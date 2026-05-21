import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
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
import { useThemedStyles, useTheme } from "../src/theme";

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
  // Manager filter
  const [managers, setManagers] = useState<any[]>([]);
  const [showManagerFilter, setShowManagerFilter] = useState(false);
  const [managerFilterIds, setManagerFilterIds] = useState<string[]>([]);
  const [statusFilterIds, setStatusFilterIds] = useState<string[]>(
    params.project_status ? params.project_status.split(",") : []
  );
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [managerStats, setManagerStats] = useState<any[]>([]);
  const [showManagerPanel, setShowManagerPanel] = useState(false);
  const [yearFilter, setYearFilter] = useState(params.year || "todos");
  const [monthFilter, setMonthFilter] = useState(params.month || "");

  const PROJECT_STATUSES = [
    { key: "pendiente", label: "Pendiente", color: "#F59E0B" },
    { key: "planificado", label: "Planificado", color: "#3B82F6" },
    { key: "a_facturar", label: "A facturar", color: "#8B5CF6" },
    { key: "facturado", label: "Facturado", color: "#10B981" },
    { key: "terminado", label: "Terminado", color: "#6366F1" },
    { key: "bloqueado", label: "Bloqueado", color: "#EF4444" },
    { key: "anulado", label: "Anulado", color: "#6B7280" },
  ];

  // Persist manager and status filters (only if no URL params passed)
  useEffect(() => {
    if (!params.project_status && !params.year && !params.month) {
      AsyncStorage.getItem("mat_manager_filter").then((v) => {
        if (v) try { setManagerFilterIds(JSON.parse(v)); } catch {}
      }).catch(() => {});
      AsyncStorage.getItem("mat_status_filter").then((v) => {
        if (v) try { setStatusFilterIds(JSON.parse(v)); } catch {}
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
    const t = setTimeout(load, 300);
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

  const clearManagerFilter = () => setManagerFilterIds([]);

  const logout = async () => {
    await clearToken();
    router.replace("/login");
  };

  const isAdmin = me?.role === "admin";

  const { has } = usePermissions();
  const esEditorCompleto = has("proyectos.edit");
  const s = useThemedStyles(useS);
  const { theme } = useTheme();
  const darkText = theme === "dark" ? "#E2E8F0" : COLORS.navy;
  const darkTextSecondary = theme === "dark" ? "#CBD5E1" : COLORS.textSecondary;

  const renderItem = ({ item }: any) => {
    const pending = item.sync_status === "pending";
    const projectStatus = item.project_status || "pendiente";
    const statusBarColors: Record<string, string> = {
      pendiente: "#F59E0B",
      planificado: "#3B82F6",
      a_facturar: "#8B5CF6",
      facturado: "#10B981",
      terminado: "#6366F1",
      bloqueado: "#EF4444",
      anulado: "#6B7280",
    };
    const statusBarColor = esEditorCompleto ? (statusBarColors[projectStatus] || "#F59E0B") : "#F59E0B";
    const statusBadgeStyles: Record<string, { bg: string; fg: string; label: string }> = {
      a_facturar: { bg: COLORS.statusFacturarBg, fg: COLORS.statusFacturarFg, label: "Facturar" },
      planificado: { bg: COLORS.statusPlanifBg, fg: COLORS.statusPlanifFg, label: "Planif." },
      facturado: { bg: COLORS.statusFacturadoBg, fg: COLORS.statusFacturadoFg, label: "Facturado" },
      terminado: { bg: COLORS.statusTerminadoBg, fg: COLORS.statusTerminadoFg, label: "Terminado" },
      bloqueado: { bg: COLORS.statusBloqueadoBg, fg: COLORS.statusBloqueadoFg, label: "Bloqueado" },
      anulado: { bg: COLORS.statusAnuladoBg, fg: COLORS.statusAnuladoFg, label: "Anulado" },
    };
    const st = esEditorCompleto && item.project_status && item.project_status !== "pendiente" ? statusBadgeStyles[item.project_status] : null;
    const horasPrev = parseFloat(item.horas_prev) || 0;
    const horasImp = parseFloat(item.horas_imputadas) || 0;
    return (
      <TouchableOpacity
        testID={`material-item-${item.id}`}
        style={[s.card, { borderLeftWidth: 3, borderLeftColor: statusBarColor }]}
        onPress={() => router.push(`/material/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={s.cardHeader}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={[s.code, { color: darkText }]} numberOfLines={1}>{item.materiales || "—"}</Text>
            <Text style={[s.cliente, { color: darkText }]} numberOfLines={1}>{item.cliente || ""}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 3, alignItems: "center" }}>
            {st && (
              <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
                <Text style={[s.statusBadgeText, { color: st.fg }]}>{st.label}</Text>
              </View>
            )}
            <View style={[s.badge, pending ? s.badgePending : s.badgeSynced]}>
              <Ionicons name={pending ? "time-outline" : "checkmark-circle"} size={9} color={pending ? COLORS.pendingText : COLORS.syncedText} />
              <Text style={[s.badgeText, { color: pending ? COLORS.pendingText : COLORS.syncedText }]}>
                {pending ? "PEND" : "SINC"}
              </Text>
            </View>
          </View>
        </View>
        <View style={s.infoGrid}>
           <View style={s.infoCell}>
            <Text style={[s.infoValue, { color: darkText }]}>{item.horas_prev || "—"}h</Text>
            {item.horas_imputadas > 0 && (
              <Text style={[s.infoValue, { fontSize: 8, color: horasImp > horasPrev ? COLORS.errorText : COLORS.primary }]}>
                +{item.horas_imputadas}
              </Text>
            )}
          </View>
          <View style={s.infoCell}>
            <Text style={[s.infoValue, { color: darkText }]} numberOfLines={1}>{item.comercial || "—"}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={[s.infoValue, { color: darkText }]} numberOfLines={1}>{item.manager_name || item.gestor || "—"}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={[s.infoValue, { color: darkText }]} numberOfLines={1}>{item.tecnicos?.join(", ") || item.tecnico || "—"}</Text>
          </View>
        </View>
        {item.ubicacion ? (
          <View style={s.metaItem}>
            <Ionicons name="location" size={10} color={COLORS.textSecondary} />
            <Text style={[s.metaText, { color: darkText }]} numberOfLines={1}>{item.ubicacion}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <ResponsiveLayout active="proyectos" isAdmin={isAdmin} onLogout={logout} userName={me?.name}>
      <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      <View style={{ flex: 1, flexDirection: "row" }}>
        {/* Desktop left panel: dashboard por gestor */}
        {isWide && managerStats.length > 0 && (
          <ScrollView style={{ flex: 1, borderRightWidth: 1, borderRightColor: COLORS.border, backgroundColor: COLORS.surface }}>
            <View style={{ padding: 10 }}>
              <Text style={{ fontSize: 9.5, fontWeight: "900", color: COLORS.textDisabled, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>
                POR GESTOR
              </Text>
              {/* Year filter */}
              {Platform.OS === "web" ? (
                <select
                  value={yearFilter}
                  onChange={(e: any) => setYearFilter(e.target.value)}
                  style={{
                  width: "100%", fontSize: 12, fontWeight: "600", color: darkText,
                  backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
                    borderRadius: 7, paddingVertical: 6, paddingHorizontal: 8, marginBottom: 8,
                    outline: "none",
                  } as any}
                >
                  <option value="todos">Todos los años</option>
                  {Array.from({ length: new Date().getFullYear() - 2021 }, (_, i) => 2022 + i).map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              ) : (
                <TouchableOpacity
                  style={{
                    flexDirection: "row", alignItems: "center", backgroundColor: COLORS.bg,
                    borderWidth: 1, borderColor: COLORS.border, borderRadius: 7,
                    paddingVertical: 8, paddingHorizontal: 10, marginBottom: 8, gap: 6,
                  }}
                  onPress={() => {
                    const years = ["todos", ...Array.from({ length: new Date().getFullYear() - 2021 }, (_, i) => String(2022 + i))];
                    const idx = years.indexOf(yearFilter);
                    setYearFilter(years[(idx + 1) % years.length]);
                  }}
                >
                  <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={{ fontSize: 12, fontWeight: "600", color: darkText, flex: 1 }}>
                    {yearFilter === "todos" ? "Todos los años" : yearFilter}
                  </Text>
                  <Ionicons name="chevron-down" size={12} color={COLORS.textDisabled} />
                </TouchableOpacity>
              )}
              {/* Total row */}
              {(() => {
                const totalProyectos = managerStats.reduce((s, m) => s + m.total, 0);
                const totalByStatus: Record<string, number> = {};
                managerStats.forEach((m) => {
                  Object.entries(m.by_status as Record<string, { count: number }>).forEach(([st, info]) => {
                    totalByStatus[st] = (totalByStatus[st] || 0) + info.count;
                  });
                });
                const STATUS_LABELS: Record<string, string> = {
                  pendiente: "Pend.", planificado: "Plan.", a_facturar: "Fact.",
                  facturado: "Fact.", terminado: "Term.", bloqueado: "Bloq.", anulado: "Anul.",
                };
                const STATUS_COLORS: Record<string, string> = {
                  pendiente: "#F59E0B", planificado: "#3B82F6", a_facturar: "#8B5CF6",
                  facturado: "#10B981", terminado: "#6366F1", bloqueado: "#EF4444", anulado: "#6B7280",
                };
                return (
                  <TouchableOpacity
                    style={{
                      backgroundColor: COLORS.primarySoft, borderRadius: 7,
                      padding: 6, marginBottom: 8,
                    }}
                    onPress={() => { setManagerFilterIds([]); setStatusFilterIds([]); }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 }}>
                      <Ionicons name="layers" size={12} color={COLORS.primary} />
                      <Text style={{ fontSize: 11.5, fontWeight: "900", color: COLORS.primary, flex: 1 }}>TOTAL</Text>
                      <Text style={{ fontSize: 11, fontWeight: "900", color: COLORS.primary }}>{totalProyectos}</Text>
                    </View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 2 }}>
                      {Object.entries(totalByStatus).sort(([a], [b]) => a.localeCompare(b)).map(([st, count]) => {
                        const color = STATUS_COLORS[st] || "#999";
                        const active = statusFilterIds.includes(st);
                        return (
                        <TouchableOpacity
                          key={st}
                          style={{
                            backgroundColor: active ? color : (color + "18"),
                            borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1.5,
                          }}
                          onPress={() => {
                            setStatusFilterIds((p) => p.includes(st) ? p.filter((x) => x !== st) : [...p, st]);
                          }}
                        >
                          <Text style={{ fontSize: 9, fontWeight: "700", color: active ? "#fff" : color }}>
                            {STATUS_LABELS[st] || st} {count}
                          </Text>
                        </TouchableOpacity>
                        );
                      })}
                    </View>
                  </TouchableOpacity>
                );
              })()}
              {managerStats.map((mgr) => (
                <TouchableOpacity
                  key={mgr.id}
                  style={{
                    backgroundColor: managerFilterIds.includes(mgr.id) ? COLORS.bg : "transparent",
                    borderRadius: 7,
                    borderWidth: managerFilterIds.includes(mgr.id) ? 1.5 : 0,
                    borderColor: mgr.color,
                    padding: 6,
                    marginBottom: 4,
                  }}
                  onPress={() => {
                    setManagerFilterIds((p) => p.includes(mgr.id) ? p.filter((x) => x !== mgr.id) : [...p, mgr.id]);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: mgr.color }} />
                    <Text style={{ fontSize: 11.5, fontWeight: "800", color: darkText, flex: 1 }} numberOfLines={1}>
                      {mgr.name.split(" ")[0]}
                    </Text>
                    <Text style={{ fontSize: 10, fontWeight: "900", color: COLORS.textDisabled }}>{mgr.total}</Text>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 2, marginTop: 4 }}>
                    {Object.entries(mgr.by_status as Record<string, { count: number; label: string; color: string }>).map(([st, info]) => {
                      const active = managerFilterIds.includes(mgr.id) && statusFilterIds.includes(st);
                      return (
                        <TouchableOpacity
                          key={st}
                          style={{
                            backgroundColor: active ? info.color : (info.color + "15"),
                            borderRadius: 4,
                            paddingHorizontal: 5,
                            paddingVertical: 1.5,
                          }}
                          onPress={() => {
                            setStatusFilterIds((p) => p.includes(st) ? p.filter((x) => x !== st) : [...p, st]);
                          }}
                        >
                          <Text style={{ fontSize: 9, fontWeight: "700", color: active ? "#fff" : info.color }}>
                            {info.label} <Text style={{ fontWeight: "900" }}>{info.count}</Text>
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}
        {/* Main content area */}
        <View style={{ flex: 3 }}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: darkText }]}>Proyectos</Text>
          <Text style={[s.headerSubHint, { color: darkTextSecondary }]}>
            {(managerFilterIds.length > 0 || statusFilterIds.length > 0)
              ? `${items.length} proyecto${items.length !== 1 ? "s" : ""} · ${items.reduce((sum: number, it: any) => { const v = parseFloat(it.horas_prev); return isNaN(v) ? sum : sum + v; }, 0)}h totales`
              : "Base sincronizada con OneDrive"}
          </Text>
        </View>
        {!isWide && (
          <View style={s.headerBtns}>
            <TouchableOpacity testID="btn-logout" style={s.iconBtn} onPress={logout}>
              <Ionicons name="log-out-outline" size={18} color={COLORS.navy} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Elegant stats strip — moved from home to keep it contextual. */}
      {stats && (
        <View style={s.statsStrip} testID="stats-strip">
          <View style={s.statCard}>
            <Ionicons name="folder" size={14} color={COLORS.primary} />
            <Text style={[s.statVal, { color: darkText }]}>{stats.total}</Text>
            <Text style={[s.statLbl, { color: darkTextSecondary }]}>Total</Text>
          </View>
          <TouchableOpacity
            style={[s.statCard, pendingOnly && { borderColor: "#F59E0B", backgroundColor: "#F59E0B1A" }]}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setPendingOnly(!pendingOnly);
            }}
            testID="stat-pending"
            activeOpacity={0.75}
          >
            <Ionicons name="time" size={14} color="#F59E0B" />
            <Text style={[s.statVal, { color: darkText }]}>{stats.pending}</Text>
            <Text style={[s.statLbl, { color: darkTextSecondary }]}>Pendientes</Text>
          </TouchableOpacity>
          <View style={s.statCard}>
            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
            <Text style={[s.statVal, { color: darkText }]}>{stats.synced}</Text>
            <Text style={[s.statLbl, { color: darkTextSecondary }]}>Sincronizados</Text>
          </View>
        </View>
      )}

      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Ionicons name="search" size={16} color={COLORS.textSecondary} />
          <TextInput
            testID="input-search"
            style={[s.searchInput, { color: darkText }]}
            value={q}
            onChangeText={setQ}
            placeholder="Buscar cliente, proyecto, ubicación..."
            placeholderTextColor={COLORS.textDisabled}
          />
          {q.length > 0 && (
            <TouchableOpacity onPress={() => setQ("")}>
              <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          testID="btn-filter-pending"
          style={[s.filterBtn, pendingOnly && s.filterBtnActive]}
          onPress={() => setPendingOnly(!pendingOnly)}
        >
          <Ionicons name="time" size={16} color={pendingOnly ? "#fff" : COLORS.navy} />
        </TouchableOpacity>
        <TouchableOpacity
          testID="btn-filter-manager"
          style={[s.filterBtn, managerFilterIds.length > 0 && s.filterBtnActive]}
          onPress={() => { setShowManagerFilter((v) => !v); setShowStatusFilter(false); }}
        >
          <Ionicons name="people" size={16} color={managerFilterIds.length > 0 ? "#fff" : COLORS.navy} />
        </TouchableOpacity>
        {esEditorCompleto && (
        <TouchableOpacity
          testID="btn-filter-status"
          style={[s.filterBtn, statusFilterIds.length > 0 && s.filterBtnActive]}
          onPress={() => { setShowStatusFilter((v) => !v); setShowManagerFilter(false); }}
        >
          <Ionicons name="flag" size={16} color={statusFilterIds.length > 0 ? "#fff" : COLORS.navy} />
        </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.filterBtn, { backgroundColor: COLORS.syncedBg, borderColor: COLORS.syncedText, borderWidth: 1 }]}
          onPress={async () => {
            try { await api.exportProjectsExcel(); }
            catch (e: any) { Alert.alert("Error", "No se pudo exportar"); }
          }}
        >
          <Ionicons name="download-outline" size={14} color={COLORS.syncedText} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.filterBtn, { backgroundColor: COLORS.pillBlueBg, borderColor: COLORS.primary, borderWidth: 1 }]}
          onPress={() => router.push("/mapa")}
        >
          <Ionicons name="map-outline" size={14} color={COLORS.primary} />
        </TouchableOpacity>
        {(managerFilterIds.length > 0 || statusFilterIds.length > 0) && (
          <TouchableOpacity
            style={[s.filterBtn, { backgroundColor: COLORS.errorBg }]}
            onPress={() => { clearManagerFilter(); setStatusFilterIds([]); }}
          >
            <Ionicons name="close" size={14} color={COLORS.errorText} />
          </TouchableOpacity>
        )}
      </View>

      {showManagerFilter && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 8, gap: 6 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <TouchableOpacity
              style={[s.managerChip, managerFilterIds.includes("__none__") && { backgroundColor: COLORS.pillPurpleBg, borderColor: COLORS.pillPurpleText }]}
              onPress={() => toggleManagerFilter("__none__")}
            >
              <Text style={[s.managerChipTxt, managerFilterIds.includes("__none__") && { color: COLORS.primary }]}>⚡ Sin gestor</Text>
            </TouchableOpacity>
            {managers.map((mgr) => {
              const on = managerFilterIds.includes(mgr.id);
              return (
                <TouchableOpacity
                  key={mgr.id}
                  style={[s.managerChip, on && { backgroundColor: COLORS.pillBlueBg, borderColor: COLORS.primary }]}
                  onPress={() => toggleManagerFilter(mgr.id)}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: (mgr as any).color || COLORS.primary }} />
                  <Text style={[s.managerChipTxt, on && { color: COLORS.primary, fontWeight: "800" }]} numberOfLines={1}>{mgr.name || mgr.email}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {showStatusFilter && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 8, gap: 6 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {PROJECT_STATUSES.map((st) => {
              const on = statusFilterIds.includes(st.key);
              return (
                <TouchableOpacity
                  key={st.key}
                  style={[s.managerChip, on && { backgroundColor: st.color + "22", borderColor: st.color }]}
                  onPress={() => toggleStatusFilter(st.key)}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: st.color }} />
                  <Text style={[s.managerChipTxt, on && { color: st.color, fontWeight: "800" }]}>{st.label}</Text>
                  {on && <Ionicons name="checkmark" size={14} color={st.color} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {loading ? (
        <View style={s.centerBox}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : items.length === 0 ? (
        <View style={s.centerBox}>
          <Ionicons name="cube-outline" size={48} color={COLORS.textDisabled} />
          <Text style={[s.emptyText, { color: darkTextSecondary }]}>Sin resultados</Text>
        </View>
      ) : (
        <FlatList
          testID="materiales-list"
          data={items}
          renderItem={renderItem}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: 8, gap: 4, paddingBottom: 40, maxWidth: 900, alignSelf: "center", width: "100%" }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={COLORS.primary}
            />
          }
          initialNumToRender={20}
          windowSize={10}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews
        />
      )}
        </View>  {/* close main content */}
      </View>  {/* close row */}

      {/* Mobile: collapsible manager panel */}
      {!isWide && managerStats.length > 0 && (
        <View style={{ paddingHorizontal: 12 }}>
          {/* Year filter for mobile */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: darkTextSecondary }}>Año:</Text>
            {Platform.OS === "web" ? (
              <select
                value={yearFilter}
                onChange={(e: any) => setYearFilter(e.target.value)}
                style={{
                  fontSize: 12, fontWeight: "600", color: darkText,
                  backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
                  borderRadius: 7, paddingVertical: 5, paddingHorizontal: 8,
                  outline: "none",
                } as any}
              >
                <option value="todos">Todos</option>
                {Array.from({ length: new Date().getFullYear() - 2021 }, (_, i) => 2022 + i).map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            ) : (
              <TouchableOpacity
                style={{
                  flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface,
                  borderWidth: 1, borderColor: COLORS.border, borderRadius: 7,
                  paddingVertical: 6, paddingHorizontal: 10,
                }}
                onPress={() => {
                  const years = ["todos", ...Array.from({ length: new Date().getFullYear() - 2021 }, (_, i) => String(2022 + i))];
                  const idx = years.indexOf(yearFilter);
                  setYearFilter(years[(idx + 1) % years.length]);
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: darkText }}>
                  {yearFilter === "todos" ? "Todos" : yearFilter}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 }}
            onPress={() => setShowManagerPanel(!showManagerPanel)}
          >
            <Ionicons name={showManagerPanel ? "chevron-down" : "chevron-forward"} size={16} color={COLORS.primary} />
            <Text style={{ fontSize: 13, fontWeight: "800", color: COLORS.primary, letterSpacing: 0.5, textTransform: "uppercase" }}>
              Por gestor
            </Text>
          </TouchableOpacity>
          {showManagerPanel && (
            <ScrollView horizontal style={{ maxHeight: 200, marginBottom: 8 }}>
              <View style={{ flexDirection: "row", gap: 8, paddingBottom: 4 }}>
                {managerStats.map((mgr) => (
                  <TouchableOpacity
                    key={mgr.id}
                    style={{
                      backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1,
                      borderColor: managerFilterIds.includes(mgr.id) ? mgr.color : COLORS.border,
                      padding: 10, minWidth: 180,
                    }}
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setManagerFilterIds((p) => p.includes(mgr.id) ? p.filter((x) => x !== mgr.id) : [...p, mgr.id]);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: mgr.color }} />
                      <Text style={{ fontSize: 13, fontWeight: "800", color: darkText }} numberOfLines={1}>
                        {mgr.name.split(" ")[0]}
                      </Text>
                      <Text style={{ fontSize: 11, color: COLORS.textDisabled }}>{mgr.total}</Text>
                    </View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                      {Object.entries(mgr.by_status as Record<string, { count: number; label: string; color: string }>).map(([st, info]) => (
                        <TouchableOpacity
                          key={st}
                          style={{
                            backgroundColor: info.color + "20", borderRadius: 6,
                            paddingHorizontal: 6, paddingVertical: 2,
                            borderWidth: statusFilterIds.includes(st) ? 1.5 : 0,
                            borderColor: info.color,
                          }}
                          onPress={() => {
                            setStatusFilterIds((p) => p.includes(st) ? p.filter((x) => x !== st) : [...p, st]);
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: "700", color: info.color }}>
                            {info.label} {info.count}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      )}

      </SafeAreaView>
    </ResponsiveLayout>
  );
}

const useS = () =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.bg },
    header: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingHorizontal: 10, paddingTop: 2, paddingBottom: 4, backgroundColor: COLORS.surface,
      borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    headerTitle: { fontSize: 18, fontWeight: "900", color: COLORS.text, letterSpacing: -0.5 },
    headerSubHint: { fontSize: 10, color: COLORS.textSecondary, fontWeight: "600" },
    statsStrip: {
      flexDirection: "row", gap: 4, paddingHorizontal: 10, paddingTop: 2, paddingBottom: 4,
    },
    statCard: {
      flex: 1, alignItems: "center", gap: 0,
      paddingVertical: 4, paddingHorizontal: 2,
      backgroundColor: COLORS.surface, borderRadius: 6,
      borderWidth: 1, borderColor: COLORS.border,
    },
    statVal: { fontSize: 14, fontWeight: "900", color: COLORS.text, letterSpacing: -0.3, lineHeight: 16 },
    statLbl: { fontSize: 8, fontWeight: "800", color: COLORS.textSecondary, letterSpacing: 0.3, textTransform: "uppercase" },
    headerBtns: { flexDirection: "row", gap: 8 },
    iconBtn: {
      width: 32, height: 32, borderRadius: 6, backgroundColor: COLORS.bg,
      alignItems: "center", justifyContent: "center",
    },
    centerBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
    emptyText: { color: COLORS.textSecondary, fontSize: 15 },
    searchRow: {
      flexDirection: "row", gap: 4, paddingHorizontal: 10, paddingVertical: 4,
      backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    searchBox: {
      flex: 1, flexDirection: "row", alignItems: "center", gap: 4,
      backgroundColor: COLORS.bg, borderRadius: 6, paddingHorizontal: 8, height: 32,
    },
    searchInput: { flex: 1, fontSize: 13, color: COLORS.text },
    filterBtn: {
      width: 32, height: 32, borderRadius: 6, backgroundColor: COLORS.bg,
      alignItems: "center", justifyContent: "center",
    },
    filterBtnActive: { backgroundColor: COLORS.primary },
    card: {
      backgroundColor: COLORS.surface, padding: 6, borderRadius: 8,
      borderWidth: 1, borderColor: COLORS.border, gap: 2,
    },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    code: { fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }), fontSize: 11, fontWeight: "700", color: COLORS.navy, letterSpacing: 0.3 },
    cliente: { fontSize: 11, fontWeight: "600", color: COLORS.textSecondary, flexShrink: 1 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 2 },
    metaText: { fontSize: 10, color: COLORS.textSecondary, fontWeight: "500" },
    infoGrid: { flexDirection: "row", marginTop: 1, gap: 2 },
    infoCell: {
      flex: 1, backgroundColor: COLORS.bg, borderRadius: 3,
      paddingVertical: 2, paddingHorizontal: 2, alignItems: "center",
    },
    infoValue: { fontSize: 9, color: COLORS.text, fontWeight: "700" },
    statusBadge: {
      flexDirection: "row", alignItems: "center", gap: 2,
      paddingHorizontal: 3, paddingVertical: 1, borderRadius: 2,
    },
    statusBadgeText: { fontSize: 7, fontWeight: "800", letterSpacing: 0.1 },
    badge: {
      flexDirection: "row", alignItems: "center", gap: 2,
      paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3,
    },
    badgeSynced: { backgroundColor: COLORS.syncedBg },
    badgePending: { backgroundColor: COLORS.pendingBg },
    badgeText: { fontSize: 8, fontWeight: "800", letterSpacing: 0.2 },
    managerChip: {
      flexDirection: "row", alignItems: "center", gap: 3,
      paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5,
      backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    },
    managerChipTxt: { fontSize: 11, fontWeight: "600", color: COLORS.textSecondary },
  });
