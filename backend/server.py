from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Query
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
import pypdfium2 as pdfium
from PIL import Image
from fastapi.responses import Response
from pdf_filler import build_budget_pdf

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

# Auto-sync config
AUTO_IMPORT_INTERVAL_SEC = 300  # re-import OneDrive file every 5 min on read
AUTO_PUSH_DELAY_SEC = 6         # debounce pushes: wait 6s after last edit

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
    color: Optional[str] = None

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

# ---------------- Auto-sync internals ----------------
import asyncio as _asyncio

_sync_lock = _asyncio.Lock()
_push_task: Optional[_asyncio.Task] = None
_import_task: Optional[_asyncio.Task] = None

async def _has_onedrive_link() -> bool:
    return await db.onedrive_tokens.find_one({"_id": "admin"}) is not None

async def _do_import() -> int:
    """Internal import — no auth, used by background job."""
    async with _sync_lock:
        xlsx_bytes = await _download_excel_from_onedrive()
        rows = parse_workbook(xlsx_bytes)
        existing = {m["row_index"]: m for m in await db.materiales.find({}, {"_id": 0}).to_list(10000)}
        docs = []
        for r in rows:
            old = existing.get(r["row_index"])
            docs.append({
                "id": old["id"] if old else str(uuid.uuid4()),
                **r,
                "sync_status": "synced",
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": old.get("updated_by", "onedrive") if old else "onedrive",
            })
        await db.materiales.delete_many({})
        if docs:
            await db.materiales.insert_many(docs)
        await db.sync_meta.update_one(
            {"_id": "meta"},
            {"$set": {"_id": "meta", "last_import_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
        return len(docs)

async def _do_push() -> int:
    """Internal push — merges pending edits into the OneDrive Excel."""
    async with _sync_lock:
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
        return len(materials)

async def _delayed_push():
    try:
        await _asyncio.sleep(AUTO_PUSH_DELAY_SEC)
        if not await _has_onedrive_link():
            return
        logger = logging.getLogger(__name__)
        try:
            n = await _do_push()
            logger.info(f"Auto-push: {n} filas sincronizadas con OneDrive")
        except Exception as e:
            logger.error(f"Auto-push falló: {e}")
    except _asyncio.CancelledError:
        pass

def schedule_auto_push():
    global _push_task
    if _push_task and not _push_task.done():
        _push_task.cancel()
    _push_task = _asyncio.create_task(_delayed_push())

async def maybe_auto_import():
    """If OneDrive linked and last import older than AUTO_IMPORT_INTERVAL_SEC, import in background."""
    global _import_task
    if not await _has_onedrive_link():
        return
    meta = await db.sync_meta.find_one({"_id": "meta"})
    last = meta.get("last_import_at") if meta else None
    if last:
        try:
            last_dt = datetime.fromisoformat(last)
            if (datetime.now(timezone.utc) - last_dt).total_seconds() < AUTO_IMPORT_INTERVAL_SEC:
                return
        except Exception:
            pass
    # Don't run two imports simultaneously
    if _import_task and not _import_task.done():
        return
    async def _runner():
        try:
            n = await _do_import()
            logging.getLogger(__name__).info(f"Auto-import: {n} filas traídas de OneDrive")
        except Exception as e:
            logging.getLogger(__name__).error(f"Auto-import falló: {e}")
    _import_task = _asyncio.create_task(_runner())

# ---------------- Auth routes ----------------
@api_router.post("/auth/register", response_model=TokenOut)
async def register(payload: UserRegister):
    count = await db.users.count_documents({})
    # Only allow public register when DB is empty (bootstrap first admin).
    if count > 0:
        raise HTTPException(403, "Registro público deshabilitado. Pide a un administrador que cree tu cuenta.")
    user = {
        "id": str(uuid.uuid4()),
        "email": payload.email.lower(),
        "name": payload.name or payload.email.split("@")[0],
        "password": hash_password(payload.password),
        "role": "admin",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    token = create_jwt(user)
    return TokenOut(access_token=token, user=UserOut(id=user["id"], email=user["email"], name=user["name"], role=user["role"], color=user.get("color")))

@api_router.post("/auth/login", response_model=TokenOut)
async def login(payload: UserLogin):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user["password"]):
        raise HTTPException(401, "Credenciales inválidas")
    token = create_jwt(user)
    return TokenOut(access_token=token, user=UserOut(id=user["id"], email=user["email"], name=user.get("name"), role=user.get("role", "user"), color=user.get("color")))

class TechnicianOut(BaseModel):
    id: str
    name: str
    email: str

@api_router.get("/technicians", response_model=List[TechnicianOut])
async def list_technicians(user: dict = Depends(current_user)):
    """List all app users as potential technicians (any authenticated user can read)."""
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    users.sort(key=lambda u: (u.get("name") or u.get("email") or "").lower())
    return [
        TechnicianOut(
            id=u["id"],
            name=u.get("name") or u.get("email", ""),
            email=u.get("email", ""),
        ) for u in users
    ]

@api_router.get("/managers", response_model=List[TechnicianOut])
async def list_managers(user: dict = Depends(current_user)):
    """List admin users (potential project managers / gestores)."""
    users = await db.users.find({"role": "admin"}, {"_id": 0, "password": 0}).to_list(500)
    users.sort(key=lambda u: (u.get("name") or u.get("email") or "").lower())
    return [
        TechnicianOut(
            id=u["id"],
            name=u.get("name") or u.get("email", ""),
            email=u.get("email", ""),
        ) for u in users
    ]



@api_router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(current_user)):
    return UserOut(id=user["id"], email=user["email"], name=user.get("name"), role=user.get("role", "user"), color=user.get("color"))

# ---------------- User management (admin only) ----------------
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None
    role: Literal["admin", "user", "comercial"] = "user"
    color: Optional[str] = None

class UserPatch(BaseModel):
    name: Optional[str] = None
    role: Optional[Literal["admin", "user", "comercial"]] = None
    color: Optional[str] = None

class PasswordReset(BaseModel):
    password: str

class UserListItem(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    role: str
    color: Optional[str] = None
    created_at: Optional[str] = None

# Default color palette rotated per newly created user
DEFAULT_USER_COLORS = [
    "#3B82F6",  # blue
    "#10B981",  # green
    "#F59E0B",  # amber
    "#EF4444",  # red
    "#8B5CF6",  # violet
    "#EC4899",  # pink
    "#06B6D4",  # cyan
    "#F97316",  # orange
    "#84CC16",  # lime
    "#14B8A6",  # teal
]

def _next_default_color(existing_colors: List[str]) -> str:
    used = set(existing_colors or [])
    for c in DEFAULT_USER_COLORS:
        if c not in used:
            return c
    return DEFAULT_USER_COLORS[len(used) % len(DEFAULT_USER_COLORS)]

@api_router.get("/users", response_model=List[UserListItem])
async def list_users(admin: dict = Depends(current_admin)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    users.sort(key=lambda u: u.get("created_at", ""))
    return users

@api_router.post("/users", response_model=UserListItem)
async def create_user(payload: UserCreate, admin: dict = Depends(current_admin)):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(400, "Email ya registrado")
    # Pick a unique default color if none provided
    if payload.color:
        color = payload.color
    else:
        existing_colors = [u.get("color") for u in await db.users.find({}, {"_id": 0, "color": 1}).to_list(1000)]
        color = _next_default_color([c for c in existing_colors if c])
    user = {
        "id": str(uuid.uuid4()),
        "email": payload.email.lower(),
        "name": payload.name or payload.email.split("@")[0],
        "password": hash_password(payload.password),
        "role": payload.role,
        "color": color,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    return UserListItem(
        id=user["id"], email=user["email"], name=user["name"],
        role=user["role"], color=user["color"], created_at=user["created_at"],
    )

@api_router.patch("/users/{uid}", response_model=UserListItem)
async def update_user(uid: str, payload: UserPatch, admin: dict = Depends(current_admin)):
    target = await db.users.find_one({"id": uid})
    if not target:
        raise HTTPException(404, "Usuario no encontrado")
    upd = {k: v for k, v in payload.dict().items() if v is not None}
    if not upd:
        raise HTTPException(400, "Nada que actualizar")
    # Prevent removing last admin
    if payload.role == "user" and target.get("role") == "admin":
        remaining = await db.users.count_documents({"role": "admin", "id": {"$ne": uid}})
        if remaining == 0:
            raise HTTPException(400, "No puedes quitar el rol admin al último administrador")
    await db.users.update_one({"id": uid}, {"$set": upd})
    updated = await db.users.find_one({"id": uid}, {"_id": 0, "password": 0})
    return updated

@api_router.post("/users/{uid}/reset-password")
async def reset_password(uid: str, payload: PasswordReset, admin: dict = Depends(current_admin)):
    target = await db.users.find_one({"id": uid})
    if not target:
        raise HTTPException(404, "Usuario no encontrado")
    if len(payload.password) < 4:
        raise HTTPException(400, "Contraseña demasiado corta (mín. 4)")
    await db.users.update_one({"id": uid}, {"$set": {"password": hash_password(payload.password)}})
    return {"ok": True}

@api_router.delete("/users/{uid}")
async def delete_user(uid: str, admin: dict = Depends(current_admin)):
    if uid == admin["id"]:
        raise HTTPException(400, "No puedes eliminarte a ti mismo")
    target = await db.users.find_one({"id": uid})
    if not target:
        raise HTTPException(404, "Usuario no encontrado")
    # Prevent deleting last admin
    if target.get("role") == "admin":
        remaining = await db.users.count_documents({"role": "admin", "id": {"$ne": uid}})
        if remaining == 0:
            raise HTTPException(400, "No puedes eliminar al último administrador")
    await db.users.delete_one({"id": uid})
    return {"ok": True}

# ---------------- Plans & Stamps ----------------
class PlanCreate(BaseModel):
    title: str
    data: Optional[dict] = None  # {shapes: [...]}
    material_id: Optional[str] = None
    source_event_id: Optional[str] = None
    source_attachment_id: Optional[str] = None

class PlanPatch(BaseModel):
    title: Optional[str] = None
    data: Optional[dict] = None
    source_attachment_id: Optional[str] = None

class PlanOut(BaseModel):
    id: str
    title: str
    data: dict
    created_at: str
    updated_at: str
    created_by: str
    material_id: Optional[str] = None
    source_event_id: Optional[str] = None
    source_attachment_id: Optional[str] = None

class PlanListItem(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    created_by: str
    shape_count: int = 0

class StampCreate(BaseModel):
    name: str
    image_base64: str  # data URI: "data:image/png;base64,...."

class StampOut(BaseModel):
    id: str
    name: str
    is_builtin: bool
    image_base64: Optional[str] = None  # null for builtin (frontend knows icons)
    icon_key: Optional[str] = None      # key for builtin SVG on frontend

BUILTIN_STAMPS = [
    # Aberturas
    {"id": "builtin_door", "name": "Puerta", "is_builtin": True, "icon_key": "door"},
    {"id": "builtin_door_double", "name": "Puerta doble", "is_builtin": True, "icon_key": "door_double"},
    {"id": "builtin_door_sliding", "name": "Puerta corredera", "is_builtin": True, "icon_key": "door_sliding"},
    {"id": "builtin_window", "name": "Ventana", "is_builtin": True, "icon_key": "window"},
    {"id": "builtin_stairs", "name": "Escalera", "is_builtin": True, "icon_key": "stairs"},
    {"id": "builtin_door_handle", "name": "Manilla puerta", "is_builtin": True, "icon_key": "door_handle"},
    # Control de accesos
    {"id": "builtin_card_reader", "name": "Lector tarjeta", "is_builtin": True, "icon_key": "card_reader"},
    {"id": "builtin_keypad", "name": "Teclado", "is_builtin": True, "icon_key": "keypad"},
    {"id": "builtin_fingerprint", "name": "Lector huella", "is_builtin": True, "icon_key": "fingerprint"},
    {"id": "builtin_face_reader", "name": "Lector facial", "is_builtin": True, "icon_key": "face_reader"},
    {"id": "builtin_maglock", "name": "Electroimán", "is_builtin": True, "icon_key": "maglock"},
    {"id": "builtin_electric_strike", "name": "Cerradura eléc.", "is_builtin": True, "icon_key": "electric_strike"},
    {"id": "builtin_exit_button", "name": "Pulsador salida", "is_builtin": True, "icon_key": "exit_button"},
    {"id": "builtin_emergency_button", "name": "Botón emergencia", "is_builtin": True, "icon_key": "emergency_button"},
    {"id": "builtin_intercom", "name": "Interfono", "is_builtin": True, "icon_key": "intercom"},
    {"id": "builtin_video_intercom", "name": "Videoportero", "is_builtin": True, "icon_key": "video_intercom"},
    {"id": "builtin_controller", "name": "Controladora", "is_builtin": True, "icon_key": "controller"},
    {"id": "builtin_door_contact", "name": "Contacto mag.", "is_builtin": True, "icon_key": "door_contact"},
    {"id": "builtin_turnstile", "name": "Torniquete", "is_builtin": True, "icon_key": "turnstile"},
    {"id": "builtin_bollard", "name": "Bolardo retráctil", "is_builtin": True, "icon_key": "bollard"},
    {"id": "builtin_barrier", "name": "Barrera vehículo", "is_builtin": True, "icon_key": "barrier"},
    {"id": "builtin_gate_motor", "name": "Motor puerta", "is_builtin": True, "icon_key": "gate_motor"},
    # Seguridad
    {"id": "builtin_camera", "name": "Cámara", "is_builtin": True, "icon_key": "camera"},
    {"id": "builtin_motion_sensor", "name": "Sensor mov.", "is_builtin": True, "icon_key": "motion_sensor"},
    {"id": "builtin_smoke_detector", "name": "Detector humo", "is_builtin": True, "icon_key": "smoke_detector"},
    {"id": "builtin_siren", "name": "Sirena", "is_builtin": True, "icon_key": "siren"},
    # Electricidad
    {"id": "builtin_outlet", "name": "Enchufe", "is_builtin": True, "icon_key": "outlet"},
    {"id": "builtin_switch", "name": "Interruptor", "is_builtin": True, "icon_key": "switch"},
    {"id": "builtin_light", "name": "Luminaria", "is_builtin": True, "icon_key": "light"},
    {"id": "builtin_light_wall", "name": "Luz pared", "is_builtin": True, "icon_key": "light_wall"},
    # Referencia
    {"id": "builtin_north_arrow", "name": "Norte", "is_builtin": True, "icon_key": "north_arrow"},
    {"id": "builtin_column", "name": "Columna", "is_builtin": True, "icon_key": "column"},
    {"id": "builtin_column_round", "name": "Columna redonda", "is_builtin": True, "icon_key": "column_round"},
    {"id": "builtin_dimension", "name": "Cota", "is_builtin": True, "icon_key": "dimension"},
]

@api_router.get("/plans", response_model=List[PlanListItem])
async def list_plans(user: dict = Depends(current_user)):
    plans = await db.plans.find({}, {"_id": 0, "data": 0}).to_list(2000)
    out: List[PlanListItem] = []
    # fetch shape counts in one pass
    all_data = await db.plans.find({}, {"_id": 0, "id": 1, "data": 1}).to_list(2000)
    counts = {p["id"]: len((p.get("data") or {}).get("shapes", [])) for p in all_data}
    plans.sort(key=lambda p: p.get("updated_at", ""), reverse=True)
    for p in plans:
        out.append(PlanListItem(
            id=p["id"], title=p["title"],
            created_at=p.get("created_at", ""), updated_at=p.get("updated_at", ""),
            created_by=p.get("created_by", ""),
            shape_count=counts.get(p["id"], 0),
        ))
    return out

@api_router.post("/plans", response_model=PlanOut)
async def create_plan(payload: PlanCreate, user: dict = Depends(current_user)):
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "title": payload.title.strip() or "Plano sin título",
        "data": payload.data or {"shapes": []},
        "material_id": payload.material_id,
        "source_event_id": payload.source_event_id,
        "source_attachment_id": payload.source_attachment_id,
        "created_at": now,
        "updated_at": now,
        "created_by": user["email"],
    }
    await db.plans.insert_one(doc)
    return PlanOut(**{k: v for k, v in doc.items() if k != "_id"})

@api_router.get("/plans/{pid}", response_model=PlanOut)
async def get_plan(pid: str, user: dict = Depends(current_user)):
    p = await db.plans.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Plano no encontrado")
    # Ensure optional fields are present in response
    p.setdefault("material_id", None)
    p.setdefault("source_event_id", None)
    p.setdefault("source_attachment_id", None)
    return p

@api_router.patch("/plans/{pid}", response_model=PlanOut)
async def update_plan(pid: str, payload: PlanPatch, user: dict = Depends(current_user)):
    upd = {k: v for k, v in payload.dict().items() if v is not None}
    if not upd:
        raise HTTPException(400, "Nada que actualizar")
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.plans.update_one({"id": pid}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Plano no encontrado")
    p = await db.plans.find_one({"id": pid}, {"_id": 0})
    return p

@api_router.delete("/plans/{pid}")
async def delete_plan(pid: str, user: dict = Depends(current_user)):
    res = await db.plans.delete_one({"id": pid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Plano no encontrado")
    return {"ok": True}

class BackgroundUpload(BaseModel):
    file_base64: str  # raw base64 (no data URI prefix)
    mime_type: str   # "image/jpeg" | "image/png" | "application/pdf"

@api_router.post("/plans/{pid}/background")
async def upload_background(pid: str, payload: BackgroundUpload, user: dict = Depends(current_user)):
    plan = await db.plans.find_one({"id": pid})
    if not plan:
        raise HTTPException(404, "Plano no encontrado")
    try:
        raw = base64.b64decode(payload.file_base64)
    except Exception:
        raise HTTPException(400, "Base64 inválido")
    mime = payload.mime_type.lower()
    if mime == "application/pdf":
        try:
            pdf = pdfium.PdfDocument(raw)
            page = pdf[0]
            pil = page.render(scale=2).to_pil()
        except Exception as e:
            raise HTTPException(400, f"No se pudo leer el PDF: {e}")
        buf = io.BytesIO()
        pil.save(buf, format="PNG")
        png_b64 = base64.b64encode(buf.getvalue()).decode()
        bg = {"type": "image", "data_uri": f"data:image/png;base64,{png_b64}",
              "width": pil.width, "height": pil.height}
    elif mime in ("image/jpeg", "image/jpg", "image/png", "image/webp"):
        try:
            pil = Image.open(io.BytesIO(raw))
            width, height = pil.size
        except Exception as e:
            raise HTTPException(400, f"Imagen inválida: {e}")
        ext = "jpeg" if "jpeg" in mime or "jpg" in mime else "png" if "png" in mime else "webp"
        data_uri = f"data:image/{ext};base64,{payload.file_base64}"
        bg = {"type": "image", "data_uri": data_uri, "width": width, "height": height}
    else:
        raise HTTPException(400, "Tipo no soportado (usar JPG, PNG o PDF)")
    # update plan.data.background
    data = plan.get("data") or {"shapes": []}
    data["background"] = bg
    await db.plans.update_one({"id": pid}, {
        "$set": {"data": data, "updated_at": datetime.now(timezone.utc).isoformat()}
    })
    return {"ok": True, "background": bg}

@api_router.delete("/plans/{pid}/background")
async def remove_background(pid: str, user: dict = Depends(current_user)):
    plan = await db.plans.find_one({"id": pid})
    if not plan:
        raise HTTPException(404, "Plano no encontrado")
    data = plan.get("data") or {"shapes": []}
    if "background" in data:
        del data["background"]
    await db.plans.update_one({"id": pid}, {
        "$set": {"data": data, "updated_at": datetime.now(timezone.utc).isoformat()}
    })
    return {"ok": True}

# ---------------- Calendar Events ----------------
class RecurrenceRule(BaseModel):
    type: Literal["none", "daily", "weekly", "monthly"] = "none"
    until: Optional[str] = None  # ISO date (YYYY-MM-DD) inclusive

class EventCreate(BaseModel):
    title: str
    start_at: str  # ISO
    end_at: str    # ISO
    description: Optional[str] = None
    material_id: Optional[str] = None
    assigned_user_ids: List[str] = []
    manager_id: Optional[str] = None  # gestor del proyecto (admin)
    recurrence: Optional[RecurrenceRule] = None
    # Status del trabajo. "in_progress" por defecto. Valores aceptados:
    #   in_progress       — todavía en curso
    #   completed         — proyecto terminado (oscurece el evento)
    #   pending_completion — pendiente de terminar (resalta el evento)
    status: Optional[str] = "in_progress"
    seguimiento: Optional[str] = None  # observaciones del técnico

class EventPatch(BaseModel):
    title: Optional[str] = None
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    description: Optional[str] = None
    material_id: Optional[str] = None
    assigned_user_ids: Optional[List[str]] = None
    manager_id: Optional[str] = None
    recurrence: Optional[RecurrenceRule] = None
    status: Optional[str] = None
    seguimiento: Optional[str] = None

class EventOut(BaseModel):
    id: str
    title: str
    start_at: str
    end_at: str
    description: Optional[str] = None
    material_id: Optional[str] = None
    material: Optional[dict] = None
    assigned_user_ids: List[str] = []
    assigned_users: List[dict] = []
    manager_id: Optional[str] = None
    manager: Optional[dict] = None
    recurrence: Optional[dict] = None
    attachments: List[dict] = []  # metadata only (no base64) for list views
    base_event_id: Optional[str] = None  # for expanded occurrences
    created_by: str
    created_at: str
    status: Optional[str] = "in_progress"
    seguimiento: Optional[str] = None

class AttachmentUpload(BaseModel):
    filename: str
    mime_type: str
    base64: str  # data only, no data: prefix

MAX_ATTACHMENT_MB = 15  # per file

def _strip_attachments(ev: dict) -> dict:
    """Return event with attachments metadata only (no base64)."""
    atts = ev.get("attachments") or []
    meta = []
    for a in atts:
        meta.append({
            "id": a.get("id"),
            "filename": a.get("filename"),
            "mime_type": a.get("mime_type"),
            "size": a.get("size"),
            "uploaded_at": a.get("uploaded_at"),
            "uploaded_by": a.get("uploaded_by"),
        })
    ev["attachments"] = meta
    return ev

async def _attach_material(ev: dict) -> dict:
    mid = ev.get("material_id")
    if mid:
        m = await db.materiales.find_one({"id": mid}, {"_id": 0})
        if m:
            ev["material"] = m
    return ev

async def _attach_users(ev: dict) -> dict:
    ids = ev.get("assigned_user_ids") or []
    if ids:
        users = await db.users.find({"id": {"$in": ids}}, {"_id": 0, "password": 0}).to_list(200)
        ev["assigned_users"] = [
            {"id": u["id"], "email": u["email"], "name": u.get("name"), "color": u.get("color")}
            for u in users
        ]
    else:
        ev["assigned_users"] = []
    # Attach manager (gestor)
    mgr_id = ev.get("manager_id")
    if mgr_id:
        mgr = await db.users.find_one({"id": mgr_id}, {"_id": 0, "password": 0})
        if mgr:
            ev["manager"] = {
                "id": mgr["id"],
                "email": mgr["email"],
                "name": mgr.get("name"),
                "color": mgr.get("color"),
                "role": mgr.get("role"),
            }
        else:
            ev["manager"] = None
    else:
        ev["manager"] = None
    return ev

def _expand_recurrence(ev: dict, from_dt: datetime, to_dt: datetime) -> List[dict]:
    """Return list of virtual occurrences inside [from_dt, to_dt)."""
    rec = ev.get("recurrence") or {}
    rtype = rec.get("type", "none")
    if rtype == "none":
        start = datetime.fromisoformat(ev["start_at"].replace("Z", "+00:00"))
        # Defensive: normalise tz-naive ISO strings (some legacy rows) to UTC
        # so comparisons with the tz-aware from_dt/to_dt never fail.
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if from_dt <= start < to_dt:
            return [ev]
        return []
    # compute step
    base_start = datetime.fromisoformat(ev["start_at"].replace("Z", "+00:00"))
    base_end = datetime.fromisoformat(ev["end_at"].replace("Z", "+00:00"))
    if base_start.tzinfo is None:
        base_start = base_start.replace(tzinfo=timezone.utc)
    if base_end.tzinfo is None:
        base_end = base_end.replace(tzinfo=timezone.utc)
    duration = base_end - base_start
    until_str = rec.get("until")
    until_dt = None
    if until_str:
        try:
            until_dt = datetime.fromisoformat(until_str + "T23:59:59+00:00")
        except Exception:
            until_dt = None
    results: List[dict] = []
    cur = base_start
    # Skip ahead if base_start far before from_dt
    # Iterate up to max 500 occurrences to prevent runaway
    for i in range(500):
        if until_dt and cur > until_dt:
            break
        if cur >= to_dt:
            break
        if cur + duration > from_dt:  # occurrence overlaps window
            occ = dict(ev)
            occ["id"] = f"{ev['id']}:{cur.date().isoformat()}"
            occ["base_event_id"] = ev["id"]
            occ["start_at"] = cur.isoformat().replace("+00:00", "Z")
            occ["end_at"] = (cur + duration).isoformat().replace("+00:00", "Z")
            results.append(occ)
        # next
        if rtype == "daily":
            cur = cur + timedelta(days=1)
        elif rtype == "weekly":
            cur = cur + timedelta(days=7)
        elif rtype == "monthly":
            # advance ~1 month keeping day of month
            y = cur.year
            m = cur.month + 1
            if m > 12:
                m -= 12
                y += 1
            try:
                cur = cur.replace(year=y, month=m)
            except ValueError:
                # day out of range (e.g. 31 of feb) → last day of month
                import calendar as _cal
                last = _cal.monthrange(y, m)[1]
                cur = cur.replace(year=y, month=m, day=last)
        else:
            break
    return results

@api_router.get("/events", response_model=List[EventOut])
async def list_events(
    user: dict = Depends(current_user),
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = None,
):
    query: dict = {}
    # Filter by visibility: non-admin only sees events where they are assigned
    is_admin = user.get("role") == "admin"
    if not is_admin:
        query["assigned_user_ids"] = user["id"]
    events = await db.events.find(query, {"_id": 0}).to_list(2000)
    # Expand recurrences
    from_dt = datetime.fromisoformat(from_.replace("Z", "+00:00")) if from_ else datetime.min.replace(tzinfo=timezone.utc)
    to_dt = datetime.fromisoformat(to.replace("Z", "+00:00")) if to else datetime.max.replace(tzinfo=timezone.utc)
    expanded: List[dict] = []
    for e in events:
        expanded.extend(_expand_recurrence(e, from_dt, to_dt))
    expanded.sort(key=lambda e: e.get("start_at", ""))
    out = []
    for e in expanded:
        e = await _attach_material(e)
        e = await _attach_users(e)
        e = _strip_attachments(e)
        out.append(e)
    return out

@api_router.post("/events", response_model=EventOut)
async def create_event(payload: EventCreate, admin: dict = Depends(current_admin)):
    if payload.end_at <= payload.start_at:
        raise HTTPException(400, "end_at debe ser posterior a start_at")
    doc = {
        "id": str(uuid.uuid4()),
        "title": payload.title.strip() or "Evento sin título",
        "start_at": payload.start_at,
        "end_at": payload.end_at,
        "description": payload.description,
        "material_id": payload.material_id,
        "assigned_user_ids": payload.assigned_user_ids or [],
        "manager_id": payload.manager_id,
        "recurrence": payload.recurrence.dict() if payload.recurrence else None,
        "attachments": [],
        "created_by": admin["email"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.events.insert_one(doc)
    doc = await _attach_material(doc)
    doc = await _attach_users(doc)
    doc = _strip_attachments(doc)
    return doc

@api_router.patch("/events/{eid}", response_model=EventOut)
async def update_event(eid: str, payload: EventPatch, user: dict = Depends(current_user)):
    # Strip virtual-occurrence suffix if present
    real_id = eid.split(":")[0]
    upd: dict = {}
    # Use exclude_unset so explicit nulls ARE applied (to clear optional fields).
    data = payload.dict(exclude_unset=True)

    # Fetch current event for permission check and notification baseline.
    ev_current = await db.events.find_one({"id": real_id}, {"_id": 0})
    if not ev_current:
        raise HTTPException(404, "Evento no encontrado")

    is_admin = user.get("role") == "admin"
    is_assigned = user["id"] in (ev_current.get("assigned_user_ids") or [])
    if not is_admin:
        # A non-admin can only modify `status` and `seguimiento`, and only
        # if they are assigned to this event (i.e. the technician in charge).
        if not is_assigned:
            raise HTTPException(403, "No autorizado")
        allowed = {"status", "seguimiento"}
        if any(k not in allowed for k in data.keys()):
            raise HTTPException(403, "Técnicos solo pueden modificar estado y seguimiento")

    for k, v in data.items():
        if k == "recurrence":
            upd["recurrence"] = v  # dict from pydantic or None (clears)
        elif k == "assigned_user_ids":
            upd[k] = v or []
        else:
            upd[k] = v
    if not upd:
        raise HTTPException(400, "Nada que actualizar")
    res = await db.events.update_one({"id": real_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Evento no encontrado")

    # Notifications: whenever status changes, create an in-app notification
    # for the event's manager (if set). The seguimiento text is included so
    # the manager sees the technician's observations right in the list.
    new_status = upd.get("status")
    prev_status = ev_current.get("status") or "in_progress"
    if new_status and new_status != prev_status and ev_current.get("manager_id"):
        title = ev_current.get("title") or "Evento"
        if new_status == "completed":
            notif_title = f"Proyecto terminado: {title}"
            notif_msg = f"{user.get('name') or user.get('email')} marcó el evento como completado."
        elif new_status == "pending_completion":
            notif_title = f"Pendiente de terminar: {title}"
            seg = upd.get("seguimiento") or ev_current.get("seguimiento") or ""
            notif_msg = (
                f"{user.get('name') or user.get('email')} dejó el evento pendiente de terminar."
                + (f"\nObservaciones: {seg}" if seg else "")
            )
        else:
            notif_title = f"Estado actualizado: {title}"
            notif_msg = f"El estado del evento pasó a '{new_status}'."
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": ev_current["manager_id"],
            "event_id": real_id,
            "type": f"event_{new_status}",
            "title": notif_title,
            "message": notif_msg,
            "read": False,
            "created_at": datetime.utcnow().isoformat(),
            "from_user_id": user["id"],
            "from_user_name": user.get("name") or user.get("email"),
        })

    ev = await db.events.find_one({"id": real_id}, {"_id": 0})
    ev = await _attach_material(ev)
    ev = await _attach_users(ev)
    ev = _strip_attachments(ev)
    return ev

@api_router.delete("/events/{eid}")
async def delete_event(eid: str, admin: dict = Depends(current_admin)):
    real_id = eid.split(":")[0]
    res = await db.events.delete_one({"id": real_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Evento no encontrado")
    return {"ok": True}

@api_router.get("/events/{eid}", response_model=EventOut)
async def get_event(eid: str, user: dict = Depends(current_user)):
    """Fetch a single event by id. Used by the notifications bell to open an
    event that may not be inside the currently-visible calendar range."""
    real_id = eid.split(":")[0]
    ev = await db.events.find_one({"id": real_id}, {"_id": 0})
    if not ev:
        raise HTTPException(404, "Evento no encontrado")
    # Permission: admin OR assigned user OR manager of the event
    is_admin = user.get("role") == "admin"
    allowed_ids = set((ev.get("assigned_user_ids") or []))
    if ev.get("manager_id"):
        allowed_ids.add(ev.get("manager_id"))
    if not is_admin and user["id"] not in allowed_ids:
        raise HTTPException(403, "No autorizado")
    ev = await _attach_material(ev)
    ev = await _attach_users(ev)
    ev = _strip_attachments(ev)
    return ev

# ---------------- Notifications ----------------
@api_router.get("/notifications")
async def list_notifications(user: dict = Depends(current_user), unread_only: bool = False):
    """Returns notifications addressed to the current user, newest first."""
    q: dict = {"user_id": user["id"]}
    if unread_only:
        q["read"] = False
    cursor = db.notifications.find(q, {"_id": 0}).sort("created_at", -1).limit(100)
    items = await cursor.to_list(length=100)
    unread = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"items": items, "unread": unread}

@api_router.post("/notifications/{nid}/read")
async def mark_notification_read(nid: str, user: dict = Depends(current_user)):
    res = await db.notifications.update_one(
        {"id": nid, "user_id": user["id"]},
        {"$set": {"read": True}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Notificación no encontrada")
    return {"ok": True}

@api_router.post("/notifications/read-all")
async def mark_all_read(user: dict = Depends(current_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}

@api_router.delete("/notifications/{nid}")
async def delete_notification(nid: str, user: dict = Depends(current_user)):
    res = await db.notifications.delete_one({"id": nid, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Notificación no encontrada")
    return {"ok": True}

@api_router.delete("/notifications")
async def delete_all_notifications(
    user: dict = Depends(current_user),
    only_read: bool = False,
):
    """Bulk-delete notifications for the current user.
    If only_read=true, only read notifications are deleted; otherwise all."""
    q: dict = {"user_id": user["id"]}
    if only_read:
        q["read"] = True
    res = await db.notifications.delete_many(q)
    return {"ok": True, "deleted": res.deleted_count}

# ---------------- Event attachments ----------------
@api_router.post("/events/{eid}/attachments")
async def upload_event_attachment(eid: str, payload: AttachmentUpload, user: dict = Depends(current_user)):
    real_id = eid.split(":")[0]
    ev = await db.events.find_one({"id": real_id}, {"_id": 0})
    if not ev:
        raise HTTPException(404, "Evento no encontrado")
    # Permission: admin OR assigned user
    is_admin = user.get("role") == "admin"
    if not is_admin and user["id"] not in (ev.get("assigned_user_ids") or []):
        raise HTTPException(403, "No autorizado")
    # Validate base64 size
    b64 = (payload.base64 or "").split(",")[-1].strip()
    if not b64:
        raise HTTPException(400, "Archivo vacío")
    try:
        raw_size = (len(b64) * 3) // 4
    except Exception:
        raw_size = 0
    if raw_size > MAX_ATTACHMENT_MB * 1024 * 1024:
        raise HTTPException(413, f"El archivo excede {MAX_ATTACHMENT_MB}MB")
    mime = payload.mime_type or ""
    allowed = ("application/pdf", "image/jpeg", "image/jpg", "image/png")
    if not any(mime.lower().startswith(a) for a in allowed):
        raise HTTPException(400, "Tipo no soportado. Solo PDF, JPEG o PNG")
    att = {
        "id": str(uuid.uuid4()),
        "filename": payload.filename[:160] or "archivo",
        "mime_type": mime,
        "size": raw_size,
        "base64": b64,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": user["email"],
    }
    await db.events.update_one({"id": real_id}, {"$push": {"attachments": att}})
    # Return metadata only
    return {
        "id": att["id"],
        "filename": att["filename"],
        "mime_type": att["mime_type"],
        "size": att["size"],
        "uploaded_at": att["uploaded_at"],
        "uploaded_by": att["uploaded_by"],
    }

@api_router.get("/events/{eid}/attachments/{aid}")
async def get_event_attachment(eid: str, aid: str, user: dict = Depends(current_user)):
    real_id = eid.split(":")[0]
    ev = await db.events.find_one({"id": real_id}, {"_id": 0})
    if not ev:
        raise HTTPException(404, "Evento no encontrado")
    is_admin = user.get("role") == "admin"
    if not is_admin and user["id"] not in (ev.get("assigned_user_ids") or []):
        raise HTTPException(403, "No autorizado")
    for a in (ev.get("attachments") or []):
        if a.get("id") == aid:
            return {
                "id": a["id"],
                "filename": a["filename"],
                "mime_type": a["mime_type"],
                "size": a["size"],
                "base64": a["base64"],
                "uploaded_at": a.get("uploaded_at"),
                "uploaded_by": a.get("uploaded_by"),
            }
    raise HTTPException(404, "Adjunto no encontrado")

@api_router.delete("/events/{eid}/attachments/{aid}")
async def delete_event_attachment(eid: str, aid: str, user: dict = Depends(current_user)):
    real_id = eid.split(":")[0]
    ev = await db.events.find_one({"id": real_id}, {"_id": 0})
    if not ev:
        raise HTTPException(404, "Evento no encontrado")
    is_admin = user.get("role") == "admin"
    if not is_admin and user["id"] not in (ev.get("assigned_user_ids") or []):
        raise HTTPException(403, "No autorizado")
    res = await db.events.update_one(
        {"id": real_id},
        {"$pull": {"attachments": {"id": aid}}}
    )
    if res.modified_count == 0:
        raise HTTPException(404, "Adjunto no encontrado")
    return {"ok": True}

@api_router.get("/stamps", response_model=List[StampOut])
async def list_stamps(user: dict = Depends(current_user)):
    customs = await db.stamps.find({}, {"_id": 0}).to_list(500)
    out = [StampOut(**s) for s in BUILTIN_STAMPS]
    for c in customs:
        out.append(StampOut(
            id=c["id"], name=c["name"], is_builtin=False,
            image_base64=c["image_base64"],
        ))
    return out

@api_router.post("/stamps", response_model=StampOut)
async def create_stamp(payload: StampCreate, admin: dict = Depends(current_admin)):
    doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip() or "Sello personalizado",
        "image_base64": payload.image_base64,
        "is_builtin": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["email"],
    }
    await db.stamps.insert_one(doc)
    return StampOut(
        id=doc["id"], name=doc["name"], is_builtin=False,
        image_base64=doc["image_base64"],
    )

@api_router.delete("/stamps/{sid}")
async def delete_stamp(sid: str, admin: dict = Depends(current_admin)):
    if sid.startswith("builtin_"):
        raise HTTPException(400, "No puedes eliminar sellos predefinidos")
    res = await db.stamps.delete_one({"id": sid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Sello no encontrado")
    return {"ok": True}

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

# ---------------- Sync routes (manual override — uses internal helpers) ----------------
@api_router.post("/sync/import-from-onedrive")
async def sync_import(user: dict = Depends(current_admin)):
    n = await _do_import()
    return {"imported": n}

@api_router.post("/sync/push-to-onedrive")
async def sync_push(user: dict = Depends(current_admin)):
    n = await _do_push()
    return {"pushed": n}

# ---------------- Materials routes ----------------
@api_router.get("/materiales", response_model=List[Material])
async def list_materiales(user: dict = Depends(current_user), q: Optional[str] = None, pending_only: bool = False, limit: int = 2000):
    # fire-and-forget auto-import if stale
    await maybe_auto_import()
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
    # schedule automatic push to OneDrive (debounced)
    if await _has_onedrive_link():
        schedule_auto_push()
    return doc

# ---------------- Stats ----------------
@api_router.get("/stats")
async def stats(user: dict = Depends(current_user)):
    total = await db.materiales.count_documents({})
    pending = await db.materiales.count_documents({"sync_status": "pending"})
    return {"total": total, "pending": pending, "synced": total - pending}

# ---------------- Budgets (Presupuestos) ----------------
async def current_admin_or_comercial(user: dict = Depends(current_user)):
    if user.get("role") not in ("admin", "comercial"):
        raise HTTPException(403, "Requiere rol admin o comercial")
    return user

class EquipmentRow(BaseModel):
    elemento: str = ""
    cantidad: Optional[str] = ""
    ubicacion: Optional[str] = ""
    observaciones: Optional[str] = ""

class BudgetCreate(BaseModel):
    # general
    n_proyecto: Optional[str] = ""
    cliente: Optional[str] = ""
    nombre_instalacion: Optional[str] = ""
    direccion: Optional[str] = ""
    contacto_1: Optional[str] = ""
    contacto_2: Optional[str] = ""
    observaciones_presupuesto: Optional[str] = ""
    fecha_inicio: Optional[str] = ""
    fecha_fin: Optional[str] = ""
    observaciones_ejecucion: Optional[str] = ""
    # equipos
    equipos: List[EquipmentRow] = []
    # deliveries
    entrega_tarjeta_mantenimiento: bool = False
    entrega_llave_salto: bool = False
    entrega_eps100: bool = False
    # signatures (base64 PNG)
    firma_isai: Optional[str] = ""
    nombre_isai: Optional[str] = ""
    cargo_isai: Optional[str] = ""
    firma_cliente: Optional[str] = ""
    nombre_cliente: Optional[str] = ""
    cargo_cliente: Optional[str] = ""
    # link to existing material (proyecto)
    material_id: Optional[str] = None

class BudgetPatch(BudgetCreate):
    pass

@api_router.post("/budgets")
async def create_budget(payload: BudgetCreate, user: dict = Depends(current_admin_or_comercial)):
    now = datetime.now(timezone.utc).isoformat()
    doc = payload.dict()
    doc["equipos"] = [e if isinstance(e, dict) else e.dict() for e in (payload.equipos or [])]
    doc.update({
        "id": str(uuid.uuid4()),
        "created_at": now,
        "updated_at": now,
        "created_by": user["email"],
    })
    await db.budgets.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/budgets")
async def list_budgets(user: dict = Depends(current_admin_or_comercial)):
    items = await db.budgets.find({}, {"_id": 0, "firma_isai": 0, "firma_cliente": 0}).sort("updated_at", -1).to_list(500)
    return items

@api_router.get("/budgets/{bid}")
async def get_budget(bid: str, user: dict = Depends(current_admin_or_comercial)):
    b = await db.budgets.find_one({"id": bid}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Presupuesto no encontrado")
    return b

@api_router.patch("/budgets/{bid}")
async def update_budget(bid: str, payload: BudgetPatch, user: dict = Depends(current_admin_or_comercial)):
    upd = {k: v for k, v in payload.dict().items() if v is not None}
    if "equipos" in upd:
        upd["equipos"] = [e if isinstance(e, dict) else (e.dict() if hasattr(e, "dict") else e) for e in upd["equipos"]]
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.budgets.update_one({"id": bid}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Presupuesto no encontrado")
    b = await db.budgets.find_one({"id": bid}, {"_id": 0})
    return b

@api_router.delete("/budgets/{bid}")
async def delete_budget(bid: str, user: dict = Depends(current_admin_or_comercial)):
    res = await db.budgets.delete_one({"id": bid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Presupuesto no encontrado")
    return {"ok": True}

DEFAULT_EQUIPMENT_LIST = [
    "Cilindro electrónico Salto XS4",
    "Lector de muro Salto XS4",
    "Cerradura electrónica Salto XS4",
    "Escudo electrónico Salto XS4",
    "Mini cilindro Salto",
    "Tarjeta MIFARE 1K",
    "Llavero MIFARE",
    "Portal encodificador HAMS",
    "PPD (Portable Programming Device)",
    "Controlador Salto CU5000",
    "Fuente de alimentación 12V",
    "Cableado estructurado",
]

@api_router.get("/budgets-defaults/equipos")
async def budgets_default_equipos(user: dict = Depends(current_admin_or_comercial)):
    return {"items": DEFAULT_EQUIPMENT_LIST}


@api_router.get("/budgets/{bid}/pdf")
async def get_budget_pdf(bid: str, user: dict = Depends(current_admin_or_comercial)):
    """
    Genera el PDF 'Hoja de instalación' rellenado con los datos del presupuesto,
    manteniendo el layout exacto del template y los campos editables (AcroForm).
    """
    b = await db.budgets.find_one({"id": bid}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Presupuesto no encontrado")
    try:
        pdf_bytes = build_budget_pdf(b)
    except Exception as e:
        logging.exception("PDF generation failed")
        raise HTTPException(500, f"No se pudo generar el PDF: {e}")
    filename = f"hoja_instalacion_{(b.get('n_proyecto') or bid)[:40]}.pdf"
    safe = "".join(c for c in filename if c.isalnum() or c in "._-") or "hoja_instalacion.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{safe}"',
            "Cache-Control": "no-store",
        },
    )


@api_router.post("/budgets/pdf-preview")
async def post_budget_pdf_preview(payload: BudgetCreate,
                                  user: dict = Depends(current_admin_or_comercial)):
    """
    Genera el PDF sin guardar el presupuesto. Útil para previsualizar antes de
    guardar. Recibe en el body los mismos campos que BudgetCreate.
    """
    data = payload.dict()
    data["equipos"] = [e if isinstance(e, dict) else e.dict() for e in (payload.equipos or [])]
    try:
        pdf_bytes = build_budget_pdf(data)
    except Exception as e:
        logging.exception("PDF preview failed")
        raise HTTPException(500, f"No se pudo generar el PDF: {e}")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'inline; filename="hoja_instalacion_preview.pdf"',
            "Cache-Control": "no-store",
        },
    )


# ---------------- Utilities: image -> PDF ----------------
class ImageToPdfBody(BaseModel):
    base64: str
    mime_type: str = "image/jpeg"   # image/jpeg or image/png
    filename: Optional[str] = "plano.pdf"


@api_router.post("/utils/image-to-pdf")
async def utils_image_to_pdf(body: ImageToPdfBody, user: dict = Depends(current_user)):
    """
    Convierte una imagen base64 (JPEG/PNG) a un PDF de una sola página
    dimensionada al aspecto de la imagen. Devuelve application/pdf.
    Utilidad para el editor de Planos al guardar de vuelta al evento.
    """
    if body.mime_type not in ("image/jpeg", "image/png"):
        raise HTTPException(400, "Solo JPEG o PNG")
    try:
        raw = base64.b64decode(body.base64)
    except Exception:
        raise HTTPException(400, "Base64 inválido")
    try:
        img = Image.open(io.BytesIO(raw))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        buf = io.BytesIO()
        # Page size: match image aspect, cap dimensions to avoid huge PDFs
        img.save(buf, format="PDF", resolution=150.0)
        data = buf.getvalue()
    except Exception as e:
        logging.exception("image-to-pdf failed")
        raise HTTPException(500, f"No se pudo generar PDF: {e}")
    filename = body.filename or "plano.pdf"
    if not filename.lower().endswith(".pdf"):
        filename += ".pdf"
    safe = "".join(c for c in filename if c.isalnum() or c in "._-") or "plano.pdf"
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{safe}"'},
    )





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


# ====================  CRM SAT — incidencias  ====================
# Flujo:
#   1) El cliente abre un enlace público (`/aviso-sat`), rellena un formulario
#      y envía. Esto crea un registro en la colección `sat_incidents` vía
#      POST /sat/public (SIN autenticación).
#   2) El equipo SAT (usuarios autenticados) consulta la lista con
#      GET /sat/incidents, añade comentarios internos y marca como
#      "pendiente" o "resuelta" con PATCH /sat/incidents/{id}.

class SATPublicIn(BaseModel):
    cliente: str = Field(..., min_length=1, max_length=200)
    direccion: str = Field("", max_length=400)
    telefono: str = Field("", max_length=60)
    observaciones: str = Field(..., min_length=1, max_length=4000)

class SATUpdateIn(BaseModel):
    cliente: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    observaciones: Optional[str] = None
    comentarios_sat: Optional[str] = None
    status: Optional[str] = None  # "pendiente" | "resuelta"

@api_router.post("/sat/public")
async def sat_public_create(body: SATPublicIn):
    """Endpoint PÚBLICO — no requiere login. Lo usa el enlace que se envía
    al cliente para que abra la incidencia."""
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "cliente": body.cliente.strip(),
        "direccion": (body.direccion or "").strip(),
        "telefono": (body.telefono or "").strip(),
        "observaciones": body.observaciones.strip(),
        "comentarios_sat": "",
        "status": "pendiente",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "resolved_at": None,
        "resolved_by": None,
    }
    await db.sat_incidents.insert_one(doc)
    doc.pop("_id", None)
    # Notificar a los administradores
    admins = await db.users.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(500)
    for a in admins:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": a["id"],
            "event_id": None,
            "type": "sat_new",
            "title": f"Nuevo aviso SAT: {doc['cliente']}",
            "message": (doc["observaciones"][:160] + ("…" if len(doc["observaciones"]) > 160 else "")),
            "read": False,
            "created_at": now.isoformat(),
            "from_user_id": None,
            "from_user_name": doc["cliente"],
            "link": f"/sat?openIncident={doc['id']}",
        })
    return {"ok": True, "id": doc["id"]}

@api_router.get("/sat/incidents")
async def sat_list(
    user: dict = Depends(current_user),
    status: Optional[str] = None,
):
    q: dict = {}
    if status in {"pendiente", "resuelta"}:
        q["status"] = status
    rows = await db.sat_incidents.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return rows

@api_router.get("/sat/incidents/{iid}")
async def sat_get(iid: str, user: dict = Depends(current_user)):
    doc = await db.sat_incidents.find_one({"id": iid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Incidencia no encontrada")
    return doc

@api_router.patch("/sat/incidents/{iid}")
async def sat_update(iid: str, body: SATUpdateIn, user: dict = Depends(current_user)):
    existing = await db.sat_incidents.find_one({"id": iid})
    if not existing:
        raise HTTPException(404, "Incidencia no encontrada")
    patch: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if body.cliente is not None: patch["cliente"] = body.cliente.strip()
    if body.direccion is not None: patch["direccion"] = body.direccion.strip()
    if body.telefono is not None: patch["telefono"] = body.telefono.strip()
    if body.observaciones is not None: patch["observaciones"] = body.observaciones.strip()
    if body.comentarios_sat is not None: patch["comentarios_sat"] = body.comentarios_sat
    if body.status in {"pendiente", "resuelta"}:
        patch["status"] = body.status
        if body.status == "resuelta" and existing.get("status") != "resuelta":
            patch["resolved_at"] = datetime.now(timezone.utc).isoformat()
            patch["resolved_by"] = user.get("id")
        elif body.status == "pendiente":
            patch["resolved_at"] = None
            patch["resolved_by"] = None
    await db.sat_incidents.update_one({"id": iid}, {"$set": patch})
    doc = await db.sat_incidents.find_one({"id": iid}, {"_id": 0})
    return doc

@api_router.delete("/sat/incidents/{iid}")
async def sat_delete(iid: str, admin: dict = Depends(current_admin)):
    res = await db.sat_incidents.delete_one({"id": iid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Incidencia no encontrada")
    return {"ok": True}


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
    await backfill_user_colors()

async def backfill_user_colors():
    """Assign a color to any user that doesn't have one."""
    users_without = await db.users.find(
        {"$or": [{"color": {"$exists": False}}, {"color": None}, {"color": ""}]},
        {"_id": 0, "id": 1}
    ).to_list(1000)
    if not users_without:
        return
    existing_colors = [u.get("color") for u in await db.users.find(
        {"color": {"$exists": True, "$ne": None, "$nin": [""]}},
        {"_id": 0, "color": 1}
    ).to_list(1000)]
    used = [c for c in existing_colors if c]
    for u in users_without:
        c = _next_default_color(used)
        await db.users.update_one({"id": u["id"]}, {"$set": {"color": c}})
        used.append(c)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
