import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Image, NativeSyntheticEvent, NativeScrollEvent
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { api, COLORS } from "../../src/api";
import { useThemedStyles } from "../../src/theme";
import { ios, fontStyle } from "../../src/ui/iosTheme";

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
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sending, setSending] = useState(false);
  const s = useThemedStyles(useS);
  const [chatTitle, setChatTitle] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  const loadMessages = async (beforeId?: string) => {
    try {
      if (beforeId) setLoadingOlder(true);
      const msgs = await api.chatMessages(id, beforeId);
      if (beforeId) {
        if (msgs.length === 0) setHasMore(false);
        setMessages(prev => [...msgs, ...prev]);
      } else {
        setMessages(msgs);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
      setLoadingOlder(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [who, chats] = await Promise.all([api.me(), api.chatList()]);
        setMe(who);
        const chat = (chats as any[]).find((c: any) => c.id === id);
        if (chat) {
          const others = (chat.participants || []).filter((p: any) => p.id !== who.id);
          setChatTitle(chat.name || others.map((p: any) => p.name || p.email.split("@")[0]).join(", ") || "Conversación");
        }
      } catch {}
    })();
    loadMessages();
    const t = setInterval(() => loadMessages(), 4000);
    return () => clearInterval(t);
  }, [id]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (e.nativeEvent.contentOffset.y === 0 && !loadingOlder && hasMore && messages.length > 0) {
      loadMessages(messages[0].created_at);
    }
  };

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.chatSend(id, text.trim());
      setText("");
      await loadMessages();
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally { setSending(false); }
  };

  const pickAndSendFile = async () => {
    try {
      let fileBase64 = "", fileName = "", mimeType = "";
      if (Platform.OS === "web") {
        const file = await new Promise<File | null>((resolve) => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/*,application/pdf";
          input.onchange = (e: any) => resolve(e.target.files?.[0] || null);
          input.click();
        });
        if (!file) return;
        fileName = file.name; mimeType = file.type;
        fileBase64 = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve((r.result as string).split(",")[1]);
          r.onerror = () => reject(r.error);
          r.readAsDataURL(file);
        });
      } else {
        const res = await DocumentPicker.getDocumentAsync({ type: ["image/*", "application/pdf"] });
        if (res.canceled || !res.assets?.[0]) return;
        const asset = res.assets[0];
        fileName = asset.name; mimeType = asset.mimeType || "application/octet-stream";
        fileBase64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      }
      setSending(true);
      await api.chatSendFile(id, fileBase64, fileName, mimeType);
      await loadMessages();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Fallo al enviar adjunto");
    } finally { setSending(false); }
  };

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{chatTitle}</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        {loading ? (
          <View style={s.centerFlex}><ActivityIndicator color={COLORS.primary} size="large" /></View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onContentSizeChange={() => !loadingOlder && scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {loadingOlder && <ActivityIndicator color={COLORS.primary} style={{ marginBottom: 10 }} />}
            {messages.map((msg, i) => {
              const isMine = msg.sender_id === me?.id;
              const showName = !isMine && (i === 0 || messages[i - 1].sender_id !== msg.sender_id);
              const t = new Date(msg.created_at);
              const timeStr = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;

              return (
                <View key={msg.id} style={[s.msgWrapper, isMine ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
                  {showName && <Text style={s.senderName}>{msg.sender_name}</Text>}

                  <View style={[s.bubble, isMine ? s.bubbleMine : s.bubbleOther]}>
                    {msg.file_base64 && (
                      <TouchableOpacity onPress={() => {
                        const win = typeof window !== "undefined" ? window.open() : null;
                        win?.document.write(`<iframe src="data:${msg.file_mime};base64,${msg.file_base64}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                      }}>
                        {msg.file_mime?.startsWith("image/") ? (
                          <Image source={{ uri: `data:${msg.file_mime};base64,${msg.file_base64}` }} style={s.attachedImage} resizeMode="cover" />
                        ) : (
                          <View style={[s.fileContainer, isMine ? s.fileContainerMine : s.fileContainerOther]}>
                            <Ionicons name="document-text" size={20} color={isMine ? "#fff" : COLORS.primary} />
                            <Text style={[s.fileNameText, isMine && { color: "#fff" }]} numberOfLines={1}>{msg.file_name || "Documento"}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    )}

                    {msg.text ? <Text style={[s.bubbleText, isMine && { color: "#fff" }]}>{msg.text}</Text> : null}

                    <View style={s.bubbleFooter}>
                      <Text style={[s.bubbleTime, isMine && { color: "rgba(255,255,255,0.65)" }]}>{timeStr}</Text>
                      {isMine && (
                        <Ionicons
                          name={msg.read_by.length > 1 ? "checkmark-done" : "checkmark"}
                          size={14}
                          color="rgba(255,255,255,0.75)"
                          style={{ marginLeft: 3 }}
                        />
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        <View style={s.inputRow}>
          <TouchableOpacity style={s.attachBtn} onPress={pickAndSendFile}>
            <Ionicons name="add-circle-outline" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TextInput
            style={s.input}
            value={text}
            onChangeText={setText}
            placeholder="Mensaje..."
            placeholderTextColor={COLORS.textDisabled}
            multiline
          />
          <TouchableOpacity
            style={[s.sendBtn, (!text.trim() || sending) && { opacity: 0.4 }]}
            onPress={send}
            disabled={!text.trim() || sending}
          >
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  centerFlex: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", alignItems: "center", gap: ios.spacing.sm,
    paddingHorizontal: ios.spacing.md, paddingVertical: ios.spacing.sm,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  msgWrapper: { width: "100%", marginBottom: 2 },
  senderName: { fontSize: 11, color: COLORS.textSecondary, fontWeight: "600", marginBottom: 3, marginLeft: 6 },
  bubble: { maxWidth: "78%", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  bubbleMine: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: COLORS.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: COLORS.border },
  bubbleText: { fontSize: 14, color: COLORS.text, lineHeight: 19 },
  bubbleFooter: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 3 },
  bubbleTime: { fontSize: 10, color: COLORS.textDisabled },
  attachedImage: { width: 220, height: 140, borderRadius: 8, marginBottom: 4 },
  fileContainer: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8, borderRadius: 8, marginBottom: 4, minWidth: 160 },
  fileContainerMine: { backgroundColor: "rgba(255,255,255,0.15)" },
  fileContainerOther: { backgroundColor: COLORS.bg },
  fileNameText: { fontSize: 12, color: COLORS.text, flex: 1 },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: ios.spacing.sm,
    padding: ios.spacing.sm, backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  attachBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  input: {
    flex: 1, minHeight: 36, maxHeight: 80, backgroundColor: COLORS.bg,
    borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.border,
  },
  sendBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
});
