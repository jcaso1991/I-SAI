import { useCallback, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ResponsiveLayout from "../../src/ResponsiveLayout";
import { useBreakpoint } from "../../src/useBreakpoint";
import { useThemedStyles } from "../../src/theme";
import IOSHeader from "../../src/ui/IOSHeader";
import { api, COLORS } from "../../src/api";

interface Nota {
  id: string;
  titulo: string;
  contenido: string;
  fecha: string | null;
  updated_at: string;
}

export default function NotasLibresScreen() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const s = useThemedStyles(useS);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Nota | null>(null);
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");

  const load = useCallback(async () => {
    const items = await api.listNotas();
    setNotas((items || []).filter((n: Nota) => !n.fecha));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const nuevaNota = () => {
    setEditando({ id: "", titulo: "", contenido: "", fecha: null, updated_at: "" } as Nota);
    setTitulo("");
    setContenido("");
  };

  const editarNota = (n: Nota) => {
    setEditando(n);
    setTitulo(n.titulo);
    setContenido(n.contenido);
  };

  const guardar = async () => {
    if (!titulo.trim() && !contenido.trim()) return;
    try {
      if (editando!.id) {
        await api.updateNota(editando!.id, { titulo: titulo.trim(), contenido: contenido.trim() });
      } else {
        await api.createNota({ titulo: titulo.trim(), contenido: contenido.trim() });
      }
      setEditando(null);
      load();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const eliminar = (id: string) => {
    Alert.alert("Eliminar nota", "¿Seguro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: async () => { await api.deleteNota(id); load(); } },
    ]);
  };

  const content = (
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      {!isWide && <IOSHeader title="Notas libres" />}
      <View style={s.body}>
        {editando ? (
          <View style={s.editor}>
            <TextInput style={s.inputTitulo} value={titulo} onChangeText={setTitulo} placeholder="Título" placeholderTextColor={COLORS.textDisabled} />
            <TextInput style={s.inputContenido} value={contenido} onChangeText={setContenido} placeholder="Escribe tu nota..." placeholderTextColor={COLORS.textDisabled} multiline textAlignVertical="top" />
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
        <FlatList
          data={notas}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.notaCard} onPress={() => editarNota(item)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={s.notaTitulo} numberOfLines={1}>{item.titulo || "Sin título"}</Text>
                <Text style={s.notaPreview} numberOfLines={2}>{item.contenido || "Sin contenido"}</Text>
                <Text style={s.notaFecha}>{item.updated_at?.slice(0, 10)}</Text>
              </View>
              <TouchableOpacity onPress={() => eliminar(item.id)}><Ionicons name="trash-outline" size={16} color={COLORS.errorText} /></TouchableOpacity>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ gap: 6, paddingBottom: 40 }}
        />
      </View>
    </SafeAreaView>
  );

  return <ResponsiveLayout active="notas">{content}</ResponsiveLayout>;
}

const useS = () =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.bg },
    body: { flex: 1, padding: 16 },
    editor: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, gap: 10, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
    inputTitulo: { fontSize: 18, fontWeight: "700", color: COLORS.text, paddingVertical: 4 },
    inputContenido: { fontSize: 14, color: COLORS.text, minHeight: 150, lineHeight: 20 },
    btnGuardar: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
    btnCancelar: { backgroundColor: COLORS.readonly, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
    btnNueva: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 10, marginBottom: 12,
    },
    btnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
    notaCard: {
      flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface,
      borderRadius: 10, padding: 12, gap: 8, borderWidth: 1, borderColor: COLORS.border,
    },
    notaTitulo: { fontSize: 14, fontWeight: "800", color: COLORS.text },
    notaPreview: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    notaFecha: { fontSize: 10, color: COLORS.textDisabled, marginTop: 4 },
  });
