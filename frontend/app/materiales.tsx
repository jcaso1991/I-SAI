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
import { ios } from "../src/ui/iosTheme";

const STATUS_COLORS: Record<string, string> = {
  pendiente: "#F59E0B",
  planificado: "#06B6D4",
  a_facturar: "#3B82F6",
  facturado: "#10B981",
  terminado: "#8B5CF6",
  bloqueado: "#F97316",
  anulado: "#64748B",
  en_curso: "#06B6D4",
  completado: "#22C55E",
  cancelado: "#DC2626",
};

const STATUS_BADGES: Record<string, { bg: string; fg: string; label: string }> = {
  a_facturar: { bg: "rgba(59,130,246,0.15)", fg: "#3B82F6", label: "Facturar" },
  planificado: { bg: "rgba(6,182,212,0.15)", fg: "#06B6D4", label: "Planif." },
  facturado: { bg: "rgba(16,185,129,0.15)", fg: "#10B981", label: "Facturado" },
  terminado: { bg: "rgba(139,92,246,0.15)", fg: "#8B5CF6", label: "Terminado" },
  bloqueado: { bg: "rgba(249,115,22,0.15)", fg: "#F97316", label: "Bloqueado" },
  anulado: { bg: "rgba(100,116,139,0.15)", fg: "#64748B", label: "Anulado" },
};

const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pend.", planificado: "Plan.", a_facturar: "Fact.",
  facturado: "Fact.", terminado: "Term.", bloqueado: "Bloq.", anulado: "Anul.",
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
  const [showManagerPanel, setShowManagerPanel] = useState(false);
  const [yearFilter, setYearFilter] = useState(params.year || "todos");
  const [monthFilter, setMonthFilter] = useState(params.month || "");

  const s = useThemedStyles(useS);
  const { theme } = useTheme();

  const PROJECT_STATUSES = [
    { key: "pendiente", label: "Pendiente", color: STATUS_COLORS.pendiente },
    { key: "planificado", label: "Planificado", color: STATUS_COLORS.planificado },
    { key: "a_facturar", label: "A facturar", color: STATUS_COLORS.a_facturar },
    { key: "facturado", label: "Facturado", color: STATUS_COLORS.facturado },
    { key: "terminado", label: "Terminado", color: STATUS_COLORS.terminado },
    { key: "bloqueado", label: "Bloqueado", color: STATUS_COLORS.bloqueado },
    { key: "anulado", label: "Anulado", color: STATUS_COLORS.anulado },
    { key: "en_curso", label: "En curso", color: STATUS_COLORS.en_curso },
    { key: "completado", label: "Completado", color: STATUS_COLORS.completado },
    { key: "cancelado", label: "Cancelado", color: STATUS_COLORS.cancelado },
  ];

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

  const renderItem = ({ item }: any) => {
    const pending = item.sync_status === "pending";
    const projectStatus = item.project_status || "pendiente";
    const statusColor = STATUS_COLORS[projectStatus] || COLORS.pendingText;
    const st = esEditorCompleto && item.project_status && item.project_status !== "pendiente" ? STATUS_BADGES[item.project_status] : null;
    const horasPrev = parseFloat(item.horas_prev) || 0;
    const horasImp = parseFloat(item.horas_imputadas) || 0;
    const initials = (item.gestor || item.manager_name || "?")
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    return (
      <TouchableOpacity
        testID={`material-item-${item.id}`}
        style={s.card}
        onPress={() => router.push(`/material/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={[s.cardBar, { backgroundColor: statusColor }]} />
        <View style={s.cardBody}>
          <View style={s.cardAvatar}>
            <Text style={s.cardAvatarText}>{initials || "?"}</Text>
          </View>
          <View style={s.cardInfo}>
            <View style={s.cardTopRow}>
              <Text style={s.cardCode} numberOfLines={1}>{item.materiales || "—"}</Text>
              <Text style={s.cardClient} numberOfLines={1}>{item.cliente || ""}</Text>
            </View>
            {item.ubicacion ? (
              <View style={s.cardAddressRow}>
                <Ionicons name="location-outline" size={10} color={COLORS.textDisabled} />
                <Text style={s.cardAddress} numberOfLines={1}>{item.ubicacion}</Text>
              </View>
            ) : null}
            <View style={s.cardMetaRow}>
              <View style={s.cardMetaTag}>
                <Text style={s.cardMetaText}>{item.horas_prev || "—"}h</Text>
              </View>
              {item.tecnicos?.length ? (
                <View style={s.cardMetaTag}>
                  <Text style={s.cardMetaText}>{item.tecnicos.join(", ")}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={s.cardRight}>
            <View style={{ flexDirection: "row", gap: 4 }}>
              {st && (
                <View style={[s.cardBadge, { backgroundColor: st.bg }]}>
                  <Text style={[s.cardBadgeText, { color: st.fg }]}>{st.label}</Text>
                </View>
              )}
              <View style={[s.cardBadge, { backgroundColor: pending ? COLORS.pendingBg : COLORS.syncedBg }]}>
                <Text style={[s.cardBadgeText, { color: pending ? COLORS.pendingText : COLORS.syncedText }]}>
                  {pending ? "PEND" : "SINC"}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={s.cardMoreBtn}>
              <Ionicons name="ellipsis-horizontal" size={16} color={COLORS.textDisabled} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderStatsSidebar = () => {
    if (managerStats.length === 0) return null;
    const totalProyectos = managerStats.reduce((s, m) => s + m.total, 0);
    const totalByStatus: Record<string, number> = {};
    managerStats.forEach((m) => {
      Object.entries(m.by_status as Record<string, { count: number }>).forEach(([st, info]) => {
        totalByStatus[st] = (totalByStatus[st] || 0) + info.count;
      });
    });
    return (
      <>
        {Platform.OS === "web" ? (
          <select
            value={yearFilter}
            onChange={(e: any) => setYearFilter(e.target.value)}
            style={{
              width: "100%", fontSize: 12, fontWeight: "600", color: COLORS.text,
              backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
              borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 4,
              outline: "none", fontFamily: "inherit",
            } as any}
          >
            <option value="todos">Todos los años</option>
            {Array.from({ length: new Date().getFullYear() - 2021 }, (_, i) => 2022 + i).map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        ) : (
          <TouchableOpacity
            style={s.teamSelector}
            onPress={() => {
              const years = ["todos", ...Array.from({ length: new Date().getFullYear() - 2021 }, (_, i) => String(2022 + i))];
              const idx = years.indexOf(yearFilter);
              setYearFilter(years[(idx + 1) % years.length]);
            }}
          >
            <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
            <Text style={{ flex: 1, color: COLORS.text, fontSize: 13, fontWeight: "600" }}>
              {yearFilter === "todos" ? "Todos los años" : yearFilter}
            </Text>
            <Ionicons name="chevron-down" size={12} color={COLORS.textDisabled} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={s.totalKpiCard}
          onPress={() => { setManagerFilterIds([]); setStatusFilterIds([]); }}
          activeOpacity={0.7}
        >
          <View style={s.totalKpiHeader}>
        <Ionicons name="layers-outline" size={14} color={COLORS.primary} />
        <Text style={s.totalKpiLabel}>TOTAL</Text>
      </View>
      <Text style={s.totalKpiNumber}>{totalProyectos}</Text>
      <View style={s.totalKpiPills}>
        {Object.entries(totalByStatus).sort(([a], [b]) => a.localeCompare(b)).map(([st, count]) => {
              const color = STATUS_COLORS[st] || COLORS.textDisabled;
              const active = statusFilterIds.includes(st);
              return (
                <TouchableOpacity
                  key={st}
                  style={[s.statusPill, { backgroundColor: active ? color : color + "18" }]}
                  onPress={() => {
                    setStatusFilterIds((p) => p.includes(st) ? p.filter((x) => x !== st) : [...p, st]);
                  }}
                >
                  <Text style={[s.statusPillText, { color: active ? "#fff" : color }]}>
                    {STATUS_LABELS[st] || st} {count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>

        <View style={s.managerSection}>
          <Text style={s.managerSectionTitle}>RESPONSABLES</Text>
          {managerStats.map((mgr) => (
            <TouchableOpacity
              key={mgr.id}
              style={[s.managerRow, managerFilterIds.includes(mgr.id) && s.managerRowActive]}
              onPress={() => {
                setManagerFilterIds((p) => p.includes(mgr.id) ? p.filter((x) => x !== mgr.id) : [...p, mgr.id]);
              }}
              activeOpacity={0.7}
            >
              <View style={[s.managerDot, { backgroundColor: mgr.color }]} />
              <Text style={[s.managerName, managerFilterIds.includes(mgr.id) && { color: COLORS.text, fontWeight: "700" }]} numberOfLines={1}>
                {mgr.name.split(" ")[0]}
              </Text>
              <Text style={s.managerTotal}>{mgr.total}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </>
    );
  };

  const renderMobileStats = () => {
    if (managerStats.length === 0) return null;
    const totalProyectos = managerStats.reduce((s, m) => s + m.total, 0);
    const totalByStatus: Record<string, number> = {};
    managerStats.forEach((m) => {
      Object.entries(m.by_status as Record<string, { count: number }>).forEach(([st, info]) => {
        totalByStatus[st] = (totalByStatus[st] || 0) + info.count;
      });
    });
    return (
      <View style={s.mobileStats}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: COLORS.textDisabled }}>Año:</Text>
          {Platform.OS === "web" ? (
            <select
              value={yearFilter}
              onChange={(e: any) => setYearFilter(e.target.value)}
              style={{
                fontSize: 12, fontWeight: "600", color: COLORS.text,
                backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
                borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10,
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
                borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
                paddingVertical: 6, paddingHorizontal: 10, gap: 6,
              }}
              onPress={() => {
                const years = ["todos", ...Array.from({ length: new Date().getFullYear() - 2021 }, (_, i) => String(2022 + i))];
                const idx = years.indexOf(yearFilter);
                setYearFilter(years[(idx + 1) % years.length]);
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: COLORS.text }}>
                {yearFilter === "todos" ? "Todos" : yearFilter}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={s.totalKpiCardMobile}
          onPress={() => { setManagerFilterIds([]); setStatusFilterIds([]); }}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Ionicons name="layers-outline" size={14} color={COLORS.primary} />
            <Text style={{ fontSize: 11, fontWeight: "700", color: COLORS.primary, letterSpacing: 1, textTransform: "uppercase", flex: 1 }}>TOTAL</Text>
            <Text style={{ fontSize: 20, fontWeight: "800", color: COLORS.text }}>{totalProyectos}</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {Object.entries(totalByStatus).sort(([a], [b]) => a.localeCompare(b)).map(([st, count]) => {
              const color = STATUS_COLORS[st] || COLORS.textDisabled;
              const active = statusFilterIds.includes(st);
              return (
                <TouchableOpacity
                  key={st}
                  style={{ backgroundColor: active ? color : color + "18", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}
                  onPress={() => {
                    setStatusFilterIds((p) => p.includes(st) ? p.filter((x) => x !== st) : [...p, st]);
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: active ? "#fff" : color }}>
                    {STATUS_LABELS[st] || st} {count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>

        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: COLORS.textDisabled, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>RESPONSABLES</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8, paddingRight: 8 }}>
              {managerStats.map((mgr) => (
                <TouchableOpacity
                  key={mgr.id}
                  style={{
                    backgroundColor: managerFilterIds.includes(mgr.id) ? COLORS.border : COLORS.surface,
                    borderRadius: 14, borderWidth: 1,
                    borderColor: managerFilterIds.includes(mgr.id) ? mgr.color : COLORS.border,
                    padding: 12, minWidth: 150,
                  }}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setManagerFilterIds((p) => p.includes(mgr.id) ? p.filter((x) => x !== mgr.id) : [...p, mgr.id]);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: mgr.color }} />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.text }} numberOfLines={1}>
                      {mgr.name.split(" ")[0]}
                    </Text>
                    <Text style={{ fontSize: 11, color: COLORS.textDisabled, fontWeight: "600" }}>{mgr.total}</Text>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                    {Object.entries(mgr.by_status as Record<string, { count: number; label: string; color: string }>).map(([st, info]) => (
                      <TouchableOpacity
                        key={st}
                        style={{
                          backgroundColor: info.color + "20", borderRadius: 6,
                          paddingHorizontal: 8, paddingVertical: 2,
                          borderWidth: statusFilterIds.includes(st) ? 1 : 0,
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
        </View>

        <TouchableOpacity style={s.newProjectBtnMobile} activeOpacity={0.8}>
          <Text style={s.newProjectBtnText}>+ Nuevo proyecto</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ResponsiveLayout active="proyectos" isAdmin={isAdmin} onLogout={logout} userName={me?.name}>
      <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
        <View style={s.container}>
          {isWide && (
            <ScrollView style={s.leftPanel} contentContainerStyle={s.leftPanelContent}>
              {renderStatsSidebar()}
            </ScrollView>
          )}

          <View style={s.mainContent}>
            <View style={s.header}>
              <View style={s.headerLeft}>
                <Text style={s.headerTitle}>Proyectos</Text>
                <Text style={s.headerSubtitle}>Todos tus proyectos en un solo lugar</Text>
              </View>
              <View style={s.headerRight}>
                <TouchableOpacity style={s.headerIcon}>
                  <Ionicons name="search-outline" size={18} color={COLORS.textDisabled} />
                </TouchableOpacity>
                <TouchableOpacity style={s.headerIcon}>
                  <Ionicons name="notifications-outline" size={18} color={COLORS.textDisabled} />
                </TouchableOpacity>
                <TouchableOpacity style={s.headerIcon}>
                  <Ionicons name="settings-outline" size={18} color={COLORS.textDisabled} />
                </TouchableOpacity>
              </View>
            </View>

            {!isWide && renderMobileStats()}

            {stats && (
              <View style={s.kpiStrip}>
                <View style={s.kpiCard}>
                  <View style={[s.kpiIconWrap, { backgroundColor: COLORS.primarySoft }]}>
                    <Ionicons name="folder-outline" size={14} color={COLORS.primary} />
                  </View>
                  <Text style={s.kpiNumber}>{stats.total}</Text>
                  <Text style={s.kpiLabel}>Total</Text>
                </View>
                <TouchableOpacity
                  style={[s.kpiCard, pendingOnly && s.kpiCardActive]}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setPendingOnly(!pendingOnly);
                  }}
                  testID="stat-pending"
                  activeOpacity={0.75}
                >
                  <View style={[s.kpiIconWrap, { backgroundColor: COLORS.pendingBg }]}>
                    <Ionicons name="time-outline" size={14} color={COLORS.pendingText} />
                  </View>
                  <Text style={s.kpiNumber}>{stats.pending}</Text>
                  <Text style={s.kpiLabel}>Pendientes</Text>
                </TouchableOpacity>
                <View style={s.kpiCard}>
                  <View style={[s.kpiIconWrap, { backgroundColor: COLORS.syncedBg }]}>
                    <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.syncedText} />
                  </View>
                  <Text style={s.kpiNumber}>{stats.synced}</Text>
                  <Text style={s.kpiLabel}>Sincronizados</Text>
                </View>
              </View>
            )}

            <View style={s.searchRow}>
              <View style={s.searchBox}>
                <Ionicons name="search-outline" size={16} color={COLORS.textDisabled} />
                <TextInput
                  testID="input-search"
                  style={s.searchInput}
                  value={q}
                  onChangeText={setQ}
                  placeholder="Buscar cliente, proyecto, ubicación..."
                  placeholderTextColor={COLORS.textSecondary}
                />
                {q.length > 0 && (
                  <TouchableOpacity onPress={() => setQ("")}>
                    <Ionicons name="close-circle" size={16} color={COLORS.textDisabled} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                testID="btn-filter-pending"
                style={[s.actionChip, pendingOnly && s.actionChipActive]}
                onPress={() => setPendingOnly(!pendingOnly)}
              >
                <Ionicons name="time-outline" size={14} color={pendingOnly ? "#fff" : COLORS.textDisabled} />
              </TouchableOpacity>
              <TouchableOpacity
                testID="btn-filter-manager"
                style={[s.actionChip, managerFilterIds.length > 0 && s.actionChipActive]}
                onPress={() => { setShowManagerFilter((v) => !v); setShowStatusFilter(false); }}
              >
                <Ionicons name="people-outline" size={14} color={managerFilterIds.length > 0 ? "#fff" : COLORS.textDisabled} />
              </TouchableOpacity>
              {esEditorCompleto && (
                <TouchableOpacity
                  testID="btn-filter-status"
                  style={[s.actionChip, statusFilterIds.length > 0 && s.actionChipActive]}
                  onPress={() => { setShowStatusFilter((v) => !v); setShowManagerFilter(false); }}
                >
                  <Ionicons name="flag-outline" size={14} color={statusFilterIds.length > 0 ? "#fff" : COLORS.textDisabled} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[s.actionChip, { borderColor: COLORS.syncedBg }]}
                onPress={async () => {
                  try { await api.exportProjectsExcel(); }
                  catch (e: any) { Alert.alert("Error", "No se pudo exportar"); }
                }}
              >
                <Ionicons name="download-outline" size={13} color={COLORS.syncedText} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionChip, { borderColor: COLORS.primarySoft }]}
                onPress={() => router.push("/mapa")}
              >
                <Ionicons name="map-outline" size={13} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionChip, { borderColor: COLORS.pendingBg }]}
                onPress={() => router.push("/archivos")}
              >
                <Ionicons name="folder-open-outline" size={13} color={COLORS.pendingText} />
              </TouchableOpacity>
              {(managerFilterIds.length > 0 || statusFilterIds.length > 0) && (
                <TouchableOpacity
                  style={[s.actionChip, { borderColor: COLORS.errorBg }]}
                  onPress={() => { clearManagerFilter(); setStatusFilterIds([]); }}
                >
                  <Ionicons name="close-outline" size={14} color={COLORS.errorText} />
                </TouchableOpacity>
              )}
            </View>

            {showManagerFilter && (
              <View style={s.filterChipsRow}>
                <View style={s.filterChips}>
                  <TouchableOpacity
                    style={[s.filterChip, managerFilterIds.includes("__none__") && s.filterChipActive]}
                    onPress={() => toggleManagerFilter("__none__")}
                  >
                    <Text style={[s.filterChipText, managerFilterIds.includes("__none__") && s.filterChipTextActive]}>⚡ Sin gestor</Text>
                  </TouchableOpacity>
                  {managers.map((mgr) => {
                    const on = managerFilterIds.includes(mgr.id);
                    return (
                      <TouchableOpacity
                        key={mgr.id}
                        style={[s.filterChip, on && s.filterChipActive]}
                        onPress={() => toggleManagerFilter(mgr.id)}
                      >
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: (mgr as any).color || COLORS.primary }} />
                        <Text style={[s.filterChipText, on && s.filterChipTextActive]} numberOfLines={1}>{mgr.name || mgr.email}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {showStatusFilter && (
              <View style={s.filterChipsRow}>
                <View style={s.filterChips}>
                  {PROJECT_STATUSES.map((st) => {
                    const on = statusFilterIds.includes(st.key);
                    return (
                      <TouchableOpacity
                        key={st.key}
                        style={[s.filterChip, on && { backgroundColor: st.color + "18", borderColor: st.color }]}
                        onPress={() => toggleStatusFilter(st.key)}
                      >
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: st.color }} />
                        <Text style={[s.filterChipText, on && { color: st.color, fontWeight: "800" }]}>{st.label}</Text>
                        {on && <Ionicons name="checkmark" size={12} color={st.color} />}
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
                <Ionicons name="cube-outline" size={48} color={COLORS.textSecondary} />
                <Text style={{ color: COLORS.textDisabled, fontSize: 15, fontWeight: "500", marginTop: 8 }}>Sin resultados</Text>
              </View>
            ) : (
              <ScrollView
                testID="materiales-list"
                contentContainerStyle={s.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => { setRefreshing(true); load(); }}
                    tintColor={COLORS.primary}
                  />
                }
              >
                {items.map((item) => (
                  <View key={item.id}>
                    {renderItem({ item })}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </SafeAreaView>
    </ResponsiveLayout>
  );
}

const useS = () =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: COLORS.bg,
    },
    container: {
      flex: 1,
      flexDirection: "row",
    },
    leftPanel: {
      flex: 0.2,
      maxWidth: 280,
      backgroundColor: COLORS.surface,
      borderRightWidth: 1,
      borderRightColor: COLORS.border,
    },
    leftPanelContent: {
      padding: 16,
      gap: 14,
      paddingBottom: 40,
    },
    teamSelector: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: COLORS.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 10,
    },
    teamSelectorLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    teamSelectorText: {
      color: COLORS.text,
      fontSize: 13,
      fontWeight: "600",
      flex: 1,
    },
    totalKpiCard: {
      backgroundColor: COLORS.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 16,
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 5,
    },
    totalKpiHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 8,
    },
    totalKpiLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: COLORS.primary,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    totalKpiNumber: {
      fontSize: 32,
      fontWeight: "800",
      color: COLORS.text,
      marginBottom: 12,
    },
    totalKpiPills: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    statusPill: {
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: "700",
    },
    managerSection: {
      gap: 2,
    },
    managerSectionTitle: {
      fontSize: 10,
      fontWeight: "700",
      color: COLORS.textDisabled,
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 6,
    },
    managerRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 12,
      gap: 10,
    },
    managerRowActive: {
      backgroundColor: COLORS.border,
    },
    managerDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    managerName: {
      flex: 1,
      fontSize: 13,
      fontWeight: "600",
      color: COLORS.textSecondary,
    },
    managerTotal: {
      fontSize: 12,
      fontWeight: "700",
      color: COLORS.textDisabled,
    },
    newProjectBtn: {
      backgroundColor: COLORS.primary,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 4,
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 8,
    },
    newProjectBtnText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "700",
    },
    mainContent: {
      flex: 0.8,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 12,
    },
    headerLeft: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: "800",
      color: COLORS.text,
    },
    headerSubtitle: {
      fontSize: 13,
      color: COLORS.textDisabled,
      fontWeight: "500",
      marginTop: 2,
    },
    headerRight: {
      flexDirection: "row",
      gap: 8,
    },
    headerIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: "center",
      justifyContent: "center",
    },
    mobileStats: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 12,
    },
    totalKpiCardMobile: {
      backgroundColor: COLORS.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 14,
    },
    newProjectBtnMobile: {
      backgroundColor: COLORS.primary,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: "center",
      marginTop: 4,
    },
    kpiStrip: {
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 24,
      paddingTop: 4,
      paddingBottom: 12,
    },
    kpiCard: {
      flex: 1,
      backgroundColor: COLORS.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 14,
      gap: 6,
      alignItems: "flex-start",
    },
    kpiCardActive: {
      borderColor: COLORS.pendingText,
      backgroundColor: COLORS.pendingBg,
    },
    kpiIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    kpiNumber: {
      fontSize: 22,
      fontWeight: "800",
      color: COLORS.text,
    },
    kpiLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: COLORS.textDisabled,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    searchRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 24,
      paddingVertical: 8,
      alignItems: "center",
    },
    searchBox: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: COLORS.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 14,
      height: 40,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: COLORS.text,
      outlineStyle: "none" as any,
    },
    actionChip: {
      height: 36,
      width: 36,
      borderRadius: 10,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: "center",
      justifyContent: "center",
    },
    actionChipActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    filterChipsRow: {
      paddingHorizontal: 24,
      paddingBottom: 8,
    },
    filterChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    filterChipActive: {
      backgroundColor: COLORS.primarySoft,
      borderColor: COLORS.primary,
    },
    filterChipText: {
      fontSize: 12,
      fontWeight: "600",
      color: COLORS.textSecondary,
    },
    filterChipTextActive: {
      color: COLORS.text,
      fontWeight: "800",
    },
    centerBox: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    listContent: {
      padding: 16,
      gap: 12,
      paddingBottom: 60,
      maxWidth: 900,
      alignSelf: "center",
      width: "100%",
    },
    card: {
      flexDirection: "row",
      backgroundColor: COLORS.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      overflow: "hidden",
    },
    cardBar: {
      width: 4,
    },
    cardBody: {
      flex: 1,
      flexDirection: "row",
      padding: 14,
      alignItems: "center",
      gap: 12,
    },
    cardAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: COLORS.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    cardAvatarText: {
      fontSize: 12,
      fontWeight: "700",
      color: COLORS.primary,
    },
    cardInfo: {
      flex: 1,
      gap: 4,
    },
    cardTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    cardCode: {
      fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
      fontSize: 13,
      fontWeight: "700",
      color: COLORS.text,
      letterSpacing: 0.3,
    },
    cardClient: {
      fontSize: 13,
      fontWeight: "600",
      color: COLORS.textSecondary,
      flexShrink: 1,
    },
    cardAddressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    cardAddress: {
      fontSize: 11,
      color: COLORS.textDisabled,
      fontWeight: "500",
    },
    cardMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
    },
    cardMetaTag: {
      backgroundColor: COLORS.surface,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    cardMetaText: {
      fontSize: 10,
      color: COLORS.textSecondary,
      fontWeight: "600",
    },
    cardRight: {
      alignItems: "flex-end",
      gap: 6,
    },
    cardBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 7,
    },
    cardBadgeText: {
      fontSize: 9,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    cardMoreBtn: {
      width: 24,
      height: 24,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
    },
  });
