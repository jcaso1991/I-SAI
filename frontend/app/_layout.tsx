import React, { lazy, Suspense } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "../src/theme";
import { ToastProvider } from "../src/ToastProvider";
import GlobalSearch from "../src/GlobalSearch";

function LoadingFallback() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0B0F19" }}>
      <ActivityIndicator size="large" color="#3B82F6" />
    </View>
  );
}

function ThemedStatusBar() {
  const { theme } = useTheme();
  return <StatusBar style={theme === "dark" ? "light" : "dark"} />;
}

function ThemedStack() {
  const { themeKey } = useTheme();
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Stack
        key={themeKey}
        screenOptions={{ headerShown: false, animation: "slide_from_right" }}
      />
    </Suspense>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <ToastProvider>
          <View style={{ flex: 1, position: "relative" } as any}>
            <ThemedStatusBar />
            <ThemedStack />
          </View>
          <GlobalSearch />
        </ToastProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
