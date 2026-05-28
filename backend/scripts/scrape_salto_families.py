"""
Scraping completo de productos Salto Systems - FASE 1: Familias.
Ejecutar primero. Luego scrape_salto_variants.py para los detalles.
"""
import subprocess, re, json, time, os
from html import unescape

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "..", "salto_products_families.json")

def fetch_html(url: str) -> str:
    r = subprocess.run(["curl", "-s", "-L", "--max-time", "15", url], capture_output=True, text=True)
    return r.stdout

def fetch_json(url: str) -> dict | None:
    r = subprocess.run(["curl", "-s", "-L", "--max-time", "15", url], capture_output=True, text=True)
    if not r.stdout.strip(): return None
    try: return json.loads(r.stdout)
    except: return None

def strip_html(text) -> str:
    if not text: return ""
    if isinstance(text, dict): text = text.get("processed", "") or text.get("value", "") or str(text)
    text = unescape(str(text))
    text = re.sub(r'<[^>]+>', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()

def extract_image(rels: dict, field: str) -> str:
    try:
        d = rels.get(field, {})
        for s in (d.get("sizes") or []):
            for k in ["xl", "l", "m"]:
                if s.get(k): return s[k]
        uri = d.get("uri", {}).get("url", "")
        if uri: return f"https://cms.saltosystems.com{uri}"
    except: pass
    return ""

# Step 1: Get all product URLs from sitemap
print("Obteniendo URLs del sitemap...")
urls = set()
for i in range(7):
    xml = fetch_html(f"https://saltosystems.com/sitemap-{i}.xml")
    urls.update(re.findall(r'<loc>(https://saltosystems\.com/es-es/productos/[^<]+)</loc>', xml))

# Filter: keep only URLs for family pages (have JSON-LD Product data)
categories = {"cerraduras-electronicas","cilindros-electronicos","candados-electronicos",
    "lectores-murales","controladoras-cu","taquillas","perifericos","llaves-inteligentes",
    "door-intercom-systems","tarjetas-llave","cerraduras-de-embutir","cerraduras-para-puertas-de-hogar",
    "sistemas-de-eficiencia-y-control-energeticos","barras-antipanico-y-dispositivos-de-salida-de-emergencia",
    "terminal-de-reconocimiento-facial","barras-antipanico-y-vias-de-evacuacion","controladoras-cus",
    "home-door-locks","electronic-padlocks","electronic-locker-locks","energy-efficiency-and-control-systems",
    "face-recognition-terminals","peripherals","credentials","en-el-nodo-de-la-habitacion",
    "cerraduras-para-taquillas-xs4","design-xs-lector-mural-europeo"}

product_urls = sorted([u for u in urls if u.rstrip("/").split("/")[-1] not in categories and u.count("/") > 5])
print(f"URLs de producto: {len(product_urls)}")

# Step 2: Fetch each family page and extract data
families = []
for i, url in enumerate(product_urls):
    path = url.replace("https://saltosystems.com", "").rstrip("/")
    pd_url = f"https://saltosystems.com/page-data{path}/page-data.json"
    
    # Get JSON-LD for basic info + page-data for detailed info
    html = fetch_html(url)
    name = path.split("/")[-1]
    print(f"[{i+1}/{len(product_urls)}] {name}")
    
    # Extract JSON-LD
    m = re.search(r'application/ld\+json[^>]*>\s*(\[.*?\])\s*</script', html, re.DOTALL)
    basic_info = {}
    if m:
        try:
            for item in json.loads(m.group(1)):
                if item.get("@type") == "Product":
                    basic_info = {"category": item.get("category", "").strip()}
        except: pass
    
    # Get page-data for subproducts
    data = fetch_json(pd_url)
    if not data:
        print(f"  -> Sin page-data")
        # Still save basic info
        families.append({
            "name": name.replace("-", " ").title(),
            "description": "", "full_description": "", "image": "",
            "category": basic_info.get("category", ""), "url": url, "products": []
        })
        continue
    
    family = data.get("result", {}).get("data", {}).get("family", {})
    if not family:
        print(f"  -> Sin datos de familia")
        continue
    
    products = []
    for p in family.get("relationships", {}).get("products", []) or []:
        rels = p.get("relationships", {}) or {}
        products.append({
            "title": p.get("title", ""),
            "description": strip_html(p.get("text", {})),
            "image": extract_image(rels, "listImageSrc"),
            "category": (rels.get("category") or {}).get("title", ""),
            "slug": p.get("slug", {}).get("alias", ""),
        })
    
    families.append({
        "name": family.get("title", ""),
        "description": strip_html(family.get("introText", {})),
        "full_description": strip_html(family.get("text", {})),
        "image": extract_image(family.get("relationships", {}), "heroImageDesktopSrc") or
                 extract_image(family.get("relationships", {}), "listImage"),
        "category": basic_info.get("category", ""),
        "url": url,
        "products": products,
    })
    print(f"  -> {family.get('title', '?')}: {len(products)} variantes")
    time.sleep(0.2)

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump({"total": len(families), "families": families, "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%S")}, f, ensure_ascii=False, indent=2)

total_v = sum(len(f["products"]) for f in families)
print(f"\nFamilias: {len(families)}, Variantes: {total_v}")
print(f"Guardado en: {OUTPUT_FILE}")
