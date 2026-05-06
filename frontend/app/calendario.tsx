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
import { useThemedStyles } from "../src/theme";
import ResponsiveLayout from "../src/ResponsiveLayout";
import { useBreakpoint } from "../src/useBreakpoint";
import DateTimeField from "../src/DateTimeField";
import NotificationsBell from "../src/NotificationsBell";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";

const HOUR_START = 7;
const HOUR_END = 20;
const HOURS = HOUR_END - HOUR_START;
const HOUR_H = 56;
const TIME_COL_W = 52;
const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie"];
const DAY_LABELS_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const DAY_LABELS_MONTH = ["L", "M", "X", "J", "V", "S", "D"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

type ViewMode = "day" | "week" | "month" | "multi";
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
  status?: string;          // in_progress | completed | pending_completion
  seguimiento?: string;
  budget_id?: string | null;
  hours?: number | null;
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
  const params = useLocalSearchParams<{ openEvent?: string; from?: string }>();
  const [me, setMe] = useState<any>(null);
  const s = useThemedStyles(useS);
  const [view, setViewState] = useState<ViewMode>("week");
  const setView = (v: ViewMode) => {
    setViewState(v);
    AsyncStorage.setItem("cal_view", v).catch(() => {});
  };

  // Restore persisted view and user filter on mount
  useEffect(() => {
    AsyncStorage.getItem("cal_view").then((v) => {
      if (v === "day" || v === "week" || v === "month" || v === "multi") setViewState(v);
    }).catch(() => {});
  }, []);
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [events, setEvents] = useState<EventT[]>([]);
  const [loading, setLoading] = useState(true);
  const [createRange, setCreateRange] = useState<{ day: Date; startMin: number; endMin: number } | null>(null);
  const [openEvent, setOpenEvent] = useState<EventT | null>(null);
  const [copiedEvent, setCopiedEvent] = useState<EventT | null>(null);

  // User filter: list of all users + set of disabled user IDs (excluded)
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; email: string; color?: string }[]>([]);
  const [disabledUserIds, setDisabledUserIds] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);

  // Notifications state (bell icon in header + modal list).
  type Notif = {
    id: string; title: string; message: string; read: boolean; created_at: string;
    event_id?: string; from_user_name?: string; type?: string;
  };
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showNotifications, setShowNotifications] = useState(false);

  // Load / refresh notifications. Polled every 60 s while the screen is
  // open so new arrivals show up without a manual refresh.
  const loadNotifications = async () => {
    try {
      const res = await api.listNotifications();
      setNotifications(res.items || []);
      setUnreadCount(res.unread || 0);
    } catch {}
  };
  useEffect(() => {
    loadNotifications();
    const t = setInterval(loadNotifications, 60000);
    return () => clearInterval(t);
  }, []);

  // Load user list (admins only — others see only their own events anyway).
  useEffect(() => {
    if (me?.role !== "admin") return;
    (async () => {
      try {
        const list = await api.listTechnicians();
        setAllUsers(list || []);
        // Hydrate persisted selection
        try {
          const raw = await AsyncStorage.getItem("cal_user_filter_v1");
          if (raw) setDisabledUserIds(new Set(JSON.parse(raw)));
        } catch {}
      } catch {}
    })();
  }, [me?.role]);

  const persistFilter = useCallback((s: Set<string>) => {
    AsyncStorage.setItem("cal_user_filter_v1", JSON.stringify(Array.from(s))).catch(() => {});
  }, []);

  const toggleUser = (uid: string) => {
    setDisabledUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      persistFilter(next);
      return next;
    });
  };
  const selectAll = () => { const n = new Set<string>(); setDisabledUserIds(n); persistFilter(n); };
  const selectNone = () => { const n = new Set<string>(allUsers.map((u) => u.id)); setDisabledUserIds(n); persistFilter(n); };

  // Apply user filter AND expand each event into one visual card per
  // assigned technician. This way, if an event has two assignees, it shows
  // up TWICE in the calendar (each with its own color/name) so every tech
  // gets their own lane. The base event id is preserved as the id prefix
  // (everything before "::u:") so edits/moves/deletes still hit the one
  // real record in MongoDB.
  const filteredEvents = useMemo(() => {
    const adminRole = me?.role === "admin";
    const out: EventT[] = [];
    for (const ev of events) {
      const ids = ev.assigned_user_ids || [];
      // Defensive: if the backend didn't populate `assigned_users` for
      // some reason (older client, stale cache, etc.) we rebuild a minimal
      // user list from the ids so the visual split still happens.
      let users = ev.assigned_users || [];
      if (users.length === 0 && ids.length > 0) {
        users = ids.map((id) => ({ id, email: id, name: undefined as any, color: undefined as any }));
      }
      // Admin filter: hide events whose every assignee is disabled.
      if (adminRole && disabledUserIds.size > 0 && ids.length > 0) {
        if (!ids.some((id) => !disabledUserIds.has(id))) continue;
      }
      if (users.length <= 1) {
        // 0 or 1 assignees → no expansion needed.
        out.push(ev);
        continue;
      }
      // Multiple assignees → one virtual card per user. Hide the ones
      // whose user is disabled via the admin user-filter.
      for (const u of users) {
        if (adminRole && disabledUserIds.has(u.id)) continue;
        out.push({
          ...ev,
          id: `${ev.id}::u:${u.id}`,
          assigned_user_ids: [u.id],
          assigned_users: [u],
        });
      }
    }
    return out;
  }, [events, disabledUserIds, me?.role]);

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
    else if (view === "week" || view === "multi") setAnchor(addDays(anchor, -7));
    else setAnchor(addMonths(anchor, -1));
  };
  const stepForward = () => {
    if (view === "day") setAnchor(addDays(anchor, 1));
    else if (view === "week" || view === "multi") setAnchor(addDays(anchor, 7));
    else setAnchor(addMonths(anchor, 1));
  };

  // If we arrived with ?openEvent=..., open that event's modal automatically.
  // We first try to find it inside the currently-loaded events. If it is not
  // there (typical when the event lives in another week/month), we fetch it
  // directly via the API and ALSO move the anchor so the user lands on that
  // event's week after closing the modal.
  useEffect(() => {
    if (!params.openEvent) return;
    const raw = String(params.openEvent);
    const targetId = raw.split(":")[0];
    const match = events.find((e) => e.id.split(":")[0] === targetId);
    if (match) {
      setOpenEvent(match);
      // @ts-ignore: setParams may not exist in older versions
      router.setParams?.({ openEvent: undefined });
      return;
    }
    // Not in the currently-loaded range → fetch it directly.
    let cancelled = false;
    (async () => {
      try {
        const ev = await api.getEvent(targetId);
        if (cancelled || !ev) return;
        setOpenEvent(ev);
        // Jump the visible range to the event's date so it is shown in
        // context when the user closes the modal.
        try {
          const d = new Date(ev.start_at);
          if (!isNaN(d.getTime())) setAnchor(d);
        } catch {}
      } catch (err: any) {
        if (cancelled) return;
        const msg = String(err?.message || "");
        // Event was deleted → friendly feedback instead of silent no-op.
        if (/404|no encontrado|not found/i.test(msg)) {
          if (Platform.OS === "web") {
            // @ts-ignore window exists on web
            if (typeof window !== "undefined") window.alert("Este evento ya no existe. La notificación se eliminará.");
          } else {
            Alert.alert("Evento no encontrado", "Este evento ya no existe. La notificación se eliminará.");
          }
          // Clean up all stale notifications referencing this deleted event.
          try {
            const res = await api.listNotifications();
            const stale = (res.items || []).filter((n: any) => (n.event_id || "").split(":")[0] === targetId);
            await Promise.all(stale.map((n: any) => api.deleteNotification(n.id).catch(() => {})));
          } catch {}
        }
      } finally {
        // @ts-ignore: setParams may not exist in older versions
        router.setParams?.({ openEvent: undefined });
      }
    })();
    return () => { cancelled = true; };
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
    if (view === "multi") {
      const s = mondayOf(anchor);
      return `${fmtRange(s, addDays(s, 4))} · Equipo`;
    }
    return `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
  }, [view, anchor]);

  const moveEvent = async (ev: EventT, newStart: Date, newEnd: Date) => {
    // Strip any virtual suffixes (":recurrence-date" and/or "::u:<userId>")
    // to get the real MongoDB id.
    const baseId = String(ev.id).split("::u:")[0].split(":")[0];
    // Optimistic update — also update any other virtual copies of the same
    // base event so all per-technician cards move together on screen.
    setEvents((arr) => arr.map((e) => {
      const eBase = String(e.id).split("::u:")[0].split(":")[0];
      return eBase === baseId ? { ...e, start_at: newStart.toISOString(), end_at: newEnd.toISOString() } : e;
    }));
    try {
      await api.updateEvent(baseId, { start_at: newStart.toISOString(), end_at: newEnd.toISOString() });
    } catch (e: any) {
      Alert.alert("Error", e.message);
      load();
    }
  };

  // When a per-technician virtual card is tapped, resolve the real event
  // from the underlying events[] so the modal edits the correct row.
  const openTappedEvent = (ev: EventT) => {
    const baseId = String(ev.id).split("::u:")[0].split(":")[0];
    const real = events.find((e) => String(e.id).split(":")[0] === baseId) || ev;
    setOpenEvent(real);
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
        {/* Shared bell (header) — same behaviour as the one in Inicio. */}
        <NotificationsBell style={{ marginLeft: 4 }} />
      </View>

      {/* View selector */}
      <View style={s.viewSelector}>
        {(["day", "week", "multi", "month"] as ViewMode[]).map((v) => (
          <TouchableOpacity
            key={v}
            testID={`view-${v}`}
            style={[s.viewChip, view === v && s.viewChipActive]}
            onPress={() => setView(v)}
          >
            <Ionicons
              name={v === "day" ? "today-outline" : v === "week" ? "calendar-outline" : v === "multi" ? "people-outline" : "grid-outline"}
              size={16}
              color={view === v ? "#fff" : COLORS.navy}
            />
            <Text style={[s.viewChipText, view === v && { color: "#fff" }]}>
              {v === "day" ? "Día" : v === "week" ? "Semana" : v === "multi" ? "Equipo" : "Mes"}
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
        {isAdmin && (
          <View style={{ marginLeft: 8, position: "relative", zIndex: 100 }}>
            <TouchableOpacity
              testID="btn-user-filter"
              style={[
                s.navBtn,
                { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12 },
                disabledUserIds.size > 0 && { backgroundColor: COLORS.highlightBg, borderColor: COLORS.primary },
              ]}
              onPress={() => setFilterOpen((v) => !v)}
            >
              <Ionicons name="people" size={18} color={COLORS.primary} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.navy }}>
                Usuarios
                {disabledUserIds.size > 0 ? ` (${allUsers.length - disabledUserIds.size}/${allUsers.length})` : ""}
              </Text>
              <Ionicons name={filterOpen ? "chevron-up" : "chevron-down"} size={16} color={COLORS.primary} />
            </TouchableOpacity>
            {filterOpen && (
              <View style={s.userFilterDropdown}>
                <View style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
                  <TouchableOpacity style={s.filterMiniBtn} onPress={selectAll}>
                    <Text style={s.filterMiniBtnTxt}>Todos</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.filterMiniBtn} onPress={selectNone}>
                    <Text style={s.filterMiniBtnTxt}>Ninguno</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={{ maxHeight: 320 }} nestedScrollEnabled>
                  {allUsers.map((u) => {
                    const on = !disabledUserIds.has(u.id);
                    return (
                      <TouchableOpacity
                        key={u.id}
                        testID={`filter-user-${u.id}`}
                        style={s.userFilterRow}
                        onPress={() => toggleUser(u.id)}
                      >
                        <View style={[s.checkSmall, on && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}>
                          {on && <Ionicons name="checkmark" size={12} color="#fff" />}
                        </View>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: u.color || COLORS.primary }} />
                        <Text style={{ flex: 1, fontSize: 13, color: COLORS.text }} numberOfLines={1}>{u.name || u.email}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : view === "month" ? (
        <MonthView
          anchor={anchor}
          events={filteredEvents}
          onSelectDay={(d) => { setAnchor(d); setView("day"); }}
        />
      ) : view === "day" ? (
        <DayView
          day={anchor}
          events={filteredEvents.filter((e) => sameDay(new Date(e.start_at), anchor))}
          isAdmin={isAdmin}
          isToday={sameDay(anchor, now)}
          onCreate={(startMin, endMin) => setCreateRange({ day: anchor, startMin, endMin })}
          onTapEvent={openTappedEvent}
          onMoveEvent={moveEvent}
          onCopyEvent={setCopiedEvent}
        />
      ) : view === "multi" ? (
        <MultiView
          weekStart={mondayOf(anchor)}
          events={filteredEvents}
          isAdmin={isAdmin}
          now={now}
          onCreate={(day, startMin, endMin) => setCreateRange({ day, startMin, endMin })}
          onTapEvent={openTappedEvent}
          onMoveEvent={moveEvent}
          onSelectDay={(d) => { setAnchor(d); setView("day"); }}
          users={allUsers}
          disabledUserIds={disabledUserIds}
        />
      ) : (
        <WeekView
          weekStart={mondayOf(anchor)}
          events={filteredEvents}
          isAdmin={isAdmin}
          now={now}
          onCreate={(day, startMin, endMin) => setCreateRange({ day, startMin, endMin })}
          onTapEvent={openTappedEvent}
          onMoveEvent={moveEvent}
          onCopyEvent={setCopiedEvent}
          onSelectDay={(d) => { setAnchor(d); setView("day"); }}
        />
      )}

      {createRange && (
        <CreateEventModal
          visible={!!createRange}
          range={createRange}
          onClose={() => setCreateRange(null)}
          onDone={() => { setCreateRange(null); setCopiedEvent(null); load(); }}
          copiedEvent={copiedEvent}
        />
      )}
      {openEvent && (
        <EventDetailsModal
          event={openEvent}
          isAdmin={isAdmin}
          onClose={() => { setOpenEvent(null); if (params.from === "project") router.back(); }}
          onChanged={() => { load(); setOpenEvent(null); setCopiedEvent(null); if (params.from === "project") router.back(); }}
          onCopy={setCopiedEvent}
        />
      )}

      {/* Notifications modal (bell drawer). */}
      <Modal visible={showNotifications} transparent animationType="slide" onRequestClose={() => setShowNotifications(false)}>
        <View style={s.notifSheetRoot}>
          <View style={s.notifSheet}>
            <View style={s.notifHeader}>
              <View>
                <Text style={s.notifTitle}>Notificaciones</Text>
                <Text style={s.notifSub}>{unreadCount} sin leer</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {unreadCount > 0 && (
                  <TouchableOpacity
                    testID="btn-mark-all-read"
                    style={s.notifHdrBtn}
                    onPress={async () => {
                      try { await api.markAllNotificationsRead(); } catch {}
                      loadNotifications();
                    }}
                  >
                    <Text style={{ color: COLORS.primary, fontWeight: "800", fontSize: 12 }}>Marcar todas</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowNotifications(false)}>
                  <Ionicons name="close" size={26} color={COLORS.text} />
                </TouchableOpacity>
              </View>
            </View>
            {notifications.length === 0 ? (
              <View style={{ padding: 30, alignItems: "center" }}>
                <Ionicons name="notifications-off-outline" size={36} color={COLORS.textDisabled} />
                <Text style={{ color: COLORS.textSecondary, marginTop: 8, fontWeight: "700" }}>Sin notificaciones</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ padding: 12, gap: 8 }}>
                {notifications.map((n) => {
                  const isCompleted = n.type === "event_completed";
                  const isPending = n.type === "event_pending_completion";
                  const accent = isPending ? "#F59E0B" : isCompleted ? "#10B981" : COLORS.primary;
                  return (
                    <TouchableOpacity
                      key={n.id}
                      style={[s.notifItem, !n.read && { borderLeftColor: accent, borderLeftWidth: 4, backgroundColor: COLORS.primarySoft }]}
                      onPress={async () => {
                        if (!n.read) {
                          try { await api.markNotificationRead(n.id); } catch {}
                          loadNotifications();
                        }
                        if (n.event_id) {
                          // Try to navigate to the referenced event if it's in view.
                          const ev = events.find((e) => e.id === n.event_id);
                          if (ev) { setOpenEvent(ev); setShowNotifications(false); }
                        }
                      }}
                    >
                      <View style={[s.notifDot, { backgroundColor: accent }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.notifItemTitle}>{n.title}</Text>
                        <Text style={s.notifItemMsg} numberOfLines={3}>{n.message}</Text>
                        <Text style={s.notifItemDate}>
                          {new Date(n.created_at).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </Text>
                      </View>
                      <TouchableOpacity
                        hitSlop={10}
                        onPress={async (e) => {
                          e?.stopPropagation?.();
                          try { await api.deleteNotification(n.id); } catch {}
                          loadNotifications();
                        }}
                      >
                        <Ionicons name="close-circle-outline" size={18} color={COLORS.textDisabled} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      </SafeAreaView>
    </ResponsiveLayout>
  );
}

// ---------------- Month view ----------------
function MonthView({
  anchor, events, onSelectDay,
}: { anchor: Date; events: EventT[]; onSelectDay: (d: Date) => void }) {
  const s = useThemedStyles(useS);
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
  weekStart, events, isAdmin, now, onCreate, onTapEvent, onMoveEvent, onSelectDay, onCopyEvent,
}: {
  weekStart: Date; events: EventT[]; isAdmin: boolean; now: Date;
  onCreate: (day: Date, startMin: number, endMin: number) => void;
  onTapEvent: (e: EventT) => void;
  onMoveEvent: (ev: EventT, s: Date, e: Date) => Promise<void>;
  onSelectDay?: (d: Date) => void;
  onCopyEvent?: (e: EventT) => void;
}) {
  const s = useThemedStyles(useS);
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
              onCopyEvent={onCopyEvent}
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

// ---------------- Multi-view (each visible user gets a week column) ----------------
function MultiView({
  weekStart, events, isAdmin, now, onCreate, onTapEvent, onMoveEvent, onSelectDay,
  users, disabledUserIds,
}: {
  weekStart: Date; events: EventT[]; isAdmin: boolean; now: Date;
  onCreate: (day: Date, startMin: number, endMin: number) => void;
  onTapEvent: (e: EventT) => void;
  onMoveEvent: (ev: EventT, s: Date, e: Date) => Promise<void>;
  onSelectDay: (d: Date) => void;
  users: { id: string; name: string; email: string; color?: string }[];
  disabledUserIds: Set<string>;
}) {
  const s = useThemedStyles(useS);
  const visibleUsers = users.filter((u) => !disabledUserIds.has(u.id));

  return (
    <View style={{ flex: 1 }}>
      {/* Scrollable user columns */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 0 }}
      >
        {visibleUsers.length === 0 ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <Text style={{ color: COLORS.textSecondary }}>No hay usuarios visibles</Text>
          </View>
        ) : visibleUsers.map((user) => {
          const thisUserEvents = events.filter((ev) => (ev.assigned_user_ids || []).includes(user.id));
          return (
            <View key={user.id} style={{ width: 320, borderRightWidth: 1, borderRightColor: COLORS.border }}>
              {/* User header */}
              <View style={{ paddingHorizontal: 8, paddingVertical: 6, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: user.color || COLORS.primary }} />
                  <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.text }} numberOfLines={1}>{user.name || user.email}</Text>
                </View>
              </View>
              {/* Week column for this user */}
              <View style={{ flex: 1 }}>
                <WeekView
                  weekStart={weekStart}
                  events={thisUserEvents}
                  isAdmin={isAdmin}
                  now={now}
                  onCreate={onCreate}
                  onTapEvent={onTapEvent}
                  onMoveEvent={onMoveEvent}
                  onSelectDay={onSelectDay}
                />
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ---------------- Day view ----------------
function DayView({
  day, events, isAdmin, isToday, onCreate, onTapEvent, onMoveEvent, onCopyEvent,
}: {
  day: Date; events: EventT[]; isAdmin: boolean; isToday: boolean;
  onCreate: (startMin: number, endMin: number) => void;
  onTapEvent: (e: EventT) => void;
  onMoveEvent: (ev: EventT, s: Date, e: Date) => Promise<void>;
  onCopyEvent?: (e: EventT) => void;
}) {
  const s = useThemedStyles(useS);
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
          onCopyEvent={onCopyEvent}
          isToday={isToday}
          nowY={nowY}
          compact={false}
        />
      </View>
    </ScrollView>
  );
}


/**
 * Column layout for overlapping events: returns eventId -> { col, total, span }.
 * - `col`: 0-based column index within the cluster.
 * - `total`: number of columns needed for the cluster.
 * - `span`: how many columns the event can occupy (col..col+span-1) without
 *           overlapping any other event. This lets each event expand to fill
 *           empty space on its right instead of staying stuck at 1/total.
 */
function layoutEventColumns(
  events: EventT[]
): Map<string, { col: number; total: number; span: number }> {
  const result = new Map<string, { col: number; total: number; span: number }>();
  if (!events.length) return result;
  const sorted = [...events].sort((a, b) => {
    const sa = new Date(a.start_at).getTime();
    const sb = new Date(b.start_at).getTime();
    if (sa !== sb) return sa - sb;
    return new Date(b.end_at).getTime() - new Date(a.end_at).getTime();
  });
  let cluster: EventT[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    if (!cluster.length) return;
    // 1) Assign columns (greedy)
    const colEnds: number[] = [];
    const colOf = new Map<string, number>();
    for (const e of cluster) {
      const s = new Date(e.start_at).getTime();
      const en = new Date(e.end_at).getTime();
      let col = -1;
      for (let i = 0; i < colEnds.length; i++) {
        if (colEnds[i] <= s) { col = i; break; }
      }
      if (col === -1) { col = colEnds.length; colEnds.push(en); }
      else { colEnds[col] = en; }
      colOf.set(e.id, col);
    }
    const total = Math.max(1, colEnds.length);
    // 2) Compute span: how many columns can this event expand into?
    //    Build a map col -> list of events in that column for quick lookup.
    const byCol = new Map<number, EventT[]>();
    for (const e of cluster) {
      const c = colOf.get(e.id) ?? 0;
      if (!byCol.has(c)) byCol.set(c, []);
      byCol.get(c)!.push(e);
    }
    const overlaps = (a: EventT, b: EventT) => {
      const as = new Date(a.start_at).getTime();
      const ae = new Date(a.end_at).getTime();
      const bs = new Date(b.start_at).getTime();
      const be = new Date(b.end_at).getTime();
      return as < be && bs < ae;
    };
    for (const e of cluster) {
      const c = colOf.get(e.id) ?? 0;
      let span = 1;
      for (let nc = c + 1; nc < total; nc++) {
        const others = byCol.get(nc) || [];
        if (others.some((o) => overlaps(e, o))) break;
        span++;
      }
      result.set(e.id, { col: c, total, span });
    }
    cluster = [];
  };
  for (const e of sorted) {
    const s = new Date(e.start_at).getTime();
    const en = new Date(e.end_at).getTime();
    if (cluster.length === 0 || s < clusterEnd) {
      cluster.push(e);
      clusterEnd = Math.max(clusterEnd, en);
    } else {
      flush();
      cluster = [e];
      clusterEnd = en;
    }
  }
  flush();
  return result;
}


// ---------------- DayColumn (with draggable events) ----------------
function DayColumn({
  day, events, isAdmin, onCreate, onTapEvent, onMoveEvent, onCopyEvent, isToday, nowY, compact,
  weekDays, colW, dayIndex,
}: {
  day: Date; events: EventT[]; isAdmin: boolean;
  onCreate: (startMin: number, endMin: number) => void;
  onTapEvent: (e: EventT) => void;
  onMoveEvent: (ev: EventT, s: Date, e: Date) => Promise<void>;
  onCopyEvent?: (e: EventT) => void;
  isToday: boolean; nowY: number; compact: boolean;
  weekDays?: Date[]; colW?: number; dayIndex?: number;
}) {
  const s = useThemedStyles(useS);
  const [dragRange, setDragRange] = useState<{ s: number; e: number } | null>(null);
  const startRef = useRef<number>(0);
  const [dragEvent, setDragEvent] = useState<{ id: string; top: number; height: number } | null>(null);

  const pan = useMemo(() => PanResponder.create({
    // On iOS the parent ScrollView competes for vertical gestures, which
    // prevents the admin "press-and-drag" to create events. We let the
    // ScrollView start the touch but capture the gesture as soon as the
    // admin's finger moves more than a few pixels vertically.
    onStartShouldSetPanResponder: () => isAdmin,
    onMoveShouldSetPanResponder: () => isAdmin,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponderCapture: (_, g) =>
      isAdmin && Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderTerminationRequest: () => false,
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

  // Compute overlap-aware column layout for this day's events
  const columnLayout = useMemo(() => layoutEventColumns(events), [events]);

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
          onCopy={onCopyEvent ? () => onCopyEvent(ev) : undefined}
          onMoveEvent={onMoveEvent}
          weekDays={weekDays}
          colW={colW}
          dayIndex={dayIndex}
          layout={columnLayout.get(ev.id) || { col: 0, total: 1, span: 1 }}
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
  event, day, isAdmin, compact, onTap, onMoveEvent, onCopy,
  weekDays, colW, dayIndex, layout,
}: {
  event: EventT; day: Date; isAdmin: boolean; compact: boolean;
  onTap: () => void;
  onMoveEvent: (ev: EventT, s: Date, e: Date) => Promise<void>;
  onCopy?: (e: EventT) => void;
  weekDays?: Date[]; colW?: number; dayIndex?: number;
  layout?: { col: number; total: number; span: number };
}) {
  const s = useThemedStyles(useS);
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);
  const initTop = yFromDate(start);
  const initHeight = Math.max(24, yFromDate(end) - initTop);

  const [top, setTop] = useState(initTop);
  const [height, setHeight] = useState(initHeight);
  const [leftOffset, setLeftOffset] = useState(0); // horizontal shift when dragging in week view
  const [mode, setMode] = useState<"idle" | "move" | "resize">("idle");
  const baseRef = useRef<{ top: number; height: number }>({ top: initTop, height: initHeight });
  const [boxWidth, setBoxWidth] = useState(0);

  useEffect(() => { setTop(initTop); setHeight(initHeight); setLeftOffset(0); baseRef.current = { top: initTop, height: initHeight }; }, [event.start_at, event.end_at]);

  const tapTimeRef = useRef(0);
  const hasMovedRef = useRef(false);
  const grantXRef = useRef(0);
  const grantYRef = useRef(0);
  const topRef = useRef(top);
  const heightRef = useRef(height);
  topRef.current = top;
  heightRef.current = height;
  const dayShiftRef = useRef(0);
  const canCrossDays = !!(weekDays && weekDays.length > 0 && colW && colW > 0 && typeof dayIndex === "number");

  const panMove = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => isAdmin,
    onStartShouldSetPanResponderCapture: () => isAdmin,
    onMoveShouldSetPanResponder: (_, g) => isAdmin && (Math.abs(g.dy) > 2 || Math.abs(g.dx) > 2),
    onMoveShouldSetPanResponderCapture: (_, g) => isAdmin && (Math.abs(g.dy) > 2 || Math.abs(g.dx) > 2),
    onPanResponderGrant: (evt) => {
      grantXRef.current = evt.nativeEvent.locationX ?? 0;
      grantYRef.current = evt.nativeEvent.locationY ?? 0;
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
      if (!hasMovedRef.current && boxWidth > 0 && onCopy) {
        const gx = grantXRef.current;
        const gy = grantYRef.current;
        if (gx > boxWidth - 36 && gy < 30) {
          onCopy(event);
          setMode("idle");
          setTop(baseRef.current.top);
          setLeftOffset(0);
          return;
        }
      }
      if (!hasMovedRef.current) {
        onTap();
        setMode("idle");
        setTop(baseRef.current.top);
        setLeftOffset(0);
        return;
      }
      const t = topRef.current;
      const h = heightRef.current;
      const startMin = Math.round((t / HOUR_H) * 60 / 15) * 15;
      const durMin = Math.round((h / HOUR_H) * 60);
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
  }), [isAdmin, top, height, event, day, onTap, onMoveEvent, canCrossDays, weekDays, colW, dayIndex, boxWidth]);

  // -------- Web-only drag using document-level mouse events (reliable on Chrome) --------
  const webStateRef = useRef<{ startX: number; startY: number; baseTop: number; baseHeight: number; moved: boolean } | null>(null);
  const onWebMouseDown = (e: any) => {
    if (Platform.OS !== "web" || !isAdmin) return;
    if (e.target?.closest?.("[data-copy-btn]")) return;
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
      const t = topRef.current;
      const h = heightRef.current;
      const startMin = Math.round((t / HOUR_H) * 60 / 15) * 15;
      const durMin = Math.round((h / HOUR_H) * 60);
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
      const t = topRef.current;
      const h = heightRef.current;
      const startMin = Math.round((t / HOUR_H) * 60 / 15) * 15;
      const durMin = Math.max(15, Math.round((h / HOUR_H) * 60 / 15) * 15);
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
      const t = topRef.current;
      const h = heightRef.current;
      const startMin = Math.round((t / HOUR_H) * 60 / 15) * 15;
      const durMin = Math.max(15, Math.round((h / HOUR_H) * 60 / 15) * 15);
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
  // Horizontal overlap layout (side-by-side + expand-to-fill + right gap).
  // Leave ~22% empty on the right of the RIGHTMOST event of each cluster so
  // the user can easily click&drag there to create a new overlapping event.
  const colInfo = layout || { col: 0, total: 1, span: 1 };
  // Column layout → equal-width slices of the day column so multi-assignee
  // events ALWAYS look the same size, regardless of how many columns the
  // day has. We still reserve a bit of room on the right of the day column
  // (for scroll/gutter area) so single events match the previous look.
  const RIGHT_RESERVE_PCT = 22;
  const availWidth = 100 - RIGHT_RESERVE_PCT;
  const perCol = availWidth / colInfo.total;
  const gapPct = colInfo.total > 1 ? 0.6 : 0;
  const widthPct = perCol * colInfo.span - gapPct;
  const leftPct = colInfo.col * perCol;

  // Status-driven visual treatment:
  //   - completed           → dim the card (low opacity + grey overlay)
  //   - pending_completion  → highlight with a thick coloured border + glow
  const st = event.status || "in_progress";
  const isCompleted = st === "completed";
  const isPending = st === "pending_completion";

  return (
    <View
      style={{
        position: "absolute",
        top, height,
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        transform: [{ translateX: leftOffset }],
        zIndex: mode === "idle" ? (isPending ? 4 : 2) : 10,
        elevation: mode === "idle" ? 2 : 10,
      }}
    >
      <View
        onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)}
        style={{
          flex: 1, borderRadius: 6, padding: 4, overflow: "hidden",
          borderLeftWidth: 3,
          backgroundColor: isCompleted ? COLORS.statusCompletedBg : bgTint,
          borderLeftColor: isPending ? "#F59E0B" : baseColor,
          opacity: mode === "move" ? 0.85 : (isCompleted ? 0.55 : 1),
          ...(isPending ? Platform.select<any>({
            web: { boxShadow: "0 0 0 2px rgba(245,158,11,0.35), 0 4px 16px rgba(245,158,11,0.25)" },
            default: { shadowColor: "#F59E0B", shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
          }) : {}),
          // @ts-ignore web-only cursor hint
          cursor: isAdmin ? (mode === "idle" ? "grab" : "grabbing") : "pointer",
        } as any}
        {...(isAdmin && Platform.OS !== "web" ? panMove.panHandlers : {})}
        {...(isAdmin && Platform.OS === "web" ? { onMouseDown: onWebMouseDown } as any : {})}
      >
        {/* Status badge overlay — small chip in the top-right corner */}
        {(isCompleted || isPending) && (
          <View pointerEvents="none" style={[
            s.statusBadge,
            { backgroundColor: isCompleted ? COLORS.statusCompletedFg : "#F59E0B" },
          ]}>
            <Ionicons
              name={isCompleted ? "checkmark-done" : "alert-circle"}
              size={11} color="#fff"
            />
          </View>
        )}
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
      {isAdmin && onCopy && (
        <TouchableOpacity
          onPress={() => onCopy(event)}
          style={{
            position: "absolute", top: 2, right: 2,
            width: 24, height: 24, borderRadius: 4,
            backgroundColor: "rgba(255,255,255,0.9)",
            alignItems: "center", justifyContent: "center", zIndex: 20,
          }}
          hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
        >
          <Ionicons name="copy-outline" size={14} color={baseColor} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ---------------- Create event modal ----------------
function CreateEventModal({
  visible, range, onClose, onDone, copiedEvent,
}: {
  visible: boolean;
  range: { day: Date; startMin: number; endMin: number };
  onClose: () => void;
  onDone: () => void;
  copiedEvent?: EventT | null;
}) {
  const s = useThemedStyles(useS);
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
  const [showTechList, setShowTechList] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");
  const [until, setUntil] = useState<string>("");
  const [hours, setHours] = useState<string>("");
  const [showHours, setShowHours] = useState(false);

  const startDate = dateAt(range.day, range.startMin);
  const endDate = dateAt(range.day, range.endMin);

  useEffect(() => {
    if (visible) {
      if (copiedEvent) {
        setMode("texto");
        setTitle(copiedEvent.title);
        setDescription(copiedEvent.description || "");
        setAssignedIds(copiedEvent.assigned_user_ids || []);
        setManagerId(copiedEvent.manager_id || null);
        setRecurrence(copiedEvent.recurrence?.type || "none");
        setUntil(copiedEvent.recurrence?.until || "");
        setMaterialId(copiedEvent.material_id || null);
        setShowMatList(false); setHours(""); setShowHours(false);
        if (copiedEvent.material_id) {
          setMode("proyecto");
        }
      } else {
        setMode("texto"); setTitle(""); setDescription("");
        setMaterialId(null); setMaterialObj(null); setShowMatList(false);
        setAssignedIds([]); setManagerId(null);
        setRecurrence("none"); setUntil(""); setHours(""); setShowHours(false);
      }
      setShowManagerList(false); setShowTechList(false);
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
        hours: hours ? parseFloat(hours) : undefined,
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
            <Text style={s.modalTitle}>{copiedEvent ? "Pegar evento" : "Nuevo evento"}</Text>
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
              <TouchableOpacity
                testID="btn-pick-techs"
                style={s.pickMatBtn}
                onPress={() => setShowTechList((v) => !v)}
              >
                <Ionicons name="people-outline" size={20} color={COLORS.primary} />
                <Text style={{ color: assignedIds.length > 0 ? COLORS.navy : COLORS.primary, fontWeight: "700", flex: 1 }} numberOfLines={1}>
                  {assignedIds.length === 0
                    ? "Seleccionar técnicos"
                    : assignedIds.length === 1
                      ? (techs.find((t) => t.id === assignedIds[0])?.name || "1 técnico")
                      : `${assignedIds.length} técnicos seleccionados`}
                </Text>
                <Ionicons name={showTechList ? "chevron-up" : "chevron-down"} size={18} color={COLORS.primary} />
              </TouchableOpacity>
              {showTechList && (
                <View style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, marginTop: 6, overflow: "hidden" }}>
                  {techs.length === 0 ? (
                    <View style={{ padding: 12 }}>
                      <Text style={{ color: COLORS.textSecondary, fontStyle: "italic" }}>Cargando técnicos...</Text>
                    </View>
                  ) : techs.map((t, idx) => {
                    const on = assignedIds.includes(t.id);
                    return (
                      <TouchableOpacity
                        key={t.id}
                        testID={`assign-${t.id}`}
                        style={[
                          s.techRow,
                          { borderRadius: 0, borderWidth: 0, borderBottomWidth: idx === techs.length - 1 ? 0 : 1, borderBottomColor: COLORS.border },
                          on && { backgroundColor: COLORS.highlightBg },
                        ]}
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
              )}
              {assignedIds.length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {assignedIds.map((id) => {
                    const t = techs.find((x) => x.id === id);
                    if (!t) return null;
                    return (
                      <View key={id} style={s.techChip}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: (t as any).color || COLORS.primary }} />
                        <Text style={s.techChipText} numberOfLines={1}>{t.name || t.email}</Text>
                        <TouchableOpacity hitSlop={8} onPress={() => toggleAssign(id)}>
                          <Ionicons name="close" size={14} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              <Text style={s.mLabel}>Horas asignadas</Text>
              <TouchableOpacity
                style={s.pickMatBtn}
                onPress={() => setShowHours((v) => !v)}
              >
                <Ionicons name="time-outline" size={20} color={COLORS.primary} />
                <Text style={{ color: hours ? COLORS.navy : COLORS.primary, fontWeight: "700", flex: 1 }}>{hours ? `${hours}h` : "Sin asignar"}</Text>
                <Ionicons name={showHours ? "chevron-up" : "chevron-down"} size={18} color={COLORS.primary} />
              </TouchableOpacity>
              {showHours && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {[0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8].map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[s.recChip, hours === String(h) && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                      onPress={() => { setHours(String(h)); setShowHours(false); }}
                    >
                      <Text style={[s.recChipText, hours === String(h) && { color: "#fff" }]}>{h}h</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

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
                        style={[s.techRow, { borderRadius: 0, borderWidth: 0, borderBottomWidth: 1, borderBottomColor: COLORS.border }, on && { backgroundColor: COLORS.highlightBg }]}
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
  event, isAdmin, onClose, onChanged, onCopy,
}: { event: EventT; isAdmin: boolean; onClose: () => void; onChanged: () => void; onCopy: (e: EventT) => void }) {
  const s = useThemedStyles(useS);
  const router = useRouter();
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
  // Assigned technicians (multi-select) — editable post-creation. Uses a
  // dropdown toggle, matching the "Gestor del proyecto" UX.
  const [assignedIds, setAssignedIds] = useState<string[]>(event.assigned_user_ids || []);
  const [techs, setTechs] = useState<Technician[]>([]);
  const [showTechList, setShowTechList] = useState(false);
  // Work-status selector (completed / pending_completion / in_progress)
  // and technician's observations ("seguimiento"). Stored on the event
  // itself; when changed, the backend notifies the event's manager.
  const [status, setStatus] = useState<string>(event.status || "in_progress");
  const [seguimiento, setSeguimiento] = useState<string>(event.seguimiento || "");
  const [eventHours, setEventHours] = useState<string>((event as any).hours ? String((event as any).hours) : "");
  const [showEventHours, setShowEventHours] = useState(false);

  // Budget linking
  const [budgetObj, setBudgetObj] = useState<any>(null);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [showBudgetList, setShowBudgetList] = useState(false);

  const m = event.material;

  useEffect(() => {
    if (isAdmin) {
      api.listManagers().then(setManagers).catch(() => {});
      api.listTechnicians().then(setTechs).catch(() => {});
    }
  }, [isAdmin]);

  // Load linked budget if event has budget_id
  useEffect(() => {
    const bid = (event as any).budget_id;
    if (bid) {
      api.getBudget(bid).then(setBudgetObj).catch(() => {});
    } else {
      setBudgetObj(null);
    }
  }, [(event as any).budget_id]);

  const loadBudgets = async () => {
    if (budgets.length > 0) return;
    try { setBudgets(await api.listAcceptedBudgets()); } catch {}
  };

  const pickBudget = (b: any) => {
    setBudgetObj(b);
    setShowBudgetList(false);
  };

  const toggleAssign = (id: string) => {
    setAssignedIds((arr) => arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  };

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
        assigned_user_ids: assignedIds,
        status,
        seguimiento: seguimiento || undefined,
        hours: eventHours ? parseFloat(eventHours) : null,
        budget_id: budgetObj?.id || null,
      } as any);
      onChanged();
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setSaving(false); }
  };

  // Fast-path used by the status chips: a technician just taps
  // Terminado / Pendiente and we persist immediately without requiring
  // full edit-mode. Validates that Pendiente comes with a seguimiento.
  const saveStatus = async (newStatus: "completed" | "pending_completion", segText?: string) => {
    if (newStatus === "pending_completion" && !(segText || "").trim()) {
      Alert.alert(
        "Observaciones requeridas",
        "Añade las observaciones del técnico antes de marcar el evento como pendiente de terminar.",
      );
      return;
    }
    setSaving(true);
    try {
      await api.updateEvent(event.id, {
        status: newStatus,
        ...(segText !== undefined ? { seguimiento: segText || undefined } : {}),
      } as any);
      setStatus(newStatus);
      if (segText !== undefined) setSeguimiento(segText);
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
        // Preview: open in a new tab without forcing download.
        const win = window.open();
        if (win) {
          win.document.write(`<iframe src="data:${data.mime_type};base64,${data.base64}" style="border:0;width:100%;height:100%"></iframe>`);
          win.document.title = data.filename || "archivo";
        } else {
          // Popup blocked — fall back to download
          const a = document.createElement("a");
          a.href = `data:${data.mime_type};base64,${data.base64}`;
          a.download = data.filename || "archivo";
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
        }
      } else {
        const ext = (data.filename || "").split(".").pop() || (data.mime_type.includes("pdf") ? "pdf" : "jpg");
        const path = `${FileSystem.cacheDirectory}${aid}.${ext}`;
        await FileSystem.writeAsStringAsync(path, data.base64, { encoding: FileSystem.EncodingType.Base64 });
        const Linking = require("react-native").Linking;
        await Linking.openURL(path);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo abrir el archivo");
    }
  };

  /** Force download/export the attachment to the user's device. */
  const downloadAttachment = async (aid: string) => {
    try {
      const data = await api.getEventAttachment(event.id, aid);
      if (Platform.OS === "web") {
        const a = document.createElement("a");
        a.href = `data:${data.mime_type};base64,${data.base64}`;
        a.download = data.filename || "archivo";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const ext = (data.filename || "").split(".").pop()
          || (data.mime_type.includes("pdf") ? "pdf" : (data.mime_type.startsWith("image/") ? data.mime_type.split("/")[1] : "bin"));
        const path = `${FileSystem.cacheDirectory}${(data.filename || aid).replace(/[^\w.-]+/g, "_")}${ext.includes(".") ? "" : ""}`;
        const finalPath = path.endsWith(`.${ext}`) ? path : `${path}.${ext}`;
        await FileSystem.writeAsStringAsync(finalPath, data.base64, { encoding: FileSystem.EncodingType.Base64 });
        const Sharing: any = await import("expo-sharing").catch(() => null);
        if (Sharing?.isAvailableAsync && (await Sharing.isAvailableAsync())) {
          await Sharing.shareAsync(finalPath, { mimeType: data.mime_type, dialogTitle: data.filename });
        } else {
          Alert.alert("Guardado", `Archivo en: ${finalPath}`);
        }
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo descargar el archivo");
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
            <TouchableOpacity
              testID="btn-copy-event"
              style={[s.iconBtn, { marginRight: 4 }]}
              onPress={() => { onCopy({ ...event, hours: undefined }); Alert.alert("Copiado", "Evento copiado. Usa el botón + para pegarlo en otro día."); }}
            >
              <Ionicons name="copy-outline" size={20} color={COLORS.primary} />
            </TouchableOpacity>
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

            {/* Presupuesto vinculado */}
            <Text style={s.mLabel}>PRESUPUESTO</Text>
            {editing && isAdmin ? (
              <>
                <TouchableOpacity
                  testID="btn-pick-budget"
                  style={s.pickMatBtn}
                  onPress={() => { setShowBudgetList((v) => !v); loadBudgets(); }}
                >
                  <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
                  <Text style={{ color: budgetObj ? COLORS.navy : COLORS.primary, fontWeight: "700", flex: 1 }} numberOfLines={1}>
                    {budgetObj
                      ? `${budgetObj.n_proyecto ? `#${budgetObj.n_proyecto} · ` : ""}${budgetObj.cliente || budgetObj.nombre_instalacion || "Seleccionado"}`
                      : "Vincular presupuesto aceptado"}
                  </Text>
                  <Ionicons name={showBudgetList ? "chevron-up" : "chevron-down"} size={18} color={COLORS.primary} />
                </TouchableOpacity>
                {showBudgetList && (
                  <View style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, marginTop: 6, overflow: "hidden", maxHeight: 300 }}>
                    <ScrollView nestedScrollEnabled>
                      {budgets.length === 0 ? (
                        <View style={{ padding: 12 }}>
                          <Text style={{ color: COLORS.textSecondary, fontStyle: "italic" }}>No hay presupuestos aceptados</Text>
                        </View>
                      ) : budgets.map((b, idx) => (
                        <TouchableOpacity
                          key={b.id}
                          testID={`budget-opt-${b.id}`}
                          style={[s.techRow, { borderRadius: 0, borderWidth: 0, borderBottomWidth: idx === budgets.length - 1 ? 0 : 1, borderBottomColor: COLORS.border }, budgetObj?.id === b.id && { backgroundColor: COLORS.highlightBg }]}
                          onPress={() => pickBudget(b)}
                        >
                          <View style={[s.checkBox, budgetObj?.id === b.id && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}>
                            {budgetObj?.id === b.id && <Ionicons name="checkmark" size={16} color="#fff" />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.techName}>{b.n_proyecto ? `#${b.n_proyecto} · ` : ""}{b.cliente || b.nombre_instalacion || "—"}</Text>
                            <Text style={s.techEmail}>{b.direccion || b.created_by_name || ""}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </>
            ) : budgetObj ? (
              <View style={s.matPreview}>
                <View style={{ flex: 1 }}>
                  <Text style={s.matCode}>{budgetObj.n_proyecto ? `#${budgetObj.n_proyecto}` : "—"}</Text>
                  <Text style={s.matCliente}>{budgetObj.cliente || budgetObj.nombre_instalacion || "Sin título"}</Text>
                  {budgetObj.direccion && <Text style={s.matUbic}>📍 {budgetObj.direccion}</Text>}
                </View>
              </View>
            ) : (
              <Text style={[s.descText, { color: COLORS.textDisabled }]}>Sin presupuesto vinculado</Text>
            )}
            {/* Edit / Export buttons always visible when a budget is linked */}
            {budgetObj && (
              <View style={{ flexDirection: "row", gap: 8, marginTop: editing ? 6 : 4 }}>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: COLORS.primarySoft }}
                  onPress={() => { onClose(); router.push(`/presupuestos/${budgetObj.id}`); }}
                >
                  <Ionicons name="create-outline" size={14} color={COLORS.primary} />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: COLORS.primary }}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: COLORS.primarySoft }}
                  onPress={async () => {
                    try {
                      const blob = await api.getBudgetPdfBlob(budgetObj.id);
                      const url = URL.createObjectURL(blob);
                      window.open(url, "_blank");
                      setTimeout(() => URL.revokeObjectURL(url), 60000);
                    } catch (e: any) { Alert.alert("Error", e.message || "No se pudo abrir el PDF"); }
                  }}
                >
                  <Ionicons name="eye-outline" size={14} color={COLORS.primary} />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: COLORS.primary }}>Ver PDF</Text>
                </TouchableOpacity>
              </View>
            )}
            {/* Técnicos asignados — editable por admin, read-only para resto.
                Usa un dropdown idéntico al de "Gestor del proyecto" para
                mantener coherencia visual. Permite seleccionar varios. */}
            <Text style={s.mLabel}>Asignado a</Text>
            {editing && isAdmin ? (
              <>
                <TouchableOpacity
                  testID="btn-pick-techs-edit"
                  style={s.pickMatBtn}
                  onPress={() => setShowTechList((v) => !v)}
                >
                  <Ionicons name="people-outline" size={20} color={COLORS.primary} />
                  <Text
                    style={{
                      color: assignedIds.length > 0 ? COLORS.navy : COLORS.primary,
                      fontWeight: "700",
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {assignedIds.length === 0
                      ? "Seleccionar técnicos"
                      : assignedIds.length === 1
                        ? (techs.find((t) => t.id === assignedIds[0])?.name
                            || event.assigned_users?.find((u) => u.id === assignedIds[0])?.name
                            || event.assigned_users?.find((u) => u.id === assignedIds[0])?.email
                            || "1 técnico")
                        : `${assignedIds.length} técnicos seleccionados`}
                  </Text>
                  <Ionicons name={showTechList ? "chevron-up" : "chevron-down"} size={18} color={COLORS.primary} />
                </TouchableOpacity>
                {showTechList && (
                  <View style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, marginTop: 6, overflow: "hidden" }}>
                    {techs.length === 0 ? (
                      <View style={{ padding: 12 }}>
                        <Text style={{ color: COLORS.textSecondary, fontStyle: "italic" }}>
                          Cargando técnicos...
                        </Text>
                      </View>
                    ) : techs.map((t, idx) => {
                      const on = assignedIds.includes(t.id);
                      return (
                        <TouchableOpacity
                          key={t.id}
                          testID={`assign-edit-${t.id}`}
                          style={[
                            s.techRow,
                            {
                              borderRadius: 0,
                              borderWidth: 0,
                              borderBottomWidth: idx === techs.length - 1 ? 0 : 1,
                              borderBottomColor: COLORS.border,
                            },
                            on && { backgroundColor: COLORS.highlightBg },
                          ]}
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
                )}
                {/* Chips summary for the selected techs, shown below the
                    dropdown so the admin has a clear glance of selections. */}
                {assignedIds.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {assignedIds.map((id) => {
                      const t = techs.find((x) => x.id === id)
                        || event.assigned_users?.find((u) => u.id === id);
                      if (!t) return null;
                      return (
                        <View key={id} style={s.techChip}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: (t as any).color || COLORS.primary }} />
                          <Text style={s.techChipText} numberOfLines={1}>
                            {(t as any).name || (t as any).email}
                          </Text>
                          <TouchableOpacity
                            hitSlop={8}
                            onPress={() => toggleAssign(id)}
                            testID={`assign-chip-remove-${id}`}
                          >
                            <Ionicons name="close" size={14} color={COLORS.textSecondary} />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            ) : (
              event.assigned_users && event.assigned_users.length > 0 ? (
                <View style={{ gap: 4 }}>
                  {event.assigned_users.map((u) => (
                    <View key={u.id} style={s.assignedRow}>
                      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: u.color || COLORS.primary }} />
                      <Text style={s.descText}>{u.name || u.email}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[s.descText, { color: COLORS.textDisabled }]}>Sin técnicos asignados</Text>
              )
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
                          style={[s.techRow, { borderRadius: 0, borderWidth: 0, borderBottomWidth: 1, borderBottomColor: COLORS.border }, on && { backgroundColor: COLORS.highlightBg }]}
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

            <Text style={s.mLabel}>Horas asignadas</Text>
            {editing && isAdmin ? (
              <>
                <TouchableOpacity
                  style={s.pickMatBtn}
                  onPress={() => setShowEventHours((v) => !v)}
                >
                  <Ionicons name="time-outline" size={20} color={COLORS.primary} />
                  <Text style={{ color: eventHours ? COLORS.navy : COLORS.primary, fontWeight: "700", flex: 1 }}>{eventHours ? `${eventHours}h` : "Sin asignar"}</Text>
                  <Ionicons name={showEventHours ? "chevron-up" : "chevron-down"} size={18} color={COLORS.primary} />
                </TouchableOpacity>
                {showEventHours && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {[0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8].map((h) => (
                      <TouchableOpacity
                        key={h}
                        style={[s.recChip, eventHours === String(h) && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                        onPress={() => { setEventHours(String(h)); setShowEventHours(false); }}
                      >
                        <Text style={[s.recChipText, eventHours === String(h) && { color: "#fff" }]}>{h}h</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <Text style={s.descText}>{eventHours ? `${eventHours}h` : "Sin asignar"}</Text>
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

            {/* Work status + technician's seguimiento. Visible to both the
                admin and the assigned technician. Chips update the status
                with a single tap; Pendiente forces a seguimiento text. */}
            <Text style={s.mLabel}>Estado del trabajo</Text>
            <View style={s.statusRow}>
              <TouchableOpacity
                testID="status-in_progress"
                style={[
                  s.statusChip,
                  status === "in_progress" && { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
                ]}
                onPress={() => saveStatus("in_progress" as any)}
                disabled={saving || status === "in_progress"}
              >
                <Ionicons name="hourglass-outline" size={14} color={status === "in_progress" ? "#fff" : COLORS.primary} />
                <Text style={[s.statusChipText, status === "in_progress" && { color: "#fff" }]}>En curso</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="status-completed"
                style={[
                  s.statusChip,
                  status === "completed" && { backgroundColor: "#10B981", borderColor: "#10B981" },
                ]}
                onPress={() => saveStatus("completed")}
                disabled={saving}
              >
                <Ionicons name="checkmark-done" size={14} color={status === "completed" ? "#fff" : "#10B981"} />
                <Text style={[s.statusChipText, status === "completed" && { color: "#fff" }]}>Proyecto terminado</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="status-pending"
                style={[
                  s.statusChip,
                  status === "pending_completion" && { backgroundColor: "#F59E0B", borderColor: "#F59E0B" },
                ]}
                onPress={() => {
                  // Pendiente requires a seguimiento. If the technician hasn't
                  // typed anything yet we enter edit mode so they see the
                  // textarea and can submit afterwards.
                  if (!seguimiento.trim()) {
                    setEditing(true);
                    setStatus("pending_completion");
                    Alert.alert(
                      "Observaciones requeridas",
                      "Escribe las observaciones del técnico en el campo Seguimiento y vuelve a pulsar el chip para guardar.",
                    );
                    return;
                  }
                  saveStatus("pending_completion", seguimiento);
                }}
                disabled={saving}
              >
                <Ionicons name="alert-circle-outline" size={14} color={status === "pending_completion" ? "#fff" : "#F59E0B"} />
                <Text style={[s.statusChipText, status === "pending_completion" && { color: "#fff" }]}>Pendiente de terminar</Text>
              </TouchableOpacity>
            </View>

            {(editing || status === "pending_completion" || !!seguimiento) && (
              <>
                <Text style={s.mLabel}>Seguimiento (observaciones del técnico)</Text>
                {editing ? (
                  <TextInput
                    testID="seguimiento-input"
                    style={[s.mInput, { minHeight: 72, textAlignVertical: "top" }]}
                    value={seguimiento}
                    onChangeText={setSeguimiento}
                    placeholder="Escribe aquí las observaciones…"
                    placeholderTextColor={COLORS.textDisabled}
                    multiline
                  />
                ) : (
                  <Text style={[s.descText, !seguimiento && { color: COLORS.textDisabled }]}>
                    {seguimiento || "Sin observaciones"}
                  </Text>
                )}
              </>
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
                    <TouchableOpacity
                      testID={`attachment-download-${a.id}`}
                      hitSlop={8}
                      style={{ padding: 4 }}
                      onPress={() => downloadAttachment(a.id)}
                    >
                      <Ionicons name="download-outline" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID={`attachment-delete-${a.id}`}
                      hitSlop={10}
                      style={{ padding: 4 }}
                      onPress={() => deleteAttachment(a.id, a.filename)}
                    >
                      <Ionicons name="trash-outline" size={18} color={COLORS.errorText} />
                    </TouchableOpacity>
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

const useS = () =>
  StyleSheet.create({
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
    borderBottomWidth: 1, borderBottomColor: COLORS.border, position: "relative", zIndex: 100,
  },
  navBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.bg, borderRadius: 8, paddingVertical: 8, gap: 4,
    borderWidth: 1, borderColor: COLORS.border,
  },
  userFilterDropdown: {
    position: "fixed" as any,
    top: 220,
    right: 16,
    minWidth: 260,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 8,
    zIndex: 9999,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  userFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  checkSmall: {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 2, borderColor: COLORS.borderInput,
    alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.surface,
  },
  filterMiniBtn: {
    flex: 1,
    paddingVertical: 6,
    backgroundColor: COLORS.bg,
    borderRadius: 6,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterMiniBtnTxt: { fontSize: 12, fontWeight: "700", color: COLORS.primary },
  dayHeaderRow: {
    flexDirection: "row", backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  dayHeader: {
    flex: 1, alignItems: "center", paddingVertical: 8,
    borderLeftWidth: 1, borderLeftColor: COLORS.border,
  },
  dayHeaderToday: { backgroundColor: COLORS.highlightBg },
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
  statusBadge: {
    position: "absolute", top: 3, right: 3,
    width: 18, height: 18, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
    zIndex: 5,
  },
  // Status chip row inside the Event detail modal.
  statusRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4, marginBottom: 4 },
  statusChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  statusChipText: { fontSize: 12, fontWeight: "800", color: COLORS.text },
  // --- Notifications bell + sheet ---
  bellBadge: {
    position: "absolute", top: 4, right: 4,
    minWidth: 16, height: 16, borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: "#EF4444",
    borderWidth: 1.5, borderColor: COLORS.surface,
    alignItems: "center", justifyContent: "center",
  },
  bellBadgeText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  notifSheetRoot: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  notifSheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  notifHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  notifTitle: { fontSize: 18, fontWeight: "900", color: COLORS.text, letterSpacing: -0.3 },
  notifSub: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "700", marginTop: 2 },
  notifHdrBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: COLORS.primarySoft,
  },
  notifItem: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    padding: 12, backgroundColor: COLORS.bg, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  notifDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  notifItemTitle: { fontSize: 13.5, fontWeight: "800", color: COLORS.text },
  notifItemMsg: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, lineHeight: 17 },
  notifItemDate: { fontSize: 10.5, color: COLORS.textDisabled, marginTop: 4, fontWeight: "700" },
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
  techChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1, borderColor: COLORS.primary,
  },
  techChipText: { fontSize: 12, fontWeight: "700", color: COLORS.navy, maxWidth: 140 },
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
