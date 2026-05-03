import { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
  ActivityIndicator, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS } from "../../src/api";

export default function NewChat() {
  const router = useRouter();
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
      } catch (e: any) {
        Alert.alert("Error", e.message);
      } finally { setLoading(false); }
    })();
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const createChat = async () => {
    if (selected.length === 0) { Alert.alert("Error", "Selecciona al menos un usuario"); return; }
    setCreating(true);
    try {
      const chat = await api.chatCreate({
        participant_ids: selected,
        name: selected.length > 1 ? name.trim() || undefined : undefined,
      });
      router.replace(`/chat/${chat.id}`);
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo crear el chat");
    } finally { setCreating(false); }
  };

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Nuevo chat</Text>
        <TouchableOpacity
          style={[s.createBtn, creating && { opacity: 0.6 }]}
          onPress={createChat}
          disabled={creating}
        >
          {creating ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="checkmark" size={24} color="#fff" />}
        </TouchableOpacity>
      </View>

      {selected.length > 1 && (
        <View style={s.nameRow}>
          <TextInput
            style={s.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="Nombre del grupo (opcional)"
            placeholderTextColor={COLORS.textDisabled}
          />
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView style={{ flex: 1 }}>
          {users.map((u) => {
            const on = selected.includes(u.id);
            return (
              <TouchableOpacity
                key={u.id}
                style={[s.userRow, on && { backgroundColor: COLORS.primarySoft }]}
                onPress={() => toggle(u.id)}
              >
                <View style={[s.avatar, { backgroundColor: (u.color || COLORS.primary) + "22" }]}>
                  <Ionicons name="person" size={22} color={u.color || COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.userName}>{u.name || u.email}</Text>
                  <Text style={s.userEmail}>{u.email}</Text>
                </View>
                <View style={[s.checkbox, on && s.checkboxOn]}>
                  {on && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text, flex: 1 },
  createBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
  },
  nameRow: {
    padding: 12, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  nameInput: {
    height: 44, backgroundColor: COLORS.bg, borderRadius: 10,
    paddingHorizontal: 14, fontSize: 15, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.border,
  },
  userRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  userName: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  userEmail: { fontSize: 12, color: COLORS.textSecondary },
  checkbox: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center",
  },
  checkboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
});
