import React, { useState } from "react";
import { Platform, TouchableOpacity, View, Text, StyleSheet, Modal, Pressable, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "./api";

type Mode = "date" | "time";

function pad(n: number) { return String(n).padStart(2, "0"); }
function toTimeStr(d: Date) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function addMonths(d: Date, n: number): Date { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DOW = ["L", "M", "X", "J", "V", "S", "D"];

// Mini calendar for picking a date (cross-platform)
function MiniCalendar({ value, onSelect }: { value: Date; onSelect: (d: Date) => void }) {
  const [anchor, setAnchor] = useState(new Date(value.getFullYear(), value.getMonth(), 1));
  const first = new Date(anchor);
  first.setDate(1);
  const firstWeekday = (first.getDay() === 0 ? 7 : first.getDay()) - 1; // Monday = 0
  const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(anchor.getFullYear(), anchor.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={cal.root}>
      <View style={cal.navRow}>
        <TouchableOpacity style={cal.navBtn} onPress={() => setAnchor(addMonths(anchor, -1))}>
          <Ionicons name="chevron-back" size={20} color={COLORS.navy} />
        </TouchableOpacity>
        <Text style={cal.navTitle}>{MONTHS[anchor.getMonth()]} {anchor.getFullYear()}</Text>
        <TouchableOpacity style={cal.navBtn} onPress={() => setAnchor(addMonths(anchor, 1))}>
          <Ionicons name="chevron-forward" size={20} color={COLORS.navy} />
        </TouchableOpacity>
      </View>
      <View style={cal.dowRow}>
        {DOW.map((d, i) => <Text key={i} style={cal.dowText}>{d}</Text>)}
      </View>
      <View style={cal.grid}>
        {cells.map((c, i) => {
          if (!c) return <View key={i} style={cal.cell} />;
          const selected = sameDay(c, value);
          const today = sameDay(c, new Date());
          return (
            <TouchableOpacity
              key={i}
              testID={`cal-day-${c.getDate()}`}
              style={[cal.cell, cal.dayCell, selected && cal.dayCellSelected, today && !selected && cal.dayCellToday]}
              onPress={() => onSelect(c)}
            >
              <Text style={[cal.dayText, selected && cal.dayTextSelected, today && !selected && cal.dayTextToday]}>
                {c.getDate()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// Mini clock for picking time
function MiniClock({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const h = value.getHours();
  const m = value.getMinutes();

  const setH = (nh: number) => {
    const d = new Date(value);
    d.setHours(((nh % 24) + 24) % 24);
    onChange(d);
  };
  const setM = (nm: number) => {
    const d = new Date(value);
    d.setMinutes(((nm % 60) + 60) % 60);
    onChange(d);
  };

  return (
    <View style={clk.wrap}>
      <View style={clk.col}>
        <Text style={clk.label}>HORA</Text>
        <View style={clk.pickerRow}>
          <TouchableOpacity style={clk.arrowBtn} onPress={() => setH(h + 1)}>
            <Ionicons name="chevron-up" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <TextInput
            testID="input-hour"
            style={clk.num}
            keyboardType="number-pad"
            maxLength={2}
            value={pad(h)}
            onChangeText={(t) => {
              const n = parseInt(t.replace(/\D/g, ""), 10);
              if (!isNaN(n)) setH(Math.min(23, n));
            }}
          />
          <TouchableOpacity style={clk.arrowBtn} onPress={() => setH(h - 1)}>
            <Ionicons name="chevron-down" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={clk.sep}>:</Text>
      <View style={clk.col}>
        <Text style={clk.label}>MIN</Text>
        <View style={clk.pickerRow}>
          <TouchableOpacity style={clk.arrowBtn} onPress={() => setM(m + 5)}>
            <Ionicons name="chevron-up" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <TextInput
            testID="input-min"
            style={clk.num}
            keyboardType="number-pad"
            maxLength={2}
            value={pad(m)}
            onChangeText={(t) => {
              const n = parseInt(t.replace(/\D/g, ""), 10);
              if (!isNaN(n)) setM(Math.min(59, n));
            }}
          />
          <TouchableOpacity style={clk.arrowBtn} onPress={() => setM(m - 5)}>
            <Ionicons name="chevron-down" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function DateTimeField({
  value, mode, onChange, label, testID, disabled, style,
}: {
  value: Date;
  mode: Mode;
  onChange: (d: Date) => void;
  label?: string;
  testID?: string;
  disabled?: boolean;
  style?: any;
}) {
  const [open, setOpen] = useState(false);
  const [tempValue, setTempValue] = useState<Date>(value);

  const displayText = mode === "date"
    ? value.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    : toTimeStr(value);

  const openPicker = () => {
    if (disabled) return;
    setTempValue(new Date(value));
    setOpen(true);
  };

  const confirm = () => { onChange(tempValue); setOpen(false); };
  const cancel = () => setOpen(false);

  return (
    <View style={[s.wrap, style]}>
      {label ? <Text style={s.lbl}>{label}</Text> : null}
      <TouchableOpacity
        testID={testID}
        style={[s.btn, disabled && { opacity: 0.7 }, open && s.btnOpen]}
        disabled={disabled}
        onPress={open ? cancel : openPicker}
        activeOpacity={0.7}
      >
        <Ionicons name={mode === "date" ? "calendar" : "time"} size={16} color={COLORS.primary} />
        <Text style={s.btnText}>{displayText}</Text>
        <View style={{ flex: 1 }} />
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={COLORS.textSecondary} />
      </TouchableOpacity>

      {open && (
        <View style={s.inlinePanel}>
          {mode === "date" ? (
            <MiniCalendar value={tempValue} onSelect={(d) => {
              const nv = new Date(tempValue);
              nv.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
              setTempValue(nv);
            }} />
          ) : (
            <MiniClock value={tempValue} onChange={setTempValue} />
          )}
          <View style={s.actions}>
            <TouchableOpacity style={[s.actionBtn, s.actionCancel]} onPress={cancel}>
              <Text style={s.actionCancelTxt}>CANCELAR</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="btn-picker-ok" style={[s.actionBtn, s.actionOk]} onPress={confirm}>
              <Text style={s.actionOkTxt}>ACEPTAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  lbl: {
    fontSize: 11, fontWeight: "800", color: COLORS.textSecondary,
    letterSpacing: 1.2, marginTop: 14, marginBottom: 6,
  },
  btn: {
    flexDirection: "row", alignItems: "center", gap: 8, height: 46,
    borderRadius: 10, backgroundColor: COLORS.bg, borderWidth: 2,
    borderColor: COLORS.borderInput, paddingHorizontal: 12,
  },
  btnOpen: { borderColor: COLORS.primary, backgroundColor: "#EFF6FF" },
  btnText: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  inlinePanel: {
    marginTop: 6, backgroundColor: COLORS.surface, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.primary, padding: 10,
  },
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center", padding: 20,
  },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 18, padding: 18,
    width: "100%", maxWidth: 360,
  },
  cardHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 10,
  },
  cardTitle: { fontSize: 17, fontWeight: "800", color: COLORS.text },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  actionBtn: { flex: 1, height: 46, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  actionCancel: { backgroundColor: COLORS.bg, borderWidth: 2, borderColor: COLORS.borderInput },
  actionCancelTxt: { color: COLORS.navy, fontWeight: "800", letterSpacing: 0.5 },
  actionOk: { backgroundColor: COLORS.primary },
  actionOkTxt: { color: "#fff", fontWeight: "800", letterSpacing: 0.5 },
});

const cal = StyleSheet.create({
  root: {},
  navRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 8,
  },
  navBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: COLORS.bg },
  navTitle: { fontSize: 15, fontWeight: "800", color: COLORS.text, textTransform: "capitalize" },
  dowRow: { flexDirection: "row", marginBottom: 4 },
  dowText: {
    flex: 1, textAlign: "center", fontSize: 11, fontWeight: "800",
    color: COLORS.textSecondary, letterSpacing: 0.5,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  dayCell: { alignItems: "center", justifyContent: "center", borderRadius: 8 },
  dayCellSelected: { backgroundColor: COLORS.primary },
  dayCellToday: { borderWidth: 2, borderColor: COLORS.primary },
  dayText: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  dayTextSelected: { color: "#fff", fontWeight: "800" },
  dayTextToday: { color: COLORS.primary, fontWeight: "800" },
});

const clk = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
  col: { alignItems: "center", gap: 6 },
  label: { fontSize: 10, fontWeight: "800", color: COLORS.textSecondary, letterSpacing: 1 },
  pickerRow: { alignItems: "center", gap: 4 },
  arrowBtn: { width: 44, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: COLORS.bg },
  num: {
    width: 84, height: 64, borderRadius: 12, textAlign: "center",
    fontSize: 34, fontWeight: "900", color: COLORS.text,
    backgroundColor: COLORS.bg, borderWidth: 2, borderColor: COLORS.borderInput,
  },
  sep: { fontSize: 34, fontWeight: "900", color: COLORS.text, marginTop: 16 },
});
