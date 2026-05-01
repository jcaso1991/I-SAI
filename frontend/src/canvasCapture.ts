/**
 * Captura del canvas (View con un SVG dentro) como JPEG base64 — cross-platform.
 *
 * - Web: serializa el SVG a XML, lo rasteriza con <canvas>.
 * - Native (iOS/Android): usa react-native-view-shot.
 */
import { Platform } from "react-native";

export type CaptureOptions = {
  quality?: number;   // 0..1
  width?: number;     // logical px
  height?: number;
};

/**
 * Devuelve base64 JPEG (sin el prefijo "data:image/jpeg;base64,").
 */
export async function captureCanvasJpegBase64(
  ref: any,
  opts: CaptureOptions = {}
): Promise<string> {
  if (Platform.OS === "web") {
    return await captureSvgWeb(ref, { ...opts, format: "jpeg" });
  }
  const { captureRef } = await import("react-native-view-shot");
  const FS = await import("expo-file-system/legacy");
  const uri = await captureRef(ref, { format: "jpg", quality: opts.quality ?? 0.95, result: "tmpfile" });
  return await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
}

/**
 * Devuelve base64 PNG (sin el prefijo "data:image/png;base64,").
 */
export async function captureCanvasPngBase64(
  ref: any,
  opts: CaptureOptions = {}
): Promise<string> {
  if (Platform.OS === "web") {
    return await captureSvgWeb(ref, { ...opts, format: "png" });
  }
  const { captureRef } = await import("react-native-view-shot");
  const FS = await import("expo-file-system/legacy");
  const uri = await captureRef(ref, { format: "png", result: "tmpfile" });
  return await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
}

// ---------------------------------------------------------------------------
// Web implementation
// ---------------------------------------------------------------------------
async function captureSvgWeb(ref: any, opts: CaptureOptions & { format?: "jpeg" | "png" }): Promise<string> {
  const node: HTMLElement | null = findDomNode(ref);
  if (!node) throw new Error("No se encontró el canvas en el DOM");
  const svg = node.querySelector("svg") as SVGSVGElement | null;
  if (!svg) throw new Error("No se encontró el SVG del canvas");

  const rect = node.getBoundingClientRect();
  const width = Math.max(1, Math.round(opts.width ?? rect.width));
  const height = Math.max(1, Math.round(opts.height ?? rect.height));

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  if (!clone.getAttribute("viewBox")) {
    clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }

  // Ensure <image href> is also set as xlink:href (cross-browser)
  clone.querySelectorAll("image").forEach((im) => {
    const href = im.getAttribute("href") || im.getAttribute("xlink:href") || "";
    if (href) {
      im.setAttribute("href", href);
      im.setAttribute("xlink:href", href);
    }
  });

  const xml = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("No se pudo rasterizar el SVG"));
      im.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener contexto 2D");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const fmt = opts.format === "png" ? "image/png" : "image/jpeg";
    const quality = fmt === "image/jpeg" ? (opts.quality ?? 0.95) : undefined;
    return canvas.toDataURL(fmt, quality as any).split(",")[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}

function findDomNode(ref: any): HTMLElement | null {
  if (!ref) return null;
  const candidate = (ref.current ?? ref) as any;
  if (!candidate) return null;
  if (typeof window !== "undefined" && candidate instanceof window.HTMLElement) return candidate;
  try {
    const { findNodeHandle } = require("react-native");
    const node = findNodeHandle(candidate);
    if (node && typeof window !== "undefined" && node instanceof window.HTMLElement) {
      return node;
    }
  } catch {}
  if (candidate.tagName) return candidate as HTMLElement;
  return null;
}

// ---------------------------------------------------------------------------
// Download / share helper (cross-platform)
// ---------------------------------------------------------------------------
export async function shareOrDownloadBase64(
  base64: string,
  mimeType: string,
  filename: string
) {
  if (Platform.OS === "web") {
    const byteChars = atob(base64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    return;
  }
  const FS = await import("expo-file-system/legacy");
  const uri = `${FS.cacheDirectory}${filename}`;
  try { await FS.deleteAsync(uri, { idempotent: true }); } catch {}
  await FS.writeAsStringAsync(uri, base64, { encoding: FS.EncodingType.Base64 });
  const Sharing: any = await import("expo-sharing").catch(() => null);
  if (Sharing?.isAvailableAsync && (await Sharing.isAvailableAsync())) {
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: filename });
  }
}
