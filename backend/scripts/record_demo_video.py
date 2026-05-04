"""Record real interaction clips for the i-SAI demo video.

Strategy:
- For each module, open a fresh Playwright context with video recording enabled.
- Perform a short interaction (open screen, fill form, open modal, etc.).
- Replace real data via a MutationObserver (so demo names like "Aurora" show up).
- Save each clip as WebM, then convert to a final MP4 with captions and transitions.
"""

import asyncio
import json
import os
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from playwright.async_api import async_playwright

OUT = Path("/tmp/isai_recordings")
OUT.mkdir(parents=True, exist_ok=True)
# Clean
for f in OUT.glob("*"):
    try:
        f.unlink()
    except IsADirectoryError:
        shutil.rmtree(f, ignore_errors=True)

ROOT = Path(__file__).resolve().parent.parent.parent
SHOTS_DIR = ROOT / "frontend" / "assets" / "portfolio"
FINAL = SHOTS_DIR / "demo.mp4"

W, H = 1280, 720
NAVY = (11, 37, 69)
PRIMARY = (25, 118, 210)

FONT_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"


# -----------------------------------------------------------------------------
# Demo data replacement injection (runs inside each recorded page)
# -----------------------------------------------------------------------------
MAPPING = {
    "Administrador Principal": "Laura García Ruiz",
    "Administrador Princ…": "Laura García",
    "Administrador Princ...": "Laura García",
    "admin@materiales.com": "laura.garcia@i-sai.com",
    "ARCELORMITTAL MOLINETE": "GRUPO AURORA CONSTRUCCIONES",
    "ARCELORMITTAL BARRERA PTA 71": "PROMOCIONES VÉRTICE S.L.",
    "3PBIO mano de obra": "REFORMAS HORIZONTE S.L.",
    "AIZARNAZABALKO UDALA": "AYUNTAMIENTO VILLANUEVA",
    "ALBIAN TECNALIA": "NEXUS TECNOLOGÍA S.A.",
    "ALFA LAN **": "TALLERES MERIDIAN",
    "ARMERIA ESKOLA": "INMOBILIARIA LUNA",
    "ARTXANDAPE IKASTOLA": "COLEGIO SAN MATEO",
    "ATHADER PUERTAS ALMACEN*": "LOGÍSTICA EUROSUR",
    "ATHADER PUERTAS ALMACEN": "LOGÍSTICA EUROSUR",
    "ARLUY": "HOTEL AURORA",
    "Santander": "GRUPO AURORA",
    "OLABERRIA": "Madrid", "NOAIN": "Barcelona", "BILBAO": "Valencia",
    "AIZARNAZABAL": "Sevilla", "EIBAR": "Málaga", "BERGARA": "Zaragoza",
    "ARRUBAL": "Alicante", "GASTEIZ": "Murcia",
    "645484945": "600 111 222", "649480888": "600 333 444",
    "aSDasd": "Sustituir cerradura electrónica",
    "Fallo de lector de entrada, no se enciende": "Revisión puerta automática — no detecta vehículos",
    "Fede Segovia": "Marco Fernández",
    "Dídac Masip": "Sergio Ortega",
    "Javier Caso": "Carlos Núñez",
    "22020084554": "PROY-2025-018", "22222200000": "PROY-2025-022",
    "22222200": "PROY-2025", "javier d": "Laura García",
    "asdasd": "Revisión", "Test Auto": "Juan Pérez",
    "#N/A": "Aurora Const.",
    "Jjxjx": "AUR-001", "Dnjxbx": "Oficinas Aurora", "Ndjxbxj": "Edificio central",
    "wsadf": "AUR-002", "adsf": "AUR-003", "sdf": "AUR-004", "asdf": "Aurora",
    "asf": "Aurora", "TEST01": "AUR-001", "Test": "Aurora",
    "Pedro": "Carlos", "Nuevo proyecto": "Oficinas Aurora",
    "MAXAM europe SA": "AURORA QUÍMICA S.A.",
    "CARLOS MONTES": "Carlos Núñez",
    "EOSKARABIA": "Aurora Bilbao",
    "Administrador@materiales.com": "admin@i-sai.com",
    "jcaso@i-sai.net": "carlos.nunez@i-sai.com",
    "test_planuser@example.com": "sergio.ortega@i-sai.com",
    "test_user_d0693377@test.com": "marco.fernandez@i-sai.com",
}
INJECT_SCRIPT = (
    "(() => {"
    "  if (window.__isaiDemoInject) return; window.__isaiDemoInject = true;"
    f"  const m = {json.dumps(MAPPING, ensure_ascii=False)};"
    "  const walk = (n) => {"
    "    if (n.nodeType === 3) {"
    "      let t = n.textContent; let ch = false;"
    "      for (const k in m) if (t.indexOf(k) !== -1) { t = t.split(k).join(m[k]); ch = true; }"
    "      if (ch) n.textContent = t;"
    "    } else if (n.childNodes) for (const x of Array.from(n.childNodes)) walk(x);"
    "  };"
    "  walk(document.body);"
    "  const obs = new MutationObserver(() => walk(document.body));"
    "  obs.observe(document.body, { childList: true, subtree: true, characterData: true });"
    "})()"
)


# -----------------------------------------------------------------------------
# Clip recording helpers
# -----------------------------------------------------------------------------
async def login(page):
    admin_email = os.environ.get("DEMO_ADMIN_EMAIL", "admin@materiales.com")
    admin_password = os.environ["DEMO_ADMIN_PASSWORD"]
    await page.goto("http://localhost:3000/login", wait_until="domcontentloaded", timeout=30000)
    await page.wait_for_timeout(2500)
    inputs = page.locator("input")
    await inputs.nth(0).fill(admin_email)
    await inputs.nth(1).fill(admin_password)
    # Submit via Enter key (most reliable in forms)
    await inputs.nth(1).press("Enter")
    # Wait for URL to actually change to a protected page
    try:
        await page.wait_for_url(lambda u: "/login" not in u, timeout=15000)
    except Exception:
        # Fallback: click the button
        try:
            await page.locator("text=/ENTRAR/i").first.click()
            await page.wait_for_url(lambda u: "/login" not in u, timeout=15000)
        except Exception as e:
            print("  ! login did not navigate:", e)
    await page.wait_for_timeout(2000)


async def record_clip(browser, storage_state, name, actions_fn, duration_ms=6000):
    """Open a new context with video recording; run actions; save as WebM."""
    ctx_args = {
        "viewport": {"width": W, "height": H},
        "record_video_dir": str(OUT),
        "record_video_size": {"width": W, "height": H},
    }
    if storage_state is not None:
        ctx_args["storage_state"] = storage_state
    ctx = await browser.new_context(**ctx_args)
    # Inject the demo-data replacement BEFORE any page script runs, so that the
    # MutationObserver is active from the first paint of every page.
    await ctx.add_init_script(INJECT_SCRIPT)
    page = await ctx.new_page()
    try:
        await actions_fn(page)
    except Exception as e:
        print(f"  ! {name} action error: {e}")
    remain = max(500, duration_ms - 0)
    await page.wait_for_timeout(remain)
    vid = page.video
    await ctx.close()
    src = await vid.path()
    dst = OUT / f"{name}.webm"
    if dst.exists():
        dst.unlink()
    os.rename(src, str(dst))
    print(f"  ✓ {name}.webm ({dst.stat().st_size // 1024} KB)")
    return dst


async def inject(page):
    try:
        await page.evaluate(INJECT_SCRIPT)
    except Exception:
        pass


# -----------------------------------------------------------------------------
# Each module scenario
# -----------------------------------------------------------------------------
async def scene_login(page):
    # Already on login (no login performed). Record typing the credentials.
    await page.wait_for_timeout(1000)
    inputs = page.locator("input")
    await inputs.nth(0).click()
    await page.wait_for_timeout(300)
    await inputs.nth(0).type("laura.garcia@i-sai.com", delay=55)
    await page.wait_for_timeout(300)
    await inputs.nth(1).click()
    await page.wait_for_timeout(200)
    await inputs.nth(1).type("************", delay=50)
    await page.wait_for_timeout(600)
    await page.locator("text=/Entrar|ENTRAR/").first.hover()
    await page.wait_for_timeout(1200)


async def scene_home(page):
    await page.goto("http://localhost:3000/home", wait_until="domcontentloaded")
    await page.wait_for_timeout(2500)
    await inject(page)
    await page.wait_for_timeout(800)
    # Hover over the Proyectos tile
    try:
        await page.locator("text=/^Proyectos$/").first.hover()
    except Exception:
        pass
    await page.wait_for_timeout(800)
    try:
        await page.locator("text=/^Calendario$/").first.hover()
    except Exception:
        pass
    await page.wait_for_timeout(800)
    try:
        await page.locator("text=/^CRM SAT$/").first.hover()
    except Exception:
        pass
    await page.wait_for_timeout(1000)


async def scene_proyectos(page):
    await page.goto("http://localhost:3000/materiales", wait_until="networkidle")
    await page.wait_for_timeout(3000)
    await inject(page)
    await page.wait_for_timeout(1500)
    # Type into search
    try:
        search = page.get_by_placeholder("Buscar", exact=False)
        await search.first.click()
        await search.first.type("Aurora", delay=80)
    except Exception:
        pass
    await page.wait_for_timeout(1800)


async def scene_calendario(page):
    await page.goto("http://localhost:3000/calendario", wait_until="networkidle")
    await page.wait_for_timeout(3500)
    await inject(page)
    # Scroll within the calendar to show some events
    await page.wait_for_timeout(2000)


async def scene_planos(page):
    await page.goto("http://localhost:3000/planos", wait_until="networkidle")
    await page.wait_for_timeout(3500)
    await inject(page)
    await page.wait_for_timeout(2000)


async def scene_presupuestos(page):
    await page.goto("http://localhost:3000/presupuestos", wait_until="networkidle")
    await page.wait_for_timeout(3500)
    await inject(page)
    await page.wait_for_timeout(2000)


async def scene_sat(page):
    await page.goto("http://localhost:3000/sat", wait_until="networkidle")
    await page.wait_for_timeout(3500)
    await inject(page)
    # Switch to Agendadas
    try:
        await page.locator("text=/Agendadas/").first.click(force=True)
    except Exception:
        pass
    await page.wait_for_timeout(1500)
    try:
        await page.locator("text=/Avisos recibidos/").first.click(force=True)
    except Exception:
        pass
    await page.wait_for_timeout(1500)


async def scene_aviso_sat(page):
    await page.goto("http://localhost:3000/aviso-sat", wait_until="domcontentloaded")
    await page.wait_for_timeout(3000)
    inputs = page.locator("input")
    try:
        await inputs.nth(0).click()
        await inputs.nth(0).type("Aurora Construcciones S.L.", delay=55)
        await page.wait_for_timeout(300)
        await inputs.nth(1).click()
        await inputs.nth(1).type("Madrid", delay=55)
        await page.wait_for_timeout(300)
        await inputs.nth(2).click()
        await inputs.nth(2).type("600 111 222", delay=55)
    except Exception:
        pass
    await page.wait_for_timeout(1500)


async def scene_clientes(page):
    await page.goto("http://localhost:3000/sat", wait_until="networkidle")
    await page.wait_for_timeout(3500)
    await inject(page)
    # Switch tab to Clientes
    try:
        await page.locator("text=Incidencias").first.click(force=True)
        await page.wait_for_timeout(600)
        await page.locator("text=Clientes").first.click(force=True)
    except Exception:
        pass
    await page.wait_for_timeout(2000)


async def scene_usuarios(page):
    await page.goto("http://localhost:3000/users", wait_until="networkidle")
    await page.wait_for_timeout(3500)
    await inject(page)
    await page.wait_for_timeout(1800)


SCENES = [
    ("00_login", scene_login, "INICIO", "Iniciar sesión",
     "Autenticación segura con roles: Admin, Técnico y Comercial."),
    ("01_home", scene_home, "MÓDULO 01", "Panel de Inicio",
     "Accesos directos a todos los módulos y notificaciones en tiempo real."),
    ("02_proyectos", scene_proyectos, "MÓDULO 02", "Proyectos",
     "Sincronizados automáticamente con Excel en OneDrive. Busca por cliente."),
    ("03_calendario", scene_calendario, "MÓDULO 03", "Calendario",
     "Drag & drop, multi-técnico y notificación automática al asignar."),
    ("04_planos", scene_planos, "MÓDULO 04", "Planos interactivos",
     "Dibuja sobre PDFs y fotos para señalar cilindros y cerraduras."),
    ("05_presupuestos", scene_presupuestos, "MÓDULO 05", "Presupuestos",
     "Rellena el formulario y la app genera el PDF con tu plantilla oficial."),
    ("06_sat", scene_sat, "MÓDULO 06", "CRM SAT",
     "Pendientes · Agendadas · Resueltas. Historial auditable y reagendable."),
    ("07_aviso", scene_aviso_sat, "MÓDULO 07", "Formulario público",
     "Tus clientes reportan incidencias sin login: llegan al CRM al instante."),
    ("08_clientes", scene_clientes, "MÓDULO 08", "Catálogo de clientes",
     "Importación masiva desde Excel. Histórico completo por cliente."),
    ("09_usuarios", scene_usuarios, "MÓDULO 09", "Gestión de usuarios",
     "Roles con permisos diferenciados y colores personalizados por técnico."),
]


# -----------------------------------------------------------------------------
# Caption overlay image (PNG with transparent background)
# -----------------------------------------------------------------------------
def make_caption_overlay(kicker, title, subtitle, out_path):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    # Bottom gradient band (semi-transparent dark)
    band_top = H - 160
    for y in range(band_top, H):
        alpha = int(200 * (y - band_top) / (H - band_top))
        dr.line([(0, y), (W, y)], fill=(11, 37, 69, min(230, alpha + 80)))
    # Accent bar
    dr.rectangle((36, band_top + 30, 44, band_top + 120), fill=PRIMARY)
    # Kicker
    font_k = ImageFont.truetype(FONT_BOLD, 14)
    font_t = ImageFont.truetype(FONT_BOLD, 32)
    font_s = ImageFont.truetype(FONT_REG, 16)
    dr.text((60, band_top + 28), kicker.upper(), font=font_k, fill=(147, 197, 253, 255))
    dr.text((60, band_top + 50), title, font=font_t, fill=(255, 255, 255, 255))
    dr.text((60, band_top + 100), subtitle, font=font_s, fill=(203, 213, 225, 255))
    # Brand corner
    dr.rounded_rectangle((36, 32, 76, 72), radius=8, fill=PRIMARY)
    dr.text((44, 38), "i", font=ImageFont.truetype(FONT_BOLD, 30), fill=(255, 255, 255))
    dr.text((86, 40), "i-SAI", font=ImageFont.truetype(FONT_BOLD, 16), fill=(255, 255, 255, 255))
    dr.text((86, 58), "Demo", font=ImageFont.truetype(FONT_REG, 11), fill=(203, 213, 225, 255))
    im.save(out_path, "PNG")


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])

        # 1) Log in once to capture storage_state (localStorage has the JWT).
        print("→ Logging in once to capture auth storage …")
        auth_ctx = await browser.new_context(viewport={"width": W, "height": H})
        auth_page = await auth_ctx.new_page()
        await login(auth_page)
        # Also visit /home so any client-side auth-bootstrap runs and persists.
        try:
            await auth_page.goto("http://localhost:3000/home", wait_until="domcontentloaded")
            await auth_page.wait_for_timeout(2000)
        except Exception:
            pass
        storage = await auth_ctx.storage_state()
        await auth_ctx.close()
        print(f"   · storage origins: {len(storage.get('origins', []))}")

        # 2) Record each scene
        clips = []
        for name, fn, kicker, title, sub in SCENES:
            # Public forms don't need auth
            use_storage = None if name in ("00_login", "07_aviso") else storage
            print(f"→ Recording {name} …")
            path = await record_clip(browser, use_storage, name, fn, duration_ms=6000)
            clips.append((path, kicker, title, sub))
        await browser.close()
    print("✓ All clips recorded")

    # -------------------------------------------------------------------------
    # Build captions and combine
    # -------------------------------------------------------------------------
    caps_dir = OUT / "captions"
    caps_dir.mkdir(exist_ok=True)
    mp4_clips = []
    for clip_path, kicker, title, sub in clips:
        # Caption PNG
        cap_png = caps_dir / f"{clip_path.stem}.png"
        make_caption_overlay(kicker, title, sub, cap_png)
        # Convert WebM → MP4 with caption overlay
        mp4_out = OUT / f"{clip_path.stem}.mp4"
        # Trim slightly to avoid initial blank frames, and fade in/out
        cmd = [
            "ffmpeg", "-y",
            "-i", str(clip_path),
            "-i", str(cap_png),
            "-filter_complex",
            "[0:v]scale=1280:720,setsar=1,fade=t=in:st=0:d=0.3,fade=t=out:st=5.5:d=0.5[v];"
            "[v][1:v]overlay=0:0,format=yuv420p[out]",
            "-map", "[out]",
            "-t", "6",
            "-r", "30",
            "-c:v", "libx264", "-preset", "fast", "-crf", "24",
            "-movflags", "+faststart", "-an",
            str(mp4_out),
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            print(f"FFmpeg failed for {clip_path.stem}: {r.stderr[-500:]}")
            continue
        mp4_clips.append(mp4_out)
        print(f"  ✓ {mp4_out.name}")

    # -------------------------------------------------------------------------
    # Concatenate all module clips with simple cut transitions
    # -------------------------------------------------------------------------
    list_file = OUT / "concat.txt"
    list_file.write_text("\n".join(f"file '{p}'" for p in mp4_clips))
    cmd = [
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", str(list_file),
        "-c", "copy", "-movflags", "+faststart",
        str(FINAL),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"Concat failed: {r.stderr[-500:]}")
        return
    total_sec = 6 * len(mp4_clips)
    print(f"✓ Final video: {FINAL} ({FINAL.stat().st_size // 1024} KB, ~{total_sec}s)")


if __name__ == "__main__":
    asyncio.run(main())
