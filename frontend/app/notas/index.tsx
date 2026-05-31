import { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, TextInput, FlatList, Alert, StyleSheet, Platform, ScrollView, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ResponsiveLayout from "../../src/ResponsiveLayout";
import { useBreakpoint } from "../../src/useBreakpoint";
import { useThemedStyles } from "../../src/theme";
import IOSHeader from "../../src/ui/IOSHeader";
import { api, COLORS } from "../../src/api";
import { ios, fontStyle } from "../../src/ui/iosTheme";
import { useNotasActions, useShareNota } from "../../src/useNotasActions";

interface Nota {
  id: string; titulo: string; contenido: string; fecha: string | null; updated_at: string;
  marcada?: boolean; material_id?: string; material_name?: string; color?: string | null; priority?: string | null; tags?: string[]; pinned?: boolean; archived?: boolean;
}

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS_SEMANA = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

const PRIORITY_COLORS: Record<string, string> = { alta: "#EF4444", media: "#F59E0B", baja: "#10B981" };
function getDotColor(note: Nota): string | undefined {
  return note.color || (note.priority ? PRIORITY_COLORS[note.priority] : undefined);
}

function fmtISO(y: number, m: number, d: number) { return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }

function getDateCategory(fecha: string | null): string {
  if (!fecha) return "Sin fecha";
  const noteDate = new Date(fecha + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - noteDate.getTime()) / 86400000);
  if (diffDays < 0) return "Próximos";
  if (diffDays <= 7) return "Esta semana";
  if (diffDays <= 14) return "Semana pasada";
  return "Meses anteriores";
}

type NoteSection = { title: string; data: Nota[] };
function groupNotesBySection(notes: Nota[]): NoteSection[] {
  const groups: Record<string, Nota[]> = {};
  for (const n of notes) {
    const cat = getDateCategory(n.fecha);
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(n);
  }
  const order = ["Sin fecha", "Esta semana", "Semana pasada", "Meses anteriores", "Próximos"];
  const result: NoteSection[] = [];
  for (const key of order) {
    if (groups[key]?.length) result.push({ title: key, data: groups[key] });
  }
  return result;
}

const SECTION_COLORS: Record<string, string> = {
  "Sin fecha": "#F59E0B",
  "Esta semana": "#3B82F6",
  "Semana pasada": "#8B5CF6",
  "Meses anteriores": "#10B981",
  "Próximos": "#EC4899",
};

function getNoteAccent(note: Nota): string {
  if (note.color) return note.color;
  if (note.priority) return PRIORITY_COLORS[note.priority];
  return "#3B82F6";
}

export default function NotasIndexScreen() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const params = useLocalSearchParams<{ open?: string }>();
  const openedRef = useRef<string | null>(null);
  const s = useThemedStyles(useS);
  const [search, setSearch] = useState("");
  const [showMarked, setShowMarked] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);

  const [notasLibres, setNotasLibres] = useState<Nota[]>([]);
  const [editando, setEditando] = useState<Nota | null>(null);
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");


  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [notaDelDia, setNotaDelDia] = useState<Nota | null>(null);
  const [tituloDia, setTituloDia] = useState("");
  const [contenidoDia, setContenidoDia] = useState("");
  const [notasCalendario, setNotasCalendario] = useState<Record<string, Nota[]>>({});
  
  const [editColor, setEditColor] = useState<string | null>(null);
  const [editPriority, setEditPriority] = useState<string | null>(null);
  const [editTags, setEditTags] = useState<string>("");
  const [editColorDia, setEditColorDia] = useState<string | null>(null);
  const [editPriorityDia, setEditPriorityDia] = useState<string | null>(null);
  const [editTagsDia, setEditTagsDia] = useState<string>("");

  const [changingDate, setChangingDate] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const [changingDateLibre, setChangingDateLibre] = useState<string | null>(null);
  const [newDateLibre, setNewDateLibre] = useState("");

  const [linkMaterial, setLinkMaterial] = useState(false);
  const [materialId, setMaterialId] = useState("");
  const [matSearch, setMatSearch] = useState("");
  const [materialesList, setMaterialesList] = useState<any[]>([]);

  const { shareNota, setShareNota, usersList, selectedUsers, openShare, toggleUser, sendToChat } = useShareNota();

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

  const { toggleMarcada: toggleMarcadaApi, handleDelete, cambiarFecha: cambiarFechaApi, guardarNota } = useNotasActions(loadAll);

  const nuevaNota = () => { setEditando({ id: "", titulo: "", contenido: "", fecha: null, updated_at: "" } as Nota); setTitulo(""); setContenido(""); setLinkMaterial(false); setMaterialId(""); setMatSearch(""); setEditColor(null); setEditPriority(null); setEditTags(""); };
  const guardarLibre = async () => {
    if (!titulo.trim() && !contenido.trim()) return;
    const notaEdit = editando;
    setEditando(null);
    if (notaEdit?.id) {
      setNotasLibres((prev) => prev.map((n) => n.id === notaEdit.id ? { ...n, titulo: titulo.trim(), contenido: contenido.trim() } : n));
    }
    const body: any = { titulo: titulo.trim(), contenido: contenido.trim(), material_id: linkMaterial ? materialId || undefined : undefined };
    if (editColor) body.color = editColor;
    if (editPriority) body.priority = editPriority;
    if (editTags.trim()) body.tags = editTags.split(",").map((t: string) => t.trim()).filter(Boolean);
    if (notaEdit?.id) {
      await guardarNota(body, notaEdit.id);
    } else {
      const created = await guardarNota(body);
      if (created) setNotasLibres((prev) => [created, ...prev]);
    }
    loadAll();
  };
  const eliminarLibre = async (id: string) => { handleDelete(id); };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const todayISO = fmtISO(now.getFullYear(), now.getMonth(), now.getDate());

  const calendarDots = useMemo(() => {
    const dots: Record<string, string[]> = {};
    for (const n of notasLibres) {
      if (!n.fecha) continue;
      if (!dots[n.fecha]) dots[n.fecha] = [];
      const c = getDotColor(n);
      if (c && !dots[n.fecha].includes(c)) dots[n.fecha].push(c);
    }
    for (const [fecha, ns] of Object.entries(notasCalendario)) {
      if (!dots[fecha]) dots[fecha] = [];
      for (const n of ns) {
        const c = getDotColor(n);
        if (c && !dots[fecha].includes(c)) dots[fecha].push(c);
      }
    }
    return dots;
  }, [notasLibres, notasCalendario]);

  const filteredLibres = useMemo(() => {
    let result = [...notasLibres];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((n) => n.titulo?.toLowerCase().includes(q) || n.contenido?.toLowerCase().includes(q));
    }
    if (showMarked) result = result.filter((n) => (n as any).marcada);
    if (filterPriority) result = result.filter((n) => (n as any).priority === filterPriority);
    return result;
  }, [notasLibres, search, showMarked, filterPriority]);

  const sectionedNotes = useMemo(() => groupNotesBySection(filteredLibres), [filteredLibres]);

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
      setEditColorDia((existing as any).color || null);
      setEditPriorityDia((existing as any).priority || null);
      setEditTagsDia(((existing as any).tags || []).join(", "));
    } else {
      setNotaDelDia(null);
      setTituloDia("");
      setContenidoDia("");
      setEditColorDia(null);
      setEditPriorityDia(null);
      setEditTagsDia("");
    }
    setEditingDay(iso);
  };

  const guardarDia = async () => {
    if (!tituloDia.trim() && !contenidoDia.trim()) return;
    const updatedNota = notaDelDia;
    const day = editingDay;
    setEditingDay(null);
    setNotaDelDia(null);
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
    const body: any = { titulo: tituloDia.trim(), contenido: contenidoDia.trim() };
    if (editColorDia) body.color = editColorDia;
    if (editPriorityDia) body.priority = editPriorityDia;
    if (editTagsDia.trim()) body.tags = editTagsDia.split(",").map((t: string) => t.trim()).filter(Boolean);
    if (updatedNota?.id) {
      await guardarNota(body, updatedNota.id);
    } else {
      const created = await guardarNota({ ...body, fecha: day || undefined, material_id: linkMaterial ? materialId || undefined : undefined });
      if (created && day) {
        setNotasCalendario((prev) => {
          const copy = { ...prev };
          copy[day] = [...(copy[day] || []), created];
          return copy;
        });
      }
    }
    loadAll();
  };

  const eliminarDia = async (notaId: string) => { handleDelete(notaId); };

  const toggleMarcada = async (nota: Nota) => {
    const newVal = !(nota as any).marcada;
    setNotasLibres((prev) => prev.map((n) => n.id === nota.id ? { ...n, marcada: newVal } as any : n));
    setNotasCalendario((prev) => {
      const copy = { ...prev };
      for (const key of Object.keys(copy)) {
        copy[key] = copy[key].map((n: Nota) => n.id === nota.id ? { ...n, marcada: newVal } as any : n);
      }
      return copy;
    });
    await toggleMarcadaApi(nota);
  };

  const cambiarFecha = async () => {
    if (!changingDate || !newDate.trim()) return;
    await cambiarFechaApi(changingDate, newDate.trim());
    setChangingDate(null); setNewDate("");
  };

  const cambiarFechaLibre = async () => {
    if (!changingDateLibre || !newDateLibre.trim()) return;
    await cambiarFechaApi(changingDateLibre, newDateLibre.trim());
    setChangingDateLibre(null); setNewDateLibre("");
  };

  // --- Note card component ---
  const renderNoteCard = (item: Nota, isCalendarNote?: boolean) => {
    const accent = getNoteAccent(item);
    const hasColor = !!(item as any).color;
    return (
      <TouchableOpacity
        key={item.id}
        style={[s.noteCard, { borderLeftColor: accent, borderLeftWidth: 3 }]}
        activeOpacity={0.7}
        onPress={() => {
          if (isCalendarNote) {
            openDayEditor(item.fecha!); setNotaDelDia(item); setTituloDia(item.titulo); setContenidoDia(item.contenido);
          } else {
            setEditando(item); setTitulo(item.titulo); setContenido(item.contenido);
            setEditColor((item as any).color || null); setEditPriority((item as any).priority || null);
            setEditTags(((item as any).tags || []).join(", "));
            if ((item as any).material_id) { setLinkMaterial(true); setMaterialId((item as any).material_id); setMatSearch(""); }
          }
        }}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {(item as any).priority && (
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PRIORITY_COLORS[(item as any).priority] }} />
            )}
            <Text style={s.noteTitle} numberOfLines={1}>{item.titulo || "Sin título"}</Text>
            {(item as any).pinned && (
              <Ionicons name="pin" size={12} color={"#F59E0B"} />
            )}
          </View>
          {item.contenido ? (
            <Text style={s.notePreview} numberOfLines={2}>{item.contenido}</Text>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
            {(item as any).tags && (item as any).tags.length > 0 ? (
              (item as any).tags.slice(0, 2).map((tag: string, i: number) => (
                <View key={i} style={s.tagPill}>
                  <Text style={s.tagText}>{tag}</Text>
                </View>
              ))
            ) : null}
            {item.fecha && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Ionicons name="calendar-outline" size={10} color={COLORS.textSecondary} />
                <Text style={s.noteDate}>{item.fecha}</Text>
              </View>
            )}
            {!item.fecha && (
              <Text style={s.noteDate}>Sin fecha</Text>
            )}
          </View>
        </View>
        <View style={{ alignItems: "center", gap: 4, marginLeft: 8 }}>
          <TouchableOpacity onPress={() => toggleMarcada(item)} style={s.iconBtn}>
            <Ionicons name={(item as any).marcada ? "flag" : "flag-outline"} size={14} color={(item as any).marcada ? "#F59E0B" : COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openShare(item)} style={s.iconBtn}>
            <Ionicons name="share-outline" size={14} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => {
            if (item.fecha) { setChangingDate(item.id); setNewDate(item.fecha || ""); }
            else { setChangingDateLibre(item.id); setNewDateLibre(""); }
          }} style={s.iconBtn}>
            <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => isCalendarNote ? eliminarDia(item.id) : eliminarLibre(item.id)} style={s.iconBtn}>
            <Ionicons name="trash-outline" size={14} color={COLORS.errorText} />
          </TouchableOpacity>
        </View>
        {changingDate === item.id && (
          <View style={s.dateChanger}>
            <TextInput style={s.dateInput} value={newDate} onChangeText={setNewDate} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textSecondary} onSubmitEditing={cambiarFecha} />
            <TouchableOpacity style={s.btnOk} onPress={cambiarFecha}><Text style={s.btnOkText}>OK</Text></TouchableOpacity>
            <TouchableOpacity style={s.btnCancel} onPress={() => setChangingDate(null)}><Text style={s.btnCancelText}>X</Text></TouchableOpacity>
          </View>
        )}
        {changingDateLibre === item.id && (
          <View style={s.dateChanger}>
            <TextInput style={s.dateInput} value={newDateLibre} onChangeText={setNewDateLibre} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textSecondary} onSubmitEditing={cambiarFechaLibre} />
            <TouchableOpacity style={s.btnOk} onPress={cambiarFechaLibre}><Text style={s.btnOkText}>OK</Text></TouchableOpacity>
            <TouchableOpacity style={s.btnCancel} onPress={() => setChangingDateLibre(null)}><Text style={s.btnCancelText}>X</Text></TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // --- Panel: Notes ---
  const panelLibres = (
    <View style={[s.panel, { flex: isWide ? 1.8 : 1 }]}>
      {/* Search bar */}
      <View style={s.searchBar}>
        <Ionicons name="search-outline" size={16} color={COLORS.textSecondary} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar notas..."
          placeholderTextColor={COLORS.textSecondary}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")} style={{ padding: 4 }}>
            <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter chips */}
      <View style={s.filterRow}>
        <TouchableOpacity style={[s.filterChip, !showMarked && !filterPriority && s.filterChipActive]} onPress={() => { setShowMarked(false); setFilterPriority(null); }}>
          <Text style={[s.filterChipText, !showMarked && !filterPriority && s.filterChipTextActive]}>Todas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.filterChip, showMarked && s.filterChipActive]} onPress={() => setShowMarked(!showMarked)}>
          <Ionicons name={showMarked ? "flag" : "flag-outline"} size={12} color={showMarked ? COLORS.primary : COLORS.textSecondary} />
          <Text style={[s.filterChipText, showMarked && s.filterChipTextActive]}>Importantes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.filterChip, filterPriority === "alta" && s.filterChipActive]} onPress={() => setFilterPriority(filterPriority === "alta" ? null : "alta")}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: PRIORITY_COLORS.alta }} />
          <Text style={[s.filterChipText, filterPriority === "alta" && s.filterChipTextActive]}>Alta</Text>
        </TouchableOpacity>
      </View>

      {/* New note button */}
      {editando ? null : (
        <TouchableOpacity style={s.newNoteBtn} onPress={nuevaNota} activeOpacity={0.8}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.newNoteBtnText}>Nueva nota</Text>
        </TouchableOpacity>
      )}

      {/* Editor */}
      {editando && (
        <View style={s.editor}>
          <View style={s.editorHeader}>
            <Text style={s.editorTitle}>{editando.id ? "Editar nota" : "Nueva nota"}</Text>
            <TouchableOpacity onPress={() => setEditando(null)}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <TextInput style={s.inputTitulo} value={titulo} onChangeText={setTitulo} placeholder="Título" placeholderTextColor={COLORS.textSecondary} />
          <TextInput style={s.inputContenido} value={contenido} onChangeText={setContenido} placeholder="Escribe tu nota..." placeholderTextColor={COLORS.textSecondary} multiline textAlignVertical="top" />
          {/* Color picker */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 11, color: COLORS.textSecondary, fontWeight: "600", letterSpacing: 0.5 }}>COLOR</Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {[COLORS.primary, "#8B5CF6", "#10B981", "#F59E0B", "#EC4899"].map((c) => (
                <TouchableOpacity key={c} onPress={() => setEditColor(editColor === c ? null : c)} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c, borderWidth: 2, borderColor: editColor === c ? "#fff" : "transparent" }} />
              ))}
              {editColor && !["#3B82F6","#8B5CF6","#10B981","#F59E0B","#EC4899"].includes(editColor) && (
                <TouchableOpacity onPress={() => setEditColor(null)} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: editColor, borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center" }} />
              )}
              <TouchableOpacity onPress={() => setEditColor(null)} style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
          {/* Priority */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 11, color: COLORS.textSecondary, fontWeight: "600", letterSpacing: 0.5 }}>PRIORIDAD</Text>
            {(["alta", "media", "baja"] as string[]).map((p) => (
              <TouchableOpacity key={p} onPress={() => setEditPriority(editPriority === p ? null : p)} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: editPriority === p ? PRIORITY_COLORS[p] : COLORS.border, backgroundColor: editPriority === p ? PRIORITY_COLORS[p] + "20" : "transparent" }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: PRIORITY_COLORS[p] }} />
                <Text style={{ fontSize: 11, color: editPriority === p ? PRIORITY_COLORS[p] : COLORS.textSecondary }}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Tags */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 11, color: COLORS.textSecondary, fontWeight: "600", letterSpacing: 0.5 }}>TAGS</Text>
            <TextInput style={{ flex: 1, fontSize: 12, color: COLORS.text, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border }} value={editTags} onChangeText={setEditTags} placeholder="obra, urgente, idea..." placeholderTextColor={COLORS.textSecondary} />
          </View>
          {/* Link material */}
          <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" }} onPress={() => { setLinkMaterial(!linkMaterial); if (!linkMaterial) { api.listMateriales().then(setMaterialesList).catch(() => {}); } }}>
            <Ionicons name={linkMaterial ? "link" : "link-outline"} size={14} color={linkMaterial ? COLORS.primary : COLORS.textSecondary} />
            <Text style={{ fontSize: 11, color: linkMaterial ? COLORS.primary : COLORS.textSecondary }}>
              {linkMaterial && materialId ? (materialesList.find(m => m.id === materialId)?.materiales || "Proyecto") : "Vincular proyecto"}
            </Text>
          </TouchableOpacity>
          {linkMaterial && (
            <View style={{ backgroundColor: COLORS.bg, borderRadius: 10, padding: 10, maxHeight: 150, borderWidth: 1, borderColor: COLORS.border }}>
              <TextInput style={{ fontSize: 12, color: COLORS.text, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 4, marginBottom: 6 }} value={matSearch} onChangeText={(v) => { setMatSearch(v); api.listMateriales(v || undefined).then(setMaterialesList).catch(() => {}); }} placeholder="Buscar proyecto..." placeholderTextColor={COLORS.textSecondary} />
              <ScrollView style={{ maxHeight: 100 }}>
                {(matSearch ? materialesList : []).slice(0, 15).map((m: any) => (
                  <TouchableOpacity key={m.id} style={{ paddingVertical: 5, paddingHorizontal: 8, borderRadius: 6, backgroundColor: materialId === m.id ? COLORS.primarySoft : "transparent" }} onPress={() => setMaterialId(m.id)}>
                    <Text style={{ fontSize: 11, color: COLORS.text }} numberOfLines={1}>{m.materiales || "—"} — {m.cliente || ""}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
            <TouchableOpacity style={s.btnGuardar} onPress={guardarLibre}><Text style={s.btnGuardarText}>Guardar</Text></TouchableOpacity>
            <TouchableOpacity style={s.btnCancelar} onPress={() => setEditando(null)}><Text style={s.btnCancelarText}>Cancelar</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {/* Sectioned notes list */}
      <FlatList
        data={sectionedNotes}
        keyExtractor={(item) => item.title}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80, gap: 8 }}
        renderItem={({ item: section }) => (
          <View style={{ marginBottom: 4 }}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionDot, { backgroundColor: SECTION_COLORS[section.title] || COLORS.primary }]} />
              <Text style={s.sectionTitle}>{section.title}</Text>
              <Text style={s.sectionCount}>{section.data.length}</Text>
            </View>
            {section.data.map((note) => renderNoteCard(note))}
          </View>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 40, gap: 8 }}>
            <Ionicons name="document-text-outline" size={40} color={COLORS.textSecondary} />
            <Text style={{ color: COLORS.textSecondary, fontSize: 14 }}>No hay notas todavía</Text>
            <TouchableOpacity style={s.newNoteBtn} onPress={nuevaNota}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={s.newNoteBtnText}>Crear primera nota</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* FAB for mobile */}
      {!editando && !isWide && (
        <TouchableOpacity style={s.fab} onPress={nuevaNota} activeOpacity={0.8}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );

  // --- Panel: Calendar ---
  const panelCalendario = (
    <View style={[s.panel, { flex: isWide ? 3 : 1 }]}>
      {/* Calendar header */}
      <View style={s.calHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity onPress={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }} style={s.todayBtn}>
            <Text style={s.todayBtnText}>Hoy</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: "row", gap: 4 }}>
            <TouchableOpacity onPress={() => { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); }} style={s.calArrow}>
              <Ionicons name="chevron-back" size={18} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); }} style={s.calArrow}>
              <Ionicons name="chevron-forward" size={18} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={s.calMonthTitle}>{MESES[month]} {year}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={s.viewToggle}>
            <TouchableOpacity style={[s.viewToggleBtn, s.viewToggleActive]}>
              <Text style={[s.viewToggleText, s.viewToggleTextActive]}>Mes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.viewToggleBtn}>
              <Text style={s.viewToggleText}>Semana</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.calFilterBtn}>
            <Ionicons name="options-outline" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Weekday headers */}
      <View style={s.weekRow}>
        {DIAS_SEMANA.map((d) => <Text key={d} style={s.weekDay}>{d}</Text>)}
      </View>

      {/* Calendar grid */}
      <View style={s.grid}>
        {cells.map((d, i) => {
          const iso = d ? fmtISO(year, month, d) : "";
          const dots = iso ? calendarDots[iso] : undefined;
          const isToday = iso === todayISO;
          const isSel = iso === selectedDay;
          const dayNotes = iso ? notasCalendario[iso] || [] : [];
          if (!d) return <View key={i} style={s.dayCell} />;
          return (
            <TouchableOpacity
              key={i}
              style={[s.dayCell, isToday && s.dayToday, isSel && s.daySelected]}
              onPress={() => selectDay(d)}
              activeOpacity={0.7}
            >
              <View style={[s.dayNumWrap, isToday && s.dayNumTodayWrap]}>
                <Text style={[s.dayNum, isToday && s.dayNumToday]}>{d}</Text>
              </View>
              {dayNotes.length > 0 && (
                <View style={{ marginTop: 2, gap: 1, width: "100%", paddingHorizontal: 2 }}>
                  {dayNotes.slice(0, 2).map((note) => (
                    <View key={note.id} style={[s.calEventMini, { borderLeftColor: getNoteAccent(note), borderLeftWidth: 2 }]}>
                      <Text style={s.calEventMiniText} numberOfLines={1}>{note.titulo || "—"}</Text>
                    </View>
                  ))}
                  {dayNotes.length > 2 && (
                    <Text style={s.calEventMore}>+{dayNotes.length - 2}</Text>
                  )}
                </View>
              )}
              {dots && dayNotes.length === 0 && (
                <View style={s.dotsRow}>
                  {dots.slice(0, 3).map((col, j) => (
                    <View key={j} style={[s.dot, { backgroundColor: col }]} />
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected day details */}
      {selectedDay && (
        <View style={{ flex: 1, marginTop: 12 }}>
          <View style={s.selectedDayHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: COLORS.primary }} />
              <Text style={s.selectedDayTitle}>{selectedDay}</Text>
            </View>
            <TouchableOpacity style={s.addNoteBtn} onPress={() => openDayEditor(selectedDay)}>
              <Ionicons name="add" size={14} color="#fff" />
              <Text style={s.addNoteBtnText}>Añadir</Text>
            </TouchableOpacity>
          </View>

          {editingDay === selectedDay && (
            <View style={s.editor}>
              <View style={s.editorHeader}>
                <Text style={s.editorTitle}>{notaDelDia?.id ? "Editar nota" : "Nueva nota"}</Text>
                <TouchableOpacity onPress={() => setEditingDay(null)}>
                  <Ionicons name="close" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
              <TextInput style={s.inputTitulo} value={tituloDia} onChangeText={setTituloDia} placeholder="Título" placeholderTextColor={COLORS.textSecondary} />
              <TextInput style={s.inputContenido} value={contenidoDia} onChangeText={setContenidoDia} placeholder="Anotación..." placeholderTextColor={COLORS.textSecondary} multiline textAlignVertical="top" />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 11, color: COLORS.textSecondary, fontWeight: "600", letterSpacing: 0.5 }}>COLOR</Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {[COLORS.primary, "#8B5CF6", "#10B981", "#F59E0B", "#EC4899"].map((c) => (
                    <TouchableOpacity key={c} onPress={() => setEditColorDia(editColorDia === c ? null : c)} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c, borderWidth: 2, borderColor: editColorDia === c ? "#fff" : "transparent" }} />
                  ))}
                  <TouchableOpacity onPress={() => setEditColorDia(null)} style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 11, color: COLORS.textSecondary, fontWeight: "600", letterSpacing: 0.5 }}>PRIORIDAD</Text>
                {(["alta", "media", "baja"] as string[]).map((p) => (
                  <TouchableOpacity key={p} onPress={() => setEditPriorityDia(editPriorityDia === p ? null : p)} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: editPriorityDia === p ? PRIORITY_COLORS[p] : COLORS.border, backgroundColor: editPriorityDia === p ? PRIORITY_COLORS[p] + "20" : "transparent" }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: PRIORITY_COLORS[p] }} />
                    <Text style={{ fontSize: 11, color: editPriorityDia === p ? PRIORITY_COLORS[p] : COLORS.textSecondary }}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 11, color: COLORS.textSecondary, fontWeight: "600", letterSpacing: 0.5 }}>TAGS</Text>
                <TextInput style={{ flex: 1, fontSize: 12, color: COLORS.text, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border }} value={editTagsDia} onChangeText={setEditTagsDia} placeholder="obra, urgente..." placeholderTextColor={COLORS.textSecondary} />
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity style={s.btnGuardar} onPress={guardarDia}><Text style={s.btnGuardarText}>Guardar</Text></TouchableOpacity>
                <TouchableOpacity style={s.btnCancelar} onPress={() => setEditingDay(null)}><Text style={s.btnCancelarText}>Cancelar</Text></TouchableOpacity>
                {notaDelDia?.id && <TouchableOpacity style={[s.btnCancelar, { backgroundColor: COLORS.errorText + "20", borderColor: COLORS.errorText }]} onPress={() => eliminarDia(notaDelDia!.id)}><Text style={[s.btnCancelarText, { color: COLORS.errorText }]}>Borrar</Text></TouchableOpacity>}
              </View>
            </View>
          )}

          <FlatList
            data={notasCalendario[selectedDay] || []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => renderNoteCard(item, true)}
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: 6, paddingBottom: 20 }}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingVertical: 30, gap: 6 }}>
                <Ionicons name="calendar-outline" size={32} color={COLORS.textSecondary} />
                <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>Sin notas para este día</Text>
              </View>
            }
          />
        </View>
      )}
    </View>
  );

  // --- Share Modal ---
  const shareModal = (
    <Modal visible={!!shareNota} transparent animationType="fade" onRequestClose={() => setShareNota(null)}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" }} activeOpacity={1} onPress={() => setShareNota(null)}>
        <View style={{ backgroundColor: COLORS.surface, borderRadius: 20, width: 380, maxHeight: "75%", overflow: "hidden", borderWidth: 1, borderColor: COLORS.border, ...(Platform.OS === "web" ? { backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" } : {}) } as any} onStartShouldSetResponder={() => true}>
          <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: COLORS.text, letterSpacing: -0.3 }}>Enviar por chat</Text>
            <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }} numberOfLines={1}>{shareNota?.titulo || shareNota?.contenido || "Nota"}</Text>
          </View>
          <FlatList
            data={usersList}
            keyExtractor={(u: any) => u.id}
            renderItem={({ item }) => {
              const sel = selectedUsers.includes(item.id);
              return (
                <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, paddingHorizontal: 20 }} onPress={() => toggleUser(item.id)}>
                  <Ionicons name={sel ? "checkbox" : "square-outline"} size={20} color={sel ? COLORS.primary : COLORS.textSecondary} />
                  <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: (item as any).color || COLORS.primary, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>{(item.name || item.email)[0].toUpperCase()}</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: COLORS.text, flex: 1 }}>{item.name || item.email}</Text>
                </TouchableOpacity>
              );
            }}
            style={{ maxHeight: 300 }}
          />
          <View style={{ flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border }}>
            <TouchableOpacity style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border }} onPress={() => setShareNota(null)}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.textSecondary }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center",
                ...(Platform.OS === "web" && selectedUsers.length > 0 ? { backgroundImage: "linear-gradient(135deg, #3B82F6, #8B5CF6)" } : { backgroundColor: selectedUsers.length > 0 ? COLORS.primary : COLORS.surface }),
              }}
              onPress={sendToChat}
              disabled={selectedUsers.length === 0}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: selectedUsers.length > 0 ? "#fff" : COLORS.textSecondary }}>Enviar ({selectedUsers.length})</Text>
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
          <View style={{ flex: 1, flexDirection: "row", gap: 16 }}>
            <View style={{ borderRightWidth: 1, borderRightColor: COLORS.border, paddingRight: 16, flex: 1.8 }}>{panelLibres}</View>
            <View style={{ flex: 3 }}>{panelCalendario}</View>
          </View>
        ) : (
          <>
            <ScrollView style={{ maxHeight: isWide ? undefined : 380 }}>
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
  body: { flex: 1, padding: 16 },

  panel: { flex: 1 },

  // --- Search & Filters ---
  searchBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingVertical: Platform.OS === "web" ? 10 : 8,
    gap: 10, marginBottom: 12,
    ...Platform.select({
      web: { backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" } as any,
      default: {},
    }),
  },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.text, paddingVertical: 0, outlineStyle: "none" as any },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  filterChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: "transparent",
  },
  filterChipActive: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primary },
  filterChipText: { fontSize: 12, fontWeight: "500", color: COLORS.textSecondary },
  filterChipTextActive: { color: COLORS.primary },

  // --- New note button ---
  newNoteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 12, borderRadius: 14, marginBottom: 16,
    ...Platform.select({
      web: { backgroundImage: "linear-gradient(135deg, #3B82F6, #8B5CF6)" } as any,
      default: { backgroundColor: COLORS.primary },
    }),
    ...Platform.select({
      web: { boxShadow: "0 4px 20px rgba(59,130,246,0.3)" } as any,
      default: {},
    }),
  },
  newNoteBtnText: { fontSize: 14, fontWeight: "700", color: "#fff", letterSpacing: 0.3 },

  // --- Section headers ---
  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 8, paddingHorizontal: 4, marginBottom: 4,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, letterSpacing: 0.5, textTransform: "uppercase" },
  sectionCount: { fontSize: 11, color: COLORS.textSecondary, fontWeight: "500" },

  // --- Note card ---
  noteCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 14, marginBottom: 6,
    flexDirection: "row",
    ...Platform.select({
      web: {
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        transition: "all 0.2s ease",
        boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
      } as any,
      default: {},
    }),
  },
  noteTitle: { fontSize: 15, fontWeight: "600", color: COLORS.text, letterSpacing: -0.2, flex: 1 },
  notePreview: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, lineHeight: 18 },
  noteDate: { fontSize: 10, color: COLORS.textSecondary, fontWeight: "500" },
  tagPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: COLORS.primarySoft },
  tagText: { fontSize: 10, color: COLORS.primary, fontWeight: "500" },
  iconBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },

  // --- Date changer overlay ---
  dateChanger: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: COLORS.surface, paddingHorizontal: 12,
    borderRadius: 16, borderWidth: 1, borderColor: COLORS.border,
    ...Platform.select({
      web: { backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" } as any,
      default: {},
    }),
  },
  dateInput: {
    flex: 1, fontSize: 12, color: COLORS.text,
    backgroundColor: COLORS.bg, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: COLORS.border,
  },
  btnOk: {
    backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 8,
  },
  btnOkText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  btnCancel: {
    backgroundColor: COLORS.surface, paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  btnCancelText: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary },

  // --- Editor ---
  editor: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 18, gap: 14, marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.border,
    ...Platform.select({
      web: { boxShadow: "0 8px 32px rgba(0,0,0,0.3), 0 0 60px rgba(59,130,246,0.05)" } as any,
      default: {},
    }),
  },
  editorHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  editorTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text, letterSpacing: -0.2 },
  inputTitulo: { fontSize: 16, fontWeight: "600", color: COLORS.text, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  inputContenido: { fontSize: 13, color: COLORS.text, minHeight: 100, lineHeight: 20, paddingVertical: 6 },
  btnGuardar: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, alignItems: "center",
    ...Platform.select({
      web: { backgroundImage: "linear-gradient(135deg, #3B82F6, #8B5CF6)" } as any,
      default: { backgroundColor: COLORS.primary },
    }),
  },
  btnGuardarText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  btnCancelar: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, alignItems: "center",
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  btnCancelarText: { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary },

  // --- Calendar ---
  calHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 16,
  },
  todayBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  todayBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  calArrow: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  calMonthTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text, letterSpacing: -0.5 },
  viewToggle: { flexDirection: "row", borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  viewToggleBtn: { paddingHorizontal: 12, paddingVertical: 5 },
  viewToggleActive: { backgroundColor: COLORS.primary },
  viewToggleText: { fontSize: 11, fontWeight: "600", color: COLORS.textSecondary },
  viewToggleTextActive: { color: "#fff" },
  calFilterBtn: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  weekRow: { flexDirection: "row", marginBottom: 4 },
  weekDay: {
    width: "14.28%", textAlign: "center",
    fontSize: 11, fontWeight: "600", color: COLORS.textSecondary,
    paddingVertical: 6, letterSpacing: 0.5, textTransform: "uppercase",
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: "14.28%",
    paddingVertical: 4, paddingHorizontal: 2,
    borderRadius: 12, marginBottom: 2,
    flexGrow: 1, overflow: "hidden", minHeight: 60,
  },
  dayToday: { backgroundColor: COLORS.primarySoft },
  daySelected: { backgroundColor: COLORS.primarySoft, borderWidth: 1.5, borderColor: COLORS.primary },
  dayNum: { fontSize: 13, fontWeight: "500", color: COLORS.textSecondary, textAlign: "center" },
  dayNumToday: { color: "#fff", fontWeight: "700" },
  dayNumWrap: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  dayNumTodayWrap: {
    backgroundColor: COLORS.primary, width: 24, height: 24, borderRadius: 12,
    alignItems: "center", justifyContent: "center", alignSelf: "center",
    ...Platform.select({ web: { boxShadow: "0 0 16px rgba(59,130,246,0.4)" } as any, default: {} }),
  },
  calEventMini: {
    backgroundColor: COLORS.readonly,
    borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2,
    marginBottom: 1,
  },
  calEventMiniText: { fontSize: 8, color: COLORS.textSecondary, fontWeight: "500" },
  calEventMore: { fontSize: 8, color: COLORS.textSecondary, textAlign: "center", fontWeight: "600" },
  dotsRow: { flexDirection: "row", gap: 2, justifyContent: "center", marginTop: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },

  // --- Selected day ---
  selectedDayHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 10,
  },
  selectedDayTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text, letterSpacing: -0.2 },
  addNoteBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10,
    ...Platform.select({
      web: { backgroundImage: "linear-gradient(135deg, #3B82F6, #8B5CF6)" } as any,
      default: { backgroundColor: COLORS.primary },
    }),
  },
  addNoteBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },

  // --- FAB ---
  fab: {
    position: "absolute", bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    alignItems: "center", justifyContent: "center",
    ...Platform.select({
      web: { backgroundImage: "linear-gradient(135deg, #3B82F6, #8B5CF6)", boxShadow: "0 4px 24px rgba(59,130,246,0.4)" } as any,
      default: { backgroundColor: COLORS.primary },
    }),
    ...Platform.select({
      web: { backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" } as any,
      default: {},
    }),
  },
});
