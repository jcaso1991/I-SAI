import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { api, COLORS } from "../../src/api";
import { useThemedStyles } from "../../src/theme";

type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_name: string;
  text: string;
  created_at: string;
  read_by: string[];
  file_base64?: string;
  file_name?: string;
  file_mime?: string;
};

export default function ChatDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const s = useThemedStyles(useS);
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

  const pickAndSendFile = async () => {
    try {
      let fileBase64 = "";
      let fileName = "";
      let mimeType = "";
      if (Platform.OS === "web") {
        const file = await new Promise<File | null>((resolve) => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/*,application/pdf";
          input.onchange = (e: any) => resolve(e.target.files?.[0] || null);
          input.click();
        });
        if (!file) return;
        fileName = file.name;
        mimeType = file.type;
        fileBase64 = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => { const s = r.result as string; resolve(s.split(",")[1]); };
          r.onerror = () => reject(r.error);
          r.readAsDataURL(file);
        });
      } else {
        const res = await DocumentPicker.getDocumentAsync({ type: ["image/*", "application/pdf"], copyToCacheDirectory: true });
        if (res.canceled || !res.assets?.[0]) return;
        const asset = res.assets[0];
        fileName = asset.name;
        mimeType = asset.mimeType || "application/octet-stream";
        fileBase64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      }
      setSending(true);
      await api.chatSendFile(id, fileBase64, fileName, mimeType);
      await loadMessages();
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo enviar el archivo");
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
                    {msg.file_base64 && (
                      <TouchableOpacity onPress={() => {
                        if (msg.file_mime?.startsWith("image/")) {
                          window.open(`data:${msg.file_mime};base64,${msg.file_base64}`, "_blank");
                        } else {
                          const a = document.createElement("a");
                          a.href = `data:${msg.file_mime};base64,${msg.file_base64}`;
                          a.download = msg.file_name || "archivo";
                          a.click();
                        }
                      }}>
                        {msg.file_mime?.startsWith("image/") ? (
                          <Image source={{ uri: `data:${msg.file_mime};base64,${msg.file_base64}` }} style={{ width: 200, height: 150, borderRadius: 8, marginBottom: 4 }} resizeMode="cover" />
                        ) : (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, padding: 8, backgroundColor: "rgba(0,0,0,0.05)", borderRadius: 6, marginBottom: 4 }}>
                            <Ionicons name="document" size={20} color={isMine ? "#fff" : COLORS.text} />
                            <Text style={{ fontSize: 12, color: isMine ? "#fff" : COLORS.text }} numberOfLines={1}>{msg.file_name || "Archivo"}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    )}
                    {msg.text ? <Text style={[s.bubbleText, isMine && { color: "#fff" }]}>{msg.text}</Text> : null}
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
          <TouchableOpacity style={s.attachBtn} onPress={pickAndSendFile}>
            <Ionicons name="attach" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
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

const useS = () => StyleSheet.create({
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
    flexDirection: "row", alignItems: "flex-end", gap: 6,
    padding: 10, backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  attachBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
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
