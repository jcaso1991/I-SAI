import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, setToken, COLORS } from "../src/api";

const MS_STATE_KEY = "ms_login_state";

export default function MicrosoftCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string; state: string }>();
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const code = Array.isArray(params.code) ? params.code[0] : params.code;
        const state = Array.isArray(params.state) ? params.state[0] : params.state;
        if (!code || !state) {
          setError("Faltan parámetros de autenticación.");
          return;
        }
        const savedState = await AsyncStorage.getItem(MS_STATE_KEY);
        await AsyncStorage.removeItem(MS_STATE_KEY);
        if (savedState !== state) {
          setError("Estado de autenticación inválido.");
          return;
        }
        const res = await api.microsoftExchange(code, state);
        await setToken(res.access_token);
        router.replace("/home");
      } catch (e: any) {
        setError(e.message || "Error al completar autenticación");
      }
    })();
  }, []);

  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.error}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={s.text}>Completando inicio de sesión...</Text>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg, padding: 24 },
  text: { marginTop: 16, fontSize: 16, color: COLORS.textSecondary },
  error: { fontSize: 16, color: "#EF4444", textAlign: "center" },
});
