/**
 * CRM SAT — pantalla principal
 *
 * Tabs:
 *   - "Avisos recibidos" → lista de incidencias creadas desde el formulario
 *     público. Permite editar todos los campos, añadir comentarios SAT y
 *     marcar como resuelta / pendiente.
 *   - "Resueltas" → mismo listado filtrado por status.
 *
 * Header-acción:
 *   - Botón "Copiar URL cliente" → copia el enlace público al portapapeles.
 */

import { useCallback, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView,
  TextInput, Modal, Platform, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { api, clearToken, COLORS } from "../src/api";
import ResponsiveLayout from "../src/ResponsiveLayout";
import { useBreakpoint } from "../src/useBreakpoint";
import NotificationsBell from "../src/NotificationsBell";

type Incident = {
  id: string;
  cliente: string;
  direccion: string;
  telefono: string;
  observaciones: string;
  comentarios_sat: string;
  status: "pendiente" | "resuelta";
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
};

/** Cross-platform confirm (web uses window.confirm; native uses Alert). */
function confirmAsync(title: string, message: string, okText = "Eliminar"): Promise<boolean> {
  if (Platform.OS === "web") {
    // @ts-ignore window
    return Promise.resolve(typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
      { text: okText, style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

/** Produce an absolute URL to the public SAT form, based on the current host. */
function publicFormUrl(): string {
  if (typeof window !== "undefined" && window.location) {
    return `${window.location.origin}/aviso-sat`;
  }
  // Fallback — rarely used on native since the SAT app is primarily web.
  return "/aviso-sat";
}

export default function SATScreen() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const params = useLocalSearchParams<{ openIncident?: string }>();

  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pendiente" | "resuelta">("pendiente");
  const [items, setItems] = useState<Incident[]>([]);
  const [openItem, setOpenItem] = useState<Incident | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.satList();
      setItems(list);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      try {
        const u = await api.me();
        if (!alive) return;
        setMe(u);
        await load();
      } catch (e: any) {
        if (/401|Invalid|expired/i.test(e?.message || "")) {
          await clearToken();
          router.replace("/login");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [load]));

  // Auto-open incident if ?openIncident=<id> (used from notifications).
  useFocusEffect(useCallback(() => {
    if (!params.openIncident) return;
    const id = String(params.openIncident);
    const match = items.find((i) => i.id === id);
    if (match) setOpenItem(match);
    // @ts-ignore
    router.setParams?.({ openIncident: undefined });
  }, [params.openIncident, items]));

  const isAdmin = me?.role === "admin";
  const logout = async () => { await clearToken(); router.replace("/login"); };

  const copyLink = async () => {
    const url = publicFormUrl();
    try {
      await Clipboard.setStringAsync(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback for web older browsers
      if (Platform.OS === "web") {
        // @ts-ignore
        const ta = document.createElement("textarea");
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }
    }
  };

  const pendingCount = items.filter((i) => i.status === "pendiente").length;
  const resolvedCount = items.filter((i) => i.status === "resuelta").length;
  const visible = items.filter((i) => i.status === tab);

  return (
    <ResponsiveLayout active="sat" isAdmin={isAdmin} userName={me?.name} onLogout={logout}>
      <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
        {/* Header */}
        <View style={s.header}>
          {!isWide && (
            <TouchableOpacity style={s.iconBtn} onPress={() => router.replace("/home")}>
              <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.title}>CRM SAT</Text>
            <Text style={s.subtitle}>Gestión de avisos técnicos</Text>
          </View>
          <TouchableOpacity
            testID="btn-copy-sat-url"
            style={[s.copyBtn, copied && { backgroundColor: "#10B981", borderColor: "#10B981" }]}
            onPress={copyLink}
          >
            <Ionicons
              name={copied ? "checkmark-circle" : "copy-outline"}
              size={16}
              color={copied ? "#fff" : COLORS.primary}
            />
            <Text style={[s.copyBtnText, copied && { color: "#fff" }]} numberOfLines={1}>
              {copied ? "¡Copiada!" : "Copiar URL cliente"}
            </Text>
          </TouchableOpacity>
          <NotificationsBell style={{ marginLeft: 8 }} />
        </View>

        {/* Tabs */}
        <View style={s.tabsRow}>
          <TabPill
            label="Avisos recibidos"
            count={pendingCount}
            active={tab === "pendiente"}
            onPress={() => setTab("pendiente")}
            testID="tab-pendientes"
          />
          <TabPill
            label="Resueltas"
            count={resolvedCount}
            active={tab === "resuelta"}
            onPress={() => setTab("resuelta")}
            testID="tab-resueltas"
          />
        </View>

        {loading ? (
          <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : visible.length === 0 ? (
          <View style={s.center}>
            <Ionicons
              name={tab === "pendiente" ? "mail-unread-outline" : "checkmark-done-circle-outline"}
              size={56}
              color={COLORS.textDisabled}
            />
            <Text style={s.emptyTitle}>
              {tab === "pendiente" ? "No hay avisos pendientes" : "Aún no hay avisos resueltos"}
            </Text>
            <Text style={s.emptyMsg}>
              {tab === "pendiente"
                ? "Copia la URL del cliente y compártela para que empiecen a llegar avisos."
                : "Cuando marques una incidencia como resuelta aparecerá aquí."}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80, gap: 12 }}>
            {visible.map((it) => (
              <IncidentCard
                key={it.id}
                item={it}
                onPress={() => setOpenItem(it)}
              />
            ))}
          </ScrollView>
        )}
      </SafeAreaView>

      {openItem && (
        <IncidentModal
          item={openItem}
          isAdmin={isAdmin}
          onClose={() => setOpenItem(null)}
          onChanged={() => { setOpenItem(null); load(); }}
        />
      )}
    </ResponsiveLayout>
  );
}

function TabPill({
  label, count, active, onPress, testID,
}: { label: string; count: number; active: boolean; onPress: () => void; testID?: string }) {
  return (
    <TouchableOpacity
      testID={testID}
      style={[s.tabPill, active && s.tabPillOn]}
      onPress={onPress}
    >
      <Text style={[s.tabPillText, active && s.tabPillTextOn]}>{label}</Text>
      <View style={[s.tabCountBadge, active && s.tabCountBadgeOn]}>
        <Text style={[s.tabCountText, active && s.tabCountTextOn]}>{count}</Text>
      </View>
    </TouchableOpacity>
  );
}

function IncidentCard({ item, onPress }: { item: Incident; onPress: () => void }) {
  const d = new Date(item.created_at);
  const dateStr = isNaN(d.getTime())
    ? ""
    : d.toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const pending = item.status === "pendiente";
  return (
    <TouchableOpacity
      testID={`sat-item-${item.id}`}
      activeOpacity={0.85}
      style={[s.card, pending && { borderLeftColor: "#F59E0B", borderLeftWidth: 4 }]}
      onPress={onPress}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={[s.statusDot, { backgroundColor: pending ? "#F59E0B" : "#10B981" }]} />
        <Text style={s.cardClient} numberOfLines={1}>{item.cliente || "— sin cliente —"}</Text>
        <Text style={s.cardDate}>{dateStr}</Text>
      </View>
      {(item.direccion || item.telefono) ? (
        <Text style={s.cardMeta} numberOfLines={1}>
          {item.direccion && <>📍 {item.direccion}</>}
          {item.direccion && item.telefono ? "   " : ""}
          {item.telefono && <>📞 {item.telefono}</>}
        </Text>
      ) : null}
      <Text style={s.cardObs} numberOfLines={2}>{item.observaciones}</Text>
      {item.comentarios_sat ? (
        <Text style={s.cardSatNote} numberOfLines={1}>
          <Ionicons name="chatbubble-ellipses" size={11} color={COLORS.primary} /> {item.comentarios_sat}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

function IncidentModal({
  item, isAdmin, onClose, onChanged,
}: {
  item: Incident; isAdmin: boolean;
  onClose: () => void; onChanged: () => void;
}) {
  const [cliente, setCliente] = useState(item.cliente);
  const [direccion, setDireccion] = useState(item.direccion);
  const [telefono, setTelefono] = useState(item.telefono);
  const [observaciones, setObservaciones] = useState(item.observaciones);
  const [comentarios, setComentarios] = useState(item.comentarios_sat);
  const [saving, setSaving] = useState(false);

  const saveWithStatus = async (status: "pendiente" | "resuelta") => {
    setSaving(true);
    try {
      await api.satUpdate(item.id, {
        cliente, direccion, telefono, observaciones,
        comentarios_sat: comentarios,
        status,
      });
      onChanged();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    const ok = await confirmAsync("Eliminar incidencia", "¿Eliminar esta incidencia? Esta acción no se puede deshacer.");
    if (!ok) return;
    setSaving(true);
    try {
      await api.satDelete(item.id);
      onChanged();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "No se pudo eliminar");
    } finally {
      setSaving(false);
    }
  };

  const createdStr = (() => {
    const d = new Date(item.created_at);
    return isNaN(d.getTime())
      ? ""
      : d.toLocaleString("es-ES", { dateStyle: "full", timeStyle: "short" } as any);
  })();

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetRoot}>
        <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle}>Incidencia SAT</Text>
              <Text style={s.modalSub}>{createdStr}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={14} style={s.closeBtn}>
              <Ionicons name="close" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }} keyboardShouldPersistTaps="handled">
            <Field label="Cliente">
              <TextInput value={cliente} onChangeText={setCliente} style={s.input} placeholderTextColor={COLORS.textDisabled} />
            </Field>
            <Field label="Dirección">
              <TextInput value={direccion} onChangeText={setDireccion} style={s.input} placeholderTextColor={COLORS.textDisabled} />
            </Field>
            <Field label="Teléfono">
              <TextInput value={telefono} onChangeText={setTelefono} style={s.input} keyboardType="phone-pad" placeholderTextColor={COLORS.textDisabled} />
            </Field>
            <Field label="Observaciones del cliente">
              <TextInput
                value={observaciones}
                onChangeText={setObservaciones}
                multiline numberOfLines={4}
                style={[s.input, s.textarea]}
                placeholderTextColor={COLORS.textDisabled}
              />
            </Field>
            <Field label="Comentarios SAT (internos)">
              <TextInput
                testID="sat-comments"
                value={comentarios}
                onChangeText={setComentarios}
                multiline numberOfLines={4}
                style={[s.input, s.textarea, { backgroundColor: COLORS.primarySoft }]}
                placeholder="Añade aquí tus comentarios, diagnóstico, piezas necesarias..."
                placeholderTextColor={COLORS.textDisabled}
              />
            </Field>

            <View style={s.statusRow}>
              <Text style={s.statusLabel}>Estado actual:</Text>
              <View style={[s.statusChip, {
                backgroundColor: item.status === "pendiente" ? "#FEF3C7" : "#D1FAE5",
                borderColor: item.status === "pendiente" ? "#F59E0B" : "#10B981",
              }]}>
                <Ionicons
                  name={item.status === "pendiente" ? "time" : "checkmark-done"}
                  size={13}
                  color={item.status === "pendiente" ? "#B45309" : "#065F46"}
                />
                <Text style={{
                  color: item.status === "pendiente" ? "#B45309" : "#065F46",
                  fontWeight: "900", fontSize: 12,
                }}>
                  {item.status === "pendiente" ? "Pendiente" : "Resuelta"}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Footer actions */}
          <View style={s.modalFooter}>
            {isAdmin && (
              <TouchableOpacity
                testID="sat-delete"
                style={s.dangerBtn}
                onPress={del}
                disabled={saving}
              >
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              testID="sat-pending"
              style={[s.pendingBtn, saving && { opacity: 0.6 }]}
              onPress={() => saveWithStatus("pendiente")}
              disabled={saving}
            >
              <Ionicons name="time-outline" size={16} color="#B45309" />
              <Text style={s.pendingBtnText}>Incidencia pendiente</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="sat-resolved"
              style={[s.resolvedBtn, saving && { opacity: 0.6 }]}
              onPress={() => saveWithStatus("resuelta")}
              disabled={saving}
            >
              <Ionicons name="checkmark-done" size={16} color="#fff" />
              <Text style={s.resolvedBtnText}>Incidencia resuelta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <View>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: 8 },

  header: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: COLORS.border,
  },
  title: { fontSize: 20, fontWeight: "900", color: COLORS.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 11.5, color: COLORS.textSecondary, fontWeight: "700", marginTop: 2 },

  copyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, height: 38, borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5, borderColor: COLORS.primary,
    maxWidth: 200,
  },
  copyBtnText: { color: COLORS.primary, fontWeight: "900", fontSize: 12.5 },

  tabsRow: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tabPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, height: 38, borderRadius: 19,
    backgroundColor: COLORS.bg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  tabPillOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabPillText: { color: COLORS.text, fontWeight: "800", fontSize: 13 },
  tabPillTextOn: { color: "#fff" },
  tabCountBadge: {
    minWidth: 22, height: 18, borderRadius: 9, paddingHorizontal: 5,
    backgroundColor: COLORS.border,
    alignItems: "center", justifyContent: "center",
  },
  tabCountBadgeOn: { backgroundColor: "rgba(255,255,255,0.3)" },
  tabCountText: { fontSize: 11, fontWeight: "900", color: COLORS.text },
  tabCountTextOn: { color: "#fff" },

  // Empty state
  emptyTitle: { fontSize: 17, fontWeight: "900", color: COLORS.text, marginTop: 4 },
  emptyMsg: {
    fontSize: 13, color: COLORS.textSecondary, textAlign: "center", maxWidth: 320,
    fontWeight: "600", lineHeight: 18,
  },

  // Card
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 14,
    ...Platform.select<any>({
      web: { boxShadow: "0 1px 4px rgba(15,23,42,0.06)" },
      default: { shadowColor: "#0F172A", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
    }),
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  cardClient: { flex: 1, fontSize: 15, fontWeight: "900", color: COLORS.text, letterSpacing: -0.2 },
  cardDate: { fontSize: 11, color: COLORS.textSecondary, fontWeight: "700" },
  cardMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 6, fontWeight: "600" },
  cardObs: { fontSize: 13, color: COLORS.text, marginTop: 8, lineHeight: 19 },
  cardSatNote: { fontSize: 12, color: COLORS.primary, marginTop: 8, fontWeight: "700" },

  // Modal
  sheetRoot: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    maxHeight: "92%",
    ...Platform.select<any>({
      web: { boxShadow: "0 -10px 40px rgba(15,23,42,0.2)" },
      default: { shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: -8 } },
    }),
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center",
    padding: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 19, fontWeight: "900", color: COLORS.text, letterSpacing: -0.4 },
  modalSub: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "600", marginTop: 2 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
  },

  fieldLabel: { fontSize: 11.5, fontWeight: "900", color: COLORS.text, marginBottom: 5, letterSpacing: 0.3 },
  input: {
    borderWidth: 1.5, borderColor: COLORS.borderInput,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: COLORS.text, backgroundColor: COLORS.bg,
  },
  textarea: { minHeight: 92, textAlignVertical: "top" as any, paddingTop: 10 },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  statusLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "800" },
  statusChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, height: 26, borderRadius: 13,
    borderWidth: 1,
  },

  modalFooter: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 14, borderTopWidth: 1, borderTopColor: COLORS.border,
    flexWrap: "wrap",
  },
  dangerBtn: {
    width: 42, height: 42, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FEE2E2",
  },
  pendingBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    height: 42, borderRadius: 10,
    backgroundColor: "#FEF3C7", borderWidth: 1.5, borderColor: "#F59E0B",
    paddingHorizontal: 10, minWidth: 140,
  },
  pendingBtnText: { color: "#B45309", fontWeight: "900", fontSize: 13 },
  resolvedBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    height: 42, borderRadius: 10, backgroundColor: "#10B981",
    paddingHorizontal: 10, minWidth: 140,
  },
  resolvedBtnText: { color: "#fff", fontWeight: "900", fontSize: 13 },
});
