import { Platform } from "react-native";

export const ios = {
  colors: {
    brand: "#1E88E5",
    brandPressed: "#1565C0",
    brandMuted: "#E0F2FE",

    accent: "#0EA5E9",
    accentSecondary: "#10B981",
    accentWarm: "#F59E0B",

    bgGrouped: "#F2F2F7",
    surface: "#FFFFFF",
    surfaceElevated: "#FFFFFF",

    glassBg: "rgba(255,255,255,0.72)",
    glassBorder: "rgba(255,255,255,0.2)",
    glassTint: "rgba(30,136,229,0.04)",

    sectionHeader: "#6E6E73",
    footnote: "#8E8E93",

    text: "#1C1C1E",
    textSub: "#3C3C4399",
    textMuted: "#3C3C434D",

    separator: "#C6C6C8",
    separatorOpaque: "#E5E5EA",

    red: "#EF4444",
    orange: "#F97316",
    yellow: "#EAB308",
    green: "#22C55E",
    teal: "#14B8A6",
    indigo: "#6366F1",
    purple: "#A855F7",
    pink: "#EC4899",

    destructive: "#EF4444",
    tabInactive: "#8E8E93",

    gradientStart: "#1E88E5",
    gradientEnd: "#0EA5E9",
  },

  font: {
    family: Platform.select<string>({
      ios: "System",
      android: "System",
      web: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Inter', 'Segoe UI', Roboto, sans-serif",
      default: "System",
    }) as string,
    display: { size: 40, weight: "800" as const, lh: 44, letter: -0.8 },
    hero: { size: 32, weight: "700" as const, lh: 38, letter: -0.6 },
    largeTitle: { size: 34, weight: "700" as const, lh: 41, letter: -0.7 },
    title1: { size: 26, weight: "700" as const, lh: 32, letter: -0.5 },
    title2: { size: 22, weight: "700" as const, lh: 28, letter: -0.4 },
    title3: { size: 18, weight: "600" as const, lh: 24, letter: -0.3 },
    body: { size: 15, weight: "400" as const, lh: 22, letter: -0.2 },
    bodyEmphasized: { size: 15, weight: "600" as const, lh: 22, letter: -0.2 },
    callout: { size: 14, weight: "400" as const, lh: 20, letter: -0.2 },
    subhead: { size: 13, weight: "500" as const, lh: 18, letter: -0.1 },
    footnote: { size: 12, weight: "400" as const, lh: 16, letter: 0 },
    section: { size: 11, weight: "600" as const, lh: 14, letter: 0.8 },
    caption: { size: 11, weight: "400" as const, lh: 14, letter: 0 },
    tabLabel: { size: 10, weight: "600" as const, lh: 12, letter: 0.3 },
  },

  spacing: {
    xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48,
    sectionGap: 32,
    rowH: 20,
    rowV: 14,
    groupPadding: 20,
  },

  radius: {
    row: 10,
    card: 12,
    pill: 999,
    icon: 10,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },

  shadow: {
    card: {
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 2 } as any,
      elevation: 2,
    } as any,
    elevated: {
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 6 } as any,
      elevation: 8,
    } as any,
    modal: {
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 32,
      shadowOffset: { width: 0, height: 10 } as any,
      elevation: 12,
    } as any,
  },

  glass: {
    blurRadius: 20,
    backgroundOpacity: 0.72,
    borderOpacity: 0.15,
    tintOpacity: 0.04,
  },

  animation: {
    duration: { fast: 150, normal: 250, slow: 400 },
  },

  hairline: 0.5,
};

export type IOSTheme = typeof ios;

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
