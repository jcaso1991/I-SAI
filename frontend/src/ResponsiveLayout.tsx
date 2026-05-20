import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, api } from "./api";
import BottomNav, { BottomTab } from "./BottomNav";
import { useBreakpoint } from "./useBreakpoint";
import { useTheme, useThemedStyles } from "./theme";
import { ios } from "./ui/iosTheme";

// Build a 2-letter avatar string from a full name.
function initials(name?: string): string {
  if (!name) return "US";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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
  const [perms, setPerms] = useState<string[]>([]);
  const [roleName, setRoleName] = useState<string | null>(null);
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await api.me();
        if (!alive) return;
        setPerms((me?.permissions as string[]) || []);
        setRoleName((me?.role_name as string) || null);
      } catch {
        if (alive) setPerms([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  const has = (p: string) => perms.includes(p);
  const canManageUsers = has("users.manage");
  const canManageRoles = has("roles.manage");
  const canOnedrive = has("onedrive.manage");

  const s = useThemedStyles(useS);

  function SideLink({
    active, label, icon, to, matIcon, accent,
  }: { active: boolean; label: string; icon: string; to: string; matIcon?: boolean; accent?: string }) {
    const router = useRouter();
    const acc = accent || COLORS.primary;
    const iconColor = accent ? acc : (active ? COLORS.primary : COLORS.textSecondary);
    const iconBg = accent ? (active ? acc : (acc + "18")) : (active ? COLORS.primarySoft : "transparent");
    return (
      <TouchableOpacity
        style={[s.linkRow, active && s.linkRowActive]}
        onPress={() => router.replace(to as any)}
        activeOpacity={0.7}
      >
        <View style={[s.linkBar, active && { backgroundColor: acc }]} />
        <View style={[s.linkIcon, active && s.linkIconActive, { backgroundColor: iconBg }]}>
          {matIcon ? (
            <MaterialCommunityIcons name={icon as any} size={18} color={iconColor} />
          ) : (
            <Ionicons name={icon as any} size={18} color={iconColor} />
          )}
        </View>
        <Text style={[s.linkTxt, { color: accent ? acc : COLORS.textSecondary }, active && { color: acc, fontWeight: "800" as any }]}>{label}</Text>
      </TouchableOpacity>
    );
  }

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
        {/* Brand — elegant mono-wordmark with a gradient square logo */}
        <View style={s.brand}>
          <View style={s.logoDot}>
            <Text style={s.logoText}>i</Text>
          </View>
          <View>
            <Text style={s.brandTxt}>i-SAI</Text>
            <Text style={s.brandSub}>Gestor de proyectos</Text>
          </View>
        </View>

        {/* User pill with colored initials avatar */}
        <View style={s.userCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials(userName)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.userName} numberOfLines={1}>{userName || "Usuario"}</Text>
            <View style={s.roleChip}>
              <View style={s.roleDot} />
              <Text style={s.userRole}>{roleName || (isAdmin ? "Administrador" : "Usuario")}</Text>
            </View>
          </View>
          {onLogout && (
            <TouchableOpacity onPress={onLogout} style={{ padding: 4 }}>
              <Ionicons name="log-out-outline" size={16} color={COLORS.errorText} />
            </TouchableOpacity>
          )}
        </View>

        <Text style={s.sectionLabel}>NAVEGACIÓN</Text>
        <SideLink active={active === "home"} label="Inicio" icon="home" to="/home" accent={ios.colors.brand} />
        <SideLink active={active === "dashboard"} label="Dashboard" icon="stats-chart" to="/dashboard" accent={ios.colors.brand} />
        {has("calendario.view") && (
          <SideLink active={active === "calendario"} label="Calendario" icon="calendar" to="/calendario" accent={ios.colors.green} />
        )}
        {has("planos.view") && (
          <SideLink active={active === "planos"} label="Planos" icon="map" to="/planos" accent={ios.colors.orange} />
        )}
        {has("proyectos.view") && (
          <SideLink active={active === "proyectos"} label="Proyectos" icon="set-square" to="/materiales" matIcon accent={ios.colors.brand} />
        )}
        {has("presupuestos.view") && (
          <SideLink active={active === "presupuestos"} label="Presupuestos" icon="document-text" to="/presupuestos" accent={ios.colors.purple} />
        )}
        {has("chat.view") && (
          <SideLink active={active === "chat"} label="Chat" icon="chatbubbles" to="/chat" accent={ios.colors.green} />
        )}
        {has("notas.view") && (
          <SideLink active={active === "notas"} label="Notas" icon="book" to="/notas" accent={ios.colors.teal} />
        )}
        {has("sat.view") && (
          <SideLink active={active === "sat"} label="CRM SAT" icon="headset" to="/sat" accent={ios.colors.pink} />
        )}

        <Text style={s.sectionLabel}>DOCUMENTOS INTERNOS</Text>
        {has("preciario.view") && (
          <SideLink active={active === "documentos"} label="Documentos Internos" icon="folder-open" to="/documentos" />
        )}
        {has("preciario.view") && (
          <SideLink active={active === "preciario"} label="Preciario" icon="pricetags" to="/preciario" />
        )}
        {has("preciario.view") && (
          <SideLink active={active === "documentaciones"} label="Documentación y Software" icon="document-text" to="/documentaciones" />
        )}

        {(canOnedrive || canManageUsers || canManageRoles) && (
          <>
            <Text style={s.sectionLabel}>ADMINISTRACIÓN</Text>
            {canOnedrive && (
              <SideLink active={active === "ajustes"} label="OneDrive" icon="cloud-outline" to="/admin" />
            )}
            {!canOnedrive && (
              <SideLink active={active === "ajustes"} label="Ajustes" icon="settings-outline" to="/admin" />
            )}
            {canManageUsers && (
              <SideLink active={false} label="Usuarios" icon="people-outline" to="/users" />
            )}
            {canManageRoles && (
              <SideLink active={false} label="Roles y permisos" icon="shield-outline" to="/roles" />
            )}
          </>
        )}
        {!canOnedrive && !canManageUsers && !canManageRoles && (
          <SideLink active={active === "ajustes"} label="Ajustes" icon="settings-outline" to="/admin" />
        )}

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={s.themeToggle} onPress={toggleTheme}>
          <Ionicons name={theme === "dark" ? "sunny" : "moon"} size={18} color={COLORS.textSecondary} />
          <Text style={s.themeToggleTxt}>{theme === "dark" ? "Modo claro" : "Modo oscuro"}</Text>
        </TouchableOpacity>

      </View>
      <View style={s.content}>{children}</View>
    </View>
  );
}

const useS = () =>
  StyleSheet.create({
  root: { flex: 1, flexDirection: "row", backgroundColor: COLORS.bg },
  sidebar: {
    width: 252, backgroundColor: COLORS.surface, borderRightWidth: 1,
    borderRightColor: COLORS.border, paddingVertical: 22, paddingHorizontal: 14,
  },

  brand: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 6, paddingBottom: 18,
  },
  logoDot: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
    ...Platform.select({
      web: { boxShadow: `0 4px 12px ${COLORS.primary}40` } as any,
      default: { shadowColor: COLORS.primary, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
    }),
  },
  logoText: { color: "#fff", fontSize: 20, fontWeight: "900", lineHeight: 22 },
  brandTxt: { fontSize: 17, fontWeight: "900", color: COLORS.navy, letterSpacing: 0.3 },
  brandSub: { fontSize: 10, fontWeight: "700", color: COLORS.textSecondary, letterSpacing: 0.5 },

  userCard: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 12,
    backgroundColor: COLORS.bg, borderRadius: 14, marginBottom: 18,
    borderWidth: 1, borderColor: COLORS.border,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 14, fontWeight: "900", letterSpacing: 0.5 },
  userName: { fontSize: 13.5, fontWeight: "800", color: COLORS.text },
  roleChip: {
    flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2,
  },
  roleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#10B981" },
  userRole: { fontSize: 10.5, color: COLORS.textSecondary, fontWeight: "700", letterSpacing: 0.2 },

  sectionLabel: {
    fontSize: 10, fontWeight: "900", color: COLORS.textDisabled,
    letterSpacing: 1.4, marginTop: 6, marginBottom: 6, marginLeft: 10,
  },

  linkRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingRight: 12, paddingVertical: 9, borderRadius: 10, marginBottom: 2,
    position: "relative",
  },
  linkRowActive: { backgroundColor: COLORS.primarySoft },
  linkBar: {
    width: 3, height: 20, borderRadius: 2, backgroundColor: "transparent",
    marginLeft: 0,
  },
  linkBarActive: { backgroundColor: COLORS.primary },
  linkIcon: {
    width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center",
    backgroundColor: "transparent",
  },
  linkIconActive: { backgroundColor: "transparent" },
  linkTxt: { fontSize: 13.5, fontWeight: "600", color: COLORS.textSecondary, flex: 1 },
  linkTxtActive: { color: COLORS.primary, fontWeight: "800" },

  themeToggle: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 8, marginBottom: 4,
    borderRadius: 10, backgroundColor: COLORS.bg,
  },
  themeToggleTxt: { fontSize: 13, color: COLORS.textSecondary, fontWeight: "600" },

  logout: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14,
    paddingVertical: 10, borderRadius: 10,
  },
  logoutTxt: { fontSize: 13, fontWeight: "700", color: COLORS.errorText },

  content: { flex: 1, backgroundColor: COLORS.bg },
});
