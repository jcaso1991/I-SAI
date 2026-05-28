import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS } from "../../src/api";
import ResponsiveLayout from "../../src/ResponsiveLayout";
import { useBreakpoint } from "../../src/useBreakpoint";
import { useThemedStyles } from "../../src/theme";
import { ios } from "../../src/ui/iosTheme";

const STATUSES = [
  { key: "todas", label: "Todas" },
  { key: "pendiente", label: "Pendientes" },
  { key: "tramitado", label: "Tramitadas" },
];

const STATUS_COLORS: Record<string, string> = {
  pendiente: "#F59E0B",
  tramitado: "#10B981",
  revisado: "#3B82F6",
  presupuestado: "#10B981",
};

export default function SolicitudesScreen() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const s = useThemedStyles(useS);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("todas");
  const [selected, setSelected] = useState<any | null>(null);

  const load = () => {
    api.listBudgetRequests().then(setRequests).catch(() => {}).finally(() => setLoading(false));
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const markAsTramitado = async (id: string) => {
    try {
      await api.updateBudgetRequest(id, { status: "tramitado" });
      Alert.alert("Listo", "Solicitud marcada como tramitada");
      load();
      setSelected(null);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const filtered = tab === "todas"
    ? requests
    : requests.filter((r) => (r.status || "pendiente") === tab);

  // Vista detalle
  if (selected) {
    const r = selected;
    const color = STATUS_COLORS[r.status] || "#F59E0B";
    return (
      <ResponsiveLayout active="admin">
        <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
          <View style={s.header}>
            <TouchableOpacity style={s.iconBtn} onPress={() => setSelected(null)}>
              <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Pedido</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={s.scroll}>
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Text style={s.cardName}>{r.client_name}</Text>
                <View style={[s.statusBadge, { backgroundColor: color + "20" }]}>
                  <Text style={[s.statusText, { color }]}>{r.status || "pendiente"}</Text>
                </View>
              </View>
              <Text style={s.detailLabel}>Contacto</Text>
              <Text style={s.cardInfo}>📧 {r.client_email}</Text>
              <Text style={s.cardInfo}>📞 {r.client_phone}</Text>
              <Text style={s.detailLabel}>Dirección de envío</Text>
              <Text style={s.cardInfo}>📍 {r.client_address}</Text>
              <Text style={s.cardInfo}>🏙️ {[r.client_city, r.client_postal, r.client_province].filter(Boolean).join(", ")}</Text>
              <Text style={s.detailLabel}>Fecha</Text>
              <Text style={s.cardInfo}>{new Date(r.created_at).toLocaleString("es-ES")}</Text>
            </View>

            <Text style={s.sectionTitle}>Productos solicitados</Text>
            {(r.items || []).map((item: any, i: number) => (
              <View key={i} style={s.productRow}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={s.productThumb} resizeMode="contain" />
                ) : (
                  <View style={[s.productThumb, { backgroundColor: COLORS.bg }]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.productName}>{item.variant || item.family}</Text>
                  <Text style={s.productFamily}>{item.family}</Text>
                </View>
                <View style={s.qtyBadge}>
                  <Text style={s.qtyBadgeText}>x{item.quantity}</Text>
                </View>
              </View>
            ))}

            {r.status !== "tramitado" && (
              <TouchableOpacity style={s.tramitarBtn} onPress={() => markAsTramitado(r.id)}>
                <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
                <Text style={s.tramitarBtnText}>Marcar como tramitado</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </SafeAreaView>
      </ResponsiveLayout>
    );
  }

  // Vista lista
  return (
    <ResponsiveLayout active="admin">
      <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
        <View style={s.header}>
          {!isWide && (
            <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
            </TouchableOpacity>
          )}
          <Text style={s.headerTitle}>Solicitudes de Presupuesto</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Tabs */}
        <View style={s.tabRow}>
          {STATUSES.map((st) => (
            <TouchableOpacity
              key={st.key}
              style={[s.tab, tab === st.key && s.tabActive]}
              onPress={() => setTab(st.key)}
            >
              <Text style={[s.tabText, tab === st.key && s.tabTextActive]}>
                {st.label} ({st.key === "todas" ? requests.length : requests.filter((r) => (r.status || "pendiente") === st.key).length})
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll}>
          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
          ) : filtered.length === 0 ? (
            <Text style={s.empty}>No hay solicitudes</Text>
          ) : (
            filtered.map((r) => (
              <TouchableOpacity key={r.id} style={s.card} onPress={() => setSelected(r)} activeOpacity={0.7}>
                <View style={s.cardHeader}>
                  <Text style={s.cardName}>{r.client_name}</Text>
                  <View style={[s.statusBadge, { backgroundColor: (STATUS_COLORS[r.status] || "#F59E0B") + "20" }]}>
                    <Text style={[s.statusText, { color: STATUS_COLORS[r.status] || "#F59E0B" }]}>{r.status || "pendiente"}</Text>
                  </View>
                </View>
                <Text style={s.cardInfo}>📧 {r.client_email}  📞 {r.client_phone}</Text>
                <Text style={s.cardInfo}>📍 {r.client_address}, {r.client_city} {r.client_postal} ({r.client_province})</Text>
                <Text style={s.cardDate}>{new Date(r.created_at).toLocaleDateString("es-ES")}</Text>
                <View style={s.itemsList}>
                  {(r.items || []).slice(0, 3).map((item: any, i: number) => (
                    <Text key={i} style={s.itemRow}>• {item.quantity}x {item.variant || item.family}</Text>
                  ))}
                  {(r.items || []).length > 3 && (
                    <Text style={[s.itemRow, { color: COLORS.primary }]}>+{(r.items || []).length - 3} más</Text>
                  )}
                </View>
                <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                  <Text style={{ fontSize: 11, color: COLORS.primary, fontWeight: "700" }}>Ver detalle →</Text>
                </View>
              </TouchableOpacity>
            ))
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
    paddingHorizontal: ios.spacing.lg, paddingVertical: 12, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 20, fontWeight: "900", color: COLORS.text, flex: 1, textAlign: "center" },
  iconBtn: { width: 40, height: 40, borderRadius: ios.radius.md, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  tabRow: {
    flexDirection: "row", marginHorizontal: 12, marginVertical: 8,
    backgroundColor: COLORS.surface, borderRadius: ios.radius.pill, padding: 4,
    borderWidth: 1, borderColor: COLORS.border,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: ios.radius.pill, alignItems: "center" },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: "700", color: COLORS.textSecondary },
  tabTextActive: { color: "#fff" },
  scroll: { padding: 12, gap: 10, paddingBottom: 40 },
  empty: { color: COLORS.textSecondary, textAlign: "center", padding: 20 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: ios.radius.lg,
    borderWidth: 1, borderColor: COLORS.border, padding: 14, gap: 6,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardName: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: ios.radius.pill },
  statusText: { fontSize: 11, fontWeight: "700" },
  cardInfo: { fontSize: 12, color: COLORS.textSecondary },
  cardDate: { fontSize: 11, color: COLORS.textDisabled },
  itemsList: { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 2 },
  itemRow: { fontSize: 12, color: COLORS.text },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text, marginTop: 8, marginBottom: 8 },
  detailLabel: { fontSize: 11, fontWeight: "700", color: COLORS.textDisabled, textTransform: "uppercase", marginTop: 8, marginBottom: 2 },
  productRow: {
    flexDirection: "row", alignItems: "center", padding: 10, gap: 10,
    backgroundColor: COLORS.surface, borderRadius: ios.radius.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  productThumb: { width: 44, height: 44, borderRadius: ios.radius.sm },
  productName: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  productFamily: { fontSize: 11, color: COLORS.textSecondary },
  qtyBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: ios.radius.pill,
    backgroundColor: COLORS.primarySoft,
  },
  qtyBadgeText: { fontSize: 13, fontWeight: "800", color: COLORS.primary },
  tramitarBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 20, paddingVertical: 14, backgroundColor: "#10B981",
    borderRadius: ios.radius.md,
  },
  tramitarBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },
});
