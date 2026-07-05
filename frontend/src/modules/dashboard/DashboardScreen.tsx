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
import IOSHeader from "../../ui/IOSHeader";
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
  const s = useS();

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

  return (
    <ResponsiveLayout active={(active || "home") as any} isAdmin={finalIsAdmin} onLogout={onLogout} userName={finalUserName}>
      <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
        {!isWide ? (
          <IOSHeader
            title={firstName ? `${greetingForNow()}, ${firstName}` : greetingForNow()}
            subtitle={spanishToday()}
            rightSlot={
              <View style={{ flexDirection: "row", gap: 8 }}>
                <NotificationsBell />
                <TouchableOpacity testID="btn-logout" style={s.iconBtn} onPress={onLogout}>
                  <Ionicons name="log-out-outline" size={20} color={COLORS.primary} />
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
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[s.scroll, isWide && s.scrollWide]}
            showsVerticalScrollIndicator={false}
          >
            {isWide && (
              <View style={s.heroBg}>
                <View style={s.hero}>
                  <Text style={s.heroGreet}>{greetingForNow()},</Text>
                  <Text style={s.heroName}>{firstName || "Bienvenido"}</Text>
                  <Text style={s.heroDate}>{spanishToday()}</Text>
                </View>
              </View>
            )}

            <Text style={s.sectionTitle}>Módulos de Gestión</Text>

            <View style={[s.tilesGrid, isWide && s.tilesGridWide]}>
              <DashboardTile testID="circle-dashboard" icon="stats-chart" title="Dashboard" accent="#3B82F6"
                onPress={() => router.push("/dashboard")} />
              {showCalendario && <DashboardTile testID="circle-calendario" icon="calendar" title="Calendario" accent="#10B981"
                onPress={() => router.push("/calendario")} />}
              {showPlanos && <DashboardTile testID="circle-planos" icon="map" title="Planos" accent="#F97316"
                onPress={() => router.push("/planos")} />}
              {showProyectos && <DashboardTile testID="circle-proyectos" iconFamily="mat" icon="set-square" title="Proyectos" accent="#3B82F6"
                onPress={() => router.push("/materiales")} />}
              {showDocs && <DashboardTile testID="circle-documentos" icon="folder-open" title="Docs. Internos" accent="#EAB308"
                onPress={() => router.push("/documentos")} />}
              {showNotas && <DashboardTile testID="circle-notas" icon="book" title="Notas" accent="#14B8A6"
                onPress={() => router.push("/notas")} />}
              {showPresupuestos && <DashboardTile testID="circle-presupuestos" icon="document-text" title="Presupuestos" accent="#8B5CF6"
                onPress={() => router.push("/presupuestos")} />}
              {showChat && <DashboardTile testID="circle-chat" icon="chatbubbles" title="Chat" accent="#10B981"
                onPress={() => router.push("/chat")} />}
              {showSat && <DashboardTile testID="circle-sat" icon="headset" title="CRM SAT" accent="#EC4899"
                onPress={() => router.push("/sat")} />}
              <DashboardTile testID="circle-financiero" icon="cash" title="Ventas y Beneficios" accent="#8B5CF6"
                onPress={() => router.push("/dashboard/ventas-beneficios")} />
            </View>

            {showNotas && pendingNotes.length > 0 && (
              <View style={s.notesContainer}>
                <Text style={s.notesTitle}>
                  Notas pendientes ({pendingNotes.length})
                </Text>
                {pendingNotes.map((n: any) => (
                  <TouchableOpacity
                    key={n.id}
                    style={s.noteCard}
                    onPress={() => router.push(`/notas?open=${n.id}`)}
                  >
                    <View style={s.noteIconCircle}>
                      <Ionicons name="flag" size={18} color={COLORS.pendingText} />
                    </View>
                    <View style={s.noteTextContainer}>
                      <Text style={s.noteHeading} numberOfLines={1}>
                        {n.titulo || "Sin título"}
                      </Text>
                      {n.contenido && (
                        <Text style={s.noteContent} numberOfLines={1}>
                          {n.contenido}
                        </Text>
                      )}
                      {n.material_name && (
                        <Text style={s.noteLink} numberOfLines={1}>
                          {'\u{1F517}'} {n.material_name}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textDisabled} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </ResponsiveLayout>
  );
}
