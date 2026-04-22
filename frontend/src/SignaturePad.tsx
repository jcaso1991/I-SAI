import React, { useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
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
  const [, forceRender] = useState(0);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (_, g) => {
      currentPath.current = `M ${g.x0} ${g.y0}`;
      forceRender((n) => n + 1);
    },
    onPanResponderMove: (_, g) => {
      currentPath.current += ` L ${g.moveX - (g.x0 - g.dx0) + g.dx} ${g.moveY - (g.y0 - g.dy0) + g.dy}`;
      // Simpler: just append moveX/moveY relative to view
      forceRender((n) => n + 1);
    },
    onPanResponderRelease: () => {
      setPaths((p) => [...p, currentPath.current]);
      currentPath.current = "";
      // Capture and emit base64
      setTimeout(async () => {
        try {
          const uri = await captureRef(viewRef, { format: "png", quality: 0.95, result: "tmpfile" });
          const FS = require("expo-file-system/legacy");
          const b64 = await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
          onChange(`data:image/png;base64,${b64}`);
        } catch {
          // Fallback: on web, convert SVG to base64 manually
          onChange(svgToDataUrl(paths));
        }
      }, 50);
    },
  })).current;

  const clear = () => { setPaths([]); currentPath.current = ""; onChange(""); };

  return (
    <View style={s.wrap}>
      {label ? <Text style={s.lbl}>{label}</Text> : null}
      <View ref={viewRef} collapsable={false} style={s.pad} {...pan.panHandlers}>
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

function svgToDataUrl(paths: string[]): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="140">${paths.map((d) => `<path d="${d}" stroke="#0F172A" stroke-width="2.5" fill="none"/>`).join("")}</svg>`;
  // @ts-ignore btoa on web
  const b64 = typeof btoa !== "undefined" ? btoa(unescape(encodeURIComponent(svg))) : "";
  return `data:image/svg+xml;base64,${b64}`;
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
