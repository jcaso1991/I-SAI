import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, TextInput, Platform, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, clearToken, COLORS } from "../src/api";
import ResponsiveLayout from "../src/ResponsiveLayout";
import { useBreakpoint } from "../src/useBreakpoint";
import IOSHeader from "../src/ui/IOSHeader";
import { useThemedStyles } from "../src/theme";
import { ios } from "../src/ui/iosTheme";



const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DAYS_MONTH = ["L", "M", "X", "J", "V", "S", "D"];

function pad(n: number): string { return String(n).padStart(2, "0"); }
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtTimeNow(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

type Tab = "fichar" | "vacaciones" | "mensual";

export default function FichajesScreen() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const s = useThemedStyles(useS);
  const [tab, setTab] = useState<Tab>("fichar");
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fichajesHoy, setFichajesHoy] = useState<any[]>([]);
  const [horaActual, setHoraActual] = useState(fmtTimeNow());
  const [ubicacion, setUbicacion] = useState<{lat: number; lng: number} | null>(null);
  const [saldoDias, setSaldoDias] = useState<any>(null);
  const [vacacionesList, setVacacionesList] = useState<any[]>([]);
  const [fichajesMes, setFichajesMes] = useState<any[]>([]);
  const [fichajesAnio, setFichajesAnio] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);

  // Vacaciones form
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [tipoSolicitud, setTipoSolicitud] = useState<"vacaciones" | "ausencia">("vacaciones");
  const [motivo, setMotivo] = useState("");

  // Calendario
  const [anchorMonth, setAnchorMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const hoyDia = useMemo(() => todayISO(), []);

  // Editar fichajes
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEntrada, setEditEntrada] = useState("");
  const [editSalida, setEditSalida] = useState("");
  const limiteAno = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d;
  }, []);

  const perms: string[] = (me?.permissions as string[]) || [];
  const has = (p: string) => perms.includes(p);
  const isAdmin = me?.role === "admin" || has("fichajes.manage");

  // Reloj en tiempo real
  useEffect(() => {
    const t = setInterval(() => setHoraActual(fmtTimeNow()), 1000);
    return () => clearInterval(t);
  }, []);

  const syncOfflineFichajes = useCallback(async () => {}, []);

  useEffect(() => {
  }, [syncOfflineFichajes]);

  const getLocation = async () => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
      );
    }
  };

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      try {
        const u = await api.me();
        if (!alive) return;
        setMe(u);
        await Promise.all([cargarFichajesHoy(), cargarVacaciones(), cargarConfig(), cargarResumen()]);
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

  async function cargarFichajesHoy() {
    try {
      const hoy = todayISO();
      const items = await api.fichajesListar(undefined, `${hoy}T00:00:00`, `${hoy}T23:59:59`);
      setFichajesHoy(items || []);
    } catch {}
  }

  async function cargarFichajesMes() {
    const d = new Date(anchorMonth);
    const inicio = new Date(d.getFullYear(), d.getMonth(), 1);
    const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const from = inicio.toISOString();
    const to = fin.toISOString();
    try {
      const items = await api.fichajesListar(undefined, from, to);
      setFichajesMes(items || []);
    } catch {}
  }

  async function cargarVacaciones() {
    try {
      if (!me?.id) return;
      const [lista, saldo] = await Promise.all([
        api.vacacionesListar(),
        api.vacacionesSaldo(me.id),
      ]);
      setVacacionesList(lista || []);
      setSaldoDias(saldo);
    } catch {}
  }

  async function cargarConfig() {
    try {
      const c = await api.configFichajes();
      setConfig(c);
    } catch {}
  }

  async function cargarResumen() {
    try {
      const ahora = new Date();
      const inicioAnio = `${ahora.getFullYear()}-01-01T00:00:00`;
      const finHoy = ahora.toISOString();
      const items = await api.fichajesListar(undefined, inicioAnio, finHoy);
      setFichajesAnio(items || []);
    } catch {}
  }

  // Resumen semanal / mensual / anual
  const resumenHoras = useMemo(() => {
    const ahora = new Date();
    const inicioSemana = new Date(ahora);
    inicioSemana.setDate(ahora.getDate() - (ahora.getDay() === 0 ? 6 : ahora.getDay() - 1));
    inicioSemana.setHours(0, 0, 0, 0);
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

    let minSemana = 0, minMes = 0, minAnio = 0;
    const diasSemana = new Set<string>();
    const diasMes = new Set<string>();
    const diasAnio = new Set<string>();

    for (const f of fichajesAnio) {
      if (!f.entrada) continue;
      const fechaDia = f.fecha || "";
      if (!fechaDia) continue;

      const d = new Date(fechaDia + "T00:00:00");
      let minutos = 0;
      if (f.entrada && f.salida) {
        const [h, m2] = (f.total || "0h 0m").replace("h ", ":").split(":");
        minutos = (parseInt(h) || 0) * 60 + (parseInt(m2) || 0);
      }

      if (d >= inicioSemana) { minSemana += minutos; if (minutos > 0) diasSemana.add(fechaDia); }
      if (d >= inicioMes) { minMes += minutos; if (minutos > 0) diasMes.add(fechaDia); }
      minAnio += minutos;
      if (minutos > 0) diasAnio.add(fechaDia);
    }

    return {
      semana: { horas: `${Math.floor(minSemana / 60)}h ${minSemana % 60}m`, dias: diasSemana.size },
      mes: { horas: `${Math.floor(minMes / 60)}h ${minMes % 60}m`, dias: diasMes.size },
      anio: { horas: `${Math.floor(minAnio / 60)}h ${minAnio % 60}m`, dias: diasAnio.size },
    };
  }, [fichajesAnio]);

  async function fichar(tipo: string) {
     try {
      await getLocation();
      await api.fichajeCrear({
        tipo,
        lat: ubicacion?.lat,
        lng: ubicacion?.lng,
        dispositivo: Platform.OS === "web" ? "web" : "mobile",
      });
      await cargarFichajesHoy();
      cargarResumen();
      Alert.alert("Fichaje registrado", `${tipo.replace("_", " ").toUpperCase()} registrado a las ${fmtTimeNow()}`);
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo crear el fichaje");
    }
  }

  async function editarFichaje(fichajeId: string) {
    try {
      await api.fichajeEditar(fichajeId, editEntrada || undefined, editSalida || undefined);
      setEditingId(null);
      await Promise.all([cargarFichajesHoy(), cargarResumen(), cargarFichajesMes()]);
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo editar el fichaje");
    }
  }

  async function borrarFichaje(fichajeId: string) {
    Alert.alert("Borrar fichaje", "¿Eliminar este registro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar", style: "destructive", onPress: async () => {
        try {
          await api.fichajeEliminar(fichajeId);
          await Promise.all([cargarFichajesHoy(), cargarResumen(), cargarFichajesMes()]);
        } catch (e: any) { Alert.alert("Error", e.message); }
      }},
    ]);
  }

  const puedeEditar = has("fichajes.edit_own") || has("fichajes.manage") || me?.role === "admin";

  async function solicitarVacaciones() {
    if (!fechaInicio || !fechaFin) {
      Alert.alert("Faltan datos", "Selecciona las fechas");
      return;
    }
    try {
      await api.vacacionesSolicitar({
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        tipo: tipoSolicitud,
        motivo,
      });
      setFechaInicio("");
      setFechaFin("");
      setMotivo("");
      await cargarVacaciones();
      Alert.alert("Enviada", "Solicitud enviada correctamente");
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo gestionar");
    }
  }

  // Cambiar mes
  function mesAnterior() {
    const target = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() - 1, 1);
    if (target >= limiteAno) { setAnchorMonth(target); setSelectedDay(null); }
  }
  function mesSiguiente() {
    const hoy = new Date();
    const target = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() + 1, 1);
    if (target <= new Date(hoy.getFullYear(), hoy.getMonth(), 1)) { setAnchorMonth(target); setSelectedDay(null); }
  }

  useEffect(() => { cargarFichajesMes(); }, [anchorMonth]);

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

  // Dias del calendario
  const vacacionesPorDia = useMemo(() => {
    const map: Record<string, string> = {};
    for (const v of vacacionesList) {
      const ini = new Date(v.fecha_inicio + "T00:00:00");
      const fin = new Date(v.fecha_fin + "T00:00:00");
      for (let d = new Date(ini); d <= fin; d.setDate(d.getDate() + 1)) {
        const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        map[key] = v.estado;
      }
    }
    return map;
  }, [vacacionesList]);

  const calendarioDias = useMemo(() => {
    const a = anchorMonth.getFullYear();
    const m = anchorMonth.getMonth();
    const primerDia = new Date(a, m, 1);
    const inicio = new Date(primerDia);
    inicio.setDate(inicio.getDate() - (primerDia.getDay() === 0 ? 6 : primerDia.getDay() - 1));

    const dias = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio);
      d.setDate(d.getDate() + i);
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const enMes = d.getMonth() === m;
      const fichajesDia = fichajesPorDia[key] || [];
      const horasTotal = fichajesDia.reduce((sum, f) => {
        if (!f.entrada || !f.salida) return sum;
        const [h, mm] = (f.total || "0h 0m").replace("h ", ":").split(":");
        return sum + (parseInt(h) || 0) * 60 + (parseInt(mm) || 0);
      }, 0);
      const tieneEntrada = fichajesDia.some((f) => f.entrada);
      const tieneSalida = fichajesDia.some((f) => f.salida);
      const festivos = config?.festivos || [];
      const esFestivo = festivos.includes(key);
      const vacStatus = vacacionesPorDia[key];
      dias.push({
        key, dia: d.getDate(), enMes,
        fichajes: fichajesDia,
        horas: horasTotal > 0 ? `${Math.floor(horasTotal / 60)}h ${horasTotal % 60}m` : null,
        tieneEntrada, tieneSalida,
        esFestivo, vacStatus,
      });
    }
    return dias;
  }, [anchorMonth, fichajesPorDia, config, vacacionesPorDia]);

  // Totales del mes visible
  const totalesMes = useMemo(() => {
    let totalMin = 0;
    let diasSet = new Set<string>();
    for (const f of fichajesMes) {
      if (f.entrada) diasSet.add(f.fecha || "");
      if (f.entrada && f.salida) {
        const [h, m2] = (f.total || "0h 0m").replace("h ", ":").split(":");
        totalMin += (parseInt(h) || 0) * 60 + (parseInt(m2) || 0);
      }
    }
    return {
      horas: `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`,
      dias: diasSet.size,
    };
  }, [fichajesMes]);

  const tipoLegible: Record<string, string> = {
    entrada: "Entrada",
    salida: "Salida",
    inicio_pausa: "Inicio pausa",
    fin_pausa: "Fin pausa",
  };

  const estadoIcon: Record<string, { color: string; icon: string }> = {
    pendiente: { color: ios.colors.yellow, icon: "time" },
    aprobada: { color: ios.colors.green, icon: "checkmark-circle" },
    rechazada: { color: ios.colors.red, icon: "close-circle" },
  };

  const content = (
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      {!isWide && <IOSHeader title={"Fichajes"} showBack />}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : (
        <View style={s.body}>
          {/* Tabs */}
          <View style={s.tabs}>
            {(["fichar", "vacaciones", "mensual"] as Tab[]).map((tabKey) => (
              <TouchableOpacity
                key={tabKey}
                style={[s.tab, tab === tabKey && s.tabActive]}
                onPress={() => setTab(tabKey)}
              >
                <Ionicons
                  name={tabKey === "fichar" ? "time" : tabKey === "vacaciones" ? "umbrella" : "calendar"}
                  size={16}
                  color={tab === tabKey ? COLORS.primary : COLORS.textSecondary}
                />
                <Text style={[s.tabLabel, tab === tabKey && s.tabLabelActive]}>
                  {tabKey === "fichar" ? "Fichar" : tabKey === "vacaciones" ? "Vacaciones" : "Mensual"}
                </Text>
              </TouchableOpacity>
            ))}
            {isAdmin && (
              <TouchableOpacity
                style={[s.tab, s.tabAdmin]}
                onPress={() => router.push("/fichajes/admin" as any)}
              >
                <Ionicons name="settings" size={16} color={COLORS.accent} />
                <Text style={[s.tabLabel, { color: COLORS.accent }]}>{"Admin"}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* === FICHAR === */}
          {tab === "fichar" && (
            <ScrollView contentContainerStyle={s.ficharWrap} refreshControl={<RefreshControl refreshing={loading} onRefresh={cargarFichajesHoy} />}>
              {/* Reloj grande */}
              <View style={s.relojCard}>
                <Text style={s.relojLabel}>{"Hora actual"}</Text>
                <Text style={s.relojTiempo}>{horaActual}</Text>
                <Text style={s.relojFecha}>
                  {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </Text>
              </View>

              {/* Botones de fichar */}
              <View style={s.botonesRow}>
                <TouchableOpacity style={[s.btnFichaje, s.btnEntrada]} onPress={() => fichar("entrada")} activeOpacity={0.7}>
                  <Ionicons name="enter" size={28} color="#fff" />
                  <Text style={s.btnFichajeTxt}>{"Entrada"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btnFichaje, s.btnSalida]} onPress={() => fichar("salida")} activeOpacity={0.7}>
                  <Ionicons name="exit" size={28} color="#fff" />
                  <Text style={s.btnFichajeTxt}>{"Salida"}</Text>
                </TouchableOpacity>
              </View>
              <View style={s.botonesRow}>
                <TouchableOpacity style={[s.btnFichaje, s.btnPausa]} onPress={() => fichar("inicio_pausa")} activeOpacity={0.7}>
                  <Ionicons name="pause" size={28} color="#fff" />
                  <Text style={s.btnFichajeTxt}>{"Pausa"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btnFichaje, s.btnFinPausa]} onPress={() => fichar("fin_pausa")} activeOpacity={0.7}>
                  <Ionicons name="play" size={28} color="#fff" />
                  <Text style={s.btnFichajeTxt}>{"Fin pausa"}</Text>
                </TouchableOpacity>
              </View>

              {/* Ubicacion */}
              {ubicacion && (
                <View style={s.ubicacionRow}>
                  <Ionicons name="location" size={14} color={COLORS.primary} />
                  <Text style={s.ubicacionTxt}>
                    {ubicacion.lat.toFixed(5)}, {ubicacion.lng.toFixed(5)}
                  </Text>
                </View>
              )}

              {/* Resumen semanal / mensual / anual */}
              <View style={s.resumenRow}>
                <View style={[s.resumenCard, { borderLeftColor: ios.colors.green }]}>
                  <Text style={s.resumenHoras}>{resumenHoras.semana.horas}</Text>
                  <Text style={s.resumenLabel}>{"Semanal"}</Text>
                  <Text style={s.resumenDias}>{resumenHoras.semana.dias}{" días"}</Text>
                </View>
                <View style={[s.resumenCard, { borderLeftColor: COLORS.primary }]}>
                  <Text style={s.resumenHoras}>{resumenHoras.mes.horas}</Text>
                  <Text style={s.resumenLabel}>{"Mensual"}</Text>
                  <Text style={s.resumenDias}>{resumenHoras.mes.dias}{" días"}</Text>
                </View>
                <View style={[s.resumenCard, { borderLeftColor: ios.colors.indigo }]}>
                  <Text style={s.resumenHoras}>{resumenHoras.anio.horas}</Text>
                  <Text style={s.resumenLabel}>{"Anual"}</Text>
                  <Text style={s.resumenDias}>{resumenHoras.anio.dias}{" días"}</Text>
                </View>
              </View>

              {/* Fichajes de hoy */}
              <Text style={s.seccionTitulo}>{"Fichajes de hoy"}</Text>
              {fichajesHoy.length === 0 ? (
                <Text style={s.emptyText}>{"Sin fichajes"}</Text>
              ) : (
                fichajesHoy.map((f) => (
                  <View key={f.id} style={s.fichajeRow}>
                    <View style={[s.fichajeDot, { backgroundColor: f.tipo === "entrada" || f.tipo === "fin_pausa" ? ios.colors.green : f.tipo === "salida" || f.tipo === "inicio_pausa" ? ios.colors.red : ios.colors.yellow }]} />
                    <Text style={s.fichajeTipo}>{tipoLegible[f.tipo] || f.tipo}</Text>
                    {editingId === f.id ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <TextInput style={s.editInput} value={editEntrada} onChangeText={setEditEntrada} placeholder="HH:MM" placeholderTextColor={COLORS.textDisabled} />
                        <Text style={{ color: COLORS.textDisabled, fontSize: 12 }}>-</Text>
                        <TextInput style={s.editInput} value={editSalida} onChangeText={setEditSalida} placeholder="HH:MM" placeholderTextColor={COLORS.textDisabled} />
                        <TouchableOpacity onPress={() => editarFichaje(f.id)}><Ionicons name="checkmark" size={18} color={ios.colors.green} /></TouchableOpacity>
                        <TouchableOpacity onPress={() => setEditingId(null)}><Ionicons name="close" size={18} color={ios.colors.red} /></TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={s.fichajeHora}>{f.hora}</Text>
                    )}
                    {f.fuera_horario && (
                      <View style={s.fueraPill}>
                        <Text style={s.fueraPillTxt}>{"Fuera de horario"}</Text>
                      </View>
                    )}
                    {puedeEditar && editingId !== f.id && f.id && (
                      <View style={{ flexDirection: "row", gap: 6, marginLeft: "auto" }}>
                        <TouchableOpacity onPress={() => { setEditingId(f.id); setEditEntrada(f.entrada ? f.entrada.slice(11, 16) : ""); setEditSalida(f.salida ? f.salida.slice(11, 16) : ""); }}>
                          <Ionicons name="create-outline" size={16} color={COLORS.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => borrarFichaje(f.id)}>
                          <Ionicons name="trash-outline" size={16} color={ios.colors.red} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          )}

          {/* === VACACIONES === */}
          {tab === "vacaciones" && (
            <ScrollView contentContainerStyle={s.vacacionesWrap} refreshControl={<RefreshControl refreshing={loading} onRefresh={cargarVacaciones} />}>
              {/* Saldo */}
              {saldoDias && (
                <View style={s.saldoCard}>
                  <Ionicons name="calendar" size={24} color={COLORS.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.saldoTitulo}>{"Dias disponibles"}</Text>
                    <Text style={s.saldoNum}>{saldoDias.dias_disponibles} / {saldoDias.dias_anuales}</Text>
                    <View style={s.saldoBarraBg}>
                      <View style={[s.saldoBarra, { width: `${Math.min(100, ((saldoDias.dias_usados || 0) / saldoDias.dias_anuales) * 100)}%` }]} />
                    </View>
                    <Text style={s.saldoUsados}>{saldoDias.dias_usados}{" usados"}</Text>
                  </View>
                </View>
              )}

              {/* Formulario */}
              <Text style={s.seccionTitulo}>{"Fichajes de hoy"}</Text>
              <View style={s.formCard}>
                <View style={s.tipoRow}>
                  <TouchableOpacity
                    style={[s.tipoBtn, tipoSolicitud === "vacaciones" && s.tipoBtnActive]}
                    onPress={() => setTipoSolicitud("vacaciones")}
                  >
                    <Ionicons name="umbrella" size={16} color={tipoSolicitud === "vacaciones" ? "#fff" : COLORS.textSecondary} />
                    <Text style={[s.tipoBtnTxt, tipoSolicitud === "vacaciones" && { color: "#fff" }]}>{"Vacaciones"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.tipoBtn, tipoSolicitud === "ausencia" && s.tipoBtnActive]}
                    onPress={() => setTipoSolicitud("ausencia")}
                  >
                    <Ionicons name="medkit" size={16} color={tipoSolicitud === "ausencia" ? "#fff" : COLORS.textSecondary} />
                    <Text style={[s.tipoBtnTxt, tipoSolicitud === "ausencia" && { color: "#fff" }]}>{"Ausencia"}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={s.inputLabel}>{"Fecha inicio"}</Text>
                <TextInput style={s.input} placeholder="YYYY-MM-DD" value={fechaInicio} onChangeText={setFechaInicio} placeholderTextColor={COLORS.textDisabled} />
                <Text style={s.inputLabel}>{"Fecha fin"}</Text>
                <TextInput style={s.input} placeholder="YYYY-MM-DD" value={fechaFin} onChangeText={setFechaFin} placeholderTextColor={COLORS.textDisabled} />
                <Text style={s.inputLabel}>{"Motivo"}</Text>
                <TextInput style={[s.input, s.inputMulti]} placeholder="Motivo de la solicitud..." value={motivo} onChangeText={setMotivo} multiline placeholderTextColor={COLORS.textDisabled} />
                <TouchableOpacity style={s.solicitarBtn} onPress={solicitarVacaciones} activeOpacity={0.7}>
                  <Text style={s.solicitarBtnTxt}>{"Enviar solicitud"}</Text>
                </TouchableOpacity>
              </View>

              {/* Historial */}
              <Text style={s.seccionTitulo}>{"Historial"}</Text>
              {vacacionesList.length === 0 ? (
                <Text style={s.emptyText}>{"Sin fichajes"}</Text>
              ) : (
                vacacionesList.map((v) => {
                  const e = estadoIcon[v.estado] || { color: COLORS.textSecondary, icon: "help-circle" };
                  return (
                    <View key={v.id} style={s.vacRow}>
                      <Ionicons name={e.icon as any} size={20} color={e.color} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.vacTxt}>
                          {v.tipo === "vacaciones" ? "Vacaciones" : "Ausencia"}: {v.fecha_inicio} a {v.fecha_fin}
                        </Text>
                        {v.motivo ? <Text style={s.vacMotivo}>{v.motivo}</Text> : null}
                      </View>
                      <View style={[s.estadoPill, { backgroundColor: e.color + "20" }]}>
                        <Text style={[s.estadoPillTxt, { color: e.color }]}>{v.estado}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* === MENSUAL === */}
          {tab === "mensual" && (
            <ScrollView contentContainerStyle={s.calWrap} refreshControl={<RefreshControl refreshing={loading} onRefresh={cargarFichajesMes} />}>
              {/* Navegación mes */}
              <View style={s.calNav}>
                <TouchableOpacity onPress={mesAnterior} disabled={anchorMonth <= limiteAno} style={anchorMonth <= limiteAno && { opacity: 0.3 }}>
                  <Ionicons name="chevron-back" size={20} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={s.calNavTitulo}>{MONTHS[anchorMonth.getMonth()]} {anchorMonth.getFullYear()}</Text>
                <TouchableOpacity onPress={mesSiguiente} disabled={anchorMonth >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)} style={anchorMonth >= new Date(new Date().getFullYear(), new Date().getMonth(), 1) && { opacity: 0.3 }}>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              {/* Totales */}
              <View style={s.mesTotales}>
                <View style={s.mesTotalCard}>
                  <Text style={s.mesTotalVal}>{totalesMes.horas}</Text>
                  <Text style={s.mesTotalLbl}>{"Horas mes"}</Text>
                </View>
                <View style={s.mesTotalCard}>
                  <Text style={s.mesTotalVal}>{totalesMes.dias}</Text>
                  <Text style={s.mesTotalLbl}>{"Días"}</Text>
                </View>
              </View>

              {/* Calendario */}
              <View style={s.calGridWrap}>
                <View style={s.calSemanaRow}>
                  {DAYS_MONTH.map((dd) => (
                    <View key={dd} style={s.calSemanaCell}>
                      <Text style={s.calSemanaTxt}>{dd}</Text>
                    </View>
                  ))}
                </View>
                <View style={s.calGrid}>
                  {calendarioDias.map((d) => {
                    const isToday = d.key === hoyDia;
                    const isSelected = d.key === selectedDay;
                    const completo = d.tieneEntrada && d.tieneSalida;
                    const incompleto = d.tieneEntrada && !d.tieneSalida;
                    let bg = "transparent";
                    if (isSelected) bg = COLORS.primary + "18";
                    else if (d.vacStatus === "aprobada") bg = "#10B98130";
                    else if (d.vacStatus === "pendiente") bg = "#8B5CF630";
                    else if (d.vacStatus === "rechazada") bg = "#EF444430";
                    else if (d.esFestivo) bg = ios.colors.red + "10";
                    else if (incompleto) bg = ios.colors.yellow + "18";
                    else if (completo) bg = ios.colors.green + "12";

                    return (
                      <TouchableOpacity
                        key={d.key}
                        style={[
                          s.calDay, { height: isWide ? 42 : 36 },
                          { backgroundColor: bg },
                          isToday && { borderColor: COLORS.primary, borderWidth: 2 },
                          !d.enMes && { opacity: 0.25 },
                        ]}
                        onPress={() => d.enMes && setSelectedDay(d.key === selectedDay ? null : d.key)}
                        activeOpacity={0.6}
                      >
                        <Text style={[
                          s.calDayNum,
                          isToday && { color: COLORS.primary, fontWeight: "800" },
                          d.esFestivo && { color: ios.colors.red },
                          !d.enMes && { color: COLORS.textDisabled },
                        ]}>{d.dia}</Text>
                        <View style={{ flexDirection: "row", gap: 1, flexWrap: "wrap", justifyContent: "center" }}>
                          {d.fichajes.filter((f: any) => f.entrada && f.salida).map((f: any, fi: number) => (
                            <View key={fi} style={[s.calDayDot, { backgroundColor: f.tipo === "entrada" || f.tipo === "fin_pausa" ? ios.colors.green : ios.colors.orange }]} />
                          ))}
                        </View>
                        {d.horas && (
                          <Text style={s.calDayHoras}>{d.horas}</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Detalle día seleccionado */}
              {selectedDay && (
                <View style={s.dayDetailWrap}>
                  <View style={s.dayDetailHeader}>
                    <Text style={s.dayDetailTitulo}>{selectedDay}</Text>
                    <TouchableOpacity onPress={() => setSelectedDay(null)}>
                      <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  {(fichajesPorDia[selectedDay] || []).length === 0 ? (
                    <Text style={s.emptyText}>{"Sin fichajes este día"}</Text>
                  ) : (
                    <View style={s.tablaWrap}>
                      <View style={s.tablaHRow}>
                        <Text style={[s.tablaH, { flex: 1 }]}>{"Tipo"}</Text>
                        <Text style={[s.tablaH, { flex: 1 }]}>{"Entrada"}</Text>
                        <Text style={[s.tablaH, { flex: 1 }]}>{"Salida"}</Text>
                        <Text style={[s.tablaH, { width: 55 }]}>{"Total"}</Text>
                        <Text style={[s.tablaH, { width: 24 }]}>{""}</Text>
                      </View>
                      {(fichajesPorDia[selectedDay] || []).map((f: any, idx: number) => {
                        const esHoy = selectedDay === todayISO();
                        return (
                        <View key={f.id || idx} style={[s.tablaRow, idx % 2 === 0 && { backgroundColor: COLORS.readonly }]}>
                          <Text style={[s.tablaTd, { flex: 1 }]}>{tipoLegible[f.tipo] || f.tipo}</Text>
                          {editingId === f.id ? (
                            <>
                              <TextInput style={[s.tablaTd, s.editInputSmall, { flex: 1 }]} value={editEntrada} onChangeText={setEditEntrada} placeholder="HH:MM" placeholderTextColor={COLORS.textDisabled} />
                              <TextInput style={[s.tablaTd, s.editInputSmall, { flex: 1 }]} value={editSalida} onChangeText={setEditSalida} placeholder="HH:MM" placeholderTextColor={COLORS.textDisabled} />
                              <Text style={[s.tablaTd, { width: 55 }]}>{f.total}</Text>
                              <View style={{ width: 50, flexDirection: "row", gap: 4 }}>
                                <TouchableOpacity onPress={() => editarFichaje(f.id)}><Ionicons name="checkmark" size={16} color={ios.colors.green} /></TouchableOpacity>
                                <TouchableOpacity onPress={() => setEditingId(null)}><Ionicons name="close" size={16} color={ios.colors.red} /></TouchableOpacity>
                              </View>
                            </>
                          ) : (
                            <>
                              <Text style={[s.tablaTd, { flex: 1 }]}>{f.entrada ? f.entrada.slice(11, 16) : "-"}</Text>
                              <Text style={[s.tablaTd, { flex: 1 }]}>{f.salida ? f.salida.slice(11, 16) : "-"}</Text>
                              <Text style={[s.tablaTd, { width: 55 }]}>{f.total}</Text>
                              <View style={{ width: 50, flexDirection: "row", gap: 4, alignItems: "center" }}>
                                {puedeEditar && f.id && (
                                  <>
                                    <TouchableOpacity onPress={() => { setEditingId(f.id); setEditEntrada(f.entrada ? f.entrada.slice(11, 16) : ""); setEditSalida(f.salida ? f.salida.slice(11, 16) : ""); }}>
                                      <Ionicons name="create-outline" size={14} color={COLORS.primary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => borrarFichaje(f.id)}>
                                      <Ionicons name="trash-outline" size={14} color={ios.colors.red} />
                                    </TouchableOpacity>
                                  </>
                                )}
                                {(!puedeEditar && esHoy && f.id) && (
                                  <TouchableOpacity onPress={() => borrarFichaje(f.id)}>
                                    <Ionicons name="trash-outline" size={14} color={ios.colors.red} />
                                  </TouchableOpacity>
                                )}
                              </View>
                            </>
                          )}
                        </View>
                      )})}
                    </View>
                  )}
                </View>
              )}

              {/* Leyenda */}
              <View style={s.leyenda}>
                <View style={s.leyendaItem}>
                  <View style={[s.leyendaDot, { backgroundColor: ios.colors.green }]} />
                  <Text style={s.leyendaTxt}>{"Completado"}</Text>
                </View>
                <View style={s.leyendaItem}>
                  <View style={[s.leyendaDot, { backgroundColor: ios.colors.yellow }]} />
                  <Text style={s.leyendaTxt}>{"Pendiente"}</Text>
                </View>
                {config?.festivos?.length > 0 && (
                  <View style={s.leyendaItem}>
                    <View style={[s.leyendaDot, { backgroundColor: ios.colors.red }]} />
                    <Text style={s.leyendaTxt}>{config.festivos.length}{" festivos"}</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      )}
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
  body: { flex: 1 },

  // Tabs
  tabs: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10, gap: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface },
  tab: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.bg },
  tabActive: { backgroundColor: COLORS.primarySoft },
  tabAdmin: { marginLeft: "auto", backgroundColor: "transparent", borderWidth: 1, borderColor: COLORS.accent + "40" },
  tabLabel: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary },
  tabLabelActive: { color: COLORS.primary },

  // Fichar
  ficharWrap: { padding: 16, gap: 16 },
  relojCard: { alignItems: "center", padding: 28, borderRadius: ios.radius.card, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, ...ios.shadow.card },
  relojLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: "500", textTransform: "uppercase", letterSpacing: 1 },
  relojTiempo: { fontSize: 48, fontWeight: "800", color: COLORS.text, fontFamily: Platform.OS === "web" ? "'SF Mono', 'Menlo', monospace" : "monospace", letterSpacing: 2, marginTop: 4 },
  relojFecha: { fontSize: 14, color: COLORS.textSecondary, marginTop: 6, textTransform: "capitalize" },

  botonesRow: { flexDirection: "row", gap: 12 },
  btnFichaje: { flex: 1, paddingVertical: 22, borderRadius: ios.radius.card, alignItems: "center", gap: 8, borderWidth: 1, borderColor: "transparent", ...ios.shadow.card },
  btnEntrada: { backgroundColor: ios.colors.green },
  btnSalida: { backgroundColor: ios.colors.red },
  btnPausa: { backgroundColor: ios.colors.yellow },
  btnFinPausa: { backgroundColor: ios.colors.indigo },
  btnFichajeTxt: { fontSize: 14, fontWeight: "700", color: "#fff", letterSpacing: 1 },

  ubicacionRow: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.surface, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: COLORS.border },
  ubicacionTxt: { fontSize: 12, color: COLORS.textSecondary, fontFamily: Platform.OS === "web" ? "'SF Mono', monospace" : "monospace" },

  seccionTitulo: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginTop: 8 },

  resumenRow: { flexDirection: "row", gap: 8 },
  resumenCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    gap: 2,
  },
  resumenHoras: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  resumenLabel: { fontSize: 10, color: COLORS.textDisabled, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 },
  resumenDias: { fontSize: 10, color: COLORS.textSecondary },

  emptyText: { fontSize: 13, color: COLORS.textDisabled, fontStyle: "italic", padding: 12 },

  fichajeRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 10, padding: 12, gap: 10, borderWidth: 1, borderColor: COLORS.border },
  fichajeDot: { width: 10, height: 10, borderRadius: 5 },
  fichajeTipo: { fontSize: 13, fontWeight: "600", color: COLORS.text, flex: 1 },
  fichajeHora: { fontSize: 13, fontWeight: "500", color: COLORS.textSecondary, fontFamily: Platform.OS === "web" ? "'SF Mono', monospace" : "monospace" },
  fueraPill: { backgroundColor: ios.colors.orange + "20", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  fueraPillTxt: { fontSize: 10, fontWeight: "600", color: ios.colors.orange },

  // Vacaciones
  vacacionesWrap: { padding: 16, gap: 16 },
  saldoCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: COLORS.surface, borderRadius: ios.radius.card, padding: 18, borderWidth: 1, borderColor: COLORS.border, ...ios.shadow.card },
  saldoTitulo: { fontSize: 13, color: COLORS.textSecondary, fontWeight: "500" },
  saldoNum: { fontSize: 26, fontWeight: "800", color: COLORS.text, marginTop: 2 },
  saldoBarraBg: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, marginTop: 6, overflow: "hidden" },
  saldoBarra: { height: 6, backgroundColor: COLORS.primary, borderRadius: 3 },
  saldoUsados: { fontSize: 11, color: COLORS.textDisabled, marginTop: 3 },

  formCard: { backgroundColor: COLORS.surface, borderRadius: ios.radius.card, padding: 18, borderWidth: 1, borderColor: COLORS.border, gap: 10 },
  tipoRow: { flexDirection: "row", gap: 8 },
  tipoBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  tipoBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tipoBtnTxt: { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary },
  inputLabel: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary },
  input: { backgroundColor: COLORS.bg, borderRadius: 8, padding: 12, fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  inputMulti: { minHeight: 70, textAlignVertical: "top" },
  solicitarBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  solicitarBtnTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },

  vacRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 10, padding: 12, gap: 10, borderWidth: 1, borderColor: COLORS.border },
  vacTxt: { fontSize: 13, fontWeight: "500", color: COLORS.text },
  vacMotivo: { fontSize: 11, color: COLORS.textDisabled, marginTop: 2 },
  estadoPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  estadoPillTxt: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },

  // Calendario
  calWrap: { padding: 12, gap: 10 },
  calNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border },
  calNavTitulo: { fontSize: 15, fontWeight: "700", color: COLORS.text, textTransform: "capitalize" },

  mesTotales: { flexDirection: "row", gap: 6 },
  mesTotalCard: { flex: 1, alignItems: "center", padding: 10, backgroundColor: COLORS.surface, borderRadius: 10, gap: 2, borderWidth: 1, borderColor: COLORS.border },
  mesTotalVal: { fontSize: 17, fontWeight: "800", color: COLORS.text },
  mesTotalLbl: { fontSize: 10, color: COLORS.textDisabled, fontWeight: "500" },

  calGridWrap: { backgroundColor: COLORS.surface, borderRadius: 10, padding: 6, borderWidth: 1, borderColor: COLORS.border },
  calSemanaRow: { flexDirection: "row", marginBottom: 2 },
  calSemanaCell: { width: "14.28%", alignItems: "center", paddingVertical: 3 },
  calSemanaTxt: { fontSize: 9, fontWeight: "700", color: COLORS.textDisabled, textTransform: "uppercase" },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calDay: { width: "14.28%", alignItems: "center", justifyContent: "center", borderRadius: 5, padding: 2, borderWidth: 1, borderColor: "transparent" },
  calDayOut: { opacity: 0.3 },
  calDayFestivo: { backgroundColor: ios.colors.red + "10" },
  calDayNum: { fontSize: 11, fontWeight: "600", color: COLORS.text },
  calDayNumOut: { color: COLORS.textDisabled },
  calDayDot: { width: 3, height: 3, borderRadius: 1.5 },
  calDayHoras: { fontSize: 7, fontWeight: "700", color: COLORS.primary, marginTop: 1 },

  dayDetailWrap: { backgroundColor: COLORS.surface, borderRadius: 10, padding: 12, gap: 8, borderWidth: 1, borderColor: COLORS.border },
  dayDetailHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dayDetailTitulo: { fontSize: 14, fontWeight: "700", color: COLORS.text },

  tablaWrap: { gap: 2 },
  tablaHRow: { flexDirection: "row", backgroundColor: COLORS.primarySoft, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8 },
  tablaH: { fontSize: 10, fontWeight: "700", color: COLORS.text, textTransform: "uppercase" },
  tablaRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 8 },
  tablaTd: { fontSize: 11, color: COLORS.text },
  editInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    padding: 4,
    paddingHorizontal: 6,
    fontSize: 12,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.primary,
    fontFamily: Platform.OS === "web" ? "'SF Mono', monospace" : "monospace",
    width: 55,
    textAlign: "center",
  },
  editInputSmall: {
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    padding: 2,
    paddingHorizontal: 4,
    fontSize: 10,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.primary,
    fontFamily: Platform.OS === "web" ? "'SF Mono', monospace" : "monospace",
  },

  leyenda: { backgroundColor: COLORS.surface, borderRadius: 10, padding: 14, gap: 8, borderWidth: 1, borderColor: COLORS.border, marginTop: 12 },
  leyendaItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  leyendaDot: { width: 8, height: 8, borderRadius: 4 },
  leyendaTxt: { fontSize: 12, color: COLORS.textSecondary },
});
