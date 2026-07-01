import { useCallback, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Modal, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, clearToken, COLORS } from "../src/api";
import ResponsiveLayout from "../src/ResponsiveLayout";
import { useBreakpoint } from "../src/useBreakpoint";
import { useThemedStyles } from "../src/theme";
import { ios } from "../src/ui/iosTheme";
import { usePermissions } from "../src/permissions";

export default function ClientesIndex() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const s = useThemedStyles(useS);
  const { me } = usePermissions();
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [formNombre, setFormNombre] = useState("");
  const [formRazon, setFormRazon] = useState("");
  const [formDocId, setFormDocId] = useState("NIF");
  const [formDireccion, setFormDireccion] = useState("");
  const [formProvincia, setFormProvincia] = useState("");
  const [formPoblacion, setFormPoblacion] = useState("");
  const [formRepresentante, setFormRepresentante] = useState("");
  const [formTelefono, setFormTelefono] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formMantenimiento, setFormMantenimiento] = useState(false);
  const [formTipoMantenimiento, setFormTipoMantenimiento] = useState("");
  const [formRevisiones, setFormRevisiones] = useState("0");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.listClientes();
      setClientes(list);
    } catch (e: any) {
      if (/401|Invalid|expired/i.test(e.message)) { await clearToken(); router.replace("/login"); }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    let alive = true;
    (async () => {
      try {
        const list = await api.listClientes();
        if (alive) setClientes(list);
      } catch (e: any) {
        if (/401|Invalid|expired/i.test(e.message)) { await clearToken(); router.replace("/login"); }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []));

  const resetForm = () => {
    setFormNombre(""); setFormRazon(""); setFormDocId("NIF"); setFormDireccion("");
    setFormProvincia(""); setFormPoblacion(""); setFormRepresentante("");
    setFormTelefono(""); setFormEmail(""); setFormMantenimiento(false);
    setFormTipoMantenimiento(""); setFormRevisiones("0");
  };

  const createCliente = async () => {
    if (!formNombre.trim()) { Alert.alert("Error", "El nombre es obligatorio"); return; }
    setSaving(true);
    try {
      const body: any = {
        nombre: formNombre.trim(),
        razon_social: formRazon.trim(),
        tipo_documento_id: formDocId,
        direccion: formDireccion.trim(),
        provincia: formProvincia.trim(),
        poblacion: formPoblacion.trim(),
        representante: formRepresentante.trim(),
        telefono: formTelefono.trim(),
        email: formEmail.trim(),
        direcciones: [{
          direccion: formDireccion.trim(),
          representante: formRepresentante.trim(),
          telefono: formTelefono.trim(),
          email: formEmail.trim(),
        }],
        mantenimiento_contratado: formMantenimiento,
        tipo_mantenimiento: formMantenimiento ? formTipoMantenimiento.trim() : "",
        numero_revisiones: formMantenimiento ? parseInt(formRevisiones) || 0 : 0,
      };
      await api.createCliente(body);
      setShowCreate(false);
      resetForm();
      load();
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setSaving(false); }
  };

  const filtered = search
    ? clientes.filter((c) =>
        `${c.nombre} ${c.razon_social} ${c.poblacion} ${c.telefono}`.toLowerCase().includes(search.toLowerCase())
      )
    : clientes;

  const content = (
    <SafeAreaView style={s.root} edges={["top"]}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Clientes</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={s.addBtnText}>Nuevo cliente</Text>
        </TouchableOpacity>
      </View>

      <View style={s.searchWrap}>
        <Ionicons name="search" size={18} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nombre, razón social, población..."
          placeholderTextColor={COLORS.textDisabled}
        />
        {search !== "" && (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: ios.spacing.lg, paddingBottom: 120, gap: ios.spacing.sm }}>
          {filtered.length === 0 ? (
            <Text style={{ color: COLORS.textDisabled, textAlign: "center", marginTop: 40, fontSize: ios.font.callout.size }}>
              {search ? "Sin resultados" : "No hay clientes registrados. Crea el primero."}
            </Text>
          ) : (
            filtered.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={s.card}
                onPress={() => router.push(`/clientes/${c.id}`)}
                activeOpacity={0.7}
              >
                <View style={s.cardLeft}>
                  <View style={s.avatarCircle}>
                    <Ionicons name="business-outline" size={22} color={COLORS.primary} />
                  </View>
                </View>
                <View style={s.cardCenter}>
                  <Text style={s.cardName} numberOfLines={1}>{c.nombre}</Text>
                  {c.razon_social ? <Text style={s.cardRazon} numberOfLines={1}>{c.razon_social}</Text> : null}
                  <View style={s.cardMeta}>
                    {c.poblacion ? (
                      <View style={s.cardMetaItem}>
                        <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} />
                        <Text style={s.cardMetaText}>{c.poblacion}</Text>
                      </View>
                    ) : null}
                    {c.telefono ? (
                      <View style={s.cardMetaItem}>
                        <Ionicons name="call-outline" size={12} color={COLORS.textSecondary} />
                        <Text style={s.cardMetaText}>{c.telefono}</Text>
                      </View>
                    ) : null}
                  </View>
                  {c.mantenimiento_contratado && (
                    <View style={s.mantBadge}>
                      <Ionicons name="shield-checkmark-outline" size={12} color={COLORS.syncedText} />
                      <Text style={s.mantBadgeText}>Mantenimiento</Text>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textDisabled} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={s.modalRoot}>
          <ScrollView style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Nuevo cliente</Text>
              <TouchableOpacity onPress={() => { setShowCreate(false); resetForm(); }}>
                <Ionicons name="close" size={26} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={s.fieldLabel}>Nombre *</Text>
            <TextInput style={s.input} value={formNombre} onChangeText={setFormNombre} placeholder="Nombre del cliente" placeholderTextColor={COLORS.textDisabled} />

            <Text style={s.fieldLabel}>Razón social</Text>
            <TextInput style={s.input} value={formRazon} onChangeText={setFormRazon} placeholder="Razón social" placeholderTextColor={COLORS.textDisabled} />

            <Text style={s.fieldLabel}>Tipo documento</Text>
            <View style={s.chipRow}>
              {["NIF", "CIF", "Otro"].map((t) => (
                <TouchableOpacity key={t} style={[s.chip, formDocId === t && s.chipActive]} onPress={() => setFormDocId(t)}>
                  <Text style={[s.chipText, formDocId === t && s.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.fieldLabel}>Dirección</Text>
            <TextInput style={s.input} value={formDireccion} onChangeText={setFormDireccion} placeholder="Dirección" placeholderTextColor={COLORS.textDisabled} />

            <View style={{ flexDirection: "row", gap: ios.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Provincia</Text>
                <TextInput style={s.input} value={formProvincia} onChangeText={setFormProvincia} placeholder="Provincia" placeholderTextColor={COLORS.textDisabled} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Población</Text>
                <TextInput style={s.input} value={formPoblacion} onChangeText={setFormPoblacion} placeholder="Población" placeholderTextColor={COLORS.textDisabled} />
              </View>
            </View>

            <Text style={s.fieldLabel}>Representante</Text>
            <TextInput style={s.input} value={formRepresentante} onChangeText={setFormRepresentante} placeholder="Nombre del representante" placeholderTextColor={COLORS.textDisabled} />

            <Text style={s.fieldLabel}>Teléfono</Text>
            <TextInput style={s.input} value={formTelefono} onChangeText={setFormTelefono} placeholder="Teléfono" placeholderTextColor={COLORS.textDisabled} keyboardType="phone-pad" />

            <Text style={s.fieldLabel}>Email</Text>
            <TextInput style={s.input} value={formEmail} onChangeText={setFormEmail} placeholder="Email" placeholderTextColor={COLORS.textDisabled} keyboardType="email-address" autoCapitalize="none" />

            <Text style={s.sectionTitle}>Mantenimiento</Text>
            <TouchableOpacity style={s.switchRow} onPress={() => setFormMantenimiento(!formMantenimiento)}>
              <Text style={s.switchLabel}>Mantenimiento contratado</Text>
              <View style={[s.toggle, formMantenimiento && s.toggleOn]}>
                <View style={[s.toggleKnob, formMantenimiento && s.toggleKnobOn]} />
              </View>
            </TouchableOpacity>
            {formMantenimiento && (
              <>
                <Text style={s.fieldLabel}>Tipo de mantenimiento</Text>
                <TextInput style={s.input} value={formTipoMantenimiento} onChangeText={setFormTipoMantenimiento} placeholder="Ej: Preventivo y correctivo" placeholderTextColor={COLORS.textDisabled} />
                <Text style={s.fieldLabel}>Nº revisiones al año</Text>
                <TextInput style={s.input} value={formRevisiones} onChangeText={setFormRevisiones} placeholder="0" placeholderTextColor={COLORS.textDisabled} keyboardType="numeric" />
              </>
            )}

            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.4 }]} onPress={createCliente} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>CREAR CLIENTE</Text>}
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );

  if (!isWide) return content;
  return (
    <ResponsiveLayout active="clientes" isAdmin={me?.role === "admin"} userName={me?.name}>
      {content}
    </ResponsiveLayout>
  );
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: ios.spacing.lg, paddingVertical: ios.spacing.md,
    backgroundColor: COLORS.surface, borderBottomWidth: ios.hairline, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: ios.font.title3.size, fontWeight: ios.font.title3.weight, color: COLORS.text },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: ios.radius.pill,
  },
  addBtnText: { color: "#fff", fontSize: ios.font.footnote.size, fontWeight: "700" },
  searchWrap: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: ios.spacing.lg, marginVertical: ios.spacing.md,
    backgroundColor: COLORS.surface, borderRadius: ios.radius.card,
    paddingHorizontal: ios.spacing.md, height: 44,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: ios.font.callout.size, color: COLORS.text },
  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.surface, borderRadius: ios.radius.card,
    padding: ios.spacing.md, borderWidth: 1, borderColor: COLORS.border,
    gap: ios.spacing.sm,
  },
  cardLeft: {},
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primarySoft, alignItems: "center", justifyContent: "center",
  },
  cardCenter: { flex: 1, gap: 2 },
  cardName: { fontSize: ios.font.body.size, fontWeight: "700", color: COLORS.text },
  cardRazon: { fontSize: ios.font.footnote.size, color: COLORS.textSecondary },
  cardMeta: { flexDirection: "row", gap: ios.spacing.md, marginTop: 2 },
  cardMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardMetaText: { fontSize: ios.font.caption.size, color: COLORS.textSecondary },
  mantBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.syncedBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: ios.radius.pill,
    alignSelf: "flex-start", marginTop: 4,
  },
  mantBadgeText: { fontSize: 10, fontWeight: "700", color: COLORS.syncedText },
  modalRoot: {
    flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalCard: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: ios.radius.xl, borderTopRightRadius: ios.radius.xl,
    maxHeight: "90%", padding: ios.spacing.lg, paddingBottom: ios.spacing.xxl,
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: ios.spacing.md,
  },
  modalTitle: { fontSize: ios.font.title2.size, fontWeight: ios.font.title2.weight, color: COLORS.text },
  fieldLabel: {
    fontSize: ios.font.section.size, fontWeight: ios.font.section.weight, color: COLORS.textSecondary,
    letterSpacing: ios.font.section.letter, marginTop: ios.spacing.md, marginBottom: ios.spacing.xs,
  },
  input: {
    height: 48, backgroundColor: COLORS.bg,
    borderWidth: 2, borderColor: COLORS.borderInput, borderRadius: ios.radius.md,
    paddingHorizontal: ios.spacing.md, fontSize: ios.font.callout.size, color: COLORS.text,
  },
  chipRow: { flexDirection: "row", gap: ios.spacing.sm },
  chip: {
    flex: 1, height: 44, borderRadius: ios.radius.md, borderWidth: 2,
    borderColor: COLORS.borderInput, backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center",
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: ios.font.callout.size, fontWeight: "700", color: COLORS.textSecondary },
  chipTextActive: { color: "#fff" },
  sectionTitle: {
    fontSize: ios.font.title3.size, fontWeight: "700", color: COLORS.text, marginTop: ios.spacing.xl, marginBottom: ios.spacing.sm,
  },
  switchRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: ios.spacing.sm, paddingHorizontal: ios.spacing.xs,
  },
  switchLabel: { fontSize: ios.font.callout.size, color: COLORS.text },
  toggle: {
    width: 48, height: 28, borderRadius: 14, backgroundColor: COLORS.borderInput,
    justifyContent: "center", paddingHorizontal: 2,
  },
  toggleOn: { backgroundColor: COLORS.primary },
  toggleKnob: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  toggleKnobOn: { alignSelf: "flex-end" },
  saveBtn: {
    height: 52, borderRadius: ios.radius.card, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center", marginTop: ios.spacing.xl,
  },
  saveBtnText: { color: "#fff", fontSize: ios.font.callout.size, fontWeight: "800", letterSpacing: 1 },
});
