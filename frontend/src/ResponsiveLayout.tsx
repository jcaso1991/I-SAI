import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "./api";
import BottomNav, { BottomTab } from "./BottomNav";
import { useBreakpoint } from "./useBreakpoint";

export default function ResponsiveLayout({
  active,
  isAdmin,
  children,
  onLogout,
  userName,
}: {
  active: BottomTab;
  isAdmin?: boolean;
  children: React.ReactNode;
  onLogout?: () => void;
  userName?: string;
}) {
  const { isWide } = useBreakpoint();

  if (!isWide) {
    // Mobile: content fills screen, BottomNav at bottom
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <View style={{ flex: 1 }}>{children}</View>
        <BottomNav active={active} isAdmin={isAdmin} />
      </View>
    );
  }

  // Desktop / tablet: side navigation
  return (
    <View style={s.root}>
      <View style={s.sidebar}>
        <View style={s.brand}>
          <View style={s.logoDot} />
          <Text style={s.brandTxt}>i-SAI</Text>
        </View>
        <View style={s.userCard}>
          <View style={s.avatar}>
            <Ionicons name="person" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.userName} numberOfLines={1}>{userName || "Usuario"}</Text>
            <Text style={s.userRole}>{isAdmin ? "Administrador" : "Técnico"}</Text>
          </View>
        </View>
        <View style={{ height: 12 }} />
        <SideLink active={active === "home"} label="Inicio" icon="home" to="/home" />
        <SideLink active={active === "proyectos"} label="Proyectos" icon="set-square" to="/materiales" matIcon />
        <SideLink active={active === "calendario"} label="Calendario" icon="calendar" to="/calendario" />
        <SideLink active={active === "planos"} label="Planos" icon="map" to="/planos" />
        <SideLink active={active === "presupuestos"} label="Presupuestos" icon="document-text" to="/presupuestos" />
        {isAdmin && (
          <>
            <View style={s.divider} />
            <SideLink active={active === "ajustes"} label="OneDrive" icon="cloud-outline" to="/admin" />
            <SideLink active={false} label="Usuarios" icon="people-outline" to="/users" />
          </>
        )}
        <View style={{ flex: 1 }} />
        {onLogout && (
          <TouchableOpacity style={s.logout} onPress={onLogout}>
            <Ionicons name="log-out-outline" size={20} color={COLORS.errorText} />
            <Text style={s.logoutTxt}>Cerrar sesión</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={s.content}>{children}</View>
    </View>
  );
}

function SideLink({
  active, label, icon, to, matIcon,
}: { active: boolean; label: string; icon: string; to: string; matIcon?: boolean }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={[s.link, active && s.linkActive]}
      onPress={() => router.replace(to as any)}
      activeOpacity={0.7}
    >
      {matIcon ? (
        <MaterialCommunityIcons name={icon as any} size={22} color={active ? "#fff" : COLORS.text} />
      ) : (
        <Ionicons name={icon as any} size={22} color={active ? "#fff" : COLORS.text} />
      )}
      <Text style={[s.linkTxt, active && { color: "#fff", fontWeight: "800" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", backgroundColor: COLORS.bg },
  sidebar: {
    width: 240, backgroundColor: COLORS.surface, borderRightWidth: 1,
    borderRightColor: COLORS.border, paddingVertical: 18, paddingHorizontal: 14,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4, paddingBottom: 10 },
  logoDot: { width: 26, height: 26, borderRadius: 6, backgroundColor: COLORS.primary },
  brandTxt: { fontSize: 18, fontWeight: "900", color: COLORS.navy, letterSpacing: 1 },
  userCard: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 10,
    backgroundColor: COLORS.bg, borderRadius: 10, marginBottom: 6,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
  },
  userName: { fontSize: 14, fontWeight: "800", color: COLORS.text },
  userRole: { fontSize: 11, color: COLORS.textSecondary, fontWeight: "600" },
  link: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12,
    paddingVertical: 10, borderRadius: 10, marginBottom: 2,
  },
  linkActive: { backgroundColor: COLORS.primary },
  linkTxt: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10, marginHorizontal: 6 },
  logout: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12,
    paddingVertical: 10, borderRadius: 10,
  },
  logoutTxt: { fontSize: 14, fontWeight: "700", color: COLORS.errorText },
  content: { flex: 1, backgroundColor: COLORS.bg },
});
