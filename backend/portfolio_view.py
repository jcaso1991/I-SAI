"""i-SAI Portfolio — Public HTML presentation for clients.

Served at GET /api/portfolio as a self-contained HTML document with:
  - Embedded CSS (no external deps, print-friendly @media rules for A4)
  - All module screenshots as base64 (survives even if the frontend
    assets directory is later moved)
  - Works on mobile, desktop and prints cleanly to PDF from the browser.

The corresponding Expo route /portfolio simply redirects here so that
users can share a clean URL.
"""

import base64
import os
from pathlib import Path

# Directory with the portfolio screenshots (bundled with the frontend)
ASSETS_DIR = Path(__file__).resolve().parent.parent / "frontend" / "assets" / "portfolio"


def _img_b64(filename: str) -> str:
    """Return a data: URL for the given portfolio screenshot."""
    p = ASSETS_DIR / filename
    if not p.exists():
        return ""
    ext = p.suffix.lower().lstrip(".")
    mime = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
    with open(p, "rb") as f:
        data = base64.b64encode(f.read()).decode("ascii")
    return f"data:{mime};base64,{data}"


# Module content (keep in sync with the app UI). Each entry renders as a row.
MODULES = [
    {
        "num": "01",
        "title": "Panel de Inicio",
        "subtitle": "Tu centro de control diario",
        "color": "#1976D2",
        "icon": "🏠",
        "shot": "01_home.jpg",
        "description": (
            "La primera pantalla que ve cada usuario al entrar. Accesos directos a "
            "todos los módulos, saludo personalizado según la hora del día y campana "
            "de notificaciones en tiempo real."
        ),
        "benefits": [
            "Acceso a todo con 1 clic",
            "Notificaciones en vivo (avisos SAT, menciones, cambios)",
            "Adaptado al rol del usuario (Admin · Técnico · Comercial)",
        ],
        "howto": [
            "El usuario inicia sesión con su email y contraseña",
            "Ve sólo los módulos que le corresponden según su rol",
            "Pulsa cualquier tarjeta para abrir el módulo",
        ],
    },
    {
        "num": "02",
        "title": "Proyectos",
        "subtitle": "Sincronización con OneDrive",
        "color": "#8B5CF6",
        "icon": "📊",
        "shot": "02_proyectos.jpg",
        "description": (
            "Todos tus proyectos se importan automáticamente desde un Excel en OneDrive. "
            "Los campos son editables en tiempo real y cualquier cambio queda guardado."
        ),
        "benefits": [
            "Sin duplicar trabajo: tu Excel sigue siendo la fuente",
            "Cualquier cambio hecho desde la app se guarda en OneDrive",
            "Búsqueda por cliente, ubicación o gestor",
        ],
        "howto": [
            "Conectas tu cuenta Microsoft una sola vez",
            "La app lee el Excel y muestra cada fila como un proyecto",
            "Editas los campos desde el móvil o el ordenador y se sincronizan solos",
        ],
    },
    {
        "num": "03",
        "title": "Calendario",
        "subtitle": "Drag & drop multi-técnico",
        "color": "#10B981",
        "icon": "📅",
        "shot": "03_calendario.jpg",
        "description": (
            "Arrastra, redimensiona y asigna eventos a uno o varios técnicos. Cada "
            "técnico tiene su color; los eventos multi-técnico se visualizan en "
            "columnas paralelas del mismo tamaño."
        ),
        "benefits": [
            "Reagenda con un dedo (drag & drop)",
            "Adjunta PDFs/fotos directamente al evento",
            "Un mismo evento puede asignarse a varios técnicos a la vez",
        ],
        "howto": [
            "Creas el evento con horario, técnico(s) y adjuntos",
            "Arrastras para mover; tiras de los bordes para cambiar la duración",
            "El técnico recibe notificación automática al ser asignado",
        ],
    },
    {
        "num": "04",
        "title": "Planos interactivos",
        "subtitle": "Dibuja sobre PDFs y fotos",
        "color": "#F59E0B",
        "icon": "🗺️",
        "shot": "04_planos_list.jpg",
        "description": (
            "Abre cualquier plano (PDF o JPG) directamente desde el proyecto o evento "
            "y anota encima: líneas, formas, textos, marcas. Ideal para señalar la "
            "ubicación de cada cilindro o cerradura."
        ),
        "benefits": [
            "Herramientas de dibujo profesionales",
            "Compatible con PDFs y fotos",
            "Guardado automático en la nube",
        ],
        "howto": [
            "Abres un evento o proyecto con plano adjunto",
            "Seleccionas herramienta (línea, forma, texto)",
            "Dibujas sobre el plano y se guarda al momento",
        ],
    },
    {
        "num": "05",
        "title": "Presupuestos",
        "subtitle": "PDF auto-rellenados",
        "color": "#1976D2",
        "icon": "📄",
        "shot": "05_presupuestos.jpg",
        "description": (
            "Rellena un formulario con datos del cliente, equipos, firmas, observaciones… "
            "y la app genera el PDF del presupuesto usando tu plantilla oficial. Listo para enviar."
        ),
        "benefits": [
            "Plantillas corporativas aplicadas automáticamente",
            "Firmas digitales del cliente y de i-SAI",
            "Genera PDFs profesionales en segundos",
        ],
        "howto": [
            "Pulsas 'Proyecto nuevo' o enlazas a uno existente",
            "Rellenas los campos del formulario",
            "Descargas o envías el PDF generado",
        ],
    },
    {
        "num": "06",
        "title": "CRM SAT",
        "subtitle": "Servicio técnico integral",
        "color": "#EC4899",
        "icon": "🎧",
        "shot": "06_sat_incidencias.jpg",
        "description": (
            "Gestión de incidencias con tres estados: pendientes, agendadas y resueltas. "
            "Historial completo de comentarios y cambios de estado con trazabilidad "
            "de quién hizo qué y cuándo."
        ),
        "benefits": [
            "Historial auditable de cada incidencia",
            "Reagendamiento con fecha y hora específicas",
            "Comentarios obligatorios al cambiar de estado",
        ],
        "howto": [
            "Ves las incidencias entrantes en 'Avisos recibidos'",
            "Las marcas como 'Resuelta' (con comentario) o las reagendas",
            "Cuando llega la fecha agendada, vuelven a Pendiente automáticamente",
        ],
    },
    {
        "num": "07",
        "title": "Formulario público SAT",
        "subtitle": "Tus clientes reportan sin login",
        "color": "#8B5CF6",
        "icon": "✉️",
        "shot": "08_aviso_sat.jpg",
        "description": (
            "Una URL pública que puedes enviar por email o WhatsApp a tus clientes. "
            "Ellos rellenan sus datos y la incidencia, y ésta llega automáticamente a "
            "tu CRM SAT con notificación instantánea."
        ),
        "benefits": [
            "Sin login para el cliente: fricción cero",
            "Auto-vinculación con el catálogo de clientes",
            "Notificación instantánea al equipo SAT",
        ],
        "howto": [
            "Copias la URL del CRM (botón 'URL cliente')",
            "La compartes por WhatsApp, email o la pones en tu web",
            "Cada aviso aparece en tiempo real en tu panel",
        ],
    },
    {
        "num": "08",
        "title": "Catálogo de clientes",
        "subtitle": "Importable desde Excel",
        "color": "#10B981",
        "icon": "👥",
        "shot": "07_sat_clientes.jpg",
        "description": (
            "Base de datos de todos tus clientes SAT importada desde Excel. Puedes crear "
            "una nueva incidencia para cualquier cliente con un clic o ver el histórico "
            "completo de avisos por cliente."
        ),
        "benefits": [
            "Importación masiva desde Excel (sin teclear nada)",
            "'Ver incidencias' muestra todo el historial del cliente",
            "Búsqueda rápida por nombre, dirección o contacto",
        ],
        "howto": [
            "Pulsas 'Cargar Excel' y seleccionas el fichero",
            "La app crea o actualiza clientes automáticamente",
            "Cada ficha tiene su botón 'Ver incidencias' e 'Incidencia nueva'",
        ],
    },
    {
        "num": "09",
        "title": "Gestión de usuarios",
        "subtitle": "Roles y permisos",
        "color": "#0B2545",
        "icon": "🛡️",
        "shot": "09_usuarios.jpg",
        "description": (
            "Tres roles: Administrador, Técnico y Comercial. Cada uno ve y puede editar "
            "sólo lo que le corresponde. El administrador crea y gestiona los usuarios "
            "desde esta pantalla."
        ),
        "benefits": [
            "Separación clara de responsabilidades",
            "Autenticación segura con JWT",
            "Colores personalizados por técnico (calendario)",
        ],
        "howto": [
            "Sólo el Administrador ve este módulo",
            "Crea usuarios con su email, rol y color",
            "Los usuarios entran con su email y contraseña",
        ],
    },
]


def _module_block(m: dict, flip: bool) -> str:
    shot_b64 = _img_b64(m["shot"])
    benefits = "".join(
        f'<li><span class="dot" style="background:{m["color"]}"></span>{b}</li>'
        for b in m["benefits"]
    )
    howto = "".join(
        f'<li><span class="step-num" style="background:{m["color"]}">{i + 1}</span>'
        f"<span>{h}</span></li>"
        for i, h in enumerate(m["howto"])
    )
    cls = "module-row flip" if flip else "module-row"
    return f"""
    <div class="{cls}">
      <div class="module-shot">
        <img src="{shot_b64}" alt="{m['title']}"/>
      </div>
      <div class="module-text">
        <div class="module-head">
          <div class="module-icon" style="background:{m['color']}18;border-color:{m['color']}">{m['icon']}</div>
          <div>
            <div class="module-num" style="color:{m['color']}">{m['num']}</div>
            <h3 class="module-title">{m['title']}</h3>
            <p class="module-sub">{m['subtitle']}</p>
          </div>
        </div>
        <p class="module-desc">{m['description']}</p>
        <p class="module-section-title">BENEFICIOS</p>
        <ul class="benefits">{benefits}</ul>
        <p class="module-section-title">¿CÓMO SE USA?</p>
        <ul class="steps">{howto}</ul>
      </div>
    </div>
    """


def build_portfolio_html() -> str:
    """Assemble the full HTML portfolio."""
    hero_shot = _img_b64("10_login.jpg")

    modules_html = "".join(
        _module_block(m, flip=(i % 2 == 1)) for i, m in enumerate(MODULES)
    )

    css = """
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif;
        background: #F4F7FB; color: #0F172A; line-height: 1.5;
        -webkit-font-smoothing: antialiased;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      img { display: block; max-width: 100%; height: auto; }
      h1, h2, h3, h4 { letter-spacing: -0.4px; }

      /* Top bar */
      .topbar {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 24px; background: #fff; border-bottom: 1px solid #E2E8F0;
        flex-wrap: wrap; gap: 12px; position: sticky; top: 0; z-index: 10;
      }
      .brand { display: flex; align-items: center; gap: 10px; }
      .brand-mark {
        width: 40px; height: 40px; border-radius: 10px; background: #1976D2;
        color: #fff; font-weight: 900; font-size: 22px;
        display: flex; align-items: center; justify-content: center;
      }
      .brand-title { font-size: 18px; font-weight: 900; color: #0B2545; }
      .brand-sub { font-size: 11px; color: #475569; font-weight: 600; margin-top: 2px; }
      .top-actions { display: flex; gap: 10px; }
      .btn {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 10px 14px; border-radius: 8px; font-weight: 800;
        font-size: 13px; text-decoration: none; cursor: pointer; border: none;
      }
      .btn-primary { background: #1976D2; color: #fff; }
      .btn-primary:hover { background: #1565C0; }
      .btn-secondary { background: #fff; color: #1976D2; border: 1px solid #1976D2; }
      .btn-secondary:hover { background: #EFF6FF; }

      /* Hero */
      .hero {
        display: flex; gap: 40px; align-items: center; flex-wrap: wrap;
        padding: 56px 32px; max-width: 1200px; margin: 0 auto;
      }
      .hero-text { flex: 1; min-width: 320px; }
      .kicker {
        font-size: 12px; font-weight: 900; color: #1976D2;
        letter-spacing: 2px; margin-bottom: 12px;
      }
      .hero h1 {
        font-size: 44px; font-weight: 900; color: #0B2545; line-height: 1.15;
        letter-spacing: -1.2px;
      }
      .hero h1 .accent { color: #1976D2; }
      .hero-lead {
        font-size: 17px; color: #475569; line-height: 1.6;
        margin-top: 18px; font-weight: 500; max-width: 560px;
      }
      .badges { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 22px; }
      .badge {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 7px 12px; border-radius: 999px;
        background: #E6F0FB; border: 1px solid #BFDBFE;
        font-size: 12px; font-weight: 700; color: #1976D2;
      }
      .hero-img {
        flex: 1; min-width: 320px;
        padding: 10px; background: #fff; border: 1px solid #E2E8F0;
        border-radius: 16px; box-shadow: 0 2px 20px rgba(15,23,42,0.05);
      }

      /* Sections */
      section.section { padding: 56px 32px; }
      section.alt { background: #EEF3FA; }
      section.section .section-title {
        font-size: 32px; font-weight: 900; color: #0B2545;
        text-align: center; letter-spacing: -0.8px;
        max-width: 900px; margin: 0 auto;
      }
      section.section .section-lead {
        font-size: 16px; color: #475569; text-align: center;
        margin: 10px auto 0; max-width: 680px; line-height: 1.5;
      }

      /* Advantages */
      .adv-grid {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 20px; max-width: 1100px; margin: 32px auto 0;
      }
      .adv-card {
        background: #fff; border-radius: 16px; padding: 24px;
        border: 1px solid #E2E8F0;
      }
      .adv-icon {
        width: 48px; height: 48px; border-radius: 12px;
        display: flex; align-items: center; justify-content: center;
        font-size: 22px; margin-bottom: 14px;
      }
      .adv-card h3 { font-size: 18px; font-weight: 900; color: #0B2545; margin-bottom: 6px; }
      .adv-card p { font-size: 14px; color: #475569; line-height: 1.55; font-weight: 500; }

      /* Roles */
      .roles-grid {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 20px; max-width: 1100px; margin: 32px auto 0;
      }
      .role-card {
        background: #fff; border-radius: 16px; padding: 24px;
        border: 1px solid #E2E8F0;
      }
      .role-badge {
        width: 44px; height: 44px; border-radius: 22px;
        display: flex; align-items: center; justify-content: center;
        color: #fff; font-size: 20px; margin-bottom: 12px;
      }
      .role-card h3 { font-size: 20px; font-weight: 900; color: #0B2545; margin-bottom: 14px; }
      .role-card ul { list-style: none; }
      .role-card li {
        display: flex; gap: 8px; align-items: center; margin-bottom: 8px;
        font-size: 14px; color: #0F172A; font-weight: 600;
      }
      .role-card li::before { content: "✓"; color: #10B981; font-weight: 900; }

      /* Modules */
      .modules-wrap { max-width: 1200px; margin: 0 auto; }
      .module-row {
        display: flex; gap: 40px; align-items: center;
        padding: 40px 0; flex-wrap: wrap;
      }
      .module-row.flip { flex-direction: row-reverse; }
      .module-shot {
        flex: 1; min-width: 300px;
        background: #fff; border: 1px solid #E2E8F0;
        border-radius: 16px; padding: 8px; overflow: hidden;
        box-shadow: 0 2px 16px rgba(15,23,42,0.06);
      }
      .module-shot img {
        width: 100%; max-height: 420px; object-fit: contain;
        border-radius: 8px;
      }
      .module-text { flex: 1; min-width: 300px; }
      .module-head {
        display: flex; gap: 14px; align-items: flex-start; margin-bottom: 18px;
      }
      .module-icon {
        width: 54px; height: 54px; border-radius: 14px;
        display: flex; align-items: center; justify-content: center;
        font-size: 26px; border: 2px solid;
      }
      .module-num { font-size: 13px; font-weight: 900; letter-spacing: 1px; }
      .module-title {
        font-size: 28px; font-weight: 900; color: #0B2545;
        letter-spacing: -0.5px; margin-top: 4px;
      }
      .module-sub { font-size: 14px; color: #475569; font-weight: 600; margin-top: 2px; }
      .module-desc { font-size: 15px; color: #0F172A; line-height: 1.6;
                     font-weight: 500; margin-bottom: 18px; }
      .module-section-title {
        font-size: 11px; font-weight: 900; color: #94A3B8;
        letter-spacing: 1.5px; margin: 10px 0;
      }
      .benefits, .steps { list-style: none; }
      .benefits li {
        display: flex; gap: 10px; align-items: center; margin-bottom: 8px;
        font-size: 14px; color: #0F172A; font-weight: 600;
      }
      .benefits .dot {
        width: 8px; height: 8px; border-radius: 4px; flex-shrink: 0;
      }
      .steps li {
        display: flex; gap: 10px; align-items: flex-start; margin-bottom: 10px;
        font-size: 14px; color: #0F172A; font-weight: 500; line-height: 1.45;
      }
      .steps .step-num {
        width: 24px; height: 24px; border-radius: 12px; color: #fff;
        font-weight: 900; font-size: 12px; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        margin-top: 1px;
      }

      /* Use cases */
      .cases-grid {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px; max-width: 1200px; margin: 32px auto 0;
      }
      .case-card {
        background: #fff; border-radius: 16px; padding: 24px;
        border: 1px solid #E2E8F0;
      }
      .case-icon {
        width: 44px; height: 44px; border-radius: 12px; background: #E6F0FB;
        display: flex; align-items: center; justify-content: center;
        font-size: 20px; margin-bottom: 14px;
      }
      .case-card h3 { font-size: 17px; font-weight: 900; color: #0B2545; margin-bottom: 16px; }
      .case-card ol { list-style: none; counter-reset: step; }
      .case-card li {
        counter-increment: step;
        display: flex; gap: 10px; align-items: flex-start; margin-bottom: 10px;
        font-size: 13.5px; color: #0F172A; font-weight: 500; line-height: 1.45;
      }
      .case-card li::before {
        content: counter(step);
        width: 22px; height: 22px; border-radius: 11px;
        background: #1976D2; color: #fff; text-align: center;
        font-weight: 900; font-size: 12px; line-height: 22px; flex-shrink: 0;
      }

      /* Tech */
      .tech-grid {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px; max-width: 1100px; margin: 32px auto 0;
      }
      .tech-card {
        background: #fff; border-radius: 14px; padding: 20px;
        border: 1px solid #E2E8F0;
      }
      .tech-card .tech-icon { font-size: 26px; margin-bottom: 8px; }
      .tech-card h3 { font-size: 15px; font-weight: 900; color: #0B2545; margin-top: 4px; }
      .tech-card p { font-size: 13px; color: #475569; line-height: 1.45; font-weight: 500; margin-top: 6px; }

      /* CTA */
      .cta {
        margin: 20px 32px; padding: 40px; border-radius: 24px;
        background: #0B2545; color: #fff; text-align: center;
        max-width: 1000px; margin-left: auto; margin-right: auto;
      }
      .cta h2 { font-size: 28px; font-weight: 900; letter-spacing: -0.6px; }
      .cta p { font-size: 15px; color: #CBD5E1; max-width: 600px;
               margin: 10px auto 22px; line-height: 1.5; }
      .cta .cta-buttons { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
      .cta .btn-primary { background: #1976D2; }
      .cta .btn-secondary { background: #fff; color: #1976D2; border: none; }

      /* Footer */
      .footer {
        padding: 32px 24px; text-align: center;
      }
      .footer p { font-size: 13px; font-weight: 800; color: #0B2545; }
      .footer small { font-size: 12px; color: #94A3B8; font-weight: 600; display: block; margin-top: 4px; }

      /* ========== PRINT ========== */
      @media print {
        @page { size: A4; margin: 8mm; }
        @page :first { margin-top: 8mm; }

        html, body {
          background: #fff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        .no-print { display: none !important; }

        /* Topbar slim */
        .topbar {
          position: static !important; box-shadow: none !important;
          padding: 6px 10px !important; border-bottom: 2px solid #1976D2 !important;
          break-after: avoid-page;
        }
        .brand-mark { width: 28px !important; height: 28px !important; font-size: 15px !important; border-radius: 7px !important; }
        .brand-title { font-size: 14px !important; }
        .brand-sub { font-size: 9px !important; }

        /* Hero compact and coloured */
        .hero {
          padding: 14px 14px 18px !important;
          background: linear-gradient(180deg,#F4F7FB 0%,#E6F0FB 100%) !important;
          break-inside: avoid; break-after: auto;
          gap: 16px !important;
        }
        .kicker { font-size: 10px !important; margin-bottom: 6px !important; letter-spacing: 1.5px !important; }
        .hero h1 { font-size: 24px !important; line-height: 1.12 !important; letter-spacing: -0.8px !important; }
        .hero-lead { font-size: 11.5px !important; margin-top: 8px !important; line-height: 1.5 !important; }
        .badges { margin-top: 10px !important; gap: 6px !important; }
        .badge { padding: 4px 9px !important; font-size: 10px !important; }
        .hero-img { padding: 4px !important; max-height: 190px !important; overflow: hidden; border-radius: 10px !important; }
        .hero-img img { max-height: 180px !important; width: 100% !important; object-fit: contain !important; }

        /* Sections layout */
        section.section { padding: 14px 14px !important; break-inside: auto !important; }
        section.alt { background: #EEF3FA !important; }
        section.section .section-title {
          font-size: 18px !important; letter-spacing: -0.4px !important;
          break-after: avoid-page !important; page-break-after: avoid !important;
        }
        section.section .section-lead {
          font-size: 11px !important; margin-top: 4px !important;
          break-after: avoid-page !important; page-break-after: avoid !important;
        }
        /* Keep title+lead with the grid/content that follows */
        .adv-grid, .roles-grid, .cases-grid, .tech-grid, .modules-wrap {
          break-before: avoid-page !important;
        }

        /* Module rows: compact side-by-side */
        .module-row, .module-row.flip {
          display: flex !important;
          flex-direction: row !important;
          gap: 12px !important;
          padding: 6px 0 !important;
          margin: 4px 0 !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          align-items: flex-start !important;
          border-top: 1px dashed #E2E8F0 !important;
        }
        .module-row:first-of-type { border-top: none !important; padding-top: 0 !important; }
        .module-shot {
          flex: 0 0 38% !important;
          max-width: 38% !important;
          padding: 3px !important;
          margin: 0 !important;
          background: #fff !important;
          border: 1px solid #E2E8F0 !important;
          border-radius: 6px !important;
          box-shadow: none !important;
        }
        .module-shot img {
          max-height: 140px !important;
          width: 100% !important;
          object-fit: contain !important;
          border-radius: 3px !important;
        }
        .module-text { flex: 1 !important; min-width: 0 !important; }
        .module-head { margin-bottom: 4px !important; gap: 6px !important; }
        .module-icon { width: 28px !important; height: 28px !important; font-size: 14px !important; border-radius: 6px !important; border-width: 1.5px !important; }
        .module-num { font-size: 9px !important; letter-spacing: 0.8px !important; }
        .module-title { font-size: 13px !important; letter-spacing: -0.3px !important; margin-top: 0 !important; }
        .module-sub { font-size: 9.5px !important; margin-top: 0 !important; }
        .module-desc { font-size: 10px !important; line-height: 1.38 !important; margin-bottom: 4px !important; }
        .module-section-title { font-size: 8px !important; margin: 2px 0 2px !important; letter-spacing: 0.8px !important; }
        .benefits li, .steps li { font-size: 9.5px !important; margin-bottom: 2px !important; line-height: 1.28 !important; }
        .benefits .dot { width: 5px !important; height: 5px !important; }
        .steps .step-num { width: 13px !important; height: 13px !important; font-size: 8px !important; line-height: 13px !important; }

        /* Grids compact 3-col */
        .adv-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 8px !important; margin-top: 10px !important; }
        .roles-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 8px !important; margin-top: 10px !important; }
        .cases-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 8px !important; margin-top: 10px !important; }
        /* Tech: 6 columns = single row → saves ~half a page */
        .tech-grid { grid-template-columns: repeat(6, 1fr) !important; gap: 6px !important; margin-top: 10px !important; }

        .adv-card, .role-card, .case-card, .tech-card {
          padding: 10px !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          border-radius: 10px !important;
          background: #fff !important;
        }
        .adv-icon, .role-badge, .case-icon {
          width: 30px !important; height: 30px !important; font-size: 15px !important;
          margin-bottom: 6px !important; border-radius: 8px !important;
        }
        .adv-card h3, .role-card h3, .case-card h3 {
          font-size: 12px !important; margin-bottom: 4px !important;
        }
        .adv-card p { font-size: 10.5px !important; line-height: 1.38 !important; }
        .role-card li, .case-card li {
          font-size: 10px !important; margin-bottom: 3px !important; line-height: 1.32 !important; gap: 4px !important;
        }
        .case-card li::before {
          width: 15px !important; height: 15px !important; line-height: 15px !important; font-size: 9px !important;
        }
        .tech-card .tech-icon { font-size: 18px !important; margin-bottom: 3px !important; }
        .tech-card h3 { font-size: 11px !important; margin-top: 2px !important; }
        .tech-card p { font-size: 10px !important; line-height: 1.35 !important; margin-top: 3px !important; }

        /* Keep entire grids whole when possible, but allow individual cards to flow
           to the next page (never split a card, just move it whole). */
        .adv-grid, .roles-grid {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        /* cases-grid and tech-grid can span pages – keeps previous module rows on same page. */
        .cases-grid, .tech-grid { break-inside: auto !important; }

        /* Hide CTA on print - redundant in PDF (no clickable buttons) */
        .cta { display: none !important; }
        .footer {
          padding: 6px 8px !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          page-break-before: avoid !important;
          break-before: avoid !important;
        }
        .footer p { font-size: 10px !important; display: inline !important; }
        .footer small { font-size: 9px !important; display: inline !important; margin-left: 8px !important; margin-top: 0 !important; }

        /* Tech section: compact enough to stay with previous section when possible */
        section.section-tech {
          padding: 10px 14px !important;
          page-break-before: avoid !important;
          break-before: avoid !important;
        }
        section.section-tech .section-title { font-size: 15px !important; margin-bottom: 2px !important; }
        section.section-tech .section-lead { font-size: 10px !important; margin-top: 2px !important; }
        .tech-card { padding: 8px 6px !important; text-align: center; }
        .tech-card .tech-icon { font-size: 16px !important; margin-bottom: 2px !important; }
        .tech-card h3 { font-size: 10px !important; margin-top: 2px !important; }
        .tech-card p { font-size: 9px !important; line-height: 1.3 !important; margin-top: 2px !important; }

        /* Never break inside small key elements */
        h1, h2, h3, h4 { break-after: avoid !important; page-break-after: avoid !important; }
        h1, h2, h3, h4, p, li { break-inside: avoid !important; orphans: 3; widows: 3; }
      }

      /* Mobile */
      @media (max-width: 720px) {
        .hero h1 { font-size: 32px; }
        section.section .section-title { font-size: 24px; }
        .module-title { font-size: 22px; }
      }
    """

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5"/>
<meta name="description" content="i-SAI — Gestor integral de proyectos, CRM SAT, calendario y presupuestos para empresas de instalación."/>
<title>i-SAI — Gestor integral de proyectos</title>
<style>{css}</style>
</head>
<body>

<header class="topbar">
  <div class="brand">
    <div class="brand-mark">i</div>
    <div>
      <div class="brand-title">i-SAI</div>
      <div class="brand-sub">Partner SALTO · Materiales · Proyectos</div>
    </div>
  </div>
  <div class="top-actions no-print">
    <button class="btn btn-primary" onclick="window.print()">🖨️ Imprimir / PDF</button>
    <a class="btn btn-secondary" href="/login">↪ Entrar a la app</a>
  </div>
</header>

<section class="hero">
  <div class="hero-text">
    <p class="kicker">PRESENTACIÓN DE PRODUCTO</p>
    <h1>El gestor integral de<br/><span class="accent">proyectos, SAT y equipos</span></h1>
    <p class="hero-lead">
      Una sola aplicación para controlar proyectos sincronizados con OneDrive,
      planificar tu equipo en el calendario, gestionar incidencias de clientes
      y generar presupuestos — desde el móvil o desde el ordenador.
    </p>
    <div class="badges">
      <span class="badge">📱 iOS · Android</span>
      <span class="badge">💻 Web · Desktop</span>
      <span class="badge">☁️ OneDrive</span>
      <span class="badge">🛡️ Roles &amp; permisos</span>
    </div>
  </div>
  <div class="hero-img">
    <img src="{hero_shot}" alt="Pantalla de login i-SAI"/>
  </div>
</section>

<section class="section">
  <h2 class="section-title">¿Por qué i-SAI?</h2>
  <div class="adv-grid">
    <div class="adv-card">
      <div class="adv-icon" style="background:#1976D220">🔄</div>
      <h3>Sincronización total</h3>
      <p>Tu Excel de OneDrive sigue siendo la fuente. Nada duplicado.</p>
    </div>
    <div class="adv-card">
      <div class="adv-icon" style="background:#F59E0B20">⚡</div>
      <h3>Planificación ágil</h3>
      <p>Drag &amp; drop, multi-técnico y notificaciones en tiempo real.</p>
    </div>
    <div class="adv-card">
      <div class="adv-icon" style="background:#10B98120">😊</div>
      <h3>Clientes contentos</h3>
      <p>Formulario público para SAT + historial completo de incidencias.</p>
    </div>
  </div>
</section>

<section class="section alt">
  <h2 class="section-title">Tres roles, tres experiencias</h2>
  <p class="section-lead">Cada usuario ve y puede hacer sólo lo que le corresponde.</p>
  <div class="roles-grid">
    <div class="role-card">
      <div class="role-badge" style="background:#EF4444">🛡️</div>
      <h3>Administrador</h3>
      <ul>
        <li>Gestiona usuarios</li>
        <li>Acceso a todo</li>
        <li>Importa clientes desde Excel</li>
        <li>Configura OneDrive</li>
      </ul>
    </div>
    <div class="role-card">
      <div class="role-badge" style="background:#1976D2">🔧</div>
      <h3>Técnico</h3>
      <ul>
        <li>Ve sus eventos del calendario</li>
        <li>Edita proyectos asignados</li>
        <li>Resuelve incidencias SAT</li>
        <li>Dibuja sobre planos</li>
      </ul>
    </div>
    <div class="role-card">
      <div class="role-badge" style="background:#8B5CF6">💼</div>
      <h3>Comercial</h3>
      <ul>
        <li>Crea presupuestos</li>
        <li>Consulta proyectos</li>
        <li>Gestiona clientes</li>
        <li>Obtiene firma digital</li>
      </ul>
    </div>
  </div>
</section>

<section class="section">
  <h2 class="section-title">Los módulos</h2>
  <p class="section-lead">
    Nueve bloques conectados entre sí. Cada uno enfocado a una tarea y diseñado para el móvil.
  </p>
  <div class="modules-wrap">
    {modules_html}
  </div>
</section>

<section class="section alt">
  <h2 class="section-title">Casos de uso reales</h2>
  <p class="section-lead">
    Tres flujos que tu equipo vive cada semana — y cómo i-SAI los simplifica.
  </p>
  <div class="cases-grid">
    <div class="case-card">
      <div class="case-icon">🔨</div>
      <h3>Instalación en nuevo cliente</h3>
      <ol>
        <li>Comercial importa el proyecto desde OneDrive</li>
        <li>Admin asigna al técnico en el calendario (drag &amp; drop)</li>
        <li>Técnico abre el evento, revisa plano y piezas asignadas</li>
        <li>Tras la visita, genera presupuesto desde la app</li>
        <li>Cliente firma digitalmente → PDF enviado</li>
      </ol>
    </div>
    <div class="case-card">
      <div class="case-icon">⚠️</div>
      <h3>Avería reportada por un cliente</h3>
      <ol>
        <li>Cliente rellena el formulario público <code>/aviso-sat</code> (sin login)</li>
        <li>La incidencia entra en el CRM SAT del equipo</li>
        <li>Admin asigna al técnico disponible en el calendario</li>
        <li>Técnico resuelve y añade comentario</li>
        <li>Incidencia marcada como 'Resuelta' con trazabilidad completa</li>
      </ol>
    </div>
    <div class="case-card">
      <div class="case-icon">📅</div>
      <h3>Planificación semanal del equipo</h3>
      <ol>
        <li>Admin abre el calendario y ve todos los eventos de la semana</li>
        <li>Arrastra los eventos pendientes a técnicos disponibles</li>
        <li>Asigna multi-técnico para trabajos grandes</li>
        <li>Cada técnico recibe notificación automática</li>
        <li>Los eventos quedan accesibles desde el móvil del técnico</li>
      </ol>
    </div>
  </div>
</section>

<section class="section section-tech">
  <h2 class="section-title">Tecnología</h2>
  <p class="section-lead">Un stack moderno, probado y mantenible.</p>
  <div class="tech-grid">
    <div class="tech-card">
      <div class="tech-icon" style="color:#1976D2">📱</div>
      <h3>React Native + Expo</h3>
      <p>Una única base de código para iOS, Android y Web.</p>
    </div>
    <div class="tech-card">
      <div class="tech-icon" style="color:#F59E0B">⚡</div>
      <h3>FastAPI (Python)</h3>
      <p>API ágil, asíncrona y lista para integraciones externas.</p>
    </div>
    <div class="tech-card">
      <div class="tech-icon" style="color:#8B5CF6">🗄️</div>
      <h3>MongoDB</h3>
      <p>Base de datos flexible que crece contigo.</p>
    </div>
    <div class="tech-card">
      <div class="tech-icon" style="color:#10B981">☁️</div>
      <h3>Microsoft Graph API</h3>
      <p>Conexión directa con OneDrive y Excel.</p>
    </div>
    <div class="tech-card">
      <div class="tech-icon" style="color:#EF4444">🔒</div>
      <h3>JWT + Bcrypt</h3>
      <p>Autenticación segura estándar del sector.</p>
    </div>
    <div class="tech-card">
      <div class="tech-icon" style="color:#EC4899">📐</div>
      <h3>Responsive nativo</h3>
      <p>Interfaz optimizada para móvil y escritorio.</p>
    </div>
  </div>
</section>

<section class="cta no-print">
  <h2>¿Hablamos?</h2>
  <p>
    i-SAI está listo para adaptarse a tu empresa. Agenda una demo o pruébalo desde tu móvil.
  </p>
  <div class="cta-buttons">
    <button class="btn btn-primary" onclick="window.print()">⬇ Descargar PDF</button>
    <a class="btn btn-secondary" href="/login">↪ Entrar a la app</a>
  </div>
</section>

<footer class="footer">
  <p>i-SAI · Partner SALTO · Materiales y Proyectos</p>
  <small>© 2026 i-SAI. Gestor integral de proyectos.</small>
</footer>

</body>
</html>
"""
