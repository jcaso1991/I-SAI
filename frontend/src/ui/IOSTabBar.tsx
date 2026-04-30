/**
 * IOSTabBar — Tab bar with iOS look-and-feel.
 *
 * Tabs are filtered dynamically based on the current user's permissions
 * (fetched on mount via /auth/me). Home and Ajustes are always visible.
 */
import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ios } from "./iosTheme";
import { api, COLORS } from "../api";

export type BottomTab =
  | "home" | "proyectos" | "calendario" | "planos"
  | "presupuestos" | "ajustes" | "sat";

const TAB_PERM_MAP: Record<BottomTab, string | null> = {
  home: null,                // always visible
  proyectos: "proyectos.view",
  calendario: "calendario.view",
  planos: "planos.view",
  presupuestos: "presupuestos.view",
  sat: "sat.view",
  ajustes: null,             // always visible
};

const TAB_ROUTES: Record<BottomTab, string> = {
  home: "/home",
  proyectos: "/materiales",
  calendario: "/calendario",
  planos: "/planos",
  presupuestos: "/presupuestos",
  sat: "/sat",
  ajustes: "/admin",
};

const LABELS: Record<BottomTab, string> = {
  home: "Inicio",
  proyectos: "Proyectos",
  calendario: "Calendario",
  planos: "Planos",
  presupuestos: "Presupuestos",
  ajustes: "Ajustes",
  sat: "CRM SAT",
};

// Cache permissions in module scope so all tab bars on the same screen
// share the same list (and the next render is instant).
let _cachedPerms: string[] | null = null;

export default function IOSTabBar({ active, isAdmin: _isAdmin }: { active: BottomTab; isAdmin?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [perms, setPerms] = useState<string[] | null>(_cachedPerms);

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

  const Icon = ({ tab, on }: { tab: BottomTab; on: boolean }) => {
    const color = on ? ios.colors.brand : ios.colors.tabInactive;
    const sz = 26;
    if (tab === "home") return <Ionicons name={on ? "home" : "home-outline"} size={sz} color={color} />;
    if (tab === "proyectos") return <MaterialCommunityIcons name="set-square" size={sz + 2} color={color} />;
    if (tab === "calendario") return <Ionicons name={on ? "calendar" : "calendar-outline"} size={sz} color={color} />;
    if (tab === "planos") return <Ionicons name={on ? "map" : "map-outline"} size={sz} color={color} />;
    if (tab === "presupuestos") return <Ionicons name={on ? "document-text" : "document-text-outline"} size={sz} color={color} />;
    if (tab === "sat") return <Ionicons name={on ? "headset" : "headset-outline"} size={sz} color={color} />;
    return <Ionicons name={on ? "settings" : "settings-outline"} size={sz} color={color} />;
  };

  // Determine which tabs to show. Until perms load, fall back to legacy (admin shows all).
  const allTabs: BottomTab[] = ["ajustes", "proyectos", "home", "calendario", "planos", "presupuestos", "sat"];
  const isReady = perms !== null;
  const visibleTabs = !isReady
    ? allTabs.filter((t) => t !== "sat") // legacy default until perms arrive
    : allTabs.filter((t) => {
        const p = TAB_PERM_MAP[t];
        return p === null || perms!.includes(p);
      });

  // Order: Home leftmost, then functional tabs, Settings rightmost.
  const ORDER: BottomTab[] = ["home", "proyectos", "calendario", "planos", "presupuestos", "sat", "ajustes"];
  const ordered = ORDER.filter((t) => visibleTabs.includes(t));

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 4) }]}>
      {ordered.map((tab) => {
        const on = active === tab;
        return (
          <TouchableOpacity
            key={tab}
            testID={`tab-${tab}`}
            style={styles.tab}
            onPress={() => go(tab)}
            activeOpacity={0.6}
          >
            <Icon tab={tab} on={on} />
            <Text style={[styles.label, on && { color: ios.colors.brand, fontWeight: "600" }]} numberOfLines={1}>
              {LABELS[tab]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderTopWidth: ios.hairline,
    borderTopColor: COLORS.border,
    paddingTop: 6,
    paddingHorizontal: 4,
    ...Platform.select({
      ios: { backdropFilter: "blur(20px)" } as any,
      default: {},
    }),
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 4, gap: 2 },
  label: {
    fontFamily: ios.font.family,
    fontSize: ios.font.tabLabel.size,
    fontWeight: "500",
    color: ios.colors.tabInactive,
    letterSpacing: 0.1,
  },
});
