import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Alert, Platform,
  LayoutAnimation, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, clearToken, COLORS } from "../src/api";
import { usePermissions } from "../src/permissions";
import ResponsiveLayout from "../src/ResponsiveLayout";
import { useBreakpoint } from "../src/useBreakpoint";
import { useThemedStyles } from "../src/theme";
import { ios } from "../src/ui/iosTheme";

const STATUS_COLORS: Record<string, string> = {
  pendiente: COLORS.pendingText || "#F59E0B",
  planificado: COLORS.pillBlueText || "#3B82F6",
  a_facturar: COLORS.primary || "#8B5CF6",
  facturado: COLORS.syncedText || "#10B981",
  terminado: COLORS.pillPurpleText || "#6366F1",
  bloqueado: COLORS.pillOrangeText || "#EF4444",
  anulado: COLORS.textSecondary || "#6B7280",
  en_curso: COLORS.pillBlueText || "#3B82F6",
  completado: COLORS.syncedText || "#10B981",
  cancelado: COLORS.errorText || "#EF4444",
};

const STATUS_BADGES: Record<string, { bg: string; fg: string; label: string }> = {
  a_facturar: { bg: COLORS.pillBlueBg || "#EFF6FF", fg: COLORS.primary, label: "Facturar" },
  planificado: { bg: COLORS.pillBlueBg || "#EFF6FF", fg: COLORS.pillBlueText, label: "Planif." },
  facturado: { bg: COLORS.syncedBg || "#ECFDF5", fg: COLORS.syncedText, label: "Facturado" },
  terminado: { bg: COLORS.pillPurpleBg || "#F5F3FF", fg: COLORS.pillPurpleText, label: "Terminado" },
  bloqueado: { bg: COLORS.pillOrangeBg || "#FEF2F2", fg: COLORS.pillOrangeText, label: "Bloqueado" },
  anulado: { bg: COLORS.statusAnuladoBg || "#F3F4F6", fg: COLORS.textSecondary, label: "Anulado" },
};

export default function Materiales() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const params = useLocalSearchParams<{ project_status?: string; year?: string; month?: string }>();
  const { isWide } = useBreakpoint();

  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [stats, setStats] = useState<{ total: number; pending: number; synced: number } | null>(null);
  const [me, setMe] = useState<any>(null);
  const [managers, setManagers] = useState<any[]>([]);
  const [showManagerFilter, setShowManagerFilter] = useState(false);
  const [managerFilterIds, setManagerFilterIds] = useState<string[]>([]);
  const [statusFilterIds, setStatusFilterIds] = useState<string[]>(
    params.project_status ? params.project_status.split(",") : []
  );
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [managerStats, setManagerStats] = useState<any[]>([]);
  const [yearFilter, setYearFilter] = useState(params.year || "todos");
  const [monthFilter, setMonthFilter] = useState(params.month || "");

  const PROJECT_STATUSES = useMemo(() => [
    { key: "pendiente", label: "Pendiente", color: STATUS_COLORS.pendiente },
    { key: "planificado", label: "Planificado", color: STATUS_COLORS.planificado },
    { key: "a_facturar", label: "A facturar", color: STATUS_COLORS.a_facturar },
    { key: "facturado", label: "Facturado", color: STATUS_COLORS.facturado },
    { key: "terminado", label: "Terminado", color: STATUS_COLORS.terminado },
    { key: "bloqueado", label: "Bloqueado", color: STATUS_COLORS.bloqueado },
    { key: "anulado", label: "Anulado", color: STATUS_COLORS.anulado },
  ], []);

  useEffect(() => {
    if (!params.project_status && !params.year && !params.month) {
      AsyncStorage.multiGet(["mat_manager_filter", "mat_status_filter"]).then((stores) => {
        const managersVal = stores[0][1];
        const statusVal = stores[1][1];
        if (managersVal) try { setManagerFilterIds(JSON.parse(managersVal)); } catch {}
        if (statusVal) try { setStatusFilterIds(JSON.parse(statusVal)); } catch {}
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("mat_manager_filter", JSON.stringify(managerFilterIds)).catch(() => {});
  }, [managerFilterIds]);

  useEffect(() => {
    AsyncStorage.setItem("mat_status_filter", JSON.stringify(statusFilterIds)).catch(() => {});
  }, [statusFilterIds]);

  const load = useCallback(async () => {
    try {
      const managerId = managerFilterIds.length > 0 && !managerFilterIds.includes("__none__")
        ? managerFilterIds.join(",") : undefined;
      const unassigned = managerFilterIds.includes("__none__");
      const statusParam = statusFilterIds.length > 0 ? statusFilterIds.join(",") : undefined;

      const [list, st, u] = await Promise.all([
        api.listMateriales(q || undefined, pendingOnly, managerId, unassigned, statusParam, yearFilter, monthFilter),
        api.stats(),
        me ? Promise.resolve(me) : api.me(),
      ]);
      setItems(list);
      setStats(st);
      if (!me) setMe(u);
    } catch (e: any) {
      if (/401|Invalid|expired/i.test(e.message)) {
        await clearToken();
        routerRef.current.replace("/login");
      } else {
        Alert.alert("Error", e.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [q, pendingOnly, managerFilterIds, statusFilterIds, yearFilter, monthFilter, me]);

  useFocusEffect(useCallback(() => {
    load();
    api.listManagers().then(setManagers).catch(() => {});
    api.statsByManager(yearFilter).then(setManagerStats).catch(() => {});
  }, [load, yearFilter]));

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const toggleManagerFilter = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setManagerFilterIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleStatusFilter = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStatusFilterIds((prev) => prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]);
  };

  const isAdmin = me?.role === "admin";
  const { has } = usePermissions();
  const esEditorCompleto = has("proyectos.edit");
  const logout = async () => { await clearToken(); router.replace("/login"); };

  const renderItem = (item: any) => {
    const pending = item.sync_status === "pending";
    const projectStatus = item.project_status || "pendiente";
    const statusColor = STATUS_COLORS[projectStatus] || COLORS.pendingText;
    const badgeConfig = esEditorCompleto && item.project_status && item.project_status !== "pendiente" ? STATUS_BADGES[item.project_status] : null;

    const initials = (item.gestor || item.manager_name || "?")
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    return (
      <TouchableOpacity
        testID={`material-item-${item.id}`}
        style={styles.card}
        onPress={() => router.push(`/material/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={[styles.cardBar, { backgroundColor: statusColor }]} />
        <View style={styles.cardBody}>
          <View style={[styles.cardAvatar, { backgroundColor: statusColor + "15" }]}>
            <Text style={[styles.cardAvatarText, { color: statusColor }]}>{initials || "?"}</Text>
          </View>

          <View style={styles.cardInfo}>
            <View style={styles.cardTopRow}>
              <Text style={styles.cardCode} numberOfLines={1}>{item.materiales || "—"}</Text>
              <Text style={styles.cardClient} numberOfLines={1}>{item.cliente || "Sin Cliente"}</Text>
            </View>

            {item.ubicacion ? (
              <View style={styles.cardAddressRow}>
                <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} />
                <Text style={styles.cardAddress} numberOfLines={1}>{item.ubicacion}</Text>
              </View>
            ) : null}

            <View style={styles.cardMetaRow}>
              <View style={styles.cardMetaTag}>
                <Ionicons name="time-outline" size={10} color={COLORS.textSecondary} />
                <Text style={styles.cardMetaText}>{item.horas_prev || "0"}h prev.</Text>
              </View>
              {item.horas_imputadas > 0 ? (
                <View style={[styles.cardMetaTag, { backgroundColor: COLORS.primarySoft + "30" }]}>
                  <Text style={[styles.cardMetaText, { color: COLORS.primary, fontWeight: "700" }]}>
                    {item.horas_imputadas}h imp.
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.cardRight}>
            <View style={styles.badgeContainer}>
              {badgeConfig && (
                <View style={[styles.cardBadge, { backgroundColor: badgeConfig.bg }]}>
                  <Text style={[styles.cardBadgeText, { color: badgeConfig.fg }]}>{badgeConfig.label}</Text>
                </View>
              )}
              <View style={[styles.cardBadge, { backgroundColor: pending ? "#FEF3C7" : "#D1FAE5" }]}>
                <Text style={[styles.cardBadgeText, { color: pending ? "#D97706" : "#059669" }]}>
                  {pending ? "PEND" : "SINC"}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textDisabled || "#9CA3AF"} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderStatsSidebar = () => {
    if (managerStats.length === 0) return null;
    const totalProyectos = managerStats.reduce((s, m) => s + m.total, 0);

    return (
      <View style={styles.sidebarContainer}>
        <View style={styles.sidebarHeader}>
          <Text style={styles.sidebarTitle}>Filtros Avanzados</Text>
        </View>

        <View style={styles.selectWrapper}>
          <select
            value={yearFilter}
            onChange={(e: any) => setYearFilter(e.target.value)}
            style={{
              width: "100%", fontSize: 13, fontWeight: "600" as any, color: "#334155",
              backgroundColor: "#F1F5F9", borderWidth: 0, borderRadius: 10, padding: 10,
              outline: "none", fontFamily: "inherit", cursor: "pointer",
            }}
          >
            <option value="todos">Todos los años</option>
            {Array.from({ length: new Date().getFullYear() - 2021 }, (_, i) => 2022 + i).map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        </View>

        <TouchableOpacity
          style={styles.totalKpiCard}
          onPress={() => { setManagerFilterIds([]); setStatusFilterIds([]); }}
          activeOpacity={0.8}
        >
          <Text style={styles.totalKpiLabel}>Proyectos Totales</Text>
          <Text style={styles.totalKpiNumber}>{totalProyectos}</Text>
        </TouchableOpacity>

        <View style={styles.managerSection}>
          <Text style={styles.managerSectionTitle}>Por Responsable</Text>
          {managerStats.map((mgr) => {
            const isSelected = managerFilterIds.includes(mgr.id);
            return (
              <TouchableOpacity
                key={mgr.id}
                style={[styles.managerRow, isSelected && styles.managerRowActive]}
                onPress={() => toggleManagerFilter(mgr.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.managerDot, { backgroundColor: mgr.color || COLORS.primary }]} />
                <Text style={[styles.managerName, isSelected && styles.textBold]} numberOfLines={1}>
                  {mgr.name.split(" ")[0]}
                </Text>
                <View style={styles.managerCountBadge}>
                  <Text style={styles.managerTotal}>{mgr.total}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <ResponsiveLayout active="proyectos" isAdmin={isAdmin} onLogout={logout} userName={me?.name}>
      <SafeAreaView style={styles.root} edges={isWide ? [] : ["top"]}>
        <View style={styles.container}>
          {isWide && (
            <ScrollView style={styles.leftPanel} showsVerticalScrollIndicator={false}>
              {renderStatsSidebar()}
            </ScrollView>
          )}

          <View style={styles.mainContent}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.headerTitle}>Módulo Proyectos</Text>
                <Text style={styles.headerSubtitle}>Gestión operativa y control de horas</Text>
              </View>
            </View>

            {stats && (
              <View style={styles.kpiStrip}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiNumber}>{stats.total}</Text>
                  <Text style={styles.kpiLabel}>Globales</Text>
                </View>
                <TouchableOpacity
                  style={[styles.kpiCard, pendingOnly && styles.kpiCardActive]}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setPendingOnly(!pendingOnly);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.kpiNumber, pendingOnly && { color: "#FFF" }]}>{stats.pending}</Text>
                  <Text style={[styles.kpiLabel, pendingOnly && { color: "#FFF" }]}>Por Sincronizar</Text>
                </TouchableOpacity>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiNumber}>{stats.synced}</Text>
                  <Text style={styles.kpiLabel}>En la Nube</Text>
                </View>
              </View>
            )}

            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
                <TextInput
                  testID="input-search"
                  style={styles.searchInput}
                  value={q}
                  onChangeText={setQ}
                  placeholder="Buscar cliente, código, localización..."
                  placeholderTextColor="#9CA3AF"
                />
                {q.length > 0 && (
                  <TouchableOpacity onPress={() => setQ("")}>
                    <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[styles.actionChip, managerFilterIds.length > 0 && styles.actionChipActive]}
                onPress={() => { setShowManagerFilter(!showManagerFilter); setShowStatusFilter(false); }}
              >
                <Ionicons name="people-outline" size={18} color={managerFilterIds.length > 0 ? "#FFF" : COLORS.primary} />
              </TouchableOpacity>

              {esEditorCompleto && (
                <TouchableOpacity
                  style={[styles.actionChip, statusFilterIds.length > 0 && styles.actionChipActive]}
                  onPress={() => { setShowStatusFilter(!showStatusFilter); setShowManagerFilter(false); }}
                >
                  <Ionicons name="flag-outline" size={18} color={statusFilterIds.length > 0 ? "#FFF" : COLORS.primary} />
                </TouchableOpacity>
              )}
            </View>

            {showManagerFilter && (
              <View style={styles.filterChipsRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
                  <TouchableOpacity
                    style={[styles.filterChip, managerFilterIds.includes("__none__") && styles.filterChipActive]}
                    onPress={() => toggleManagerFilter("__none__")}
                  >
                    <Text style={[styles.filterChipText, managerFilterIds.includes("__none__") && styles.filterChipTextActive]}>Sin gestor</Text>
                  </TouchableOpacity>
                  {managers.map((mgr) => {
                    const on = managerFilterIds.includes(mgr.id);
                    return (
                      <TouchableOpacity
                        key={mgr.id}
                        style={[styles.filterChip, on && styles.filterChipActive]}
                        onPress={() => toggleManagerFilter(mgr.id)}
                      >
                        <Text style={[styles.filterChipText, on && styles.filterChipTextActive]}>{mgr.name || mgr.email}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {showStatusFilter && (
              <View style={styles.filterChipsRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
                  {PROJECT_STATUSES.map((st) => {
                    const on = statusFilterIds.includes(st.key);
                    return (
                      <TouchableOpacity
                        key={st.key}
                        style={[styles.filterChip, on && { backgroundColor: st.color + "20", borderColor: st.color }]}
                        onPress={() => toggleStatusFilter(st.key)}
                      >
                        <Text style={[styles.filterChipText, on && { color: st.color, fontWeight: "700" }]}>{st.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {loading ? (
              <View style={styles.centerBox}>
                <ActivityIndicator color={COLORS.primary} size="large" />
              </View>
            ) : items.length === 0 ? (
              <View style={styles.centerBox}>
                <Ionicons name="cube-outline" size={44} color="#D1D5DB" />
                <Text style={styles.noResultsText}>No se encontraron proyectos activos</Text>
              </View>
            ) : (
              <ScrollView
                testID="materiales-list"
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />
                }
              >
                {items.map((item) => (
                  <View key={item.id}>{renderItem(item)}</View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </SafeAreaView>
    </ResponsiveLayout>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },
  container: { flex: 1, flexDirection: "row" },
  leftPanel: { flex: 0.25, maxWidth: 300, backgroundColor: "#FFFFFF", borderRightWidth: 1, borderRightColor: "#E2E8F0" },
  sidebarContainer: { padding: 20, gap: 16 },
  sidebarHeader: { marginBottom: 4 },
  sidebarTitle: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  selectWrapper: { borderRadius: 10, overflow: "hidden" },
  totalKpiCard: { backgroundColor: "#F1F5F9", borderRadius: 12, padding: 16, gap: 4 },
  totalKpiLabel: { fontSize: 11, fontWeight: "600", color: "#64748B", textTransform: "uppercase" },
  totalKpiNumber: { fontSize: 28, fontWeight: "800", color: "#0F172A" },
  managerSection: { gap: 6, marginTop: 10 },
  managerSectionTitle: { fontSize: 12, fontWeight: "700", color: "#475569", textTransform: "uppercase", marginBottom: 4 },
  managerRow: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 10, gap: 10, backgroundColor: "#F8FAFC" },
  managerRowActive: { backgroundColor: "#E2E8F0" },
  managerDot: { width: 8, height: 8, borderRadius: 4 },
  managerName: { flex: 1, fontSize: 13, fontWeight: "500", color: "#334155" },
  managerCountBadge: { backgroundColor: "#FFF", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  managerTotal: { fontSize: 11, fontWeight: "700", color: "#64748B" },
  textBold: { fontWeight: "700", color: "#0F172A" },
  mainContent: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 },
  headerLeft: {},
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#0F172A" },
  headerSubtitle: { fontSize: 13, color: "#64748B", marginTop: 2 },
  kpiStrip: { flexDirection: "row", gap: 12, paddingHorizontal: 24, marginBottom: 16 },
  kpiCard: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", elevation: 1 },
  kpiCardActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  kpiNumber: { fontSize: 22, fontWeight: "800", color: "#1E293B" },
  kpiLabel: { fontSize: 12, fontWeight: "500", color: "#64748B", marginTop: 2 },
  searchRow: { flexDirection: "row", gap: 8, paddingHorizontal: 24, marginBottom: 12, alignItems: "center" },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF", borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0", paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontSize: 14, color: "#1E293B", ...Platform.select({ web: { outlineStyle: "none" } as any }) },
  actionChip: { height: 44, width: 44, borderRadius: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center", justifyContent: "center" },
  actionChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipsRow: { paddingHorizontal: 24, marginBottom: 12 },
  filterChips: { flexDirection: "row", gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0" },
  filterChipActive: { backgroundColor: "#E0F2FE", borderColor: "#0284C7" },
  filterChipText: { fontSize: 12, fontWeight: "500", color: "#475569" },
  filterChipTextActive: { color: "#0369A1", fontWeight: "700" },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  noResultsText: { color: "#64748B", fontSize: 14, marginTop: 10, fontWeight: "500" },
  listContent: { paddingHorizontal: 24, gap: 10, paddingBottom: 40 },
  card: { flexDirection: "row", backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", overflow: "hidden", elevation: 1 },
  cardBar: { width: 5 },
  cardBody: { flex: 1, flexDirection: "row", padding: 14, alignItems: "center", gap: 12 },
  cardAvatar: { width: 40, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  cardAvatarText: { fontSize: 13, fontWeight: "700" },
  cardInfo: { flex: 1, gap: 4 },
  cardTopRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  cardCode: { fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }), fontSize: 13, fontWeight: "700", color: "#0F172A" },
  cardClient: { fontSize: 13, fontWeight: "500", color: "#475569" },
  cardAddressRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardAddress: { fontSize: 12, color: "#64748B" },
  cardMetaRow: { flexDirection: "row", gap: 6, marginTop: 2 },
  cardMetaTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F1F5F9", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  cardMetaText: { fontSize: 11, color: "#475569", fontWeight: "500" },
  cardRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  badgeContainer: { alignItems: "flex-end", gap: 4 },
  cardBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  cardBadgeText: { fontSize: 10, fontWeight: "700" },
});
