from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from fastapi.responses import RedirectResponse, HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt as pyjwt
import msal
import httpx
import io
import math
import base64
from openpyxl import load_workbook

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ---------------- Config ----------------
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRE_HOURS = int(os.environ.get('JWT_EXPIRE_HOURS', '24'))

MS_TENANT_ID = os.environ.get('MS_TENANT_ID', '')
MS_CLIENT_ID = os.environ.get('MS_CLIENT_ID', '')
MS_CLIENT_SECRET = os.environ.get('MS_CLIENT_SECRET', '')
MS_REDIRECT_URI = os.environ.get('MS_REDIRECT_URI', '')
ONEDRIVE_FILE_PATH = os.environ.get('ONEDRIVE_FILE_PATH', '/Materiales.xlsx')
ONEDRIVE_SHARE_URL = os.environ.get('ONEDRIVE_SHARE_URL', '').strip()
INITIAL_EXCEL_PATH = os.environ.get('INITIAL_EXCEL_PATH', '/app/backend/Materiales.xlsx')

# Support personal + work accounts
MS_AUTHORITY = "https://login.microsoftonline.com/common"
MS_SCOPES = ["Files.ReadWrite.All", "User.Read"]  # offline_access added automatically by MSAL
GRAPH_BASE = "https://graph.microsoft.com/v1.0"

# ---------------- DB ----------------
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ---------------- App ----------------
app = FastAPI(title="Materiales OneDrive App")
api_router = APIRouter(prefix="/api")

# ---------------- Models ----------------
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    role: str = "user"

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class Material(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    row_index: int  # 1-based row in excel (excluding header)
    materiales: Optional[str] = None
    cliente: Optional[str] = None
    ubicacion: Optional[str] = None
    horas_prev: Optional[str] = None
    comercial: Optional[str] = None
    gestor: Optional[str] = None
    # editable
    fecha: Optional[str] = None
    entrega_recogida: Optional[str] = None
    total_parcial: Optional[str] = None
    tecnico: Optional[str] = None
    comentarios: Optional[str] = None
    # meta
    sync_status: str = "synced"  # synced | pending | error
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None

class MaterialUpdate(BaseModel):
    fecha: Optional[str] = None
    entrega_recogida: Optional[str] = None
    total_parcial: Optional[str] = None
    tecnico: Optional[str] = None
    comentarios: Optional[str] = None

class OneDriveStatus(BaseModel):
    connected: bool
    admin_email: Optional[str] = None
    last_import_at: Optional[str] = None
    last_push_at: Optional[str] = None
    file_path: str = ONEDRIVE_FILE_PATH
    file_name: Optional[str] = None
    using_share_url: bool = bool(ONEDRIVE_SHARE_URL)

# ---------------- Helpers ----------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_jwt(user: dict) -> str:
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "role": user.get("role", "user"),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except Exception:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user

async def current_admin(user: dict = Depends(current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user

def _clean(v):
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d")
    s = str(v).strip()
    return s if s and s.lower() != "nan" else None

# ---------------- Excel parsing ----------------
# Column mapping (A..M in the Excel):
# A=Materiales, B=CLIENTE, C=Ubicación Cliente, D=Horas PREV, E=Comercial,
# F=Gestor/a, G=Fecha, H=Entrega/recogida, I=Recogida Total/Parcial,
# J=Técnico, K=Comentarios, L=Columna1, M=Columna2
EDITABLE_COL_MAP = {
    "fecha": "G",
    "entrega_recogida": "H",
    "total_parcial": "I",
    "tecnico": "J",
    "comentarios": "K",
}

def parse_workbook(xlsx_bytes: bytes) -> List[dict]:
    wb = load_workbook(io.BytesIO(xlsx_bytes), data_only=True)
    ws = wb.active
    rows = []
    for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        # skip empty
        if not any(row):
            continue
        r = list(row) + [None] * (13 - len(row))
        rows.append({
            "row_index": idx,
            "materiales": _clean(r[0]),
            "cliente": _clean(r[1]),
            "ubicacion": _clean(r[2]),
            "horas_prev": _clean(r[3]),
            "comercial": _clean(r[4]),
            "gestor": _clean(r[5]),
            "fecha": _clean(r[6]),
            "entrega_recogida": _clean(r[7]),
            "total_parcial": _clean(r[8]),
            "tecnico": _clean(r[9]),
            "comentarios": _clean(r[10]),
        })
    return rows

# ---------------- Microsoft Graph ----------------
def _msal_app():
    return msal.ConfidentialClientApplication(
        client_id=MS_CLIENT_ID,
        client_credential=MS_CLIENT_SECRET,
        authority=MS_AUTHORITY,
    )

async def _get_onedrive_token() -> str:
    """Return a fresh access token using the stored refresh token."""
    doc = await db.onedrive_tokens.find_one({"_id": "admin"})
    if not doc:
        raise HTTPException(400, "OneDrive no conectado. El admin debe vincular OneDrive primero.")
    app_msal = _msal_app()
    result = app_msal.acquire_token_by_refresh_token(doc["refresh_token"], scopes=MS_SCOPES)
    if "error" in result:
        raise HTTPException(401, f"Error refrescando token OneDrive: {result.get('error_description')}")
    # save new refresh token if provided
    update = {"access_token": result["access_token"]}
    if result.get("refresh_token"):
        update["refresh_token"] = result["refresh_token"]
    await db.onedrive_tokens.update_one({"_id": "admin"}, {"$set": update})
    return result["access_token"]

async def _graph_get(url: str, token: str) -> httpx.Response:
    async with httpx.AsyncClient(timeout=60) as c:
        return await c.get(url, headers={"Authorization": f"Bearer {token}"})

async def _graph_request(method: str, url: str, token: str, **kw) -> httpx.Response:
    async with httpx.AsyncClient(timeout=120) as c:
        headers = kw.pop("headers", {})
        headers["Authorization"] = f"Bearer {token}"
        return await c.request(method, url, headers=headers, **kw)

async def _resolve_share_url(token: str) -> dict:
    """Resolve ONEDRIVE_SHARE_URL to driveId + itemId + name (cached in Mongo)."""
    cached = await db.onedrive_share_cache.find_one({"_id": ONEDRIVE_SHARE_URL})
    if cached:
        return cached
    # Encode URL per Graph spec: u! + base64url(no padding)
    b64 = base64.urlsafe_b64encode(ONEDRIVE_SHARE_URL.encode()).decode().rstrip("=")
    share_id = f"u!{b64}"
    url = f"{GRAPH_BASE}/shares/{share_id}/driveItem"
    r = await _graph_get(url, token)
    if r.status_code != 200:
        raise HTTPException(r.status_code, f"No se pudo resolver el enlace compartido: {r.text}")
    data = r.json()
    drive_id = data.get("parentReference", {}).get("driveId")
    item_id = data.get("id")
    name = data.get("name")
    if not drive_id or not item_id:
        raise HTTPException(500, f"Respuesta inesperada del share: {data}")
    doc = {"_id": ONEDRIVE_SHARE_URL, "drive_id": drive_id, "item_id": item_id, "name": name}
    await db.onedrive_share_cache.update_one({"_id": ONEDRIVE_SHARE_URL}, {"$set": doc}, upsert=True)
    return doc

async def _download_excel_from_onedrive() -> bytes:
    token = await _get_onedrive_token()
    if ONEDRIVE_SHARE_URL:
        info = await _resolve_share_url(token)
        url = f"{GRAPH_BASE}/drives/{info['drive_id']}/items/{info['item_id']}/content"
    else:
        url = f"{GRAPH_BASE}/me/drive/root:{ONEDRIVE_FILE_PATH}:/content"
    r = await _graph_get(url, token)
    if r.status_code not in (200, 302):
        raise HTTPException(r.status_code, f"No se pudo descargar Excel: {r.text}")
    return r.content

async def _upload_excel_to_onedrive(xlsx_bytes: bytes) -> None:
    token = await _get_onedrive_token()
    if ONEDRIVE_SHARE_URL:
        info = await _resolve_share_url(token)
        url = f"{GRAPH_BASE}/drives/{info['drive_id']}/items/{info['item_id']}/content"
    else:
        url = f"{GRAPH_BASE}/me/drive/root:{ONEDRIVE_FILE_PATH}:/content"
    async with httpx.AsyncClient(timeout=120) as c:
        r = await c.put(
            url,
            content=xlsx_bytes,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            },
        )
    if r.status_code not in (200, 201):
        raise HTTPException(r.status_code, f"No se pudo subir Excel: {r.text}")

# ---------------- Auth routes ----------------
@api_router.post("/auth/register", response_model=TokenOut)
async def register(payload: UserRegister):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(400, "Email ya registrado")
    count = await db.users.count_documents({})
    role = "admin" if count == 0 else "user"
    user = {
        "id": str(uuid.uuid4()),
        "email": payload.email.lower(),
        "name": payload.name or payload.email.split("@")[0],
        "password": hash_password(payload.password),
        "role": role,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    token = create_jwt(user)
    return TokenOut(access_token=token, user=UserOut(id=user["id"], email=user["email"], name=user["name"], role=user["role"]))

@api_router.post("/auth/login", response_model=TokenOut)
async def login(payload: UserLogin):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user["password"]):
        raise HTTPException(401, "Credenciales inválidas")
    token = create_jwt(user)
    return TokenOut(access_token=token, user=UserOut(id=user["id"], email=user["email"], name=user.get("name"), role=user.get("role", "user")))

@api_router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(current_user)):
    return UserOut(id=user["id"], email=user["email"], name=user.get("name"), role=user.get("role", "user"))

# ---------------- OneDrive routes ----------------
@api_router.get("/auth/onedrive/login")
async def onedrive_login(user: dict = Depends(current_admin)):
    app_msal = _msal_app()
    state = user["id"]
    auth_url = app_msal.get_authorization_request_url(
        scopes=MS_SCOPES,
        redirect_uri=MS_REDIRECT_URI,
        state=state,
        prompt="select_account",
    )
    return {"auth_url": auth_url}

@api_router.get("/auth/onedrive/callback")
async def onedrive_callback(code: str, state: Optional[str] = None, error: Optional[str] = None, error_description: Optional[str] = None):
    if error:
        return HTMLResponse(f"<h2>Error</h2><p>{error}: {error_description}</p>", status_code=400)
    app_msal = _msal_app()
    result = app_msal.acquire_token_by_authorization_code(
        code, scopes=MS_SCOPES, redirect_uri=MS_REDIRECT_URI
    )
    if "error" in result:
        return HTMLResponse(f"<h2>Error</h2><p>{result.get('error_description')}</p>", status_code=400)
    admin_email = result.get("id_token_claims", {}).get("preferred_username") or result.get("id_token_claims", {}).get("email", "unknown")
    await db.onedrive_tokens.update_one(
        {"_id": "admin"},
        {"$set": {
            "_id": "admin",
            "access_token": result["access_token"],
            "refresh_token": result.get("refresh_token", ""),
            "admin_email": admin_email,
            "connected_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return HTMLResponse(
        f"""<html><body style='font-family:sans-serif;text-align:center;padding:40px;background:#F8FAFC'>
        <h1 style='color:#EA580C'>✓ OneDrive conectado</h1>
        <p>Cuenta: <b>{admin_email}</b></p>
        <p>Ya puedes cerrar esta ventana y volver a la app.</p>
        </body></html>"""
    )

@api_router.get("/auth/onedrive/status", response_model=OneDriveStatus)
async def onedrive_status(user: dict = Depends(current_user)):
    doc = await db.onedrive_tokens.find_one({"_id": "admin"}, {"_id": 0, "access_token": 0, "refresh_token": 0})
    if not doc:
        return OneDriveStatus(connected=False)
    meta = await db.sync_meta.find_one({"_id": "meta"}, {"_id": 0}) or {}
    file_name = None
    if ONEDRIVE_SHARE_URL:
        share_doc = await db.onedrive_share_cache.find_one({"_id": ONEDRIVE_SHARE_URL})
        if share_doc:
            file_name = share_doc.get("name")
    return OneDriveStatus(
        connected=True,
        admin_email=doc.get("admin_email"),
        last_import_at=meta.get("last_import_at"),
        last_push_at=meta.get("last_push_at"),
        file_name=file_name,
    )

@api_router.post("/auth/onedrive/disconnect")
async def onedrive_disconnect(user: dict = Depends(current_admin)):
    await db.onedrive_tokens.delete_one({"_id": "admin"})
    return {"ok": True}

# ---------------- Sync routes ----------------
@api_router.post("/sync/import-from-onedrive")
async def sync_import(user: dict = Depends(current_admin)):
    xlsx_bytes = await _download_excel_from_onedrive()
    rows = parse_workbook(xlsx_bytes)
    # Replace all materials, preserving ids if row_index matches
    existing = {m["row_index"]: m for m in await db.materiales.find({}, {"_id": 0}).to_list(10000)}
    docs = []
    for r in rows:
        old = existing.get(r["row_index"])
        docs.append({
            "id": old["id"] if old else str(uuid.uuid4()),
            **r,
            "sync_status": "synced",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": user["email"],
        })
    await db.materiales.delete_many({})
    if docs:
        await db.materiales.insert_many(docs)
    await db.sync_meta.update_one(
        {"_id": "meta"},
        {"$set": {"_id": "meta", "last_import_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"imported": len(docs)}

@api_router.post("/sync/push-to-onedrive")
async def sync_push(user: dict = Depends(current_admin)):
    xlsx_bytes = await _download_excel_from_onedrive()
    wb = load_workbook(io.BytesIO(xlsx_bytes))
    ws = wb.active
    materials = await db.materiales.find({}, {"_id": 0}).to_list(10000)
    for m in materials:
        row = m["row_index"]
        for field, col in EDITABLE_COL_MAP.items():
            val = m.get(field)
            if val is not None:
                ws[f"{col}{row}"] = val
    out = io.BytesIO()
    wb.save(out)
    await _upload_excel_to_onedrive(out.getvalue())
    await db.materiales.update_many({}, {"$set": {"sync_status": "synced"}})
    await db.sync_meta.update_one(
        {"_id": "meta"},
        {"$set": {"_id": "meta", "last_push_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"pushed": len(materials)}

# ---------------- Materials routes ----------------
@api_router.get("/materiales", response_model=List[Material])
async def list_materiales(user: dict = Depends(current_user), q: Optional[str] = None, pending_only: bool = False, limit: int = 2000):
    query: dict = {}
    if pending_only:
        query["sync_status"] = "pending"
    if q:
        rx = {"$regex": q, "$options": "i"}
        query["$or"] = [
            {"materiales": rx}, {"cliente": rx}, {"ubicacion": rx},
            {"tecnico": rx}, {"comentarios": rx}, {"comercial": rx}, {"gestor": rx},
        ]
    items = await db.materiales.find(query, {"_id": 0}).limit(limit).to_list(limit)
    items.sort(key=lambda x: x.get("row_index", 0))
    return items

@api_router.get("/materiales/{mid}", response_model=Material)
async def get_material(mid: str, user: dict = Depends(current_user)):
    doc = await db.materiales.find_one({"id": mid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Material no encontrado")
    return doc

@api_router.patch("/materiales/{mid}", response_model=Material)
async def update_material(mid: str, payload: MaterialUpdate, user: dict = Depends(current_user)):
    upd = {k: v for k, v in payload.dict().items() if v is not None}
    if not upd:
        raise HTTPException(400, "Nada que actualizar")
    upd["sync_status"] = "pending"
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    upd["updated_by"] = user["email"]
    res = await db.materiales.update_one({"id": mid}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Material no encontrado")
    doc = await db.materiales.find_one({"id": mid}, {"_id": 0})
    return doc

# ---------------- Stats ----------------
@api_router.get("/stats")
async def stats(user: dict = Depends(current_user)):
    total = await db.materiales.count_documents({})
    pending = await db.materiales.count_documents({"sync_status": "pending"})
    return {"total": total, "pending": pending, "synced": total - pending}

# ---------------- Seed ----------------
async def seed_initial_data():
    count = await db.materiales.count_documents({})
    if count > 0:
        return
    path = Path(INITIAL_EXCEL_PATH)
    if not path.exists():
        return
    with open(path, "rb") as f:
        rows = parse_workbook(f.read())
    docs = [{
        "id": str(uuid.uuid4()),
        **r,
        "sync_status": "synced",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": "system",
    } for r in rows]
    if docs:
        await db.materiales.insert_many(docs)
    logging.getLogger(__name__).info(f"Seeded {len(docs)} materials from {path}")

async def seed_admin_user():
    existing = await db.users.find_one({"email": "admin@materiales.com"})
    if existing:
        return
    user = {
        "id": str(uuid.uuid4()),
        "email": "admin@materiales.com",
        "name": "Administrador",
        "password": hash_password("Admin1234"),
        "role": "admin",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)

# ---------------- Root/Health ----------------
@api_router.get("/")
async def root():
    return {"status": "ok", "service": "Materiales OneDrive App"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def on_startup():
    await seed_admin_user()
    await seed_initial_data()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
