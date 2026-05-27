import { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, setToken, COLORS, BACKEND_URL } from "../src/api";
import { useThemedStyles } from "../src/theme";
import { ios, fontStyle } from "../src/ui/iosTheme";

const MS_STATE_KEY = "ms_login_state";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msLoading, setMsLoading] = useState(false);
  const [msEnabled, setMsEnabled] = useState<boolean | null>(null);
  const s = useThemedStyles(useS);

  const backendOrigin = BACKEND_URL.replace(/\/+$/, "");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.microsoftStatus();
        if (active) setMsEnabled(Boolean(res.enabled));
      } catch {
        if (active) setMsEnabled(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Listen for postMessage from popup (web flow)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (ev: MessageEvent) => {
      if (ev.origin !== backendOrigin) return;
      if (ev.data?.type !== "microsoft_auth" || !ev.data?.code) return;
      const storedState = sessionStorage.getItem("ms_state");
      if (!storedState || ev.data?.state !== storedState) return;
      sessionStorage.removeItem("ms_state");
      (async () => {
        try {
          const res = await api.microsoftExchange(ev.data.code, storedState);
          await setToken(res.access_token);
          router.replace("/home");
        } catch (e: any) {
          Alert.alert("Error", e.message || "Error al completar autenticación");
        }
      })();
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const microsoftLogin = async () => {
    if (msEnabled === false) {
      Alert.alert("Login Microsoft", "El inicio de sesión con Microsoft no está configurado en este entorno.");
      return;
    }
    setMsLoading(true);
    try {
      const { auth_url, state } = await api.microsoftLoginUrl();

      if (Platform.OS === "web") {
        sessionStorage.setItem("ms_state", state);
        const w = 600, h = 700;
        const left = window.screenX + (window.outerWidth - w) / 2;
        const top = window.screenY + (window.outerHeight - h) / 2;
        window.open(auth_url, "ms-login", `width=${w},height=${h},left=${left},top=${top}`);
      } else {
        await AsyncStorage.setItem(MS_STATE_KEY, state);
        const result = await WebBrowser.openAuthSessionAsync(
          auth_url,
          "frontend://microsoft-callback"
        );
        if (result.type === "success" && result.url) {
          const raw = result.url.includes("?") ? result.url.split("?")[1] : "";
          router.replace(`/microsoft-callback${raw ? `?${raw}` : ""}` as any);
        }
        if (result.type === "cancel") {
          await AsyncStorage.removeItem(MS_STATE_KEY);
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

          <View style={s.card}>
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
              style={[s.btnMicrosoft, (msLoading || msEnabled === false) && s.btnDisabled]}
              onPress={microsoftLogin}
              disabled={msLoading || msEnabled === false}
            >
              {msLoading ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text style={s.btnMicrosoftText}>{msEnabled === false ? "Microsoft no configurado" : "Iniciar sesión con Microsoft"}</Text>
              )}
            </TouchableOpacity>

            <Text style={s.helperText}>
              ¿No tienes cuenta? Pídele al administrador que te cree una.
            </Text>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useS = () =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: ios.spacing.xxl, justifyContent: "center" },
  logoContainer: {
    alignItems: "center",
    marginBottom: ios.spacing.xxxl,
    paddingVertical: ios.spacing.lg,
  },
  logoImage: {
    width: 260,
    height: 130,
  },
  title: {
    ...fontStyle("largeTitle"),
    color: COLORS.text,
    marginBottom: ios.spacing.xs,
    textAlign: "center",
  },
  subtitle: {
    ...fontStyle("callout"),
    color: COLORS.textSecondary,
    marginBottom: ios.spacing.xxl,
    textAlign: "center",
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: ios.radius.xl,
    padding: ios.spacing.xxl,
    ...ios.shadow.elevated,
  },
  form: { gap: ios.spacing.xs },
  label: {
    ...fontStyle("section"),
    fontWeight: "800",
    color: COLORS.textSecondary,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: ios.spacing.md,
    marginBottom: ios.spacing.xs,
  },
  input: {
    height: 56,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.borderInput,
    borderRadius: ios.radius.md,
    paddingHorizontal: 20,
    ...fontStyle("body"),
    color: COLORS.text,
  },
  btnPrimary: {
    height: 56,
    backgroundColor: COLORS.primary,
    borderRadius: ios.radius.card,
    alignItems: "center",
    justifyContent: "center",
    marginTop: ios.spacing.xxl,
  },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: {
    color: "#fff",
    ...fontStyle("callout"),
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  btnMicrosoft: {
    height: 56,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: ios.radius.card,
    alignItems: "center",
    justifyContent: "center",
    marginTop: ios.spacing.sm,
  },
  btnMicrosoftText: {
    ...fontStyle("body"),
    fontWeight: "700",
    color: COLORS.text,
  },
  helperText: {
    textAlign: "center",
    color: COLORS.textSecondary,
    ...fontStyle("footnote"),
    marginTop: ios.spacing.xl,
  },
});
