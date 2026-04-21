import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "./api";

export type BottomTab = "home" | "proyectos" | "calendario" | "planos" | "ajustes";

export default function BottomNav({ active, isAdmin }: { active: BottomTab; isAdmin?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const go = (tab: BottomTab) => {
    if (tab === active) return;
    switch (tab) {
      case "home": router.replace("/home"); break;
      case "proyectos": router.replace("/materiales"); break;
      case "calendario": router.replace("/calendario"); break;
      case "planos": router.replace("/planos"); break;
      case "ajustes": router.replace("/admin"); break;
    }
  };

  const Icon = ({ tab }: { tab: BottomTab }) => {
    const on = active === tab;
    const color = on ? COLORS.primary : COLORS.textSecondary;
    if (tab === "home") return <Ionicons name={on ? "home" : "home-outline"} size={24} color={color} />;
    if (tab === "proyectos") return <MaterialCommunityIcons name={on ? "set-square" : "set-square"} size={26} color={color} />;
    if (tab === "calendario") return <Ionicons name={on ? "calendar" : "calendar-outline"} size={24} color={color} />;
    if (tab === "planos") return <Ionicons name={on ? "map" : "map-outline"} size={24} color={color} />;
    return <Ionicons name={on ? "settings" : "settings-outline"} size={24} color={color} />;
  };

  const labels: Record<BottomTab, string> = {
    home: "Inicio",
    proyectos: "Proyectos",
    calendario: "Calendario",
    planos: "Planos",
    ajustes: "Ajustes",
  };

  // Order (left → right): Ajustes, Proyectos, Inicio, Calendario, Planos
  // Ajustes only visible for admins
  const tabs: BottomTab[] = isAdmin
    ? ["ajustes", "proyectos", "home", "calendario", "planos"]
    : ["proyectos", "home", "calendario", "planos"];

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {tabs.map((tab) => {
        const on = active === tab;
        return (
          <TouchableOpacity
            key={tab}
            testID={`tab-${tab}`}
            style={styles.tab}
            onPress={() => go(tab)}
            activeOpacity={0.7}
          >
            <Icon tab={tab} />
            <Text style={[styles.label, on && { color: COLORS.primary, fontWeight: "800" }]}>{labels[tab]}</Text>
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
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 6,
    paddingHorizontal: 4,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: -2 } },
      android: { elevation: 8 },
      default: {},
    }),
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 4, gap: 2 },
  label: { fontSize: 10, fontWeight: "600", color: COLORS.textSecondary, letterSpacing: 0.2 },
});
