import React, { useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "./api";
import { captureRef } from "react-native-view-shot";
import { PanResponder } from "react-native";

export default function SignaturePad({
  value, onChange, label,
}: { value?: string; onChange: (base64: string | "") => void; label?: string }) {
  const viewRef = useRef<any>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const currentPath = useRef<string>("");
  const pathsRef = useRef<string[]>([]);
  const [, forceRender] = useState(0);
  const sizeRef = useRef({ w: 400, h: 140 });

  const updateSize = () => {
    if (viewRef.current && typeof window !== "undefined") {
      try {
        const el = viewRef.current as HTMLElement;
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.width > 0) sizeRef.current = { w: Math.round(r.width), h: Math.round(r.height) };
        }
      } catch {}
    }
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const { locationX: x, locationY: y } = evt.nativeEvent;
      currentPath.current = `M ${x} ${y}`;
      forceRender((n) => n + 1);
    },
    onPanResponderMove: (evt) => {
      const { locationX: x, locationY: y } = evt.nativeEvent;
      currentPath.current += ` L ${x} ${y}`;
      forceRender((n) => n + 1);
    },
    onPanResponderRelease: () => {
      const newPath = currentPath.current;
      const allPaths = [...pathsRef.current, newPath];
      pathsRef.current = allPaths;
      setPaths(allPaths);
      currentPath.current = "";
      updateSize();

      setTimeout(async () => {
        try {
          if (Platform.OS === "web") {
            const pngBase64 = await svgToPngBase64(allPaths, sizeRef.current.w, sizeRef.current.h);
            onChange(`data:image/png;base64,${pngBase64}`);
          } else {
            const uri = await captureRef(viewRef, { format: "png", quality: 0.95, result: "tmpfile" });
            const FS = require("expo-file-system/legacy");
            const b64 = await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
            onChange(`data:image/png;base64,${b64}`);
          }
        } catch {
          onChange(svgToDataUrl(allPaths, sizeRef.current.w, sizeRef.current.h));
        }
      }, 50);
    },
  })).current;

  const clear = () => { pathsRef.current = []; setPaths([]); currentPath.current = ""; onChange(""); };

  return (
    <View style={s.wrap}>
      {label ? <Text style={s.lbl}>{label}</Text> : null}
      <View ref={viewRef} collapsable={false} style={s.pad as any} {...pan.panHandlers}
        onLayout={updateSize}>
        <Svg width="100%" height="100%">
          {paths.map((d, i) => (
            <Path key={i} d={d} stroke={COLORS.navy} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {currentPath.current ? (
            <Path d={currentPath.current} stroke={COLORS.navy} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
        </Svg>
        {paths.length === 0 && !currentPath.current && (
          <View style={s.hint} pointerEvents="none">
            <Ionicons name="create-outline" size={16} color={COLORS.textDisabled} />
            <Text style={s.hintTxt}>Firma aquí</Text>
          </View>
        )}
      </View>
      <TouchableOpacity style={s.clearBtn} onPress={clear}>
        <Ionicons name="refresh" size={14} color={COLORS.navy} />
        <Text style={s.clearTxt}>Borrar firma</Text>
      </TouchableOpacity>
    </View>
  );
}

function svgToDataUrl(paths: string[], w: number = 400, h: number = 140): string {
  const svg = buildSvg(paths, w, h);
  let b64 = "";
  if (typeof TextEncoder !== "undefined") {
    const bytes = new TextEncoder().encode(svg);
    const bin = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
    b64 = typeof btoa !== "undefined" ? btoa(bin) : "";
  }
  return `data:image/svg+xml;base64,${b64}`;
}

function svgToPngBase64(paths: string[], w: number = 400, h: number = 140): Promise<string> {
  return new Promise((resolve, reject) => {
    const svg = buildSvg(paths, w, h);
    const img = new Image();
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("No canvas context")); return; }
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png").split(",")[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("SVG load failed")); };
    img.src = url;
  });
}

function buildSvg(paths: string[], w: number, h: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${paths.map((d) => `<path d="${d}" stroke="#0F172A" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join("")}</svg>`;
}

const s = StyleSheet.create({
  wrap: { gap: 6 },
  lbl: { fontSize: 11, fontWeight: "800", color: COLORS.textSecondary, letterSpacing: 1.2 },
  pad: {
    height: 140, borderWidth: 2, borderColor: COLORS.borderInput, borderRadius: 12,
    backgroundColor: "#FFFFFF", overflow: "hidden", position: "relative",
    // @ts-ignore web cursor
    cursor: "crosshair",
  },
  hint: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6,
  },
  hintTxt: { fontSize: 13, color: COLORS.textDisabled, fontWeight: "600" },
  clearBtn: {
    alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  clearTxt: { fontSize: 12, color: COLORS.navy, fontWeight: "700" },
});
