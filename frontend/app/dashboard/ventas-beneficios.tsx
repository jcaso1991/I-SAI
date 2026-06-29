import { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Platform, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, getToken, BACKEND_URL } from "../../src/api";
import ResponsiveLayout from "../../src/ResponsiveLayout";
import { useThemedStyles } from "../../src/theme";
import { useBreakpoint } from "../../src/useBreakpoint";
import { ios, fontStyle } from "../../src/ui/iosTheme";

const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente", planificado: "Planificado", a_facturar: "A facturar",
  facturado: "Facturado", terminado: "Terminado", bloqueado: "Bloqueado",
};

function fmtEur(v: number | null | undefined): string {
  if (v == null || v === 0) return "—";
  const n = Number(v);
  if (isNaN(n) || n === 0) return "—";
  return n.toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || v === 0) return "—";
  return `${v > 0 ? "+" : ""}${v}%`;
}

function fmtHoras(v: any): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (isNaN(n)) return "—";
  return n === 0 ? "0h" : `${n}h`;
}

function causaDesviacion(p: any): string {
  const mat = p.desviacion_materiales || 0;
  const mo = p.desviacion_mo || 0;
  if (mat > 0 && mo > 0) return "Materiales y mano de obra";
  if (mat > 0) return "Exceso de materiales";
  if (mo > 0) return "Exceso de mano de obra";
  return "Margen ajustado";
}

function pctColor(v: number | null | undefined): string {
  if (v == null) return COLORS.textDisabled;
  if (v > 10) return COLORS.syncedText;
  if (v >= 0) return COLORS.pendingText;
  return COLORS.errorText;
}

const BAR_COLORS = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899", "#6366F1"];

function fmtEurShort(v: number): string {
  if (v === 0) return "0";
  if (Math.abs(v) >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(Math.round(v));
}

export default function VentasBeneficios() {
  const router = useRouter();
  const params = useLocalSearchParams<{ year?: string; search?: string; profit?: string; manager?: string }>();
  const { isWide } = useBreakpoint();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [showAllPerdidas, setShowAllPerdidas] = useState(false);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedYear, setSelectedYear] = useState<string>((params.year as string) || "");
  const [selectedManager, setSelectedManager] = useState<string>((params.manager as string) || "");
  const s = useThemedStyles(useS);
  const [searchText, setSearchText] = useState((params.search as string) || "");
  const [profitFilter, setProfitFilter] = useState<number | null>(params.profit ? Number(params.profit) : null);
  const [showProfitPicker, setShowProfitPicker] = useState(false);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [managers, setManagers] = useState<any[]>([]);
  const [exporting, setExporting] = useState(false);

  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized) return;
    const upd: Record<string, string> = {};
    if (selectedYear) upd.year = selectedYear;
    if (searchText) upd.search = searchText;
    if (profitFilter !== null) upd.profit = String(profitFilter);
    if (selectedManager) upd.manager = selectedManager;
    router.setParams(upd);
  }, [selectedYear, searchText, profitFilter, selectedManager]);

  useEffect(() => {
    getToken().then(async (token) => {
      try {
        const base = BACKEND_URL || "";
        const res = await fetch(`${base}/api/managers`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setManagers(await res.json());
      } catch {}
    });
  }, []);

  const fetchData = useCallback(async (year?: string, manager?: string) => {
    try {
      const token = await getToken();
      const base = BACKEND_URL || "";
      const qp = new URLSearchParams();
      if (year) qp.set("year", year);
      if (manager) qp.set("manager_id", manager);
      const qs = qp.toString();
      const res = await fetch(`${base}/api/dashboard/financiero${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: any) {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  const doExport = useCallback(async () => {
    setExporting(true);
    try {
      const token = await getToken();
      const base = BACKEND_URL || "";
      const qp = new URLSearchParams();
      if (selectedYear) qp.set("year", selectedYear);
      const qs = qp.toString();
      const res = await fetch(`${base}/api/dashboard/financiero/export-excel${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ventas_beneficios_${selectedYear || "todo"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      Alert.alert("Error", "No se pudo exportar el archivo");
    } finally {
      setExporting(false);
    }
  }, [selectedYear]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchData(selectedYear || undefined, selectedManager || undefined);
  }, [selectedYear, selectedManager]));

  useEffect(() => {
    if (data && !initialized && data.years_disponibles?.length > 0) {
      const currentYear = String(new Date().getFullYear());
      if (!selectedYear && data.years_disponibles.includes(currentYear)) {
        setSelectedYear(currentYear);
      }
      setInitialized(true);
    }
  }, [data]);

  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const r = data?.resumen;
  const detalle: any[] = data?.detalle || [];
  const perdidas: any[] = data?.perdidas || [];
  const comparativa: any[] = data?.comparativa || [];
  const years: string[] = data?.years_disponibles || [];
  const porGestor: any[] = data?.por_gestor || [];

  const filterProject = (p: any) => {
    if (searchText) {
      const q = searchText.toLowerCase();
      const code = (p.materiales || "").toLowerCase();
      const client = (p.cliente || "").toLowerCase();
      if (!code.includes(q) && !client.includes(q)) return false;
    }
    if (profitFilter !== null) {
      const ben = p.ben_real || 0;
      if (profitFilter === 0 && ben >= 0) return false;
      if (profitFilter > 0 && ben > profitFilter) return false;
    }
    return true;
  };

  const filteredDetalle = detalle.filter(filterProject);
  const filteredPerdidas = perdidas.filter(filterProject);

  if (sortCol) {
    filteredDetalle.sort((a: any, b: any) => {
      const va = a[sortCol] ?? "";
      const vb = b[sortCol] ?? "";
      if (sortCol === "materiales") {
        return sortDir === "desc" ? String(vb).localeCompare(String(va)) : String(va).localeCompare(String(vb));
      }
      const na = Number(va) || 0;
      const nb = Number(vb) || 0;
      return sortDir === "desc" ? nb - na : na - nb;
    });
  }

  const displayed = showAll ? filteredDetalle : filteredDetalle.slice(0, 10);

  const toggleSort = (col: string) => {
    if (sortCol === col) {
      if (sortDir === "desc") { setSortDir("asc"); }
      else { setSortCol(null); setSortDir("desc"); }
    } else {
      setSortCol(col); setSortDir("desc");
    }
  };

  const sortArrow = (col: string) => sortCol === col ? (sortDir === "desc" ? " ▼" : " ▲") : "";

  const maxMargen = Math.max(...comparativa.map((c: any) => Math.abs(c.margen)), 1);
  const maxVenta = Math.max(...comparativa.map((c: any) => c.venta), 1);

  return (
    <ResponsiveLayout active="ventas-beneficios">
      <SafeAreaView style={s.root} edges={["top"]}>
        <View style={s.header}>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.replace("/dashboard")}>
            <Ionicons name="chevron-back" size={26} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Ventas y Beneficios</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={[s.scroll, isWide && s.scrollWide]}
          showsVerticalScrollIndicator={false}
        >
          {/* Year selector + Export + Manager */}
          <View style={{ gap: 8, marginBottom: 4 }}>
            {years.length > 0 && (
              <View style={s.yearStrip}>
                <TouchableOpacity
                  style={[s.yearChip, !selectedYear && s.yearChipActive]}
                  onPress={() => setSelectedYear("")}
                >
                  <Text style={[s.yearChipTxt, !selectedYear && s.yearChipActiveTxt]}>Todos</Text>
                </TouchableOpacity>
                {years.map((y: string) => (
                  <TouchableOpacity
                    key={y}
                    style={[s.yearChip, selectedYear === y && s.yearChipActive]}
                    onPress={() => setSelectedYear(y)}
                  >
                    <Text style={[s.yearChipTxt, selectedYear === y && s.yearChipActiveTxt]}>{y}</Text>
                  </TouchableOpacity>
                ))}
                <View style={{ flex: 1 }} />
                {Platform.OS === "web" && (
                  <TouchableOpacity
                    style={s.exportBtn}
                    onPress={doExport}
                    disabled={exporting}
                  >
                    {exporting ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <Ionicons name="download-outline" size={18} color={COLORS.primary} />
                    )}
                    <Text style={s.exportBtnText}>{exporting ? "Exportando..." : "Exportar Excel"}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {managers.length > 0 && (
              <View style={s.yearStrip}>
                <TouchableOpacity
                  style={[s.yearChip, !selectedManager && s.yearChipActive]}
                  onPress={() => setSelectedManager("")}
                >
                  <Text style={[s.yearChipTxt, !selectedManager && s.yearChipActiveTxt]}>Todos los gestores</Text>
                </TouchableOpacity>
                {managers.map((m: any) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[s.yearChip, selectedManager === m.id && s.yearChipActive]}
                    onPress={() => setSelectedManager(selectedManager === m.id ? "" : m.id)}
                  >
                    <Text style={[s.yearChipTxt, selectedManager === m.id && s.yearChipActiveTxt]}>{m.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Alertas automáticas */}

          {/* KPI Cards */}
          {r && (
            <View style={s.kpiRow}>
              <View style={s.kpiCard}>
                <Text style={s.kpiValue}>{fmtEur(r.total_venta_prevista)}</Text>
                <Text style={s.kpiLabel}>Ventas previstas</Text>
              </View>
              <View style={s.kpiCard}>
                <Text style={s.kpiValue}>{fmtEur(r.total_coste_real)}</Text>
                <Text style={s.kpiLabel}>Costes reales</Text>
              </View>
              <View style={s.kpiCard}>
                <Text style={[s.kpiValue, { color: pctColor(r.beneficio_medio_real) }]}>
                  {fmtPct(r.beneficio_medio_real)}
                </Text>
                <Text style={s.kpiLabel}>Margen real medio</Text>
              </View>
              <View style={s.kpiCard}>
                <Text style={s.kpiValue}>{r.proyectos_con_datos}</Text>
                <Text style={s.kpiLabel}>{selectedYear ? `Proyectos ${selectedYear}` : "Proyectos totales"}</Text>
              </View>
            </View>
          )}



          {/* Year-over-Year Comparison Chart */}
          {comparativa.length > 1 && (
            <View style={s.chartCard}>
              <Text style={[s.sectionTitle, { marginBottom: 16 }]}>Comparativa anual</Text>
              <View style={s.chartLegend}>
                <View style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: BAR_COLORS[0] }]} />
                  <Text style={s.legendText}>Margen (€)</Text>
                </View>
                <View style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: BAR_COLORS[3] }]} />
                  <Text style={s.legendText}>Ventas (€)</Text>
                </View>
              </View>

              {comparativa.map((c: any, i: number) => (
                <View key={c.year} style={{ marginTop: i === 0 ? 8 : 16 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={s.chartYear}>{c.year}</Text>
                    <Text style={s.chartYearVal}>
                      Margen: {fmtEur(c.margen)} ({c.margen_pct}%)
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ height: 10, backgroundColor: COLORS.bg, borderRadius: 6, overflow: "hidden" }}>
                        <View style={{
                          height: 10, borderRadius: 6,
                          backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                          width: `${Math.max(5, (Math.abs(c.margen) / maxMargen) * 100)}%`,
                        }} />
                      </View>
                      <Text style={{ fontSize: 10, color: BAR_COLORS[i % BAR_COLORS.length], fontWeight: "700", marginTop: 2 }}>
                        {fmtEurShort(c.margen)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ height: 10, backgroundColor: COLORS.bg, borderRadius: 6, overflow: "hidden" }}>
                        <View style={{
                          height: 10, borderRadius: 6,
                          backgroundColor: BAR_COLORS[3],
                          width: `${Math.max(5, (c.venta / maxVenta) * 100)}%`,
                          opacity: 0.6,
                        }} />
                      </View>
                      <Text style={{ fontSize: 10, color: BAR_COLORS[3], fontWeight: "700", marginTop: 2 }}>
                        {fmtEurShort(c.venta)}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                    <Text style={s.chartMeta}>
                      {c.proyectos} proyectos
                    </Text>
                    <Text style={s.chartMeta}>
                      Beneficio: {c.margen_pct}%
                    </Text>
                  </View>
                </View>
              ))}

              <View style={{ marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {comparativa.map((c: any, i: number) => (
                  <View key={`res-${c.year}`} style={{
                    flex: 1, minWidth: 100, backgroundColor: COLORS.bg,
                    borderRadius: 8, padding: 10, alignItems: "center",
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: "800", color: COLORS.text }}>{c.year}</Text>
                    <Text style={{ fontSize: 11, color: pctColor(c.margen_pct), fontWeight: "700", marginTop: 2 }}>
                      {c.margen_pct}% margen
                    </Text>
                    <Text style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 1 }}>
                      {c.proyectos} proy.
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Financial summary */}
          {r && (
            <View style={s.summaryGrid}>
              <SummaryItem label="Margen previsto total" value={fmtEur(r.total_margen_previsto)} color={pctColor(r.beneficio_medio_inicial)} s={s} />
              <SummaryItem label="Margen real total" value={fmtEur(r.total_margen_real)} color={pctColor(r.beneficio_medio_real)} s={s} />
              <SummaryItem label="Coste previsto total" value={fmtEur(r.total_coste_previsto)} color={COLORS.textSecondary} s={s} />
              <SummaryItem label="Diferencia previsto vs real" value={fmtEur(r.total_margen_real - r.total_margen_previsto)} color={r.total_margen_real >= r.total_margen_previsto ? COLORS.syncedText : COLORS.errorText} s={s} />
              <SummaryItem label="% Beneficio inicial medio" value={fmtPct(r.beneficio_medio_inicial)} color={pctColor(r.beneficio_medio_inicial)} s={s} />
              <SummaryItem label="Proyectos sin datos" value={String(r.proyectos_sin_datos)} color={r.proyectos_sin_datos > 0 ? COLORS.errorText : COLORS.textSecondary} s={s} />
            </View>
          )}

          {/* Projects below margin */}
          {/* Search + profit filters */}
          <View style={{ gap: 10, marginTop: 24 }}>
            <View style={s.searchRow}>
              <Ionicons name="search" size={18} color={COLORS.textDisabled} />
              <TextInput
                style={s.searchInput}
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Buscar por codigo o cliente..."
                placeholderTextColor={COLORS.textDisabled}
              />
              {searchText !== "" && (
                <TouchableOpacity onPress={() => setSearchText("")}>
                  <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ ...fontStyle("caption"), color: COLORS.textSecondary }}>Beneficio max:</Text>
              <TouchableOpacity
                style={s.dropdown}
                onPress={() => setShowProfitPicker(!showProfitPicker)}
              >
                <Text style={s.dropdownText}>
                  {profitFilter !== null ? `≤ ${profitFilter}%` : "Sin filtro"}
                </Text>
                <Ionicons name={showProfitPicker ? "chevron-up" : "chevron-down"} size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.filterChip, profitFilter === 0 && s.filterChipActive]}
                onPress={() => setProfitFilter(profitFilter === 0 ? null : 0)}
              >
                <Text style={[s.filterChipTxt, profitFilter === 0 && s.filterChipActiveTxt]}>
                  <Ionicons name="arrow-down" size={12} color={profitFilter === 0 ? "#fff" : COLORS.errorText} /> Perdidas
                </Text>
              </TouchableOpacity>
            </View>
            {showProfitPicker && (
              <View style={s.dropdownList}>
                <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                  <TouchableOpacity
                    style={[s.dropdownItem, profitFilter === null && s.dropdownItemActive]}
                    onPress={() => { setProfitFilter(null); setShowProfitPicker(false); }}
                  >
                    <Text style={[s.dropdownItemTxt, profitFilter === null && { color: "#fff" }]}>Sin filtro</Text>
                  </TouchableOpacity>
                  {Array.from({ length: 60 }, (_, i) => i + 1).map((n) => (
                    <TouchableOpacity
                      key={n}
                      style={[s.dropdownItem, profitFilter === n && s.dropdownItemActive]}
                      onPress={() => { setProfitFilter(n); setShowProfitPicker(false); }}
                    >
                      <Text style={[s.dropdownItemTxt, profitFilter === n && { color: "#fff" }]}>≤ {n}%</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {filteredPerdidas.length > 0 && (
            <>
               <View style={[s.sectionHeader, { marginTop: 24 }]}>
                 <Ionicons name="warning" size={20} color={COLORS.errorText} />
                 <Text style={[s.sectionTitle, { color: COLORS.errorText }]}>
                   Proyectos por debajo del margen previsto ({filteredPerdidas.length})
                 </Text>
               </View>
               <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={true} nestedScrollEnabled={true}>
               {filteredPerdidas.slice(0, showAllPerdidas ? filteredPerdidas.length : 8).map((p: any) => (
                <View key={p.id}>
                  <TouchableOpacity
                    style={s.projectRow}
                    onPress={() => setExpandedProject(expandedProject === p.id ? null : p.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.projectName} numberOfLines={1}>
                        {p.materiales || "Sin codigo"} — {p.cliente || "Sin cliente"}
                      </Text>
                      <Text style={s.projectSub}>
                        {p.gestor || "Sin gestor"} · {STATUS_LABELS[p.project_status] || p.project_status}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[s.projectAmount, { color: COLORS.errorText }]}>
                        {fmtEur(p.desviacion_euros)}
                      </Text>
                      <Text style={s.projectDelta}>
                        Prev: {fmtEur(p.margen_previsto)} → Real: {fmtEur(p.margen_real)}
                      </Text>
                    </View>
                    <Ionicons
                      name={expandedProject === p.id ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={COLORS.textSecondary}
                      style={{ marginLeft: 8 }}
                    />
                  </TouchableOpacity>
                  {expandedProject === p.id && (
                    <View style={s.desvioDetail}>
                      <Text style={s.desvioCause}>{causaDesviacion(p)}</Text>
                      <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.desvioLabel}>Materiales</Text>
                          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Text style={s.desvioValue}>Prev: {fmtEur(p.coste_prev_mat)}</Text>
                            <Text style={[s.desvioValue, { color: (p.desviacion_materiales || 0) > 0 ? COLORS.errorText : COLORS.syncedText }]}>
                              Real: {fmtEur(p.coste_real_mat)}
                            </Text>
                          </View>
                          {(p.desviacion_materiales || 0) !== 0 && (
                            <Text style={[s.desvioDelta, { color: (p.desviacion_materiales || 0) > 0 ? COLORS.errorText : COLORS.syncedText }]}>
                              {(p.desviacion_materiales || 0) > 0 ? "+" : ""}{fmtEur(p.desviacion_materiales)}
                            </Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.desvioLabel}>Mano de obra</Text>
                          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Text style={s.desvioValue}>Prev: {fmtEur(p.coste_prev_mo)}</Text>
                            <Text style={[s.desvioValue, { color: (p.desviacion_mo || 0) > 0 ? COLORS.errorText : COLORS.syncedText }]}>
                              Real: {fmtEur(p.coste_real_mo)}
                            </Text>
                          </View>
                          {(p.desviacion_mo || 0) !== 0 && (
                            <Text style={[s.desvioDelta, { color: (p.desviacion_mo || 0) > 0 ? COLORS.errorText : COLORS.syncedText }]}>
                              {(p.desviacion_mo || 0) > 0 ? "+" : ""}{fmtEur(p.desviacion_mo)}
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.desvioLabel}>Horas previstas</Text>
                          <Text style={s.desvioValue}>{fmtHoras(p.horas_prev)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.desvioLabel}>Horas imputadas</Text>
                          <Text style={s.desvioValue}>{fmtHoras(p.horas_imputadas)}</Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={{ marginTop: 10, alignSelf: "flex-end" }}
                        onPress={() => router.push(`/material/${p.id}` as any)}
                      >
                        <Text style={{ color: COLORS.primary, fontWeight: "700", fontSize: 13 }}>
                          Ver detalle del proyecto →
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
              </ScrollView>
              {filteredPerdidas.length > 8 && (
                <TouchableOpacity style={s.showMoreBtn} onPress={() => setShowAllPerdidas(!showAllPerdidas)}>
                  <Text style={s.showMoreText}>
                    {showAllPerdidas ? "Mostrar menos" : `Ver todos (${filteredPerdidas.length - 8} más)`}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* All projects table */}
          <View style={[s.sectionHeader, { marginTop: 24 }]}>
            <Ionicons name="list" size={20} color={COLORS.textSecondary} />
            <Text style={[s.sectionTitle]}>Proyectos {selectedYear ? `de ${selectedYear}` : ""} ({filteredDetalle.length})</Text>
          </View>

          <View style={s.tableHeader}>
            <TouchableOpacity style={{ flex: 2 }} onPress={() => toggleSort("materiales")}>
              <Text style={[s.th, { flex: 0 }]}>Proyecto{sortArrow("materiales")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1.2 }} onPress={() => toggleSort("venta_total")}>
              <Text style={[s.th, { flex: 0, textAlign: "right" }]}>Venta{sortArrow("venta_total")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1.2 }} onPress={() => toggleSort("coste_real_total")}>
              <Text style={[s.th, { flex: 0, textAlign: "right" }]}>Coste real{sortArrow("coste_real_total")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => toggleSort("margen_real")}>
              <Text style={[s.th, { flex: 0, textAlign: "right" }]}>Margen{sortArrow("margen_real")}</Text>
            </TouchableOpacity>
          </View>

          {displayed.map((p: any) => {
            const desvColor = p.desviacion_euros >= 0 ? COLORS.syncedText : COLORS.errorText;
            return (
              <TouchableOpacity
                key={p.id}
                style={s.tableRow}
                onPress={() => router.push(`/material/${p.id}` as any)}
              >
                <View style={{ flex: 2 }}>
                  <Text style={s.cellName} numberOfLines={1}>{p.materiales || "—"}</Text>
                  <Text style={s.cellSub} numberOfLines={1}>{p.cliente || ""}</Text>
                </View>
                <Text style={[s.cell, { flex: 1.2, textAlign: "right" }]}>{fmtEur(p.venta_total)}</Text>
                <Text style={[s.cell, { flex: 1.2, textAlign: "right" }]}>{fmtEur(p.coste_real_total)}</Text>
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <Text style={[s.cell, { fontWeight: "800", color: desvColor }]}>
                    {fmtEur(p.margen_real)}
                  </Text>
                  <Text style={[s.cellSmall, { color: desvColor }]}>
                    {fmtPct(p.ben_real)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {filteredDetalle.length > 10 && (
            <TouchableOpacity style={s.showMoreBtn} onPress={() => setShowAll(!showAll)}>
              <Text style={s.showMoreText}>
                {showAll ? "Mostrar menos" : `Ver todos (${filteredDetalle.length - 10} más)`}
              </Text>
            </TouchableOpacity>
          )}

                    {/* Gestor summary cards */}
          {porGestor.length > 0 && !selectedManager && (
            <View style={s.chartCard}>
              <Text style={[s.sectionTitle, { marginBottom: 12 }]}>Resumen por gestor</Text>
              <View style={{ gap: 8 }}>
                {porGestor.map((g: any) => (
                  <TouchableOpacity
                    key={g.gestor_id}
                    style={s.managerRow}
                    onPress={() => setSelectedManager(g.gestor_id === "sin_gestor" ? "" : g.gestor_id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.managerName} numberOfLines={1}>{g.gestor_name}</Text>
                      <Text style={s.managerMeta}>{g.proyectos} proyectos</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[s.managerValue, { color: pctColor(g.margen_pct) }]}>
                        {fmtEur(g.margen_real)}
                      </Text>
                      <Text style={[s.managerPct, { color: pctColor(g.margen_pct) }]}>
                        {fmtPct(g.margen_pct)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textDisabled} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {data?.alertas?.length > 0 && (
            <View style={{ gap: 8, marginTop: 4 }}>
              {data.alertas.map((a: any, i: number) => {
                const isHoras = a.tipo === "horas_excedidas";
                return (
                  <TouchableOpacity
                    key={`alerta-${i}`}
                    style={[s.alertaCard, isHoras ? s.alertaRed : s.alertaAmber]}
                    onPress={() => router.push(`/material/${a.proyecto_id}` as any)}
                    activeOpacity={0.7}
                  >
                    <View style={s.alertaIcon}>
                      <Ionicons
                        name={isHoras ? "time" : "trending-down"}
                        size={20}
                        color={isHoras ? COLORS.errorText : "#92400E"}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.alertaTitle} numberOfLines={1}>
                        {isHoras
                          ? `Horas al ${a.pct}% — ${a.materiales || "Sin código"}`
                          : `Margen ${a.margen_pct}% — ${a.materiales || "Sin código"}`}
                      </Text>
                      <Text style={s.alertaSub}>
                        {isHoras
                          ? `${a.horas_imp}h imputadas de ${a.horas_prev}h previstas`
                          : `Beneficio real por debajo del 10%`}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <View style={{ height: 80 }} />
        </ScrollView>
      </SafeAreaView>
    </ResponsiveLayout>
  );
}

function SummaryItem({ label, value, color, s }: { label: string; value: string; color: string; s: any }) {
  return (
    <View style={s.summaryItem}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={[s.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: ios.spacing.md, paddingVertical: ios.spacing.sm,
    backgroundColor: COLORS.surface, borderBottomWidth: ios.hairline, borderBottomColor: COLORS.border,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { ...fontStyle("title3"), color: COLORS.text, fontWeight: "800" },
  scroll: { padding: ios.spacing.lg, gap: 12 },
  scrollWide: { maxWidth: 1000, alignSelf: "center", width: "100%" },
  yearStrip: {
    flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4,
  },
  yearChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border,
  },
  yearChipActive: {
    backgroundColor: COLORS.primary, borderColor: COLORS.primary,
  },
  yearChipTxt: {
    ...fontStyle("callout"), color: COLORS.textSecondary, fontWeight: "700",
  },
  yearChipActiveTxt: { color: "#fff", fontWeight: "800" },
  kpiRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  kpiCard: {
    flex: 1, minWidth: 140, backgroundColor: COLORS.surface,
    borderRadius: ios.radius.lg, padding: ios.spacing.md, borderWidth: 1, borderColor: COLORS.border,
    alignItems: "center",
  },
  kpiValue: { ...fontStyle("title1"), color: COLORS.text, fontWeight: "900" },
  kpiLabel: { ...fontStyle("caption"), color: COLORS.textSecondary, marginTop: 4, textAlign: "center" },
  chartCard: {
    backgroundColor: COLORS.surface, borderRadius: ios.radius.lg,
    padding: ios.spacing.groupPadding, borderWidth: 1, borderColor: COLORS.border,
  },
  chartLegend: { flexDirection: "row", gap: 20, marginBottom: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { ...fontStyle("caption"), color: COLORS.textSecondary, fontWeight: "600" },
  chartYear: { ...fontStyle("callout"), color: COLORS.text, fontWeight: "700" },
  chartYearVal: { ...fontStyle("caption"), color: COLORS.textSecondary },
  chartMeta: { fontSize: 10, color: COLORS.textDisabled },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  sectionTitle: { ...fontStyle("title3"), color: COLORS.text, fontWeight: "800" },
  summaryGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 8,
  },
  summaryItem: {
    flex: 1, minWidth: 150, backgroundColor: COLORS.surface,
    borderRadius: ios.radius.md, padding: ios.spacing.md, borderWidth: 1, borderColor: COLORS.border,
  },
  summaryLabel: { ...fontStyle("caption"), color: COLORS.textSecondary },
  summaryValue: { ...fontStyle("title2"), fontWeight: "800", marginTop: 4 },
  projectRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: COLORS.surface, borderRadius: ios.radius.md,
    padding: ios.spacing.md, borderWidth: 1, borderColor: COLORS.border,
  },
  projectName: { ...fontStyle("callout"), color: COLORS.text, fontWeight: "700" },
  projectSub: { ...fontStyle("caption"), color: COLORS.textSecondary, marginTop: 2 },
  projectAmount: { ...fontStyle("callout"), fontWeight: "900" },
  projectDelta: { ...fontStyle("caption"), color: COLORS.textSecondary, marginTop: 2 },
  tableHeader: {
    flexDirection: "row", gap: 8, paddingVertical: 8,
    borderBottomWidth: 2, borderBottomColor: COLORS.border,
  },
  th: { ...fontStyle("caption"), color: COLORS.textSecondary, fontWeight: "800", letterSpacing: 1 },
  tableRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 10, borderBottomWidth: ios.hairline, borderBottomColor: COLORS.border,
  },
  cellName: { ...fontStyle("callout"), color: COLORS.text, fontWeight: "700" },
  cellSub: { ...fontStyle("caption"), color: COLORS.textSecondary, marginTop: 1 },
  cell: { ...fontStyle("callout"), color: COLORS.text },
  cellSmall: { ...fontStyle("caption"), color: COLORS.textSecondary },
  showMoreBtn: {
    alignItems: "center", paddingVertical: 14,
    backgroundColor: COLORS.surface, borderRadius: ios.radius.md,
    borderWidth: 1, borderColor: COLORS.border, marginTop: 4,
  },
  showMoreText: { ...fontStyle("callout"), color: COLORS.primary, fontWeight: "700" },
  desvioDetail: {
    backgroundColor: COLORS.bg, borderRadius: ios.radius.md,
    padding: ios.spacing.md, marginTop: 4, marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  desvioCause: { ...fontStyle("callout"), color: COLORS.errorText, fontWeight: "800" },
  desvioLabel: { fontSize: 11, color: COLORS.textDisabled, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  desvioValue: { ...fontStyle("callout"), color: COLORS.text, fontWeight: "600" },
  desvioDelta: { fontSize: 13, fontWeight: "900", marginTop: 2 },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: COLORS.surface, borderRadius: ios.radius.md,
    borderWidth: 1.5, borderColor: COLORS.borderInput,
    paddingHorizontal: ios.spacing.md, height: 48,
  },
  searchInput: {
    flex: 1, fontSize: ios.font.callout.size, color: COLORS.text,
    height: 48,
  },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary, borderColor: COLORS.primary,
  },
  filterChipTxt: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "600" },
  filterChipActiveTxt: { color: "#fff", fontWeight: "700" },
  dropdown: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: COLORS.surface, borderRadius: ios.radius.md,
    borderWidth: 1.5, borderColor: COLORS.borderInput,
    paddingHorizontal: ios.spacing.md, height: 44, minWidth: 130,
  },
  dropdownText: {
    ...fontStyle("callout"), color: COLORS.text, fontWeight: "700",
  },
  dropdownList: {
    backgroundColor: COLORS.surface, borderRadius: ios.radius.md,
    borderWidth: 1, borderColor: COLORS.border, marginTop: 4,
    overflow: "hidden",
  },
  dropdownItem: {
    paddingHorizontal: ios.spacing.md, paddingVertical: 10,
    borderBottomWidth: ios.hairline, borderBottomColor: COLORS.border,
  },
  dropdownItemActive: {
    backgroundColor: COLORS.primary,
  },
  dropdownItemTxt: {
    ...fontStyle("callout"), color: COLORS.text, fontWeight: "600",
  },
  exportBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.primary,
  },
  exportBtnText: {
    ...fontStyle("callout"), color: COLORS.primary, fontWeight: "700",
  },
  managerRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: COLORS.bg, borderRadius: ios.radius.md,
    padding: ios.spacing.md, borderWidth: 1, borderColor: COLORS.border,
  },
  managerName: { ...fontStyle("callout"), color: COLORS.text, fontWeight: "700" },
  managerMeta: { ...fontStyle("caption"), color: COLORS.textSecondary, marginTop: 2 },
  managerValue: { ...fontStyle("callout"), fontWeight: "800" },
  managerPct: { ...fontStyle("caption"), fontWeight: "700", marginTop: 1 },
  alertaCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: ios.radius.md, padding: ios.spacing.md,
    borderWidth: 1,
  },
  alertaRed: {
    backgroundColor: COLORS.errorBg, borderColor: "#FECACA",
  },
  alertaAmber: {
    backgroundColor: "#FFFBEB", borderColor: "#FDE68A",
  },
  alertaIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.7)",
    alignItems: "center", justifyContent: "center",
  },
  alertaTitle: { ...fontStyle("callout"), color: COLORS.text, fontWeight: "700" },
  alertaSub: { ...fontStyle("caption"), color: COLORS.textSecondary, marginTop: 2 },
});
