/**
 * Robust "go back" that works on web too. expo-router's router.back() silently
 * fails when there's no history entry (e.g. user opened a deep link, or was
 * navigated here via router.replace). In that case we fall back to a known-safe
 * route.
 */
import type { Router } from "expo-router";

export function safeBack(router: Pick<Router, "back" | "canGoBack" | "replace">, fallback: string = "/home") {
  try {
    if (typeof router.canGoBack === "function" && router.canGoBack()) {
      router.back();
      return;
    }
  } catch {}
  // Also check real browser history on web — some routers don't reflect it
  if (typeof window !== "undefined" && typeof window.history !== "undefined" && window.history.length > 1) {
    try { window.history.back(); return; } catch {}
  }
  try { (router as any).replace(fallback); } catch {}
}
