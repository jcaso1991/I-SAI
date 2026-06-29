import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient
from server import app
import uuid

client = TestClient(app)


@pytest.fixture(scope="module")
def admin_token():
    resp = client.post("/api/auth/login", json={"email": "admin@isai.com", "password": "Admin1234"})
    return resp.json()["access_token"]


def test_login_ok():
    resp = client.post("/api/auth/login", json={"email": "admin@isai.com", "password": "Admin1234"})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_login_fail():
    resp = client.post("/api/auth/login", json={"email": "no@existe.com", "password": "mal"})
    assert resp.status_code == 401


def test_list_materiales(admin_token):
    resp = client.get("/api/materiales?limit=5", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200


def test_list_events(admin_token):
    resp = client.get("/api/events?from=2026-01-01&to=2026-12-31", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200


def test_list_roles(admin_token):
    resp = client.get("/api/roles", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    roles = resp.json()
    assert len(roles) >= 5


def test_financiero(admin_token):
    resp = client.get("/api/dashboard/financiero", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    d = resp.json()
    assert "resumen" in d
    assert "detalle" in d


def test_create_event(admin_token):
    mid = client.get("/api/materiales?limit=1", headers={"Authorization": f"Bearer {admin_token}"}).json()[0]["id"]
    resp = client.post("/api/events", json={
        "title": "Test pytest", "start_at": "2026-12-01T10:00:00", "end_at": "2026-12-01T12:00:00",
        "material_id": mid, "hours": 2, "tipo_mano_obra": "obra", "status": "in_progress"
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    eid = resp.json()["id"]
    resp2 = client.patch(f"/api/events/{eid}", json={"status": "completed", "hours": 2, "tipo_mano_obra": "obra", "seguimiento": "ok"}, headers={"Authorization": f"Bearer {admin_token}"})
    assert resp2.status_code == 200
    client.delete(f"/api/events/{eid}", headers={"Authorization": f"Bearer {admin_token}"})


def test_event_complete_requires_fields(admin_token):
    mid = client.get("/api/materiales?limit=1", headers={"Authorization": f"Bearer {admin_token}"}).json()[0]["id"]
    resp = client.post("/api/events", json={
        "title": "Test required", "start_at": "2026-12-02T10:00:00", "end_at": "2026-12-02T12:00:00",
        "material_id": mid, "hours": 2, "tipo_mano_obra": "obra", "status": "in_progress"
    }, headers={"Authorization": f"Bearer {admin_token}"})
    eid = resp.json()["id"]
    resp2 = client.patch(f"/api/events/{eid}", json={"status": "completed"}, headers={"Authorization": f"Bearer {admin_token}"})
    assert resp2.status_code == 400
    client.delete(f"/api/events/{eid}", headers={"Authorization": f"Bearer {admin_token}"})


def test_tipos_mano_obra(admin_token):
    resp = client.get("/api/auth/tipos-mano-obra", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    assert len(resp.json()["tipos"]) >= 8


def test_homepage(admin_token):
    resp = client.patch("/api/auth/homepage", json={"homepage": "/dashboard"}, headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    client.patch("/api/auth/homepage", json={"homepage": "/home"}, headers={"Authorization": f"Bearer {admin_token}"})


def test_pdf_download(admin_token):
    resp = client.get("/api/config/pdf-funcionalidades", params={"token": admin_token})
    assert resp.status_code == 200
    assert len(resp.content) > 10000
