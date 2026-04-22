import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
  ActivityIndicator, Modal, TextInput, Platform, PanResponder,
  FlatList, KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS } from "../src/api";
import BottomNav from "../src/BottomNav";
import ResponsiveLayout from "../src/ResponsiveLayout";
import { useBreakpoint } from "../src/useBreakpoint";
import DateTimeField from "../src/DateTimeField";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";

const HOUR_START = 7;
const HOUR_END = 18;
const HOURS = HOUR_END - HOUR_START;
const HOUR_H = 56;
const TIME_COL_W = 52;
const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie"];
const DAY_LABELS_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const DAY_LABELS_MONTH = ["L", "M", "X", "J", "V", "S", "D"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

type ViewMode = "day" | "week" | "month";
type Technician = { id: string; name: string; email: string };
type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

type EventT = {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  description?: string;
  material_id?: string | null;
  material?: any;
  assigned_user_ids?: string[];
  assigned_users?: { id: string; name?: string; email: string; color?: string }[];
  manager_id?: string | null;
  manager?: { id: string; name?: string; email: string; color?: string } | null;
  recurrence?: { type: RecurrenceType; until?: string | null } | null;
  attachments?: Array<{ id: string; filename: string; mime_type: string; size: number; uploaded_at?: string; uploaded_by?: string }>;
  base_event_id?: string | null;
  created_by: string;
};

// Date helpers
function mondayOf(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay() === 0 ? 7 : x.getDay();
  x.setDate(x.getDate() - (day - 1));
  x.setHours(0, 0, 0, 0);
  return x;
}
function firstOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonths(d: Date, n: number): Date { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
function sameDay(a: Date, b: Date): boolean { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function pad(n: number): string { return String(n).padStart(2, "0"); }
function fmtTime(d: Date): string { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }

// Read a Blob/File as raw base64 (without the "data:*;base64," prefix).
// Used for web file uploads where FileSystem.readAsStringAsync is not available.
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    // @ts-ignore FileReader is a browser API available on web
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.substring(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error("FileReader error"));
    reader.readAsDataURL(blob);
  });
}
function fmtRange(start: Date, end: Date): string {
  if (start.getMonth() === end.getMonth()) return `${start.getDate()} – ${end.getDate()} ${MONTHS[start.getMonth()].slice(0, 3)} ${start.getFullYear()}`;
  return `${start.getDate()} ${MONTHS[start.getMonth()].slice(0, 3)} – ${end.getDate()} ${MONTHS[end.getMonth()].slice(0, 3)} ${start.getFullYear()}`;
}
function minutesFromTop(y: number): number {
  return Math.max(0, Math.min(HOURS * 60, Math.round((y / HOUR_H) * 60 / 15) * 15));
}
function dateAt(base: Date, minutesFrom7: number): Date {
  const d = new Date(base);
  d.setHours(HOUR_START, 0, 0, 0);
  d.setMinutes(d.getMinutes() + minutesFrom7);
  return d;
}
function yFromDate(d: Date): number {
  const h = d.getHours() + d.getMinutes() / 60;
  return (h - HOUR_START) * HOUR_H;
}

export default function CalendarScreen() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const params = useLocalSearchParams<{ openEvent?: string }>();
  const [me, setMe] = useState<any>(null);
  const [view, setView] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [events, setEvents] = useState<EventT[]>([]);
  const [loading, setLoading] = useState(true);
  const [createRange, setCreateRange] = useState<{ day: Date; startMin: number; endMin: number } | null>(null);
  const [openEvent, setOpenEvent] = useState<EventT | null>(null);

  // Range to fetch
  const { rangeFrom, rangeTo } = useMemo(() => {
    if (view === "day") {
      const s = new Date(anchor); s.setHours(0, 0, 0, 0);
      const e = addDays(s, 1);
      return { rangeFrom: s, rangeTo: e };
    }
    if (view === "week") {
      const s = mondayOf(anchor);
      return { rangeFrom: s, rangeTo: addDays(s, 7) };
    }
    const s = firstOfMonth(anchor);
    const monday = mondayOf(s);
    return { rangeFrom: monday, rangeTo: addDays(monday, 42) };
  }, [view, anchor]);

  const load = async () => {
    setLoading(true);
    try {
      const [list, who] = await Promise.all([
        api.listEvents(rangeFrom.toISOString(), rangeTo.toISOString()),
        api.me(),
      ]);
      setEvents(list);
      setMe(who);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [rangeFrom.getTime(), rangeTo.getTime()]));

  const isAdmin = me?.role === "admin";
  const now = new Date();

  const stepBack = () => {
    if (view === "day") setAnchor(addDays(anchor, -1));
    else if (view === "week") setAnchor(addDays(anchor, -7));
    else setAnchor(addMonths(anchor, -1));
  };
  const stepForward = () => {
    if (view === "day") setAnchor(addDays(anchor, 1));
    else if (view === "week") setAnchor(addDays(anchor, 7));
    else setAnchor(addMonths(anchor, 1));
  };

  // If we arrived with ?openEvent=..., open that event's modal automatically
  useEffect(() => {
    if (!params.openEvent || events.length === 0) return;
    // Find the base event (strip any :date suffix)
    const targetId = String(params.openEvent).split(":")[0];
    const match = events.find((e) => (e.id.split(":")[0] === targetId));
    if (match) setOpenEvent(match);
    // Clean the param after using it
    // @ts-ignore: setParams may not exist in older versions
    router.setParams?.({ openEvent: undefined });
  }, [params.openEvent, events]);

  // Keyboard shortcuts on web (arrow keys + D/S/M + T for today)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (e: any) => {
      const tag = (e.target?.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); stepBack(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); stepForward(); }
      else if (e.key === "d" || e.key === "D") setView("day");
      else if (e.key === "s" || e.key === "S") setView("week");
      else if (e.key === "m" || e.key === "M") setView("month");
      else if (e.key === "t" || e.key === "T") setAnchor(new Date());
    };
    // @ts-ignore window exists on web
    window.addEventListener("keydown", handler);
    return () => { /* @ts-ignore */ window.removeEventListener("keydown", handler); };
  }, [view, anchor]);

  const headerSub = useMemo(() => {
    if (view === "day") return anchor.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    if (view === "week") {
      const s = mondayOf(anchor);
      return fmtRange(s, addDays(s, 4));
    }
    return `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
  }, [view, anchor]);

  const moveEvent = async (ev: EventT, newStart: Date, newEnd: Date) => {
    // Optimistic update
    setEvents((arr) => arr.map((e) => e.id === ev.id ? { ...e, start_at: newStart.toISOString(), end_at: newEnd.toISOString() } : e));
    try {
      await api.updateEvent(ev.id, { start_at: newStart.toISOString(), end_at: newEnd.toISOString() });
    } catch (e: any) {
      Alert.alert("Error", e.message);
      load();
    }
  };

  return (
    <ResponsiveLayout active="calendario" isAdmin={isAdmin} userName={me?.name}
      onLogout={async () => { const { clearToken } = await import("../src/api"); await clearToken(); router.replace("/login"); }}
    >
      <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      <View style={s.header}>
        {!isWide && (
          <TouchableOpacity style={s.iconBtn} onPress={() => router.replace("/home")}>
            <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={s.headerTitle}>Calendario</Text>
          <Text style={s.headerSub} numberOfLines={1}>{headerSub}</Text>
        </View>
        <TouchableOpacity style={s.iconBtn} onPress={() => setAnchor(new Date())}>
          <Ionicons name="today-outline" size={22} color={COLORS.navy} />
        </TouchableOpacity>
      </View>

      {/* View selector */}
      <View style={s.viewSelector}>
        {(["day", "week", "month"] as ViewMode[]).map((v) => (
          <TouchableOpacity
            key={v}
            testID={`view-${v}`}
            style={[s.viewChip, view === v && s.viewChipActive]}
            onPress={() => setView(v)}
          >
            <Ionicons
              name={v === "day" ? "today-outline" : v === "week" ? "calendar-outline" : "grid-outline"}
              size={16}
              color={view === v ? "#fff" : COLORS.navy}
            />
            <Text style={[s.viewChipText, view === v && { color: "#fff" }]}>
              {v === "day" ? "Día" : v === "week" ? "Semana" : "Mes"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.navRow}>
        <TouchableOpacity style={s.navBtn} onPress={stepBack}>
          <Ionicons name="chevron-back" size={20} color={COLORS.navy} />
        </TouchableOpacity>
        <TouchableOpacity style={s.navBtn} onPress={stepForward}>
          <Ionicons name="chevron-forward" size={20} color={COLORS.navy} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : view === "month" ? (
        <MonthView
          anchor={anchor}
          events={events}
          onSelectDay={(d) => { setAnchor(d); setView("day"); }}
        />
      ) : view === "day" ? (
        <DayView
          day={anchor}
          events={events.filter((e) => sameDay(new Date(e.start_at), anchor))}
          isAdmin={isAdmin}
          isToday={sameDay(anchor, now)}
          onCreate={(startMin, endMin) => setCreateRange({ day: anchor, startMin, endMin })}
          onTapEvent={setOpenEvent}
          onMoveEvent={moveEvent}
        />
      ) : (
        <WeekView
          weekStart={mondayOf(anchor)}
          events={events}
          isAdmin={isAdmin}
          now={now}
          onCreate={(day, startMin, endMin) => setCreateRange({ day, startMin, endMin })}
          onTapEvent={setOpenEvent}
          onMoveEvent={moveEvent}
          onSelectDay={(d) => { setAnchor(d); setView("day"); }}
        />
      )}

      {createRange && (
        <CreateEventModal
          visible={!!createRange}
          range={createRange}
          onClose={() => setCreateRange(null)}
          onDone={() => { setCreateRange(null); load(); }}
        />
      )}
      {openEvent && (
        <EventDetailsModal
          event={openEvent}
          isAdmin={isAdmin}
          onClose={() => setOpenEvent(null)}
          onChanged={() => { setOpenEvent(null); load(); }}
        />
      )}
      </SafeAreaView>
    </ResponsiveLayout>
  );
}

// ---------------- Month view ----------------
function MonthView({
  anchor, events, onSelectDay,
}: { anchor: Date; events: EventT[]; onSelectDay: (d: Date) => void }) {
  const first = firstOfMonth(anchor);
  const gridStart = mondayOf(first);
  const weeks = 6;
  const today = new Date();
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
      <View style={s.monthHeader}>
        {DAY_LABELS_MONTH.map((d, i) => (
          <View key={i} style={s.monthHeaderCell}>
            <Text style={s.monthHeaderText}>{d}</Text>
          </View>
        ))}
      </View>
      {Array.from({ length: weeks }).map((_, w) => (
        <View key={w} style={s.monthRow}>
          {Array.from({ length: 7 }).map((_, d) => {
            const date = addDays(gridStart, w * 7 + d);
            const inMonth = date.getMonth() === anchor.getMonth();
            const isToday = sameDay(date, today);
            const dayEvents = events.filter((e) => sameDay(new Date(e.start_at), date));
            return (
              <TouchableOpacity
                key={d}
                style={[
                  s.monthCell,
                  !inMonth && { backgroundColor: "transparent", opacity: 0.4 },
                  isToday && s.monthCellToday,
                ]}
                onPress={() => onSelectDay(date)}
                activeOpacity={0.7}
              >
                <Text style={[s.monthDayNum, isToday && { color: COLORS.primary, fontWeight: "900" }]}>
                  {date.getDate()}
                </Text>
                <View style={s.monthDots}>
                  {dayEvents.slice(0, 3).map((ev, i) => (
                    <View
                      key={ev.id}
                      style={[s.monthDot, { backgroundColor: ev.material_id ? COLORS.primary : "#6366F1" }]}
                    />
                  ))}
                  {dayEvents.length > 3 && (
                    <Text style={s.monthMoreText}>+{dayEvents.length - 3}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

// ---------------- Week view ----------------
function WeekView({
  weekStart, events, isAdmin, now, onCreate, onTapEvent, onMoveEvent, onSelectDay,
}: {
  weekStart: Date; events: EventT[]; isAdmin: boolean; now: Date;
  onCreate: (day: Date, startMin: number, endMin: number) => void;
  onTapEvent: (e: EventT) => void;
  onMoveEvent: (ev: EventT, s: Date, e: Date) => Promise<void>;
  onSelectDay?: (d: Date) => void;
}) {
  const days = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const [colW, setColW] = useState(0);
  const nowY = yFromDate(now);
  return (
    <>
      <View style={s.dayHeaderRow}>
        <View style={{ width: TIME_COL_W }} />
        {days.map((d, i) => {
          const isToday = sameDay(d, now);
          return (
            <TouchableOpacity
              key={i}
              testID={`week-day-${i}`}
              style={[s.dayHeader, isToday && s.dayHeaderToday]}
              activeOpacity={onSelectDay ? 0.6 : 1}
              onPress={() => onSelectDay && onSelectDay(d)}
            >
              <Text style={[s.dayLabel, isToday && { color: COLORS.primary }]}>{DAY_LABELS[i]}</Text>
              <Text style={[s.dayNum, isToday && { color: COLORS.primary, fontWeight: "900" }]}>{d.getDate()}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <View
          style={s.gridRow}
          onLayout={(e) => setColW((e.nativeEvent.layout.width - TIME_COL_W) / 5)}
        >
          <View style={{ width: TIME_COL_W }}>
            {Array.from({ length: HOURS + 1 }).map((_, i) => (
              <View key={i} style={{ height: HOUR_H }}>
                <Text style={s.hourLabel}>{pad(HOUR_START + i)}:00</Text>
              </View>
            ))}
          </View>
          {days.map((d, i) => (
            <DayColumn
              key={i}
              day={d}
              events={events.filter((e) => sameDay(new Date(e.start_at), d))}
              isAdmin={isAdmin}
              onCreate={(s2, e2) => onCreate(d, s2, e2)}
              onTapEvent={onTapEvent}
              onMoveEvent={async (ev, s, e) => {
                // In week mode we need to calculate cross-day drop via dx; handled inside DraggableEvent using colW
                await onMoveEvent(ev, s, e);
              }}
              isToday={sameDay(d, now)}
              nowY={nowY}
              compact
              weekDays={days}
              colW={colW}
              dayIndex={i}
            />
          ))}
        </View>
      </ScrollView>
    </>
  );
}

// ---------------- Day view ----------------
function DayView({
  day, events, isAdmin, isToday, onCreate, onTapEvent, onMoveEvent,
}: {
  day: Date; events: EventT[]; isAdmin: boolean; isToday: boolean;
  onCreate: (startMin: number, endMin: number) => void;
  onTapEvent: (e: EventT) => void;
  onMoveEvent: (ev: EventT, s: Date, e: Date) => Promise<void>;
}) {
  const now = new Date();
  const nowY = yFromDate(now);
  const dayIdx = day.getDay() === 0 ? 6 : day.getDay() - 1;
  const dayName = dayIdx < 5 ? DAY_LABELS_FULL[dayIdx] : ["Sábado", "Domingo"][dayIdx - 5];
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={[s.dayFullHeader, isToday && s.dayHeaderToday]}>
        <Text style={[s.dayLabel, isToday && { color: COLORS.primary }]}>{dayName}</Text>
        <Text style={[s.dayNumBig, isToday && { color: COLORS.primary }]}>{day.getDate()}</Text>
      </View>
      <View style={s.gridRow}>
        <View style={{ width: TIME_COL_W }}>
          {Array.from({ length: HOURS + 1 }).map((_, i) => (
            <View key={i} style={{ height: HOUR_H }}>
              <Text style={s.hourLabel}>{pad(HOUR_START + i)}:00</Text>
            </View>
          ))}
        </View>
        <DayColumn
          day={day}
          events={events}
          isAdmin={isAdmin}
          onCreate={onCreate}
          onTapEvent={onTapEvent}
          onMoveEvent={onMoveEvent}
          isToday={isToday}
          nowY={nowY}
          compact={false}
        />
      </View>
    </ScrollView>
  );
}

// ---------------- DayColumn (with draggable events) ----------------
function DayColumn({
  day, events, isAdmin, onCreate, onTapEvent, onMoveEvent, isToday, nowY, compact,
  weekDays, colW, dayIndex,
}: {
  day: Date; events: EventT[]; isAdmin: boolean;
  onCreate: (startMin: number, endMin: number) => void;
  onTapEvent: (e: EventT) => void;
  onMoveEvent: (ev: EventT, s: Date, e: Date) => Promise<void>;
  isToday: boolean; nowY: number; compact: boolean;
  weekDays?: Date[]; colW?: number; dayIndex?: number;
}) {
  const [dragRange, setDragRange] = useState<{ s: number; e: number } | null>(null);
  const startRef = useRef<number>(0);
  const [dragEvent, setDragEvent] = useState<{ id: string; top: number; height: number } | null>(null);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => isAdmin,
    onMoveShouldSetPanResponder: () => isAdmin,
    onPanResponderGrant: (evt) => {
      const y = evt.nativeEvent.locationY;
      const m = minutesFromTop(y);
      startRef.current = m;
      setDragRange({ s: m, e: Math.min(HOURS * 60, m + 60) });
    },
    onPanResponderMove: (evt) => {
      const y = evt.nativeEvent.locationY;
      const m = minutesFromTop(y);
      const s = Math.min(startRef.current, m);
      const e = Math.max(startRef.current, m);
      setDragRange({ s, e: Math.max(e, s + 15) });
    },
    onPanResponderRelease: () => {
      if (dragRange) onCreate(dragRange.s, dragRange.e);
      setDragRange(null);
    },
    onPanResponderTerminate: () => setDragRange(null),
  }), [isAdmin, dragRange, onCreate]);

  return (
    <View style={{ flex: 1, height: HOURS * HOUR_H, position: "relative", borderLeftWidth: 1, borderLeftColor: COLORS.border, backgroundColor: isToday ? "rgba(59,130,246,0.04)" : "transparent" }}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} {...pan.panHandlers} />
      {Array.from({ length: HOURS + 1 }).map((_, i) => (
        <View key={i} style={[s.hourLine, { top: i * HOUR_H }]} />
      ))}
      {Array.from({ length: HOURS }).map((_, i) => (
        <View key={`h${i}`} style={[s.halfHourLine, { top: i * HOUR_H + HOUR_H / 2 }]} />
      ))}
      {isToday && nowY >= 0 && nowY <= HOURS * HOUR_H && (
        <View style={[s.nowLine, { top: nowY }]} pointerEvents="none">
          <View style={s.nowDot} />
        </View>
      )}
      {events.map((ev) => (
        <DraggableEvent
          key={ev.id}
          event={ev}
          day={day}
          isAdmin={isAdmin}
          compact={compact}
          onTap={() => onTapEvent(ev)}
          onMoveEvent={onMoveEvent}
          weekDays={weekDays}
          colW={colW}
          dayIndex={dayIndex}
        />
      ))}
      {dragRange && (
        <View style={[s.dragPreview, {
          top: (dragRange.s / 60) * HOUR_H,
          height: ((dragRange.e - dragRange.s) / 60) * HOUR_H,
        }]} pointerEvents="none">
          <Text style={s.dragPreviewText}>
            {pad(HOUR_START + Math.floor(dragRange.s / 60))}:{pad(dragRange.s % 60)} - {pad(HOUR_START + Math.floor(dragRange.e / 60))}:{pad(dragRange.e % 60)}
          </Text>
        </View>
      )}
    </View>
  );
}

// ---------------- Draggable event (move + resize) ----------------
function DraggableEvent({
  event, day, isAdmin, compact, onTap, onMoveEvent,
  weekDays, colW, dayIndex,
}: {
  event: EventT; day: Date; isAdmin: boolean; compact: boolean;
  onTap: () => void;
  onMoveEvent: (ev: EventT, s: Date, e: Date) => Promise<void>;
  weekDays?: Date[]; colW?: number; dayIndex?: number;
}) {
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);
  const initTop = yFromDate(start);
  const initHeight = Math.max(24, yFromDate(end) - initTop);

  const [top, setTop] = useState(initTop);
  const [height, setHeight] = useState(initHeight);
  const [leftOffset, setLeftOffset] = useState(0); // horizontal shift when dragging in week view
  const [mode, setMode] = useState<"idle" | "move" | "resize">("idle");
  const baseRef = useRef<{ top: number; height: number }>({ top: initTop, height: initHeight });

  useEffect(() => { setTop(initTop); setHeight(initHeight); setLeftOffset(0); baseRef.current = { top: initTop, height: initHeight }; }, [event.start_at, event.end_at]);

  const tapTimeRef = useRef(0);
  const hasMovedRef = useRef(false);
  const dayShiftRef = useRef(0);
  const canCrossDays = !!(weekDays && weekDays.length > 0 && colW && colW > 0 && typeof dayIndex === "number");

  const panMove = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => isAdmin,
    onStartShouldSetPanResponderCapture: () => isAdmin,
    onMoveShouldSetPanResponder: (_, g) => isAdmin && (Math.abs(g.dy) > 2 || Math.abs(g.dx) > 2),
    onMoveShouldSetPanResponderCapture: (_, g) => isAdmin && (Math.abs(g.dy) > 2 || Math.abs(g.dx) > 2),
    onPanResponderGrant: () => {
      tapTimeRef.current = Date.now();
      hasMovedRef.current = false;
      baseRef.current = { top, height };
      dayShiftRef.current = 0;
      setMode("move");
    },
    onPanResponderMove: (_, g) => {
      if (Math.abs(g.dy) > 3 || Math.abs(g.dx) > 3) hasMovedRef.current = true;
      const snapDy = Math.round(g.dy / (HOUR_H / 4)) * (HOUR_H / 4);
      const nt = Math.max(0, Math.min(HOURS * HOUR_H - baseRef.current.height, baseRef.current.top + snapDy));
      setTop(nt);
      if (canCrossDays) {
        const shift = Math.round(g.dx / colW!);
        const newIdx = Math.max(0, Math.min(weekDays!.length - 1, dayIndex! + shift));
        const effective = newIdx - dayIndex!;
        dayShiftRef.current = effective;
        setLeftOffset(effective * colW!);
      }
    },
    onPanResponderRelease: async () => {
      if (!hasMovedRef.current) {
        onTap();
        setMode("idle");
        setTop(baseRef.current.top);
        setLeftOffset(0);
        return;
      }
      const startMin = Math.round((top / HOUR_H) * 60 / 15) * 15;
      const durMin = Math.round((height / HOUR_H) * 60);
      const targetDay = canCrossDays && dayShiftRef.current !== 0
        ? weekDays![dayIndex! + dayShiftRef.current]
        : day;
      const newStart = dateAt(targetDay, startMin);
      const newEnd = new Date(newStart.getTime() + durMin * 60000);
      setLeftOffset(0);
      await onMoveEvent(event, newStart, newEnd);
      setMode("idle");
    },
    onPanResponderTerminate: () => { setTop(baseRef.current.top); setLeftOffset(0); setMode("idle"); },
  }), [isAdmin, top, height, event, day, onTap, onMoveEvent, canCrossDays, weekDays, colW, dayIndex]);

  // -------- Web-only drag using document-level mouse events (reliable on Chrome) --------
  const webStateRef = useRef<{ startX: number; startY: number; baseTop: number; baseHeight: number; moved: boolean } | null>(null);
  const onWebMouseDown = (e: any) => {
    if (Platform.OS !== "web" || !isAdmin) return;
    e.stopPropagation?.();
    e.preventDefault?.();
    webStateRef.current = {
      startX: e.clientX, startY: e.clientY,
      baseTop: top, baseHeight: height, moved: false,
    };
    tapTimeRef.current = Date.now();
    hasMovedRef.current = false;
    baseRef.current = { top, height };
    dayShiftRef.current = 0;
    setMode("move");
    const moveHandler = (ev: any) => {
      const st = webStateRef.current; if (!st) return;
      const dx = ev.clientX - st.startX;
      const dy = ev.clientY - st.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) { st.moved = true; hasMovedRef.current = true; }
      const snapDy = Math.round(dy / (HOUR_H / 4)) * (HOUR_H / 4);
      const nt = Math.max(0, Math.min(HOURS * HOUR_H - st.baseHeight, st.baseTop + snapDy));
      setTop(nt);
      if (canCrossDays) {
        const shift = Math.round(dx / colW!);
        const newIdx = Math.max(0, Math.min(weekDays!.length - 1, dayIndex! + shift));
        const effective = newIdx - dayIndex!;
        dayShiftRef.current = effective;
        setLeftOffset(effective * colW!);
      }
    };
    const upHandler = async () => {
      // @ts-ignore web
      document.removeEventListener("mousemove", moveHandler);
      // @ts-ignore web
      document.removeEventListener("mouseup", upHandler);
      const st = webStateRef.current; webStateRef.current = null;
      if (!st) return;
      if (!st.moved) {
        setMode("idle");
        setTop(baseRef.current.top);
        setLeftOffset(0);
        onTap();
        return;
      }
      const startMin = Math.round((top / HOUR_H) * 60 / 15) * 15;
      const durMin = Math.round((height / HOUR_H) * 60);
      const targetDay = canCrossDays && dayShiftRef.current !== 0
        ? weekDays![dayIndex! + dayShiftRef.current]
        : day;
      const newStart = dateAt(targetDay, startMin);
      const newEnd = new Date(newStart.getTime() + durMin * 60000);
      setLeftOffset(0);
      await onMoveEvent(event, newStart, newEnd);
      setMode("idle");
    };
    // @ts-ignore web
    document.addEventListener("mousemove", moveHandler);
    // @ts-ignore web
    document.addEventListener("mouseup", upHandler);
  };

  // BOTTOM resize (moves endMin; keeps startMin)
  const panResize = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => isAdmin,
    onStartShouldSetPanResponderCapture: () => isAdmin,
    onMoveShouldSetPanResponder: () => isAdmin,
    onMoveShouldSetPanResponderCapture: () => isAdmin,
    onPanResponderGrant: () => { baseRef.current = { top, height }; setMode("resize"); },
    onPanResponderMove: (_, g) => {
      const snap = Math.round(g.dy / (HOUR_H / 4)) * (HOUR_H / 4);
      const nh = Math.max(HOUR_H / 4, Math.min(HOURS * HOUR_H - baseRef.current.top, baseRef.current.height + snap));
      setHeight(nh);
    },
    onPanResponderRelease: async () => {
      const startMin = Math.round((top / HOUR_H) * 60 / 15) * 15;
      const durMin = Math.max(15, Math.round((height / HOUR_H) * 60 / 15) * 15);
      const newStart = dateAt(day, startMin);
      const newEnd = new Date(newStart.getTime() + durMin * 60000);
      await onMoveEvent(event, newStart, newEnd);
      setMode("idle");
    },
    onPanResponderTerminate: () => { setHeight(baseRef.current.height); setMode("idle"); },
  }), [isAdmin, top, height, event, day, onMoveEvent]);

  // TOP resize (moves startMin; keeps endMin)
  const panResizeTop = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => isAdmin,
    onStartShouldSetPanResponderCapture: () => isAdmin,
    onMoveShouldSetPanResponder: () => isAdmin,
    onMoveShouldSetPanResponderCapture: () => isAdmin,
    onPanResponderGrant: () => { baseRef.current = { top, height }; setMode("resize"); },
    onPanResponderMove: (_, g) => {
      const snap = Math.round(g.dy / (HOUR_H / 4)) * (HOUR_H / 4);
      const baseBottom = baseRef.current.top + baseRef.current.height;
      const nt = Math.max(0, Math.min(baseBottom - HOUR_H / 4, baseRef.current.top + snap));
      const nh = baseBottom - nt;
      setTop(nt); setHeight(nh);
    },
    onPanResponderRelease: async () => {
      const startMin = Math.round((top / HOUR_H) * 60 / 15) * 15;
      const durMin = Math.max(15, Math.round((height / HOUR_H) * 60 / 15) * 15);
      const newStart = dateAt(day, startMin);
      const newEnd = new Date(newStart.getTime() + durMin * 60000);
      await onMoveEvent(event, newStart, newEnd);
      setMode("idle");
    },
    onPanResponderTerminate: () => { setTop(baseRef.current.top); setHeight(baseRef.current.height); setMode("idle"); },
  }), [isAdmin, top, height, event, day, onMoveEvent]);

  // Keep a ref of top/height so mouseup can read the latest state at submit time
  const resizeStateRef = useRef({ top, height });
  useEffect(() => { resizeStateRef.current = { top, height }; }, [top, height]);

  // Web-only resize helpers (mouse-based, reliable on Chrome)
  const onWebResizeDown = (edge: "top" | "bottom") => (e: any) => {
    if (Platform.OS !== "web" || !isAdmin) return;
    e.stopPropagation?.(); e.preventDefault?.();
    const startY = e.clientY;
    const baseTop = top;
    const baseHeight = height;
    setMode("resize");
    const moveHandler = (ev: any) => {
      const dy = ev.clientY - startY;
      const snap = Math.round(dy / (HOUR_H / 4)) * (HOUR_H / 4);
      if (edge === "bottom") {
        const nh = Math.max(HOUR_H / 4, Math.min(HOURS * HOUR_H - baseTop, baseHeight + snap));
        setHeight(nh);
      } else {
        const baseBottom = baseTop + baseHeight;
        const nt = Math.max(0, Math.min(baseBottom - HOUR_H / 4, baseTop + snap));
        setTop(nt); setHeight(baseBottom - nt);
      }
    };
    const upHandler = async () => {
      // @ts-ignore
      document.removeEventListener("mousemove", moveHandler);
      // @ts-ignore
      document.removeEventListener("mouseup", upHandler);
      const curTop = resizeStateRef.current.top;
      const curHeight = resizeStateRef.current.height;
      const startMin = Math.round((curTop / HOUR_H) * 60 / 15) * 15;
      const durMin = Math.max(15, Math.round((curHeight / HOUR_H) * 60 / 15) * 15);
      const newStart = dateAt(day, startMin);
      const newEnd = new Date(newStart.getTime() + durMin * 60000);
      await onMoveEvent(event, newStart, newEnd);
      setMode("idle");
    };
    // @ts-ignore
    document.addEventListener("mousemove", moveHandler);
    // @ts-ignore
    document.addEventListener("mouseup", upHandler);
  };

  const hasMaterial = !!event.material_id;
  const isRecurring = event.recurrence && event.recurrence.type !== "none";
  // Determine color based on first assigned user's color, fallback to palette by material
  const userColor = event.assigned_users && event.assigned_users.length > 0
    ? event.assigned_users[0].color
    : null;
  const baseColor = userColor || (hasMaterial ? COLORS.primary : "#6366F1");
  // Compute a light tint from the user color (use 22 alpha hex = ~13% opacity)
  const bgTint = baseColor + "33";
  return (
    <View
      style={[s.eventBox, {
        top, height,
        transform: [{ translateX: leftOffset }],
        backgroundColor: bgTint,
        borderLeftColor: baseColor,
        opacity: mode === "move" ? 0.85 : 1,
        zIndex: mode === "idle" ? 2 : 10,
        elevation: mode === "idle" ? 2 : 10,
        // @ts-ignore web-only cursor hint
        cursor: isAdmin ? (mode === "idle" ? "grab" : "grabbing") : "pointer",
      }]}
      {...(isAdmin && Platform.OS !== "web" ? panMove.panHandlers : {})}
      {...(isAdmin && Platform.OS === "web" ? { onMouseDown: onWebMouseDown } as any : {})}
    >
      {isAdmin ? (
        <View pointerEvents="none" style={{ padding: 2 }}>
          {/* Top: assigned user(s) */}
          {event.assigned_users && event.assigned_users.length > 0 && (
            <Text style={[s.eventAssignee, { color: baseColor }]} numberOfLines={1}>
              👤 {event.assigned_users.map((u) => u.name || u.email.split("@")[0]).join(", ")}
            </Text>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            {isRecurring && <Ionicons name="repeat" size={10} color={baseColor} />}
            <Text style={[s.eventTitle, { color: baseColor }]} numberOfLines={compact ? 1 : 2}>{event.title}</Text>
          </View>
          <Text style={s.eventTime}>{fmtTime(new Date(event.start_at))} - {fmtTime(new Date(event.end_at))}</Text>
          {!compact && event.material && (
            <Text style={s.eventMeta} numberOfLines={1}>📍 {event.material.ubicacion || ""}</Text>
          )}
          {/* Bottom: manager (gestor) */}
          {event.manager && (
            <Text style={s.eventManager} numberOfLines={1}>
              🧑‍💼 {event.manager.name || event.manager.email.split("@")[0]}
            </Text>
          )}
        </View>
      ) : (
        <TouchableOpacity onPress={onTap} activeOpacity={0.8} style={{ padding: 2 }}>
          {event.assigned_users && event.assigned_users.length > 0 && (
            <Text style={[s.eventAssignee, { color: baseColor }]} numberOfLines={1}>
              👤 {event.assigned_users.map((u) => u.name || u.email.split("@")[0]).join(", ")}
            </Text>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            {isRecurring && <Ionicons name="repeat" size={10} color={baseColor} />}
            <Text style={[s.eventTitle, { color: baseColor }]} numberOfLines={compact ? 1 : 2}>{event.title}</Text>
          </View>
          <Text style={s.eventTime}>{fmtTime(new Date(event.start_at))} - {fmtTime(new Date(event.end_at))}</Text>
          {!compact && event.material && (
            <Text style={s.eventMeta} numberOfLines={1}>📍 {event.material.ubicacion || ""}</Text>
          )}
          {event.manager && (
            <Text style={s.eventManager} numberOfLines={1}>
              🧑‍💼 {event.manager.name || event.manager.email.split("@")[0]}
            </Text>
          )}
        </TouchableOpacity>
      )}
      {isAdmin && (
        <>
          {/* Top resize handle */}
          <View
            style={s.resizeHandleTop}
            {...(Platform.OS !== "web" ? panResizeTop.panHandlers : {})}
            {...(Platform.OS === "web" ? { onMouseDown: onWebResizeDown("top") } as any : {})}
          >
            <View style={s.resizeBar} />
          </View>
          {/* Bottom resize handle */}
          <View
            style={s.resizeHandle}
            {...(Platform.OS !== "web" ? panResize.panHandlers : {})}
            {...(Platform.OS === "web" ? { onMouseDown: onWebResizeDown("bottom") } as any : {})}
          >
            <View style={s.resizeBar} />
          </View>
        </>
      )}
    </View>
  );
}

// ---------------- Create event modal ----------------
function CreateEventModal({
  visible, range, onClose, onDone,
}: {
  visible: boolean;
  range: { day: Date; startMin: number; endMin: number };
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"texto" | "proyecto">("texto");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [materialObj, setMaterialObj] = useState<any>(null);
  const [materiales, setMateriales] = useState<any[]>([]);
  const [loadingMat, setLoadingMat] = useState(false);
  const [q, setQ] = useState("");
  const [showMatList, setShowMatList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [techs, setTechs] = useState<Technician[]>([]);
  const [managers, setManagers] = useState<Technician[]>([]);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [managerId, setManagerId] = useState<string | null>(null);
  const [showManagerList, setShowManagerList] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");
  const [until, setUntil] = useState<string>("");

  const startDate = dateAt(range.day, range.startMin);
  const endDate = dateAt(range.day, range.endMin);

  useEffect(() => {
    if (visible) {
      setMode("texto"); setTitle(""); setDescription("");
      setMaterialId(null); setMaterialObj(null); setShowMatList(false);
      setAssignedIds([]); setManagerId(null); setShowManagerList(false);
      setRecurrence("none"); setUntil("");
      (async () => {
        try { setTechs(await api.listTechnicians()); } catch {}
        try { setManagers(await api.listManagers()); } catch {}
      })();
    }
  }, [visible]);

  const loadMateriales = async () => {
    if (materiales.length > 0) return;
    setLoadingMat(true);
    try { setMateriales(await api.listMateriales()); }
    catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoadingMat(false); }
  };

  const pickMaterial = (m: any) => {
    setMaterialId(m.id);
    setMaterialObj(m);
    setTitle(`${m.materiales || "—"} — ${m.cliente || "Sin cliente"}`);
    setShowMatList(false);
  };

  const toggleAssign = (id: string) => {
    setAssignedIds((arr) => arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  };

  const submit = async () => {
    if (mode === "texto" && !title.trim()) { Alert.alert("Error", "Introduce un título"); return; }
    if (mode === "proyecto" && !materialId) { Alert.alert("Error", "Selecciona un proyecto"); return; }
    setSaving(true);
    try {
      await api.createEvent({
        title: title.trim(),
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        description: description || undefined,
        material_id: materialId || undefined,
        assigned_user_ids: assignedIds,
        manager_id: managerId || undefined,
        recurrence: recurrence !== "none" ? { type: recurrence, until: until || null } : undefined,
      } as any);
      onDone();
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setSaving(false); }
  };

  const filtered = q.trim()
    ? materiales.filter((m) => `${m.materiales || ""} ${m.cliente || ""} ${m.ubicacion || ""}`.toLowerCase().includes(q.toLowerCase()))
    : materiales;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.modalRoot}>
        <View style={[s.modalCard, showMatList && { maxHeight: "88%", minHeight: "70%" }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Nuevo evento</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={26} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          {showMatList ? (
            <View style={{ flex: 1, minHeight: 300 }}>
              <TouchableOpacity style={s.backRow} onPress={() => setShowMatList(false)}>
                <Ionicons name="chevron-back" size={20} color={COLORS.navy} />
                <Text style={s.backRowText}>Volver</Text>
              </TouchableOpacity>
              <View style={s.searchBox}>
                <Ionicons name="search" size={18} color={COLORS.textSecondary} />
                <TextInput style={s.searchInput} value={q} onChangeText={setQ} placeholder="Buscar proyecto..." placeholderTextColor={COLORS.textDisabled} />
              </View>
              {loadingMat ? (
                <ActivityIndicator color={COLORS.primary} style={{ padding: 20 }} />
              ) : (
                <FlatList
                  data={filtered} keyExtractor={(m) => m.id} style={{ flex: 1 }} keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity style={s.matRow} onPress={() => pickMaterial(item)}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.matCode}>{item.materiales || "—"}</Text>
                        <Text style={s.matCliente} numberOfLines={1}>{item.cliente || "Sin cliente"}</Text>
                        {item.ubicacion && <Text style={s.matUbic} numberOfLines={1}>📍 {item.ubicacion}</Text>}
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  )}
                  initialNumToRender={15}
                />
              )}
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={s.timeBox}>
                <Ionicons name="time-outline" size={18} color={COLORS.textSecondary} />
                <Text style={s.timeText}>
                  {startDate.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                  {" · "}{fmtTime(startDate)} - {fmtTime(endDate)}
                </Text>
              </View>
              <View style={s.modeRow}>
                <TouchableOpacity testID="mode-texto" style={[s.modeChip, mode === "texto" && s.modeChipActive]} onPress={() => setMode("texto")}>
                  <Ionicons name="create-outline" size={18} color={mode === "texto" ? "#fff" : COLORS.navy} />
                  <Text style={[s.modeChipText, mode === "texto" && { color: "#fff" }]}>Texto libre</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="mode-proyecto" style={[s.modeChip, mode === "proyecto" && s.modeChipActive]} onPress={() => { setMode("proyecto"); loadMateriales(); }}>
                  <Ionicons name="briefcase-outline" size={18} color={mode === "proyecto" ? "#fff" : COLORS.navy} />
                  <Text style={[s.modeChipText, mode === "proyecto" && { color: "#fff" }]}>Desde proyecto</Text>
                </TouchableOpacity>
              </View>
              {mode === "texto" ? (
                <>
                  <Text style={s.mLabel}>Título</Text>
                  <TextInput style={s.mInput} value={title} onChangeText={setTitle} placeholder="Ej. Reunión equipo" placeholderTextColor={COLORS.textDisabled} autoFocus />
                  <Text style={s.mLabel}>Descripción (opcional)</Text>
                  <TextInput style={[s.mInput, { height: 90, paddingTop: 12 }]} value={description} onChangeText={setDescription} placeholder="Notas adicionales..." multiline textAlignVertical="top" placeholderTextColor={COLORS.textDisabled} />
                </>
              ) : (
                <>
                  <Text style={s.mLabel}>Proyecto</Text>
                  {materialObj ? (
                    <View style={s.matPreview}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.matCode}>{materialObj.materiales || "—"}</Text>
                        <Text style={s.matCliente}>{materialObj.cliente || "Sin cliente"}</Text>
                        {materialObj.ubicacion && <Text style={s.matUbic}>📍 {materialObj.ubicacion}</Text>}
                      </View>
                      <TouchableOpacity onPress={() => setShowMatList(true)}>
                        <Ionicons name="swap-horizontal" size={22} color={COLORS.primary} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={s.pickMatBtn} onPress={() => setShowMatList(true)}>
                      <Ionicons name="list" size={20} color={COLORS.primary} />
                      <Text style={{ color: COLORS.primary, fontWeight: "700" }}>Elegir proyecto...</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={s.mLabel}>Nota adicional (opcional)</Text>
                  <TextInput style={[s.mInput, { height: 70, paddingTop: 12 }]} value={description} onChangeText={setDescription} placeholder="Instrucciones específicas..." multiline textAlignVertical="top" placeholderTextColor={COLORS.textDisabled} />
                </>
              )}

              <Text style={s.mLabel}>Técnicos asignados</Text>
              <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 6 }}>
                {assignedIds.length === 0 ? "Si no seleccionas nadie, solo lo verán los admins" : `${assignedIds.length} seleccionado${assignedIds.length !== 1 ? "s" : ""}`}
              </Text>
              <View style={{ gap: 6 }}>
                {techs.map((t) => {
                  const on = assignedIds.includes(t.id);
                  return (
                    <TouchableOpacity
                      key={t.id}
                      testID={`assign-${t.id}`}
                      style={[s.techRow, on && { backgroundColor: "#DBEAFE", borderColor: COLORS.primary }]}
                      onPress={() => toggleAssign(t.id)}
                    >
                      <View style={[s.checkBox, on && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}>
                        {on && <Ionicons name="checkmark" size={16} color="#fff" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.techName}>{t.name}</Text>
                        <Text style={s.techEmail}>{t.email}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.mLabel}>Gestor del proyecto</Text>
              <TouchableOpacity
                testID="btn-pick-manager"
                style={s.pickMatBtn}
                onPress={() => setShowManagerList((v) => !v)}
              >
                <Ionicons name="person-circle-outline" size={20} color={COLORS.primary} />
                <Text style={{ color: managerId ? COLORS.navy : COLORS.primary, fontWeight: "700", flex: 1 }} numberOfLines={1}>
                  {managerId
                    ? (managers.find((m) => m.id === managerId)?.name || "Gestor seleccionado")
                    : "Seleccionar gestor (admin)"}
                </Text>
                <Ionicons name={showManagerList ? "chevron-up" : "chevron-down"} size={18} color={COLORS.primary} />
              </TouchableOpacity>
              {showManagerList && (
                <View style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, marginTop: 6, overflow: "hidden" }}>
                  <TouchableOpacity
                    testID="manager-none"
                    style={[s.techRow, { borderRadius: 0, borderWidth: 0, borderBottomWidth: 1, borderBottomColor: COLORS.border }]}
                    onPress={() => { setManagerId(null); setShowManagerList(false); }}
                  >
                    <View style={[s.checkBox, !managerId && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}>
                      {!managerId && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                    <Text style={[s.techName, { color: COLORS.textSecondary, fontStyle: "italic" }]}>— Sin gestor —</Text>
                  </TouchableOpacity>
                  {managers.length === 0 ? (
                    <View style={{ padding: 12 }}>
                      <Text style={{ color: COLORS.textSecondary, fontStyle: "italic" }}>No hay administradores disponibles</Text>
                    </View>
                  ) : managers.map((m) => {
                    const on = managerId === m.id;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        testID={`manager-${m.id}`}
                        style={[s.techRow, { borderRadius: 0, borderWidth: 0, borderBottomWidth: 1, borderBottomColor: COLORS.border }, on && { backgroundColor: "#DBEAFE" }]}
                        onPress={() => { setManagerId(m.id); setShowManagerList(false); }}
                      >
                        <View style={[s.checkBox, on && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}>
                          {on && <Ionicons name="checkmark" size={16} color="#fff" />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.techName}>{m.name}</Text>
                          <Text style={s.techEmail}>{m.email}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={s.mLabel}>Repetir</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {([["none", "Una vez"], ["daily", "Cada día"], ["weekly", "Cada semana"], ["monthly", "Cada mes"]] as [RecurrenceType, string][]).map(([v, l]) => (
                  <TouchableOpacity
                    key={v}
                    testID={`rec-${v}`}
                    style={[s.recChip, recurrence === v && s.recChipActive]}
                    onPress={() => setRecurrence(v)}
                  >
                    <Text style={[s.recChipText, recurrence === v && { color: "#fff" }]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {recurrence !== "none" && (
                <>
                  <Text style={s.mLabel}>Hasta (opcional, YYYY-MM-DD)</Text>
                  <TextInput
                    style={s.mInput}
                    value={until}
                    onChangeText={setUntil}
                    placeholder="2026-12-31"
                    placeholderTextColor={COLORS.textDisabled}
                    autoCapitalize="none"
                  />
                </>
              )}

              <TouchableOpacity testID="btn-create-event" style={[s.primary, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>CREAR EVENTO</Text>}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------- Event details modal (editable) ----------------
function EventDetailsModal({
  event, isAdmin, onClose, onChanged,
}: { event: EventT; isAdmin: boolean; onClose: () => void; onChanged: () => void }) {
  const [start, setStart] = useState<Date>(new Date(event.start_at));
  const [end, setEnd] = useState<Date>(new Date(event.end_at));
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description || "");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [attachments, setAttachments] = useState<any[]>(event.attachments || []);
  const [uploading, setUploading] = useState(false);
  const [managerId, setManagerId] = useState<string | null>(event.manager_id || null);
  const [managers, setManagers] = useState<Technician[]>([]);
  const [showManagerList, setShowManagerList] = useState(false);

  const m = event.material;

  useEffect(() => {
    if (isAdmin) {
      api.listManagers().then(setManagers).catch(() => {});
    }
  }, [isAdmin]);

  const doDelete = () => {
    Alert.alert("Eliminar evento", "¿Seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar", style: "destructive", onPress: async () => {
          try { await api.deleteEvent(event.id); onChanged(); }
          catch (e: any) { Alert.alert("Error", e.message); }
        },
      },
    ]);
  };

  const saveChanges = async () => {
    if (!title.trim()) { Alert.alert("Error", "El título no puede estar vacío"); return; }
    if (end <= start) { Alert.alert("Error", "La hora fin debe ser posterior a la hora inicio"); return; }
    setSaving(true);
    try {
      await api.updateEvent(event.id, {
        title: title.trim(),
        description: description || undefined,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        manager_id: managerId ?? null,
      } as any);
      onChanged();
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setSaving(false); }
  };

  const onPickerChange = (which: "date" | "startTime" | "endTime") => (_event: any, _picked?: Date) => {
    // retained for backward compat — no longer used (replaced by DateTimeField)
  };

  const pickAndUpload = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png", "image/jpg"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const file = res.assets[0];
      const mime = file.mimeType || (file.name?.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
      setUploading(true);
      let b64: string = "";

      // Cross-platform base64 read
      if (Platform.OS === "web") {
        // Expo-document-picker on web returns a File object
        const fileObj: Blob | undefined = (file as any).file;
        if (fileObj) {
          b64 = await blobToBase64(fileObj);
        } else if (file.uri?.startsWith("data:")) {
          b64 = file.uri.split(",")[1];
        } else if (file.uri?.startsWith("blob:")) {
          // Fetch the blob URL
          const resp = await fetch(file.uri);
          const blob = await resp.blob();
          b64 = await blobToBase64(blob);
        } else {
          throw new Error("No se pudo leer el archivo en web");
        }
      } else {
        if (file.uri.startsWith("data:")) {
          b64 = file.uri.split(",")[1];
        } else {
          b64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
        }
      }

      const sizeMB = (b64.length * 3) / 4 / (1024 * 1024);
      if (sizeMB > 15) { Alert.alert("Error", "El archivo excede 15 MB"); return; }
      const meta = await api.uploadEventAttachment(event.id, {
        filename: file.name || "archivo",
        mime_type: mime,
        base64: b64,
      });
      setAttachments((arr) => [...arr, meta]);
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo subir el archivo");
    } finally {
      setUploading(false);
    }
  };

  const openAttachment = async (aid: string) => {
    try {
      const data = await api.getEventAttachment(event.id, aid);
      if (Platform.OS === "web") {
        // Open in new tab via data URL
        const a = document.createElement("a");
        a.href = `data:${data.mime_type};base64,${data.base64}`;
        a.download = data.filename || "archivo";
        a.target = "_blank";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        // Save to cache and open
        const ext = (data.filename || "").split(".").pop() || (data.mime_type.includes("pdf") ? "pdf" : "jpg");
        const path = `${FileSystem.cacheDirectory}${aid}.${ext}`;
        await FileSystem.writeAsStringAsync(path, data.base64, { encoding: FileSystem.EncodingType.Base64 });
        // Use Linking or Sharing — simplest: try Linking
        const Linking = require("react-native").Linking;
        await Linking.openURL(path);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo abrir el archivo");
    }
  };

  const editWithPlanos = async (att: any) => {
    try {
      // Download the attachment
      const data = await api.getEventAttachment(event.id, att.id);
      // Create a plan linked back to this event + attachment
      const plan = await api.createPlan({
        title: `📐 ${att.filename}`,
        source_event_id: event.id,
        source_attachment_id: att.id,
        material_id: event.material_id || undefined,
      });
      // Upload the attachment as the plan background (backend converts PDF→PNG)
      await api.uploadBackground(plan.id, {
        file_base64: data.base64,
        mime_type: data.mime_type,
      });
      // Navigate to the plan editor
      // @ts-ignore
      const router = require("expo-router").router;
      router.push(`/planos/${plan.id}`);
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo abrir en Planos");
    }
  };

  const deleteAttachment = (aid: string, name: string) => {
    Alert.alert("Eliminar adjunto", `¿Eliminar "${name}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar", style: "destructive", onPress: async () => {
          try {
            await api.deleteEventAttachment(event.id, aid);
            setAttachments((arr) => arr.filter((a) => a.id !== aid));
          } catch (e: any) { Alert.alert("Error", e.message); }
        },
      },
    ]);
  };

  const fmtSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const iconForMime = (mt: string): any => {
    if (!mt) return "document";
    if (mt.includes("pdf")) return "document-text";
    if (mt.startsWith("image/")) return "image";
    return "document";
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.modalRoot}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            {editing ? (
              <TextInput
                testID="input-event-title"
                style={[s.mInput, { flex: 1, marginRight: 8, height: 44 }]}
                value={title}
                onChangeText={setTitle}
                placeholder="Título del evento"
                placeholderTextColor={COLORS.textDisabled}
              />
            ) : (
              <Text style={s.modalTitle} numberOfLines={2}>{title}</Text>
            )}
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={26} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {/* Date & Time row — cross-platform pickers */}
            <DateTimeField
              testID="picker-date"
              label="FECHA"
              mode="date"
              value={start}
              disabled={!isAdmin}
              onChange={(picked) => {
                const newStart = new Date(start); newStart.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
                const newEnd = new Date(end); newEnd.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
                setStart(newStart); setEnd(newEnd);
              }}
            />
            <View style={s.dtDouble}>
              <DateTimeField
                testID="picker-start"
                label="HORA INICIO"
                mode="time"
                value={start}
                disabled={!isAdmin}
                onChange={(picked) => {
                  const ns = new Date(start); ns.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
                  setStart(ns);
                  if (end <= ns) {
                    const ne = new Date(ns); ne.setMinutes(ne.getMinutes() + 60);
                    setEnd(ne);
                  }
                }}
              />
              <DateTimeField
                testID="picker-end"
                label="HORA FIN"
                mode="time"
                value={end}
                disabled={!isAdmin}
                onChange={(picked) => {
                  const ne = new Date(end); ne.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
                  setEnd(ne);
                }}
              />
            </View>

            {m && (
              <View style={s.matPreview}>
                <View style={{ flex: 1 }}>
                  <Text style={s.mLabel}>PROYECTO</Text>
                  <Text style={s.matCode}>{m.materiales || "—"}</Text>
                  <Text style={s.matCliente}>{m.cliente || "Sin cliente"}</Text>
                  {m.ubicacion && <Text style={s.matUbic}>📍 {m.ubicacion}</Text>}
                  {m.horas_prev && <Text style={s.matMeta}>⏱️ {m.horas_prev}h previstas</Text>}
                  {m.tecnico && <Text style={s.matMeta}>🔧 Técnico: {m.tecnico}</Text>}
                </View>
              </View>
            )}
            {event.assigned_users && event.assigned_users.length > 0 && (
              <>
                <Text style={s.mLabel}>Asignado a</Text>
                <View style={{ gap: 4 }}>
                  {event.assigned_users.map((u) => (
                    <View key={u.id} style={s.assignedRow}>
                      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: u.color || COLORS.primary }} />
                      <Text style={s.descText}>{u.name || u.email}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Gestor del proyecto */}
            <Text style={s.mLabel}>Gestor del proyecto</Text>
            {editing ? (
              <>
                <TouchableOpacity
                  testID="btn-pick-manager-edit"
                  style={s.pickMatBtn}
                  onPress={() => setShowManagerList((v) => !v)}
                >
                  <Ionicons name="person-circle-outline" size={20} color={COLORS.primary} />
                  <Text style={{ color: managerId ? COLORS.navy : COLORS.primary, fontWeight: "700", flex: 1 }} numberOfLines={1}>
                    {managerId
                      ? (managers.find((m) => m.id === managerId)?.name || event.manager?.name || "Gestor")
                      : "Seleccionar gestor (admin)"}
                  </Text>
                  <Ionicons name={showManagerList ? "chevron-up" : "chevron-down"} size={18} color={COLORS.primary} />
                </TouchableOpacity>
                {showManagerList && (
                  <View style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, marginTop: 6, overflow: "hidden" }}>
                    <TouchableOpacity
                      testID="manager-edit-none"
                      style={[s.techRow, { borderRadius: 0, borderWidth: 0, borderBottomWidth: 1, borderBottomColor: COLORS.border }]}
                      onPress={() => { setManagerId(null); setShowManagerList(false); }}
                    >
                      <View style={[s.checkBox, !managerId && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}>
                        {!managerId && <Ionicons name="checkmark" size={16} color="#fff" />}
                      </View>
                      <Text style={[s.techName, { color: COLORS.textSecondary, fontStyle: "italic" }]}>— Sin gestor —</Text>
                    </TouchableOpacity>
                    {managers.length === 0 ? (
                      <View style={{ padding: 12 }}>
                        <Text style={{ color: COLORS.textSecondary, fontStyle: "italic" }}>No hay administradores disponibles</Text>
                      </View>
                    ) : managers.map((mgr) => {
                      const on = managerId === mgr.id;
                      return (
                        <TouchableOpacity
                          key={mgr.id}
                          testID={`manager-edit-${mgr.id}`}
                          style={[s.techRow, { borderRadius: 0, borderWidth: 0, borderBottomWidth: 1, borderBottomColor: COLORS.border }, on && { backgroundColor: "#DBEAFE" }]}
                          onPress={() => { setManagerId(mgr.id); setShowManagerList(false); }}
                        >
                          <View style={[s.checkBox, on && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}>
                            {on && <Ionicons name="checkmark" size={16} color="#fff" />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.techName}>{mgr.name}</Text>
                            <Text style={s.techEmail}>{mgr.email}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </>
            ) : (
              event.manager ? (
                <View style={s.assignedRow}>
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: event.manager.color || COLORS.primary }} />
                  <Text style={s.descText}>🧑‍💼 {event.manager.name || event.manager.email}</Text>
                </View>
              ) : (
                <Text style={[s.descText, { color: COLORS.textDisabled }]}>Sin gestor asignado</Text>
              )
            )}

            {event.recurrence && event.recurrence.type !== "none" && (
              <>
                <Text style={s.mLabel}>Repetición</Text>
                <Text style={s.descText}>
                  {event.recurrence.type === "daily" ? "🔁 Cada día"
                    : event.recurrence.type === "weekly" ? "🔁 Cada semana"
                    : "🔁 Cada mes"}
                  {event.recurrence.until ? ` · hasta ${event.recurrence.until}` : ""}
                </Text>
              </>
            )}

            <Text style={s.mLabel}>Notas</Text>
            {editing ? (
              <TextInput
                testID="input-event-description"
                style={[s.mInput, { height: 80, paddingTop: 10 }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Notas adicionales..."
                multiline
                textAlignVertical="top"
                placeholderTextColor={COLORS.textDisabled}
              />
            ) : (
              description ? (
                <Text style={s.descText}>{description}</Text>
              ) : (
                <Text style={[s.descText, { color: COLORS.textDisabled }]}>Sin notas</Text>
              )
            )}

            {/* Attachments */}
            <Text style={s.mLabel}>Archivos adjuntos</Text>
            {attachments.length === 0 ? (
              <Text style={[s.descText, { color: COLORS.textDisabled }]}>Sin archivos</Text>
            ) : (
              <View style={{ gap: 6 }}>
                {attachments.map((a) => {
                  const canEditInPlanos = (a.mime_type || "").toLowerCase().includes("pdf") || (a.mime_type || "").toLowerCase().startsWith("image/");
                  return (
                  <View key={a.id} style={s.attRow}>
                    <TouchableOpacity
                      testID={`attachment-${a.id}`}
                      style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}
                      onPress={() => openAttachment(a.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={iconForMime(a.mime_type)} size={22} color={COLORS.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.attName} numberOfLines={1}>{a.filename}</Text>
                        <Text style={s.attMeta}>{fmtSize(a.size)} · {a.mime_type}</Text>
                      </View>
                    </TouchableOpacity>
                    {canEditInPlanos && (
                      <TouchableOpacity
                        testID={`attachment-edit-${a.id}`}
                        hitSlop={8}
                        style={{ padding: 4 }}
                        onPress={() => editWithPlanos(a)}
                      >
                        <Ionicons name="create-outline" size={20} color={COLORS.primary} />
                      </TouchableOpacity>
                    )}
                    {isAdmin && (
                      <TouchableOpacity hitSlop={10} style={{ padding: 4 }} onPress={() => deleteAttachment(a.id, a.filename)}>
                        <Ionicons name="trash-outline" size={18} color={COLORS.errorText} />
                      </TouchableOpacity>
                    )}
                  </View>
                  );
                })}
              </View>
            )}
            <TouchableOpacity
              testID="btn-add-attachment"
              style={[s.pickMatBtn, { marginTop: 8 }, uploading && { opacity: 0.6 }]}
              onPress={pickAndUpload}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <>
                  <Ionicons name="attach" size={20} color={COLORS.primary} />
                  <Text style={{ color: COLORS.primary, fontWeight: "700" }}>Añadir PDF o imagen</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={[s.mLabel, { marginTop: 16 }]}>Creado por</Text>
            <Text style={s.descText}>{event.created_by}</Text>

            {isAdmin && (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 20 }}>
                {editing ? (
                  <>
                    <TouchableOpacity
                      testID="btn-cancel-edit"
                      style={[s.primary, { flex: 1, backgroundColor: COLORS.bg, borderWidth: 2, borderColor: COLORS.borderInput }]}
                      onPress={() => {
                        setEditing(false);
                        setTitle(event.title); setDescription(event.description || "");
                        setStart(new Date(event.start_at)); setEnd(new Date(event.end_at));
                      }}
                    >
                      <Text style={[s.primaryText, { color: COLORS.navy }]}>CANCELAR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity testID="btn-save-event" style={[s.primary, { flex: 1 }, saving && { opacity: 0.6 }]} onPress={saveChanges} disabled={saving}>
                      {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>GUARDAR</Text>}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity testID="btn-edit-event" style={[s.primary, { flex: 1 }]} onPress={() => setEditing(true)}>
                      <Ionicons name="create-outline" size={18} color="#fff" />
                      <Text style={s.primaryText}> EDITAR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity testID="btn-delete-event" style={[s.primary, { flex: 1, backgroundColor: COLORS.errorText }]} onPress={doDelete}>
                      <Ionicons name="trash" size={18} color="#fff" />
                      <Text style={s.primaryText}> ELIMINAR</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  headerSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, textTransform: "capitalize" },
  viewSelector: {
    flexDirection: "row", gap: 6, padding: 8, backgroundColor: COLORS.surface,
  },
  viewChip: {
    flex: 1, height: 40, borderRadius: 10, backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 6,
  },
  viewChipActive: { backgroundColor: COLORS.primary },
  viewChipText: { fontSize: 13, fontWeight: "800", color: COLORS.navy, letterSpacing: 0.3 },
  navRow: {
    flexDirection: "row", gap: 8, paddingHorizontal: 8, paddingBottom: 8, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  navBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.bg, borderRadius: 8, paddingVertical: 8, gap: 4,
  },
  dayHeaderRow: {
    flexDirection: "row", backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  dayHeader: {
    flex: 1, alignItems: "center", paddingVertical: 8,
    borderLeftWidth: 1, borderLeftColor: COLORS.border,
  },
  dayHeaderToday: { backgroundColor: "#DBEAFE" },
  dayLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: "800", letterSpacing: 1 },
  dayNum: { fontSize: 18, fontWeight: "700", color: COLORS.text, marginTop: 2 },
  dayNumBig: { fontSize: 34, fontWeight: "900", color: COLORS.text, marginTop: 2 },
  dayFullHeader: {
    alignItems: "center", paddingVertical: 14, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  gridRow: { flexDirection: "row" },
  hourLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: "600", paddingRight: 6, textAlign: "right", marginTop: -6, marginLeft: 4 },
  hourLine: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: COLORS.border },
  halfHourLine: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: COLORS.border, opacity: 0.4 },
  nowLine: { position: "absolute", left: 0, right: 0, height: 2, backgroundColor: "#EF4444", zIndex: 5 },
  nowDot: { position: "absolute", left: -4, top: -4, width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444" },
  eventBox: {
    position: "absolute", left: 2, right: 2, borderRadius: 6,
    padding: 4, borderLeftWidth: 3, overflow: "hidden",
  },
  eventTitle: { fontSize: 11, fontWeight: "800", color: COLORS.navy },
  eventTime: { fontSize: 10, color: COLORS.textSecondary, marginTop: 1 },
  eventMeta: { fontSize: 10, color: COLORS.textSecondary, marginTop: 1 },
  eventAssignee: { fontSize: 10, fontWeight: "700", marginBottom: 1 },
  eventManager: { fontSize: 10, fontWeight: "600", color: COLORS.textSecondary, marginTop: 2, fontStyle: "italic" },
  resizeHandle: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: 14,
    alignItems: "center", justifyContent: "center",
    // @ts-ignore web cursor
    cursor: "ns-resize",
  },
  resizeHandleTop: {
    position: "absolute", top: 0, left: 0, right: 0, height: 14,
    alignItems: "center", justifyContent: "center",
    // @ts-ignore web cursor
    cursor: "ns-resize",
  },
  resizeBar: { width: 28, height: 4, borderRadius: 2, backgroundColor: COLORS.primary, opacity: 0.6 },
  dragPreview: {
    position: "absolute", left: 2, right: 2, backgroundColor: "rgba(30,136,229,0.3)",
    borderWidth: 2, borderColor: COLORS.primary, borderRadius: 6,
    alignItems: "center", justifyContent: "center",
  },
  dragPreviewText: { fontSize: 11, fontWeight: "800", color: COLORS.primary },
  // month
  monthHeader: { flexDirection: "row", marginBottom: 4 },
  monthHeaderCell: { flex: 1, alignItems: "center", paddingVertical: 6 },
  monthHeaderText: { fontSize: 11, fontWeight: "800", color: COLORS.textSecondary, letterSpacing: 1 },
  monthRow: { flexDirection: "row", marginBottom: 6 },
  monthCell: {
    flex: 1, minHeight: 70, margin: 2, padding: 6,
    backgroundColor: COLORS.surface, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  monthCellToday: { borderColor: COLORS.primary, borderWidth: 2 },
  monthDayNum: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  monthDots: { flexDirection: "row", flexWrap: "wrap", gap: 3, marginTop: 4, alignItems: "center" },
  monthDot: { width: 7, height: 7, borderRadius: 3.5 },
  monthMoreText: { fontSize: 9, color: COLORS.textSecondary, fontWeight: "700", marginLeft: 2 },
  // modal
  modalRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalCard: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, maxHeight: "85%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: "900", color: COLORS.text, flex: 1, marginRight: 12 },
  timeBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, backgroundColor: COLORS.bg, borderRadius: 10, marginVertical: 8 },
  timeText: { fontSize: 13, fontWeight: "700", color: COLORS.text, textTransform: "capitalize" },
  modeRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  modeChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 48, borderRadius: 10, backgroundColor: COLORS.bg, borderWidth: 2, borderColor: COLORS.borderInput },
  modeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modeChipText: { fontSize: 13, fontWeight: "800", color: COLORS.navy },
  mLabel: { fontSize: 11, fontWeight: "800", color: COLORS.textSecondary, letterSpacing: 1.2, marginTop: 14, marginBottom: 6 },
  mInput: { height: 50, backgroundColor: COLORS.bg, borderWidth: 2, borderColor: COLORS.borderInput, borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: COLORS.text },
  primary: { flexDirection: "row", height: 52, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", marginTop: 20 },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  pickMatBtn: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", height: 52, borderRadius: 10, borderWidth: 2, borderColor: COLORS.primary, borderStyle: "dashed", backgroundColor: COLORS.bg },
  backRow: { flexDirection: "row", alignItems: "center", gap: 4, padding: 6, marginBottom: 4 },
  backRowText: { color: COLORS.navy, fontWeight: "700", fontSize: 14 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.bg, borderRadius: 10, paddingHorizontal: 12, height: 44, marginBottom: 6 },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text },
  matRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, backgroundColor: COLORS.bg, borderRadius: 10, marginBottom: 6 },
  matPreview: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, backgroundColor: COLORS.bg, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, marginTop: 6 },
  matCode: { fontSize: 12, fontWeight: "800", color: COLORS.primary, letterSpacing: 0.3, fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) },
  matCliente: { fontSize: 14, fontWeight: "700", color: COLORS.text, marginTop: 2 },
  matUbic: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  matMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  descText: { fontSize: 14, color: COLORS.text, lineHeight: 20, marginTop: 4 },
  techRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 10, borderRadius: 10, backgroundColor: COLORS.bg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  checkBox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: COLORS.borderInput, alignItems: "center", justifyContent: "center",
  },
  techName: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  techEmail: { fontSize: 11, color: COLORS.textSecondary },
  recChip: {
    paddingHorizontal: 14, height: 40, borderRadius: 8, backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: COLORS.borderInput,
  },
  recChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  recChipText: { fontSize: 13, fontWeight: "800", color: COLORS.navy },
  assignedRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 8, backgroundColor: COLORS.bg, borderRadius: 8,
  },
  dtRow: { marginTop: 8 },
  dtDouble: { flexDirection: "row", gap: 8 },
  dtBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, height: 46,
    borderRadius: 10, backgroundColor: COLORS.bg, borderWidth: 2,
    borderColor: COLORS.borderInput, paddingHorizontal: 12,
  },
  dtBtnText: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  attRow: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 10,
    borderRadius: 10, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
  },
  attName: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  attMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
});
