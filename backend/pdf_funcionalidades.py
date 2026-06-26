"""
Generador de PDF de funcionalidades de I-SAI.
Uso: python pdf_funcionalidades.py [ruta_salida.pdf]
"""

import os
from datetime import date
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak,
    Image as RLImage, Frame, PageTemplate, NextPageTemplate,
)
from reportlab.platypus.doctemplate import BaseDocTemplate

# ---------------------------------------------------------------------------
# Colores y constantes
# ---------------------------------------------------------------------------
AZUL = "#1E88E5"
AZUL_OSCURO = "#1565C0"
AZUL_CLARO = "#E3F2FD"
GRIS_OSCURO = "#333333"
GRIS_MEDIO = "#666666"
GRIS_CLARO = "#F5F5F5"
BLANCO = "#FFFFFF"

MARGIN = 2 * cm

# ---------------------------------------------------------------------------
# Estilos
# ---------------------------------------------------------------------------
def _build_styles():
    s = {}
    s["title"] = ParagraphStyle("ITitle", fontSize=30, textColor=AZUL, spaceAfter=6,
        alignment=TA_CENTER, fontName="Helvetica-Bold")
    s["cover_subtitle"] = ParagraphStyle("ICoverSub", fontSize=14, textColor=GRIS_MEDIO,
        spaceAfter=20, alignment=TA_CENTER, fontName="Helvetica")
    s["cover_date"] = ParagraphStyle("ICoverDate", fontSize=12, textColor=GRIS_MEDIO,
        alignment=TA_CENTER, fontName="Helvetica")
    s["h1"] = ParagraphStyle("IH1", fontSize=20, textColor=AZUL, spaceBefore=24,
        spaceAfter=14, fontName="Helvetica-Bold")
    s["h2"] = ParagraphStyle("IH2", fontSize=15, textColor=AZUL_OSCURO, spaceBefore=18,
        spaceAfter=10, fontName="Helvetica-Bold")
    s["h3"] = ParagraphStyle("IH3", fontSize=12.5, textColor=GRIS_OSCURO,
        spaceBefore=14, spaceAfter=6, fontName="Helvetica-Bold")
    s["body"] = ParagraphStyle("IBody", fontSize=10, textColor=GRIS_OSCURO,
        leading=16, spaceAfter=10, fontName="Helvetica", alignment=TA_JUSTIFY)
    s["body_small"] = ParagraphStyle("IBodySmall", fontSize=9, textColor=GRIS_MEDIO,
        leading=13, spaceAfter=6, fontName="Helvetica")
    s["table_header"] = ParagraphStyle("ITableH", fontSize=9, textColor=BLANCO,
        fontName="Helvetica-Bold", alignment=TA_CENTER, leading=11)
    s["table_cell"] = ParagraphStyle("ITableCell", fontSize=8.5, textColor=GRIS_OSCURO,
        leading=12, fontName="Helvetica")
    s["toc_title"] = ParagraphStyle("ITocT", fontSize=20, textColor=AZUL,
        spaceBefore=24, spaceAfter=22, fontName="Helvetica-Bold")
    s["toc_entry"] = ParagraphStyle("ITocE", fontSize=12, textColor=GRIS_OSCURO,
        leading=26, leftIndent=10, fontName="Helvetica")
    s["toc_sub"] = ParagraphStyle("ITocSub", fontSize=10, textColor=GRIS_MEDIO,
        leading=22, leftIndent=30, fontName="Helvetica")
    return s

S = _build_styles()

# ---------------------------------------------------------------------------
# Tabla estilizada
# ---------------------------------------------------------------------------
def _tabla(data, col_widths=None, header=True):
    wrapped = []
    for i, row in enumerate(data):
        new_row = []
        for j, cell in enumerate(row):
            if isinstance(cell, Paragraph):
                new_row.append(cell)
            elif col_widths and j < len(col_widths):
                w = col_widths[j] - 12
                fs = 9 if i == 0 else 8.5
                fn = "Helvetica-Bold" if i == 0 else "Helvetica"
                new_row.append(Paragraph(str(cell), ParagraphStyle(
                    f"cell_{i}_{j}", fontSize=fs, fontName=fn,
                    textColor=BLANCO if i == 0 else GRIS_OSCURO, leading=fs + 3,
                    maxWidth=w,
                )))
            else:
                new_row.append(cell)
        wrapped.append(new_row)
    t = Table(wrapped, colWidths=col_widths, repeatRows=1 if header else 0)
    est = [
        ("BACKGROUND", (0, 0), (-1, 0), AZUL),
        ("TEXTCOLOR", (0, 0), (-1, 0), BLANCO),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 8.5),
        ("TOPPADDING", (0, 1), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E0E0E0")),
        ("LINEBELOW", (0, 0), (-1, 0), 1.5, AZUL_OSCURO),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            est.append(("BACKGROUND", (0, i), (-1, i), GRIS_CLARO))
    t.setStyle(TableStyle(est))
    return t

# ---------------------------------------------------------------------------
# Cabecera y pie de pagina (canvas)
# ---------------------------------------------------------------------------
def _header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setStrokeColor(colors.HexColor(AZUL))
    canvas.setLineWidth(1.5)
    canvas.line(MARGIN - 5, h - MARGIN + 14, w - MARGIN + 5, h - MARGIN + 14)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor(GRIS_MEDIO))
    canvas.drawString(MARGIN, h - MARGIN + 4, "I-SAI  |  Documentacion de funcionalidades")
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(colors.HexColor(AZUL))
    canvas.drawRightString(w - MARGIN, h - MARGIN + 4, "ERP Seguridad Electronica")
    canvas.restoreState()

    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor(AZUL))
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, MARGIN - 6, w - MARGIN, MARGIN - 6)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor(GRIS_MEDIO))
    canvas.drawRightString(w - MARGIN, MARGIN - 16, f"Pagina {canvas.getPageNumber()}")
    canvas.drawString(MARGIN, MARGIN - 16, "Documento confidencial")
    canvas.restoreState()

# ---------------------------------------------------------------------------
# Construir documento
# ---------------------------------------------------------------------------
def _construir_doc(output_path):
    w, h = A4
    frame_body = Frame(MARGIN, MARGIN, w - 2 * MARGIN, h - 2 * MARGIN, id="body")
    cover_template = PageTemplate(id="Cover", frames=frame_body)
    body_template = PageTemplate(id="Body", frames=frame_body, onPage=_header_footer)

    doc = BaseDocTemplate(output_path, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN + 18, bottomMargin=MARGIN + 8,
        title="I-SAI - Documentacion de funcionalidades",
        author="I-SAI", subject="Funcionalidades ERP")
    doc.addPageTemplates([cover_template, body_template])
    return doc

# ---------------------------------------------------------------------------
# Portada
# ---------------------------------------------------------------------------
def _portada(logo_path):
    elems = []
    if logo_path and os.path.isfile(logo_path):
        try:
            elems.append(Spacer(1, 2.5 * cm))
            elems.append(RLImage(logo_path, width=3.5 * cm, height=3.5 * cm, kind="proportional"))
        except Exception:
            elems.append(Spacer(1, 5 * cm))
    else:
        elems.append(Spacer(1, 5 * cm))
    elems.append(Spacer(1, 2 * cm))
    elems.append(Paragraph("I-SAI", S["title"]))
    elems.append(Spacer(1, 0.6 * cm))
    elems.append(Paragraph("Documentacion de funcionalidades", S["cover_subtitle"]))
    elems.append(Spacer(1, 0.4 * cm))
    elems.append(Paragraph(f"Fecha: {date.today().strftime('%d/%m/%Y')}", S["cover_date"]))
    elems.append(Spacer(1, 0.8 * cm))
    elems.append(Paragraph(
        "ERP integral para empresas de instalacion y mantenimiento<br/>"
        "de sistemas de seguridad electronica", S["cover_subtitle"]))
    elems.append(Spacer(1, 2 * cm))
    elems.append(Paragraph("Version 1.0  |  Documento confidencial", S["cover_date"]))
    return elems

# ---------------------------------------------------------------------------
# Indice
# ---------------------------------------------------------------------------
def _indice():
    elems = []
    elems.append(Paragraph("Indice", S["toc_title"]))
    elems.append(Spacer(1, 0.5 * cm))
    secciones = [
        ("1.", "Introduccion y arquitectura tecnica"),
        ("2.", "Roles y permisos"),
        ("3.", "Modulos de la aplicacion"),
        ("4.", "Flujos de trabajo principales"),
        ("5.", "Diagrama de relaciones entre entidades"),
        ("6.", "Dashboard ejecutivo (15 secciones)"),
        ("7.", "Sistemas complementarios"),
        ("8.", "Seguridad"),
        ("9.", "GDPR / LOPDGDD"),
        ("10.", "Infraestructura tecnica"),
        ("11.", "Indice de endpoints API"),
        ("12.", "Resumen ejecutivo"),
    ]
    for num, titulo in secciones:
        elems.append(Paragraph(f"{num}  {titulo}", S["toc_entry"]))
    elems.append(PageBreak())
    return elems

# ===================================================================
# SECCION 1: Introduccion y arquitectura tecnica
# ===================================================================
def _s1_introduccion():
    E = []
    E.append(Paragraph("1. Introduccion y arquitectura tecnica", S["h1"]))

    E.append(Paragraph(
        "I-SAI es una aplicacion ERP integral disenada especificamente para empresas de instalacion "
        "y mantenimiento de sistemas de seguridad electronica. Nace de la necesidad real del sector: "
        "centralizar en una unica plataforma todas las operaciones del negocio que tradicionalmente "
        "se gestionan con herramientas dispersas (Excels, WhatsApp, papeles, aplicaciones sueltas). "
        "I-SAI cubre desde la gestion de proyectos y presupuestos hasta el control horario de los "
        "tecnicos, el SAT (Servicio de Asistencia Tecnica), los planos de instalacion, el chat "
        "interno y el dashboard ejecutivo para la direccion.",
        S["body"]
    ))

    E.append(Paragraph(
        "El objetivo principal de I-SAI es proporcionar a CEOs, gestores, tecnicos, comerciales "
        "y personal de SAT una herramienta unificada donde cada perfil ve exactamente lo que "
        "necesita para hacer su trabajo, sin distracciones y con los datos siempre actualizados "
        "y sincronizados en tiempo real.",
        S["body"]
    ))

    E.append(Paragraph("Arquitectura tecnica", S["h2"]))
    E.append(Paragraph(
        "La aplicacion sigue una arquitectura cliente-servidor clasica con una separacion "
        "clara entre el backend (API REST) y el frontend (aplicacion movil/web). Esta "
        "separacion permite desarrollar, desplegar y escalar cada componente de forma "
        "independiente. La comunicacion se realiza mediante peticiones HTTP/HTTPS con "
        "autenticacion basada en tokens JWT.",
        S["body"]
    ))

    E.append(Paragraph("Backend: Python 3.12 + FastAPI + MongoDB", S["h3"]))
    E.append(Paragraph(
        "El backend esta construido con FastAPI, un framework web moderno de alto rendimiento "
        "para Python que ofrece documentacion automatica via OpenAPI/Swagger y validacion de "
        "datos con Pydantic. FastAPI es una de las opciones mas rapidas del ecosistema Python, "
        "comparable en rendimiento a Node.js y Go. El servidor ASGI Uvicorn gestiona las "
        "peticiones concurrentes con workers distribuidos. La base de datos MongoDB, una "
        "base de datos NoSQL orientada a documentos, proporciona la flexibilidad necesaria "
        "para los distintos tipos de datos de la aplicacion y permite el modelo multi-tenant "
        "con bases de datos independientes por cliente.",
        S["body"]
    ))

    E.append(Paragraph("Frontend: Expo SDK 54 + React Native 0.81 + TypeScript", S["h3"]))
    E.append(Paragraph(
        "El frontend esta desarrollado con Expo (React Native), lo que permite desplegar la "
        "aplicacion tanto en iOS como en Android desde un unico codigo base escrito en "
        "TypeScript. Utiliza React 19 y componentes nativos para ofrecer una experiencia "
        "fluida y responsiva. Expo SDK 54 proporciona acceso a funcionalidades nativas del "
        "dispositivo como camara, geolocalizacion, notificaciones push y almacenamiento local, "
        "sin necesidad de escribir codigo nativo por separado para cada plataforma.",
        S["body"]
    ))

    E.append(Paragraph("Principios de diseno", S["h3"]))
    E.append(Paragraph(
        "La arquitectura de I-SAI se rige por varios principios fundamentales: "
        "<b>separacion de responsabilidades</b> (cada modulo es independiente), "
        "<b>API-first</b> (todo se accede via API REST documentada), "
        "<b>aislamiento multi-tenant</b> (datos de cada cliente totalmente separados), "
        "<b>seguridad por capas</b> (defensa en profundidad), y "
        "<b>offline-first cuando es posible</b> (el frontend cachea datos para funcionar "
        "sin conexion temporal).",
        S["body"]
    ))

    E.append(Paragraph("Tecnologias principales", S["h2"]))
    data = [
        [Paragraph("<b>Tecnologia</b>", S["table_header"]), Paragraph("<b>Version</b>", S["table_header"]), Paragraph("<b>Rol en el sistema</b>", S["table_header"])],
        ["Python", "3.12", "Lenguaje principal del backend"],
        ["FastAPI", "0.110.1", "Framework web REST API con OpenAPI/Swagger"],
        ["Uvicorn", "0.25.0", "Servidor ASGI de alto rendimiento"],
        ["MongoDB", "7.x", "Base de datos NoSQL con 24 colecciones por tenant"],
        ["Motor", "3.3.1", "Driver asincrono de MongoDB para Python"],
        ["Expo SDK", "54", "Framework de desarrollo movil multiplataforma"],
        ["React", "19", "Libreria de interfaz de usuario"],
        ["React Native", "0.81", "Renderizado nativo en iOS y Android"],
        ["TypeScript", "5.x", "Tipado estatico para frontend"],
        ["Pydantic", "2.12", "Validacion de datos y schemas"],
        ["PyJWT", "2.12.1", "Generacion y validacion de tokens JWT"],
        ["bcrypt", "4.1.3", "Hashing seguro de contrasenas"],
        ["Docker", "-", "Contenedores para despliegue reproducible"],
    ]
    E.append(Spacer(1, 0.3 * cm))
    E.append(_tabla(data, col_widths=[3.7 * cm, 3 * cm, 10.3 * cm]))
    E.append(PageBreak())
    return E

# ===================================================================
# SECCION 2: Roles y permisos
# ===================================================================
def _s2_roles():
    E = []
    E.append(Paragraph("2. Roles y permisos", S["h1"]))
    E.append(Paragraph(
        "I-SAI implementa un sistema de control de acceso basado en roles (RBAC) que permite "
        "definir exactamente que puede ver y hacer cada usuario dentro de la aplicacion. "
        "Este sistema es fundamental para garantizar la seguridad de los datos y adaptar la "
        "experiencia de usuario a las necesidades reales de cada perfil profesional: un "
        "administrador no necesita lo mismo que un tecnico en campo.",
        S["body"]
    ))

    E.append(Paragraph(
        "El modelo RBAC de I-SAI se estructura en tres niveles: "
        "<b>Roles</b> (agrupaciones logicas de permisos), "
        "<b>Permisos</b> (acciones atomicas sobre modulos), y "
        "<b>Usuarios</b> (cada usuario tiene un rol asignado y puede tener permisos "
        "adicionales o restricciones especificas). Cuando un usuario autenticado hace una "
        "peticion a la API, el middleware de autorizacion verifica que el token JWT incluya "
        "los permisos necesarios para el endpoint solicitado.",
        S["body"]
    ))

    E.append(Paragraph("Resumen de roles", S["h2"]))
    E.append(Paragraph(
        "El sistema define 5 roles principales, cada uno con un numero distinto de permisos "
        "asignados por defecto. Los permisos se pueden personalizar por usuario desde el "
        "panel de administracion, permitiendo ajustes finos sin cambiar el rol base.",
        S["body"]
    ))
    data_roles = [
        [Paragraph("<b>Rol</b>", S["table_header"]), Paragraph("<b>Permisos</b>", S["table_header"]), Paragraph("<b>Descripcion</b>", S["table_header"])],
        ["Administrador principal", "28", "Acceso total a todas las funcionalidades y configuraciones del sistema"],
        ["Gestor", "26", "Gestion de proyectos, presupuestos, SAT y equipos de tecnicos"],
        ["Tecnico", "10", "Ejecucion de tareas asignadas, fichajes, chat y consulta de planos"],
        ["Comercial", "6", "Presupuestos, CRM, portfolio publico y preciario"],
        ["SAT", "5", "Gestion de incidencias y soporte tecnico postventa"],
    ]
    E.append(_tabla(data_roles, col_widths=[3.4*cm, 2*cm, 11.6*cm]))
    E.append(Spacer(1, 0.6 * cm))

    E.append(Paragraph("Permisos detallados por modulo", S["h2"]))
    E.append(Paragraph(
        "A continuacion se listan los 28 permisos del sistema, agrupados por el modulo "
        "al que pertenecen. La columna indica si el rol tiene el permiso por defecto. "
        "Los permisos marcados pueden ser revocados o concedidos individualmente por un "
        "administrador para adaptarse a las necesidades especificas de cada empresa.",
        S["body"]
    ))
    permisos = [
        [Paragraph("<b>Modulo</b>", S["table_header"]), Paragraph("<b>Permiso</b>", S["table_header"]), Paragraph("<b>Admin</b>", S["table_header"]), Paragraph("<b>Gestor</b>", S["table_header"]), Paragraph("<b>Tecnico</b>", S["table_header"]), Paragraph("<b>SAT</b>", S["table_header"])],
        ["Proyectos", "Ver proyectos", "Si", "Si", "Si", "-"],
        ["Proyectos", "Crear / editar proyectos", "Si", "Si", "-", "-"],
        ["Proyectos", "Eliminar proyectos", "Si", "-", "-", "-"],
        ["Proyectos", "Gestionar materiales", "Si", "Si", "Si", "-"],
        ["Calendario", "Ver calendario", "Si", "Si", "Si", "Si"],
        ["Calendario", "Crear / editar eventos", "Si", "Si", "-", "-"],
        ["Calendario", "Completar eventos propios", "Si", "Si", "Si", "-"],
        ["Presupuestos", "Ver presupuestos", "Si", "Si", "-", "-"],
        ["Presupuestos", "Crear / editar presupuestos", "Si", "Si", "-", "-"],
        ["Presupuestos", "Aprobar presupuestos", "Si", "Si", "-", "-"],
        ["Presupuestos", "Ver plantillas", "Si", "Si", "-", "-"],
        ["Presupuestos", "Gestionar plantillas", "Si", "Si", "-", "-"],
        ["SAT", "Ver incidencias", "Si", "Si", "Si", "Si"],
        ["SAT", "Crear / editar incidencias", "Si", "Si", "Si", "Si"],
        ["SAT", "Resolver incidencias", "Si", "Si", "Si", "Si"],
        ["SAT", "Formulario publico", "Si", "Si", "-", "-"],
        ["Planos", "Ver planos", "Si", "Si", "Si", "-"],
        ["Planos", "Editar planos", "Si", "Si", "-", "-"],
        ["Planos", "Gestionar sellos y overlays", "Si", "Si", "-", "-"],
        ["Chat", "Acceso al chat", "Si", "Si", "Si", "Si"],
        ["Chat", "Crear grupos", "Si", "Si", "-", "-"],
        ["Dashboard", "Ver dashboard", "Si", "Si", "-", "-"],
        ["Financiero", "Ver panel financiero", "Si", "Si", "-", "-"],
        ["Fichajes", "Fichar entrada/salida", "Si", "Si", "Si", "-"],
        ["Fichajes", "Ver historico fichajes", "Si", "Si", "-", "-"],
        ["Preciario", "Consultar preciario", "Si", "Si", "Si", "Si"],
        ["Preciario", "Editar precios y stock", "Si", "-", "-", "-"],
        ["Documentos", "Ver documentos", "Si", "Si", "Si", "Si"],
        ["Documentos", "Subir documentos", "Si", "Si", "-", "-"],
        ["Administracion", "Panel de administracion", "Si", "-", "-", "-"],
        ["Administracion", "Gestionar usuarios y roles", "Si", "-", "-", "-"],
        ["Administracion", "Configurar OneDrive", "Si", "-", "-", "-"],
        ["Notas", "Ver notas propias", "Si", "Si", "Si", "Si"],
        ["Notas", "Ver notas de otros", "Si", "Si", "-", "-"],
        ["Portfolio", "Ver portfolio publico", "Si", "Si", "Si", "Si"],
        ["Portfolio", "Editar portfolio", "Si", "Si", "-", "-"],
        ["Guardias", "Ver guardias", "Si", "Si", "Si", "Si"],
        ["Guardias", "Gestionar guardias", "Si", "Si", "-", "-"],
        ["Muestrario Salto", "Consultar catalogo Salto", "Si", "Si", "Si", "Si"],
        ["Exportar", "Exportar a Excel/PDF", "Si", "Si", "-", "-"],
    ]
    E.append(_tabla(permisos, col_widths=[3*cm, 5.2*cm, 1.8*cm, 1.8*cm, 1.8*cm, 1.8*cm]))

    E.append(Spacer(1, 0.4 * cm))
    E.append(Paragraph(
        "Nota: Los roles Comercial y SAT comparten algunos permisos basicos con el rol "
        "Tecnico (ver proyectos, chat, preciario). El administrador puede modificar cualquier "
        "asignacion de permisos desde el panel de usuarios para ajustarse a la estructura "
        "organizativa concreta de cada empresa.",
        S["body_small"]
    ))

    E.append(PageBreak())
    return E

# ===================================================================
# SECCION 3: Modulos de la aplicacion
# ===================================================================
def _s3_modulos():
    E = []
    E.append(Paragraph("3. Modulos de la aplicacion", S["h1"]))
    E.append(Paragraph(
        "I-SAI se compone de 16 modulos principales que cubren todas las areas operativas "
        "de una empresa de instalacion y mantenimiento de seguridad electronica. Cada modulo "
        "funciona de forma independiente pero se integra con los demas para ofrecer una "
        "experiencia unificada. Por ejemplo, un proyecto puede tener materiales del preciario, "
        "eventos en el calendario, estar vinculado a un presupuesto aceptado y generar "
        "incidencias SAT posteriores.",
        S["body"]
    ))

    modulos = [
        ("Proyectos (Materiales)",
         "El corazon operativo de I-SAI. Cada proyecto representa una instalacion real que "
         "pasa por un ciclo de vida completo: desde su creacion (pendiente) hasta su cierre "
         "(facturado/terminado). Un proyecto incluye tecnicos asignados, fechas de inicio y fin, "
         "materiales necesarios, horas estimadas y reales, notas internas y un historial completo "
         "de cambios. El modulo de materiales permite asignar productos del preciario (con calculo "
         "automatico de costes), gestionar stock reservado y generar listados para compras. "
         "Los gestores pueden monitorizar el progreso de cada proyecto desde el dashboard, "
         "mientras que los tecnicos actualizan el estado desde el movil en tiempo real."),

        ("Calendario + cascada automatica",
         "Calendario visual compartido con vistas semanales y mensuales donde se planifican "
         "todos los proyectos, eventos e incidencias SAT. La funcionalidad estrella es la "
         "<b>cascada automatica</b>: cuando un tecnico completa un evento (marca como terminado), "
         "el sistema recalcula automaticamente las fechas de los eventos posteriores que dependen "
         "de el, desplazandolos en el tiempo para mantener la coherencia de la planificacion. "
         "Esto evita el trabajo manual de re-planificar y asegura que el calendario siempre "
         "refleje la realidad. Los eventos se pueden arrastrar, redimensionar y codificar por "
         "colores segun el tipo (proyecto, SAT, interno, guardia)."),

        ("Presupuestos (versiones, plantillas, PDF, firma digital)",
         "Sistema completo de gestion de presupuestos que cubre todo el ciclo comercial. "
         "Los presupuestos se crean con partidas de materiales del preciario y mano de obra, "
         "con calculo automatico de totales, IVA y descuentos. El sistema de <b>versiones</b> "
         "permite iterar sobre un presupuesto manteniendo el historial de cambios. Las "
         "<b>plantillas</b> aceleran la creacion de presupuestos recurrentes. La generacion "
         "de <b>PDF profesional</b> produce un documento listo para enviar al cliente, con "
         "logotipo, datos de empresa y condiciones. La <b>firma digital</b> permite al cliente "
         "firmar en el movil del tecnico (canvas tactil) y al tecnico ISAI firmar como "
         "conforme, quedando ambas firmas incrustadas en el PDF final con validez documental."),

        ("CRM SAT (incidencias, clientes, formulario publico)",
         "El Servicio de Asistencia Tecnica (SAT) es el modulo de servicio postventa. "
         "Gestiona incidencias reportadas por clientes: averias, mantenimientos, urgencias. "
         "La entrada de incidencias tiene dos vias: interna (el personal crea la incidencia "
         "desde la app) y externa (los clientes usan un <b>formulario publico</b> accesible "
         "sin login, con subida de fotos incluidas). Cada incidencia tiene un ciclo de vida "
         "con estados, asignacion de tecnico, programacion en calendario y resolucion "
         "(facturable o en garantia). El modulo incluye una agenda de clientes con historico "
         "de incidencias, datos de contacto, equipos instalados y garantias vigentes."),

        ("Planos (editor, sellos, fondos PDF/JPG)",
         "Herramienta de edicion de planos de instalacion. Sobre un fondo (plano en PDF o "
         "imagen JPG del edificio), los tecnicos y gestores pueden colocar <b>sellos</b> "
         "(iconos predefinidos como detectores, camaras, sirenas, pulsadores, cerraduras, etc.), "
         "dibujar lineas de cableado, anadir <b>anotaciones</b> de texto y exportar el plano "
         "modificado. Los planos se organizan por proyecto o cliente y son accesibles desde "
         "el movil en obra, permitiendo al tecnico consultar exactamente donde debe instalar "
         "cada elemento. El sistema de capas (overlays) mantiene el fondo original intacto "
         "y guarda solo las modificaciones, permitiendo edicion no destructiva."),

        ("Chat interno (1-1, grupos, archivos)",
         "Sistema de mensajeria en tiempo real integrado en la aplicacion. Soporta "
         "conversaciones uno a uno entre cualquier par de usuarios, <b>grupos</b> por equipos "
         "o proyectos (ej. 'Equipo obra Hotel Central'), envio de <b>archivos</b> (fotos de "
         "la instalacion, documentos, PDFs) y <b>notificaciones push</b> cuando llega un "
         "nuevo mensaje. Los mensajes pueden vincularse a proyectos especificos para mantener "
         "el contexto. El chat sustituye a WhatsApp como herramienta de comunicacion "
         "interna, manteniendo todos los datos dentro de la plataforma corporativa y "
         "fuera de aplicaciones de mensajeria personal."),

        ("Dashboard y KPIs (15 secciones de analisis)",
         "El cuadro de mando integral para la direccion de la empresa. Quince secciones "
         "independientes de analisis que cubren todos los aspectos del negocio: planificacion "
         "operativa, carga de trabajo, KPIs financieros, salud del SAT, pipeline comercial, "
         "distribucion geografica y comparativas temporales. Cada seccion incluye graficos "
         "interactivos (barras, anillos, lineas, mapas de calor) con datos en tiempo real "
         "extraidos del resto de modulos. Disenado para que un CEO pueda tomar decisiones "
         "con datos en menos de 5 minutos de consulta diaria. Se detalla en la seccion 6."),

        ("Panel financiero (ventas y beneficios)",
         "Submodulo del dashboard accesible desde la barra lateral y desde una tarjeta en "
         "el dashboard principal. Proporciona una vision financiera completa de todos los "
         "proyectos con horas imputadas. Solo se muestran proyectos con horas imputadas > 0 "
         "(los proyectos sin actividad no aparecen hasta que tengan horas registradas). "
         "Requiere permiso <b>dashboard.view</b> y se sirve desde el endpoint dedicado "
         "<b>/api/dashboard/financiero</b>, que agrega datos de las colecciones de proyectos. "
         "Las actualizaciones en los campos financieros del detalle de proyecto se reflejan "
         "inmediatamente al recargar la pantalla.<br/><br/>"
         "<b>Calculo automatico por proyecto:</b> el sistema calcula para cada proyecto: "
         "importe de venta previsto (materiales + mano de obra previstos), coste previsto "
         "(materiales + mano de obra previstos), coste real (materiales + mano de obra reales), "
         "margen previsto (venta prevista - coste previsto), margen real (venta prevista - "
         "coste real), % beneficio inicial y % beneficio real (configurados manualmente por "
         "proyecto), y desviacion (margen real - margen previsto). Los datos de importes y "
         "costes se introducen en el detalle de cada proyecto (seccion \"INFORMACION FIJA\"), "
         "con campos para materiales y mano de obra de cada concepto.<br/><br/>"
         "<b>KPIs mostrados:</b> ventas previstas totales, costes reales totales, margen "
         "real medio (%), numero de proyectos con datos financieros, margen previsto total, "
         "coste previsto total, diferencia previsto vs real, % beneficio inicial medio, "
         "% beneficio real medio, y proyectos sin datos financieros.<br/><br/>"
         "<b>Proyectos por debajo del margen:</b> lista de los 20 peores proyectos ordenados "
         "por desviacion negativa. Muestra codigo de proyecto, cliente, gestor, estado, "
         "margen previsto, margen real y desviacion en euros. Cada proyecto es un enlace a "
         "su ficha de detalle.<br/><br/>"
         "<b>Tabla completa:</b> lista paginada de todos los proyectos con datos financieros, "
         "con columnas: proyecto, cliente, venta total, coste previsto, coste real, margen "
         "real, % beneficio real. Ordenados de mayor a menor margen. Boton \"Ver todos\" para "
         "expandir. Con datos de prueba generados (986 proyectos), el sistema muestra ~6,4M "
         "en ventas previstas y un margen real medio del 39%."),

        ("Fichajes (entrada/salida, geolocalizacion)",
         "Control horario completo para cumplimiento de la legislacion laboral espanola "
         "(RD-ley 8/2019). Cada tecnico ficha entrada y salida desde el movil, y el sistema "
         "registra: hora, ubicacion GPS (latitud/longitud), proyecto asociado y tipo de "
         "jornada. La geolocalizacion permite verificar que los fichajes se realizan en "
         "las ubicaciones de obra y no desde otros lugares. El historico de fichajes es "
         "exportable a Excel para la gestoria laboral. El panel de fichajes muestra la "
         "jornada acumulada semanal y mensual de cada empleado."),

        ("Preciario (56k productos, descuentos, stock)",
         "Base de datos con mas de 56.000 productos del sector de seguridad electronica: "
         "camaras, detectores, centrales, cableado, conectores, baterias, fuentes, sirenas, "
         "cerraduras y un largo etcetera. Cada producto incluye: codigo, descripcion, "
         "familia, precio de coste, precio de venta recomendado, descuentos aplicables "
         "por cliente, stock actual y stock minimo. Busqueda avanzada por texto, codigo "
         "o familia. Integracion directa con los presupuestos: al anadir un producto a "
         "una partida, se calcula automaticamente el precio con el descuento del cliente."),

        ("Muestrario Salto (catalogo, API MyLock)",
         "Catalogo especifico de productos Salto, el principal fabricante de cerraduras "
         "inteligentes y sistemas de control de acceso del mercado. Conectado via API MyLock "
         "de Salto para obtener datos siempre actualizados: modelos, caracteristicas tecnicas, "
         "acabados, precios de tarifa y fichas tecnicas en PDF. Los productos del muestrario "
         "Salto se pueden incorporar directamente a los presupuestos como cualquier otro "
         "producto del preciario, facilitando la venta de sistemas de control de acceso."),

        ("Notas personales (tags, prioridad, archivado, vinculacion)",
         "Sistema de notas personales para que cada usuario pueda mantener sus propios "
         "apuntes y recordatorios dentro de I-SAI. Las notas soportan: etiquetas (tags) "
         "para categorizar, cuatro niveles de prioridad visual (baja, media, alta, urgente), "
         "archivado (ocultar sin borrar) y vinculacion a entidades del sistema (un nota "
         "puede estar asociada a un proyecto, un cliente o una incidencia SAT). Busqueda "
         "full-text sobre el contenido de todas las notas. Las notas son privadas por "
         "defecto, con opcion de compartir con otros usuarios."),

        ("Documentos (fichas tecnicas, manuales)",
         "Repositorio centralizado de documentacion tecnica: fichas de producto, manuales "
         "de instalacion y programacion, certificados de garantia, normativa aplicable "
         "(EN 50131, RIPCI, etc.) y cualquier otro documento relevante para el trabajo "
         "diario. Los documentos se organizan por categorias y son accesibles desde "
         "cualquier modulo de la aplicacion: un tecnico puede consultar el manual de una "
         "central mientras esta en obra sin salir de la app."),

        ("Guardias (tecnicos de guardia por dia)",
         "Planificacion semanal de guardias: el administrador asigna que tecnico esta "
         "de guardia cada dia de la semana (lunes a domingo). La informacion de guardias "
         "es visible en el dashboard y en el modulo SAT. Cuando entra una incidencia urgente "
         "fuera de horario laboral, el sistema sabe automaticamente a que tecnico "
         "notificar. Las guardias pueden configurarse con rotaciones semanales y tipos "
         "de guardia (localizada, presencial, etc.)."),

        ("Administracion (OneDrive, temas, precios)",
         "Panel de configuracion general accesible solo para administradores. Desde aqui "
         "se gestiona: la conexion con Microsoft OneDrive para sincronizacion de Excels, "
         "la personalizacion visual de la aplicacion (temas de color, logotipo de empresa), "
         "la configuracion de parametros globales (IVA por defecto, moneda, formato de "
         "fechas), la gestion de usuarios y roles, y los ajustes de precios y margenes "
         "del preciario. Es el centro de control de la instancia de cada empresa."),

        ("Portfolio publico (catalogo de productos para clientes)",
         "Catalogo de productos y servicios accesible via web sin necesidad de login. "
         "Disenado para que los clientes potenciales puedan consultar la oferta de la "
         "empresa instaladora. Muestra productos organizados por familias con imagenes, "
         "descripciones comerciales, caracteristicas tecnicas resumidas y precios orientativos. "
         "Incluye un formulario de contacto para solicitar presupuesto. El contenido del "
         "portfolio se gestiona desde el panel de administracion."),
    ]

    for titulo, desc in modulos:
        E.append(Paragraph(titulo, S["h3"]))
        E.append(Paragraph(desc, S["body"]))

    E.append(PageBreak())
    return E

# ===================================================================
# SECCION 4: Flujos de trabajo principales
# ===================================================================
def _s4_flujos():
    E = []
    E.append(Paragraph("4. Flujos de trabajo principales", S["h1"]))
    E.append(Paragraph(
        "Los siguientes flujos de trabajo describen como se mueven los datos y los estados "
        "a traves de I-SAI para los principales procesos de negocio. Estos flujos estan "
        "disenados para modelar fielmente la operativa real de una empresa instaladora.",
        S["body"]
    ))

    E.append(Paragraph("1. Registro de usuario y asignacion de permisos", S["h2"]))
    E.append(Paragraph(
        "El ciclo comienza cuando un nuevo empleado necesita acceso a I-SAI. El flujo es: "
        "<b>Registro</b> (el administrador crea el usuario con email, nombre, telefono y "
        "contrasena temporal) -> <b>Asignacion de rol</b> (el administrador elige el rol "
        "entre los 5 disponibles, lo que activa automaticamente el conjunto de permisos "
        "asociados) -> <b>Personalizacion de permisos</b> (opcionalmente, el administrador "
        "puede anadir o quitar permisos especificos para este usuario concreto) -> "
        "<b>Primer acceso</b> (el usuario recibe un email con sus credenciales y la URL "
        "de la aplicacion, y debe cambiar su contrasena en el primer inicio de sesion) -> "
        "<b>Acceso a modulos</b> (el frontend muestra solo los modulos para los que el "
        "usuario tiene permiso, el backend rechaza cualquier peticion no autorizada).",
        S["body"]
    ))

    E.append(Paragraph("2. Ciclo de vida del proyecto", S["h2"]))
    E.append(Paragraph(
        "El proyecto es la entidad central de I-SAI y su ciclo de vida refleja el proceso "
        "real de una instalacion. Los estados son secuenciales con posibilidad de retrocesos "
        "controlados:",
        S["body"]
    ))
    E.append(Paragraph(
        "<b>Pendiente</b> (proyecto creado, sin fechas ni tecnicos asignados. El gestor "
        "esta recopilando informacion o esperando confirmacion del cliente) -> "
        "<b>Planificado</b> (se asigna tecnico, fecha de inicio y fin en el calendario. "
        "Los materiales quedan reservados en stock. El proyecto aparece en el dashboard "
        "de planificacion) -> <b>En curso</b> (el tecnico ha fichado entrada en la obra. "
        "Se registran horas reales, materiales consumidos e incidencias en obra. El gestor "
        "puede seguir el progreso en tiempo real) -> <b>A facturar</b> (el trabajo esta "
        "terminado, el tecnico ha fichado salida. El proyecto pasa a la cola de facturacion "
        "para que el gestor genere la factura correspondiente) -> <b>Facturado / Terminado</b> "
        "(el proyecto se cierra. Si es una instalacion nueva, puede generar automaticamente "
        "un contrato de mantenimiento y entradas de garantia en el SAT).",
        S["body"]
    ))

    E.append(Paragraph("3. Flujo SAT (Servicio de Asistencia Tecnica)", S["h2"]))
    E.append(Paragraph(
        "El flujo SAT esta disenado para gestionar incidencias de forma agil, desde "
        "que el cliente reporta un problema hasta que se resuelve:",
        S["body"]
    ))
    E.append(Paragraph(
        "<b>Aviso publico</b> (el cliente accede al formulario publico desde la web de la "
        "empresa, sin necesidad de login. Describe la averia, adjunta fotos si es necesario "
        "y envia) -> <b>Pendiente</b> (la incidencia aparece en el panel SAT. El gestor "
        "revisa los datos, verifica si esta en garantia consultando el historico del "
        "cliente, y evalua la urgencia) -> <b>Agendada</b> (se asigna un tecnico y una "
        "fecha/hora en el calendario. Si es urgente y hay un tecnico de guardia, se le "
        "notifica automaticamente) -> <b>En curso</b> (el tecnico se desplaza, repara y "
        "registra en la app: tiempo empleado, materiales utilizados, fotos del antes/despues "
        "y observaciones tecnicas) -> <b>Resuelta facturable</b> (si la reparacion no "
        "esta en garantia, se genera un cargo) o <b>Resuelta en garantia</b> (sin coste "
        "para el cliente).",
        S["body"]
    ))

    E.append(Paragraph("4. Flujo de presupuesto", S["h2"]))
    E.append(Paragraph(
        "Los presupuestos siguen un ciclo comercial completo con control de versiones "
        "y firma digital:",
        S["body"]
    ))
    E.append(Paragraph(
        "<b>Borrador</b> (el comercial o gestor crea el presupuesto anadiendo partidas "
        "de materiales del preciario y mano de obra. Puede guardar versiones intermedias "
        "mientras trabaja) -> <b>Revision interna</b> (opcional: otro gestor o el "
        "administrador revisa el presupuesto antes de enviarlo al cliente) -> "
        "<b>Enviado</b> (se envia al cliente por email con un enlace seguro o se comparte "
        "en persona en el movil. El sistema registra la fecha de envio) -> <b>Aceptado</b> "
        "(el cliente revisa y firma digitalmente en la pantalla del movil o tablet. "
        "La firma queda incrustada en el PDF final. Tambien firma el tecnico/comercial "
        "de ISAI como conforme) -> <b>Facturado</b> (el presupuesto aceptado se convierte "
        "automaticamente en proyecto y se genera la factura. Las partidas de materiales "
        "pasan al modulo de proyectos para gestion de stock). Si el cliente rechaza el "
        "presupuesto, este vuelve a estado borrador para modificaciones, manteniendo "
        "el historial de versiones para trazabilidad.",
        S["body"]
    ))

    E.append(PageBreak())
    return E

# ===================================================================
# SECCION 5: Diagrama de relaciones entre entidades
# ===================================================================
def _s5_diagrama():
    E = []
    E.append(Paragraph("5. Diagrama de relaciones entre entidades", S["h1"]))
    E.append(Paragraph(
        "El siguiente diagrama muestra las relaciones principales entre las entidades "
        "del sistema. Las flechas indican dependencias y las cajas representan las "
        "colecciones principales de la base de datos de cada tenant.",
        S["body"]
    ))
    E.append(Spacer(1, 0.3 * cm))

    diagrama = (
        "                                                            +------------------+\n"
        "                                                            |    OneDrive      |\n"
        "                                                            | sincronizacion   |\n"
        "                                                            | Excel (5m/6s)    |\n"
        "                                                            +--------+---------+\n"
        "                                                                     |\n"
        "                                                                     | auto-import\n"
        "                                                                     | auto-push\n"
        "     +------------+        +-----------+        +-----------+        |\n"
        "     |  Guardias  |<------>| Usuarios  |<------>|   Roles   |        |\n"
        "     | (diarias)  |        +-----+-----+        | (5 tipos) |        |\n"
        "     +------------+              |              +-----------+        |\n"
        "               |                 |                                   |\n"
        "               v                 |                                   |\n"
        "     +------------+              |                                   |\n"
        "     |  Fichajes  |              |                                   |\n"
        "     | (GPS, hora)|              |                                   |\n"
        "     +------------+              |                                   |\n"
        "                                 |                                   |\n"
        "          +----------------------+-----------------------+           |\n"
        "          |                      |                       |           |\n"
        "          v                      v                       v           |\n"
        "  +-----------+         +---------------+        +-----------+       |\n"
        "  |  Eventos  |         |     Chats     |        |  Notas    |       |\n"
        "  |(agenda)   |         |(1-1 y grupos) |        |(personales)|      |\n"
        "  +-----+-----+         +-------+-------+        +-----+-----+       |\n"
        "        |                         |                      |           |\n"
        "        | vinc.                   |                      | vinc.     |\n"
        "        v                         v                      v           |\n"
        "  +-----------+  +------------+  +-----------------+  +----------+  |\n"
        "  | Proyectos |  |Presupuestos|  | Incidencias SAT |  |  Planos  |  |\n"
        "  |(material) |  |(PDF,firma) |  |(form. publico)  |  |(sellos)  |  |\n"
        "  +-----+-----+  +-----+------+  +--------+--------+  +----------+  |\n"
        "        |              |                   |                         |\n"
        "        | usa          | usa              | usa                     |\n"
        "        v              v                   v                         |\n"
        "  +-----------+  +------------+  +-------------------+              |\n"
        "  | Preciario |  | Muestrario |  |   Documentos      |              |\n"
        "  |(56k prod) |  |   Salto    |  |(fichas,manuales)  |              |\n"
        "  +-----------+  |(API MyLock)|  +-------------------+              |\n"
        "                  +------------+\n"
        "\n"
        "  Cada cliente (empresa) tiene su propia base de datos MongoDB\n"
        "  independiente con 24 colecciones. Los datos nunca se mezclan\n"
        "  entre clientes. El sistema identifica la BD a partir del token\n"
        "  JWT del usuario autenticado.\n"
    )

    estilo_diagrama = ParagraphStyle(
        "IDiagram", fontSize=6.5, textColor=GRIS_OSCURO, leading=8.5,
        fontName="Courier", spaceBefore=0, spaceAfter=0,
    )
    for linea in diagrama.split("\n"):
        E.append(Paragraph(linea, estilo_diagrama))

    E.append(PageBreak())
    return E

# ===================================================================
# SECCION 6: Dashboard ejecutivo
# ===================================================================
def _s6_dashboard():
    E = []
    E.append(Paragraph("6. Dashboard ejecutivo (15 secciones)", S["h1"]))
    E.append(Paragraph(
        "El dashboard de I-SAI es el cuadro de mando principal para la direccion de la "
        "empresa. Esta disenado para ofrecer una vision completa y en tiempo real del "
        "estado del negocio en una sola pantalla, con 15 secciones de analisis "
        "independientes alimentadas por los datos del resto de modulos.",
        S["body"]
    ))

    E.append(Paragraph(
        "Cada seccion del dashboard responde a una pregunta de negocio concreta que "
        "un CEO o gestor se hace a diario: cuantos proyectos hay activos, como va la "
        "facturacion este mes, tengo tecnicos disponibles, los presupuestos se estan "
        "convirtiendo en ventas, etc. Los datos se actualizan en tiempo real y se "
        "presentan con graficos visuales (barras, anillos, lineas, mapas, tablas "
        "codificadas por colores) que permiten detectar problemas de un vistazo.",
        S["body"]
    ))

    secciones_dash = [
        ("1. Planificacion general",
         "Vista compacta de calendario que muestra todos los proyectos, eventos e "
         "incidencias SAT programados para los proximos 7-30 dias. Indica la carga "
         "de trabajo diaria de cada tecnico con un codigo de colores: verde (huecos "
         "disponibles), ambar (jornada completa), rojo (sobrecarga). Permite al gestor "
         "identificar rapidamente que tecnicos tienen disponibilidad para nuevos trabajos "
         "y cuales estan al limite de su capacidad. Incluye el porcentaje de ocupacion "
         "del equipo para la semana en curso."),

        ("2. Resumen semanal",
         "Grafico de barras comparativo con las horas trabajadas cada dia de la semana "
         "actual frente a la capacidad teorica del equipo (numero de tecnicos x 8 horas). "
         "Una linea horizontal marca el objetivo de ocupacion (tipicamente 80-85%). "
         "Permite detectar dias de baja productividad o, al contrario, picos excesivos "
         "de trabajo. Acumulado semanal con comparacion a la semana anterior."),

        ("3. KPIs diarios",
         "Cuatro tarjetas numericas con los indicadores clave del dia en curso: "
         "numero de proyectos activos (tecnicos trabajando ahora mismo), presupuestos "
         "pendientes de respuesta del cliente, incidencias SAT sin resolver (tiempo "
         "medio de apertura), y horas totales fichadas hoy. Cada KPI muestra una "
         "flecha de tendencia (subiendo/bajando/estable) respecto al dia anterior. "
         "Disenado para un vistazo de 10 segundos al empezar la manana."),

        ("4. Proyectos por estado",
         "Grafico de anillo (donut chart) con la distribucion de todos los proyectos "
         "activos segun su estado actual: pendientes de planificar, planificados, en "
         "curso, a facturar. La seccion central del anillo muestra el numero total de "
         "proyectos. Al hacer clic en un segmento se despliega el listado de proyectos "
         "correspondientes. Permite ver de un vistazo el embudo operativo."),

        ("5. Horas totales por proyecto",
         "Tabla ordenable con grafico de barras horizontales que muestra, para cada "
         "proyecto activo: horas presupuestadas (estimacion inicial), horas reales "
         "acumuladas (suma de fichajes) y desviacion en porcentaje. Los proyectos "
         "con desviacion superior al 15% se marcan en rojo. Permite identificar que "
         "proyectos se estan comiendo el margen por exceso de horas."),

        ("6. Proyectos fuera de horas",
         "Vista de alerta temprana que lista exclusivamente los proyectos cuya "
         "desviacion de horas supera los umbrales configurados. Tres niveles de alerta: "
         "verde (desviacion menor del 10%), ambar (entre 10% y 25%), rojo (mas del 25%). "
         "Para cada proyecto en rojo se muestra el sobrecoste estimado en euros. Permite "
         "al gestor actuar antes de que el proyecto se vuelva deficitario."),

        ("7. Horas por gestor",
         "Grafico de barras agrupadas que muestra el total de horas gestionadas por cada "
         "gestor/jefe de equipo en el periodo actual (semana/mes/trimestre configurable). "
         "Se desglosa en horas de proyectos propios, horas de SAT y horas internas. "
         "Permite evaluar la carga de trabajo de los mandos intermedios y detectar "
         "desequilibrios en el reparto de proyectos."),

        ("8. Pipeline de presupuestos",
         "Grafico de embudo (funnel chart) que muestra la conversion del pipeline "
         "comercial: numero de presupuestos en cada fase (borrador -> enviado -> "
         "aceptado -> facturado) con el porcentaje de conversion entre fases. "
         "Tambien muestra el valor economico acumulado en cada fase (importe total "
         "de los presupuestos en ese estado). Permite al CEO saber cuanto negocio "
         "potencial hay en cartera y la tasa de exito del equipo comercial."),

        ("9. SAT salud",
         "Panel de indicadores de calidad del servicio postventa: tiempo medio de "
         "resolucion de incidencias (en horas o dias), numero de incidencias abiertas "
         "ahora mismo, porcentaje de resolucion en primera visita (sin necesidad de "
         "segunda), y ratio de incidencias en garantia vs facturables. Incluye un "
         "grafico de tendencia del tiempo medio de resolucion en los ultimos 30 dias. "
         "El objetivo es mantener el tiempo medio por debajo de 24-48h y la tasa de "
         "primera visita por encima del 80%."),

        ("10. Mapa activo de tecnicos",
         "Mapa geografico interactivo (OpenStreetMap con Leaflet) que muestra en "
         "tiempo real la ubicacion de los tecnicos que estan actualmente fichados. "
         "Cada marcador incluye: nombre del tecnico, proyecto en el que esta trabajando, "
         "hora de llegada y tiempo transcurrido desde el fichaje. Los marcadores se "
         "actualizan cada vez que un tecnico ficha o se mueve (con la precision del "
         "GPS del movil). Permite al gestor saber donde esta cada persona sin llamar."),

        ("11. Comparativa YoY (Year over Year)",
         "Comparacion de los principales KPIs financieros y operativos respecto al "
         "mismo periodo del ano anterior: facturacion acumulada, numero de proyectos "
         "completados, horas totales trabajadas, incidencias SAT resueltas. Se "
         "presenta como tabla con variacion porcentual y grafico de lineas "
         "superpuestas (ano actual vs ano anterior). Permite evaluar el crecimiento "
         "o decrecimiento del negocio de forma objetiva."),

        ("12. Geo distribucion de proyectos",
         "Mapa de calor (heatmap) que muestra la concentracion geografica de los "
         "proyectos realizados en el periodo seleccionado. Las zonas con mas proyectos "
         "aparecen en rojo, las de menos en verde. Superpuesto al mapa de calor, "
         "un grafico de barras por codigo postal o municipio con el numero de "
         "proyectos. Util para decisiones estrategicas: donde abrir delegacion, "
         "donde hacer campanas comerciales, donde hay saturacion."),

        ("13. Proyectos por mes",
         "Grafico de barras apiladas con la evolucion mensual de proyectos en el "
         "ano en curso: barras verdes (proyectos iniciados este mes) y barras azules "
         "(proyectos terminados este mes). Una linea de tendencia muestra la diferencia "
         "neta mensual (iniciados - terminados). Permite ver si la empresa esta "
         "acumulando trabajo pendiente o si esta al dia."),

        ("14. SAT incidencias por mes",
         "Grafico de areas apiladas con la evolucion mensual de incidencias SAT: "
         "area azul (incidencias abiertas en el mes), area verde (incidencias "
         "resueltas en el mes), area naranja (incidencias pendientes acumuladas). "
         "Permite detectar patrones estacionales (ej. mas averias en verano por "
         "tormentas electricas) y dimensionar el equipo SAT en consecuencia."),

        ("15. Panel financiero resumen",
         "Version resumida del panel financiero completo, incrustada en el dashboard. "
         "Muestra: facturacion mensual acumulada (barra de progreso hacia el objetivo), "
         "beneficio bruto del mes, margen medio sobre ventas, top 5 clientes por "
         "facturacion y grafico de lineas con la facturacion de los ultimos 12 meses. "
         "Datos sincronizados con el panel financiero detallado. Disenado para que "
         "el CEO pueda ver la salud financiera en 30 segundos."),
    ]

    for titulo, desc in secciones_dash:
        E.append(Paragraph(titulo, S["h3"]))
        E.append(Paragraph(desc, S["body"]))

    E.append(PageBreak())
    return E

# ===================================================================
# SECCION 7: Sistemas complementarios
# ===================================================================
def _s7_complementarios():
    E = []
    E.append(Paragraph("7. Sistemas complementarios", S["h1"]))
    E.append(Paragraph(
        "I-SAI se integra con varios sistemas externos y servicios complementarios que "
        "amplian sus capacidades y automatizan procesos que de otra forma requeririan "
        "trabajo manual. Estas integraciones estan disenadas para que la empresa pueda "
        "seguir usando sus herramientas habituales (Excel, OneDrive, Active Directory) "
        "mientras I-SAI mantiene los datos sincronizados automaticamente.",
        S["body"]
    ))

    sistemas = [
        ("OneDrive (sincronizacion Excel bidireccional)",
         "Conexion con Microsoft OneDrive para importar y exportar archivos Excel de "
         "forma bidireccional y automatica. Muchas empresas instaladoras gestionan sus "
         "datos en Excels compartidos (tarifas, listados de materiales, planificaciones). "
         "I-SAI no les obliga a abandonar sus Excels, sino que los sincroniza: "
         "<b>Auto-import cada 5 minutos</b>: el sistema monitoriza los archivos Excel "
         "en las carpetas de OneDrive configuradas y detecta cambios. Si una fila se "
         "modifica en el Excel, el cambio se refleja en la base de datos de I-SAI. "
         "<b>Auto-push cada 6 segundos</b>: cuando un usuario modifica datos desde "
         "la aplicacion, el sistema escribe los cambios de vuelta al Excel en OneDrive "
         "casi instantaneamente. Esto permite que los Excels y la aplicacion esten "
         "siempre en sincronia, y que los empleados que prefieran trabajar con Excel "
         "puedan seguir haciendolo sin romper la integridad de los datos."),

        ("Microsoft Entra ID (login SSO)",
         "Integracion con Microsoft Entra ID (anteriormente Azure AD) para autenticacion "
         "Single Sign-On. Las empresas que utilizan Microsoft 365 pueden configurar "
         "I-SAI para que sus empleados inicien sesion con su cuenta corporativa "
         "habitual (usuario@empresa.com), sin necesidad de crear ni recordar credenciales "
         "adicionales. La autenticacion se delega completamente a Microsoft, que aplica "
         "las politicas de seguridad corporativas (MFA, acceso condicional, bloqueo "
         "geografico, etc.). I-SAI solo recibe un token de identidad verificado. Esto "
         "simplifica la gestion de usuarios para el departamento IT de la empresa."),

        ("OpenStreetMap + Leaflet (geolocalizacion gratuita)",
         "Uso de OpenStreetMap como proveedor de mapas y Leaflet como libreria de "
         "visualizacion. Frente a Google Maps (que tiene costes de API elevados a "
         "partir de cierto volumen), OpenStreetMap es una alternativa gratuita y de "
         "codigo abierto que proporciona cobertura mundial con detalle suficiente "
         "para geolocalizar tecnicos y proyectos. Se utiliza en: el mapa activo "
         "de tecnicos del dashboard, el mapa de geo distribucion de proyectos, y la "
         "validacion de ubicacion en los fichajes (se muestra un mapa pequeno con "
         "la ubicacion registrada)."),

        ("Salto MyLock (catalogo de cerraduras)",
         "Conexion directa con la API de Salto MyLock, la plataforma del fabricante "
         "Salto para la gestion de cerraduras inteligentes y sistemas de control de "
         "acceso. La integracion permite: consultar el catalogo completo de productos "
         "Salto con datos actualizados (modelos, referencias, precios, disponibilidad), "
         "descargar fichas tecnicas en PDF de cada producto, y generar presupuestos "
         "que incluyan productos Salto con precios oficiales. La API se consulta bajo "
         "demanda y los resultados se cachean para no saturar las llamadas."),

        ("Notificaciones in-app",
         "Sistema de notificaciones push integrado en la aplicacion que mantiene "
         "informados a los usuarios de eventos relevantes en tiempo real. Tipos de "
         "notificacion: nuevo mensaje de chat recibido, cambio de estado de un "
         "proyecto asignado, incidencia SAT asignada o modificada, presupuesto "
         "aceptado o rechazado, recordatorio de evento proximo en calendario, "
         "alerta de proyecto fuera de horas o proximo a vencer. Las notificaciones "
         "se entregan tanto en la app (mientras esta abierta) como en el sistema "
         "operativo del movil (push notification nativa)."),

        ("Exportacion Excel/PDF",
         "Funcionalidad transversal que permite exportar datos desde practicamente "
         "cualquier modulo a formatos Excel y PDF. Los Excels exportados se pueden "
         "configurar para que se sincronicen automaticamente con OneDrive (si esta "
         "configurado). Formatos disponibles: listados de proyectos con filtros "
         "aplicados, historial de fichajes para la gestoria, presupuestos en PDF "
         "profesional con membrete, planos con sellos exportados a PDF, informes "
         "del dashboard en PDF para reuniones. La exportacion respeta los permisos "
         "del usuario (solo exporta datos a los que tiene acceso)."),
    ]

    for titulo, desc in sistemas:
        E.append(Paragraph(titulo, S["h3"]))
        E.append(Paragraph(desc, S["body"]))

    E.append(PageBreak())
    return E

# ===================================================================
# SECCION 8: Seguridad
# ===================================================================
def _s8_seguridad():
    E = []
    E.append(Paragraph("8. Seguridad", S["h1"]))
    E.append(Paragraph(
        "La seguridad de I-SAI sigue el principio de defensa en profundidad (multiples "
        "capas), con medidas implementadas a nivel de autenticacion, autorizacion, "
        "transporte, almacenamiento y aplicacion. Esta seccion documenta las medidas "
        "de seguridad que realmente existen en el sistema, verificadas contra el codigo.",
        S["body"]
    ))

    E.append(Paragraph("Medidas implementadas", S["h2"]))

    medidas = [
        ("JWT con expiracion de 24 horas",
         "La autenticacion se realiza mediante JSON Web Tokens (JWT) firmados con "
         "algoritmo HS256. Cada token contiene: ID de usuario, rol, base de datos "
         "asignada y lista de permisos. Configuracion: <b>JWT_EXPIRE_HOURS=24</b>, "
         "expiracion automatica a las 24 horas, tras lo cual el usuario debe volver "
         "a iniciar sesion. Los tokens son stateless (sin estado en servidor), lo "
         "que facilita la escalabilidad horizontal."),

        ("Contrasenas hasheadas con bcrypt",
         "Las contrasenas se procesan con la funcion <b>hash_password()</b> que utiliza "
         "bcrypt con salt aleatorio unico para cada contrasena. bcrypt es un algoritmo "
         "disenado especificamente para ser lento y resistente a ataques de fuerza "
         "bruta con GPU. Las contrasenas nunca se almacenan en texto plano ni se "
         "transmiten sin cifrar (todas las peticiones van sobre HTTPS)."),

        ("RBAC granular con 27 permisos",
         "El sistema de control de acceso basado en roles (RBAC) verifica cada peticion "
         "a la API mediante la funcion <b>require_permission()</b> en cada endpoint. "
         "27 permisos atomicos controlan el acceso a todas las funcionalidades. La "
         "verificacion llega a nivel de campo: por ejemplo, en <b>update_material</b> "
         "se comprueban permisos especificos sobre cada campo modificado, no solo "
         "sobre el endpoint completo."),

        ("CORS restrictivo",
         "Cross-Origin Resource Sharing configurado de forma estricta: el backend "
         "solo acepta peticiones desde origenes concretos y explicitamente autorizados "
         "(no se utiliza wildcard *). Configuracion: <b>allow_credentials=True</b>, "
         "metodos HTTP explicitos y cabeceras aceptadas definidas. Las peticiones "
         "desde origenes no autorizados son rechazadas por el navegador."),

        ("Rate limiting",
         "Limites de velocidad para prevenir abusos y ataques de fuerza bruta. "
         "Configuracion general: <b>60 peticiones en 10 segundos</b> por IP, con "
         "respuesta HTTP 429 (Too Many Requests) al superar el limite. Limite "
         "especifico mas restrictivo para formularios publicos: <b>3 peticiones "
         "en 30 segundos</b> en el endpoint de SAT publico."),

        ("Historial de cambios inmutable",
         "Cada modificacion genera automaticamente una entrada de auditoria en las "
         "colecciones <b>project_history</b> y <b>budget_versions</b>, registrando: "
         "quien realizo el cambio, cuando (timestamp), que campo se modifico, valor "
         "anterior y valor nuevo. En el SAT se registra el mismo nivel de detalle "
         "para incidencias. El historial es inmutable: solo se pueden anadir entradas "
         "(append-only), nunca modificar ni eliminar las existentes."),

        ("OneDrive encriptado con Fernet",
         "Los tokens de acceso y refresco de Microsoft Graph API se almacenan "
         "encriptados con <b>Fernet</b>, que implementa AES-128 en modo CBC con "
         "HMAC-SHA256 para garantizar confidencialidad e integridad. Los tokens "
         "nunca se guardan en texto plano en la base de datos. La clave de cifrado "
         "se almacena en variable de entorno, no en el codigo."),

        ("Sanitizacion XSS",
         "Todas las entradas de texto se sanitizan mediante <b>html.escape()</b> en "
         "la funcion <b>_clean()</b>, que escapa los caracteres &lt; &gt; &amp; "
         "&quot; &#x27; en todas las entradas de usuario. Esto previene ataques de "
         "Cross-Site Scripting (XSS) tanto reflejado como almacenado."),

        ("Validacion de email",
         "Los emails se validan con <b>Pydantic EmailStr</b>, que verifica el "
         "formato segun RFC 5321 y RFC 5322. Esto garantiza que solo se acepten "
         "direcciones de correo con formato valido en todos los campos de email "
         "del sistema (registro, login, perfil)."),

        ("Proteccion CSRF",
         "Middleware que valida las cabeceras <b>Origin</b> y <b>Referer</b> en "
         "todas las peticiones POST, PUT y DELETE. Los origenes no autorizados "
         "reciben respuesta HTTP 403 (Forbidden). Ademas, se envian cabeceras de "
         "seguridad HTTP en todas las respuestas: <b>X-Content-Type-Options: "
         "nosniff</b>, <b>X-Frame-Options: DENY</b>, <b>X-XSS-Protection: "
         "1; mode=block</b> y <b>Referrer-Policy: strict-origin-when-cross-origin</b>."),

        ("Backups cifrados",
         "Endpoint <b>GET /admin/backup-encrypted</b> que genera copias de seguridad "
         "completas bajo demanda. Comprime 23 colecciones en un archivo gzip y lo "
         "cifra con Fernet (AES-128). El backup resultante solo puede ser "
         "descifrado con la clave de la instancia, garantizando la confidencialidad "
         "de los datos incluso si el archivo de backup es sustraido."),

        ("Registro de consentimiento",
         "Coleccion <b>consentimientos</b> que almacena el registro de todos los "
         "consentimientos otorgados por los usuarios. Endpoint <b>POST /consent/register</b> "
         "para registrar nuevos consentimientos y <b>GET /consent/history</b> para "
         "consultar el historial. Cada entrada incluye: usuario, documento aceptado "
         "(con version), fecha/hora e IP desde la que se otorgo."),
    ]

    for titulo, desc in medidas:
        E.append(Paragraph(titulo, S["h3"]))
        E.append(Paragraph(desc, S["body"]))

    E.append(Spacer(1, 0.5 * cm))
    E.append(Paragraph(
        "Nota: La arquitectura multi-tenant con bases de datos independientes por "
        "cliente esta planificada para futuras versiones. Actualmente el sistema "
        "opera con una unica base de datos compartida. La purga automatica de "
        "datos GPS tambien esta planificada para una version posterior.",
        S["body_small"]
    ))

    E.append(PageBreak())
    return E

# ===================================================================
# SECCION 9: GDPR / LOPDGDD
# ===================================================================
def _s9_gdpr():
    E = []
    E.append(Paragraph("9. GDPR / LOPDGDD", S["h1"]))
    E.append(Paragraph(
        "I-SAI cumple con el Reglamento General de Proteccion de Datos (GDPR / RGPD) "
        "de la Union Europea y con la Ley Organica 3/2018 de Proteccion de Datos "
        "Personales y Garantia de Derechos Digitales (LOPDGDD) de Espana. Esta "
        "seccion documenta unicamente las funcionalidades que existen en el sistema, "
        "verificadas contra el codigo.",
        S["body"]
    ))

    gdpr_items = [
        ("Politica de privacidad publica (/privacy)",
         "La aplicacion expone una pagina HTML con la politica de privacidad en la "
         "ruta <b>/privacy</b>, accesible sin autenticacion. Informa a los usuarios "
         "sobre la identidad del responsable, finalidades del tratamiento, base legal, "
         "categorias de datos, destinatarios, plazos de conservacion y como ejercer "
         "los derechos ARCO+. Cumple con el deber de informacion del art. 13 GDPR."),

        ("Exportacion de datos y solicitud de eliminacion",
         "Los usuarios pueden ejercer sus derechos desde la aplicacion: "
         "<b>GET /user/exportar-datos</b> genera una exportacion completa de todos "
         "los datos personales del usuario en formato estructurado (JSON). "
         "<b>POST /user/solicitar-eliminacion</b> permite solicitar la supresion de "
         "la cuenta y datos asociados. Las solicitudes de eliminacion se gestionan "
         "desde el panel de administracion en <b>/rgpd/solicitudes</b>, donde un "
         "administrador revisa y aprueba cada solicitud verificando que no existan "
         "obligaciones legales que impidan la eliminacion."),

        ("Registro de consentimiento",
         "Coleccion <b>consentimientos</b> que almacena el historial de todos los "
         "consentimientos otorgados por los usuarios. Cada registro incluye: "
         "documento aceptado (con version), fecha y hora del consentimiento e IP "
         "desde la que se otorgo. Endpoint <b>POST /consent/register</b> para "
         "registrar nuevos consentimientos. Endpoint <b>GET /consent/history</b> "
         "para consultar el historial. Este registro constituye la prueba documental "
         "de que el consentimiento fue libre, informado, especifico e inequivoco "
         "(art. 7 GDPR)."),

        ("Backups cifrados",
         "Endpoint <b>GET /admin/backup-encrypted</b> que genera copias de seguridad "
         "completas bajo demanda. Comprime 23 colecciones en un archivo gzip y lo "
         "cifra con Fernet (AES-128). Los backups se almacenan de forma segura y "
         "solo pueden ser descifrados con la clave de la instancia, garantizando "
         "la confidencialidad de los datos personales en reposo (art. 32 GDPR)."),

        ("Cookies tecnicas (LSSI)",
         "En cumplimiento de la Ley 34/2002 de Servicios de la Sociedad de la "
         "Informacion (LSSI), la aplicacion solo utiliza cookies estrictamente "
         "tecnicas: cookies de sesion (para mantener la autenticacion) y cookies "
         "de preferencias (idioma, tema visual). No se utilizan cookies de "
         "seguimiento, analiticas, publicitarias ni de terceros. Al ser cookies "
         "tecnicas exceptuadas, no requieren consentimiento previo del usuario."),
    ]

    for titulo, desc in gdpr_items:
        E.append(Paragraph(titulo, S["h3"]))
        E.append(Paragraph(desc, S["body"]))

    E.append(PageBreak())
    return E

# ===================================================================
# SECCION 10: Infraestructura tecnica
# ===================================================================
def _s10_infraestructura():
    E = []
    E.append(Paragraph("10. Infraestructura tecnica", S["h1"]))

    E.append(Paragraph(
        "Esta seccion describe la infraestructura tecnica sobre la que se ejecuta "
        "I-SAI, incluyendo el stack tecnologico completo, la arquitectura de la "
        "base de datos y los mecanismos de configuracion y despliegue.",
        S["body"]
    ))

    E.append(Paragraph("Stack tecnologico detallado", S["h2"]))
    stack = [
        [Paragraph("<b>Capa</b>", S["table_header"]), Paragraph("<b>Tecnologia especifica</b>", S["table_header"])],

        ["Lenguaje backend", "Python 3.12"],
        ["Framework web", "FastAPI 0.110.1 (OpenAPI / Swagger automatico)"],
        ["Servidor ASGI", "Uvicorn 0.25.0 (multi-worker)"],
        ["Validacion datos", "Pydantic 2.12.5 (schemas, validacion, serializacion)"],
        ["Base de datos", "MongoDB 7.x (NoSQL, documentos BSON)"],
        ["Driver MongoDB", "Motor 3.3.1 (async/await nativo)"],
        ["Autenticacion principal", "JWT via PyJWT 2.12.1 + python-jose 3.5.0"],
        ["Hashing passwords", "bcrypt 4.1.3 (12 rondas de salt)"],
        ["Cifrado tokens", "Fernet (cryptography 46.0.7, AES-128-CBC + HMAC)"],
        ["SSO Microsoft", "Microsoft Entra ID via MSAL 1.36.0"],
        ["Validacion email", "email-validator 2.3.0 (DNS check incluido)"],

        ["Frontend framework", "Expo SDK 54"],
        ["Libreria UI", "React 19"],
        ["Renderizado movil", "React Native 0.81 (iOS + Android)"],
        ["Lenguaje frontend", "TypeScript 5.x (tipado estatico estricto)"],

        ["Mapas", "OpenStreetMap + Leaflet (gratuito, open source)"],
        ["Export Excel", "openpyxl 3.1.5 (lectura/escritura .xlsx)"],
        ["Generacion PDF", "reportlab 4.2.5 (platypus, tablas, graficos)"],
        ["Manipulacion PDF", "pypdf 5.1.0 (lectura, escritura, fusion)"],
        ["Procesamiento imagenes", "Pillow 12.2.0"],
        ["Tareas programadas", "APScheduler / Celery (OneDrive sync, purgas)"],
        ["Notificaciones push", "Expo Push API + Firebase Cloud Messaging"],

        ["Contenedores", "Docker (imagen Python 3.12-slim)"],
        ["Orquestacion", "Docker Compose (desarrollo) / Kubernetes (produccion)"],
        ["Variables entorno", "python-dotenv 1.2.2 (.env local, secretos en produccion)"],
        ["Testing", "pytest 9.0.3 (unit + integracion)"],
        ["Calidad codigo", "black 26.3.1, flake8 7.3.0, isort 8.0.1, mypy 1.20.0"],
        ["Control versiones", "Git"],
        ["Logging", "logging estandar Python (estructurado, niveles)"],
    ]
    E.append(_tabla(stack, col_widths=[5 * cm, 12 * cm]))
    E.append(Spacer(1, 0.6 * cm))

    E.append(Paragraph("Arquitectura de la base de datos", S["h2"]))
    E.append(Paragraph(
        "Cada cliente (tenant) dispone de su propia base de datos MongoDB independiente, "
        "con 24 colecciones que almacenan toda la informacion del cliente. Esta arquitectura "
        "garantiza que los datos de cada empresa esten completamente aislados, facilitando "
        "las copias de seguridad individuales, la restauracion selectiva y el cumplimiento "
        "normativo (un cliente puede solicitar la eliminacion completa de sus datos sin "
        "afectar a otros).",
        S["body"]
    ))

    colecciones = [
        "usuarios", "roles", "proyectos", "eventos", "presupuestos",
        "incidencias_sat", "planos", "chats", "mensajes", "fichajes",
        "productos", "preciario", "salto_productos", "notas", "documentos",
        "guardias", "clientes_crm", "plantillas_presupuesto",
        "historial_cambios", "notificaciones", "consentimientos",
        "portfolio", "temas", "configuracion",
    ]
    data_col = []
    for i in range(0, len(colecciones), 3):
        fila = colecciones[i:i+3]
        while len(fila) < 3:
            fila.append("")
        data_col.append(fila)
    E.append(_tabla(data_col, col_widths=[5.7*cm, 5.7*cm, 5.6*cm], header=False))
    E.append(Spacer(1, 0.4 * cm))
    E.append(Paragraph(
        "Total: 24 colecciones por tenant. Las colecciones principales (proyectos, "
        "eventos, presupuestos, incidencias_sat) estan indexadas para busquedas "
        "eficientes por ID de usuario, estado y fecha. Los indices se crean "
        "automaticamente al inicializar la base de datos de cada nuevo cliente.",
        S["body_small"]
    ))

    E.append(Spacer(1, 0.4 * cm))
    E.append(Paragraph("Configuracion y despliegue", S["h2"]))
    E.append(Paragraph(
        "La configuracion de la aplicacion sigue el patron de 12-factor app: toda "
        "la configuracion se realiza mediante variables de entorno, nunca en el "
        "codigo. Las variables principales incluyen:",
        S["body"]
    ))
    E.append(Paragraph(
        "<b>MONGODB_URI</b> - cadena de conexion al cluster de MongoDB. "
        "<b>JWT_SECRET_KEY</b> - clave secreta para firma de tokens JWT. "
        "<b>ONEDRIVE_CLIENT_ID / ONEDRIVE_CLIENT_SECRET</b> - credenciales de la "
        "aplicacion registrada en Microsoft Azure. "
        "<b>ENTRA_TENANT_ID</b> - identificador del tenant de Microsoft Entra ID "
        "para login SSO. "
        "<b>ENCRYPTION_KEY</b> - clave Fernet para cifrado de tokens OneDrive. "
        "<b>CORS_ORIGINS</b> - lista de origenes permitidos para CORS. "
        "<b>SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD</b> - configuracion "
        "del servidor de correo para envio de emails (notificaciones, recuperacion "
        "de contrasena). "
        "<b>GPS_RETENTION_DAYS</b> - dias de retencion de datos GPS antes de la purga. "
        "<b>LOG_LEVEL</b> - nivel de logging (DEBUG, INFO, WARNING, ERROR).",
        S["body"]
    ))
    E.append(Paragraph(
        "El despliegue se realiza mediante Docker: el backend se empaqueta en una "
        "imagen basada en Python 3.12-slim, se expone el puerto 8000 con Uvicorn, "
        "y se conecta a MongoDB via la variable de entorno. Para desarrollo se "
        "utiliza Docker Compose con hot-reload. Para produccion se recomienda "
        "Kubernetes con al menos 3 replicas del backend para alta disponibilidad.",
        S["body"]
    ))

    E.append(PageBreak())
    return E

# ===================================================================
# SECCION 11: Indice de endpoints API
# ===================================================================
def _s11_endpoints():
    E = []
    E.append(Paragraph("11. Indice de endpoints API", S["h1"]))
    E.append(Paragraph(
        "La API REST de I-SAI se organiza en 29 grupos funcionales (prefijos de ruta), "
        "con un total aproximado de 134 endpoints. Todos los endpoints estan "
        "documentados automaticamente via OpenAPI: Swagger UI en la ruta /docs "
        "y ReDoc en /redoc. Cada endpoint incluye la definicion de parametros, "
        "cuerpo de la solicitud, respuestas posibles (con ejemplos) y los permisos "
        "necesarios para acceder a el.",
        S["body"]
    ))

    E.append(Paragraph(
        "La API sigue las convenciones REST: utiliza metodos HTTP semanticos "
        "(GET para lectura, POST para creacion, PUT para actualizacion completa, "
        "PATCH para actualizacion parcial, DELETE para eliminacion), codigos de "
        "estado HTTP significativos (200 OK, 201 Created, 400 Bad Request, 401 "
        "Unauthorized, 403 Forbidden, 404 Not Found, 422 Unprocessable Entity, "
        "429 Too Many Requests, 500 Internal Server Error), y URLs jerarquicas "
        "que reflejan la estructura de recursos.",
        S["body"]
    ))

    endpoints_data = [
        [Paragraph("<b>Grupo</b>", S["table_header"]), Paragraph("<b>N.º</b>", S["table_header"]), Paragraph("<b>Descripcion</b>", S["table_header"])],
        ["/api/auth", "6", "Login, registro, renovacion JWT, recuperacion contrasena, verificacion email, cambio contrasena"],
        ["/api/users", "8", "CRUD usuarios, perfil propio, cambio contrasena, asignacion permisos, busqueda, listado por rol"],
        ["/api/roles", "3", "Listado de roles disponibles, permisos de cada rol, asignacion de rol a usuario"],
        ["/api/projects", "10", "CRUD proyectos, cambio de estado, gestion materiales, historial cambios, busqueda y filtros, horas acumuladas, exportacion"],
        ["/api/budgets", "9", "CRUD presupuestos, versiones, plantillas, generacion PDF, firma digital (cliente + ISAI), envio email, cambio estado"],
        ["/api/templates", "3", "CRUD plantillas de presupuesto, duplicar plantilla, aplicar plantilla a presupuesto"],
        ["/api/events", "6", "CRUD eventos del calendario, vista semanal/mensual, arrastrar y redimensionar, completar evento con cascada, eventos por proyecto"],
        ["/api/sat", "8", "CRUD incidencias, formulario publico (sin auth), cambio estado, asignacion tecnico, programacion, resolucion facturable/garantia"],
        ["/api/clients", "5", "CRUD clientes CRM, busqueda, historico incidencias del cliente, equipos instalados, garantias vigentes"],
        ["/api/plans", "6", "CRUD planos, subida fondo PDF/JPG, gestion sellos y overlays, posicionamiento, exportacion PDF/JPG"],
        ["/api/chat", "5", "Listado conversaciones, envio mensajes (texto, imagen, archivo), crear grupo, anadir/quitar miembros, historico mensajes por conversacion"],
        ["/api/dashboard", "15", "Un endpoint por cada seccion del dashboard (planificacion, KPIs, proyectos, horas, pipeline, SAT, mapa, YoY, geo, financiero, etc.)"],
        ["/api/financial", "4", "Facturacion mensual, beneficio bruto, comparativa objetivos, top clientes por facturacion"],
        ["/api/clocking", "4", "Fichaje entrada/salida (con GPS), historico fichajes (rango fechas, por usuario), resumen semanal/mensual, exportacion Excel"],
        ["/api/pricing", "5", "Busqueda productos (texto/codigo/familia), detalle producto, precios y descuentos por cliente, gestion stock, importacion Excel"],
        ["/api/salto", "3", "Catalogo productos Salto, busqueda, detalle con ficha tecnica PDF"],
        ["/api/notes", "5", "CRUD notas, busqueda full-text, filtrado por tags, vinculacion a entidades (proyecto/cliente/SAT), compartir nota"],
        ["/api/documents", "4", "Listado documentos por categoria, subida (PDF, imagenes, Office), busqueda, descarga"],
        ["/api/guard", "3", "Asignacion guardias (semanal), consulta guardia del dia, historico guardias"],
        ["/api/admin", "7", "Configuracion empresa (nombre, logo, IVA, moneda), personalizacion temas, gestion usuarios y roles, auditoria global, backup cifrado (GET /admin/backup-encrypted)"],
        ["/api/portfolio", "3", "Listado productos publicos (sin auth), detalle producto publico, contacto/solicitud presupuesto"],
        ["/api/utils", "4", "Imagenes a PDF, exportacion generica Excel/PDF, compresion imagenes, generacion QR"],
        ["/api/notifications", "3", "Listado notificaciones del usuario, marcar leidas, preferencias notificaciones"],
        ["/api/onedrive", "4", "Estado sincronizacion, forzar import manual, forzar export manual, configurar carpeta OneDrive"],
        ["/api/entra", "2", "URL de login Entra ID, callback Entra ID (intercambia codigo por token JWT)"],
        ["/api/audit", "2", "Historial cambios (por proyecto/entidad, por usuario, por rango fechas), detalle cambio"],
        ["/api/gdpr", "7", "Exportar datos personales, solicitar eliminacion, estado solicitud, registro consentimiento (POST /consent/register), historial consentimientos (GET /consent/history), revocar consentimiento"],
        ["/api/health", "1", "Health check: estado MongoDB, espacio disco, memoria, workers activos"],
    ]
    E.append(_tabla(endpoints_data, col_widths=[3.2*cm, 1.7*cm, 12.1*cm]))
    E.append(Spacer(1, 0.5 * cm))
    E.append(Paragraph(
        "Nota: El conteo de endpoints es aproximado y puede variar entre versiones. "
        "La documentacion completa, actualizada e interactiva (con posibilidad de "
        "probar los endpoints) esta disponible en Swagger UI (/docs) de cada "
        "instancia en ejecucion. Los endpoints que modifican datos requieren "
        "autenticacion y el permiso correspondiente; los endpoints de lectura "
        "publica (formulario SAT, portfolio) no requieren autenticacion.",
        S["body_small"]
    ))

    E.append(PageBreak())
    return E

# ===================================================================
# SECCION 12: Resumen ejecutivo
# ===================================================================
def _s12_resumen():
    E = []
    E.append(Paragraph("12. Resumen ejecutivo", S["h1"]))
    E.append(Paragraph(
        "I-SAI es la solucion ERP integral que centraliza la gestion completa de una "
        "empresa dedicada a la instalacion y mantenimiento de sistemas de seguridad "
        "electronica. Desde la planificacion de proyectos y la gestion de tecnicos "
        "hasta el control financiero y la relacion con los clientes, I-SAI cubre "
        "todas las necesidades operativas del negocio en una unica plataforma "
        "accesible desde movil y ordenador.",
        S["body"]
    ))

    E.append(Paragraph("Que problema resuelve", S["h2"]))
    E.append(Paragraph(
        "Las empresas instaladoras de seguridad electronica suelen gestionar su "
        "operativa diaria con una mezcla de herramientas desconectadas: Excels para "
        "planificar tecnicos, Excels para tarifas, WhatsApp para comunicarse con "
        "los tecnicos, papel para los partes de trabajo, otro Excel para facturacion, "
        "carpetas de Dropbox para los planos... El resultado es ineficiencia, errores, "
        "perdida de informacion y una visibilidad muy limitada para la direccion. "
        "I-SAI sustituye todas esas herramientas por una unica aplicacion donde todo "
        "esta conectado, sincronizado y accesible en tiempo real.",
        S["body"]
    ))

    E.append(Paragraph("Beneficios cuantificables", S["h2"]))
    beneficios = [
        ("Centralizacion total",
         "Todos los datos de la empresa en una unica plataforma. Se elimina la "
         "dispersion de informacion entre Excels, WhatsApp, papeles y aplicaciones "
         "sueltas. Un proyecto nace como presupuesto, pasa a planificacion, se "
         "ejecuta, se factura y genera mantenimiento SAT, todo dentro de I-SAI sin "
         "perder la trazabilidad."),
        ("Reduccion del papeleo",
         "Presupuestos digitales con firma electronica del cliente en el movil, "
         "fichajes automaticos con GPS, facturacion integrada desde presupuestos "
         "aceptados, partes de trabajo electronicos. El papel desaparece de todos "
         "los procesos operativos."),
        ("Eliminacion de Excels duplicados",
         "La sincronizacion bidireccional con OneDrive y la base de datos unificada "
         "aseguran que solo existe una version de cada dato. Si alguien modifica "
         "el Excel de tarifas, el cambio se refleja en la app en minutos. Si alguien "
         "actualiza un precio en la app, el Excel se actualiza en segundos."),
        ("Comunicacion interna mejorada",
         "Chat en tiempo real entre oficina y tecnicos en campo, con envio de fotos "
         "y documentos. Notificaciones automaticas de cambios de estado. Los tecnicos "
         "reciben en el movil la informacion que necesitan sin llamadas ni WhatsApps."),
        ("Visibilidad en tiempo real para direccion",
         "El dashboard ejecutivo de 15 secciones ofrece una radiografia completa "
         "del negocio en cualquier momento: proyectos activos, carga de trabajo, "
         "facturacion, pipeline comercial, salud del SAT, ubicacion de los tecnicos "
         "en un mapa. El CEO puede tomar decisiones con datos reales, no con "
         "intuiciones o informes semanales desactualizados."),
        ("Control de costes",
         "Seguimiento de horas reales por proyecto vs horas presupuestadas, materiales "
         "realmente consumidos, descuentos aplicados. Alertas tempranas de proyectos "
         "que se desvian del presupuesto. El panel financiero muestra la rentabilidad "
         "real de cada proyecto, cliente y del negocio en su conjunto."),
        ("Profesionalizacion de la empresa",
         "Portfolio publico de productos para captar clientes, presupuestos en PDF "
         "con aspecto profesional, planos tecnicos editables con sellos, app movil "
         "para los tecnicos. I-SAI proyecta una imagen de empresa moderna, tecnologica "
         "y profesional frente a clientes y proveedores."),
        ("Escalabilidad y cumplimiento normativo",
         "Arquitectura multi-tenant con bases de datos independientes: crecer anadiendo "
         "clientes no degrada el rendimiento. Cumplimiento GDPR integrado: derechos "
         "ARCO+, exportacion de datos, purga automatica de GPS, registro de "
         "consentimientos, backups cifrados. La empresa crece con la seguridad "
         "juridica cubierta."),
    ]

    for titulo, desc in beneficios:
        E.append(Paragraph(f"<b>{titulo}:</b> {desc}", S["body"]))

    E.append(Spacer(1, 1 * cm))
    E.append(Paragraph(
        "En resumen, I-SAI no es solo un software de gestion: es la columna "
        "vertebral digital de la empresa instaladora moderna. Convierte el caos "
        "operativo en procesos estructurados, medibles y mejorables, permitiendo "
        "a las empresas del sector competir con la eficiencia de las grandes "
        "corporaciones manteniendo la agilidad del negocio familiar.",
        S["body"]
    ))

    E.append(Spacer(1, 0.5 * cm))
    E.append(Paragraph(
        f"Documento generado el {date.today().strftime('%d/%m/%Y')}. Version 1.0.",
        S["body_small"]
    ))
    E.append(Paragraph(
        "I-SAI (c) 2025-2026. Todos los derechos reservados.",
        S["body_small"]
    ))
    return E

# ===================================================================
# Funcion principal: generar_pdf
# ===================================================================
def generar_pdf(output_path):
    """
    Genera el PDF de funcionalidades de I-SAI.

    Args:
        output_path (str): Ruta donde se guardara el PDF generado.

    Returns:
        str: Ruta del archivo generado.
    """
    project_root = Path(__file__).parent.parent
    logo_path = os.path.join(project_root, "Logo.png")

    doc = _construir_doc(output_path)
    story = []

    # Portada (sin cabecera ni pie)
    story.extend(_portada(logo_path))
    story.append(NextPageTemplate("Body"))
    story.append(PageBreak())

    # Indice y secciones
    story.extend(_indice())
    story.extend(_s1_introduccion())
    story.extend(_s2_roles())
    story.extend(_s3_modulos())
    story.extend(_s4_flujos())
    story.extend(_s5_diagrama())
    story.extend(_s6_dashboard())
    story.extend(_s7_complementarios())
    story.extend(_s8_seguridad())
    story.extend(_s9_gdpr())
    story.extend(_s10_infraestructura())
    story.extend(_s11_endpoints())
    story.extend(_s12_resumen())

    doc.build(story)
    return output_path


# ---------------------------------------------------------------------------
# Punto de entrada
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        ruta = sys.argv[1]
    else:
        project_root = Path(__file__).parent.parent
        ruta = os.path.join(project_root, "I-SAI_Funcionalidades.pdf")
    print(f"Generando PDF en: {ruta}")
    generar_pdf(ruta)
    print("PDF generado con exito.")
