import { useCallback, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { api, clearToken, COLORS } from "../src/api";
import ResponsiveLayout from "../src/ResponsiveLayout";
import { useBreakpoint } from "../src/useBreakpoint";
import NotificationsBell from "../src/NotificationsBell";
import { ios } from "../src/ui/iosTheme";
import IOSHeader from "../src/ui/IOSHeader";
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
  const perms: string[] = (me?.permissions as string[]) || [];
  const has = (p: string) => perms.includes(p);
  const showProyectos = has("proyectos.view");
  const showCalendario = has("calendario.view");
  const showPlanos = has("planos.view");
  const showPresupuestos = has("presupuestos.view");
  const showChat = has("chat.view");
  const showSat = has("sat.view");

  /** iOS-style tile (rounded square + icon + title). */
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
      activeOpacity={0.7}
    >
      <View style={[s.tileIcon, { backgroundColor: accent }]}>
        {iconFamily === "ion" ? (
          <Ionicons name={icon as any} size={32} color="#fff" />
        ) : (
          <MaterialCommunityIcons name={icon as any} size={34} color="#fff" />
        )}
      </View>
      <Text style={s.tileTitle} numberOfLines={1}>{title}</Text>
    </TouchableOpacity>
  );

  const content = (
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      {!isWide ? (
        // Mobile: iOS large-title header
        <IOSHeader
          title={firstName ? `${greetingForNow()}, ${firstName}` : greetingForNow()}
          subtitle={spanishToday()}
          rightSlot={
            <View style={{ flexDirection: "row", gap: 8 }}>
              <NotificationsBell />
              <TouchableOpacity
                testID="btn-logout"
                style={s.iconBtn}
                onPress={logout}
              >
                <Ionicons name="log-out-outline" size={20} color={ios.colors.brand} />
              </TouchableOpacity>
            </View>
          }
        />
      ) : (
        <View style={s.deskTopRight}>
          <NotificationsBell />
        </View>
      )}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={ios.colors.brand} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.scroll, isWide && s.scrollWide]}
          showsVerticalScrollIndicator={false}
        >
          {isWide && (
            <View style={s.hero}>
              <Text style={s.heroGreet}>{greetingForNow()},</Text>
              <Text style={s.heroName}>{firstName || "Bienvenido"}</Text>
              <Text style={s.heroDate}>{spanishToday()}</Text>
            </View>
          )}

          <Text style={s.sectionTitle}>Módulos</Text>
          <View style={[s.tilesGrid, isWide && s.tilesGridWide]}>
            {showCalendario && (
              <Tile
                testID="circle-calendario"
                icon="calendar"
                title="Calendario"
                accent={ios.colors.green}
                onPress={() => router.push("/calendario")}
              />
            )}
            {showPlanos && (
              <Tile
                testID="circle-planos"
                icon="map"
                title="Planos"
                accent={ios.colors.orange}
                onPress={() => router.push("/planos")}
              />
            )}
            {showProyectos && (
              <Tile
                testID="circle-proyectos"
                iconFamily="mat"
                icon="set-square"
                title="Proyectos"
                accent={ios.colors.brand}
                onPress={() => router.push("/materiales")}
              />
            )}
            {showPresupuestos && (
              <Tile
                testID="circle-presupuestos"
                icon="document-text"
                title="Presupuestos"
                accent={ios.colors.purple}
                onPress={() => router.push("/presupuestos")}
              />
            )}
            {showChat && (
              <Tile
                testID="circle-chat"
                icon="chatbubbles"
                title="Chat"
                accent={ios.colors.green}
                onPress={() => router.push("/chat")}
              />
            )}
            {showSat && (
              <Tile
                testID="circle-sat"
                icon="headset"
                title="CRM SAT"
                accent={ios.colors.pink}
                onPress={() => router.push("/sat")}
              />
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

  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 } as any, elevation: 1,
  },
  deskTopRight: { position: "absolute", top: 24, right: 32, zIndex: 10 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  scroll: { padding: 16, paddingBottom: 40 },
  scrollWide: { padding: 48, paddingBottom: 80, maxWidth: 1100, alignSelf: "center", width: "100%" },

  // Wide-screen hero
  hero: { marginBottom: 32, paddingHorizontal: 4 },
  heroGreet: {
    fontFamily: ios.font.family,
    fontSize: 17, color: COLORS.textSecondary, fontWeight: "500",
  },
  heroName: {
    fontFamily: ios.font.family,
    fontSize: 38, fontWeight: "700", color: COLORS.text,
    letterSpacing: -0.8, marginTop: 4,
  },
  heroDate: {
    fontFamily: ios.font.family,
    fontSize: 15, color: COLORS.textSecondary, fontWeight: "500",
    marginTop: 6,
  },

  sectionTitle: {
    fontFamily: ios.font.family,
    fontSize: 13, color: COLORS.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5,
    marginBottom: 8, marginLeft: 16,
  },

  tilesGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 12,
    justifyContent: "flex-start",
  },
  tilesGridWide: { gap: 18 },
  tile: {
    flexBasis: "48%", maxWidth: "48%",
    backgroundColor: COLORS.surface,
    borderRadius: ios.radius.card,
    paddingVertical: 22, paddingHorizontal: 16,
    alignItems: "center", justifyContent: "center",
    minHeight: 140,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 } as any, elevation: 1,
  },
  tileWide: {
    // Three columns on desktop
    // @ts-ignore — react-native-web accepts calc()
    flexBasis: "calc(33.333% - 12px)",
    maxWidth: "calc(33.333% - 12px)",
    paddingVertical: 32,
    minHeight: 170,
  },
  tileIcon: {
    width: 56, height: 56, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    marginBottom: 12,
  },
  tileTitle: {
    fontFamily: ios.font.family,
    fontSize: 15, fontWeight: "600", color: COLORS.text,
    letterSpacing: -0.2,
  },
} as Record<string, any>);
