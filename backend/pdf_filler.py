"""
Rellenar el template PDF 'Hoja de instalación' con datos de presupuesto,
manteniendo el layout exacto del original y dejando los campos editables
(AcroForm text fields).

Uso:
    from pdf_filler import build_budget_pdf
    pdf_bytes = build_budget_pdf(budget_dict)
"""
from __future__ import annotations

import base64
import io
import os
from pathlib import Path
from typing import Any, Dict, List, Tuple

from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    BooleanObject,
    DictionaryObject,
    FloatObject,
    IndirectObject,
    NameObject,
    NumberObject,
    TextStringObject,
)
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as rl_canvas

TEMPLATE_PATH = str(Path(__file__).parent / "templates" / "hoja_instalacion.pdf")

# PDF is A4 (595.35 x 841.95 pt). Coordinates measured from bottom-left.
# ---- PAGE 0 FIELDS ----
PAGE0_FIELDS: List[Dict[str, Any]] = [
    # key, rect (x1,y1,x2,y2), multiline
    {"key": "n_proyecto",             "rect": (130, 722, 585, 746), "multiline": False},
    {"key": "cliente",                "rect": (130, 681, 585, 705), "multiline": False},
    {"key": "nombre_instalacion",     "rect": (130, 642, 585, 682), "multiline": False},
    {"key": "direccion",              "rect": (130, 602, 585, 625), "multiline": False},
    {"key": "contacto_1",             "rect": (130, 522, 585, 590), "multiline": True},
    {"key": "contacto_2",             "rect": (130, 412, 585, 492), "multiline": True},
    {"key": "observaciones_presupuesto", "rect": (130, 258, 585, 405), "multiline": True},
    {"key": "fecha_inicio",           "rect": (130, 224, 280, 248), "multiline": False},
    {"key": "fecha_fin",              "rect": (330, 224, 485, 248), "multiline": False},
    {"key": "observaciones_ejecucion","rect": (130,  40, 585, 155), "multiline": True},
]

# ---- PAGE 1 FIELDS ----
# Equipment table: columns (element has a small checkbox at left + text,
# then CANT, UBICACION, OBSERVACIONES). We'll place text fields per row.
EQ_TABLE_TOP = 752     # Y of first row (top of first row)
EQ_ROW_HEIGHT = 22     # approximate spacing per row
EQ_ROWS = 20           # reserve 20 rows
# Column rectangles (x1..x2) — measured from the template
EQ_COL_ELEMENT   = (82,  190)   # element text (checkbox ~ 65..78)
EQ_COL_CANT      = (192, 240)
EQ_COL_UBICACION = (242, 368)
EQ_COL_OBSERV    = (370, 555)
EQ_CHECK_X       = 68
EQ_CHECK_SIZE    = 10

# Delivery checkboxes (before signatures)
DELIV_X = 52
DELIV_SIZE = 12
DELIVERIES = [
    {"key": "entrega_tarjeta_mantenimiento", "y": 263},
    {"key": "entrega_llave_salto",           "y": 240},
    {"key": "entrega_eps100",                "y": 217},
]

# Signatures (base64 PNG) — positioned below "FIRMA I-SAI" / "FIRMA CLIENTE" labels at y≈149
SIG_ISAI_RECT   = (55,  60, 275, 140)
SIG_CLIENT_RECT = (310, 60, 540, 140)

# Name/cargo fields under each signature
NAME_ISAI_RECT   = (55,  38, 275, 55)
CARGO_ISAI_RECT  = (55,  20, 275, 37)
NAME_CLIENT_RECT = (310, 38, 540, 55)
CARGO_CLIENT_RECT= (310, 20, 540, 37)


# ---------------------------------------------------------------------------
# Overlay rendering
# ---------------------------------------------------------------------------
def _build_overlay(budget: Dict[str, Any]) -> bytes:
    """
    Generate a 2-page A4 PDF overlay that draws:
      - text values at the coordinates of each editable field,
      - a ☑ mark for each delivery checkbox that is True,
      - signature images for firma_isai / firma_cliente if present,
      - for each equipment row: a ☑/☐ mark + element text + cantidad/ubicación/observaciones.
    The output is merged on top of the template and OVER the AcroForm
    widgets so that when rendered the values are visible even before the
    AcroForm layer is edited.  The AcroForm widgets themselves are still
    editable (see _attach_formfields).
    """
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=A4)
    W, H = A4  # 595.27, 841.89 -> close enough to template 595.35 / 841.95

    # Helper: wrap text so it fits inside a rectangle width at given font size
    def _wrap(text: str, max_w: float, font="Helvetica", size=10):
        if not text:
            return []
        from reportlab.pdfbase.pdfmetrics import stringWidth
        lines = []
        for para in str(text).split("\n"):
            words = para.split(" ")
            cur = ""
            for w in words:
                nxt = (cur + " " + w).strip()
                if stringWidth(nxt, font, size) <= max_w:
                    cur = nxt
                else:
                    if cur:
                        lines.append(cur)
                    cur = w
            if cur:
                lines.append(cur)
        return lines

    def _draw_text_in_rect(text: str, x1, y1, x2, y2, font="Helvetica", size=10, multiline=False):
        if not text:
            return
        c.setFont(font, size)
        c.setFillColorRGB(0, 0, 0)
        if multiline:
            lines = _wrap(text, x2 - x1 - 4, font, size)
            cy = y2 - size - 1  # start near top
            for ln in lines:
                if cy < y1 + 2:
                    break
                c.drawString(x1 + 2, cy, ln)
                cy -= size + 2
        else:
            # Vertically center
            cy = (y1 + y2) / 2 - size / 2 + 1
            c.drawString(x1 + 2, cy, str(text))

    # ---- PAGE 0 ----
    for spec in PAGE0_FIELDS:
        v = budget.get(spec["key"], "") or ""
        _draw_text_in_rect(str(v), *spec["rect"], multiline=spec["multiline"])
    c.showPage()

    # ---- PAGE 1 ----
    # Equipment rows
    equipos = budget.get("equipos") or []
    c.setFont("Helvetica", 9)
    c.setFillColorRGB(0, 0, 0)
    for i, eq in enumerate(equipos[:EQ_ROWS]):
        row_top = EQ_TABLE_TOP - i * EQ_ROW_HEIGHT
        row_bot = row_top - EQ_ROW_HEIGHT + 2
        # checkbox at left — mark if there's any value
        checked = bool((eq.get("elemento") or "").strip())
        cx = EQ_CHECK_X
        cy = row_bot + (EQ_ROW_HEIGHT - EQ_CHECK_SIZE) / 2
        c.setLineWidth(0.6)
        c.rect(cx, cy, EQ_CHECK_SIZE, EQ_CHECK_SIZE, stroke=1, fill=0)
        if checked:
            # draw a check mark
            c.setStrokeColorRGB(0.18, 0.55, 0.9)
            c.setLineWidth(1.5)
            c.line(cx + 2, cy + EQ_CHECK_SIZE / 2,
                   cx + EQ_CHECK_SIZE / 2, cy + 2)
            c.line(cx + EQ_CHECK_SIZE / 2, cy + 2,
                   cx + EQ_CHECK_SIZE - 1, cy + EQ_CHECK_SIZE - 1)
            c.setStrokeColorRGB(0, 0, 0)
            c.setLineWidth(0.6)
        # element
        _draw_text_in_rect(eq.get("elemento") or "", EQ_COL_ELEMENT[0], row_bot, EQ_COL_ELEMENT[1], row_top, size=9)
        # cantidad
        _draw_text_in_rect(eq.get("cantidad") or "", EQ_COL_CANT[0], row_bot, EQ_COL_CANT[1], row_top, size=9)
        # ubicación
        _draw_text_in_rect(eq.get("ubicacion") or "", EQ_COL_UBICACION[0], row_bot, EQ_COL_UBICACION[1], row_top, size=9)
        # observaciones
        _draw_text_in_rect(eq.get("observaciones") or "", EQ_COL_OBSERV[0], row_bot, EQ_COL_OBSERV[1], row_top, size=9)

    # Delivery check marks
    for d in DELIVERIES:
        val = bool(budget.get(d["key"]))
        y = d["y"]
        c.setLineWidth(0.8)
        c.rect(DELIV_X, y - 1, DELIV_SIZE, DELIV_SIZE, stroke=1, fill=0)
        if val:
            c.setStrokeColorRGB(0.18, 0.55, 0.9)
            c.setLineWidth(1.8)
            c.line(DELIV_X + 2, y + DELIV_SIZE / 2 - 1,
                   DELIV_X + DELIV_SIZE / 2, y + 1)
            c.line(DELIV_X + DELIV_SIZE / 2, y + 1,
                   DELIV_X + DELIV_SIZE - 1, y + DELIV_SIZE - 1)
            c.setStrokeColorRGB(0, 0, 0)
            c.setLineWidth(0.8)

    # Signatures (base64 PNG/JPEG data URIs)
    def _draw_sig(data_uri: str, rect: Tuple[int, int, int, int]):
        if not data_uri:
            return
        try:
            b64 = data_uri
            if b64.startswith("data:"):
                b64 = b64.split(",", 1)[1]
            raw = base64.b64decode(b64)
            img = ImageReader(io.BytesIO(raw))
            x1, y1, x2, y2 = rect
            c.drawImage(img, x1, y1, width=x2 - x1, height=y2 - y1, mask="auto", preserveAspectRatio=True)
        except Exception as e:
            print("signature embed failed:", e)

    _draw_sig(budget.get("firma_isai") or "", SIG_ISAI_RECT)
    _draw_sig(budget.get("firma_cliente") or "", SIG_CLIENT_RECT)

    # Nombre/cargo under signatures
    _draw_text_in_rect(budget.get("nombre_isai") or "",   *NAME_ISAI_RECT,  size=9)
    _draw_text_in_rect(budget.get("cargo_isai") or "",    *CARGO_ISAI_RECT, size=9)
    _draw_text_in_rect(budget.get("nombre_cliente") or "", *NAME_CLIENT_RECT, size=9)
    _draw_text_in_rect(budget.get("cargo_cliente") or "",  *CARGO_CLIENT_RECT, size=9)

    c.showPage()
    c.save()
    return buf.getvalue()


# ---------------------------------------------------------------------------
# AcroForm field creation
# ---------------------------------------------------------------------------
def _attach_formfields(writer: PdfWriter, page_index: int, fields: List[Dict[str, Any]]):
    """
    Attach editable AcroForm text fields to a page of the writer.
    Each entry in `fields` is dict with:
        name (str), value (str), rect (x1,y1,x2,y2), multiline (bool)
    """
    for f in fields:
        name = f["name"]
        value = str(f.get("value") or "")
        rect = [FloatObject(v) for v in f["rect"]]
        # Flags: multiline = bit 13 (value 4096)
        field_flags = 4096 if f.get("multiline") else 0
        widget = DictionaryObject({
            NameObject("/Type"): NameObject("/Annot"),
            NameObject("/Subtype"): NameObject("/Widget"),
            NameObject("/FT"): NameObject("/Tx"),
            NameObject("/T"): TextStringObject(name),
            NameObject("/V"): TextStringObject(value),
            NameObject("/DV"): TextStringObject(value),
            NameObject("/Rect"): ArrayObject(rect),
            NameObject("/F"): NumberObject(4),  # printable
            NameObject("/Ff"): NumberObject(field_flags),
            NameObject("/DA"): TextStringObject("/Helv 0 Tf 0 g"),  # auto font size
            NameObject("/Border"): ArrayObject([NumberObject(0), NumberObject(0), NumberObject(0)]),
            NameObject("/MK"): DictionaryObject({
                NameObject("/BC"): ArrayObject([]),
                NameObject("/BG"): ArrayObject([]),
            }),
        })
        writer.add_annotation(page_number=page_index, annotation=widget)


def _attach_check_fields(writer: PdfWriter, page_index: int, checks: List[Dict[str, Any]]):
    """Attach AcroForm checkbox fields. Each check has name, value (bool), rect."""
    for c in checks:
        name = c["name"]
        on = bool(c.get("value"))
        rect = [FloatObject(v) for v in c["rect"]]
        widget = DictionaryObject({
            NameObject("/Type"): NameObject("/Annot"),
            NameObject("/Subtype"): NameObject("/Widget"),
            NameObject("/FT"): NameObject("/Btn"),
            NameObject("/T"): TextStringObject(name),
            NameObject("/V"): NameObject("/Yes") if on else NameObject("/Off"),
            NameObject("/AS"): NameObject("/Yes") if on else NameObject("/Off"),
            NameObject("/Rect"): ArrayObject(rect),
            NameObject("/F"): NumberObject(4),
            NameObject("/Ff"): NumberObject(0),
            NameObject("/DA"): TextStringObject("/ZaDb 0 Tf 0 g"),
            NameObject("/Border"): ArrayObject([NumberObject(0), NumberObject(0), NumberObject(0)]),
        })
        writer.add_annotation(page_number=page_index, annotation=widget)


def _ensure_acroform(writer: PdfWriter):
    """Ensure the writer has an /AcroForm with NeedAppearances=True so viewers
    will render field values without pre-computed appearance streams."""
    root = writer._root_object  # type: ignore[attr-defined]
    if "/AcroForm" not in root:
        root[NameObject("/AcroForm")] = DictionaryObject({
            NameObject("/NeedAppearances"): BooleanObject(True),
            NameObject("/Fields"): ArrayObject([]),
            NameObject("/DA"): TextStringObject("/Helv 10 Tf 0 g"),
        })
    else:
        af = root["/AcroForm"]
        af[NameObject("/NeedAppearances")] = BooleanObject(True)
        if "/DA" not in af:
            af[NameObject("/DA")] = TextStringObject("/Helv 10 Tf 0 g")


# ---------------------------------------------------------------------------
# Main build
# ---------------------------------------------------------------------------
def build_budget_pdf(budget: Dict[str, Any]) -> bytes:
    """
    Produce a filled & editable Hoja de Instalación PDF.

    Strategy:
      1) Open the template PDF (static background).
      2) Build an overlay PDF (reportlab) drawing ONLY values/signatures/
         checkmarks at the exact coordinates.
      3) Merge overlay *under* or *over* the template? We merge overlay
         OVER the template so text sits on top. But we also attach
         AcroForm widgets at the same coordinates, so the PDF stays
         editable. NeedAppearances=true forces viewers to re-render
         the form widgets (which will visually hide the overlay inside
         the widget rect when the user edits). This is the standard
         pattern used by many form-filling tools.
    """
    template = PdfReader(TEMPLATE_PATH)
    writer = PdfWriter()
    for p in template.pages:
        writer.add_page(p)

    # Build + merge overlay
    overlay_bytes = _build_overlay(budget)
    overlay = PdfReader(io.BytesIO(overlay_bytes))
    for i, page in enumerate(writer.pages):
        if i < len(overlay.pages):
            page.merge_page(overlay.pages[i])

    # Attach AcroForm widgets so the document is still editable
    _ensure_acroform(writer)

    # Page 0: text fields
    page0_fields_spec = [
        {"name": spec["key"], "value": budget.get(spec["key"], ""),
         "rect": spec["rect"], "multiline": spec["multiline"]}
        for spec in PAGE0_FIELDS
    ]
    _attach_formfields(writer, 0, page0_fields_spec)

    # Page 1: equipment rows as editable text fields
    equipos = list(budget.get("equipos") or [])
    # Pad to 20 rows
    while len(equipos) < EQ_ROWS:
        equipos.append({"elemento": "", "cantidad": "", "ubicacion": "", "observaciones": ""})
    page1_text_fields: List[Dict[str, Any]] = []
    page1_check_fields: List[Dict[str, Any]] = []
    for i, eq in enumerate(equipos[:EQ_ROWS]):
        row_top = EQ_TABLE_TOP - i * EQ_ROW_HEIGHT
        row_bot = row_top - EQ_ROW_HEIGHT + 2
        # Element checkbox (auto-checked if has value)
        cx = EQ_CHECK_X
        cy = row_bot + (EQ_ROW_HEIGHT - EQ_CHECK_SIZE) / 2
        page1_check_fields.append({
            "name": f"eq_check_{i+1}",
            "value": bool((eq.get("elemento") or "").strip()),
            "rect": (cx, cy, cx + EQ_CHECK_SIZE, cy + EQ_CHECK_SIZE),
        })
        page1_text_fields.extend([
            {"name": f"eq_elemento_{i+1}",     "value": eq.get("elemento") or "",
             "rect": (EQ_COL_ELEMENT[0], row_bot, EQ_COL_ELEMENT[1], row_top), "multiline": False},
            {"name": f"eq_cantidad_{i+1}",     "value": eq.get("cantidad") or "",
             "rect": (EQ_COL_CANT[0], row_bot, EQ_COL_CANT[1], row_top), "multiline": False},
            {"name": f"eq_ubicacion_{i+1}",    "value": eq.get("ubicacion") or "",
             "rect": (EQ_COL_UBICACION[0], row_bot, EQ_COL_UBICACION[1], row_top), "multiline": False},
            {"name": f"eq_observaciones_{i+1}", "value": eq.get("observaciones") or "",
             "rect": (EQ_COL_OBSERV[0], row_bot, EQ_COL_OBSERV[1], row_top), "multiline": False},
        ])

    # Delivery checkboxes
    for d in DELIVERIES:
        y = d["y"]
        page1_check_fields.append({
            "name": d["key"],
            "value": bool(budget.get(d["key"])),
            "rect": (DELIV_X, y - 1, DELIV_X + DELIV_SIZE, y - 1 + DELIV_SIZE),
        })

    # Name / cargo fields
    page1_text_fields.extend([
        {"name": "nombre_isai",    "value": budget.get("nombre_isai") or "",
         "rect": NAME_ISAI_RECT,  "multiline": False},
        {"name": "cargo_isai",     "value": budget.get("cargo_isai") or "",
         "rect": CARGO_ISAI_RECT, "multiline": False},
        {"name": "nombre_cliente", "value": budget.get("nombre_cliente") or "",
         "rect": NAME_CLIENT_RECT, "multiline": False},
        {"name": "cargo_cliente",  "value": budget.get("cargo_cliente") or "",
         "rect": CARGO_CLIENT_RECT, "multiline": False},
    ])

    _attach_formfields(writer, 1, page1_text_fields)
    _attach_check_fields(writer, 1, page1_check_fields)

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


if __name__ == "__main__":
    # Quick test
    sample = {
        "n_proyecto": "P-2025-042",
        "cliente": "ACME Corp.",
        "nombre_instalacion": "Sede Central Madrid",
        "direccion": "C/ Alcalá 123, 28009 Madrid",
        "contacto_1": "Juan Pérez — 666 111 222 — juan@acme.es",
        "contacto_2": "María López — 666 333 444",
        "observaciones_presupuesto": "Se incluye montaje y configuración de 10 cilindros electrónicos.",
        "fecha_inicio": "01/07/2025",
        "fecha_fin": "05/07/2025",
        "observaciones_ejecucion": "Instalación finalizada sin incidencias.",
        "equipos": [
            {"elemento": "Cilindro XS4", "cantidad": "10", "ubicacion": "Planta 1", "observaciones": "OK"},
            {"elemento": "Lector muro",   "cantidad": "2",  "ubicacion": "Acceso",   "observaciones": ""},
        ],
        "entrega_tarjeta_mantenimiento": True,
        "entrega_llave_salto": True,
        "entrega_eps100": False,
        "nombre_isai": "Ana García",
        "cargo_isai": "Técnico senior",
        "nombre_cliente": "Pedro Ruiz",
        "cargo_cliente": "Jefe de obra",
    }
    data = build_budget_pdf(sample)
    Path("/tmp/test_hoja.pdf").write_bytes(data)
    print("OK /tmp/test_hoja.pdf size=", len(data))
