import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, setToken, COLORS } from "../src/api";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("admin@materiales.com");
  const [password, setPassword] = useState("Admin1234");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Introduce email y contraseña");
      return;
    }
    setLoading(true);
    try {
      const res = mode === "login"
        ? await api.login(email, password)
        : await api.register(email, password, name || undefined);
      await setToken(res.access_token);
      router.replace("/materiales");
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
          <View style={s.logoRow}>
            <View style={s.logoBox}>
              <Ionicons name="cube" size={36} color="#fff" />
            </View>
            <Text style={s.brand}>Materiales</Text>
          </View>

          <Text style={s.title}>
            {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </Text>
          <Text style={s.subtitle}>
            Gestiona entregas y recogidas sincronizadas con OneDrive
          </Text>

          <View style={s.form}>
            {mode === "register" && (
              <>
                <Text style={s.label}>Nombre</Text>
                <TextInput
                  testID="input-name"
                  style={s.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Tu nombre"
                  placeholderTextColor={COLORS.textDisabled}
                />
              </>
            )}
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
                <Text style={s.btnPrimaryText}>
                  {mode === "login" ? "ENTRAR" : "CREAR CUENTA"}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              testID="btn-toggle-mode"
              style={s.linkBtn}
              onPress={() => setMode(mode === "login" ? "register" : "login")}
            >
              <Text style={s.linkText}>
                {mode === "login"
                  ? "¿No tienes cuenta? Crear una"
                  : "¿Ya tienes cuenta? Iniciar sesión"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: 24, justifyContent: "center" },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 32 },
  logoBox: {
    width: 56, height: 56, backgroundColor: COLORS.primary,
    borderRadius: 14, alignItems: "center", justifyContent: "center",
  },
  brand: { fontSize: 24, fontWeight: "900", color: COLORS.navy, letterSpacing: -0.5 },
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
  linkBtn: { alignItems: "center", paddingVertical: 16 },
  linkText: { color: COLORS.primary, fontSize: 15, fontWeight: "600" },
});
