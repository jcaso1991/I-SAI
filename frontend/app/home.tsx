import { useCallback, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { api, clearToken, COLORS } from "../src/api";
import ResponsiveLayout from "../src/ResponsiveLayout";
import { useBreakpoint } from "../src/useBreakpoint";

// Elegant greeting based on local hour.
function greetingForNow(): string {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

// Spanish formatted date, e.g. "Martes, 22 de abril de 2026".
function spanishToday(): string {
  try {
    const d = new Date().toLocaleDateString("es-ES", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
    });
    return d.charAt(0).toUpperCase() + d.slice(1);
  } catch {
    return "";
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ total: number; pending: number; synced: number } | null>(null);

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      try {
        const [u, st] = await Promise.all([api.me(), api.stats().catch(() => null)]);
        if (!alive) return;
        setMe(u);
        setStats(st);
      } catch (e: any) {
        if (/401|Invalid|expired/i.test(e?.message || "")) {
          await clearToken();
          router.replace("/login");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []));

  const isAdmin = me?.role === "admin";
  const logout = async () => { await clearToken(); router.replace("/login"); };
  const firstName = me?.name ? me.name.split(" ")[0] : "";

  // ---------- Action tile ----------
  const ActionTile = ({
    testID, icon, iconFamily = "ion", title, subtitle, accent, onPress, badge,
  }: {
    testID: string; icon: string; iconFamily?: "ion" | "mat";
    title: string; subtitle: string; accent: string;
    onPress: () => void; badge?: string;
  }) => (
    <TouchableOpacity testID={testID} style={[s.tile, isWide && s.tileWide]} onPress={onPress} activeOpacity={0.85}>
      <View style={[s.tileIcon, { backgroundColor: accent + "1A", borderColor: accent + "33" }]}>
        {iconFamily === "ion" ? (
          <Ionicons name={icon as any} size={28} color={accent} />
        ) : (
          <MaterialCommunityIcons name={icon as any} size={28} color={accent} />
        )}
        {badge ? (
          <View style={[s.tileBadge, { backgroundColor: accent }]}>
            <Text style={s.tileBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={s.tileTitle}>{title}</Text>
      <Text style={s.tileSubtitle}>{subtitle}</Text>
      <View style={s.tileArrow}>
        <Ionicons name="arrow-forward" size={16} color={accent} />
      </View>
    </TouchableOpacity>
  );

  const StatCard = ({
    icon, value, label, accent,
  }: { icon: string; value: number | string; label: string; accent: string }) => (
    <View style={s.statCard}>
      <View style={[s.statIcon, { backgroundColor: accent + "1A" }]}>
        <Ionicons name={icon as any} size={18} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.statVal}>{value}</Text>
        <Text style={s.statLbl}>{label}</Text>
      </View>
    </View>
  );

  const content = (
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      {/* Mobile: compact header on top */}
      {!isWide && (
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.greetingSmall}>{greetingForNow()}</Text>
            <Text style={s.helloSmall}>{firstName || "Bienvenido"}</Text>
          </View>
          <TouchableOpacity
            testID="btn-logout"
            style={s.logoutBtn}
            onPress={logout}
          >
            <Ionicons name="log-out-outline" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={[s.scroll, isWide && s.scrollWide]}>
          <View style={isWide ? s.wideWrap : undefined}>

            {/* Desktop hero */}
            {isWide && (
              <View style={s.hero}>
                <Text style={s.heroGreet}>{greetingForNow()},</Text>
                <Text style={s.heroName}>{firstName || "Bienvenido"} 👋</Text>
                <Text style={s.heroDate}>{spanishToday()}</Text>
              </View>
            )}

            {/* Stats cards row */}
            {stats && (
              <View style={[s.statsRow, !isWide && { marginTop: 16 }]}>
                <StatCard icon="folder" value={stats.total} label="Proyectos totales" accent={COLORS.primary} />
                <StatCard icon="time" value={stats.pending} label="Pendientes" accent="#F59E0B" />
                <StatCard icon="checkmark-circle" value={stats.synced} label="Sincronizados" accent="#10B981" />
              </View>
            )}

            {/* Section header */}
            <Text style={[s.sectionLabel, { marginTop: 28 }]}>ACCESOS RÁPIDOS</Text>

            {/* Action tiles grid */}
            <View style={[s.tilesGrid, isWide && s.tilesGridWide]}>
              <ActionTile
                testID="circle-proyectos"
                iconFamily="mat"
                icon="set-square"
                title="Proyectos"
                subtitle="Gestiona la base sincronizada con OneDrive"
                accent={COLORS.primary}
                onPress={() => router.push("/materiales")}
                badge={stats && stats.pending > 0 ? String(stats.pending) : undefined}
              />
              <ActionTile
                testID="circle-calendario"
                icon="calendar"
                title="Calendario"
                subtitle="Planifica y arrastra eventos por equipo"
                accent="#10B981"
                onPress={() => router.push("/calendario")}
              />
              <ActionTile
                testID="circle-planos"
                icon="map"
                title="Planos"
                subtitle="Dibuja sobre PDFs y añade símbolos"
                accent="#F59E0B"
                onPress={() => router.push("/planos")}
              />
              {(isAdmin || me?.role === "comercial") && (
                <ActionTile
                  testID="circle-presupuestos"
                  icon="document-text"
                  title="Presupuestos"
                  subtitle="Genera PDFs oficiales rellenables"
                  accent="#8B5CF6"
                  onPress={() => router.push("/presupuestos")}
                />
              )}
            </View>

          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );

  return (
    <ResponsiveLayout active="home" isAdmin={isAdmin} onLogout={logout} userName={me?.name}>
      {content}
    </ResponsiveLayout>
  );
}

const shadowLight = Platform.select<any>({
  web: { boxShadow: "0 2px 12px rgba(15, 23, 42, 0.06)" },
  default: { shadowColor: "#0F172A", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  // Mobile header
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  greetingSmall: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "700", letterSpacing: 0.3 },
  helloSmall: { fontSize: 20, fontWeight: "900", color: COLORS.text, letterSpacing: -0.4 },
  logoutBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: COLORS.border,
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 20, paddingBottom: 40 },
  scrollWide: { padding: 48 },
  wideWrap: { maxWidth: 1160, width: "100%", alignSelf: "center" },

  // Hero (desktop)
  hero: { marginBottom: 32 },
  heroGreet: { fontSize: 16, color: COLORS.textSecondary, fontWeight: "700", letterSpacing: 0.2 },
  heroName: {
    fontSize: 38, fontWeight: "900", color: COLORS.text,
    letterSpacing: -1, marginTop: 2,
  },
  heroDate: { fontSize: 13, color: COLORS.textSecondary, fontWeight: "600", marginTop: 6, letterSpacing: 0.2 },

  // Stats row
  statsRow: {
    flexDirection: "row", gap: 12, flexWrap: "wrap",
  },
  statCard: {
    flex: 1, minWidth: 180,
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 16,
    backgroundColor: COLORS.surface, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border,
    ...shadowLight,
  },
  statIcon: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  statVal: { fontSize: 24, fontWeight: "900", color: COLORS.text, letterSpacing: -0.5 },
  statLbl: { fontSize: 11, fontWeight: "700", color: COLORS.textSecondary, letterSpacing: 0.3, textTransform: "uppercase", marginTop: 1 },

  // Section labels
  sectionLabel: {
    fontSize: 11, fontWeight: "900", color: COLORS.textDisabled,
    letterSpacing: 1.6, marginBottom: 10,
  },

  // Action tiles
  tilesGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 14,
  },
  tilesGridWide: { gap: 18 },
  tile: {
    flexBasis: "100%",
    backgroundColor: COLORS.surface, borderRadius: 18,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 20,
    position: "relative",
    minWidth: 260,
    ...shadowLight,
    // @ts-ignore — react-native-web accepts these as flex items
    flexGrow: 1, flexShrink: 1,
    maxWidth: "100%",
  },
  tileWide: {
    // Two-column layout on desktop: gap=18, so width is 50% - 9px.
    // @ts-ignore
    flexBasis: "calc(50% - 9px)",
    maxWidth: "calc(50% - 9px)",
  },
  tileIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, marginBottom: 14,
    position: "relative",
  },
  tileBadge: {
    position: "absolute", top: -5, right: -5,
    minWidth: 22, height: 22, borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: COLORS.surface,
  },
  tileBadgeText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  tileTitle: {
    fontSize: 17, fontWeight: "900", color: COLORS.text,
    letterSpacing: -0.3, marginBottom: 4,
  },
  tileSubtitle: {
    fontSize: 13, color: COLORS.textSecondary, fontWeight: "500", lineHeight: 18,
  },
  tileArrow: {
    position: "absolute", top: 20, right: 20,
    opacity: 0.7,
  },
});
