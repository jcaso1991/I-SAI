import { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
  ActivityIndicator, PanResponder, Modal, TextInput, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { G, Path, Rect, Circle, SvgXml, Image as SvgImage, Text as SvgText, Line as SvgLine } from "react-native-svg";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { api, COLORS } from "../../src/api";
import { BUILTIN_STAMPS, STAMP_STROKE, CATEGORY_ORDER } from "../../src/stamps";
import { captureCanvasJpegBase64, captureCanvasPngBase64, shareOrDownloadBase64 } from "../../src/canvasCapture";
import { useBreakpoint } from "../../src/useBreakpoint";
import SignaturePad from "../../src/SignaturePad";

type Pt = { x: number; y: number };
type LineShape = { id: string; type: "line"; points: Pt[]; stroke: string; strokeWidth: number; rotation?: number };
type RectShape = { id: string; type: "rect"; x: number; y: number; w: number; h: number; stroke: string; strokeWidth: number; fill: string; rotation?: number };
type CircleShape = { id: string; type: "circle"; cx: number; cy: number; r: number; stroke: string; strokeWidth: number; fill: string; rotation?: number };
type StraightLineShape = { id: string; type: "straight"; x1: number; y1: number; x2: number; y2: number; stroke: string; strokeWidth: number; rotation?: number };
type TextShape = { id: string; type: "text"; x: number; y: number; text: string; fontSize: number; color: string; rotation?: number };
type StampShape = {
  id: string; type: "stamp"; x: number; y: number; w: number; h: number;
  stampId: string; icon_key?: string; image_base64?: string; rotation?: number;
  color?: string;
};
type Shape = LineShape | RectShape | CircleShape | StraightLineShape | TextShape | StampShape;

type Tool = "pencil" | "straight" | "rect" | "circle" | "text" | "stamp" | "signature" | "eraser" | "select";
type StampItem = { id: string; name: string; is_builtin: boolean; image_base64?: string | null; icon_key?: string | null };

// Color palette for drawing tools (stroke color)
const PALETTE: { name: string; value: string }[] = [
  { name: "Negro", value: "#0F172A" },
  { name: "Rojo", value: "#EF4444" },
  { name: "Naranja", value: "#F59E0B" },
  { name: "Amarillo", value: "#EAB308" },
  { name: "Verde", value: "#22C55E" },
  { name: "Turquesa", value: "#14B8A6" },
  { name: "Azul", value: "#1E88E5" },
  { name: "Morado", value: "#A855F7" },
  { name: "Rosa", value: "#EC4899" },
  { name: "Blanco", value: "#FFFFFF" },
];

const STROKE_WIDTHS: { label: string; value: number }[] = [
  { label: "Fino", value: 2 },
  { label: "Medio", value: 4 },
  { label: "Grueso", value: 6 },
];

// Convert hex color to rgba with alpha for rect/circle fills
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return `rgba(30,136,229,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const TOOLBAR_H = 64;
const BOTTOM_H = 84;

export default function PlanEditor() {
  const { id, export: exportParam } = useLocalSearchParams<{ id: string; export?: string }>();
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const autoExportRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [background, setBackground] = useState<{ data_uri: string; width: number; height: number } | null>(null);
  const [bgUploading, setBgUploading] = useState(false);
  const [tool, setTool] = useState<Tool>("pencil");
  const [currentStampId, setCurrentStampId] = useState<string | null>("builtin_door");
  const [size, setSize] = useState(80);
  const [strokeColor, setStrokeColor] = useState<string>(PALETTE[0].value);
  const [strokeW, setStrokeW] = useState<number>(STROKE_WIDTHS[0].value);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Sub-mode used when the Seleccionar tool is active:
  //   - "individual": each tap toggles a shape in/out of the selection set
  //   - "area": drag paints a marquee rectangle; on release every shape
  //     whose center is inside the rect is added to the selection.
  const [selectMode, setSelectMode] = useState<"individual" | "area">("individual");
  // Marquee rect while the user is dragging (in canvas coordinates).
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  // Mirror of `marquee` kept in a ref so handlers captured inside the
  // useMemo-wrapped PanResponder always read the freshest rect, even if
  // the PanResponder closure is stale.
  const marqueeRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  // What kind of drag is in progress in the Seleccionar tool: translate
  // the whole group, or draw a marquee. Null when idle.
  const dragKindRef = useRef<"group" | "marquee" | null>(null);

  // Derived helpers for single-selection paths that existed before multi.
  const selectedId = selectedIds.length > 0 ? selectedIds[0] : null;
  const clearSelection = () => setSelectedIds([]);
  const selectSingle = (id: string) => setSelectedIds([id]);
  const toggleInSelection = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const [stamps, setStamps] = useState<StampItem[]>([]);
  const [showStampPicker, setShowStampPicker] = useState(false);
  const [showStampManager, setShowStampManager] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [me, setMe] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 1000, h: 1000 });
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [zoom, setZoomState] = useState(1);
  const MIN_ZOOM = 0.15;
  const MAX_ZOOM = 5;
  const ZOOM_STEP = 0.1;
  const zoomRef = useRef(1);
  const setZoom = (z: number) => {
    const clamped = Math.round(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z)) * 100) / 100;
    zoomRef.current = clamped;
    setZoomState(clamped);
  };

  const [canvasRotation, setCanvasRotation] = useState<0 | 90>(0);
  const rotationRef = useRef<0 | 90>(0);

  // Convert screen touch coords → canvas coords accounting for zoom and rotation.
  // Web uses physical size (canvasSize * zoom), native uses CSS transform scale.
  const toCanvasCoords = (sx: number, sy: number): Pt => {
    const z = zoomRef.current;
    const r = rotationRef.current;
    const cw = canvasSize.w;
    const ch = canvasSize.h;
    const scale = Platform.OS === "web" ? z : 1;
    if (r === 0) return { x: sx / scale, y: sy / scale };
    if (r === 90) {
      return { x: sy / scale, y: (ch - sx / scale) };
    }
    return { x: sx / scale, y: sy / scale };
  };

  // Native wheel event listener for zoom (needs passive: false to preventDefault)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    let node: HTMLElement | null = null;
    let cleanup: (() => void) | null = null;
    const tryAttach = () => {
      const el = canvasRef.current as any;
      if (el instanceof HTMLElement) {
        node = el;
      } else if (el?._nativeTag) {
        node = document.getElementById(el._nativeTag);
      }
      if (node) {
        const handler = (e: WheelEvent) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            e.stopPropagation();
            const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
            const newZoom = Math.round(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomRef.current + delta)) * 100) / 100;
            if (newZoom === zoomRef.current) return;
            const scrollEl = scrollRef.current as HTMLElement | null;
            if (scrollEl) {
              const rect = scrollEl.getBoundingClientRect();
              const cx = e.clientX - rect.left + scrollEl.scrollLeft;
              const cy = e.clientY - rect.top + scrollEl.scrollTop;
              const ratio = newZoom / zoomRef.current;
              zoomRef.current = newZoom;
              setZoomState(newZoom);
              requestAnimationFrame(() => {
                scrollEl.scrollLeft = cx * ratio - (e.clientX - rect.left);
                scrollEl.scrollTop = cy * ratio - (e.clientY - rect.top);
              });
            } else {
              zoomRef.current = newZoom;
              setZoomState(newZoom);
            }
          }
        };
        node.addEventListener("wheel", handler, { passive: false });
        cleanup = () => node?.removeEventListener("wheel", handler);
      }
    };
    tryAttach();
    if (!node) {
      const t = setTimeout(tryAttach, 100);
      return () => { clearTimeout(t); if (cleanup) cleanup(); };
    }
    return () => { if (cleanup) cleanup(); };
  }, []);
  const [textModal, setTextModal] = useState<{ x: number; y: number; editingId?: string } | null>(null);
  const [textDraft, setTextDraft] = useState("");
  const [textFontSize, setTextFontSize] = useState<number>(18);

  const canvasRef = useRef<View>(null);
  const scrollRef = useRef<any>(null);
  const saveTimer = useRef<any>(null);
  const currentDrawingRef = useRef<Shape | null>(null);
  const lastDragRef = useRef<Pt | null>(null);
  const pinchRef = useRef<{ startDist: number; baseShape: Shape } | null>(null);
  const zoomPinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);

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
        if (plan.data?.background) {
          setBackground(plan.data.background);
          if (plan.data.background.width && plan.data.background.height) {
            setCanvasSize({ w: plan.data.background.width, h: plan.data.background.height });
          }
        }
        if (plan.data?.rotation) {
          const r = plan.data.rotation === 90 ? 90 : 0;
          setCanvasRotation(r as 0 | 90);
          rotationRef.current = r as 0 | 90;
        }
        setStamps(stampList);
        setMe(who);
        if (plan.source_event_id) setSourceEventId(plan.source_event_id);
        if (plan.source_attachment_id) setSourceAttachmentId(plan.source_attachment_id);
        // Extract original filename from title pattern "📐 filename.pdf"
        const m = (plan.title || "").match(/^📐\s*(.+)$/);
        if (m) setSourceFilename(m[1]);
      } catch (e: any) {
        Alert.alert("Error", e.message);
        try { if (router.canGoBack && router.canGoBack()) { router.back(); } else { router.replace("/planos"); } } catch { router.replace("/planos"); }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // One-shot auto-export: when the editor is opened from the list with
  // ?export=pdf|jpeg, fire the export right after the plan has finished
  // loading (so the canvas is mounted and sized correctly).
  useEffect(() => {
    if (loading || autoExportRef.current) return;
    if (exportParam !== "pdf" && exportParam !== "jpeg") return;
    autoExportRef.current = true;
    const format: "pdf" | "jpg" = exportParam === "pdf" ? "pdf" : "jpg";
    // Give SVG two frames to paint before capturing.
    setTimeout(() => { exportAs(format); }, 400);
  }, [loading, exportParam]);

  // Debounced autosave
  useEffect(() => {
    if (!dirty || loading) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        setSaving(true);
        await api.updatePlan(id, { data: { shapes, background, rotation: canvasRotation } });
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
      const z = zoomRef.current;
      const { x, y } = toCanvasCoords(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
      const touches = evt.nativeEvent.touches || [];
      if (touches.length >= 2) {
        const [t1, t2] = touches;
        const d = Math.hypot((t1.pageX - t2.pageX), (t1.pageY - t2.pageY));
        if (selectedId) {
          const sh = shapes.find((s) => s.id === selectedId);
          if (sh) {
            pinchRef.current = { startDist: d, baseShape: JSON.parse(JSON.stringify(sh)) };
          }
        } else {
          zoomPinchRef.current = { startDist: d, startZoom: z };
        }
        return;
      }
      handleStart(x, y);
    },
    onPanResponderMove: (evt) => {
      const z = zoomRef.current;
      const touches = evt.nativeEvent.touches || [];
      if (touches.length >= 2) {
        const [t1, t2] = touches;
        const d = Math.hypot((t1.pageX - t2.pageX), (t1.pageY - t2.pageY));
        if (pinchRef.current && selectedId) {
          const factor = d / pinchRef.current.startDist;
          const base = pinchRef.current.baseShape;
          setShapes((arr) => arr.map((sh) => {
            if (sh.id !== selectedId) return sh;
            return scaleShape(base, factor);
          }));
          markDirty();
          return;
        }
        if (zoomPinchRef.current) {
          const factor = d / zoomPinchRef.current.startDist;
          setZoom(zoomPinchRef.current.startZoom * factor);
          return;
        }
        return;
      }
      const { x, y } = toCanvasCoords(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
      handleMove(x, y);
    },
    onPanResponderRelease: () => { pinchRef.current = null; zoomPinchRef.current = null; handleEnd(); },
    onPanResponderTerminate: () => { pinchRef.current = null; zoomPinchRef.current = null; handleEnd(); },
    // NOTE: we include `selectMode`, `selectedIds`, `strokeColor` and
    // `strokeW` in the deps because the handlers read them via closure.
    // Without these deps the PanResponder captured stale values from the
    // first render and the Rectángulo / multi-select logic never fired.
  }), [tool, selectMode, currentStampId, size, selectedId, selectedIds, strokeColor, strokeW, shapes]);

  const handleStart = (x: number, y: number) => {
    if (tool === "pencil") {
      const line: LineShape = {
        id: uid(), type: "line",
        points: [{ x, y }],
        stroke: strokeColor, strokeWidth: strokeW,
      };
      currentDrawingRef.current = line;
      setShapes((s) => [...s, line]);
    } else if (tool === "rect") {
      const rect: RectShape = {
        id: uid(), type: "rect",
        x, y, w: 0, h: 0,
        stroke: strokeColor, strokeWidth: strokeW, fill: hexToRgba(strokeColor, 0.1),
      };
      currentDrawingRef.current = rect;
      setShapes((s) => [...s, rect]);
    } else if (tool === "circle") {
      const circ: CircleShape = {
        id: uid(), type: "circle",
        cx: x, cy: y, r: 0,
        stroke: strokeColor, strokeWidth: strokeW, fill: hexToRgba(strokeColor, 0.1),
      };
      currentDrawingRef.current = circ;
      setShapes((s) => [...s, circ]);
    } else if (tool === "straight") {
      // Straight line: press to fix the start, drag to stretch, release to finish.
      const ln: StraightLineShape = {
        id: uid(), type: "straight",
        x1: x, y1: y, x2: x, y2: y,
        stroke: strokeColor, strokeWidth: strokeW,
      };
      currentDrawingRef.current = ln;
      setShapes((s) => [...s, ln]);
    } else if (tool === "text") {
      // One-shot tap opens the text editor modal at the tap position.
      // (No drag — a single tap is enough to spawn text.)
      setTextDraft("");
      setTextModal({ x, y });
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
        color: strokeColor,
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
        if (selectedIds.includes(hit.id)) {
          // Already in selection: prepare to drag the whole group.
          dragKindRef.current = "group";
        } else if (selectMode === "individual") {
          // Individual mode: ADD this shape to the running selection, and
          // also arm a potential group drag (so you can place+move quickly).
          setSelectedIds((prev) => [...prev, hit.id]);
          dragKindRef.current = "group";
        } else {
          // Area mode: clicking on a shape replaces selection with just this
          // one — then drag still moves the whole (1-item) group.
          setSelectedIds([hit.id]);
          dragKindRef.current = "group";
        }
        lastDragRef.current = { x, y };
      } else {
        // Empty canvas space
        if (selectMode === "area") {
          // Start painting a marquee rectangle.
          dragKindRef.current = "marquee";
          const m0 = { x1: x, y1: y, x2: x, y2: y };
          marqueeRef.current = m0;
          setMarquee(m0);
        } else {
          clearSelection();
        }
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
    } else if (tool === "straight" && cur && cur.type === "straight") {
      cur.x2 = x;
      cur.y2 = y;
      setShapes((s) => s.map((sh) => (sh.id === cur.id ? { ...cur } : sh)));
    } else if (tool === "select" && dragKindRef.current === "group" && selectedIds.length && lastDragRef.current) {
      const dx = x - lastDragRef.current.x;
      const dy = y - lastDragRef.current.y;
      lastDragRef.current = { x, y };
      setShapes((arr) => arr.map((sh) => (selectedIds.includes(sh.id) ? translateShape(sh, dx, dy) : sh)));
    } else if (tool === "select" && dragKindRef.current === "marquee") {
      // Use a functional update so we always work with the freshest rect
      // (no stale-closure traps while the useMemo-wrapped PanResponder
      //  re-renders between renders).
      setMarquee((cur) => {
        if (!cur) return cur;
        const next = { ...cur, x2: x, y2: y };
        marqueeRef.current = next;
        return next;
      });
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
    // Finalize marquee selection in the Seleccionar tool (area mode):
    // compute final rect and ADD every shape whose center falls inside it.
    // We read the marquee from the ref (always fresh) not the captured state.
    if (tool === "select" && dragKindRef.current === "marquee" && marqueeRef.current) {
      const mq = marqueeRef.current;
      const r = {
        x1: Math.min(mq.x1, mq.x2),
        y1: Math.min(mq.y1, mq.y2),
        x2: Math.max(mq.x1, mq.x2),
        y2: Math.max(mq.y1, mq.y2),
      };
      const big = Math.abs(r.x2 - r.x1) > 4 && Math.abs(r.y2 - r.y1) > 4;
      if (big) {
        const inside = shapes
          .filter((sh) => {
            const c = shapeCenter(sh);
            return c.x >= r.x1 && c.x <= r.x2 && c.y >= r.y1 && c.y <= r.y2;
          })
          .map((sh) => sh.id);
        setSelectedIds((prev) => Array.from(new Set([...prev, ...inside])));
      }
      marqueeRef.current = null;
      setMarquee(null);
      dragKindRef.current = null;
      lastDragRef.current = null;
      return;
    }
    if (cur) {
      // normalize rect so w,h positive
      if (cur.type === "rect") {
        if (cur.w < 0) { cur.x += cur.w; cur.w = -cur.w; }
        if (cur.h < 0) { cur.y += cur.h; cur.h = -cur.h; }
        setShapes((s) => s.map((sh) => (sh.id === cur.id ? { ...cur } : sh)));
      }
      // Discard degenerate straight lines (user just tapped without dragging).
      if (cur.type === "straight") {
        if (Math.hypot(cur.x2 - cur.x1, cur.y2 - cur.y1) < 4) {
          setShapes((s) => s.filter((sh) => sh.id !== cur.id));
          currentDrawingRef.current = null;
          lastDragRef.current = null;
          dragKindRef.current = null;
          return;
        }
      }
      markDirty();
    }
    // Commit a group-drag move (if any).
    if (tool === "select" && dragKindRef.current === "group") {
      markDirty();
    }
    currentDrawingRef.current = null;
    lastDragRef.current = null;
    dragKindRef.current = null;
  };

  // ---------------- Selected shape actions ----------------
  // When exactly ONE shape is selected we expose it as `selectedShape` so
  // the existing single-item UI keeps working (text-edit button, label, …).
  // Helpers below always iterate over the full `selectedIds` set so they
  // work on multi-selection seamlessly.
  const selectedShape = selectedIds.length === 1
    ? shapes.find((s) => s.id === selectedIds[0]) || null
    : null;

  const resizeSelected = (factor: number) => {
    if (selectedIds.length === 0) return;
    setShapes((arr) => arr.map((sh) => (selectedIds.includes(sh.id) ? scaleShape(sh, factor) : sh)));
    markDirty();
  };

  const deleteSelected = () => {
    if (selectedIds.length === 0) return;
    setShapes((s) => s.filter((sh) => !selectedIds.includes(sh.id)));
    clearSelection();
    markDirty();
  };

  const recolorSelected = (color: string) => {
    if (selectedIds.length === 0) return;
    setShapes((arr) => arr.map((sh) => {
      if (!selectedIds.includes(sh.id)) return sh;
      if (sh.type === "line") return { ...sh, stroke: color };
      if (sh.type === "rect") return { ...sh, stroke: color, fill: hexToRgba(color, 0.1) };
      if (sh.type === "circle") return { ...sh, stroke: color, fill: hexToRgba(color, 0.1) };
      if (sh.type === "straight") return { ...sh, stroke: color };
      if (sh.type === "text") return { ...sh, color };
      if (sh.type === "stamp") return { ...sh, color };
      return sh;
    }));
    markDirty();
  };

  const rotateSelected = (deltaDeg: number) => {
    if (selectedIds.length === 0) return;
    setShapes((arr) => arr.map((sh) => {
      if (!selectedIds.includes(sh.id)) return sh;
      const cur = sh.rotation || 0;
      let next = deltaDeg === 0 ? 0 : cur + deltaDeg;
      if (next > 180) next -= 360;
      if (next < -180) next += 360;
      return { ...sh, rotation: next } as Shape;
    }));
    markDirty();
  };

  // Commit the text-modal draft: either create a new TextShape at (x,y)
  // or, if editingId is set, update the existing one in place.
  const commitText = () => {
    if (!textModal) return;
    const t = textDraft.trim();
    if (!t) {
      setTextModal(null);
      setTextDraft("");
      return;
    }
    if (textModal.editingId) {
      setShapes((arr) => arr.map((sh) => {
        if (sh.id !== textModal.editingId) return sh;
        if (sh.type !== "text") return sh;
        return { ...sh, text: t, fontSize: textFontSize, color: strokeColor };
      }));
    } else {
      const ts: TextShape = {
        id: uid(), type: "text",
        x: textModal.x, y: textModal.y,
        text: t, fontSize: textFontSize, color: strokeColor,
      };
      setShapes((s) => [...s, ts]);
    }
    markDirty();
    setTextModal(null);
    setTextDraft("");
  };

  const clearAll = () => {
    Alert.alert("Limpiar todo", "¿Seguro que quieres borrar todo el plano?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar", style: "destructive",
        onPress: () => { setShapes([]); clearSelection(); markDirty(); },
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
      if (bg.width && bg.height) {
        setCanvasSize({ w: bg.width, h: bg.height });
      }
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

  /**
   * Compute optimal capture dimensions to preserve original quality.
   * - If a background image/PDF exists, capture at its native resolution
   *   (capped at 5000px on the longest side to avoid memory issues).
   * - Otherwise capture at the canvas display size.
   * Shapes are vector and re-rasterise crisply at any size.
   */
  const computeCaptureSize = () => {
    const MAX_DIM = 5000;
    if (background?.width && background?.height) {
      const bw = background.width;
      const bh = background.height;
      const aspect = bw / bh;
      let capW = bw;
      let capH = bh;
      if (Math.max(bw, bh) > MAX_DIM) {
        if (bw >= bh) {
          capW = MAX_DIM;
          capH = Math.round(MAX_DIM / aspect);
        } else {
          capH = MAX_DIM;
          capW = Math.round(MAX_DIM * aspect);
        }
      }
      return { w: capW, h: capH };
    }
    return { w: canvasSize.w, h: canvasSize.h };
  };

  const exportAs = async (format: "jpg" | "pdf") => {
    try {
      clearSelection();
      await new Promise((r) => setTimeout(r, 100));
      const cap = computeCaptureSize();
      if (format === "jpg") {
        const jpgBase64 = await captureCanvasJpegBase64(canvasRef, {
          quality: 0.98,
          width: cap.w,
          height: cap.h,
        });
        const baseName = safeFilename(title);
        await shareOrDownloadBase64(jpgBase64, "image/jpeg", `${baseName}.jpg`);
      } else {
        const pngBase64 = await captureCanvasPngBase64(canvasRef, {
          width: cap.w,
          height: cap.h,
        });
        const baseName = safeFilename(title);
        const pdfBase64 = await api.imageToPdfBase64(pngBase64, "image/png");
        await shareOrDownloadBase64(pdfBase64, "application/pdf", `${baseName}.pdf`);
      }
    } catch (e: any) {
      Alert.alert("Error al exportar", e.message || String(e));
    }
  };

  const saveBackToEvent = async (andGoBack?: boolean) => {
    if (!sourceEventId || !sourceAttachmentId) return;
    try {
      clearSelection();
      await new Promise((r) => setTimeout(r, 100));

      // 1) Capture canvas at original background resolution.
      //    Use PNG (lossless) for PDFs, JPEG for images.
      const cap = computeCaptureSize();
      const baseName = safeFilename(sourceFilename || title);
      const isPdf = (sourceFilename || "").toLowerCase().endsWith(".pdf");

      let uploadBase64: string;
      let mimeType: "image/jpeg" | "application/pdf";
      let finalFilename: string;

      if (isPdf) {
        const pngBase64 = await captureCanvasPngBase64(canvasRef, {
          width: cap.w,
          height: cap.h,
        });
        uploadBase64 = await api.imageToPdfBase64(pngBase64, "image/png");
        mimeType = "application/pdf";
        finalFilename = baseName.endsWith(".pdf") ? baseName : `${baseName}.pdf`;
      } else {
        uploadBase64 = await captureCanvasJpegBase64(canvasRef, {
          quality: 0.98,
          width: cap.w,
          height: cap.h,
        });
        mimeType = "image/jpeg";
        finalFilename = baseName.endsWith(".jpg") || baseName.endsWith(".jpeg")
          ? baseName
          : `${baseName}.jpg`;
      }

      // 2) Save current shapes state to the plan
      try {
        await api.updatePlan(id, { data: { shapes, ...(background ? { background } : {}), rotation: canvasRotation } } as any);
      } catch {}

      // 3) Upload new attachment FIRST (to avoid losing data if delete succeeds but upload fails)
      const newAtt = await api.uploadEventAttachment(sourceEventId, {
        filename: finalFilename,
        mime_type: mimeType,
        base64: uploadBase64,
      });

      // 4) Delete old attachment (best-effort)
      try {
        await api.deleteEventAttachment(sourceEventId, sourceAttachmentId);
      } catch (err) {
        console.warn("Could not delete old attachment:", err);
      }

      // 5) Update plan source_attachment_id so subsequent saves replace the new one
      try {
        await api.updatePlan(id, { source_attachment_id: newAtt.id } as any);
      } catch {}
      setSourceAttachmentId(newAtt.id);

      if (andGoBack) {
        // Navigate back to calendar and request to open the event
        router.replace({ pathname: "/calendario", params: { openEvent: sourceEventId } });
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
        <TouchableOpacity style={s.iconBtn} onPress={() => {
          try { if (router.canGoBack && router.canGoBack()) { router.back(); return; } } catch {}
          router.replace("/planos");
        }}>
          <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
          <Text style={s.headerSub}>{saving ? "Guardando..." : dirty ? "Sin guardar" : "Guardado"}</Text>
        </View>
        <TouchableOpacity testID="btn-export-jpg" style={s.iconBtn} onPress={() => exportAs("jpg")}>
          <Ionicons name="image-outline" size={22} color={COLORS.navy} />
        </TouchableOpacity>
        <TouchableOpacity testID="btn-export-pdf" style={s.iconBtn} onPress={() => exportAs("pdf")}>
          <Ionicons name="document-outline" size={22} color={COLORS.navy} />
        </TouchableOpacity>
        <TouchableOpacity
          testID="btn-rotate"
          style={[s.iconBtn,           canvasRotation === 90 && { backgroundColor: COLORS.primarySoft, borderWidth: 2, borderColor: COLORS.primary }]}
          onPress={() => {
            const next = canvasRotation === 0 ? 90 as const : 0 as const;
            rotationRef.current = next;
            setCanvasRotation(next);
          }}
        >
          <Ionicons name="phone-landscape-outline" size={22} color={canvasRotation === 90 ? COLORS.primary : COLORS.navy} />
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

      {/* Toolbar — collapsible on mobile for cleaner view */}
      {!isWide && (
        <TouchableOpacity
          testID="btn-toggle-toolbar"
          style={s.toolbarToggle}
          onPress={() => setToolbarOpen((v) => !v)}
        >
          <Ionicons name={toolbarOpen ? "chevron-up" : "hammer-outline"} size={18} color={COLORS.primary} />
          <Text style={s.toolbarToggleText}>
            {toolbarOpen ? "Ocultar herramientas" : `Herramientas · ${tool === "stamp" ? (currentStamp?.name || "Pieza") : tool.charAt(0).toUpperCase() + tool.slice(1)}`}
          </Text>
          {!toolbarOpen && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: strokeColor }} />}
        </TouchableOpacity>
      )}
      {(isWide || toolbarOpen) && (
      isWide ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.toolbar}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 12, alignItems: "center" }}
        >
          <ToolBtn icon="pencil" active={tool === "pencil"} onPress={() => { setTool("pencil"); clearSelection(); }} label="Lápiz" />
          <ToolBtn icon="remove-outline" active={tool === "straight"} onPress={() => { setTool("straight"); clearSelection(); }} label="Línea" />
          <ToolBtn icon="square-outline" active={tool === "rect"} onPress={() => { setTool("rect"); clearSelection(); }} label="Cuadro" />
          <ToolBtn icon="ellipse-outline" active={tool === "circle"} onPress={() => { setTool("circle"); clearSelection(); }} label="Círculo" />
          <ToolBtn icon="text" active={tool === "text"} onPress={() => { setTool("text"); clearSelection(); }} label="Texto" />
          <ToolBtn icon="create" active={false} onPress={() => { setShowSignatureModal(true); }} label="Firma" />
          <ToolBtn icon="cube" active={tool === "stamp"} onPress={() => { setTool("stamp"); clearSelection(); setShowStampPicker(true); }} label={currentStamp?.name || "Pieza"} />
          <ToolBtn icon="trash-outline" active={tool === "eraser"} onPress={() => { setTool("eraser"); clearSelection(); }} label="Borrar" />
          <ToolBtn icon="hand-left-outline" active={tool === "select"} onPress={() => { setTool("select"); }} label="Seleccionar" />
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
      ) : (
        <View style={s.toolDropdown}>
          {[
            { icon: "pencil", tool: "pencil" as Tool, label: "Lápiz" },
            { icon: "remove-outline", tool: "straight" as Tool, label: "Línea" },
            { icon: "square-outline", tool: "rect" as Tool, label: "Cuadro" },
            { icon: "ellipse-outline", tool: "circle" as Tool, label: "Círculo" },
            { icon: "text", tool: "text" as Tool, label: "Texto" },
            { icon: "create", tool: "signature" as Tool, label: "Firma" },
            { icon: "cube", tool: "stamp" as Tool, label: currentStamp?.name || "Pieza" },
            { icon: "trash-outline", tool: "eraser" as Tool, label: "Borrar" },
            { icon: "hand-left-outline", tool: "select" as Tool, label: "Seleccionar" },
          ].map(({ icon, tool: t, label }) => (
            <TouchableOpacity
              key={t}
              testID={`tool-${label}`}
              style={[s.toolDropdownItem, tool === t && s.toolDropdownItemActive]}
              onPress={() => {
                if (t === "stamp") { setTool("stamp"); setShowStampPicker(true); }
                else { setTool(t); }
                if (t !== "select") clearSelection();
                setToolbarOpen(false);
              }}
            >
              <View style={[s.toolDropdownIcon, tool === t && { backgroundColor: COLORS.primary }]}>
                <Ionicons name={icon as any} size={18} color={tool === t ? "#fff" : COLORS.navy} />
              </View>
              <Text style={[s.toolDropdownItemText, tool === t && { color: COLORS.primary, fontWeight: "800" }]}>{label}</Text>
              {tool === t && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
            </TouchableOpacity>
          ))}
          <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 4 }} />
          <TouchableOpacity style={s.toolDropdownItem} onPress={() => { background ? removeBackground() : pickBackground(); setToolbarOpen(false); }}>
            <View style={s.toolDropdownIcon}>
              <Ionicons name={background ? "close-circle" : "image"} size={18} color={background ? COLORS.errorText : COLORS.primary} />
            </View>
            <Text style={[s.toolDropdownItemText, { color: background ? COLORS.errorText : COLORS.primary }]}>{background ? "Quitar fondo" : "Añadir fondo"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.toolDropdownItem} onPress={() => { clearAll(); setToolbarOpen(false); }}>
            <View style={s.toolDropdownIcon}>
              <Ionicons name="refresh" size={18} color={COLORS.errorText} />
            </View>
            <Text style={[s.toolDropdownItemText, { color: COLORS.errorText }]}>Limpiar todo</Text>
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity style={s.toolDropdownItem} onPress={() => { setShowStampManager(true); setToolbarOpen(false); }}>
              <View style={s.toolDropdownIcon}>
                <Ionicons name="add-circle" size={18} color={COLORS.primary} />
              </View>
              <Text style={[s.toolDropdownItemText, { color: COLORS.primary }]}>Gestionar sellos</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {/* Sub-toolbar for the Seleccionar tool: choose between tapping
          individual shapes or painting a marquee rectangle. */}
      {tool === "select" && (
        <View style={s.subToolbar}>
          <Text style={s.subToolLabel}>Modo</Text>
          <TouchableOpacity
            testID="selmode-individual"
            style={[s.subChip, selectMode === "individual" && s.subChipActive]}
            onPress={() => setSelectMode("individual")}
          >
            <Ionicons
              name="finger-print-outline"
              size={16}
              color={selectMode === "individual" ? "#fff" : COLORS.text}
            />
            <Text style={[s.subChipText, selectMode === "individual" && { color: "#fff" }]}>Individual</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="selmode-area"
            style={[s.subChip, selectMode === "area" && s.subChipActive]}
            onPress={() => setSelectMode("area")}
          >
            <Ionicons
              name="scan-outline"
              size={16}
              color={selectMode === "area" ? "#fff" : COLORS.text}
            />
            <Text style={[s.subChipText, selectMode === "area" && { color: "#fff" }]}>Rectángulo</Text>
          </TouchableOpacity>
          {selectedIds.length > 0 && (
            <TouchableOpacity
              testID="btn-clear-selection"
              style={[s.subChip, { marginLeft: "auto", backgroundColor: COLORS.errorBg }]}
              onPress={clearSelection}
            >
              <Ionicons name="close" size={16} color={COLORS.errorText} />
              <Text style={[s.subChipText, { color: COLORS.errorText }]}>
                Limpiar selección ({selectedIds.length})
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Color + stroke-width row: applies to pencil/rect/circle/stamp.
          If a shape is selected, tapping a color recolors it; otherwise it becomes the default for new drawings. */}
      <View style={s.palette}>
        <Text style={s.paletteLabel}>
          {selectedIds.length > 0 ? `Color selección (${selectedIds.length})` : "Color"}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: "center" }}>
          {PALETTE.map((c) => {
            const active = (selectedShape
              ? (selectedShape.type === "stamp" ? selectedShape.color : (selectedShape as any).stroke) === c.value
              : strokeColor === c.value);
            return (
              <TouchableOpacity
                key={c.value}
                testID={`color-${c.value}`}
                onPress={() => {
                  if (selectedIds.length > 0) {
                    // Apply to every selected shape (works for single or many).
                    recolorSelected(c.value);
                  }
                  setStrokeColor(c.value);
                }}
                style={[
                  s.colorDot,
                  { backgroundColor: c.value },
                  c.value === "#FFFFFF" && { borderWidth: 2, borderColor: COLORS.border },
                  active && s.colorDotActive,
                ]}
              />
            );
          })}
        </ScrollView>
        <View style={s.widthGroup}>
          {STROKE_WIDTHS.map((w) => (
            <TouchableOpacity
              key={w.value}
              testID={`width-${w.value}`}
              style={[s.widthChip, strokeW === w.value && s.widthChipActive]}
              onPress={() => setStrokeW(w.value)}
            >
              <View style={[s.widthDot, { height: w.value + 1 }, strokeW === w.value && { backgroundColor: "#fff" }]} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

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
        {/* Canvas content with zoom and optional rotation */}
        <View
          ref={scrollRef}
          style={s.canvasScrollOuter}
        >
          {Platform.OS === "web" ? (
            <View
              style={{
                width: canvasRotation === 90 ? canvasSize.h * zoom : canvasSize.w * zoom,
                height: canvasRotation === 90 ? canvasSize.w * zoom : canvasSize.h * zoom,
                justifyContent: "center", alignItems: "center",
              } as any}
            >
              <View
                {...(canvasRotation === 90 ? {
                  style: { transform: "rotate(90deg)", width: canvasSize.w * zoom, height: canvasSize.h * zoom },
                } as any : {})}
              >
                <View
                  style={[s.canvasPaper, {
                    width: canvasSize.w * zoom, height: canvasSize.h * zoom,
                    backgroundColor: background ? "#FFFFFF" : COLORS.canvasPaper,
                    // Prevent browser scroll when drawing (pencil/line/rect/circle/text/stamp)
                    touchAction: tool !== "select" ? "none" : "auto",
                  } as any]}
                  {...panResponder.panHandlers}
                >
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
                    {shapes.map((sh) => renderShape(sh, selectedIds.includes(sh.id)))}
                    {marquee && (
                      <Rect
                        x={Math.min(marquee.x1, marquee.x2)}
                        y={Math.min(marquee.y1, marquee.y2)}
                        width={Math.abs(marquee.x2 - marquee.x1)}
                        height={Math.abs(marquee.y2 - marquee.y1)}
                        stroke={COLORS.primary}
                        strokeWidth={1.5}
                        strokeDasharray="8 4"
                        fill={hexToRgba(COLORS.primary, 0.08)}
                      />
                    )}
                  </Svg>
                </View>
              </View>
            </View>
          ) : (
            <View
              style={[
                s.canvasPaper,
                { transform: [{ scale: zoom }, { rotate: canvasRotation === 90 ? "90deg" : "0deg" }], backgroundColor: background ? "#FFFFFF" : COLORS.canvasPaper },
              ]}
              {...panResponder.panHandlers}
            >
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
                {shapes.map((sh) => renderShape(sh, selectedIds.includes(sh.id)))}
                {marquee && (
                  <Rect
                    x={Math.min(marquee.x1, marquee.x2)}
                    y={Math.min(marquee.y1, marquee.y2)}
                    width={Math.abs(marquee.x2 - marquee.x1)}
                    height={Math.abs(marquee.y2 - marquee.y1)}
                    stroke={COLORS.primary}
                    strokeWidth={1.5}
                    strokeDasharray="8 4"
                    fill={hexToRgba(COLORS.primary, 0.08)}
                  />
                )}
              </Svg>
            </View>
          )}
        </View>

        {/* Zoom controls */}
        <View style={s.zoomControls} pointerEvents="box-none">
          <TouchableOpacity
            style={s.zoomBtn}
            onPress={() => setZoom(zoom + ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
          >
            <Ionicons name="add" size={20} color={zoom >= MAX_ZOOM ? COLORS.textDisabled : COLORS.navy} />
          </TouchableOpacity>
          <Text style={s.zoomLabel}>{Math.round(zoom * 100)}%</Text>
          <TouchableOpacity
            style={s.zoomBtn}
            onPress={() => setZoom(zoom - ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
          >
            <Ionicons name="remove" size={20} color={zoom <= MIN_ZOOM ? COLORS.textDisabled : COLORS.navy} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom bar */}
      <View style={s.bottomBar}>
        {selectedIds.length > 0 ? (
          <View style={s.selectedRow}>
            <Text style={s.selectedLabel} numberOfLines={1}>
              {selectedIds.length === 1 && selectedShape ? (
                <>
                  Selección: {shapeLabel(selectedShape)}
                  {selectedShape.rotation ? ` · ${Math.round(selectedShape.rotation)}°` : ""}
                </>
              ) : (
                <>{selectedIds.length} elementos seleccionados</>
              )}
            </Text>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {selectedShape?.type === "text" && (
                <TouchableOpacity
                  testID="btn-edit-text"
                  style={[s.btnIconSm, { paddingHorizontal: 10, flexDirection: "row", gap: 4 }]}
                  onPress={() => {
                    const sh = selectedShape as TextShape;
                    setTextDraft(sh.text);
                    setTextFontSize(sh.fontSize);
                    setTextModal({ x: sh.x, y: sh.y, editingId: sh.id });
                  }}
                >
                  <Ionicons name="create-outline" size={18} color={COLORS.primary} />
                  <Text style={{ color: COLORS.primary, fontWeight: "800", fontSize: 12 }}>Editar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity testID="btn-rot-left" style={s.btnIconSm} onPress={() => rotateSelected(-15)}>
                <Ionicons name="return-up-back" size={20} color={COLORS.navy} />
              </TouchableOpacity>
              <TouchableOpacity testID="btn-rot-right" style={s.btnIconSm} onPress={() => rotateSelected(15)}>
                <Ionicons name="return-up-forward" size={20} color={COLORS.navy} />
              </TouchableOpacity>
              <TouchableOpacity testID="btn-rot-90" style={s.btnIconSm} onPress={() => rotateSelected(90)}>
                <Text style={{ fontWeight: "800", color: COLORS.navy, fontSize: 11 }}>90°</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="btn-rot-reset" style={s.btnIconSm} onPress={() => rotateSelected(0)} disabled={!selectedShape?.rotation && selectedIds.length === 1}>
                <Ionicons name="refresh" size={18} color={COLORS.navy} />
              </TouchableOpacity>
              <View style={{ width: 1, height: 28, backgroundColor: COLORS.border, marginHorizontal: 2, alignSelf: "center" }} />
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
              : tool === "straight" ? "Pulsa para fijar inicio · arrastra y suelta para terminar la línea"
              : tool === "rect" ? "Arrastra para crear un cuadrado"
              : tool === "circle" ? "Arrastra para crear un círculo"
              : tool === "text" ? "Toca donde quieras escribir · se abrirá un teclado"
              : tool === "stamp" ? `Toca para colocar: ${currentStamp?.name || "pieza"}`
              : tool === "eraser" ? "Toca una pieza para borrarla"
              : tool === "select" ? (selectMode === "area"
                ? "Arrastra desde un espacio vacío para dibujar un rectángulo · toca una pieza para seleccionarla/moverla"
                : "Toca piezas para añadirlas a la selección · toca vacío para limpiar · arrastra una seleccionada para mover todas")
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

      {/* Signature modal */}
      <Modal visible={showSignatureModal} transparent animationType="slide" onRequestClose={() => setShowSignatureModal(false)}>
        <View style={s.modalRoot}>
          <View style={[s.modalCard, { maxHeight: "60%" }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Añadir firma</Text>
              <TouchableOpacity onPress={() => setShowSignatureModal(false)}>
                <Ionicons name="close" size={26} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <SignaturePad
              label="Firma aquí"
              onChange={(b64) => {
                if (b64) {
                  const newShape: StampShape = {
                    id: uid(), type: "stamp",
                    x: 50, y: 50, w: 220, h: 80,
                    stampId: uid(),
                    image_base64: b64,
                  };
                  setShapes((s) => [...s, newShape]);
                  markDirty();
                  setShowSignatureModal(false);
                }
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Text tool editor modal:
          opened when the user taps on the canvas with the text tool active,
          or when they press the "Editar texto" button for a selected text shape. */}
      <Modal
        visible={!!textModal}
        transparent
        animationType="fade"
        onRequestClose={() => setTextModal(null)}
      >
        <View style={s.modalRoot}>
          <View style={[s.modalCard, { maxHeight: "auto", paddingBottom: 16 }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>
                {textModal?.editingId ? "Editar texto" : "Nuevo texto"}
              </Text>
              <TouchableOpacity onPress={() => setTextModal(null)}>
                <Ionicons name="close" size={26} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              testID="text-input"
              value={textDraft}
              onChangeText={setTextDraft}
              placeholder="Escribe aquí…"
              placeholderTextColor={COLORS.textDisabled}
              autoFocus
              multiline
              style={s.textField}
              onSubmitEditing={commitText}
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12, alignItems: "center" }}>
              <Text style={{ color: COLORS.textSecondary, fontWeight: "700", fontSize: 12 }}>Tamaño</Text>
              {[14, 18, 24, 32, 48].map((fs) => (
                <TouchableOpacity
                  key={fs}
                  testID={`text-size-${fs}`}
                  onPress={() => setTextFontSize(fs)}
                  style={[s.fsChip, textFontSize === fs && s.fsChipActive]}
                >
                  <Text style={[s.fsChipText, textFontSize === fs && { color: "#fff" }]}>{fs}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 8 }}>
              El color del texto usa el color actual seleccionado en la paleta.
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: COLORS.bg }]}
                onPress={() => { setTextModal(null); setTextDraft(""); }}
              >
                <Text style={[s.modalBtnText, { color: COLORS.text }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="text-commit"
                style={[s.modalBtn, { backgroundColor: COLORS.primary }]}
                onPress={commitText}
              >
                <Text style={[s.modalBtnText, { color: "#fff" }]}>
                  {textModal?.editingId ? "Guardar" : "Añadir"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ---------------- helpers ----------------

// Geometric center of a shape (used for rotation pivot + hit-testing).
function shapeCenter(sh: Shape): Pt {
  if (sh.type === "line") {
    if (sh.points.length === 0) return { x: 0, y: 0 };
    let sx = 0, sy = 0;
    for (const p of sh.points) { sx += p.x; sy += p.y; }
    return { x: sx / sh.points.length, y: sy / sh.points.length };
  }
  if (sh.type === "rect") return { x: sh.x + sh.w / 2, y: sh.y + sh.h / 2 };
  if (sh.type === "circle") return { x: sh.cx, y: sh.cy };
  if (sh.type === "straight") return { x: (sh.x1 + sh.x2) / 2, y: (sh.y1 + sh.y2) / 2 };
  if (sh.type === "text") {
    // Approximate text bbox center based on font-size and text length.
    const w = sh.text.length * sh.fontSize * 0.55;
    return { x: sh.x + w / 2, y: sh.y - sh.fontSize / 2 };
  }
  // stamp
  return { x: sh.x + sh.w / 2, y: sh.y + sh.h / 2 };
}

function rotatePt(x: number, y: number, cx: number, cy: number, deg: number): Pt {
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  const dx = x - cx, dy = y - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

function renderShape(sh: Shape, selected: boolean) {
  const highlight = selected ? "#EF4444" : undefined;
  const rot = sh.rotation || 0;
  const c = shapeCenter(sh);
  const rotAttr = rot ? `rotate(${rot} ${c.x} ${c.y})` : undefined;
  if (sh.type === "line") {
    if (sh.points.length < 2) {
      const dot = <Circle key={sh.id} cx={sh.points[0].x} cy={sh.points[0].y} r={sh.strokeWidth / 2} fill={highlight || sh.stroke} />;
      return rotAttr ? <G key={sh.id} transform={rotAttr}>{dot}</G> : dot;
    }
    const d = sh.points.map((p, i) => (i === 0 ? `M${p.x} ${p.y}` : `L${p.x} ${p.y}`)).join(" ");
    const path = <Path d={d} stroke={highlight || sh.stroke} strokeWidth={sh.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
    return rotAttr ? <G key={sh.id} transform={rotAttr}>{path}</G> : <G key={sh.id}>{path}</G>;
  }
  if (sh.type === "rect") {
    const r = <Rect x={sh.x} y={sh.y} width={sh.w} height={sh.h} stroke={highlight || sh.stroke} strokeWidth={sh.strokeWidth} fill={sh.fill} />;
    return rotAttr ? <G key={sh.id} transform={rotAttr}>{r}</G> : <G key={sh.id}>{r}</G>;
  }
  if (sh.type === "circle") {
    // Rotation of a true circle is visually identical; still wrap for consistency.
    const cc = <Circle cx={sh.cx} cy={sh.cy} r={sh.r} stroke={highlight || sh.stroke} strokeWidth={sh.strokeWidth} fill={sh.fill} />;
    return <G key={sh.id}>{cc}</G>;
  }
  if (sh.type === "straight") {
    const ln = (
      <SvgLine
        x1={sh.x1} y1={sh.y1} x2={sh.x2} y2={sh.y2}
        stroke={highlight || sh.stroke} strokeWidth={sh.strokeWidth}
        strokeLinecap="round"
      />
    );
    return rotAttr ? <G key={sh.id} transform={rotAttr}>{ln}</G> : <G key={sh.id}>{ln}</G>;
  }
  if (sh.type === "text") {
    const textEl = (
      <SvgText
        x={sh.x} y={sh.y}
        fontSize={sh.fontSize}
        fontWeight="600"
        fill={highlight || sh.color}
        stroke="none"
      >
        {sh.text}
      </SvgText>
    );
    // Add a dashed bounding box when selected so the user can locate small labels.
    if (highlight) {
      const w = sh.text.length * sh.fontSize * 0.55;
      const h = sh.fontSize * 1.2;
      const bbox = (
        <Rect x={sh.x - 2} y={sh.y - h} width={w + 4} height={h + 4}
          stroke={highlight} strokeWidth={1} fill="none" strokeDasharray="4 3" />
      );
      return rotAttr
        ? <G key={sh.id} transform={rotAttr}>{textEl}{bbox}</G>
        : <G key={sh.id}>{textEl}{bbox}</G>;
    }
    return rotAttr ? <G key={sh.id} transform={rotAttr}>{textEl}</G> : <G key={sh.id}>{textEl}</G>;
  }
  if (sh.type === "stamp") {
    return <StampView key={sh.id} shape={sh} highlight={highlight} />;
  }
  return null;
}

function StampView({ shape, highlight }: { shape: StampShape; highlight?: string }) {
  // Resolve effective stroke/fill for a stamp path or circle:
  //  - If the user set a color on this stamp, override any path whose stroke matches STAMP_STROKE.
  //  - If fill equals STAMP_STROKE (solid accent fills), replace it too, so "solid" parts follow the chosen color.
  //  - White / transparent / explicit fills are preserved to keep contrast readable.
  const override = shape.color && shape.color !== STAMP_STROKE ? shape.color : undefined;
  const resolveStroke = (orig?: string) => highlight || (override && (!orig || orig === STAMP_STROKE) ? override : undefined) || orig || COLORS.navy;
  const resolveFill = (orig?: string) => {
    if (!orig || orig === "none") return orig || "none";
    if (override && orig === STAMP_STROKE) return override;
    return orig;
  };

  if (shape.icon_key) {
    const builtin = BUILTIN_STAMPS[shape.icon_key];
    if (!builtin) return null;
    const info = builtin.render(shape.w);
    const scaleX = shape.w / 100;
    const scaleY = shape.h / 100;
    const rot = shape.rotation || 0;
    const cx = shape.x + shape.w / 2;
    const cy = shape.y + shape.h / 2;
    // Outer rotation group pivots around the stamp center; inner group positions/scales the raw 100x100 artwork.
    const rotAttr = rot ? `rotate(${rot} ${cx} ${cy})` : "";
    return (
      <G transform={`${rotAttr} translate(${shape.x}, ${shape.y}) scale(${scaleX}, ${scaleY})`}>
        {info.paths.map((p, i) => (
          <Path key={i}
            d={p.d}
            stroke={resolveStroke(p.stroke)}
            strokeWidth={p.strokeWidth || 2}
            fill={resolveFill(p.fill)}
          />
        ))}
        {(info.circles || []).map((c, i) => (
          <Circle key={`c${i}`}
            cx={c.cx} cy={c.cy} r={c.r}
            stroke={resolveStroke(c.stroke)}
            strokeWidth={c.strokeWidth || 2}
            fill={resolveFill(c.fill)}
          />
        ))}
      </G>
    );
  }
  if (shape.image_base64) {
    const rot = shape.rotation || 0;
    const cx = shape.x + shape.w / 2;
    const cy = shape.y + shape.h / 2;
    const rotAttr = rot ? `rotate(${rot} ${cx} ${cy})` : undefined;
    return (
      <G transform={rotAttr}>
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
    // If shape is rotated, inverse-rotate the test point back into its local coordinate frame.
    let tx = x, ty = y;
    if (sh.rotation) {
      const c = shapeCenter(sh);
      const p = rotatePt(x, y, c.x, c.y, -sh.rotation);
      tx = p.x; ty = p.y;
    }
    if (sh.type === "line") {
      for (const p of sh.points) {
        if (Math.hypot(p.x - tx, p.y - ty) < 12) return sh;
      }
    } else if (sh.type === "rect") {
      if (tx >= sh.x && tx <= sh.x + sh.w && ty >= sh.y && ty <= sh.y + sh.h) return sh;
    } else if (sh.type === "circle") {
      if (Math.hypot(tx - sh.cx, ty - sh.cy) <= sh.r + 4) return sh;
    } else if (sh.type === "stamp") {
      if (tx >= sh.x && tx <= sh.x + sh.w && ty >= sh.y && ty <= sh.y + sh.h) return sh;
    } else if (sh.type === "straight") {
      // Distance from point to segment. Select if < 8px tolerance.
      const vx = sh.x2 - sh.x1, vy = sh.y2 - sh.y1;
      const wx = tx - sh.x1, wy = ty - sh.y1;
      const len2 = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
      const px = sh.x1 + t * vx, py = sh.y1 + t * vy;
      if (Math.hypot(tx - px, ty - py) < 8) return sh;
    } else if (sh.type === "text") {
      const w = sh.text.length * sh.fontSize * 0.55;
      const h = sh.fontSize * 1.2;
      // bbox: x..x+w, (y - h)..y
      if (tx >= sh.x - 2 && tx <= sh.x + w + 4 && ty >= sh.y - h - 2 && ty <= sh.y + 4) return sh;
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
  if (sh.type === "straight") return { ...sh, x1: sh.x1 + dx, y1: sh.y1 + dy, x2: sh.x2 + dx, y2: sh.y2 + dy };
  if (sh.type === "text") return { ...sh, x: sh.x + dx, y: sh.y + dy };
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
  if (sh.type === "straight") {
    const cx = (sh.x1 + sh.x2) / 2;
    const cy = (sh.y1 + sh.y2) / 2;
    return {
      ...sh,
      x1: cx + (sh.x1 - cx) * factor, y1: cy + (sh.y1 - cy) * factor,
      x2: cx + (sh.x2 - cx) * factor, y2: cy + (sh.y2 - cy) * factor,
    };
  }
  if (sh.type === "text") {
    return { ...sh, fontSize: Math.max(8, Math.round(sh.fontSize * factor)) };
  }
  return sh;
}

function shapeLabel(sh: Shape): string {
  if (sh.type === "line") return "Trazo";
  if (sh.type === "rect") return "Cuadrado";
  if (sh.type === "circle") return "Círculo";
  if (sh.type === "stamp") return "Pieza";
  if (sh.type === "straight") return "Línea";
  if (sh.type === "text") return `Texto "${sh.text.slice(0, 20)}${sh.text.length > 20 ? "…" : ""}"`;
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
  // Group stamps by category. Built-in stamps use the category defined in stamps.ts; user-uploaded stamps go to "Personalizadas".
  const groups: Record<string, StampItem[]> = {};
  for (const st of stamps) {
    let cat = "Personalizadas";
    if (st.icon_key) {
      const b = BUILTIN_STAMPS[st.icon_key];
      if (b) cat = b.category;
    }
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(st);
  }
  const orderedCats = [
    ...CATEGORY_ORDER.filter((c) => groups[c] && groups[c].length),
    ...(groups["Personalizadas"] ? ["Personalizadas"] : []),
  ];

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
          <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
            {orderedCats.map((cat) => (
              <View key={cat} style={{ marginBottom: 12 }}>
                <Text style={s.catTitle}>{cat}</Text>
                <View style={s.stampGrid}>
                  {groups[cat].map((st) => {
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
                </View>
              </View>
            ))}
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
  toolbarToggle: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  toolbarToggleText: { fontSize: 12, fontWeight: "700", color: COLORS.primary, flex: 1 },
  toolDropdown: {
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    padding: 8, gap: 2,
  },
  toolDropdownItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 9, paddingHorizontal: 8, borderRadius: 8,
  },
  toolDropdownItemActive: { backgroundColor: COLORS.primarySoft },
  toolDropdownIcon: {
    width: 34, height: 34, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.bg,
  },
  toolDropdownItemText: { fontSize: 14, fontWeight: "600", color: COLORS.navy, flex: 1 },
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
  subToolbar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: COLORS.primarySoft, paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  subToolLabel: {
    fontSize: 11, fontWeight: "800", color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  subChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  subChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  subChipText: { fontSize: 12, fontWeight: "800", color: COLORS.text },
  palette: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: COLORS.surface, paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  paletteLabel: {
    fontSize: 11, fontWeight: "800", color: COLORS.textSecondary,
    letterSpacing: 0.5, width: 110,
  },
  colorDot: {
    width: 28, height: 28, borderRadius: 14,
  },
  colorDotActive: {
    borderWidth: 3, borderColor: COLORS.primary,
    transform: [{ scale: 1.08 }],
  },
  widthGroup: {
    flexDirection: "row", gap: 4, marginLeft: 8,
    paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: COLORS.border,
  },
  widthChip: {
    width: 36, height: 28, borderRadius: 8, backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center",
  },
  widthChipActive: { backgroundColor: COLORS.primary },
  widthDot: {
    width: 22, backgroundColor: COLORS.navy, borderRadius: 3,
  },
  sizeLabel: { fontSize: 12, fontWeight: "700", color: COLORS.textSecondary },
  sizeBtns: { flexDirection: "row", gap: 6, flex: 1, justifyContent: "flex-end" },
  sizeChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: COLORS.bg,
  },
  sizeChipActive: { backgroundColor: COLORS.primary },
  sizeChipText: { fontSize: 12, fontWeight: "800", color: COLORS.navy },
  canvasWrap: { flex: 1, padding: 4, backgroundColor: COLORS.bg, overflow: "hidden", position: "relative" },
  canvasScrollOuter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({ web: { overflow: "auto" } as any, default: {} }),
  },
  canvasPaper: {
    backgroundColor: COLORS.canvasPaper,
    borderRadius: 4, borderWidth: 1, borderColor: COLORS.border,
    overflow: "hidden",
  },
  zoomControls: {
    position: "absolute", bottom: 12, right: 12,
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 4, paddingVertical: 2,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  zoomBtn: {
    width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 8,
  },
  zoomLabel: {
    fontSize: 11, fontWeight: "800", color: COLORS.navy,
    minWidth: 40, textAlign: "center",
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
  catTitle: {
    fontSize: 12, fontWeight: "900", color: COLORS.textSecondary,
    letterSpacing: 1.5, marginTop: 8, marginBottom: 4, marginLeft: 4,
    textTransform: "uppercase",
  },
  textField: {
    borderWidth: 1, borderColor: COLORS.borderInput, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    minHeight: 80, maxHeight: 160,
    fontSize: 16, color: COLORS.text, backgroundColor: COLORS.surface,
    textAlignVertical: "top",
  },
  fsChip: {
    minWidth: 36, height: 28, paddingHorizontal: 8, borderRadius: 6,
    backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center",
  },
  fsChipActive: { backgroundColor: COLORS.primary },
  fsChipText: { fontSize: 12, fontWeight: "700", color: COLORS.text },
  modalBtn: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  modalBtnText: { fontSize: 14, fontWeight: "800" },
  stampCell: {
    width: "30%", minWidth: 90, alignItems: "center", padding: 10, gap: 4,
    backgroundColor: COLORS.bg, borderRadius: 12, borderWidth: 2, borderColor: "transparent",
  },
  stampCellActive: { borderColor: COLORS.primary },
  stampPreview: {
    width: 70, height: 70, backgroundColor: COLORS.canvasPaper,
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
    width: 50, height: 50, backgroundColor: COLORS.canvasPaper, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
});
