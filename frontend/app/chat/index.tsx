import { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, TextInput, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, clearToken, COLORS } from "../../src/api";
import ResponsiveLayout from "../../src/ResponsiveLayout";
import { useThemedStyles } from "../../src/theme";
import { ios, fontStyle } from "../../src/ui/iosTheme";

type ChatItem = {
  id: string;
  participant_ids: string[];
  name?: string | null;
  participants?: { id: string; name?: string; email: string; color?: string }[];
  last_message?: { text: string; sender_name: string; created_at: string } | null;
  unread: number;
  project_id?: string | null;
  updated_at: string;
};

export default function ChatIndex() {
  const router = useRouter();
  const s = useThemedStyles(useS);
  const [me, setMe] = useState<any>(null);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [unreadTotal, setUnreadTotal] = useState(0);

  const load = async () => {
    try {
      const [who, list, unread] = await Promise.all([
        me ? Promise.resolve(me) : api.me(),
        api.chatList().catch(() => []),
        api.chatUnreadTotal().catch(() => ({ unread: 0 })),
      ]);
      if (!me) setMe(who);
      setChats(list);
      setUnreadTotal(unread.unread || 0);
    } catch (e: any) {
      if (/401|Invalid|expired/i.test(e.message)) { await clearToken(); router.replace("/login"); }
    } finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  useEffect(() => {
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [me]);

  const logout = async () => { await clearToken(); router.replace("/login"); };

  const chatName = (c: ChatItem): string => {
    if (c.name) return c.name;
    const others = (c.participants || []).filter((p) => p.id !== me?.id);
    return others.map((p) => p.name || p.email.split("@")[0]).join(", ") || "Chat";
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const filteredChats = chats.filter(c =>
    chatName(c).toLowerCase().includes(search.toLowerCase()) ||
    c.last_message?.text?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ResponsiveLayout active="chat" isAdmin={me?.role === "admin"} onLogout={logout} userName={me?.name}>
      <SafeAreaView style={s.root} edges={["top"]}>
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>Mensajería</Text>
            {unreadTotal > 0 && <Text style={s.headerSubtitle}>{unreadTotal} sin leer</Text>}
          </View>
          <TouchableOpacity testID="btn-new-chat" style={s.newChatBtn} onPress={() => router.push("/chat/nuevo")}>
            <Ionicons name="create-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={s.searchContainer}>
          <Ionicons name="search-outline" size={16} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar conversación o contenido..."
            placeholderTextColor={COLORS.textDisabled}
          />
        </View>

        {loading ? (
          <View style={s.centerFlex}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : filteredChats.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="chatbubbles-outline" size={54} color={COLORS.textDisabled} />
            <Text style={s.emptyTitle}>Sin conversaciones</Text>
            <Text style={s.emptySub}>{search ? "No hay resultados para la búsqueda" : "Pulsa el botón superior para iniciar un chat"}</Text>
          </View>
        ) : (
          <FlatList
            data={filteredChats}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ paddingBottom: 32 }}
            renderItem={({ item: c }) => {
              const activeColor = c.participants?.[0]?.color || COLORS.primary;
              return (
                <TouchableOpacity
                  style={[s.chatRow, c.unread > 0 && s.chatRowUnread]}
                  onPress={() => router.push(`/chat/${c.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={[s.avatar, { backgroundColor: activeColor + "15" }]}>
                    <Ionicons name={c.name ? "people-sharp" : "person-sharp"} size={20} color={activeColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.chatTop}>
                      <Text style={s.chatName} numberOfLines={1}>{chatName(c)}</Text>
                      {c.last_message && (
                        <Text style={[s.chatTime, c.unread > 0 && s.chatTimeUnread]}>{formatTime(c.last_message.created_at)}</Text>
                      )}
                    </View>
                    <View style={s.chatBottom}>
                      <Text style={[s.chatPreview, c.unread > 0 && s.chatPreviewUnread]} numberOfLines={1}>
                        {c.last_message ? `${c.last_message.sender_name}: ${c.last_message.text}` : "Nueva conversación iniciada"}
                      </Text>
                      {c.unread > 0 && (
                        <View style={s.badge}>
                          <Text style={s.badgeText}>{c.unread > 99 ? "99+" : c.unread}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </SafeAreaView>
    </ResponsiveLayout>
  );
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  centerFlex: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: ios.spacing.lg, paddingVertical: ios.spacing.md,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 12, fontWeight: "600", color: COLORS.errorText, marginTop: 1 },
  newChatBtn: {
    width: 36, height: 36, alignItems: "center", justifyContent: "center",
    borderRadius: 18, backgroundColor: COLORS.primary,
  },
  searchContainer: {
    flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface,
    marginHorizontal: ios.spacing.md, marginVertical: ios.spacing.sm,
    paddingHorizontal: ios.spacing.sm, height: 38, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 0 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: ios.spacing.xxl, marginTop: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginTop: ios.spacing.sm },
  emptySub: { fontSize: 13, color: COLORS.textSecondary, textAlign: "center", marginTop: 4 },
  chatRow: {
    flexDirection: "row", alignItems: "center", gap: ios.spacing.md,
    padding: ios.spacing.md, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  chatRowUnread: { backgroundColor: COLORS.primarySoft + "08" },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: "center", justifyContent: "center",
  },
  chatTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chatName: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  chatTime: { fontSize: 11, color: COLORS.textDisabled },
  chatTimeUnread: { color: COLORS.primary, fontWeight: "600" },
  chatBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
  chatPreview: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  chatPreviewUnread: { fontWeight: "700", color: COLORS.text },
  badge: {
    minWidth: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 4, marginLeft: ios.spacing.sm,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
