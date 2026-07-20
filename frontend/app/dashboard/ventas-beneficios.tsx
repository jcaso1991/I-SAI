/* ================================================================
 * I-SAI — Ventas y Beneficios + Obra en Curso
 * Rediseño Visual de Alta Fidelidad - Panel Ejecutivo Premium
 * ================================================================ */

import { useCallback, useEffect, useState, useMemo } from "react";
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

const PREMIUM_COLORS = {
  get bg() { return COLORS.bg },
  get surface() { return COLORS.surface },
  get surfaceCard() { return COLORS.surface },
  get border() { return COLORS.border },
  get accent() { return COLORS.primary },
  get accentGlow() { return COLORS.primarySoft },
  success: "#10B981",
  successGlow: "rgba(16, 185, 129, 0.12)",
  warning: "#F59E0B",
  error: "#EF4444",
  errorGlow: "rgba(239, 68, 68, 0.12)",
  get textPrimary() { return COLORS.text },
  get textSecondary() { return COLORS.textSecondary },
  get textMuted() { return COLORS.textDisabled },
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
  if (mat > 0 && mo > 0) return "Desviación Crítica: Materiales y Mano de Obra";
  if (mat > 0) return "Exceso de Coste en Materiales";
  if (mo > 0) return "Exceso de Horas / Mano de Obra";
  return "Margen comercial ajustado";
}

function pctColor(v: number | null | undefined): string {
  if (v == null) return PREMIUM_COLORS.textMuted;
  if (v > 10) return PREMIUM_COLORS.success;
  if (v >= 0) return PREMIUM_COLORS.warning;
  return PREMIUM_COLORS.error;
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
  const [activeTab, setActiveTab] = useState<"ventas" | "obra">("ventas");
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
      } catch { /* silent */ }
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

  const comparativa: any[] = data?.comparativa || [];
  const maxMargen = useMemo(() => Math.max(...comparativa.map((c: any) => Math.abs(c.margen)), 1), [comparativa]);
  const maxVenta = useMemo(() => Math.max(...comparativa.map((c: any) => c.venta), 1), [comparativa]);

  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={PREMIUM_COLORS.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const r = data?.resumen;
  const detalle: any[] = data?.detalle || [];
  const perdidas: any[] = data?.perdidas || [];
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

  return (
    <ResponsiveLayout active="ventas-beneficios">
      <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
        <View style={s.header}>
          <TouchableOpacity style={s.iconBtn} onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/dashboard"); }}>
            <Ionicons name="chevron-back" size={24} color={PREMIUM_COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={{ alignItems: "center" }}>
            <Text style={s.headerTitle}>Control Financiero Integrado</Text>
            <Text style={{ fontSize: 11, color: PREMIUM_COLORS.textMuted, fontWeight: "500", marginTop: 2 }}>Módulo de Ventas & Obra en Curso</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={s.tabContainer}>
          <View style={s.tabWrapper}>
            <TouchableOpacity
              style={[s.tabButton, activeTab === "ventas" && s.tabButtonActive]}
              onPress={() => setActiveTab("ventas")}
            >
              <Ionicons name="pie-chart" size={16} color={activeTab === "ventas" ? PREMIUM_COLORS.textPrimary : PREMIUM_COLORS.textSecondary} style={{ marginRight: 6 }} />
              <Text style={[s.tabText, activeTab === "ventas" && s.tabTextActive]}>Ventas y Rentabilidad</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tabButton, activeTab === "obra" && s.tabButtonActive]}
              onPress={() => setActiveTab("obra")}
            >
              <Ionicons name="trending-up" size={16} color={activeTab === "obra" ? PREMIUM_COLORS.textPrimary : PREMIUM_COLORS.textSecondary} style={{ marginRight: 6 }} />
              <Text style={[s.tabText, activeTab === "obra" && s.tabTextActive]}>Cálculo Obra en Curso</Text>
            </TouchableOpacity>
          </View>
        </View>

        {activeTab === "obra" ? <ObraEnCursoContent /> : (
        <ScrollView
          contentContainerStyle={[s.scroll, isWide && s.scrollWide]}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ gap: 10, marginBottom: 14 }}>
            {years.length > 0 && (
              <View style={s.yearStrip}>
                <Text style={s.stripLabel}>Año Fiscal:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  <TouchableOpacity
                    style={[s.yearChip, !selectedYear && s.yearChipActive]}
                    onPress={() => setSelectedYear("")}
                  >
                    <Text style={[s.yearChipTxt, !selectedYear && s.yearChipActiveTxt]}>Histórico Completo</Text>
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
                </ScrollView>
                {Platform.OS === "web" && (
                  <TouchableOpacity style={s.exportBtn} onPress={doExport} disabled={exporting}>
                    {exporting ? <ActivityIndicator size="small" color={PREMIUM_COLORS.accent} /> : <Ionicons name="cloud-download-outline" size={16} color={PREMIUM_COLORS.accent} />}
                    <Text style={s.exportBtnText}>{exporting ? "Generando..." : "Exportar Excel"}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {managers.length > 0 && (
              <View style={s.yearStrip}>
                <Text style={s.stripLabel}>Gestor:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  <TouchableOpacity style={[s.yearChip, !selectedManager && s.yearChipActive]} onPress={() => setSelectedManager("")}>
                    <Text style={[s.yearChipTxt, !selectedManager && s.yearChipActiveTxt]}>Todos los Gestores</Text>
                  </TouchableOpacity>
                  {managers.map((m: any) => (
                    <TouchableOpacity key={m.id} style={[s.yearChip, selectedManager === m.id && s.yearChipActive]} onPress={() => setSelectedManager(selectedManager === m.id ? "" : m.id)}>
                      <Text style={[s.yearChipTxt, selectedManager === m.id && s.yearChipActiveTxt]}>{m.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {r && (
            <View style={s.kpiRow}>
              <View style={s.kpiCard}>
                <Text style={s.kpiValue}>{fmtEur(r.total_venta_prevista)}</Text>
                <Text style={s.kpiLabel}>Volumen Venta Prevista</Text>
                <View style={[s.cardStatusLine, { backgroundColor: PREMIUM_COLORS.accent }]} />
              </View>
              <View style={s.kpiCard}>
                <Text style={s.kpiValue}>{fmtEur(r.total_coste_real)}</Text>
                <Text style={s.kpiLabel}>Coste Real Soportado</Text>
                <View style={[s.cardStatusLine, { backgroundColor: PREMIUM_COLORS.warning }]} />
              </View>
              <View style={[s.kpiCard, { backgroundColor: "rgba(16, 185, 129, 0.04)" }]}>
                <Text style={[s.kpiValue, { color: pctColor(r.beneficio_medio_real) }]}>{fmtPct(r.beneficio_medio_real)}</Text>
                <Text style={s.kpiLabel}>Margen Real Promedio</Text>
                <View style={[s.cardStatusLine, { backgroundColor: pctColor(r.beneficio_medio_real) }]} />
              </View>
              <View style={s.kpiCard}>
                <Text style={s.kpiValue}>{r.proyectos_con_datos}</Text>
                <Text style={s.kpiLabel}>{selectedYear ? `Proyectos Activos ${selectedYear}` : "Proyectos Globales"}</Text>
                <View style={[s.cardStatusLine, { backgroundColor: PREMIUM_COLORS.textMuted }]} />
              </View>
            </View>
          )}

          {comparativa.length > 1 && (
            <View style={s.chartCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <Text style={s.sectionTitle}>Evolución Estratégica Interanual</Text>
                <View style={s.chartLegend}>
                  <View style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: PREMIUM_COLORS.accent }]} />
                    <Text style={s.legendText}>Margen Bruto (€)</Text>
                  </View>
                  <View style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: PREMIUM_COLORS.textMuted }]} />
                    <Text style={s.legendText}>Facturación total</Text>
                  </View>
                </View>
              </View>
              {comparativa.map((c: any, i: number) => (
                <View key={c.year} style={{ marginTop: i === 0 ? 0 : 18 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={s.chartYear}>{c.year} <Text style={{ fontSize: 11, fontWeight: "500", color: PREMIUM_COLORS.textMuted }}>({c.proyectos} proy.)</Text></Text>
                    <Text style={[s.chartYearVal, { color: pctColor(c.margen_pct), fontWeight: "700" }]}>
                      {fmtEur(c.margen)} <Text style={{ color: PREMIUM_COLORS.textSecondary }}>({c.margen_pct}%)</Text>
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <View style={s.barBackground}>
                        <View style={{ height: 8, borderRadius: 4, backgroundColor: PREMIUM_COLORS.accent, width: `${Math.max(5, (Math.abs(c.margen) / maxMargen) * 100)}%` }} />
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={s.barBackground}>
                        <View style={{ height: 8, borderRadius: 4, backgroundColor: PREMIUM_COLORS.textSecondary, width: `${Math.max(5, (c.venta / maxVenta) * 100)}%`, opacity: 0.4 }} />
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {r && (
            <View style={s.summaryGrid}>
              <SummaryItem label="Margen Bruto Previsto" value={fmtEur(r.total_margen_previsto)} color={PREMIUM_COLORS.textPrimary} s={s} />
              <SummaryItem label="Margen Real Obtenido" value={fmtEur(r.total_margen_real)} color={pctColor(r.beneficio_medio_real)} s={s} />
              <SummaryItem label="Costes Totales Presupuestados" value={fmtEur(r.total_coste_previsto)} color={PREMIUM_COLORS.textSecondary} s={s} />
              <SummaryItem label="Desviación Presupuestaria" value={fmtEur(r.total_margen_real - r.total_margen_previsto)} color={r.total_margen_real >= r.total_margen_previsto ? PREMIUM_COLORS.success : PREMIUM_COLORS.error} s={s} />
            </View>
          )}

          <View style={{ gap: 10, marginTop: 18 }}>
            <View style={s.searchRow}>
              <Ionicons name="search-outline" size={18} color={PREMIUM_COLORS.textMuted} />
              <TextInput style={s.searchInput} value={searchText} onChangeText={setSearchText} placeholder="Filtrar por código de proyecto o cliente..." placeholderTextColor={PREMIUM_COLORS.textMuted} />
              {searchText !== "" && (
                <TouchableOpacity onPress={() => setSearchText("")}>
                  <Ionicons name="close-circle" size={18} color={PREMIUM_COLORS.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 12, color: PREMIUM_COLORS.textSecondary, fontWeight: "500" }}>Ajuste de Margen:</Text>
              <TouchableOpacity style={s.dropdown} onPress={() => setShowProfitPicker(!showProfitPicker)}>
                <Text style={s.dropdownText}>{profitFilter !== null ? `Rentabilidad ≤ ${profitFilter}%` : "Cualquier Rentabilidad"}</Text>
                <Ionicons name={showProfitPicker ? "chevron-up" : "chevron-down"} size={14} color={PREMIUM_COLORS.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={[s.filterChip, profitFilter === 0 && s.filterChipActive]} onPress={() => setProfitFilter(profitFilter === 0 ? null : 0)}>
                <Text style={[s.filterChipTxt, profitFilter === 0 && { color: "#fff" }]}>⚠️ Proyectos en Pérdidas</Text>
              </TouchableOpacity>
            </View>
            {showProfitPicker && (
              <View style={s.dropdownList}>
                <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                  <TouchableOpacity style={[s.dropdownItem, profitFilter === null && s.dropdownItemActive]} onPress={() => { setProfitFilter(null); setShowProfitPicker(false); }}>
                    <Text style={[s.dropdownItemTxt, profitFilter === null && { color: "#fff" }]}>Sin Restricción de Margen</Text>
                  </TouchableOpacity>
                  {[5, 10, 15, 20, 30, 40, 50].map((n) => (
                    <TouchableOpacity key={n} style={[s.dropdownItem, profitFilter === n && s.dropdownItemActive]} onPress={() => { setProfitFilter(n); setShowProfitPicker(false); }}>
                      <Text style={[s.dropdownItemTxt, profitFilter === n && { color: "#fff" }]}>Rentabilidad menor o igual a {n}%</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {filteredPerdidas.length > 0 && (
            <>
               <View style={[s.sectionHeader, { marginTop: 24 }]}>
                 <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PREMIUM_COLORS.error }} />
                 <Text style={[s.sectionTitle, { color: PREMIUM_COLORS.error }]}>Alertas Financieras: Margen por Debajo del Objetivo ({filteredPerdidas.length})</Text>
               </View>
               <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={true} nestedScrollEnabled={true}>
               {filteredPerdidas.slice(0, showAllPerdidas ? filteredPerdidas.length : 8).map((p: any) => (
                <View key={p.id} style={s.projectCardWrapper}>
                  <TouchableOpacity style={[s.projectRow, expandedProject === p.id && s.projectRowExpanded]} onPress={() => setExpandedProject(expandedProject === p.id ? null : p.id)}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.projectName} numberOfLines={1}>{p.materiales || "Código no asignado"} — {p.cliente || "Consumidor Final"}</Text>
                      <Text style={s.projectSub}>Gestión: <Text style={{ color: PREMIUM_COLORS.textPrimary }}>{p.gestor || "Sin asignar"}</Text> · {STATUS_LABELS[p.project_status] || p.project_status}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end", marginRight: 6 }}>
                      <Text style={[s.projectAmount, { color: PREMIUM_COLORS.error }]}>{fmtEur(p.desviacion_euros)}</Text>
                      <Text style={s.projectDelta}>Prev: {fmtEur(p.margen_previsto)} → <Text style={{ color: PREMIUM_COLORS.error }}>Real: {fmtEur(p.margen_real)}</Text></Text>
                    </View>
                    <Ionicons name={expandedProject === p.id ? "chevron-up" : "chevron-down"} size={16} color={PREMIUM_COLORS.textSecondary} />
                  </TouchableOpacity>
                  {expandedProject === p.id && (
                    <View style={s.desvioDetail}>
                      <View style={s.alertBadge}>
                        <Ionicons name="alert-circle" size={14} color={PREMIUM_COLORS.error} />
                        <Text style={s.desvioCause}>{causaDesviacion(p)}</Text>
                      </View>
                      <View style={s.detailGrid}>
                        <View style={s.detailCol}>
                          <Text style={s.desvioLabel}>Materiales</Text>
                          <Text style={s.desvioValue}>Previsto: {fmtEur(p.coste_prev_mat)}</Text>
                          <Text style={[s.desvioValue, { color: (p.desviacion_materiales || 0) > 0 ? PREMIUM_COLORS.error : PREMIUM_COLORS.success }]}>Incurrido: {fmtEur(p.coste_real_mat)}</Text>
                        </View>
                        <View style={s.detailCol}>
                          <Text style={s.desvioLabel}>Mano de Obra (MOD)</Text>
                          <Text style={s.desvioValue}>Previsto: {fmtEur(p.coste_prev_mo)}</Text>
                          <Text style={[s.desvioValue, { color: (p.desviacion_mo || 0) > 0 ? PREMIUM_COLORS.error : PREMIUM_COLORS.success }]}>Incurrido: {fmtEur(p.coste_real_mo)}</Text>
                        </View>
                      </View>
                      <View style={[s.detailGrid, { marginTop: 10, borderTopWidth: 1, borderColor: PREMIUM_COLORS.border, paddingTop: 10 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.desvioLabel}>Horas Previstas</Text>
                          <Text style={[s.desvioValue, { color: PREMIUM_COLORS.textPrimary }]}>{fmtHoras(p.horas_prev)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.desvioLabel}>Horas Reales Computadas</Text>
                          <Text style={[s.desvioValue, { color: p.horas_imputadas > p.horas_prev ? PREMIUM_COLORS.error : PREMIUM_COLORS.success, fontWeight: "700" }]}>{fmtHoras(p.horas_imputadas)}</Text>
                        </View>
                      </View>
                      <TouchableOpacity style={s.actionDetailBtn} onPress={() => router.push(`/material/${p.id}` as any)}>
                        <Text style={{ color: PREMIUM_COLORS.accent, fontWeight: "700", fontSize: 12 }}>Auditar analítica detallada del proyecto →</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
              </ScrollView>
              {filteredPerdidas.length > 8 && (
                <TouchableOpacity style={s.showMoreBtn} onPress={() => setShowAllPerdidas(!showAllPerdidas)}>
                  <Text style={s.showMoreText}>{showAllPerdidas ? "Contraer Lista" : `Ver todas las alertas (${filteredPerdidas.length - 8} más)`}</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          <View style={[s.sectionHeader, { marginTop: 24 }]}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PREMIUM_COLORS.accent }} />
            <Text style={[s.sectionTitle]}>Auditoría General de Proyectos {selectedYear ? `(${selectedYear})` : ""} ({filteredDetalle.length})</Text>
          </View>

          <View style={s.tableHeader}>
            <TouchableOpacity style={{ flex: 2 }} onPress={() => toggleSort("materiales")}>
              <Text style={s.th}>Proyecto / Cliente {sortArrow("materiales")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1.2 }} onPress={() => toggleSort("venta_total")}>
              <Text style={[s.th, { textAlign: "right" }]}>Venta Bruta {sortArrow("venta_total")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1.2 }} onPress={() => toggleSort("coste_real_total")}>
              <Text style={[s.th, { textAlign: "right" }]}>Coste Total {sortArrow("coste_real_total")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => toggleSort("margen_real")}>
              <Text style={[s.th, { textAlign: "right" }]}>Margen Neto {sortArrow("margen_real")}</Text>
            </TouchableOpacity>
          </View>

          {displayed.map((p: any) => {
            const desvColor = p.desviacion_euros >= 0 ? PREMIUM_COLORS.success : PREMIUM_COLORS.error;
            return (
              <TouchableOpacity key={p.id} style={s.tableRow} onPress={() => router.push(`/material/${p.id}` as any)}>
                <View style={{ flex: 2, paddingRight: 4 }}>
                  <Text style={s.cellName} numberOfLines={1}>{p.materiales || "—"}</Text>
                  <Text style={s.cellSub} numberOfLines={1}>{p.cliente || "No especificado"}</Text>
                </View>
                <Text style={[s.cell, { flex: 1.2, textAlign: "right", fontWeight: "500" }]}>{fmtEur(p.venta_total)}</Text>
                <Text style={[s.cell, { flex: 1.2, textAlign: "right", color: PREMIUM_COLORS.textSecondary }]}>{fmtEur(p.coste_real_total)}</Text>
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <Text style={[s.cell, { fontWeight: "700", color: desvColor }]}>{fmtEur(p.margen_real)}</Text>
                  <Text style={[s.cellSmall, { color: desvColor, fontWeight: "600" }]}>{fmtPct(p.ben_real)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {filteredDetalle.length > 10 && (
            <TouchableOpacity style={s.showMoreBtn} onPress={() => setShowAll(!showAll)}>
              <Text style={s.showMoreText}>{showAll ? "Ver Menos Proyectos" : `Expandir listado completo (${filteredDetalle.length - 10} más)`}</Text>
            </TouchableOpacity>
          )}

          {porGestor.length > 0 && !selectedManager && (
            <View style={[s.chartCard, { marginTop: 24 }]}>
              <Text style={[s.sectionTitle, { marginBottom: 14 }]}>Rentabilidad Consolidada por Gestor</Text>
              <View style={{ gap: 8 }}>
                {porGestor.map((g: any) => (
                  <TouchableOpacity key={g.gestor_id} style={s.managerRow} onPress={() => setSelectedManager(g.gestor_id === "sin_gestor" ? "" : g.gestor_id)}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.managerName} numberOfLines={1}>{g.gestor_name}</Text>
                      <Text style={s.managerMeta}>{g.proyectos} Contratos en cartera</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[s.managerValue, { color: pctColor(g.margen_pct) }]}>{fmtEur(g.margen_real)}</Text>
                      <Text style={[s.managerPct, { color: pctColor(g.margen_pct) }]}>{fmtPct(g.margen_pct)} Rend.</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={PREMIUM_COLORS.textMuted} style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {data?.alertas?.length > 0 && (
            <View style={{ gap: 8, marginTop: 24 }}>
              <Text style={s.sectionTitle}>Alertas del Asistente del Sistema</Text>
              {data.alertas.map((a: any, i: number) => {
                const isHoras = a.tipo === "horas_excedidas";
                return (
                  <TouchableOpacity key={`alerta-${i}`} style={[s.alertaCard, isHoras ? s.alertaRed : s.alertaAmber]} onPress={() => router.push(`/material/${a.proyecto_id}` as any)} activeOpacity={0.8}>
                    <View style={[s.alertaIcon, { backgroundColor: isHoras ? "rgba(239, 68, 68, 0.15)" : "rgba(245, 158, 11, 0.15)" }]}>
                      <Ionicons name={isHoras ? "time-outline" : "trending-down-outline"} size={18} color={isHoras ? PREMIUM_COLORS.error : PREMIUM_COLORS.warning} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.alertaTitle} numberOfLines={1}>{isHoras ? `Desborde de horas al ${a.pct}% — ${a.materiales || "Proyecto"}` : `Margen crítico (${a.margen_pct}%) — ${a.materiales || "Proyecto"}`}</Text>
                      <Text style={s.alertaSub}>{isHoras ? `${a.horas_imp}h consumidas de un presupuesto de ${a.horas_prev}h` : `Rendimiento de preventa devaluado por debajo del mínimo de seguridad.`}</Text>
                    </View>
                    <Ionicons name="arrow-forward-outline" size={16} color={PREMIUM_COLORS.textSecondary} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <View style={{ height: 60 }} />
        </ScrollView>
        )}
      </SafeAreaView>
    </ResponsiveLayout>
  );
}

function ObraEnCursoContent() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchObra, setSearchObra] = useState("");
  const [activeFilter, setActiveFilter] = useState("todos");
  const s = useThemedStyles(useS);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const base = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/+$/, "");
        const res = await fetch(`${base}/api/dashboard/obra-en-curso`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e: any) {} finally { setLoading(false); }
    })();
  }, []);

  if (loading) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}><ActivityIndicator color={PREMIUM_COLORS.accent} size="large" /></View>;
  }

  const proyectosAll: any[] = data?.proyectos || [];
  const searchLower = searchObra.toLowerCase();

  let proyectos = searchObra
    ? proyectosAll.filter((p: any) => {
        return (p.materiales || "").toLowerCase().includes(searchLower) || (p.cliente || "").toLowerCase().includes(searchLower);
      })
    : proyectosAll;

  if (activeFilter === "holgado") proyectos = proyectos.filter((p: any) => p.pct_avance <= 30);
  else if (activeFilter === "en_curso") proyectos = proyectos.filter((p: any) => p.pct_avance > 30 && p.pct_avance <= 70);
  else if (activeFilter === "limite") proyectos = proyectos.filter((p: any) => p.pct_avance > 70 && p.pct_avance < 100);
  else if (activeFilter === "excedido") proyectos = proyectos.filter((p: any) => p.pct_avance >= 100);

  const totalProy = proyectosAll.length;
  const holgado = proyectosAll.filter((p: any) => p.pct_avance <= 30).length;
  const enCurso = proyectosAll.filter((p: any) => p.pct_avance > 30 && p.pct_avance <= 70).length;
  const alLimite = proyectosAll.filter((p: any) => p.pct_avance > 70 && p.pct_avance < 100).length;
  const excedido = proyectosAll.filter((p: any) => p.pct_avance >= 100).length;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
      <View style={{ maxWidth: 1100, alignSelf: "center", width: "100%" }}>

      <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ color: PREMIUM_COLORS.textPrimary, fontSize: 24, fontWeight: "800", letterSpacing: -0.5 }}>Análisis Técnico: Obra en Curso (OEC)</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: PREMIUM_COLORS.successGlow, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: PREMIUM_COLORS.success }} />
            <Text style={{ color: PREMIUM_COLORS.success, fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>Real-Time</Text>
          </View>
        </View>
        <Text style={{ color: PREMIUM_COLORS.textSecondary, fontSize: 13 }}>
          Evaluación analítica de la producción ininterrumpida basada en costes reales e ingresos reconocidos.
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 24, paddingBottom: 14, flexWrap: "wrap" }}>
        {[
          { label: "Cartera Activa Comercial", value: String(totalProy), icon: "folder-open-outline", color: PREMIUM_COLORS.accent },
          { label: "Volumen Neto OEC", value: fmtEur(data?.total_obra_en_curso), icon: "analytics-outline", color: "#8B5CF6" },
          { label: "Coste Incurrido Acumulado", value: fmtEur(data?.total_coste_incurrido), icon: "calculator-outline", color: PREMIUM_COLORS.warning },
          { label: "Proyectos en Ejecución", value: String(enCurso), icon: "construct-outline", color: PREMIUM_COLORS.success },
        ].map((kpi, i) => (
          <View key={i} style={s.kpiCardContainer}>
            <View style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: kpi.color + "15", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
              <Ionicons name={kpi.icon as any} size={16} color={kpi.color} />
            </View>
            <Text style={{ fontSize: 22, fontWeight: "800", color: PREMIUM_COLORS.textPrimary, letterSpacing: -0.5 }}>{kpi.value}</Text>
            <Text style={{ fontSize: 11, color: PREMIUM_COLORS.textSecondary, fontWeight: "500", marginTop: 2 }}>{kpi.label}</Text>
          </View>
        ))}
      </View>

      <View style={{ paddingHorizontal: 24, paddingVertical: 12, marginHorizontal: 24, backgroundColor: PREMIUM_COLORS.surfaceCard, borderRadius: 12, borderWidth: 1, borderColor: PREMIUM_COLORS.border }}>
        <Text style={{ fontSize: 12, fontWeight: "700", color: PREMIUM_COLORS.textPrimary, marginBottom: 8 }}>Distribución del Grado de Avance de la Cartera</Text>
        <View style={{ height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: "hidden", flexDirection: "row" }}>
          {totalProy > 0 && (
            <>
              {holgado > 0 && <View style={{ flex: holgado, backgroundColor: PREMIUM_COLORS.success }} />}
              {enCurso > 0 && <View style={{ flex: enCurso, backgroundColor: PREMIUM_COLORS.accent }} />}
              {alLimite > 0 && <View style={{ flex: alLimite, backgroundColor: PREMIUM_COLORS.warning }} />}
              {excedido > 0 && <View style={{ flex: excedido, backgroundColor: PREMIUM_COLORS.error }} />}
            </>
          )}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
          <View style={s.distributionItem}><View style={[s.distDot, { backgroundColor: PREMIUM_COLORS.success }]} /><Text style={s.distText}>Inicial ({holgado})</Text></View>
          <View style={s.distributionItem}><View style={[s.distDot, { backgroundColor: PREMIUM_COLORS.accent }]} /><Text style={s.distText}>En Curso ({enCurso})</Text></View>
          <View style={s.distributionItem}><View style={[s.distDot, { backgroundColor: PREMIUM_COLORS.warning }]} /><Text style={s.distText}>Maduro ({alLimite})</Text></View>
          <View style={s.distributionItem}><View style={[s.distDot, { backgroundColor: PREMIUM_COLORS.error }]} /><Text style={s.distText}>Desbordado ({excedido})</Text></View>
        </View>
      </View>

      <View style={{ paddingHorizontal: 24, paddingTop: 16, gap: 10 }}>
        <View style={s.searchRow}>
          <Ionicons name="search-outline" size={16} color={PREMIUM_COLORS.textMuted} />
          <TextInput style={s.searchInput} value={searchObra} onChangeText={setSearchObra} placeholder="Buscar por identificador de obra o cliente..." placeholderTextColor={PREMIUM_COLORS.textMuted} />
          {searchObra ? <TouchableOpacity onPress={() => setSearchObra("")}><Ionicons name="close-circle" size={16} color={PREMIUM_COLORS.textSecondary} /></TouchableOpacity> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {[
            { key: "todos", label: "Cartera Completa", v: totalProy },
            { key: "holgado", label: `Fase Temprana (≤30%)`, v: holgado },
            { key: "en_curso", label: `Fase Activa (30-70%)`, v: enCurso },
            { key: "limite", label: `Fase Crítica (>70%)`, v: alLimite },
            { key: "excedido", label: `Presupuesto Superado`, v: excedido },
          ].map((c) => (
            <TouchableOpacity
              key={c.key}
              onPress={() => setActiveFilter(c.key === activeFilter ? "todos" : c.key)}
              style={[s.filterBadge, activeFilter === c.key && s.filterBadgeActive]}
            >
              <Text style={[s.filterBadgeText, activeFilter === c.key && { color: PREMIUM_COLORS.textPrimary }]}>
                {c.label} <Text style={{ opacity: 0.6 }}>({c.v})</Text>
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: PREMIUM_COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
          Desglose de Producción en Curso ({proyectos.length})
        </Text>
        <View style={s.tableHeaderOEC}>
          <Text style={[s.thOEC, { flex: 1.8 }]}>CÓDIGO DE PROYECTO</Text>
          <Text style={[s.thOEC, { flex: 0.9, textAlign: "center" }]}>DESVIACIÓN AVANCE</Text>
          <Text style={[s.thOEC, { flex: 0.8, textAlign: "right" }]}>MOD INVERTIDA</Text>
          <Text style={[s.thOEC, { flex: 0.8, textAlign: "right" }]}>Bº RECONOCIDO</Text>
          <Text style={[s.thOEC, { flex: 0.8, textAlign: "right" }]}>FACTURADO</Text>
          <Text style={[s.thOEC, { flex: 1, textAlign: "right", color: PREMIUM_COLORS.accent }]}>VALOR NETO OEC</Text>
        </View>
        {proyectos.map((p: any) => {
          const pct = p.pct_avance;
          let statusColor = PREMIUM_COLORS.success;
          if (pct >= 100) statusColor = PREMIUM_COLORS.error;
          else if (pct > 70) statusColor = PREMIUM_COLORS.warning;
          else if (pct > 30) statusColor = PREMIUM_COLORS.accent;

          return (
            <TouchableOpacity key={p.id} onPress={() => router.push(`/material/${p.id}` as any)} style={s.tableRowOEC}>
              <View style={{ flex: 1.8, paddingRight: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: PREMIUM_COLORS.textPrimary }} numberOfLines={1}>{p.materiales || "—"}</Text>
                <Text style={{ fontSize: 11, color: PREMIUM_COLORS.textMuted, marginTop: 1 }} numberOfLines={1}>{p.cliente || "Cliente corporativo"}</Text>
              </View>
              <View style={{ flex: 0.9, paddingHorizontal: 6, justifyContent: "center" }}>
                <View style={s.miniProgressBarBg}>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: statusColor, width: `${Math.min(pct, 100)}%` }} />
                </View>
                <Text style={{ fontSize: 11, color: statusColor, fontWeight: "700", marginTop: 3, textAlign: "center" }}>{pct}%</Text>
              </View>
              <Text style={s.cellOECText}>{fmtEur(p.mod_real)}</Text>
              <Text style={[s.cellOECText, { color: PREMIUM_COLORS.textSecondary }]}>{fmtEur(p.beneficio_avance)}</Text>
              <Text style={[s.cellOECText, { color: PREMIUM_COLORS.textMuted }]}>{fmtEur(p.ingreso_facturado || 0)}</Text>
              <Text style={[s.cellOECText, { flex: 1, fontWeight: "700", color: p.obra_en_curso >= 0 ? PREMIUM_COLORS.textPrimary : PREMIUM_COLORS.error }]}>{fmtEur(p.obra_en_curso)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      </View>
    </ScrollView>
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
  root: { flex: 1, backgroundColor: PREMIUM_COLORS.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: PREMIUM_COLORS.bg, borderBottomWidth: 1, borderBottomColor: PREMIUM_COLORS.border,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: COLORS.bg },
  headerTitle: { fontSize: 16, color: PREMIUM_COLORS.textPrimary, fontWeight: "850", letterSpacing: -0.3 },

  tabContainer: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: PREMIUM_COLORS.bg },
  tabWrapper: { flexDirection: "row", backgroundColor: COLORS.readonly, borderRadius: 10, padding: 4, borderWidth: 1, borderColor: PREMIUM_COLORS.border },
  tabButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 7 },
  tabButtonActive: { backgroundColor: COLORS.border, borderWidth: 1, borderColor: PREMIUM_COLORS.border },
  tabText: { fontSize: 13, color: PREMIUM_COLORS.textSecondary, fontWeight: "600" },
  tabTextActive: { color: PREMIUM_COLORS.textPrimary, fontWeight: "750" },

  scroll: { padding: 20, gap: 14 },
  scrollWide: { maxWidth: 1100, alignSelf: "center", width: "100%" },

  yearStrip: { flexDirection: "row", alignItems: "center", gap: 10 },
  stripLabel: { fontSize: 12, color: PREMIUM_COLORS.textMuted, fontWeight: "700", textTransform: "uppercase", width: 75 },
  yearChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: PREMIUM_COLORS.border },
  yearChipActive: { backgroundColor: PREMIUM_COLORS.accentGlow, borderColor: PREMIUM_COLORS.accent },
  yearChipTxt: { fontSize: 12, color: PREMIUM_COLORS.textSecondary, fontWeight: "600" },
  yearChipActiveTxt: { color: PREMIUM_COLORS.textPrimary, fontWeight: "700" },

  kpiRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  kpiCard: { flex: 1, minWidth: 180, backgroundColor: PREMIUM_COLORS.surfaceCard, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: PREMIUM_COLORS.border, position: "relative", overflow: "hidden" },
  kpiValue: { fontSize: 22, color: PREMIUM_COLORS.textPrimary, fontWeight: "850", letterSpacing: -0.5 },
  kpiLabel: { fontSize: 11, color: PREMIUM_COLORS.textSecondary, marginTop: 4, fontWeight: "500" },
  cardStatusLine: { position: "absolute", bottom: 0, left: 0, right: 0, height: 3 },
  kpiCardContainer: { flex: 1, minWidth: 200, borderRadius: 12, padding: 16, backgroundColor: PREMIUM_COLORS.surfaceCard, borderWidth: 1, borderColor: PREMIUM_COLORS.border },

  chartCard: { backgroundColor: PREMIUM_COLORS.surfaceCard, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: PREMIUM_COLORS.border },
  chartLegend: { flexDirection: "row", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: PREMIUM_COLORS.textSecondary, fontWeight: "500" },
  chartYear: { fontSize: 13, color: PREMIUM_COLORS.textPrimary, fontWeight: "700" },
  chartYearVal: { fontSize: 13 },
  barBackground: { height: 8, backgroundColor: COLORS.readonly, borderRadius: 4, overflow: "hidden" },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 14, color: PREMIUM_COLORS.textPrimary, fontWeight: "800", letterSpacing: -0.2 },

  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryItem: { flex: 1, minWidth: 200, backgroundColor: PREMIUM_COLORS.surfaceCard, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: PREMIUM_COLORS.border },
  summaryLabel: { fontSize: 11, color: PREMIUM_COLORS.textSecondary, fontWeight: "500" },
  summaryValue: { fontSize: 16, fontWeight: "750", marginTop: 4 },

  projectCardWrapper: { backgroundColor: PREMIUM_COLORS.surfaceCard, borderRadius: 10, borderWidth: 1, borderColor: PREMIUM_COLORS.border, marginBottom: 8, overflow: "hidden" },
  projectRow: { flexDirection: "row", alignItems: "center", padding: 14 },
  projectRowExpanded: { backgroundColor: COLORS.bg, borderBottomWidth: 1, borderBottomColor: PREMIUM_COLORS.border },
  projectName: { fontSize: 13, color: PREMIUM_COLORS.textPrimary, fontWeight: "700" },
  projectSub: { fontSize: 11, color: PREMIUM_COLORS.textMuted, marginTop: 2 },
  projectAmount: { fontSize: 14, fontWeight: "850" },
  projectDelta: { fontSize: 11, color: PREMIUM_COLORS.textMuted, marginTop: 2 },

  desvioDetail: { padding: 14, backgroundColor: COLORS.bg, borderRadius: 8 },
  alertBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: PREMIUM_COLORS.errorGlow, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: "flex-start", marginBottom: 12 },
  desvioCause: { fontSize: 11, color: PREMIUM_COLORS.error, fontWeight: "700" },
  detailGrid: { flexDirection: "row", gap: 14 },
  detailCol: { flex: 1 },
  desvioLabel: { fontSize: 10, color: PREMIUM_COLORS.textMuted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  desvioValue: { fontSize: 12, color: PREMIUM_COLORS.textSecondary, marginTop: 1 },
  actionDetailBtn: { marginTop: 12, alignSelf: "flex-end", paddingVertical: 4 },

  tableHeader: { flexDirection: "row", gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: PREMIUM_COLORS.textMuted, opacity: 0.7 },
  th: { fontSize: 10, color: PREMIUM_COLORS.textSecondary, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  tableRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: PREMIUM_COLORS.border },
  cellName: { fontSize: 13, color: PREMIUM_COLORS.textPrimary, fontWeight: "650" },
  cellSub: { fontSize: 11, color: PREMIUM_COLORS.textMuted, marginTop: 1 },
  cell: { fontSize: 13, color: PREMIUM_COLORS.textPrimary },
  cellSmall: { fontSize: 11, marginTop: 1 },

  showMoreBtn: { alignItems: "center", paddingVertical: 12, backgroundColor: COLORS.bg, borderRadius: 8, borderWidth: 1, borderColor: PREMIUM_COLORS.border, marginTop: 4 },
  showMoreText: { fontSize: 12, color: PREMIUM_COLORS.accent, fontWeight: "700" },

  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.bg, borderRadius: 10, borderWidth: 1, borderColor: PREMIUM_COLORS.border, paddingHorizontal: 12, height: 42 },
  searchInput: { flex: 1, fontSize: 13, color: PREMIUM_COLORS.textPrimary, height: 42 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: PREMIUM_COLORS.border },
  filterChipActive: { backgroundColor: PREMIUM_COLORS.errorGlow, borderColor: PREMIUM_COLORS.error },
  filterChipTxt: { fontSize: 11, color: PREMIUM_COLORS.textSecondary, fontWeight: "600" },

  dropdown: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.bg, borderRadius: 6, borderWidth: 1, borderColor: PREMIUM_COLORS.border, paddingHorizontal: 10, height: 32, minWidth: 150 },
  dropdownText: { fontSize: 11, color: PREMIUM_COLORS.textSecondary, fontWeight: "600" },
  dropdownList: { backgroundColor: PREMIUM_COLORS.bg, borderRadius: 8, borderWidth: 1, borderColor: PREMIUM_COLORS.border, marginTop: 4, overflow: "hidden" },
  dropdownItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: PREMIUM_COLORS.border },
  dropdownItemActive: { backgroundColor: PREMIUM_COLORS.accent },
  dropdownItemTxt: { fontSize: 12, color: PREMIUM_COLORS.textSecondary, fontWeight: "500" },

  exportBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: PREMIUM_COLORS.accentGlow, borderWidth: 1, borderColor: PREMIUM_COLORS.accent, marginLeft: "auto" },
  exportBtnText: { fontSize: 12, color: PREMIUM_COLORS.textPrimary, fontWeight: "700" },

  managerRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.bg, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: PREMIUM_COLORS.border },
  managerName: { fontSize: 13, color: PREMIUM_COLORS.textPrimary, fontWeight: "700" },
  managerMeta: { fontSize: 11, color: PREMIUM_COLORS.textMuted, marginTop: 2 },
  managerValue: { fontSize: 13, fontWeight: "750" },
  managerPct: { fontSize: 11, fontWeight: "600", marginTop: 1 },

  alertaCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 10, padding: 14, borderWidth: 1 },
  alertaRed: { backgroundColor: PREMIUM_COLORS.errorGlow, borderColor: "rgba(239,68,68,0.2)" },
  alertaAmber: { backgroundColor: "rgba(245,158,11,0.05)", borderColor: "rgba(245,158,11,0.2)" },
  alertaIcon: { width: 32, height: 32, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  alertaTitle: { fontSize: 13, color: PREMIUM_COLORS.textPrimary, fontWeight: "700" },
  alertaSub: { fontSize: 11, color: PREMIUM_COLORS.textSecondary, marginTop: 2 },

  distributionItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  distDot: { width: 6, height: 6, borderRadius: 3 },
  distText: { fontSize: 11, color: PREMIUM_COLORS.textSecondary, fontWeight: "500" },
  filterBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, marginRight: 6, borderColor: PREMIUM_COLORS.border, backgroundColor: COLORS.bg },
  filterBadgeActive: { borderColor: PREMIUM_COLORS.accent, backgroundColor: PREMIUM_COLORS.accentGlow },
  filterBadgeText: { fontSize: 12, fontWeight: "600", color: PREMIUM_COLORS.textSecondary },
  tableHeaderOEC: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: PREMIUM_COLORS.textSecondary, marginBottom: 4, opacity: 0.8 },
  thOEC: { fontSize: 10, fontWeight: "700", color: PREMIUM_COLORS.textSecondary, letterSpacing: 0.5 },
  tableRowOEC: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: PREMIUM_COLORS.border },
  miniProgressBarBg: { height: 4, width: "100%", backgroundColor: COLORS.readonly, borderRadius: 2, overflow: "hidden" },
  cellOECText: { flex: 0.8, fontSize: 12, fontWeight: "500", color: PREMIUM_COLORS.textPrimary, textAlign: "right" },
});
