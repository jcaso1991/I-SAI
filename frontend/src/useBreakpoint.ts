import { useEffect, useState } from "react";
import { Dimensions, Platform } from "react-native";

/**
 * Returns the current breakpoint based on window width.
 * Breakpoints: mobile <768, tablet 768-1023, desktop ≥1024.
 */
export function useBreakpoint() {
  const getBp = () => {
    const w = Dimensions.get("window").width;
    if (w >= 1024) return "desktop" as const;
    if (w >= 768) return "tablet" as const;
    return "mobile" as const;
  };
  const [bp, setBp] = useState<"mobile" | "tablet" | "desktop">(getBp());

  useEffect(() => {
    const handler = () => setBp(getBp());
    const sub = Dimensions.addEventListener("change", handler);
    return () => sub?.remove?.();
  }, []);

  return {
    bp,
    isMobile: bp === "mobile",
    isTablet: bp === "tablet",
    isDesktop: bp === "desktop",
    isWide: bp !== "mobile",
    isWeb: Platform.OS === "web",
  };
}
