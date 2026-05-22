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
  const [yearFilter, setYearFilter] = useState<Set<string>>(new Set());
  const [managerFilter, setManagerFilter] = useState("todos");
  const [managers, setManagers] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const [list, mgrs] = await Promise.all([
        api.listMateriales(undefined, false, undefined, false, undefined, undefined),
        api.listManagers().catch(() => []),
      ]);
      setProyectos(list || []);
      setManagers(mgrs || []);
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

  const toggleYear = (y: string) => {
    setYearFilter((prev) => {
      const next = new Set(prev);
      if (next.has(y)) next.delete(y); else next.add(y);
      return next;
    });
  };

  const markers: { pos: [number, number]; color: string; title: string }[] = [];
  const allPoints: [number, number][] = [];

  proyectos.forEach((p) => {
    if (!p.ubicacion) return;
    const st = p.project_status || "pendiente";
    if (hiddenStatuses.has(st)) return;
    // Filtro por año
    if (yearFilter.size > 0) {
      const fy = (p.fecha || "").slice(0, 4);
      if (fy && !yearFilter.has(fy)) return;
    }
    // Filtro por gestor
    if (managerFilter === "sin_gestor" && p.manager_id) return;
    if (managerFilter !== "todos" && managerFilter !== "sin_gestor" && p.manager_id !== managerFilter) return;
    const lat = Number(p.lat ?? p._lat);
    const lng = Number(p.lng ?? p._lng);
    // Excluir si no son números válidos O si caen en (0,0) — esto pasa
    // cuando lat/lng vienen como null y Number(null)===0, lo que mete a
    // todos los proyectos sin coordenadas en mitad del Atlántico y
    // fitBounds hace zoom máximo a la nada.
    if (isNaN(lat) || isNaN(lng)) return;
    if (lat === 0 && lng === 0) return;
    if (Math.abs(lat) < 0.1 && Math.abs(lng) < 0.1) return;
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
      {!isWide && <IOSHeader title="Mapa" showBack />}
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

        {/* Filtro por año y gestor */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Text style={{ fontSize: 11, fontWeight: "600", color: COLORS.textSecondary }}>Año:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", gap: 4 }}>
              {Array.from({ length: new Date().getFullYear() - 2021 }, (_, i) => String(2022 + i)).map((y) => (
                <TouchableOpacity key={y} style={[s.yearChip, yearFilter.has(y) && { backgroundColor: COLORS.primary + "22", borderColor: COLORS.primary }]} onPress={() => toggleYear(y)}>
                  <Text style={[s.yearChipText, yearFilter.has(y) && { color: COLORS.primary, fontWeight: "800" }]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Text style={{ fontSize: 11, fontWeight: "600", color: COLORS.textSecondary }}>Gestor:</Text>
          {Platform.OS === "web" ? (
            <select value={managerFilter} onChange={(e: any) => setManagerFilter(e.target.value)} style={{ fontSize: 11, fontWeight: "600", padding: 4, borderRadius: 6, borderColor: COLORS.border, backgroundColor: COLORS.surface, color: COLORS.text }}>
              <option value="todos">Todos</option>
              <option value="sin_gestor">Sin gestor</option>
              {managers.map((m: any) => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
            </select>
          ) : (
            <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.surface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border }} onPress={() => {
              const opts = ["todos", "sin_gestor", ...managers.map(m => m.id)];
              const idx = opts.indexOf(managerFilter);
              setManagerFilter(opts[(idx + 1) % opts.length]);
            }}>
              <Text style={{ fontSize: 11, color: COLORS.text }}>
                {managerFilter === "todos" ? "Todos" : managerFilter === "sin_gestor" ? "Sin gestor" : managers.find(m => m.id === managerFilter)?.name || "Gestor"}
              </Text>
              <Ionicons name="chevron-down" size={12} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

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
  yearChip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  yearChipText: { fontSize: 11, fontWeight: "600", color: COLORS.textSecondary },
});
