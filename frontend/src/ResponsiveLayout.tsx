import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, api } from "./api";
import BottomNav, { BottomTab } from "./BottomNav";
import { useBreakpoint } from "./useBreakpoint";
import { useTheme, useThemedStyles } from "./theme";
import { ios } from "./ui/iosTheme";

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
  active: string;
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
    const iconColor = active ? acc : COLORS.textSecondary;
    const iconBg = active ? (acc + "18") : "transparent";
    return (
      <TouchableOpacity
        style={[s.linkRow, active && s.linkRowActive]}
        onPress={() => router.replace(to as any)}
        activeOpacity={0.7}
      >
        <View style={[s.linkBar, active && { backgroundColor: acc }]} />
        <View style={[s.linkIcon, { backgroundColor: iconBg }]}>
          {matIcon ? (
            <MaterialCommunityIcons name={icon as any} size={18} color={iconColor} />
          ) : (
            <Ionicons name={icon as any} size={18} color={iconColor} />
          )}
        </View>
        <Text style={[s.linkTxt, { color: iconColor }, active && { fontWeight: "600" as any }]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  if (!isWide) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <View style={{ flex: 1 }}>{children}</View>
        <BottomNav active={active} isAdmin={isAdmin} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <View style={s.sidebar}>
        <View style={s.brand}>
          <View style={s.logoDot}>
            <Text style={s.logoText}>i</Text>
          </View>
          <View>
            <Text style={s.brandTxt}>i-SAI</Text>
            <Text style={s.brandSub}>Gestor de proyectos</Text>
          </View>
        </View>

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

        <Text style={s.sectionLabel}>Navegación</Text>
        <SideLink active={active === "home"} label="Inicio" icon="home" to="/home" accent={ios.colors.brand} />
        <SideLink active={active === "dashboard"} label="Dashboard" icon="stats-chart" to="/dashboard" accent={ios.colors.brand} />
        {has("dashboard.view") && (
          <SideLink active={active === "ventas-beneficios"} label="Ventas y Beneficios" icon="cash" to="/dashboard/ventas-beneficios" accent={ios.colors.orange} />
        )}

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
        <SideLink active={active === "clientes"} label="Clientes" icon="people-outline" to="/clientes" accent={ios.colors.teal} />

        <Text style={s.sectionLabel}>Documentos internos</Text>
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
            <Text style={s.sectionLabel}>Administración</Text>
            {canOnedrive && (
              <SideLink active={active === "ajustes"} label="Ajustes" icon="cloud-outline" to="/admin" />
            )}
            {!canOnedrive && (
              <SideLink active={active === "ajustes"} label="Ajustes" icon="settings-outline" to="/admin" />
            )}
            <SideLink active={active === "solicitudes"} label="Solicitudes presupuesto" icon="cart-outline" to="/admin/solicitudes" />
          </>
        )}
        {!canOnedrive && !canManageUsers && !canManageRoles && (
          <SideLink active={active === "ajustes"} label="Ajustes" icon="settings-outline" to="/admin" />
        )}

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={s.themeToggle} onPress={toggleTheme}>
          <Ionicons name={theme === "dark" ? "sunny" : "moon"} size={16} color={COLORS.textSecondary} />
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
    width: 240,
    backgroundColor: COLORS.surface,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    paddingVertical: 24,
    paddingHorizontal: 16,
    ...Platform.select({
      web: { boxShadow: "2px 0 24px rgba(0,0,0,0.02)" } as any,
      default: { shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 24, shadowOffset: { width: 2, height: 0 } } as any,
    }),
  },

  brand: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 6, paddingBottom: 20,
  },
  logoDot: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
    ...Platform.select({
      web: { boxShadow: `0 4px 12px ${COLORS.primary}40` } as any,
      default: { shadowColor: COLORS.primary, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
    }),
  },
  logoText: { color: "#fff", fontSize: 18, fontWeight: "700", lineHeight: 20 },
  brandTxt: { fontSize: 17, fontWeight: "700", color: COLORS.text, letterSpacing: -0.3 },
  brandSub: { fontSize: 10, fontWeight: "500", color: COLORS.textDisabled, letterSpacing: 0.3, marginTop: 1 },

  userCard: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 10,
    borderRadius: 14, marginBottom: 20,
    borderWidth: ios.hairline, borderColor: COLORS.border,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  userName: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  roleChip: {
    flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2,
  },
  roleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#10B981" },
  userRole: { fontSize: 10, color: COLORS.textDisabled, fontWeight: "500", letterSpacing: 0.2 },

  sectionLabel: {
    fontSize: 11, fontWeight: "600", color: COLORS.textDisabled,
    letterSpacing: 0.5, marginTop: 8, marginBottom: 6, marginLeft: 10,
  },

  linkRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingRight: 12, paddingVertical: 10, paddingLeft: 8,
    borderRadius: 10, marginBottom: 1,
  },
  linkRowActive: { backgroundColor: COLORS.primarySoft + "80" },
  linkBar: {
    width: 3, height: 20, borderRadius: 2, backgroundColor: "transparent",
    marginLeft: 0,
  },
  linkIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  linkTxt: { fontSize: 13, fontWeight: "500", flex: 1 },

  themeToggle: {
    flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center",
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: ios.radius.pill,
    borderWidth: 1, borderColor: COLORS.border,
    marginHorizontal: 4, marginBottom: 4,
  },
  themeToggleTxt: { fontSize: 11, color: COLORS.textSecondary, fontWeight: "500" },

  content: { flex: 1, backgroundColor: '#0A0E1A' },
});
