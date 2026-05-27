import { useCallback, useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform,
  FlatList, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS } from "../../src/api";
import BottomNav from "../../src/BottomNav";
import ResponsiveLayout from "../../src/ResponsiveLayout";
import { useBreakpoint } from "../../src/useBreakpoint";
import { useThemedStyles } from "../../src/theme";
import { ios } from "../../src/ui/iosTheme";

type Plan = {
  id: string; title: string; created_at: string; updated_at: string;
  created_by: string; shape_count: number;
};

type ModalStep = "choose" | "libre" | "proyecto";

export default function PlansList() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [me, setMe] = useState<any>(null);
  const [linkPlan, setLinkPlan] = useState<Plan | null>(null);
  const [linkType, setLinkType] = useState<"evento" | "proyecto" | null>(null);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkItems, setLinkItems] = useState<any[]>([]);

  const s = useThemedStyles(useS);

  const load = async () => {
    try {
      const [list, u] = await Promise.all([
        api.listPlans(),
        me ? Promise.resolve(me) : api.me().catch(() => null),
      ]);
      setPlans(list);
      if (!me && u) setMe(u);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const confirmAsync = (title: string, message: string, okText = "Eliminar"): Promise<boolean> => {
    if (Platform.OS === "web") {
      // react-native-web's Alert.alert only forwards title+message to window.alert
      // and silently drops the buttons array, so destructive callbacks never
      // fire. Fall back to a real confirm dialog on web.
      return Promise.resolve(typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`));
    }
    return new Promise<boolean>((resolve) => {
      Alert.alert(title, message, [
        { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
        { text: okText, style: "destructive", onPress: () => resolve(true) },
      ]);
    });
  };

  const doDelete = async (p: Plan) => {
    const ok = await confirmAsync("Eliminar plano", `¿Eliminar "${p.title}"? Esta acción no se puede deshacer.`);
    if (!ok) return;
    try {
      await api.deletePlan(p.id);
      load();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const doExport = (p: Plan, format: "pdf" | "jpeg") => {
    // Navigate to the editor with a one-shot export hint; the editor handles
    // the actual canvas-to-file export (already implemented there for Web + Native).
    router.push({ pathname: `/planos/${p.id}`, params: { export: format } } as any);
  };

  const openLinkSearch = async (type: "evento" | "proyecto") => {
    setLinkType(type);
    setLinkSearch("");
    try {
      if (type === "evento") {
        const evs = await api.listEvents(new Date(2020, 0, 1).toISOString(), new Date(2030, 0, 1).toISOString());
        setLinkItems(evs || []);
      } else {
        const mats = await api.listMateriales();
        setLinkItems(mats || []);
      }
    } catch { setLinkItems([]); }
  };

  const doLink = async (targetId: string) => {
    if (!linkPlan || !linkType) return;
    try {
      if (linkType === "evento") {
        await api.updatePlan(linkPlan.id, { source_event_id: targetId } as any);
      } else {
        await api.updatePlan(linkPlan.id, { material_id: targetId } as any);
      }
      setLinkPlan(null);
      load();
    } catch (e: any) { Alert.alert("Error", e.message); }
  };

  const showExportSheet = (p: Plan) => {
    if (Platform.OS === "web") {
      // Simple chooser via confirm; PDF is the primary action.
      const usePdf = typeof window !== "undefined" && window.confirm(
        `Exportar "${p.title}"\n\nAceptar = PDF\nCancelar = JPEG`
      );
      doExport(p, usePdf ? "pdf" : "jpeg");
      return;
    }
    Alert.alert("Exportar plano", `"${p.title}"`, [
      { text: "Cancelar", style: "cancel" },
      { text: "PDF", onPress: () => doExport(p, "pdf") },
      { text: "JPEG", onPress: () => doExport(p, "jpeg") },
    ]);
  };

  return (
    <>
    <ResponsiveLayout active="planos" isAdmin={me?.role === "admin"} userName={me?.name}>
      <SafeAreaView style={s.root} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.replace("/home")}>
          <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Planos</Text>
        <TouchableOpacity
          testID="btn-new-plan"
          style={s.iconBtn}
          onPress={() => setShowCreate(true)}
        >
          <Ionicons name="add" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 10 }}>
          {[1, 2, 3].map((i) => <View key={i} style={s.skeleton} />)}
        </View>
      ) : plans.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="map-outline" size={60} color={COLORS.textDisabled} />
          <Text style={s.emptyTitle}>Sin planos</Text>
          <Text style={s.emptySub}>Crea tu primer plano con el botón +</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={() => setShowCreate(true)}>
            <Ionicons name="add-circle" size={22} color="#fff" />
            <Text style={s.emptyBtnText}>NUEVO PLANO</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: ios.spacing.lg, gap: 10 }}>
          {plans.filter((p: any) => !p.material_id && !p.source_event_id).map((p) => (
            <View key={p.id} style={s.planCard} testID={`plan-card-${p.id}`}>
              <TouchableOpacity
                style={s.planCardBody}
                onPress={() => router.push(`/planos/${p.id}`)}
                activeOpacity={0.8}
              >
                <View style={s.planIcon}>
                  <Ionicons name="map" size={24} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.planTitle} numberOfLines={2}>{p.title}</Text>
                  <Text style={s.planMeta}>
                    {p.shape_count} pieza{p.shape_count !== 1 ? "s" : ""} · {p.created_by.split("@")[0]}
                  </Text>
                  <Text style={s.planDate}>
                    {new Date(p.updated_at).toLocaleDateString("es-ES", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </Text>
                </View>
                {(p as any).thumbnail ? (
                  <Image source={{ uri: (p as any).thumbnail }} style={{ width: 64, height: 48, borderRadius: 6 }} resizeMode="cover" />
                ) : null}
              </TouchableOpacity>
              <View style={s.planActions}>
                <TouchableOpacity
                  testID={`btn-export-plan-${p.id}`}
                  hitSlop={8}
                  style={s.actionBtn}
                  onPress={() => showExportSheet(p)}
                >
                  <Ionicons name="download-outline" size={20} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`btn-link-plan-${p.id}`}
                  hitSlop={8}
                  style={s.actionBtn}
                  onPress={() => { setLinkPlan(p); setLinkType(null); setLinkSearch(""); }}
                >
                  <Ionicons name="link-outline" size={20} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`btn-delete-plan-${p.id}`}
                  hitSlop={8}
                  style={s.actionBtn}
                  onPress={() => doDelete(p)}
                >
                  <Ionicons name="trash-outline" size={20} color={COLORS.errorText} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <CreatePlanModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onDone={(id) => { setShowCreate(false); router.push(`/planos/${id}`); }}
      />
      </SafeAreaView>
    </ResponsiveLayout>
    {linkPlan && (
      <Modal visible={!!linkPlan} transparent animationType="fade" onRequestClose={() => setLinkPlan(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" }}>
          <View style={{ backgroundColor: COLORS.surface, borderRadius: ios.radius.lg, width: 400, maxHeight: "70%", overflow: "hidden", ...ios.shadow.modal }}>
            <View style={{ flexDirection: "row", alignItems: "center", padding: ios.spacing.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
              <Text style={{ fontSize: 16, fontWeight: "900", color: COLORS.text, flex: 1 }} numberOfLines={1}>Vincular "{linkPlan.title}"</Text>
              <TouchableOpacity onPress={() => setLinkPlan(null)}><Ionicons name="close" size={22} color={COLORS.textSecondary} /></TouchableOpacity>
            </View>
            {linkType ? (
              <>
                <TextInput style={{ margin: ios.spacing.lg, fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border, borderRadius: ios.radius.sm, padding: ios.spacing.sm, backgroundColor: COLORS.bg }} value={linkSearch} onChangeText={setLinkSearch} placeholder="Buscar..." placeholderTextColor={COLORS.textDisabled} />
                <FlatList
                  data={linkSearch ? linkItems.filter((i: any) => (i.title || i.materiales || i.cliente || "").toLowerCase().includes(linkSearch.toLowerCase())) : linkItems}
                  keyExtractor={(i: any) => i.id}
                  style={{ maxHeight: 300 }}
                  renderItem={({ item }: any) => (
                    <TouchableOpacity style={{ paddingVertical: 12, paddingHorizontal: ios.spacing.lg }} onPress={() => doLink(item.id)}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text }} numberOfLines={1}>{item.title || item.materiales || item.cliente || "—"}</Text>
                    </TouchableOpacity>
                  )}
                />
              </>
            ) : (
              <View style={{ padding: ios.spacing.lg, gap: 8 }}>
                <TouchableOpacity style={{ padding: ios.spacing.lg, borderRadius: ios.radius.md, backgroundColor: COLORS.bg, flexDirection: "row", alignItems: "center", gap: 12 }} onPress={() => openLinkSearch("evento")}>
                  <View style={{ width: 40, height: 40, borderRadius: ios.radius.sm, backgroundColor: COLORS.primarySoft, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="calendar" size={22} color={COLORS.primary} />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.text, flex: 1 }}>Vincular a evento</Text>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={{ padding: ios.spacing.lg, borderRadius: ios.radius.md, backgroundColor: COLORS.bg, flexDirection: "row", alignItems: "center", gap: 12 }} onPress={() => openLinkSearch("proyecto")}>
                  <View style={{ width: 40, height: 40, borderRadius: ios.radius.sm, backgroundColor: COLORS.primarySoft, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="cube" size={22} color={COLORS.primary} />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.text, flex: 1 }}>Vincular a proyecto</Text>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    )}
    </>
  );
}

function CreatePlanModal({
  visible, onClose, onDone,
}: { visible: boolean; onClose: () => void; onDone: (id: string) => void }) {
  const s = useThemedStyles(useS);
  const [step, setStep] = useState<ModalStep>("choose");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [materiales, setMateriales] = useState<any[]>([]);
  const [loadingMat, setLoadingMat] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!visible) {
      // reset on close
      setTimeout(() => { setStep("choose"); setTitle(""); setQ(""); }, 250);
    }
  }, [visible]);

  useEffect(() => {
    if (step === "proyecto") {
      (async () => {
        setLoadingMat(true);
        try {
          const list = await api.listMateriales();
          setMateriales(list);
        } catch (e: any) { Alert.alert("Error", e.message); }
        finally { setLoadingMat(false); }
      })();
    }
  }, [step]);

  const createLibre = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "El título es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const plan = await api.createPlan({ title: title.trim() });
      onDone(plan.id);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const createDesdeProyecto = async (material: any) => {
    const mCode = material.materiales || "";
    const cliente = material.cliente || "Sin cliente";
    const planTitle = `${mCode} — ${cliente}`.trim();
    setSaving(true);
    try {
      const plan = await api.createPlan({ title: planTitle });
      onDone(plan.id);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = q.trim()
    ? materiales.filter((m) => {
        const s = `${m.materiales || ""} ${m.cliente || ""} ${m.ubicacion || ""}`.toLowerCase();
        return s.includes(q.toLowerCase());
      })
    : materiales;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.modalRoot}
      >
        <View style={[s.modalCard, step === "proyecto" && { maxHeight: "88%", minHeight: "70%" }]}>
          <View style={s.modalHeader}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
              {step !== "choose" && (
                <TouchableOpacity onPress={() => setStep("choose")} hitSlop={10}>
                  <Ionicons name="chevron-back" size={24} color={COLORS.navy} />
                </TouchableOpacity>
              )}
              <Text style={s.modalTitle}>
                {step === "choose" ? "Nuevo plano"
                  : step === "libre" ? "Plano libre"
                  : "Desde proyecto"}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={26} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {step === "choose" && (
            <View style={{ gap: 12, marginTop: 8 }}>
              <Text style={s.chooseHint}>¿Cómo quieres crear el plano?</Text>
              <TouchableOpacity
                testID="option-libre"
                style={s.optionCard}
                onPress={() => setStep("libre")}
              >
                <View style={[s.optionIcon, { backgroundColor: COLORS.pillBlueBg }]}>
                  <Ionicons name="document-text-outline" size={28} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.optionTitle}>Plano libre</Text>
                  <Text style={s.optionDesc}>Introduce un título personalizado y empieza en blanco</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                testID="option-proyecto"
                style={s.optionCard}
                onPress={() => setStep("proyecto")}
              >
                <View style={[s.optionIcon, { backgroundColor: COLORS.pillOrangeBg }]}>
                  <Ionicons name="list-outline" size={28} color="#92400E" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.optionTitle}>Desde proyecto</Text>
                  <Text style={s.optionDesc}>Elige un material/proyecto existente como base del plano</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {step === "libre" && (
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={s.mLabel}>Título del plano</Text>
              <TextInput
                testID="input-plan-title"
                style={s.mInput}
                value={title}
                onChangeText={setTitle}
                placeholder="Ej. Oficina Cliente X"
                placeholderTextColor={COLORS.textDisabled}
                autoFocus
              />
              <Text style={s.hint}>
                Este título será el nombre del archivo al exportar a JPG o PDF.
              </Text>
              <TouchableOpacity
                testID="btn-create-plan"
                style={[s.primary, saving && { opacity: 0.6 }]}
                onPress={createLibre}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>CREAR Y ABRIR</Text>}
              </TouchableOpacity>
            </ScrollView>
          )}

          {step === "proyecto" && (
            <View style={{ flex: 1, minHeight: 300 }}>
              <View style={s.searchBox}>
                <Ionicons name="search" size={18} color={COLORS.textSecondary} />
                <TextInput
                  testID="input-mat-search"
                  style={s.searchInput}
                  value={q}
                  onChangeText={setQ}
                  placeholder="Buscar proyecto, cliente, ubicación..."
                  placeholderTextColor={COLORS.textDisabled}
                />
                {q.length > 0 && (
                  <TouchableOpacity onPress={() => setQ("")}>
                    <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              {loadingMat ? (
                <View style={{ padding: 40, alignItems: "center" }}>
                  <ActivityIndicator color={COLORS.primary} />
                </View>
              ) : (
                <Text style={s.resultsCount}>{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</Text>
              )}
              <FlatList
                data={filtered}
                keyExtractor={(m) => m.id}
                style={{ flex: 1 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    testID={`mat-opt-${item.id}`}
                    style={s.matRow}
                    onPress={() => createDesdeProyecto(item)}
                    disabled={saving}
                  >
                    <View style={s.matIcon}>
                      <Ionicons name="cube-outline" size={22} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.matCode}>{item.materiales || "—"}</Text>
                      <Text style={s.matCliente} numberOfLines={1}>{item.cliente || "Sin cliente"}</Text>
                      {item.ubicacion && (
                        <Text style={s.matUbic} numberOfLines={1}>📍 {item.ubicacion}</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                )}
                initialNumToRender={15}
                windowSize={8}
              />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: ios.spacing.md, paddingVertical: 10, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: ios.radius.md },
  headerTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 40 },
  emptyTitle: { fontSize: 22, fontWeight: "900", color: COLORS.text, marginTop: 12 },
  emptySub: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 20, textAlign: "center" },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.primary,
    paddingHorizontal: 24, height: 50, borderRadius: ios.radius.card,
    ...ios.shadow.elevated,
  },
  emptyBtnText: { color: "#fff", fontWeight: "800", fontSize: 14, letterSpacing: 1 },
  planCard: {
    flexDirection: "row", alignItems: "stretch", gap: 4,
    backgroundColor: COLORS.surface, borderRadius: ios.radius.lg,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: "hidden",
    ...ios.shadow.card,
  },
  planCardBody: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 12, padding: ios.spacing.lg,
  },
  planIcon: {
    width: 48, height: 48, borderRadius: ios.radius.md, backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center",
  },
  planTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  planMeta: { fontSize: 13, color: COLORS.textSecondary },
  planDate: { fontSize: 11, color: COLORS.textDisabled, fontWeight: "600" },
  planActions: {
    flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 6, paddingHorizontal: 10, borderLeftWidth: 1, borderLeftColor: COLORS.border,
  },
  actionBtn: {
    width: 40, height: 40, borderRadius: ios.radius.sm,
    alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.bg,
  },
  trashBtn: { padding: 8 },
  modalRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalCard: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: ios.radius.xl, borderTopRightRadius: ios.radius.xl,
    padding: ios.spacing.xl, paddingBottom: 32, maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  chooseHint: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 4 },
  optionCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: COLORS.bg, padding: ios.spacing.lg, borderRadius: ios.radius.lg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  optionIcon: {
    width: 52, height: 52, borderRadius: ios.radius.md, alignItems: "center", justifyContent: "center",
  },
  optionTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  optionDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  mLabel: {
    fontSize: 11, fontWeight: "800", color: COLORS.textSecondary,
    letterSpacing: 1.2, marginTop: ios.spacing.lg, marginBottom: ios.spacing.sm,
  },
  mInput: {
    height: 52, backgroundColor: COLORS.bg, borderWidth: 2, borderColor: COLORS.borderInput,
    borderRadius: ios.radius.md, paddingHorizontal: ios.spacing.lg, fontSize: 16, color: COLORS.text,
  },
  hint: { fontSize: 12, color: COLORS.textSecondary, marginTop: 10, lineHeight: 18 },
  primary: {
    height: 52, borderRadius: ios.radius.card, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center", marginTop: ios.spacing.xl,
  },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: COLORS.bg, borderRadius: ios.radius.md, paddingHorizontal: ios.spacing.md, height: 48,
    marginTop: ios.spacing.md, marginBottom: ios.spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text },
  resultsCount: { fontSize: 12, color: COLORS.textSecondary, marginBottom: ios.spacing.sm, fontWeight: "600" },
  matRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, backgroundColor: COLORS.bg, borderRadius: ios.radius.md, marginBottom: 6,
  },
  matIcon: {
    width: 44, height: 44, borderRadius: ios.radius.md, backgroundColor: COLORS.surface,
    alignItems: "center", justifyContent: "center",
  },
  matCode: {
    fontSize: 12, fontWeight: "800", color: COLORS.primary, letterSpacing: 0.3,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
  matCliente: { fontSize: 14, fontWeight: "700", color: COLORS.text, marginTop: 1 },
  matUbic: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  skeleton: {
    height: 92, borderRadius: ios.radius.lg, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
  },
});
