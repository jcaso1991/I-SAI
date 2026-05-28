"""
Scraping de detalles de variantes Salto Systems.
Carga las familias existentes de salto_products.json y obtiene
datos detallados (features, características, acabados, certificaciones)
de cada variante individual via page-data.json.
"""
import subprocess
import re
import json
import time
import os
from html import unescape

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "..", "salto_products.json")

def fetch_json(url: str) -> dict | None:
    result = subprocess.run(
        ["curl", "-s", "-L", "--max-time", "15", url],
        capture_output=True, text=True
    )
    if result.returncode != 0 or not result.stdout.strip():
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return None

def strip_html(text) -> str:
    if not text:
        return ""
    if isinstance(text, dict):
        text = text.get("processed", "") or text.get("value", "") or str(text)
    text = unescape(str(text))
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def extract_image(relationships: dict, field: str) -> str:
    try:
        img_data = relationships.get(field, {})
        sizes = img_data.get("sizes", [])
        for s in sizes:
            for key in ["xl", "l", "m"]:
                if s.get(key):
                    return s[key]
        uri = img_data.get("uri", {}).get("url", "")
        if uri:
            return f"https://cms.saltosystems.com{uri}"
    except Exception:
        pass
    return ""

def process_product_page(page_data: dict) -> dict | None:
    try:
        p = page_data.get("result", {}).get("data", {}).get("product", {})
        if not p or not p.get("title"):
            return None
        rels = p.get("relationships", {})

        finishes = []
        for f in rels.get("finishes", []) or []:
            try:
                img_url = extract_image(f.get("relationships", {}), "imageSrc")
                if not img_url:
                    raw = f.get("relationships", {}).get("imageSrc", {}).get("uri", {}).get("url", "")
                    if raw:
                        img_url = "https://cms.saltosystems.com" + raw
            except:
                img_url = ""
            finishes.append({"name": f.get("name", ""), "image": img_url})

        downloads = []
        for key, label in [
            ("downloadDatasheetSrc", "Ficha técnica"),
            ("downloadTechnicalSrc", "Ficha instalación"),
            ("downloadCertificationsSrc", "Certificaciones"),
        ]:
            for item in (rels.get(key) or []):
                uri = ""
                try:
                    uri = item.get("uri", {}).get("url", "")
                    if uri:
                        uri = "https://cms.saltosystems.com" + uri
                except:
                    pass
                if uri:
                    downloads.append({"label": label, "url": uri})

        return {
            "title": p.get("title", ""),
            "short_description": strip_html(p.get("shortDescription", "")),
            "features": strip_html(p.get("features", "")),
            "tech_characteristics": strip_html(p.get("techCharacteristics", "")),
            "image": extract_image(rels, "descImageSrc") or
                     extract_image(rels, "finishDefaultImageSrc"),
            "platforms": [x.get("title", "") for x in (rels.get("techPlatforms") or []) if x.get("title")],
            "carriers": [x.get("title", "") for x in (rels.get("carriers") or []) if x.get("title")],
            "wireless_tech": [x.get("title", "") for x in (rels.get("wirelessTech") or []) if x.get("title")],
            "certifications": [x.get("title", "") for x in (rels.get("certifications") or []) if x.get("title")],
            "finishes": finishes,
            "downloads": downloads,
        }
    except Exception as e:
        print(f"    Error procesando: {e}")
        return None

def slug_to_url(slug: str) -> str:
    slug = slug.strip("/")
    slug = re.sub(r'^(products|productos)/', 'productos/', slug)
    return f"https://saltosystems.com/page-data/es-es/{slug}/page-data.json"

def main():
    existing_file = os.path.join(os.path.dirname(__file__), "..", "salto_products.json")
    if not os.path.exists(existing_file):
        print("salto_products.json no encontrado")
        return

    with open(existing_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    families = data.get("families", [])
    if not families:
        print("No hay familias en el JSON")
        return

    total_variants = sum(len(f.get("products", [])) for f in families)
    print(f"Cargadas {len(families)} familias con {total_variants} variantes")
    print("Obteniendo detalles de cada variante...\n")

    variant_count = 0
    updated = 0
    for family in families:
        for v in family.get("products", []):
            variant_count += 1
            slug = v.get("slug", "")
            if not slug:
                continue

            # Skip if already has features data
            if v.get("features") or v.get("tech_characteristics"):
                updated += 1
                continue

            url = slug_to_url(slug)
            name_short = v.get("title", slug)[:60]
            print(f"[{variant_count}/{total_variants}] {name_short}")

            detail = fetch_json(url)
            if detail:
                prod = process_product_page(detail)
                if prod:
                    v.update(prod)
                    updated += 1
                    feats = "features" if prod.get("features") else ""
                    tech = "tech" if prod.get("tech_characteristics") else ""
                    finishes = f"{len(prod.get('finishes',[]))} acabados" if prod.get("finishes") else ""
                    parts = [p for p in [feats, tech, finishes] if p]
                    print(f"  -> {', '.join(parts)}")
                else:
                    print(f"  -> Sin datos de producto")
            else:
                # Try alternative URL format
                alt_slug = slug.replace("/products/", "/productos/").replace("/productos/", "/products/")
                if alt_slug != slug:
                    alt_url = slug_to_url(alt_slug)
                    detail = fetch_json(alt_url)
                    if detail:
                        prod = process_product_page(detail)
                        if prod:
                            v.update(prod)
                            updated += 1
                            print(f"  -> OK (URL alternativa)")
                        else:
                            print(f"  -> Sin page-data (ni original ni alternativa)")
                    else:
                        print(f"  -> Page-data no encontrado")
                else:
                    print(f"  -> Page-data no encontrado")
            time.sleep(0.15)

    # Guardar
    output = {
        "total": len(families),
        "total_variants": total_variants,
        "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "families": families,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    with_features = sum(1 for fam in families for v in fam.get("products", []) if v.get("features"))
    with_finishes = sum(1 for fam in families for v in fam.get("products", []) if v.get("finishes"))

    print(f"\n=== RESUMEN ===")
    print(f"Variantes actualizadas: {updated}/{total_variants}")
    print(f"Con features: {with_features}")
    print(f"Con acabados: {with_finishes}")
    print(f"Guardado en: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
