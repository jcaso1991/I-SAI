"""
Backend tests for CRM SAT endpoints (iteration 15).

Endpoints under test:
  - POST   /api/sat/public                (public, no auth)
  - GET    /api/sat/incidents             (auth)
  - GET    /api/sat/incidents/{id}        (auth)
  - PATCH  /api/sat/incidents/{id}        (auth)
  - DELETE /api/sat/incidents/{id}        (admin only)
"""

import os
import sys
import time
import requests
from typing import List

BASE = "https://excel-form-sync-1.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@materiales.com"
ADMIN_PASS = "Admin1234"

created_incident_ids: List[str] = []
created_user_ids: List[str] = []
created_notification_ids_by_admin: List[str] = []  # cleanup notifications

assertions_passed = 0
assertions_failed = 0
failures: List[str] = []


def check(cond: bool, msg: str):
    global assertions_passed, assertions_failed
    if cond:
        assertions_passed += 1
        print(f"  PASS: {msg}")
    else:
        assertions_failed += 1
        failures.append(msg)
        print(f"  FAIL: {msg}")


def login(email: str, password: str) -> str:
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def H(token: str):
    return {"Authorization": f"Bearer {token}"}


def main():
    global created_incident_ids, created_user_ids

    print("\n=== Logging in admin ===")
    admin_token = login(ADMIN_EMAIL, ADMIN_PASS)
    print("  Admin token OK")

    # ---------------------------------------------------------------
    # Clean up any leftover SAT notifications for admin before tests
    # ---------------------------------------------------------------
    before_notifs = requests.get(f"{BASE}/notifications", headers=H(admin_token), timeout=30).json()
    pre_sat_ids = {n["id"] for n in before_notifs.get("items", []) if n.get("type") == "sat_new"}
    print(f"  Pre-existing admin sat_new notifications: {len(pre_sat_ids)}")

    # ------------------------------------------------------------------
    # 1) POST /api/sat/public — public, no auth required
    # ------------------------------------------------------------------
    print("\n=== 1) POST /api/sat/public (public) ===")

    # 1a) Happy path WITHOUT Authorization header.
    body_ok = {
        "cliente": "Acme Industrial S.L.",
        "direccion": "Calle Mayor 12, Madrid",
        "telefono": "+34 910 123 456",
        "observaciones": "El lector de acceso principal se queda bloqueado cada vez que se reinicia el router. Necesitamos revisión urgente.",
    }
    r = requests.post(f"{BASE}/sat/public", json=body_ok, timeout=30)
    check(r.status_code == 200, f"POST /sat/public without auth returns 200 (got {r.status_code}; body={r.text[:200]})")
    data = r.json() if r.status_code == 200 else {}
    check(data.get("ok") is True, "Response has ok:true")
    inc_id_1 = data.get("id")
    check(bool(inc_id_1) and isinstance(inc_id_1, str) and len(inc_id_1) >= 20,
          f"Response returns uuid id (got {inc_id_1!r})")
    if inc_id_1:
        created_incident_ids.append(inc_id_1)

    # 1b) A second incident, also public.
    body_ok_2 = {
        "cliente": "Bodegas Rioja Alta",
        "direccion": "Avenida del Vino 45, Haro",
        "telefono": "",
        "observaciones": "Falla intermitente del intercomunicador exterior. Se escucha con ruido.",
    }
    r = requests.post(f"{BASE}/sat/public", json=body_ok_2, timeout=30)
    check(r.status_code == 200, "Second public POST 200")
    inc_id_2 = r.json().get("id") if r.status_code == 200 else None
    if inc_id_2:
        created_incident_ids.append(inc_id_2)

    # 1c) Missing `cliente` → 422
    r = requests.post(f"{BASE}/sat/public", json={
        "direccion": "", "telefono": "", "observaciones": "Observación sin cliente",
    }, timeout=30)
    check(r.status_code == 422, f"Missing cliente → 422 (got {r.status_code})")

    # 1d) Missing `observaciones` → 422
    r = requests.post(f"{BASE}/sat/public", json={
        "cliente": "Alguien", "direccion": "", "telefono": "",
    }, timeout=30)
    check(r.status_code == 422, f"Missing observaciones → 422 (got {r.status_code})")

    # 1e) Empty strings → 422 (Field min_length=1)
    r = requests.post(f"{BASE}/sat/public", json={
        "cliente": "", "observaciones": "x",
    }, timeout=30)
    check(r.status_code == 422, f"Empty cliente → 422 (got {r.status_code})")

    r = requests.post(f"{BASE}/sat/public", json={
        "cliente": "x", "observaciones": "",
    }, timeout=30)
    check(r.status_code == 422, f"Empty observaciones → 422 (got {r.status_code})")

    # 1f) Notifications auto-created for all admin users
    # List admin users
    admins_res = requests.get(f"{BASE}/users", headers=H(admin_token), timeout=30)
    check(admins_res.status_code == 200, "GET /users returns 200 for admin")
    admin_ids = [u["id"] for u in admins_res.json() if u.get("role") == "admin"]
    check(len(admin_ids) >= 1, f"At least one admin user exists ({len(admin_ids)})")

    # Admin should have at least 2 new sat_new notifications (from our 2 incidents).
    after_notifs = requests.get(f"{BASE}/notifications", headers=H(admin_token), timeout=30).json()
    admin_sat = [n for n in after_notifs.get("items", []) if n.get("type") == "sat_new"]
    new_sat = [n for n in admin_sat if n["id"] not in pre_sat_ids]
    # Track for cleanup
    matching_for_inc1 = [n for n in new_sat if body_ok["cliente"] in (n.get("title") or "")]
    matching_for_inc2 = [n for n in new_sat if body_ok_2["cliente"] in (n.get("title") or "")]
    check(len(matching_for_inc1) >= 1, f"Admin got a sat_new notification for incident 1 (found {len(matching_for_inc1)})")
    check(len(matching_for_inc2) >= 1, f"Admin got a sat_new notification for incident 2 (found {len(matching_for_inc2)})")
    if matching_for_inc1:
        n = matching_for_inc1[0]
        check(n.get("read") is False, "Notification starts unread")
        check("aviso SAT" in (n.get("title") or "").lower() or "Nuevo aviso SAT" in (n.get("title") or ""),
              f"Title mentions new SAT (got {n.get('title')!r})")
        check(body_ok["cliente"] in (n.get("title") or ""),
              f"Title contains cliente name (got {n.get('title')!r})")

    # ------------------------------------------------------------------
    # 2) GET /api/sat/incidents
    # ------------------------------------------------------------------
    print("\n=== 2) GET /api/sat/incidents ===")

    # No auth → 401/403
    r = requests.get(f"{BASE}/sat/incidents", timeout=30)
    check(r.status_code in (401, 403), f"GET /sat/incidents without token → 401/403 (got {r.status_code})")

    # Admin list
    r = requests.get(f"{BASE}/sat/incidents", headers=H(admin_token), timeout=30)
    check(r.status_code == 200, f"GET /sat/incidents admin 200 (got {r.status_code})")
    rows = r.json() if r.status_code == 200 else []
    check(isinstance(rows, list), "Response is a list")
    ids_in_list = {x["id"] for x in rows}
    check(inc_id_1 in ids_in_list, "Incident 1 appears in list")
    check(inc_id_2 in ids_in_list, "Incident 2 appears in list")

    # Newest-first sort: incident 2 was created AFTER incident 1,
    # so its index should be smaller (closer to top) than incident 1.
    idx1 = next((i for i, x in enumerate(rows) if x["id"] == inc_id_1), -1)
    idx2 = next((i for i, x in enumerate(rows) if x["id"] == inc_id_2), -1)
    check(idx2 >= 0 and idx1 >= 0 and idx2 < idx1,
          f"Newest-first ordering: inc2 idx={idx2} < inc1 idx={idx1}")

    # Also: every created_at (descending) should be monotonically non-increasing
    # for the top N items.
    top = rows[:5]
    sorted_desc = sorted(top, key=lambda x: x.get("created_at") or "", reverse=True)
    check(top == sorted_desc, "Top results sorted by created_at desc")

    # Default status on creation = "pendiente"
    inc1_row = next((x for x in rows if x["id"] == inc_id_1), None)
    check(inc1_row is not None and inc1_row.get("status") == "pendiente",
          f"Newly created incident has status=pendiente (got {inc1_row and inc1_row.get('status')})")
    check(inc1_row and inc1_row.get("resolved_at") is None, "resolved_at is None on new incident")
    check(inc1_row and inc1_row.get("resolved_by") is None, "resolved_by is None on new incident")
    check(inc1_row and inc1_row.get("cliente") == body_ok["cliente"], "cliente persisted")
    check(inc1_row and inc1_row.get("observaciones") == body_ok["observaciones"], "observaciones persisted")
    check(inc1_row and inc1_row.get("comentarios_sat") == "", "comentarios_sat defaults to empty string")

    # status=pendiente filter
    r = requests.get(f"{BASE}/sat/incidents", headers=H(admin_token), params={"status": "pendiente"}, timeout=30)
    check(r.status_code == 200, "status=pendiente filter 200")
    pend = r.json() if r.status_code == 200 else []
    check(all(x.get("status") == "pendiente" for x in pend),
          f"All items in pendiente filter have status=pendiente ({len(pend)} items)")
    check(inc_id_1 in {x["id"] for x in pend}, "Incident 1 in pendiente filter")

    # status=resuelta filter (no resueltas yet, at least our incidents shouldn't be there)
    r = requests.get(f"{BASE}/sat/incidents", headers=H(admin_token), params={"status": "resuelta"}, timeout=30)
    check(r.status_code == 200, "status=resuelta filter 200")
    res_rows = r.json() if r.status_code == 200 else []
    check(all(x.get("status") == "resuelta" for x in res_rows),
          f"All items in resuelta filter have status=resuelta ({len(res_rows)} items)")
    check(inc_id_1 not in {x["id"] for x in res_rows}, "Incident 1 NOT in resuelta filter (still pending)")

    # Invalid status value — just ignored (filter not applied)
    r = requests.get(f"{BASE}/sat/incidents", headers=H(admin_token), params={"status": "garbage"}, timeout=30)
    check(r.status_code == 200, "Invalid status value ignored → 200")

    # ------------------------------------------------------------------
    # 3) GET /api/sat/incidents/{id}
    # ------------------------------------------------------------------
    print("\n=== 3) GET /api/sat/incidents/{id} ===")

    r = requests.get(f"{BASE}/sat/incidents/{inc_id_1}", headers=H(admin_token), timeout=30)
    check(r.status_code == 200, f"GET single incident 200 (got {r.status_code})")
    single = r.json() if r.status_code == 200 else {}
    check(single.get("id") == inc_id_1, "Returned id matches")
    check(single.get("cliente") == body_ok["cliente"], "cliente matches")
    check(single.get("status") == "pendiente", "status is pendiente")

    # 404 on unknown id
    r = requests.get(f"{BASE}/sat/incidents/does-not-exist-uuid-00000000", headers=H(admin_token), timeout=30)
    check(r.status_code == 404, f"GET unknown id → 404 (got {r.status_code})")

    # No auth → 401
    r = requests.get(f"{BASE}/sat/incidents/{inc_id_1}", timeout=30)
    check(r.status_code in (401, 403), f"GET single without token → 401 (got {r.status_code})")

    # ------------------------------------------------------------------
    # 4) PATCH /api/sat/incidents/{id}
    # ------------------------------------------------------------------
    print("\n=== 4) PATCH /api/sat/incidents/{id} ===")

    # 4a) Patch subset of editable fields
    patch_body_1 = {
        "direccion": "Calle Nueva 88, Madrid",
        "telefono": "+34 699 000 111",
        "comentarios_sat": "Técnico asignado: Juan. Pieza pedida al proveedor.",
    }
    r = requests.patch(f"{BASE}/sat/incidents/{inc_id_1}", headers=H(admin_token), json=patch_body_1, timeout=30)
    check(r.status_code == 200, f"PATCH subset 200 (got {r.status_code}; body={r.text[:200]})")
    doc = r.json() if r.status_code == 200 else {}
    check(doc.get("direccion") == patch_body_1["direccion"], "direccion updated")
    check(doc.get("telefono") == patch_body_1["telefono"], "telefono updated")
    check(doc.get("comentarios_sat") == patch_body_1["comentarios_sat"], "comentarios_sat updated")
    check(doc.get("cliente") == body_ok["cliente"], "cliente left unchanged")
    check(doc.get("status") == "pendiente", "status still pendiente")
    check(doc.get("resolved_at") is None, "resolved_at still None")

    # 4b) Set status=resuelta → resolved_at + resolved_by filled
    r = requests.patch(f"{BASE}/sat/incidents/{inc_id_1}", headers=H(admin_token), json={"status": "resuelta"}, timeout=30)
    check(r.status_code == 200, f"PATCH status=resuelta 200 (got {r.status_code})")
    doc = r.json() if r.status_code == 200 else {}
    check(doc.get("status") == "resuelta", "status now resuelta")
    check(doc.get("resolved_at") is not None and "T" in str(doc.get("resolved_at")),
          f"resolved_at set to ISO datetime (got {doc.get('resolved_at')!r})")
    check(doc.get("resolved_by") == admin_ids[0] or doc.get("resolved_by") in admin_ids,
          f"resolved_by set to admin id (got {doc.get('resolved_by')!r})")

    # 4c) Patch again with status=resuelta → resolved_at should NOT change
    #     (per spec: only fills when status wasn't already resuelta).
    prev_resolved_at = doc.get("resolved_at")
    time.sleep(0.5)
    r = requests.patch(f"{BASE}/sat/incidents/{inc_id_1}", headers=H(admin_token),
                       json={"status": "resuelta", "comentarios_sat": "Cerrada y validada."}, timeout=30)
    check(r.status_code == 200, "PATCH status=resuelta (already resuelta) 200")
    doc = r.json() if r.status_code == 200 else {}
    check(doc.get("resolved_at") == prev_resolved_at,
          f"resolved_at unchanged when re-setting to resuelta (prev={prev_resolved_at}, now={doc.get('resolved_at')})")

    # 4d) Switch back to pendiente → resolved_at/by reset to null
    r = requests.patch(f"{BASE}/sat/incidents/{inc_id_1}", headers=H(admin_token), json={"status": "pendiente"}, timeout=30)
    check(r.status_code == 200, "PATCH back to pendiente 200")
    doc = r.json() if r.status_code == 200 else {}
    check(doc.get("status") == "pendiente", "status back to pendiente")
    check(doc.get("resolved_at") is None, f"resolved_at reset to null (got {doc.get('resolved_at')!r})")
    check(doc.get("resolved_by") is None, f"resolved_by reset to null (got {doc.get('resolved_by')!r})")

    # 4e) No auth → 401
    r = requests.patch(f"{BASE}/sat/incidents/{inc_id_1}", json={"cliente": "x"}, timeout=30)
    check(r.status_code in (401, 403), f"PATCH without token → 401 (got {r.status_code})")

    # 4f) 404 on unknown id
    r = requests.patch(f"{BASE}/sat/incidents/definitely-not-existing",
                       headers=H(admin_token), json={"cliente": "y"}, timeout=30)
    check(r.status_code == 404, f"PATCH unknown id → 404 (got {r.status_code})")

    # ------------------------------------------------------------------
    # 5) DELETE /api/sat/incidents/{id} — admin only
    # ------------------------------------------------------------------
    print("\n=== 5) DELETE /api/sat/incidents/{id} ===")

    # Create a non-admin temp user
    nonadmin_email = f"sattest.nonadmin.{int(time.time())}@materiales.com"
    nonadmin_pass = "Tester1234!"
    r = requests.post(f"{BASE}/users", headers=H(admin_token),
                      json={"email": nonadmin_email, "password": nonadmin_pass,
                            "name": "SAT Non Admin", "role": "user"}, timeout=30)
    check(r.status_code == 200, f"Create non-admin test user 200 (got {r.status_code}; body={r.text[:200]})")
    if r.status_code == 200:
        uid = r.json()["id"]
        created_user_ids.append(uid)
        nonadmin_token = login(nonadmin_email, nonadmin_pass)

        # Non-admin DELETE → 403
        r = requests.delete(f"{BASE}/sat/incidents/{inc_id_2}", headers=H(nonadmin_token), timeout=30)
        check(r.status_code == 403, f"Non-admin DELETE → 403 (got {r.status_code})")

        # Non-admin can still GET
        r = requests.get(f"{BASE}/sat/incidents/{inc_id_2}", headers=H(nonadmin_token), timeout=30)
        check(r.status_code == 200, f"Non-admin GET single 200 (got {r.status_code})")

    # No token DELETE → 401/403
    r = requests.delete(f"{BASE}/sat/incidents/{inc_id_2}", timeout=30)
    check(r.status_code in (401, 403), f"DELETE without token → 401 (got {r.status_code})")

    # Admin DELETE → 200
    r = requests.delete(f"{BASE}/sat/incidents/{inc_id_2}", headers=H(admin_token), timeout=30)
    check(r.status_code == 200, f"Admin DELETE 200 (got {r.status_code})")
    body = r.json() if r.status_code == 200 else {}
    check(body.get("ok") is True, f"DELETE returns ok:true (got {body!r})")
    if r.status_code == 200 and inc_id_2 in created_incident_ids:
        created_incident_ids.remove(inc_id_2)

    # Second DELETE of the same id → 404
    r = requests.delete(f"{BASE}/sat/incidents/{inc_id_2}", headers=H(admin_token), timeout=30)
    check(r.status_code == 404, f"DELETE unknown id → 404 (got {r.status_code})")

    # Admin DELETE of non-existing uuid → 404
    r = requests.delete(f"{BASE}/sat/incidents/ghost-id-0000", headers=H(admin_token), timeout=30)
    check(r.status_code == 404, f"DELETE ghost id → 404 (got {r.status_code})")


def cleanup():
    """Remove all incidents, notifications (sat_new type) and temp users created by the test."""
    print("\n=== Cleanup ===")
    try:
        admin_token = login(ADMIN_EMAIL, ADMIN_PASS)
    except Exception as e:
        print(f"  Cleanup login failed: {e}")
        return

    # Delete remaining incidents
    for iid in created_incident_ids[:]:
        try:
            r = requests.delete(f"{BASE}/sat/incidents/{iid}", headers=H(admin_token), timeout=30)
            print(f"  DELETE incident {iid} → {r.status_code}")
        except Exception as e:
            print(f"  DELETE incident {iid} err: {e}")

    # Delete ALL SAT notifications of admin (cleanest approach)
    try:
        notifs = requests.get(f"{BASE}/notifications", headers=H(admin_token), timeout=30).json()
        for n in notifs.get("items", []):
            if n.get("type") == "sat_new":
                rr = requests.delete(f"{BASE}/notifications/{n['id']}", headers=H(admin_token), timeout=30)
                print(f"  DELETE notif {n['id']} → {rr.status_code}")
    except Exception as e:
        print(f"  Cleanup notifications err: {e}")

    # Delete temp users
    for uid in created_user_ids:
        try:
            r = requests.delete(f"{BASE}/users/{uid}", headers=H(admin_token), timeout=30)
            print(f"  DELETE user {uid} → {r.status_code}")
        except Exception as e:
            print(f"  DELETE user {uid} err: {e}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        import traceback
        traceback.print_exc()
        failures.append(f"Unhandled exception: {e}")
        assertions_failed += 1
    finally:
        cleanup()

    print("\n" + "=" * 60)
    print(f"RESULTS: {assertions_passed} passed, {assertions_failed} failed")
    if failures:
        print("\nFailures:")
        for f in failures:
            print(f"  - {f}")
    sys.exit(0 if assertions_failed == 0 else 1)
