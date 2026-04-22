import { useCallback, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, clearToken, COLORS } from "../../src/api";
import ResponsiveLayout from "../../src/ResponsiveLayout";
import { useBreakpoint } from "../../src/useBreakpoint";

export default function PresupuestosIndex() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const [me, setMe] = useState<any>(null);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <View style={[s.actions, isWide && { maxWidth: 900, alignSelf: "center", width: "100%" }]}>
          <TouchableOpacity
            testID="btn-new-budget"
            style={[s.card, { backgroundColor: COLORS.primary }]}
            onPress={() => router.push("/presupuestos/nuevo")}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle" size={56} color="#fff" />
            <Text style={s.cardTitle}>Proyecto nuevo</Text>
            <Text style={s.cardSub}>Crear un presupuesto en blanco</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="btn-existing-budget"
            style={[s.card, { backgroundColor: "#8B5CF6" }]}
            onPress={() => router.push("/presupuestos/existente")}
            activeOpacity={0.85}
          >
            <Ionicons name="folder-open" size={56} color="#fff" />
            <Text style={s.cardTitle}>Proyecto existente</Text>
            <Text style={s.cardSub}>Enlazar a un proyecto ya creado</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.sectionTitle}>Presupuestos recientes</Text>
        {loading ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : budgets.length === 0 ? (
          <Text style={s.empty}>No hay presupuestos todavía</Text>
        ) : (
          <View style={{ gap: 10, maxWidth: isWide ? 900 : undefined, alignSelf: "center", width: "100%" }}>
            {budgets.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={s.row}
                onPress={() => router.push(`/presupuestos/${b.id}`)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle} numberOfLines={1}>
                    {b.n_proyecto ? `#${b.n_proyecto} · ` : ""}{b.cliente || b.nombre_instalacion || "Sin título"}
                  </Text>
                  <Text style={s.rowSub} numberOfLines={1}>
                    {b.nombre_instalacion || ""} {b.direccion ? `· ${b.direccion}` : ""}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
    </ResponsiveLayout>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 22, fontWeight: "900", color: COLORS.text, flex: 1, textAlign: "center" },
  iconBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 20, paddingBottom: 40, gap: 18 },
  actions: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  card: {
    flex: 1, minWidth: 220, padding: 22, borderRadius: 18, alignItems: "center", gap: 8,
  },
  cardTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  cardSub: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "600" },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: COLORS.text, marginTop: 10 },
  empty: { color: COLORS.textSecondary, textAlign: "center" },
  row: {
    flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: COLORS.surface,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  rowTitle: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  rowSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  denied: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 40 },
  deniedTitle: { fontSize: 22, fontWeight: "900", color: COLORS.text },
  deniedTxt: { color: COLORS.textSecondary, textAlign: "center" },
});
