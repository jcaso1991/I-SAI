/**
 * Roles & Permissions admin screen.
 *
 * - Lists all roles (system + custom)
 * - Allows toggling permissions per role with checkboxes
 * - Allows creating / renaming / deleting custom roles
 * - The "Administrador principal" role is locked (cannot be edited)
 *
 * Access: anyone with `roles.manage` permission (admin principal by default).
 */
import { useCallback, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS } from "../src/api";

type Permission = { key: string; label: string; module: string };
type NotifPref = { key: string; label: string; module: string };
type Role = {
  id: string;
  key: string;
  name: string;
  permissions: string[];
  notification_prefs: string[];
  system: boolean;
  locked: boolean;
  created_at?: string;
};

export default function RolesScreen() {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [notifs, setNotifs] = useState<NotifPref[]>([]);
  const [loading, setLoading] = useState(true);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    try {
      const [rl, pp, np] = await Promise.all([api.listRoles(), api.listPermissions(), api.listNotificationPrefs()]);
      setRoles(rl);
      setPerms((pp?.permissions as Permission[]) || []);
      setNotifs((np?.notifications as NotifPref[]) || []);
    } catch (e: any) {
      if (/403/i.test(e.message)) {
        Alert.alert("Acceso denegado", "Solo el administrador principal puede gestionar roles.");
        router.back();
        return;
      }
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const doDelete = (r: Role) => {
    if (r.system) {
      Alert.alert("No permitido", "Los roles del sistema no se pueden eliminar.");
      return;
    }
    Alert.alert(
      "Eliminar rol",
      `¿Seguro que quieres eliminar "${r.name}"?\nLos usuarios con este rol pasarán a ser Técnicos.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar", style: "destructive",
          onPress: async () => {
            try {
              await api.deleteRole(r.id);
              await load();
            } catch (e: any) {
              Alert.alert("Error", e.message);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => {
          try { if (router.canGoBack && router.canGoBack()) { router.back(); return; } } catch {}
          router.replace("/admin");
        }}>
          <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Roles y permisos</Text>
        <TouchableOpacity
          testID="btn-new-role"
          style={s.iconBtn}
          onPress={() => setShowCreate(true)}
        >
          <Ionicons name="add" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        <Text style={s.subtitle}>{roles.length} rol{roles.length !== 1 ? "es" : ""}</Text>
        {roles.map((r) => (
          <View key={r.id} style={s.roleCard} testID={`role-card-${r.key}`}>
            <View style={s.roleHead}>
              <View style={[s.iconBox, r.locked ? { backgroundColor: "#FEE2E2" } : r.system ? { backgroundColor: COLORS.pillBlueBg } : { backgroundColor: COLORS.pillPurpleBg }]}>
                <Ionicons
                  name={r.locked ? "shield" : r.system ? "shield-checkmark" : "person-circle"}
                  size={24}
                  color={r.locked ? "#991B1B" : r.system ? COLORS.pillBlueText : COLORS.pillPurpleText}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.roleName} numberOfLines={1}>{r.name}</Text>
                <View style={{ flexDirection: "row", gap: 6, alignItems: "center", marginTop: 2 }}>
                  {r.system && (
                    <View style={s.pill}><Text style={s.pillTxt}>Sistema</Text></View>
                  )}
                  {r.locked && (
                    <View style={[s.pill, { backgroundColor: "#FEE2E2" }]}>
                      <Text style={[s.pillTxt, { color: "#991B1B" }]}>Bloqueado</Text>
                    </View>
                  )}
                  <Text style={s.roleSub}>{r.permissions.length} permiso{r.permissions.length !== 1 ? "s" : ""}</Text>
                </View>
              </View>
              <TouchableOpacity
                testID={`btn-edit-role-${r.key}`}
                style={[s.actionBtn, r.locked && { opacity: 0.4 }]}
                onPress={() => !r.locked && setEditRole(r)}
                disabled={r.locked}
              >
                <Ionicons name="create-outline" size={20} color={COLORS.navy} />
              </TouchableOpacity>
              {!r.system && (
                <TouchableOpacity
                  testID={`btn-delete-role-${r.key}`}
                  style={s.actionBtn}
                  onPress={() => doDelete(r)}
                >
                  <Ionicons name="trash-outline" size={20} color={COLORS.errorText} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      <CreateRoleModal
        visible={showCreate}
        permissions={perms}
        notifications={notifs}
        onClose={() => setShowCreate(false)}
        onDone={() => { setShowCreate(false); load(); }}
      />

      <EditRoleModal
        role={editRole}
        permissions={perms}
        notifications={notifs}
        onClose={() => setEditRole(null)}
        onDone={() => { setEditRole(null); load(); }}
      />
    </SafeAreaView>
  );
}

// ---------------- Create role ----------------
function CreateRoleModal({ visible, permissions, notifications, onClose, onDone }: {
  visible: boolean; permissions: Permission[]; notifications: NotifPref[]; onClose: () => void; onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [notifSelected, setNotifSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    setName(""); setSelected([]); setNotifSelected([]);
  }, [visible]));

  const togglePerm = (k: string) => {
    setSelected((prev) => prev.includes(k) ? prev.filter((p) => p !== k) : [...prev, k]);
  };

  const toggleNotif = (k: string) => {
    setNotifSelected((prev) => prev.includes(k) ? prev.filter((p) => p !== k) : [...prev, k]);
  };

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Nombre obligatorio");
      return;
    }
    setSaving(true);
    try {
      await api.createRole({ name: name.trim(), permissions: selected, notification_prefs: notifSelected } as any);
      onDone();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.modalRoot}
      >
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Nuevo rol</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={26} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <ScrollView>
            <Text style={s.mLabel}>Nombre del rol</Text>
            <TextInput
              testID="modal-role-name"
              style={s.mInput}
              value={name}
              onChangeText={setName}
              placeholder="Ej. Supervisor SAT"
              placeholderTextColor={COLORS.textDisabled}
            />
            <Text style={s.mLabel}>Permisos</Text>
            <PermissionList
              permissions={permissions}
              selected={selected}
              onToggle={togglePerm}
            />
            <Text style={s.mLabel}>Notificaciones</Text>
            <NotificationList
              notifications={notifications}
              selected={notifSelected}
              onToggle={toggleNotif}
            />
            <TouchableOpacity
              testID="modal-submit-role"
              style={[s.primary, saving && { opacity: 0.6 }]}
              onPress={submit}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>CREAR ROL</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------- Edit role ----------------
function EditRoleModal({ role, permissions, notifications, onClose, onDone }: {
  role: Role | null; permissions: Permission[]; notifications: NotifPref[]; onClose: () => void; onDone: () => void;
}) {
  const [name, setName] = useState(role?.name || "");
  const [selected, setSelected] = useState<string[]>(role?.permissions || []);
  const [notifSelected, setNotifSelected] = useState<string[]>(role?.notification_prefs || []);
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    setName(role?.name || "");
    setSelected(role?.permissions || []);
    setNotifSelected(role?.notification_prefs || []);
  }, [role?.id]));

  const togglePerm = (k: string) => {
    setSelected((prev) => prev.includes(k) ? prev.filter((p) => p !== k) : [...prev, k]);
  };

  const toggleNotif = (k: string) => {
    setNotifSelected((prev) => prev.includes(k) ? prev.filter((p) => p !== k) : [...prev, k]);
  };

  const submit = async () => {
    if (!role) return;
    if (!name.trim()) {
      Alert.alert("Error", "Nombre obligatorio");
      return;
    }
    setSaving(true);
    try {
      await api.updateRole(role.id, { name: name.trim(), permissions: selected, notification_prefs: notifSelected } as any);
      onDone();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={!!role} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.modalRoot}
      >
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Editar rol</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={26} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <ScrollView>
            <Text style={s.mLabel}>Nombre</Text>
            <TextInput
              style={s.mInput}
              value={name}
              onChangeText={setName}
              placeholderTextColor={COLORS.textDisabled}
              editable={!role?.system}
            />
            {role?.system && (
              <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>
                ℹ️ Es un rol del sistema. El nombre no se puede cambiar pero sí los permisos.
              </Text>
            )}
            <Text style={s.mLabel}>Permisos</Text>
            <PermissionList
              permissions={permissions}
              selected={selected}
              onToggle={togglePerm}
            />
            <Text style={s.mLabel}>Notificaciones</Text>
            <NotificationList
              notifications={notifications}
              selected={notifSelected}
              onToggle={toggleNotif}
            />
            <TouchableOpacity
              style={[s.primary, saving && { opacity: 0.6 }]}
              onPress={submit}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>GUARDAR CAMBIOS</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------- Permission list (grouped by module) ----------------
function PermissionList({ permissions, selected, onToggle }: {
  permissions: Permission[]; selected: string[]; onToggle: (k: string) => void;
}) {
  // Group by module preserving order
  const groups: { [mod: string]: Permission[] } = {};
  const order: string[] = [];
  for (const p of permissions) {
    if (!groups[p.module]) { groups[p.module] = []; order.push(p.module); }
    groups[p.module].push(p);
  }

  return (
    <View style={{ gap: 14 }}>
      {order.map((mod) => (
        <View key={mod} style={s.permGroup}>
          <Text style={s.permGroupTitle}>{mod.toUpperCase()}</Text>
          {groups[mod].map((p) => {
            const on = selected.includes(p.key);
            return (
              <TouchableOpacity
                key={p.key}
                testID={`perm-${p.key}`}
                style={s.permRow}
                onPress={() => onToggle(p.key)}
                activeOpacity={0.7}
              >
                <View style={[s.checkbox, on && s.checkboxOn]}>
                  {on && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Text style={[s.permLabel, on && { color: COLORS.text, fontWeight: "700" }]}>
                  {p.label}
                </Text>
                <Text style={s.permKey}>{p.key}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ---------------- Notification preferences list (grouped by module) ----------------
function NotificationList({ notifications, selected, onToggle }: {
  notifications: NotifPref[]; selected: string[]; onToggle: (k: string) => void;
}) {
  const groups: { [mod: string]: NotifPref[] } = {};
  const order: string[] = [];
  for (const n of notifications) {
    if (!groups[n.module]) { groups[n.module] = []; order.push(n.module); }
    groups[n.module].push(n);
  }

  return (
    <View style={{ gap: 14 }}>
      {order.map((mod) => (
        <View key={mod} style={s.permGroup}>
          <Text style={s.permGroupTitle}>{mod.toUpperCase()}</Text>
          {groups[mod].map((n) => {
            const on = selected.includes(n.key);
            return (
              <TouchableOpacity
                key={n.key}
                testID={`notif-${n.key}`}
                style={s.permRow}
                onPress={() => onToggle(n.key)}
                activeOpacity={0.7}
              >
                <View style={[s.checkbox, on && s.checkboxOn]}>
                  {on && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Text style={[s.permLabel, on && { color: COLORS.text, fontWeight: "700" }]}>
                  {n.label}
                </Text>
                <Text style={s.permKey}>{n.key}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 6, fontWeight: "600" },
  roleCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  roleHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  roleName: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  roleSub: { fontSize: 12, color: COLORS.textSecondary },
  pill: {
    backgroundColor: COLORS.pillBlueBg, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 6,
  },
  pillTxt: { fontSize: 10, fontWeight: "900", letterSpacing: 0.8, color: COLORS.pillBlueText },
  actionBtn: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center",
  },
  // Modal
  modalRoot: {
    flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalCard: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: "92%",
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  mLabel: {
    fontSize: 11, fontWeight: "800", color: COLORS.textSecondary,
    letterSpacing: 1.2, marginTop: 12, marginBottom: 6,
  },
  mInput: {
    height: 50, backgroundColor: COLORS.bg, borderWidth: 2, borderColor: COLORS.borderInput,
    borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: COLORS.text,
  },
  permGroup: {
    backgroundColor: COLORS.bg, borderRadius: 12, padding: 12, gap: 4,
    borderWidth: 1, borderColor: COLORS.border,
  },
  permGroupTitle: {
    fontSize: 11, fontWeight: "900", color: COLORS.textSecondary,
    letterSpacing: 1.5, marginBottom: 8,
  },
  permRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 8,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: COLORS.borderInput, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  checkboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  permLabel: { flex: 1, fontSize: 14, color: COLORS.textSecondary, fontWeight: "500" },
  permKey: { fontSize: 10, color: COLORS.textDisabled, fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }) },
  primary: {
    height: 52, borderRadius: 12, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center", marginTop: 20,
  },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: 1 },
});
