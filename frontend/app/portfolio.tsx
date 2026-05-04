/**
 * /portfolio — Redirige a la landing pública independiente cuando está configurada.
 */

import { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Platform } from "react-native";

export default function PortfolioRedirect() {
  const portfolioUrl = (process.env.EXPO_PUBLIC_PORTFOLIO_URL || "").replace(/\/+$/, "");

  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined" && portfolioUrl) {
      // @ts-ignore
      window.location.replace(portfolioUrl);
    }
  }, [portfolioUrl]);

  return (
    <View style={s.root}>
      <ActivityIndicator size="large" color="#1976D2" />
      <Text style={s.t}>
        {portfolioUrl ? "Cargando presentación de i-SAI..." : "Landing pública no configurada"}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F7FB", gap: 12 },
  t: { color: "#475569", fontSize: 14, fontWeight: "600" },
});
