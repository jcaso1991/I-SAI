"""
Backend tests for iteration 14 new endpoints:
1) GET /api/events/{eid}
2) DELETE /api/notifications (bulk delete)

Base URL: EXPO_PUBLIC_BACKEND_URL from /app/frontend/.env + /api
"""
import os
import sys
import time
import uuid
import json
from datetime import datetime, timedelta, timezone

import requests


def load_base_url() -> str:
    env_path = "/app/frontend/.env"
    url = None
    with open(env_path) as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                url = line.split("=", 1)[1].strip().strip('"')
                break
    if not url:
        raise RuntimeError("EXPO_PUBLIC_BACKEND_URL not found in /app/frontend/.env")
    return url.rstrip("/") + "/api"


BASE = load_base_url()
print(f"[info] Base URL: {BASE}")

ADMIN_EMAIL = "admin@materiales.com"
ADMIN_PASSWORD = "Admin1234"

results = []


def log(ok: bool, label: str, detail: str = ""):
    mark = "PASS" if ok else "FAIL"
    print(f"[{mark}] {label}" + (f" — {detail}" if detail else ""))
    results.append((ok, label, detail))


def assert_eq(actual, expected, label: str):
    ok = actual == expected
    log(ok, label, f"expected={expected!r} got={actual!r}" if not ok else "")
    return ok


def assert_true(cond: bool, label: str, detail: str = ""):
    log(bool(cond), label, detail if not cond else "")
    return bool(cond)


def req(method: str, path: str, token: str = None, **kw):
    headers = kw.pop("headers", {}) or {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = requests.request(method, BASE + path, headers=headers, timeout=30, **kw)
    return r


def login(email: str, password: str) -> str:
    r = req("POST", "/auth/login", json={"email": email, "password": password})
    if r.status_code != 200:
        raise RuntimeError(f"login failed {email}: {r.status_code} {r.text[:200]}")
    j = r.json()
    return j.get("access_token") or j.get("token")


print("\n=== SETUP ===")
admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
print("[info] admin token acquired")

tag = uuid.uuid4().hex[:8]


def create_user(email: str, password: str, role: str, name: str):
    body = {"email": email, "password": password, "role": role, "name": name}
    r = req("POST", "/users", admin_token, json=body)
    if r.status_code != 200:
        raise RuntimeError(f"create user {email} failed: {r.status_code} {r.text[:200]}")
    return r.json()


userA = create_user(f"usera_{tag}@test.dev", "PwdA1234", "user", "Ana Rivera")
userB = create_user(f"userb_{tag}@test.dev", "PwdB1234", "user", "Beatriz Soto")
techT = create_user(f"tech_{tag}@test.dev", "PwdT1234", "user", "Tomás Vidal")
other = create_user(f"other_{tag}@test.dev", "PwdO1234", "user", "Otto Unrelated")
print(f"[info] users: A={userA['id'][:8]} B={userB['id'][:8]} T={techT['id'][:8]} O={other['id'][:8]}")

tokenA = login(userA["email"], "PwdA1234")
tokenB = login(userB["email"], "PwdB1234")
tokenT = login(techT["email"], "PwdT1234")
tokenO = login(other["email"], "PwdO1234")

created_event_ids = []


def create_event(title: str, assigned_ids=None, manager_id=None, minutes_from_now=60, recurrence=None):
    start = datetime.now(timezone.utc) + timedelta(minutes=minutes_from_now)
    end = start + timedelta(hours=1)
    body = {
        "title": title,
        "start_at": start.isoformat().replace("+00:00", "Z"),
        "end_at": end.isoformat().replace("+00:00", "Z"),
        "assigned_user_ids": assigned_ids or [],
        "manager_id": manager_id,
    }
    if recurrence:
        body["recurrence"] = recurrence
    r = req("POST", "/events", admin_token, json=body)
    if r.status_code != 200:
        raise RuntimeError(f"create event failed: {r.status_code} {r.text[:300]}")
    ev = r.json()
    created_event_ids.append(ev["id"])
    return ev


# =======================================================
# SECTION 1: GET /api/events/{eid}
# =======================================================
print("\n=== 1) GET /api/events/{eid} ===")

start = (datetime.now(timezone.utc) + timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)
end = start + timedelta(hours=1)
body = {
    "title": f"ReuniónSemanal-{tag}",
    "start_at": start.isoformat().replace("+00:00", "Z"),
    "end_at": end.isoformat().replace("+00:00", "Z"),
    "assigned_user_ids": [techT["id"]],
    "manager_id": userA["id"],
    "recurrence": {"type": "weekly", "until": (start + timedelta(days=14)).date().isoformat()},
}
r = req("POST", "/events", admin_token, json=body)
assert_true(r.status_code == 200, "POST /events main weekly event", f"{r.status_code} {r.text[:120]}")
ev1 = r.json()
ev1_id = ev1["id"]
created_event_ids.append(ev1_id)

# 1.a admin fetches any event → 200
r = req("GET", f"/events/{ev1_id}", admin_token)
assert_eq(r.status_code, 200, "GET /events/{id} as admin → 200")
if r.status_code == 200:
    d = r.json()
    assert_eq(d.get("id"), ev1_id, "admin fetch: id matches")
    assert_true("assigned_users" in d and isinstance(d["assigned_users"], list),
                "admin fetch: assigned_users list present")
    assert_true(any(u["id"] == techT["id"] for u in d["assigned_users"]),
                "admin fetch: techT in assigned_users")
    assert_true("manager" in d and d["manager"] and d["manager"]["id"] == userA["id"],
                "admin fetch: manager attached with correct id")
    atts = d.get("attachments") or []
    assert_true(all("base64" not in a for a in atts),
                "admin fetch: attachments strip base64 payload")

# 1.b :date suffix → resolves to base event
virtual_id = f"{ev1_id}:{start.date().isoformat()}"
r = req("GET", f"/events/{virtual_id}", admin_token)
assert_eq(r.status_code, 200, "GET /events/{id}:date suffix as admin → 200")
if r.status_code == 200:
    assert_eq(r.json().get("id"), ev1_id, "virtual-id fetch returns base id")

# 1.c assigned non-admin → 200
r = req("GET", f"/events/{ev1_id}", tokenT)
assert_eq(r.status_code, 200, "GET /events/{id} as assigned techT → 200")

# 1.d manager (non-admin with manager_id=self) → 200
r = req("GET", f"/events/{ev1_id}", tokenA)
assert_eq(r.status_code, 200, "GET /events/{id} as manager userA → 200")

# admin as manager also works
r = req("GET", "/auth/me", admin_token)
admin_id = r.json().get("id") if r.status_code == 200 else None
if admin_id:
    ev_admin_mgr = create_event(f"AdminMgr-{tag}", assigned_ids=[techT["id"]],
                                manager_id=admin_id, minutes_from_now=120)
    r = req("GET", f"/events/{ev_admin_mgr['id']}", admin_token)
    assert_eq(r.status_code, 200, "GET /events/{id} admin (who is manager) → 200")

# 1.e unrelated non-admin → 403
r = req("GET", f"/events/{ev1_id}", tokenO)
assert_eq(r.status_code, 403, "GET /events/{id} unrelated non-admin (other) → 403")
r = req("GET", f"/events/{ev1_id}", tokenB)
assert_eq(r.status_code, 403, "GET /events/{id} as userB (unrelated) → 403")

# 1.f non-existent id → 404
bogus_id = str(uuid.uuid4())
r = req("GET", f"/events/{bogus_id}", admin_token)
assert_eq(r.status_code, 404, "GET /events/{non-existent} → 404 (admin)")
r = req("GET", f"/events/{bogus_id}:2026-01-01", admin_token)
assert_eq(r.status_code, 404, "GET /events/{non-existent}:date → 404")

# No token → 401
r = requests.get(BASE + f"/events/{ev1_id}")
assert_true(r.status_code in (401, 403), "GET /events/{id} no token → 401/403",
            f"got {r.status_code}")

# =======================================================
# SECTION 2: DELETE /api/notifications (bulk delete)
# =======================================================
print("\n=== 2) DELETE /api/notifications ===")


def seed_notification_for(manager_user_id: str,
                          assigned_user_id: str, assigned_token: str,
                          status: str, seguimiento: str = None, title_suffix: str = ""):
    """Create a fresh event managed by manager_user_id and assigned to assigned_user_id,
    then have assigned user PATCH status to produce a notification for the manager."""
    ev = create_event(f"Seed-{tag}-{title_suffix}",
                      assigned_ids=[assigned_user_id], manager_id=manager_user_id,
                      minutes_from_now=60 + len(created_event_ids))
    body = {"status": status}
    if seguimiento:
        body["seguimiento"] = seguimiento
    r = req("PATCH", f"/events/{ev['id']}", assigned_token, json=body)
    if r.status_code != 200:
        raise RuntimeError(f"PATCH status failed: {r.status_code} {r.text[:200]}")
    return ev


# Clean userA's notifications up front
r = req("DELETE", "/notifications", tokenA)
assert_true(r.status_code == 200, "pre-clean DELETE /notifications for userA",
            f"{r.status_code}")

# Seed 3 notifications for userA
print("[info] seeding 3 notifications for userA...")
seed_notification_for(userA["id"], techT["id"], tokenT, "completed", title_suffix="1")
seed_notification_for(userA["id"], techT["id"], tokenT, "pending_completion",
                      seguimiento="Falta material", title_suffix="2")
seed_notification_for(userA["id"], techT["id"], tokenT, "completed", title_suffix="3")

r = req("GET", "/notifications", tokenA)
assert_eq(r.status_code, 200, "GET /notifications userA after seed → 200")
items = r.json().get("items", []) if r.status_code == 200 else []
unread = r.json().get("unread", -1) if r.status_code == 200 else -1
assert_eq(len(items), 3, "userA has 3 notifications seeded")
assert_eq(unread, 3, "userA unread=3")

# Mark 1 as read
if items:
    nid_to_read = items[0]["id"]
    r = req("POST", f"/notifications/{nid_to_read}/read", tokenA)
    assert_eq(r.status_code, 200, "POST /notifications/{id}/read → 200")

r = req("GET", "/notifications", tokenA)
assert_eq(r.json().get("unread"), 2, "userA unread=2 after marking 1 read")

# 2.a DELETE /api/notifications?only_read=true → {ok:true, deleted:1}
r = req("DELETE", "/notifications?only_read=true", tokenA)
assert_eq(r.status_code, 200, "DELETE /notifications?only_read=true → 200")
body = r.json() if r.status_code == 200 else {}
assert_eq(body.get("ok"), True, "only_read=true response ok=true")
assert_eq(body.get("deleted"), 1, "only_read=true response deleted=1")

r = req("GET", "/notifications", tokenA)
body = r.json() if r.status_code == 200 else {}
items = body.get("items", [])
assert_eq(len(items), 2, "GET after only_read=true delete: 2 items remain")
assert_eq(body.get("unread"), 2, "GET after only_read=true delete: unread=2")
assert_true(all(not it.get("read") for it in items), "all remaining items are unread")

# 2.b DELETE /api/notifications (no query) → {ok:true, deleted:2}
r = req("DELETE", "/notifications", tokenA)
assert_eq(r.status_code, 200, "DELETE /notifications (no query) → 200")
body = r.json() if r.status_code == 200 else {}
assert_eq(body.get("ok"), True, "bulk delete response ok=true")
assert_eq(body.get("deleted"), 2, "bulk delete response deleted=2")

r = req("GET", "/notifications", tokenA)
body = r.json() if r.status_code == 200 else {}
assert_eq(body.get("items"), [], "GET after bulk delete: items=[]")
assert_eq(body.get("unread"), 0, "GET after bulk delete: unread=0")

# 2.c Cross-user isolation
print("\n[info] testing cross-user isolation...")
seed_notification_for(userB["id"], techT["id"], tokenT, "completed", title_suffix="B1")
seed_notification_for(userA["id"], techT["id"], tokenT, "completed", title_suffix="A1")

r = req("GET", "/notifications", tokenB)
b_items_before = r.json().get("items", []) if r.status_code == 200 else []
assert_eq(len(b_items_before), 1, "userB has 1 notification seeded")
assert_eq(r.json().get("unread"), 1, "userB unread=1 before userA bulk delete")

r = req("DELETE", "/notifications", tokenA)
assert_eq(r.status_code, 200, "userA DELETE /notifications → 200")
assert_true(r.json().get("deleted", 0) >= 1, "userA deleted >= 1",
            f"got {r.json().get('deleted')}")

tokenB_fresh = login(userB["email"], "PwdB1234")
r = req("GET", "/notifications", tokenB_fresh)
body = r.json() if r.status_code == 200 else {}
b_items_after = body.get("items", [])
assert_eq(len(b_items_after), 1, "userB still has 1 notification (isolation)")
assert_eq(body.get("unread"), 1, "userB unread=1 after (isolation)")
if b_items_before and b_items_after:
    assert_eq(b_items_after[0]["id"], b_items_before[0]["id"],
              "userB notification id identical before/after")

# userA DELETE?only_read=true also respects isolation
seed_notification_for(userB["id"], techT["id"], tokenT, "pending_completion",
                      seguimiento="X", title_suffix="B2")
r = req("GET", "/notifications", tokenB_fresh)
b_items = r.json().get("items", [])
if len(b_items) >= 1:
    req("POST", f"/notifications/{b_items[0]['id']}/read", tokenB_fresh)

seed_notification_for(userA["id"], techT["id"], tokenT, "completed", title_suffix="A2")
r = req("GET", "/notifications", tokenA)
a_items = r.json().get("items", [])
if a_items:
    req("POST", f"/notifications/{a_items[0]['id']}/read", tokenA)

r = req("DELETE", "/notifications?only_read=true", tokenA)
assert_eq(r.status_code, 200, "userA DELETE only_read=true (2nd round) → 200")

r = req("GET", "/notifications", tokenB_fresh)
body = r.json() if r.status_code == 200 else {}
assert_eq(len(body.get("items", [])), 2, "userB still has 2 notifications after userA only_read delete")

# Unrelated user sees nothing
r = req("GET", "/notifications", tokenO)
body = r.json() if r.status_code == 200 else {}
assert_eq(len(body.get("items", [])), 0, "unrelated user has no notifications (isolation)")
assert_eq(body.get("unread"), 0, "unrelated user unread=0")

# No token → 401
r = requests.delete(BASE + "/notifications")
assert_true(r.status_code in (401, 403), "DELETE /notifications no token → 401/403",
            f"got {r.status_code}")

# =======================================================
# CLEANUP
# =======================================================
print("\n=== CLEANUP ===")

for tok in (tokenA, tokenB_fresh, tokenT, tokenO):
    try:
        req("DELETE", "/notifications", tok)
    except Exception:
        pass

for eid in set(created_event_ids):
    try:
        req("DELETE", f"/events/{eid}", admin_token)
    except Exception:
        pass

for u in (userA, userB, techT, other):
    try:
        req("DELETE", f"/users/{u['id']}", admin_token)
    except Exception:
        pass

print(f"[info] cleanup done: events={len(set(created_event_ids))} users=4")

# Report
print("\n=== SUMMARY ===")
total = len(results)
passed = sum(1 for ok, _, _ in results if ok)
failed = total - passed
print(f"Passed: {passed}/{total}")
for ok, label, detail in results:
    if not ok:
        print(f"  FAIL: {label} — {detail}")

sys.exit(0 if failed == 0 else 1)
