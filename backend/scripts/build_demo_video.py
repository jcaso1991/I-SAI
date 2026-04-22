"""Generate the i-SAI demo video (PNG scenes + ffmpeg crossfade).

Output: /app/frontend/assets/portfolio/demo.mp4  (~720p, ~30s).
Run:   python3 /app/backend/scripts/build_demo_video.py
"""
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent.parent
SHOTS_DIR = ROOT / "frontend" / "assets" / "portfolio"
OUT = SHOTS_DIR / "demo.mp4"

W, H = 1280, 720          # final video resolution
SCENE_DURATION = 3.0      # seconds each scene holds (before xfade)
FADE = 0.6                # crossfade seconds

# Colors (match portfolio)
NAVY = (11, 37, 69)
PRIMARY = (25, 118, 210)
TEXT = (255, 255, 255)
SUB = (203, 213, 225)
BG_TOP = (11, 37, 69)
BG_BOT = (25, 118, 210)

# Fonts
FONT_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"


def _font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def _gradient(size=(W, H), c1=BG_TOP, c2=BG_BOT):
    """Vertical gradient background."""
    img = Image.new("RGB", size, c1)
    top = Image.new("RGB", size, c1)
    bot = Image.new("RGB", size, c2)
    mask = Image.linear_gradient("L").resize(size)
    img.paste(bot, (0, 0), mask)
    return img


def _round_corners(img: Image.Image, radius: int) -> Image.Image:
    """Return img with rounded corners + alpha."""
    rgba = img.convert("RGBA")
    mask = Image.new("L", rgba.size, 0)
    dr = ImageDraw.Draw(mask)
    dr.rounded_rectangle((0, 0, rgba.size[0], rgba.size[1]), radius=radius, fill=255)
    rgba.putalpha(mask)
    return rgba


def _shadow(size, radius=20, offset=(0, 8), blur=18, color=(0, 0, 0, 120)):
    shadow = Image.new("RGBA", (size[0] + offset[0] * 2 + blur * 2,
                                size[1] + offset[1] * 2 + blur * 2), (0, 0, 0, 0))
    dr = ImageDraw.Draw(shadow)
    dr.rounded_rectangle(
        (offset[0] + blur, offset[1] + blur,
         offset[0] + blur + size[0], offset[1] + blur + size[1]),
        radius=radius, fill=color,
    )
    return shadow.filter(ImageFilter.GaussianBlur(blur / 2))


def _scene_with_shot(shot_path: Path, kicker: str, title: str, caption: str) -> Image.Image:
    bg = _gradient()
    dr = ImageDraw.Draw(bg)

    # Brand mark top-left
    dr.rounded_rectangle((40, 36, 90, 86), radius=10, fill=PRIMARY)
    dr.text((50, 40), "i", font=_font(FONT_BOLD, 42), fill=(255, 255, 255))
    dr.text((100, 46), "i-SAI", font=_font(FONT_BOLD, 22), fill=TEXT)
    dr.text((100, 72), "Partner SALTO  ·  Proyectos", font=_font(FONT_REG, 12), fill=SUB)

    # Text left-side
    text_x = 60
    text_y = 180
    dr.text((text_x, text_y), kicker.upper(), font=_font(FONT_BOLD, 14), fill=(147, 197, 253))
    dr.text((text_x, text_y + 30), title, font=_font(FONT_BOLD, 44), fill=TEXT)
    # Wrap caption manually (naive line-wrap)
    caption_font = _font(FONT_REG, 18)
    words = caption.split()
    line, lines, max_px = "", [], 460
    for w in words:
        test = f"{line} {w}".strip()
        bbox = dr.textbbox((0, 0), test, font=caption_font)
        if bbox[2] - bbox[0] <= max_px:
            line = test
        else:
            if line:
                lines.append(line)
            line = w
    if line:
        lines.append(line)
    ty = text_y + 90
    for ln in lines:
        dr.text((text_x, ty), ln, font=caption_font, fill=SUB)
        ty += 26

    # Screenshot right-side
    shot = Image.open(shot_path).convert("RGB")
    # Fit inside a 640x480 area while keeping aspect
    target = (640, 480)
    sw, sh = shot.size
    scale = min(target[0] / sw, target[1] / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    shot_resized = shot.resize((nw, nh), Image.Resampling.LANCZOS)
    shot_rc = _round_corners(shot_resized, radius=18)

    # Compose shadow then shot
    sh_img = _shadow((nw, nh), radius=18, offset=(0, 10), blur=28, color=(0, 0, 0, 130))
    px = W - 60 - nw
    py = (H - nh) // 2
    bg.paste(sh_img, (px - 28, py - 18), sh_img)
    bg.paste(shot_rc, (px, py), shot_rc)

    return bg


def _title_scene(title: str, sub: str, big_icon: str = "i-SAI") -> Image.Image:
    bg = _gradient()
    dr = ImageDraw.Draw(bg)
    # Giant centered mark
    dr.rounded_rectangle((W / 2 - 60, 170, W / 2 + 60, 290), radius=24, fill=PRIMARY)
    dr.text((W / 2 - 30, 192), "i", font=_font(FONT_BOLD, 86), fill=(255, 255, 255))
    # Title
    bbox = dr.textbbox((0, 0), title, font=_font(FONT_BOLD, 54))
    tw = bbox[2] - bbox[0]
    dr.text(((W - tw) / 2, 330), title, font=_font(FONT_BOLD, 54), fill=TEXT)
    # Subtitle
    bbox2 = dr.textbbox((0, 0), sub, font=_font(FONT_REG, 22))
    sw = bbox2[2] - bbox2[0]
    dr.text(((W - sw) / 2, 410), sub, font=_font(FONT_REG, 22), fill=SUB)
    # Badge row at bottom
    badges = ["📱 iOS · Android", "💻 Web · Desktop", "☁️ OneDrive", "🛡️ Roles & permisos"]
    y = H - 140
    # Approx width per badge
    bw_list = []
    for b in badges:
        bb = dr.textbbox((0, 0), b, font=_font(FONT_BOLD, 14))
        bw_list.append(bb[2] - bb[0] + 30)
    total = sum(bw_list) + 12 * (len(badges) - 1)
    x = (W - total) // 2
    for b, bw in zip(badges, bw_list):
        dr.rounded_rectangle((x, y, x + bw, y + 34), radius=17, outline=(147, 197, 253), width=1)
        dr.text((x + 15, y + 10), b, font=_font(FONT_BOLD, 13), fill=(219, 234, 254))
        x += bw + 12
    return bg


def _cta_scene() -> Image.Image:
    bg = _gradient()
    dr = ImageDraw.Draw(bg)
    # Big circle with check
    dr.ellipse((W / 2 - 70, 170, W / 2 + 70, 310), fill=(16, 185, 129))
    dr.text((W / 2 - 34, 200), "✓", font=_font(FONT_BOLD, 90), fill=(255, 255, 255))
    title = "¿Hablamos?"
    bbox = dr.textbbox((0, 0), title, font=_font(FONT_BOLD, 58))
    dr.text(((W - (bbox[2] - bbox[0])) / 2, 340), title, font=_font(FONT_BOLD, 58), fill=TEXT)
    sub = "i-SAI se adapta a tu empresa. Agenda una demo."
    bbox2 = dr.textbbox((0, 0), sub, font=_font(FONT_REG, 22))
    dr.text(((W - (bbox2[2] - bbox2[0])) / 2, 420), sub, font=_font(FONT_REG, 22), fill=SUB)
    # CTA pill
    pill_text = "Entra a la app / Descarga el PDF"
    bbox3 = dr.textbbox((0, 0), pill_text, font=_font(FONT_BOLD, 18))
    tw = bbox3[2] - bbox3[0]
    px = (W - tw - 40) // 2
    dr.rounded_rectangle((px, 480, px + tw + 40, 530), radius=25, fill=PRIMARY)
    dr.text((px + 20, 493), pill_text, font=_font(FONT_BOLD, 18), fill=(255, 255, 255))
    # Footer
    foot = "i-SAI · Partner SALTO · Materiales y Proyectos"
    bbox4 = dr.textbbox((0, 0), foot, font=_font(FONT_BOLD, 14))
    dr.text(((W - (bbox4[2] - bbox4[0])) / 2, H - 60), foot, font=_font(FONT_BOLD, 14), fill=SUB)
    return bg


# -----------------------------------------------------------------------------
# Build scene list
# -----------------------------------------------------------------------------
SCENES = [
    ("title", None, {"title": "i-SAI", "sub": "El gestor integral de proyectos, SAT y equipos"}),
    ("shot", "10_login.jpg",
     {"kicker": "Acceso seguro", "title": "Inicia sesión",
      "caption": "Autenticación con roles: Administrador, Técnico y Comercial. Cada usuario ve sólo lo que le corresponde."}),
    ("shot", "01_home.jpg",
     {"kicker": "Módulo 01", "title": "Panel de Inicio",
      "caption": "Accesos directos a todos los módulos y notificaciones en tiempo real."}),
    ("shot", "02_proyectos.jpg",
     {"kicker": "Módulo 02", "title": "Proyectos",
      "caption": "Sincronizados automáticamente con tu Excel en OneDrive. Cero trabajo duplicado."}),
    ("shot", "03_calendario.jpg",
     {"kicker": "Módulo 03", "title": "Calendario",
      "caption": "Drag & drop multi-técnico. Eventos en paralelo y notificación automática al asignar."}),
    ("shot", "04_planos_list.jpg",
     {"kicker": "Módulo 04", "title": "Planos interactivos",
      "caption": "Dibuja sobre PDFs y fotos para señalar la ubicación de cilindros y cerraduras."}),
    ("shot", "05_presupuestos.jpg",
     {"kicker": "Módulo 05", "title": "Presupuestos",
      "caption": "Rellenas un formulario y la app genera el PDF con tu plantilla oficial, listo para enviar."}),
    ("shot", "06_sat_incidencias.jpg",
     {"kicker": "Módulo 06", "title": "CRM SAT",
      "caption": "Pendientes · Agendadas · Resueltas. Historial auditable y reagendamiento integrado."}),
    ("shot", "08_aviso_sat.jpg",
     {"kicker": "Módulo 07", "title": "Formulario público",
      "caption": "Tus clientes reportan incidencias sin login. La incidencia llega al CRM al instante."}),
    ("shot", "07_sat_clientes.jpg",
     {"kicker": "Módulo 08", "title": "Catálogo de clientes",
      "caption": "Importación masiva desde Excel. Histórico completo de incidencias por cliente."}),
    ("shot", "09_usuarios.jpg",
     {"kicker": "Módulo 09", "title": "Gestión de usuarios",
      "caption": "Roles con permisos diferenciados y colores personalizados por técnico en el calendario."}),
    ("cta", None, {}),
]


def main():
    tmp = Path(tempfile.mkdtemp(prefix="isai_demo_"))
    print(f"Building scenes in {tmp}")
    scene_files = []
    for i, (kind, shot_file, data) in enumerate(SCENES):
        if kind == "title":
            img = _title_scene(data["title"], data["sub"])
        elif kind == "cta":
            img = _cta_scene()
        else:
            shot_path = SHOTS_DIR / shot_file
            img = _scene_with_shot(shot_path, data["kicker"], data["title"], data["caption"])
        p = tmp / f"scene_{i:02d}.png"
        img.save(p, "PNG", optimize=False)
        scene_files.append(p)
        print(f"  ✓ {p.name}")

    # -------------------------------------------------------------------------
    # Build MP4 with ffmpeg — each scene SCENE_DURATION seconds + FADE crossfade
    # -------------------------------------------------------------------------
    n = len(scene_files)
    per_input_dur = SCENE_DURATION + FADE  # each input needs to cover its fade
    inputs = []
    for p in scene_files:
        inputs += ["-loop", "1", "-t", f"{per_input_dur:.2f}", "-i", str(p)]
    # Build xfade chain
    filter_parts = []
    prev = "[0:v]"
    acc_offset = SCENE_DURATION - FADE  # Actually xfade offset = duration of previous clip - fade
    for i in range(1, n):
        out_label = f"[v{i}]"
        offset = SCENE_DURATION * i - FADE  # offset of this transition from t=0
        # No - the offset should be relative to the input before the fade
        # Use acc_offset pattern: cumulative duration minus fade
        offset = (SCENE_DURATION * i) - FADE
        filter_parts.append(
            f"{prev}[{i}:v]xfade=transition=fade:duration={FADE}:offset={offset}{out_label}"
        )
        prev = out_label
    filter_complex = ";".join(filter_parts) + f";{prev}format=yuv420p[out]"

    out_duration = SCENE_DURATION * n  # approximate total
    cmd = [
        "ffmpeg", "-y",
        *inputs,
        "-filter_complex", filter_complex,
        "-map", "[out]",
        "-r", "30",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-preset", "medium",
        "-crf", "23",
        str(OUT),
    ]
    print("Running ffmpeg …")
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("FFMPEG STDERR:\n", r.stderr[-2000:])
        raise SystemExit(1)
    print(f"✓ Video generated: {OUT} ({OUT.stat().st_size/1024:.0f} KB)")
    shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
