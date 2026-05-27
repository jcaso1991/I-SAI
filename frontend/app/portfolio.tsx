import React, { useState } from "react";
import { useTheme } from "../src/theme";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Linking, Platform, useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ios, fontStyle } from "../src/ui/iosTheme";

const Print = require("expo-print");
let Sharing: any = null;
try {
  Sharing = require("expo-sharing");
} catch {}

const MODULOS = [
  {
    accent: "#3B82F6",
    accentBg: "rgba(59,130,246,0.15)",
    badge: "Panel de control",
    title: "Dashboard",
    roles: "Admin · Gestor",
    description: "Panel de control con KPIs en tiempo real: eventos del día, tickets SAT pendientes, presupuestos en curso y tasa de resolución. Widgets interactivos como anillo de proyectos por estado, barras de horas por gestor, top técnicos del mes, embudo de presupuestos y mapa de proyectos activos. Alertas críticas con notificación inmediata.",
    features: [
      "KPIs en tiempo real: eventos, SAT, presupuestos, horas",
      "Widgets visuales: anillos, barras, rankings",
      "Embudo de presupuestos y salud SAT",
      "Alertas críticas con notificación inmediata",
    ],
    techData: { endpoint: "GET /api/dashboard", perm: "Admin y Gestores" },
    renderMockup: () => (
      <>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
          {[
            { v: "12", l: "Activos" },
            { v: "5", l: "Pend." },
            { v: "8", l: "Hoy" },
            { v: "94%", l: "Resol." },
          ].map((kpi, i) => (
            <View key={i} style={{ backgroundColor: "#1E293B", borderRadius: 6, paddingVertical: 6, paddingHorizontal: 4, width: "22%", alignItems: "center" }}>
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "800" }}>{kpi.v}</Text>
              <Text style={{ color: "#94A3B8", fontSize: 8, marginTop: 1 }}>{kpi.l}</Text>
            </View>
          ))}
        </View>
        <Text style={{ color: "#94A3B8", fontSize: 9, marginBottom: 3 }}>Horas por gestor</Text>
        <View style={{ height: 5, backgroundColor: "#1E293B", borderRadius: 2.5, marginBottom: 4 }}>
          <View style={{ width: "75%", height: 5, backgroundColor: "#3B82F6", borderRadius: 2.5 }} />
        </View>
        <View style={{ height: 5, backgroundColor: "#1E293B", borderRadius: 2.5 }}>
          <View style={{ width: "45%", height: 5, backgroundColor: "#5BC87C", borderRadius: 2.5 }} />
        </View>
      </>
    ),
  },
  {
    accent: "#F59E0B",
    accentBg: "rgba(245,158,11,0.15)",
    badge: "Obras y materiales",
    title: "Proyectos",
    roles: "Admin · Gestor · Técnico",
    description: "Gestión completa de obras y materiales. Cada proyecto tiene código, cliente, ubicación, fechas, estado y horas previstas. Los estados fluyen de planificado → pendiente → terminado → facturado → bloqueado. Se vinculan al calendario y los técnicos reportan horas. Sincronización bidireccional automática con Excel en OneDrive.",
    features: [
      "Creación manual o desde Excel sincronizado",
      "Flujo de 5 estados con tracking visual",
      "Vinculación a eventos del calendario",
      "Reporte de horas por técnico",
    ],
    techData: { endpoint: "GET/POST/PUT /api/materials", sync: "OneDrive cada 5 min", perm: "Admin crea, Gestor edita, Técnico consulta" },
    renderMockup: () => (
      <>
        {[
          { status: "#5BC87C", name: "Edif. Torres del Sol", date: "15/06" },
          { status: "#F59E0B", name: "Centro Comercial Norte", date: "22/06" },
          { status: "#64748B", name: "Residencial Los Pinos", date: "01/07" },
        ].map((p, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 7 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: p.status, marginRight: 7 }} />
            <Text style={{ color: "#F8FAFC", fontSize: 10, flex: 1 }} numberOfLines={1}>{p.name}</Text>
            <Text style={{ color: "#64748B", fontSize: 9 }}>{p.date}</Text>
          </View>
        ))}
        <View style={{ position: "absolute", bottom: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: "#3B82F6", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="add" size={14} color="#F8FAFC" />
        </View>
      </>
    ),
  },
  {
    accent: "#7E51FD",
    accentBg: "rgba(126,81,253,0.15)",
    badge: "Planificación",
    title: "Calendario",
    roles: "Admin · Gestor",
    description: "Planificación de visitas técnicas, reuniones y eventos recurrentes. Cinco vistas: día con columnas horarias, semana, equipo (columna por técnico), mes y gestor con lista clasificable. Drag & drop para mover y redimensionar eventos. Adjuntos con previsualización de imágenes y PDFs. Guardias diarias asignables.",
    features: [
      "Cinco vistas: día, semana, equipo, mes, gestor",
      "Drag & drop para mover y redimensionar eventos",
      "Adjuntos con previsualización",
      "Guardias diarias y copia de eventos",
    ],
    techData: { endpoint: "GET/POST/PUT/DELETE /api/events", perm: "Admin y Gestor" },
    renderMockup: () => (
      <>
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 6 }}>
          <Ionicons name="chevron-back" size={9} color="#94A3B8" />
          <Text style={{ color: "#F8FAFC", fontSize: 11, fontWeight: "600", marginHorizontal: 10 }}>Mayo 2026</Text>
          <Ionicons name="chevron-forward" size={9} color="#94A3B8" />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 3 }}>
          {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => (
            <Text key={i} style={{ color: "#64748B", fontSize: 8, width: 22, textAlign: "center" }}>{d}</Text>
          ))}
        </View>
        {[
          ["", "", "1", "2", "3", "4", "5"],
          ["6", "7", "8", "9", "10", "11", "12"],
        ].map((row, ri) => (
          <View key={ri} style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 2 }}>
            {row.map((d, ci) => (
              <Text key={ci} style={{ color: d ? "#E2E8F0" : "#1E293B", fontSize: 8, width: 22, textAlign: "center" }}>{d || ""}</Text>
            ))}
          </View>
        ))}
        <View style={{ flexDirection: "row", marginTop: 5, paddingHorizontal: 2 }}>
          <View style={{ flex: 2, height: 2.5, backgroundColor: "#3B82F6", borderRadius: 1, marginRight: 3 }} />
          <View style={{ flex: 1, height: 2.5, backgroundColor: "#5BC87C", borderRadius: 1 }} />
        </View>
      </>
    ),
  },
  {
    accent: "#5BC87C",
    accentBg: "rgba(91,200,124,0.15)",
    badge: "Editor de dibujo",
    title: "Planos",
    roles: "Admin · Gestor · Técnico",
    description: "Editor de dibujo sobre planos con siete herramientas: lápiz, línea, rectángulo, círculo, texto, sellos predefinidos (puertas, ventanas, extintores) y firma. Fondo desde imagen, galería o cámara. Autoguardado cada 1200ms. Al guardar en evento, captura el canvas a resolución original y si el fondo era PDF lo convierte de vuelta a PDF, reemplazando el attachment original.",
    features: [
      "Siete herramientas + sellos predefinidos",
      "Fondo desde galería o cámara",
      "Autoguardado cada 1200ms",
      "Conversión automática PDF↔PDF al guardar",
    ],
    techData: { endpoint: "GET/POST/PUT /api/plans", extra: "POST /api/utils/image-to-pdf", perm: "Admin, Gestor y Técnico" },
    renderMockup: () => (
      <>
        <View style={{ height: 80, borderWidth: 1, borderColor: "#475569", borderRadius: 4, marginBottom: 6, overflow: "hidden" }}>
          <View style={{ position: "absolute", top: 8, left: 12, width: 50, height: 1, backgroundColor: "#64748B", transform: [{ rotate: "28deg" }] }} />
          <View style={{ position: "absolute", top: 12, right: 12, width: 40, height: 1, backgroundColor: "#64748B", transform: [{ rotate: "-22deg" }] }} />
          <View style={{ position: "absolute", bottom: 20, right: 20, width: 12, height: 1.5, backgroundColor: "#F59E0B" }} />
          <View style={{ position: "absolute", bottom: 8, left: 30, width: 20, height: 1, backgroundColor: "#64748B", transform: [{ rotate: "15deg" }] }} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 2 }}>
          {(["create-outline", "resize-outline", "square-outline", "ellipse-outline", "text-outline", "bookmark-outline"] as const).map((icon, i) => (
            <Ionicons key={i} name={icon} size={11} color="#64748B" />
          ))}
        </View>
      </>
    ),
  },
  {
    accent: "#F59E0B",
    accentBg: "rgba(245,158,11,0.15)",
    badge: "Atención técnica",
    title: "SAT",
    roles: "Admin · Gestor · Técnico",
    description: "Servicio de Atención Técnica. Gestión de tickets con datos del cliente, dirección, teléfono y observaciones. Flujo de estados: pendiente → agendada → resuelta, con historial completo de cambios (usuario, fecha, comentario). Asignación de técnicos desde la agenda integrada. Tickets manuales o desde formulario público /aviso-sat. Exportación a Excel.",
    features: [
      "Tickets manuales o desde formulario público",
      "Asignación de técnico vía agenda",
      "Historial completo de cambios",
      "Exportación a Excel con filtros",
    ],
    techData: { endpoint: "GET/POST/PUT /api/sat-tickets", perm: "Admin y permiso sat.edit" },
    renderMockup: () => (
      <>
        <View style={{ flexDirection: "row", marginBottom: 7, backgroundColor: "#1E293B", borderRadius: 6, overflow: "hidden" }}>
          <View style={{ flex: 1, paddingVertical: 4, backgroundColor: "#3B82F6", alignItems: "center", borderRadius: 6 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "600" }}>Pendientes (3)</Text>
          </View>
          <View style={{ flex: 1, paddingVertical: 4, alignItems: "center" }}>
            <Text style={{ color: "#94A3B8", fontSize: 9 }}>Resueltos (8)</Text>
          </View>
        </View>
        {[
          { icon: "time-outline" as const, color: "#F59E0B", title: "Fuga en baño 3B", date: "12:30" },
          { icon: "checkmark-circle-outline" as const, color: "#5BC87C", title: "Puerta atascada", date: "Ayer" },
        ].map((t, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
            <Ionicons name={t.icon} size={12} color={t.color} style={{ marginRight: 7 }} />
            <Text style={{ color: "#F8FAFC", fontSize: 10, flex: 1 }} numberOfLines={1}>{t.title}</Text>
            <Text style={{ color: "#64748B", fontSize: 9 }}>{t.date}</Text>
          </View>
        ))}
      </>
    ),
  },
  {
    accent: "#3B82F6",
    accentBg: "rgba(59,130,246,0.15)",
    badge: "Presupuestos",
    title: "Presupuestos",
    roles: "Admin · Comercial",
    description: "Presupuestos profesionales con datos del proyecto, listado de equipos autocompletado desde el preciario, cantidades y observaciones. Sección de entregas (tarjeta mantenimiento, llave Salto, EPS100) y firmas. Exportación a PDF con plantilla HTML (logo, tabla, entregas, firmas). Exportación a Excel desde el listado. Copia de presupuestos anteriores como plantilla.",
    features: [
      "Autocompletado desde el preciario",
      "Exportación a PDF profesional",
      "Exportación a Excel",
      "Copia de presupuestos como plantilla",
    ],
    techData: { endpoint: "GET/POST/PUT /api/budgets", extra: "GET /api/budgets/{id}/pdf", perm: "Admin y Comercial" },
    renderMockup: () => (
      <>
        <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#334155", paddingBottom: 3, marginBottom: 4 }}>
          <Text style={{ color: "#94A3B8", fontSize: 8, fontWeight: "600", flex: 2 }}>Elemento</Text>
          <Text style={{ color: "#94A3B8", fontSize: 8, fontWeight: "600", flex: 1, textAlign: "center" }}>Cant.</Text>
          <Text style={{ color: "#94A3B8", fontSize: 8, fontWeight: "600", flex: 1, textAlign: "right" }}>Precio</Text>
        </View>
        {[
          { elem: "Detector i3", cant: "4", precio: "320 €" },
          { elem: "Sirena exterior", cant: "2", precio: "180 €" },
        ].map((row, i) => (
          <View key={i} style={{ flexDirection: "row", marginBottom: 2 }}>
            <Text style={{ color: "#E2E8F0", fontSize: 9, flex: 2 }} numberOfLines={1}>{row.elem}</Text>
            <Text style={{ color: "#E2E8F0", fontSize: 9, flex: 1, textAlign: "center" }}>{row.cant}</Text>
            <Text style={{ color: "#E2E8F0", fontSize: 9, flex: 1, textAlign: "right" }}>{row.precio}</Text>
          </View>
        ))}
        <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: "#334155", paddingTop: 3 }}>
          <Text style={{ color: "#5BC87C", fontSize: 9, fontWeight: "700", flex: 2 }}>Total</Text>
          <Text style={{ color: "#5BC87C", fontSize: 9, fontWeight: "700", flex: 1, textAlign: "center" }}>6</Text>
          <Text style={{ color: "#5BC87C", fontSize: 9, fontWeight: "700", flex: 1, textAlign: "right" }}>500 €</Text>
        </View>
      </>
    ),
  },
  {
    accent: "#5BC87C",
    accentBg: "rgba(91,200,124,0.15)",
    badge: "Nube",
    title: "OneDrive",
    roles: "Admin",
    description: "Sincronización bidireccional automática entre la app y Excel en OneDrive. La app sube cambios al guardar y descarga cambios externos cada 5 minutos. Sincroniza materiales, stock y descuentos. Conexión única vía OAuth por el administrador. Forzar importación/exportación manual.",
    features: [
      "Sincronización automática bidireccional",
      "Conexión única vía OAuth",
      "Actualización cada 5 minutos",
      "Forzar sincronización manual",
    ],
    techData: { endpoint: "GET /api/onedrive/status", sync: "Cada 5 minutos", perm: "Admin con onedrive.manage" },
    renderMockup: () => (
      <>
        <View style={{ alignItems: "center", marginBottom: 6 }}>
          <Ionicons name="cloud-outline" size={28} color="#5BC87C" />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 7 }}>
          <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#5BC87C", marginRight: 4 }} />
          <Text style={{ color: "#5BC87C", fontSize: 10, fontWeight: "600" }}>Conectado</Text>
        </View>
        <View style={{ height: 3.5, backgroundColor: "#1E293B", borderRadius: 1.75, marginBottom: 5 }}>
          <View style={{ width: "62%", height: 3.5, backgroundColor: "#3B82F6", borderRadius: 1.75 }} />
        </View>
        <Text style={{ color: "#64748B", fontSize: 8, textAlign: "center" }}>Última sinc: 12:45</Text>
      </>
    ),
  },
  {
    accent: "#7E51FD",
    accentBg: "rgba(126,81,253,0.15)",
    badge: "Catálogo",
    title: "Preciario",
    roles: "Admin · Comercial · Técnico",
    description: "Catálogo de precios con referencia, descripción, precio unitario, descuento %, precio final y stock. Búsqueda por referencia o descripción con filtro por stock mínimo. Paginación de 50 productos. Descuentos y stock editables inline. Datos desde Excel de OneDrive. El autocompletado de presupuestos consulta este catálogo.",
    features: [
      "Búsqueda con filtro de stock mínimo",
      "Edición inline de descuentos y stock",
      "Sincronizado con OneDrive",
      "Autocompletado en presupuestos",
    ],
    techData: { endpoint: "GET/PUT /api/prices", perm: "preciario.edit y preciario.ver_precios" },
    renderMockup: () => (
      <>
        <View style={{ backgroundColor: "#1E293B", borderRadius: 5, paddingHorizontal: 9, paddingVertical: 5, marginBottom: 7, flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="search-outline" size={11} color="#64748B" style={{ marginRight: 5 }} />
          <Text style={{ color: "#64748B", fontSize: 9 }}>Buscar...</Text>
        </View>
        <View style={{ flexDirection: "row", marginBottom: 3 }}>
          <Text style={{ color: "#64748B", fontSize: 8, fontWeight: "600", width: 48 }}>Ref.</Text>
          <Text style={{ color: "#64748B", fontSize: 8, fontWeight: "600", flex: 1 }}>Descripción</Text>
          <Text style={{ color: "#64748B", fontSize: 8, fontWeight: "600", width: 42, textAlign: "right" }}>Precio</Text>
        </View>
        {[
          { ref: "DET-01", desc: "Detector de humo", precio: "42 €", badge: false },
          { ref: "SIR-02", desc: "Sirena interior", precio: "89 €", badge: false },
          { ref: "BAT-03", desc: "Batería 12V", precio: "15 €", badge: true },
        ].map((row, i) => (
          <View key={i} style={{ flexDirection: "row", marginBottom: 2, alignItems: "center" }}>
            <Text style={{ color: "#E2E8F0", fontSize: 9, width: 48 }}>{row.ref}</Text>
            <Text style={{ color: "#E2E8F0", fontSize: 9, flex: 1 }} numberOfLines={1}>{row.desc}</Text>
            <View style={{ width: 42, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" }}>
              {row.badge && (
                <View style={{ backgroundColor: "#EF4444", borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1, marginRight: 3 }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 6, fontWeight: "600" }}>BAJO</Text>
                </View>
              )}
              <Text style={{ color: "#E2E8F0", fontSize: 9 }}>{row.precio}</Text>
            </View>
          </View>
        ))}
      </>
    ),
  },
  {
    accent: "#94A3B8",
    accentBg: "rgba(148,163,184,0.15)",
    badge: "Acceso rápido",
    title: "Documentos",
    roles: "Todos",
    description: "Pantalla puente que centraliza el acceso a Documentos Internos. Redirige a Preciario y Documentaciones. Entrada unificada para toda la documentación de la empresa.",
    features: [
      "Acceso rápido a Preciario y Documentaciones",
    ],
    techData: null,
    renderMockup: null,
  },
  {
    accent: "#F59E0B",
    accentBg: "rgba(245,158,11,0.15)",
    badge: "Fichas y manuales",
    title: "Documentaciones",
    roles: "Todos",
    description: "Repositorio de fichas técnicas y manuales en PDF. Subida de archivos de hasta 20 MB con visualización en modal y zoom. Dos categorías: fichas técnicas y manuales. Búsqueda por nombre. Permisos diferenciados para subir/borrar versus consultar.",
    features: [
      "Subida de PDFs de hasta 20 MB",
      "Visualización en modal con zoom",
      "Fichas técnicas y manuales",
      "Búsqueda por nombre",
    ],
    techData: { endpoint: "GET/POST/DELETE /api/documentations", maxSize: "20 MB", perm: "documentos.manage para subir/borrar" },
    renderMockup: () => (
      <>
        <View style={{ flexDirection: "row", marginBottom: 7, backgroundColor: "#1E293B", borderRadius: 6, overflow: "hidden" }}>
          <View style={{ flex: 1, paddingVertical: 4, backgroundColor: "#3B82F6", alignItems: "center", borderRadius: 6 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "600" }}>Fichas técnicas</Text>
          </View>
          <View style={{ flex: 1, paddingVertical: 4, alignItems: "center" }}>
            <Text style={{ color: "#94A3B8", fontSize: 9 }}>Manuales</Text>
          </View>
        </View>
        {[
          { name: "Detector-i3-FT.pdf" },
          { name: "Central-incendios-MN.pdf" },
        ].map((doc, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
            <Ionicons name="document-text-outline" size={12} color="#EF4444" style={{ marginRight: 7 }} />
            <Text style={{ color: "#F8FAFC", fontSize: 10, flex: 1 }} numberOfLines={1}>{doc.name}</Text>
            <Ionicons name="download-outline" size={11} color="#3B82F6" style={{ marginLeft: 7 }} />
          </View>
        ))}
      </>
    ),
  },
  {
    accent: "#3B82F6",
    accentBg: "rgba(59,130,246,0.15)",
    badge: "Mensajería",
    title: "Chat",
    roles: "Todos",
    description: "Mensajería interna con pool cada 5 segundos para simular tiempo real. Grupos con múltiples usuarios, adjuntos (imágenes y PDFs), confirmación de lectura por participante (doble check azul) y contador de no leídos. Borrado manual del historial disponible.",
    features: [
      "Tiempo real con pool cada 5 segundos",
      "Grupos y adjuntos",
      "Confirmación de lectura (doble check)",
      "Contador de no leídos",
    ],
    techData: { endpoint: "GET/POST /api/chat/conversations", sync: "Pool cada 5 segundos", perm: "Todos los usuarios" },
    renderMockup: () => (
      <>
        <View style={{ alignItems: "flex-start", marginBottom: 7 }}>
          <View style={{ backgroundColor: "#1E293B", borderRadius: 9, borderTopLeftRadius: 2, paddingHorizontal: 9, paddingVertical: 6, maxWidth: "72%" }}>
            <Text style={{ color: "#E2E8F0", fontSize: 9, lineHeight: 13 }}>¿A qué hora es la visita?</Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end", marginBottom: 9 }}>
          <View style={{ backgroundColor: "#3B82F6", borderRadius: 9, borderTopRightRadius: 2, paddingHorizontal: 9, paddingVertical: 6, maxWidth: "72%" }}>
            <Text style={{ color: "#FFFFFF", fontSize: 9, lineHeight: 13 }}>A las 10:30 en nave B</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#1E293B", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 }}>
          <Text style={{ color: "#64748B", fontSize: 9, flex: 1 }}>Escribir...</Text>
          <Ionicons name="send-outline" size={11} color="#3B82F6" />
        </View>
      </>
    ),
  },
  {
    accent: "#5BC87C",
    accentBg: "rgba(91,200,124,0.15)",
    badge: "Bloc de notas",
    title: "Notas",
    roles: "Todos",
    description: "Bloc de notas con dos modos: libres y ancladas al calendario. Vista de calendario mensual para navegar notas con fecha. Autoguardado. Compartir al chat del equipo. Vinculación opcional a proyectos.",
    features: [
      "Notas libres y ancladas al calendario",
      "Autoguardado",
      "Compartir al chat",
      "Vinculación a proyectos",
    ],
    techData: { endpoint: "GET/POST/PUT/DELETE /api/notes", perm: "Todos los usuarios" },
    renderMockup: () => (
      <>
        <Text style={{ color: "#94A3B8", fontSize: 9, marginBottom: 7 }}>27 de mayo, 2026</Text>
        {[85, 70, 92, 50].map((w, i) => (
          <View key={i} style={{ height: 2, backgroundColor: "#475569", borderRadius: 1, marginBottom: 5, width: `${w}%` as any }} />
        ))}
        <Text style={{ color: "#64748B", fontSize: 9, marginTop: 3 }}>Escribí tu nota...</Text>
      </>
    ),
  },
];

const ph = StyleSheet.create({
  phone: {
    width: 220,
    height: 420,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "rgba(148,163,184,0.25)",
    backgroundColor: "#0F172A",
    overflow: "hidden",
    alignItems: "center",
  },
  notch: {
    width: 70,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#080A13",
    marginTop: 6,
  },
  screen: {
    flex: 1,
    width: "100%",
    padding: 10,
  },
});

const PhoneMockup = ({ children }: { children: React.ReactNode }) => (
  <View style={ph.phone}>
    <View style={ph.notch} />
    <View style={ph.screen}>{children}</View>
  </View>
);

export default function Portfolio() {
  const router = useRouter();
  const [generando, setGenerando] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const exportPdf = async () => {
    try {
      setGenerando(true);

      const c = isDark
        ? {
            bodyBg: "#0F172A",
            bodyColor: "#FFFFFF",
            cardBg: "rgba(255,255,255,0.03)",
            cardBorder: "rgba(148,163,184,0.1)",
            titleColor: "#FFFFFF",
            descColor: "#94A3B8",
            secondaryColor: "#64748B",
            featureColor: "#CBD5E1",
            techBg: "rgba(255,255,255,0.04)",
            techBorder: "rgba(148,163,184,0.1)",
            techLabel: "#94A3B8",
            techValue: "#F8FAFC",
            rolesBg: "rgba(255,255,255,0.05)",
            footerColor: "#64748B",
          }
        : {
            bodyBg: "#F8FAFC",
            bodyColor: "#0F172A",
            cardBg: "#FFFFFF",
            cardBorder: "#E2E8F0",
            titleColor: "#0F172A",
            descColor: "#475569",
            secondaryColor: "#64748B",
            featureColor: "#334155",
            techBg: "#F1F5F9",
            techBorder: "#E2E8F0",
            techLabel: "#334155",
            techValue: "#0F172A",
            rolesBg: "#F1F5F9",
            footerColor: "#94A3B8",
          };

      const GROUPS_OF = 3;
      const buildCard = (m: (typeof MODULOS)[number]) => {
        const featuresHtml = m.features
          .map(
            (f: string) =>
              `<div style="margin-bottom:2px;padding-left:4px;color:${c.featureColor};">&#9679; ${f}</div>`,
          )
          .join("");

        let techHtml = "";
        if (m.techData) {
          const parts = [];
          if (m.techData.endpoint)
            parts.push(
              `<div><span style="color:${c.techLabel};">Endpoint:</span> <span style="color:${c.techValue};">${m.techData.endpoint}</span></div>`,
            );
          if (m.techData.sync)
            parts.push(
              `<div><span style="color:${c.techLabel};">Sync:</span> <span style="color:${c.techValue};">${m.techData.sync}</span></div>`,
            );
          if (m.techData.maxSize)
            parts.push(
              `<div><span style="color:${c.techLabel};">Tamaño máx.:</span> <span style="color:${c.techValue};">${m.techData.maxSize}</span></div>`,
            );
          if (m.techData.perm)
            parts.push(
              `<div><span style="color:${c.techLabel};">Permisos:</span> <span style="color:${c.techValue};">${m.techData.perm}</span></div>`,
            );
          if (m.techData.extra)
            parts.push(
              `<div><span style="color:${c.techLabel};">Extra:</span> <span style="color:${c.techValue};">${m.techData.extra}</span></div>`,
            );
          techHtml = `<div style="background:${c.techBg};border-radius:10px;padding:12px;margin-top:8px;font-size:12px;line-height:1.7;border:1px solid ${c.techBorder};">${parts.join("")}</div>`;
        }

        return `<div style="background:${c.cardBg};border-radius:14px;padding:16px;margin-bottom:12px;border:1px solid ${c.cardBorder};break-inside:avoid-page;">
          <div style="display:inline-block;background:${m.accentBg};border-radius:20px;padding:4px 12px;margin-bottom:8px;">
            <span style="font-size:11px;font-weight:700;color:${m.accent};">${m.badge}</span>
          </div>
          <div style="font-size:18px;font-weight:900;color:${c.titleColor};margin-bottom:4px;">${m.title}</div>
          <div style="font-size:11px;color:${c.secondaryColor};margin-bottom:6px;">👥 ${m.roles}</div>
          <div style="font-size:13px;color:${c.descColor};line-height:1.5;margin-bottom:8px;">${m.description}</div>
          <div style="font-size:12px;line-height:1.7;margin-bottom:4px;">${featuresHtml}</div>
          ${techHtml}
        </div>`;
      };

      const itemsHtml = MODULOS.reduce((acc, m, i) => {
        if (i % GROUPS_OF === 0) {
          const isLastGroup = i + GROUPS_OF >= MODULOS.length;
          acc += `<div class="page-group" style="page-break-after:${isLastGroup ? "auto" : "always"};padding-bottom:12px;">`;
        }
        acc += buildCard(m);
        if (i % GROUPS_OF === GROUPS_OF - 1 || i === MODULOS.length - 1) {
          acc += `</div>`;
        }
        return acc;
      }, "");

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>I-SAI — Gestión inteligente de obras</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page-group { page-break-after: always; }
      .page-group:last-child { page-break-after: auto; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: "Segoe UI", system-ui, -apple-system, sans-serif; background: ${c.bodyBg}; padding: 0; color: ${c.bodyColor}; width: 100%; orphans: 3; widows: 3; }
    h1 { font-size: 26px; font-weight: 900; letter-spacing: -0.5px; }
    .subtitle { font-size: 14px; color: ${c.descColor}; margin-bottom: 24px; }
    .footer { text-align: center; font-size: 11px; color: ${c.footerColor}; margin-top: 24px; }
  </style>
</head>
<body>
  <div style="padding: 16px 12px; max-width: 100%;">
    <h1>I-SAI</h1>
    <div class="subtitle">Gestión inteligente de obras</div>
    ${itemsHtml}
    <div class="footer">Generado desde I-SAI</div>
  </div>
</body>
</html>`;

      if (Platform.OS === "web") {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({
          html,
          base64: false,
          width: 595,
          height: 842,
          margins: { top: 40, bottom: 40, left: 40, right: 40 },
        });

        if (Sharing && typeof Sharing.shareAsync === "function") {
          await Sharing.shareAsync(uri, {
            mimeType: "application/pdf",
            dialogTitle: "Compartir guía visual",
            UTI: "com.adobe.pdf",
          });
        } else {
          await Linking.openURL(uri);
        }
      }
    } catch (e: any) {
      Alert.alert("Error al exportar", e?.message || "No se pudo generar el PDF");
    } finally {
      setGenerando(false);
    }
  };

  return (
    <View style={s.root}>
      <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.heroOuter}>
          <View style={s.heroOverlay1} />
          <View style={s.heroOverlay2} />
          <View style={s.heroOverlay3} />
          <SafeAreaView style={s.heroSafe}>
            <View style={s.heroHeader}>
              <TouchableOpacity
                style={s.heroBackBtn}
                onPress={() => (router.canGoBack() ? router.back() : router.replace("/admin"))}
              >
                <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={s.exportPill} onPress={exportPdf} disabled={generando}>
                {generando ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={s.exportPillText}>Exportar PDF</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            <View style={s.heroContent}>
              <Text style={s.heroTitle}>I-SAI</Text>
              <Text style={s.heroSubtitle}>Gestión inteligente de obras</Text>
            </View>
          </SafeAreaView>
        </View>

        {MODULOS.map((mod, idx) => {
          const isOdd = idx % 2 === 0;
          const hasMockup = mod.renderMockup !== null;

          return (
            <View key={idx}>
              {idx > 0 && <View style={s.separator} />}
              <View style={[s.section, { paddingVertical: isDesktop ? 60 : 32 }]}>
                <View style={[s.sectionContent, isDesktop && s.sectionContentDesktop]}>
                  <View
                    style={[
                      s.sectionRow,
                      isDesktop && hasMockup && { flexDirection: isOdd ? "row" : "row-reverse" },
                    ]}
                  >
                    <View style={[s.textCol, isDesktop && hasMockup ? s.textColHalf : undefined]}>
                      <View style={[s.badge, { backgroundColor: mod.accentBg }]}>
                        <Text style={[s.badgeText, { color: mod.accent }]}>{mod.badge}</Text>
                      </View>
                      <Text style={[s.sectionTitle, { fontSize: isDesktop ? 32 : 26 }]}>{mod.title}</Text>
                      <Text style={s.sectionDesc}>{mod.description}</Text>
                      <View style={s.featuresList}>
                        {mod.features.map((f, i) => (
                          <Text key={i} style={s.feature}>{"•  " + f}</Text>
                        ))}
                      </View>
                      <View style={s.rolesBox}>
                        <Text style={s.rolesText}>👥 {mod.roles}</Text>
                      </View>
                      {mod.techData && (
                        <View style={s.techBox}>
                          {mod.techData.endpoint && (
                            <Text style={s.techLine}><Text style={s.techLabel}>Endpoint: </Text>{mod.techData.endpoint}</Text>
                          )}
                          {mod.techData.sync && (
                            <Text style={s.techLine}><Text style={s.techLabel}>Sync: </Text>{mod.techData.sync}</Text>
                          )}
                          {mod.techData.maxSize && (
                            <Text style={s.techLine}><Text style={s.techLabel}>Tamaño máx.: </Text>{mod.techData.maxSize}</Text>
                          )}
                          {mod.techData.perm && (
                            <Text style={s.techLine}><Text style={s.techLabel}>Permisos: </Text>{mod.techData.perm}</Text>
                          )}
                          {mod.techData.extra && (
                            <Text style={s.techLine}><Text style={s.techLabel}>Extra: </Text>{mod.techData.extra}</Text>
                          )}
                        </View>
                      )}
                    </View>

                    {hasMockup && (
                      <View style={s.mockupCol}>
                        {isDesktop ? (
                          <PhoneMockup>{mod.renderMockup()}</PhoneMockup>
                        ) : (
                          <View style={s.mockupInline}>
                            {mod.renderMockup()}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </View>
          );
        })}

        <View style={s.footerSpacer} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#080A13",
  },
  heroOuter: {
    backgroundColor: "#0F1B3D",
    position: "relative",
    overflow: "hidden",
  },
  heroOverlay1: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: "#3A2CAF",
    opacity: 0.15,
  },
  heroOverlay2: {
    position: "absolute",
    bottom: -120,
    left: -80,
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: "#1E88E5",
    opacity: 0.08,
  },
  heroOverlay3: {
    position: "absolute",
    top: "30%",
    left: "50%",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#0EA5E9",
    opacity: 0.06,
    transform: [{ translateX: -100 }],
  },
  heroSafe: {
    paddingTop: 50,
    paddingBottom: 50,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  heroBackBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  exportPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  exportPillText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  heroContent: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  heroTitle: {
    fontSize: 48,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -1,
    ...fontStyle("display"),
  },
  heroSubtitle: {
    ...fontStyle("title3"),
    color: "#94A3B8",
    marginTop: 8,
  },
  separator: {
    height: 1,
    backgroundColor: "rgba(148,163,184,0.08)",
    marginHorizontal: 20,
  },
  section: {
    paddingHorizontal: 20,
  },
  sectionContent: {
    width: "100%",
  },
  sectionContentDesktop: {
    maxWidth: 1100,
    alignSelf: "center",
  },
  sectionRow: {
    flexDirection: "column",
    alignItems: "center",
  },
  textCol: {
    flex: 1,
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: ios.radius.lg,
    padding: ios.spacing.xxl,
    ...ios.shadow.card,
  },
  textColHalf: {
    maxWidth: "55%",
  },
  badge: {
    borderRadius: ios.radius.pill,
    paddingHorizontal: ios.spacing.md,
    paddingVertical: ios.spacing.xs,
    alignSelf: "flex-start",
    marginBottom: ios.spacing.md,
  },
  badgeText: {
    ...fontStyle("subhead"),
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: ios.spacing.md,
    ...fontStyle("largeTitle"),
  },
  sectionDesc: {
    ...fontStyle("body"),
    color: "#94A3B8",
    marginBottom: ios.spacing.lg,
  },
  featuresList: {
    marginBottom: ios.spacing.lg,
  },
  feature: {
    ...fontStyle("subhead"),
    color: "#CBD5E1",
    marginBottom: 4,
  },
  rolesBox: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: ios.radius.sm,
    padding: ios.spacing.sm,
    marginBottom: ios.spacing.md,
  },
  rolesText: {
    ...fontStyle("subhead"),
    color: "#94A3B8",
  },
  techBox: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: ios.radius.sm,
    padding: ios.spacing.md,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.1)",
  },
  techLine: {
    ...fontStyle("footnote"),
    color: "#94A3B8",
  },
  techLabel: {
    fontWeight: "600",
    color: "#CBD5E1",
  },
  mockupCol: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: ios.spacing.xxl,
  },
  mockupInline: {
    backgroundColor: "#1E293B",
    borderRadius: ios.radius.lg,
    padding: ios.spacing.lg,
    width: 260,
    minHeight: 150,
    overflow: "hidden",
    ...ios.shadow.card,
  },
  footerSpacer: {
    height: 60,
  },
});
