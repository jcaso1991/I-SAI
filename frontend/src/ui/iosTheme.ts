/**
 * iOS-inspired design tokens for i-SAI.
 *
 * These tokens follow Apple HIG conventions while preserving the i-SAI
 * brand colour (azul corporativo `#1E88E5`).
 *
 * Use everywhere via `import { ios } from "../src/ui/iosTheme";`
 */

import { Platform } from "react-native";

export const ios = {
  // ---------------------------------------------------------------------------
  // Colours – iOS system palette + i-SAI brand
  // ---------------------------------------------------------------------------
  colors: {
    /** Brand primary (kept i-SAI blue, slightly tuned for iOS feel). */
    brand: "#1E88E5",
    brandPressed: "#1565C0",

    /** Page background — iOS uses very light grey for "grouped" lists. */
    bgGrouped: "#F2F2F7",
    /** White content surfaces (cards / rows). */
    surface: "#FFFFFF",
    /** Slightly off-white used for nested surfaces. */
    surfaceElevated: "#FFFFFF",

    /** Section header text (UPPERCASE small caps) – iOS gray. */
    sectionHeader: "#6E6E73",
    /** Footnote / explanatory text under groups. */
    footnote: "#8E8E93",

    /** Primary text — near-black, easier on the eye than full #000. */
    text: "#1C1C1E",
    /** Secondary label – iOS "secondaryLabel". */
    textSub: "#3C3C4399", // 60% black per iOS HIG
    /** Tertiary label */
    textMuted: "#3C3C434D", // 30%

    /** Separator between rows – iOS thin grey. */
    separator: "#C6C6C8",
    /** Lighter separator used inside grouped tables. */
    separatorOpaque: "#E5E5EA",

    /** System feedback colours (matched to iOS). */
    red: "#FF3B30",
    orange: "#FF9500",
    yellow: "#FFCC00",
    green: "#34C759",
    teal: "#5AC8FA",
    indigo: "#5856D6",
    purple: "#AF52DE",
    pink: "#FF2D55",

    /** Danger / destructive helpers (delete, log out). */
    destructive: "#FF3B30",

    /** Tab bar inactive icon. */
    tabInactive: "#8E8E93",
  },

  // ---------------------------------------------------------------------------
  // Typography – San Francisco (system) feel
  // ---------------------------------------------------------------------------
  font: {
    /** iOS prefers system font; on web we fall back to SF/Inter/Apple stack. */
    family: Platform.select<string>({
      ios: "System",
      android: "System",
      web: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Inter', 'Segoe UI', Roboto, sans-serif",
      default: "System",
    }) as string,
    /** Large Title — top of every iOS screen. */
    largeTitle: { size: 34, weight: "700" as const, lh: 41, letter: -0.7 },
    /** Standard nav bar title (when scrolled / compact). */
    title1: { size: 28, weight: "700" as const, lh: 34, letter: -0.4 },
    title2: { size: 22, weight: "700" as const, lh: 28, letter: -0.3 },
    title3: { size: 20, weight: "600" as const, lh: 25, letter: -0.2 },
    /** Body text (default). */
    body: { size: 17, weight: "400" as const, lh: 22, letter: -0.4 },
    bodyEmphasized: { size: 17, weight: "600" as const, lh: 22, letter: -0.4 },
    callout: { size: 16, weight: "400" as const, lh: 21, letter: -0.3 },
    /** Subhead used for secondary row text. */
    subhead: { size: 15, weight: "400" as const, lh: 20, letter: -0.2 },
    footnote: { size: 13, weight: "400" as const, lh: 18, letter: -0.1 },
    /** Section header (UPPERCASE letterspaced). */
    section: { size: 13, weight: "400" as const, lh: 18, letter: 0 },
    caption: { size: 12, weight: "400" as const, lh: 16, letter: 0 },
    /** Tab bar label. */
    tabLabel: { size: 10, weight: "500" as const, lh: 12, letter: 0.1 },
  },

  // ---------------------------------------------------------------------------
  // Spacing (8 pt grid)
  // ---------------------------------------------------------------------------
  spacing: {
    xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48,
    /** Standard horizontal padding inside iOS list groups. */
    rowH: 16,
    rowV: 11,
  },

  // ---------------------------------------------------------------------------
  // Radii
  // ---------------------------------------------------------------------------
  radius: {
    /** Inner radius for individual list rows when at top/bottom of group. */
    row: 10,
    /** Card corner radius. */
    card: 12,
    /** Pill/segmented control. */
    pill: 999,
    /** Settings icon container. */
    icon: 7,
  },

  // ---------------------------------------------------------------------------
  // Shadows / hairlines
  // ---------------------------------------------------------------------------
  shadow: {
    /** Subtle shadow used by cards. iOS prefers subtle blur. */
    card: Platform.select<any>({
      web: { boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
      default: {
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      },
    }) as any,
    /** Slightly elevated (modal handle, FAB). */
    elevated: Platform.select<any>({
      web: { boxShadow: "0 4px 16px rgba(0,0,0,0.10)" },
      default: {
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      },
    }) as any,
  },

  /** Hairline (iOS uses 0.33pt — we approximate with 0.5px). */
  hairline: 0.5,
};

export type IOSTheme = typeof ios;

/** Helper: apply a typography preset from `ios.font` to a Text style. */
export function fontStyle(preset: keyof IOSTheme["font"]) {
  const f = ios.font[preset] as any;
  if (typeof f === "string") return {} as any;
  return {
    fontFamily: ios.font.family,
    fontSize: f.size,
    fontWeight: f.weight,
    lineHeight: f.lh,
    letterSpacing: f.letter,
  };
}
