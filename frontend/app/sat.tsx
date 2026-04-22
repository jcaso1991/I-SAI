/**
 * CRM SAT — pantalla principal con dos vistas conmutables:
 *   - Incidencias (pendientes / resueltas)
 *   - Clientes (catálogo)
 *
 * El selector superior (dropdown) alterna entre las dos vistas.
 * Cada incidencia puede enlazar a un cliente del catálogo (client_id).
 * En la vista de clientes, cada tarjeta tiene:
 *   - botón "Nueva incidencia" → pre-rellena el modal de creación.
 *   - botón editar / eliminar (admin).
 *   - botón de subir Excel en el header (admin) para reimportar el catálogo.
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
import * as DocumentPicker from "expo-document-picker";
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
  client_id?: string | null;
};

type Client = {
  id: string;
  cliente: string;
  direccion: string;
  contacto: string;
  telefono: string;
};

function confirmAsync(title: string, message: string, okText = "Eliminar"): Promise<boolean> {
  if (Platform.OS === "web") {
    // @ts-ignore
    return Promise.resolve(typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
      { text: okText, style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

function publicFormUrl(): string {
  if (typeof window !== "undefined" && window.location) {
    return `${window.location.origin}/aviso-sat`;
  }
  return "/aviso-sat";
}

export default function SATScreen() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const params = useLocalSearchParams<{ openIncident?: string; tab?: string }>();

  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"incidencias" | "clientes">(
    params.tab === "clientes" ? "clientes" : "incidencias"
  );
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [tab, setTab] = useState<"pendiente" | "resuelta">("pendiente");
  const [items, setItems] = useState<Incident[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [openItem, setOpenItem] = useState<Incident | null>(null);
  const [creatingIncident, setCreatingIncident] = useState<Partial<Incident> | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [its, cls] = await Promise.all([api.satList(), api.satClientList()]);
      setItems(its); setClients(cls);
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
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [load]));

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
    try { await Clipboard.setStringAsync(url); }
    catch {
      if (Platform.OS === "web") {
        // @ts-ignore
        const ta = document.createElement("textarea"); ta.value = url;
        // @ts-ignore
        document.body.appendChild(ta); ta.select();
        // @ts-ignore
        document.execCommand("copy"); document.body.removeChild(ta);
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const pickAndImportExcel = async () => {
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: ["application/vnd.ms-excel.sheet.macroenabled.12",
               "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
               "application/vnd.ms-excel", ".xlsm", ".xlsx"],
        copyToCacheDirectory: true,
      });
      if (pick.canceled || !pick.assets?.[0]) return;
      const asset = pick.assets[0];
      const replace = await confirmAsync(
        "Importar clientes",
        "¿Reemplazar la lista completa de clientes?\n\nSí = borrar todos y cargar nuevos.\nNo = añadir nuevos y actualizar existentes por nombre.",
        "Reemplazar"
      );
      setImporting(true);
      // Web: we have a File object inside asset.file
      const file: any = (asset as any).file
        || { uri: asset.uri, name: asset.name, mimeType: asset.mimeType };
      const res = await api.satClientImport(file, replace);
      if (Platform.OS === "web") {
        // @ts-ignore
        window.alert(`Importación completada:\n• ${res.created} creados\n• ${res.updated} actualizados\n• ${res.skipped} omitidos (sin cliente)`);
      } else {
        Alert.alert("Importación completada",
          `Creados: ${res.created}\nActualizados: ${res.updated}\nOmitidos: ${res.skipped}`);
      }
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "No se pudo importar el Excel");
    } finally { setImporting(false); }
  };

  const pendingCount = items.filter((i) => i.status === "pendiente").length;
  const resolvedCount = items.filter((i) => i.status === "resuelta").length;
  const visibleIncidents = items.filter((i) => i.status === tab);
  const visibleClients = clients.filter((c) => {
    if (!clientSearch.trim()) return true;
    const q = clientSearch.trim().toLowerCase();
    return (c.cliente?.toLowerCase().includes(q)
         || c.direccion?.toLowerCase().includes(q)
         || c.contacto?.toLowerCase().includes(q)
         || c.telefono?.includes(q));
  });

  const handleNewIncidentFromClient = (c: Client) => {
    setCreatingIncident({
      cliente: c.cliente,
      direccion: c.direccion,
      telefono: c.telefono,
      observaciones: "",
      comentarios_sat: "",
      status: "pendiente",
      client_id: c.id,
    });
    setView("incidencias");
  };

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
            {/* View selector dropdown */}
            <TouchableOpacity
              testID="btn-view-selector"
              style={s.viewSelector}
              onPress={() => setShowViewMenu((v) => !v)}
            >
              <Ionicons
                name={view === "incidencias" ? "alert-circle" : "people"}
                size={14}
                color={COLORS.primary}
              />
              <Text style={s.viewSelectorText}>
                {view === "incidencias" ? "Incidencias" : "Clientes"}
              </Text>
              <Ionicons name={showViewMenu ? "chevron-up" : "chevron-down"} size={14} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          {view === "incidencias" && (
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
                {copied ? "¡Copiada!" : "URL cliente"}
              </Text>
            </TouchableOpacity>
          )}
          {view === "clientes" && isAdmin && (
            <TouchableOpacity
              testID="btn-import-excel"
              style={[s.copyBtn, importing && { opacity: 0.6 }]}
              onPress={pickAndImportExcel}
              disabled={importing}
            >
              {importing ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Ionicons name="cloud-upload-outline" size={16} color={COLORS.primary} />
              )}
              <Text style={s.copyBtnText} numberOfLines={1}>
                {importing ? "Importando..." : "Cargar Excel"}
              </Text>
            </TouchableOpacity>
          )}
          <NotificationsBell style={{ marginLeft: 8 }} />
        </View>

        {/* View dropdown menu */}
        {showViewMenu && (
          <>
            <TouchableOpacity
              activeOpacity={1}
              style={s.dropdownBackdrop}
              onPress={() => setShowViewMenu(false)}
            />
            <View style={[s.viewMenu, !isWide && { left: 16 }]}>
              {(["incidencias", "clientes"] as const).map((v) => (
                <TouchableOpacity
                  key={v}
                  testID={`view-menu-${v}`}
                  style={[s.viewMenuItem, view === v && s.viewMenuItemOn]}
                  onPress={() => { setView(v); setShowViewMenu(false); }}
                >
                  <Ionicons
                    name={v === "incidencias" ? "alert-circle-outline" : "people-outline"}
                    size={18}
                    color={view === v ? COLORS.primary : COLORS.text}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.viewMenuTitle, view === v && { color: COLORS.primary }]}>
                      {v === "incidencias" ? "Incidencias" : "Clientes"}
                    </Text>
                    <Text style={s.viewMenuSub}>
                      {v === "incidencias"
                        ? `${pendingCount} pendientes · ${resolvedCount} resueltas`
                        : `${clients.length} clientes en el catálogo`}
                    </Text>
                  </View>
                  {view === v && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Incidencias: tabs + list */}
        {view === "incidencias" && (
          <>
            <View style={s.tabsRow}>
              <TabPill
                label="Avisos recibidos" count={pendingCount}
                active={tab === "pendiente"} onPress={() => setTab("pendiente")}
                testID="tab-pendientes"
              />
              <TabPill
                label="Resueltas" count={resolvedCount}
                active={tab === "resuelta"} onPress={() => setTab("resuelta")}
                testID="tab-resueltas"
              />
              <View style={{ flex: 1 }} />
              {isAdmin && (
                <TouchableOpacity
                  testID="btn-new-incident"
                  style={s.addBtn}
                  onPress={() => setCreatingIncident({
                    cliente: "", direccion: "", telefono: "", observaciones: "",
                    comentarios_sat: "", status: "pendiente",
                  })}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={s.addBtnText}>Nueva</Text>
                </TouchableOpacity>
              )}
            </View>
            {loading ? (
              <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
            ) : visibleIncidents.length === 0 ? (
              <View style={s.center}>
                <Ionicons
                  name={tab === "pendiente" ? "mail-unread-outline" : "checkmark-done-circle-outline"}
                  size={56} color={COLORS.textDisabled}
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
                {visibleIncidents.map((it) => (
                  <IncidentCard
                    key={it.id}
                    item={it}
                    clientName={clients.find((c) => c.id === it.client_id)?.cliente}
                    onPress={() => setOpenItem(it)}
                  />
                ))}
              </ScrollView>
            )}
          </>
        )}

        {/* Clientes: search + list */}
        {view === "clientes" && (
          <>
            <View style={s.clientHeader}>
              <View style={s.searchWrap}>
                <Ionicons name="search" size={16} color={COLORS.textSecondary} />
                <TextInput
                  testID="client-search"
                  style={s.searchInput}
                  value={clientSearch}
                  onChangeText={setClientSearch}
                  placeholder="Buscar cliente, dirección, contacto..."
                  placeholderTextColor={COLORS.textDisabled}
                />
                {clientSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setClientSearch("")} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={COLORS.textDisabled} />
                  </TouchableOpacity>
                )}
              </View>
              {isAdmin && (
                <TouchableOpacity
                  testID="btn-new-client"
                  style={s.addBtn}
                  onPress={() => setShowNewClient(true)}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={s.addBtnText}>Nuevo</Text>
                </TouchableOpacity>
              )}
            </View>

            {loading ? (
              <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
            ) : visibleClients.length === 0 ? (
              <View style={s.center}>
                <Ionicons name="people-outline" size={56} color={COLORS.textDisabled} />
                <Text style={s.emptyTitle}>
                  {clients.length === 0 ? "Sin clientes en el catálogo" : "Sin resultados"}
                </Text>
                {isAdmin && clients.length === 0 && (
                  <Text style={s.emptyMsg}>
                    Carga un Excel con la lista de clientes desde el botón superior.
                  </Text>
                )}
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80, gap: 10 }}>
                {visibleClients.map((c) => (
                  <ClientCard
                    key={c.id}
                    client={c}
                    isAdmin={isAdmin}
                    onEdit={() => setEditingClient(c)}
                    onNewIncident={() => handleNewIncidentFromClient(c)}
                  />
                ))}
              </ScrollView>
            )}
          </>
        )}
      </SafeAreaView>

      {openItem && (
        <IncidentModal
          item={openItem}
          clients={clients}
          isAdmin={isAdmin}
          onClose={() => setOpenItem(null)}
          onChanged={() => { setOpenItem(null); load(); }}
        />
      )}
      {creatingIncident && (
        <IncidentCreateModal
          initial={creatingIncident}
          clients={clients}
          onClose={() => setCreatingIncident(null)}
          onCreated={() => { setCreatingIncident(null); setTab("pendiente"); load(); }}
        />
      )}
      {editingClient && (
        <ClientModal
          client={editingClient}
          onClose={() => setEditingClient(null)}
          onSaved={() => { setEditingClient(null); load(); }}
        />
      )}
      {showNewClient && (
        <ClientModal
          client={null}
          onClose={() => setShowNewClient(false)}
          onSaved={() => { setShowNewClient(false); load(); }}
        />
      )}
    </ResponsiveLayout>
  );
}

/* ============================ helpers UI ============================ */

function TabPill({ label, count, active, onPress, testID }:
  { label: string; count: number; active: boolean; onPress: () => void; testID?: string }) {
  return (
    <TouchableOpacity testID={testID} style={[s.tabPill, active && s.tabPillOn]} onPress={onPress}>
      <Text style={[s.tabPillText, active && s.tabPillTextOn]}>{label}</Text>
      <View style={[s.tabCountBadge, active && s.tabCountBadgeOn]}>
        <Text style={[s.tabCountText, active && s.tabCountTextOn]}>{count}</Text>
      </View>
    </TouchableOpacity>
  );
}

function IncidentCard({ item, clientName, onPress }:
  { item: Incident; clientName?: string; onPress: () => void }) {
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
      {clientName && clientName !== item.cliente && (
        <Text style={s.linkedClient} numberOfLines={1}>
          <Ionicons name="link" size={11} color={COLORS.primary} /> {clientName}
        </Text>
      )}
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

function ClientCard({ client, isAdmin, onEdit, onNewIncident }:
  { client: Client; isAdmin: boolean; onEdit: () => void; onNewIncident: () => void }) {
  return (
    <View testID={`client-${client.id}`} style={s.clientCard}>
      <View style={{ flex: 1 }}>
        <Text style={s.clientName} numberOfLines={1}>{client.cliente}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
          {!!client.direccion && (
            <View style={s.clientChip}>
              <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} />
              <Text style={s.clientChipText}>{client.direccion}</Text>
            </View>
          )}
          {!!client.contacto && (
            <View style={s.clientChip}>
              <Ionicons name="person-outline" size={12} color={COLORS.textSecondary} />
              <Text style={s.clientChipText}>{client.contacto}</Text>
            </View>
          )}
          {!!client.telefono && (
            <View style={s.clientChip}>
              <Ionicons name="call-outline" size={12} color={COLORS.textSecondary} />
              <Text style={s.clientChipText}>{client.telefono}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <TouchableOpacity
          testID={`client-new-incident-${client.id}`}
          style={s.clientActionPrimary}
          onPress={onNewIncident}
        >
          <Ionicons name="add-circle-outline" size={16} color="#fff" />
          <Text style={s.clientActionPrimaryText}>Incidencia</Text>
        </TouchableOpacity>
        {isAdmin && (
          <TouchableOpacity
            testID={`client-edit-${client.id}`}
            style={s.clientActionGhost}
            onPress={onEdit}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.text} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/* ============================ modals ============================ */

function Field({ label, children }: { label: string; children: any }) {
  return (<View><Text style={s.fieldLabel}>{label}</Text>{children}</View>);
}

function ClientPicker({ value, onChange, clients }:
  { value: string | null | undefined; onChange: (id: string | null, name: string) => void; clients: Client[] }) {
  const [open, setOpen] = useState(false);
  const selected = value ? clients.find((c) => c.id === value) : null;
  return (
    <View>
      <TouchableOpacity
        testID="btn-pick-client"
        style={s.pickerBtn}
        onPress={() => setOpen((v) => !v)}
      >
        <Ionicons name="business-outline" size={18} color={COLORS.primary} />
        <Text style={{ flex: 1, color: selected ? COLORS.text : COLORS.primary, fontWeight: "700" }} numberOfLines={1}>
          {selected ? selected.cliente : "Seleccionar cliente del catálogo"}
        </Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={COLORS.primary} />
      </TouchableOpacity>
      {open && (
        <View style={s.pickerList}>
          <TouchableOpacity
            style={[s.pickerItem, !value && { backgroundColor: COLORS.highlightBg }]}
            onPress={() => { onChange(null, ""); setOpen(false); }}
          >
            <Ionicons name="close-circle-outline" size={16} color={COLORS.textSecondary} />
            <Text style={s.pickerItemText}>— Sin cliente vinculado —</Text>
          </TouchableOpacity>
          {clients.map((c) => (
            <TouchableOpacity
              key={c.id}
              testID={`pick-client-${c.id}`}
              style={[s.pickerItem, value === c.id && { backgroundColor: COLORS.highlightBg }]}
              onPress={() => { onChange(c.id, c.cliente); setOpen(false); }}
            >
              <Ionicons name="business" size={14} color={value === c.id ? COLORS.primary : COLORS.textSecondary} />
              <Text style={s.pickerItemText} numberOfLines={1}>{c.cliente}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function IncidentModal({ item, clients, isAdmin, onClose, onChanged }: {
  item: Incident; clients: Client[]; isAdmin: boolean;
  onClose: () => void; onChanged: () => void;
}) {
  const [cliente, setCliente] = useState(item.cliente);
  const [direccion, setDireccion] = useState(item.direccion);
  const [telefono, setTelefono] = useState(item.telefono);
  const [observaciones, setObservaciones] = useState(item.observaciones);
  const [comentarios, setComentarios] = useState(item.comentarios_sat);
  const [clientId, setClientId] = useState<string | null>(item.client_id || null);
  const [saving, setSaving] = useState(false);

  const saveWithStatus = async (status: "pendiente" | "resuelta") => {
    setSaving(true);
    try {
      await api.satUpdate(item.id, {
        cliente, direccion, telefono, observaciones,
        comentarios_sat: comentarios,
        client_id: clientId,
        status,
      });
      onChanged();
    } catch (e: any) { Alert.alert("Error", e?.message || "No se pudo guardar"); }
    finally { setSaving(false); }
  };

  const del = async () => {
    const ok = await confirmAsync("Eliminar incidencia", "¿Eliminar esta incidencia?");
    if (!ok) return;
    setSaving(true);
    try { await api.satDelete(item.id); onChanged(); }
    catch (e: any) { Alert.alert("Error", e?.message || "No se pudo eliminar"); }
    finally { setSaving(false); }
  };

  const createdStr = (() => {
    const d = new Date(item.created_at);
    return isNaN(d.getTime()) ? "" : d.toLocaleString("es-ES", { dateStyle: "full", timeStyle: "short" } as any);
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
            <Field label="Cliente del catálogo">
              <ClientPicker
                value={clientId}
                onChange={(id, name) => {
                  setClientId(id);
                  if (id) {
                    const c = clients.find((x) => x.id === id);
                    if (c) { setCliente(c.cliente); setDireccion(c.direccion); setTelefono(c.telefono); }
                  }
                }}
                clients={clients}
              />
            </Field>
            <Field label="Cliente"><TextInput value={cliente} onChangeText={setCliente} style={s.input} placeholderTextColor={COLORS.textDisabled} /></Field>
            <Field label="Dirección"><TextInput value={direccion} onChangeText={setDireccion} style={s.input} placeholderTextColor={COLORS.textDisabled} /></Field>
            <Field label="Teléfono"><TextInput value={telefono} onChangeText={setTelefono} style={s.input} keyboardType="phone-pad" placeholderTextColor={COLORS.textDisabled} /></Field>
            <Field label="Observaciones del cliente">
              <TextInput value={observaciones} onChangeText={setObservaciones} multiline numberOfLines={4} style={[s.input, s.textarea]} placeholderTextColor={COLORS.textDisabled} />
            </Field>
            <Field label="Comentarios SAT (internos)">
              <TextInput
                value={comentarios} onChangeText={setComentarios} multiline numberOfLines={4}
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
                <Ionicons name={item.status === "pendiente" ? "time" : "checkmark-done"} size={13}
                  color={item.status === "pendiente" ? "#B45309" : "#065F46"} />
                <Text style={{ color: item.status === "pendiente" ? "#B45309" : "#065F46", fontWeight: "900", fontSize: 12 }}>
                  {item.status === "pendiente" ? "Pendiente" : "Resuelta"}
                </Text>
              </View>
            </View>
          </ScrollView>
          <View style={s.modalFooter}>
            {isAdmin && (
              <TouchableOpacity testID="sat-delete" style={s.dangerBtn} onPress={del} disabled={saving}>
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </TouchableOpacity>
            )}
            <TouchableOpacity testID="sat-pending" style={[s.pendingBtn, saving && { opacity: 0.6 }]} onPress={() => saveWithStatus("pendiente")} disabled={saving}>
              <Ionicons name="time-outline" size={16} color="#B45309" />
              <Text style={s.pendingBtnText}>Pendiente</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="sat-resolved" style={[s.resolvedBtn, saving && { opacity: 0.6 }]} onPress={() => saveWithStatus("resuelta")} disabled={saving}>
              <Ionicons name="checkmark-done" size={16} color="#fff" />
              <Text style={s.resolvedBtnText}>Resuelta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function IncidentCreateModal({ initial, clients, onClose, onCreated }: {
  initial: Partial<Incident>; clients: Client[];
  onClose: () => void; onCreated: () => void;
}) {
  const [cliente, setCliente] = useState(initial.cliente || "");
  const [direccion, setDireccion] = useState(initial.direccion || "");
  const [telefono, setTelefono] = useState(initial.telefono || "");
  const [observaciones, setObservaciones] = useState(initial.observaciones || "");
  const [comentarios, setComentarios] = useState(initial.comentarios_sat || "");
  const [clientId, setClientId] = useState<string | null>(initial.client_id || null);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!cliente.trim() || !observaciones.trim()) {
      Alert.alert("Error", "Cliente y observaciones son obligatorios"); return;
    }
    setSaving(true);
    try {
      const { id } = await api.satCreatePublic({ cliente, direccion, telefono, observaciones });
      if (clientId || comentarios.trim()) {
        await api.satUpdate(id, { client_id: clientId, comentarios_sat: comentarios });
      }
      onCreated();
    } catch (e: any) { Alert.alert("Error", e?.message || "No se pudo crear"); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetRoot}>
        <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle}>Nueva incidencia</Text>
              <Text style={s.modalSub}>Crea un aviso SAT manualmente</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={14} style={s.closeBtn}>
              <Ionicons name="close" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }} keyboardShouldPersistTaps="handled">
            <Field label="Cliente del catálogo (opcional)">
              <ClientPicker
                value={clientId}
                onChange={(id) => {
                  setClientId(id);
                  if (id) {
                    const c = clients.find((x) => x.id === id);
                    if (c) { setCliente(c.cliente); setDireccion(c.direccion); setTelefono(c.telefono); }
                  }
                }}
                clients={clients}
              />
            </Field>
            <Field label="Cliente *"><TextInput value={cliente} onChangeText={setCliente} style={s.input} placeholderTextColor={COLORS.textDisabled} placeholder="Nombre o razón social" /></Field>
            <Field label="Dirección"><TextInput value={direccion} onChangeText={setDireccion} style={s.input} placeholderTextColor={COLORS.textDisabled} /></Field>
            <Field label="Teléfono"><TextInput value={telefono} onChangeText={setTelefono} style={s.input} keyboardType="phone-pad" placeholderTextColor={COLORS.textDisabled} /></Field>
            <Field label="Observaciones *">
              <TextInput value={observaciones} onChangeText={setObservaciones} multiline numberOfLines={4} style={[s.input, s.textarea]} placeholderTextColor={COLORS.textDisabled} placeholder="Descripción de la incidencia" />
            </Field>
            <Field label="Comentarios SAT (internos)">
              <TextInput value={comentarios} onChangeText={setComentarios} multiline numberOfLines={3} style={[s.input, s.textarea, { backgroundColor: COLORS.primarySoft }]} placeholderTextColor={COLORS.textDisabled} />
            </Field>
          </ScrollView>
          <View style={s.modalFooter}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="btn-create-incident" style={[s.resolvedBtn, saving && { opacity: 0.6 }]} onPress={create} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={s.resolvedBtnText}>Crear</Text>
              </>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ClientModal({ client, onClose, onSaved }: {
  client: Client | null; onClose: () => void; onSaved: () => void;
}) {
  const [cliente, setCliente] = useState(client?.cliente || "");
  const [direccion, setDireccion] = useState(client?.direccion || "");
  const [contacto, setContacto] = useState(client?.contacto || "");
  const [telefono, setTelefono] = useState(client?.telefono || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!cliente.trim()) { Alert.alert("Error", "El nombre del cliente es obligatorio"); return; }
    setSaving(true);
    try {
      if (client) await api.satClientUpdate(client.id, { cliente, direccion, contacto, telefono });
      else await api.satClientCreate({ cliente, direccion, contacto, telefono });
      onSaved();
    } catch (e: any) { Alert.alert("Error", e?.message || "No se pudo guardar"); }
    finally { setSaving(false); }
  };

  const del = async () => {
    if (!client) return;
    const ok = await confirmAsync("Eliminar cliente", `¿Eliminar a "${client.cliente}" del catálogo? Las incidencias vinculadas se conservarán.`);
    if (!ok) return;
    setSaving(true);
    try { await api.satClientDelete(client.id); onSaved(); }
    catch (e: any) { Alert.alert("Error", e?.message || "No se pudo eliminar"); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetRoot}>
        <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle}>{client ? "Editar cliente" : "Nuevo cliente"}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={14} style={s.closeBtn}>
              <Ionicons name="close" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }} keyboardShouldPersistTaps="handled">
            <Field label="Cliente *"><TextInput value={cliente} onChangeText={setCliente} style={s.input} placeholderTextColor={COLORS.textDisabled} placeholder="Nombre o razón social" /></Field>
            <Field label="Dirección"><TextInput value={direccion} onChangeText={setDireccion} style={s.input} placeholderTextColor={COLORS.textDisabled} /></Field>
            <Field label="Responsable / contacto"><TextInput value={contacto} onChangeText={setContacto} style={s.input} placeholderTextColor={COLORS.textDisabled} /></Field>
            <Field label="Teléfono"><TextInput value={telefono} onChangeText={setTelefono} style={s.input} keyboardType="phone-pad" placeholderTextColor={COLORS.textDisabled} /></Field>
          </ScrollView>
          <View style={s.modalFooter}>
            {client && (
              <TouchableOpacity testID="client-delete" style={s.dangerBtn} onPress={del} disabled={saving}>
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="btn-save-client" style={[s.resolvedBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={s.resolvedBtnText}>Guardar</Text>
              </>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ============================ styles ============================ */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: 8 },

  header: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: COLORS.border,
  },
  title: { fontSize: 20, fontWeight: "900", color: COLORS.text, letterSpacing: -0.4 },
  viewSelector: {
    flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4,
    paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start",
    borderRadius: 12, backgroundColor: COLORS.primarySoft,
    borderWidth: 1, borderColor: COLORS.primary + "33",
  },
  viewSelectorText: { fontSize: 12, fontWeight: "900", color: COLORS.primary, letterSpacing: 0.3 },

  copyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, height: 38, borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5, borderColor: COLORS.primary,
    maxWidth: 170,
  },
  copyBtnText: { color: COLORS.primary, fontWeight: "900", fontSize: 12 },

  dropdownBackdrop: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 20,
  },
  viewMenu: {
    position: "absolute", top: 76, left: 72, width: 280, zIndex: 21,
    backgroundColor: COLORS.surface, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 6, gap: 2,
    ...Platform.select<any>({
      web: { boxShadow: "0 16px 32px rgba(15,23,42,0.18)" },
      default: { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
    }),
  },
  viewMenuItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 10, borderRadius: 10,
  },
  viewMenuItemOn: { backgroundColor: COLORS.highlightBg },
  viewMenuTitle: { fontSize: 14, fontWeight: "900", color: COLORS.text },
  viewMenuSub: { fontSize: 11.5, color: COLORS.textSecondary, fontWeight: "600", marginTop: 2 },

  tabsRow: {
    flexDirection: "row", gap: 8, alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tabPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, height: 38, borderRadius: 19,
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
  },
  tabPillOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabPillText: { color: COLORS.text, fontWeight: "800", fontSize: 13 },
  tabPillTextOn: { color: "#fff" },
  tabCountBadge: {
    minWidth: 22, height: 18, borderRadius: 9, paddingHorizontal: 5,
    backgroundColor: COLORS.border, alignItems: "center", justifyContent: "center",
  },
  tabCountBadgeOn: { backgroundColor: "rgba(255,255,255,0.3)" },
  tabCountText: { fontSize: 11, fontWeight: "900", color: COLORS.text },
  tabCountTextOn: { color: "#fff" },

  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, height: 38, borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  addBtnText: { color: "#fff", fontWeight: "900", fontSize: 13 },

  emptyTitle: { fontSize: 17, fontWeight: "900", color: COLORS.text, marginTop: 4 },
  emptyMsg: { fontSize: 13, color: COLORS.textSecondary, textAlign: "center", maxWidth: 320, fontWeight: "600", lineHeight: 18 },

  // Incident card
  card: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, padding: 14,
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
  linkedClient: { fontSize: 11.5, color: COLORS.primary, marginTop: 6, fontWeight: "700" },

  // Clients
  clientHeader: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  searchWrap: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    height: 38, paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 13.5, color: COLORS.text, paddingVertical: 0 },

  clientCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: COLORS.surface, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, padding: 12,
  },
  clientName: { fontSize: 14, fontWeight: "900", color: COLORS.text, letterSpacing: -0.2 },
  clientChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    backgroundColor: COLORS.bg,
  },
  clientChipText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: "700", maxWidth: 180 },
  clientActionPrimary: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, height: 34, borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  clientActionPrimaryText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  clientActionGhost: {
    width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
  },

  // Modal
  sheetRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    maxHeight: "92%",
    ...Platform.select<any>({
      web: { boxShadow: "0 -10px 40px rgba(15,23,42,0.2)" },
      default: { shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: -8 } },
    }),
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", padding: 18,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 19, fontWeight: "900", color: COLORS.text, letterSpacing: -0.4 },
  modalSub: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "600", marginTop: 2 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
  },
  fieldLabel: { fontSize: 11.5, fontWeight: "900", color: COLORS.text, marginBottom: 5, letterSpacing: 0.3 },
  input: {
    borderWidth: 1.5, borderColor: COLORS.borderInput,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: COLORS.text, backgroundColor: COLORS.bg,
  },
  textarea: { minHeight: 92, textAlignVertical: "top" as any, paddingTop: 10 },

  pickerBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, height: 44, borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5, borderColor: COLORS.primary,
  },
  pickerList: {
    maxHeight: 260, marginTop: 6, borderRadius: 10, overflow: "hidden",
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg,
  },
  pickerItem: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  pickerItemText: { flex: 1, fontSize: 13, color: COLORS.text, fontWeight: "700" },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  statusLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "800" },
  statusChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, height: 26, borderRadius: 13, borderWidth: 1,
  },

  modalFooter: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 14, borderTopWidth: 1, borderTopColor: COLORS.border,
    flexWrap: "wrap",
  },
  dangerBtn: {
    width: 42, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FEE2E2",
  },
  pendingBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    height: 42, borderRadius: 10, backgroundColor: "#FEF3C7",
    borderWidth: 1.5, borderColor: "#F59E0B", paddingHorizontal: 10, minWidth: 120,
  },
  pendingBtnText: { color: "#B45309", fontWeight: "900", fontSize: 13 },
  resolvedBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    height: 42, borderRadius: 10, backgroundColor: "#10B981",
    paddingHorizontal: 10, minWidth: 120,
  },
  resolvedBtnText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  cancelBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    height: 42, borderRadius: 10, paddingHorizontal: 18,
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
  },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: "900", fontSize: 13 },
});
