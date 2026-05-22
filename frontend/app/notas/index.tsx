import { useCallback, useRef, useState } from "react";
import { View, Text, TouchableOpacity, TextInput, FlatList, Alert, StyleSheet, Platform, ScrollView, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ResponsiveLayout from "../../src/ResponsiveLayout";
import { useBreakpoint } from "../../src/useBreakpoint";
import { useThemedStyles, useTheme } from "../../src/theme";
import IOSHeader from "../../src/ui/IOSHeader";
import { api, COLORS } from "../../src/api";

interface Nota {
  id: string; titulo: string; contenido: string; fecha: string | null; updated_at: string;
}

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS_SEMANA = ["Lu", "Ma", "Mi", "Ju", "Vi"];

function fmtISO(y: number, m: number, d: number) { return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }

export default function NotasIndexScreen() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const params = useLocalSearchParams<{ open?: string }>();
  const openedRef = useRef<string | null>(null);
  const s = useThemedStyles(useS);
  const { theme } = useTheme();
  const txtColor = theme === "dark" ? "#E2E8F0" : COLORS.text;
  const txtSecondary = theme === "dark" ? "#CBD5E1" : COLORS.textSecondary;

  // Free notes
  const [notasLibres, setNotasLibres] = useState<Nota[]>([]);
  const [editando, setEditando] = useState<Nota | null>(null);
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");

  // Calendar
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [notaDelDia, setNotaDelDia] = useState<Nota | null>(null);
  const [tituloDia, setTituloDia] = useState("");
  const [contenidoDia, setContenidoDia] = useState("");
  const [notasCalendario, setNotasCalendario] = useState<Record<string, Nota[]>>({});

  // Date change for a note
  const [changingDate, setChangingDate] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const [changingDateLibre, setChangingDateLibre] = useState<string | null>(null);
  const [newDateLibre, setNewDateLibre] = useState("");

  // Share to chat
  const [shareNota, setShareNota] = useState<Nota | null>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [linkMaterial, setLinkMaterial] = useState(false);
  const [materialId, setMaterialId] = useState("");
  const [matSearch, setMatSearch] = useState("");
  const [materialesList, setMaterialesList] = useState<any[]>([]);

  const loadAll = useCallback(async () => {
    const items = await api.listNotas();
    const libres: Nota[] = [];
    const cal: Record<string, Nota[]> = {};
    (items || []).forEach((n: Nota) => {
      if (!n.fecha) { libres.push(n); return; }
      if (!cal[n.fecha]) cal[n.fecha] = [];
      cal[n.fecha].push(n);
    });
    setNotasLibres(libres);
    setNotasCalendario(cal);
    // Auto-abrir nota desde Inicio
    const openId = (params as any)?.open;
    if (openId && openedRef.current !== openId) {
      openedRef.current = openId;
      const target = (items || []).find((n: Nota) => n.id === openId);
      if (target) {
        if (target.fecha) {
          setSelectedDay(target.fecha);
          setEditingDay(target.fecha);
          setNotaDelDia(target);
          setTituloDia(target.titulo || "");
          setContenidoDia(target.contenido || "");
        } else {
          setEditando(target);
          setTitulo(target.titulo || "");
          setContenido(target.contenido || "");
        }
        router.replace("/notas");
      }
    }
  }, []);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  // Free notes
  const nuevaNota = () => { setEditando({ id: "", titulo: "", contenido: "", fecha: null, updated_at: "" } as Nota); setTitulo(""); setContenido(""); setLinkMaterial(false); setMaterialId(""); setMatSearch(""); };
  const guardarLibre = async () => {
    if (!titulo.trim() && !contenido.trim()) return;
    const notaEdit = editando;
    setEditando(null);
    // Optimistic update
    if (notaEdit?.id) {
      setNotasLibres((prev) => prev.map((n) => n.id === notaEdit.id ? { ...n, titulo: titulo.trim(), contenido: contenido.trim() } : n));
    }
    try {
      if (notaEdit?.id) {
        await api.updateNota(notaEdit.id, { titulo: titulo.trim(), contenido: contenido.trim(), material_id: linkMaterial ? materialId || undefined : undefined });
      } else {
        const created = await api.createNota({ titulo: titulo.trim(), contenido: contenido.trim(), material_id: linkMaterial ? materialId || undefined : undefined });
        if (created) setNotasLibres((prev) => [created, ...prev]);
      }
      loadAll();
    } catch (e: any) { Alert.alert("Error", e.message); loadAll(); }
  };
  const eliminarLibre = async (id: string) => {
    if (Platform.OS === "web" && !window.confirm("¿Borrar?")) return;
    try { await api.deleteNota(id); loadAll(); } catch (e: any) { Alert.alert("Error", e.message); }
  };

  // Calendar
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow && i < 5; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = (new Date(year, month, d).getDay() + 6) % 7;
    if (dow >= 5) continue;
    cells.push(d);
  }
  const todayISO = fmtISO(now.getFullYear(), now.getMonth(), now.getDate());

  const selectDay = (d: number) => {
    const iso = fmtISO(year, month, d);
    setSelectedDay(iso);
    setEditingDay(null);
    setNotaDelDia(null);
  };

  const openDayEditor = (iso: string) => {
    const existing = notasCalendario[iso]?.[0];
    if (existing) {
      setNotaDelDia(existing);
      setTituloDia(existing.titulo || "");
      setContenidoDia(existing.contenido || "");
    } else {
      setNotaDelDia(null);
      setTituloDia("");
      setContenidoDia("");
    }
    setEditingDay(iso);
  };

  const guardarDia = async () => {
    if (!tituloDia.trim() && !contenidoDia.trim()) return;
    const updatedNota = notaDelDia;
    const day = editingDay;
    setEditingDay(null);
    setNotaDelDia(null);
    // Optimistic update
    if (updatedNota && day) {
      setNotasCalendario((prev) => {
        const copy = { ...prev };
        const list = [...(copy[day] || [])];
        const idx = list.findIndex((n) => n.id === updatedNota.id);
        if (idx >= 0) {
          list[idx] = { ...list[idx], titulo: tituloDia.trim(), contenido: contenidoDia.trim() };
          copy[day] = list;
        }
        return copy;
      });
    }
    try {
      if (updatedNota?.id) {
        await api.updateNota(updatedNota.id, { titulo: tituloDia.trim(), contenido: contenidoDia.trim() });
      } else {
        const created = await api.createNota({ titulo: tituloDia.trim(), contenido: contenidoDia.trim(), fecha: day || undefined, material_id: linkMaterial ? materialId || undefined : undefined });
        if (created && day) {
          setNotasCalendario((prev) => {
            const copy = { ...prev };
            copy[day] = [...(copy[day] || []), created];
            return copy;
          });
        }
      }
      loadAll();
    } catch (e: any) { Alert.alert("Error", e.message); loadAll(); }
  };

  const eliminarDia = async (notaId: string) => {
    if (Platform.OS === "web" && !window.confirm("¿Borrar?")) return;
    try { await api.deleteNota(notaId); loadAll(); } catch (e: any) { Alert.alert("Error", e.message); }
  };

  const toggleMarcada = async (nota: Nota) => {
    const newVal = !(nota as any).marcada;
    // Optimistic update
    setNotasLibres((prev) => prev.map((n) => n.id === nota.id ? { ...n, marcada: newVal } as any : n));
    setNotasCalendario((prev) => {
      const copy = { ...prev };
      for (const key of Object.keys(copy)) {
        copy[key] = copy[key].map((n: Nota) => n.id === nota.id ? { ...n, marcada: newVal } as any : n);
      }
      return copy;
    });
    try {
      await api.updateNota(nota.id, { marcada: newVal });
    } catch { loadAll(); }
  };

  const cambiarFecha = async () => {
    if (!changingDate || !newDate.trim()) return;
    const iso = newDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) { Alert.alert("Formato", "Usa YYYY-MM-DD (ej: 2025-05-14)"); return; }
    try {
      await api.updateNota(changingDate, { fecha: iso });
      setChangingDate(null); setNewDate(""); loadAll();
    } catch (e: any) { Alert.alert("Error", e.message); }
  };

  const cambiarFechaLibre = async () => {
    if (!changingDateLibre || !newDateLibre.trim()) return;
    const iso = newDateLibre.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) { Alert.alert("Formato", "Usa YYYY-MM-DD (ej: 2025-05-14)"); return; }
    try {
      await api.updateNota(changingDateLibre, { fecha: iso });
      setChangingDateLibre(null); setNewDateLibre(""); loadAll();
    } catch (e: any) { Alert.alert("Error", e.message); }
  };

  // Enviar nota por chat
  const openShare = async (nota: Nota) => {
    setShareNota(nota);
    setSelectedUsers([]);
    try {
      const users = await api.listUsers();
      setUsersList(users || []);
    } catch { setUsersList([]); }
  };

  const toggleUser = (uid: string) => {
    setSelectedUsers((p) => p.includes(uid) ? p.filter((x) => x !== uid) : [...p, uid]);
  };

  const sendToChat = async () => {
    if (!shareNota || selectedUsers.length === 0) return;
    try {
      const body = shareNota.titulo || shareNota.contenido || "";
      const chat = await api.chatCreate({ participant_ids: selectedUsers, name: shareNota.titulo?.slice(0, 50) || "Nota compartida" });
      await api.chatSend(chat.id, body);
      setShareNota(null); setSelectedUsers([]);
      Alert.alert("Enviado", "Nota compartida por chat.");
    } catch (e: any) { Alert.alert("Error", e.message); }
  };

  // Panel: Notas libres
  const panelLibres = (
    <View style={{ flex: 1 }}>
      <Text style={s.panelTitle}>Notas libres</Text>
      {editando ? (
        <View style={s.editor}>
          <TextInput style={s.inputTitulo} value={titulo} onChangeText={setTitulo} placeholder="Título" placeholderTextColor={COLORS.textDisabled} />
          <TextInput style={s.inputContenido} value={contenido} onChangeText={setContenido} placeholder="Escribe..." placeholderTextColor={COLORS.textDisabled} multiline textAlignVertical="top" />
          <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }} onPress={() => { setLinkMaterial(!linkMaterial); if (!linkMaterial) { api.listMateriales().then(setMaterialesList).catch(() => {}); } }}>
            <Ionicons name={linkMaterial ? "link" : "link-outline"} size={14} color={linkMaterial ? COLORS.primary : COLORS.textSecondary} />
            <Text style={{ fontSize: 11, color: linkMaterial ? COLORS.primary : COLORS.textSecondary }}>
              {linkMaterial && materialId ? (materialesList.find(m => m.id === materialId)?.materiales || "Proyecto") : "Vincular proyecto"}
            </Text>
          </TouchableOpacity>
          {linkMaterial && (
            <View style={{ backgroundColor: COLORS.bg, borderRadius: 8, padding: 8, maxHeight: 150 }}>
              <TextInput style={{ fontSize: 12, color: COLORS.text, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 4, marginBottom: 4 }} value={matSearch} onChangeText={(v) => { setMatSearch(v); api.listMateriales(v || undefined).then(setMaterialesList).catch(() => {}); }} placeholder="Buscar proyecto..." placeholderTextColor={COLORS.textDisabled} />
              <ScrollView style={{ maxHeight: 100 }}>
                {(matSearch ? materialesList : []).slice(0, 15).map((m: any) => (
                  <TouchableOpacity key={m.id} style={{ paddingVertical: 4, paddingHorizontal: 6, borderRadius: 4, backgroundColor: materialId === m.id ? COLORS.primarySoft : "transparent" }} onPress={() => setMaterialId(m.id)}>
                    <Text style={{ fontSize: 11, color: COLORS.text }} numberOfLines={1}>{m.materiales || "—"} — {m.cliente || ""}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          <View style={{ flexDirection: "row", gap: 6 }}>
            <TouchableOpacity style={s.btnGuardar} onPress={guardarLibre}><Text style={s.btnText}>Guardar</Text></TouchableOpacity>
            <TouchableOpacity style={s.btnCancelar} onPress={() => setEditando(null)}><Text style={[s.btnText, { color: COLORS.textSecondary }]}>Cancelar</Text></TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={s.btnNueva} onPress={nuevaNota}>
          <Ionicons name="add" size={16} color="#fff" /><Text style={s.btnText}>Nueva nota</Text>
        </TouchableOpacity>
      )}
      <FlatList data={notasLibres} keyExtractor={(item) => item.id} renderItem={({ item }) => (
        <View style={s.noteCardWrap}>
          <TouchableOpacity style={s.dateBadge} onPress={() => { setChangingDateLibre(item.id); setNewDateLibre(""); }}>
            <Ionicons name="calendar-outline" size={11} color={COLORS.textSecondary} />
            <Text style={[s.dateBadgeText, { color: COLORS.textSecondary }]}>Sin fecha</Text>
            <Ionicons name="pencil" size={10} color={COLORS.textDisabled} />
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => { setEditando(item); setTitulo(item.titulo); setContenido(item.contenido); }} activeOpacity={0.7}>
            <Text style={s.notaTituloCard} numberOfLines={1}>{item.titulo || "Sin título"}</Text>
            {item.contenido ? <Text style={s.notaContCard} numberOfLines={2}>{item.contenido}</Text> : null}
          </TouchableOpacity>
          <TouchableOpacity style={{ padding: 4 }} onPress={() => toggleMarcada(item)}>
            <Ionicons name={(item as any).marcada ? "flag" : "flag-outline"} size={15} color={(item as any).marcada ? "#F59E0B" : COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={{ padding: 4 }} onPress={() => openShare(item)}>
            <Ionicons name="share-outline" size={15} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={{ padding: 4 }} onPress={() => eliminarLibre(item.id)}>
            <Ionicons name="trash-outline" size={15} color={COLORS.errorText} />
          </TouchableOpacity>
          {changingDateLibre === item.id && (
            <View style={s.dateChanger}>
              <TextInput style={s.dateInput} value={newDateLibre} onChangeText={setNewDateLibre} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textDisabled} onSubmitEditing={cambiarFechaLibre} />
              <TouchableOpacity style={s.btnGuardar} onPress={cambiarFechaLibre}><Text style={s.btnText}>OK</Text></TouchableOpacity>
              <TouchableOpacity style={s.btnCancelar} onPress={() => setChangingDateLibre(null)}><Text style={[s.btnText, { color: COLORS.textSecondary }]}>X</Text></TouchableOpacity>
            </View>
          )}
        </View>
      )} contentContainerStyle={{ gap: 4, paddingBottom: 20 }} />
    </View>
  );

  // Panel: Calendario
  const panelCalendario = (
    <View style={{ flex: 1 }}>
      <Text style={s.panelTitle}>Calendario</Text>
      <View style={s.nav}>
        <TouchableOpacity onPress={() => { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); }}>
          <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={s.monthTitle}>{MESES[month]} {year}</Text>
        <TouchableOpacity onPress={() => { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); }}>
          <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      <View style={s.weekRow}>{DIAS_SEMANA.map((d) => <Text key={d} style={s.weekDay}>{d}</Text>)}</View>
      <View style={s.grid}>
        {cells.map((d, i) => {
          const iso = d ? fmtISO(year, month, d) : "";
          const dayNotas = iso ? notasCalendario[iso] : undefined;
          const isToday = iso === todayISO;
          const isSel = iso === selectedDay;
          const fullText = dayNotas?.length ? dayNotas.map(n => n.titulo || n.contenido).filter(Boolean).join(" | ") : "";
          if (!d) return <View key={i} style={s.dayCell} />;
          return (
            <TouchableOpacity key={i} style={[s.dayCell, { minHeight: isWide ? 110 : 70 }, isToday && s.dayToday, isSel && s.daySelected]} onPress={() => selectDay(d)} activeOpacity={0.7}>
              <Text style={[s.dayNum, { color: txtColor }, isToday && { color: COLORS.primary, fontWeight: "900" }]}>{d}</Text>
              {fullText ? <Text style={[s.dayPreview, { color: txtSecondary }]} numberOfLines={isWide ? 6 : 2}>{fullText}</Text> : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Notas del día seleccionado */}
      {selectedDay && (
        <View style={{ flex: 1, marginTop: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Text style={s.fechaLabel}>{selectedDay}</Text>
            <TouchableOpacity style={s.btnAdd} onPress={() => openDayEditor(selectedDay)}>
              <Ionicons name="add" size={14} color="#fff" /><Text style={s.btnAddText}>Añadir</Text>
            </TouchableOpacity>
          </View>

          {editingDay === selectedDay && (
            <View style={[s.editor, { marginBottom: 8 }]}>
              <TextInput style={s.inputTitulo} value={tituloDia} onChangeText={setTituloDia} placeholder="Título" placeholderTextColor={COLORS.textDisabled} />
              <TextInput style={s.inputContenido} value={contenidoDia} onChangeText={setContenidoDia} placeholder="Anotación..." placeholderTextColor={COLORS.textDisabled} multiline textAlignVertical="top" />
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TouchableOpacity style={s.btnGuardar} onPress={guardarDia}><Text style={s.btnText}>Guardar</Text></TouchableOpacity>
                <TouchableOpacity style={s.btnCancelar} onPress={() => setEditingDay(null)}><Text style={[s.btnText, { color: COLORS.textSecondary }]}>Cancelar</Text></TouchableOpacity>
                {notaDelDia?.id && <TouchableOpacity style={[s.btnCancelar, { backgroundColor: COLORS.errorBg }]} onPress={() => eliminarDia(notaDelDia!.id)}><Text style={[s.btnText, { color: COLORS.errorText }]}>Borrar</Text></TouchableOpacity>}
              </View>
            </View>
          )}

          <FlatList
            data={notasCalendario[selectedDay] || []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={s.noteCardWrap}>
                <TouchableOpacity style={s.dateBadge} onPress={() => { setChangingDate(item.id); setNewDate(item.fecha || ""); }}>
                  <Ionicons name="calendar" size={11} color={COLORS.primary} />
                  <Text style={s.dateBadgeText}>{item.fecha}</Text>
                  <Ionicons name="pencil" size={10} color={COLORS.textDisabled} />
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => { openDayEditor(item.fecha!); setNotaDelDia(item); setTituloDia(item.titulo); setContenidoDia(item.contenido); }} activeOpacity={0.7}>
                  <Text style={s.notaTituloCard} numberOfLines={1}>{item.titulo || "Sin título"}</Text>
                  {item.contenido ? <Text style={s.notaContCard} numberOfLines={2}>{item.contenido}</Text> : null}
                </TouchableOpacity>
          <TouchableOpacity style={{ padding: 4 }} onPress={() => toggleMarcada(item)}>
            <Ionicons name={(item as any).marcada ? "flag" : "flag-outline"} size={15} color={(item as any).marcada ? "#F59E0B" : COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={{ padding: 4 }} onPress={() => openShare(item)}>
                  <Ionicons name="share-outline" size={15} color={COLORS.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={{ padding: 4 }} onPress={() => eliminarDia(item.id)}>
                  <Ionicons name="trash-outline" size={15} color={COLORS.errorText} />
                </TouchableOpacity>

                {/* Modal inline para cambiar fecha */}
                {changingDate === item.id && (
                  <View style={s.dateChanger}>
                    <TextInput style={s.dateInput} value={newDate} onChangeText={setNewDate} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textDisabled} onSubmitEditing={cambiarFecha} />
                    <TouchableOpacity style={s.btnGuardar} onPress={cambiarFecha}><Text style={s.btnText}>OK</Text></TouchableOpacity>
                    <TouchableOpacity style={s.btnCancelar} onPress={() => setChangingDate(null)}><Text style={[s.btnText, { color: COLORS.textSecondary }]}>X</Text></TouchableOpacity>
                  </View>
                )}
              </View>
            )}
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: 4, paddingBottom: 20 }}
          />
        </View>
      )}
    </View>
  );

  // ---- Share Modal ----
  const shareModal = (
    <Modal visible={!!shareNota} transparent animationType="fade" onRequestClose={() => setShareNota(null)}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" }} activeOpacity={1} onPress={() => setShareNota(null)}>
        <View style={{ backgroundColor: COLORS.surface, borderRadius: 14, width: 360, maxHeight: "70%", overflow: "hidden" }} onStartShouldSetResponder={() => true}>
          <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
            <Text style={{ fontSize: 16, fontWeight: "900", color: COLORS.text }}>Enviar por chat</Text>
            <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }} numberOfLines={1}>{shareNota?.titulo || shareNota?.contenido || "Nota"}</Text>
          </View>
          <FlatList
            data={usersList}
            keyExtractor={(u: any) => u.id}
            renderItem={({ item }) => {
              const sel = selectedUsers.includes(item.id);
              return (
                <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, paddingHorizontal: 14 }} onPress={() => toggleUser(item.id)}>
                  <Ionicons name={sel ? "checkbox" : "square-outline"} size={20} color={sel ? COLORS.primary : COLORS.textDisabled} />
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: (item as any).color || COLORS.primary, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>{(item.name || item.email)[0].toUpperCase()}</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: COLORS.text, flex: 1 }}>{item.name || item.email}</Text>
                </TouchableOpacity>
              );
            }}
            style={{ maxHeight: 300 }}
          />
          <View style={{ flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border }}>
            <TouchableOpacity style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center", backgroundColor: COLORS.readonly }} onPress={() => setShareNota(null)}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.textSecondary }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center", backgroundColor: selectedUsers.length > 0 ? COLORS.primary : COLORS.readonly }} onPress={sendToChat} disabled={selectedUsers.length === 0}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: selectedUsers.length > 0 ? "#fff" : COLORS.textDisabled }}>Enviar ({selectedUsers.length})</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const content = (
    <>
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      {!isWide && <IOSHeader title="Notas" showBack />}
      <View style={s.body}>
        {isWide ? (
          <View style={{ flex: 1, flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: COLORS.border, paddingRight: 12 }}>{panelLibres}</View>
            <View style={{ flex: 4 }}>{panelCalendario}</View>
          </View>
        ) : (
          <>
            <ScrollView style={{ maxHeight: isWide ? undefined : 420 }}>
              {panelCalendario}
            </ScrollView>
            <View style={{ height: 12 }} />
            <View style={{ flex: 1 }}>
              {panelLibres}
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
    {shareModal}
    </>
  );

  return <ResponsiveLayout active="notas">{content}</ResponsiveLayout>;
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  body: { flex: 1, padding: 12 },
  panelTitle: { fontSize: 16, fontWeight: "900", color: COLORS.text, marginBottom: 8, letterSpacing: 0.3 },
  nav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  monthTitle: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  weekRow: { flexDirection: "row", marginBottom: 2 },
  weekDay: { width: "20%", textAlign: "center", fontSize: 10, fontWeight: "700", color: COLORS.textSecondary, paddingVertical: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: "20%", paddingVertical: 4, paddingHorizontal: 1, borderRadius: 6, marginBottom: 2, flexGrow: 1, overflow: "hidden" },
  dayToday: { borderWidth: 1, borderColor: COLORS.primary },
  daySelected: { backgroundColor: COLORS.primarySoft, borderWidth: 1.5, borderColor: COLORS.primary },
  dayNum: { fontSize: 11, fontWeight: "600" },
  dayPreview: { fontSize: 8.5, lineHeight: 11 },
  fechaLabel: { fontSize: 13, fontWeight: "800", color: COLORS.primary },
  editor: { backgroundColor: COLORS.surface, borderRadius: 10, padding: 10, gap: 8, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  inputTitulo: { fontSize: 14, fontWeight: "700", color: COLORS.text, paddingVertical: 2 },
  inputContenido: { fontSize: 13, color: COLORS.text, minHeight: 80, lineHeight: 18 },
  btnGuardar: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 7, alignItems: "center" },
  btnCancelar: { backgroundColor: COLORS.readonly, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 7, alignItems: "center" },
  btnNueva: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: COLORS.primary, paddingVertical: 8, borderRadius: 8, marginBottom: 8 },
  btnAdd: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  btnAddText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  btnText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  notaCard: { backgroundColor: COLORS.surface, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: COLORS.border },
  notaTitulo: { fontSize: 12, fontWeight: "800", color: COLORS.text },
  noteCardWrap: {
    backgroundColor: COLORS.surface, borderRadius: 10, padding: 8, gap: 4,
    borderWidth: 1, borderColor: COLORS.border, flexDirection: "row", alignItems: "flex-start",
  },
  dateBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: COLORS.primarySoft, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, marginRight: 8 },
  dateBadgeText: { fontSize: 10, fontWeight: "700", color: COLORS.primary },
  notaTituloCard: { fontSize: 13, fontWeight: "800", color: COLORS.text },
  notaContCard: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  dateChanger: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.surface, paddingHorizontal: 8, borderRadius: 10 },
  dateInput: { flex: 1, fontSize: 11, color: COLORS.text, backgroundColor: COLORS.bg, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 4 },
});
