import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { api, COLORS } from "../../src/api";

// ---------- date helpers ----------
function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function parseToDate(str?: string | null): Date {
  if (!str) return new Date();
  // accept YYYY-MM-DD or DD/MM/YYYY
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(str);
  if (iso) return new Date(str.slice(0, 10) + "T00:00:00");
  const es = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(str);
  if (es) return new Date(`${es[3]}-${es[2]}-${es[1]}T00:00:00`);
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}

function formatES(str?: string | null): string {
  if (!str) return "";
  const d = parseToDate(str);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function toISOString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

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
  const [techs, setTechs] = useState<{ id: string; name: string; email: string }[]>([]);
  const [managers, setManagers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [managerId, setManagerId] = useState("");
  const [projectStatus, setProjectStatus] = useState("pendiente");
  const [showTechPicker, setShowTechPicker] = useState(false);
  const [showManagerPicker, setShowManagerPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [data, tlist, mlist] = await Promise.all([
          api.getMaterial(id),
          api.listTechnicians().catch(() => []),
          api.listManagers().catch(() => []),
        ]);
        setM(data);
        setFecha(data.fecha || todayISO());
        setEntrega(data.entrega_recogida || "");
        setTp(data.total_parcial || "");
        setTecnico(data.tecnico || "");
        setComentarios(data.comentarios || "");
        setManagerId(data.manager_id || "");
        setProjectStatus(data.project_status || "pendiente");
        setTechs(tlist);
        setManagers(mlist);
        // if fecha was empty, mark dirty so user sees the default today is pending save
        if (!data.fecha) setDirty(true);
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
        manager_id: managerId || null,
        project_status: projectStatus || null,
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
        <TouchableOpacity testID="btn-back" style={s.iconBtn} onPress={() => {
          try { if (router.canGoBack && router.canGoBack()) { router.back(); return; } } catch {}
          router.replace("/materiales");
        }}>
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
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>EDITABLE</Text>

            <Text style={s.fieldLabel}>Estado</Text>
            <TouchableOpacity
              testID="picker-status"
              style={s.picker}
              onPress={() => setShowStatusPicker(true)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                <Ionicons name="flag" size={20} color={COLORS.primary} />
                <Text style={s.pickerText}>
                  {projectStatus === "pendiente" ? "🟡 Pendiente"
                    : projectStatus === "a_facturar" ? "🟣 A facturar"
                    : projectStatus === "planificado" ? "🔵 Planificado"
                    : projectStatus === "terminado" ? "🟢 Terminado"
                    : projectStatus === "anulado" ? "🔴 Anulado"
                    : "Selecciona estado..."}
                </Text>
              </View>
            </TouchableOpacity>

            <Text style={s.fieldLabel}>Gestor asignado</Text>
            <TouchableOpacity
              testID="picker-manager"
              style={s.picker}
              onPress={() => setShowManagerPicker(true)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                <Ionicons name="person" size={20} color={COLORS.primary} />
                <Text style={[s.pickerText, !managerId && { color: COLORS.textDisabled }]}>
                  {managerId
                    ? (managers.find((m) => m.id === managerId)?.name || managers.find((m) => m.id === managerId)?.email || "Seleccionado")
                    : "Selecciona gestor..."}
                </Text>
              </View>
              {managerId !== "" && (
                <TouchableOpacity
                  testID="btn-clear-manager"
                  onPress={() => { setManagerId(""); setDirty(true); }}
                  hitSlop={10}
                >
                  <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            <Text style={s.fieldLabel}>Fecha</Text>
            <TouchableOpacity
              testID="picker-fecha"
              style={s.picker}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                <Ionicons name="calendar" size={20} color={COLORS.primary} />
                <Text style={[s.pickerText, !fecha && { color: COLORS.textDisabled }]}>
                  {fecha ? formatES(fecha) : "Selecciona fecha..."}
                </Text>
              </View>
              {fecha !== "" && (
                <TouchableOpacity
                  testID="btn-clear-fecha"
                  onPress={() => { setFecha(""); setDirty(true); }}
                  hitSlop={10}
                >
                  <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

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
            <TouchableOpacity
              testID="picker-tecnico"
              style={s.picker}
              onPress={() => setShowTechPicker(true)}
              activeOpacity={0.7}
            >
              <Text style={[s.pickerText, !tecnico && { color: COLORS.textDisabled }]}>
                {tecnico || "Selecciona técnico..."}
              </Text>
              <Ionicons name="chevron-down" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>

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

      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={s.modalRoot}>
          <View style={s.datePickerCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Selecciona fecha</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Ionicons name="close" size={26} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={{ alignItems: "center", paddingVertical: 8 }}>
              <DateTimePicker
                value={parseToDate(fecha || todayISO())}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                onChange={(event: any, d?: Date) => {
                  if (Platform.OS === "android") {
                    setShowDatePicker(false);
                    if (event.type === "set" && d) {
                      setFecha(toISOString(d));
                      setDirty(true);
                    }
                  } else if (d) {
                    setFecha(toISOString(d));
                    setDirty(true);
                  }
                }}
                locale="es-ES"
                themeVariant="light"
              />
            </View>
            <View style={s.dateActions}>
              <TouchableOpacity
                testID="btn-today"
                style={s.btnSecondary}
                onPress={() => {
                  setFecha(todayISO());
                  setDirty(true);
                }}
              >
                <Ionicons name="today" size={18} color={COLORS.navy} />
                <Text style={s.btnSecondaryText}>Hoy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="btn-date-ok"
                style={s.btnPrimarySmall}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={s.btnPrimaryText}>LISTO</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showTechPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTechPicker(false)}
      >
        <View style={s.modalRoot}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Selecciona técnico</Text>
              <TouchableOpacity onPress={() => setShowTechPicker(false)}>
                <Ionicons name="close" size={26} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 440 }}>
              {tecnico !== "" && (
                <TouchableOpacity
                  testID="tech-clear"
                  style={s.techRow}
                  onPress={() => {
                    setTecnico("");
                    setDirty(true);
                    setShowTechPicker(false);
                  }}
                >
                  <Ionicons name="close-circle" size={20} color={COLORS.errorText} />
                  <Text style={[s.techName, { color: COLORS.errorText }]}>Quitar técnico</Text>
                </TouchableOpacity>
              )}
              {techs.length === 0 && (
                <Text style={{ color: COLORS.textSecondary, padding: 20, textAlign: "center" }}>
                  No hay usuarios disponibles
                </Text>
              )}
              {techs.map((t) => {
                const active = (tecnico || "").toLowerCase() === t.name.toLowerCase();
                return (
                  <TouchableOpacity
                    key={t.id}
                    testID={`tech-opt-${t.id}`}
                    style={[s.techRow, active && s.techRowActive]}
                    onPress={() => {
                      setTecnico(t.name);
                      setDirty(true);
                      setShowTechPicker(false);
                    }}
                  >
                    <View style={[s.techAvatar, active && { backgroundColor: COLORS.primary }]}>
                      <Ionicons name="person" size={18} color={active ? "#fff" : COLORS.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.techName}>{t.name}</Text>
                      <Text style={s.techEmail}>{t.email}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showManagerPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowManagerPicker(false)}
      >
        <View style={s.modalRoot}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Selecciona gestor</Text>
              <TouchableOpacity onPress={() => setShowManagerPicker(false)}>
                <Ionicons name="close" size={26} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 440 }}>
              {managerId !== "" && (
                <TouchableOpacity
                  testID="manager-clear"
                  style={s.techRow}
                  onPress={() => {
                    setManagerId("");
                    setDirty(true);
                    setShowManagerPicker(false);
                  }}
                >
                  <Ionicons name="close-circle" size={20} color={COLORS.errorText} />
                  <Text style={[s.techName, { color: COLORS.errorText }]}>Quitar gestor</Text>
                </TouchableOpacity>
              )}
              {managers.length === 0 && (
                <Text style={{ color: COLORS.textSecondary, padding: 20, textAlign: "center" }}>
                  No hay gestores disponibles
                </Text>
              )}
              {managers.map((mgr) => {
                const active = managerId === mgr.id;
                return (
                  <TouchableOpacity
                    key={mgr.id}
                    testID={`manager-opt-${mgr.id}`}
                    style={[s.techRow, active && s.techRowActive]}
                    onPress={() => {
                      setManagerId(mgr.id);
                      setDirty(true);
                      setShowManagerPicker(false);
                    }}
                  >
                    <View style={[s.techAvatar, active && { backgroundColor: COLORS.primary }]}>
                      <Ionicons name="person" size={18} color={active ? "#fff" : COLORS.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.techName}>{mgr.name}</Text>
                      <Text style={s.techEmail}>{mgr.email}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showStatusPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStatusPicker(false)}
      >
        <View style={s.modalRoot}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Estado del proyecto</Text>
              <TouchableOpacity onPress={() => setShowStatusPicker(false)}>
                <Ionicons name="close" size={26} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {[
                { key: "pendiente", label: "🟡 Pendiente", color: "#F59E0B" },
                { key: "a_facturar", label: "🟣 A facturar", color: "#8B5CF6" },
                { key: "planificado", label: "🔵 Planificado", color: "#3B82F6" },
                { key: "terminado", label: "🟢 Terminado", color: "#10B981" },
                { key: "anulado", label: "🔴 Anulado", color: "#EF4444" },
              ].map((st) => {
                const active = projectStatus === st.key;
                return (
                  <TouchableOpacity
                    key={st.key}
                    testID={`status-opt-${st.key}`}
                    style={[s.techRow, active && { backgroundColor: st.color + "18" }]}
                    onPress={() => {
                      setProjectStatus(st.key);
                      setDirty(true);
                      setShowStatusPicker(false);
                    }}
                  >
                    <View style={[s.techAvatar, active && { backgroundColor: st.color }]}>
                      <Ionicons name="flag" size={18} color={active ? "#fff" : COLORS.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.techName}>{st.label}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={22} color={st.color} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  picker: {
    height: 52, backgroundColor: COLORS.bg,
    borderWidth: 2, borderColor: COLORS.borderInput, borderRadius: 10,
    paddingHorizontal: 14, flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
  },
  pickerText: { fontSize: 16, color: COLORS.text, flex: 1 },
  modalRoot: {
    flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalCard: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 16, paddingBottom: 28,
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 12, paddingHorizontal: 4,
  },
  modalTitle: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  techRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, borderRadius: 10, marginBottom: 4,
  },
  techRowActive: { backgroundColor: COLORS.bg },
  techAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center",
  },
  techName: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  techEmail: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  datePickerCard: {
    backgroundColor: COLORS.surface, borderRadius: 20,
    marginHorizontal: 20, padding: 16, width: "90%", maxWidth: 420,
    alignSelf: "center",
  },
  dateActions: {
    flexDirection: "row", gap: 10, marginTop: 8,
  },
  btnSecondary: {
    flex: 1, height: 48, borderRadius: 10, backgroundColor: COLORS.bg,
    borderWidth: 2, borderColor: COLORS.borderInput,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 6,
  },
  btnSecondaryText: { fontSize: 14, fontWeight: "800", color: COLORS.navy, letterSpacing: 0.5 },
  btnPrimarySmall: {
    flex: 1, height: 48, borderRadius: 10, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
  },
});
