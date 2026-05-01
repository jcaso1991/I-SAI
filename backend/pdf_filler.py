"""
Rellenar el template 'Hoja de instalación' SIN DUPLICAR campos:
- Abre el PDF original (que ya trae sus widgets AcroForm con posición y fuentes
  definidas por el diseñador).
- Para cada widget, escribe su /V y genera un /AP (Form XObject) que renderiza
  el valor con la MISMA fuente/tamaño que el widget declara en /DA.
- Para checkboxes, pone /V y /AS coherentes con /AP/N.
- Para firma_isai / firma_cliente, dibuja la imagen como overlay por encima.

De esta forma:
  - El PDF se ve 100% idéntico al template pero con los datos (sin fantasmas).
  - Los campos SIGUEN SIENDO EDITABLES (cualquier visor/editor PDF).
"""
from __future__ import annotations

import base64
import io
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    BooleanObject,
    ByteStringObject,
    DictionaryObject,
    FloatObject,
    IndirectObject,
    NameObject,
    NumberObject,
    StreamObject,
    TextStringObject,
)
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas as rl_canvas

TEMPLATE_PATH = str(Path(__file__).parent / "templates" / "hoja_instalacion.pdf")

# -----------------------------------------------------------------
# Mapping: budget_key -> widget_name (in the template PDF)
# -----------------------------------------------------------------
TEXT_FIELD_MAP: Dict[str, str] = {
    # page 0
    "n_proyecto":                "Text51",
    "cliente":                   "Text5",
    "nombre_instalacion":        "Text7",
    "direccion":                 "Text8",
    "contacto_1":                "Text9",
    "contacto_2":                "Text10",
    "observaciones_presupuesto": "Text11",
    "fecha_inicio":              "Date3",
    "fecha_fin":                 "Date4",
    "observaciones_ejecucion":   "Text12",
    # page 1 (signatures)
    "firma_isai_text":           "Text13",  # name/charge under FIRMA I-SAI
    "firma_cliente_text":        "Text14",  # name/charge under FIRMA CLIENTE
}

# Equipment rows: 14 rows available in the template
NUM_EQ_ROWS = 14

CHECKBOX_MAP: Dict[str, str] = {
    "entrega_tarjeta_mantenimiento": "Check Box1",
    "entrega_llave_salto":           "Check Box2",
    "entrega_eps100":                "Check Box3",
}

# Signature image positions (overlay on top of template)
# Signature pad on web is 400×140 (aspect 20:7); native capture matches view size.
# We fit the image into the rect below preserving aspect ratio, centred.
SIG_ISAI_RECT   = (55,  55, 275, 132)
SIG_CLIENT_RECT = (310, 55, 540, 135)


# -----------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------
def _pdf_escape(text: str) -> str:
    """Escape (, ), \\ inside a PDF literal string."""
    return (
        text.replace("\\", "\\\\")
            .replace("(", "\\(")
            .replace(")", "\\)")
    )


# Map a few "smart" Unicode chars to their WinAnsi equivalents (cp1252 already
# covers most, but Python's "replace" errors otherwise turn them into '?').
_WINANSI_REPLACEMENTS = {
    "\u2013": "-",    # en-dash
    "\u2014": "-",    # em-dash
    "\u2018": "'",
    "\u2019": "'",
    "\u201C": '"',
    "\u201D": '"',
    "\u2026": "...",
    "\u00A0": " ",    # non-breaking space
    "\u2022": "-",    # bullet
    "\u2192": "->",   # right arrow
}


def _encode_pdf_text(text: str) -> str:
    """
    Return a string safe to embed in a PDF content stream using
    WinAnsiEncoding. Any character that cp1252 cannot represent is
    substituted (see _WINANSI_REPLACEMENTS) or replaced with '?'.
    """
    if not text:
        return ""
    out_chars: List[str] = []
    for ch in text:
        rep = _WINANSI_REPLACEMENTS.get(ch)
        if rep is not None:
            out_chars.append(rep)
            continue
        try:
            ch.encode("cp1252")
            out_chars.append(ch)
        except Exception:
            out_chars.append("?")
    return "".join(out_chars)


def _parse_da(da: str, fallback_size: float = 10.0) -> Tuple[str, float, str]:
    """
    Parse a /DA (default appearance) string like '/Helvetica 13 Tf 0 g' into
    (font_resource_name, size, color_cmd).
    Returns font name WITHOUT the leading slash.
    """
    if not da:
        return ("Helv", fallback_size, "0 g")
    m = re.match(r"\s*/(\S+)\s+([\d.]+)\s+Tf\s+(.*)", da)
    if m:
        font = m.group(1)
        try:
            size = float(m.group(2))
        except Exception:
            size = fallback_size
        color = m.group(3).strip() or "0 g"
        return (font, size, color)
    return ("Helv", fallback_size, "0 g")


def _wrap_lines(text: str, max_w: float, font: str, size: float) -> List[str]:
    """Word-wrap to fit `max_w`. Preserves explicit newlines."""
    if not text:
        return []
    lines: List[str] = []
    # Use 'Helvetica' for metrics when font name is 'Helv' etc.
    metrics_font = "Helvetica"
    for para in str(text).split("\n"):
        words = para.split(" ")
        cur = ""
        for w in words:
            nxt = (cur + " " + w).strip() if cur else w
            try:
                width = stringWidth(nxt, metrics_font, size)
            except Exception:
                width = len(nxt) * size * 0.5
            if width <= max_w or not cur:
                cur = nxt
            else:
                lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
    return lines


def _shrink_font_to_fit(text: str, max_w: float, base_size: float, min_size: float = 6.0) -> float:
    """Reduce font size until single-line text fits in max_w."""
    size = base_size
    while size > min_size:
        try:
            w = stringWidth(str(text), "Helvetica", size)
        except Exception:
            w = len(str(text)) * size * 0.5
        if w <= max_w:
            break
        size -= 0.5
    return size


def _make_appearance(value: str, rect: Tuple[float, float, float, float],
                      font_name: str, font_size: float, color: str,
                      multiline: bool) -> StreamObject:
    """
    Build a Form XObject appearance stream rendering `value` inside a box of
    size rect.width x rect.height (local coordinates start at 0,0).
    The font referenced by /F0 is declared in /Resources (Helvetica WinAnsi).
    """
    x1, y1, x2, y2 = rect
    w = float(x2 - x1)
    h = float(y2 - y1)
    size = float(font_size or 10)

    if value and not multiline:
        size = _shrink_font_to_fit(str(value), w - 6, size)

    content_parts: List[str] = ["/Tx BMC", "q"]
    content_parts.append(f"1 1 {max(w - 2, 0):.3f} {max(h - 2, 0):.3f} re W n")
    content_parts.append(color)
    content_parts.append("BT")
    content_parts.append(f"/F0 {size:.2f} Tf")

    if value:
        if multiline:
            lines = _wrap_lines(str(value), w - 6, font_name, size)
            leading = size * 1.2
            top_y = h - size - 1
            content_parts.append(f"{leading:.2f} TL")
            content_parts.append(f"3 {top_y:.2f} Td")
            for i, ln in enumerate(lines):
                safe = _pdf_escape(_encode_pdf_text(ln))
                if i == 0:
                    content_parts.append(f"({safe}) Tj")
                else:
                    content_parts.append("T*")
                    content_parts.append(f"({safe}) Tj")
        else:
            baseline = (h - size) / 2 + size * 0.25
            content_parts.append(f"3 {baseline:.2f} Td")
            content_parts.append(f"({_pdf_escape(_encode_pdf_text(str(value)))}) Tj")

    content_parts.append("ET")
    content_parts.append("Q")
    content_parts.append("EMC")
    stream_bytes = "\n".join(content_parts).encode("cp1252", errors="replace")

    stream = StreamObject()
    stream.set_data(stream_bytes)
    stream.update({
        NameObject("/Type"):    NameObject("/XObject"),
        NameObject("/Subtype"): NameObject("/Form"),
        NameObject("/FormType"): NumberObject(1),
        NameObject("/BBox"): ArrayObject([
            FloatObject(0), FloatObject(0), FloatObject(w), FloatObject(h)
        ]),
        NameObject("/Resources"): DictionaryObject({
            NameObject("/ProcSet"): ArrayObject([NameObject("/PDF"), NameObject("/Text")]),
            NameObject("/Font"): DictionaryObject({
                NameObject("/F0"): DictionaryObject({
                    NameObject("/Type"):     NameObject("/Font"),
                    NameObject("/Subtype"):  NameObject("/Type1"),
                    NameObject("/BaseFont"): NameObject("/Helvetica"),
                    NameObject("/Encoding"): NameObject("/WinAnsiEncoding"),
                }),
            }),
        }),
    })
    return stream


def _make_checkbox_appearance(on: bool,
                               rect: Tuple[float, float, float, float]) -> StreamObject:
    """Build a /Yes appearance drawing a ✔ if on; /Off = empty."""
    x1, y1, x2, y2 = rect
    w = float(x2 - x1)
    h = float(y2 - y1)
    parts: List[str] = ["q"]
    if on:
        # Draw a check mark (2 lines) in blue
        parts.append("0.18 0.55 0.9 RG")
        parts.append("2 w")
        parts.append(f"2 {h*0.45:.2f} m")
        parts.append(f"{w*0.4:.2f} 2 l")
        parts.append(f"{w*0.4:.2f} 2 m")
        parts.append(f"{w-1:.2f} {h-1:.2f} l")
        parts.append("S")
    parts.append("Q")
    stream = StreamObject()
    stream.set_data("\n".join(parts).encode("latin-1"))
    stream.update({
        NameObject("/Type"):     NameObject("/XObject"),
        NameObject("/Subtype"):  NameObject("/Form"),
        NameObject("/FormType"): NumberObject(1),
        NameObject("/BBox"): ArrayObject([FloatObject(0), FloatObject(0),
                                          FloatObject(w), FloatObject(h)]),
        NameObject("/Resources"): DictionaryObject({
            NameObject("/ProcSet"): ArrayObject([NameObject("/PDF")]),
        }),
    })
    return stream


def _find_widgets_by_name(page) -> Dict[str, DictionaryObject]:
    """Return a map {widget name (/T) -> widget dict} for a given page."""
    result: Dict[str, DictionaryObject] = {}
    if "/Annots" not in page:
        return result
    for a in page["/Annots"]:
        obj = a.get_object()
        if obj.get("/Subtype") == NameObject("/Widget"):
            name = obj.get("/T")
            if name is not None:
                result[str(name)] = obj
    return result


def _set_text_widget(writer: PdfWriter, widget: DictionaryObject, value: str,
                     multiline_override: Optional[bool] = None) -> None:
    """Populate an existing AcroForm text widget with `value` and a fresh /AP."""
    rect_arr = widget["/Rect"]
    rect = tuple(float(x) for x in rect_arr)  # type: ignore
    da = str(widget.get("/DA") or "/Helvetica 10 Tf 0 g")
    font_name, size, color = _parse_da(da)
    # Detect multiline flag (bit 13, value 4096)
    ff = int(widget.get("/Ff") or 0)
    multiline = bool(ff & 4096) if multiline_override is None else multiline_override

    ap = _make_appearance(value, rect, font_name, size, color, multiline)
    ap_ref = writer._add_object(ap)  # type: ignore[attr-defined]

    widget[NameObject("/V")]  = TextStringObject(str(value or ""))
    widget[NameObject("/DV")] = TextStringObject(str(value or ""))
    widget[NameObject("/AP")] = DictionaryObject({NameObject("/N"): ap_ref})


def _set_choice_widget(writer: PdfWriter, widget: DictionaryObject, value: str) -> None:
    """For /Ch choice widgets (e.g. the 'Cantidad' dropdown). We treat the
    value as free text and create an appearance accordingly."""
    # Some readers want /V to match one of the /Opt entries; we force free-text
    # by clearing combo 'Edit' flag requirement — but for display, the /AP
    # alone is sufficient.
    rect_arr = widget["/Rect"]
    rect = tuple(float(x) for x in rect_arr)  # type: ignore
    da = str(widget.get("/DA") or "/Helvetica 10 Tf 0 g")
    font_name, size, color = _parse_da(da)
    ap = _make_appearance(value, rect, font_name, size, color, multiline=False)
    ap_ref = writer._add_object(ap)  # type: ignore[attr-defined]
    widget[NameObject("/V")]  = TextStringObject(str(value or ""))
    widget[NameObject("/DV")] = TextStringObject(str(value or ""))
    widget[NameObject("/AP")] = DictionaryObject({NameObject("/N"): ap_ref})


def _set_checkbox_widget(writer: PdfWriter, widget: DictionaryObject, on: bool) -> None:
    rect_arr = widget["/Rect"]
    rect = tuple(float(x) for x in rect_arr)  # type: ignore
    yes_ap = _make_checkbox_appearance(True,  rect)
    off_ap = _make_checkbox_appearance(False, rect)
    yes_ref = writer._add_object(yes_ap)  # type: ignore[attr-defined]
    off_ref = writer._add_object(off_ap)  # type: ignore[attr-defined]
    widget[NameObject("/AP")] = DictionaryObject({
        NameObject("/N"): DictionaryObject({
            NameObject("/Yes"): yes_ref,
            NameObject("/Off"): off_ref,
        }),
    })
    state = NameObject("/Yes") if on else NameObject("/Off")
    widget[NameObject("/V")]  = state
    widget[NameObject("/AS")] = state


def _ensure_acroform(writer: PdfWriter):
    """Make sure /AcroForm exists; NeedAppearances=false (we provide /AP)."""
    root = writer._root_object  # type: ignore[attr-defined]
    if "/AcroForm" not in root:
        root[NameObject("/AcroForm")] = DictionaryObject({
            NameObject("/NeedAppearances"): BooleanObject(False),
            NameObject("/Fields"): ArrayObject([]),
        })
    else:
        af = root["/AcroForm"]
        af[NameObject("/NeedAppearances")] = BooleanObject(False)


def _draw_signature_overlay(budget: Dict[str, Any]) -> bytes:
    """Draw signature images on page 1 of an A4 overlay PDF."""
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=A4)
    c.showPage()  # page 0 empty (template has no signatures on first page)

    def _draw(data_uri: str, rect: Tuple[int, int, int, int]):
        if not data_uri:
            return
        try:
            b64 = data_uri
            if b64.startswith("data:"):
                b64 = b64.split(",", 1)[1]
            raw = base64.b64decode(b64)
            img = ImageReader(io.BytesIO(raw))
            x1, y1, x2, y2 = rect
            box_w = x2 - x1
            box_h = y2 - y1
            # Get image dimensions
            iw, ih = img.getSize()
            if iw > 0 and ih > 0:
                # Fit image into box preserving aspect ratio, centred
                scale = min(box_w / iw, box_h / ih)
                fitted_w = iw * scale
                fitted_h = ih * scale
                cx = x1 + (box_w - fitted_w) / 2
                cy = y1 + (box_h - fitted_h) / 2
            else:
                cx, cy = x1, y1
                fitted_w, fitted_h = box_w, box_h
            c.setFillColorRGB(1, 1, 1)
            c.rect(x1, y1, box_w, box_h, fill=1, stroke=0)
            c.drawImage(img, cx, cy, width=fitted_w, height=fitted_h,
                        mask="auto")
        except Exception as e:
            print("signature embed failed:", e)

    _draw(budget.get("firma_isai") or "", SIG_ISAI_RECT)
    _draw(budget.get("firma_cliente") or "", SIG_CLIENT_RECT)
    c.showPage()
    c.save()
    return buf.getvalue()


# -----------------------------------------------------------------
# Main entry
# -----------------------------------------------------------------
def build_budget_pdf(budget: Dict[str, Any]) -> bytes:
    reader = PdfReader(TEMPLATE_PATH)
    writer = PdfWriter()
    writer.append_pages_from_reader(reader)
    _ensure_acroform(writer)

    # Merge signature overlay (images) before filling widgets so widgets
    # stay on top (but images sit on top of the static template content).
    sig_overlay = _draw_signature_overlay(budget)
    ov_reader = PdfReader(io.BytesIO(sig_overlay))
    for i, page in enumerate(writer.pages):
        if i < len(ov_reader.pages):
            page.merge_page(ov_reader.pages[i])

    # Collect widgets per page
    widgets_p0 = _find_widgets_by_name(writer.pages[0]) if len(writer.pages) > 0 else {}
    widgets_p1 = _find_widgets_by_name(writer.pages[1]) if len(writer.pages) > 1 else {}
    all_widgets = {**widgets_p0, **widgets_p1}

    # ---- Fill simple text fields ----
    for key, widget_name in TEXT_FIELD_MAP.items():
        w = all_widgets.get(widget_name)
        if not w:
            continue
        value = str(budget.get(key, "") or "")
        _set_text_widget(writer, w, value)

    # Signature name/cargo: concat "Nombre\nCargo" into Text13 / Text14
    isai_lines = "\n".join([str(budget.get("nombre_isai") or ""), str(budget.get("cargo_isai") or "")]).strip()
    client_lines = "\n".join([str(budget.get("nombre_cliente") or ""), str(budget.get("cargo_cliente") or "")]).strip()
    if all_widgets.get("Text13"):
        _set_text_widget(writer, all_widgets["Text13"], isai_lines, multiline_override=True)
    if all_widgets.get("Text14"):
        _set_text_widget(writer, all_widgets["Text14"], client_lines, multiline_override=True)

    # ---- Equipment rows ----
    equipos = list(budget.get("equipos") or [])
    for row_idx in range(NUM_EQ_ROWS):
        eq = equipos[row_idx] if row_idx < len(equipos) else {}
        suffix = f".0.{row_idx}"  # e.g. Text15.0.0.0.0

        # Element
        w_el = all_widgets.get(f"Text15.0.0.0.{row_idx}")
        if w_el:
            _set_text_widget(writer, w_el, str(eq.get("elemento") or ""))
        # Cantidad (choice field)
        w_cant = all_widgets.get(f"1.0.{row_idx}")
        if w_cant:
            _set_choice_widget(writer, w_cant, str(eq.get("cantidad") or ""))
        # Ubicación
        w_ub = all_widgets.get(f"Text15.0.1.0.{row_idx}")
        if w_ub:
            _set_text_widget(writer, w_ub, str(eq.get("ubicacion") or ""), multiline_override=True)
        # Observaciones
        w_ob = all_widgets.get(f"Text15.0.2.0.{row_idx}")
        if w_ob:
            _set_text_widget(writer, w_ob, str(eq.get("observaciones") or ""), multiline_override=True)

    # ---- Delivery checkboxes ----
    for key, widget_name in CHECKBOX_MAP.items():
        w = all_widgets.get(widget_name)
        if not w:
            continue
        _set_checkbox_widget(writer, w, bool(budget.get(key)))

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


# -----------------------------------------------------------------
# CLI self-test
# -----------------------------------------------------------------
if __name__ == "__main__":
    sample = {
        "n_proyecto": "P-2025-042",
        "cliente": "ACME Corp.",
        "nombre_instalacion": "Sede Central Madrid",
        "direccion": "C/ Alcalá 123, 28009 Madrid",
        "contacto_1": "Juan Pérez\n666 111 222\njuan@acme.es",
        "contacto_2": "María López\n666 333 444",
        "observaciones_presupuesto": "Se incluye montaje y configuración de 10 cilindros electrónicos XS4 con lector exterior y llave Salto.",
        "fecha_inicio": "01/07/2025",
        "fecha_fin": "05/07/2025",
        "observaciones_ejecucion": "Instalación finalizada sin incidencias. Pendiente entrega de documentación al cliente.",
        "equipos": [
            {"elemento": "Cilindro XS4", "cantidad": "10", "ubicacion": "Planta 1 — puertas 101 a 110", "observaciones": "OK"},
            {"elemento": "Lector muro",  "cantidad": "2",  "ubicacion": "Entrada principal",               "observaciones": "Requiere cableado"},
            {"elemento": "Manilla electrónica", "cantidad": "5", "ubicacion": "Planta 2", "observaciones": ""},
        ],
        "entrega_tarjeta_mantenimiento": True,
        "entrega_llave_salto": True,
        "entrega_eps100": False,
        "nombre_isai":   "Ana García",
        "cargo_isai":    "Técnico senior",
        "nombre_cliente": "Pedro Ruiz",
        "cargo_cliente":  "Jefe de obra",
    }
    data = build_budget_pdf(sample)
    Path("/tmp/test_hoja.pdf").write_bytes(data)
    print("OK /tmp/test_hoja.pdf size=", len(data))
