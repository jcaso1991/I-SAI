import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, RefreshControl, Alert, Platform,
  LayoutAnimation,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, clearToken, COLORS } from "../src/api";
import ResponsiveLayout from "../src/ResponsiveLayout";
import { useBreakpoint } from "../src/useBreakpoint";
import { useThemedStyles } from "../src/theme";

export default function Materiales() {
  const router = useRouter();
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
  const [statusFilterIds, setStatusFilterIds] = useState<string[]>([]);
  const [showStatusFilter, setShowStatusFilter] = useState(false);

  const PROJECT_STATUSES = [
    { key: "pendiente", label: "Pendiente", color: "#F59E0B" },
    { key: "planificado", label: "Planificado", color: "#3B82F6" },
    { key: "a_facturar", label: "A facturar", color: "#8B5CF6" },
    { key: "facturado", label: "Facturado", color: "#10B981" },
    { key: "terminado", label: "Terminado", color: "#6366F1" },
    { key: "bloqueado", label: "Bloqueado", color: "#EF4444" },
    { key: "anulado", label: "Anulado", color: "#6B7280" },
  ];

  // Persist manager and status filters
  useEffect(() => {
    AsyncStorage.getItem("mat_manager_filter").then((v) => {
      if (v) try { setManagerFilterIds(JSON.parse(v)); } catch {}
    }).catch(() => {});
    AsyncStorage.getItem("mat_status_filter").then((v) => {
      if (v) try { setStatusFilterIds(JSON.parse(v)); } catch {}
    }).catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("mat_manager_filter", JSON.stringify(managerFilterIds)).catch(() => {});
  }, [managerFilterIds]);

  useEffect(() => {
    AsyncStorage.setItem("mat_status_filter", JSON.stringify(statusFilterIds)).catch(() => {});
  }, [statusFilterIds]);

  const load = async () => {
    try {
      const managerId = managerFilterIds.length === 1 ? managerFilterIds[0] : undefined;
      const unassigned = managerFilterIds.includes("__none__");
      const statusParam = statusFilterIds.length > 0 ? statusFilterIds.join(",") : undefined;
      const [list, st, u] = await Promise.all([
        api.listMateriales(q || undefined, pendingOnly, managerId, unassigned, statusParam),
        api.stats(),
        me ? Promise.resolve(me) : api.me(),
      ]);
      setItems(list);
      setStats(st);
      if (!me) setMe(u);
    } catch (e: any) {
      if (/401|Invalid|expired/i.test(e.message)) {
        await clearToken();
        router.replace("/login");
      } else {
        Alert.alert("Error", e.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => {
    load();
    api.listManagers().then(setManagers).catch(() => {});
  }, [q, pendingOnly, managerFilterIds, statusFilterIds]));

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [q, pendingOnly, managerFilterIds, statusFilterIds]);

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

  const s = useThemedStyles(useS);

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
    const statusBarColor = statusBarColors[projectStatus] || "#F59E0B";
    const statusBadgeStyles: Record<string, { bg: string; fg: string; label: string }> = {
      a_facturar: { bg: COLORS.statusFacturarBg, fg: COLORS.statusFacturarFg, label: "Facturar" },
      planificado: { bg: COLORS.statusPlanifBg, fg: COLORS.statusPlanifFg, label: "Planif." },
      facturado: { bg: COLORS.statusFacturadoBg, fg: COLORS.statusFacturadoFg, label: "Facturado" },
      terminado: { bg: COLORS.statusTerminadoBg, fg: COLORS.statusTerminadoFg, label: "Terminado" },
      bloqueado: { bg: COLORS.statusBloqueadoBg, fg: COLORS.statusBloqueadoFg, label: "Bloqueado" },
      anulado: { bg: COLORS.statusAnuladoBg, fg: COLORS.statusAnuladoFg, label: "Anulado" },
    };
    const st = item.project_status && item.project_status !== "pendiente" ? statusBadgeStyles[item.project_status] : null;
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
            <Text style={s.code} numberOfLines={1}>{item.materiales || "—"}</Text>
            <Text style={s.cliente} numberOfLines={1}>{item.cliente || ""}</Text>
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
            <Text style={s.infoValue}>{item.horas_prev || "—"}h</Text>
            {item.horas_imputadas > 0 && (
              <Text style={[s.infoValue, { fontSize: 8, color: horasImp > horasPrev ? COLORS.errorText : COLORS.primary }]}>
                +{item.horas_imputadas}
              </Text>
            )}
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoValue} numberOfLines={1}>{item.comercial || "—"}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoValue} numberOfLines={1}>{item.manager_name || item.gestor || "—"}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoValue} numberOfLines={1}>{item.tecnicos?.join(", ") || item.tecnico || "—"}</Text>
          </View>
        </View>
        {item.ubicacion ? (
          <View style={s.metaItem}>
            <Ionicons name="location" size={10} color={COLORS.textSecondary} />
            <Text style={s.metaText} numberOfLines={1}>{item.ubicacion}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <ResponsiveLayout active="proyectos" isAdmin={isAdmin} onLogout={logout} userName={me?.name}>
      <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Proyectos</Text>
          <Text style={s.headerSubHint}>
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
            <Text style={s.statVal}>{stats.total}</Text>
            <Text style={s.statLbl}>Total</Text>
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
            <Text style={s.statVal}>{stats.pending}</Text>
            <Text style={s.statLbl}>Pendientes</Text>
          </TouchableOpacity>
          <View style={s.statCard}>
            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
            <Text style={s.statVal}>{stats.synced}</Text>
            <Text style={s.statLbl}>Sincronizados</Text>
          </View>
        </View>
      )}

      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Ionicons name="search" size={16} color={COLORS.textSecondary} />
          <TextInput
            testID="input-search"
            style={s.searchInput}
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
        <TouchableOpacity
          testID="btn-filter-status"
          style={[s.filterBtn, statusFilterIds.length > 0 && s.filterBtnActive]}
          onPress={() => { setShowStatusFilter((v) => !v); setShowManagerFilter(false); }}
        >
          <Ionicons name="flag" size={16} color={statusFilterIds.length > 0 ? "#fff" : COLORS.navy} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.filterBtn, { backgroundColor: COLORS.syncedBg, borderColor: COLORS.syncedText, borderWidth: 1 }]}
          onPress={async () => {
            try { await api.exportProjectsExcel(); }
            catch (e: any) { Alert.alert("Error", "No se pudo exportar"); }
          }}
        >
          <Ionicons name="download-outline" size={14} color={COLORS.syncedText} />
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
          <Text style={s.emptyText}>Sin resultados</Text>
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
