"""
Script masivo para:
1. Geocodificar TODOS los proyectos a coordenadas reales.
2. Generar direcciones aleatorias realistas basadas en la ubicación.
3. Rellenar todos los campos vacíos de proyectos con datos coherentes.
4. Generar datos de prueba en TODOS los apartados de la app
   (historial, presupuestos, SAT, chats, eventos, documentos, planos).
"""
import asyncio
import os
import sys
import random
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ---------------------------------------------------------------------------
# Diccionario amplio de ciudades (norte de España, País Vasco, Navarra, La Rioja).
# Coordenadas reales del centro de la población.
# ---------------------------------------------------------------------------
CITIES = {
    # Bizkaia
    "BILBAO": (43.2630, -2.9350),
    "BARAKALDO": (43.2967, -2.9889),
    "GETXO": (43.3567, -3.0117),
    "PORTUGALETE": (43.3208, -3.0193),
    "SESTAO": (43.3094, -3.0080),
    "BASAURI": (43.2333, -2.8833),
    "DURANGO": (43.1714, -2.6336),
    "AMOREBIETA": (43.2186, -2.7400),
    "MUNGIA": (43.3539, -2.8453),
    "ERMUA": (43.1850, -2.4978),
    "GERNIKA": (43.3147, -2.6794),
    "GUERNICA": (43.3147, -2.6794),
    "GALDAKAO": (43.2308, -2.8389),
    "BERMEO": (43.4214, -2.7228),
    "ONDARROA": (43.3214, -2.4181),
    "LEKEITIO": (43.3650, -2.5050),
    "ZALLA": (43.2167, -3.1500),
    "BALMASEDA": (43.1781, -3.1936),
    "TRAPAGA": (43.2933, -3.0289),
    "TRAPAGARAN": (43.2933, -3.0289),
    "LOIU": (43.3308, -2.9442),
    "DERIO": (43.2950, -2.8950),
    "ZAMUDIO": (43.2933, -2.8744),
    "BILBO": (43.2630, -2.9350),

    # Gipuzkoa
    "DONOSTIA": (43.3183, -1.9812),
    "SAN SEBASTIAN": (43.3183, -1.9812),
    "IRUN": (43.3389, -1.7894),
    "RENTERIA": (43.3122, -1.8983),
    "ERRENTERIA": (43.3122, -1.8983),
    "EIBAR": (43.1839, -2.4717),
    "ARRASATE": (43.0658, -2.4889),
    "MONDRAGON": (43.0658, -2.4889),
    "BERGARA": (43.1086, -2.4181),
    "HONDARRIBIA": (43.3700, -1.7944),
    "PASAIA": (43.3231, -1.9281),
    "ZARAUTZ": (43.2856, -2.1689),
    "AZPEITIA": (43.1844, -2.2658),
    "AZKOITIA": (43.1789, -2.3036),
    "BEASAIN": (43.0467, -2.2008),
    "ORDIZIA": (43.0419, -2.1822),
    "ELGOIBAR": (43.2147, -2.4128),
    "ZUMAIA": (43.2972, -2.2519),
    "MENDARO": (43.2161, -2.3622),
    "OÑATI": (43.0353, -2.4147),
    "OATI": (43.0353, -2.4147),
    "TOLOSA": (43.1356, -2.0789),
    "LASARTE": (43.2658, -2.0247),
    "ASTIGARRAGA": (43.2789, -1.9444),
    "LAUDIO": (43.1428, -2.9728),
    "LLODIO": (43.1428, -2.9728),
    "USURBIL": (43.2756, -2.0533),
    "ANDOAIN": (43.2225, -2.0211),

    # Araba
    "VITORIA": (42.8467, -2.6716),
    "GASTEIZ": (42.8467, -2.6716),
    "AMURRIO": (43.0533, -3.0006),
    "SALVATIERRA": (42.8517, -2.3922),
    "AGURAIN": (42.8517, -2.3922),
    "OKONDO": (43.1217, -3.0511),
    "LAUDIO/LLODIO": (43.1428, -2.9728),
    "JUNDIZ": (42.8417, -2.7517),
    "LAUIAONDO": (43.1167, -2.9833),

    # Navarra
    "PAMPLONA": (42.8125, -1.6458),
    "IRUÑEA": (42.8125, -1.6458),
    "TUDELA": (42.0644, -1.6064),
    "TAFALLA": (42.5267, -1.6700),
    "BARAÑAIN": (42.8000, -1.6764),
    "ESTELLA": (42.6722, -2.0322),
    "LIZARRA": (42.6722, -2.0322),
    "BURLADA": (42.8275, -1.6181),
    "ZIZUR": (42.7869, -1.6856),
    "ANSOAIN": (42.8389, -1.6500),
    "OLAZAGUTIA": (42.8769, -2.1900),

    # La Rioja
    "LOGROÑO": (42.4650, -2.4456),
    "LOGRONO": (42.4650, -2.4456),
    "CALAHORRA": (42.3050, -1.9650),
    "HARO": (42.5778, -2.8472),
    "ARNEDO": (42.2275, -2.1006),
    "NAJERA": (42.4172, -2.7308),

    # Cantabria / norte
    "SANTANDER": (43.4623, -3.8099),
    "TORRELAVEGA": (43.3500, -4.0500),

    # Genéricos
    "MADRID": (40.4168, -3.7038),
    "BARCELONA": (41.3851, 2.1734),
    "VALENCIA": (39.4699, -0.3763),
    "ZARAGOZA": (41.6488, -0.8891),
    "SEVILLA": (37.3891, -5.9845),
    "GUADALAJARA": (40.6342, -3.1611),
    "BURGOS": (42.3408, -3.6997),
    "VARIOS": (43.2630, -2.9350),  # fallback Bilbao
}

# Calles tipo (genéricas pero reales en su mayoría)
STREETS = [
    "Calle Mayor", "Calle Real", "Calle de la Estación", "Calle de la Iglesia",
    "Calle de San Juan", "Calle de Santa María", "Avenida de la Libertad",
    "Avenida del Ferrocarril", "Plaza Mayor", "Plaza Nueva", "Plaza del Ayuntamiento",
    "Calle del Comercio", "Calle Nueva", "Calle Industria", "Polígono Industrial",
    "Calle de la Paz", "Calle del Carmen", "Calle Doctor Fleming", "Calle del Sol",
    "Travesía de la Estación", "Camino Real", "Calle del Puerto",
    "Calle Ribera", "Calle Ercilla", "Gran Vía", "Calle Henao",
    "Calle Alameda Recalde", "Calle Buenos Aires", "Calle Iparraguirre",
    "Calle Licenciado Poza", "Avenida del Triángulo", "Calle Bidebarrieta",
    "Calle Diputación", "Calle Hurtado de Amezaga",
]

NOTES = [
    "Instalación realizada sin incidencias.",
    "El cliente confirma la recepción del material.",
    "Pendiente de revisión por parte del técnico responsable.",
    "Se ha entregado documentación firmada en obra.",
    "Material entregado en plazo según planificación.",
    "Aplicado descuento comercial acordado con el cliente.",
    "Coordinado con el jefe de obra para acceso a la zona.",
    "Cerradura instalada y comprobada con llaves maestras.",
    "Caja fuerte anclada y probada según protocolo.",
    "Acta de entrega firmada por el responsable.",
    "Cliente solicita factura electrónica.",
    "Pendiente de cobro a 30 días.",
    "Acceso restringido a la obra, coordinar con seguridad.",
    "Material para almacén intermedio, posterior traslado.",
    "Cliente preferente, dar prioridad en entregas.",
]

INCIDENT_TYPES = [
    "Avería en cerradura electrónica",
    "Caja fuerte bloqueada",
    "Cilindro forzado",
    "Reprogramación de tarjetas",
    "Avería motor puerta blindada",
    "Sustitución de bombín",
    "Mantenimiento preventivo anual",
    "Revisión sistema control de acceso",
    "Cambio de combinación caja fuerte",
    "Instalación de cerradura nueva",
]

INCIDENT_STATUS = ["abierta", "en_proceso", "resuelta", "cerrada"]
INCIDENT_PRIORITIES = ["baja", "media", "alta", "urgente"]

CHAT_MESSAGES = [
    "Hola, ¿cómo va la obra?",
    "Acabo de llegar a la ubicación.",
    "Material entregado correctamente.",
    "¿Puedes confirmar la hora de la visita?",
    "Subo el albarán firmado.",
    "El cliente pide presupuesto adicional.",
    "Revisado, todo OK por mi parte.",
    "Cambio de planes, voy a otro proyecto antes.",
    "Llego en 15 min.",
    "Cerrado el parte.",
    "Hay un problema con el acceso, llamo al jefe de obra.",
    "Pendiente de validar con el cliente.",
    "Foto enviada al grupo.",
    "Acta firmada y guardada en el proyecto.",
    "Necesito confirmación para empezar.",
]

# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------
def normalize_city(s: str) -> str:
    if not s:
        return ""
    # quitar acentos y caracteres especiales
    s = s.upper().strip()
    # caracteres raros (encoding) -> N/Ñ ANTES de la normalización
    s = s.replace("—", "N").replace("‹", "U").replace("›", "U").replace("”", "O").replace("Ñ", "N")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s


# Normalizamos las claves del diccionario para que el match sea consistente
CITIES = {normalize_city(k): v for k, v in CITIES.items()}


def jitter(lat: float, lng: float, radius_km: float = 4.0) -> tuple[float, float]:
    # ~ 1 grado lat = 111 km
    dlat = (random.random() - 0.5) * 2 * (radius_km / 111.0)
    dlng = (random.random() - 0.5) * 2 * (radius_km / (111.0 * abs(0.7)))
    return round(lat + dlat, 6), round(lng + dlng, 6)


def find_city_coords(ubicacion: str) -> Optional[tuple[float, float]]:
    if not ubicacion:
        return None
    norm = normalize_city(ubicacion)
    # match exacto
    if norm in CITIES:
        return CITIES[norm]
    # match parcial
    for key, coords in CITIES.items():
        if key in norm or norm in key:
            return coords
    return None


async def geocode_nominatim(query: str) -> Optional[tuple[float, float]]:
    try:
        async with httpx.AsyncClient(timeout=8.0) as c:
            r = await c.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": query + ", España", "format": "json", "limit": 1},
                headers={"User-Agent": "isai-materiales-app/1.0"},
            )
            if r.status_code == 200:
                data = r.json()
                if data:
                    return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as e:
        print(f"  ! Nominatim fail '{query}': {e}")
    return None


def random_address(city_norm: str) -> str:
    street = random.choice(STREETS)
    number = random.randint(1, 220)
    city_clean = city_norm.title()
    return f"{street}, {number} - {city_clean}"


# ---------------------------------------------------------------------------
# 1. Geocodificación + direcciones
# ---------------------------------------------------------------------------
async def geocode_all_projects():
    print("\n=== 1. Geocodificación masiva de proyectos ===")
    cur = db.materiales.find({}, {"id": 1, "ubicacion": 1, "cliente": 1, "lat": 1})
    docs = await cur.to_list(length=10000)
    print(f"  Proyectos totales: {len(docs)}")

    # Ciudades reales del norte donde "reasignar" los proyectos con ubicación corrupta
    # Se reparten con pesos realistas (Bilbao y Donosti más, pueblos menos)
    REAL_CITIES_POOL = [
        ("BILBAO", 25), ("DONOSTIA", 18), ("VITORIA", 14), ("PAMPLONA", 10),
        ("BARAKALDO", 6), ("GETXO", 5), ("PORTUGALETE", 4), ("BASAURI", 4),
        ("DURANGO", 4), ("AMOREBIETA", 3), ("MUNGIA", 3), ("ERMUA", 3),
        ("GALDAKAO", 3), ("IRUN", 5), ("EIBAR", 4), ("ARRASATE", 4),
        ("BERGARA", 3), ("HONDARRIBIA", 3), ("ZARAUTZ", 3), ("AZPEITIA", 3),
        ("BEASAIN", 3), ("ELGOIBAR", 3), ("TOLOSA", 4), ("LASARTE", 3),
        ("AMURRIO", 2), ("LAUDIO", 2), ("LOGRONO", 6), ("TUDELA", 3),
        ("ESTELLA", 2), ("SANTANDER", 5), ("MADRID", 2),
    ]
    pool_cities = []
    pool_weights = []
    for name, w in REAL_CITIES_POOL:
        norm = normalize_city(name)
        if norm in CITIES:
            pool_cities.append(norm)
            pool_weights.append(w)

    nominatim_cache: dict[str, tuple[float, float]] = {}
    updated = 0
    by_local = 0
    by_nominatim = 0
    by_corrupted = 0
    failed = 0

    for i, doc in enumerate(docs):
        ubic = (doc.get("ubicacion") or "").strip()
        # Detectar ubicaciones corruptas (errores Excel) o vacías -> asignar ciudad real aleatoria
        is_corrupted = (
            not ubic
            or "#" in ubic
            or "CONECTAR" in ubic.upper()
            or "N/A" in ubic.upper()
            or "#N/A" in ubic
            or "VARIOS" in ubic.upper()
            or "?" in ubic
        )
        new_ubicacion = ubic

        if is_corrupted:
            chosen = random.choices(pool_cities, weights=pool_weights)[0]
            coords = CITIES[chosen]
            new_ubicacion = chosen.title()
            by_corrupted += 1
        else:
            coords = find_city_coords(ubic)
            if coords:
                by_local += 1
            else:
                # Fallback a una de las ciudades vascas/cántabras
                chosen = random.choices(pool_cities, weights=pool_weights)[0]
                coords = CITIES[chosen]
                new_ubicacion = chosen.title()
                failed += 1

        lat, lng = jitter(coords[0], coords[1], radius_km=3.5)
        direccion = random_address(normalize_city(new_ubicacion) or "Bilbao")

        update = {"lat": lat, "lng": lng, "direccion": direccion}
        if is_corrupted or not ubic:
            update["ubicacion"] = new_ubicacion

        await db.materiales.update_one(
            {"id": doc["id"]},
            {"$set": update},
        )
        updated += 1
        if (i + 1) % 200 == 0:
            print(f"  ... {i+1}/{len(docs)} actualizados")

    print(f"  ✅ Geocodificados: {updated}")
    print(f"     - Match local: {by_local}, Corruptos reasignados: {by_corrupted}, Fallback: {failed}")


# ---------------------------------------------------------------------------
# 2. Completar campos vacíos de proyectos
# ---------------------------------------------------------------------------
async def enrich_projects():
    print("\n=== 2. Enriquecimiento de campos de proyectos ===")
    cur = db.materiales.find({})
    docs = await cur.to_list(length=10000)

    # cargar usuarios
    users = await db.users.find({}).to_list(length=500)
    tecnicos = [u for u in users if (u.get("role") or "").lower() in ("user", "tecnico", "technician")] or users
    managers = [u for u in users if (u.get("role") or "").lower() in ("manager", "gestor")] or users
    comerciales = [u for u in users if "comercial" in (u.get("role") or "").lower()] or users

    statuses = ["pendiente", "en_curso", "completado", "cancelado"]
    status_weights = [0.35, 0.30, 0.25, 0.10]

    updated = 0
    for d in docs:
        upd: dict = {}
        # fecha
        if not d.get("fecha"):
            days_ago = random.randint(0, 365)
            upd["fecha"] = (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime("%Y-%m-%d")
        # entrega/recogida
        if not d.get("entrega_recogida"):
            upd["entrega_recogida"] = random.choice(["entrega", "recogida", "entrega+montaje", "instalación"])
        # total parcial (importe)
        if not d.get("total_parcial"):
            upd["total_parcial"] = f"{random.randint(150, 12000)},{random.randint(0,99):02d} €"
        # tecnico
        if not d.get("tecnico") and tecnicos:
            t = random.choice(tecnicos)
            upd["tecnico"] = t.get("name") or t.get("email", "Técnico")
        # tecnicos list
        if not d.get("tecnicos") and tecnicos:
            n = random.choice([1, 1, 2, 2, 3])
            picks = random.sample(tecnicos, min(n, len(tecnicos)))
            upd["tecnicos"] = [u.get("name") or u.get("email") for u in picks]
        # comentarios
        if not d.get("comentarios"):
            upd["comentarios"] = random.choice(NOTES)
        # manager
        if not d.get("manager_id") and managers:
            m = random.choice(managers)
            upd["manager_id"] = m["id"]
            upd["manager_name"] = m.get("name") or m.get("email")
        # project_status
        if not d.get("project_status") or d.get("project_status") == "pendiente":
            upd["project_status"] = random.choices(statuses, weights=status_weights)[0]
        # horas previstas
        if not d.get("horas_prev"):
            upd["horas_prev"] = str(random.randint(2, 80))
        # horas imputadas
        if not d.get("horas_imputadas"):
            try:
                prev = float(d.get("horas_prev") or upd.get("horas_prev") or 8)
            except (ValueError, TypeError):
                prev = 8.0
            upd["horas_imputadas"] = round(random.uniform(0, prev * 1.2), 1)
        # gestor / comercial nombres
        if not d.get("comercial") and comerciales:
            upd["comercial"] = (random.choice(comerciales).get("name") or "Comercial")
        if not d.get("gestor") and managers:
            upd["gestor"] = (random.choice(managers).get("name") or "Gestor")

        if upd:
            upd["updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.materiales.update_one({"id": d["id"]}, {"$set": upd})
            updated += 1

    print(f"  ✅ {updated} proyectos enriquecidos")


# ---------------------------------------------------------------------------
# 3. Historial por proyecto
# ---------------------------------------------------------------------------
async def seed_project_history():
    print("\n=== 3. Historial de proyectos ===")
    projects = await db.materiales.find({}, {"id": 1, "cliente": 1, "manager_name": 1}).to_list(length=10000)
    users = await db.users.find({}).to_list(length=500)
    if not users:
        print("  ! No hay usuarios")
        return

    actions = [
        "creó el proyecto", "asignó técnico", "actualizó fechas", "subió documento",
        "envió mensaje al chat", "marcó como en curso", "registró visita técnica",
        "añadió comentario", "cambió el estado", "validó presupuesto",
    ]

    inserted = 0
    for p in projects[:300]:  # solo a 300 proyectos para no saturar
        n_events = random.randint(2, 8)
        for _ in range(n_events):
            u = random.choice(users)
            when = datetime.now(timezone.utc) - timedelta(days=random.randint(0, 180), hours=random.randint(0, 23))
            entry = {
                "id": f"hist_{p['id']}_{inserted}",
                "project_id": p["id"],
                "user_id": u["id"],
                "user_name": u.get("name") or u.get("email"),
                "action": random.choice(actions),
                "detail": random.choice(NOTES),
                "timestamp": when.isoformat(),
            }
            await db.project_history.insert_one(entry)
            inserted += 1
    print(f"  ✅ {inserted} entradas de historial")


# ---------------------------------------------------------------------------
# 4. Presupuestos
# ---------------------------------------------------------------------------
async def seed_budgets():
    print("\n=== 4. Presupuestos ===")
    projects = await db.materiales.find({}, {"id": 1, "cliente": 1, "ubicacion": 1}).to_list(length=10000)
    users = await db.users.find({}).to_list(length=500)
    if not projects or not users:
        return

    existing = await db.budgets.count_documents({})
    print(f"  Presupuestos existentes: {existing}")

    items_pool = [
        ("Cerradura electrónica de alta seguridad", 380),
        ("Bombín europeo antibumping", 95),
        ("Caja fuerte FAC 1500", 850),
        ("Cilindro de seguridad", 60),
        ("Control de acceso por tarjeta", 1450),
        ("Mano de obra técnico (h)", 45),
        ("Desplazamiento", 60),
        ("Llave maestra", 25),
        ("Cierre antipánico", 320),
        ("Blindaje puerta", 1200),
    ]

    inserted = 0
    for p in random.sample(projects, min(200, len(projects))):
        n_items = random.randint(2, 6)
        items = []
        total = 0
        for _ in range(n_items):
            name, base = random.choice(items_pool)
            qty = random.randint(1, 6)
            price = base + random.randint(-15, 35)
            line = qty * price
            items.append({"descripcion": name, "cantidad": qty, "precio": price, "total": line})
            total += line

        budget = {
            "id": f"bdg_{p['id']}_{inserted}",
            "project_id": p["id"],
            "cliente": p.get("cliente", ""),
            "ubicacion": p.get("ubicacion", ""),
            "fecha": (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 200))).strftime("%Y-%m-%d"),
            "estado": random.choice(["borrador", "enviado", "aceptado", "rechazado"]),
            "items": items,
            "subtotal": total,
            "iva": round(total * 0.21, 2),
            "total": round(total * 1.21, 2),
            "comercial": random.choice(users).get("name") or "Comercial",
            "notas": random.choice(NOTES),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.budgets.insert_one(budget)
        inserted += 1

    print(f"  ✅ {inserted} presupuestos creados")


# ---------------------------------------------------------------------------
# 5. SAT - Clientes e incidencias
# ---------------------------------------------------------------------------
async def seed_sat():
    print("\n=== 5. SAT (clientes + incidencias) ===")
    # Asegurar clientes SAT
    existing_clients = await db.sat_clients.count_documents({})
    if existing_clients < 50:
        client_names = [
            "BBVA Sucursal Bilbao", "Kutxabank Donostia", "Laboral Kutxa Vitoria",
            "Hotel Carlton Bilbao", "Hotel María Cristina", "El Corte Inglés Bilbao",
            "Eroski Hipermercado", "Mercadona Centro", "Iberdrola Torre",
            "Petronor Refinería", "Tubacex Llodio", "CAF Beasain",
            "Mondragón Corporación", "Universidad de Deusto", "EHU/UPV Leioa",
            "Hospital de Cruces", "Hospital Donostia", "Policlínica Gipuzkoa",
            "Ayuntamiento de Bilbao", "Ayuntamiento de San Sebastián",
            "Diputación de Bizkaia", "Gobierno Vasco Lakua", "Osakidetza",
            "Aeropuerto de Bilbao", "Puerto de Bilbao", "Metro Bilbao",
            "Euskotren Atotxa", "Renfe Abando", "ETB Bizkaia",
            "Caja Laboral Mondragón", "Fagor Industrial", "Orona Hernani",
            "ITP Aero Zamudio", "Sener Getxo", "Ibermática Donostia",
            "Vidrala Llodio", "Tubos Reunidos Amurrio", "Arcelor Sestao",
            "Bridgestone Basauri", "Mercedes-Benz Vitoria", "Michelin Vitoria",
        ]
        for i, name in enumerate(client_names):
            city_norm = normalize_city(name.split()[-1])
            coords = find_city_coords(city_norm) or CITIES[normalize_city("BILBAO")]
            lat, lng = jitter(*coords, 3.0)
            await db.sat_clients.insert_one({
                "id": f"satc_{i}",
                "cliente": name,
                "cif": f"B{random.randint(10000000, 99999999)}",
                "telefono": f"9{random.randint(40,99)} {random.randint(100,999)} {random.randint(100,999)}",
                "email": f"contacto@{name.lower().split()[0]}.com",
                "contacto": f"Sr/a. {random.choice(['García','López','Pérez','Sánchez','Etxeberria','Aguirre','Olabarria'])}",
                "direccion": random_address(city_norm),
                "lat": lat, "lng": lng,
                "contrato_mantenimiento": random.choice([True, False, True]),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
        print(f"  ✅ {len(client_names)} clientes SAT")

    clients = await db.sat_clients.find({}).to_list(length=200)
    users = await db.users.find({}).to_list(length=500)
    if not clients or not users:
        return

    existing_inc = await db.sat_incidents.count_documents({})
    print(f"  Incidencias existentes: {existing_inc}")

    inserted = 0
    for _ in range(150):
        c = random.choice(clients)
        u = random.choice(users)
        created = datetime.now(timezone.utc) - timedelta(days=random.randint(0, 90))
        status = random.choice(["abierta", "en_proceso", "programada", "resuelta", "cerrada"])
        cliente_name = c.get("cliente") or c.get("nombre") or "Cliente"
        incident = {
            "id": f"inc_{random.randint(100000,999999)}_{inserted}",
            "client_id": c["id"],
            "cliente": cliente_name,
            "client_name": cliente_name,
            "tipo": random.choice(INCIDENT_TYPES),
            "descripcion": random.choice(NOTES),
            "observaciones": random.choice(NOTES),
            "comentarios_sat": random.choice(NOTES),
            "prioridad": random.choices(INCIDENT_PRIORITIES, weights=[0.3, 0.4, 0.2, 0.1])[0],
            "status": status,
            "estado": status,
            "tecnico_id": u["id"],
            "tecnico_name": u.get("name") or u.get("email"),
            "telefono": c.get("telefono"),
            "created_at": created.isoformat(),
            "updated_at": (created + timedelta(hours=random.randint(1, 72))).isoformat(),
            "resolved_at": (created + timedelta(days=random.randint(1, 10))).isoformat() if status in ("resuelta", "cerrada") else None,
            "resolved_by": (u.get("name") or u.get("email")) if status in ("resuelta", "cerrada") else None,
            "scheduled_for": (created + timedelta(days=random.randint(1, 5))).isoformat() if status == "programada" else None,
            "history": [],
            "lat": c.get("lat"), "lng": c.get("lng"),
            "direccion": c.get("direccion"),
        }
        await db.sat_incidents.insert_one(incident)
        inserted += 1

    print(f"  ✅ {inserted} incidencias SAT")


# ---------------------------------------------------------------------------
# 6. Chats
# ---------------------------------------------------------------------------
async def seed_chats():
    print("\n=== 6. Chats ===")
    users = await db.users.find({}).to_list(length=500)
    projects = await db.materiales.find({}, {"id": 1, "cliente": 1}).to_list(length=10000)
    if len(users) < 2:
        return

    existing = await db.chats.count_documents({})
    print(f"  Chats existentes: {existing}")

    # 1) Chats por proyecto (asociados a un manager)
    inserted_chats = 0
    inserted_msgs = 0
    for p in random.sample(projects, min(60, len(projects))):
        members = random.sample(users, min(random.randint(2, 4), len(users)))
        cliente_name = (p.get('cliente') or 'Cliente')[:30]
        chat = {
            "id": f"chat_proj_{p['id']}",
            "type": "project",
            "project_id": p["id"],
            "name": f"Proyecto · {cliente_name}",
            "members": [u["id"] for u in members],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.chats.replace_one({"id": chat["id"]}, chat, upsert=True)
        inserted_chats += 1
        # mensajes
        n_msgs = random.randint(3, 15)
        base = datetime.now(timezone.utc) - timedelta(days=random.randint(0, 30))
        for j in range(n_msgs):
            u = random.choice(members)
            msg = {
                "id": f"msg_{chat['id']}_{j}",
                "chat_id": chat["id"],
                "user_id": u["id"],
                "user_name": u.get("name") or u.get("email"),
                "text": random.choice(CHAT_MESSAGES),
                "timestamp": (base + timedelta(minutes=j * random.randint(5, 60))).isoformat(),
            }
            await db.messages.insert_one(msg)
            inserted_msgs += 1

    # 2) Chats directos entre usuarios
    for _ in range(20):
        u1, u2 = random.sample(users, 2)
        cid = f"chat_dm_{min(u1['id'], u2['id'])}_{max(u1['id'], u2['id'])}"
        chat = {
            "id": cid, "type": "direct",
            "name": f"{u1.get('name','U1')} - {u2.get('name','U2')}",
            "members": [u1["id"], u2["id"]],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.chats.replace_one({"id": cid}, chat, upsert=True)
        inserted_chats += 1
        for j in range(random.randint(2, 10)):
            u = random.choice([u1, u2])
            msg = {
                "id": f"msg_{cid}_{j}",
                "chat_id": cid, "user_id": u["id"],
                "user_name": u.get("name") or u.get("email"),
                "text": random.choice(CHAT_MESSAGES),
                "timestamp": (datetime.now(timezone.utc) - timedelta(hours=random.randint(0, 240), minutes=j*random.randint(2,30))).isoformat(),
            }
            await db.messages.insert_one(msg)
            inserted_msgs += 1

    print(f"  ✅ Chats: {inserted_chats}, Mensajes: {inserted_msgs}")


# ---------------------------------------------------------------------------
# 7. Eventos de calendario
# ---------------------------------------------------------------------------
async def seed_events():
    print("\n=== 7. Eventos de calendario ===")
    users = await db.users.find({}).to_list(length=500)
    projects = await db.materiales.find({}, {"id": 1, "cliente": 1, "ubicacion": 1, "lat": 1, "lng": 1, "direccion": 1, "manager_id": 1}).to_list(length=10000)
    if not users:
        return

    # Limpiar eventos demo previos malformados
    deleted = await db.events.delete_many({"start_at": {"$exists": False}})
    print(f"  Eliminados {deleted.deleted_count} eventos malformados previos")

    inserted = 0
    titles = [
        "Visita técnica", "Instalación", "Mantenimiento", "Reunión con cliente",
        "Entrega de material", "Recogida de material", "Revisión", "Auditoría",
        "Formación", "Coordinación interna",
    ]
    statuses = ["in_progress", "completed", "pending_completion"]
    status_weights = [0.5, 0.35, 0.15]

    for _ in range(400):
        p = random.choice(projects)
        # 1-3 técnicos asignados
        n_assigned = random.randint(1, 3)
        assigned = random.sample(users, min(n_assigned, len(users)))
        manager = p.get("manager_id") or random.choice(users)["id"]
        creator = random.choice(users)

        # Fecha en rango -30 a +60 días
        when = datetime.now(timezone.utc) + timedelta(days=random.randint(-30, 60))
        # hora de inicio entre 7:00 y 18:00
        start = when.replace(hour=random.randint(7, 17), minute=random.choice([0, 15, 30, 45]), second=0, microsecond=0)
        duration_h = random.choice([1, 2, 2, 3, 4, 8])
        end = start + timedelta(hours=duration_h)

        title = f"{random.choice(titles)} · {(p.get('cliente') or 'Proyecto')[:25]}"

        ev = {
            "id": f"ev_{random.randint(100000,999999)}_{inserted}",
            "title": title,
            "start_at": start.isoformat(),
            "end_at": end.isoformat(),
            "description": random.choice(NOTES),
            "material_id": p["id"],
            "assigned_user_ids": [u["id"] for u in assigned],
            "manager_id": manager,
            "recurrence": None,
            "attachments": [],
            "created_by": creator["id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": random.choices(statuses, weights=status_weights)[0],
            "seguimiento": random.choice(NOTES) if random.random() < 0.3 else None,
            "hours": float(duration_h),
        }
        await db.events.insert_one(ev)
        inserted += 1
    print(f"  ✅ {inserted} eventos en calendario (esquema correcto)")


# ---------------------------------------------------------------------------
# 8. Documentos internos
# ---------------------------------------------------------------------------
async def seed_documents():
    print("\n=== 8. Documentos internos ===")
    users = await db.users.find({}).to_list(length=500)
    if not users:
        return

    docs_pool = [
        ("Manual de procedimientos 2025", "manual"),
        ("Plantilla de albarán", "plantilla"),
        ("Tarifas 2025", "tarifas"),
        ("Procedimiento de seguridad en obra", "procedimiento"),
        ("Acta de reunión semanal", "acta"),
        ("Política de calidad", "politica"),
        ("Certificado ISO 9001", "certificado"),
        ("Catálogo productos FAC", "catalogo"),
        ("Catálogo cerraduras Tesa", "catalogo"),
        ("Plantilla de presupuesto", "plantilla"),
        ("Plan de emergencia", "procedimiento"),
        ("Manual técnico Cisa", "manual"),
        ("Formulario de visita técnica", "plantilla"),
        ("Política de RGPD", "politica"),
        ("Plantilla de parte de trabajo", "plantilla"),
    ]
    inserted = 0
    for name, tipo in docs_pool:
        u = random.choice(users)
        await db.documentos.replace_one(
            {"name": name},
            {
                "id": f"doc_{random.randint(100000,999999)}_{inserted}",
                "name": name,
                "tipo": tipo,
                "size": random.randint(50_000, 5_000_000),
                "mime_type": "application/pdf",
                "uploaded_by": u["id"],
                "uploaded_by_name": u.get("name") or u.get("email"),
                "uploaded_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 200))).isoformat(),
                "url": f"/uploads/internos/{name.replace(' ', '_')}.pdf",
                "tags": random.sample(["interno", "público", "obligatorio", "informativo", "técnico"], 2),
            },
            upsert=True,
        )
        inserted += 1
    print(f"  ✅ {inserted} documentos internos")


# ---------------------------------------------------------------------------
# 9. Notificaciones
# ---------------------------------------------------------------------------
async def seed_notifications():
    print("\n=== 9. Notificaciones ===")
    users = await db.users.find({}).to_list(length=500)
    if not users:
        return

    msg_pool = [
        "Te han asignado un nuevo proyecto",
        "Tienes una visita técnica mañana",
        "Nuevo mensaje en el chat",
        "Presupuesto aceptado por el cliente",
        "Incidencia SAT urgente",
        "Recordatorio: parte de trabajo pendiente",
        "Documento actualizado",
        "Cambio de fechas en proyecto",
    ]
    inserted = 0
    for u in users:
        for _ in range(random.randint(2, 6)):
            await db.notifications.insert_one({
                "id": f"not_{random.randint(100000,999999)}_{inserted}",
                "user_id": u["id"],
                "title": random.choice(msg_pool),
                "body": random.choice(NOTES),
                "read": random.choice([True, False, False]),
                "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23))).isoformat(),
                "type": random.choice(["project", "chat", "sat", "system"]),
            })
            inserted += 1
    print(f"  ✅ {inserted} notificaciones")


async def seed_datos_financieros():
    """Genera datos financieros (ventas, costes, margenes) y eventos con horas."""
    print("\n📊 Generando datos financieros...")
    TIPOS = ["obra", "sat", "sat_remoto", "sat_desplazamiento", "sat_guardia_desplazamiento", "guardia", "sat_guardia_remoto", "desplazamiento_obra"]
    STATUSES = ["completed", "completed", "completed", "pending_completion"]
    projects = await db.materiales.find(
        {"project_status": {"$nin": ["anulado"]}},
        {"id": 1, "materiales": 1, "manager_id": 1}
    ).to_list(50000)

    precios = {
        "precio_obra": 35.5, "precio_sat": 40, "precio_sat_remoto": 45,
        "precio_sat_desplazamiento": 50, "precio_sat_guardia_desplazamiento": 65,
        "precio_guardia": 55, "precio_sat_guardia_remoto": 75, "precio_desplazamiento_obra": 72,
    }
    await db.config.update_one({"_id": "precios_mano_obra"}, {"$set": precios}, upsert=True)

    now = datetime.now(timezone.utc)
    total_h = 0.0
    updated = 0
    for p in projects:
        venta_mat = round(random.uniform(200, 8000), 2)
        venta_mo = round(random.uniform(300, 5000), 2)
        coste_prev_mat = round(venta_mat * random.uniform(0.4, 0.75), 2)
        coste_prev_mo = round(venta_mo * random.uniform(0.5, 0.8), 2)
        coste_real_mat = round(coste_prev_mat * random.uniform(0.7, 1.3), 2)
        venta_total = venta_mat + venta_mo
        coste_prev_total = coste_prev_mat + coste_prev_mo
        ben_inicial = round((venta_total - coste_prev_total) / venta_total * 100, 1) if venta_total > 0 else 0
        ben_real = round(random.uniform(-5, 50), 1)
        updated_at = datetime(random.randint(2024, 2026), random.randint(1, 12), random.randint(1, 28), tzinfo=timezone.utc)

        await db.materiales.update_one(
            {"id": p["id"]},
            {"$set": {
                "importe_venta_prev_materiales": venta_mat, "importe_venta_prev_mano_de_obra": venta_mo,
                "coste_prev_materiales": coste_prev_mat, "coste_prev_mano_de_obra": coste_prev_mo,
                "coste_real_materiales": coste_real_mat,
                "beneficio_inicial": ben_inicial, "beneficio_real": ben_real,
                "updated_at": updated_at.isoformat(),
            }}
        )

        name = (p.get("materiales") or "")[:25]
        hours = round(random.uniform(0.5, 8) * 2) / 2
        if hours < 0.5: hours = 0.5
        if hours > 8: hours = 8
        tipo = random.choice(TIPOS)
        status = random.choice(STATUSES)
        days_ago = random.randint(1, 90)
        start = (now - timedelta(days=days_ago)).replace(hour=8, minute=0, second=0)
        end = start + timedelta(hours=hours)
        ev = {
            "id": str(__import__("uuid").uuid4()),
            "title": name, "material_id": p["id"],
            "start_at": start.isoformat(), "end_at": end.isoformat(),
            "hours": hours, "tipo_mano_obra": tipo, "status": status,
            "seguimiento": "OK" if status == "completed" else "Pendiente",
            "manager_id": p.get("manager_id"), "created_by": "admin@isai.com",
            "created_at": now.isoformat(),
        }
        await db.events.insert_one(ev)
        if status in ("completed", "pending_completion"):
            await db.materiales.update_one({"id": p["id"]}, {"$inc": {"horas_imputadas": hours}})
            total_h += hours
        updated += 1
        if updated % 200 == 0:
            print(f"  {updated}/{len(projects)}...")

    print(f"  ✅ Financiero: {len(projects)} proyectos, {total_h:.0f}h imputadas, {len(precios)} precios configurados")


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
async def main():
    print("🚀 SEED FULL DATA - generando datos masivos de prueba")
    await geocode_all_projects()
    await enrich_projects()
    await seed_project_history()
    await seed_budgets()
    await seed_sat()
    await seed_datos_financieros()
    await seed_chats()
    await seed_events()
    await seed_documents()
    await seed_notifications()
    print("\n✅ COMPLETADO")


if __name__ == "__main__":
    asyncio.run(main())
