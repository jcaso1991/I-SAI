import { useCallback, useState, lazy, Suspense } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ResponsiveLayout from "../src/ResponsiveLayout";
import { useBreakpoint } from "../src/useBreakpoint";
import { useThemedStyles } from "../src/theme";
import IOSHeader from "../src/ui/IOSHeader";
import { api, COLORS } from "../src/api";

const STATUS_COLORS: Record<string, string> = {
  pendiente: "#F59E0B", planificado: "#3B82F6", a_facturar: "#8B5CF6",
  facturado: "#10B981", terminado: "#6366F1", bloqueado: "#EF4444", anulado: "#6B7280",
};
const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente", planificado: "Planif.", a_facturar: "A facturar",
  facturado: "Facturado", terminado: "Terminado", bloqueado: "Bloqueado", anulado: "Anulado",
};

// Lazy-load Leaflet map (solo web)
const LeafletMap = lazy(() => import("../src/LeafletMap"));

export default function MapaScreen() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const s = useThemedStyles(useS);
  const [proyectos, setProyectos] = useState<any[]>([]);
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const list = await api.listMateriales(undefined, false, undefined, false, undefined, undefined);
      setProyectos(list || []);
    } catch { setProyectos([]); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleStatus = (st: string) => {
    setHiddenStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(st)) next.delete(st); else next.add(st);
      return next;
    });
  };

  const markers: { pos: [number, number]; color: string; title: string }[] = [];
  const allPoints: [number, number][] = [];

  proyectos.forEach((p) => {
    if (!p.ubicacion) return;
    const st = p.project_status || "pendiente";
    if (hiddenStatuses.has(st)) return;
    const lat = Number(p.lat ?? p._lat);
    const lng = Number(p.lng ?? p._lng);
    if (isNaN(lat) || isNaN(lng)) return;
    const color = STATUS_COLORS[st] || "#999";
    const label = STATUS_LABELS[st] || st;
    markers.push({
      pos: [lat, lng],
      color,
      title: `${p.materiales || "—"} — ${p.cliente || ""}<br/>${p.ubicacion || ""} [${label}]`,
    });
    allPoints.push([lat, lng]);
  });

  const content = (
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      {!isWide && <IOSHeader title="Mapa" />}
      <View style={s.body}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtersRow}>
          {Object.entries(STATUS_COLORS).map(([st, color]) => (
            <TouchableOpacity
              key={st}
              style={[s.filterChip, !hiddenStatuses.has(st) && { backgroundColor: color + "22", borderColor: color }]}
              onPress={() => toggleStatus(st)}
            >
              <View style={[s.filterDot, { backgroundColor: hiddenStatuses.has(st) ? COLORS.textDisabled : color }]} />
              <Text style={[s.filterLabel, hiddenStatuses.has(st) && { color: COLORS.textDisabled }]}>
                {STATUS_LABELS[st]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {Platform.OS === "web" ? (
          <View style={{ flex: 1, borderRadius: 10, overflow: "hidden", minHeight: 500 }}>
            <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />}>
              <LeafletMap markers={markers} allPoints={allPoints} />
            </Suspense>
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="map-outline" size={48} color={COLORS.textDisabled} />
            <Text style={{ color: COLORS.textSecondary, marginTop: 10 }}>Mapa solo disponible en web</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );

  return <ResponsiveLayout active="proyectos">{content}</ResponsiveLayout>;
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  body: { flex: 1, padding: 10 },
  filtersRow: { maxHeight: 40, marginBottom: 8, flexGrow: 0 },
  filterChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
    borderWidth: 1, borderColor: COLORS.border, marginRight: 6,
    backgroundColor: COLORS.surface,
  },
  filterDot: { width: 8, height: 8, borderRadius: 4 },
  filterLabel: { fontSize: 11, fontWeight: "600", color: COLORS.text },
});
