"""
Script para poblar la base de datos con datos de prueba.
Ejecutar desde /backend: venv/bin/python seed_demo_full.py
"""
import os, random, uuid
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta, timezone
import asyncio

load_dotenv(".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

TIPOS = ["obra", "sat", "sat_remoto", "sat_desplazamiento", "sat_guardia_desplazamiento", "guardia", "sat_guardia_remoto", "desplazamiento_obra"]
STATUSES = ["completed", "completed", "completed", "pending_completion"]


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    print(f"Conectado a {DB_NAME}")

    # 1. Verificar que existe al menos un proyecto
    count = await db.materiales.count_documents({})
    if count == 0:
        print("No hay proyectos. Importa primero el Excel o ejecuta otro seed.")
        return
    print(f"Proyectos encontrados: {count}")

    # 2. Generar eventos para cada proyecto
    await db.events.delete_many({})
    await db.materiales.update_many({}, {"$set": {"horas_imputadas": 0}, "$unset": {"historial_horas": ""}})
    print("Datos anteriores limpiados")

    projects = await db.materiales.find(
        {"project_status": {"$nin": ["anulado"]}},
        {"id": 1, "materiales": 1, "cliente": 1, "manager_id": 1, "importe_venta_prev_materiales": 1, "coste_prev_materiales": 1}
    ).to_list(50000)

    now = datetime.now(timezone.utc)
    created = 0
    total_hours = 0.0

    for p in projects:
        # 3. Datos financieros aleatorios
        venta_mat = round(random.uniform(200, 8000), 2)
        venta_mo = round(random.uniform(300, 5000), 2)
        coste_prev_mat = round(venta_mat * random.uniform(0.4, 0.75), 2)
        coste_prev_mo = round(venta_mo * random.uniform(0.5, 0.8), 2)
        desviacion = random.uniform(-0.3, 0.5)
        coste_real_mat = round(coste_prev_mat * (1 + desviacion), 2)
        if coste_real_mat < 0:
            coste_real_mat = round(coste_prev_mat * 0.5, 2)

        await db.materiales.update_one(
            {"id": p["id"]},
            {"$set": {
                "importe_venta_prev_materiales": venta_mat,
                "importe_venta_prev_mano_de_obra": venta_mo,
                "coste_prev_materiales": coste_prev_mat,
                "coste_prev_mano_de_obra": coste_prev_mo,
                "coste_real_materiales": coste_real_mat,
            }}
        )

        # 4. Evento vinculado
        name = (p.get("materiales") or "")[:25]
        hours = round(random.uniform(0.5, 8) * 2) / 2
        if hours < 0.5: hours = 0.5
        if hours > 8: hours = 8
        tipo = random.choice(TIPOS)
        status = random.choice(STATUSES)
        days_ago = random.randint(1, 90)
        start = (now - timedelta(days=days_ago)).replace(hour=8, minute=0, second=0)
        end = start + timedelta(hours=hours)

        event = {
            "id": str(uuid.uuid4()),
            "title": f"{name}",
            "material_id": p["id"],
            "start_at": start.isoformat(),
            "end_at": end.isoformat(),
            "hours": hours,
            "tipo_mano_obra": tipo,
            "status": status,
            "seguimiento": "Trabajo OK" if status == "completed" else "Pendiente revision",
            "manager_id": p.get("manager_id"),
            "created_by": "admin@isai.com",
            "created_at": now.isoformat(),
        }
        await db.events.insert_one(event)

        # 5. Fecha aleatoria por año
        r = random.random()
        if r < 0.4: year = 2024
        elif r < 0.75: year = 2025
        else: year = 2026
        dt = datetime(year, random.randint(1, 12), random.randint(1, 28), tzinfo=timezone.utc)
        await db.materiales.update_one(
            {"id": p["id"]},
            {"$set": {"updated_at": dt.isoformat()}}
        )

        # 6. Acumular horas imputadas de eventos completados/pendientes
        if status in ("completed", "pending_completion"):
            await db.materiales.update_one(
                {"id": p["id"]},
                {"$inc": {"horas_imputadas": hours}}
            )
            total_hours += hours

        created += 1
        if created % 200 == 0:
            print(f"  {created}/{len(projects)}...")

    # 7. Configurar precios de mano de obra
    precios = {
        "precio_obra": 35.5, "precio_sat": 40, "precio_sat_remoto": 45,
        "precio_sat_desplazamiento": 50, "precio_sat_guardia_desplazamiento": 65,
        "precio_guardia": 55, "precio_sat_guardia_remoto": 75, "precio_desplazamiento_obra": 72,
    }
    await db.config.update_one(
        {"_id": "precios_mano_obra"},
        {"$set": precios},
        upsert=True
    )

    print(f"\nCompletado:")
    print(f"  Proyectos actualizados: {len(projects)}")
    print(f"  Eventos creados: {created}")
    print(f"  Horas imputadas totales: {total_hours:.0f}h")
    print(f"  Precios de mano de obra configurados: {len(precios)} tipos")
    print(f"  Datos distribuidos en 3 años (2024-2026)")
    client.close()


asyncio.run(main())
