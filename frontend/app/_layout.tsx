import React from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "../src/theme";

function ThemedStatusBar() {
  const { theme } = useTheme();
  return <StatusBar style={theme === "dark" ? "light" : "dark"} />;
}

function ThemedStack() {
  const { themeKey } = useTheme();
  // Remount the whole navigation tree when the theme changes so that every
  // StyleSheet.create() is re-executed with the new COLORS values.
  return (
    <Stack
      key={themeKey}
      screenOptions={{ headerShown: false, animation: "slide_from_right" }}
    />
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <ThemedStatusBar />
        <ThemedStack />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
