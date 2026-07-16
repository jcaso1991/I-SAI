import { useCallback, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, clearToken } from "../../src/api";
import ResponsiveLayout from "../../src/ResponsiveLayout";
import { useBreakpoint } from "../../src/useBreakpoint";

const BRAND_COLORS = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  primary: "#4F46E5",
  primaryLight: "#EEF2F6",
  accent: "#0EA5E9",
  text: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#94A3B8",
  border: "#E2E8F0",
  success: "#10B981",
  successBg: "#D1FAE5",
  warning: "#F59E0B",
  warningBg: "#FEF3C7",
  purple: "#8B5CF6",
  purpleBg: "#EDE9FE",
};

type Tab = "pendiente" | "en_revision" | "enviado" | "aceptado";

export default function PresupuestosIndex() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const [me, setMe] = useState<any>(null);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pendiente");
  const [search, setSearch] = useState("");
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [attachModal, setAttachModal] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      try {
        const [u, list] = await Promise.all([api.me(), api.listBudgets()]);
        if (!alive) return;
        setMe(u);
        setBudgets(list);
      } catch (e: any) {
        if (/401|Invalid|expired/i.test(e.message)) {
          await clearToken();
          router.replace("/login");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []));

  const updateStatusDirect = async (id: string, newStatus: string) => {
    try {
      const res = await api.setBudgetStatus(id, newStatus);
      setBudgets((arr) => arr.map((x) => x.id === id ? { ...x, status: res.status || newStatus } : x));
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const openAttachModal = async (budgetId: string) => {
    setAttachModal(budgetId);
    setProjectSearch("");
    setLoadingProjects(true);
    try {
      const list = await api.listMateriales();
      setProjects(list || []);
    } catch (e: any) {
      Alert.alert("Error", "No se pudieron cargar los proyectos");
    } finally {
      setLoadingProjects(false);
    }
  };

  const attachToProject = async (budgetId: string, materialId: string) => {
    try {
      await api.updateBudget(budgetId, { material_id: materialId });
      setBudgets((arr) => arr.map((x) => x.id === budgetId ? { ...x, material_id: materialId } : x));
      setAttachModal(null);
      Alert.alert("Éxito", "Presupuesto vinculado correctamente al proyecto.");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    pendiente: { label: "Pendiente", color: BRAND_COLORS.warning, bg: BRAND_COLORS.warningBg },
    en_revision: { label: "En Revisión", color: BRAND_COLORS.purple, bg: BRAND_COLORS.purpleBg },
    enviado: { label: "Enviado", color: BRAND_COLORS.accent, bg: "#E0F2FE" },
    aceptado: { label: "Aceptado", color: BRAND_COLORS.success, bg: BRAND_COLORS.successBg },
  };

  const isAdmin = me?.role === "admin";
  const canAccess = isAdmin || me?.role === "comercial";
  const logout = async () => { await clearToken(); router.replace("/login"); };

  if (me && !canAccess) {
    return (
      <ResponsiveLayout active="presupuestos" isAdmin={isAdmin} onLogout={logout} userName={me?.name}>
        <SafeAreaView style={styles.containerCenter}>
          <Ionicons name="shield-alert-outline" size={72} color={BRAND_COLORS.textMuted} />
          <Text style={styles.deniedTitle}>Acceso no autorizado</Text>
          <Text style={styles.deniedText}>Tu rol actual no cuenta con permisos para gestionar presupuestos comerciales.</Text>
        </SafeAreaView>
      </ResponsiveLayout>
    );
  }

  const filteredBudgets = budgets.filter((b) => {
    if ((b.status || "pendiente") !== tab) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return `${b.n_proyecto || ""} ${b.cliente || ""} ${b.nombre_instalacion || ""}`.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <ResponsiveLayout active="presupuestos" isAdmin={isAdmin} onLogout={logout} userName={me?.name}>
      <SafeAreaView style={styles.root} edges={isWide ? [] : ["top"]}>

        <View style={styles.headerBar}>
          <View>
            <Text style={styles.mainTitle}>Módulo de Presupuestos</Text>
            <Text style={styles.subTitle}>Pipeline comercial y técnico de i-SAI</Text>
          </View>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => setShowCreateMenu(!showCreateMenu)}
          >
            <Ionicons name={showCreateMenu ? "close" : "add-circle-outline"} size={20} color="#FFF" />
            <Text style={styles.btnPrimaryText}>Nuevo Presupuesto</Text>
          </TouchableOpacity>
        </View>

        {showCreateMenu && (
          <View style={styles.dropdownActionMenu}>
            <TouchableOpacity
              style={styles.actionMenuCard}
              onPress={() => { setShowCreateMenu(false); router.push("/presupuestos/nuevo"); }}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: BRAND_COLORS.primaryLight }]}>
                <Ionicons name="document-text" size={20} color={BRAND_COLORS.primary} />
              </View>
              <View>
                <Text style={styles.actionCardTitle}>Proyecto en Blanco</Text>
                <Text style={styles.actionCardSub}>Ficha técnica limpia de instalación</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionMenuCard}
              onPress={() => { setShowCreateMenu(false); router.push("/presupuestos/existente"); }}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: "#E0F2FE" }]}>
                <Ionicons name="link-outline" size={20} color={BRAND_COLORS.accent} />
              </View>
              <View>
                <Text style={styles.actionCardTitle}>Enlazar Existente</Text>
                <Text style={styles.actionCardSub}>Vincular datos desde materiales</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={BRAND_COLORS.textSecondary} />
          <TextInput
            style={styles.searchInp}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por cliente, proyecto o instalación..."
            placeholderTextColor={BRAND_COLORS.textMuted}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color={BRAND_COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.segmentedTabRow}>
          {(["pendiente", "en_revision", "enviado", "aceptado"] as Tab[]).map((t) => {
            const count = budgets.filter((b) => (b.status || "pendiente") === t).length;
            const isActive = tab === t;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.segmentTab, isActive && styles.segmentTabActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.segmentTabText, isActive && styles.segmentTabTextActive]}>
                  {STATUS_CONFIG[t].label}
                </Text>
                <View style={[styles.badgeCounter, isActive ? { backgroundColor: "#FFF" } : { backgroundColor: BRAND_COLORS.primaryLight }]}>
                  <Text style={[styles.badgeCounterTxt, isActive && { color: BRAND_COLORS.primary }]}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

         <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollWrapper}>
          {loading ? (
            <ActivityIndicator size="large" color={BRAND_COLORS.primary} style={{ marginTop: 40 }} />
          ) : filteredBudgets.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={48} color={BRAND_COLORS.textMuted} />
              <Text style={styles.emptyText}>No se encontraron registros en este estado</Text>
            </View>
          ) : (
            filteredBudgets.map((b) => (
              <View key={b.id} style={styles.budgetCard}>
                <TouchableOpacity
                  style={{ flex: 1, padding: 16 }}
                  onPress={() => router.push(`/presupuestos/${b.id}`)}
                >
                  <View style={styles.cardHeaderInfo}>
                    <Text style={styles.projectCode}>
                      {b.n_proyecto ? `#${b.n_proyecto}` : "SIN CÓDIGO"}
                    </Text>
                    <View style={[styles.statusChip, { backgroundColor: STATUS_CONFIG[b.status || "pendiente"].bg }]}>
                      <Text style={[styles.statusChipText, { color: STATUS_CONFIG[b.status || "pendiente"].color }]}>
                        {STATUS_CONFIG[b.status || "pendiente"].label}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.clientName}>{b.cliente || "Cliente no asignado"}</Text>
                  <Text style={styles.installationLine} numberOfLines={1}>
                    <Ionicons name="location-outline" size={13} /> {b.nombre_instalacion || "Ubicación sin definir"}
                  </Text>

                  <View style={styles.cardFooter}>
                    <Text style={styles.creatorStamp}>
                      ✍️ {b.created_by_name || "Asignador automático"}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.contextActionArea}>
                  {b.status === "aceptado" ? (
                    <TouchableOpacity style={styles.btnAttachLink} onPress={() => openAttachModal(b.id)}>
                      <Ionicons name="link" size={16} color={BRAND_COLORS.primary} />
                      <Text style={styles.btnAttachLinkTxt}>Adjuntar</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.inlinePickerRow}>
                      <TouchableOpacity
                        style={styles.pickerSelector}
                        onPress={() => {
                          const states: Tab[] = ["pendiente", "en_revision", "enviado", "aceptado"];
                          const currIdx = states.indexOf(b.status || "pendiente");
                          if (currIdx < states.length - 1) {
                            updateStatusDirect(b.id, states[currIdx + 1]);
                          }
                        }}
                      >
                        <Text style={styles.pickerSelectorTxt}>Avanzar etapa</Text>
                        <Ionicons name="arrow-forward-outline" size={14} color={BRAND_COLORS.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal visible={attachModal !== null} transparent animationType="fade" onRequestClose={() => setAttachModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBody}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Vincular a Proyecto Madre</Text>
              <TouchableOpacity onPress={() => setAttachModal(null)}>
                <Ionicons name="close" size={24} color={BRAND_COLORS.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalSearchInp}
              value={projectSearch}
              onChangeText={setProjectSearch}
              placeholder="Filtro rápido de proyectos madre..."
            />
            <ScrollView style={{ maxHeight: 300 }}>
              {projects.filter(p => `${p.materiales} ${p.cliente}`.toLowerCase().includes(projectSearch.toLowerCase())).map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.modalProjectRow}
                  onPress={() => attachToProject(attachModal!, p.id)}
                >
                  <Text style={styles.modalProjectTitle}>{p.materiales || "Fila de Material"} - {p.cliente}</Text>
                  <Ionicons name="chevron-forward" size={16} color={BRAND_COLORS.primary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ResponsiveLayout>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND_COLORS.bg },
  containerCenter: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: BRAND_COLORS.bg },
  headerBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 18, backgroundColor: BRAND_COLORS.surface, borderBottomWidth: 1, borderBottomColor: BRAND_COLORS.border },
  mainTitle: { fontSize: 22, fontWeight: "800", color: BRAND_COLORS.text, letterSpacing: -0.5 },
  subTitle: { fontSize: 13, color: BRAND_COLORS.textSecondary, marginTop: 2 },
  btnPrimary: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: BRAND_COLORS.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  btnPrimaryText: { color: "#FFF", fontWeight: "600", fontSize: 14 },
  dropdownActionMenu: { backgroundColor: BRAND_COLORS.surface, marginHorizontal: 20, marginTop: 12, borderRadius: 12, padding: 8, borderWidth: 1, borderColor: BRAND_COLORS.border, gap: 4 },
  actionMenuCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 8 },
  actionIconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  actionCardTitle: { fontSize: 14, fontWeight: "700", color: BRAND_COLORS.text },
  actionCardSub: { fontSize: 11, color: BRAND_COLORS.textSecondary },
  searchContainer: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: BRAND_COLORS.surface, marginHorizontal: 20, marginTop: 16, paddingHorizontal: 16, height: 46, borderRadius: 10, borderWidth: 1, borderColor: BRAND_COLORS.border },
  searchInp: { flex: 1, fontSize: 14, color: BRAND_COLORS.text },
  segmentedTabRow: { flexDirection: "row", backgroundColor: "#E2E8F0", marginHorizontal: 20, marginTop: 16, padding: 4, borderRadius: 12 },
  segmentTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 8 },
  segmentTabActive: { backgroundColor: BRAND_COLORS.surface },
  segmentTabText: { fontSize: 13, fontWeight: "600", color: BRAND_COLORS.textSecondary },
  segmentTabTextActive: { color: BRAND_COLORS.text, fontWeight: "700" },
  badgeCounter: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeCounterTxt: { fontSize: 11, fontWeight: "700", color: BRAND_COLORS.textSecondary },
  scrollWrapper: { paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyText: { color: BRAND_COLORS.textMuted, fontSize: 14 },
  budgetCard: { backgroundColor: BRAND_COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: BRAND_COLORS.border, overflow: "hidden" },
  cardHeaderInfo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  projectCode: { fontSize: 12, fontWeight: "700", color: BRAND_COLORS.textMuted, letterSpacing: 0.5 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusChipText: { fontSize: 11, fontWeight: "700" },
  clientName: { fontSize: 16, fontWeight: "700", color: BRAND_COLORS.text },
  installationLine: { fontSize: 13, color: BRAND_COLORS.textSecondary, marginTop: 4 },
  cardFooter: { borderTopWidth: 1, borderTopColor: BRAND_COLORS.border, marginTop: 14, paddingTop: 10 },
  creatorStamp: { fontSize: 11, color: BRAND_COLORS.textMuted, fontWeight: "500" },
  contextActionArea: { backgroundColor: "#F8FAFC", borderTopWidth: 1, borderTopColor: BRAND_COLORS.border, padding: 12, alignItems: "flex-end" },
  btnAttachLink: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: BRAND_COLORS.primaryLight },
  btnAttachLinkTxt: { fontSize: 13, fontWeight: "600", color: BRAND_COLORS.primary },
  inlinePickerRow: { flexDirection: "row", alignItems: "center" },
  pickerSelector: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: BRAND_COLORS.border, backgroundColor: "#FFF" },
  pickerSelectorTxt: { fontSize: 12, color: BRAND_COLORS.textSecondary, fontWeight: "600" },
  deniedTitle: { fontSize: 20, fontWeight: "800", color: BRAND_COLORS.text, marginTop: 16 },
  deniedText: { fontSize: 14, color: BRAND_COLORS.textSecondary, textAlign: "center", marginTop: 6, paddingHorizontal: 20 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.6)", justifyContent: "center", padding: 20 },
  modalBody: { backgroundColor: "#FFF", borderRadius: 16, padding: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalSearchInp: { borderWidth: 1, borderColor: BRAND_COLORS.border, borderRadius: 8, padding: 10, marginBottom: 12 },
  modalProjectRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BRAND_COLORS.border },
  modalProjectTitle: { fontSize: 14, color: BRAND_COLORS.text },
});
