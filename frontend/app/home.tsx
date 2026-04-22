import { useCallback, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { api, clearToken, COLORS } from "../src/api";
import ResponsiveLayout from "../src/ResponsiveLayout";
import { useBreakpoint } from "../src/useBreakpoint";
import NotificationsBell from "../src/NotificationsBell";

function greetingForNow(): string {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function spanishToday(): string {
  try {
    const d = new Date().toLocaleDateString("es-ES", {
      weekday: "long", day: "2-digit", month: "long",
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

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      try {
        const u = await api.me();
        if (!alive) return;
        setMe(u);
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
  const showPresupuestos = isAdmin || me?.role === "comercial";

  const Tile = ({
    testID, icon, iconFamily = "ion", title, accent, onPress,
  }: {
    testID: string; icon: string; iconFamily?: "ion" | "mat";
    title: string; accent: string; onPress: () => void;
  }) => (
    <TouchableOpacity
      testID={testID}
      style={[s.tile, isWide && s.tileWide]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[s.tileIcon, { backgroundColor: accent + "1A", borderColor: accent + "33" }]}>
        {iconFamily === "ion" ? (
          <Ionicons name={icon as any} size={isWide ? 36 : 30} color={accent} />
        ) : (
          <MaterialCommunityIcons name={icon as any} size={isWide ? 40 : 32} color={accent} />
        )}
      </View>
      <Text style={[s.tileTitle, !isWide && { fontSize: 15 }]}>{title}</Text>
    </TouchableOpacity>
  );

  const content = (
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      {/* Mobile compact header */}
      {!isWide && (
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.greetingSmall}>{greetingForNow()}</Text>
            <Text style={s.helloSmall}>{firstName || "Bienvenido"} 👋</Text>
          </View>
          <NotificationsBell />
          <TouchableOpacity
            testID="btn-logout"
            style={[s.logoutBtn, { marginLeft: 8 }]}
            onPress={logout}
          >
            <Ionicons name="log-out-outline" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      )}

      {/* Desktop notifications bell — anchored to the top-right corner of the
          content area (above the hero). Keeps the sidebar untouched. */}
      {isWide && (
        <View style={s.deskTopRight}>
          <NotificationsBell />
        </View>
      )}

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        // No ScrollView: the layout is designed to fit any desktop or mobile
        // viewport without scrolling. Content is centered vertically for a
        // more premium, uncluttered feel.
        <View style={[s.body, isWide && s.bodyWide]}>
          <View style={isWide ? s.wideWrap : s.mobileWrap}>

            {isWide && (
              <View style={s.hero}>
                <Text style={s.heroGreet}>{greetingForNow()},</Text>
                <Text style={s.heroName}>{firstName || "Bienvenido"} 👋</Text>
                <Text style={s.heroDate}>{spanishToday()}</Text>
              </View>
            )}

            <View style={[s.tilesGrid, isWide && s.tilesGridWide]}>
              <Tile
                testID="circle-proyectos"
                iconFamily="mat"
                icon="set-square"
                title="Proyectos"
                accent={COLORS.primary}
                onPress={() => router.push("/materiales")}
              />
              <Tile
                testID="circle-calendario"
                icon="calendar"
                title="Calendario"
                accent="#10B981"
                onPress={() => router.push("/calendario")}
              />
              <Tile
                testID="circle-planos"
                icon="map"
                title="Planos"
                accent="#F59E0B"
                onPress={() => router.push("/planos")}
              />
              {showPresupuestos && (
                <Tile
                  testID="circle-presupuestos"
                  icon="document-text"
                  title="Presupuestos"
                  accent="#8B5CF6"
                  onPress={() => router.push("/presupuestos")}
                />
              )}
              <Tile
                testID="circle-sat"
                icon="headset"
                title="CRM SAT"
                accent="#EC4899"
                onPress={() => router.push("/sat")}
              />
            </View>

          </View>
        </View>
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
  web: { boxShadow: "0 2px 16px rgba(15, 23, 42, 0.08)" },
  default: { shadowColor: "#0F172A", shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
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
  deskTopRight: {
    position: "absolute",
    top: 28, right: 32,
    zIndex: 10,
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Body container (no scroll)
  body: { flex: 1, padding: 20, justifyContent: "center" },
  bodyWide: { padding: 48 },
  wideWrap: { maxWidth: 960, width: "100%", alignSelf: "center" },
  mobileWrap: { flex: 1, justifyContent: "center" },

  // Hero
  hero: { marginBottom: 40, alignItems: "center" },
  heroGreet: { fontSize: 16, color: COLORS.textSecondary, fontWeight: "700", letterSpacing: 0.2 },
  heroName: {
    fontSize: 42, fontWeight: "900", color: COLORS.text,
    letterSpacing: -1, marginTop: 4,
  },
  heroDate: { fontSize: 13, color: COLORS.textSecondary, fontWeight: "600", marginTop: 8, letterSpacing: 0.2 },

  // Tiles grid
  tilesGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 14,
    justifyContent: "center",
  },
  tilesGridWide: { gap: 24 },
  tile: {
    flexBasis: "47%",
    maxWidth: "47%",
    backgroundColor: COLORS.surface, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: 28, paddingHorizontal: 20,
    alignItems: "center",
    ...shadowLight,
  },
  tileWide: {
    // Three columns on desktop: 5 tiles → first row of 3, second row of 2.
    // @ts-ignore — react-native-web accepts calc()
    flexBasis: "calc(33.333% - 16px)",
    maxWidth: "calc(33.333% - 16px)",
    paddingVertical: 36,
  },
  tileIcon: {
    width: 72, height: 72, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, marginBottom: 14,
  },
  tileTitle: {
    fontSize: 18, fontWeight: "900", color: COLORS.text,
    letterSpacing: -0.3,
  },
});
