import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "light" | "dark";

const ThemeContext = createContext<{
  mode: ThemeMode;
  toggle: () => void;
  colors: typeof lightColors;
}>({ mode: "light", toggle: () => {}, colors: {} as any });

const lightColors = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  readonly: "#F1F5F9",
  text: "#0F172A",
  textSecondary: "#475569",
  textDisabled: "#94A3B8",
  primary: "#1E88E5",
  primaryHover: "#1565C0",
  border: "#E2E8F0",
  borderInput: "#CBD5E1",
  syncedBg: "#DCFCE7",
  syncedText: "#166534",
  pendingBg: "#FEF3C7",
  pendingText: "#92400E",
  errorBg: "#FEE2E2",
  errorText: "#991B1B",
  navy: "#0F172A",
  primarySoft: "#EFF6FF",
  pillBlueBg: "#DBEAFE",
  pillBlueText: "#1E40AF",
  pillPurpleBg: "#EDE9FE",
  pillPurpleText: "#5B21B6",
  highlightBg: "#EFF6FF",
  canvasPaper: "#F1F5F9",
  accent: "#EA580C",
  pillOrangeBg: "#FFF7ED",
};

const darkColors = {
  bg: "#0F172A",
  surface: "#1E293B",
  readonly: "#1E293B",
  text: "#F1F5F9",
  textSecondary: "#94A3B8",
  textDisabled: "#64748B",
  primary: "#3B82F6",
  primaryHover: "#2563EB",
  border: "#334155",
  borderInput: "#475569",
  syncedBg: "#064E3B",
  syncedText: "#A7F3D0",
  pendingBg: "#78350F",
  pendingText: "#FDE68A",
  errorBg: "#7F1D1D",
  errorText: "#FECACA",
  navy: "#F1F5F9",
  primarySoft: "#1E3A5F",
  pillBlueBg: "#1E3A5F",
  pillBlueText: "#93C5FD",
  pillPurpleBg: "#3B1F5E",
  pillPurpleText: "#C4B5FD",
  highlightBg: "#1E3A5F",
  canvasPaper: "#1E293B",
  accent: "#F97316",
  pillOrangeBg: "#431407",
};

let _cachedMode: ThemeMode | null = null;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(_cachedMode || "light");

  useEffect(() => {
    AsyncStorage.getItem("theme_mode").then((v) => {
      const m = (v === "dark" ? "dark" : "light") as ThemeMode;
      _cachedMode = m;
      setMode(m);
    }).catch(() => {});
  }, []);

  const toggle = () => {
    const next = mode === "light" ? "dark" : "light";
    _cachedMode = next;
    setMode(next);
    AsyncStorage.setItem("theme_mode", next).catch(() => {});
  };

  const colors = mode === "dark" ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ mode, toggle, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
