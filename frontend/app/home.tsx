import { useCallback, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { api, clearToken, COLORS } from "../src/api";
import ResponsiveLayout from "../src/ResponsiveLayout";
import { useBreakpoint } from "../src/useBreakpoint";

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

  const Circle = ({
    testID, icon, iconFamily = "ion", label, color, onPress, badge, big,
  }: {
    testID: string;
    icon: string;
    iconFamily?: "ion" | "mat";
    label: string;
    color: string;
    onPress: () => void;
    badge?: string;
    big?: boolean;
  }) => (
    <TouchableOpacity testID={testID} style={s.circleWrap} onPress={onPress} activeOpacity={0.8}>
      <View style={[s.circle, big && s.circleBig, { backgroundColor: color }]}>
        {iconFamily === "ion" ? (
          <Ionicons name={icon as any} size={big ? 72 : 52} color="#fff" />
        ) : (
          <MaterialCommunityIcons name={icon as any} size={big ? 80 : 56} color="#fff" />
        )}
        {badge ? (
          <View style={s.circleBadge}>
            <Text style={s.circleBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[s.circleLabel, big && { fontSize: 18 }]}>{label}</Text>
    </TouchableOpacity>
  );

  const content = (
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      {!isWide && (
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.hello}>Hola{me?.name ? `, ${me.name.split(" ")[0]}` : ""}</Text>
            <Text style={s.sub}>{isAdmin ? "Administrador" : "Técnico"}</Text>
          </View>
          <TouchableOpacity
            testID="btn-logout"
            style={s.logoutBtn}
            onPress={logout}
          >
            <Ionicons name="log-out-outline" size={22} color={COLORS.navy} />
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={[s.scroll, isWide && s.scrollWide]}>
          <View style={isWide && { maxWidth: 1100, width: "100%", alignSelf: "center" }}>
            <Text style={[s.title, isWide && { fontSize: 36 }]}>
              {isWide ? `Hola${me?.name ? `, ${me.name.split(" ")[0]}` : ""}` : "Panel principal"}
            </Text>
            <Text style={s.subtitle}>
              {isWide ? "Selecciona un módulo para empezar" : "Selecciona una sección"}
            </Text>

            <View style={[s.circlesRow, isWide && s.circlesRowWide]}>
              <Circle
                testID="circle-proyectos"
                iconFamily="mat"
                icon="set-square"
                label="Proyectos"
                color={COLORS.primary}
                onPress={() => router.push("/materiales")}
                badge={stats && stats.pending > 0 ? String(stats.pending) : undefined}
                big={isWide}
              />
              <Circle
                testID="circle-calendario"
                icon="calendar"
                label="Calendario"
                color="#10B981"
                onPress={() => router.push("/calendario")}
                big={isWide}
              />
              <Circle
                testID="circle-planos"
                icon="map"
                label="Planos"
                color="#F59E0B"
                onPress={() => router.push("/planos")}
                big={isWide}
              />
            </View>

            {stats && (
              <View style={[s.statsCard, isWide && { marginTop: 36 }]}>
                <View style={s.statCol}>
                  <Text style={s.statNum}>{stats.total}</Text>
                  <Text style={s.statLbl}>Total proyectos</Text>
                </View>
                <View style={s.statCol}>
                  <Text style={[s.statNum, { color: COLORS.pendingText }]}>{stats.pending}</Text>
                  <Text style={s.statLbl}>Pendientes</Text>
                </View>
                <View style={s.statCol}>
                  <Text style={[s.statNum, { color: COLORS.syncedText }]}>{stats.synced}</Text>
                  <Text style={s.statLbl}>Sincronizados</Text>
                </View>
              </View>
            )}
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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  hello: { fontSize: 22, fontWeight: "900", color: COLORS.text, letterSpacing: -0.5 },
  sub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  logoutBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 20, paddingBottom: 40, gap: 12 },
  scrollWide: { padding: 40 },
  title: { fontSize: 26, fontWeight: "900", color: COLORS.text, marginTop: 8 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 16 },
  circlesRow: {
    flexDirection: "row", justifyContent: "space-around", alignItems: "flex-start",
    paddingVertical: 12, flexWrap: "wrap", gap: 8,
  },
  circlesRowWide: { justifyContent: "center", gap: 60, paddingVertical: 40 },
  circleWrap: { alignItems: "center", gap: 8, flexBasis: "30%", minWidth: 100 },
  circle: {
    width: 110, height: 110, borderRadius: 55, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
    position: "relative",
  },
  circleBig: { width: 170, height: 170, borderRadius: 85 },
  circleBadge: {
    position: "absolute", top: -4, right: -4, minWidth: 26, height: 26, borderRadius: 13,
    backgroundColor: "#EF4444", paddingHorizontal: 8, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: COLORS.surface,
  },
  circleBadgeText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  circleLabel: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  statsCard: {
    flexDirection: "row", marginTop: 24, backgroundColor: COLORS.surface, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border, padding: 16,
  },
  statCol: { flex: 1, alignItems: "center", gap: 4 },
  statNum: { fontSize: 24, fontWeight: "900", color: COLORS.text },
  statLbl: { fontSize: 11, fontWeight: "700", color: COLORS.textSecondary, letterSpacing: 0.5, textTransform: "uppercase" },
});
