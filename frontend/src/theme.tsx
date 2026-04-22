/**
 * Sistema de tema (claro / oscuro) — persistido en AsyncStorage.
 *
 * Estrategia:
 * 1) `THEMES` define las paletas.
 * 2) `ThemeProvider` guarda el tema actual (string) y lo persiste.
 * 3) MUTAMOS el objeto `COLORS` exportado desde `api.ts` al cambiar de tema.
 *    Esto hace que:
 *      - Inline styles `{ backgroundColor: COLORS.bg }` reflejen el cambio
 *        en el próximo render.
 *      - Las hojas creadas con `StyleSheet.create` quedan "congeladas" con el
 *        tema activo en el momento de su creación. Por eso, cuando el usuario
 *        cambia el tema forzamos un "remount" del árbol renderizando los
 *        children con una `key` distinta: todas las StyleSheets se vuelven a
 *        crear con el nuevo `COLORS`.
 * 4) En Web, además inyectamos un `data-theme="dark"` en <html> y un poco de
 *    CSS para suavizar el cambio (scrollbars, body bg).
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS } from "./api";

export type ThemeName = "light" | "dark";

const KEY = "app_theme_v1";

const LIGHT = {
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
  // accents (NEW)
  primarySoft: "#EFF6FF",   // very light blue — active/open buttons
  highlightBg: "#DBEAFE",   // selected row / today column header
  highlightText: "#1E40AF",
  pillBlueBg: "#DBEAFE",
  pillBlueText: "#1E40AF",
  pillOrangeBg: "#FEF3C7",
  pillOrangeText: "#92400E",
  pillPurpleBg: "#EDE9FE",
  pillPurpleText: "#5B21B6",
  accent: "#8B5CF6",        // purple accent (presupuestos)
  accentText: "#FFFFFF",
  canvasPaper: "#FFFFFF",   // always white — drawings canvas
};

const DARK = {
  bg: "#0B1220",          // deep near-black blue
  surface: "#111827",     // cards
  readonly: "#0E1526",
  text: "#F8FAFC",
  textSecondary: "#94A3B8",
  textDisabled: "#475569",
  primary: "#3B82F6",
  primaryHover: "#2563EB",
  border: "#1F2937",
  borderInput: "#374151",
  syncedBg: "#064E3B",
  syncedText: "#A7F3D0",
  pendingBg: "#78350F",
  pendingText: "#FDE68A",
  errorBg: "#7F1D1D",
  errorText: "#FCA5A5",
  navy: "#E2E8F0",        // used as "strong text" — light in dark
  // accents (NEW)
  primarySoft: "#1E293B",
  highlightBg: "#1E3A8A",
  highlightText: "#BFDBFE",
  pillBlueBg: "#1E3A8A",
  pillBlueText: "#BFDBFE",
  pillOrangeBg: "#78350F",
  pillOrangeText: "#FDE68A",
  pillPurpleBg: "#4C1D95",
  pillPurpleText: "#DDD6FE",
  accent: "#A78BFA",
  accentText: "#FFFFFF",
  canvasPaper: "#F8FAFC",  // slightly dim for readability
};

export const THEMES: Record<ThemeName, typeof LIGHT> = { light: LIGHT, dark: DARK };

function applyPalette(name: ThemeName) {
  const palette = THEMES[name];
  for (const k of Object.keys(palette)) {
    // @ts-ignore dynamic mutation
    COLORS[k] = palette[k as keyof typeof palette];
  }
  if (Platform.OS === "web" && typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", name);
    document.documentElement.style.backgroundColor = palette.bg;
    document.body.style.backgroundColor = palette.bg;
    document.documentElement.style.colorScheme = name;
    injectThemeCSS();
  }
}

/**
 * Inject a stylesheet that retroactively overrides the hardcoded light-palette
 * colours baked into already-created StyleSheets. We match on the exact
 * rgb()/rgba() values RN-Web emits for each colour in the light palette and
 * remap them to the dark palette when the document is `data-theme="dark"`.
 *
 * This only affects WEB. On native the theme mutation is picked up as soon as
 * the navigation tree remounts (thanks to `<Stack key={themeKey}>`), because
 * native `StyleSheet` does not freeze inline hex values the same way.
 */
let _themeCssInjected = false;
function injectThemeCSS() {
  if (typeof document === "undefined") return;
  // Always (re)write the stylesheet so HMR / theme file updates take effect.
  let el = document.getElementById("app-theme-overrides") as HTMLStyleElement | null;
  const css = `
[data-theme="dark"] {
  color-scheme: dark;
}
[data-theme="dark"] * {
  scrollbar-color: #334155 ${DARK.bg};
}
/* ------------------------------------------------------------------
 * RN-Web generates deterministic class suffixes per CSS value.
 * We override each of the light-palette class names with dark ones.
 * Using !important to win specificity over RN Web's emitted classes.
 * ------------------------------------------------------------------ */
/* Backgrounds */
[data-theme="dark"] .r-backgroundColor-11j01x2,
[data-theme="dark"] [style*="background-color: rgb(248, 250, 252)"] {
  background-color: ${DARK.bg} !important;
}
[data-theme="dark"] .r-backgroundColor-14lw9ot,
[data-theme="dark"] [style*="background-color: rgb(255, 255, 255)"] {
  background-color: ${DARK.surface} !important;
}
[data-theme="dark"] .r-backgroundColor-1jh0li6,
[data-theme="dark"] [style*="background-color: rgb(241, 245, 249)"] {
  background-color: ${DARK.readonly} !important;
}
[data-theme="dark"] .r-backgroundColor-182zmgx,
[data-theme="dark"] [style*="background-color: rgb(226, 232, 240)"] {
  background-color: ${DARK.border} !important;
}
/* Text colours */
[data-theme="dark"] .r-color-15ijx5m,
[data-theme="dark"] [style*="color: rgb(15, 23, 42)"] {
  color: ${DARK.text} !important;
}
[data-theme="dark"] .r-color-1dk24ck,
[data-theme="dark"] [style*="color: rgb(71, 85, 105)"] {
  color: ${DARK.textSecondary} !important;
}
[data-theme="dark"] .r-color-1npgj5g,
[data-theme="dark"] [style*="color: rgb(148, 163, 184)"] {
  color: ${DARK.textDisabled} !important;
}
[data-theme="dark"] .r-color-jwli3a,
[data-theme="dark"] [style*="color: rgb(255, 255, 255)"] {
  /* white text stays white on coloured buttons — don't override */
}
/* Borders (all 4 sides generated separately) */
[data-theme="dark"] .r-borderColor-1wr2p1e,
[data-theme="dark"] .r-borderBottomColor-eaxd7d,
[data-theme="dark"] .r-borderLeftColor-uonkgb,
[data-theme="dark"] [style*="border-color: rgb(226, 232, 240)"] {
  border-color: ${DARK.border} !important;
}
[data-theme="dark"] [style*="border-bottom-color: rgb(226, 232, 240)"] {
  border-bottom-color: ${DARK.border} !important;
}
[data-theme="dark"] [style*="border-top-color: rgb(226, 232, 240)"] {
  border-top-color: ${DARK.border} !important;
}
[data-theme="dark"] [style*="border-left-color: rgb(226, 232, 240)"] {
  border-left-color: ${DARK.border} !important;
}
[data-theme="dark"] [style*="border-right-color: rgb(226, 232, 240)"] {
  border-right-color: ${DARK.border} !important;
}
[data-theme="dark"] .r-borderColor-1ropktw,
[data-theme="dark"] [style*="border-color: rgb(203, 213, 225)"] {
  border-color: ${DARK.borderInput} !important;
}
[data-theme="dark"] .r-borderColor-11mg6pl,
[data-theme="dark"] [style*="border-color: rgb(255, 255, 255)"] {
  border-color: ${DARK.surface} !important;
}
[data-theme="dark"] .r-borderColor-1ucinvm,
[data-theme="dark"] [style*="border-color: rgb(15, 23, 42)"] {
  border-color: ${DARK.text} !important;
}
/* Inputs */
[data-theme="dark"] input::placeholder,
[data-theme="dark"] textarea::placeholder {
  color: ${DARK.textDisabled} !important;
  opacity: 1 !important;
}
[data-theme="dark"] input, [data-theme="dark"] textarea {
  caret-color: ${DARK.text};
  color-scheme: dark;
}
/* ------------------------------------------------------------------
 * Fallbacks for light-accent backgrounds that may still slip through
 * as inline styles (e.g. 3rd-party RN-Web spots we haven't migrated).
 * Each maps the light hex → its equivalent dark-palette entry.
 * ------------------------------------------------------------------ */
[data-theme="dark"] [style*="background-color: rgb(219, 234, 254)"],
[data-theme="dark"] .r-backgroundColor-1niwhzg {  /* #DBEAFE */
  background-color: ${DARK.highlightBg} !important;
}
[data-theme="dark"] [style*="background-color: rgb(254, 243, 199)"] {  /* #FEF3C7 */
  background-color: ${DARK.pillOrangeBg} !important;
}
[data-theme="dark"] [style*="background-color: rgb(237, 233, 254)"] {  /* #EDE9FE */
  background-color: ${DARK.pillPurpleBg} !important;
}
[data-theme="dark"] [style*="background-color: rgb(239, 246, 255)"] {  /* #EFF6FF */
  background-color: ${DARK.primarySoft} !important;
}
[data-theme="dark"] [style*="background-color: rgb(220, 252, 231)"] {  /* #DCFCE7 */
  background-color: ${DARK.syncedBg} !important;
}
[data-theme="dark"] [style*="background-color: rgb(254, 226, 226)"] {  /* #FEE2E2 */
  background-color: ${DARK.errorBg} !important;
}
/* Text colours that should also adapt */
[data-theme="dark"] [style*="color: rgb(30, 64, 175)"] {  /* #1E40AF */
  color: ${DARK.pillBlueText} !important;
}
[data-theme="dark"] [style*="color: rgb(146, 64, 14)"] {  /* #92400E */
  color: ${DARK.pillOrangeText} !important;
}
[data-theme="dark"] [style*="color: rgb(91, 33, 182)"],
[data-theme="dark"] [style*="color: rgb(109, 40, 217)"] {  /* #5B21B6 / #6D28D9 */
  color: ${DARK.pillPurpleText} !important;
}
[data-theme="dark"] [style*="color: rgb(22, 101, 52)"] {  /* #166534 */
  color: ${DARK.syncedText} !important;
}
[data-theme="dark"] [style*="color: rgb(153, 27, 27)"] {  /* #991B1B */
  color: ${DARK.errorText} !important;
}
  `;
  if (!el) {
    el = document.createElement("style");
    el.id = "app-theme-overrides";
    document.head.appendChild(el);
  }
  el.textContent = css;
  _themeCssInjected = true;
}

type Ctx = {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  toggle: () => void;
  /** increments each time theme changes — use as <View key={themeKey}> to force rebuild */
  themeKey: number;
};

const ThemeContext = createContext<Ctx>({
  theme: "light",
  setTheme: () => {},
  toggle: () => {},
  themeKey: 0,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>("light");
  const [themeKey, setThemeKey] = useState<number>(0);
  const loaded = useRef(false);

  // Apply immediately at mount, then hydrate from storage
  useEffect(() => {
    applyPalette("light");
    (async () => {
      try {
        const v = await AsyncStorage.getItem(KEY);
        if (v === "dark" || v === "light") {
          if (v !== theme) {
            applyPalette(v);
            setThemeState(v);
          }
        }
      } catch {}
      loaded.current = true;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = useCallback((t: ThemeName) => {
    applyPalette(t);
    setThemeState(t);
    setThemeKey((k) => k + 1);
    AsyncStorage.setItem(KEY, t).catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggle, themeKey }),
    [theme, setTheme, toggle, themeKey]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
