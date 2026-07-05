import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS } from "../../src/api";
import { useThemedStyles } from "../../src/theme";
import { ios } from "../../src/ui/iosTheme";

export default function NewChat() {
  const router = useRouter();
  const s = useThemedStyles(useS);
  const [users, setUsers] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [techs, me] = await Promise.all([api.listTechnicians(), api.me()]);
        setUsers((techs || []).filter((u: any) => u.id !== me.id));
      } catch (e: any) { Alert.alert("Error", e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  const toggle = (id: string) => {
    setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  };

  const createChat = async () => {
    if (selected.length === 0) { Alert.alert("Error", "Selecciona miembros"); return; }
    setCreating(true);
    try {
      const chat = await api.chatCreate({
        participant_ids: selected,
        name: selected.length > 1 ? name.trim() || undefined : undefined,
      });
      router.replace(`/chat/${chat.id}`);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Error al constituir el chat");
    } finally { setCreating(false); }
  };

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Nueva Conversación</Text>
        <TouchableOpacity style={[s.createBtn, creating && { opacity: 0.5 }]} onPress={createChat} disabled={creating}>
          {creating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.createBtnText}>Listo</Text>}
        </TouchableOpacity>
      </View>

      {selected.length > 1 && (
        <View style={s.nameRow}>
          <TextInput
            style={s.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="Nombre del grupo / canal..."
            placeholderTextColor={COLORS.textDisabled}
          />
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={COLORS.primary} /></View>
      ) : (
        <ScrollView style={{ flex: 1 }}>
          {users.map((u) => {
            const isSelected = selected.includes(u.id);
            return (
              <TouchableOpacity key={u.id} style={s.userRow} onPress={() => toggle(u.id)} activeOpacity={0.8}>
                <View style={[s.avatar, { backgroundColor: (u.color || COLORS.primary) + "20" }]}>
                  <Text style={[s.avatarInitial, { color: u.color || COLORS.primary }]}>{(u.name || u.email || "?")[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.userName}>{u.name || u.email}</Text>
                  <Text style={s.userEmail}>{u.email}</Text>
                </View>
                <View style={[s.checkbox, isSelected && s.checkboxOn]}>
                  {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: ios.spacing.md, paddingVertical: ios.spacing.sm,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  createBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  createBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  nameRow: { padding: ios.spacing.md, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  nameInput: { height: 38, backgroundColor: COLORS.bg, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  userRow: { flexDirection: "row", alignItems: "center", gap: ios.spacing.md, padding: ios.spacing.md, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 14, fontWeight: "700" },
  userName: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  userEmail: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  checkbox: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
});
