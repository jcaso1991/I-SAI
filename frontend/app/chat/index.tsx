import { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, clearToken, COLORS } from "../../src/api";
import ResponsiveLayout from "../../src/ResponsiveLayout";
import { useThemedStyles } from "../../src/theme";

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

  // Poll every 5s
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

  return (
    <ResponsiveLayout active="chat" isAdmin={me?.role === "admin"} onLogout={logout} userName={me?.name}>
      <SafeAreaView style={s.root} edges={["top"]}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Chat</Text>
          <TouchableOpacity
            testID="btn-new-chat"
            style={s.newChatBtn}
            onPress={() => router.push("/chat/nuevo")}
          >
            <Ionicons name="create-outline" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : chats.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="chatbubbles-outline" size={64} color={COLORS.textDisabled} />
            <Text style={s.emptyTitle}>Sin conversaciones</Text>
            <Text style={s.emptySub}>Pulsa + para iniciar un chat</Text>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }}>
            {chats.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={s.chatRow}
                onPress={() => router.push(`/chat/${c.id}`)}
                activeOpacity={0.7}
              >
                <View style={[s.avatar, { backgroundColor: (c.participants?.[0]?.color || COLORS.primary) + "22" }]}>
                  <Ionicons name={c.name ? "people" : "person"} size={22} color={c.participants?.[0]?.color || COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.chatTop}>
                    <Text style={s.chatName} numberOfLines={1}>{chatName(c)}</Text>
                    {c.last_message && (
                      <Text style={s.chatTime}>{formatTime(c.last_message.created_at)}</Text>
                    )}
                  </View>
                  <View style={s.chatBottom}>
                    <Text style={[s.chatPreview, c.unread > 0 && { fontWeight: "700", color: COLORS.text }]} numberOfLines={1}>
                      {c.last_message ? `${c.last_message.sender_name}: ${c.last_message.text}` : "Nueva conversación"}
                    </Text>
                    {c.unread > 0 && (
                      <View style={s.badge}>
                        <Text style={s.badgeText}>{c.unread > 99 ? "99+" : c.unread}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </ResponsiveLayout>
  );
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 22, fontWeight: "900", color: COLORS.text },
  newChatBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: COLORS.bg },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  emptySub: { fontSize: 14, color: COLORS.textSecondary },
  chatRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: "center", justifyContent: "center",
  },
  chatTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chatName: { fontSize: 16, fontWeight: "700", color: COLORS.text, flex: 1 },
  chatTime: { fontSize: 12, color: COLORS.textSecondary, marginLeft: 8 },
  chatBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
  chatPreview: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  badge: {
    minWidth: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 6, marginLeft: 8,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
});
