import { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
  ActivityIndicator, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS } from "../../src/api";
import { useThemedStyles } from "../../src/theme";
import { ios, fontStyle } from "../../src/ui/iosTheme";

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
                <View style={[s.avatar, { backgroundColor: u.color || COLORS.primary }]}>
                  <Text style={s.avatarInitial}>{(u.name || u.email || "?")[0].toUpperCase()}</Text>
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

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", alignItems: "center", gap: ios.spacing.md,
    paddingHorizontal: ios.spacing.md, paddingVertical: ios.spacing.sm,
    backgroundColor: COLORS.surface, borderBottomWidth: ios.hairline, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { ...fontStyle("title3"), color: COLORS.text, flex: 1 },
  createBtn: {
    height: 56, width: 56, borderRadius: ios.radius.card, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
  },
  nameRow: {
    padding: ios.spacing.md, backgroundColor: COLORS.surface,
    borderBottomWidth: ios.hairline, borderBottomColor: COLORS.border,
  },
  nameInput: {
    height: 44, backgroundColor: COLORS.bg, borderRadius: ios.radius.sm,
    paddingHorizontal: 14, ...fontStyle("body"), color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.border,
  },
  userRow: {
    flexDirection: "row", alignItems: "center", gap: ios.spacing.md,
    padding: ios.spacing.lg, backgroundColor: COLORS.surface,
    borderBottomWidth: ios.hairline, borderBottomColor: COLORS.border,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  avatarInitial: { color: "#fff", ...fontStyle("subhead"), fontWeight: "800" },
  userName: { ...fontStyle("bodyEmphasized"), color: COLORS.text },
  userEmail: { ...fontStyle("footnote"), color: COLORS.textSecondary },
  checkbox: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center",
  },
  checkboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
});
