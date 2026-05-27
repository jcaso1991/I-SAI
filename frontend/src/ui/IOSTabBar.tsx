import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ios } from "./iosTheme";
import { api, COLORS } from "../api";
import { useThemedStyles } from "../theme";

export type BottomTab =
  | "home" | "dashboard" | "proyectos" | "calendario" | "planos"
  | "presupuestos" | "chat" | "ajustes" | "sat" | "documentos"
  | "preciario" | "documentaciones" | "notas";

const TAB_PERM_MAP: Record<BottomTab, string | null> = {
  home: null,
  dashboard: null,
  proyectos: "proyectos.view",
  calendario: "calendario.view",
  planos: "planos.view",
  presupuestos: "presupuestos.view",
  chat: "chat.view",
  sat: "sat.view",
  documentos: "preciario.view",
  preciario: "preciario.view",
  documentaciones: "preciario.view",
  notas: "notas.view",
  ajustes: null,
};

const TAB_ROUTES: Record<BottomTab, string> = {
  home: "/home",
  dashboard: "/dashboard",
  proyectos: "/materiales",
  calendario: "/calendario",
  planos: "/planos",
  presupuestos: "/presupuestos",
  chat: "/chat",
  sat: "/sat",
  documentos: "/documentos",
  preciario: "/preciario",
  documentaciones: "/documentaciones",
  notas: "/notas",
  ajustes: "/admin",
};

const LABELS: Record<BottomTab, string> = {
  home: "Inicio",
  dashboard: "Dashboard",
  proyectos: "Proyectos",
  calendario: "Calendario",
  planos: "Planos",
  presupuestos: "Presupuestos",
  chat: "Chat",
  ajustes: "Ajustes",
  sat: "CRM SAT",
  documentos: "Docs. Internos",
  preciario: "Preciario",
  documentaciones: "Docs. y Software",
  notas: "Notas",
};

let _cachedPerms: string[] | null = null;

function Icon({ tab, on, size }: { tab: BottomTab; on: boolean; size: number }) {
  const color = on ? COLORS.primary : COLORS.textSecondary;
  if (tab === "home") return <Ionicons name={on ? "home" : "home-outline"} size={size} color={color} />;
  if (tab === "dashboard") return <Ionicons name={on ? "stats-chart" : "stats-chart-outline"} size={size} color={color} />;
  if (tab === "proyectos") return <MaterialCommunityIcons name="set-square" size={size + 2} color={color} />;
  if (tab === "calendario") return <Ionicons name={on ? "calendar" : "calendar-outline"} size={size} color={color} />;
  if (tab === "planos") return <Ionicons name={on ? "map" : "map-outline"} size={size} color={color} />;
  if (tab === "presupuestos") return <Ionicons name={on ? "document-text" : "document-text-outline"} size={size} color={color} />;
  if (tab === "sat") return <Ionicons name={on ? "headset" : "headset-outline"} size={size} color={color} />;
  if (tab === "documentos") return <Ionicons name={on ? "folder-open" : "folder-open-outline"} size={size} color={color} />;
  if (tab === "notas") return <Ionicons name={on ? "book" : "book-outline"} size={size} color={color} />;
  return <Ionicons name={on ? "settings" : "settings-outline"} size={size} color={color} />;
}

function TabButton({ tab, on, label, onPress, styles: st }: {
  tab: BottomTab; on: boolean; label: string; onPress: () => void; styles: any;
}) {
  const pillOpacity = useRef(new Animated.Value(on ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(pillOpacity, {
      toValue: on ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [on]);

  return (
    <TouchableOpacity style={st.tab} onPress={onPress} activeOpacity={0.6}>
      <View style={st.tabIconWrap}>
        <Icon tab={tab} on={on} size={22} />
        <Animated.View style={[st.tabPill, { opacity: pillOpacity }]} />
      </View>
      <Text style={[st.label, on && st.labelActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function IOSTabBar({ active, isAdmin: _isAdmin }: { active: BottomTab; isAdmin?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [perms, setPerms] = useState<string[] | null>(_cachedPerms);
  const styles = useThemedStyles(useStyles);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await api.me();
        const p = (me?.permissions as string[]) || [];
        _cachedPerms = p;
        if (alive) setPerms(p);
      } catch {
        if (alive) setPerms([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  const go = (tab: BottomTab) => {
    if (tab === active) return;
    router.replace(TAB_ROUTES[tab] as any);
  };

  const allTabs: BottomTab[] = ["ajustes", "proyectos", "home", "dashboard", "calendario", "planos", "presupuestos", "sat", "documentos", "notas"];
  const isReady = perms !== null;
  const visibleTabs = !isReady
    ? allTabs.filter((t) => t !== "sat")
    : allTabs.filter((t) => {
        const p = TAB_PERM_MAP[t];
        return p === null || perms!.includes(p);
      });

  const ORDER: BottomTab[] = ["home", "dashboard", "calendario", "planos", "proyectos", "documentos", "presupuestos", "chat", "notas", "sat", "ajustes"];
  const ordered = ORDER.filter((t) => visibleTabs.includes(t));

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {ordered.map((tab) => {
        const on = active === tab;
        return (
          <TabButton
            key={tab}
            tab={tab}
            on={on}
            label={LABELS[tab]}
            onPress={() => go(tab)}
            styles={styles}
          />
        );
      })}
    </View>
  );
}

const useStyles = () => {
  const isWeb = Platform.OS === "web";
  const surfaceBg = COLORS.surface;
  const wrapBg = isWeb ? surfaceBg + "B8" : surfaceBg;

  return StyleSheet.create({
    wrap: {
      flexDirection: "row",
      backgroundColor: wrapBg,
      borderTopWidth: ios.hairline,
      borderTopColor: COLORS.border,
      paddingTop: 4,
      paddingHorizontal: 4,
      ...Platform.select({
        web: { backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" } as any,
        default: {},
      }),
    },
    tab: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 4,
      gap: 2,
    },
    tabIconWrap: {
      alignItems: "center",
      justifyContent: "center",
      height: 30,
    },
    tabPill: {
      width: 20,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: COLORS.primary,
      position: "absolute",
      bottom: -2,
    },
    label: {
      fontFamily: ios.font.family,
      fontSize: 9,
      fontWeight: "500",
      color: COLORS.textSecondary,
      letterSpacing: 0.3,
    },
    labelActive: {
      color: COLORS.primary,
      fontWeight: "600",
    },
  });
};
