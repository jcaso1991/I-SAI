import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, Alert, StyleSheet, Platform, Modal, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ResponsiveLayout from "../src/ResponsiveLayout";
import { useBreakpoint } from "../src/useBreakpoint";
import { useThemedStyles } from "../src/theme";
import IOSHeader from "../src/ui/IOSHeader";
import { usePermissions } from "../src/permissions";
import { api, COLORS, BACKEND_URL, getToken } from "../src/api";

interface DocItem {
  _id: string; titulo: string; categoria: string; filename: string; created_by: string; created_at: string;
}

export default function DocumentacionesScreen() {
  const { isWide } = useBreakpoint();
  const s = useThemedStyles(useS);
  const { has } = usePermissions();
  const puedeGestionar = has("documentos.manage");

  const [seccion, setSeccion] = useState<"menu" | "fichas" | "manuales">("menu");
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [viewingTitle, setViewingTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? docs.filter((d) => (d.titulo || d.filename || "").toLowerCase().includes(search.toLowerCase()))
    : docs;

  const load = useCallback(async () => {
    if (seccion === "menu") return;
    setLoading(true);
    try {
      const items = await api.listDocumentos(seccion);
      setDocs(items || []);
    } catch { setDocs([]); }
    finally { setLoading(false); }
  }, [seccion]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const uploadFile = async () => {
    if (!puedeGestionar) { Alert.alert("Permiso", "No tienes permiso para subir documentos."); return; }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 20 * 1024 * 1024) { Alert.alert("Error", "Límite 20 MB"); return; }
      const reader = new FileReader();
      reader.onload = async () => {
        const b64 = (reader.result as string).split(",")[1];
        try {
          await api.createDocumento({ titulo: file.name.replace(".pdf", ""), categoria: seccion, filename: file.name, file_base64: b64 });
          load();
        } catch (e: any) { Alert.alert("Error", e.message); }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const eliminar = (id: string) => {
    if (!window.confirm("¿Eliminar este documento?")) return;
    api.deleteDocumento(id).then(() => load()).catch((e: any) => Alert.alert("Error", e.message));
  };

  const verPDF = async (id: string, title: string) => {
    try {
      const t = await getToken();
      const res = await fetch(`${BACKEND_URL}/api/documentos/${id}/file`, {
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      });
      if (!res.ok) throw new Error("Error al cargar PDF");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      setViewingFile(blobUrl);
      setViewingTitle(title);
    } catch (e: any) { Alert.alert("Error", e.message); }
  };

  const descargar = async (id: string) => {
    try {
      const t = await getToken();
      const res = await fetch(`${BACKEND_URL}/api/documentos/${id}/file`, {
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      });
      if (!res.ok) throw new Error("Error al descargar");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "documento.pdf";
      a.click();
    } catch (e: any) { Alert.alert("Error", e.message); }
  };

  const cards = [
    { key: "fichas" as const, title: "Fichas técnicas", icon: "hardware-chip-outline", subtitle: "Datasheets y especificaciones" },
    { key: "manuales" as const, title: "Manuales", icon: "book-outline", subtitle: "Guías de instalación y uso" },
  ];

  const content = (
    <>
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      {!isWide && <IOSHeader title={seccion === "menu" ? "Docs. y Software" : seccion === "fichas" ? "Fichas técnicas" : "Manuales"} showBack onBack={seccion === "menu" ? undefined : () => setSeccion("menu")} backLabel={seccion === "menu" ? "Atrás" : "Docs"} />}
      <View style={s.body}>
        {seccion === "menu" ? (
          <>
            <Text style={s.heading}>Documentación y Software</Text>
            <Text style={s.subtitle}>Fichas técnicas y manuales de producto</Text>
            <View style={s.cards}>
              {cards.map((card) => (
                <TouchableOpacity key={card.key} style={s.card} onPress={() => setSeccion(card.key)} activeOpacity={0.8}>
                  <View style={s.cardIcon}><Ionicons name={card.icon as any} size={32} color={COLORS.primary} /></View>
                  <View style={s.cardBody}>
                    <Text style={s.cardTitle}>{card.title}</Text>
                    <Text style={s.cardSubtitle}>{card.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.textDisabled} />
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            <TouchableOpacity style={s.backBtn} onPress={() => setSeccion("menu")}>
              <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
              <Text style={s.backText}>Volver</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={s.heading}>{seccion === "fichas" ? "Fichas técnicas" : "Manuales"}</Text>
              {puedeGestionar && (
                <TouchableOpacity style={s.btnAdd} onPress={uploadFile}>
                  <Ionicons name="add" size={16} color="#fff" /><Text style={s.btnAddText}>Subir PDF</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={s.searchRow}>
              <Ionicons name="search" size={16} color={COLORS.textSecondary} />
              <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Buscar por nombre..." placeholderTextColor={COLORS.textDisabled} />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")}><Ionicons name="close-circle" size={16} color={COLORS.textSecondary} /></TouchableOpacity>
              )}
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <View style={s.docRow}>
                  <TouchableOpacity style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }} onPress={() => verPDF(item._id, item.titulo || item.filename)}>
                    <Ionicons name="document-text" size={22} color={COLORS.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.docTitle} numberOfLines={1}>{item.titulo || item.filename}</Text>
                      <Text style={s.docMeta}>{item.filename} · {item.created_at?.slice(0, 10)}</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ padding: 6 }} onPress={() => descargar(item._id)}>
                    <Ionicons name="download-outline" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                  {puedeGestionar && (
                    <TouchableOpacity style={{ padding: 6 }} onPress={() => eliminar(item._id)}>
                      <Ionicons name="trash-outline" size={18} color={COLORS.errorText} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
              contentContainerStyle={{ gap: 4, paddingBottom: 20 }}
              refreshing={loading}
              onRefresh={load}
            />
          </>
        )}
      </View>
    </SafeAreaView>
    {viewingFile && (
      <Modal visible={!!viewingFile} animationType="slide" onRequestClose={() => setViewingFile(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface }}>
            <TouchableOpacity onPress={() => setViewingFile(null)} style={{ padding: 6 }}>
              <Ionicons name="close" size={26} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: "800", color: COLORS.text, marginLeft: 10 }} numberOfLines={1}>{viewingTitle}</Text>
            <TouchableOpacity style={{ padding: 6 }} onPress={() => { const a = document.createElement("a"); a.href = viewingFile; a.download = "documento.pdf"; a.click(); }}>
              <Ionicons name="download-outline" size={22} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          {Platform.OS === "web" ? (
            <iframe src={viewingFile} style={{ flex: 1, border: "none" }} title={viewingTitle} />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: COLORS.textSecondary }}>Vista previa no disponible en móvil</Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    )}
    </>
  );

  return <ResponsiveLayout active="documentaciones">{content}</ResponsiveLayout>;
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  body: { flex: 1, padding: 20, paddingTop: 12 },
  heading: { fontSize: 22, fontWeight: "900", color: COLORS.text, letterSpacing: 0.2 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4, marginBottom: 24 },
  cards: { gap: 12 },
  card: {
    flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface,
    borderRadius: 14, padding: 16, gap: 14, borderWidth: 1, borderColor: COLORS.border,
    ...(Platform.OS === "web" ? { boxShadow: `0 1px 3px ${COLORS.text}08` } as any : {}),
  },
  cardIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: COLORS.primarySoft, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  cardSubtitle: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 2 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  backText: { fontSize: 14, fontWeight: "600", color: COLORS.primary },
  btnAdd: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  btnAddText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  docRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 10, padding: 12, gap: 6, borderWidth: 1, borderColor: COLORS.border },
  docTitle: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  docMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  searchRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 10, paddingHorizontal: 12, gap: 8, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border, height: 40 },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.text },
});
