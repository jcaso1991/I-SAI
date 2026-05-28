import { useCallback, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, clearToken, COLORS } from "../../src/api";
import ResponsiveLayout from "../../src/ResponsiveLayout";
import { useBreakpoint } from "../../src/useBreakpoint";
import { useThemedStyles } from "../../src/theme";
import { ios } from "../../src/ui/iosTheme";

type Tab = "pendiente" | "en_revision" | "enviado" | "aceptado";

export default function PresupuestosIndex() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const s = useThemedStyles(useS);
  const [me, setMe] = useState<any>(null);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pendiente");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
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
        setMe(u); setBudgets(list);
      } catch (e: any) {
        if (/401|Invalid|expired/i.test(e.message)) { await clearToken(); router.replace("/login"); }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []));

  const statusFlow: Record<string, string> = {
    pendiente: "en_revision",
    en_revision: "enviado",
    enviado: "aceptado",
  };

  const reverseFlow: Record<string, string> = {
    en_revision: "pendiente",
    enviado: "en_revision",
    aceptado: "enviado",
  };

  const changeStatus = async (id: string, newStatus: string) => {
    try {
      const res = await api.setBudgetStatus(id, newStatus);
      setBudgets((arr) => arr.map((x) => x.id === id ? { ...x, status: res.status || newStatus } : x));
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const advanceStatus = async (id: string) => {
    const b = budgets.find((x) => x.id === id);
    if (!b) return;
    const current = b.status || "pendiente";
    const next = statusFlow[current];
    if (!next) return;
    await changeStatus(id, next);
  };

  const goBackStatus = async (id: string) => {
    const b = budgets.find((x) => x.id === id);
    if (!b) return;
    const current = b.status || "pendiente";
    const prev = reverseFlow[current];
    if (!prev) return;
    await changeStatus(id, prev);
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
      Alert.alert("Listo", "Presupuesto vinculado al proyecto");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const filteredProjects = projects.filter((p) => {
    if (!projectSearch.trim()) return true;
    const q = projectSearch.toLowerCase();
    return `${p.materiales || ""} ${p.cliente || ""} ${p.n_proyecto || ""}`.toLowerCase().includes(q);
  });

  const STATUS_LABELS: Record<string, string> = {
    pendiente: "Pendiente",
    en_revision: "En revisión",
    enviado: "Pend. aceptar",
    aceptado: "Aceptado",
  };

  const isAdmin = me?.role === "admin";
  const canAccess = me?.role === "admin" || me?.role === "comercial";
  const logout = async () => { await clearToken(); router.replace("/login"); };

  if (me && !canAccess) {
    return (
      <ResponsiveLayout active="presupuestos" isAdmin={isAdmin} onLogout={logout} userName={me?.name}>
        <SafeAreaView style={s.root}>
          <View style={s.denied}>
            <Ionicons name="lock-closed" size={64} color={COLORS.textDisabled} />
            <Text style={s.deniedTitle}>Acceso restringido</Text>
            <Text style={s.deniedTxt}>Solo administradores y comerciales pueden ver presupuestos.</Text>
          </View>
        </SafeAreaView>
      </ResponsiveLayout>
    );
  }

  const filtered = budgets.filter((b) => {
    const status = b.status || "pendiente";
    if (tab !== status) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const haystack = `${b.n_proyecto || ""} ${b.cliente || ""} ${b.nombre_instalacion || ""} ${b.created_by_name || b.created_by || ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const countByStatus = (status: string) => budgets.filter((b) => (b.status || "pendiente") === status).length;

  return (
    <ResponsiveLayout active="presupuestos" isAdmin={isAdmin} onLogout={logout} userName={me?.name}>
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      <View style={s.header}>
        {!isWide && (
          <TouchableOpacity style={s.iconBtn} onPress={() => router.replace("/home")}>
            <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
          </TouchableOpacity>
        )}
        <Text style={s.headerTitle}>Presupuestos</Text>
        <TouchableOpacity
          style={s.iconBtn}
          onPress={() => setShowCreate((v) => !v)}
        >
          <Ionicons name={showCreate ? "chevron-up" : "add"} size={26} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

        {/* Create actions (collapsible) */}
      {showCreate && (
        <View style={[s.actions, isWide && { maxWidth: 900, alignSelf: "center", width: "100%" }]}>
          <TouchableOpacity
            testID="btn-new-budget"
            style={[s.card, { backgroundColor: COLORS.primary }]}
            onPress={() => { setShowCreate(false); router.push("/presupuestos/nuevo"); }}
            activeOpacity={0.85}
          >
            <View style={s.cardIconContainer}>
              <Ionicons name="add-circle" size={28} color="#fff" />
            </View>
            <Text style={s.cardTitle}>Proyecto nuevo</Text>
            <Text style={s.cardSub}>Crear un presupuesto en blanco</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="btn-existing-budget"
            style={[s.card, { backgroundColor: COLORS.accent }]}
            onPress={() => { setShowCreate(false); router.push("/presupuestos/existente"); }}
            activeOpacity={0.85}
          >
            <View style={s.cardIconContainer}>
              <Ionicons name="folder-open" size={28} color="#fff" />
            </View>
            <Text style={s.cardTitle}>Proyecto existente</Text>
            <Text style={s.cardSub}>Enlazar a un proyecto ya creado</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search bar */}
      <View style={s.searchBox}>
        <Ionicons name="search" size={18} color={COLORS.textSecondary} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por proyecto, cliente, creador..."
          placeholderTextColor={COLORS.textDisabled}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(["pendiente", "en_revision", "enviado", "aceptado"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {STATUS_LABELS[t]} ({countByStatus(t)})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Budget list */}
      <ScrollView contentContainerStyle={s.scroll}>
        {loading ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : filtered.length === 0 ? (
          <Text style={s.empty}>No hay presupuestos {STATUS_LABELS[tab]?.toLowerCase() || ""}</Text>
        ) : (
          <View style={{ gap: 10, maxWidth: isWide ? 900 : undefined, alignSelf: "center", width: "100%" }}>
            {filtered.map((b) => (
              <View key={b.id} style={s.row}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => router.push(`/presupuestos/${b.id}`)}
                >
                  <Text style={s.rowTitle} numberOfLines={1}>
                    {b.n_proyecto ? `#${b.n_proyecto} · ` : ""}{b.cliente || b.nombre_instalacion || "Sin título"}
                  </Text>
                  <Text style={s.rowSub} numberOfLines={1}>
                    {b.nombre_instalacion || ""} {b.direccion ? `· ${b.direccion}` : ""}
                  </Text>
                  <Text style={s.rowCreator}>
                    👤 {b.created_by_name || b.created_by || "—"}
                  </Text>
                </TouchableOpacity>
                {b.status === "aceptado" ? (
                  <TouchableOpacity
                    style={[s.attachBtn]}
                    onPress={() => openAttachModal(b.id)}
                  >
                    <Ionicons name="link" size={16} color="#1E40AF" />
                    <Text style={[s.statusBtnText, { color: "#1E40AF" }]}>Adjuntar</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    {reverseFlow[b.status || "pendiente"] ? (
                      <TouchableOpacity style={s.arrowBtn} onPress={() => goBackStatus(b.id)}>
                        <Ionicons name="chevron-back" size={16} color={COLORS.textSecondary} />
                      </TouchableOpacity>
                    ) : (
                      <View style={[s.arrowBtn, { opacity: 0.3 }]}>
                        <Ionicons name="chevron-back" size={16} color={COLORS.textDisabled} />
                      </View>
                    )}
                    <View style={[s.statusBtn, b.status === "pendiente" ? s.statusBtnPending : b.status === "enviado" ? { backgroundColor: "#DBEAFE" } : { backgroundColor: "#F3E8FF" }]}>
                      <Text style={[s.statusBtnText, b.status === "pendiente" ? { color: "#92400E" } : b.status === "en_revision" ? { color: "#6B21A8" } : { color: "#1E40AF" }]}>
                        {STATUS_LABELS[b.status || "pendiente"]}
                      </Text>
                    </View>
                    {statusFlow[b.status || "pendiente"] ? (
                      <TouchableOpacity style={s.arrowBtn} onPress={() => advanceStatus(b.id)}>
                        <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
                      </TouchableOpacity>
                    ) : (
                      <View style={[s.arrowBtn, { opacity: 0.3 }]}>
                        <Ionicons name="chevron-forward" size={16} color={COLORS.textDisabled} />
                      </View>
                    )}
                  </View>
                )}
                <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} style={{ marginLeft: 4 }} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
    <Modal visible={attachModal !== null} transparent animationType="slide" onRequestClose={() => setAttachModal(null)}>
      <View style={s.modalOverlay}>
        <View style={s.modalContent}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Seleccionar proyecto</Text>
            <TouchableOpacity onPress={() => setAttachModal(null)} style={s.iconBtn}>
              <Ionicons name="close" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <View style={s.searchBox}>
            <Ionicons name="search" size={18} color={COLORS.textSecondary} />
            <TextInput
              style={s.searchInput}
              value={projectSearch}
              onChangeText={setProjectSearch}
              placeholder="Buscar por nombre, número de proyecto..."
              placeholderTextColor={COLORS.textDisabled}
            />
            {projectSearch.length > 0 && (
              <TouchableOpacity onPress={() => setProjectSearch("")}>
                <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          <ScrollView style={s.modalList}>
            {loadingProjects ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
            ) : filteredProjects.length === 0 ? (
              <Text style={s.empty}>No se encontraron proyectos</Text>
            ) : (
              filteredProjects.map((p) => (
                <TouchableOpacity
                  key={p.id || p._id}
                  style={s.projectRow}
                  onPress={() => attachToProject(attachModal!, p.id || p._id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle} numberOfLines={1}>
                      {p.materiales || "Sin título"} {p.n_proyecto ? `(#${p.n_proyecto})` : ""}
                    </Text>
                    <Text style={s.rowSub} numberOfLines={1}>
                      {p.cliente || ""} {p.ubicacion ? `· ${p.ubicacion}` : ""}
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={22} color={COLORS.primary} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
    </ResponsiveLayout>
  );
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: ios.spacing.lg, paddingVertical: 12, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 22, fontWeight: "900", color: COLORS.text, flex: 1, textAlign: "center", letterSpacing: -0.4 },
  iconBtn: { width: 40, height: 40, borderRadius: ios.radius.md, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  scroll: { padding: ios.spacing.lg, paddingBottom: 40, gap: 10 },
  actions: { flexDirection: "row", gap: ios.spacing.md, padding: ios.spacing.lg },
  card: {
    flex: 1, minWidth: 200, padding: ios.spacing.lg, borderRadius: ios.radius.lg,
    alignItems: "center", gap: ios.spacing.sm,
    ...ios.shadow.card,
  },
  cardIconContainer: {
    width: 52, height: 52, borderRadius: ios.radius.md,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
  cardSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600" },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginTop: 12, marginBottom: 8,
    paddingHorizontal: 16, height: 48, backgroundColor: COLORS.surface,
    borderRadius: ios.radius.md, borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text },
  tabRow: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 8,
    backgroundColor: COLORS.surface, borderRadius: ios.radius.pill, padding: 4,
    borderWidth: 1, borderColor: COLORS.border,
  },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: ios.radius.pill, alignItems: "center",
  },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 14, fontWeight: "700", color: COLORS.textSecondary },
  tabTextActive: { color: "#fff" },
  empty: { color: COLORS.textSecondary, textAlign: "center", padding: 20 },
  row: {
    flexDirection: "row", alignItems: "center", padding: ios.spacing.lg,
    backgroundColor: COLORS.surface,
    borderRadius: ios.radius.lg, borderWidth: 1, borderColor: COLORS.border, gap: 10,
    ...ios.shadow.card,
  },
  rowTitle: { fontSize: 14, fontWeight: "800", color: COLORS.text },
  rowSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  rowCreator: { fontSize: 11, color: COLORS.textDisabled, fontWeight: "600", marginTop: 3 },
  statusBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: ios.radius.pill,
  },
  statusBtnPending: { backgroundColor: "#FEF3C7" },
  statusBtnAccepted: { backgroundColor: "#DCFCE7" },
  statusBtnText: { fontSize: 12, fontWeight: "800" },
  denied: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 40 },
  deniedTitle: { fontSize: 22, fontWeight: "900", color: COLORS.text },
  deniedTxt: { color: COLORS.textSecondary, textAlign: "center" },
  attachBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: ios.radius.pill,
    backgroundColor: "#DBEAFE",
  },
  arrowBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: COLORS.border,
  },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: "70%", paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  modalList: { flex: 1, paddingHorizontal: 16 },
  projectRow: {
    flexDirection: "row", alignItems: "center", padding: 14,
    backgroundColor: COLORS.bg, borderRadius: ios.radius.md, marginBottom: 8, gap: 10,
  },
});
