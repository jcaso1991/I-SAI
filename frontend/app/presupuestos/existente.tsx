import { useCallback, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, clearToken, COLORS } from "../../src/api";
import ResponsiveLayout from "../../src/ResponsiveLayout";
import { useBreakpoint } from "../../src/useBreakpoint";
import { useThemedStyles } from "../../src/theme";
import { ios } from "../../src/ui/iosTheme";

export default function PresupuestoExistente() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const s = useThemedStyles(useS);
  const [me, setMe] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      try {
        const [u, list] = await Promise.all([api.me(), api.listMateriales(q || undefined)]);
        if (!alive) return;
        setMe(u); setItems(list);
      } catch (e: any) {
        if (/401|expired/i.test(e?.message || "")) { await clearToken(); router.replace("/login"); }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [q]));

  return (
    <ResponsiveLayout active="presupuestos" isAdmin={me?.role === "admin"} userName={me?.name}
      onLogout={async () => { await clearToken(); router.replace("/login"); }}>
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.replace("/presupuestos")}>
          <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Seleccionar proyecto</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={s.searchRow}>
        <Ionicons name="search" size={18} color={COLORS.textSecondary} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Buscar cliente o proyecto..."
          placeholderTextColor={COLORS.textDisabled}
          style={s.searchInput}
        />
        {q.length > 0 && (
          <TouchableOpacity onPress={() => setQ("")}>
            <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      {loading ? (
        <View style={{ padding: 16, gap: 10 }}>
          {[1, 2, 3, 4, 5].map((i) => <View key={i} style={s.skeleton} />)}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 10, maxWidth: isWide ? 900 : undefined, alignSelf: isWide ? "center" : undefined, width: "100%" }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.row}
              onPress={() => router.push(`/presupuestos/nuevo?material_id=${item.id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{item.materiales || "Sin código"}</Text>
                <Text style={s.rowSub}>{item.cliente || "Sin cliente"} · {item.ubicacion || "—"}</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={{ textAlign: "center", color: COLORS.textSecondary, padding: 20 }}>Sin resultados</Text>}
        />
      )}
    </SafeAreaView>
    </ResponsiveLayout>
  );
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "800", color: COLORS.text, letterSpacing: -0.3 },
  iconBtn: { width: 40, height: 40, borderRadius: ios.radius.md, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginTop: 12, paddingHorizontal: 16, height: 48,
    borderRadius: ios.radius.md, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row", alignItems: "center", padding: ios.spacing.lg,
    backgroundColor: COLORS.surface,
    borderRadius: ios.radius.lg, borderWidth: 1, borderColor: COLORS.border,
    ...ios.shadow.card,
  },
  rowTitle: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  rowSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  skeleton: {
    height: 72, borderRadius: ios.radius.lg, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 10,
  },
});
