import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS } from "../../src/api";

const ENTREGA_OPTS = ["Entrega", "Recogida"];
const TP_OPTS = ["TOTAL", "PARCIAL"];

function ReadRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={s.roRow}>
      <Text style={s.roLabel}>{label}</Text>
      <Text style={s.roValue}>{value || "—"}</Text>
    </View>
  );
}

function ChipGroup({
  value, options, onChange, testID,
}: { value?: string | null; options: string[]; onChange: (v: string) => void; testID?: string }) {
  return (
    <View style={s.chipRow} testID={testID}>
      {options.map((o) => {
        const active = (value || "").toLowerCase() === o.toLowerCase();
        return (
          <TouchableOpacity
            key={o}
            testID={`${testID}-${o}`}
            style={[s.chip, active && s.chipActive]}
            onPress={() => onChange(active ? "" : o)}
          >
            <Text style={[s.chipText, active && s.chipTextActive]}>{o}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function MaterialDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [m, setM] = useState<any>(null);
  const [fecha, setFecha] = useState("");
  const [entrega, setEntrega] = useState("");
  const [tp, setTp] = useState("");
  const [tecnico, setTecnico] = useState("");
  const [comentarios, setComentarios] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getMaterial(id);
        setM(data);
        setFecha(data.fecha || "");
        setEntrega(data.entrega_recogida || "");
        setTp(data.total_parcial || "");
        setTecnico(data.tecnico || "");
        setComentarios(data.comentarios || "");
      } catch (e: any) {
        Alert.alert("Error", e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.updateMaterial(id, {
        fecha: fecha || null,
        entrega_recogida: entrega || null,
        total_parcial: tp || null,
        tecnico: tecnico || null,
        comentarios: comentarios || null,
      });
      setM(updated);
      setDirty(false);
      Alert.alert("Guardado", "Cambios guardados. Se sincronizarán con OneDrive automáticamente.");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }
  if (!m) return null;

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity testID="btn-back" style={s.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Detalle</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.titleBlock}>
            <Text style={s.matCode} testID="detail-code">{m.materiales || "—"}</Text>
            <Text style={s.matCliente} testID="detail-cliente">{m.cliente || "Sin cliente"}</Text>
            <View style={s.matMeta}>
              <Ionicons name="location" size={14} color={COLORS.textSecondary} />
              <Text style={s.matMetaText}>{m.ubicacion || "—"}</Text>
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>INFORMACIÓN FIJA</Text>
            <ReadRow label="Horas PREV" value={m.horas_prev} />
            <ReadRow label="Comercial" value={m.comercial} />
            <ReadRow label="Gestor/a" value={m.gestor} />
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>EDITABLE</Text>

            <Text style={s.fieldLabel}>Fecha</Text>
            <TextInput
              testID="input-fecha"
              style={s.input}
              value={fecha}
              onChangeText={(v) => { setFecha(v); setDirty(true); }}
              placeholder="dd/mm/aaaa"
              placeholderTextColor={COLORS.textDisabled}
            />

            <Text style={s.fieldLabel}>Entrega / Recogida</Text>
            <ChipGroup
              testID="chips-entrega"
              value={entrega}
              options={ENTREGA_OPTS}
              onChange={(v) => { setEntrega(v); setDirty(true); }}
            />

            <Text style={s.fieldLabel}>Total / Parcial</Text>
            <ChipGroup
              testID="chips-tp"
              value={tp}
              options={TP_OPTS}
              onChange={(v) => { setTp(v); setDirty(true); }}
            />

            <Text style={s.fieldLabel}>Técnico</Text>
            <TextInput
              testID="input-tecnico"
              style={s.input}
              value={tecnico}
              onChangeText={(v) => { setTecnico(v); setDirty(true); }}
              placeholder="Nombre del técnico"
              placeholderTextColor={COLORS.textDisabled}
            />

            <Text style={s.fieldLabel}>Comentarios</Text>
            <TextInput
              testID="input-comentarios"
              style={[s.input, s.textarea]}
              value={comentarios}
              onChangeText={(v) => { setComentarios(v); setDirty(true); }}
              placeholder="Observaciones, incidencias..."
              placeholderTextColor={COLORS.textDisabled}
              multiline
              textAlignVertical="top"
            />
          </View>
        </ScrollView>

        <View style={s.bottomBar}>
          <TouchableOpacity
            testID="btn-save"
            style={[s.btnPrimary, (!dirty || saving) && s.btnDisabled]}
            onPress={save}
            disabled={!dirty || saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.btnPrimaryText}>
                {dirty ? "GUARDAR CAMBIOS" : "SIN CAMBIOS"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  titleBlock: { gap: 4 },
  matCode: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    fontSize: 13, fontWeight: "700", color: COLORS.primary, letterSpacing: 0.5,
  },
  matCliente: { fontSize: 24, fontWeight: "900", color: COLORS.text, letterSpacing: -0.3 },
  matMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  matMetaText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: "500" },
  section: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.border, gap: 10,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: "800", color: COLORS.textSecondary,
    letterSpacing: 1.5, marginBottom: 4,
  },
  roRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  roLabel: { color: COLORS.textSecondary, fontSize: 14, fontWeight: "500" },
  roValue: { color: COLORS.text, fontSize: 15, fontWeight: "700", maxWidth: "60%", textAlign: "right" },
  fieldLabel: {
    fontSize: 11, fontWeight: "800", color: COLORS.textSecondary,
    letterSpacing: 1.2, marginTop: 10, marginBottom: 4,
  },
  input: {
    height: 52, backgroundColor: COLORS.bg,
    borderWidth: 2, borderColor: COLORS.borderInput, borderRadius: 10,
    paddingHorizontal: 14, fontSize: 16, color: COLORS.text,
  },
  textarea: { height: 110, paddingTop: 12 },
  chipRow: { flexDirection: "row", gap: 10 },
  chip: {
    flex: 1, height: 48, borderRadius: 10, borderWidth: 2,
    borderColor: COLORS.borderInput, backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center",
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 14, fontWeight: "800", color: COLORS.textSecondary, letterSpacing: 0.5 },
  chipTextActive: { color: "#fff" },
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: 16, paddingBottom: 24, backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  btnPrimary: {
    height: 56, borderRadius: 12, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
  },
  btnDisabled: { opacity: 0.5 },
  btnPrimaryText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 1 },
});
