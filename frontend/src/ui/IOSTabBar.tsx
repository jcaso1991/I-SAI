/**
 * IOSTabBar — Tab bar with iOS look-and-feel.
 *
 * Drop-in replacement for the existing BottomNav. Same API surface
 * (active prop + isAdmin) so the rest of the app keeps working.
 */
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ios } from "./iosTheme";

export type BottomTab =
  | "home" | "proyectos" | "calendario" | "planos"
  | "presupuestos" | "ajustes" | "sat";

export default function IOSTabBar({ active, isAdmin }: { active: BottomTab; isAdmin?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const go = (tab: BottomTab) => {
    if (tab === active) return;
    switch (tab) {
      case "home": router.replace("/home"); break;
      case "proyectos": router.replace("/materiales"); break;
      case "calendario": router.replace("/calendario"); break;
      case "planos": router.replace("/planos"); break;
      case "presupuestos": router.replace("/presupuestos"); break;
      case "ajustes": router.replace("/admin"); break;
    }
  };

  const Icon = ({ tab, on }: { tab: BottomTab; on: boolean }) => {
    const color = on ? ios.colors.brand : ios.colors.tabInactive;
    const sz = 26;
    if (tab === "home") return <Ionicons name={on ? "house.fill" as any : "house" as any} size={sz} color={color} />;
    if (tab === "proyectos") return <MaterialCommunityIcons name="set-square" size={sz + 2} color={color} />;
    if (tab === "calendario") return <Ionicons name={on ? "calendar" : "calendar-outline"} size={sz} color={color} />;
    if (tab === "planos") return <Ionicons name={on ? "map" : "map-outline"} size={sz} color={color} />;
    if (tab === "presupuestos") return <Ionicons name={on ? "document-text" : "document-text-outline"} size={sz} color={color} />;
    return <Ionicons name={on ? "settings" : "settings-outline"} size={sz} color={color} />;
  };

  // Fallback for invalid SF Symbol names on web/RN
  const SafeIcon = ({ tab, on }: { tab: BottomTab; on: boolean }) => {
    const color = on ? ios.colors.brand : ios.colors.tabInactive;
    const sz = 26;
    if (tab === "home") return <Ionicons name={on ? "home" : "home-outline"} size={sz} color={color} />;
    if (tab === "proyectos") return <MaterialCommunityIcons name="set-square" size={sz + 2} color={color} />;
    if (tab === "calendario") return <Ionicons name={on ? "calendar" : "calendar-outline"} size={sz} color={color} />;
    if (tab === "planos") return <Ionicons name={on ? "map" : "map-outline"} size={sz} color={color} />;
    if (tab === "presupuestos") return <Ionicons name={on ? "document-text" : "document-text-outline"} size={sz} color={color} />;
    return <Ionicons name={on ? "settings" : "settings-outline"} size={sz} color={color} />;
  };

  const labels: Record<BottomTab, string> = {
    home: "Inicio",
    proyectos: "Proyectos",
    calendario: "Calendario",
    planos: "Planos",
    presupuestos: "Presupuestos",
    ajustes: "Ajustes",
    sat: "CRM SAT",
  };

  const tabs: BottomTab[] = ["ajustes", "proyectos", "home", "calendario", "planos", "presupuestos"];

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 4) }]}>
      {tabs.map((tab) => {
        const on = active === tab;
        return (
          <TouchableOpacity
            key={tab}
            testID={`tab-${tab}`}
            style={styles.tab}
            onPress={() => go(tab)}
            activeOpacity={0.6}
          >
            <SafeIcon tab={tab} on={on} />
            <Text style={[styles.label, on && { color: ios.colors.brand, fontWeight: "600" }]}>{labels[tab]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: Platform.select({
      ios: "rgba(255,255,255,0.92)",
      default: "#FFFFFF",
    }),
    borderTopWidth: ios.hairline,
    borderTopColor: ios.colors.separator,
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
