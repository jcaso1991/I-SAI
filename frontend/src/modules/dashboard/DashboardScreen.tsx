import { useCallback, useEffect, useState } from "react";
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

const DEFAULT_ORDER = ["dashboard", "calendario", "planos", "proyectos", "documentos", "notas", "presupuestos", "chat", "sat", "fichajes", "financiero"];

type ModuleItem = { key: string; icon: string; title: string; accent: string; onPress: () => void };

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
  const [pendingNotes, setPendingNotes] = useState<any[]>([]);
  const [reorderMode, setReorderMode] = useState(false);
  const [modulosOrder, setModulosOrder] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

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

  // Load saved order
  useEffect(() => {
    if (me?.id) {
      api.getModulosOrder().then((r: any) => {
        const saved = r?.modulos_order || [];
        if (saved.length > 0) setModulosOrder(saved);
      }).catch(() => {});
    }
  }, [me?.id]);

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
  const showFichajes = has("fichajes.view");

  // Build ordered module list
  const orderedModulos: ModuleItem[] = (() => {
    const visible: ModuleItem[] = [];

    if (showCalendario) visible.push({ key: "calendario", icon: "calendar", title: "Calendario", accent: "#10B981", onPress: () => router.push("/calendario") });
    if (showPlanos) visible.push({ key: "planos", icon: "map", title: "Planos", accent: "#F97316", onPress: () => router.push("/planos") });
    if (showProyectos) visible.push({ key: "proyectos", icon: "set-square", title: "Proyectos", accent: "#3B82F6", onPress: () => router.push("/materiales") });
    if (showDocs) visible.push({ key: "documentos", icon: "folder-open", title: "Docs. Internos", accent: "#EAB308", onPress: () => router.push("/documentos") });
    if (showNotas) visible.push({ key: "notas", icon: "book", title: "Notas", accent: "#14B8A6", onPress: () => router.push("/notas") });
    if (showPresupuestos) visible.push({ key: "presupuestos", icon: "document-text", title: "Presupuestos", accent: "#8B5CF6", onPress: () => router.push("/presupuestos") });
    if (showChat) visible.push({ key: "chat", icon: "chatbubbles", title: "Chat", accent: "#10B981", onPress: () => router.push("/chat") });
    if (showSat) visible.push({ key: "sat", icon: "headset", title: "CRM SAT", accent: "#EC4899", onPress: () => router.push("/sat") });
    if (showFichajes) visible.push({ key: "fichajes", icon: "time", title: "Fichajes", accent: "#10B981", onPress: () => router.push("/fichajes") });
    visible.push({ key: "dashboard", icon: "stats-chart", title: "Dashboard", accent: "#3B82F6", onPress: () => router.push("/dashboard") });
    visible.push({ key: "financiero", icon: "cash", title: "Ventas y Beneficios", accent: "#8B5CF6", onPress: () => router.push("/dashboard/ventas-beneficios") });

    const order = modulosOrder.length > 0 ? modulosOrder : DEFAULT_ORDER;
    return [...visible].sort((a, b) => {
      const ia = order.indexOf(a.key);
      const ib = order.indexOf(b.key);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  })();

  const handleTileTap = (index: number) => {
    if (!reorderMode) return;
    if (selectedIndex === null) {
      setSelectedIndex(index);
    } else if (selectedIndex === index) {
      setSelectedIndex(null);
    } else {
      const newOrder = [...orderedModulos];
      [newOrder[selectedIndex], newOrder[index]] = [newOrder[index], newOrder[selectedIndex]];
      const keys = newOrder.map(m => m.key);
      setModulosOrder(keys);
      api.updateModulosOrder(keys).catch(() => {});
      setSelectedIndex(null);
    }
  };

  const saveOrder = () => {
    setSelectedIndex(null);
    setReorderMode(false);
  };

  if (loading) {
    return (
      <ResponsiveLayout active={(active || "home") as any} isAdmin={finalIsAdmin} onLogout={onLogout} userName={finalUserName}>
        <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
          <View style={s.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        </SafeAreaView>
      </ResponsiveLayout>
    );
  }

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

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={s.sectionTitle}>Módulos de Gestión</Text>
            <TouchableOpacity
              onPress={() => reorderMode ? saveOrder() : setReorderMode(true)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: reorderMode ? COLORS.primary : COLORS.primarySoft }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name={reorderMode ? "checkmark" : "reorder-three-outline"} size={14} color={reorderMode ? "#fff" : COLORS.primary} />
                <Text style={{ fontSize: 12, fontWeight: "600", color: reorderMode ? "#fff" : COLORS.primary }}>
                  {reorderMode ? "Listo" : "Editar"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={[s.tilesGrid, isWide && s.tilesGridWide]}>
            {orderedModulos.map((m, index) => (
              <DashboardTile
                key={m.key}
                testID={`circle-${m.key}`}
                icon={m.icon}
                iconFamily={m.key === "proyectos" ? "mat" : "ion"}
                title={m.title}
                accent={m.accent}
                onPress={reorderMode ? () => handleTileTap(index) : m.onPress}
                selected={reorderMode && selectedIndex === index}
              />
            ))}
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
      </SafeAreaView>
    </ResponsiveLayout>
  );
}
