import { useCallback, useState } from "react";
  import { View, Text, TouchableOpacity, FlatList, StyleSheet, Platform, Modal, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ResponsiveLayout from "../src/ResponsiveLayout";
import { useBreakpoint } from "../src/useBreakpoint";
import { useThemedStyles } from "../src/theme";
import IOSHeader from "../src/ui/IOSHeader";
import { api, COLORS, BACKEND_URL, getToken } from "../src/api";

interface Item {
  name: string; type: "folder" | "file"; path: string; size: number | null; count?: number;
}

export default function ArchivosScreen() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const s = useThemedStyles(useS);
  const [items, setItems] = useState<Item[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [viewingName, setViewingName] = useState("");
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? items.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  const load = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const data = await api.getArchivos(p);
      const safeItems = (data.items || []).map((item: Item) => ({
        ...item,
        name: (item.name || "").replace(/[\r\n\t]+/g, " "),
        path: (item.path || "").replace(/[\r\n\t]+/g, " "),
      }));
      setItems(safeItems);
      setCurrentPath((data.path || "").replace(/[\r\n\t]+/g, " "));
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(""); }, [load]));

  const formatSize = (bytes: number | null) => {
    if (bytes == null) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const openFile = async (item: Item) => {
    const t = await getToken();
    try {
      const res = await fetch(`${BACKEND_URL}/api/archivos?path=${encodeURIComponent(item.path)}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) throw new Error("No se pudo cargar");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setViewingFile(url);
      setViewingName(item.name);
    } catch {
      Alert.alert("Error", "No se pudo abrir el archivo");
    }
  };

  const downloadFile = async (item: Item) => {
    const t = await getToken();
    try {
      const res = await fetch(`${BACKEND_URL}/api/archivos?path=${encodeURIComponent(item.path)}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) throw new Error("No se pudo descargar");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      Alert.alert("Error", "No se pudo descargar el archivo");
    }
  };

  const content = (
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      {!isWide && <IOSHeader title="Archivos ordenados" />}
      <View style={s.body}>
        <View style={s.header}>
          {currentPath ? (
            <TouchableOpacity onPress={() => load(currentPath.split("/").slice(0, -1).join("/"))} style={{ padding: 6 }}>
              <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
            </TouchableOpacity>
          ) : null}
          <Text style={s.pathText}>{currentPath || "Archivos ordenados"}</Text>
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
          keyExtractor={(item) => item.path}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.row} onPress={() => item.type === "folder" ? load(item.path) : openFile(item)}>
              <Ionicons name={item.type === "folder" ? "folder-open" : "document-text"} size={22} color={item.type === "folder" ? COLORS.primary : COLORS.textSecondary} />
              <Text style={s.name} numberOfLines={1}>{item.name}</Text>
              {item.count != null && <Text style={s.count}>{item.count}</Text>}
              {item.size != null && <Text style={s.size}>{formatSize(item.size)}</Text>}
              {item.type === "file" && (
                <TouchableOpacity style={{ padding: 4 }} onPress={(e) => { (e as any).stopPropagation?.(); downloadFile(item); }}>
                  <Ionicons name="download-outline" size={18} color={COLORS.primary} />
                </TouchableOpacity>
              )}
              <Ionicons name="chevron-forward" size={16} color={COLORS.textDisabled} />
            </TouchableOpacity>
          )}
        />
      </View>
      {viewingFile && (
        <Modal visible={!!viewingFile} animationType="slide" onRequestClose={() => setViewingFile(null)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
            <View style={{ flexDirection: "row", alignItems: "center", padding: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface }}>
              <TouchableOpacity onPress={() => setViewingFile(null)} style={{ padding: 6 }}>
                <Ionicons name="close" size={26} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: "800", color: COLORS.text, marginLeft: 10 }} numberOfLines={1}>{viewingName}</Text>
              <TouchableOpacity style={{ padding: 6 }} onPress={() => { const a = document.createElement("a"); a.href = viewingFile; a.download = viewingName; a.click(); }}>
                <Ionicons name="download-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            {Platform.OS === "web" ? (
              <iframe src={viewingFile} style={{ flex: 1, border: "none" }} title={viewingName} />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: COLORS.textSecondary }}>Vista previa no disponible en móvil</Text>
              </View>
            )}
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );

  return <ResponsiveLayout active="proyectos">{content}</ResponsiveLayout>;
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  body: { flex: 1, padding: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  pathText: { fontSize: 15, fontWeight: "800", color: COLORS.text, flex: 1 },
  searchRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 10, paddingHorizontal: 12, gap: 8, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border, height: 40 },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.text },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, backgroundColor: COLORS.surface, marginBottom: 4, borderWidth: 1, borderColor: COLORS.border },
  name: { flex: 1, fontSize: 13, fontWeight: "600", color: COLORS.text },
  count: { fontSize: 11, fontWeight: "700", color: COLORS.primary, backgroundColor: COLORS.primarySoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, overflow: "hidden", marginRight: 4 },
  size: { fontSize: 11, color: COLORS.textSecondary, marginRight: 4 },
});
