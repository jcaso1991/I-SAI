"""
Backend tests for event status + notifications endpoints (iteration 13).
Targets /app/backend/server.py endpoints:
 - POST /api/events (default status=in_progress)
 - PATCH /api/events/{id} (admin + technician restrictions)
 - GET/POST/DELETE /api/notifications*
"""
import os
import sys
import time
from datetime import datetime, timezone, timedelta
import requests

BASE_URL = "https://excel-form-sync-1.preview.emergentagent.com/api"
ADMIN_EMAIL = os.environ.get("DEMO_ADMIN_EMAIL", "admin@materiales.com")
ADMIN_PASSWORD = os.environ["DEMO_ADMIN_PASSWORD"]

TECH_EMAIL = "tec.test@materiales.com"
TECH_PASSWORD = "Test1234"
TECH_NAME = "Técnico Test"

OTHER_EMAIL = "otro.tec@materiales.com"
OTHER_PASSWORD = "Otro1234"
OTHER_NAME = "Otro Tecnico"


def hdrs(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


results = []


def record(step, ok, detail=""):
    results.append((step, ok, detail))
    prefix = "PASS" if ok else "FAIL"
    print(f"[{prefix}] {step}{': ' + detail if detail else ''}")


def login(email, password):
    r = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=30)
    r.raise_for_status()
    return r.json()


def ensure_user(admin_token, email, password, name, role="user"):
    r = requests.get(f"{BASE_URL}/users", headers=hdrs(admin_token), timeout=30)
    r.raise_for_status()
    for u in r.json():
        if u.get("email", "").lower() == email.lower():
            requests.post(f"{BASE_URL}/users/{u['id']}/reset-password",
                          headers=hdrs(admin_token), json={"password": password}, timeout=30)
            if u.get("role") != role:
                requests.patch(f"{BASE_URL}/users/{u['id']}",
                               headers=hdrs(admin_token), json={"role": role}, timeout=30)
            return u["id"]
    body = {"email": email, "password": password, "name": name, "role": role, "color": "#1E88E5"}
    r = requests.post(f"{BASE_URL}/users", headers=hdrs(admin_token), json=body, timeout=30)
    r.raise_for_status()
    return r.json()["id"]


def iso(dt):
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def cleanup(admin_token, event_id, *user_ids):
    try:
        if event_id:
            requests.delete(f"{BASE_URL}/events/{event_id}", headers=hdrs(admin_token), timeout=30)
    except Exception:
        pass
    for uid in user_ids:
        try:
            if uid:
                requests.delete(f"{BASE_URL}/users/{uid}", headers=hdrs(admin_token), timeout=30)
        except Exception:
            pass


def print_summary():
    print("\n==== SUMMARY ====")
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    for step, ok, detail in results:
        tag = "PASS" if ok else "FAIL"
        print(f"  [{tag}] {step}  {detail}")
    print(f"\nTotals: {passed} PASS / {failed} FAIL / {len(results)} total")


def main():
    print(f"== BASE={BASE_URL} ==\n")

    admin = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    admin_token = admin["access_token"]
    admin_id = admin["user"]["id"]
    record("admin.login", admin["user"]["role"] == "admin", f"id={admin_id}")

    tech_id = ensure_user(admin_token, TECH_EMAIL, TECH_PASSWORD, TECH_NAME, role="user")
    record("setup.tech_user", True, f"id={tech_id}")
    other_id = ensure_user(admin_token, OTHER_EMAIL, OTHER_PASSWORD, OTHER_NAME, role="user")
    record("setup.other_user", True, f"id={other_id}")

    tech_token = login(TECH_EMAIL, TECH_PASSWORD)["access_token"]
    other_token = login(OTHER_EMAIL, OTHER_PASSWORD)["access_token"]

    # -------- 1. Admin creates event --------
    start_at = iso(datetime.now(timezone.utc) + timedelta(hours=1))
    end_at = iso(datetime.now(timezone.utc) + timedelta(hours=2))
    body = {
        "title": "Evento pruebas",
        "start_at": start_at,
        "end_at": end_at,
        "assigned_user_ids": [tech_id],
        "manager_id": admin_id,
    }
    r = requests.post(f"{BASE_URL}/events", headers=hdrs(admin_token), json=body, timeout=30)
    ok = r.status_code == 200
    created_event_id = None
    if ok:
        ev = r.json()
        created_event_id = ev["id"]
        ok = ev.get("status") == "in_progress"
        record("1.admin_create_event_default_in_progress", ok, f"id={ev['id']} status={ev.get('status')}")
    else:
        record("1.admin_create_event_default_in_progress", False, f"HTTP {r.status_code} {r.text[:200]}")
        print_summary()
        return

    # -------- 2. Tech PATCH completed --------
    r = requests.patch(f"{BASE_URL}/events/{created_event_id}",
                       headers=hdrs(tech_token), json={"status": "completed"}, timeout=30)
    ok = r.status_code == 200 and r.json().get("status") == "completed"
    record("2.tech_patch_completed",
           ok,
           f"HTTP {r.status_code} status={r.json().get('status') if r.status_code == 200 else r.text[:150]}")

    # -------- 3. Admin GET /notifications --------
    r = requests.get(f"{BASE_URL}/notifications", headers=hdrs(admin_token), timeout=30)
    if r.status_code == 200:
        payload = r.json()
        items = payload.get("items", [])
        unread = payload.get("unread", 0)
        checks = {
            "first_user_id_admin": items and items[0].get("user_id") == admin_id,
            "first_event_id_match": items and items[0].get("event_id") == created_event_id,
            "first_type_completed": items and items[0].get("type") == "event_completed",
            "first_read_false": items and items[0].get("read") is False,
            "unread_ge_1": unread >= 1,
        }
        record("3.notifications_event_completed", all(checks.values()),
               f"unread={unread} checks={checks}")
    else:
        record("3.notifications_event_completed", False, f"HTTP {r.status_code} {r.text[:200]}")

    # -------- 4. Tech invalid PATCH (title) --------
    r = requests.patch(f"{BASE_URL}/events/{created_event_id}",
                       headers=hdrs(tech_token), json={"title": "hack"}, timeout=30)
    ok = r.status_code == 403 and "Técnicos" in r.text
    record("4.tech_invalid_patch_403", ok, f"HTTP {r.status_code} body={r.text[:200]}")

    # -------- 5. Tech PATCH pending_completion + seguimiento --------
    r = requests.patch(f"{BASE_URL}/events/{created_event_id}",
                       headers=hdrs(tech_token),
                       json={"status": "pending_completion",
                             "seguimiento": "Falta cableado final"},
                       timeout=30)
    ok = r.status_code == 200 and r.json().get("status") == "pending_completion" \
        and r.json().get("seguimiento") == "Falta cableado final"
    record("5a.tech_patch_pending_completion", ok,
           f"HTTP {r.status_code} body={r.text[:250]}")

    # admin fetches notifications → new event_pending_completion
    r = requests.get(f"{BASE_URL}/notifications", headers=hdrs(admin_token), timeout=30)
    pending_notif_id = None
    completed_notif_id = None
    if r.status_code == 200:
        items = r.json().get("items", [])
        pending_notif = next((n for n in items if n.get("event_id") == created_event_id
                              and n.get("type") == "event_pending_completion"), None)
        completed_notif = next((n for n in items if n.get("event_id") == created_event_id
                                and n.get("type") == "event_completed"), None)
        if pending_notif:
            pending_notif_id = pending_notif["id"]
        if completed_notif:
            completed_notif_id = completed_notif["id"]
        msg = (pending_notif or {}).get("message", "") or ""
        ok = pending_notif is not None and "Falta cableado final" in msg
        record("5b.admin_sees_pending_notif_with_seguimiento", ok,
               f"found={pending_notif is not None} msg={msg[:120]!r}")
    else:
        record("5b.admin_sees_pending_notif_with_seguimiento", False,
               f"HTTP {r.status_code} {r.text[:200]}")

    # -------- 6. Mark-read flow --------
    if pending_notif_id:
        r = requests.post(f"{BASE_URL}/notifications/{pending_notif_id}/read",
                          headers=hdrs(admin_token), timeout=30)
        record("6a.mark_read_single_200", r.status_code == 200, f"HTTP {r.status_code}")

        r = requests.get(f"{BASE_URL}/notifications", headers=hdrs(admin_token), timeout=30)
        if r.status_code == 200:
            payload = r.json()
            this_one = next((n for n in payload.get("items", []) if n.get("id") == pending_notif_id), None)
            ok = this_one is not None and this_one.get("read") is True
            record("6b.notif_read_true", ok,
                   f"read={this_one.get('read') if this_one else None} unread={payload.get('unread')}")
        else:
            record("6b.notif_read_true", False, f"HTTP {r.status_code}")
    else:
        record("6a.mark_read_single_200", False, "skipped")

    r = requests.post(f"{BASE_URL}/notifications/read-all",
                      headers=hdrs(admin_token), timeout=30)
    record("6c.read_all_200", r.status_code == 200, f"HTTP {r.status_code}")

    r = requests.get(f"{BASE_URL}/notifications", headers=hdrs(admin_token), timeout=30)
    ok = r.status_code == 200 and r.json().get("unread", -1) == 0
    record("6d.unread_zero_after_read_all", ok,
           f"unread={r.json().get('unread') if r.status_code == 200 else r.text[:120]}")

    # Delete a specific notification
    delete_target = pending_notif_id or completed_notif_id
    if delete_target:
        r = requests.delete(f"{BASE_URL}/notifications/{delete_target}",
                            headers=hdrs(admin_token), timeout=30)
        record("6e.delete_notif_200", r.status_code == 200, f"HTTP {r.status_code}")

        r = requests.get(f"{BASE_URL}/notifications", headers=hdrs(admin_token), timeout=30)
        if r.status_code == 200:
            items = r.json().get("items", [])
            still_there = any(n.get("id") == delete_target for n in items)
            record("6f.deleted_notif_gone", not still_there, f"still={still_there}")
        else:
            record("6f.deleted_notif_gone", False, f"HTTP {r.status_code}")
    else:
        record("6e.delete_notif_200", False, "skipped")

    # -------- 7. Security / isolation --------
    remaining_notif = None
    r = requests.get(f"{BASE_URL}/notifications", headers=hdrs(admin_token), timeout=30)
    if r.status_code == 200:
        items = r.json().get("items", [])
        if items:
            remaining_notif = items[0]["id"]

    if remaining_notif:
        r = requests.post(f"{BASE_URL}/notifications/{remaining_notif}/read",
                          headers=hdrs(other_token), timeout=30)
        record("7a.other_user_mark_read_foreign_404", r.status_code == 404, f"HTTP {r.status_code}")

        r = requests.delete(f"{BASE_URL}/notifications/{remaining_notif}",
                            headers=hdrs(other_token), timeout=30)
        record("7b.other_user_delete_foreign_404", r.status_code == 404, f"HTTP {r.status_code}")

        r = requests.get(f"{BASE_URL}/notifications", headers=hdrs(other_token), timeout=30)
        if r.status_code == 200:
            items_other = r.json().get("items", [])
            leaked = any(n.get("id") == remaining_notif for n in items_other)
            ok = (not leaked) and all(n.get("user_id") == other_id for n in items_other)
            record("7c.other_user_list_isolated", ok,
                   f"count={len(items_other)} leaked={leaked}")
        else:
            record("7c.other_user_list_isolated", False, f"HTTP {r.status_code}")
    else:
        record("7a.other_user_mark_read_foreign_404", True, "skipped (no notifs)")

    # Non-assigned tech tries to PATCH event
    r = requests.patch(f"{BASE_URL}/events/{created_event_id}",
                       headers=hdrs(other_token), json={"status": "completed"}, timeout=30)
    record("7d.non_assigned_tech_patch_403", r.status_code == 403,
           f"HTTP {r.status_code} body={r.text[:150]}")

    # -------- 8. Regression: admin full PATCH --------
    r = requests.patch(f"{BASE_URL}/events/{created_event_id}",
                       headers=hdrs(admin_token),
                       json={"title": "Evento pruebas (editado)",
                             "description": "desc regresión"},
                       timeout=30)
    if r.status_code == 200:
        ev = r.json()
        ok = (ev.get("title") == "Evento pruebas (editado)"
              and ev.get("description") == "desc regresión"
              and "status" in ev and "seguimiento" in ev)
        record("8a.admin_full_patch_regression", ok,
               f"title={ev.get('title')!r} status={ev.get('status')!r} seguimiento={ev.get('seguimiento')!r}")
    else:
        record("8a.admin_full_patch_regression", False, f"HTTP {r.status_code} {r.text[:200]}")

    r = requests.get(f"{BASE_URL}/events", headers=hdrs(admin_token),
                     params={"from": iso(datetime.now(timezone.utc) - timedelta(days=1)),
                             "to": iso(datetime.now(timezone.utc) + timedelta(days=2))},
                     timeout=30)
    if r.status_code == 200:
        evs = r.json()
        found = next((e for e in evs if e.get("id") == created_event_id), None)
        ok = found is not None and "status" in found and "seguimiento" in found
        record("8b.list_events_has_new_fields", ok,
               f"found={'yes' if found else 'no'}")
    else:
        record("8b.list_events_has_new_fields", False, f"HTTP {r.status_code}")

    cleanup(admin_token, created_event_id, tech_id, other_id)
    print_summary()


if __name__ == "__main__":
    main()
