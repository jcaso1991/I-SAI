import { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, getToken } from "../../src/api";
import ResponsiveLayout from "../../src/ResponsiveLayout";
import { useThemedStyles } from "../../src/theme";
import { useBreakpoint } from "../../src/useBreakpoint";
import { ios, fontStyle } from "../../src/ui/iosTheme";

function fmtEur(v: number | null | undefined): string {
  if (v == null || v === 0) return "—";
  return Number(v).toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(v: number): string {
  if (v == null || v === 0) return "—";
  return `${v}%`;
}

function pctColor(v: number): string {
  if (v > 100) return COLORS.errorText;
  if (v > 80) return COLORS.pendingText;
  if (v > 50) return COLORS.primary;
  return COLORS.textSecondary;
}

function avanceColor(v: number): string {
  if (v > 90) return COLORS.syncedText;
  if (v > 50) return COLORS.pendingText;
  if (v > 25) return COLORS.primary;
  return COLORS.textSecondary;
}

export default function ObraEnCurso() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const s = useThemedStyles(useS);

  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const token = await getToken();
        const base = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/+$/, "");
        const res = await fetch(`${base}/api/dashboard/obra-en-curso`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e: any) {} finally { setLoading(false); }
    })();
  }, []));

  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const proyectos: any[] = data?.proyectos || [];

  return (
    <ResponsiveLayout active="ventas-beneficios">
      <SafeAreaView style={s.root} edges={["top"]}>
        <View style={s.header}>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.replace("/dashboard/ventas-beneficios")}>
            <Ionicons name="chevron-back" size={26} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Obra en curso</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={[s.scroll, isWide && s.scrollWide]}
          showsVerticalScrollIndicator={false}
        >

          {data && (
            <View style={s.kpiRow}>
              <View style={s.kpiCard}>
                <Text style={s.kpiValue}>{data.total_proyectos}</Text>
                <Text style={s.kpiLabel}>Proyectos en curso</Text>
              </View>
              <View style={s.kpiCard}>
                <Text style={s.kpiValue}>{fmtEur(data.total_coste_incurrido)}</Text>
                <Text style={s.kpiLabel}>Coste incurrido total</Text>
              </View>
              <View style={s.kpiCard}>
                <Text style={s.kpiValue}>{fmtEur(data.total_ingreso_reconocido)}</Text>
                <Text style={s.kpiLabel}>Ingreso reconocido</Text>
              </View>
            </View>
          )}

          <View style={s.sectionHeader}>
            <Ionicons name="construct" size={20} color={COLORS.primary} />
            <Text style={s.sectionTitle}>Proyectos con costes reales ({proyectos.length})</Text>
          </View>

          <View style={s.tableHeader}>
            <Text style={[s.th, { flex: 1.8 }]}>Proyecto</Text>
            <Text style={[s.th, { flex: 1, textAlign: "center" }]}>% Material</Text>
            <Text style={[s.th, { flex: 1, textAlign: "center" }]}>% M.Obra</Text>
            <Text style={[s.th, { flex: 1, textAlign: "center" }]}>Grado Avance</Text>
            <Text style={[s.th, { flex: 1.2, textAlign: "right" }]}>Ingreso Rec.</Text>
          </View>

          {proyectos.map((p: any) => (
            <TouchableOpacity
              key={p.id}
              style={s.tableRow}
              onPress={() => router.push(`/material/${p.id}` as any)}
            >
              <View style={{ flex: 1.8 }}>
                <Text style={s.cellName} numberOfLines={1}>{p.materiales || "—"}</Text>
                <Text style={s.cellSub} numberOfLines={1}>{p.cliente || ""}</Text>
              </View>
              <View style={{ flex: 1, alignItems: "center" }}>
                <View style={[s.pctBar, { width: `${Math.min(p.pct_mat, 100)}%`, backgroundColor: pctColor(p.pct_mat) }]}>
                  <Text style={s.pctText}>{fmtPct(p.pct_mat)}</Text>
                </View>
              </View>
              <View style={{ flex: 1, alignItems: "center" }}>
                <View style={[s.pctBar, { width: `${Math.min(p.pct_mo, 100)}%`, backgroundColor: pctColor(p.pct_mo) }]}>
                  <Text style={s.pctText}>{fmtPct(p.pct_mo)}</Text>
                </View>
              </View>
              <View style={{ flex: 1, alignItems: "center" }}>
                <View style={[s.avanceRing, { borderColor: avanceColor(p.grado_avance) }]}>
                  <Text style={[s.avanceText, { color: avanceColor(p.grado_avance) }]}>{p.grado_avance}%</Text>
                </View>
              </View>
              <Text style={[s.cell, { flex: 1.2, textAlign: "right", fontWeight: "700" }]}>{fmtEur(p.ingreso_reconocido)}</Text>
            </TouchableOpacity>
          ))}

          <View style={{ height: 80 }} />
        </ScrollView>
      </SafeAreaView>
    </ResponsiveLayout>
  );
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: ios.spacing.md, paddingVertical: ios.spacing.sm,
    backgroundColor: COLORS.surface, borderBottomWidth: ios.hairline, borderBottomColor: COLORS.border,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { ...fontStyle("title3"), color: COLORS.text, fontWeight: "800" },
  scroll: { padding: ios.spacing.lg, gap: 12 },
  scrollWide: { maxWidth: 1100, alignSelf: "center", width: "100%" },
  kpiRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  kpiCard: {
    flex: 1, minWidth: 140, backgroundColor: COLORS.surface,
    borderRadius: ios.radius.lg, padding: ios.spacing.md, borderWidth: 1, borderColor: COLORS.border,
    alignItems: "center",
  },
  kpiValue: { ...fontStyle("title1"), color: COLORS.text, fontWeight: "900" },
  kpiLabel: { ...fontStyle("caption"), color: COLORS.textSecondary, marginTop: 4, textAlign: "center" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  sectionTitle: { ...fontStyle("title3"), color: COLORS.text, fontWeight: "800" },
  tableHeader: {
    flexDirection: "row", gap: 8, paddingVertical: 8,
    borderBottomWidth: 2, borderBottomColor: COLORS.border,
  },
  th: { ...fontStyle("caption"), color: COLORS.textSecondary, fontWeight: "800", letterSpacing: 1 },
  tableRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 10, borderBottomWidth: ios.hairline, borderBottomColor: COLORS.border,
  },
  cellName: { ...fontStyle("callout"), color: COLORS.text, fontWeight: "700" },
  cellSub: { ...fontStyle("caption"), color: COLORS.textSecondary, marginTop: 1 },
  cell: { ...fontStyle("callout"), color: COLORS.text },
  pctBar: {
    height: 22, borderRadius: 6, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    minWidth: 50,
  },
  pctText: { fontSize: 10, fontWeight: "800", color: COLORS.text },
  avanceRing: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 3,
    alignItems: "center", justifyContent: "center",
  },
  avanceText: { fontSize: 10, fontWeight: "900" },
});
