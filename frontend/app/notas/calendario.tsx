import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, TextInput, Alert, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ResponsiveLayout from "../../src/ResponsiveLayout";
import { useBreakpoint } from "../../src/useBreakpoint";
import { useThemedStyles } from "../../src/theme";
import IOSHeader from "../../src/ui/IOSHeader";
import { api, COLORS } from "../../src/api";
import { ios, fontStyle } from "../../src/ui/iosTheme";

interface Nota {
  id: string;
  titulo: string;
  contenido: string;
  fecha: string | null;
  updated_at: string;
}

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS_SEMANA = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

function fmtISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function CalendarioNotasScreen() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const s = useThemedStyles(useS);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [notaEdit, setNotaEdit] = useState<Nota | null>(null);
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");

  const loadDay = useCallback(async (fecha: string) => {
    const items = await api.listNotas(fecha);
    setNotas(items || []);
  }, []);

  useFocusEffect(useCallback(() => {
    if (selectedDay) loadDay(selectedDay);
  }, [selectedDay]));

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayISO = fmtISO(now.getFullYear(), now.getMonth(), now.getDate());

  const selectDay = (d: number) => {
    const iso = fmtISO(year, month, d);
    setSelectedDay(iso);
    loadDay(iso);
  };

  const nuevaNota = () => {
    setNotaEdit({ id: "", titulo: "", contenido: "", fecha: selectedDay, updated_at: "" } as Nota);
    setTitulo("");
    setContenido("");
  };

  const guardar = async () => {
    if (!titulo.trim() && !contenido.trim()) return;
    try {
      if (notaEdit!.id) {
        await api.updateNota(notaEdit!.id, { titulo: titulo.trim(), contenido: contenido.trim() });
      } else {
        await api.createNota({ titulo: titulo.trim(), contenido: contenido.trim(), fecha: selectedDay! });
      }
      setNotaEdit(null);
      if (selectedDay) loadDay(selectedDay);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const eliminar = (id: string) => {
    Alert.alert("Eliminar", "¿Borrar esta nota?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: async () => { await api.deleteNota(id); if (selectedDay) loadDay(selectedDay); } },
    ]);
  };

  const content = (
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      {!isWide && <IOSHeader title="Calendario de notas" showBack />}
      <View style={s.body}>
        <View style={s.nav}>
          <TouchableOpacity onPress={() => { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); }}>
            <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={s.monthTitle}>{MESES[month]} {year}</Text>
          <TouchableOpacity onPress={() => { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); }}>
            <Ionicons name="chevron-forward" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        <View style={s.weekRow}>
          {DIAS_SEMANA.map((d) => <Text key={d} style={s.weekDay}>{d}</Text>)}
        </View>
        <View style={s.grid}>
          {cells.map((d, i) => (
            <TouchableOpacity
              key={i}
              style={[s.dayCell, d && fmtISO(year, month, d) === selectedDay ? s.daySelected : null, d && fmtISO(year, month, d) === todayISO ? s.dayToday : null]}
              onPress={() => d && selectDay(d)}
              disabled={!d}
              activeOpacity={0.6}
            >
              <Text style={[s.dayNum, d && fmtISO(year, month, d) === todayISO ? { color: COLORS.primary, fontWeight: "900" as any } : null]}>
                {d || ""}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedDay && (
          <View style={{ flex: 1, marginTop: 12 }}>
            <Text style={s.fechaLabel}>{selectedDay}</Text>
            {notaEdit ? (
              <View style={s.editor}>
                <TextInput style={s.inputTitulo} value={titulo} onChangeText={setTitulo} placeholder="Título" placeholderTextColor={COLORS.textDisabled} />
                <TextInput style={s.inputContenido} value={contenido} onChangeText={setContenido} placeholder="Anotación del día..." placeholderTextColor={COLORS.textDisabled} multiline textAlignVertical="top" />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity style={s.btnGuardar} onPress={guardar}><Text style={s.btnText}>Guardar</Text></TouchableOpacity>
                  <TouchableOpacity style={s.btnCancelar} onPress={() => setNotaEdit(null)}><Text style={[s.btnText, { color: COLORS.textSecondary }]}>Cancelar</Text></TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={s.btnNueva} onPress={nuevaNota}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={[s.btnText, { color: "#fff" }]}>Añadir nota</Text>
              </TouchableOpacity>
            )}
            <ScrollView style={{ flex: 1 }}>
              {notas.map((n) => (
                <TouchableOpacity key={n.id} style={s.notaCard} onPress={() => { setNotaEdit(n); setTitulo(n.titulo); setContenido(n.contenido); }} activeOpacity={0.7}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.notaTitulo} numberOfLines={1}>{n.titulo || "Sin título"}</Text>
                    <Text style={s.notaPreview}>{n.contenido}</Text>
                  </View>
                  <TouchableOpacity onPress={() => eliminar(n.id)}><Ionicons name="trash-outline" size={16} color={COLORS.errorText} /></TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </SafeAreaView>
  );

  return <ResponsiveLayout active="notas">{content}</ResponsiveLayout>;
}

const useS = () =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.bg },
    body: { flex: 1, padding: ios.spacing.md },
    nav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: ios.spacing.sm, ...ios.shadow.card },
    monthTitle: { ...fontStyle("title3"), fontWeight: "800", color: COLORS.text },
    weekRow: { flexDirection: "row", marginBottom: ios.spacing.xs },
    weekDay: { flex: 1, textAlign: "center", ...fontStyle("section"), fontWeight: "700", color: COLORS.textSecondary, paddingVertical: ios.spacing.xs },
    grid: { flexDirection: "row", flexWrap: "wrap" },
    dayCell: {
      width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center",
      borderRadius: ios.radius.sm, marginBottom: 2,
    },
    daySelected: { backgroundColor: COLORS.primarySoft, borderWidth: 1.5, borderColor: COLORS.primary },
    dayToday: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: ios.radius.sm },
    dayNum: { ...fontStyle("subhead"), fontWeight: "600", color: COLORS.text },
    fechaLabel: { ...fontStyle("callout"), fontWeight: "800", color: COLORS.primary, marginBottom: ios.spacing.sm },
    editor: { backgroundColor: COLORS.surface, borderRadius: ios.radius.card, padding: ios.spacing.rowV, gap: ios.spacing.sm, marginBottom: ios.spacing.sm, borderWidth: 1, borderColor: COLORS.border, ...ios.shadow.card },
    inputTitulo: { ...fontStyle("title3"), fontWeight: "700", color: COLORS.text, paddingVertical: ios.spacing.xs },
    inputContenido: { ...fontStyle("callout"), color: COLORS.text, minHeight: 100 },
    btnGuardar: { backgroundColor: COLORS.primary, paddingHorizontal: ios.spacing.xl, paddingVertical: ios.spacing.sm, borderRadius: ios.radius.sm, alignItems: "center" },
    btnCancelar: { backgroundColor: COLORS.readonly, paddingHorizontal: ios.spacing.xl, paddingVertical: ios.spacing.sm, borderRadius: ios.radius.sm, alignItems: "center" },
    btnNueva: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: ios.spacing.sm,
      backgroundColor: COLORS.primary, paddingVertical: ios.spacing.sm, borderRadius: ios.radius.sm, marginBottom: ios.spacing.sm,
    },
    btnText: { ...fontStyle("subhead"), fontWeight: "700", color: "#fff" },
    notaCard: {
      flexDirection: "row", alignItems: "flex-start", backgroundColor: COLORS.surface,
      borderRadius: ios.radius.sm, padding: ios.spacing.sm, gap: ios.spacing.sm, marginBottom: 6, borderWidth: 1, borderColor: COLORS.border, ...ios.shadow.card,
    },
    notaTitulo: { ...fontStyle("subhead"), fontWeight: "800", color: COLORS.text },
    notaPreview: { ...fontStyle("footnote"), color: COLORS.textSecondary, marginTop: 2, lineHeight: 17 },
  });
