import { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
  ActivityIndicator, PanResponder, Modal, TextInput, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { G, Path, Rect, Circle, SvgXml, Image as SvgImage } from "react-native-svg";
import { captureRef } from "react-native-view-shot";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { api, COLORS } from "../../src/api";
import { BUILTIN_STAMPS } from "../../src/stamps";

type Pt = { x: number; y: number };
type LineShape = { id: string; type: "line"; points: Pt[]; stroke: string; strokeWidth: number };
type RectShape = { id: string; type: "rect"; x: number; y: number; w: number; h: number; stroke: string; strokeWidth: number; fill: string };
type CircleShape = { id: string; type: "circle"; cx: number; cy: number; r: number; stroke: string; strokeWidth: number; fill: string };
type StampShape = {
  id: string; type: "stamp"; x: number; y: number; w: number; h: number;
  stampId: string; icon_key?: string; image_base64?: string; rotation?: number;
};
type Shape = LineShape | RectShape | CircleShape | StampShape;

type Tool = "pencil" | "rect" | "circle" | "stamp" | "eraser" | "select";
type StampItem = { id: string; name: string; is_builtin: boolean; image_base64?: string | null; icon_key?: string | null };

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const TOOLBAR_H = 64;
const BOTTOM_H = 84;

export default function PlanEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [background, setBackground] = useState<{ data_uri: string; width: number; height: number } | null>(null);
  const [bgUploading, setBgUploading] = useState(false);
  const [tool, setTool] = useState<Tool>("pencil");
  const [currentStampId, setCurrentStampId] = useState<string | null>("builtin_door");
  const [size, setSize] = useState(80);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stamps, setStamps] = useState<StampItem[]>([]);
  const [showStampPicker, setShowStampPicker] = useState(false);
  const [showStampManager, setShowStampManager] = useState(false);
  const [me, setMe] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 1000, h: 1000 });

  const canvasRef = useRef<View>(null);
  const saveTimer = useRef<any>(null);
  const currentDrawingRef = useRef<Shape | null>(null);
  const lastDragRef = useRef<Pt | null>(null);
  const pinchRef = useRef<{ startDist: number; baseShape: Shape } | null>(null);

  // Load plan + stamps + me
  const [sourceEventId, setSourceEventId] = useState<string | null>(null);
  const [sourceAttachmentId, setSourceAttachmentId] = useState<string | null>(null);
  const [sourceFilename, setSourceFilename] = useState<string>("plano");

  useEffect(() => {
    (async () => {
      try {
        const [plan, stampList, who] = await Promise.all([
          api.getPlan(id),
          api.listStamps(),
          api.me(),
        ]);
        setTitle(plan.title);
        setShapes((plan.data?.shapes || []) as Shape[]);
        if (plan.data?.background) setBackground(plan.data.background);
        setStamps(stampList);
        setMe(who);
        if (plan.source_event_id) setSourceEventId(plan.source_event_id);
        if (plan.source_attachment_id) setSourceAttachmentId(plan.source_attachment_id);
        // Extract original filename from title pattern "📐 filename.pdf"
        const m = (plan.title || "").match(/^📐\s*(.+)$/);
        if (m) setSourceFilename(m[1]);
      } catch (e: any) {
        Alert.alert("Error", e.message);
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Debounced autosave
  useEffect(() => {
    if (!dirty || loading) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        setSaving(true);
        await api.updatePlan(id, { data: { shapes } });
        setDirty(false);
      } catch (e: any) {
        console.warn("Save failed:", e.message);
      } finally {
        setSaving(false);
      }
    }, 1200);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [shapes, dirty, loading, id]);

  const markDirty = () => setDirty(true);

  // ---------------- Drawing gestures ----------------
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const { locationX: x, locationY: y } = evt.nativeEvent;
      const touches = evt.nativeEvent.touches || [];
      if (touches.length >= 2 && selectedId) {
        // start pinch
        const [t1, t2] = touches;
        const d = Math.hypot((t1.pageX - t2.pageX), (t1.pageY - t2.pageY));
        const sh = shapes.find((s) => s.id === selectedId);
        if (sh) {
          pinchRef.current = { startDist: d, baseShape: JSON.parse(JSON.stringify(sh)) };
        }
        return;
      }
      handleStart(x, y);
    },
    onPanResponderMove: (evt) => {
      const touches = evt.nativeEvent.touches || [];
      if (touches.length >= 2 && pinchRef.current && selectedId) {
        const [t1, t2] = touches;
        const d = Math.hypot((t1.pageX - t2.pageX), (t1.pageY - t2.pageY));
        const factor = d / pinchRef.current.startDist;
        const base = pinchRef.current.baseShape;
        setShapes((arr) => arr.map((sh) => {
          if (sh.id !== selectedId) return sh;
          return scaleShape(base, factor);
        }));
        markDirty();
        return;
      }
      const { locationX: x, locationY: y } = evt.nativeEvent;
      handleMove(x, y);
    },
    onPanResponderRelease: () => { pinchRef.current = null; handleEnd(); },
    onPanResponderTerminate: () => { pinchRef.current = null; handleEnd(); },
  }), [tool, currentStampId, size, selectedId, shapes]);

  const handleStart = (x: number, y: number) => {
    if (tool === "pencil") {
      const line: LineShape = {
        id: uid(), type: "line",
        points: [{ x, y }],
        stroke: COLORS.navy, strokeWidth: 3,
      };
      currentDrawingRef.current = line;
      setShapes((s) => [...s, line]);
    } else if (tool === "rect") {
      const rect: RectShape = {
        id: uid(), type: "rect",
        x, y, w: 0, h: 0,
        stroke: COLORS.navy, strokeWidth: 2, fill: "rgba(30,136,229,0.1)",
      };
      currentDrawingRef.current = rect;
      setShapes((s) => [...s, rect]);
    } else if (tool === "circle") {
      const circ: CircleShape = {
        id: uid(), type: "circle",
        cx: x, cy: y, r: 0,
        stroke: COLORS.navy, strokeWidth: 2, fill: "rgba(30,136,229,0.1)",
      };
      currentDrawingRef.current = circ;
      setShapes((s) => [...s, circ]);
    } else if (tool === "stamp" && currentStampId) {
      const st = stamps.find((s) => s.id === currentStampId);
      if (!st) return;
      const newShape: StampShape = {
        id: uid(), type: "stamp",
        x: x - size / 2, y: y - size / 2,
        w: size, h: size,
        stampId: st.id,
        icon_key: st.icon_key || undefined,
        image_base64: st.image_base64 || undefined,
      };
      setShapes((s) => [...s, newShape]);
      markDirty();
    } else if (tool === "eraser") {
      // find and delete shape under point
      const hit = hitTest(shapes, x, y);
      if (hit) {
        setShapes((s) => s.filter((sh) => sh.id !== hit.id));
        markDirty();
      }
    } else if (tool === "select") {
      const hit = hitTest(shapes, x, y);
      if (hit) {
        setSelectedId(hit.id);
        lastDragRef.current = { x, y };
      } else {
        setSelectedId(null);
      }
    }
  };

  const handleMove = (x: number, y: number) => {
    const cur = currentDrawingRef.current;
    if (tool === "pencil" && cur && cur.type === "line") {
      const last = cur.points[cur.points.length - 1];
      if (Math.hypot(x - last.x, y - last.y) < 2) return;
      cur.points.push({ x, y });
      setShapes((s) => s.map((sh) => (sh.id === cur.id ? { ...cur } : sh)));
    } else if (tool === "rect" && cur && cur.type === "rect") {
      cur.w = x - cur.x;
      cur.h = y - cur.y;
      setShapes((s) => s.map((sh) => (sh.id === cur.id ? { ...cur } : sh)));
    } else if (tool === "circle" && cur && cur.type === "circle") {
      cur.r = Math.hypot(x - cur.cx, y - cur.cy);
      setShapes((s) => s.map((sh) => (sh.id === cur.id ? { ...cur } : sh)));
    } else if (tool === "select" && selectedId && lastDragRef.current) {
      const dx = x - lastDragRef.current.x;
      const dy = y - lastDragRef.current.y;
      lastDragRef.current = { x, y };
      setShapes((arr) => arr.map((sh) => {
        if (sh.id !== selectedId) return sh;
        return translateShape(sh, dx, dy);
      }));
    } else if (tool === "eraser") {
      // continuous erase
      const hit = hitTest(shapes, x, y);
      if (hit) {
        setShapes((s) => s.filter((sh) => sh.id !== hit.id));
        markDirty();
      }
    }
  };

  const handleEnd = () => {
    const cur = currentDrawingRef.current;
    if (cur) {
      // normalize rect so w,h positive
      if (cur.type === "rect") {
        if (cur.w < 0) { cur.x += cur.w; cur.w = -cur.w; }
        if (cur.h < 0) { cur.y += cur.h; cur.h = -cur.h; }
        setShapes((s) => s.map((sh) => (sh.id === cur.id ? { ...cur } : sh)));
      }
      markDirty();
    }
    currentDrawingRef.current = null;
    lastDragRef.current = null;
  };

  // ---------------- Selected shape actions ----------------
  const selectedShape = shapes.find((s) => s.id === selectedId);

  const resizeSelected = (factor: number) => {
    if (!selectedShape) return;
    setShapes((arr) => arr.map((sh) => {
      if (sh.id !== selectedShape.id) return sh;
      return scaleShape(sh, factor);
    }));
    markDirty();
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setShapes((s) => s.filter((sh) => sh.id !== selectedId));
    setSelectedId(null);
    markDirty();
  };

  const clearAll = () => {
    Alert.alert("Limpiar todo", "¿Seguro que quieres borrar todo el plano?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar", style: "destructive",
        onPress: () => { setShapes([]); setSelectedId(null); markDirty(); },
      },
    ]);
  };

  // ---------------- Background (JPG/PDF) ----------------
  const pickBackground = async () => {
    try {
      setBgUploading(true);
      let fileBase64 = "";
      let mimeType = "";
      if (Platform.OS === "web") {
        // Use standard input[type=file] for broader web support
        const file = await new Promise<File | null>((resolve) => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/jpeg,image/png,application/pdf";
          input.onchange = (e: any) => resolve(e.target.files?.[0] || null);
          input.oncancel = () => resolve(null);
          input.click();
        });
        if (!file) { setBgUploading(false); return; }
        mimeType = file.type;
        fileBase64 = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => {
            const s = r.result as string;
            resolve(s.split(",")[1]);
          };
          r.onerror = () => reject(r.error);
          r.readAsDataURL(file);
        });
      } else {
        const res = await DocumentPicker.getDocumentAsync({
          type: ["image/jpeg", "image/png", "application/pdf"],
          copyToCacheDirectory: true,
        });
        if (res.canceled || !res.assets?.[0]) { setBgUploading(false); return; }
        const asset = res.assets[0];
        mimeType = asset.mimeType || "application/octet-stream";
        fileBase64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
      const { background: bg } = await api.uploadBackground(id, {
        file_base64: fileBase64, mime_type: mimeType,
      });
      setBackground(bg);
    } catch (e: any) {
      Alert.alert("Error al subir fondo", e.message);
    } finally {
      setBgUploading(false);
    }
  };

  const removeBackground = () => {
    Alert.alert("Quitar fondo", "¿Eliminar la imagen/PDF de fondo?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Quitar", style: "destructive",
        onPress: async () => {
          try {
            await api.removeBackground(id);
            setBackground(null);
          } catch (e: any) { Alert.alert("Error", e.message); }
        },
      },
    ]);
  };

  // ---------------- Export ----------------
  const safeFilename = (name: string): string => {
    return (name || "plano")
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, "_")
      .replace(/_{2,}/g, "_")
      .substring(0, 80) || "plano";
  };

  const exportAs = async (format: "jpg" | "pdf") => {
    try {
      setSelectedId(null);
      await new Promise((r) => setTimeout(r, 100));
      const uri = await captureRef(canvasRef, {
        format: "jpg",
        quality: 0.95,
        result: "tmpfile",
      });
      const baseName = safeFilename(title);
      if (format === "jpg") {
        // Copy to a file with the plan's title as filename
        const destUri = `${FileSystem.cacheDirectory}${baseName}.jpg`;
        try {
          await FileSystem.deleteAsync(destUri, { idempotent: true });
        } catch {}
        await FileSystem.copyAsync({ from: uri, to: destUri });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(destUri, {
            mimeType: "image/jpeg",
            dialogTitle: title,
            UTI: "public.jpeg",
          });
        } else {
          Alert.alert("Guardado", `Archivo creado: ${baseName}.jpg\n${destUri}`);
        }
      } else {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const html = `<html><head><title>${escapeHtml(title)}</title></head><body style="margin:0;padding:20px"><h2 style="font-family:sans-serif">${escapeHtml(title)}</h2><img src="data:image/jpeg;base64,${base64}" style="max-width:100%;border:1px solid #ccc"/></body></html>`;
        const { uri: pdfUri } = await Print.printToFileAsync({ html, base64: false });
        // rename the file to match title
        const destUri = `${FileSystem.cacheDirectory}${baseName}.pdf`;
        try { await FileSystem.deleteAsync(destUri, { idempotent: true }); } catch {}
        await FileSystem.copyAsync({ from: pdfUri, to: destUri });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(destUri, {
            mimeType: "application/pdf",
            dialogTitle: title,
            UTI: "com.adobe.pdf",
          });
        } else {
          Alert.alert("Guardado", `PDF creado: ${baseName}.pdf\n${destUri}`);
        }
      }
    } catch (e: any) {
      Alert.alert("Error al exportar", e.message);
    }
  };

  const saveBackToEvent = async (andGoBack?: boolean) => {
    if (!sourceEventId || !sourceAttachmentId) return;
    try {
      setSelectedId(null);
      await new Promise((r) => setTimeout(r, 100));
      // 1) Capture canvas as JPG base64
      const uri = await captureRef(canvasRef, {
        format: "jpg",
        quality: 0.95,
        result: "tmpfile",
      });
      const jpgBase64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

      // 2) Generate a PDF with the JPG embedded
      const baseName = safeFilename(sourceFilename || title);
      const isPdf = (sourceFilename || "").toLowerCase().endsWith(".pdf");
      let uploadBase64 = jpgBase64;
      let mimeType = "image/jpeg";
      let finalFilename = baseName.endsWith(".jpg") ? baseName : `${baseName}.jpg`;

      if (isPdf) {
        const html = `<html><head><title>${escapeHtml(title)}</title></head><body style="margin:0;padding:0"><img src="data:image/jpeg;base64,${jpgBase64}" style="width:100%;display:block"/></body></html>`;
        const { uri: pdfUri } = await Print.printToFileAsync({ html, base64: true });
        // @ts-ignore Print returns base64 when requested
        uploadBase64 = (pdfUri as any).base64 || await FileSystem.readAsStringAsync(pdfUri, { encoding: FileSystem.EncodingType.Base64 });
        if (typeof pdfUri === "string") {
          uploadBase64 = await FileSystem.readAsStringAsync(pdfUri, { encoding: FileSystem.EncodingType.Base64 });
        }
        mimeType = "application/pdf";
        finalFilename = baseName.endsWith(".pdf") ? baseName : `${baseName}.pdf`;
      }

      // Save shapes state to the plan first (autosave)
      try { await api.updatePlan(id, { data: { shapes, ...(background ? { background } : {}) } } as any); } catch {}

      // 3) Delete old attachment
      await api.deleteEventAttachment(sourceEventId, sourceAttachmentId);
      // 4) Upload new attachment
      const newAtt = await api.uploadEventAttachment(sourceEventId, {
        filename: finalFilename,
        mime_type: mimeType,
        base64: uploadBase64,
      });
      // 5) Update plan source_attachment_id so subsequent saves replace the new one
      await api.updatePlan(id, { source_attachment_id: newAtt.id } as any);
      setSourceAttachmentId(newAtt.id);

      if (andGoBack) {
        // Navigate back to calendar
        router.replace(`/calendario?openEvent=${sourceEventId}`);
      } else {
        Alert.alert("✅ Guardado", `El adjunto "${finalFilename}" se ha actualizado en el evento.`);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo guardar en el evento");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const isAdmin = me?.role === "admin";
  const currentStamp = stamps.find((x) => x.id === currentStampId);

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
          <Text style={s.headerSub}>{saving ? "Guardando..." : dirty ? "Sin guardar" : "Guardado"}</Text>
        </View>
        <TouchableOpacity style={s.iconBtn} onPress={() => exportAs("jpg")}>
          <Ionicons name="image-outline" size={22} color={COLORS.navy} />
        </TouchableOpacity>
        <TouchableOpacity style={s.iconBtn} onPress={() => exportAs("pdf")}>
          <Ionicons name="document-outline" size={22} color={COLORS.navy} />
        </TouchableOpacity>
        {sourceEventId && sourceAttachmentId && (
          <>
            <TouchableOpacity
              testID="btn-save-to-event"
              style={[s.iconBtn, { backgroundColor: COLORS.bg, borderWidth: 2, borderColor: COLORS.primary }]}
              onPress={() => saveBackToEvent(false)}
            >
              <Ionicons name="cloud-upload-outline" size={22} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              testID="btn-save-and-back"
              style={[s.saveBackBtn]}
              onPress={() => saveBackToEvent(true)}
            >
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={s.saveBackBtnTxt}>Guardar y volver</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Toolbar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.toolbar}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 12, alignItems: "center" }}
      >
        <ToolBtn icon="pencil" active={tool === "pencil"} onPress={() => { setTool("pencil"); setSelectedId(null); }} label="Lápiz" />
        <ToolBtn icon="square-outline" active={tool === "rect"} onPress={() => { setTool("rect"); setSelectedId(null); }} label="Cuadro" />
        <ToolBtn icon="ellipse-outline" active={tool === "circle"} onPress={() => { setTool("circle"); setSelectedId(null); }} label="Círculo" />
        <ToolBtn icon="cube" active={tool === "stamp"} onPress={() => { setTool("stamp"); setSelectedId(null); setShowStampPicker(true); }} label={currentStamp?.name || "Pieza"} />
        <ToolBtn icon="trash-outline" active={tool === "eraser"} onPress={() => { setTool("eraser"); setSelectedId(null); }} label="Borrar" />
        <ToolBtn icon="hand-left-outline" active={tool === "select"} onPress={() => { setTool("select"); }} label="Mover" />
        <View style={{ width: 1, height: 28, backgroundColor: COLORS.border, marginHorizontal: 4 }} />
        <TouchableOpacity style={s.toolBtn} onPress={background ? removeBackground : pickBackground} disabled={bgUploading}>
          {bgUploading ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : (
            <Ionicons name={background ? "close-circle" : "image"} size={20} color={background ? COLORS.errorText : COLORS.primary} />
          )}
          <Text style={[s.toolBtnLabel, { color: background ? COLORS.errorText : COLORS.primary }]}>
            {background ? "Sin fondo" : "Fondo"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.toolBtn} onPress={clearAll}>
          <Ionicons name="refresh" size={20} color={COLORS.errorText} />
          <Text style={[s.toolBtnLabel, { color: COLORS.errorText }]}>Limpiar</Text>
        </TouchableOpacity>
        {isAdmin && (
          <TouchableOpacity style={s.toolBtn} onPress={() => setShowStampManager(true)}>
            <Ionicons name="add-circle" size={20} color={COLORS.primary} />
            <Text style={[s.toolBtnLabel, { color: COLORS.primary }]}>Sellos</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Size control for stamp tool */}
      {tool === "stamp" && (
        <View style={s.sizeRow}>
          <Text style={s.sizeLabel}>Tamaño: {size}px</Text>
          <View style={s.sizeBtns}>
            {[40, 80, 120, 180].map((v) => (
              <TouchableOpacity
                key={v}
                onPress={() => setSize(v)}
                style={[s.sizeChip, size === v && s.sizeChipActive]}
              >
                <Text style={[s.sizeChipText, size === v && { color: "#fff" }]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Canvas */}
      <View
        ref={canvasRef}
        style={s.canvasWrap}
        onLayout={(e) => setCanvasSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        collapsable={false}
      >
        <View style={s.canvasPaper} {...panResponder.panHandlers}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${canvasSize.w} ${canvasSize.h}`} pointerEvents="none">
            {background && (
              <SvgImage
                x={0} y={0}
                width={canvasSize.w} height={canvasSize.h}
                href={background.data_uri}
                preserveAspectRatio="xMidYMid meet"
                opacity={0.75}
              />
            )}
            {shapes.map((sh) => renderShape(sh, sh.id === selectedId))}
          </Svg>
        </View>
      </View>

      {/* Bottom bar */}
      <View style={s.bottomBar}>
        {selectedShape ? (
          <View style={s.selectedRow}>
            <Text style={s.selectedLabel}>Selección: {shapeLabel(selectedShape)}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity style={s.btnIconSm} onPress={() => resizeSelected(0.8)}>
                <Ionicons name="remove" size={20} color={COLORS.navy} />
              </TouchableOpacity>
              <TouchableOpacity style={s.btnIconSm} onPress={() => resizeSelected(1.25)}>
                <Ionicons name="add" size={20} color={COLORS.navy} />
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnIconSm, { backgroundColor: COLORS.errorBg }]} onPress={deleteSelected}>
                <Ionicons name="trash" size={20} color={COLORS.errorText} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text style={s.hintText}>
            {tool === "pencil" ? "Dibuja libremente arrastrando el dedo"
              : tool === "rect" ? "Arrastra para crear un cuadrado"
              : tool === "circle" ? "Arrastra para crear un círculo"
              : tool === "stamp" ? `Toca para colocar: ${currentStamp?.name || "pieza"}`
              : tool === "eraser" ? "Toca una pieza para borrarla"
              : tool === "select" ? "Toca para seleccionar · arrastra para mover · pellizca con 2 dedos para cambiar tamaño"
              : ""}
          </Text>
        )}
      </View>

      {/* Stamp picker */}
      <StampPicker
        visible={showStampPicker}
        stamps={stamps}
        currentId={currentStampId}
        onSelect={(s) => { setCurrentStampId(s.id); setShowStampPicker(false); }}
        onClose={() => setShowStampPicker(false)}
      />

      {/* Stamp manager (admin) */}
      <StampManager
        visible={showStampManager}
        stamps={stamps}
        onClose={() => setShowStampManager(false)}
        onRefresh={async () => setStamps(await api.listStamps())}
      />
    </SafeAreaView>
  );
}

// ---------------- helpers ----------------

function renderShape(sh: Shape, selected: boolean) {
  const highlight = selected ? "#EF4444" : undefined;
  if (sh.type === "line") {
    if (sh.points.length < 2) {
      // draw dot
      return <Circle key={sh.id} cx={sh.points[0].x} cy={sh.points[0].y} r={sh.strokeWidth / 2} fill={highlight || sh.stroke} />;
    }
    const d = sh.points.map((p, i) => (i === 0 ? `M${p.x} ${p.y}` : `L${p.x} ${p.y}`)).join(" ");
    return <Path key={sh.id} d={d} stroke={highlight || sh.stroke} strokeWidth={sh.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
  }
  if (sh.type === "rect") {
    return <Rect key={sh.id} x={sh.x} y={sh.y} width={sh.w} height={sh.h} stroke={highlight || sh.stroke} strokeWidth={sh.strokeWidth} fill={sh.fill} />;
  }
  if (sh.type === "circle") {
    return <Circle key={sh.id} cx={sh.cx} cy={sh.cy} r={sh.r} stroke={highlight || sh.stroke} strokeWidth={sh.strokeWidth} fill={sh.fill} />;
  }
  if (sh.type === "stamp") {
    return <StampView key={sh.id} shape={sh} highlight={highlight} />;
  }
  return null;
}

function StampView({ shape, highlight }: { shape: StampShape; highlight?: string }) {
  if (shape.icon_key) {
    const builtin = BUILTIN_STAMPS[shape.icon_key];
    if (!builtin) return null;
    const info = builtin.render(shape.w);
    const scaleX = shape.w / 100;
    const scaleY = shape.h / 100;
    return (
      <G transform={`translate(${shape.x}, ${shape.y}) scale(${scaleX}, ${scaleY})`}>
        {info.paths.map((p, i) => (
          <Path key={i}
            d={p.d}
            stroke={highlight || p.stroke || COLORS.navy}
            strokeWidth={p.strokeWidth || 2}
            fill={p.fill || "none"}
          />
        ))}
        {(info.circles || []).map((c, i) => (
          <Circle key={`c${i}`}
            cx={c.cx} cy={c.cy} r={c.r}
            stroke={highlight || c.stroke || COLORS.navy}
            strokeWidth={c.strokeWidth || 2}
            fill={c.fill || "none"}
          />
        ))}
      </G>
    );
  }
  if (shape.image_base64) {
    return (
      <G>
        <SvgImage
          x={shape.x} y={shape.y}
          width={shape.w} height={shape.h}
          href={shape.image_base64}
          preserveAspectRatio="xMidYMid meet"
        />
        {highlight && (
          <Rect x={shape.x} y={shape.y} width={shape.w} height={shape.h}
            stroke={highlight} strokeWidth={2} fill="none" strokeDasharray="6 4" />
        )}
      </G>
    );
  }
  return null;
}

function hitTest(shapes: Shape[], x: number, y: number): Shape | null {
  // iterate in reverse so topmost is hit first
  for (let i = shapes.length - 1; i >= 0; i--) {
    const sh = shapes[i];
    if (sh.type === "line") {
      for (const p of sh.points) {
        if (Math.hypot(p.x - x, p.y - y) < 12) return sh;
      }
    } else if (sh.type === "rect") {
      if (x >= sh.x && x <= sh.x + sh.w && y >= sh.y && y <= sh.y + sh.h) return sh;
    } else if (sh.type === "circle") {
      if (Math.hypot(x - sh.cx, y - sh.cy) <= sh.r + 4) return sh;
    } else if (sh.type === "stamp") {
      if (x >= sh.x && x <= sh.x + sh.w && y >= sh.y && y <= sh.y + sh.h) return sh;
    }
  }
  return null;
}

function translateShape(sh: Shape, dx: number, dy: number): Shape {
  if (sh.type === "line") {
    return { ...sh, points: sh.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  }
  if (sh.type === "rect") return { ...sh, x: sh.x + dx, y: sh.y + dy };
  if (sh.type === "circle") return { ...sh, cx: sh.cx + dx, cy: sh.cy + dy };
  if (sh.type === "stamp") return { ...sh, x: sh.x + dx, y: sh.y + dy };
  return sh;
}

function scaleShape(sh: Shape, factor: number): Shape {
  if (sh.type === "line") {
    if (sh.points.length === 0) return sh;
    const cx = sh.points.reduce((a, p) => a + p.x, 0) / sh.points.length;
    const cy = sh.points.reduce((a, p) => a + p.y, 0) / sh.points.length;
    return { ...sh, points: sh.points.map((p) => ({ x: cx + (p.x - cx) * factor, y: cy + (p.y - cy) * factor })) };
  }
  if (sh.type === "rect") {
    const cx = sh.x + sh.w / 2;
    const cy = sh.y + sh.h / 2;
    const nw = sh.w * factor;
    const nh = sh.h * factor;
    return { ...sh, x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
  }
  if (sh.type === "circle") return { ...sh, r: sh.r * factor };
  if (sh.type === "stamp") {
    const cx = sh.x + sh.w / 2;
    const cy = sh.y + sh.h / 2;
    const nw = sh.w * factor;
    const nh = sh.h * factor;
    return { ...sh, x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
  }
  return sh;
}

function shapeLabel(sh: Shape): string {
  if (sh.type === "line") return "Trazo";
  if (sh.type === "rect") return "Cuadrado";
  if (sh.type === "circle") return "Círculo";
  if (sh.type === "stamp") return "Pieza";
  return "";
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

// ---------------- Sub-components ----------------

function ToolBtn({ icon, active, onPress, label }: { icon: any; active: boolean; onPress: () => void; label: string }) {
  return (
    <TouchableOpacity
      testID={`tool-${label}`}
      style={[s.toolBtn, active && s.toolBtnActive]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={active ? "#fff" : COLORS.navy} />
      <Text style={[s.toolBtnLabel, active && { color: "#fff" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StampPicker({
  visible, stamps, currentId, onSelect, onClose,
}: { visible: boolean; stamps: StampItem[]; currentId: string | null; onSelect: (s: StampItem) => void; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalRoot}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Piezas</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={26} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.stampGrid}>
            {stamps.map((st) => {
              const active = st.id === currentId;
              return (
                <TouchableOpacity
                  key={st.id}
                  testID={`stamp-opt-${st.id}`}
                  style={[s.stampCell, active && s.stampCellActive]}
                  onPress={() => onSelect(st)}
                >
                  <View style={s.stampPreview}>
                    <StampPreview stamp={st} size={60} />
                  </View>
                  <Text style={s.stampName} numberOfLines={1}>{st.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function StampPreview({ stamp, size }: { stamp: StampItem; size: number }) {
  if (stamp.icon_key) {
    const b = BUILTIN_STAMPS[stamp.icon_key];
    if (!b) return null;
    const info = b.render(size);
    return (
      <Svg width={size} height={size} viewBox={info.viewBox}>
        {info.paths.map((p, i) => (
          <Path key={i} d={p.d}
            stroke={p.stroke || COLORS.navy}
            strokeWidth={p.strokeWidth || 2}
            fill={p.fill || "none"}
          />
        ))}
        {(info.circles || []).map((c, i) => (
          <Circle key={`c${i}`} cx={c.cx} cy={c.cy} r={c.r}
            stroke={c.stroke || COLORS.navy}
            strokeWidth={c.strokeWidth || 2}
            fill={c.fill || "none"}
          />
        ))}
      </Svg>
    );
  }
  if (stamp.image_base64) {
    return (
      <Svg width={size} height={size}>
        <SvgImage width={size} height={size} href={stamp.image_base64} preserveAspectRatio="xMidYMid meet" />
      </Svg>
    );
  }
  return null;
}

function StampManager({
  visible, stamps, onClose, onRefresh,
}: { visible: boolean; stamps: StampItem[]; onClose: () => void; onRefresh: () => Promise<void> }) {
  const [newName, setNewName] = useState("");
  const [newImageBase64, setNewImageBase64] = useState("");
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setNewImageBase64(reader.result as string);
        reader.readAsDataURL(file);
      };
      input.click();
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permiso denegado", "Necesitamos acceso a tu galería");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.9,
        base64: true,
      });
      if (res.canceled || !res.assets?.[0]?.base64) return;
      const asset = res.assets[0];
      const mime = asset.mimeType || "image/jpeg";
      setNewImageBase64(`data:${mime};base64,${asset.base64}`);
    }
  };

  const create = async () => {
    if (!newName.trim() || !newImageBase64) {
      Alert.alert("Error", "Introduce nombre e imagen");
      return;
    }
    setSaving(true);
    try {
      await api.createStamp({ name: newName.trim(), image_base64: newImageBase64 });
      setNewName(""); setNewImageBase64("");
      await onRefresh();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = (s: StampItem) => {
    Alert.alert("Eliminar sello", `¿Eliminar "${s.name}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar", style: "destructive",
        onPress: async () => {
          try {
            await api.deleteStamp(s.id);
            await onRefresh();
          } catch (e: any) { Alert.alert("Error", e.message); }
        },
      },
    ]);
  };

  const customs = stamps.filter((s) => !s.is_builtin);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalRoot}>
        <View style={[s.modalCard, { maxHeight: "90%" }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Gestionar sellos</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={26} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <ScrollView>
            <Text style={s.mLabel}>Subir nueva pieza</Text>
            <TextInput
              style={s.mInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Nombre de la pieza"
              placeholderTextColor={COLORS.textDisabled}
            />
            <TouchableOpacity style={s.uploadBtn} onPress={pickImage}>
              <Ionicons name="cloud-upload-outline" size={20} color={COLORS.primary} />
              <Text style={{ color: COLORS.primary, fontWeight: "700" }}>
                {newImageBase64 ? "Imagen cargada ✓" : "Seleccionar imagen PNG/JPG"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.primary, saving && { opacity: 0.6 }]}
              onPress={create}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>AÑADIR PIEZA</Text>}
            </TouchableOpacity>

            <Text style={[s.mLabel, { marginTop: 24 }]}>Piezas personalizadas ({customs.length})</Text>
            {customs.length === 0 ? (
              <Text style={{ color: COLORS.textSecondary, padding: 12 }}>Ninguna pieza subida todavía.</Text>
            ) : (
              customs.map((st) => (
                <View key={st.id} style={s.customRow}>
                  <View style={s.stampPreviewSm}>
                    <StampPreview stamp={st} size={40} />
                  </View>
                  <Text style={{ flex: 1, fontWeight: "700", color: COLORS.text }}>{st.name}</Text>
                  <TouchableOpacity onPress={() => remove(st)} style={{ padding: 8 }}>
                    <Ionicons name="trash-outline" size={20} color={COLORS.errorText} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 4, paddingVertical: 8, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  saveBackBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, height: 40, borderRadius: 10,
    backgroundColor: COLORS.primary, marginLeft: 4,
  },
  saveBackBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 0.3 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  headerSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  toolbar: {
    maxHeight: TOOLBAR_H, minHeight: TOOLBAR_H,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  toolBtn: {
    alignItems: "center", justifyContent: "center", gap: 2,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    minWidth: 56, height: 52, backgroundColor: COLORS.bg,
  },
  toolBtnActive: { backgroundColor: COLORS.primary },
  toolBtnLabel: { fontSize: 10, fontWeight: "700", color: COLORS.navy, letterSpacing: 0.3 },
  sizeRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: COLORS.surface, paddingHorizontal: 12, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  sizeLabel: { fontSize: 12, fontWeight: "700", color: COLORS.textSecondary },
  sizeBtns: { flexDirection: "row", gap: 6, flex: 1, justifyContent: "flex-end" },
  sizeChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: COLORS.bg,
  },
  sizeChipActive: { backgroundColor: COLORS.primary },
  sizeChipText: { fontSize: 12, fontWeight: "800", color: COLORS.navy },
  canvasWrap: { flex: 1, padding: 4, backgroundColor: COLORS.bg },
  canvasPaper: {
    flex: 1, backgroundColor: "#fff",
    borderRadius: 4, borderWidth: 1, borderColor: COLORS.border,
    overflow: "hidden",
  },
  bottomBar: {
    minHeight: BOTTOM_H,
    padding: 14, paddingBottom: 20, backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  hintText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: "600", textAlign: "center" },
  selectedRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  selectedLabel: { color: COLORS.text, fontWeight: "700", fontSize: 14 },
  btnIconSm: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center",
  },
  modalRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalCard: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 32, maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  stampGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, padding: 4 },
  stampCell: {
    width: "30%", minWidth: 90, alignItems: "center", padding: 10, gap: 4,
    backgroundColor: COLORS.bg, borderRadius: 12, borderWidth: 2, borderColor: "transparent",
  },
  stampCellActive: { borderColor: COLORS.primary },
  stampPreview: {
    width: 70, height: 70, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center", borderRadius: 8,
  },
  stampName: { fontSize: 12, fontWeight: "700", color: COLORS.text, textAlign: "center" },
  mLabel: {
    fontSize: 11, fontWeight: "800", color: COLORS.textSecondary,
    letterSpacing: 1.2, marginTop: 14, marginBottom: 6,
  },
  mInput: {
    height: 50, backgroundColor: COLORS.bg, borderWidth: 2, borderColor: COLORS.borderInput,
    borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: COLORS.text,
  },
  uploadBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center",
    marginTop: 10, height: 50, borderRadius: 10, borderWidth: 2,
    borderColor: COLORS.primary, borderStyle: "dashed", backgroundColor: COLORS.bg,
  },
  primary: {
    height: 50, borderRadius: 12, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center", marginTop: 14,
  },
  primaryText: { color: "#fff", fontSize: 14, fontWeight: "800", letterSpacing: 1 },
  customRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 10, backgroundColor: COLORS.bg, borderRadius: 10, marginBottom: 6,
  },
  stampPreviewSm: {
    width: 50, height: 50, backgroundColor: "#fff", borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
});
