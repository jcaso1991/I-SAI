"""
Enriches each demo project (materiales with demo=True) with:
    - 5-7 entries in project_history (assignment, status changes, comments…)
    - Recalculates horas_imputadas from linked events
    - Adds tecnicos[] and comercial/gestor if missing
    - Ensures attachments metadata in linked events

Run:
    cd /app/backend && python -m scripts.seed_project_detail
"""
import asyncio
import os
import sys
import uuid
import random
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "test_database")


def iso(dt: datetime) -> str:
    return dt.isoformat()


# Realistic, project-relevant history entries pool
HISTORY_TEMPLATES = [
    ("comercial",        "(vacío)",      "{comercial}",         "{author_gestor}"),
    ("gestor",           "(vacío)",      "{gestor}",            "{author_admin}"),
    ("project_status",   "pendiente",    "planificado",         "{author_gestor}"),
    ("fecha",            "(vacío)",      "{fecha}",             "{author_gestor}"),
    ("tecnicos",         "[]",           "[{tecnico1_id}]",     "{author_gestor}"),
    ("tecnicos",         "[{tecnico1_id}]", "[{tecnico1_id}, {tecnico2_id}]", "{author_gestor}"),
    ("comentarios",      "(vacío)",      "Cliente confirma instalación", "{author_gestor}"),
    ("horas_prev",       "(vacío)",      "{horas_prev}",        "{author_admin}"),
    ("project_status",   "planificado",  "en_curso",            "{author_tecnico}"),
    ("seguimiento",      "(vacío)",      "Llegamos a las 9:00", "{author_tecnico}"),
    ("comentarios",      "Cliente confirma instalación", "Material entregado en almacén OK", "{author_gestor}"),
    ("project_status",   "en_curso",     "terminado",           "{author_tecnico}"),
    ("total_parcial",    "(vacío)",      "{total}",             "{author_gestor}"),
    ("project_status",   "terminado",    "a_facturar",          "{author_admin}"),
]


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    print(f"📦 Conectado a {DB_NAME}\n")

    # Wipe previous demo history
    res = await db.project_history.delete_many({"demo": True})
    if res.deleted_count:
        print(f"🗑️  Borradas {res.deleted_count} entradas de historial demo\n")

    # Load demo users
    admin = await db.users.find_one({"email": "admin@materiales.com"}, {"_id": 0, "password": 0})
    gestor = await db.users.find_one({"email": "gestor@isai.com"}, {"_id": 0, "password": 0})
    t1 = await db.users.find_one({"email": "tecnico1@isai.com"}, {"_id": 0, "password": 0})
    t2 = await db.users.find_one({"email": "tecnico2@isai.com"}, {"_id": 0, "password": 0})

    authors = {
        "{author_admin}":   admin,
        "{author_gestor}":  gestor,
        "{author_tecnico}": t1 or t2,
    }

    # Iterate demo projects
    projects = await db.materiales.find({"demo": True}, {"_id": 0}).to_list(200)
    print(f"📂 Enriqueciendo {len(projects)} proyectos demo…\n")

    history_total = 0
    hours_recalc = 0

    for proj in projects:
        pid = proj["id"]
        cliente = proj.get("cliente", "—")

        # Build history (chronological, spread across last 30 days)
        start_dt = datetime.now(timezone.utc) - timedelta(days=30)
        entries_to_create = []

        # Pick first 7-10 templates depending on the project's stage
        status = proj.get("project_status", "pendiente")
        if status == "pendiente":
            n = 3
        elif status == "planificado":
            n = 6
        elif status == "anulado":
            n = 4
        elif status == "terminado":
            n = 10
        elif status == "a_facturar":
            n = 12
        else:
            n = 7

        templates = HISTORY_TEMPLATES[:n]
        if status == "anulado":
            templates = HISTORY_TEMPLATES[:3] + [("project_status", "pendiente", "anulado", "{author_admin}")]

        for i, (field, oldv, newv, author_key) in enumerate(templates):
            # Spread over last 30 days
            ts = start_dt + timedelta(days=(30 * (i / max(1, n))), hours=random.randint(0, 8))

            # Resolve placeholders
            def resolve(s: str) -> str:
                return (s or "")\
                    .replace("{comercial}", proj.get("comercial", "Mario López"))\
                    .replace("{gestor}", proj.get("manager_name", proj.get("gestor", "Carmen Ruiz")))\
                    .replace("{fecha}", proj.get("fecha") or "12/05/2026")\
                    .replace("{tecnico1_id}", (t1 or {}).get("id", "")[:8])\
                    .replace("{tecnico2_id}", (t2 or {}).get("id", "")[:8])\
                    .replace("{horas_prev}", proj.get("horas_prev") or "8")\
                    .replace("{total}", proj.get("total_parcial") or "1.200€")

            author = authors.get(author_key) or admin or {"name": "sistema", "id": "system"}

            entries_to_create.append({
                "id": str(uuid.uuid4()),
                "demo": True,
                "project_id": pid,
                "field": field,
                "old_value": resolve(oldv),
                "new_value": resolve(newv),
                "changed_by": author.get("name") or author.get("email") or "sistema",
                "changed_by_id": author.get("id") or "system",
                "created_at": iso(ts),
            })

        if entries_to_create:
            await db.project_history.insert_many(entries_to_create)
            history_total += len(entries_to_create)

        # ---------------- Recalculate horas_imputadas ----------------
        events = await db.events.find(
            {"material_id": pid, "status": {"$in": ["completed", "in_progress", "pending_completion"]}},
            {"_id": 0, "hours": 1, "start_at": 1, "end_at": 1},
        ).to_list(200)
        total = 0.0
        for ev in events:
            h = ev.get("hours")
            if h is None and ev.get("start_at") and ev.get("end_at"):
                try:
                    h = (datetime.fromisoformat(ev["end_at"]) - datetime.fromisoformat(ev["start_at"])).total_seconds() / 3600
                except Exception:
                    h = 0
            try:
                total += float(h or 0)
            except Exception:
                pass
        await db.materiales.update_one(
            {"id": pid},
            {"$set": {"horas_imputadas": round(total, 1)}},
        )
        hours_recalc += 1

        print(f"   ✅ {cliente[:45]:45}  ({status:12})  → {len(entries_to_create)} historial, {total:.1f} h imputadas")

    print(f"\n{'='*60}")
    print(f"✅ Enriquecimiento completado")
    print(f"{'='*60}")
    print(f"  Proyectos enriquecidos:   {len(projects)}")
    print(f"  Entradas historial:       {history_total}")
    print(f"  Proyectos con horas calc: {hours_recalc}")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
