/**
 * /portfolio — Redirige automáticamente al HTML público generado por el backend
 * (servido en /api/portfolio). Así el cliente sólo recuerda "misitio.com/portfolio".
 */

import { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Platform } from "react-native";

export default function PortfolioRedirect() {
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      // Prefer the backend URL when configured (handles dev + prod gracefully).
      const base = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/+$/, "");
      const target = base ? `${base}/api/portfolio` : "/api/portfolio";
      // @ts-ignore
      window.location.replace(target);
    }
  }, []);
  return (
    <View style={s.root}>
      <ActivityIndicator size="large" color="#1976D2" />
      <Text style={s.t}>Cargando presentación de i-SAI…</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F7FB", gap: 12 },
  t: { color: "#475569", fontSize: 14, fontWeight: "600" },
});
