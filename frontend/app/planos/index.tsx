import { useCallback, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS } from "../../src/api";

type Plan = {
  id: string; title: string; created_at: string; updated_at: string;
  created_by: string; shape_count: number;
};

export default function PlansList() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    try {
      const list = await api.listPlans();
      setPlans(list);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const doDelete = (p: Plan) => {
    Alert.alert("Eliminar plano", `¿Eliminar "${p.title}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar", style: "destructive",
        onPress: async () => {
          try {
            await api.deletePlan(p.id);
            load();
          } catch (e: any) {
            Alert.alert("Error", e.message);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}>
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
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={COLORS.primary} size="large" />
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
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {plans.map((p) => (
            <TouchableOpacity
              key={p.id}
              testID={`plan-card-${p.id}`}
              style={s.planCard}
              onPress={() => router.push(`/planos/${p.id}`)}
              activeOpacity={0.8}
            >
              <View style={s.planIcon}>
                <Ionicons name="map" size={24} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.planTitle} numberOfLines={1}>{p.title}</Text>
                <Text style={s.planMeta}>
                  {p.shape_count} pieza{p.shape_count !== 1 ? "s" : ""} · {p.created_by.split("@")[0]}
                </Text>
                <Text style={s.planDate}>
                  {new Date(p.updated_at).toLocaleDateString("es-ES", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                </Text>
              </View>
              <TouchableOpacity
                testID={`btn-delete-plan-${p.id}`}
                hitSlop={10}
                style={s.trashBtn}
                onPress={() => doDelete(p)}
              >
                <Ionicons name="trash-outline" size={20} color={COLORS.errorText} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <CreatePlanModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onDone={(id) => { setShowCreate(false); router.push(`/planos/${id}`); }}
      />
    </SafeAreaView>
  );
}

function CreatePlanModal({
  visible, onClose, onDone,
}: { visible: boolean; onClose: () => void; onDone: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "El título es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const plan = await api.createPlan({ title: title.trim() });
      setTitle("");
      onDone(plan.id);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.modalRoot}
      >
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Nuevo plano</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={26} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <Text style={s.mLabel}>Título</Text>
          <TextInput
            testID="input-plan-title"
            style={s.mInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Ej. Oficina Cliente X"
            placeholderTextColor={COLORS.textDisabled}
          />
          <TouchableOpacity
            testID="btn-create-plan"
            style={[s.primary, saving && { opacity: 0.6 }]}
            onPress={submit}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>CREAR Y ABRIR</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 40 },
  emptyTitle: { fontSize: 22, fontWeight: "900", color: COLORS.text, marginTop: 12 },
  emptySub: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 20, textAlign: "center" },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.primary,
    paddingHorizontal: 20, height: 50, borderRadius: 12,
  },
  emptyBtnText: { color: "#fff", fontWeight: "800", fontSize: 14, letterSpacing: 1 },
  planCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  planIcon: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center",
  },
  planTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  planMeta: { fontSize: 13, color: COLORS.textSecondary },
  planDate: { fontSize: 11, color: COLORS.textDisabled, fontWeight: "600" },
  trashBtn: { padding: 8 },
  modalRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalCard: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  mLabel: {
    fontSize: 11, fontWeight: "800", color: COLORS.textSecondary,
    letterSpacing: 1.2, marginTop: 14, marginBottom: 6,
  },
  mInput: {
    height: 52, backgroundColor: COLORS.bg, borderWidth: 2, borderColor: COLORS.borderInput,
    borderRadius: 10, paddingHorizontal: 14, fontSize: 16, color: COLORS.text,
  },
  primary: {
    height: 52, borderRadius: 12, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center", marginTop: 20,
  },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: 1 },
});
