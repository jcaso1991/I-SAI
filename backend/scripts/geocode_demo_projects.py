"""
Asigna coordenadas lat/lng a los proyectos demo basado en su ubicación.
Usa coordenadas aproximadas conocidas para las direcciones de los proyectos seed.

Run: cd /app/backend && python -m scripts.geocode_demo_projects
"""
import asyncio, os, sys, re
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
from motor.motor_asyncio import AsyncIOMotorClient

# Coordenadas aproximadas de las direcciones usadas en el seed
COORDS = {
    "BBVA Sucursal Madrid Centro":       (40.4203, -3.7058),  # Gran Vía 23
    "Santander Plaza Cataluña":          (41.3870,  2.1700),  # Pl. Catalunya
    "Caixabank Sucursal Sevilla":        (37.3886, -5.9953),  # Av. Constitución
    "Edificio Castellana 81":            (40.4516, -3.6917),  # Pº Castellana 81
    "Bufete Pérez & Asociados":          (40.4262, -3.6850),  # Velázquez 50
    "Joyería Suárez":                    (40.4258, -3.6877),  # Serrano 56
    "Sabadell Tarragona":                (41.1189,  1.2456),  # Rambla Nova
    "ING Direct Valencia":               (39.4733, -0.3735),  # Av. Aragón
    "Hospital La Paz":                   (40.4783, -3.6889),  # Castellana 261
    "Universidad Complutense":           (40.4471, -3.7283),  # Ciudad Universitaria
    "Endesa Sede Central":               (40.4395, -3.6358),  # Ribera del Loira
    "Bankinter Bilbao":                  (43.2622, -2.9259),  # Gran Vía 47 Bilbao
    "Iberdrola Bilbao":                  (43.2640, -2.9347),  # Torre Iberdrola
    "Telefónica I+D":                    (40.4350, -3.6230),  # Distrito C
}


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "test_database")]

    updated = 0
    not_found = 0
    projects = await db.materiales.find({"demo": True}, {"_id": 0, "id": 1, "cliente": 1, "ubicacion": 1}).to_list(500)

    print(f"📍 Geocodificando {len(projects)} proyectos demo…\n")

    for p in projects:
        cliente = p.get("cliente", "")
        coords = COORDS.get(cliente)
        if not coords:
            # try partial match
            for k, v in COORDS.items():
                if k.lower() in cliente.lower() or cliente.lower() in k.lower():
                    coords = v
                    break
        if not coords:
            not_found += 1
            print(f"   ⚠️  Sin coords: {cliente}")
            continue
        lat, lng = coords
        await db.materiales.update_one(
            {"id": p["id"]},
            {"$set": {"lat": lat, "lng": lng}},
        )
        updated += 1
        print(f"   ✅ {cliente[:40]:40} → ({lat:.4f}, {lng:.4f})")

    print(f"\n{'='*60}")
    print(f"  Actualizados:  {updated}")
    print(f"  Sin match:     {not_found}")


if __name__ == "__main__":
    asyncio.run(main())
