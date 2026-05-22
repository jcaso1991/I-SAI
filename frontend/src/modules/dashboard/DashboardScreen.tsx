import { useCallback, useState } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, clearToken, COLORS } from "../../api";
import ResponsiveLayout from "../../ResponsiveLayout";
import { useBreakpoint } from "../../useBreakpoint";
import NotificationsBell from "../../NotificationsBell";
import { ios } from "../../ui/iosTheme";
import IOSHeader from "../../ui/IOSHeader";
import { useThemedStyles } from "../../theme";
import DashboardTile from "./DashboardTile";
import { useS } from "./DashboardStyles";
import { greetingForNow, spanishToday } from "./DashboardUtils";

export interface DashboardScreenProps {
  active?: string;
  onLogout: () => void;
  isAdmin?: boolean;
  userName?: string;
}

export default function DashboardScreen({
  active,
  onLogout,
  isAdmin: isAdminProp,
  userName: userNameProp,
}: DashboardScreenProps) {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const s = useThemedStyles(useS);

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      try {
        const u = await api.me();
        if (!alive) return;
        setMe(u);
        const perms: string[] = (u?.permissions as string[]) || [];
        if (perms.includes("notas.view")) {
          try {
            const notas = await api.listNotas(undefined, true);
            setPendingNotes(notas || []);
          } catch { setPendingNotes([]); }
        }
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

  const internalIsAdmin = me?.role === "admin";
  const finalIsAdmin = isAdminProp !== undefined ? isAdminProp : internalIsAdmin;
  const finalUserName = userNameProp ?? me?.name;
  const firstName = me?.name ? me.name.split(" ")[0] : "";
  const perms: string[] = (me?.permissions as string[]) || [];
  const has = (p: string) => perms.includes(p);
  const showProyectos = has("proyectos.view");
  const showCalendario = has("calendario.view");
  const showPlanos = has("planos.view");
  const showPresupuestos = has("presupuestos.view");
  const showChat = has("chat.view");
  const showSat = has("sat.view");
  const showDocs = has("preciario.view");
  const showNotas = has("notas.view");
  const [pendingNotes, setPendingNotes] = useState<any[]>([]);

  const content = (
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      {!isWide ? (
        <IOSHeader
          title={firstName ? `${greetingForNow()}, ${firstName}` : greetingForNow()}
          subtitle={spanishToday()}
          rightSlot={
            <View style={{ flexDirection: "row", gap: 8 }}>
              <NotificationsBell />
              <TouchableOpacity
                testID="btn-logout"
                style={s.iconBtn}
                onPress={onLogout}
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
            <DashboardTile
              testID="circle-dashboard"
              icon="stats-chart"
              title="Dashboard"
              accent={ios.colors.brand}
              onPress={() => router.push("/dashboard")}
            />
            {showCalendario && (
              <DashboardTile
                testID="circle-calendario"
                icon="calendar"
                title="Calendario"
                accent={ios.colors.green}
                onPress={() => router.push("/calendario")}
              />
            )}
            {showPlanos && (
              <DashboardTile
                testID="circle-planos"
                icon="map"
                title="Planos"
                accent={ios.colors.orange}
                onPress={() => router.push("/planos")}
              />
            )}
            {showProyectos && (
              <DashboardTile
                testID="circle-proyectos"
                iconFamily="mat"
                icon="set-square"
                title="Proyectos"
                accent={ios.colors.brand}
                onPress={() => router.push("/materiales")}
              />
            )}
            {showDocs && (
              <DashboardTile
                testID="circle-documentos"
                icon="folder-open"
                title="Docs. Internos"
                accent={ios.colors.yellow}
                onPress={() => router.push("/documentos")}
              />
            )}
            {showNotas && (
              <DashboardTile
                testID="circle-notas"
                icon="book"
                title="Notas"
                accent={ios.colors.teal}
                onPress={() => router.push("/notas")}
              />
            )}
            {showPresupuestos && (
              <DashboardTile
                testID="circle-presupuestos"
                icon="document-text"
                title="Presupuestos"
                accent={ios.colors.purple}
                onPress={() => router.push("/presupuestos")}
              />
            )}
            {showChat && (
              <DashboardTile
                testID="circle-chat"
                icon="chatbubbles"
                title="Chat"
                accent={ios.colors.green}
                onPress={() => router.push("/chat")}
              />
            )}
            {showSat && (
              <DashboardTile
                testID="circle-sat"
                icon="headset"
                title="CRM SAT"
                accent={ios.colors.pink}
                onPress={() => router.push("/sat")}
              />
            )}
          </View>
          {showNotas && pendingNotes.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: "900", color: COLORS.textSecondary, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                Notas pendientes ({pendingNotes.length})
              </Text>
              {pendingNotes.map((n: any) => (
                <TouchableOpacity
                  key={n.id}
                  style={{ backgroundColor: COLORS.surface, borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: COLORS.border, flexDirection: "row", alignItems: "center", gap: 10 }}
                  onPress={() => router.push(`/notas?open=${n.id}`)}
                >
                  <Ionicons name="flag" size={16} color="#F59E0B" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.text }} numberOfLines={1}>
                      {n.titulo || "Sin título"}
                    </Text>
                    {n.contenido ? <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 1 }} numberOfLines={1}>{n.contenido}</Text> : null}
                    {n.material_name ? <Text style={{ fontSize: 10, color: COLORS.primary, marginTop: 1 }}>🔗 {n.material_name}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textDisabled} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );

  return (
    <ResponsiveLayout
      active={(active || "home") as any}
      isAdmin={finalIsAdmin}
      onLogout={onLogout}
      userName={finalUserName}
    >
      {content}
    </ResponsiveLayout>
  );
}
