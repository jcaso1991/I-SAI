import { useCallback, useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, RefreshControl, Alert, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, clearToken, COLORS } from "../src/api";
import ResponsiveLayout from "../src/ResponsiveLayout";
import { useBreakpoint } from "../src/useBreakpoint";

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

  const load = async () => {
    try {
      const managerId = managerFilterIds.length === 1 ? managerFilterIds[0] : undefined;
      const unassigned = managerFilterIds.includes("__none__");
      const [list, st, u] = await Promise.all([
        api.listMateriales(q || undefined, pendingOnly, managerId, unassigned),
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
  }, [q, pendingOnly, managerFilterIds]));

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [q, pendingOnly, managerFilterIds]);

  const toggleManagerFilter = (id: string) => {
    setManagerFilterIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const clearManagerFilter = () => setManagerFilterIds([]);

  const logout = async () => {
    await clearToken();
    router.replace("/login");
  };

  const isAdmin = me?.role === "admin";

  const renderItem = ({ item }: any) => {
    const pending = item.sync_status === "pending";
    return (
      <TouchableOpacity
        testID={`material-item-${item.id}`}
        style={s.card}
        onPress={() => router.push(`/material/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={s.cardTop}>
          <Text style={s.code}>{item.materiales || "—"}</Text>
          <View style={[s.badge, pending ? s.badgePending : s.badgeSynced]}>
            <Ionicons
              name={pending ? "time-outline" : "checkmark-circle"}
              size={12}
              color={pending ? COLORS.pendingText : COLORS.syncedText}
            />
            <Text style={[s.badgeText, { color: pending ? COLORS.pendingText : COLORS.syncedText }]}>
              {pending ? "PEND" : "SINC"}
            </Text>
          </View>
        </View>
        <Text style={s.cliente} numberOfLines={1}>{item.cliente || "Sin cliente"}</Text>
        <View style={s.infoGrid}>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Horas</Text>
            <Text style={s.infoValue}>{item.horas_prev || "—"}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Comercial</Text>
            <Text style={s.infoValue}>{item.comercial || "—"}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Gestor</Text>
            <Text style={s.infoValue}>{item.manager_name || item.gestor || "—"}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Técnico</Text>
            <Text style={s.infoValue}>{item.tecnico || "—"}</Text>
          </View>
        </View>
        {item.ubicacion && (
          <View style={s.metaItem}>
            <Ionicons name="location" size={13} color={COLORS.textSecondary} />
            <Text style={s.metaText} numberOfLines={1}>{item.ubicacion}</Text>
          </View>
        )}
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
            {managerFilterIds.length > 0
              ? `${items.length} proyecto${items.length !== 1 ? "s" : ""} · ${items.reduce((sum: number, it: any) => sum + (parseFloat(it.horas_prev) || 0), 0)}h totales`
              : "Base sincronizada con OneDrive"}
          </Text>
        </View>
        {!isWide && (
          <View style={s.headerBtns}>
            <TouchableOpacity testID="btn-logout" style={s.iconBtn} onPress={logout}>
              <Ionicons name="log-out-outline" size={22} color={COLORS.navy} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Elegant stats strip — moved from home to keep it contextual. */}
      {stats && (
        <View style={s.statsStrip} testID="stats-strip">
          <View style={s.statCard}>
            <View style={[s.statIcon, { backgroundColor: COLORS.primary + "1A" }]}>
              <Ionicons name="folder" size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.statVal}>{stats.total}</Text>
              <Text style={s.statLbl}>Total</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[s.statCard, pendingOnly && { borderColor: "#F59E0B", backgroundColor: "#F59E0B1A" }]}
            onPress={() => setPendingOnly(!pendingOnly)}
            testID="stat-pending"
            activeOpacity={0.75}
          >
            <View style={[s.statIcon, { backgroundColor: "#F59E0B1A" }]}>
              <Ionicons name="time" size={18} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.statVal}>{stats.pending}</Text>
              <Text style={s.statLbl}>Pendientes</Text>
            </View>
          </TouchableOpacity>
          <View style={s.statCard}>
            <View style={[s.statIcon, { backgroundColor: "#10B9811A" }]}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.statVal}>{stats.synced}</Text>
              <Text style={s.statLbl}>Sincronizados</Text>
            </View>
          </View>
        </View>
      )}

      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Ionicons name="search" size={18} color={COLORS.textSecondary} />
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
              <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          testID="btn-filter-pending"
          style={[s.filterBtn, pendingOnly && s.filterBtnActive]}
          onPress={() => setPendingOnly(!pendingOnly)}
        >
          <Ionicons name="time" size={18} color={pendingOnly ? "#fff" : COLORS.navy} />
        </TouchableOpacity>
        <TouchableOpacity
          testID="btn-filter-manager"
          style={[s.filterBtn, managerFilterIds.length > 0 && s.filterBtnActive]}
          onPress={() => setShowManagerFilter((v) => !v)}
        >
          <Ionicons name="people" size={18} color={managerFilterIds.length > 0 ? "#fff" : COLORS.navy} />
        </TouchableOpacity>
        {managerFilterIds.length > 0 && (
          <TouchableOpacity
            style={[s.filterBtn, { backgroundColor: COLORS.errorBg }]}
            onPress={clearManagerFilter}
          >
            <Ionicons name="close" size={16} color={COLORS.errorText} />
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
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40, maxWidth: 900, alignSelf: "center", width: "100%" }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={COLORS.primary}
            />
          }
          initialNumToRender={20}
          windowSize={10}
          removeClippedSubviews
        />
      )}

      </SafeAreaView>
    </ResponsiveLayout>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 26, fontWeight: "900", color: COLORS.text, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  headerSubHint: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, fontWeight: "600" },
  statsStrip: {
    flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10,
  },
  statCard: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: COLORS.surface, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  statIcon: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  statVal: { fontSize: 20, fontWeight: "900", color: COLORS.text, letterSpacing: -0.3, lineHeight: 22 },
  statLbl: { fontSize: 10.5, fontWeight: "800", color: COLORS.textSecondary, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 1 },
  headerBtns: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center",
  },
  searchRow: {
    flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  searchBox: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: COLORS.bg, borderRadius: 10, paddingHorizontal: 12, height: 44,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text },
  filterBtn: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center",
  },
  filterBtnActive: { backgroundColor: COLORS.primary },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15 },
  card: {
    backgroundColor: COLORS.surface, padding: 14, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, gap: 8,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  code: { fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }), fontSize: 13, fontWeight: "700", color: COLORS.navy, letterSpacing: 0.3 },
  cliente: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: "500" },
  infoGrid: { flexDirection: "row", marginTop: 6, gap: 4 },
  infoCell: {
    flex: 1, backgroundColor: COLORS.bg, borderRadius: 6,
    paddingVertical: 6, paddingHorizontal: 6, alignItems: "center",
  },
  infoLabel: { fontSize: 10, color: COLORS.textDisabled, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  infoValue: { fontSize: 12, color: COLORS.text, fontWeight: "700", marginTop: 1 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  badgeSynced: { backgroundColor: COLORS.syncedBg },
  badgePending: { backgroundColor: COLORS.pendingBg },
  badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  pillBlue: { backgroundColor: COLORS.pillBlueBg },
  pillOrange: { backgroundColor: COLORS.pillOrangeBg },
  pillText: { fontSize: 10, fontWeight: "800", color: COLORS.navy, letterSpacing: 0.5 },
  managerText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "600", marginTop: 2 },
  managerChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  managerChipTxt: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary },
});
