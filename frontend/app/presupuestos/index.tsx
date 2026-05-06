import { useCallback, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, clearToken, COLORS } from "../../src/api";
import ResponsiveLayout from "../../src/ResponsiveLayout";
import { useBreakpoint } from "../../src/useBreakpoint";
import { useThemedStyles } from "../../src/theme";

type Tab = "pendientes" | "aceptados";

export default function PresupuestosIndex() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const s = useThemedStyles(useS);
  const [me, setMe] = useState<any>(null);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pendientes");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      try {
        const [u, list] = await Promise.all([api.me(), api.listBudgets()]);
        if (!alive) return;
        setMe(u); setBudgets(list);
      } catch (e: any) {
        if (/401|Invalid|expired/i.test(e.message)) { await clearToken(); router.replace("/login"); }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []));

  const toggleStatus = async (id: string) => {
    try {
      const res = await api.toggleBudgetStatus(id);
      setBudgets((arr) => arr.map((b) => b.id === id ? { ...b, status: res.status } : b));
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const isAdmin = me?.role === "admin";
  const canAccess = me?.role === "admin" || me?.role === "comercial";
  const logout = async () => { await clearToken(); router.replace("/login"); };

  if (me && !canAccess) {
    return (
      <ResponsiveLayout active="presupuestos" isAdmin={isAdmin} onLogout={logout} userName={me?.name}>
        <SafeAreaView style={s.root}>
          <View style={s.denied}>
            <Ionicons name="lock-closed" size={64} color={COLORS.textDisabled} />
            <Text style={s.deniedTitle}>Acceso restringido</Text>
            <Text style={s.deniedTxt}>Solo administradores y comerciales pueden ver presupuestos.</Text>
          </View>
        </SafeAreaView>
      </ResponsiveLayout>
    );
  }

  const filtered = budgets.filter((b) => {
    const status = b.status || "pendiente";
    if (tab === "pendientes" && status !== "pendiente") return false;
    if (tab === "aceptados" && status !== "aceptado") return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const haystack = `${b.n_proyecto || ""} ${b.cliente || ""} ${b.nombre_instalacion || ""} ${b.created_by_name || b.created_by || ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const pendientes = budgets.filter((b) => (b.status || "pendiente") === "pendiente").length;
  const aceptados = budgets.filter((b) => b.status === "aceptado").length;

  return (
    <ResponsiveLayout active="presupuestos" isAdmin={isAdmin} onLogout={logout} userName={me?.name}>
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      <View style={s.header}>
        {!isWide && (
          <TouchableOpacity style={s.iconBtn} onPress={() => router.replace("/home")}>
            <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
          </TouchableOpacity>
        )}
        <Text style={s.headerTitle}>Presupuestos</Text>
        <TouchableOpacity
          style={s.iconBtn}
          onPress={() => setShowCreate((v) => !v)}
        >
          <Ionicons name={showCreate ? "chevron-up" : "add"} size={26} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Create actions (collapsible) */}
      {showCreate && (
        <View style={[s.actions, isWide && { maxWidth: 900, alignSelf: "center", width: "100%" }]}>
          <TouchableOpacity
            testID="btn-new-budget"
            style={[s.card, { backgroundColor: COLORS.primary }]}
            onPress={() => { setShowCreate(false); router.push("/presupuestos/nuevo"); }}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle" size={48} color="#fff" />
            <Text style={s.cardTitle}>Proyecto nuevo</Text>
            <Text style={s.cardSub}>Crear un presupuesto en blanco</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="btn-existing-budget"
            style={[s.card, { backgroundColor: COLORS.accent }]}
            onPress={() => { setShowCreate(false); router.push("/presupuestos/existente"); }}
            activeOpacity={0.85}
          >
            <Ionicons name="folder-open" size={48} color="#fff" />
            <Text style={s.cardTitle}>Proyecto existente</Text>
            <Text style={s.cardSub}>Enlazar a un proyecto ya creado</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search bar */}
      <View style={s.searchBox}>
        <Ionicons name="search" size={18} color={COLORS.textSecondary} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por proyecto, cliente, creador..."
          placeholderTextColor={COLORS.textDisabled}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        <TouchableOpacity
          testID="tab-pendientes"
          style={[s.tab, tab === "pendientes" && s.tabActive]}
          onPress={() => setTab("pendientes")}
        >
          <Text style={[s.tabText, tab === "pendientes" && s.tabTextActive]}>Pendientes ({pendientes})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="tab-aceptados"
          style={[s.tab, tab === "aceptados" && s.tabActive]}
          onPress={() => setTab("aceptados")}
        >
          <Text style={[s.tabText, tab === "aceptados" && s.tabTextActive]}>Aceptados ({aceptados})</Text>
        </TouchableOpacity>
      </View>

      {/* Budget list */}
      <ScrollView contentContainerStyle={s.scroll}>
        {loading ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : filtered.length === 0 ? (
          <Text style={s.empty}>No hay presupuestos {tab === "pendientes" ? "pendientes" : "aceptados"}</Text>
        ) : (
          <View style={{ gap: 10, maxWidth: isWide ? 900 : undefined, alignSelf: "center", width: "100%" }}>
            {filtered.map((b) => (
              <View key={b.id} style={s.row}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => router.push(`/presupuestos/${b.id}`)}
                >
                  <Text style={s.rowTitle} numberOfLines={1}>
                    {b.n_proyecto ? `#${b.n_proyecto} · ` : ""}{b.cliente || b.nombre_instalacion || "Sin título"}
                  </Text>
                  <Text style={s.rowSub} numberOfLines={1}>
                    {b.nombre_instalacion || ""} {b.direccion ? `· ${b.direccion}` : ""}
                  </Text>
                  <Text style={s.rowCreator}>
                    👤 {b.created_by_name || b.created_by || "—"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`toggle-status-${b.id}`}
                  style={[s.statusBtn, b.status === "aceptado" ? s.statusBtnAccepted : s.statusBtnPending]}
                  onPress={() => toggleStatus(b.id)}
                >
                  <Ionicons
                    name={b.status === "aceptado" ? "checkmark-circle" : "time-outline"}
                    size={18}
                    color={b.status === "aceptado" ? "#166534" : "#92400E"}
                  />
                  <Text style={[s.statusBtnText, b.status === "aceptado" ? { color: "#166534" } : { color: "#92400E" }]}>
                    {b.status === "aceptado" ? "Aceptado" : "Pendiente"}
                  </Text>
                </TouchableOpacity>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} style={{ marginLeft: 4 }} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
    </ResponsiveLayout>
  );
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 22, fontWeight: "900", color: COLORS.text, flex: 1, textAlign: "center" },
  iconBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, paddingBottom: 40, gap: 10 },
  actions: { flexDirection: "row", gap: 12, padding: 16 },
  card: {
    flex: 1, minWidth: 200, padding: 18, borderRadius: 16, alignItems: "center", gap: 6,
  },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
  cardSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600" },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, marginTop: 12, marginBottom: 8,
    paddingHorizontal: 12, height: 42, backgroundColor: COLORS.surface,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  tabRow: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 8,
    backgroundColor: COLORS.surface, borderRadius: 10, padding: 4,
    borderWidth: 1, borderColor: COLORS.border,
  },
  tab: {
    flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center",
  },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 14, fontWeight: "700", color: COLORS.textSecondary },
  tabTextActive: { color: "#fff" },
  empty: { color: COLORS.textSecondary, textAlign: "center", padding: 20 },
  row: {
    flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: COLORS.surface,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, gap: 8,
  },
  rowTitle: { fontSize: 14, fontWeight: "800", color: COLORS.text },
  rowSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  rowCreator: { fontSize: 11, color: COLORS.textDisabled, fontWeight: "600", marginTop: 3 },
  statusBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  statusBtnPending: { backgroundColor: "#FEF3C7" },
  statusBtnAccepted: { backgroundColor: "#DCFCE7" },
  statusBtnText: { fontSize: 12, fontWeight: "800" },
  denied: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 40 },
  deniedTitle: { fontSize: 22, fontWeight: "900", color: COLORS.text },
  deniedTxt: { color: COLORS.textSecondary, textAlign: "center" },
});
