import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, TextInput, Platform, FlatList, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, clearToken, COLORS } from "../../src/api";
import ResponsiveLayout from "../../src/ResponsiveLayout";
import { useBreakpoint } from "../../src/useBreakpoint";
import IOSHeader from "../../src/ui/IOSHeader";
import { useThemedStyles } from "../../src/theme";
import { ios } from "../../src/ui/iosTheme";


function pad(n: number): string { return String(n).padStart(2, "0"); }

function hoyStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function haceUnAno(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function mesesDropdown(): { label: string; desde: string; hasta: string }[] {
  const items: { label: string; desde: string; hasta: string }[] = [];
  const hoy = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const desde = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
    const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const hasta = `${ultimo.getFullYear()}-${pad(ultimo.getMonth() + 1)}-${pad(ultimo.getDate())}`;
    items.push({ label: `${MESES[d.getMonth()]} ${d.getFullYear()}`, desde, hasta });
  }
  return items;
}

export default function FichajesAdminScreen() {
  const t = { fichajes: { admin: "Admin", gestionar: "Gestionar", exportar: "Exportar", crear: "Crear", eliminar: "Eliminar", editar: "Editar", usuario: "Usuario", fecha: "Fecha", entrada: "Entrada", salida: "Salida", horas: "Horas", estado: "Estado", vacaciones: "Vacaciones", solicitudes: "Solicitudes" } };
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const s = useThemedStyles(useS);
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<"resumen" | "detalle" | "vacaciones" | "exportar">("resumen");

  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");

  const [selectedUserId, setSelectedUserId] = useState("");
  const [detalle, setDetalle] = useState<any>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEntrada, setEditEntrada] = useState("");
  const [editSalida, setEditSalida] = useState("");

  const [modalVisible, setModalVisible] = useState(false);
  const [nuevoFecha, setNuevoFecha] = useState(() => hoyStr());
  const [nuevoEntrada, setNuevoEntrada] = useState("09:00");
  const [nuevoSalida, setNuevoSalida] = useState("18:00");

  const [vacaciones, setVacaciones] = useState<any[]>([]);
  const [vacLoading, setVacLoading] = useState(false);

  const [exportUsuario, setExportUsuario] = useState("");
  const [exportDesde, setExportDesde] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
  });
  const [exportHasta, setExportHasta] = useState(() => hoyStr());
  const [exportPreview, setExportPreview] = useState<any[]>([]);
  const [exportMesSel, setExportMesSel] = useState(-1);

  const [kpiUsuarios, setKpiUsuarios] = useState({ total: 0, fichadosHoy: 0, horasMes: "0h" });

  // Calendario para el detalle
  const [anchorMonth, setAnchorMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [fichajesMes, setFichajesMes] = useState<any[]>([]);
  const [mesLoading, setMesLoading] = useState(false);
  const MESES_CAL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

  const hoyDia = new Date();
  const limiteAno = new Date(hoyDia.getFullYear() - 1, hoyDia.getMonth(), 1);
  const today = useMemo(() => `${hoyDia.getFullYear()}-${pad(hoyDia.getMonth() + 1)}-${pad(hoyDia.getDate())}`, []);

  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return usuarios;
    return usuarios.filter(
      (u) => (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q)
    );
  }, [usuarios, busqueda]);

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      try {
        const u = await api.me();
        if (!alive) return;
        setMe(u);
        if (u?.role !== "admin" && !(u?.permissions || []).includes("fichajes.manage")) {
          router.replace("/fichajes");
          return;
        }
        await cargarUsuarios();
      } catch (e: any) {
        if (/401|Invalid|expired/i.test(e?.message || "")) {
          await clearToken();
          router.replace("/login");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []));

  async function cargarUsuarios() {
    try {
      const data = await api.fichajesAdminUsuarios();
      setUsuarios(data || []);
      const fichadosHoy = (data || []).filter((u: any) => u.hoy?.entrada).length;
      let totalMinMes = 0;
      for (const u of data || []) {
        const m = u.mes?.match(/(\d+)h\s*(\d+)m/);
        if (m) totalMinMes += parseInt(m[1]) * 60 + parseInt(m[2]);
      }
      setKpiUsuarios({
        total: (data || []).length,
        fichadosHoy,
        horasMes: `${Math.floor(totalMinMes / 60)}h ${Math.round(totalMinMes % 60)}m`,
      });
    } catch {}
  }

  // Cargar todos los fichajes del mes para el usuario seleccionado
  async function cargarFichajesMes(userId: string, mes: Date) {
    if (!userId) return;
    setMesLoading(true);
    const a = mes.getFullYear();
    const m = mes.getMonth();
    const desde = `${a}-${pad(m + 1)}-01`;
    const hasta = `${a}-${pad(m + 1)}-${pad(new Date(a, m + 1, 0).getDate())}`;
    try {
      const d = await api.fichajesAdminDetalle(userId, desde, hasta);
      setFichajesMes((d as any)?.fichajes || []);
      setDetalle(d);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Error al cargar el mes");
    } finally {
      setMesLoading(false);
    }
  }

  useEffect(() => {
    if (selectedUserId && tab === "detalle") {
      cargarFichajesMes(selectedUserId, anchorMonth);
    }
  }, [selectedUserId, anchorMonth, tab]);

  // Agrupar fichajes por dia para el calendario
  const fichajesPorDia = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const f of fichajesMes) {
      const dia = f.fecha || "";
      if (dia) {
        if (!map[dia]) map[dia] = [];
        map[dia].push(f);
      }
    }
    return map;
  }, [fichajesMes]);

  // Construir la cuadrícula del calendario
  const calendarioDias = useMemo(() => {
    const a = anchorMonth.getFullYear();
    const m = anchorMonth.getMonth();
    const primerDia = new Date(a, m, 1);
    const ultimoDia = new Date(a, m + 1, 0);
    const inicio = new Date(primerDia);
    inicio.setDate(inicio.getDate() - (primerDia.getDay() === 0 ? 6 : primerDia.getDay() - 1));

    const dias = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio);
      d.setDate(d.getDate() + i);
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const enMes = d.getMonth() === m;
      const fichajesDia = fichajesPorDia[key] || [];
      const horas = fichajesDia.reduce((sum, f) => {
        if (!f.entrada || !f.salida) return sum;
        const [h, m2] = (f.total || "0h 0m").replace("h ", ":").split(":");
        return sum + (parseInt(h) || 0) * 60 + (parseInt(m2) || 0);
      }, 0);
      dias.push({
        key,
        dia: d.getDate(),
        enMes,
        fichajes: fichajesDia,
        horas: horas > 0 ? `${Math.floor(horas / 60)}h ${horas % 60}m` : null,
        tieneEntrada: fichajesDia.some((f) => f.entrada),
        tieneSalida: fichajesDia.some((f) => f.salida),
      });
    }
    return dias;
  }, [anchorMonth, fichajesPorDia]);

  function mesAnterior() {
    const target = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() - 1, 1);
    if (target >= limiteAno) setAnchorMonth(target);
  }
  function mesSiguiente() {
    const target = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() + 1, 1);
    if (target <= new Date(hoyDia.getFullYear(), hoyDia.getMonth(), 1)) setAnchorMonth(target);
  }

  async function guardarEdicion(fichajeId: string) {
    try {
      await api.fichajesAdminEditar(fichajeId, editEntrada || null, editSalida || null);
      setEditingId(null);
      if (selectedUserId) cargarFichajesMes(selectedUserId, anchorMonth);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Error al realizar la operación");
    }
  }

  async function eliminarFichaje(fichajeId: string) {
    Alert.alert("Eliminar fichaje", "¿Seguro que quieres eliminar este fichaje?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar", style: "destructive",
        onPress: async () => {
          try {
            await api.fichajesAdminEliminar(fichajeId);
            cargarFichajesMes(selectedUserId, anchorMonth);
          } catch (e: any) {
            Alert.alert("Error", e.message || "Error al realizar la operación");
          }
        },
      },
    ]);
  }

  async function crearFichaje() {
    try {
      await api.fichajesAdminCrear(selectedUserId, nuevoFecha, nuevoEntrada, nuevoSalida);
      setModalVisible(false);
      cargarFichajesMes(selectedUserId, anchorMonth);
      cargarUsuarios();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Error al realizar la operación");
    }
  }

  async function cargarVacaciones() {
    setVacLoading(true);
    try {
      const data = await api.fichajesAdminVacaciones();
      setVacaciones(data || []);
    } catch {}
    finally {
      setVacLoading(false);
    }
  }

  async function gestionarVacacion(vacId: string, estado: "aprobada" | "rechazada") {
    try {
      await api.fichajesAdminVacacionesGestionar(vacId, estado);
      cargarVacaciones();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Error al realizar la operación");
    }
  }

  async function previewExportar() {
    try {
      const csv = await api.fichajesAdminExportar(exportDesde, exportHasta, exportUsuario || undefined);
      const lines = csv.split("\n").filter(Boolean);
      const headers = lines[0].split(",");
      const rows = lines.slice(1).map((l) => {
        const vals = l.split(",");
        const obj: any = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
        return obj;
      });
      setExportPreview(rows);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Error al realizar la operación");
    }
  }

  async function descargarCSV() {
    try {
      const csv = await api.fichajesAdminExportar(exportDesde, exportHasta, exportUsuario || undefined);
      if (typeof document !== "undefined") {
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `fichajes_${exportDesde}_${exportHasta}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 15000);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Error al realizar la operación");
    }
  }

  useEffect(() => {
    if (tab === "vacaciones") cargarVacaciones();
  }, [tab]);

  useEffect(() => {
    if (tab === "exportar" && exportMesSel >= 0) {
      const m = mesesDropdown()[exportMesSel];
      if (m) {
        setExportDesde(m.desde);
        setExportHasta(m.hasta);
      }
    }
  }, [exportMesSel, tab]);

  if (loading) {
    return (
    <ResponsiveLayout active="fichajes-admin">
        <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
          <ActivityIndicator style={{ marginTop: 60 }} color={COLORS.primary} />
        </SafeAreaView>
      </ResponsiveLayout>
    );
  }

  const selectedUser = usuarios.find((u) => u.id === selectedUserId);

  const calDayH = isWide ? 42 : 36;
  const calDayNumS = isWide ? 12 : 11;
  const calHourS = isWide ? 8 : 7;

  const content = (
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      {!isWide && <IOSHeader title={"Admin Fichajes"} showBack backLabel={"Fichajes"} />}

      <View style={s.headerBar}>
        {isWide && (
          <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/fichajes"); }} style={s.headerBack} activeOpacity={0.6}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textSecondary} />
            <Text style={s.headerBackLabel}>{"Fichajes"}</Text>
          </TouchableOpacity>
        )}
        <Text style={s.headerTitle}>{"Gestión de fichajes"}</Text>
      </View>

      <View style={s.kpiRow}>
        <View style={s.kpiCard}>
          <Ionicons name="people" size={18} color={ios.colors.indigo} />
          <Text style={s.kpiVal}>{kpiUsuarios.total}</Text>
          <Text style={s.kpiLabel}>{"Usuarios"}</Text>
        </View>
        <View style={s.kpiCard}>
          <Ionicons name="time" size={18} color={ios.colors.green} />
          <Text style={s.kpiVal}>{kpiUsuarios.fichadosHoy}</Text>
          <Text style={s.kpiLabel}>{"Fichados hoy"}</Text>
        </View>
        <View style={s.kpiCard}>
          <Ionicons name="hourglass" size={18} color={ios.colors.orange} />
          <Text style={s.kpiVal}>{kpiUsuarios.horasMes}</Text>
          <Text style={s.kpiLabel}>{"Horas mes"}</Text>
        </View>
      </View>

      <View style={s.tabs}>
        {(["resumen", "detalle", "vacaciones", "exportar"] as const).map((tabKey) => (
          <TouchableOpacity
            key={tabKey}
            style={[s.tabBtn, tab === tabKey && s.tabBtnActive]}
            onPress={() => setTab(tabKey)}
          >
            <Text style={[s.tabBtnTxt, tab === tabKey && s.tabBtnTxtActive]}>
              {tabKey === "resumen" ? "Resumen" : tabKey === "detalle" ? "Detalle" : tabKey === "vacaciones" ? "Vacaciones" : "Exportar"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">

        {/* TAB 1: Resumen */}
        {tab === "resumen" && (
          <View style={{ gap: 12 }}>
            <TextInput
              style={s.searchInput}
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder={"Buscar usuario..."}
              placeholderTextColor={COLORS.textDisabled}
            />
            {usuariosFiltrados.map((u) => (
              <TouchableOpacity
                key={u.id}
                style={s.userRow}
                onPress={() => { setSelectedUserId(u.id); setTab("detalle"); }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.userName}>{u.name}</Text>
                  <Text style={s.userEmail}>{u.email}</Text>
                </View>
                <View style={s.userStats}>
                  <View style={s.statItem}>
                    <Text style={s.statLabel}>{"Hoy"}</Text>
                    <Text style={[s.statVal, u.hoy?.entrada ? { color: ios.colors.green } : { color: COLORS.textDisabled }]}>
                      {u.hoy?.entrada || "-"} / {u.hoy?.salida || "-"}
                    </Text>
                  </View>
                  <View style={s.statItem}>
                    <Text style={s.statLabel}>{"Semana"}</Text>
                    <Text style={s.statVal}>{u.semana}</Text>
                  </View>
                  <View style={s.statItem}>
                    <Text style={s.statLabel}>{"Mes"}</Text>
                    <Text style={s.statVal}>{u.mes}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textDisabled} />
              </TouchableOpacity>
            ))}
            {usuariosFiltrados.length === 0 && (
              <Text style={s.emptyText}>{"Sin datos"}</Text>
            )}
          </View>
        )}

        {/* TAB 2: Detalle — Calendario */}
        {tab === "detalle" && (
          <View style={{ gap: 8 }}>
            {/* Selector usuario */}
            <View style={s.formRow}>
              <Text style={s.formLabel}>{"Usuario"}</Text>
              <View style={s.pickerWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {usuarios.map((u) => (
                    <TouchableOpacity
                      key={u.id}
                      style={[s.chip, selectedUserId === u.id && s.chipActive]}
                      onPress={() => { setSelectedUserId(u.id); setSelectedDay(null); }}
                    >
                      <Text style={[s.chipText, selectedUserId === u.id && { color: "#fff" }]}>{u.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {!selectedUserId ? (
              <Text style={s.emptyText}>{"Selecciona un usuario para ver su calendario"}</Text>
            ) : (
              <>
                {/* Navegación mes */}
                <View style={[s.calNav, !isWide && { paddingHorizontal: 8, paddingVertical: 4 }]}>
                  <TouchableOpacity onPress={mesAnterior} disabled={anchorMonth <= limiteAno} style={anchorMonth <= limiteAno && { opacity: 0.3 }}>
                    <Ionicons name="chevron-back" size={isWide ? 20 : 16} color={COLORS.text} />
                  </TouchableOpacity>
                  <Text style={[s.calNavTitulo, !isWide && { fontSize: 13 }]}>
                    {MESES_CAL[anchorMonth.getMonth()]} {anchorMonth.getFullYear()}
                  </Text>
                  <TouchableOpacity onPress={mesSiguiente} disabled={anchorMonth >= new Date(hoyDia.getFullYear(), hoyDia.getMonth(), 1)} style={anchorMonth >= new Date(hoyDia.getFullYear(), hoyDia.getMonth(), 1) && { opacity: 0.3 }}>
                    <Ionicons name="chevron-forward" size={isWide ? 20 : 16} color={COLORS.text} />
                  </TouchableOpacity>
                </View>

                {mesLoading ? (
                  <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
                ) : (
                  <>
                    {/* Totales del mes */}
                    <View style={[s.totalesRow, { gap: isWide ? 4 : 2 }]}>
                      <View style={[s.totalCard, { padding: isWide ? 8 : 5, borderRadius: 8 }]}>
                        <Text style={[s.totalVal, { fontSize: isWide ? 16 : 13 }]}>{detalle?.totales?.horas_trabajadas || "0h"}</Text>
                        <Text style={[s.totalLbl, { fontSize: isWide ? 9 : 8 }]}>{"Horas mes"}</Text>
                      </View>
                      <View style={[s.totalCard, { padding: isWide ? 8 : 5, borderRadius: 8 }]}>
                        <Text style={[s.totalVal, { fontSize: isWide ? 16 : 13 }]}>{detalle?.totales?.dias_trabajados || 0}</Text>
                        <Text style={[s.totalLbl, { fontSize: isWide ? 9 : 8 }]}>{"Días"}</Text>
                      </View>
                      <View style={[s.totalCard, { padding: isWide ? 8 : 5, borderRadius: 8 }]}>
                        <Text style={[s.totalVal, { fontSize: isWide ? 16 : 13 }]}>{detalle?.totales?.vacaciones || 0}</Text>
                        <Text style={[s.totalLbl, { fontSize: isWide ? 9 : 8 }]}>{"Vacaciones"}</Text>
                      </View>
                    </View>

                    {/* Calendario */}
                    <View style={[s.calGridWrap, !isWide && { padding: 3, borderRadius: 8 }]}>
                      <View style={[s.calSemanaRow, !isWide && { marginBottom: 0 }]}>
                        {DIAS_SEMANA.map((dd) => (
                          <View key={dd} style={[s.calSemanaCell, !isWide && { paddingVertical: 1 }]}>
                            <Text style={[s.calSemanaTxt, !isWide && { fontSize: 8 }]}>{dd}</Text>
                          </View>
                        ))}
                      </View>
                      <View style={s.calGrid}>
                        {calendarioDias.map((d) => {
                          const isToday = d.key === today.current;
                          const isSelected = d.key === selectedDay;
                          const tieneDatos = d.tieneEntrada && d.tieneSalida;
                          const incompleto = d.tieneEntrada && !d.tieneSalida;
                          let bg = "transparent";
                          if (isSelected) bg = COLORS.primary + "18";
                          else if (incompleto) bg = ios.colors.yellow + "18";
                          else if (tieneDatos) bg = ios.colors.green + "12";

                          return (
                            <TouchableOpacity
                              key={d.key}
                              style={[
                                s.calDay,
                                { height: calDayH },
                                isToday && { borderColor: COLORS.primary, borderWidth: 1.5 },
                                !d.enMes && { opacity: 0.25 },
                                { backgroundColor: bg },
                              ]}
                              onPress={() => {
                                if (d.enMes) setSelectedDay(d.key);
                              }}
                              activeOpacity={0.6}
                            >
                              <Text style={[
                                s.calDayNum,
                                { fontSize: calDayNumS },
                                isToday && { color: COLORS.primary, fontWeight: "800" },
                                !d.enMes && { color: COLORS.textDisabled },
                              ]}>{d.dia}</Text>
                              <View style={{ flexDirection: "row", gap: 1, flexWrap: "wrap", justifyContent: "center" }}>
                                {d.fichajes.filter((f: any) => f.entrada && f.salida).map((f: any, fi: number) => (
                                  <View key={fi} style={[s.calDayDot, { backgroundColor: f.tipo === "entrada" || f.tipo === "fin_pausa" ? ios.colors.green : ios.colors.orange }]} />
                                ))}
                              </View>
                              {d.horas && (
                                <Text style={[s.calDayHoras, { fontSize: calHourS }]}>{d.horas}</Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* Detalle del día seleccionado */}
                    {selectedDay && (
                      <View style={[s.dayDetailWrap, !isWide && { maxHeight: 220 }]}>
                        <View style={s.dayDetailHeader}>
                          <Text style={s.dayDetailTitulo}>{selectedDay}</Text>
                          <TouchableOpacity onPress={() => { setSelectedDay(null); }}>
                            <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                          </TouchableOpacity>
                        </View>
                        <View style={s.detalleHeader}>
                          <TouchableOpacity style={s.addBtn} onPress={() => { setNuevoFecha(selectedDay); setModalVisible(true); }} activeOpacity={0.7}>
                            <Ionicons name="add" size={16} color="#fff" />
                            <Text style={s.addBtnText}>{"Añadir"}</Text>
                          </TouchableOpacity>
                        </View>
                        {(fichajesPorDia[selectedDay] || []).length === 0 ? (
                          <Text style={s.emptyText}>{"Sin fichajes este día"}</Text>
                        ) : (
                          <View style={s.tablaWrap}>
                            <View style={s.tablaHRow}>
                              <Text style={[s.tablaH, { flex: 1 }]}>{"Entrada"}</Text>
                              <Text style={[s.tablaH, { flex: 1 }]}>{"Salida"}</Text>
                              <Text style={[s.tablaH, { width: 60 }]}>{"Total"}</Text>
                              <Text style={[s.tablaH, { width: 70 }]}>{""}</Text>
                            </View>
                            {(fichajesPorDia[selectedDay] || []).map((f: any, idx: number) => (
                              <View key={f.id || idx} style={[s.tablaRow, idx % 2 === 0 && { backgroundColor: COLORS.readonly }]}>
                                {editingId === f.id ? (
                                  <>
                                    <TextInput style={[s.tablaTd, s.inputInline, { flex: 1 }]} value={editEntrada} onChangeText={setEditEntrada} placeholder="--:--" placeholderTextColor={COLORS.textDisabled} />
                                    <TextInput style={[s.tablaTd, s.inputInline, { flex: 1 }]} value={editSalida} onChangeText={setEditSalida} placeholder="--:--" placeholderTextColor={COLORS.textDisabled} />
                                    <Text style={[s.tablaTd, { width: 60 }]}>{f.total}</Text>
                                    <View style={[{ width: 70, flexDirection: "row", gap: 8 }]}>
                                      <TouchableOpacity onPress={() => guardarEdicion(f.id)}><Ionicons name="checkmark" size={18} color={ios.colors.green} /></TouchableOpacity>
                                      <TouchableOpacity onPress={() => setEditingId(null)}><Ionicons name="close" size={18} color={ios.colors.red} /></TouchableOpacity>
                                    </View>
                                  </>
                                ) : (
                                  <>
                                    <Text style={[s.tablaTd, { flex: 1 }]}>{f.entrada || "-"}</Text>
                                    <Text style={[s.tablaTd, { flex: 1 }]}>{f.salida || "-"}</Text>
                                    <Text style={[s.tablaTd, { width: 60 }]}>{f.total}</Text>
                                    <View style={[{ width: 70, flexDirection: "row", gap: 8 }]}>
                                      <TouchableOpacity onPress={() => { setEditingId(f.id); setEditEntrada(f.entrada || ""); setEditSalida(f.salida || ""); }}>
                                        <Ionicons name="create-outline" size={16} color={COLORS.primary} />
                                      </TouchableOpacity>
                                      <TouchableOpacity onPress={() => eliminarFichaje(f.id)}>
                                        <Ionicons name="trash-outline" size={16} color={ios.colors.red} />
                                      </TouchableOpacity>
                                    </View>
                                  </>
                                )}
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    )}
                  </>
                )}
              </>
            )}
          </View>
        )}

        {/* TAB 3: Vacaciones */}
        {tab === "vacaciones" && (
          <View style={{ gap: 12 }}>
            {vacLoading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
            ) : (
              <>
                <Text style={s.seccionTit}>{"Pendientes de aprobar"}</Text>
                {vacaciones.filter((v) => v.estado === "pendiente").length === 0 ? (
                  <Text style={s.emptyText}>{"Sin datos"}</Text>
                ) : (
                  vacaciones.filter((v) => v.estado === "pendiente").map((v) => (
                    <View key={v.id} style={s.vacCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.vacUser}>{v.user_name || v.user_id}</Text>
                        <Text style={s.vacFechas}>
                          {v.tipo === "vacaciones" ? "Vacaciones" : "Ausencia"}: {v.fecha_inicio} → {v.fecha_fin} ({v.dias || "?"}{" días"})
                        </Text>
                        {v.motivo ? <Text style={s.vacMotivo}>{v.motivo}</Text> : null}
                      </View>
                      <View style={s.vacBtns}>
                        <TouchableOpacity style={[s.vacBtn, { backgroundColor: ios.colors.green }]} onPress={() => gestionarVacacion(v.id, "aprobada")}>
                          <Ionicons name="checkmark" size={18} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.vacBtn, { backgroundColor: ios.colors.red }]} onPress={() => gestionarVacacion(v.id, "rechazada")}>
                          <Ionicons name="close" size={18} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}

                <Text style={[s.seccionTit, { marginTop: 8 }]}>{"Historial de solicitudes"}</Text>
                {vacaciones.filter((v) => v.estado !== "pendiente").length === 0 ? (
                  <Text style={s.emptyText}>{"Sin datos"}</Text>
                ) : (
                  vacaciones.filter((v) => v.estado !== "pendiente").map((v) => (
                    <View key={v.id} style={[s.vacCard, v.estado === "aprobada" ? s.vacAprobada : s.vacRechazada]}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.vacUser}>{v.user_name || v.user_id}</Text>
                        <Text style={s.vacFechas}>
                          {v.tipo === "vacaciones" ? "Vacaciones" : "Ausencia"}: {v.fecha_inicio} → {v.fecha_fin}
                        </Text>
                      </View>
                      <View style={[s.estadoChip, v.estado === "aprobada" ? s.estadoAprob : s.estadoRech]}>
                        <Text style={s.estadoChipText}>{v.estado}</Text>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}
          </View>
        )}

        {/* TAB 4: Exportar */}
        {tab === "exportar" && (
          <View style={{ gap: 14 }}>
            <Text style={s.seccionTit}>{"Exportar fichajes"}</Text>

            <View style={s.formCard}>
              <Text style={s.formLabel}>{"Mes"}:</Text>
              <View style={s.pickerWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {mesesDropdown().map((m, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[s.chip, exportMesSel === i && s.chipActive]}
                      onPress={() => setExportMesSel(i)}
                    >
                      <Text style={[s.chipText, exportMesSel === i && { color: "#fff" }]}>{m.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <Text style={s.formLabel}>{"Período"}:</Text>
              <View style={s.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.formLabelSm}>{"Desde"}</Text>
                  <TextInput
                    style={s.input}
                    value={exportDesde}
                    onChangeText={setExportDesde}
                    placeholder={"YYYY-MM-DD"}
                    placeholderTextColor={COLORS.textDisabled}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.formLabelSm}>{"Hasta"}</Text>
                  <TextInput
                    style={s.input}
                    value={exportHasta}
                    onChangeText={setExportHasta}
                    placeholder={"YYYY-MM-DD"}
                    placeholderTextColor={COLORS.textDisabled}
                  />
                </View>
              </View>

              <Text style={s.formLabel}>{"Usuario"}:</Text>              <View style={s.pickerWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  <TouchableOpacity
                    style={[s.chip, !exportUsuario && s.chipActive]}
                    onPress={() => setExportUsuario("")}
                  >
                    <Text style={[s.chipText, !exportUsuario && { color: "#fff" }]}>{"Todos"}</Text>
                  </TouchableOpacity>
                  {usuarios.map((u) => (
                    <TouchableOpacity
                      key={u.id}
                      style={[s.chip, exportUsuario === u.id && s.chipActive]}
                      onPress={() => setExportUsuario(u.id)}
                    >
                      <Text style={[s.chipText, exportUsuario === u.id && { color: "#fff" }]}>{u.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity style={s.btnOutline} onPress={previewExportar} activeOpacity={0.7}>
                  <Ionicons name="eye" size={16} color={COLORS.primary} />
                  <Text style={s.btnOutlineText}>{"Previsualizar"}</Text>
                </TouchableOpacity>
                {typeof document !== "undefined" && (
                  <TouchableOpacity style={s.btnPrimary} onPress={descargarCSV} activeOpacity={0.7}>
                    <Ionicons name="download" size={16} color="#fff" />
                    <Text style={s.btnPrimaryText}>{"Descargar CSV"}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {exportPreview.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={s.seccionTit}>{"Vista previa"} ({exportPreview.length} {"Vista previa"})</Text>
                <ScrollView horizontal>
                  <View>
                    <View style={s.tablaHRow}>
                      {Object.keys(exportPreview[0] || {}).map((k) => (
                        <Text key={k} style={[s.tablaH, { width: 110 }]}>{k}</Text>
                      ))}
                    </View>
                    {exportPreview.slice(0, 20).map((row, i) => (
                      <View key={i} style={[s.tablaRow, i % 2 === 0 && { backgroundColor: COLORS.readonly }]}>
                        {Object.values(row).map((v: any, j) => (
                          <Text key={j} style={[s.tablaTd, { width: 110 }]}>{String(v)}</Text>
                        ))}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        )}

      </ScrollView>

      {/* Modal crear fichaje */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{"Nuevo fichaje"}</Text>
            <Text style={s.modalSub}>
              {"Crear fichaje para"} {selectedUser?.name || selectedUserId}
            </Text>

            <Text style={s.formLabel}>{"Fecha"}</Text>
            <TextInput
              style={s.input}
              value={nuevoFecha}
              onChangeText={setNuevoFecha}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textDisabled}
            />

            <Text style={s.formLabel}>{"Hora entrada"}</Text>
            <TextInput
              style={s.input}
              value={nuevoEntrada}
              onChangeText={setNuevoEntrada}
              placeholder="HH:MM"
              placeholderTextColor={COLORS.textDisabled}
            />

            <Text style={s.formLabel}>{"Hora salida"}</Text>
            <TextInput
              style={s.input}
              value={nuevoSalida}
              onChangeText={setNuevoSalida}
              placeholder="HH:MM"
              placeholderTextColor={COLORS.textDisabled}
            />

            <View style={s.modalBtns}>
              <TouchableOpacity
                style={s.btnOutline}
                onPress={() => setModalVisible(false)}
              >
                <Text style={s.btnOutlineText}>{"Cancelar"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnPrimary} onPress={crearFichaje}>
                <Text style={s.btnPrimaryText}>{"Crear"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );

  return (
    <ResponsiveLayout active="fichajes">
      {content}
    </ResponsiveLayout>
  );
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  headerBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  headerBack: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingRight: 8,
  },
  headerBackLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },

  kpiRow: {
    flexDirection: "row",
    padding: 10,
    gap: 8,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  kpiCard: {
    flex: 1,
    alignItems: "center",
    padding: 10,
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    gap: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  kpiVal: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  kpiLabel: { fontSize: 10, color: COLORS.textDisabled, fontWeight: "500" },

  tabs: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: COLORS.bg,
  },
  tabBtnActive: { backgroundColor: COLORS.primary },
  tabBtnTxt: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary },
  tabBtnTxtActive: { color: "#fff" },

  body: { padding: 14, paddingBottom: 60 },

  searchInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  userRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  userName: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  userEmail: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  userStats: {
    flexDirection: "row",
    gap: 10,
    paddingRight: 4,
  },
  statItem: { alignItems: "center", gap: 2 },
  statLabel: { fontSize: 9, color: COLORS.textDisabled, fontWeight: "500", textTransform: "uppercase" },
  statVal: { fontSize: 12, fontWeight: "700", color: COLORS.text },

  formRow: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  formLabel: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 4 },
  formLabelSm: { fontSize: 11, fontWeight: "600", color: COLORS.textDisabled, marginBottom: 4 },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  pickerWrap: { flex: 1, maxHeight: 40 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: "500", color: COLORS.textSecondary },

  input: {
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  totalesRow: { flexDirection: "row", gap: 8 },
  totalCard: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    gap: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  totalVal: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  totalLbl: { fontSize: 10, color: COLORS.textDisabled, fontWeight: "500" },

  detalleHeader: { flexDirection: "row", justifyContent: "flex-end" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: { fontSize: 13, fontWeight: "600", color: "#fff" },

  tablaWrap: { gap: 2 },
  tablaHRow: {
    flexDirection: "row",
    backgroundColor: COLORS.primarySoft,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  tablaH: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tablaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tablaTd: { fontSize: 12, color: COLORS.text },
  inputInline: {
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    padding: 4,
    fontSize: 12,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },

  accionesCol: { flexDirection: "row", gap: 8, justifyContent: "center" },

  seccionTit: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  emptyText: { fontSize: 13, color: COLORS.textDisabled, fontStyle: "italic", padding: 12, textAlign: "center" },

  vacCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  vacAprobada: { borderLeftWidth: 3, borderLeftColor: ios.colors.green },
  vacRechazada: { borderLeftWidth: 3, borderLeftColor: ios.colors.red },
  vacUser: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  vacFechas: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  vacMotivo: { fontSize: 11, color: COLORS.textDisabled, marginTop: 2, fontStyle: "italic" },
  vacBtns: { flexDirection: "row", gap: 8 },
  vacBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  estadoChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  estadoAprob: { backgroundColor: ios.colors.green + "22" },
  estadoRech: { backgroundColor: ios.colors.red + "22" },
  estadoChipText: { fontSize: 11, fontWeight: "600", color: COLORS.text },

  btnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
  },
  btnPrimaryText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  btnOutline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  btnOutlineText: { fontSize: 14, fontWeight: "600", color: COLORS.primary },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  modalSub: { fontSize: 13, color: COLORS.textSecondary },
  modalBtns: { flexDirection: "row", gap: 8, marginTop: 8 },

  // Calendario
  calNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  calNavTitulo: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    textTransform: "capitalize",
  },
  calGridWrap: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  calSemanaRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  calSemanaCell: {
    width: "14.28%",
    alignItems: "center",
    paddingVertical: 3,
  },
  calSemanaTxt: {
    fontSize: 9,
    fontWeight: "700",
    color: COLORS.textDisabled,
    textTransform: "uppercase",
  },
  calGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calDay: {
    width: "14.28%",
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    padding: 1,
  },
  calDayNum: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.text,
  },
  calDayDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  calDayHoras: {
    fontSize: 7,
    fontWeight: "700",
    color: COLORS.primary,
    marginTop: 1,
  },
  dayDetailWrap: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayDetailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayDetailTitulo: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
});
