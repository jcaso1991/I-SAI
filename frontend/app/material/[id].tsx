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
import { useThemedStyles } from "../../src/theme";
import { usePermissions } from "../../src/permissions";
import { ios } from "../../src/ui/iosTheme";

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

export default function MaterialDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [m, setM] = useState<any>(null);
  const [fecha, setFecha] = useState("");
  const [entrega, setEntrega] = useState("");
  const [tp, setTp] = useState("");
  const [tecnico, setTecnico] = useState("");
  const [tecnicos, setTecnicos] = useState<string[]>([]);
  const [comentarios, setComentarios] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [techs, setTechs] = useState<{ id: string; name: string; email: string }[]>([]);
  const [managers, setManagers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [managerId, setManagerId] = useState("");
  const [projectStatus, setProjectStatus] = useState("pendiente");
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [linkedEvents, setLinkedEvents] = useState<any[]>([]);
  const [showLinkedEvents, setShowLinkedEvents] = useState(false);
  const [linkedBudgets, setLinkedBudgets] = useState<any[]>([]);
  const [showLinkedBudgets, setShowLinkedBudgets] = useState(false);
  const [showTechPicker, setShowTechPicker] = useState(false);
  const [showManagerPicker, setShowManagerPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const s = useThemedStyles(useS);
  const { has } = usePermissions();
  const esEditorCompleto = has("proyectos.edit");
  const esEditorLimitado = has("proyectos.editar_campo") && !esEditorCompleto;
  const puedeEditar = esEditorCompleto || esEditorLimitado;

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
        setTecnicos(data.tecnicos || (data.tecnico ? [data.tecnico] : []));
        setComentarios(data.comentarios || "");
        setManagerId(data.manager_id || "");
        setProjectStatus(data.project_status || "pendiente");
        setTechs(tlist);
        setManagers(mlist);
        // Load linked events
        const events = await api.listEvents(
          new Date(new Date().getFullYear(), 0, 1).toISOString(),
          new Date(new Date().getFullYear() + 1, 0, 1).toISOString()
        ).catch(() => []);
        setLinkedEvents((events || []).filter((e: any) => e.material_id === id));
        api.listBudgets(id).then(setLinkedBudgets).catch(() => {});
        // if fecha was empty, mark dirty so user sees the default today is pending save
        if (!data.fecha) setDirty(true);
      } catch (e: any) {
        Alert.alert("Error", e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const updateEventStatus = (eventId: string, newStatus: string) => {
    setLinkedEvents((prev) =>
      prev.map((ev) =>
        ev.id === eventId ? { ...ev, status: newStatus } : ev
      )
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: any = esEditorCompleto ? {
        fecha: fecha || null,
        entrega_recogida: entrega || null,
        total_parcial: tp || null,
        tecnico: tecnico || null,
        tecnicos: tecnicos.length > 0 ? tecnicos : null,
        comentarios: comentarios || null,
        manager_id: managerId || null,
        project_status: projectStatus || null,
      } : {
        entrega_recogida: entrega || "",
        total_parcial: tp || "",
        comentarios: comentarios || "",
      };
      const updated = await api.updateMaterial(id, payload);
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
              {m.ubicacion ? (
                <TouchableOpacity onPress={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.ubicacion + ", " + (m.cliente || ""))}`, "_blank")} style={{ marginLeft: 4 }}>
                  <Ionicons name="navigate-outline" size={16} color={COLORS.primary} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>INFORMACIÓN FIJA</Text>
            <ReadRow label="Horas PREV" value={m.horas_prev} />
            <ReadRow
              label="Horas imputadas"
              value={m.horas_imputadas != null ? String(m.horas_imputadas) : "—"}
            />
            <ReadRow label="Comercial" value={m.comercial} />
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>EDITABLE</Text>

            {esEditorCompleto && (
            <>
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
                    : projectStatus === "facturado" ? "🟢 Facturado"
                    : projectStatus === "terminado" ? "🔷 Terminado"
                    : projectStatus === "bloqueado" ? "🔴 Bloqueado"
                    : projectStatus === "anulado" ? "⚫ Anulado"
                    : "Selecciona estado..."}
                </Text>
              </View>
            </TouchableOpacity>
            </>
            )}

            {esEditorCompleto && (
            <>
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

            <Text style={s.fieldLabel}>Técnicos</Text>
            <TouchableOpacity
              testID="picker-tecnico"
              style={s.picker}
              onPress={() => setShowTechPicker(true)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                <Ionicons name="people" size={20} color={COLORS.primary} />
                <Text style={[s.pickerText, tecnicos.length === 0 && { color: COLORS.textDisabled }]}>
                  {tecnicos.length > 0 ? `${tecnicos.length} técnico${tecnicos.length !== 1 ? "s" : ""}` : "Selecciona técnicos..."}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
            {tecnicos.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {tecnicos.map((name) => (
                  <View key={name} style={s.techChipSmall}>
                    <Text style={s.techChipSmallText} numberOfLines={1}>{name}</Text>
                    <TouchableOpacity hitSlop={8} onPress={() => { setTecnicos((prev) => prev.filter((t) => t !== name)); setDirty(true); }}>
                      <Ionicons name="close" size={14} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
          </View>
        )}

        {linkedEvents.length > 0 && (
          <View style={{ padding: 8 }}>
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              onPress={() => setShowLinkedEvents(!showLinkedEvents)}
              activeOpacity={0.7}
            >
              <Text style={s.fieldLabel}>Eventos vinculados ({linkedEvents.length})</Text>
              <Ionicons name={showLinkedEvents ? "chevron-up" : "chevron-down"} size={14} color={COLORS.textSecondary} />
            </TouchableOpacity>
            {showLinkedEvents && linkedEvents.map((ev: any) => (
              <View key={ev.id} style={{ flexDirection: "row", alignItems: "center", gap: ios.spacing.sm, paddingVertical: ios.spacing.xs }}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => router.push(`/calendario?openEvent=${encodeURIComponent(ev.id)}&from=project` as any)}
                  activeOpacity={0.6}
                >
                  <Text style={{ fontSize: ios.font.footnote.size, color: COLORS.primary, fontWeight: "600" }} numberOfLines={1}>{ev.title}</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: ios.font.caption.size, color: COLORS.textSecondary, minWidth: 60 }}>{ev.start_at?.slice(0, 16).replace("T", " ")}</Text>
                <TouchableOpacity
                  style={[s.statusChip, ev.status === "in_progress" && { backgroundColor: COLORS.primarySoft }]}
                  onPress={async () => { await api.updateEvent(ev.id.split(":")[0], { status: "in_progress" } as any); updateEventStatus(ev.id, "in_progress"); }}
                >
                  <Text style={[s.statusChipTxt, ev.status === "in_progress" && { color: COLORS.primary }]}>Curso</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.statusChip, ev.status === "pending_completion" && { backgroundColor: COLORS.pendingBg }]}
                  onPress={async () => { await api.updateEvent(ev.id.split(":")[0], { status: "pending_completion", seguimiento: "Pendiente desde proyecto" } as any); updateEventStatus(ev.id, "pending_completion"); }}
                >
                  <Text style={[s.statusChipTxt, ev.status === "pending_completion" && { color: COLORS.pendingText }]}>Pendiente</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.statusChip, ev.status === "completed" && { backgroundColor: COLORS.syncedBg }]}
                  onPress={async () => { await api.updateEvent(ev.id.split(":")[0], { status: "completed" } as any); updateEventStatus(ev.id, "completed"); }}
                >
                  <Text style={[s.statusChipTxt, ev.status === "completed" && { color: COLORS.syncedText }]}>Terminado</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
          )}
{linkedBudgets.length > 0 && (
  <View style={{ padding: 8 }}>
    <TouchableOpacity
      style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
      onPress={() => setShowLinkedBudgets(!showLinkedBudgets)}
      activeOpacity={0.7}
    >
      <Text style={s.fieldLabel}>Presupuestos vinculados ({linkedBudgets.length})</Text>
      <Ionicons name={showLinkedBudgets ? "chevron-up" : "chevron-down"} size={14} color={COLORS.textSecondary} />
    </TouchableOpacity>
    {showLinkedBudgets && linkedBudgets.map((b: any) => {
      const statusLabel: Record<string, string> = {
        pendiente: "Pendiente", en_revision: "En revisión", enviado: "Pend. aceptar", aceptado: "Aceptado", rechazado: "Rechazado", facturado: "Facturado",
      };
      const statusColor: Record<string, string> = {
        pendiente: "#F59E0B", en_revision: "#8B5CF6", enviado: "#3B82F6", aceptado: "#10B981", rechazado: "#EF4444", facturado: "#6B7280",
      };
      return (
        <View key={b.id} style={{ flexDirection: "row", alignItems: "center", gap: ios.spacing.sm, paddingVertical: ios.spacing.xs }}>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => router.push(`/presupuestos/${b.id}`)}
            activeOpacity={0.6}
          >
            <Text style={{ fontSize: ios.font.footnote.size, color: COLORS.primary, fontWeight: "600" }} numberOfLines={1}>
              {b.n_proyecto ? `#${b.n_proyecto} · ` : ""}{b.cliente || b.nombre_instalacion || "Sin título"}
            </Text>
          </TouchableOpacity>
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: (statusColor[b.status || "pendiente"] || "#F59E0B") + "20" }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: statusColor[b.status || "pendiente"] || "#F59E0B" }}>
              {statusLabel[b.status || "pendiente"] || "Pendiente"}
            </Text>
          </View>
        </View>
      );
    })}
  </View>
)}
            </>
            )}

            <Text style={s.fieldLabel}>Entrega / Recogida</Text>
            <ChipGroup
              testID="chips-entrega"
              value={entrega}
              options={ENTREGA_OPTS}
              onChange={(v) => { if (puedeEditar) { setEntrega(v); setDirty(true); } }}
            />

            <Text style={s.fieldLabel}>Total / Parcial</Text>
            <ChipGroup
              testID="chips-tp"
              value={tp}
              options={TP_OPTS}
              onChange={(v) => { if (puedeEditar) { setTp(v); setDirty(true); } }}
            />

            <Text style={s.fieldLabel}>Comentarios</Text>
            <TextInput
              testID="input-comentarios"
              style={[s.input, s.textarea]}
              value={comentarios}
              onChangeText={(v) => { if (puedeEditar) { setComentarios(v); setDirty(true); } }}
              placeholder="Observaciones, incidencias..."
              placeholderTextColor={COLORS.textDisabled}
              multiline
              textAlignVertical="top"
            />
            {/* Adjuntos del proyecto (presupuestos, PDFs) */}
            {m.attachments?.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={s.fieldLabel}>Adjuntos ({m.attachments.length})</Text>
                {m.attachments.map((a: any) => (
                  <TouchableOpacity
                    key={a.id}
                    style={{ flexDirection: "row", alignItems: "center", gap: ios.spacing.sm, padding: ios.spacing.sm, backgroundColor: COLORS.bg, borderRadius: ios.radius.sm, marginBottom: ios.spacing.xs }}
                    onPress={() => {
                      if (a.base64) {
                        const byteChars = atob(a.base64);
                        const byteNums = new Array(byteChars.length);
                        for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
                        const blob = new Blob([new Uint8Array(byteNums)], { type: a.mime_type || "application/pdf" });
                        window.open(URL.createObjectURL(blob), "_blank");
                      }
                    }}
                  >
                    <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
                    <Text style={{ flex: 1, fontSize: ios.font.footnote.size, color: COLORS.text }} numberOfLines={1}>{a.filename}</Text>
                    <Ionicons name="download-outline" size={16} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        <View style={s.bottomBar}>
          <TouchableOpacity
            testID="btn-save"
            style={[s.btnPrimary, (!dirty || saving) && s.btnDisabled]}
            onPress={async () => { await save(); setHistory(await api.getMaterialHistory(id).catch(() => [])); }}
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
          <TouchableOpacity
            style={[s.btnPrimarySmall, { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border }]}
            onPress={async () => { setShowHistory(!showHistory); if (!showHistory) setHistory(await api.getMaterialHistory(id).catch(() => [])); }}
          >
            <Ionicons name="time-outline" size={18} color={COLORS.textSecondary} />
            <Text style={[s.btnPrimaryText, { color: COLORS.textSecondary }]}>Historial</Text>
          </TouchableOpacity>
        </View>
        {showHistory && (
          <View style={{ padding: ios.spacing.xs }}>
            {history.length === 0 ? (
              <Text style={{ color: COLORS.textDisabled, fontStyle: "italic", padding: ios.spacing.sm, fontSize: ios.font.footnote.size }}>Sin cambios registrados</Text>
            ) : history.map((h, i) => (
              <View key={h.id || i} style={{ flexDirection: "row", padding: ios.spacing.sm, gap: ios.spacing.sm, borderBottomWidth: ios.hairline, borderBottomColor: COLORS.border }}>
                <Text style={{ fontSize: ios.font.caption.size, color: COLORS.textDisabled, minWidth: 50 }}>{(h.created_at || "").slice(0, 16).replace("T", " ")}</Text>
                <Text style={{ fontSize: ios.font.footnote.size, fontWeight: "700", color: COLORS.primary, minWidth: 80 }}>{h.changed_by?.split("@")[0]}</Text>
                <Text style={{ fontSize: ios.font.footnote.size, color: COLORS.text, flex: 1 }} numberOfLines={2}>
                  <Text style={{ fontWeight: "600" }}>{h.field}</Text>: {h.old_value || "—"} → {h.new_value || "—"}
                </Text>
              </View>
            ))}
          </View>
        )}
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
              <Text style={s.modalTitle}>Selecciona técnicos</Text>
              <TouchableOpacity onPress={() => setShowTechPicker(false)}>
                <Ionicons name="close" size={26} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 440 }}>
              {tecnicos.length > 0 && (
                <TouchableOpacity
                  testID="tech-clear"
                  style={s.techRow}
                  onPress={() => { setTecnicos([]); setDirty(true); }}
                >
                  <Ionicons name="close-circle" size={20} color={COLORS.errorText} />
                  <Text style={[s.techName, { color: COLORS.errorText }]}>Quitar todos los técnicos</Text>
                </TouchableOpacity>
              )}
              {techs.length === 0 && (
                <Text style={{ color: COLORS.textSecondary, padding: 20, textAlign: "center" }}>
                  No hay usuarios disponibles
                </Text>
              )}
              {techs.map((t) => {
                const on = tecnicos.includes(t.name);
                return (
                  <TouchableOpacity
                    key={t.id}
                    testID={`tech-opt-${t.id}`}
                    style={[s.techRow, on && s.techRowActive]}
                    onPress={() => {
                      setTecnicos((prev) => prev.includes(t.name) ? prev.filter((n) => n !== t.name) : [...prev, t.name]);
                      setDirty(true);
                    }}
                  >
                    <View style={[s.techAvatar, on && { backgroundColor: COLORS.primary }]}>
                      <Ionicons name="person" size={18} color={on ? "#fff" : COLORS.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.techName}>{t.name}</Text>
                      <Text style={s.techEmail}>{t.email}</Text>
                    </View>
                    {on && <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />}
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
                { key: "planificado", label: "🔵 Planificado", color: "#3B82F6" },
                { key: "a_facturar", label: "🟣 A facturar", color: "#8B5CF6" },
                { key: "facturado", label: "🟢 Facturado", color: "#10B981" },
                { key: "terminado", label: "🔷 Terminado", color: "#6366F1" },
                { key: "bloqueado", label: "🔴 Bloqueado", color: "#EF4444" },
                { key: "anulado", label: "⚫ Anulado", color: "#6B7280" },
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

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: ios.spacing.lg, paddingVertical: ios.spacing.sm, backgroundColor: COLORS.surface,
    borderBottomWidth: ios.hairline, borderBottomColor: COLORS.border,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: ios.font.title3.size, fontWeight: ios.font.title3.weight, color: COLORS.text },
  titleBlock: { gap: ios.spacing.xs, marginBottom: ios.spacing.sm },
  matCode: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    fontSize: ios.font.subhead.size, fontWeight: "700", color: COLORS.primary, letterSpacing: 0.5,
  },
  matCliente: { fontSize: ios.font.title1.size, fontWeight: ios.font.title1.weight, color: COLORS.text, letterSpacing: ios.font.title1.letter },
  matMeta: { flexDirection: "row", alignItems: "center", gap: ios.spacing.sm, marginTop: ios.spacing.xs },
  matMetaText: { color: COLORS.textSecondary, fontSize: ios.font.callout.size, fontWeight: "500" },
  section: {
    backgroundColor: COLORS.surface, borderRadius: ios.radius.lg, padding: ios.spacing.lg,
    borderWidth: 1, borderColor: COLORS.border, gap: ios.spacing.sm,
    ...ios.shadow.card,
  },
  sectionTitle: {
    fontSize: ios.font.section.size, fontWeight: ios.font.section.weight, color: COLORS.textSecondary,
    letterSpacing: ios.font.section.letter, marginBottom: ios.spacing.xs,
  },
  roRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: ios.spacing.md, borderBottomWidth: ios.hairline, borderBottomColor: COLORS.border,
  },
  roLabel: { color: COLORS.textSecondary, fontSize: ios.font.callout.size, fontWeight: "500" },
  roValue: { color: COLORS.text, fontSize: ios.font.callout.size, fontWeight: "700", maxWidth: "60%", textAlign: "right" },
  fieldLabel: {
    fontSize: ios.font.section.size, fontWeight: ios.font.section.weight, color: COLORS.textSecondary,
    letterSpacing: ios.font.section.letter, marginTop: ios.spacing.sm, marginBottom: ios.spacing.xs,
  },
  input: {
    height: 56, backgroundColor: COLORS.bg,
    borderWidth: 2, borderColor: COLORS.borderInput, borderRadius: ios.radius.md,
    paddingHorizontal: ios.spacing.lg, fontSize: ios.font.body.size, color: COLORS.text,
  },
  textarea: { height: 120, paddingTop: ios.spacing.md, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", gap: ios.spacing.sm },
  chip: {
    flex: 1, height: 52, borderRadius: ios.radius.md, borderWidth: 2,
    borderColor: COLORS.borderInput, backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center",
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: ios.font.callout.size, fontWeight: "800", color: COLORS.textSecondary, letterSpacing: 0.5 },
  chipTextActive: { color: "#fff" },
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: ios.spacing.lg, paddingBottom: 24,
    backgroundColor: ios.colors.glassBg,
    borderTopWidth: ios.hairline, borderTopColor: COLORS.border,
    ...Platform.select({
      web: { backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" } as any,
      ios: { backdropFilter: "blur(16px)" } as any,
    }),
    ...ios.shadow.elevated,
  },
  btnPrimary: {
    height: 56, borderRadius: ios.radius.card, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
    ...ios.shadow.card,
  },
  btnDisabled: { opacity: 0.4 },
  btnPrimaryText: { color: "#fff", fontSize: ios.font.body.size, fontWeight: "800", letterSpacing: 1 },
  picker: {
    height: 56, backgroundColor: COLORS.bg,
    borderWidth: 2, borderColor: COLORS.borderInput, borderRadius: ios.radius.md,
    paddingHorizontal: ios.spacing.lg, flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
  },
  pickerText: { fontSize: ios.font.body.size, color: COLORS.text, flex: 1 },
  modalRoot: {
    flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalCard: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: ios.radius.xl, borderTopRightRadius: ios.radius.xl,
    padding: ios.spacing.lg, paddingBottom: ios.spacing.xxl,
    ...ios.shadow.modal,
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: ios.spacing.md, paddingHorizontal: ios.spacing.xs,
  },
  modalTitle: { fontSize: ios.font.title2.size, fontWeight: ios.font.title2.weight, color: COLORS.text },
  techRow: {
    flexDirection: "row", alignItems: "center", gap: ios.spacing.md,
    padding: ios.spacing.md, borderRadius: ios.radius.sm, marginBottom: ios.spacing.xs,
  },
  techRowActive: { backgroundColor: COLORS.bg },
  techAvatar: {
    width: 40, height: 40, borderRadius: ios.spacing.xl, backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center",
  },
  techName: { fontSize: ios.font.callout.size, fontWeight: "700", color: COLORS.text },
  techEmail: { fontSize: ios.font.footnote.size, color: COLORS.textSecondary, marginTop: 1 },
  datePickerCard: {
    backgroundColor: COLORS.surface, borderRadius: ios.radius.xl,
    marginHorizontal: ios.spacing.xl, padding: ios.spacing.lg, width: "90%", maxWidth: 420,
    alignSelf: "center",
  },
  dateActions: {
    flexDirection: "row", gap: ios.spacing.sm, marginTop: ios.spacing.sm,
  },
  btnSecondary: {
    flex: 1, height: 52, borderRadius: ios.radius.md, backgroundColor: COLORS.bg,
    borderWidth: 2, borderColor: COLORS.borderInput,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: ios.spacing.sm,
  },
  btnSecondaryText: { fontSize: ios.font.callout.size, fontWeight: "800", color: COLORS.navy, letterSpacing: 0.5 },
  btnPrimarySmall: {
    flex: 1, height: 52, borderRadius: ios.radius.md, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
  },
  techChipSmall: {
    flexDirection: "row", alignItems: "center", gap: ios.spacing.xs,
    paddingHorizontal: ios.spacing.sm, paddingVertical: ios.spacing.xs, borderRadius: ios.radius.sm,
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
  },
  techChipSmallText: { fontSize: ios.font.footnote.size, fontWeight: "600", color: COLORS.text },
  statusChip: {
    paddingHorizontal: ios.spacing.sm, paddingVertical: ios.spacing.xs, borderRadius: ios.radius.sm,
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
  },
  statusChipTxt: { fontSize: ios.font.caption.size, fontWeight: "700", color: COLORS.textSecondary },
});
