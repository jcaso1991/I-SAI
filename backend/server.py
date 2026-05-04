from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Query, UploadFile, File, Request
from fastapi.responses import RedirectResponse, HTMLResponse, FileResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import re
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
JWT_SECRET = os.environ.get('JWT_SECRET', '')
if not JWT_SECRET:
    import secrets
    JWT_SECRET = secrets.token_hex(32)
    logging.warning("JWT_SECRET not configured. Using auto-generated key. Set it in .env for persistence.")
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
if JWT_ALGORITHM not in ('HS256', 'HS384', 'HS512'):
    raise ValueError("JWT_ALGORITHM must be HS256, HS384, or HS512")
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

# Microsoft user-authentication redirect URIs
MS_AUTH_REDIRECT_URI = os.environ.get('MS_AUTH_REDIRECT_URI', 'http://localhost:8000/api/auth/microsoft/callback')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:8081')

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
    password: str = Field(..., min_length=8, max_length=128)
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
    role_id: Optional[str] = None
    role_name: Optional[str] = None
    permissions: Optional[List[str]] = None

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
    tecnicos: Optional[List[str]] = None
    comentarios: Optional[str] = None
    # manager assignment
    manager_id: Optional[str] = None
    manager_name: Optional[str] = None
    # project status
    project_status: Optional[str] = "pendiente"  # pendiente | a_facturar | anulado | planificado | terminado
    # meta
    sync_status: str = "synced"  # synced | pending | error
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None

class MaterialUpdate(BaseModel):
    fecha: Optional[str] = None
    entrega_recogida: Optional[str] = None
    total_parcial: Optional[str] = None
    tecnico: Optional[str] = None
    tecnicos: Optional[List[str]] = None
    comentarios: Optional[str] = None
    manager_id: Optional[str] = None
    project_status: Optional[str] = None

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

# ---------------- Roles & Permissions ----------------
PERMISSIONS_CATALOG = [
    {"key": "proyectos.view", "label": "Ver Proyectos", "module": "Proyectos"},
    {"key": "proyectos.edit", "label": "Editar Proyectos", "module": "Proyectos"},
    {"key": "calendario.view", "label": "Ver Calendario", "module": "Calendario"},
    {"key": "calendario.edit", "label": "Crear/Editar eventos", "module": "Calendario"},
    {"key": "planos.view", "label": "Ver Planos", "module": "Planos"},
    {"key": "planos.edit", "label": "Editar Planos", "module": "Planos"},
    {"key": "presupuestos.view", "label": "Ver Presupuestos", "module": "Presupuestos"},
    {"key": "presupuestos.edit", "label": "Editar Presupuestos", "module": "Presupuestos"},
    {"key": "sat.view", "label": "Ver CRM SAT", "module": "CRM SAT"},
    {"key": "sat.edit", "label": "Gestionar incidencias SAT", "module": "CRM SAT"},
    {"key": "users.manage", "label": "Gestionar usuarios", "module": "Administración"},
    {"key": "roles.manage", "label": "Gestionar roles y permisos", "module": "Administración"},
    {"key": "onedrive.manage", "label": "Conectar/Sincronizar OneDrive", "module": "Administración"},
    {"key": "chat.view", "label": "Usar el chat", "module": "Chat"},
]
ALL_PERMS = [p["key"] for p in PERMISSIONS_CATALOG]

NOTIFICATION_CATALOG = [
    {"key": "event_completed", "label": "Proyecto terminado", "module": "Calendario"},
    {"key": "event_pending_completion", "label": "Pendiente de terminar", "module": "Calendario"},
    {"key": "event_updated", "label": "Estado de evento actualizado", "module": "Calendario"},
    {"key": "sat_new", "label": "Nueva incidencia SAT", "module": "CRM SAT"},
    {"key": "sat_revived", "label": "Incidencia SAT reactivada", "module": "CRM SAT"},
    {"key": "chat_message", "label": "Mensajes de chat", "module": "Chat"},
]
ALL_NOTIFS = [n["key"] for n in NOTIFICATION_CATALOG]

NON_ADMIN_PERMS = [p for p in ALL_PERMS if p not in ("users.manage", "roles.manage")]
TECNICO_PERMS = ["proyectos.view", "proyectos.edit", "calendario.view", "calendario.edit", "planos.view", "planos.edit", "chat.view"]
COMERCIAL_PERMS = ["presupuestos.view", "presupuestos.edit", "proyectos.view", "chat.view"]
SAT_PERMS = ["sat.view", "sat.edit", "chat.view"]

# System roles seeded on startup. Admin role can NEVER be modified or deleted.
DEFAULT_ROLES = [
    {"key": "admin", "name": "Administrador principal", "permissions": ALL_PERMS, "notification_prefs": ALL_NOTIFS, "system": True, "locked": True},
    {"key": "gestor", "name": "Gestor", "permissions": NON_ADMIN_PERMS, "notification_prefs": ALL_NOTIFS, "system": True, "locked": False},
    {"key": "tecnico", "name": "Técnico", "permissions": TECNICO_PERMS, "notification_prefs": ["event_completed", "event_pending_completion", "chat_message"], "system": True, "locked": False},
    {"key": "comercial", "name": "Comercial", "permissions": COMERCIAL_PERMS, "notification_prefs": ["event_completed", "chat_message"], "system": True, "locked": False},
    {"key": "sat", "name": "SAT", "permissions": SAT_PERMS, "notification_prefs": ["sat_new", "sat_revived", "chat_message"], "system": True, "locked": False},
]

# Map legacy `role` field -> new role key
LEGACY_ROLE_MAP = {
    "admin": "admin",
    "user": "tecnico",
    "comercial": "comercial",
}


class RoleOut(BaseModel):
    id: str
    key: str
    name: str
    permissions: List[str]
    system: bool = False
    locked: bool = False
    created_at: Optional[str] = None
    notification_prefs: List[str] = []


class RoleCreate(BaseModel):
    name: str
    permissions: List[str] = []
    notification_prefs: List[str] = []


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    permissions: Optional[List[str]] = None
    notification_prefs: Optional[List[str]] = None


async def ensure_default_roles_and_migrate():
    """Bootstrap default system roles and migrate legacy users to role_id."""
    # 1. Seed system roles (idempotent by `key`)
    for r in DEFAULT_ROLES:
        existing = await db.roles.find_one({"key": r["key"]})
        if not existing:
            await db.roles.insert_one({
                "id": str(uuid.uuid4()),
                "key": r["key"],
                "name": r["name"],
                "permissions": r["permissions"],
                "notification_prefs": r.get("notification_prefs", []),
                "system": r["system"],
                "locked": r.get("locked", False),
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        else:
            # Always force admin role to have ALL permissions (locked, source of truth).
            if r["key"] == "admin":
                await db.roles.update_one(
                    {"key": "admin"},
                    {"$set": {"permissions": ALL_PERMS, "system": True, "locked": True, "name": existing.get("name") or r["name"]}},
                )
    # 2. Migrate users without role_id
    users_no_role = await db.users.find(
        {"$or": [{"role_id": {"$exists": False}}, {"role_id": None}]},
        {"_id": 0, "id": 1, "role": 1},
    ).to_list(5000)
    for u in users_no_role:
        legacy = (u.get("role") or "user").lower()
        key = LEGACY_ROLE_MAP.get(legacy, "tecnico")
        role = await db.roles.find_one({"key": key})
        if role:
            await db.users.update_one({"id": u["id"]}, {"$set": {"role_id": role["id"]}})


async def get_user_permissions(user: dict) -> List[str]:
    """Resolve permissions for a user via role_id; falls back to legacy `role` field."""
    role_id = user.get("role_id")
    role = None
    if role_id:
        role = await db.roles.find_one({"id": role_id})
    if not role:
        legacy = (user.get("role") or "user").lower()
        key = LEGACY_ROLE_MAP.get(legacy, "tecnico")
        role = await db.roles.find_one({"key": key})
    return role.get("permissions", []) if role else []


async def get_user_role_info(user: dict) -> dict:
    """Return {role_id, role_name, permissions, notification_prefs} for a user."""
    role_id = user.get("role_id")
    role = None
    if role_id:
        role = await db.roles.find_one({"id": role_id})
    if not role:
        legacy = (user.get("role") or "user").lower()
        key = LEGACY_ROLE_MAP.get(legacy, "tecnico")
        role = await db.roles.find_one({"key": key})
    return {
        "role_id": role.get("id") if role else None,
        "role_name": role.get("name") if role else None,
        "permissions": role.get("permissions", []) if role else [],
        "notification_prefs": role.get("notification_prefs", []) if role else [],
    }


async def should_notify_user(user_id: str, notif_type: str) -> bool:
    """Check if a user's role allows receiving this notification type."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        return False
    info = await get_user_role_info(user)
    return notif_type in info.get("notification_prefs", [])


def require_permission(perm: str):
    """FastAPI dependency factory: ensures the current user has `perm`."""
    async def _dep(user: dict = Depends(current_user)) -> dict:
        perms = await get_user_permissions(user)
        if perm not in perms:
            raise HTTPException(403, f"No tienes permiso ({perm})")
        return user
    return _dep


def require_any_permission(*perms: str):
    """FastAPI dependency: passes if user has at least one of `perms`."""
    async def _dep(user: dict = Depends(current_user)) -> dict:
        user_perms = await get_user_permissions(user)
        if not any(p in user_perms for p in perms):
            raise HTTPException(403, "No tienes permiso para esta acción")
        return user
    return _dep

def _clean(v):
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d")
    s = str(v).strip()
    return s if s and s.lower() != "nan" else None

def _safe_float(v) -> float:
    """Parse float safely, returning 0 on any error."""
    try:
        return float(v or 0)
    except (ValueError, TypeError):
        return 0.0

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
        raise HTTPException(r.status_code, "Error al descargar el archivo de OneDrive")
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

# ---------------- Rate limiter (simple in-memory) ----------------
import time as _time
from collections import defaultdict

_rate_window = 60  # seconds
_rate_max = 30     # max requests per window per IP
_rate_store: dict[str, list[float]] = defaultdict(list)

async def _rate_limit(request: Request, max_req: int = _rate_max):
    if not hasattr(request, "client"):
        return
    ip = request.client.host if request.client else "unknown"
    now = _time.time()
    _rate_store[ip] = [t for t in _rate_store[ip] if t > now - _rate_window]
    if len(_rate_store[ip]) >= max_req:
        raise HTTPException(429, "Demasiadas peticiones. Espera unos segundos.")
    _rate_store[ip].append(now)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    await _rate_limit(request, 60)
    return await call_next(request)
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
    info = await get_user_role_info(user)
    return UserOut(
        id=user["id"], email=user["email"], name=user.get("name"),
        role=user.get("role", "user"), color=user.get("color"),
        role_id=info["role_id"], role_name=info["role_name"], permissions=info["permissions"],
    )

# ---------------- User management (admin only) ----------------
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None
    role: Optional[Literal["admin", "user", "comercial"]] = None  # legacy
    role_id: Optional[str] = None
    color: Optional[str] = None

class UserPatch(BaseModel):
    name: Optional[str] = None
    role: Optional[Literal["admin", "user", "comercial"]] = None  # legacy
    role_id: Optional[str] = None
    color: Optional[str] = None

class PasswordReset(BaseModel):
    password: str

class UserListItem(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    role: str
    role_id: Optional[str] = None
    role_name: Optional[str] = None
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
async def list_users(admin: dict = Depends(require_permission("users.manage"))):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    users.sort(key=lambda u: u.get("created_at", ""))
    # Enrich with role_name
    role_ids = list({u.get("role_id") for u in users if u.get("role_id")})
    role_map = {}
    if role_ids:
        async for r in db.roles.find({"id": {"$in": role_ids}}):
            role_map[r["id"]] = r.get("name")
    out = []
    for u in users:
        u["role_name"] = role_map.get(u.get("role_id"))
        out.append(u)
    return out

async def _resolve_role_for_user(role_id: Optional[str], legacy_role: Optional[str]) -> dict:
    """Return the role doc to assign. Prefers role_id; falls back to legacy mapping."""
    role = None
    if role_id:
        role = await db.roles.find_one({"id": role_id})
        if not role:
            raise HTTPException(400, "Rol inválido")
    elif legacy_role:
        key = LEGACY_ROLE_MAP.get(legacy_role.lower(), "tecnico")
        role = await db.roles.find_one({"key": key})
    else:
        role = await db.roles.find_one({"key": "tecnico"})
    if not role:
        raise HTTPException(500, "Roles del sistema no inicializados")
    return role

@api_router.post("/users", response_model=UserListItem)
async def create_user(payload: UserCreate, admin: dict = Depends(require_permission("users.manage"))):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(400, "Email ya registrado")
    role = await _resolve_role_for_user(payload.role_id, payload.role)
    # Pick a unique default color if none provided
    if payload.color:
        color = payload.color
    else:
        existing_colors = [u.get("color") for u in await db.users.find({}, {"_id": 0, "color": 1}).to_list(1000)]
        color = _next_default_color([c for c in existing_colors if c])
    # Legacy `role` field: gestor also marked as "admin" so it passes inline
    # `role == "admin"` checks scattered in the codebase. The real ACL is on role_id.
    legacy_role = "admin" if role["key"] in ("admin", "gestor") else ("comercial" if role["key"] == "comercial" else "user")
    user = {
        "id": str(uuid.uuid4()),
        "email": payload.email.lower(),
        "name": payload.name or payload.email.split("@")[0],
        "password": hash_password(payload.password),
        "role": legacy_role,
        "role_id": role["id"],
        "color": color,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    return UserListItem(
        id=user["id"], email=user["email"], name=user["name"],
        role=user["role"], role_id=user["role_id"], role_name=role["name"],
        color=user["color"], created_at=user["created_at"],
    )

@api_router.patch("/users/{uid}", response_model=UserListItem)
async def update_user(uid: str, payload: UserPatch, admin: dict = Depends(require_permission("users.manage"))):
    target = await db.users.find_one({"id": uid})
    if not target:
        raise HTTPException(404, "Usuario no encontrado")
    upd = {k: v for k, v in payload.dict().items() if v is not None and k != "role_id" and k != "role"}
    new_role = None
    if payload.role_id is not None or payload.role is not None:
        new_role = await _resolve_role_for_user(payload.role_id, payload.role)
        upd["role_id"] = new_role["id"]
        upd["role"] = "admin" if new_role["key"] in ("admin", "gestor") else ("comercial" if new_role["key"] == "comercial" else "user")
    if not upd:
        raise HTTPException(400, "Nada que actualizar")
    # Prevent removing last admin (super)
    if new_role and new_role["key"] != "admin":
        if (target.get("role") == "admin") or (await db.roles.find_one({"id": target.get("role_id"), "key": "admin"})):
            remaining = await db.users.count_documents({"role": "admin", "id": {"$ne": uid}})
            if remaining == 0:
                raise HTTPException(400, "No puedes quitar el rol Administrador principal al último administrador")
    await db.users.update_one({"id": uid}, {"$set": upd})
    updated = await db.users.find_one({"id": uid}, {"_id": 0, "password": 0})
    if updated.get("role_id"):
        rdoc = await db.roles.find_one({"id": updated["role_id"]})
        updated["role_name"] = rdoc.get("name") if rdoc else None
    return updated

@api_router.post("/users/{uid}/reset-password")
async def reset_password(uid: str, payload: PasswordReset, admin: dict = Depends(require_permission("users.manage"))):
    target = await db.users.find_one({"id": uid})
    if not target:
        raise HTTPException(404, "Usuario no encontrado")
    if len(payload.password) < 4:
        raise HTTPException(400, "Contraseña demasiado corta (mín. 4)")
    await db.users.update_one({"id": uid}, {"$set": {"password": hash_password(payload.password)}})
    return {"ok": True}

@api_router.delete("/users/{uid}")
async def delete_user(uid: str, admin: dict = Depends(require_permission("users.manage"))):
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

# ---------------- Roles & Permissions API ----------------
@api_router.get("/permissions")
async def list_permissions(user: dict = Depends(current_user)):
    """Public catalog of all permissions in the app, grouped by module."""
    return {"permissions": PERMISSIONS_CATALOG}

@api_router.get("/notification-prefs")
async def list_notification_prefs(user: dict = Depends(current_user)):
    """Public catalog of all notification preferences."""
    return {"notifications": NOTIFICATION_CATALOG}

@api_router.get("/roles", response_model=List[RoleOut])
async def list_roles(user: dict = Depends(current_user)):
    """Anyone authenticated can see roles (used by user-edit dropdown)."""
    roles = await db.roles.find({}, {"_id": 0}).to_list(200)
    # Stable order: system first by key order, then customs by created_at
    sys_order = {"admin": 0, "gestor": 1, "tecnico": 2, "comercial": 3, "sat": 4}
    roles.sort(key=lambda r: (0 if r.get("system") else 1, sys_order.get(r.get("key"), 99), r.get("created_at", "")))
    return roles

@api_router.post("/roles", response_model=RoleOut)
async def create_role(payload: RoleCreate, admin: dict = Depends(require_permission("roles.manage"))):
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Nombre obligatorio")
    bad = [p for p in payload.permissions if p not in ALL_PERMS]
    if bad:
        raise HTTPException(400, f"Permisos inválidos: {bad}")
    role_notifs = [n for n in payload.notification_prefs if n in ALL_NOTIFS]
    base_key = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_") or "role"
    key = base_key
    suffix = 1
    while await db.roles.find_one({"key": key}):
        suffix += 1
        key = f"{base_key}_{suffix}"
    role = {
        "id": str(uuid.uuid4()),
        "key": key,
        "name": name,
        "permissions": list(dict.fromkeys(payload.permissions)),
        "notification_prefs": role_notifs,
        "system": False,
        "locked": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.roles.insert_one(role)
    return role

@api_router.patch("/roles/{rid}", response_model=RoleOut)
async def update_role(rid: str, payload: RoleUpdate, admin: dict = Depends(require_permission("roles.manage"))):
    role = await db.roles.find_one({"id": rid})
    if not role:
        raise HTTPException(404, "Rol no encontrado")
    if role.get("locked"):
        raise HTTPException(400, "El rol Administrador principal no se puede modificar")
    upd = {}
    if payload.name is not None:
        nm = payload.name.strip()
        if not nm:
            raise HTTPException(400, "Nombre vacío")
        upd["name"] = nm
    if payload.permissions is not None:
        bad = [p for p in payload.permissions if p not in ALL_PERMS]
        if bad:
            raise HTTPException(400, f"Permisos inválidos: {bad}")
        upd["permissions"] = list(dict.fromkeys(payload.permissions))
    if payload.notification_prefs is not None:
        upd["notification_prefs"] = [n for n in payload.notification_prefs if n in ALL_NOTIFS]
    if not upd:
        raise HTTPException(400, "Nada que actualizar")
    await db.roles.update_one({"id": rid}, {"$set": upd})
    updated = await db.roles.find_one({"id": rid}, {"_id": 0})
    return updated

@api_router.delete("/roles/{rid}")
async def delete_role(rid: str, admin: dict = Depends(require_permission("roles.manage"))):
    role = await db.roles.find_one({"id": rid})
    if not role:
        raise HTTPException(404, "Rol no encontrado")
    if role.get("system"):
        raise HTTPException(400, "No puedes eliminar un rol del sistema")
    # Reassign any user using this role to "tecnico"
    fallback = await db.roles.find_one({"key": "tecnico"})
    fallback_id = fallback["id"] if fallback else None
    if fallback_id:
        await db.users.update_many(
            {"role_id": rid},
            {"$set": {"role_id": fallback_id, "role": "user"}},
        )
    await db.roles.delete_one({"id": rid})
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
    budget_id: Optional[str] = None

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
    budget_id: Optional[str] = None

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
    if from_dt.tzinfo is None:
        from_dt = from_dt.replace(tzinfo=timezone.utc)
    to_dt = datetime.fromisoformat(to.replace("Z", "+00:00")) if to else datetime.max.replace(tzinfo=timezone.utc)
    if to_dt.tzinfo is None:
        to_dt = to_dt.replace(tzinfo=timezone.utc)
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
async def create_event(payload: EventCreate, admin: dict = Depends(require_permission("calendario.edit"))):
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
        notif_type = f"event_{new_status}"
        if await should_notify_user(ev_current["manager_id"], notif_type):
            title = ev_current.get("title") or "Evento"
            if new_status == "completed":
                notif_title = f"Proyecto terminado: {title}"
                notif_msg = f"{user.get('name') or user.get('email')} marcó el evento como completado."
                # If a budget is linked, generate PDF and attach to event
                budget_id = ev_current.get("budget_id") or upd.get("budget_id")
                if budget_id:
                    budget = await db.budgets.find_one({"id": budget_id})
                    if budget:
                        try:
                            pdf_bytes = build_budget_pdf(budget)
                            pdf_b64 = base64.b64encode(pdf_bytes).decode()
                            att = {
                                "id": str(uuid.uuid4()),
                                "filename": f"presupuesto_{budget.get('n_proyecto','')}.pdf",
                                "mime_type": "application/pdf",
                                "size": len(pdf_bytes),
                                "base64": pdf_b64,
                                "uploaded_at": datetime.now(timezone.utc).isoformat(),
                                "uploaded_by": "sistema",
                            }
                            await db.events.update_one({"id": real_id}, {"$push": {"attachments": att}})
                            notif_msg += f"\n📎 Presupuesto adjunto: {att['filename']}"
                        except Exception as e:
                            logging.getLogger(__name__).error(f"Failed to attach budget PDF: {e}")
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
                "type": notif_type,
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
async def delete_event(eid: str, admin: dict = Depends(require_permission("calendario.edit"))):
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
async def create_stamp(payload: StampCreate, admin: dict = Depends(require_permission("planos.edit"))):
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
async def delete_stamp(sid: str, admin: dict = Depends(require_permission("planos.edit"))):
    if sid.startswith("builtin_"):
        raise HTTPException(400, "No puedes eliminar sellos predefinidos")
    res = await db.stamps.delete_one({"id": sid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Sello no encontrado")
    return {"ok": True}

# ---------------- OneDrive routes ----------------
@api_router.get("/auth/onedrive/login")
async def onedrive_login(user: dict = Depends(require_permission("onedrive.manage"))):
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
async def onedrive_disconnect(user: dict = Depends(require_permission("onedrive.manage"))):
    await db.onedrive_tokens.delete_one({"_id": "admin"})
    return {"ok": True}

# ---------------- Microsoft user authentication (Entra ID / Azure AD) ----------------
@api_router.get("/auth/microsoft/login")
async def microsoft_login():
    """Return the Microsoft OAuth URL for user login (Entra ID / Azure AD)."""
    state = str(uuid.uuid4())
    await db.oauth_states.insert_one({
        "_id": state,
        "created_at": datetime.now(timezone.utc),
    })
    app_msal = _msal_app()
    auth_url = app_msal.get_authorization_request_url(
        scopes=["User.Read"],
        redirect_uri=MS_AUTH_REDIRECT_URI,
        state=state,
        prompt="select_account",
    )
    return {"auth_url": auth_url}

@api_router.get("/auth/microsoft/callback", response_class=HTMLResponse)
async def microsoft_callback(code: str, state: Optional[str] = None, error: Optional[str] = None):
    """Handle Microsoft OAuth callback for user login."""
    if error:
        return HTMLResponse("<h2>Error</h2><p>Autenticación cancelada</p>", status_code=400)
    if state:
        st = await db.oauth_states.find_one_and_delete({"_id": state})
        if not st:
            return HTMLResponse("<h2>Error de seguridad</h2><p>Estado de autenticación inválido</p>", status_code=400)
    else:
        return HTMLResponse("<h2>Error</h2><p>Falta el parámetro de estado</p>", status_code=400)

    app_msal = _msal_app()
    result = app_msal.acquire_token_by_authorization_code(
        code,
        scopes=["User.Read"],
        redirect_uri=MS_AUTH_REDIRECT_URI,
    )
    if "error" in result:
        return HTMLResponse(
            "<h2>Error de autenticación</h2><p>No se pudo completar el inicio de sesión.</p>",
            status_code=400,
        )

    claims = result.get("id_token_claims", {})
    email = (claims.get("preferred_username") or claims.get("email") or "").lower().strip()
    name = claims.get("name") or ""

    if not email and result.get("access_token"):
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                r = await c.get(
                    f"{GRAPH_BASE}/me",
                    headers={"Authorization": f"Bearer {result['access_token']}"},
                )
                if r.status_code == 200:
                    profile = r.json()
                    email = (profile.get("mail") or profile.get("userPrincipalName") or "").lower().strip()
                    name = profile.get("displayName") or name
        except Exception:
            pass

    if not email:
        return HTMLResponse(
            "<h2>Error de autenticación</h2><p>No se pudo obtener tu email de Microsoft.</p>",
            status_code=400,
        )

    user = await db.users.find_one({"email": email})
    if not user:
        count = await db.users.count_documents({})
        role_key = "admin" if count == 0 else "tecnico"
        role = await db.roles.find_one({"key": role_key})
        existing_colors = [u.get("color") for u in await db.users.find({}, {"_id": 0, "color": 1}).to_list(1000)]
        color = _next_default_color([c for c in existing_colors if c])

        legacy_role = "admin" if role_key == "admin" else "user"
        user = {
            "id": str(uuid.uuid4()),
            "email": email,
            "name": name or email.split("@")[0],
            "password": hash_password(str(uuid.uuid4())),
            "role": legacy_role,
            "role_id": role["id"] if role else None,
            "color": color,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "microsoft_id": claims.get("oid"),
        }
        await db.users.insert_one(user)
        logging.getLogger(__name__).info(f"Auto-registered Microsoft user: {email}")
    elif not user.get("name") and name:
        await db.users.update_one({"id": user["id"]}, {"$set": {"name": name}})

    jwt_token = create_jwt(user)

    return HTMLResponse(content=f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Autenticado — i-SAI</title>
<style>
  * {{ box-sizing:border-box;margin:0;padding:0 }}
  body {{
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    display:flex;align-items:center;justify-content:center;
    min-height:100vh;background:#F8FAFC;
  }}
  .card {{
    background:#fff;border-radius:16px;padding:40px;text-align:center;
    box-shadow:0 2px 20px rgba(0,0,0,0.08);max-width:400px
  }}
  h2 {{ color:#10B981;margin-bottom:8px;font-size:20px }}
  p {{ color:#475569;margin-bottom:20px;font-size:14px }}
  .spinner {{
    width:24px;height:24px;border:3px solid #E2E8F0;border-top-color:#1976D2;
    border-radius:50%;animation:spin 0.6s linear infinite;margin:0 auto 16px
  }}
  @keyframes spin {{ to {{ transform:rotate(360deg) }} }}
  .fallback {{ font-size:12px;color:#94A3B8;margin-top:20px }}
  .fallback a {{ color:#1976D2;font-weight:600;text-decoration:none }}
</style>
</head>
<body>
<div class="card">
  <h2>✓ Autenticado</h2>
  <p>Redirigiendo a i-SAI como <strong>{email}</strong>...</p>
  <div class="spinner"></div>
  <p class="fallback">
    Si no te redirige automáticamente,<br/>
    <a href="{FRONTEND_URL}/login?microsoft_token={jwt_token}">haz clic aquí para entrar</a>
  </p>
</div>
<script>
  var token = '{jwt_token}';
  try {{
    if (window.opener && !window.opener.closed) {{
      window.opener.postMessage({{ type:'microsoft_auth', token:token }}, '*');
      setTimeout(function(){{ window.close(); }}, 500);
    }} else {{
      window.location.replace('{FRONTEND_URL}/login?microsoft_token=' + token);
    }}
  }} catch(e) {{
    window.location.replace('{FRONTEND_URL}/login?microsoft_token=' + token);
  }}
</script>
</body>
</html>""")


# ---------------- Sync routes (manual override — uses internal helpers) ----------------
@api_router.post("/sync/import-from-onedrive")
async def sync_import(user: dict = Depends(require_permission("onedrive.manage"))):
    n = await _do_import()
    return {"imported": n}

@api_router.post("/sync/push-to-onedrive")
async def sync_push(user: dict = Depends(require_permission("onedrive.manage"))):
    n = await _do_push()
    return {"pushed": n}

# ---------------- Materials routes ----------------
@api_router.get("/materiales", response_model=List[Material])
async def list_materiales(user: dict = Depends(current_user), q: Optional[str] = None, pending_only: bool = False, limit: int = 2000, manager_id: Optional[str] = None, unassigned: bool = False, project_status: Optional[str] = None):
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
    if manager_id:
        query["manager_id"] = manager_id
    if unassigned:
        query["manager_id"] = {"$in": [None, ""]}
    if project_status:
        status_list = [s.strip() for s in project_status.split(",") if s.strip()]
        if len(status_list) == 1:
            st = status_list[0]
            if st == "pendiente":
                query["$or"] = [{"project_status": "pendiente"}, {"project_status": {"$exists": False}}]
            else:
                query["project_status"] = st
        elif len(status_list) > 1:
            q_list = [{"project_status": s} for s in status_list]
            if "pendiente" in status_list:
                q_list.append({"project_status": {"$exists": False}})
            query["$or"] = q_list
    items = await db.materiales.find(query, {"_id": 0}).limit(limit).to_list(limit)
    items.sort(key=lambda x: x.get("row_index", 0))
    # Enrich with manager names
    manager_ids = list({m.get("manager_id") for m in items if m.get("manager_id")})
    if manager_ids:
        mgrs = await db.users.find({"id": {"$in": manager_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(500)
        mgr_map = {m["id"]: m.get("name") or m.get("email", "") for m in mgrs}
        for item in items:
            mid = item.get("manager_id")
            if mid and mid in mgr_map:
                item["manager_name"] = mgr_map[mid]
    return items

@api_router.get("/materiales/{mid}", response_model=Material)
async def get_material(mid: str, user: dict = Depends(current_user)):
    doc = await db.materiales.find_one({"id": mid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Material no encontrado")
    return doc

@api_router.patch("/materiales/{mid}", response_model=Material)
async def update_material(mid: str, payload: MaterialUpdate, user: dict = Depends(current_user)):
    old = await db.materiales.find_one({"id": mid})
    if not old:
        raise HTTPException(404, "Material no encontrado")
    upd = {k: v for k, v in payload.dict().items() if v is not None}
    if not upd:
        raise HTTPException(400, "Nada que actualizar")
    upd["sync_status"] = "pending"
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    upd["updated_by"] = user["email"]
    res = await db.materiales.update_one({"id": mid}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Material no encontrado")
    # Log changes to history
    for field, new_val in upd.items():
        if field in ("sync_status", "updated_at", "updated_by"):
            continue
        old_val = old.get(field)
        if str(old_val) != str(new_val):
            await db.project_history.insert_one({
                "id": str(uuid.uuid4()),
                "project_id": mid,
                "field": field,
                "old_value": str(old_val or ""),
                "new_value": str(new_val or ""),
                "changed_by": user.get("name") or user.get("email"),
                "changed_by_id": user["id"],
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
    doc = await db.materiales.find_one({"id": mid}, {"_id": 0})
    if await _has_onedrive_link():
        schedule_auto_push()
    return doc

@api_router.get("/materiales/{mid}/history")
async def get_material_history(mid: str, user: dict = Depends(current_user)):
    items = await db.project_history.find({"project_id": mid}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return items

# ---------------- Stats ----------------
@api_router.get("/stats")
async def stats(user: dict = Depends(current_user)):
    total = await db.materiales.count_documents({})
    pending = await db.materiales.count_documents({"sync_status": "pending"})
    return {"total": total, "pending": pending, "synced": total - pending}


@api_router.get("/dashboard")
async def dashboard(user: dict = Depends(current_user)):
    # Projects by status
    statuses = ["pendiente", "planificado", "a_facturar", "facturado", "terminado", "bloqueado", "anulado"]
    projects_by_status = {}
    total_hours = 0
    for st in statuses:
        count = await db.materiales.count_documents({"project_status": st})
        projects_by_status[st] = count

    # Hours by manager
    manager_hours = []
    managers = await db.users.find({"role": "admin"}, {"_id": 0, "id": 1, "name": 1, "email": 1, "color": 1}).to_list(50)
    for mgr in managers:
        mats = await db.materiales.find({"manager_id": mgr["id"]}, {"horas_prev": 1}).to_list(5000)
        hours = sum(_safe_float(m.get("horas_prev")) for m in mats)
        if hours > 0:
            manager_hours.append({
                "name": mgr.get("name") or mgr.get("email", ""),
                "color": mgr.get("color", "#3B82F6"),
                "hours": round(hours, 1),
                "count": len(mats),
            })
    manager_hours.sort(key=lambda x: x["hours"], reverse=True)

    # SAT incidents by month (last 6 months)
    sat_by_month = []
    for i in range(5, -1, -1):
        dt = datetime.now(timezone.utc) - timedelta(days=30 * i)
        month_start = dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if i == 0:
            month_end = datetime.now(timezone.utc)
        else:
            if month_start.month == 12:
                month_end = month_start.replace(year=month_start.year + 1, month=1)
            else:
                month_end = month_start.replace(month=month_start.month + 1)
        count = await db.sat_incidents.count_documents({
            "created_at": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}
        })
        resolved = await db.sat_incidents.count_documents({
            "status": "resuelta",
            "created_at": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()},
        })
        mes = month_start.strftime("%b").capitalize()
        sat_by_month.append({"month": mes, "total": count, "resolved": resolved})

    # Today's pending
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_end = datetime.now(timezone.utc).replace(hour=23, minute=59, second=59).isoformat()
    today_events = await db.events.count_documents({
        "$or": [
            {"start_at": {"$gte": today_start, "$lte": today_end}},
            {"end_at": {"$gte": today_start, "$lte": today_end}},
        ],
        "status": {"$ne": "completed"},
    })
    pending_sat = await db.sat_incidents.count_documents({"status": "pendiente"})
    pending_budgets = await db.budgets.count_documents({"$or": [{"status": "pendiente"}, {"status": {"$exists": False}}]})

    return {
        "projects_by_status": projects_by_status,
        "manager_hours": manager_hours[:8],
        "sat_by_month": sat_by_month,
        "today": {
            "events": today_events,
            "pending_sat": pending_sat,
            "pending_budgets": pending_budgets,
        },
    }

# ---------------- Budgets (Presupuestos) ----------------
async def current_admin_or_comercial(user: dict = Depends(current_user)):
    """Backwards-compatible guard: now allows anyone with `presupuestos.view`."""
    perms = await get_user_permissions(user)
    if "presupuestos.view" not in perms and user.get("role") not in ("admin", "comercial"):
        raise HTTPException(403, "Requiere permiso de Presupuestos")
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
        "created_by_name": user.get("name") or user["email"],
        "status": "pendiente",
    })
    await db.budgets.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/budgets")
async def list_budgets(user: dict = Depends(current_admin_or_comercial)):
    items = await db.budgets.find({}, {"_id": 0, "firma_isai": 0, "firma_cliente": 0}).sort("updated_at", -1).to_list(500)
    return items

@api_router.get("/budgets/accepted")
async def list_accepted_budgets(user: dict = Depends(current_user)):
    items = await db.budgets.find(
        {"status": "aceptado"},
        {"_id": 0, "firma_isai": 0, "firma_cliente": 0},
    ).sort("updated_at", -1).to_list(500)
    return items

@api_router.get("/budgets/{bid}")
async def get_budget(bid: str, user: dict = Depends(current_admin_or_comercial)):
    b = await db.budgets.find_one({"id": bid}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Presupuesto no encontrado")
    return b

@api_router.patch("/budgets/{bid}/status")
async def update_budget_status(bid: str, user: dict = Depends(current_admin_or_comercial)):
    b = await db.budgets.find_one({"id": bid})
    if not b:
        raise HTTPException(404, "Presupuesto no encontrado")
    new_status = "aceptado" if b.get("status") != "aceptado" else "pendiente"
    await db.budgets.update_one({"id": bid}, {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True, "status": new_status}

@api_router.patch("/budgets/{bid}/status")
async def update_budget_status(bid: str, user: dict = Depends(current_admin_or_comercial)):
    b = await db.budgets.find_one({"id": bid})
    if not b:
        raise HTTPException(404, "Presupuesto no encontrado")
    new_status = "aceptado" if b.get("status") != "aceptado" else "pendiente"
    await db.budgets.update_one({"id": bid}, {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True, "status": new_status}

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
        # Save high-DPI PDF (300 DPI) to preserve detail. PIL embeds the JPEG
        # without re-compression so quality matches the source image.
        img.save(buf, format="PDF", resolution=300.0)
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
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@materiales.com")
    admin_pass = os.environ.get("ADMIN_PASSWORD", "")
    if not admin_pass:
        admin_pass = secrets.token_hex(12)
        logging.getLogger(__name__).warning(f"ADMIN_PASSWORD not set. Admin password: {admin_pass}")
    existing = await db.users.find_one({"email": admin_email})
    if existing:
        return
    user = {
        "id": str(uuid.uuid4()),
        "email": admin_email,
        "name": "Administrador",
        "password": hash_password(admin_pass),
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
    # Auto-link to catalog client if the name matches an existing client.
    if doc["cliente"]:
        matched = await db.sat_clients.find_one(
            {"cliente": {"$regex": f"^{re.escape(doc['cliente'])}$", "$options": "i"}},
            {"_id": 0, "id": 1},
        )
        if matched:
            doc["client_id"] = matched["id"]
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
    client_id: Optional[str] = None,
):
    # Lazy auto-revive: any incident scheduled for past time returns as "pendiente".
    now_iso = datetime.now(timezone.utc).isoformat()
    await _sat_auto_revive(now_iso)

    q: dict = {}
    if status in {"pendiente", "resuelta", "agendada"}:
        q["status"] = status
    if client_id:
        # Match by client_id OR by cliente name (case-insensitive) for incidents
        # submitted via the public form that didn't have client_id linked.
        client_doc = await db.sat_clients.find_one({"id": client_id}, {"_id": 0})
        client_name = (client_doc or {}).get("cliente", "")
        if client_name:
            q["$or"] = [
                {"client_id": client_id},
                {"cliente": {"$regex": f"^{re.escape(client_name)}$", "$options": "i"}},
            ]
        else:
            q["client_id"] = client_id
    rows = await db.sat_incidents.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return rows

async def _sat_auto_revive(now_iso: str):
    """Move incidents whose scheduled_for date has passed back to pendiente
    and leave a history note describing the auto-revival."""
    overdue = await db.sat_incidents.find({
        "status": "agendada",
        "scheduled_for": {"$lte": now_iso},
    }, {"_id": 0}).to_list(500)
    for ev in overdue:
        entry = {
            "id": str(uuid.uuid4()),
            "action": "auto_revive",
            "from_status": "agendada",
            "to_status": "pendiente",
            "comment": "Ha llegado la fecha programada. La incidencia vuelve a Pendiente.",
            "user_id": None,
            "user_name": "Sistema",
            "created_at": now_iso,
        }
        await db.sat_incidents.update_one(
            {"id": ev["id"]},
            {
                "$set": {"status": "pendiente", "updated_at": now_iso, "scheduled_for": None},
                "$push": {"history": entry},
            },
        )
        # Also notify admins about the revived incident
        admins = await db.users.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(200)
        for a in admins:
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": a["id"],
                "event_id": None,
                "type": "sat_revived",
                "title": f"Incidencia reactivada: {ev.get('cliente','')}",
                "message": ev.get("observaciones", "")[:200],
                "read": False,
                "created_at": now_iso,
                "from_user_id": None,
                "from_user_name": "Sistema",
                "link": f"/sat?openIncident={ev['id']}",
            })

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
async def sat_delete(iid: str, admin: dict = Depends(require_permission("sat.edit"))):
    res = await db.sat_incidents.delete_one({"id": iid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Incidencia no encontrada")
    return {"ok": True}

class SATStatusChangeIn(BaseModel):
    status: str  # "pendiente" | "resuelta"
    comment: str = Field("", max_length=4000)
    facturable: Optional[bool] = None  # required when status == "resuelta"

@api_router.post("/sat/incidents/{iid}/status")
async def sat_change_status(iid: str, body: SATStatusChangeIn, user: dict = Depends(current_user)):
    """Change the status of an incident and append a history entry with the
    user's comment. This is the canonical way to toggle pendiente↔resuelta
    from the UI so that every change is traceable."""
    existing = await db.sat_incidents.find_one({"id": iid})
    if not existing:
        raise HTTPException(404, "Incidencia no encontrada")
    if body.status not in {"pendiente", "resuelta"}:
        raise HTTPException(400, "Estado inválido")
    if body.status == "resuelta" and body.facturable is None:
        raise HTTPException(400, "Debes indicar si la incidencia es facturable o no")

    now = datetime.now(timezone.utc).isoformat()
    prev = existing.get("status") or "pendiente"
    entry = {
        "id": str(uuid.uuid4()),
        "action": "status_change",
        "from_status": prev,
        "to_status": body.status,
        "comment": (body.comment or "").strip(),
        "facturable": body.facturable if body.status == "resuelta" else None,
        "user_id": user.get("id"),
        "user_name": user.get("name") or user.get("email") or "usuario",
        "created_at": now,
    }
    patch = {
        "status": body.status,
        "updated_at": now,
    }
    if body.status == "resuelta" and prev != "resuelta":
        patch["resolved_at"] = now
        patch["resolved_by"] = user.get("id")
        patch["facturable"] = body.facturable
    elif body.status == "pendiente":
        patch["resolved_at"] = None
        patch["resolved_by"] = None
    await db.sat_incidents.update_one(
        {"id": iid},
        {"$set": patch, "$push": {"history": entry}},
    )
    doc = await db.sat_incidents.find_one({"id": iid}, {"_id": 0})
    return doc

class SATScheduleIn(BaseModel):
    scheduled_for: str  # ISO datetime
    comment: str = Field("", max_length=4000)

@api_router.post("/sat/incidents/{iid}/schedule")
async def sat_schedule(iid: str, body: SATScheduleIn, user: dict = Depends(current_user)):
    """Reschedule an incident. Moves it to status='agendada' with the chosen
    date/time. When that date arrives, `_sat_auto_revive` flips it back to
    pendiente and notifies the admins."""
    existing = await db.sat_incidents.find_one({"id": iid})
    if not existing:
        raise HTTPException(404, "Incidencia no encontrada")
    try:
        sched = datetime.fromisoformat(body.scheduled_for.replace("Z", "+00:00"))
        if sched.tzinfo is None:
            sched = sched.replace(tzinfo=timezone.utc)
    except Exception:
        raise HTTPException(400, "Fecha inválida")
    now = datetime.now(timezone.utc).isoformat()
    prev = existing.get("status") or "pendiente"
    pretty = sched.strftime("%d/%m/%Y %H:%M")
    entry = {
        "id": str(uuid.uuid4()),
        "action": "scheduled",
        "from_status": prev,
        "to_status": "agendada",
        "scheduled_for": sched.isoformat(),
        "comment": (body.comment or "").strip() or f"Incidencia reagendada para el {pretty}.",
        "user_id": user.get("id"),
        "user_name": user.get("name") or user.get("email") or "usuario",
        "created_at": now,
    }
    await db.sat_incidents.update_one(
        {"id": iid},
        {
            "$set": {
                "status": "agendada",
                "scheduled_for": sched.isoformat(),
                "resolved_at": None,
                "resolved_by": None,
                "updated_at": now,
            },
            "$push": {"history": entry},
        },
    )
    doc = await db.sat_incidents.find_one({"id": iid}, {"_id": 0})
    return doc

@api_router.post("/sat/incidents/{iid}/note")
async def sat_add_note(iid: str, body: SATStatusChangeIn, user: dict = Depends(current_user)):
    """Add a free-form note to the history without changing status. Handy if
    the SAT team wants to leave intermediate comments."""
    existing = await db.sat_incidents.find_one({"id": iid})
    if not existing:
        raise HTTPException(404, "Incidencia no encontrada")
    if not (body.comment or "").strip():
        raise HTTPException(400, "El comentario no puede estar vacío")
    now = datetime.now(timezone.utc).isoformat()
    entry = {
        "id": str(uuid.uuid4()),
        "action": "note",
        "comment": body.comment.strip(),
        "user_id": user.get("id"),
        "user_name": user.get("name") or user.get("email") or "usuario",
        "created_at": now,
    }
    await db.sat_incidents.update_one(
        {"id": iid},
        {"$set": {"updated_at": now}, "$push": {"history": entry}},
    )
    doc = await db.sat_incidents.find_one({"id": iid}, {"_id": 0})
    return doc


# ====================  CRM SAT — clientes  ====================
# Catálogo de clientes. Se puede importar desde Excel o mantener
# manualmente. Cada incidencia puede (opcionalmente) enlazar a un cliente
# vía `client_id` para centralizar información.

class SATClientIn(BaseModel):
    cliente: str = Field(..., min_length=1, max_length=240)
    direccion: str = Field("", max_length=400)
    contacto: str = Field("", max_length=160)
    telefono: str = Field("", max_length=80)

@api_router.get("/sat/clients")
async def sat_clients_list(user: dict = Depends(current_user)):
    rows = await db.sat_clients.find({}, {"_id": 0}).sort("cliente", 1).to_list(5000)
    return rows

@api_router.get("/sat/clients/{cid}")
async def sat_client_get(cid: str, user: dict = Depends(current_user)):
    doc = await db.sat_clients.find_one({"id": cid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Cliente no encontrado")
    return doc

@api_router.post("/sat/clients")
async def sat_client_create(body: SATClientIn, admin: dict = Depends(require_permission("sat.edit"))):
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "cliente": body.cliente.strip(),
        "direccion": body.direccion.strip(),
        "contacto": body.contacto.strip(),
        "telefono": body.telefono.strip(),
        "created_at": now,
        "updated_at": now,
    }
    await db.sat_clients.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.patch("/sat/clients/{cid}")
async def sat_client_update(cid: str, body: SATClientIn, admin: dict = Depends(require_permission("sat.edit"))):
    existing = await db.sat_clients.find_one({"id": cid})
    if not existing:
        raise HTTPException(404, "Cliente no encontrado")
    patch = {
        "cliente": body.cliente.strip(),
        "direccion": body.direccion.strip(),
        "contacto": body.contacto.strip(),
        "telefono": body.telefono.strip(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.sat_clients.update_one({"id": cid}, {"$set": patch})
    doc = await db.sat_clients.find_one({"id": cid}, {"_id": 0})
    return doc

@api_router.delete("/sat/clients/{cid}")
async def sat_client_delete(cid: str, admin: dict = Depends(require_permission("sat.edit"))):
    res = await db.sat_clients.delete_one({"id": cid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Cliente no encontrado")
    return {"ok": True}

def _match_header(headers: list, *needles: str) -> Optional[int]:
    """Return the index of the first header that contains any of the
    needles (case/accent-insensitive, substring match). Used to support
    Excel files with slight typos in column names (e.g. 'Responsablñe')."""
    import unicodedata
    def norm(s: str) -> str:
        s = str(s or "").strip().lower()
        return "".join(c for c in unicodedata.normalize("NFD", s)
                       if unicodedata.category(c) != "Mn")
    for i, h in enumerate(headers):
        nh = norm(h)
        if any(n in nh for n in needles):
            return i
    return None

@api_router.post("/sat/clients/import")
async def sat_client_import(
    file: UploadFile = File(...),
    replace: bool = False,
    admin: dict = Depends(require_permission("sat.edit")),
):
    """Admin/SAT-only: import clients from an uploaded .xlsx/.xlsm file.
    - Auto-detects columns using keyword matching on headers (tolerant to
      typos like 'Responsablñe' in the real data).
    - `replace=true` wipes the collection before importing.
    - Default behaviour = upsert by `cliente` name (case-insensitive).
    Returns {created, updated, skipped}.
    """
    try:
        from openpyxl import load_workbook
    except Exception:
        raise HTTPException(500, "openpyxl no instalado en el servidor")
    try:
        raw = await file.read()
        import io
        wb = load_workbook(io.BytesIO(raw), data_only=True, keep_vba=False, read_only=True)
    except Exception as e:
        raise HTTPException(400, f"Archivo Excel inválido: {e}")

    ws = wb.active
    rows_iter = ws.iter_rows(values_only=True)
    try:
        headers = list(next(rows_iter))
    except StopIteration:
        raise HTTPException(400, "La hoja está vacía")

    col_cli = _match_header(headers, "client", "nombre")
    col_dir = _match_header(headers, "direcc", "address")
    col_con = _match_header(headers, "responsab", "contact")
    col_tel = _match_header(headers, "tel", "phone", "movil")
    if col_cli is None:
        raise HTTPException(400, "No se ha encontrado una columna 'Cliente' en el Excel")

    if replace:
        await db.sat_clients.delete_many({})

    created = updated = skipped = 0
    now = datetime.now(timezone.utc).isoformat()
    for r in rows_iter:
        try:
            name = str(r[col_cli]).strip() if col_cli is not None and r[col_cli] is not None else ""
        except IndexError:
            name = ""
        if not name:
            skipped += 1
            continue
        def _cell(ix):
            if ix is None: return ""
            try:
                v = r[ix]
                return str(v).strip() if v is not None else ""
            except IndexError:
                return ""
        doc = {
            "cliente": name,
            "direccion": _cell(col_dir),
            "contacto": _cell(col_con),
            "telefono": _cell(col_tel),
            "updated_at": now,
        }
        # Upsert by case-insensitive name match.
        existing = await db.sat_clients.find_one({
            "cliente": {"$regex": f"^{re.escape(name)}$", "$options": "i"}
        })
        if existing:
            await db.sat_clients.update_one({"id": existing["id"]}, {"$set": doc})
            updated += 1
        else:
            doc["id"] = str(uuid.uuid4())
            doc["created_at"] = now
            await db.sat_clients.insert_one(doc)
            created += 1
    return {"ok": True, "created": created, "updated": updated, "skipped": skipped}


@api_router.get("/materiales/export-excel")
async def materiales_export_excel(user: dict = Depends(current_user)):
    """Export all projects as an Excel file."""
    items = await db.materiales.find({}, {"_id": 0}).sort("row_index", 1).to_list(10000)
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Proyectos"

    header_font = Font(bold=True, size=11, color="FFFFFF")
    header_fill = PatternFill(start_color="1976D2", end_color="1976D2", fill_type="solid")
    thin_border = Border(left=Side(style="thin"), right=Side(style="thin"), top=Side(style="thin"), bottom=Side(style="thin"))

    headers = ["Nº Proyecto", "Cliente", "Ubicación", "Horas PREV", "Comercial", "Gestor", "Técnicos", "Fecha", "Entrega/Recogida", "Total/Parcial", "Estado", "Comentarios"]
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")
        cell.border = thin_border

    status_map = {"pendiente": "Pendiente", "a_facturar": "A facturar", "planificado": "Planificado",
                  "facturado": "Facturado", "terminado": "Terminado", "bloqueado": "Bloqueado", "anulado": "Anulado"}

    for row, item in enumerate(items, 2):
        values = [
            item.get("materiales", ""),
            item.get("cliente", ""),
            item.get("ubicacion", ""),
            item.get("horas_prev", ""),
            item.get("comercial", ""),
            item.get("manager_name") or item.get("gestor", ""),
            ", ".join(item.get("tecnicos") or [item.get("tecnico", "")]) if item.get("tecnicos") else (item.get("tecnico") or ""),
            item.get("fecha", ""),
            item.get("entrega_recogida", ""),
            item.get("total_parcial", ""),
            status_map.get(item.get("project_status", ""), item.get("project_status", "Pendiente")),
            item.get("comentarios", ""),
        ]
        for col, v in enumerate(values, 1):
            cell = ws.cell(row=row, column=col, value=v)
            cell.border = thin_border
            cell.alignment = Alignment(wrap_text=True, vertical="top")

    for col in range(1, len(headers) + 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(col)].width = 20

    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    filename = f"proyectos_{datetime.now(timezone.utc).strftime('%Y%m%d')}.xlsx"
    return StreamingResponse(out, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": f'attachment; filename="{filename}"'})


# -----------------------------------------------------------------------------
# Portfolio — self-contained HTML presentation for clients.
# -----------------------------------------------------------------------------
from portfolio_view import build_portfolio_html  # noqa: E402
from pathlib import Path as _Path  # noqa: E402

@api_router.get("/portfolio", response_class=HTMLResponse)
async def portfolio_html():
    """Public URL that renders the i-SAI portfolio (no auth, self-contained HTML)."""
    return HTMLResponse(content=build_portfolio_html(), media_type="text/html")


@api_router.get("/portfolio/demo.mp4")
async def portfolio_demo_video(request: Request):
    """Serve the demo video with HTTP byte-range support (needed by <video>)."""
    p = _Path(__file__).resolve().parent.parent / "frontend" / "assets" / "portfolio" / "demo.mp4"
    if not p.exists():
        raise HTTPException(status_code=404, detail="demo video not built")
    file_size = p.stat().st_size
    range_header = request.headers.get("range")
    if range_header:
        # Basic single-range support: "bytes=<start>-<end>"
        try:
            units, rng = range_header.split("=", 1)
            start_s, end_s = rng.split("-", 1)
            start = int(start_s) if start_s else 0
            end = int(end_s) if end_s else file_size - 1
        except Exception:
            start, end = 0, file_size - 1
        end = min(end, file_size - 1)
        length = end - start + 1

        def iterfile():
            with open(p, "rb") as f:
                f.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = f.read(min(1024 * 64, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(length),
            "Content-Type": "video/mp4",
        }
        return StreamingResponse(iterfile(), status_code=206, headers=headers)

    return FileResponse(p, media_type="video/mp4", headers={"Accept-Ranges": "bytes"})


# ====================  CHAT — mensajería entre usuarios  ====================
class ChatCreate(BaseModel):
    participant_ids: List[str]  # must include current user
    name: Optional[str] = None  # for group chats
    project_id: Optional[str] = None
    event_id: Optional[str] = None

class MessageCreate(BaseModel):
    text: str = Field("", max_length=4000)
    file_base64: Optional[str] = None
    file_name: Optional[str] = None
    file_mime: Optional[str] = None

@api_router.post("/chats")
async def chat_create(payload: ChatCreate, user: dict = Depends(current_user)):
    if user["id"] not in payload.participant_ids:
        payload.participant_ids.append(user["id"])
    pids = list(dict.fromkeys(payload.participant_ids))
    if len(pids) < 2:
        raise HTTPException(400, "Mínimo 2 participantes")
    # For 1-on-1 chats, check if chat already exists
    if len(pids) == 2 and not payload.name:
        existing = await db.chats.find_one({
            "participant_ids": {"$all": pids, "$size": 2},
            "name": {"$in": [None, ""]},
        })
        if existing:
            existing.pop("_id", None)
            return existing
    now = datetime.now(timezone.utc).isoformat()
    chat = {
        "id": str(uuid.uuid4()),
        "participant_ids": pids,
        "name": payload.name or None,
        "project_id": payload.project_id,
        "event_id": payload.event_id,
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now,
    }
    await db.chats.insert_one(chat)
    chat.pop("_id", None)
    return chat

@api_router.get("/chats")
async def chat_list(user: dict = Depends(current_user)):
    chats = await db.chats.find(
        {"participant_ids": user["id"]},
        {"_id": 0},
    ).sort("updated_at", -1).to_list(200)
    # Enrich with last message, participant names, and unread count
    out = []
    for c in chats:
        last_msg = await db.messages.find_one(
            {"chat_id": c["id"]},
            {"_id": 0},
            sort=[("created_at", -1)],
        )
        c["last_message"] = last_msg
        unread = await db.messages.count_documents({
            "chat_id": c["id"],
            "sender_id": {"$ne": user["id"]},
            "read_by": {"$ne": user["id"]},
        })
        c["unread"] = unread
        # Participant names
        users = await db.users.find(
            {"id": {"$in": c["participant_ids"]}},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "color": 1},
        ).to_list(50)
        c["participants"] = users
        out.append(c)
    return out

@api_router.get("/chats/{cid}/messages")
async def chat_messages(cid: str, user: dict = Depends(current_user), limit: int = 50, before: Optional[str] = None):
    chat = await db.chats.find_one({"id": cid})
    if not chat or user["id"] not in chat.get("participant_ids", []):
        raise HTTPException(404, "Chat no encontrado")
    q: dict = {"chat_id": cid}
    if before:
        q["created_at"] = {"$lt": before}
    msgs = await db.messages.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    # Mark as read
    await db.messages.update_many(
        {"chat_id": cid, "sender_id": {"$ne": user["id"]}, "read_by": {"$ne": user["id"]}},
        {"$push": {"read_by": user["id"]}},
    )
    return list(reversed(msgs))

@api_router.post("/chats/{cid}/messages")
async def chat_send_message(cid: str, payload: MessageCreate, user: dict = Depends(current_user)):
    chat = await db.chats.find_one({"id": cid})
    if not chat or user["id"] not in chat.get("participant_ids", []):
        raise HTTPException(404, "Chat no encontrado")
    now = datetime.now(timezone.utc).isoformat()
    msg = {
        "id": str(uuid.uuid4()),
        "chat_id": cid,
        "sender_id": user["id"],
        "sender_name": user.get("name") or user.get("email"),
        "text": (payload.text or "").strip(),
        "created_at": now,
        "read_by": [user["id"]],
    }
    if payload.file_base64 and payload.file_name:
        msg["file_base64"] = payload.file_base64
        msg["file_name"] = payload.file_name
        msg["file_mime"] = payload.file_mime or "application/octet-stream"
    if not msg["text"] and not msg.get("file_base64"):
        raise HTTPException(400, "El mensaje no puede estar vacío")
    await db.messages.insert_one(msg)
    await db.chats.update_one({"id": cid}, {"$set": {"updated_at": now}})
    msg.pop("_id", None)
    # Notify other participants
    sender_name = user.get("name") or user.get("email")
    for pid in chat["participant_ids"]:
        if pid == user["id"]:
            continue
        if await should_notify_user(pid, "chat_message"):
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": pid,
                "event_id": None,
                "type": "chat_message",
                "title": f"💬 {sender_name}",
                "message": payload.text.strip()[:200],
                "read": False,
                "created_at": now,
                "from_user_id": user["id"],
                "from_user_name": sender_name,
                "link": f"/chat/{cid}",
            })
    return msg

@api_router.get("/chats/unread-total")
async def chat_unread_total(user: dict = Depends(current_user)):
    total = await db.messages.count_documents({
        "sender_id": {"$ne": user["id"]},
        "read_by": {"$ne": user["id"]},
    })
    return {"unread": total}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[FRONTEND_URL],
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
    await ensure_default_roles_and_migrate()

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
