import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api, setToken, COLORS } from "../src/api";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@materiales.com");
  const [password, setPassword] = useState("Admin1234");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Introduce email y contraseña");
      return;
    }
    setLoading(true);
    try {
      const res = await api.login(email, password);
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
                <Text style={s.btnPrimaryText}>ENTRAR</Text>
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
  helperText: {
    textAlign: "center", color: COLORS.textSecondary,
    fontSize: 13, marginTop: 20, lineHeight: 18,
  },
});
