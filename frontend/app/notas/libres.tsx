import { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Modal, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
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

const PRIORITY_COLORS: Record<string, string> = { alta: "#EF4444", media: "#F59E0B", baja: "#10B981" };
function getNoteAccent(note: Nota): string {
  if (note.color) return note.color;
  if (note.priority) return PRIORITY_COLORS[note.priority];
  return "#3B82F6";
}

export default function NotasLibresScreen() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const s = useThemedStyles(useS);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [editando, setEditando] = useState<Nota | null>(null);
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");

  const [search, setSearch] = useState("");
  const [showMarked, setShowMarked] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);

  const [editColor, setEditColor] = useState<string | null>(null);
  const [editPriority, setEditPriority] = useState<string | null>(null);
  const [editTags, setEditTags] = useState<string>("");

  const [linkMaterial, setLinkMaterial] = useState(false);
  const [materialId, setMaterialId] = useState("");
  const [matSearch, setMatSearch] = useState("");
  const [materialesList, setMaterialesList] = useState<any[]>([]);

  const { shareNota, setShareNota, usersList, selectedUsers, openShare, toggleUser, sendToChat } = useShareNota();

  const load = useCallback(async () => {
    const items = await api.listNotas();
    setNotas((items || []).filter((n: Nota) => !n.fecha));
  }, []);

  const { toggleMarcada: toggleMarcadaApi, handleDelete, guardarNota } = useNotasActions(load);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const nuevaNota = () => {
    setEditando({ id: "", titulo: "", contenido: "", fecha: null, updated_at: "" } as Nota);
    setTitulo("");
    setContenido("");
    setLinkMaterial(false);
    setMaterialId("");
    setMatSearch("");
    setEditColor(null);
    setEditPriority(null);
    setEditTags("");
  };

  const editarNota = (n: Nota) => {
    setEditando(n);
    setTitulo(n.titulo);
    setContenido(n.contenido);
    setEditColor(n.color || null);
    setEditPriority(n.priority || null);
    setEditTags((n.tags || []).join(", "));
    if (n.material_id) { setLinkMaterial(true); setMaterialId(n.material_id); setMatSearch(""); }
  };

  const guardar = async () => {
    if (!titulo.trim() && !contenido.trim()) return;
    const notaEdit = editando;
    setEditando(null);
    const body: any = { titulo: titulo.trim(), contenido: contenido.trim(), material_id: linkMaterial ? materialId || undefined : undefined };
    if (editColor) body.color = editColor;
    if (editPriority) body.priority = editPriority;
    if (editTags.trim()) body.tags = editTags.split(",").map((t: string) => t.trim()).filter(Boolean);
    if (notaEdit?.id) {
      await guardarNota(body, notaEdit.id);
    } else {
      await guardarNota(body);
    }
    load();
  };

  const eliminar = (id: string) => { handleDelete(id); };

  const toggleMarcada = async (nota: Nota) => {
    const newVal = !nota.marcada;
    setNotas((prev) => prev.map((n) => n.id === nota.id ? { ...n, marcada: newVal } as any : n));
    await toggleMarcadaApi(nota);
  };

  const filteredNotas = useMemo(() => {
    let result = [...notas];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((n) => n.titulo?.toLowerCase().includes(q) || n.contenido?.toLowerCase().includes(q));
    }
    if (showMarked) result = result.filter((n) => n.marcada);
    if (filterPriority) result = result.filter((n) => n.priority === filterPriority);
    return result;
  }, [notas, search, showMarked, filterPriority]);

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
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      {!isWide && <IOSHeader title="Notas libres" showBack />}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: ios.spacing.lg, paddingBottom: 60, gap: 6 }}
          keyboardShouldPersistTaps="handled"
        >
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
            {(["alta", "media", "baja"] as string[]).map((p) => (
              <TouchableOpacity key={p} style={[s.filterChip, filterPriority === p && s.filterChipActive]} onPress={() => setFilterPriority(filterPriority === p ? null : p)}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: PRIORITY_COLORS[p] }} />
                <Text style={[s.filterChipText, filterPriority === p && s.filterChipTextActive]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {editando ? (
            <View style={s.editor}>
              <View style={s.editorHeader}>
                <Text style={s.editorTitle}>{editando.id ? "Editar nota" : "Nueva nota"}</Text>
                <TouchableOpacity onPress={() => setEditando(null)}>
                  <Ionicons name="close" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
              <TextInput style={s.inputTitulo} value={titulo} onChangeText={setTitulo} placeholder="Título" placeholderTextColor={COLORS.textDisabled} />
              <TextInput style={s.inputContenido} value={contenido} onChangeText={setContenido} placeholder="Escribe tu nota..." placeholderTextColor={COLORS.textDisabled} multiline textAlignVertical="top" />
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
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity style={s.btnGuardar} onPress={guardar}><Text style={s.btnText}>Guardar</Text></TouchableOpacity>
                <TouchableOpacity style={s.btnCancelar} onPress={() => setEditando(null)}><Text style={[s.btnText, { color: COLORS.textSecondary }]}>Cancelar</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={s.btnNueva} onPress={nuevaNota}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={[s.btnText, { color: "#fff" }]}>Nueva nota</Text>
            </TouchableOpacity>
          )}

          {filteredNotas.map((item) => (
            <TouchableOpacity key={item.id} style={[s.notaCard, { borderLeftColor: getNoteAccent(item), borderLeftWidth: 3 }]} onPress={() => editarNota(item)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {item.priority && (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PRIORITY_COLORS[item.priority] }} />
                  )}
                  <Text style={s.notaTitulo} numberOfLines={1}>{item.titulo || "Sin título"}</Text>
                  {item.pinned && (
                    <Ionicons name="pin" size={12} color={"#F59E0B"} />
                  )}
                </View>
                {item.contenido ? (
                  <Text style={s.notaPreview} numberOfLines={2}>{item.contenido}</Text>
                ) : null}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                  {item.tags && item.tags.length > 0 ? (
                    item.tags.slice(0, 2).map((tag: string, i: number) => (
                      <View key={i} style={s.tagPill}>
                        <Text style={s.tagText}>{tag}</Text>
                      </View>
                    ))
                  ) : null}
                  <Text style={s.notaFecha}>{item.updated_at?.slice(0, 10)}</Text>
                </View>
              </View>
              <View style={{ alignItems: "center", gap: 4, marginLeft: 8 }}>
                <TouchableOpacity onPress={() => toggleMarcada(item)} style={s.iconBtn}>
                  <Ionicons name={item.marcada ? "flag" : "flag-outline"} size={14} color={item.marcada ? "#F59E0B" : COLORS.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openShare(item)} style={s.iconBtn}>
                  <Ionicons name="share-outline" size={14} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => eliminar(item.id)} style={s.iconBtn}>
                  <Ionicons name="trash-outline" size={14} color={COLORS.errorText} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
      {shareModal}
    </SafeAreaView>
  );

  return <ResponsiveLayout active="notas">{content}</ResponsiveLayout>;
}

const useS = () =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.bg },
    body: { flex: 1, padding: ios.spacing.lg },
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
    // --- Editor ---
    editor: { backgroundColor: COLORS.surface, borderRadius: ios.radius.card, padding: ios.spacing.rowV, gap: ios.spacing.md, marginBottom: ios.spacing.md, borderWidth: 1, borderColor: COLORS.border, ...ios.shadow.card },
    editorHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    editorTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text, letterSpacing: -0.2 },
    inputTitulo: { ...fontStyle("title3"), fontWeight: "700", color: COLORS.text, paddingVertical: ios.spacing.xs, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    inputContenido: { ...fontStyle("callout"), color: COLORS.text, minHeight: 100, lineHeight: 20 },
    btnGuardar: { backgroundColor: COLORS.primary, paddingHorizontal: ios.spacing.xl, paddingVertical: ios.spacing.sm, borderRadius: ios.radius.sm, alignItems: "center" },
    btnCancelar: { backgroundColor: COLORS.readonly, paddingHorizontal: ios.spacing.xl, paddingVertical: ios.spacing.sm, borderRadius: ios.radius.sm, alignItems: "center" },
    btnNueva: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: ios.spacing.sm,
      backgroundColor: COLORS.primary, paddingVertical: ios.spacing.md, borderRadius: ios.radius.row, marginBottom: ios.spacing.md,
    },
    btnText: { ...fontStyle("callout"), fontWeight: "700", color: "#fff" },
    // --- Note card ---
    notaCard: {
      flexDirection: "row", alignItems: "flex-start", backgroundColor: COLORS.surface,
      borderRadius: ios.radius.row, padding: ios.spacing.md, gap: ios.spacing.sm, borderWidth: 1, borderColor: COLORS.border, marginBottom: 6, ...ios.shadow.card,
    },
    notaTitulo: { ...fontStyle("callout"), fontWeight: "800", color: COLORS.text, flex: 1 },
    notaPreview: { ...fontStyle("footnote"), color: COLORS.textSecondary, marginTop: 2, lineHeight: 18 },
    notaFecha: { ...fontStyle("caption"), color: COLORS.textDisabled, fontWeight: "500" },
    tagPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: COLORS.primarySoft },
    tagText: { fontSize: 10, color: COLORS.primary, fontWeight: "500" },
    iconBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  });
