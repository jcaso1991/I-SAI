"""
Script de generación de datos de prueba para I-SAI ERP.
Elimina todos los datos existentes y crea datos nuevos completos.
Ejecutar: python3 seed_datos_prueba.py
"""
import asyncio
import random
import uuid
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "isai_db"

# ─── Datos inventados ───
CLIENTES_DATA = [
    {"nombre": "Hotel Gran Vía Palace", "razon_social": "Hotel Gran Vía Palace SL", "direccion": "Gran Vía 45", "provincia": "Madrid", "poblacion": "Madrid", "representante": "Carlos Mendoza", "telefono": "912345678", "email": "carlos@granviapalace.com", "mantenimiento_contratado": True, "tipo_mantenimiento": "Anual", "alta_mantenimiento": "2025-03-15", "numero_revisiones": 4, "salto_ks_activo": True, "salto_ks_tipo_renovacion": "Anual", "salto_ks_fecha_renovacion": "2026-09-01"},
    {"nombre": "Centro Comercial Las Rosas", "razon_social": "CC Las Rosas SA", "direccion": "Av. de la Constitución 120", "provincia": "Barcelona", "poblacion": "Hospitalet", "representante": "María López", "telefono": "932345678", "email": "maria@lasrosas.com", "mantenimiento_contratado": True, "tipo_mantenimiento": "Trimestral", "alta_mantenimiento": "2025-06-01", "numero_revisiones": 4, "salto_ks_activo": False},
    {"nombre": "Oficinas Torre Picasso", "razon_social": "Torre Picasso SA", "direccion": "Plaza Pablo Ruiz Picasso 1", "provincia": "Madrid", "poblacion": "Madrid", "representante": "Ana García", "telefono": "913456789", "email": "ana@torrepicasso.com", "mantenimiento_contratado": True, "tipo_mantenimiento": "Semestral", "alta_mantenimiento": "2025-01-20", "numero_revisiones": 2},
    {"nombre": "Residencial Los Pinos", "razon_social": "Comunidad Los Pinos", "direccion": "Calle Pino 5", "provincia": "Valencia", "poblacion": "Valencia", "representante": "Pedro Sánchez", "telefono": "962345678", "email": "pedro@lospinos.com", "mantenimiento_contratado": False},
    {"nombre": "Hospital Universitario Norte", "razon_social": "Hospital Norte SL", "direccion": "Av. de la Salud 88", "provincia": "Sevilla", "poblacion": "Sevilla", "representante": "Elena Ruiz", "telefono": "952345678", "email": "elena@hospitalnorte.com", "mantenimiento_contratado": True, "tipo_mantenimiento": "A medida", "alta_mantenimiento": "2025-04-10", "numero_revisiones": 6, "salto_ks_activo": True, "salto_ks_tipo_renovacion": "Anual", "salto_ks_fecha_renovacion": "2027-01-15"},
    {"nombre": "Fábrica Eurotech", "razon_social": "Eurotech Manufacturing SL", "direccion": "Polígono Industrial 42, Nave 7", "provincia": "Bilbao", "poblacion": "Barakaldo", "representante": "Javier Ortiz", "telefono": "942345678", "email": "javier@eurotech.es", "mantenimiento_contratado": True, "tipo_mantenimiento": "Anual", "alta_mantenimiento": "2025-08-22", "numero_revisiones": 4},
    {"nombre": "Colegio Santa María", "razon_social": "Colegio Santa María", "direccion": "Calle Mayor 12", "provincia": "Zaragoza", "poblacion": "Zaragoza", "representante": "Carmen Díez", "telefono": "972345678", "email": "carmen@santamaria.edu", "mantenimiento_contratado": False, "salto_ks_activo": True, "salto_ks_tipo_renovacion": "Anual", "salto_ks_fecha_renovacion": "2026-12-20"},
    {"nombre": "Almacenes Surplus", "razon_social": "Surplus Logística SL", "direccion": "Calle Comercio 99", "provincia": "Murcia", "poblacion": "Murcia", "representante": "Miguel Torres", "telefono": "962345679", "email": "miguel@surpluslog.com", "mantenimiento_contratado": False},
]

NOMBRES_PROYECTOS = [
    "Instalación control accesos Salto", "CCTV perimetral 32 cámaras", "Sistema anti-intrusión",
    "Migración cerraduras XS4", "Cableado estructurado CAT6", "Central incendios analógica",
    "Megafonía y evacuación", "Control presencia parking", "Reforma CCTV existente",
    "Nueva sede corporativa", "Sucursal zona norte", "Ampliación almacén",
    "Sistema control horario", "Video porteros IP", "Detección gases cocina",
    "Portero automático digital", "Circuito cerrado nave", "Sensores perimetrales IR",
    "Integración Salto + CCTV", "Kit accesos emergencia",
]

TECNICOS_NOMBRES = ["David Martín", "Laura Gómez", "Sergio Fernández", "Patricia Gil", "Roberto Castro"]
COMERCIALES_NOMBRES = ["Iker Santos", "Nuria Vega"]
GESTORES_NOMBRES = ["Pablo Alonso", "Sandra Torres"]

MATERIALES_EQUIPOS = [
    "Cilindro electrónico Salto XS4", "Lector de muro Salto XS4", "Cerradura electrónica Salto XS4",
    "Escudo electrónico Salto XS4", "Mini cilindro Salto", "Tarjeta MIFARE 1K",
    "Llavero MIFARE", "Controlador Salto CU5000", "Fuente alimentación 12V",
    "Cable UTP CAT6", "Cámara IP Hikvision 4K", "NVR 32 canales",
    "Detector IR pasivo", "Central incendios NOTIFIER", "Sirena exterior IP65",
    "Sensor magnético puerta", "Pulsador emergencia", "Amplificador megafonía 120W",
]

async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print("🗑️  Eliminando datos existentes...")
    collections = ["users", "materiales", "events", "clientes", "fichajes", "budgets",
                   "chats", "messages", "notifications", "sat_incidents", "vacaciones",
                   "project_history", "notas", "certificaciones", "plans", "stamps", "config"]
    for coll in collections:
        try:
            await db[coll].delete_many({})
        except:
            pass

    # Mantener admin
    admin_id = str(uuid.uuid4())
    admin_pw = bcrypt.hashpw("Admin1234".encode(), bcrypt.gensalt()).decode()
    await db.users.insert_one({
        "id": admin_id, "email": "admin@isai.com", "name": "Admin",
        "password": admin_pw, "role": "admin", "color": "#3B82F6",
        "role_id": "admin-role", "role_name": "Administrador",
        "permissions": [], "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # Crear usuarios
    users = [{"id": admin_id, "name": "Admin", "email": "admin@isai.com", "role": "admin"}]
    
    ALL_USERS = [
        # Gestores
        {"name": "Pablo Alonso", "email": "pablo.alonso@isai.com", "role": "gestor"},
        {"name": "Sandra Torres", "email": "sandra.torres@isai.com", "role": "gestor"},
        {"name": "Marta Herrera", "email": "marta.herrera@isai.com", "role": "gestor"},
        {"name": "Alberto Ruiz", "email": "alberto.ruiz@isai.com", "role": "gestor"},
        {"name": "Cristina Ibáñez", "email": "cristina.ibanez@isai.com", "role": "gestor"},
        # Técnicos
        {"name": "David Martín", "email": "david.martin@isai.com", "role": "tecnico"},
        {"name": "Laura Gómez", "email": "laura.gomez@isai.com", "role": "tecnico"},
        {"name": "Sergio Fernández", "email": "sergio.fernandez@isai.com", "role": "tecnico"},
        {"name": "Patricia Gil", "email": "patricia.gil@isai.com", "role": "tecnico"},
        {"name": "Roberto Castro", "email": "roberto.castro@isai.com", "role": "tecnico"},
        {"name": "Rubén Vargas", "email": "ruben.vargas@isai.com", "role": "tecnico"},
        {"name": "Andrea Molina", "email": "andrea.molina@isai.com", "role": "tecnico"},
        {"name": "Hugo Delgado", "email": "hugo.delgado@isai.com", "role": "tecnico"},
        {"name": "Claudia Reyes", "email": "claudia.reyes@isai.com", "role": "tecnico"},
        {"name": "Mateo Campos", "email": "mateo.campos@isai.com", "role": "tecnico"},
        {"name": "Valeria Paredes", "email": "valeria.paredes@isai.com", "role": "tecnico"},
        {"name": "Diego Flores", "email": "diego.flores@isai.com", "role": "tecnico"},
        # Comerciales
        {"name": "Iker Santos", "email": "iker.santos@isai.com", "role": "comercial"},
        {"name": "Nuria Vega", "email": "nuria.vega@isai.com", "role": "comercial"},
        {"name": "Lorena Bustos", "email": "lorena.bustos@isai.com", "role": "comercial"},
        {"name": "Andrés Mora", "email": "andres.mora@isai.com", "role": "comercial"},
        # SAT
        {"name": "Rocío Silva", "email": "rocio.silva@isai.com", "role": "sat"},
        {"name": "Gonzalo Peña", "email": "gonzalo.pena@isai.com", "role": "sat"},
        {"name": "Isabel Duarte", "email": "isabel.duarte@isai.com", "role": "sat"},
    ]

    for i, u in enumerate(ALL_USERS):
        uid = str(uuid.uuid4())
        pw = bcrypt.hashpw("Demo1234".encode(), bcrypt.gensalt()).decode()
        color = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16", "#06B6D4", "#D946EF", "#EAB308", "#0EA5E9", "#A855F7"][i % 15]
        if u["role"] == "tecnico":
            perms = ["proyectos.view", "calendario.view", "calendario.edit", "planos.view", "planos.edit", "chat.view", "chat.edit", "fichajes.view", "fichajes.edit_own", "certificaciones.view", "certificaciones.edit", "notas.view", "documentos.manage"]
        elif u["role"] == "comercial":
            perms = ["presupuestos.view", "presupuestos.edit", "presupuestos.export", "proyectos.view", "chat.view", "chat.edit", "fichajes.view", "fichajes.edit_own"]
        elif u["role"] == "gestor":
            perms = ["proyectos.view", "proyectos.edit", "calendario.view", "calendario.edit", "calendario.assign", "planos.view", "planos.edit", "presupuestos.view", "presupuestos.edit", "sat.view", "sat.edit", "chat.view", "chat.edit", "dashboard.view", "fichajes.view", "fichajes.manage", "fichajes.edit_own", "clientes.view", "clientes.edit", "users.manage", "notas.view", "documentos.manage", "certificaciones.view", "certificaciones.edit"]
        elif u["role"] == "sat":
            perms = ["sat.view", "sat.edit", "sat.export", "chat.view", "chat.edit", "fichajes.view", "fichajes.edit_own"]
        else:
            perms = []
        await db.users.insert_one({
            "id": uid, "email": u["email"], "name": u["name"], "password": pw,
            "role": u["role"], "color": color, "permissions": perms,
        })
        users.append({"id": uid, "name": u["name"], "email": u["email"], "role": u["role"]})

    admin_user = users[0]
    tecnicos = [u for u in users if u["role"] == "tecnico"]
    comerciales = [u for u in users if u["role"] == "comercial"]
    gestores = [u for u in users if u["role"] == "gestor"]
    tecnicos_ids = [u["id"] for u in tecnicos]
    gestores_ids = [u["id"] for u in gestores]

    print(f"  ✅ {len(users)} usuarios (admin + {len(tecnicos)} técnicos + {len(comerciales)} comerciales + {len(gestores)} gestores)")

    # Crear clientes
    clientes_creados = []
    for data in CLIENTES_DATA:
        cid = str(uuid.uuid4())
        doc = {**data, "id": cid, "tipo_documento_id": "NIF",
               "numero_documento": f"{random.randint(10000000, 99999999)}{random.choice('ABCDEFGHJNPQRSUVW')}",
               "direcciones": [{"calle": data["direccion"], "provincia": data["provincia"], "poblacion": data["poblacion"]}],
               "created_at": datetime.now(timezone.utc).isoformat(), "materiales_instalados": [], "documentos": [], "incidencias": [], "mantenimientos": []}
        await db.clientes.insert_one(doc)
        clientes_creados.append(doc)

    print(f"  ✅ {len(clientes_creados)} clientes")

    # Crear proyectos con datos financieros
    proyectos_creados = []
    STATUSES = ["pendiente", "planificado", "a_facturar", "facturado", "terminado", "terminado", "terminado", "planificado", "a_facturar", "facturado"]
    ahora = datetime.now(timezone.utc)
    todos_tecnicos = tecnicos_ids
    todos_gestores = gestores_ids

    for i, nombre in enumerate(NOMBRES_PROYECTOS):
        pid = str(uuid.uuid4())
        cliente = random.choice(clientes_creados)
        status = STATUSES[i % len(STATUSES)]
        tec_asignados = random.sample(todos_tecnicos, min(3, random.randint(1, 3)))
        gestor = random.choice(todos_gestores)

        # Datos financieros variados
        venta_mat = round(random.uniform(2000, 45000), 2)
        venta_mo = round(random.uniform(1000, 25000), 2)
        coste_mat = round(random.uniform(1500, 50000), 2)
        coste_mo = round(random.uniform(800, 28000), 2)

        # Algunos proyectos con pérdidas (coste > venta)
        if random.random() < 0.2:
            coste_mat = round(venta_mat * random.uniform(1.1, 2.0), 2)
        if random.random() < 0.15:
            coste_mo = round(venta_mo * random.uniform(1.1, 1.8), 2)

        horas_prev = random.randint(8, 200)
        horas_imputadas = random.randint(0, horas_prev) if status in ("facturado", "terminado") else random.randint(0, horas_prev // 2)
        ingreso_fact = round((venta_mat + venta_mo) * random.uniform(0.3, 1.0), 2) if status in ("facturado", "terminado") else 0

        # Beneficio
        beneficio_inicial = round(venta_mat + venta_mo - coste_mat - coste_mo, 2)
        coste_real_mat = round(coste_mat * random.uniform(0.85, 1.25), 2) if status in ("facturado", "terminado") else None
        coste_real_mo = round(coste_mo * random.uniform(0.8, 1.3), 2) if status in ("facturado", "terminado") else None

        doc = {
            "id": pid, "row_index": i + 1,
            "materiales": nombre, "cliente": cliente["nombre"],
            "ubicacion": cliente["direccion"], "horas_prev": str(horas_prev),
            "comercial": random.choice(comerciales)["name"],
            "gestor": next((u["name"] for u in gestores if u["id"] == gestor), "Pablo Alonso"),
            "fecha": (ahora - timedelta(days=random.randint(30, 365))).strftime("%Y-%m-%d"),
            "entrega_recogida": random.choice(["Entrega", "Recogida", None]),
            "total_parcial": random.choice(["TOTAL", "PARCIAL", None]),
            "manager_id": gestor, "manager_name": next((u["name"] for u in gestores if u["id"] == gestor), None),
            "project_status": status,
            "horas_imputadas": horas_imputadas,
            "importe_venta_prev_materiales": venta_mat,
            "importe_venta_prev_mano_de_obra": venta_mo,
            "coste_prev_materiales": coste_mat,
            "coste_prev_mano_de_obra": coste_mo,
            "coste_prev_actualizado_materiales": round(coste_mat * random.uniform(0.9, 1.15), 2),
            "coste_prev_actualizado_mano_de_obra": round(coste_mo * random.uniform(0.9, 1.1), 2),
            "coste_real_materiales": coste_real_mat,
            "coste_real_mano_de_obra": coste_real_mo,
            "beneficio_inicial": beneficio_inicial,
            "beneficio_real": round((venta_mat + venta_mo - (coste_real_mat or coste_mat) - (coste_real_mo or coste_mo)), 2) if coste_real_mat else None,
            "ingreso_facturado": ingreso_fact,
            "pedido_realizado": random.choice([True, False]),
            "fecha_entrega_material": (ahora - timedelta(days=random.randint(5, 60))).strftime("%Y-%m-%d") if status in ("terminado", "facturado", "a_facturar") else None,
            "numero_pedido": f"PED-{random.randint(1000, 9999)}" if status in ("terminado", "facturado") else None,
            "fecha_prevista_planificacion": (ahora + timedelta(days=random.randint(5, 90))).strftime("%Y-%m-%d") if status in ("pendiente", "planificado") else None,
            "fecha_prevista_facturacion": (ahora + timedelta(days=random.randint(30, 120))).strftime("%Y-%m-%d") if status in ("planificado", "pendiente", "a_facturar") else None,
            "attachments": [], "historial_horas": [], "sync_status": "synced",
            "created_at": (ahora - timedelta(days=random.randint(60, 365))).isoformat(),
        }

        # Materiales del proyecto
        num_mats = random.randint(2, 6)
        mats = []
        for j in range(num_mats):
            eq = random.choice(MATERIALES_EQUIPOS)
            prev = random.randint(1, 50)
            inst = random.randint(0, prev) if status in ("terminado", "facturado") else 0
            mats.append({"id": str(uuid.uuid4()), "material": eq, "cantidad_prevista": prev, "cantidad_instalada": inst, "fecha_instalacion": (ahora - timedelta(days=random.randint(10, 90))).strftime("%Y-%m-%d") if inst > 0 else None})
        doc["materiales_proyecto"] = mats

        # Copiar a cliente los materiales instalados si está terminado
        if status == "terminado":
            mats_cli = []
            for m in mats:
                if m["cantidad_instalada"] > 0:
                    mats_cli.append({"material": m["material"], "cantidad": m["cantidad_instalada"], "fecha_terminacion": doc["fecha"] or ahora.strftime("%Y-%m-%d"), "proyecto_id": pid, "proyecto_nombre": nombre})
            if mats_cli:
                cli_doc = await db.clientes.find_one({"id": cliente["id"]})
                if cli_doc:
                    actuales = list(cli_doc.get("materiales_instalados") or [])
                    await db.clientes.update_one({"id": cliente["id"]}, {"$set": {"materiales_instalados": actuales + mats_cli}})

        await db.materiales.insert_one(doc)
        proyectos_creados.append(doc)

    print(f"  ✅ {len(proyectos_creados)} proyectos (con datos financieros y materiales)")

    # Crear eventos
    eventos_creados = 0
    for proy in proyectos_creados:
        num_events = random.randint(1, 5)
        for _ in range(num_events):
            eid = str(uuid.uuid4())
            dia = ahora - timedelta(days=random.randint(0, 90)) if proy["project_status"] in ("terminado", "facturado") else ahora + timedelta(days=random.randint(0, 60))
            start = dia.replace(hour=random.randint(8, 12), minute=0, second=0, microsecond=0)
            end = start + timedelta(hours=random.randint(2, 6))
            status = "completed" if proy["project_status"] in ("terminado", "facturado") else random.choice(["in_progress", "pending_completion"])
            horas = random.randint(2, 8)
            tipo_mo = random.choice(["obra", "desplazamiento_obra", "sat"])

            # Materiales instalados
            mats_inst = []
            mats_proy = proy.get("materiales_proyecto") or []
            for m in random.sample(mats_proy, min(2, len(mats_proy))):
                if status == "completed" and random.random() < 0.7:
                    mats_inst.append({"material_proyecto_id": m["id"], "cantidad": random.randint(1, min(10, int(m["cantidad_prevista"]))), "instalado": True})
                else:
                    mats_inst.append({"material_proyecto_id": m["id"], "cantidad": 0, "instalado": False})

            event_doc = {
                "id": eid, "title": f"{proy['materiales']} - {random.choice(['Instalación', 'Revisión', 'Configuración', 'Pruebas', 'Puesta en marcha'])}",
                "start_at": start.isoformat(), "end_at": end.isoformat(),
                "description": f"Evento del proyecto {proy['materiales']}",
                "material_id": proy["id"],
                "assigned_user_ids": random.sample(todos_tecnicos, min(2, random.randint(1, 2))),
                "manager_id": proy["manager_id"],
                "hours": horas, "tipo_mano_obra": tipo_mo,
                "status": status, "seguimiento": "Trabajo realizado correctamente" if status == "completed" else "",
                "materiales_instalados": mats_inst,
                "attachments": [], "created_by": admin_user["email"],
                "created_at": ahora.isoformat(), "deleted": False,
            }
            await db.events.insert_one(event_doc)
            eventos_creados += 1

    print(f"  ✅ {eventos_creados} eventos de calendario")

    # Crear fichajes
    fichajes_creados = 0
    for u in [admin_user] + tecnicos + comerciales + gestores:
        for dia_offset in range(random.randint(15, 45)):
            dia = ahora - timedelta(days=dia_offset)
            if dia.weekday() >= 5 and random.random() < 0.8:
                continue  # Saltar fines de semana
            entrada_hora = random.randint(7, 10)
            entrada = dia.replace(hour=entrada_hora, minute=random.randint(0, 59), second=0, microsecond=0)
            salida = entrada + timedelta(hours=random.randint(4, 10))
            # Pausa
            if random.random() < 0.6:
                pausa_start = entrada + timedelta(hours=random.randint(2, 5))
                pausa_end = pausa_start + timedelta(minutes=random.randint(15, 60))
                # Fichaje pausa
                await db.fichajes.insert_one({
                    "id": str(uuid.uuid4()), "user_id": u["id"],
                    "entrada": pausa_start.isoformat(), "salida": pausa_end.isoformat(),
                    "tipo": "pausa", "deleted": False,
                })
            # Fichaje principal
            await db.fichajes.insert_one({
                "id": str(uuid.uuid4()), "user_id": u["id"],
                "entrada": entrada.isoformat(), "salida": salida.isoformat(),
                "tipo": "entrada", "deleted": False,
            })
            fichajes_creados += 1

    print(f"  ✅ {fichajes_creados} fichajes")

    # Crear vacaciones
    vac_creadas = 0
    for u in [admin_user] + tecnicos[:3]:
        for _ in range(random.randint(1, 3)):
            dia = ahora + timedelta(days=random.randint(30, 180))
            fin = dia + timedelta(days=random.randint(3, 10))
            estado = random.choice(["pendiente", "aprobada", "aprobada"])
            await db.vacaciones.insert_one({
                "id": str(uuid.uuid4()), "user_id": u["id"],
                "fecha_inicio": dia.strftime("%Y-%m-%d"), "fecha_fin": fin.strftime("%Y-%m-%d"),
                "tipo": random.choice(["vacaciones", "vacaciones", "asuntos_propios"]),
                "motivo": "Descanso anual" if random.random() < 0.7 else "Asuntos personales",
                "estado": estado, "created_at": ahora.isoformat(),
            })
            vac_creadas += 1

    print(f"  ✅ {vac_creadas} solicitudes de vacaciones")

    # Crear incidencias SAT
    sat_creadas = 0
    for _ in range(25):
        sid = str(uuid.uuid4())
        cliente = random.choice(clientes_creados)
        status = random.choice(["pendiente", "agendada", "resuelta", "resuelta"])
        await db.sat_incidents.insert_one({
            "id": sid, "client_id": cliente["id"], "cliente": cliente["nombre"],
            "observaciones": random.choice(["Fuga de agua en baño", "Puerta no cierra correctamente", "Cámara sin señal", "Alarma saltó sin motivo", "Aire acondicionado no enciende", "Sensor magnético averiado", "Cerrojo atascado", "Lector de tarjetas no reconoce"]),
            "status": status, "created_at": (ahora - timedelta(days=random.randint(5, 120))).isoformat(),
            "assigned_user_ids": [random.choice(todos_tecnicos)] if status != "pendiente" else [],
        })
        sat_creadas += 1

    print(f"  ✅ {sat_creadas} incidencias SAT")

    # Crear presupuestos
    pres_creados = 0
    for _ in range(12):
        bid = str(uuid.uuid4())
        proy = random.choice(proyectos_creados)
        estados = ["pendiente", "en_revision", "enviado", "aceptado"]
        status = random.choice(estados)
        await db.budgets.insert_one({
            "id": bid, "n_proyecto": proy.get("materiales", "PROY-" + str(random.randint(1000, 9999)))[:30],
            "cliente": proy["cliente"], "material_id": proy["id"],
            "nombre_instalacion": proy["cliente"],
            "direccion": proy["ubicacion"],
            "contacto_1": f"{random.randint(600000000, 699999999)}",
            "status": status, "created_at": ahora.isoformat(),
            "equipos": [{"elemento": random.choice(MATERIALES_EQUIPOS), "cantidad": str(random.randint(1, 20)), "ubicacion": "Entrada principal"} for _ in range(random.randint(1, 5))],
        })
        pres_creados += 1

    print(f"  ✅ {pres_creados} presupuestos")

    # Crear notas
    notas_creadas = 0
    for u in [admin_user] + tecnicos[:2]:
        for _ in range(random.randint(3, 8)):
            nid = str(uuid.uuid4())
            prioridad = random.choice(["baja", "media", "alta", "urgente"])
            tags = random.sample(["instalación", "pendiente", "revisar", "urgente", "material", "cliente", "factura"], random.randint(1, 3))
            await db.notas.insert_one({
                "id": nid, "user_id": u["id"],
                "titulo": random.choice(["Revisar pedido materiales", "Llamar cliente", "Actualizar presupuesto", "Comprobar stock", "Enviar factura", "Coordinar instalación", "Pruebas sistema", "Documentación proyecto", "Seguimiento incidencia", "Planificar visita"]),
                "contenido": "Nota de prueba generada automáticamente para verificar el módulo de notas.",
                "fecha": (ahora + timedelta(days=random.randint(-5, 15))).strftime("%Y-%m-%d"),
                "prioridad": prioridad, "tags": tags, "color": random.choice(["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"]),
                "marcada": random.random() < 0.3, "pinned": random.random() < 0.15,
                "created_at": ahora.isoformat(),
            })
            notas_creadas += 1

    print(f"  ✅ {notas_creadas} notas")

    # Crear planos
    planos_creados = 0
    for _ in range(5):
        plid = str(uuid.uuid4())
        proy = random.choice(proyectos_creados)
        await db.plans.insert_one({
            "id": plid, "title": f"Plano {proy['materiales'][:30]}",
            "material_id": proy["id"],
            "data": {"shapes": [], "stamps": []},
            "created_at": ahora.isoformat(), "created_by": admin_user["email"],
        })
        planos_creados += 1

    print(f"  ✅ {planos_creados} planos")

    # Crear certificaciones
    cert_creadas = 0
    for proy in random.sample(proyectos_creados, min(8, len(proyectos_creados))):
        certid = str(uuid.uuid4())
        lineas = []
        for _ in range(random.randint(2, 6)):
            eq = random.choice(MATERIALES_EQUIPOS)
            alc = random.randint(1, 50)
            ej = random.randint(0, alc)
            lineas.append({"descripcion": eq, "cantidad_alcance": alc, "precio_alcance": round(random.uniform(50, 500), 2), "cantidad_ejecutado": ej, "precio_ejecutado": round(random.uniform(50, 500), 2)})
        await db.certificaciones.insert_one({
            "id": certid, "material_id": proy["id"], "nombre": f"Certificación {proy['materiales'][:20]}",
            "lineas": lineas, "created_at": ahora.isoformat(),
            "fecha_certificacion": ahora.strftime("%Y-%m-%d"),
        })
        cert_creadas += 1

    print(f"  ✅ {cert_creadas} certificaciones")

    # Config fichajes
    await db.config.update_one({"_id": "fichajes"}, {"$set": {
        "festivos": ["2026-01-01", "2026-01-06", "2026-04-17", "2026-05-01", "2026-08-15", "2026-10-12", "2026-11-01", "2026-12-06", "2026-12-08", "2026-12-25"],
        "hora_entrada": "08:00", "hora_salida": "17:00",
    }}, upsert=True)

    print(f"  ✅ Configuración de fichajes")

    client.close()
    print(f"\n🎉 {len(CLIENTES_DATA)} clientes | {len(NOMBRES_PROYECTOS)} proyectos | {eventos_creados} eventos | {fichajes_creados} fichajes")
    print(f"   {vac_creadas} vacaciones | {sat_creadas} SAT | {pres_creados} presupuestos | {notas_creadas} notas | {planos_creados} planos | {cert_creadas} certificaciones")
    print(f"   Login: admin@isai.com / Admin1234 | Técnicos: david.martin@isai.com / Demo1234")

if __name__ == "__main__":
    asyncio.run(main())
