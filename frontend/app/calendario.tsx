import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
  ActivityIndicator, Modal, TextInput, Platform, PanResponder,
  FlatList, KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS } from "../src/api";

const HOUR_START = 7;
const HOUR_END = 18; // 6pm shown as last mark
const HOURS = HOUR_END - HOUR_START; // 11 hours
const HOUR_H = 56; // px per hour
const TIME_COL_W = 52;
const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie"];

type EventT = {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  description?: string;
  material_id?: string | null;
  material?: any;
  created_by: string;
};

function mondayOf(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay() === 0 ? 7 : x.getDay(); // 1..7, Mon=1
  x.setDate(x.getDate() - (day - 1));
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmtRange(start: Date, end: Date): string {
  const m = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} – ${end.getDate()} ${m[start.getMonth()]} ${start.getFullYear()}`;
  }
  return `${start.getDate()} ${m[start.getMonth()]} – ${end.getDate()} ${m[end.getMonth()]} ${start.getFullYear()}`;
}
function pad(n: number): string { return String(n).padStart(2, "0"); }
function fmtTime(d: Date): string { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }

function minutesFromTop(y: number): number {
  // snap to 15min
  const totalMin = Math.max(0, Math.min(HOURS * 60, Math.round((y / HOUR_H) * 60 / 15) * 15));
  return totalMin;
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
  const [me, setMe] = useState<any>(null);
  const [weekStart, setWeekStart] = useState<Date>(mondayOf(new Date()));
  const [events, setEvents] = useState<EventT[]>([]);
  const [loading, setLoading] = useState(true);
  const [createRange, setCreateRange] = useState<{ day: Date; startMin: number; endMin: number } | null>(null);
  const [openEvent, setOpenEvent] = useState<EventT | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [list, who] = await Promise.all([
        api.listEvents(
          weekStart.toISOString(),
          addDays(weekStart, 7).toISOString(),
        ),
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

  useFocusEffect(useCallback(() => { load(); }, [weekStart]));

  const isAdmin = me?.role === "admin";
  const days = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const now = new Date();
  const nowY = yFromDate(now);

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={s.headerTitle}>Calendario</Text>
          <Text style={s.headerSub}>{fmtRange(days[0], days[4])}</Text>
        </View>
        <TouchableOpacity style={s.iconBtn} onPress={() => setWeekStart(mondayOf(new Date()))}>
          <Ionicons name="today-outline" size={22} color={COLORS.navy} />
        </TouchableOpacity>
      </View>

      <View style={s.navRow}>
        <TouchableOpacity style={s.navBtn} onPress={() => setWeekStart(addDays(weekStart, -7))}>
          <Ionicons name="chevron-back" size={20} color={COLORS.navy} />
          <Text style={s.navBtnText}>Semana anterior</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navBtn} onPress={() => setWeekStart(addDays(weekStart, 7))}>
          <Text style={s.navBtnText}>Semana siguiente</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.navy} />
        </TouchableOpacity>
      </View>

      {/* Day headers */}
      <View style={s.dayHeaderRow}>
        <View style={{ width: TIME_COL_W }} />
        {days.map((d, i) => {
          const today = sameDay(d, now);
          return (
            <View key={i} style={[s.dayHeader, today && s.dayHeaderToday]}>
              <Text style={[s.dayLabel, today && { color: COLORS.primary }]}>{DAY_LABELS[i]}</Text>
              <Text style={[s.dayNum, today && { color: COLORS.primary, fontWeight: "900" }]}>{d.getDate()}</Text>
            </View>
          );
        })}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={s.gridRow}>
            {/* Hours column */}
            <View style={{ width: TIME_COL_W }}>
              {Array.from({ length: HOURS + 1 }).map((_, i) => (
                <View key={i} style={{ height: HOUR_H }}>
                  <Text style={s.hourLabel}>{pad(HOUR_START + i)}:00</Text>
                </View>
              ))}
            </View>
            {/* Day columns */}
            {days.map((d, i) => (
              <DayColumn
                key={i}
                day={d}
                events={events.filter((e) => sameDay(new Date(e.start_at), d))}
                isAdmin={isAdmin}
                onCreate={(startMin, endMin) => setCreateRange({ day: d, startMin, endMin })}
                onTapEvent={(e) => setOpenEvent(e)}
                isToday={sameDay(d, now)}
                nowY={nowY}
              />
            ))}
          </View>
        </ScrollView>
      )}

      {/* Create event modal */}
      {createRange && (
        <CreateEventModal
          visible={!!createRange}
          range={createRange}
          onClose={() => setCreateRange(null)}
          onDone={() => { setCreateRange(null); load(); }}
        />
      )}

      {/* Event details */}
      {openEvent && (
        <EventDetailsModal
          event={openEvent}
          isAdmin={isAdmin}
          onClose={() => setOpenEvent(null)}
          onDeleted={() => { setOpenEvent(null); load(); }}
        />
      )}
    </SafeAreaView>
  );
}

// ---------------- Day column ----------------
function DayColumn({
  day, events, isAdmin, onCreate, onTapEvent, isToday, nowY,
}: {
  day: Date; events: EventT[]; isAdmin: boolean;
  onCreate: (startMin: number, endMin: number) => void;
  onTapEvent: (e: EventT) => void;
  isToday: boolean; nowY: number;
}) {
  const [dragRange, setDragRange] = useState<{ s: number; e: number } | null>(null);
  const startRef = useRef<number>(0);

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
      if (dragRange) {
        onCreate(dragRange.s, dragRange.e);
      }
      setDragRange(null);
    },
    onPanResponderTerminate: () => setDragRange(null),
  }), [isAdmin, dragRange, onCreate]);

  return (
    <View style={{ flex: 1, height: HOURS * HOUR_H, position: "relative" }} {...pan.panHandlers}>
      {/* Hour grid lines */}
      {Array.from({ length: HOURS + 1 }).map((_, i) => (
        <View key={i} style={[s.hourLine, { top: i * HOUR_H }]} />
      ))}
      {/* Half-hour lines */}
      {Array.from({ length: HOURS }).map((_, i) => (
        <View key={`h${i}`} style={[s.halfHourLine, { top: i * HOUR_H + HOUR_H / 2 }]} />
      ))}
      {/* Now line */}
      {isToday && nowY >= 0 && nowY <= HOURS * HOUR_H && (
        <View style={[s.nowLine, { top: nowY }]}>
          <View style={s.nowDot} />
        </View>
      )}
      {/* Events */}
      {events.map((ev) => {
        const top = yFromDate(new Date(ev.start_at));
        const bottom = yFromDate(new Date(ev.end_at));
        const height = Math.max(24, bottom - top);
        const hasMaterial = !!ev.material_id;
        return (
          <TouchableOpacity
            key={ev.id}
            style={[s.eventBox, {
              top, height,
              backgroundColor: hasMaterial ? "#DBEAFE" : "#E0E7FF",
              borderLeftColor: hasMaterial ? COLORS.primary : "#6366F1",
            }]}
            onPress={() => onTapEvent(ev)}
            activeOpacity={0.8}
          >
            <Text style={s.eventTitle} numberOfLines={2}>{ev.title}</Text>
            <Text style={s.eventTime}>{fmtTime(new Date(ev.start_at))} - {fmtTime(new Date(ev.end_at))}</Text>
          </TouchableOpacity>
        );
      })}
      {/* Drag preview */}
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

  const startDate = dateAt(range.day, range.startMin);
  const endDate = dateAt(range.day, range.endMin);

  useEffect(() => {
    if (visible) {
      setMode("texto"); setTitle(""); setDescription("");
      setMaterialId(null); setMaterialObj(null); setShowMatList(false);
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

  const submit = async () => {
    if (mode === "texto" && !title.trim()) {
      Alert.alert("Error", "Introduce un título");
      return;
    }
    if (mode === "proyecto" && !materialId) {
      Alert.alert("Error", "Selecciona un proyecto");
      return;
    }
    setSaving(true);
    try {
      await api.createEvent({
        title: title.trim(),
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        description: description || undefined,
        material_id: materialId || undefined,
      });
      onDone();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = q.trim()
    ? materiales.filter((m) => {
        const str = `${m.materiales || ""} ${m.cliente || ""} ${m.ubicacion || ""}`.toLowerCase();
        return str.includes(q.toLowerCase());
      })
    : materiales;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.modalRoot}
      >
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
                <TextInput
                  style={s.searchInput}
                  value={q}
                  onChangeText={setQ}
                  placeholder="Buscar proyecto..."
                  placeholderTextColor={COLORS.textDisabled}
                />
              </View>
              {loadingMat ? (
                <ActivityIndicator color={COLORS.primary} style={{ padding: 20 }} />
              ) : (
                <FlatList
                  data={filtered}
                  keyExtractor={(m) => m.id}
                  style={{ flex: 1 }}
                  keyboardShouldPersistTaps="handled"
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
                <TouchableOpacity
                  testID="mode-texto"
                  style={[s.modeChip, mode === "texto" && s.modeChipActive]}
                  onPress={() => setMode("texto")}
                >
                  <Ionicons name="create-outline" size={18} color={mode === "texto" ? "#fff" : COLORS.navy} />
                  <Text style={[s.modeChipText, mode === "texto" && { color: "#fff" }]}>Texto libre</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="mode-proyecto"
                  style={[s.modeChip, mode === "proyecto" && s.modeChipActive]}
                  onPress={() => { setMode("proyecto"); loadMateriales(); }}
                >
                  <Ionicons name="briefcase-outline" size={18} color={mode === "proyecto" ? "#fff" : COLORS.navy} />
                  <Text style={[s.modeChipText, mode === "proyecto" && { color: "#fff" }]}>Desde proyecto</Text>
                </TouchableOpacity>
              </View>

              {mode === "texto" ? (
                <>
                  <Text style={s.mLabel}>Título</Text>
                  <TextInput
                    style={s.mInput}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Ej. Reunión equipo"
                    placeholderTextColor={COLORS.textDisabled}
                    autoFocus
                  />
                  <Text style={s.mLabel}>Descripción (opcional)</Text>
                  <TextInput
                    style={[s.mInput, { height: 90, paddingTop: 12 }]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Notas adicionales..."
                    multiline
                    textAlignVertical="top"
                    placeholderTextColor={COLORS.textDisabled}
                  />
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
                        {materialObj.horas_prev && <Text style={s.matMeta}>⏱️ {materialObj.horas_prev}h previstas</Text>}
                        {materialObj.comercial && <Text style={s.matMeta}>👤 {materialObj.comercial}</Text>}
                        {materialObj.gestor && <Text style={s.matMeta}>📋 {materialObj.gestor}</Text>}
                      </View>
                      <TouchableOpacity onPress={() => setShowMatList(true)}>
                        <Ionicons name="swap-horizontal" size={22} color={COLORS.primary} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={s.pickMatBtn}
                      onPress={() => setShowMatList(true)}
                    >
                      <Ionicons name="list" size={20} color={COLORS.primary} />
                      <Text style={{ color: COLORS.primary, fontWeight: "700" }}>Elegir proyecto...</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={s.mLabel}>Nota adicional (opcional)</Text>
                  <TextInput
                    style={[s.mInput, { height: 70, paddingTop: 12 }]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Instrucciones específicas..."
                    multiline
                    textAlignVertical="top"
                    placeholderTextColor={COLORS.textDisabled}
                  />
                </>
              )}

              <TouchableOpacity
                testID="btn-create-event"
                style={[s.primary, saving && { opacity: 0.6 }]}
                onPress={submit}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>CREAR EVENTO</Text>}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------- Event details modal ----------------
function EventDetailsModal({
  event, isAdmin, onClose, onDeleted,
}: { event: EventT; isAdmin: boolean; onClose: () => void; onDeleted: () => void }) {
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);
  const doDelete = () => {
    Alert.alert("Eliminar evento", "¿Seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar", style: "destructive",
        onPress: async () => {
          try { await api.deleteEvent(event.id); onDeleted(); }
          catch (e: any) { Alert.alert("Error", e.message); }
        },
      },
    ]);
  };
  const m = event.material;
  return (
    <Modal visible={true} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalRoot}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle} numberOfLines={2}>{event.title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={26} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <ScrollView>
            <View style={s.timeBox}>
              <Ionicons name="time-outline" size={18} color={COLORS.textSecondary} />
              <Text style={s.timeText}>
                {start.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                {" · "}{fmtTime(start)} - {fmtTime(end)}
              </Text>
            </View>

            {m && (
              <View style={s.matPreview}>
                <View style={{ flex: 1 }}>
                  <Text style={s.mLabel}>PROYECTO</Text>
                  <Text style={s.matCode}>{m.materiales || "—"}</Text>
                  <Text style={s.matCliente}>{m.cliente || "Sin cliente"}</Text>
                  {m.ubicacion && <Text style={s.matUbic}>📍 {m.ubicacion}</Text>}
                  {m.horas_prev && <Text style={s.matMeta}>⏱️ {m.horas_prev}h previstas</Text>}
                  {m.comercial && <Text style={s.matMeta}>👤 Comercial: {m.comercial}</Text>}
                  {m.gestor && <Text style={s.matMeta}>📋 Gestor/a: {m.gestor}</Text>}
                  {m.tecnico && <Text style={s.matMeta}>🔧 Técnico: {m.tecnico}</Text>}
                  {m.comentarios && <Text style={s.matMeta}>💬 {m.comentarios}</Text>}
                </View>
              </View>
            )}

            {event.description && (
              <>
                <Text style={s.mLabel}>Notas</Text>
                <Text style={s.descText}>{event.description}</Text>
              </>
            )}

            <Text style={[s.mLabel, { marginTop: 16 }]}>Creado por</Text>
            <Text style={s.descText}>{event.created_by}</Text>

            {isAdmin && (
              <TouchableOpacity
                testID="btn-delete-event"
                style={[s.primary, { backgroundColor: COLORS.errorText }]}
                onPress={doDelete}
              >
                <Ionicons name="trash" size={18} color="#fff" />
                <Text style={s.primaryText}> ELIMINAR EVENTO</Text>
              </TouchableOpacity>
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
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  headerSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, textTransform: "capitalize" },
  navRow: {
    flexDirection: "row", gap: 8, padding: 10, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  navBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.bg, borderRadius: 8, paddingVertical: 8, gap: 4,
  },
  navBtnText: { fontSize: 13, fontWeight: "700", color: COLORS.navy },
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
  gridRow: { flexDirection: "row" },
  hourLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: "600", paddingRight: 6, textAlign: "right", marginTop: -6, marginLeft: 4 },
  hourLine: {
    position: "absolute", left: 0, right: 0, height: 1, backgroundColor: COLORS.border,
  },
  halfHourLine: {
    position: "absolute", left: 0, right: 0, height: 1,
    backgroundColor: COLORS.border, opacity: 0.4,
  },
  nowLine: {
    position: "absolute", left: 0, right: 0, height: 2, backgroundColor: "#EF4444",
    zIndex: 5,
  },
  nowDot: {
    position: "absolute", left: -4, top: -4, width: 10, height: 10,
    borderRadius: 5, backgroundColor: "#EF4444",
  },
  eventBox: {
    position: "absolute", left: 2, right: 2, borderRadius: 6,
    padding: 4, borderLeftWidth: 3, overflow: "hidden",
  },
  eventTitle: { fontSize: 11, fontWeight: "800", color: COLORS.navy },
  eventTime: { fontSize: 10, color: COLORS.textSecondary, marginTop: 1 },
  dragPreview: {
    position: "absolute", left: 2, right: 2,
    backgroundColor: "rgba(30,136,229,0.3)",
    borderWidth: 2, borderColor: COLORS.primary,
    borderRadius: 6, alignItems: "center", justifyContent: "center",
  },
  dragPreviewText: { fontSize: 11, fontWeight: "800", color: COLORS.primary },
  modalRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalCard: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 32, maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: { fontSize: 20, fontWeight: "900", color: COLORS.text, flex: 1, marginRight: 12 },
  timeBox: {
    flexDirection: "row", alignItems: "center", gap: 8, padding: 12,
    backgroundColor: COLORS.bg, borderRadius: 10, marginVertical: 8,
  },
  timeText: { fontSize: 13, fontWeight: "700", color: COLORS.text, textTransform: "capitalize" },
  modeRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  modeChip: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, height: 48, borderRadius: 10, backgroundColor: COLORS.bg,
    borderWidth: 2, borderColor: COLORS.borderInput,
  },
  modeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modeChipText: { fontSize: 13, fontWeight: "800", color: COLORS.navy },
  mLabel: {
    fontSize: 11, fontWeight: "800", color: COLORS.textSecondary,
    letterSpacing: 1.2, marginTop: 14, marginBottom: 6,
  },
  mInput: {
    height: 50, backgroundColor: COLORS.bg, borderWidth: 2, borderColor: COLORS.borderInput,
    borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: COLORS.text,
  },
  primary: {
    flexDirection: "row",
    height: 52, borderRadius: 12, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center", marginTop: 20,
  },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  pickMatBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center",
    height: 52, borderRadius: 10, borderWidth: 2, borderColor: COLORS.primary,
    borderStyle: "dashed", backgroundColor: COLORS.bg,
  },
  backRow: {
    flexDirection: "row", alignItems: "center", gap: 4, padding: 6, marginBottom: 4,
  },
  backRowText: { color: COLORS.navy, fontWeight: "700", fontSize: 14 },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: COLORS.bg, borderRadius: 10, paddingHorizontal: 12, height: 44, marginBottom: 6,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text },
  matRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 10, backgroundColor: COLORS.bg, borderRadius: 10, marginBottom: 6,
  },
  matPreview: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    padding: 12, backgroundColor: COLORS.bg, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, marginTop: 6,
  },
  matCode: {
    fontSize: 12, fontWeight: "800", color: COLORS.primary, letterSpacing: 0.3,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
  matCliente: { fontSize: 14, fontWeight: "700", color: COLORS.text, marginTop: 2 },
  matUbic: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  matMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  descText: { fontSize: 14, color: COLORS.text, lineHeight: 20, marginTop: 4 },
});
