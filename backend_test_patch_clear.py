"""
Retest of PATCH /api/events/{id} after the exclude_unset fix.

Validates:
1. PATCH {"manager_id": null} -> 200, event.manager_id=null, event.manager=null.
2. PATCH {"description": null} -> 200, clears description.
3. PATCH {} -> 400 "Nada que actualizar".
4. PATCH {"title": "nuevo"} -> 200, updates title.
5. PATCH {"assigned_user_ids": []} -> 200, clears assigned users (admins-only visibility).
6. PATCH {"recurrence": null} -> 200, clears recurrence.

Credentials: admin@materiales.com / Admin1234.
Base URL: http://localhost:8001/api
Cleanup: deletes all events and test users it created.
"""

import sys
import uuid
import json
import requests
from datetime import datetime, timedelta, timezone

BASE = "http://localhost:8001/api"
ADMIN_EMAIL = "admin@materiales.com"
ADMIN_PASS = "Admin1234"

PASS = 0
FAIL = 0
FAIL_MSGS = []

def check(cond, msg):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  PASS: {msg}")
    else:
        FAIL += 1
        FAIL_MSGS.append(msg)
        print(f"  FAIL: {msg}")

def login(email, password):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]

def h(token):
    return {"Authorization": f"Bearer {token}"}

def iso(dt):
    return dt.replace(microsecond=0).isoformat().replace("+00:00", "Z")

def create_event(token, **over):
    now = datetime.now(timezone.utc) + timedelta(days=2)
    body = {
        "title": over.get("title", f"PatchClearTest-{uuid.uuid4().hex[:6]}"),
        "start_at": over.get("start_at", iso(now)),
        "end_at": over.get("end_at", iso(now + timedelta(hours=1))),
    }
    for k in ("description", "manager_id", "assigned_user_ids", "recurrence"):
        if k in over:
            body[k] = over[k]
    r = requests.post(f"{BASE}/events", json=body, headers=h(token), timeout=15)
    r.raise_for_status()
    return r.json()

def patch_event(token, eid, body):
    return requests.patch(f"{BASE}/events/{eid}", json=body, headers=h(token), timeout=15)

def delete_event(token, eid):
    try:
        requests.delete(f"{BASE}/events/{eid}", headers=h(token), timeout=15)
    except Exception:
        pass

def get_event(token, eid):
    # GET /events/{id} likely not exposed; fetch from list using a wide window
    now = datetime.now(timezone.utc)
    frm = iso(now - timedelta(days=30))
    to = iso(now + timedelta(days=180))
    r = requests.get(f"{BASE}/events", params={"from": frm, "to": to}, headers=h(token), timeout=15)
    r.raise_for_status()
    for ev in r.json():
        if ev.get("id") == eid or ev.get("base_event_id") == eid:
            return ev
    return None

def get_managers(token):
    r = requests.get(f"{BASE}/managers", headers=h(token), timeout=15)
    r.raise_for_status()
    return r.json()

def main():
    global PASS, FAIL
    created = []  # list of (token, event_id)

    print(f"[SETUP] Logging in as admin {ADMIN_EMAIL} ...")
    try:
        admin_token = login(ADMIN_EMAIL, ADMIN_PASS)
    except Exception as e:
        print(f"FATAL: admin login failed: {e}")
        sys.exit(2)

    # Get one admin manager id to use as manager
    managers = get_managers(admin_token)
    if not managers:
        print("FATAL: /api/managers returned empty list, cannot test manager_id clearing")
        sys.exit(2)
    mgr_id = managers[0]["id"]
    print(f"[SETUP] Using manager_id={mgr_id} ({managers[0].get('email')})")

    try:
        # 1) PATCH {"manager_id": null} -> 200 & clears manager
        print("\n[TEST 1] PATCH {'manager_id': null} clears manager fields")
        ev1 = create_event(admin_token, manager_id=mgr_id, description="inicial-1")
        created.append(ev1["id"])
        check(ev1.get("manager_id") == mgr_id, "created event.manager_id populated")
        check(isinstance(ev1.get("manager"), dict) and ev1["manager"].get("id") == mgr_id,
              "created event.manager is dict with correct id")
        r = patch_event(admin_token, ev1["id"], {"manager_id": None})
        check(r.status_code == 200, f"PATCH manager_id=null returns 200 (got {r.status_code}, body={r.text[:200]})")
        if r.status_code == 200:
            body = r.json()
            check(body.get("manager_id") is None, f"response.manager_id is null (got {body.get('manager_id')})")
            check(body.get("manager") is None, f"response.manager is null (got {body.get('manager')})")
            # Re-read via GET
            ev_after = get_event(admin_token, ev1["id"])
            check(ev_after is not None, "event still exists after PATCH")
            if ev_after:
                check(ev_after.get("manager_id") is None, "GET: manager_id is null")
                check(ev_after.get("manager") is None, "GET: manager is null")

        # 2) PATCH {"description": null} -> clears description
        print("\n[TEST 2] PATCH {'description': null} clears description")
        ev2 = create_event(admin_token, description="alguna descripcion inicial")
        created.append(ev2["id"])
        check(ev2.get("description") == "alguna descripcion inicial", "initial description set")
        r = patch_event(admin_token, ev2["id"], {"description": None})
        check(r.status_code == 200, f"PATCH description=null returns 200 (got {r.status_code}, body={r.text[:200]})")
        if r.status_code == 200:
            check(r.json().get("description") is None, "response.description is null after clear")

        # 3) PATCH {} -> 400 "Nada que actualizar"
        print("\n[TEST 3] PATCH {} returns 400 'Nada que actualizar'")
        ev3 = create_event(admin_token)
        created.append(ev3["id"])
        r = patch_event(admin_token, ev3["id"], {})
        check(r.status_code == 400, f"PATCH empty body returns 400 (got {r.status_code})")
        try:
            detail = r.json().get("detail", "")
        except Exception:
            detail = r.text
        check("Nada que actualizar" in str(detail), f"error detail is 'Nada que actualizar' (got {detail!r})")

        # 4) PATCH {"title": "nuevo"} -> 200, updates title
        print("\n[TEST 4] PATCH {'title': 'nuevo'} updates title")
        ev4 = create_event(admin_token, title="Titulo Original")
        created.append(ev4["id"])
        r = patch_event(admin_token, ev4["id"], {"title": "nuevo"})
        check(r.status_code == 200, f"PATCH title returns 200 (got {r.status_code})")
        if r.status_code == 200:
            check(r.json().get("title") == "nuevo", f"response.title is 'nuevo' (got {r.json().get('title')!r})")

        # 5) PATCH {"assigned_user_ids": []} -> 200, clears assigned users
        print("\n[TEST 5] PATCH {'assigned_user_ids': []} clears assignments")
        # Use the admin user id as a valid assignee (since we may not have other techs)
        admin_user_id = mgr_id  # reuse admin id
        ev5 = create_event(admin_token, assigned_user_ids=[admin_user_id])
        created.append(ev5["id"])
        check(ev5.get("assigned_user_ids") == [admin_user_id], "initial assigned_user_ids contains admin")
        check(len(ev5.get("assigned_users") or []) == 1, "initial assigned_users enriched (1 item)")
        r = patch_event(admin_token, ev5["id"], {"assigned_user_ids": []})
        check(r.status_code == 200, f"PATCH assigned_user_ids=[] returns 200 (got {r.status_code}, body={r.text[:200]})")
        if r.status_code == 200:
            body = r.json()
            check(body.get("assigned_user_ids") == [], f"response.assigned_user_ids == [] (got {body.get('assigned_user_ids')})")
            check(body.get("assigned_users") == [], f"response.assigned_users == [] (got {body.get('assigned_users')})")

        # 6) PATCH {"recurrence": null} -> clears recurrence
        print("\n[TEST 6] PATCH {'recurrence': null} clears recurrence")
        until = (datetime.now(timezone.utc) + timedelta(days=21)).strftime("%Y-%m-%d")
        ev6 = create_event(admin_token, recurrence={"type": "weekly", "until": until})
        created.append(ev6["id"])
        check(isinstance(ev6.get("recurrence"), dict) and ev6["recurrence"].get("type") == "weekly",
              "initial recurrence.type=='weekly'")
        r = patch_event(admin_token, ev6["id"], {"recurrence": None})
        check(r.status_code == 200, f"PATCH recurrence=null returns 200 (got {r.status_code}, body={r.text[:200]})")
        if r.status_code == 200:
            check(r.json().get("recurrence") is None, f"response.recurrence is null (got {r.json().get('recurrence')})")
            # Confirm via GET: should now only appear once in the list (no expansion)
            now = datetime.now(timezone.utc)
            frm = iso(now - timedelta(days=1))
            to = iso(now + timedelta(days=60))
            rr = requests.get(f"{BASE}/events", params={"from": frm, "to": to}, headers=h(admin_token), timeout=15)
            rr.raise_for_status()
            occurrences = [e for e in rr.json() if e.get("id") == ev6["id"] or e.get("base_event_id") == ev6["id"]]
            check(len(occurrences) == 1, f"GET /events returns exactly 1 occurrence for cleared recurrence (got {len(occurrences)})")

    finally:
        print("\n[CLEANUP] Deleting test events...")
        for eid in created:
            delete_event(admin_token, eid)
        print(f"[CLEANUP] Deleted {len(created)} events")

    print(f"\n================ RESULTS ================")
    print(f"PASS: {PASS}")
    print(f"FAIL: {FAIL}")
    if FAIL:
        print("\nFailed checks:")
        for m in FAIL_MSGS:
            print(f"  - {m}")
        sys.exit(1)
    print("ALL GREEN")

if __name__ == "__main__":
    main()
