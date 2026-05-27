import { useCallback, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
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
    const performDelete = async () => { try { await api.deleteNota(id); load(); } catch (e: any) { Alert.alert("Error", e?.message || ""); } };
    if (typeof window !== "undefined" && typeof window.confirm === "function") {
      if (window.confirm("¿Eliminar esta nota?")) performDelete();
      return;
    }
    Alert.alert("Eliminar nota", "¿Seguro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: performDelete },
    ]);
  };

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
          {notas.map((item) => (
            <TouchableOpacity key={item.id} style={s.notaCard} onPress={() => editarNota(item)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={s.notaTitulo} numberOfLines={1}>{item.titulo || "Sin título"}</Text>
                <Text style={s.notaPreview} numberOfLines={2}>{item.contenido || "Sin contenido"}</Text>
                <Text style={s.notaFecha}>{item.updated_at?.slice(0, 10)}</Text>
              </View>
              <TouchableOpacity onPress={() => eliminar(item.id)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}><Ionicons name="trash-outline" size={18} color={COLORS.errorText} /></TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  return <ResponsiveLayout active="notas">{content}</ResponsiveLayout>;
}

const useS = () =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.bg },
    body: { flex: 1, padding: ios.spacing.lg },
    editor: { backgroundColor: COLORS.surface, borderRadius: ios.radius.card, padding: ios.spacing.rowV, gap: ios.spacing.md, marginBottom: ios.spacing.md, borderWidth: 1, borderColor: COLORS.border, ...ios.shadow.card },
    inputTitulo: { ...fontStyle("title3"), fontWeight: "700", color: COLORS.text, paddingVertical: ios.spacing.xs },
    inputContenido: { ...fontStyle("callout"), color: COLORS.text, minHeight: 150 },
    btnGuardar: { backgroundColor: COLORS.primary, paddingHorizontal: ios.spacing.xl, paddingVertical: ios.spacing.sm, borderRadius: ios.radius.sm, alignItems: "center" },
    btnCancelar: { backgroundColor: COLORS.readonly, paddingHorizontal: ios.spacing.xl, paddingVertical: ios.spacing.sm, borderRadius: ios.radius.sm, alignItems: "center" },
    btnNueva: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: ios.spacing.sm,
      backgroundColor: COLORS.primary, paddingVertical: ios.spacing.md, borderRadius: ios.radius.row, marginBottom: ios.spacing.md,
    },
    btnText: { ...fontStyle("callout"), fontWeight: "700", color: "#fff" },
    notaCard: {
      flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface,
      borderRadius: ios.radius.row, padding: ios.spacing.md, gap: ios.spacing.sm, borderWidth: 1, borderColor: COLORS.border, ...ios.shadow.card,
    },
    notaTitulo: { ...fontStyle("callout"), fontWeight: "800", color: COLORS.text },
    notaPreview: { ...fontStyle("footnote"), color: COLORS.textSecondary, marginTop: 2 },
    notaFecha: { ...fontStyle("caption"), color: COLORS.textDisabled, marginTop: ios.spacing.xs },
  });
