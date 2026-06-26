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

const SAT_STATUS_COLORS: Record<string, string> = {
  pendiente: "#F59E0B",
  agendada: "#3B82F6",
  programada: "#3B82F6",
  resuelta: "#8B5CF6",
  resuelta_facturar: "#8B5CF6",
  resuelta_garantia: "#10B981",
};
const SAT_STATUS_LABELS: Record<string, string> = {
  pendiente: "Aviso recibido",
  agendada: "Agendada",
  programada: "Programada",
  resuelta: "Resuelta",
  resuelta_facturar: "Facturable",
  resuelta_garantia: "Garantía",
};

const SAT_FILTER_GROUPS: { key: string; label: string; color: string; match: string[] }[] = [
  { key: "pendiente", label: "Aviso recibido", color: "#F59E0B", match: ["pendiente"] },
  { key: "agendada", label: "Agendada", color: "#3B82F6", match: ["agendada", "programada"] },
  { key: "resuelta", label: "Resuelta", color: "#8B5CF6", match: ["resuelta", "resuelta_facturar", "resuelta_garantia"] },
];

const LeafletMap = lazy(() => import("../src/LeafletMap"));

// Cache de geocodificación: dirección → [lat, lng]
const geocodeCache: Record<string, [number, number] | null> = {};

async function geocodeDelay() {
  await new Promise((r) => setTimeout(r, 1100)); // 1.1s para respetar rate limit de Nominatim
}

async function geocodeDireccion(dir: string): Promise<[number, number] | null> {
  if (!dir || !dir.trim()) return null;
  const key = dir.trim().toLowerCase();
  if (key in geocodeCache) return geocodeCache[key];

  try {
    await geocodeDelay();
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(dir.trim())}&limit=1&countrycodes=es`;
    const res = await fetch(url, { headers: { "User-Agent": "i-SAI/1.0" } });
    const data = await res.json();
    if (data && data.length > 0) {
      const result: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      geocodeCache[key] = result;
      return result;
    }
    geocodeCache[key] = null;
    return null;
  } catch {
    geocodeCache[key] = null;
    return null;
  }
}

function hasCoords(inc: any): boolean {
  const lat = Number(inc.lat ?? inc._lat);
  const lng = Number(inc.lng ?? inc._lng);
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  if (Math.abs(lat) < 0.1 && Math.abs(lng) < 0.1) return false;
  return true;
}

export default function MapaSatScreen() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const s = useThemedStyles(useS);
  const [incidencias, setIncidencias] = useState<any[]>([]);
  const [geocoded, setGeocoded] = useState<Record<string, [number, number]>>({});
  const [geocoding, setGeocoding] = useState(false);
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const list = await api.satList();
      const items = list || [];
      setIncidencias(items);

      // Geocodificar las que tienen dirección pero no coordenadas
      const toGeocode = items.filter((i: any) => i.direccion && i.direccion.trim() && !hasCoords(i));
      if (toGeocode.length > 0) {
        setGeocoding(true);
        const newCoords: Record<string, [number, number]> = { ...geocoded };
        for (const inc of toGeocode) {
          const coords = await geocodeDireccion(inc.direccion);
          if (coords) newCoords[inc.id] = coords;
        }
        setGeocoded(newCoords);
        setGeocoding(false);
      }
    } catch { setIncidencias([]); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleStatus = (groupKey: string) => {
    setHiddenStatuses((prev) => {
      const next = new Set(prev);
      const group = SAT_FILTER_GROUPS.find((g) => g.key === groupKey);
      if (!group) return prev;
      // Si alguno del grupo está oculto, mostramos todos; si no, ocultamos todos
      const anyHidden = group.match.some((s) => next.has(s));
      if (anyHidden) {
        group.match.forEach((s) => next.delete(s));
      } else {
        group.match.forEach((s) => next.add(s));
      }
      return next;
    });
  };

  const isGroupHidden = (groupKey: string) => {
    const group = SAT_FILTER_GROUPS.find((g) => g.key === groupKey);
    if (!group) return false;
    return group.match.every((s) => hiddenStatuses.has(s));
  };

  const markers = useMemo(() => {
    const result: { pos: [number, number]; color: string; title: string }[] = [];
    const allPts: [number, number][] = [];
    incidencias.forEach((inc) => {
      const st = inc.status || "pendiente";
      if (hiddenStatuses.has(st)) return;

      // Usar coordenadas propias o geocodificadas
      let lat: number, lng: number;
      if (hasCoords(inc)) {
        lat = Number(inc.lat ?? inc._lat);
        lng = Number(inc.lng ?? inc._lng);
      } else if (geocoded[inc.id]) {
        [lat, lng] = geocoded[inc.id];
      } else {
        return;
      }

      const color = SAT_STATUS_COLORS[st] || "#999";
      const label = SAT_STATUS_LABELS[st] || st;
      const fact = inc.facturable ? " [Facturable]" : "";
      result.push({
        pos: [lat, lng],
        color,
        title: `${inc.cliente || "—"}<br/>${inc.direccion || ""}<br/>${inc.observaciones || ""} [${label}${fact}]`,
      });
      allPts.push([lat, lng]);
    });
    return { markers: result, allPoints: allPts };
  }, [incidencias, hiddenStatuses, geocoded]);

  const totalConCoords = useMemo(() => {
    return incidencias.filter((i) => hasCoords(i) || geocoded[i.id]).length;
  }, [incidencias, geocoded]);

  const content = (
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      {!isWide && <IOSHeader title="Mapa SAT" showBack />}
      <View style={s.body}>
        <Text style={s.infoText}>
          {totalConCoords} de {incidencias.length} incidencias localizadas
          {geocoding && " (geolocalizando...)"}
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtersRow}>
          {SAT_FILTER_GROUPS.map((group) => {
            const hidden = isGroupHidden(group.key);
            return (
              <TouchableOpacity
                key={group.key}
                style={[s.filterChip, !hidden && { backgroundColor: group.color + "22", borderColor: group.color }]}
                onPress={() => toggleStatus(group.key)}
              >
                <View style={[s.filterDot, { backgroundColor: hidden ? COLORS.textDisabled : group.color }]} />
                <Text style={[s.filterLabel, hidden && { color: COLORS.textDisabled }]}>
                  {group.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {geocoding && (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={{ color: COLORS.textSecondary, marginTop: 8 }}>
              Geolocalizando direcciones...
            </Text>
          </View>
        )}

        {!geocoding && totalConCoords === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Ionicons name="warning-outline" size={24} color={COLORS.textDisabled} />
            <Text style={{ color: COLORS.textSecondary, marginTop: 8, textAlign: "center" }}>
              No se encontraron ubicaciones para las incidencias.
            </Text>
          </View>
        )}

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

  return <ResponsiveLayout active="sat">{content}</ResponsiveLayout>;
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  body: { flex: 1, padding: ios.spacing.sm },
  infoText: { ...fontStyle("caption"), color: COLORS.textSecondary, marginBottom: ios.spacing.sm, textAlign: "center" },
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
});
