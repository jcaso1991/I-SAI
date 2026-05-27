import { useCallback, useMemo, useState, lazy, Suspense } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ResponsiveLayout from "../src/ResponsiveLayout";
import { useBreakpoint } from "../src/useBreakpoint";
import { useThemedStyles } from "../src/theme";
import IOSHeader from "../src/ui/IOSHeader";
import { api, COLORS } from "../src/api";
import { ios, fontStyle } from "../src/ui/iosTheme";

const STATUS_COLORS: Record<string, string> = {
  pendiente: "#F59E0B", planificado: "#3B82F6", a_facturar: "#8B5CF6",
  facturado: "#10B981", terminado: "#6366F1", bloqueado: "#EF4444", anulado: "#6B7280",
  en_curso: "#06B6D4", completado: "#22C55E", cancelado: "#DC2626",
};
const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente", planificado: "Planif.", a_facturar: "A facturar",
  facturado: "Facturado", terminado: "Terminado", bloqueado: "Bloqueado", anulado: "Anulado",
  en_curso: "En curso", completado: "Completado", cancelado: "Cancelado",
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

  const markers = useMemo(() => {
    const result: { pos: [number, number]; color: string; title: string }[] = [];
    const allPts: [number, number][] = [];
    proyectos.forEach((p) => {
      if (!p.ubicacion) return;
      const st = p.project_status || "pendiente";
      if (hiddenStatuses.has(st)) return;
      if (yearFilter.size > 0) {
        const fy = (p.fecha || "").slice(0, 4);
        if (fy && !yearFilter.has(fy)) return;
      }
      if (managerFilter === "sin_gestor" && p.manager_id) return;
      if (managerFilter !== "todos" && managerFilter !== "sin_gestor" && p.manager_id !== managerFilter) return;
      const lat = Number(p.lat ?? p._lat);
      const lng = Number(p.lng ?? p._lng);
      if (isNaN(lat) || isNaN(lng)) return;
      if (lat === 0 && lng === 0) return;
      if (Math.abs(lat) < 0.1 && Math.abs(lng) < 0.1) return;
      const color = STATUS_COLORS[st] || "#999";
      const label = STATUS_LABELS[st] || st;
      result.push({
        pos: [lat, lng],
        color,
        title: `${p.materiales || "—"} — ${p.cliente || ""}<br/>${p.ubicacion || ""} [${label}]`,
      });
      allPts.push([lat, lng]);
    });
    return { markers: result, allPoints: allPts };
  }, [proyectos, hiddenStatuses, yearFilter, managerFilter]);

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
        <View style={{ flexDirection: "row", gap: ios.spacing.sm, marginBottom: ios.spacing.sm, flexWrap: "wrap", alignItems: "center" }}>
          <Text style={{ ...fontStyle("section"), color: COLORS.textSecondary }}>Año:</Text>
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: ios.spacing.sm, marginBottom: ios.spacing.sm }}>
          <Text style={{ ...fontStyle("section"), color: COLORS.textSecondary }}>Gestor:</Text>
          {Platform.OS === "web" ? (
            <select value={managerFilter} onChange={(e: any) => setManagerFilter(e.target.value)} style={{ ...fontStyle("subhead"), paddingVertical: 4, paddingHorizontal: ios.spacing.sm, borderRadius: ios.radius.sm, borderColor: COLORS.border, backgroundColor: COLORS.surface, color: COLORS.text, outline: "none" }}>
              <option value="todos">Todos</option>
              <option value="sin_gestor">Sin gestor</option>
              {managers.map((m: any) => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
            </select>
          ) : (
            <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: ios.spacing.xs, backgroundColor: COLORS.surface, paddingHorizontal: ios.spacing.sm, paddingVertical: ios.spacing.xs, borderRadius: ios.radius.sm, borderWidth: 1, borderColor: COLORS.border }} onPress={() => {
              const opts = ["todos", "sin_gestor", ...managers.map(m => m.id)];
              const idx = opts.indexOf(managerFilter);
              setManagerFilter(opts[(idx + 1) % opts.length]);
            }}>
              <Text style={{ ...fontStyle("subhead"), color: COLORS.text }}>
                {managerFilter === "todos" ? "Todos" : managerFilter === "sin_gestor" ? "Sin gestor" : managers.find(m => m.id === managerFilter)?.name || "Gestor"}
              </Text>
              <Ionicons name="chevron-down" size={12} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {Platform.OS === "web" ? (
          <View style={{ flex: 1, borderRadius: ios.radius.lg, overflow: "hidden", minHeight: 500, ...ios.shadow.card }}>
            <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />}>
              <LeafletMap markers={markers.markers} allPoints={markers.allPoints} />
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
  body: { flex: 1, padding: ios.spacing.sm },
  filtersRow: { maxHeight: 44, marginBottom: ios.spacing.sm, flexGrow: 0 },
  filterChip: {
    flexDirection: "row", alignItems: "center", gap: ios.spacing.xs,
    paddingHorizontal: ios.spacing.md, paddingVertical: 7,
    borderRadius: ios.radius.pill,
    borderWidth: 1, borderColor: COLORS.border, marginRight: 6,
    backgroundColor: COLORS.surface,
  },
  filterDot: { width: 10, height: 10, borderRadius: 5 },
  filterLabel: { ...fontStyle("subhead"), fontWeight: "600", color: COLORS.text },
  yearChip: {
    paddingHorizontal: ios.spacing.sm, paddingVertical: 4,
    borderRadius: ios.radius.pill,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  yearChipText: { ...fontStyle("caption"), fontWeight: "600", color: COLORS.textSecondary },
});
