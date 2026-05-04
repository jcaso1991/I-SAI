"""
Backend tests for the new 'Gestor del proyecto' (manager) feature on events.
Targets: http://localhost:8001/api

Covers:
1) GET /api/managers (auth, admin-only filter, sorted)
2) POST /api/events with manager_id (valid, none, bogus)
3) PATCH /api/events/{id} with manager_id (set/unset)
4) GET /api/events list includes manager fields; recurrence occurrences too
5) Regression: event attachments POST/GET/DELETE; budget PDF endpoints
Cleanup at end.
"""
import base64
import os
import sys
import time
import uuid
import requests
from datetime import datetime, timezone, timedelta

BASE = "http://localhost:8001/api"
ADMIN_EMAIL = os.environ.get("DEMO_ADMIN_EMAIL", "admin@materiales.com")
ADMIN_PASSWORD = os.environ["DEMO_ADMIN_PASSWORD"]

pass_count = 0
fail_count = 0
failures = []


def _log(ok, name, detail=""):
    global pass_count, fail_count
    icon = "✅" if ok else "❌"
    print(f"{icon} {name}" + (f" — {detail}" if detail else ""))
    if ok:
        pass_count += 1
    else:
        fail_count += 1
        failures.append(f"{name}: {detail}")


def login(email, password):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"], r.json()["user"]


def h(token):
    return {"Authorization": f"Bearer {token}"}


def main():
    # --- Login admin ---
    admin_token, admin_user = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    _log(True, "Login admin", f"id={admin_user['id']}, role={admin_user['role']}")

    created_user_ids = []
    created_event_ids = []
    created_budget_ids = []

    try:
        # ================== (1) GET /api/managers ==================
        # No token → 401
        r = requests.get(f"{BASE}/managers", timeout=10)
        _log(r.status_code == 401, "GET /api/managers without token → 401", f"status={r.status_code}")

        # With admin token
        r = requests.get(f"{BASE}/managers", headers=h(admin_token), timeout=10)
        _log(r.status_code == 200, "GET /api/managers with admin → 200", f"status={r.status_code}")
        managers_initial = r.json()
        _log(isinstance(managers_initial, list) and len(managers_initial) >= 1,
             "managers list contains at least seeded admin",
             f"count={len(managers_initial)}")
        for m in managers_initial:
            if not {"id", "name", "email"}.issubset(m.keys()):
                _log(False, "manager item shape", f"missing keys in {m}")
                break
        else:
            _log(True, "manager items have id/name/email")

        # Create a second admin
        unique = uuid.uuid4().hex[:8]
        new_admin_email = f"gestor.alberto.{unique}@materiales.com"
        r = requests.post(f"{BASE}/users", headers=h(admin_token), json={
            "email": new_admin_email,
            "password": "Gestor1234",
            "name": "Alberto García",
            "role": "admin",
        }, timeout=10)
        _log(r.status_code == 200, "POST /api/users create second admin", f"status={r.status_code}, body={r.text[:120]}")
        new_admin = r.json()
        created_user_ids.append(new_admin["id"])

        # Create a non-admin (comercial)
        comercial_email = f"comercial.laura.{unique}@materiales.com"
        r = requests.post(f"{BASE}/users", headers=h(admin_token), json={
            "email": comercial_email,
            "password": "Comer1234",
            "name": "Laura Sánchez",
            "role": "comercial",
        }, timeout=10)
        _log(r.status_code == 200, "POST /api/users create comercial (non-admin)", f"status={r.status_code}")
        comercial_user = r.json()
        created_user_ids.append(comercial_user["id"])

        # Create another non-admin (user)
        tech_email = f"tecnico.juan.{unique}@materiales.com"
        r = requests.post(f"{BASE}/users", headers=h(admin_token), json={
            "email": tech_email,
            "password": "Tec1234567",
            "name": "Juan Pérez",
            "role": "user",
        }, timeout=10)
        _log(r.status_code == 200, "POST /api/users create user (non-admin)", f"status={r.status_code}")
        tech_user = r.json()
        created_user_ids.append(tech_user["id"])

        # GET /api/managers should contain new admin, not comercial nor user
        r = requests.get(f"{BASE}/managers", headers=h(admin_token), timeout=10)
        managers_now = r.json()
        manager_ids = {m["id"] for m in managers_now}
        _log(new_admin["id"] in manager_ids,
             "new admin appears in /api/managers",
             f"present={new_admin['id'] in manager_ids}, count={len(managers_now)}")
        _log(comercial_user["id"] not in manager_ids,
             "comercial does NOT appear in /api/managers")
        _log(tech_user["id"] not in manager_ids,
             "regular user does NOT appear in /api/managers")

        # Sorted by name/email lowercase
        names = [(m.get("name") or m.get("email") or "").lower() for m in managers_now]
        _log(names == sorted(names), "managers list is sorted by name/email", f"names={names}")

        # Auth: any logged-in (non-admin) user can call /api/managers
        tech_token, _ = login(tech_email, "Tec1234567")
        r = requests.get(f"{BASE}/managers", headers=h(tech_token), timeout=10)
        _log(r.status_code == 200, "GET /api/managers as non-admin user → 200", f"status={r.status_code}")

        # ================== (2) POST /api/events with manager_id ==================
        now = datetime.now(timezone.utc).replace(microsecond=0)
        start_at = (now + timedelta(days=1)).isoformat().replace("+00:00", "Z")
        end_at = (now + timedelta(days=1, hours=2)).isoformat().replace("+00:00", "Z")

        # a) Valid manager_id (new_admin)
        r = requests.post(f"{BASE}/events", headers=h(admin_token), json={
            "title": "Instalación Salto XS4 - Sede Central",
            "start_at": start_at,
            "end_at": end_at,
            "description": "Montaje de cilindros",
            "manager_id": new_admin["id"],
            "assigned_user_ids": [tech_user["id"]],
        }, timeout=10)
        _log(r.status_code == 200, "POST event with valid manager_id", f"status={r.status_code}, body={r.text[:150]}")
        ev_with_mgr = r.json()
        created_event_ids.append(ev_with_mgr["id"])
        _log(ev_with_mgr.get("manager_id") == new_admin["id"],
             "event has manager_id set",
             f"got={ev_with_mgr.get('manager_id')}")
        mgr = ev_with_mgr.get("manager")
        _log(isinstance(mgr, dict) and mgr.get("id") == new_admin["id"],
             "event.manager is populated object with id matching",
             f"manager={mgr}")
        if isinstance(mgr, dict):
            required_keys = {"id", "email", "name", "color", "role"}
            _log(required_keys.issubset(set(mgr.keys())),
                 "manager object has id/email/name/color/role",
                 f"keys={list(mgr.keys())}")
            _log(mgr.get("role") == "admin",
                 "manager.role is admin",
                 f"role={mgr.get('role')}")

        # b) No manager_id
        r = requests.post(f"{BASE}/events", headers=h(admin_token), json={
            "title": "Revisión Proyecto Torre Picasso",
            "start_at": start_at,
            "end_at": end_at,
        }, timeout=10)
        _log(r.status_code == 200, "POST event WITHOUT manager_id", f"status={r.status_code}")
        ev_no_mgr = r.json()
        created_event_ids.append(ev_no_mgr["id"])
        _log(ev_no_mgr.get("manager_id") is None,
             "event.manager_id is null when not provided",
             f"got={ev_no_mgr.get('manager_id')}")
        _log(ev_no_mgr.get("manager") is None,
             "event.manager is null when not provided",
             f"got={ev_no_mgr.get('manager')}")

        # c) Bogus manager_id
        bogus = str(uuid.uuid4())
        r = requests.post(f"{BASE}/events", headers=h(admin_token), json={
            "title": "Evento con gestor inexistente",
            "start_at": start_at,
            "end_at": end_at,
            "manager_id": bogus,
        }, timeout=10)
        _log(r.status_code == 200,
             "POST event with bogus manager_id still creates event",
             f"status={r.status_code}, body={r.text[:200]}")
        ev_bogus = r.json()
        created_event_ids.append(ev_bogus["id"])
        _log(ev_bogus.get("manager_id") == bogus,
             "bogus manager_id stored as-is",
             f"got={ev_bogus.get('manager_id')}")
        _log(ev_bogus.get("manager") is None,
             "event.manager is null for bogus manager_id",
             f"got={ev_bogus.get('manager')}")

        # ================== (3) PATCH /api/events/{id} with manager_id ==================
        # Set manager_id on ev_no_mgr
        r = requests.patch(f"{BASE}/events/{ev_no_mgr['id']}", headers=h(admin_token), json={
            "manager_id": new_admin["id"],
        }, timeout=10)
        _log(r.status_code == 200, "PATCH event set manager_id to admin", f"status={r.status_code}")
        patched = r.json()
        _log(patched.get("manager_id") == new_admin["id"],
             "PATCH response reflects manager_id",
             f"got={patched.get('manager_id')}")
        _log(isinstance(patched.get("manager"), dict) and patched["manager"].get("id") == new_admin["id"],
             "PATCH response has populated manager object",
             f"manager={patched.get('manager')}")

        # Now PATCH manager_id to null (unset)
        # Because pydantic EventPatch uses None to mean "not provided", we need to verify
        # unset semantics. The PATCH code filters out None values (skips update),
        # so setting to None via JSON will NOT clear it. Let's test what happens.
        # The spec says: "Update event with manager_id=null → assert manager=null, manager_id=null".
        # This is a potential issue if the backend skips None values.
        r = requests.patch(f"{BASE}/events/{patched['id']}", headers=h(admin_token), json={
            "manager_id": None,
        }, timeout=10)
        # Check both possibilities
        if r.status_code == 400:
            _log(False,
                 "PATCH manager_id=null should clear but got 400 ('Nada que actualizar')",
                 "Backend skips None fields in PATCH, so manager_id cannot be cleared via PATCH")
        else:
            _log(r.status_code == 200, "PATCH event unset manager_id", f"status={r.status_code}")
            cleared = r.json()
            _log(cleared.get("manager_id") is None,
                 "PATCH with manager_id=null clears manager_id",
                 f"got={cleared.get('manager_id')}")
            _log(cleared.get("manager") is None,
                 "PATCH with manager_id=null clears manager object",
                 f"got={cleared.get('manager')}")

        # ================== (4) GET /api/events list includes manager fields ==================
        # Create a recurring event with manager
        rec_start = (now + timedelta(days=2)).isoformat().replace("+00:00", "Z")
        rec_end = (now + timedelta(days=2, hours=1)).isoformat().replace("+00:00", "Z")
        until_date = (now + timedelta(days=16)).date().isoformat()
        r = requests.post(f"{BASE}/events", headers=h(admin_token), json={
            "title": "Mantenimiento semanal",
            "start_at": rec_start,
            "end_at": rec_end,
            "manager_id": new_admin["id"],
            "recurrence": {"type": "weekly", "until": until_date},
        }, timeout=10)
        _log(r.status_code == 200, "POST weekly recurring event with manager", f"status={r.status_code}")
        ev_rec = r.json()
        created_event_ids.append(ev_rec["id"])

        # Fetch with window covering at least 2 occurrences
        from_iso = now.isoformat().replace("+00:00", "Z")
        to_iso = (now + timedelta(days=25)).isoformat().replace("+00:00", "Z")
        r = requests.get(f"{BASE}/events",
                         headers=h(admin_token),
                         params={"from": from_iso, "to": to_iso},
                         timeout=10)
        _log(r.status_code == 200, "GET /api/events range", f"status={r.status_code}")
        all_events = r.json()
        # Every event must have manager_id and manager key present (may be null)
        for ev in all_events:
            if "manager_id" not in ev or "manager" not in ev:
                _log(False, "every listed event has manager_id/manager keys",
                     f"event id={ev.get('id')} keys={list(ev.keys())[:20]}")
                break
        else:
            _log(True, f"all {len(all_events)} listed events include manager_id/manager fields")

        # Find recurrence occurrences (virtual ids contain ':')
        occurrences = [e for e in all_events if e.get("base_event_id") == ev_rec["id"]]
        _log(len(occurrences) >= 2,
             "weekly recurrence expanded to multiple occurrences",
             f"count={len(occurrences)}")
        # Each occurrence should preserve manager_id and have populated manager
        for occ in occurrences:
            ok = (occ.get("manager_id") == new_admin["id"]
                  and isinstance(occ.get("manager"), dict)
                  and occ["manager"].get("id") == new_admin["id"])
            if not ok:
                _log(False, "recurrence occurrence preserves manager",
                     f"occ id={occ.get('id')}, manager_id={occ.get('manager_id')}, manager={occ.get('manager')}")
                break
        else:
            if occurrences:
                _log(True, f"all {len(occurrences)} recurrence occurrences preserve manager_id/manager")

        # Verify ev_bogus also listed and has manager=null
        bogus_in_list = next((e for e in all_events if e.get("id") == ev_bogus["id"]), None)
        _log(bogus_in_list is not None and bogus_in_list.get("manager") is None,
             "event with bogus manager_id still listed; manager is null",
             f"found={bogus_in_list is not None}")

        # ================== (5) Regression: GET event by... well GET /api/events/{id} doesn't exist
        # The review mentions "GET /api/events/{id}" returning manager — let's try it.
        r = requests.get(f"{BASE}/events/{ev_with_mgr['id']}", headers=h(admin_token), timeout=10)
        if r.status_code == 404:
            print(f"  (info) No single-event GET endpoint /api/events/{{id}} exists (404) — using list to validate instead.")
            # That's fine: we already validated via list.
        elif r.status_code == 200:
            single = r.json()
            _log(single.get("manager_id") == new_admin["id"],
                 "GET /api/events/{id} returns manager_id",
                 f"got={single.get('manager_id')}")

        # ================== Regression: Event attachments ==================
        # Upload small PDF to ev_with_mgr
        pdf_bytes = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\nxref\n0 3\n0000000000 65535 f\n0000000015 00000 n\n0000000057 00000 n\ntrailer<</Size 3/Root 1 0 R>>\nstartxref\n100\n%%EOF"
        b64 = base64.b64encode(pdf_bytes).decode()
        r = requests.post(f"{BASE}/events/{ev_with_mgr['id']}/attachments",
                          headers=h(admin_token),
                          json={"filename": "croquis_central.pdf",
                                "mime_type": "application/pdf",
                                "base64": b64},
                          timeout=10)
        _log(r.status_code == 200, "POST event attachment (regression)", f"status={r.status_code}, body={r.text[:120]}")
        att = r.json() if r.status_code == 200 else {}
        aid = att.get("id")

        if aid:
            r = requests.get(f"{BASE}/events/{ev_with_mgr['id']}/attachments/{aid}",
                             headers=h(admin_token), timeout=10)
            _log(r.status_code == 200 and r.json().get("base64") == b64,
                 "GET event attachment returns base64 (regression)",
                 f"status={r.status_code}")

            r = requests.delete(f"{BASE}/events/{ev_with_mgr['id']}/attachments/{aid}",
                                headers=h(admin_token), timeout=10)
            _log(r.status_code == 200, "DELETE event attachment (regression)", f"status={r.status_code}")

        # ================== Regression: Budget PDF endpoints ==================
        r = requests.post(f"{BASE}/budgets", headers=h(admin_token), json={
            "n_proyecto": f"P-MGR-{unique}",
            "cliente": "ACME Seguridad",
            "nombre_instalacion": "Sede Central",
            "equipos": [{"elemento": "Cilindro Salto XS4", "cantidad": "3", "ubicacion": "Puerta principal"}],
        }, timeout=15)
        _log(r.status_code == 200, "POST /api/budgets (regression)", f"status={r.status_code}")
        if r.status_code == 200:
            b = r.json()
            created_budget_ids.append(b["id"])
            r2 = requests.get(f"{BASE}/budgets/{b['id']}/pdf", headers=h(admin_token), timeout=30)
            _log(r2.status_code == 200 and r2.content[:5] == b"%PDF-",
                 "GET /api/budgets/{id}/pdf returns PDF (regression)",
                 f"status={r2.status_code}, len={len(r2.content)}")
            r3 = requests.post(f"{BASE}/budgets/pdf-preview", headers=h(admin_token),
                               json={"n_proyecto": f"PREV-{unique}"}, timeout=30)
            _log(r3.status_code == 200 and r3.content[:5] == b"%PDF-",
                 "POST /api/budgets/pdf-preview returns PDF (regression)",
                 f"status={r3.status_code}, len={len(r3.content)}")

    finally:
        # ================== Cleanup ==================
        print("\n--- Cleanup ---")
        for eid in created_event_ids:
            try:
                r = requests.delete(f"{BASE}/events/{eid}", headers=h(admin_token), timeout=10)
                print(f"  event {eid[:8]}… del={r.status_code}")
            except Exception as e:
                print(f"  event {eid[:8]}… del FAILED: {e}")
        for bid in created_budget_ids:
            try:
                r = requests.delete(f"{BASE}/budgets/{bid}", headers=h(admin_token), timeout=10)
                print(f"  budget {bid[:8]}… del={r.status_code}")
            except Exception as e:
                print(f"  budget {bid[:8]}… del FAILED: {e}")
        for uid in created_user_ids:
            try:
                r = requests.delete(f"{BASE}/users/{uid}", headers=h(admin_token), timeout=10)
                print(f"  user {uid[:8]}… del={r.status_code}")
            except Exception as e:
                print(f"  user {uid[:8]}… del FAILED: {e}")

    print("\n==========================")
    print(f"PASSED: {pass_count}")
    print(f"FAILED: {fail_count}")
    if failures:
        print("\nFailures:")
        for f in failures:
            print(f"  - {f}")
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
