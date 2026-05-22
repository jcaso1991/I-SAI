"""
Seed demo data — fills every module of the app with realistic Spanish content
for end-to-end testing.

Run:
    cd /app/backend && python -m scripts.seed_demo_data
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "test_database")
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(pw: str) -> str: return pwd_ctx.hash(pw)
def now_iso() -> str: return datetime.now(timezone.utc).isoformat()
def days_from_now(d: int, hour: int = 9) -> str:
    base = datetime.now(timezone.utc).replace(hour=hour, minute=0, second=0, microsecond=0)
    return (base + timedelta(days=d)).isoformat()


DEMO_USERS = [
    {"email": "gestor@isai.com",    "password": "Gestor1234",    "name": "Carmen Ruiz",   "role_key": "gestor",    "color": "#10B981"},
    {"email": "tecnico1@isai.com",  "password": "Tecnico1234",   "name": "Pablo García",  "role_key": "tecnico",   "color": "#F59E0B"},
    {"email": "tecnico2@isai.com",  "password": "Tecnico1234",   "name": "Lucía Méndez",  "role_key": "tecnico",   "color": "#8B5CF6"},
    {"email": "comercial@isai.com", "password": "Comercial1234", "name": "David Torres",  "role_key": "comercial", "color": "#06B6D4"},
    {"email": "sat@isai.com",       "password": "Sat1234",       "name": "Marta Vega",    "role_key": "sat",       "color": "#EC4899"},
]

DEMO_MATERIALES = [
    {"materiales": "Caja fuerte FAC 1500",                  "cliente": "BBVA Sucursal Madrid Centro",      "ubicacion": "C/ Gran Vía 23, Madrid",        "horas_prev": "16", "comercial": "David Torres", "gestor": "Carmen Ruiz", "project_status": "planificado", "fecha": "12/05/2026", "comentarios": "Cliente prefiere instalación matinal"},
    {"materiales": "Bóveda modular MK7",                    "cliente": "Santander Plaza Cataluña",         "ubicacion": "Plaça Catalunya 4, Barcelona",  "horas_prev": "32", "comercial": "David Torres", "gestor": "Carmen Ruiz", "project_status": "planificado", "fecha": "20/05/2026", "comentarios": "Coordinación con seguridad central"},
    {"materiales": "Cerradura electrónica Kaba 7800",       "cliente": "Caixabank Sucursal Sevilla",       "ubicacion": "Av. Constitución 12, Sevilla",  "horas_prev": "8",  "comercial": "David Torres", "gestor": "Carmen Ruiz", "project_status": "terminado",   "fecha": "08/04/2026", "total_parcial": "1.400€"},
    {"materiales": "Sistema control accesos Salto",         "cliente": "Edificio Castellana 81",           "ubicacion": "Pº Castellana 81, Madrid",      "horas_prev": "24", "comercial": "Mario López",  "gestor": "Carmen Ruiz", "project_status": "pendiente"},
    {"materiales": "Caja fuerte ignífuga FichetBauche II",  "cliente": "Bufete Pérez & Asociados",         "ubicacion": "C/ Velázquez 50, Madrid",       "horas_prev": "10", "comercial": "David Torres", "gestor": "Carmen Ruiz", "project_status": "a_facturar",  "fecha": "15/04/2026", "total_parcial": "4.700€"},
    {"materiales": "Cerradura biométrica Burg-Wächter",     "cliente": "Joyería Suárez",                   "ubicacion": "C/ Serrano 56, Madrid",         "horas_prev": "6",  "comercial": "David Torres", "gestor": "Carmen Ruiz", "project_status": "planificado", "fecha": "20/05/2026"},
    {"materiales": "Vault digital Diebold IB100",           "cliente": "Sabadell Tarragona",               "ubicacion": "Rambla Nova 75, Tarragona",     "horas_prev": "40", "comercial": "Mario López",  "gestor": "Carmen Ruiz", "project_status": "planificado", "fecha": "10/06/2026"},
    {"materiales": "Cajero exterior Wincor Nixdorf",        "cliente": "ING Direct Valencia",              "ubicacion": "Av. Aragón 23, Valencia",       "horas_prev": "20", "comercial": "David Torres", "gestor": "Carmen Ruiz", "project_status": "pendiente"},
    {"materiales": "Mantenimiento anual cámaras",           "cliente": "Hospital La Paz",                  "ubicacion": "Pº Castellana 261, Madrid",     "horas_prev": "12", "comercial": "Mario López",  "gestor": "Carmen Ruiz", "project_status": "a_facturar",  "fecha": "01/04/2026", "total_parcial": "6.000€"},
    {"materiales": "Lectores tarjeta entrada principal",    "cliente": "Universidad Complutense",          "ubicacion": "Av. Complutense s/n, Madrid",   "horas_prev": "18", "comercial": "David Torres", "gestor": "Carmen Ruiz", "project_status": "planificado", "fecha": "03/05/2026"},
    {"materiales": "Cambio cilindros oficinas",             "cliente": "Endesa Sede Central",              "ubicacion": "C/ Ribera del Loira 60, Madrid","horas_prev": "9",  "comercial": "Mario López",  "gestor": "Carmen Ruiz", "project_status": "terminado",   "fecha": "27/04/2026", "total_parcial": "1.150€"},
    {"materiales": "Auditoría seguridad bóveda",            "cliente": "Bankinter Bilbao",                 "ubicacion": "Gran Vía 47, Bilbao",           "horas_prev": "14", "comercial": "David Torres", "gestor": "Carmen Ruiz", "project_status": "planificado", "fecha": "06/05/2026"},
    {"materiales": "Instalación CCTV oficina principal",    "cliente": "Iberdrola Bilbao",                 "ubicacion": "Pº Castellana 81, Madrid",      "horas_prev": "30", "comercial": "Mario López",  "gestor": "Carmen Ruiz", "project_status": "anulado"},
    {"materiales": "Renovación cerraduras edificio",        "cliente": "Telefónica I+D",                   "ubicacion": "Distrito C, Madrid",            "horas_prev": "26", "comercial": "David Torres", "gestor": "Carmen Ruiz", "project_status": "pendiente"},
]

DEMO_BUDGETS = [
    {"n_proyecto": "P-2026-001", "cliente": "BBVA Sucursal Madrid Centro", "nombre_instalacion": "Sustitución caja fuerte FAC 1500", "direccion": "C/ Gran Vía 23, Madrid", "contacto_1": "Luis Fernández — 666 111 222", "observaciones_presupuesto": "Incluye desinstalación, transporte e instalación.", "fecha_inicio": "2026-05-12", "fecha_fin": "2026-05-14",
     "equipos": [{"elemento":"Caja fuerte FAC 1500","cantidad":"1","ubicacion":"Bóveda principal","observaciones":"Transporte incluido"},{"elemento":"Cerradura electrónica","cantidad":"1","ubicacion":"Caja FAC 1500","observaciones":"Grado IV"},{"elemento":"Servicio instalación","cantidad":"1","ubicacion":"","observaciones":""}],
     "entrega_tarjeta_mantenimiento": True, "entrega_llave_salto": False, "entrega_eps100": True,
     "nombre_isai": "David Torres", "cargo_isai": "Comercial", "nombre_cliente": "Luis Fernández", "cargo_cliente": "Director", "status": "aceptado"},
    {"n_proyecto": "P-2026-002", "cliente": "Caixabank Sucursal Sevilla", "nombre_instalacion": "Cerradura Kaba 7800", "direccion": "Av. Constitución 12, Sevilla", "contacto_1": "Marta Pérez — 666 555 666", "observaciones_presupuesto": "Cambio puntual.", "fecha_inicio": "2026-05-08", "fecha_fin": "2026-05-08",
     "equipos": [{"elemento":"Cerradura Kaba 7800","cantidad":"1","ubicacion":"Caja registradora","observaciones":""}], "entrega_tarjeta_mantenimiento": False, "entrega_llave_salto": True, "entrega_eps100": False, "nombre_isai": "David Torres", "cargo_isai": "Comercial", "status": "aceptado"},
    {"n_proyecto": "P-2026-003", "cliente": "Edificio Castellana 81", "nombre_instalacion": "Sistema accesos Salto — 4 plantas", "direccion": "Pº Castellana 81, Madrid", "contacto_1": "Comunidad — 911 234 567", "observaciones_presupuesto": "Despliegue Salto KS completo.", "fecha_inicio": "2026-06-01", "fecha_fin": "2026-06-05",
     "equipos": [{"elemento":"Lector Salto XS4 RFID","cantidad":"12","ubicacion":"12 puertas","observaciones":""},{"elemento":"Controladora KS Pro","cantidad":"1","ubicacion":"Sala técnica","observaciones":""},{"elemento":"Tarjetas RFID","cantidad":"200","ubicacion":"Stock","observaciones":""}], "entrega_tarjeta_mantenimiento": True, "entrega_llave_salto": True, "entrega_eps100": False, "nombre_isai": "David Torres", "cargo_isai": "Comercial", "status": "pendiente"},
    {"n_proyecto": "P-2026-004", "cliente": "Joyería Suárez", "nombre_instalacion": "Cerradura biométrica + caja ignífuga", "direccion": "C/ Serrano 56, Madrid", "contacto_1": "Sr. Suárez — 666 999 000", "observaciones_presupuesto": "Instalación nocturna.", "fecha_inicio": "2026-05-20", "fecha_fin": "2026-05-21",
     "equipos": [{"elemento":"Caja ignífuga FichetBauche II","cantidad":"1","ubicacion":"Trastienda","observaciones":""},{"elemento":"Cerradura biométrica B-W","cantidad":"1","ubicacion":"Puerta principal","observaciones":""}], "entrega_tarjeta_mantenimiento": True, "entrega_llave_salto": False, "entrega_eps100": True, "nombre_isai": "David Torres", "cargo_isai": "Comercial", "status": "pendiente"},
    {"n_proyecto": "P-2026-005", "cliente": "Hospital La Paz", "nombre_instalacion": "Mantenimiento anual cámaras", "direccion": "Pº Castellana 261, Madrid", "contacto_1": "STM — 911 222 333", "observaciones_presupuesto": "Contrato anual.", "fecha_inicio": "2026-05-01", "fecha_fin": "2027-04-30",
     "equipos": [{"elemento":"Mantenimiento cámaras IP","cantidad":"75","ubicacion":"Todo el complejo","observaciones":"2 visitas/año"},{"elemento":"Soporte 24/7","cantidad":"1","ubicacion":"","observaciones":""}], "entrega_tarjeta_mantenimiento": True, "entrega_llave_salto": False, "entrega_eps100": False, "nombre_isai": "Mario López", "cargo_isai": "Comercial Senior", "nombre_cliente": "Diego Vázquez", "cargo_cliente": "Jefe ST", "status": "aceptado"},
    {"n_proyecto": "P-2026-006", "cliente": "Sabadell Tarragona", "nombre_instalacion": "Vault digital Diebold IB100", "direccion": "Rambla Nova 75, Tarragona", "contacto_1": "Director — 666 444 555", "observaciones_presupuesto": "Sustitución vault.", "fecha_inicio": "2026-06-10", "fecha_fin": "2026-06-13",
     "equipos": [{"elemento":"Vault Diebold IB100","cantidad":"1","ubicacion":"Sótano","observaciones":""},{"elemento":"Auditoría seguridad","cantidad":"1","ubicacion":"Toda sucursal","observaciones":""}], "entrega_tarjeta_mantenimiento": True, "entrega_llave_salto": True, "entrega_eps100": True, "nombre_isai": "Mario López", "cargo_isai": "Comercial Senior", "status": "pendiente"},
]

DEMO_SAT_CLIENTS = [
    {"cliente": "BBVA Sucursal Madrid Centro",  "direccion": "C/ Gran Vía 23, Madrid",         "contacto": "Luis Fernández",       "telefono": "666 111 222"},
    {"cliente": "Caixabank Sucursal Sevilla",   "direccion": "Av. Constitución 12, Sevilla",   "contacto": "Marta Pérez",          "telefono": "666 555 666"},
    {"cliente": "Edificio Castellana 81",       "direccion": "Pº Castellana 81, Madrid",       "contacto": "Juan Fuentes",         "telefono": "911 234 567"},
    {"cliente": "Joyería Suárez",               "direccion": "C/ Serrano 56, Madrid",          "contacto": "Sr. Suárez",           "telefono": "666 999 000"},
    {"cliente": "Hospital La Paz",              "direccion": "Pº Castellana 261, Madrid",      "contacto": "Diego Vázquez",        "telefono": "911 222 333"},
    {"cliente": "Universidad Complutense",      "direccion": "Av. Complutense s/n, Madrid",    "contacto": "Decanato — Ana Vidal", "telefono": "913 944 100"},
    {"cliente": "Endesa Sede Central",          "direccion": "C/ Ribera del Loira 60, Madrid", "contacto": "Servicios Generales",  "telefono": "912 130 000"},
    {"cliente": "Bankinter Bilbao",             "direccion": "Gran Vía 47, Bilbao",            "contacto": "Director",             "telefono": "944 110 020"},
]

DEMO_SAT_INCIDENTS = [
    {"cliente_idx": 0, "observaciones": "Caja fuerte bloqueada desde esta mañana.",                                  "status": "pendiente"},
    {"cliente_idx": 1, "observaciones": "Cerradura electrónica pitidos intermitentes. Batería baja.",                "status": "pendiente"},
    {"cliente_idx": 2, "observaciones": "Lector planta 3 no responde a tarjetas. Resto del edificio OK.",            "status": "en_proceso"},
    {"cliente_idx": 3, "observaciones": "Lector biométrico no reconoce huella. Urgente.",                            "status": "resuelta",  "comentarios_sat": "Reinicializada BD biométrica. OK.",   "facturable": True},
    {"cliente_idx": 4, "observaciones": "Cámara helipuerto desconectada.",                                            "status": "resuelta",  "comentarios_sat": "Cable Ethernet defectuoso sustituido.", "facturable": False},
    {"cliente_idx": 0, "observaciones": "Cambio de combinación tras rotación de directiva.",                          "status": "pendiente"},
    {"cliente_idx": 5, "observaciones": "Solicitud nueva tarjeta de acceso para empleado.",                          "status": "resuelta",  "comentarios_sat": "Tarjeta entregada a RRHH.",            "facturable": True},
    {"cliente_idx": 6, "observaciones": "Puerta principal aparcamiento no cierra bien.",                              "status": "en_proceso"},
    {"cliente_idx": 2, "observaciones": "Software accesos da error al exportar informes.",                            "status": "pendiente"},
    {"cliente_idx": 7, "observaciones": "Auditoría seguridad solicitada por dirección.",                              "status": "en_proceso"},
    {"cliente_idx": 3, "observaciones": "Cliente solicita formación adicional uso caja fuerte.",                      "status": "resuelta",  "comentarios_sat": "Formación 2h impartida.",               "facturable": True},
    {"cliente_idx": 4, "observaciones": "Cámara exterior helipuerto con interferencias nocturnas.",                   "status": "pendiente"},
]


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    print(f"📦 Conectado a {DB_NAME}")

    # Wipe demo records
    print("⏳ Limpiando datos demo previos…")
    for col in ["materiales", "events", "plans", "budgets", "sat_incidents", "sat_clients", "notifications", "chats", "messages"]:
        res = await db[col].delete_many({"demo": True})
        if res.deleted_count: print(f"   🗑️  {col}: -{res.deleted_count}")

    # USERS
    print("\n👥 Usuarios demo…")
    role_docs = {r["key"]: r async for r in db.roles.find({})}
    users_created = 0
    for u in DEMO_USERS:
        if await db.users.find_one({"email": u["email"]}): continue
        role = role_docs.get(u["role_key"])
        if not role: continue
        legacy = "admin" if role["key"] in ("admin","gestor") else ("comercial" if role["key"]=="comercial" else "user")
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": u["email"].lower(), "name": u["name"],
            "password": hash_password(u["password"]), "role": legacy, "role_id": role["id"],
            "color": u["color"], "created_at": now_iso(),
        })
        users_created += 1
    print(f"   ✅ {users_created} usuarios nuevos")

    all_users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(200)
    ube = {u["email"]: u for u in all_users}
    admin_u = ube.get("admin@materiales.com"); gestor = ube.get("gestor@isai.com")
    t1 = ube.get("tecnico1@isai.com"); t2 = ube.get("tecnico2@isai.com")
    comercial = ube.get("comercial@isai.com"); sat_u = ube.get("sat@isai.com")

    # MATERIALES
    print("\n📂 Proyectos…")
    last = await db.materiales.find({}, {"_id": 0, "row_index": 1}).sort("row_index", -1).limit(1).to_list(1)
    next_row = (last[0]["row_index"] + 1) if last else 1
    mats = []
    for i, m in enumerate(DEMO_MATERIALES):
        techs = [t1["id"]] if i % 3 == 0 and t1 else ([t2["id"]] if i % 3 == 1 and t2 else ([t1["id"], t2["id"]] if t1 and t2 else []))
        doc = {
            "id": str(uuid.uuid4()), "row_index": next_row + i, "demo": True, "sync_status": "synced",
            "fecha": m.get("fecha", ""), "entrega_recogida": "", "total_parcial": m.get("total_parcial", ""),
            "tecnico": "", "tecnicos": techs, "comentarios": m.get("comentarios", ""),
            "project_status": m.get("project_status", "pendiente"),
            "manager_id": gestor["id"] if gestor else None, "manager_name": gestor["name"] if gestor else None,
            "updated_at": now_iso(), "updated_by": "seed_script",
            **{k: v for k, v in m.items() if k not in ("project_status","fecha","total_parcial","comentarios")},
        }
        await db.materiales.insert_one(doc)
        mats.append(doc)
    print(f"   ✅ {len(mats)} proyectos")

    # EVENTS
    print("\n🗓️ Eventos…")
    ep = [
        (-3, 8, 4, "Auditoría inicial", 11, [t1], "completed", "Auditoría OK. Informe pendiente."),
        (-2, 9, 8, "Cambio cilindros Endesa", 10, [t1, t2], "completed", "Llaves entregadas."),
        (-1, 9, 6, "Cerradura Kaba Caixabank", 2, [t2], "completed", "Cerradura instalada."),
        (0, 9, 6, "Caja fuerte BBVA Gran Vía", 0, [t1], "in_progress", "Esperando confirmación cliente."),
        (0, 14, 3, "Visita comercial Castellana 81", 3, [comercial], "in_progress", "Reunión con junta."),
        (1, 8, 8, "Bóveda Santander BCN", 1, [t1, t2], "in_progress", ""),
        (2, 9, 4, "Mantenimiento Hospital La Paz", 8, [t2], "pending_completion", "Faltan cables helipuerto."),
        (3, 10, 5, "Lectores Universidad Complutense", 9, [t1], "in_progress", ""),
        (4, 9, 8, "Vault Sabadell Tarragona", 6, [t1, t2], "in_progress", ""),
        (5, 14, 4, "Auditoría Bankinter Bilbao", 11, [t2], "in_progress", ""),
        (7, 9, 8, "Accesos Castellana 81", 3, [t1, t2], "in_progress", ""),
        (8, 9, 6, "Cajero ING Direct Valencia", 7, [t1], "in_progress", ""),
        (10, 9, 5, "Cerradura biométrica Joyería Suárez", 5, [t2], "in_progress", ""),
        (12, 9, 4, "Caja ignífuga Bufete Pérez", 4, [t1], "in_progress", ""),
    ]
    evc = 0
    for offset, hour, dur, title, mi, assignees, status, seg in ep:
        if not assignees or not all(assignees): continue
        start = days_from_now(offset, hour=hour)
        end = (datetime.fromisoformat(start) + timedelta(hours=dur)).isoformat()
        mat = mats[mi] if mi < len(mats) else None
        await db.events.insert_one({
            "id": str(uuid.uuid4()), "demo": True, "title": title,
            "start_at": start, "end_at": end,
            "description": f"Trabajo en {mat['cliente']}" if mat else "",
            "material_id": mat["id"] if mat else None,
            "assigned_user_ids": [u["id"] for u in assignees if u],
            "manager_id": gestor["id"] if gestor else (admin_u or {}).get("id"),
            "status": status, "seguimiento": seg, "hours": dur,
            "created_by": (admin_u or {}).get("email"), "created_at": now_iso(), "updated_at": now_iso(),
        })
        evc += 1
    print(f"   ✅ {evc} eventos")

    # PLANS
    print("\n📐 Planos…")
    plans = ["BBVA Gran Vía — planta 1", "Castellana 81 — planta tipo", "Joyería Suárez — distribución", "Hospital La Paz — pasillo urgencias", "Universidad Complutense — entrada principal"]
    for t in plans:
        await db.plans.insert_one({"id": str(uuid.uuid4()), "demo": True, "title": t, "data": {"shapes": []}, "created_at": now_iso(), "updated_at": now_iso(), "created_by": (admin_u or {}).get("email")})
    print(f"   ✅ {len(plans)} planos")

    # BUDGETS
    print("\n💰 Presupuestos…")
    for b in DEMO_BUDGETS:
        mat = next((m for m in mats if m.get("cliente") == b["cliente"]), None)
        await db.budgets.insert_one({"id": str(uuid.uuid4()), "demo": True, **b, "material_id": mat["id"] if mat else None, "created_by": "comercial@isai.com", "created_by_name": "David Torres", "created_at": now_iso(), "updated_at": now_iso()})
    print(f"   ✅ {len(DEMO_BUDGETS)} presupuestos")

    # SAT CLIENTS
    print("\n📞 Clientes SAT…")
    sat_cl = []
    for c in DEMO_SAT_CLIENTS:
        d = {"id": str(uuid.uuid4()), "demo": True, **c, "created_at": now_iso()}
        await db.sat_clients.insert_one(d); sat_cl.append(d)
    print(f"   ✅ {len(sat_cl)} SAT clients")

    # SAT INCIDENTS
    print("\n🛠️ Incidencias SAT…")
    for i, inc in enumerate(DEMO_SAT_INCIDENTS):
        cl = sat_cl[inc["cliente_idx"]]
        fe = (datetime.now(timezone.utc) - timedelta(days=(i%25)+1)).isoformat()
        hist = [{"ts": fe, "user": "Cliente (formulario)", "action": "Incidencia abierta", "note": inc["observaciones"][:120]}]
        if inc["status"] in ("en_proceso","resuelta"):
            hist.append({"ts": (datetime.fromisoformat(fe) + timedelta(hours=2)).isoformat(), "user": "Marta Vega", "action": "Asignada", "note": "Asignada al técnico"})
        if inc["status"] == "resuelta":
            hist.append({"ts": (datetime.fromisoformat(fe) + timedelta(days=1)).isoformat(), "user": "Marta Vega", "action": f"Resuelta — {'Facturable' if inc.get('facturable') else 'No facturable'}", "note": inc.get("comentarios_sat", "Resuelta")})
        await db.sat_incidents.insert_one({
            "id": str(uuid.uuid4()), "demo": True, "client_id": cl["id"], "cliente": cl["cliente"],
            "direccion": cl["direccion"], "telefono": cl["telefono"], "observaciones": inc["observaciones"],
            "comentarios_sat": inc.get("comentarios_sat",""), "status": inc["status"],
            "facturable": inc.get("facturable") if inc["status"] == "resuelta" else None,
            "fecha_entrada": fe, "history": hist, "created_at": fe, "updated_at": now_iso(),
        })
    print(f"   ✅ {len(DEMO_SAT_INCIDENTS)} incidencias SAT")

    # CHATS
    print("\n💬 Chats…")
    cc = mc = 0
    if all([admin_u, t1, t2, gestor, comercial, sat_u]):
        chats_payload = [
            (None, [admin_u, gestor], [(admin_u, "Buenos días Carmen, ¿repasamos planificación?"), (gestor, "Hola, claro. Envío plan completo esta tarde."), (admin_u, "Perfecto, gracias!")]),
            (None, [gestor, t1], [(gestor, "Pablo, mañana arrancas con BBVA Gran Vía 9:00."), (t1, "Recibido, ¿llevo la caja desde almacén?"), (gestor, "Sí, ya está separada. Habla con María."), (t1, "Perfecto, hasta mañana.")]),
            (None, [gestor, t2], [(gestor, "Lucía, te paso contacto Hospital La Paz."), (t2, "Gracias. ¿Furgo grande?"), (gestor, "Sí, reserva la grande, vais Pablo y tú.")]),
            (None, [comercial, gestor], [(comercial, "Castellana 81 quiere reunirse jueves."), (gestor, "Apunto. Te confirmo.")]),
            (None, [sat_u, gestor], [(sat_u, "Urgencia BBVA — caja bloqueada."), (gestor, "Asígnaselo a Pablo, mañana cuando termine Caixabank."), (sat_u, "Listo, asignado.")]),
            ("Equipo técnico", [admin_u, gestor, t1, t2], [(admin_u, "Recordad reunión viernes 18:00."), (gestor, "Apuntado, prepararé resumen."), (t1, "Confirmado!"), (t2, "Allí estaré.")]),
        ]
        now = datetime.now(timezone.utc)
        for name, parts, msgs in chats_payload:
            cid = str(uuid.uuid4())
            await db.chats.insert_one({"id": cid, "demo": True, "participant_ids": [p["id"] for p in parts], "name": name, "project_id": None, "event_id": None, "created_by": parts[0]["id"], "created_at": (now - timedelta(days=2)).isoformat(), "updated_at": now.isoformat()})
            cc += 1
            for j, (sender, text) in enumerate(msgs):
                await db.messages.insert_one({"id": str(uuid.uuid4()), "demo": True, "chat_id": cid, "sender_id": sender["id"], "sender_name": sender.get("name") or sender["email"], "text": text, "file_base64": None, "file_name": None, "file_mime": None, "read_by": [sender["id"]], "created_at": (now - timedelta(hours=len(msgs)-j)).isoformat()})
                mc += 1
    print(f"   ✅ {cc} chats con {mc} mensajes")

    # NOTIFICATIONS
    print("\n🔔 Notificaciones…")
    nc = 0
    if t1:
        for n in [("Tienes 3 trabajos asignados esta semana","info"), ("Nuevo evento: Caja fuerte BBVA Gran Vía","event"), ("Recordatorio: completa seguimiento Endesa","warning")]:
            await db.notifications.insert_one({"id": str(uuid.uuid4()), "demo": True, "user_id": t1["id"], "text": n[0], "kind": n[1], "read": False, "created_at": now_iso()})
            nc += 1
    if gestor:
        await db.notifications.insert_one({"id": str(uuid.uuid4()), "demo": True, "user_id": gestor["id"], "text": "El proyecto BBVA Gran Vía cambió a 'planificado'", "kind": "info", "read": False, "created_at": now_iso()}); nc += 1
    if sat_u:
        await db.notifications.insert_one({"id": str(uuid.uuid4()), "demo": True, "user_id": sat_u["id"], "text": "Nueva incidencia urgente: Caja BBVA bloqueada", "kind": "warning", "read": False, "created_at": now_iso()}); nc += 1
    print(f"   ✅ {nc} notificaciones")

    print("\n" + "="*60 + "\n✅ SEED COMPLETO\n" + "="*60)
    print(f"  Usuarios:      {users_created}\n  Proyectos:     {len(mats)}\n  Eventos:       {evc}\n  Planos:        {len(plans)}")
    print(f"  Presupuestos:  {len(DEMO_BUDGETS)}\n  SAT clients:   {len(sat_cl)}\n  SAT incid:     {len(DEMO_SAT_INCIDENTS)}")
    print(f"  Chats:         {cc} ({mc} msgs)\n  Notificaciones:{nc}")
    print("\n📋 Credenciales:\n  admin@materiales.com / Admin1234")
    for u in DEMO_USERS:
        print(f"  {u['email']:25} / {u['password']}")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
