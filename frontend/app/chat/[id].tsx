import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS } from "../../src/api";

type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_name: string;
  text: string;
  created_at: string;
  read_by: string[];
};

export default function ChatDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatTitle, setChatTitle] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  const loadMessages = async () => {
    try {
      const msgs = await api.chatMessages(id);
      setMessages(msgs);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    (async () => {
      try {
        const [who, chats] = await Promise.all([api.me(), api.chatList()]);
        setMe(who);
        const chat = (chats as any[]).find((c: any) => c.id === id);
        if (chat) {
          const others = (chat.participants || []).filter((p: any) => p.id !== who.id);
          setChatTitle(chat.name || others.map((p: any) => p.name || p.email.split("@")[0]).join(", ") || "Chat");
        }
      } catch {}
    })();
    loadMessages();
    const t = setInterval(loadMessages, 5000);
    return () => clearInterval(t);
  }, [id]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.chatSend(id, text.trim());
      setText("");
      await loadMessages();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally { setSending(false); }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle} numberOfLines={1}>{chatTitle}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 12, gap: 4, paddingBottom: 16 }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((msg, i) => {
              const isMine = msg.sender_id === me?.id;
              const showName = i === 0 || messages[i - 1].sender_id !== msg.sender_id;
              return (
                <View key={msg.id}>
                  {showName && (
                    <Text style={[s.senderName, isMine && { textAlign: "right" }]}>
                      {isMine ? "Tú" : msg.sender_name}
                    </Text>
                  )}
                  <View style={[s.bubble, isMine ? s.bubbleMine : s.bubbleOther]}>
                    <Text style={[s.bubbleText, isMine && { color: "#fff" }]}>{msg.text}</Text>
                    <Text style={[s.bubbleTime, isMine && { color: "rgba(255,255,255,0.7)" }]}>
                      {formatTime(msg.created_at)}
                      {isMine && msg.read_by.length > 1 ? " ✓✓" : isMine ? " ✓" : ""}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={text}
            onChangeText={setText}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={COLORS.textDisabled}
            multiline
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[s.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}
            onPress={send}
            disabled={!text.trim() || sending}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  headerTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text },
  senderName: { fontSize: 11, color: COLORS.textSecondary, fontWeight: "600", marginBottom: 2, paddingHorizontal: 4 },
  bubble: { maxWidth: "80%", padding: 10, borderRadius: 12, gap: 2 },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: COLORS.primary },
  bubbleOther: { alignSelf: "flex-start", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  bubbleText: { fontSize: 15, color: COLORS.text, lineHeight: 20 },
  bubbleTime: { fontSize: 10, color: COLORS.textSecondary, alignSelf: "flex-end" },
  inputRow: {
    flexDirection: "row", alignItems: "flex-end", gap: 8,
    padding: 10, backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 120,
    backgroundColor: COLORS.bg, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
    fontSize: 15, color: COLORS.text,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
  },
});
