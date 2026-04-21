"""Backend tests for Plans and Stamps features (Materiales app)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://excel-form-sync-1.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@materiales.com"
ADMIN_PASSWORD = "Admin1234"

# Tiny 1x1 transparent PNG
TINY_PNG_B64 = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0"
    "lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def user_token(admin_token):
    """Create a regular user for non-admin checks."""
    email = "TEST_planuser@example.com"
    password = "TestPass1234"
    headers = {"Authorization": f"Bearer {admin_token}"}
    # Create (ignore 400 if exists)
    requests.post(f"{BASE_URL}/api/users", json={
        "email": email, "password": password, "name": "Test Plan User", "role": "user"
    }, headers=headers, timeout=30)
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"User login failed: {r.text}"
    yield r.json()["access_token"]
    # cleanup
    users = requests.get(f"{BASE_URL}/api/users", headers=headers, timeout=30).json()
    for u in users:
        if u["email"] == email:
            requests.delete(f"{BASE_URL}/api/users/{u['id']}", headers=headers, timeout=30)


@pytest.fixture
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------------- Stamps ----------------
class TestStamps:
    def test_list_stamps_returns_four_builtins(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/stamps", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        builtins = [s for s in data if s.get("is_builtin")]
        assert len(builtins) >= 4
        ids = {s["id"] for s in builtins}
        for expected in ["builtin_door", "builtin_door_handle", "builtin_camera", "builtin_barrier"]:
            assert expected in ids, f"Missing builtin: {expected}"
        # builtin should have icon_key
        door = next(s for s in builtins if s["id"] == "builtin_door")
        assert door.get("icon_key") == "door"

    def test_delete_builtin_stamp_rejected(self, auth_headers):
        r = requests.delete(f"{BASE_URL}/api/stamps/builtin_door",
                            headers=auth_headers, timeout=30)
        assert r.status_code == 400

    def test_create_stamp_as_admin_and_delete(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/stamps",
                          json={"name": "TEST_CustomStamp", "image_base64": TINY_PNG_B64},
                          headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        stamp = r.json()
        assert stamp["is_builtin"] is False
        assert stamp["name"] == "TEST_CustomStamp"
        sid = stamp["id"]
        # Verify listed
        lst = requests.get(f"{BASE_URL}/api/stamps", headers=auth_headers, timeout=30).json()
        assert any(s["id"] == sid for s in lst)
        # Delete
        d = requests.delete(f"{BASE_URL}/api/stamps/{sid}", headers=auth_headers, timeout=30)
        assert d.status_code == 200
        # Verify removed
        lst2 = requests.get(f"{BASE_URL}/api/stamps", headers=auth_headers, timeout=30).json()
        assert not any(s["id"] == sid for s in lst2)

    def test_create_stamp_as_non_admin_forbidden(self, user_token):
        r = requests.post(f"{BASE_URL}/api/stamps",
                          json={"name": "TEST_Hack", "image_base64": TINY_PNG_B64},
                          headers={"Authorization": f"Bearer {user_token}",
                                   "Content-Type": "application/json"}, timeout=30)
        assert r.status_code == 403


# ---------------- Plans ----------------
class TestPlans:
    plan_id = None

    def test_create_plan(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/plans",
                          json={"title": "TEST_Plan_Backend"},
                          headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["title"] == "TEST_Plan_Backend"
        assert "id" in data
        assert data["data"] == {"shapes": []}
        TestPlans.plan_id = data["id"]

    def test_list_plans_includes_created(self, auth_headers):
        assert TestPlans.plan_id, "run create first"
        r = requests.get(f"{BASE_URL}/api/plans", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        plans = r.json()
        found = [p for p in plans if p["id"] == TestPlans.plan_id]
        assert found, "Created plan not in list"
        assert found[0]["shape_count"] == 0
        assert "title" in found[0]

    def test_get_plan_returns_full_data(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/plans/{TestPlans.plan_id}",
                         headers=auth_headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == TestPlans.plan_id
        assert "shapes" in data["data"]

    def test_patch_plan_updates_shapes(self, auth_headers):
        new_shapes = [
            {"id": "s1", "type": "rect", "x": 10, "y": 20, "w": 100, "h": 50,
             "stroke": "#000", "strokeWidth": 2, "fill": "none"}
        ]
        r = requests.patch(f"{BASE_URL}/api/plans/{TestPlans.plan_id}",
                           json={"data": {"shapes": new_shapes}},
                           headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        # GET verify persistence
        g = requests.get(f"{BASE_URL}/api/plans/{TestPlans.plan_id}",
                         headers=auth_headers, timeout=30).json()
        assert len(g["data"]["shapes"]) == 1
        assert g["data"]["shapes"][0]["type"] == "rect"

    def test_list_shape_count_reflects_update(self, auth_headers):
        plans = requests.get(f"{BASE_URL}/api/plans", headers=auth_headers, timeout=30).json()
        p = next(x for x in plans if x["id"] == TestPlans.plan_id)
        assert p["shape_count"] == 1

    def test_delete_plan(self, auth_headers):
        r = requests.delete(f"{BASE_URL}/api/plans/{TestPlans.plan_id}",
                            headers=auth_headers, timeout=30)
        assert r.status_code == 200
        # Verify 404
        g = requests.get(f"{BASE_URL}/api/plans/{TestPlans.plan_id}",
                         headers=auth_headers, timeout=30)
        assert g.status_code == 404

    def test_plans_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/plans", timeout=30)
        assert r.status_code == 401
