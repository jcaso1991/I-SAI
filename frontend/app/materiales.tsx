import { useCallback, useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, clearToken, COLORS } from "../src/api";

export default function Materiales() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [stats, setStats] = useState<{ total: number; pending: number; synced: number } | null>(null);

  const load = async () => {
    try {
      const [list, st] = await Promise.all([
        api.listMateriales(q || undefined, pendingOnly),
        api.stats(),
      ]);
      setItems(list);
      setStats(st);
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
  }, [q, pendingOnly]));

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [q, pendingOnly]);

  const logout = async () => {
    await clearToken();
    router.replace("/login");
  };

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
              {pending ? "PENDIENTE" : "SINC"}
            </Text>
          </View>
        </View>
        <Text style={s.cliente} numberOfLines={1}>{item.cliente || "Sin cliente"}</Text>
        <View style={s.metaRow}>
          <View style={s.metaItem}>
            <Ionicons name="location" size={13} color={COLORS.textSecondary} />
            <Text style={s.metaText} numberOfLines={1}>{item.ubicacion || "—"}</Text>
          </View>
          {item.horas_prev && (
            <View style={s.metaItem}>
              <Ionicons name="time" size={13} color={COLORS.textSecondary} />
              <Text style={s.metaText}>{item.horas_prev}h</Text>
            </View>
          )}
          {item.entrega_recogida && (
            <View style={[s.pill, item.entrega_recogida.toLowerCase().includes("entrega") ? s.pillBlue : s.pillOrange]}>
              <Text style={s.pillText}>{item.entrega_recogida}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Materiales</Text>
          {stats && (
            <Text style={s.headerSub} testID="stats-text">
              {stats.total} total · <Text style={{ color: stats.pending > 0 ? COLORS.pendingText : COLORS.syncedText, fontWeight: "700" }}>{stats.pending} pendiente{stats.pending !== 1 ? "s" : ""}</Text>
            </Text>
          )}
        </View>
        <View style={s.headerBtns}>
          <TouchableOpacity testID="btn-calendario" style={s.iconBtn} onPress={() => router.push("/calendario")}>
            <Ionicons name="calendar-outline" size={22} color={COLORS.navy} />
          </TouchableOpacity>
          <TouchableOpacity testID="btn-planos" style={s.iconBtn} onPress={() => router.push("/planos")}>
            <Ionicons name="map-outline" size={22} color={COLORS.navy} />
          </TouchableOpacity>
          <TouchableOpacity testID="btn-admin" style={s.iconBtn} onPress={() => router.push("/admin")}>
            <Ionicons name="cloud-outline" size={22} color={COLORS.navy} />
          </TouchableOpacity>
          <TouchableOpacity testID="btn-logout" style={s.iconBtn} onPress={logout}>
            <Ionicons name="log-out-outline" size={22} color={COLORS.navy} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Ionicons name="search" size={18} color={COLORS.textSecondary} />
          <TextInput
            testID="input-search"
            style={s.searchInput}
            value={q}
            onChangeText={setQ}
            placeholder="Buscar cliente, material, ubicación..."
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
      </View>

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
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
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
  code: { fontFamily: Platform_ok("monospace"), fontSize: 13, fontWeight: "700", color: COLORS.navy, letterSpacing: 0.3 },
  cliente: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: "500" },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  badgeSynced: { backgroundColor: COLORS.syncedBg },
  badgePending: { backgroundColor: COLORS.pendingBg },
  badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  pillBlue: { backgroundColor: "#DBEAFE" },
  pillOrange: { backgroundColor: "#FEF3C7" },
  pillText: { fontSize: 10, fontWeight: "800", color: COLORS.navy, letterSpacing: 0.5 },
});

function Platform_ok(m: string) { return m; }
