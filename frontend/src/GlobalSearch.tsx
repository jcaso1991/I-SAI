import { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS } from "./api";

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  route: string;
  icon: string;
}

export default function GlobalSearch() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setVisible((v) => !v);
        setQuery("");
        setResults([]);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res: SearchResult[] = [];
      // Client search via existing API calls
      const [clientes, proyectos] = await Promise.all([
        api.listClientes().catch(() => []),
        api.listMateriales(q || undefined).catch(() => []),
      ]);

      const lower = q.toLowerCase();
      for (const c of clientes) {
        if (c.nombre.toLowerCase().includes(lower) || (c.razon_social || "").toLowerCase().includes(lower)) {
          res.push({ id: c.id, title: c.nombre, subtitle: c.razon_social || c.poblacion || "", type: "Cliente", route: `/clientes/${c.id}`, icon: "people" });
        }
      }
      for (const p of proyectos.slice(0, 20)) {
        if ((p.materiales || "").toLowerCase().includes(lower) || (p.cliente || "").toLowerCase().includes(lower)) {
          res.push({ id: p.id, title: p.materiales || "Sin nombre", subtitle: p.cliente || "", type: "Proyecto", route: `/material/${p.id}`, icon: "cube" });
        }
      }

      setResults(res.slice(0, 15));
    } catch {} finally { setLoading(false); }
  }, []);

  const goTo = (route: string) => {
    setVisible(false);
    setQuery("");
    router.push(route as any);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
        <View style={styles.panel} onStartShouldSetResponder={() => true}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="#94A3B8" />
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={doSearch}
              placeholder="Buscar clientes, proyectos..."
              placeholderTextColor="#64748B"
              autoFocus
            />
            {query ? (
              <TouchableOpacity onPress={() => { setQuery(""); setResults([]); }}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
            <View style={styles.shortcut}>
              <Text style={styles.shortcutText}>ESC</Text>
            </View>
          </View>
          {results.length > 0 && (
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {results.map((r) => (
                <TouchableOpacity key={`${r.type}-${r.id}`} style={styles.row} onPress={() => goTo(r.route)}>
                  <Ionicons name={r.icon as any} size={16} color="#3B82F6" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{r.title}</Text>
                    <Text style={styles.subtitle}>{r.subtitle}</Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{r.type}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          {query.length >= 2 && !loading && results.length === 0 && (
            <Text style={styles.empty}>Sin resultados</Text>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-start", alignItems: "center", paddingTop: 80,
  },
  panel: {
    width: "90%", maxWidth: 550,
    backgroundColor: "#1E293B", borderRadius: 16,
    borderWidth: 1, borderColor: "#334155",
    ...Platform.select({ web: { boxShadow: "0 20px 60px rgba(0,0,0,0.5)" } as any }),
  },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, height: 52,
    borderBottomWidth: 1, borderBottomColor: "#334155",
  },
  input: { flex: 1, fontSize: 15, color: "#F1F5F9" },
  shortcut: {
    backgroundColor: "#334155", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4,
  },
  shortcutText: { fontSize: 10, fontWeight: "700", color: "#94A3B8" },
  list: { maxHeight: 350 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#33415533",
  },
  title: { fontSize: 14, fontWeight: "600", color: "#F1F5F9" },
  subtitle: { fontSize: 12, color: "#94A3B8", marginTop: 1 },
  badge: {
    backgroundColor: "#3B82F620", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
    borderWidth: 1, borderColor: "#3B82F640",
  },
  badgeText: { fontSize: 10, fontWeight: "700", color: "#60A5FA" },
  empty: { textAlign: "center", color: "#94A3B8", padding: 20, fontSize: 13 },
});
