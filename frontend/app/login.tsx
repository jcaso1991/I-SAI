import { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { api, setToken, COLORS } from "../src/api";

export default function Login() {
  const router = useRouter();
  const params = useLocalSearchParams<{ microsoft_token?: string }>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msLoading, setMsLoading] = useState(false);

  // Handle redirect from Microsoft OAuth (web: query param)
  useEffect(() => {
    if (params.microsoft_token) {
      (async () => {
        await setToken(params.microsoft_token as string);
        router.replace("/home");
      })();
    }
  }, [params.microsoft_token]);

  // Listen for postMessage from popup (web flow)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (ev: MessageEvent) => {
      if (ev.data?.type === "microsoft_auth" && ev.data?.token) {
        (async () => {
          await setToken(ev.data.token);
          router.replace("/home");
        })();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const microsoftLogin = async () => {
    setMsLoading(true);
    try {
      const { auth_url } = await api.microsoftLoginUrl();
      if (Platform.OS === "web") {
        const w = 600, h = 700;
        const left = window.screenX + (window.outerWidth - w) / 2;
        const top = window.screenY + (window.outerHeight - h) / 2;
        window.open(auth_url, "ms-login", `width=${w},height=${h},left=${left},top=${top}`);
      } else {
        const result = await WebBrowser.openAuthSessionAsync(auth_url, "frontend://");
        if (result.type === "success" && result.url) {
          const raw = result.url.includes("?") ? result.url.split("?")[1] : "";
          const token = new URLSearchParams(raw).get("microsoft_token");
          if (token) {
            await setToken(token);
            router.replace("/home");
          }
        }
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Error al conectar con Microsoft");
    } finally {
      setMsLoading(false);
    }
  };

  const submit = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Introduce email y contraseña");
      return;
    }
    setLoading(true);
    try {
      const res = await api.login(email, password);
      await setToken(res.access_token);
      router.replace("/home");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Error de autenticación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.root} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.logoContainer}>
            <Image
              source={require("../assets/images/logo.png")}
              style={s.logoImage}
              resizeMode="contain"
            />
          </View>

          <Text style={s.title}>Iniciar sesión</Text>
          <Text style={s.subtitle}>
            Gestiona entregas y recogidas sincronizadas con OneDrive
          </Text>

          <View style={s.form}>
            <Text style={s.label}>Email</Text>
            <TextInput
              testID="input-email"
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="tu@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={COLORS.textDisabled}
              returnKeyType="next"
              onSubmitEditing={submit}
            />
            <Text style={s.label}>Contraseña</Text>
            <TextInput
              testID="input-password"
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              placeholderTextColor={COLORS.textDisabled}
              returnKeyType="go"
              onSubmitEditing={submit}
            />

            <TouchableOpacity
              testID="btn-submit"
              style={[s.btnPrimary, loading && s.btnDisabled]}
              onPress={submit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.btnPrimaryText}>ENTRAR</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              testID="btn-ms-login"
              style={[s.btnMicrosoft, msLoading && s.btnDisabled]}
              onPress={microsoftLogin}
              disabled={msLoading}
            >
              {msLoading ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text style={s.btnMicrosoftText}>Iniciar sesión con Microsoft</Text>
              )}
            </TouchableOpacity>

            <Text style={s.helperText}>
              ¿No tienes cuenta? Pídele al administrador que te cree una.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: 24, justifyContent: "center" },
  logoContainer: {
    alignItems: "center",
    marginBottom: 32,
    paddingVertical: 8,
  },
  logoImage: {
    width: 220,
    height: 110,
  },
  title: { fontSize: 32, fontWeight: "900", color: COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, marginBottom: 32, lineHeight: 22 },
  form: { gap: 8 },
  label: {
    fontSize: 11, fontWeight: "800", color: COLORS.textSecondary,
    letterSpacing: 1.5, textTransform: "uppercase", marginTop: 12, marginBottom: 4,
  },
  input: {
    height: 56, backgroundColor: COLORS.surface,
    borderWidth: 2, borderColor: COLORS.borderInput, borderRadius: 12,
    paddingHorizontal: 16, fontSize: 17, color: COLORS.text,
  },
  btnPrimary: {
    height: 56, backgroundColor: COLORS.primary, borderRadius: 12,
    alignItems: "center", justifyContent: "center", marginTop: 24,
  },
  btnDisabled: { opacity: 0.7 },
  btnPrimaryText: { color: "#fff", fontSize: 17, fontWeight: "800", letterSpacing: 1 },
  btnMicrosoft: {
    height: 56, backgroundColor: COLORS.surface,
    borderWidth: 2, borderColor: COLORS.borderInput, borderRadius: 12,
    alignItems: "center", justifyContent: "center", marginTop: 12,
  },
  btnMicrosoftText: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  helperText: {
    textAlign: "center", color: COLORS.textSecondary,
    fontSize: 13, marginTop: 20, lineHeight: 18,
  },
});
