import { useCallback, useState, useMemo } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform
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
  const [filterSaltoKs, setFilterSaltoKs] = useState(false);
  const [filterTipoMtto, setFilterTipoMtto] = useState("");
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
  }, [router]));

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
      const list = await api.listClientes();
      setClientes(list);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setSaving(false); }
  };

  const filtered = (search || filterSaltoKs || filterTipoMtto
    ? clientes.filter((c) => {
        if (filterSaltoKs && !c.salto_ks_activo) return false;
        if (filterTipoMtto && c.tipo_mantenimiento !== filterTipoMtto) return false;
        if (search && !`${c.nombre} ${c.razon_social} ${c.poblacion} ${c.telefono}`.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
    : clientes
  );

  const content = (
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Clientes</Text>
          <Text style={s.headerSubtitle}>{filtered.length} registrados</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowCreate(true)} activeOpacity={0.8}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={s.addBtnText}>Nuevo</Text>
        </TouchableOpacity>
      </View>

      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar cliente, población o teléfono..."
          placeholderTextColor={COLORS.textDisabled}
        />
        {search !== "" && (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={{ flexDirection: "row", gap: 6, marginHorizontal: ios.spacing.lg, marginBottom: 8, flexWrap: "wrap" }}>
        <TouchableOpacity onPress={() => setFilterSaltoKs(!filterSaltoKs)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: filterSaltoKs ? COLORS.pillPurpleText : COLORS.border, backgroundColor: filterSaltoKs ? "#EDE9FE" : "transparent" }}>
          <Text style={{ fontSize: 11, fontWeight: "600", color: filterSaltoKs ? COLORS.pillPurpleText : COLORS.textSecondary }}>🔑 Salto KS</Text>
        </TouchableOpacity>
        {["Anual", "Trimestral", "Semestral"].map((t) => (
          <TouchableOpacity key={t} onPress={() => setFilterTipoMtto(filterTipoMtto === t ? "" : t)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: filterTipoMtto === t ? COLORS.syncedText : COLORS.border, backgroundColor: filterTipoMtto === t ? "#D1FAE5" : "transparent" }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: filterTipoMtto === t ? COLORS.syncedText : COLORS.textSecondary }}>🛡️ {t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scrollContainer}>
          {filtered.length === 0 ? (
            <View style={s.emptyState}>
              <Ionicons name="people-outline" size={48} color={COLORS.textDisabled} />
              <Text style={s.emptyText}>
                {search ? "No se encontraron coincidencias" : "No hay clientes registrados en el sistema."}
              </Text>
            </View>
          ) : (
            filtered.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={s.card}
                onPress={() => router.push(`/clientes/${c.id}`)}
                activeOpacity={0.7}
              >
                <View style={s.avatarCircle}>
                  <Ionicons name="business" size={20} color={COLORS.primary} />
                </View>

                <View style={s.cardCenter}>
                  <Text style={s.cardName} numberOfLines={1}>{c.nombre}</Text>
                  {c.razon_social ? <Text style={s.cardRazon} numberOfLines={1}>{c.razon_social}</Text> : null}

                  <View style={s.cardMeta}>
                    {c.poblacion && (
                      <View style={s.cardMetaItem}>
                        <Ionicons name="location-outline" size={13} color={COLORS.textSecondary} />
                        <Text style={s.cardMetaText} numberOfLines={1}>{c.poblacion}</Text>
                      </View>
                    )}
                    {c.telefono && (
                      <View style={s.cardMetaItem}>
                        <Ionicons name="call-outline" size={13} color={COLORS.textSecondary} />
                        <Text style={s.cardMetaText}>{c.telefono}</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={s.cardRight}>
                  {c.mantenimiento_contratado && (
                    <View style={s.mantBadge}>
                      <Ionicons name="shield-checkmark" size={10} color={COLORS.syncedText} />
                      <Text style={s.mantBadgeText}>{c.tipo_mantenimiento || "Mantenimiento"}</Text>
                    </View>
                  )}
                  {c.salto_ks_activo && (
                    <View style={[s.mantBadge, { backgroundColor: "#EDE9FE" }]}>
                      <Ionicons name="key-outline" size={10} color={COLORS.pillPurpleText} />
                      <Text style={[s.mantBadgeText, { color: COLORS.pillPurpleText }]}>Salto KS</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textDisabled} style={{ alignSelf: 'flex-end', marginTop: 'auto', marginBottom: 'auto' }} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.modalRoot}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Nuevo Cliente</Text>
              <TouchableOpacity onPress={() => { setShowCreate(false); resetForm(); }} style={s.closeModalBtn}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={s.modalForm} showsVerticalScrollIndicator={false}>
              <Text style={s.fieldLabel}>Nombre comercial *</Text>
              <TextInput style={s.input} value={formNombre} onChangeText={setFormNombre} placeholder="Ej: Electrónica S.A." placeholderTextColor={COLORS.textDisabled} />

              <Text style={s.fieldLabel}>Razón social</Text>
              <TextInput style={s.input} value={formRazon} onChangeText={setFormRazon} placeholder="Nombre fiscal completo" placeholderTextColor={COLORS.textDisabled} />

              <Text style={s.fieldLabel}>Tipo de documento</Text>
              <View style={s.chipRow}>
                {["NIF", "CIF", "Otro"].map((t) => (
                  <TouchableOpacity key={t} style={[s.chip, formDocId === t && s.chipActive]} onPress={() => setFormDocId(t)}>
                    <Text style={[s.chipText, formDocId === t && s.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.fieldLabel}>Dirección principal</Text>
              <TextInput style={s.input} value={formDireccion} onChangeText={setFormDireccion} placeholder="Calle, número, planta..." placeholderTextColor={COLORS.textDisabled} />

              <View style={s.rowFields}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Población</Text>
                  <TextInput style={s.input} value={formPoblacion} onChangeText={setFormPoblacion} placeholder="Localidad" placeholderTextColor={COLORS.textDisabled} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Provincia</Text>
                  <TextInput style={s.input} value={formProvincia} onChangeText={setFormProvincia} placeholder="Provincia" placeholderTextColor={COLORS.textDisabled} />
                </View>
              </View>

              <Text style={s.fieldLabel}>Persona de contacto / Representante</Text>
              <TextInput style={s.input} value={formRepresentante} onChangeText={setFormRepresentante} placeholder="Nombre del gestor" placeholderTextColor={COLORS.textDisabled} />

              <Text style={s.fieldLabel}>Teléfono</Text>
              <TextInput style={s.input} value={formTelefono} onChangeText={setFormTelefono} placeholder="Número telefónico" placeholderTextColor={COLORS.textDisabled} keyboardType="phone-pad" />

              <Text style={s.fieldLabel}>Email</Text>
              <TextInput style={s.input} value={formEmail} onChangeText={setFormEmail} placeholder="correo@empresa.com" placeholderTextColor={COLORS.textDisabled} keyboardType="email-address" autoCapitalize="none" />

              <View style={s.divider} />

              <Text style={s.formSectionTitle}>Mantenimiento</Text>
              <TouchableOpacity style={s.switchRow} onPress={() => setFormMantenimiento(!formMantenimiento)} activeOpacity={0.8}>
                <View>
                  <Text style={s.switchLabel}>Contrato de mantenimiento activo</Text>
                  <Text style={s.switchSublabel}>Habilita el seguimiento de visitas SAT</Text>
                </View>
                <View style={[s.toggle, formMantenimiento && s.toggleOn]}>
                  <View style={[s.toggleKnob, formMantenimiento && s.toggleKnobOn]} />
                </View>
              </TouchableOpacity>

              {formMantenimiento && (
                <View style={s.nestedFields}>
                  <Text style={s.fieldLabel}>Tipo de mantenimiento</Text>
                  <View style={s.chipRow}>
                    {["Anual", "Trimestral", "Semestral"].map((t) => (
                      <TouchableOpacity key={t} style={[s.chip, formTipoMantenimiento === t && s.chipActive]} onPress={() => { setFormTipoMantenimiento(t); setFormRevisiones(t === "Anual" ? "1" : t === "Semestral" ? "2" : "3"); }}>
                        <Text style={[s.chipText, formTipoMantenimiento === t && s.chipTextActive]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={[s.chip, formTipoMantenimiento && !["Anual","Trimestral","Semestral"].includes(formTipoMantenimiento) && s.chipActive]} onPress={() => { setFormTipoMantenimiento("A medida"); setFormRevisiones(""); }}>
                      <Text style={[s.chipText, formTipoMantenimiento && !["Anual","Trimestral","Semestral"].includes(formTipoMantenimiento) && s.chipTextActive]}>A medida</Text>
                    </TouchableOpacity>
                  </View>
                  {formTipoMantenimiento && !["Anual","Trimestral","Semestral"].includes(formTipoMantenimiento) && (
                    <TextInput style={s.input} value={formTipoMantenimiento === "A medida" ? "" : formTipoMantenimiento} onChangeText={setFormTipoMantenimiento} placeholder="Describe el tipo de mantenimiento..." placeholderTextColor={COLORS.textDisabled} />
                  )}
                  <Text style={s.fieldLabel}>Nº revisiones estimadas / año</Text>
                  <TextInput style={s.input} value={formRevisiones} onChangeText={setFormRevisiones} placeholder="2" placeholderTextColor={COLORS.textDisabled} keyboardType="numeric" />
                </View>
              )}

              <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={createCliente} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>CREAR CLIENTE</Text>}
              </TouchableOpacity>
              <View style={{ height: 60 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: ios.spacing.lg, paddingVertical: ios.spacing.md,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.primary,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: ios.radius.md,
  },
  addBtnText: { color: "#fff", fontSize: ios.font.footnote.size, fontWeight: "600" },
  searchWrap: {
    flexDirection: "row", alignItems: "center", marginHorizontal: ios.spacing.lg, marginVertical: ios.spacing.md,
    backgroundColor: COLORS.surface, borderRadius: ios.radius.md, paddingHorizontal: ios.spacing.sm, height: 40,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: ios.font.callout.size, color: COLORS.text, paddingVertical: 0 },
  scrollContainer: { padding: ios.spacing.lg, paddingBottom: 100, gap: ios.spacing.sm },
  emptyState: { alignItems: "center", justifyContent: "center", marginTop: 60, gap: ios.spacing.xs },
  emptyText: { color: COLORS.textDisabled, textAlign: "center", fontSize: 14, paddingHorizontal: 32 },
  card: {
    flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: ios.radius.md,
    padding: ios.spacing.md, borderWidth: 1, borderColor: COLORS.border, gap: ios.spacing.md,
    ...Platform.select({ ios: { shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }, android: { elevation: 1 } }),
  },
  avatarCircle: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primarySoft,
    alignItems: "center", justifyContent: "center",
  },
  cardCenter: { flex: 1, gap: 2 },
  cardName: { fontSize: 16, fontWeight: "700", color: COLORS.text, letterSpacing: -0.2 },
  cardRazon: { fontSize: 12, color: COLORS.textSecondary },
  cardMeta: { flexDirection: "row", gap: ios.spacing.md, marginTop: 4, flexWrap: 'wrap' },
  cardMetaItem: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: 140 },
  cardMetaText: { fontSize: 12, color: COLORS.textSecondary },
  cardRight: { alignItems: 'flex-end', justifyContent: 'space-between', height: '100%', minHeight: 40 },
  mantBadge: {
    flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: COLORS.syncedBg,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  mantBadgeText: { fontSize: 10, fontWeight: "600", color: COLORS.syncedText },

  modalRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  modalCard: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: ios.radius.lg, borderTopRightRadius: ios.radius.lg,
    maxHeight: "92%", padding: ios.spacing.lg,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: ios.spacing.sm },
  modalTitle: { fontSize: 20, fontWeight: "700", color: COLORS.text },
  closeModalBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: COLORS.bg },
  modalForm: { marginTop: ios.spacing.xs },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary, marginTop: ios.spacing.sm, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: {
    height: 42, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: ios.radius.sm, paddingHorizontal: ios.spacing.sm, fontSize: 14, color: COLORS.text,
  },
  rowFields: { flexDirection: "row", gap: ios.spacing.sm },
  chipRow: { flexDirection: "row", gap: ios.spacing.sm, marginVertical: 2 },
  chip: { flex: 1, height: 38, borderRadius: ios.radius.sm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary },
  chipTextActive: { color: "#fff" },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: ios.spacing.md },
  formSectionTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text, marginBottom: ios.spacing.xs },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: ios.spacing.xs },
  switchLabel: { fontSize: 14, fontWeight: "500", color: COLORS.text },
  switchSublabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: COLORS.border, justifyContent: "center", paddingHorizontal: 2 },
  toggleOn: { backgroundColor: COLORS.primary },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  toggleKnobOn: { alignSelf: "flex-end" },
  nestedFields: { backgroundColor: COLORS.bg, padding: ios.spacing.sm, borderRadius: ios.radius.sm, marginTop: ios.spacing.sm, gap: 2 },
  saveBtn: { height: 46, borderRadius: ios.radius.sm, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", marginTop: ios.spacing.xl },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700", letterSpacing: 0.5 },
});
