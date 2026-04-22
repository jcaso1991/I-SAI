"""
Backend tests for iteration 3 PDF-related endpoints:
  - POST /api/utils/image-to-pdf
  - POST /api/budgets/pdf-preview
  - GET  /api/budgets/{bid}/pdf
Plus regression sanity on budgets CRUD, /api/events and /api/plans.

Targets http://localhost:8001/api and uses admin credentials from
/app/memory/test_credentials.md.
"""
import base64
import io
import os
import sys
import time
import uuid

import requests
from PIL import Image

BASE = os.environ.get("BACKEND_URL", "http://localhost:8001/api")
ADMIN_EMAIL = "admin@materiales.com"
ADMIN_PASS = "Admin1234"

PASS = 0
FAIL = 0
FAILURES = []


def check(cond, label, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  PASS  {label}")
    else:
        FAIL += 1
        FAILURES.append(f"{label} — {detail}")
        print(f"  FAIL  {label}  {detail}")


def login(email, password):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password})
    r.raise_for_status()
    return r.json()


def hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


def make_jpeg_b64(size=(8, 8), color=(220, 10, 10)):
    img = Image.new("RGB", size, color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80)
    return base64.b64encode(buf.getvalue()).decode()


def make_png_b64(size=(8, 8), color=(10, 200, 20, 255)):
    img = Image.new("RGBA", size, color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


# ---------------------------------------------------------------- fixtures
print("=== Login admin ===")
admin = login(ADMIN_EMAIL, ADMIN_PASS)
admin_tok = admin["access_token"]
admin_id = admin["user"]["id"]
check(bool(admin_tok) and admin["user"]["role"] == "admin",
      "login admin", f"role={admin['user'].get('role')}")

# Create a throw-away 'user' (role='user') and 'comercial' for permission checks
tmp_user_email = f"tmp_user_{uuid.uuid4().hex[:8]}@example.com"
tmp_comercial_email = f"tmp_com_{uuid.uuid4().hex[:8]}@example.com"
created_user_ids = []
for email, role in [(tmp_user_email, "user"), (tmp_comercial_email, "comercial")]:
    r = requests.post(
        f"{BASE}/users",
        headers=hdr(admin_tok),
        json={"email": email, "password": "Password123", "name": f"Test {role}", "role": role},
    )
    if r.status_code == 200:
        created_user_ids.append(r.json()["id"])
        print(f"  created test user {email} role={role}")
    else:
        print(f"  WARN could not create {email}: {r.status_code} {r.text}")

user_tok = login(tmp_user_email, "Password123")["access_token"]
com_tok = login(tmp_comercial_email, "Password123")["access_token"]

created_budget_ids = []
created_event_ids = []
created_plan_ids = []


# ---------------------------------------------------------------- 1) utils/image-to-pdf
print("\n=== 1) POST /api/utils/image-to-pdf ===")

# Without token -> 401
r = requests.post(f"{BASE}/utils/image-to-pdf", json={"base64": make_jpeg_b64(), "mime_type": "image/jpeg"})
check(r.status_code == 401, "image-to-pdf no token -> 401", f"got {r.status_code}")

# Valid JPEG
jpeg_b64 = make_jpeg_b64()
r = requests.post(f"{BASE}/utils/image-to-pdf", headers=hdr(admin_tok),
                  json={"base64": jpeg_b64, "mime_type": "image/jpeg"})
check(r.status_code == 200, "image-to-pdf jpeg 200", f"got {r.status_code} {r.text[:120]}")
check(r.headers.get("content-type", "").startswith("application/pdf"),
      "image-to-pdf jpeg content-type pdf", r.headers.get("content-type"))
check(r.content[:4] == b"%PDF", "image-to-pdf jpeg %PDF magic", str(r.content[:10]))

# Valid PNG
png_b64 = make_png_b64()
r = requests.post(f"{BASE}/utils/image-to-pdf", headers=hdr(admin_tok),
                  json={"base64": png_b64, "mime_type": "image/png"})
check(r.status_code == 200, "image-to-pdf png 200", f"got {r.status_code} {r.text[:120]}")
check(r.content[:4] == b"%PDF", "image-to-pdf png %PDF magic")

# non-admin/non-comercial user -> should still get 200 (any logged-in user allowed)
r = requests.post(f"{BASE}/utils/image-to-pdf", headers=hdr(user_tok),
                  json={"base64": png_b64, "mime_type": "image/png"})
check(r.status_code == 200, "image-to-pdf user role 200", f"got {r.status_code}")

# Invalid mime
r = requests.post(f"{BASE}/utils/image-to-pdf", headers=hdr(admin_tok),
                  json={"base64": jpeg_b64, "mime_type": "text/plain"})
check(r.status_code == 400, "image-to-pdf invalid mime -> 400", f"got {r.status_code}")
check("Solo JPEG o PNG" in r.text, "image-to-pdf detail 'Solo JPEG o PNG'", r.text[:160])

# Invalid base64 — "not-base64!!"
r = requests.post(f"{BASE}/utils/image-to-pdf", headers=hdr(admin_tok),
                  json={"base64": "not-base64!!", "mime_type": "image/jpeg"})
check(r.status_code == 400, "image-to-pdf invalid base64 -> 400", f"got {r.status_code}")
check("Base64" in r.text or "base64" in r.text.lower(),
      "image-to-pdf detail mentions base64", r.text[:160])


# ---------------------------------------------------------------- 2) budgets/pdf-preview
print("\n=== 2) POST /api/budgets/pdf-preview ===")

# Without token -> 401
r = requests.post(f"{BASE}/budgets/pdf-preview", json={"n_proyecto": "X"})
check(r.status_code == 401, "pdf-preview no token -> 401", f"got {r.status_code}")

# role=user -> 403
r = requests.post(f"{BASE}/budgets/pdf-preview", headers=hdr(user_tok), json={"n_proyecto": "X"})
check(r.status_code == 403, "pdf-preview role=user -> 403", f"got {r.status_code} {r.text[:120]}")

# Minimal body -> 200
r = requests.post(f"{BASE}/budgets/pdf-preview", headers=hdr(admin_tok),
                  json={"n_proyecto": "P-MIN-001"})
check(r.status_code == 200, "pdf-preview minimal admin 200", f"got {r.status_code} {r.text[:120]}")
check(r.content[:5] == b"%PDF-", "pdf-preview minimal %PDF- header")
check(b"/AcroForm" in r.content, "pdf-preview minimal has /AcroForm")

# Complete body -> 200 from comercial user too
full_body = {
    "n_proyecto": "P-2026-100",
    "cliente": "ACME Ibérica S.L.",
    "nombre_instalacion": "Sede Central Madrid — Edificio B",
    "direccion": "Calle Alcalá 345, 28009 Madrid",
    "contacto_1": "Juan Pérez Ramírez — 666 111 222 — juan@acme.es",
    "contacto_2": "María López Ruiz — 666 333 444 — maria@acme.es",
    "observaciones_presupuesto": ("Instalación de 12 cilindros electrónicos Salto XS4 y "
                                  "2 lectores de muro en accesos principales."),
    "fecha_inicio": "2026-03-10",
    "fecha_fin": "2026-03-14",
    "observaciones_ejecucion": "Trabajos ejecutados según planning sin incidencias.",
    "equipos": [
        {"elemento": "Cilindro XS4", "cantidad": "12", "ubicacion": "Planta 1-3", "observaciones": "Montaje completo"},
        {"elemento": "Lector de muro", "cantidad": "2", "ubicacion": "Entrada principal", "observaciones": ""},
        {"elemento": "Tarjeta MIFARE", "cantidad": "50", "ubicacion": "Oficina", "observaciones": "Entregadas al cliente"},
    ],
    "entrega_tarjeta_mantenimiento": True,
    "entrega_llave_salto": True,
    "entrega_eps100": False,
    "nombre_isai": "Ana García Torres",
    "cargo_isai": "Técnico Senior",
    "nombre_cliente": "Pedro Ruiz Castilla",
    "cargo_cliente": "Jefe de Mantenimiento",
}
r = requests.post(f"{BASE}/budgets/pdf-preview", headers=hdr(com_tok), json=full_body)
check(r.status_code == 200, "pdf-preview full comercial 200", f"got {r.status_code} {r.text[:160]}")
check(r.headers.get("content-type", "").startswith("application/pdf"),
      "pdf-preview full content-type pdf", r.headers.get("content-type"))
check(r.content[:5] == b"%PDF-", "pdf-preview full %PDF-")
check(b"/AcroForm" in r.content, "pdf-preview full has /AcroForm")
check(len(r.content) > 100_000, f"pdf-preview full size>100KB (actual={len(r.content)})")


# ---------------------------------------------------------------- 3) budgets/{bid}/pdf
print("\n=== 3) GET /api/budgets/{bid}/pdf ===")

# Create a budget first
r = requests.post(f"{BASE}/budgets", headers=hdr(admin_tok), json=full_body)
check(r.status_code == 200, "POST /budgets create 200", f"got {r.status_code} {r.text[:160]}")
bid = r.json()["id"]
created_budget_ids.append(bid)

# Without token -> 401
r = requests.get(f"{BASE}/budgets/{bid}/pdf")
check(r.status_code == 401, "GET budget pdf no token -> 401", f"got {r.status_code}")

# role=user -> 403
r = requests.get(f"{BASE}/budgets/{bid}/pdf", headers=hdr(user_tok))
check(r.status_code == 403, "GET budget pdf role=user -> 403", f"got {r.status_code} {r.text[:160]}")

# admin -> 200, valid PDF
r = requests.get(f"{BASE}/budgets/{bid}/pdf", headers=hdr(admin_tok))
check(r.status_code == 200, "GET budget pdf admin 200", f"got {r.status_code} {r.text[:160]}")
check(r.headers.get("content-type", "").startswith("application/pdf"),
      "GET budget pdf content-type", r.headers.get("content-type"))
check(r.content[:5] == b"%PDF-", "GET budget pdf %PDF-")
check(len(r.content) > 100_000, f"GET budget pdf size>100KB (actual={len(r.content)})")
disp = r.headers.get("content-disposition", "")
check(disp.startswith("inline;") and 'filename="hoja_instalacion_' in disp,
      "GET budget pdf content-disposition inline+filename", disp)

# comercial -> 200
r = requests.get(f"{BASE}/budgets/{bid}/pdf", headers=hdr(com_tok))
check(r.status_code == 200, "GET budget pdf comercial 200", f"got {r.status_code}")

# Invalid id -> 404
r = requests.get(f"{BASE}/budgets/does-not-exist-{uuid.uuid4().hex}/pdf", headers=hdr(admin_tok))
check(r.status_code == 404, "GET budget pdf invalid id -> 404", f"got {r.status_code}")
check("Presupuesto no encontrado" in r.text, "GET budget pdf 404 detail", r.text[:160])


# ---------------------------------------------------------------- Regression: Budgets CRUD
print("\n=== Regression: Budgets CRUD ===")

# POST
r = requests.post(f"{BASE}/budgets", headers=hdr(admin_tok),
                  json={"n_proyecto": "REG-001", "cliente": "Reg Client"})
check(r.status_code == 200, "budgets POST regression", f"got {r.status_code}")
reg_bid = r.json()["id"]
created_budget_ids.append(reg_bid)

# GET list
r = requests.get(f"{BASE}/budgets", headers=hdr(admin_tok))
check(r.status_code == 200 and any(b["id"] == reg_bid for b in r.json()),
      "budgets GET list includes new", f"got {r.status_code}")

# GET by id
r = requests.get(f"{BASE}/budgets/{reg_bid}", headers=hdr(admin_tok))
check(r.status_code == 200 and r.json().get("cliente") == "Reg Client",
      "budgets GET by id", f"got {r.status_code}")

# PATCH
r = requests.patch(f"{BASE}/budgets/{reg_bid}", headers=hdr(admin_tok),
                   json={"cliente": "Updated Client"})
check(r.status_code == 200 and r.json().get("cliente") == "Updated Client",
      "budgets PATCH", f"got {r.status_code} {r.text[:120]}")

# DELETE
r = requests.delete(f"{BASE}/budgets/{reg_bid}", headers=hdr(admin_tok))
check(r.status_code == 200 and r.json() == {"ok": True}, "budgets DELETE", f"got {r.status_code}")
# confirm gone
r = requests.get(f"{BASE}/budgets/{reg_bid}", headers=hdr(admin_tok))
check(r.status_code == 404, "budgets DELETE confirmed 404", f"got {r.status_code}")
created_budget_ids.remove(reg_bid)


# ---------------------------------------------------------------- Regression: Events
print("\n=== Regression: Events ===")

r = requests.post(f"{BASE}/events", headers=hdr(admin_tok),
                  json={"title": "Reg Event",
                        "start_at": "2026-04-01T10:00:00Z",
                        "end_at": "2026-04-01T11:00:00Z"})
check(r.status_code == 200, "POST /events", f"got {r.status_code} {r.text[:120]}")
eid = r.json()["id"]
created_event_ids.append(eid)

r = requests.get(f"{BASE}/events", headers=hdr(admin_tok))
check(r.status_code == 200 and any(e["id"] == eid for e in r.json()),
      "GET /events contains new", f"got {r.status_code}")

r = requests.patch(f"{BASE}/events/{eid}", headers=hdr(admin_tok),
                   json={"title": "Reg Event Updated"})
check(r.status_code == 200 and r.json()["title"] == "Reg Event Updated",
      "PATCH /events", f"got {r.status_code}")

r = requests.delete(f"{BASE}/events/{eid}", headers=hdr(admin_tok))
check(r.status_code == 200, "DELETE /events", f"got {r.status_code}")
created_event_ids.remove(eid)


# ---------------------------------------------------------------- Regression: Plans
print("\n=== Regression: Plans ===")

r = requests.post(f"{BASE}/plans", headers=hdr(admin_tok),
                  json={"title": "Reg Plan", "data": {"shapes": []}})
check(r.status_code == 200, "POST /plans", f"got {r.status_code} {r.text[:120]}")
pid = r.json()["id"]
created_plan_ids.append(pid)

r = requests.get(f"{BASE}/plans", headers=hdr(admin_tok))
check(r.status_code == 200 and any(p["id"] == pid for p in r.json()),
      "GET /plans contains new", f"got {r.status_code}")

r = requests.get(f"{BASE}/plans/{pid}", headers=hdr(admin_tok))
check(r.status_code == 200 and r.json()["title"] == "Reg Plan",
      "GET /plans/{id}", f"got {r.status_code}")

r = requests.delete(f"{BASE}/plans/{pid}", headers=hdr(admin_tok))
check(r.status_code == 200, "DELETE /plans", f"got {r.status_code}")
created_plan_ids.remove(pid)


# ---------------------------------------------------------------- cleanup
print("\n=== Cleanup ===")
for bid in list(created_budget_ids):
    r = requests.delete(f"{BASE}/budgets/{bid}", headers=hdr(admin_tok))
    print(f"  delete budget {bid}: {r.status_code}")
for eid in list(created_event_ids):
    requests.delete(f"{BASE}/events/{eid}", headers=hdr(admin_tok))
for pid in list(created_plan_ids):
    requests.delete(f"{BASE}/plans/{pid}", headers=hdr(admin_tok))
for uid in created_user_ids:
    r = requests.delete(f"{BASE}/users/{uid}", headers=hdr(admin_tok))
    print(f"  delete user {uid}: {r.status_code}")

print(f"\n=== RESULT: {PASS} pass, {FAIL} fail ===")
if FAIL:
    print("Failures:")
    for f in FAILURES:
        print("  -", f)
    sys.exit(1)
