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
  const [dash, setDash] = useState<any>(null);

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      try {
        const [u, d] = await Promise.all([
          api.me(),
          api.getDashboard().catch(() => null),
        ]);
        if (!alive) return;
        setMe(u);
        setDash(d);
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

          {dash && (
            <View style={{ gap: 12, marginBottom: 8 }}>
              <Text style={s.sectionTitle}>Resumen</Text>

              {/* Today row */}
              <View style={s.dashRow}>
                <View style={[s.dashCard, { backgroundColor: COLORS.primarySoft }]}>
                  <Ionicons name="today-outline" size={22} color={COLORS.primary} />
                  <Text style={s.dashVal}>{dash.today?.events || 0}</Text>
                  <Text style={s.dashLbl}>Eventos hoy</Text>
                </View>
                <View style={[s.dashCard, { backgroundColor: "#FEF3C7" }]}>
                  <Ionicons name="alert-circle-outline" size={22} color="#F59E0B" />
                  <Text style={s.dashVal}>{dash.today?.pending_sat || 0}</Text>
                  <Text style={s.dashLbl}>SAT pendiente</Text>
                </View>
                <View style={[s.dashCard, { backgroundColor: "#EDE9FE" }]}>
                  <Ionicons name="document-text-outline" size={22} color="#8B5CF6" />
                  <Text style={s.dashVal}>{dash.today?.pending_budgets || 0}</Text>
                  <Text style={s.dashLbl}>Presup. pendientes</Text>
                </View>
              </View>

              {/* Projects by status */}
              <Text style={s.sectionSub}>Proyectos por estado</Text>
              <View style={s.dashRow}>
                {(dash.projects_by_status ? Object.entries(dash.projects_by_status) as [string, number][] : []).slice(0, 4).map(([k, v]) => {
                  const colors: Record<string, string> = {
                    pendiente: "#F59E0B", a_facturar: "#8B5CF6", planificado: "#3B82F6",
                    terminado: "#10B981", facturado: "#10B981", bloqueado: "#EF4444", anulado: "#6B7280",
                  };
                  return (
                    <View key={k} style={[s.dashCard, { backgroundColor: (colors[k] || "#F59E0B") + "18" }]}>
                      <Text style={[s.dashVal, { color: colors[k] || "#F59E0B" }]}>{v}</Text>
                      <Text style={s.dashLbl}>{k.replace("_", " ")}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Hours by manager */}
              {dash.manager_hours?.length > 0 && (
                <>
                  <Text style={s.sectionSub}>Horas por gestor</Text>
                  {dash.manager_hours.slice(0, 5).map((m: any, i: number) => (
                    <View key={i} style={s.hourRow}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color || COLORS.primary }} />
                        <Text style={s.hourName} numberOfLines={1}>{m.name}</Text>
                      </View>
                      <Text style={s.hourVal}>{m.hours}h</Text>
                      <Text style={s.hourCount}>({m.count})</Text>
                      <View style={[s.hourBar, { flex: 2, maxWidth: 120 }]}>
                        <View style={[s.hourFill, { width: `${Math.min(100, (m.hours / (dash.manager_hours[0]?.hours || 1)) * 100)}%`, backgroundColor: m.color || COLORS.primary }]} />
                      </View>
                    </View>
                  ))}
                </>
              )}

              {/* SAT by month */}
              {dash.sat_by_month?.length > 0 && (
                <>
                  <Text style={s.sectionSub}>Incidencias SAT por mes</Text>
                  <View style={s.dashRow}>
                    {dash.sat_by_month.map((m: any, i: number) => (
                      <View key={i} style={[s.dashCard, { flex: 1, minWidth: 50 }]}>
                        <Text style={s.dashVal}>{m.total}</Text>
                        <Text style={s.dashLbl}>{m.month}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
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
  dashRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dashCard: {
    flex: 1, minWidth: 90, padding: 12, borderRadius: 10,
    alignItems: "center", gap: 2, backgroundColor: COLORS.surface,
  },
  dashVal: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  dashLbl: { fontSize: 10, color: COLORS.textSecondary, fontWeight: "600", textAlign: "center" },
  sectionSub: {
    fontSize: 12, fontWeight: "800", color: COLORS.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4,
  },
  hourRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  hourName: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  hourVal: { fontSize: 13, fontWeight: "800", color: COLORS.text, minWidth: 45, textAlign: "right" },
  hourCount: { fontSize: 11, color: COLORS.textSecondary, minWidth: 35 },
  hourBar: { height: 10, backgroundColor: COLORS.borderInput, borderRadius: 5, overflow: "hidden" },
  hourFill: { height: 10, borderRadius: 5 },
} as Record<string, any>);
