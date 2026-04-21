import { useCallback, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS } from "../src/api";

type User = { id: string; email: string; name?: string; role: string; color?: string; created_at?: string };
type Role = "admin" | "user";

const USER_COLOR_PALETTE = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#84CC16", "#14B8A6",
  "#6366F1", "#0EA5E9",
];

export default function Users() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);

  const load = async () => {
    try {
      const [list, who] = await Promise.all([api.listUsers(), api.me()]);
      setUsers(list);
      setMe(who);
    } catch (e: any) {
      if (/403|Admin only/i.test(e.message)) {
        Alert.alert("Acceso denegado", "Solo administradores pueden gestionar usuarios.");
        router.back();
        return;
      }
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const doDelete = (u: User) => {
    if (u.id === me?.id) {
      Alert.alert("Error", "No puedes eliminarte a ti mismo.");
      return;
    }
    Alert.alert(
      "Eliminar usuario",
      `¿Seguro que quieres eliminar a ${u.name || u.email}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar", style: "destructive",
          onPress: async () => {
            try {
              await api.deleteUser(u.id);
              await load();
            } catch (e: any) {
              Alert.alert("Error", e.message);
            }
          },
        },
      ]
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
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Usuarios</Text>
        <TouchableOpacity
          testID="btn-new-user"
          style={s.iconBtn}
          onPress={() => setShowCreate(true)}
        >
          <Ionicons name="add" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        <Text style={s.subtitle}>{users.length} usuario{users.length !== 1 ? "s" : ""}</Text>
        {users.map((u) => {
          const isMe = u.id === me?.id;
          return (
            <View
              key={u.id}
              style={s.userCard}
              testID={`user-card-${u.id}`}
            >
              <View style={[s.avatarBox, { backgroundColor: u.color ? u.color + "22" : COLORS.bg, borderWidth: u.color ? 2 : 0, borderColor: u.color || "transparent" }]}>
                <Ionicons
                  name={u.role === "admin" ? "shield-checkmark" : "person"}
                  size={22}
                  color={u.color || (u.role === "admin" ? COLORS.primary : COLORS.textSecondary)}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.userName} numberOfLines={1}>
                  {u.name || u.email} {isMe && <Text style={s.youBadge}>(tú)</Text>}
                </Text>
                <Text style={s.userEmail} numberOfLines={1}>{u.email}</Text>
                <View style={[s.roleBadge, u.role === "admin" ? s.roleAdmin : s.roleUser]}>
                  <Text style={[s.roleBadgeText, u.role === "admin" && { color: COLORS.primary }]}>
                    {u.role === "admin" ? "ADMIN" : "TÉCNICO"}
                  </Text>
                </View>
              </View>
              <View style={s.actions}>
                <TouchableOpacity
                  testID={`btn-edit-${u.id}`}
                  style={s.actionBtn}
                  onPress={() => setEditUser(u)}
                >
                  <Ionicons name="create-outline" size={20} color={COLORS.navy} />
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`btn-pwd-${u.id}`}
                  style={s.actionBtn}
                  onPress={() => setPasswordUser(u)}
                >
                  <Ionicons name="key-outline" size={20} color={COLORS.navy} />
                </TouchableOpacity>
                {!isMe && (
                  <TouchableOpacity
                    testID={`btn-delete-${u.id}`}
                    style={s.actionBtn}
                    onPress={() => doDelete(u)}
                  >
                    <Ionicons name="trash-outline" size={20} color={COLORS.errorText} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <CreateUserModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onDone={() => { setShowCreate(false); load(); }}
      />

      <EditUserModal
        user={editUser}
        onClose={() => setEditUser(null)}
        onDone={() => { setEditUser(null); load(); }}
      />

      <ResetPasswordModal
        user={passwordUser}
        onClose={() => setPasswordUser(null)}
        onDone={() => setPasswordUser(null)}
      />
    </SafeAreaView>
  );
}

// ---------------- Create ----------------
function CreateUserModal({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Email y contraseña son obligatorios");
      return;
    }
    setSaving(true);
    try {
      await api.createUser({ email, password, name: name || undefined, role });
      setEmail(""); setPassword(""); setName(""); setRole("user");
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
            <Text style={s.modalTitle}>Nuevo usuario</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={26} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <ScrollView>
            <Text style={s.mLabel}>Email</Text>
            <TextInput
              testID="modal-email"
              style={s.mInput}
              value={email}
              onChangeText={setEmail}
              placeholder="usuario@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={COLORS.textDisabled}
            />
            <Text style={s.mLabel}>Nombre</Text>
            <TextInput
              testID="modal-name"
              style={s.mInput}
              value={name}
              onChangeText={setName}
              placeholder="Nombre visible"
              placeholderTextColor={COLORS.textDisabled}
            />
            <Text style={s.mLabel}>Contraseña inicial</Text>
            <TextInput
              testID="modal-password"
              style={s.mInput}
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 4 caracteres"
              secureTextEntry
              placeholderTextColor={COLORS.textDisabled}
            />
            <Text style={s.mLabel}>Rol</Text>
            <View style={s.roleRow}>
              <TouchableOpacity
                testID="modal-role-user"
                style={[s.roleChip, role === "user" && s.roleChipActive]}
                onPress={() => setRole("user")}
              >
                <Ionicons name="person" size={18} color={role === "user" ? "#fff" : COLORS.navy} />
                <Text style={[s.roleChipText, role === "user" && { color: "#fff" }]}>Técnico</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="modal-role-admin"
                style={[s.roleChip, role === "admin" && s.roleChipActive]}
                onPress={() => setRole("admin")}
              >
                <Ionicons name="shield-checkmark" size={18} color={role === "admin" ? "#fff" : COLORS.navy} />
                <Text style={[s.roleChipText, role === "admin" && { color: "#fff" }]}>Admin</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              testID="modal-submit"
              style={[s.primary, saving && { opacity: 0.6 }]}
              onPress={submit}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>CREAR USUARIO</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------- Edit ----------------
function EditUserModal({ user, onClose, onDone }: { user: User | null; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(user?.name || "");
  const [role, setRole] = useState<Role>((user?.role as Role) || "user");
  const [color, setColor] = useState<string>(user?.color || USER_COLOR_PALETTE[0]);
  const [saving, setSaving] = useState(false);

  // reset state when user changes
  useFocusEffect(useCallback(() => {
    setName(user?.name || "");
    setRole((user?.role as Role) || "user");
    setColor(user?.color || USER_COLOR_PALETTE[0]);
  }, [user?.id]));

  const submit = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await api.updateUser(user.id, { name: name || undefined, role, color });
      onDone();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={!!user} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.modalRoot}
      >
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Editar usuario</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={26} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <ScrollView>
            <Text style={s.mLabel}>Email</Text>
            <View style={[s.mInput, { justifyContent: "center", backgroundColor: COLORS.readonly }]}>
              <Text style={{ color: COLORS.textSecondary }}>{user?.email}</Text>
            </View>
            <Text style={s.mLabel}>Nombre</Text>
            <TextInput
              style={s.mInput}
              value={name}
              onChangeText={setName}
              placeholderTextColor={COLORS.textDisabled}
            />
            <Text style={s.mLabel}>Rol</Text>
            <View style={s.roleRow}>
              <TouchableOpacity
                style={[s.roleChip, role === "user" && s.roleChipActive]}
                onPress={() => setRole("user")}
              >
                <Ionicons name="person" size={18} color={role === "user" ? "#fff" : COLORS.navy} />
                <Text style={[s.roleChipText, role === "user" && { color: "#fff" }]}>Técnico</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.roleChip, role === "admin" && s.roleChipActive]}
                onPress={() => setRole("admin")}
              >
                <Ionicons name="shield-checkmark" size={18} color={role === "admin" ? "#fff" : COLORS.navy} />
                <Text style={[s.roleChipText, role === "admin" && { color: "#fff" }]}>Admin</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.mLabel}>Color del usuario</Text>
            <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 }}>
              Los eventos asignados a este usuario se mostrarán con este color en el calendario.
            </Text>
            <View style={s.colorGrid}>
              {USER_COLOR_PALETTE.map((c) => (
                <TouchableOpacity
                  key={c}
                  testID={`color-${c}`}
                  style={[s.colorDot, { backgroundColor: c }, color === c && s.colorDotActive]}
                  onPress={() => setColor(c)}
                >
                  {color === c && <Ionicons name="checkmark" size={18} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>
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

// ---------------- Reset password ----------------
function ResetPasswordModal({ user, onClose, onDone }: { user: User | null; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (password.length < 4) {
      Alert.alert("Error", "Mínimo 4 caracteres");
      return;
    }
    setSaving(true);
    try {
      await api.resetPassword(user.id, password);
      Alert.alert("Listo", `Contraseña actualizada para ${user.email}`);
      setPassword("");
      onDone();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={!!user} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.modalRoot}
      >
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Cambiar contraseña</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={26} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <Text style={[s.mLabel, { marginTop: 4 }]}>
            Usuario: <Text style={{ color: COLORS.text, fontWeight: "700" }}>{user?.email}</Text>
          </Text>
          <Text style={s.mLabel}>Nueva contraseña</Text>
          <TextInput
            style={s.mInput}
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 4 caracteres"
            secureTextEntry
            placeholderTextColor={COLORS.textDisabled}
          />
          <TouchableOpacity
            style={[s.primary, saving && { opacity: 0.6 }]}
            onPress={submit}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>ACTUALIZAR</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  userCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  avatarBox: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center",
  },
  userName: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  youBadge: { fontSize: 12, color: COLORS.primary, fontWeight: "700" },
  userEmail: { fontSize: 13, color: COLORS.textSecondary },
  roleBadge: {
    alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 6, marginTop: 2,
  },
  roleAdmin: { backgroundColor: "#DBEAFE" },
  roleUser: { backgroundColor: COLORS.bg },
  roleBadgeText: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: COLORS.textSecondary },
  actions: { flexDirection: "row", gap: 4 },
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
    padding: 20, maxHeight: "85%",
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
  roleRow: { flexDirection: "row", gap: 10 },
  roleChip: {
    flex: 1, height: 50, borderRadius: 10, borderWidth: 2,
    borderColor: COLORS.borderInput, backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8,
  },
  roleChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  roleChipText: { fontSize: 14, fontWeight: "800", color: COLORS.navy },
  primary: {
    height: 52, borderRadius: 12, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center", marginTop: 20,
  },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  colorGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4,
  },
  colorDot: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "transparent",
  },
  colorDotActive: { borderColor: COLORS.navy },
});
