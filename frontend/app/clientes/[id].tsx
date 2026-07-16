import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Platform, Linking
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS } from "../../src/api";
import { useThemedStyles } from "../../src/theme";
import { ios } from "../../src/ui/iosTheme";

function RowInfo({ s, editando, label, value, icon, action }: {
  s: any; editando: boolean; label: string; value?: string | null; icon?: string; action?: () => void;
}) {
  if (!editando && !value) return null;
  return (
    <View style={s.infoRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue}>{value || "—"}</Text>
      </View>
      {icon && action && !editando && (
        <TouchableOpacity onPress={action} style={s.actionCircle}>
          <Ionicons name={icon as any} size={16} color={COLORS.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function ClienteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const s = useThemedStyles(useS);

  const [cliente, setCliente] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [original, setOriginal] = useState<string>("");

  const [nombre, setNombre] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [docId, setDocId] = useState("NIF");
  const [numDoc, setNumDoc] = useState("");
  const [direccion, setDireccion] = useState("");
  const [provincia, setProvincia] = useState("");
  const [poblacion, setPoblacion] = useState("");
  const [representante, setRepresentante] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [direcciones, setDirecciones] = useState<any[]>([]);
  const [mantenimiento, setMantenimiento] = useState(false);
  const [tipoMantenimiento, setTipoMantenimiento] = useState("");
  const [revisiones, setRevisiones] = useState("0");
  const [altaMantenimiento, setAltaMantenimiento] = useState("");
  const [fechaPrimeraRevision, setFechaPrimeraRevision] = useState("");

  // Salto KS
  const [saltoKsActivo, setSaltoKsActivo] = useState(false);
  const [saltoKsTipoRenovacion, setSaltoKsTipoRenovacion] = useState("");
  const [saltoKsFechaRenovacion, setSaltoKsFechaRenovacion] = useState("");

  const [proyectos, setProyectos] = useState<any[]>([]);
  const [incidencias, setIncidencias] = useState<any[]>([]);
  const [mantenimientosList, setMantenimientosList] = useState<any[]>([]);
  const [materialesInstalados, setMaterialesInstalados] = useState<any[]>([]);
  const [showMatInst, setShowMatInst] = useState(true);
  const [documentos, setDocumentos] = useState<any[]>([]);

  const [showDocs, setShowDocs] = useState(true);
  const [showProy, setShowProy] = useState(false);
  const [showInci, setShowInci] = useState(false);

  const isDirty = () => {
    if (!original) return false;
    const current = JSON.stringify({
      nombre, razonSocial, docId, direccion, provincia, poblacion, representante, telefono, email,
      direcciones: direcciones.map(d => ({ direccion: d.direccion, representante: d.representante, telefono: d.telefono, email: d.email })),
      mantenimiento, tipoMantenimiento, revisiones,
    });
    return current !== original;
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getCliente(id);
        setCliente(data);
        setNombre(data.nombre || "");
        setRazonSocial(data.razon_social || "");
        setDocId(data.tipo_documento_id || "NIF");
        setNumDoc(data.numero_documento || "");
        setDireccion(data.direccion || "");
        setProvincia(data.provincia || "");
        setPoblacion(data.poblacion || "");
        setRepresentante(data.representante || "");
        setTelefono(data.telefono || "");
        setEmail(data.email || "");
        setDirecciones(data.direcciones || []);
        setMantenimiento(!!data.mantenimiento_contratado);
        setTipoMantenimiento(data.tipo_mantenimiento || "");
        setRevisiones(String(data.numero_revisiones ?? 0));
        setAltaMantenimiento(data.alta_mantenimiento || "");
        setFechaPrimeraRevision(data.fecha_primera_revision || "");
        setSaltoKsActivo(!!data.salto_ks_activo);
        setSaltoKsTipoRenovacion(data.salto_ks_tipo_renovacion || "");
        setSaltoKsFechaRenovacion(data.salto_ks_fecha_renovacion || "");
        setProyectos(data.proyectos || []);
        setIncidencias(data.incidencias || []);
        setMantenimientosList(data.mantenimientos || []);
        setMaterialesInstalados(data.materiales_instalados || []);
        setDocumentos(data.documentos || []);

        setOriginal(JSON.stringify({
          nombre: data.nombre || "", razonSocial: data.razon_social || "", docId: data.tipo_documento_id || "NIF",
          direccion: data.direccion || "", provincia: data.provincia || "", poblacion: data.poblacion || "",
          representante: data.representante || "", telefono: data.telefono || "", email: data.email || "",
          direcciones: (data.direcciones || []).map((d: any) => ({ direccion: d.direccion || "", representante: d.representante || "", telefono: d.telefono || "", email: d.email || "" })),
          mantenimiento: !!data.mantenimiento_contratado, tipoMantenimiento: data.tipo_mantenimiento || "", revisiones: String(data.numero_revisiones ?? 0),
        }));
      } catch (e: any) { Alert.alert("Error", e.message); }
      finally { setLoading(false); }
    })();
  }, [id]);

  const guardar = async () => {
    if (!nombre.trim()) { Alert.alert("Error", "El nombre es obligatorio"); return; }
    setSaving(true);
    try {
      const body: any = {
        nombre: nombre.trim(), razon_social: razonSocial.trim(), tipo_documento_id: docId,
        numero_documento: numDoc.trim(), direccion: direccion.trim(), provincia: provincia.trim(),
        poblacion: poblacion.trim(), representante: representante.trim(), telefono: telefono.trim(),
        email: email.trim(), direcciones: direcciones.map(d => ({ direccion: d.direccion || "", representante: d.representante || "", telefono: d.telefono || "", email: d.email || "" })),
        mantenimiento_contratado: mantenimiento, tipo_mantenimiento: mantenimiento ? tipoMantenimiento.trim() : "",
        numero_revisiones: mantenimiento ? parseInt(revisiones) || 0 : 0, alta_mantenimiento: altaMantenimiento || null,
        fecha_primera_revision: fechaPrimeraRevision || null,
        salto_ks_activo: saltoKsActivo,
        salto_ks_tipo_renovacion: saltoKsActivo ? saltoKsTipoRenovacion.trim() : "",
        salto_ks_fecha_renovacion: saltoKsActivo ? (saltoKsFechaRenovacion || null) : null,
      };
      const updated = await api.updateCliente(id, body);
      setCliente(updated);
      setEditando(false);
      Alert.alert("Guardado", "Datos actualizados correctamente.");
      setOriginal(JSON.stringify({
        nombre: nombre.trim(), razonSocial: razonSocial.trim(), docId, direccion: direccion.trim(),
        provincia: provincia.trim(), poblacion: poblacion.trim(), representante: representante.trim(),
        telefono: telefono.trim(), email: email.trim(), direcciones: direcciones.map(d => ({ direccion: d.direccion || "", representante: d.representante || "", telefono: d.telefono || "", email: d.email || "" })),
        mantenimiento, tipoMantenimiento: mantenimiento ? tipoMantenimiento.trim() : "", revisiones: mantenimiento ? String(parseInt(revisiones) || 0) : "0",
      }));
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setSaving(false); }
  };

  const handleUploadDoc = () => {
    if (Platform.OS !== "web") return;
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async (ev: any) => {
      const file = ev.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const b64 = dataUrl.includes("base64,") ? dataUrl.split("base64,")[1] : dataUrl;
        try {
          await api.uploadClientDoc(id, file.name, b64, file.type || "application/pdf");
          const data = await api.getCliente(id);
          setDocumentos(data.documentos || []);
        } catch (e: any) { alert(e.message); }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleDeleteDoc = (docId: string, docName: string) => {
    if (Platform.OS === 'web' && !window.confirm(`¿Eliminar "${docName}"?`)) return;
    api.deleteClientDoc(id, docId).then(async () => {
      const data = await api.getCliente(id);
      setDocumentos(data.documentos || []);
    }).catch((e: any) => Alert.alert("Error", e.message));
  };

  if (loading) {
    return (
      <SafeAreaView style={s.root} edges={["top"]}>
        <View style={s.centered}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => {
          if (isDirty()) {
            Alert.alert("Cambios sin guardar", "¿Deseas descartar los cambios realizados?", [
              { text: "Permanecer" },
              { text: "Descartar", style: "destructive", onPress: () => router.back() }
            ]);
            return;
          }
          router.back();
        }}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{editando ? "Editar Cliente" : "Ficha Cliente"}</Text>
        <TouchableOpacity style={[s.editBadge, editando && s.editBadgeActive]} onPress={() => editando ? guardar() : setEditando(true)}>
          <Ionicons name={editando ? "checkmark-sharp" : "create-outline"} size={16} color={editando ? "#fff" : COLORS.primary} />
          <Text style={[s.editBadgeText, editando && { color: "#fff" }]}>{editando ? "Guardar" : "Editar"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={s.heroCard}>
          <View style={s.heroAvatar}>
            <Ionicons name="business" size={28} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroName}>{cliente.nombre}</Text>
            {cliente.razon_social ? <Text style={s.heroRazon}>{cliente.razon_social}</Text> : null}
            <View style={s.heroMetaRow}>
              <Text style={s.heroMetaBadge}>{cliente.tipo_documento_id || "NIF"}: {cliente.numero_documento || "—"}</Text>
              {cliente.mantenimiento_contratado && (
                <View style={[s.mantBadge, { marginTop: 0 }]}>
                  <Ionicons name="shield-checkmark" size={10} color={COLORS.syncedText} />
                  <Text style={s.mantBadgeText}>Soporte Activo</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Información de Contacto</Text>

          {editando ? (
            <View style={{ gap: ios.spacing.sm }}>
              <Text style={s.fieldLabel}>Nombre Comercial *</Text>
              <TextInput style={s.input} value={nombre} onChangeText={setNombre} />

              <Text style={s.fieldLabel}>Razón Social</Text>
              <TextInput style={s.input} value={razonSocial} onChangeText={setRazonSocial} />

              <Text style={s.fieldLabel}>Tipo e Identificación</Text>
              <View style={s.chipRow}>
                {["NIF", "CIF", "Otro"].map((t) => (
                  <TouchableOpacity key={t} style={[s.chip, docId === t && s.chipActive]} onPress={() => setDocId(t)}>
                    <Text style={[s.chipText, docId === t && s.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={s.input} value={numDoc} onChangeText={setNumDoc} placeholder="Número de Documento" />

              <Text style={s.fieldLabel}>Dirección Fiscal</Text>
              <TextInput style={s.input} value={direccion} onChangeText={setDireccion} />

              <View style={s.rowFields}>
                <View style={{ flex: 1 }}><Text style={s.fieldLabel}>Población</Text><TextInput style={s.input} value={poblacion} onChangeText={setPoblacion} /></View>
                <View style={{ flex: 1 }}><Text style={s.fieldLabel}>Provincia</Text><TextInput style={s.input} value={provincia} onChangeText={setProvincia} /></View>
              </View>

              <Text style={s.fieldLabel}>Representante / Contacto</Text>
              <TextInput style={s.input} value={representante} onChangeText={setRepresentante} />

              <Text style={s.fieldLabel}>Teléfono</Text>
              <TextInput style={s.input} value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />

              <Text style={s.fieldLabel}>Email</Text>
              <TextInput style={s.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>
          ) : (
            <View>
              <RowInfo s={s} editando={editando} label="Representante / Contacto" value={representante} />
              <RowInfo s={s} editando={editando} label="Teléfono" value={telefono} icon="call-outline" action={() => Linking.openURL(`tel:${telefono}`)} />
              <RowInfo s={s} editando={editando} label="Email corporativo" value={email} icon="mail-outline" action={() => Linking.openURL(`mailto:${email}`)} />
              <RowInfo s={s} editando={editando} label="Ubicación principal" value={`${direccion}${poblacion ? `, ${poblacion}` : ""}${provincia ? ` (${provincia})` : ""}`} icon="map-outline" />
            </View>
          )}
        </View>

        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Contrato Mantenimiento (SAT)</Text>
            {editando && (
              <TouchableOpacity style={[s.toggle, mantenimiento && s.toggleOn]} onPress={() => setMantenimiento(!mantenimiento)}>
                <View style={[s.toggleKnob, mantenimiento && s.toggleKnobOn]} />
              </TouchableOpacity>
            )}
          </View>

          {mantenimiento ? (
            editando ? (
               <View style={{ gap: ios.spacing.sm, marginTop: ios.spacing.xs }}>
                <Text style={s.fieldLabel}>Fecha de Alta</Text>
                {Platform.OS === "web" ? (
                  <View style={{ height: 44, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg }}>
                    <input type="date" value={altaMantenimiento} onChange={(e: any) => setAltaMantenimiento(e.target.value)} style={{ width: "100%", height: "100%", border: "none", padding: "0 12px", fontSize: 14, backgroundColor: "transparent", color: COLORS.text, outline: "none" }} />
                  </View>
                ) : (
                  <TextInput style={s.input} value={altaMantenimiento} onChangeText={setAltaMantenimiento} placeholder="YYYY-MM-DD" />
                )}
                <Text style={s.fieldLabel}>Tipo de Servicio</Text>
                <View style={s.chipRow}>
                  {["Anual", "Trimestral", "Semestral"].map((t) => (
                    <TouchableOpacity key={t} style={[s.chip, tipoMantenimiento === t && s.chipActive]} onPress={() => { setTipoMantenimiento(t); setRevisiones(t === "Anual" ? "1" : t === "Semestral" ? "2" : "3"); }}>
                      <Text style={[s.chipText, tipoMantenimiento === t && s.chipTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={[s.chip, tipoMantenimiento && !["Anual","Trimestral","Semestral"].includes(tipoMantenimiento) && s.chipActive]} onPress={() => { setTipoMantenimiento("A medida"); setRevisiones(""); }}>
                    <Text style={[s.chipText, tipoMantenimiento && !["Anual","Trimestral","Semestral"].includes(tipoMantenimiento) && s.chipTextActive]}>A medida</Text>
                  </TouchableOpacity>
                </View>
                {tipoMantenimiento && !["Anual","Trimestral","Semestral"].includes(tipoMantenimiento) && (
                  <TextInput style={s.input} value={tipoMantenimiento === "A medida" ? "" : tipoMantenimiento} onChangeText={setTipoMantenimiento} placeholder="Describe el tipo de mantenimiento..." placeholderTextColor={COLORS.textDisabled} />
                )}
                <Text style={s.fieldLabel}>Revisiones Anuales</Text>
                <TextInput style={s.input} value={revisiones} onChangeText={setRevisiones} keyboardType="numeric" />
              </View>
            ) : (
              <View style={{ marginTop: 4 }}>
                <RowInfo s={s} editando={editando} label="Modalidad de Cobertura" value={tipoMantenimiento} />
                <RowInfo s={s} editando={editando} label="Revisiones Planificadas" value={`${revisiones} visitas al año`} />
                <RowInfo s={s} editando={editando} label="Fecha Incorporación" value={altaMantenimiento} />
                <RowInfo s={s} editando={editando} label="Próxima Revisión" value={fechaPrimeraRevision} />
              </View>
            )
          ) : (
            !editando && <Text style={s.emptySectionText}>Este cliente no dispone de un contrato de mantenimiento.</Text>
          )}

        </View>

        {/* Salto KS */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Cliente Salto KS</Text>
            {editando && (
              <TouchableOpacity style={[s.toggle, saltoKsActivo && s.toggleOn]} onPress={() => setSaltoKsActivo(!saltoKsActivo)}>
                <View style={[s.toggleKnob, saltoKsActivo && s.toggleKnobOn]} />
              </TouchableOpacity>
            )}
          </View>

          {saltoKsActivo ? (
            editando ? (
              <View style={{ gap: ios.spacing.sm, marginTop: ios.spacing.xs }}>
                <Text style={s.fieldLabel}>Tipo de Renovación</Text>
                <View style={s.chipRow}>
                  {["Mensual", "Trimestral", "Semestral", "Anual"].map((t) => (
                    <TouchableOpacity key={t} style={[s.chip, saltoKsTipoRenovacion === t && s.chipActive]} onPress={() => setSaltoKsTipoRenovacion(t)}>
                      <Text style={[s.chipText, saltoKsTipoRenovacion === t && s.chipTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={s.fieldLabel}>Fecha de Renovación del Voucher</Text>
                <TextInput style={s.input} value={saltoKsFechaRenovacion} onChangeText={setSaltoKsFechaRenovacion} placeholder="YYYY-MM-DD" />
              </View>
            ) : (
              <View style={{ marginTop: 4 }}>
                <RowInfo s={s} editando={editando} label="Estado" value="Activo" />
                <RowInfo s={s} editando={editando} label="Tipo de Renovación" value={saltoKsTipoRenovacion} />
                <RowInfo s={s} editando={editando} label="Fecha Renovación Voucher" value={saltoKsFechaRenovacion} />
              </View>
            )
          ) : (
            !editando && <Text style={s.emptySectionText}>Cliente no registrado como Cliente Salto KS.</Text>
          )}

        </View>

        <View style={s.section}>
          <TouchableOpacity style={s.accordionHeader} onPress={() => setShowProy(!showProy)} activeOpacity={0.7}>
            <View style={s.rowAlignCenter}>
              <Ionicons name="folder-open-outline" size={18} color={COLORS.primary} />
              <Text style={s.accordionTitle}>Proyectos Asociados ({proyectos.length})</Text>
            </View>
            <Ionicons name={showProy ? "chevron-up" : "chevron-down"} size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
          {showProy && (
            <View style={s.accordionContent}>
              {proyectos.length === 0 ? (
                <Text style={s.emptySectionText}>Sin históricos ni obras en curso.</Text>
              ) : (
                proyectos.map((p: any) => (
                  <TouchableOpacity key={p.id} style={s.itemRow} onPress={() => router.push(`/material/${p.id}`)}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemRowTitle} numberOfLines={1}>{p.materiales || "Proyecto sin título"}</Text>
                      <Text style={s.itemRowSub}>{p.project_status || "Pendiente"} · {p.updated_at ? new Date(p.updated_at).toLocaleDateString("es-ES") : ""}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={COLORS.textDisabled} />
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>

        <View style={s.section}>
          <TouchableOpacity style={s.accordionHeader} onPress={() => setShowInci(!showInci)} activeOpacity={0.7}>
            <View style={s.rowAlignCenter}>
              <Ionicons name="build-outline" size={18} color={COLORS.primary} />
              <Text style={s.accordionTitle}>Incidencias Reportadas ({incidencias.length})</Text>
            </View>
            <Ionicons name={showInci ? "chevron-up" : "chevron-down"} size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
          {showInci && (
            <View style={s.accordionContent}>
              {incidencias.length === 0 ? (
                <Text style={s.emptySectionText}>No se registran alertas técnicas para este cliente.</Text>
              ) : (
                incidencias.map((i: any) => (
                  <View key={i.id} style={s.itemRow}>
                    <View style={[s.statusIndicator, { backgroundColor: i.status === "resuelta" ? COLORS.syncedText : COLORS.errorText }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemRowTitle} numberOfLines={1}>{i.observaciones || "Sin especificaciones"}</Text>
                      <Text style={s.itemRowSub}>{new Date(i.created_at).toLocaleDateString("es-ES")} · Estado: {i.status || "abierta"}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        <View style={s.section}>
          <TouchableOpacity style={s.accordionHeader} onPress={() => setShowMatInst(!showMatInst)} activeOpacity={0.7}>
            <View style={s.rowAlignCenter}>
              <Ionicons name="cube-outline" size={18} color={ios.colors.green} />
              <Text style={s.accordionTitle}>Materiales Instalados ({materialesInstalados.length})</Text>
            </View>
            <Ionicons name={showMatInst ? "chevron-up" : "chevron-down"} size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
          {showMatInst && (
            <View style={s.accordionContent}>
              {materialesInstalados.length === 0 ? (
                <Text style={s.emptySectionText}>Sin materiales instalados registrados.</Text>
              ) : (
                <View style={{ gap: 2 }}>
                  <View style={{ flexDirection: "row", paddingVertical: 4, paddingHorizontal: 8, backgroundColor: COLORS.primarySoft, borderRadius: 6, marginBottom: 4 }}>
                    <Text style={{ flex: 2, fontSize: 10, fontWeight: "700", color: COLORS.textSecondary, textTransform: "uppercase" }}>Material</Text>
                    <Text style={{ width: 50, fontSize: 10, fontWeight: "700", color: COLORS.textSecondary, textTransform: "uppercase", textAlign: "center" }}>Cant.</Text>
                    <Text style={{ flex: 1, fontSize: 10, fontWeight: "700", color: COLORS.textSecondary, textTransform: "uppercase", textAlign: "right" }}>Fecha</Text>
                    <Text style={{ flex: 1.2, fontSize: 10, fontWeight: "700", color: COLORS.textSecondary, textTransform: "uppercase", textAlign: "right" }}>Proyecto</Text>
                  </View>
                  {materialesInstalados.map((m: any, i: number) => (
                    <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 8, backgroundColor: i % 2 === 0 ? COLORS.readonly : "transparent", borderRadius: 4, gap: 4 }}>
                      <Text style={{ flex: 2, fontSize: 12, fontWeight: "600", color: COLORS.text }} numberOfLines={1}>{m.material}</Text>
                      <Text style={{ width: 50, fontSize: 12, fontWeight: "700", color: ios.colors.green, textAlign: "center" }}>{m.cantidad}</Text>
                      <Text style={{ flex: 1, fontSize: 10, color: COLORS.textSecondary, textAlign: "right" }}>{m.fecha_terminacion || "-"}</Text>
                      <Text style={{ flex: 1.2, fontSize: 10, color: COLORS.textDisabled, textAlign: "right" }} numberOfLines={1}>{m.proyecto_nombre || m.proyecto_id?.slice(0, 8) || "-"}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        <View style={s.section}>
          <TouchableOpacity style={s.accordionHeader} onPress={() => setShowDocs(!showDocs)} activeOpacity={0.7}>
            <View style={s.rowAlignCenter}>
              <Ionicons name="document-attach-outline" size={18} color={COLORS.primary} />
              <Text style={s.accordionTitle}>Documentación ({documentos.length})</Text>
            </View>
            <View style={s.rowAlignCenter}>
              {Platform.OS === 'web' && (
                <TouchableOpacity onPress={handleUploadDoc} style={s.addDocInline} hitSlop={8}>
                  <Ionicons name="cloud-upload-outline" size={16} color={COLORS.primary} />
                </TouchableOpacity>
              )}
              <Ionicons name={showDocs ? "chevron-up" : "chevron-down"} size={16} color={COLORS.textSecondary} />
            </View>
          </TouchableOpacity>

          {showDocs && (
            <View style={s.accordionContent}>
              {documentos.length === 0 ? (
                <Text style={s.emptySectionText}>No hay archivos adjuntos en el repositorio.</Text>
              ) : (
                documentos.map((d: any) => (
                  <View key={d.id} style={s.itemRow}>
                    <Ionicons name="document-text" size={20} color="#E2574C" />
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemRowTitle} numberOfLines={1}>{d.nombre}</Text>
                      <Text style={s.itemRowSub}>{new Date(d.created_at).toLocaleDateString("es-ES")}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteDoc(d.id, d.nombre)} style={s.deleteBtnInline} hitSlop={6}>
                      <Ionicons name="trash-outline" size={16} color={COLORS.errorText} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        {editando && (
          <TouchableOpacity style={s.saveBtn} onPress={guardar} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>CONFIRMAR CAMBIOS</Text>}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: ios.spacing.md, paddingVertical: ios.spacing.sm,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  editBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primarySoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  editBadgeActive: { backgroundColor: COLORS.primary },
  editBadgeText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },

  scrollContainer: { padding: ios.spacing.md, paddingBottom: 100, gap: ios.spacing.md },
  heroCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface,
    padding: ios.spacing.lg, borderRadius: ios.radius.md, gap: ios.spacing.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  heroAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  heroName: { fontSize: 20, fontWeight: "800", color: COLORS.text, letterSpacing: -0.4 },
  heroRazon: { fontSize: 13, color: COLORS.textSecondary, marginTop: 1 },
  heroMetaRow: { flexDirection: 'row', gap: ios.spacing.sm, marginTop: ios.spacing.xs, alignItems: 'center' },
  heroMetaBadge: { fontSize: 11, backgroundColor: COLORS.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, color: COLORS.textSecondary, borderWidth: 1, borderColor: COLORS.border },

  section: { backgroundColor: COLORS.surface, borderRadius: ios.radius.md, padding: ios.spacing.md, borderWidth: 1, borderColor: COLORS.border },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: ios.spacing.xs },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: ios.spacing.xs },

  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: ios.spacing.sm, borderBottomWidth: 1, borderBottomColor: COLORS.bg },
  infoLabel: { color: COLORS.textSecondary, fontSize: 11, textTransform: 'uppercase' },
  infoValue: { color: COLORS.text, fontSize: 14, fontWeight: "600", marginTop: 2 },
  actionCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },

  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  rowAlignCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  accordionTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  accordionContent: { marginTop: ios.spacing.sm, borderTopWidth: 1, borderTopColor: COLORS.bg, paddingTop: ios.spacing.xs },
  emptySectionText: { fontSize: 13, color: COLORS.textDisabled, fontStyle: 'italic', marginTop: 4 },

  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: ios.spacing.sm, borderBottomWidth: 1, borderBottomColor: COLORS.bg, gap: ios.spacing.sm },
  itemRowTitle: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  itemRowSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  statusIndicator: { width: 6, height: 6, borderRadius: 3 },
  addDocInline: { marginRight: ios.spacing.sm, padding: 2 },
  deleteBtnInline: { padding: 4 },

  fieldLabel: { fontSize: 11, fontWeight: "600", color: COLORS.textSecondary, marginTop: ios.spacing.xs, marginBottom: 2 },
  input: { height: 38, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 10, fontSize: 13, color: COLORS.text },
  rowFields: { flexDirection: "row", gap: ios.spacing.sm },
  chipRow: { flexDirection: "row", gap: ios.spacing.xs, marginVertical: 2 },
  chip: { flex: 1, height: 34, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary },
  chipTextActive: { color: "#fff" },
  toggle: { width: 40, height: 22, borderRadius: 11, backgroundColor: COLORS.border, justifyContent: "center", paddingHorizontal: 2 },
  toggleOn: { backgroundColor: COLORS.primary },
  toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff" },
  toggleKnobOn: { alignSelf: "flex-end" },
  mantBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: COLORS.syncedBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  mantBadgeText: { fontSize: 10, fontWeight: "600", color: COLORS.syncedText },
  saveBtn: { height: 44, borderRadius: ios.radius.md, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", marginTop: ios.spacing.sm },
  saveBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
