import { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS, getToken } from "../../src/api";
import { useThemedStyles } from "../../src/theme";
import { ios } from "../../src/ui/iosTheme";

export default function ClienteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const s = useThemedStyles(useS);
  const [cliente, setCliente] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [original, setOriginal] = useState<string>("");

  const isDirty = () => {
    if (!original) return false;
    const current = JSON.stringify({
      nombre, razonSocial, docId, direccion, provincia, poblacion, representante, telefono, email,
      direcciones: direcciones.map(d => ({ direccion: d.direccion, representante: d.representante, telefono: d.telefono, email: d.email })),
      mantenimiento, tipoMantenimiento, revisiones,
    });
    return current !== original;
  };

  // Campos editables
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
  const [proyectos, setProyectos] = useState<any[]>([]);
  const [incidencias, setIncidencias] = useState<any[]>([]);
  const [mantenimientosList, setMantenimientosList] = useState<any[]>([]);
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [showDocs, setShowDocs] = useState(false);
  const [showProy, setShowProy] = useState(false);
  const [showInci, setShowInci] = useState(false);

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
        setProyectos(data.proyectos || []);
        setIncidencias(data.incidencias || []);
        setMantenimientosList(data.mantenimientos || []);
        setDocumentos(data.documentos || []);
        setTimeout(() => {
          setOriginal(JSON.stringify({
            nombre: data.nombre || "", razonSocial: data.razon_social || "", docId: data.tipo_documento_id || "NIF",
            direccion: data.direccion || "", provincia: data.provincia || "", poblacion: data.poblacion || "",
            representante: data.representante || "", telefono: data.telefono || "", email: data.email || "",
            direcciones: (data.direcciones || []).map((d: any) => ({ direccion: d.direccion || "", representante: d.representante || "", telefono: d.telefono || "", email: d.email || "" })),
            mantenimiento: !!data.mantenimiento_contratado, tipoMantenimiento: data.tipo_mantenimiento || "", revisiones: String(data.numero_revisiones ?? 0),
          }));
        }, 500);
      } catch (e: any) {
        Alert.alert("Error", e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const guardar = async () => {
    if (!nombre.trim()) { Alert.alert("Error", "El nombre es obligatorio"); return; }
    if (Platform.OS === "web") {
      const ok = window.confirm("¿Confirms que quieres actualizar los datos del cliente?");
      if (!ok) return;
    } else {
      // Mobile: use Alert with callback
      return new Promise<void>((resolve) => {
        Alert.alert("Guardar cambios", "¿Confirms que quieres actualizar los datos?", [
          { text: "Cancelar", style: "cancel", onPress: () => resolve() },
          { text: "Guardar", onPress: () => resolve() },
        ]);
      }).then(() => {});
    }
    setSaving(true);
    try {
      const body: any = {
        nombre: nombre.trim(),
        razon_social: razonSocial.trim(),
        tipo_documento_id: docId,
        numero_documento: numDoc.trim(),
        direccion: direccion.trim(),
        provincia: provincia.trim(),
        poblacion: poblacion.trim(),
        representante: representante.trim(),
        telefono: telefono.trim(),
        email: email.trim(),
        direcciones: direcciones.map(d => ({
          direccion: d.direccion || "",
          representante: d.representante || "",
          telefono: d.telefono || "",
          email: d.email || "",
        })),
        mantenimiento_contratado: mantenimiento,
        tipo_mantenimiento: mantenimiento ? tipoMantenimiento.trim() : "",
        numero_revisiones: mantenimiento ? parseInt(revisiones) || 0 : 0,
        alta_mantenimiento: altaMantenimiento || null,
        fecha_primera_revision: fechaPrimeraRevision || null,
      };
      const updated = await api.updateCliente(id, body);
      setCliente(updated);
      setEditando(false);
      Alert.alert("Guardado", "Datos actualizados correctamente.");
      setOriginal(JSON.stringify({
        nombre: nombre.trim(), razonSocial: razonSocial.trim(), docId,
        direccion: direccion.trim(), provincia: provincia.trim(), poblacion: poblacion.trim(),
        representante: representante.trim(), telefono: telefono.trim(), email: email.trim(),
        direcciones: direcciones.map(d => ({ direccion: d.direccion || "", representante: d.representante || "", telefono: d.telefono || "", email: d.email || "" })),
        mantenimiento, tipoMantenimiento: mantenimiento ? tipoMantenimiento.trim() : "", revisiones: mantenimiento ? String(parseInt(revisiones) || 0) : "0",
      }));
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const nuevaDireccion = () => {
    setDirecciones([...direcciones, { direccion: "", representante: "", telefono: "", email: "" }]);
  };

  const handleUploadDoc = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async (ev: any) => {
      const file = ev.target.files?.[0];
      if (!file) return;
      readAndUpload(file);
    };
    input.click();
  };

  const readAndUpload = (file: File) => {
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

  const [dragOver, setDragOver] = useState(false);
  const docsRef = useRef<any>(null);

  useEffect(() => {
    const el = docsRef.current;
    if (!el) return;
    const onDragOver = (e: DragEvent) => { e.preventDefault(); setDragOver(true); };
    const onDragLeave = () => setDragOver(false);
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer?.files?.length) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          readAndUpload(e.dataTransfer.files[i]);
        }
      }
    };
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("drop", onDrop);
    };
  }, [documentos]);

  const handleDragOver = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = e.dataTransfer?.files;
    if (files?.length) {
      for (let i = 0; i < files.length; i++) {
        readAndUpload(files[i]);
      }
    }
  };

  const handleDeleteDoc = (docId: string, docName: string) => {
    if (!window.confirm(`Eliminar "${docName}"?`)) return;
    if (!window.confirm("Seguro que quieres eliminar este documento?")) return;
    api.deleteClientDoc(id, docId).then(async () => {
      const data = await api.getCliente(id);
      setDocumentos(data.documentos || []);
    }).catch((e: any) => alert(e.message));
  };

  const eliminarDireccion = (idx: number) => {
    setDirecciones(direcciones.filter((_, i) => i !== idx));
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

  if (!cliente) return null;

  function Field({ label, value }: { label: string; value?: string | null }) {
    return (
      <View style={s.roRow}>
        <Text style={s.roLabel}>{label}</Text>
        <Text style={s.roValue}>{value || "—"}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => {
          if (isDirty()) {
            const goBack = () => { try { if (router.canGoBack && router.canGoBack()) { router.back(); } } catch {}; router.replace("/clientes"); };
            if (Platform.OS === "web") {
              if (window.confirm("Tienes cambios sin guardar. ¿Quieres guardarlos antes de salir?")) {
                guardar().then(() => goBack());
              } else {
                goBack();
              }
            } else {
              Alert.alert("Cambios sin guardar", "¿Guardar antes de salir?", [
                { text: "Descartar", style: "destructive", onPress: () => goBack() },
                { text: "Guardar", onPress: () => guardar().then(() => goBack()) },
                { text: "Cancelar", style: "cancel" },
              ]);
            }
            return;
          }
          try { if (router.canGoBack && router.canGoBack()) { router.back(); return; } } catch {}
          router.replace("/clientes");
        }}>
          <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Cliente</Text>
        <TouchableOpacity
          style={s.iconBtn}
          onPress={() => editando ? guardar() : setEditando(true)}
        >
          <Ionicons name={editando ? "checkmark" : "create-outline"} size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: ios.spacing.lg, paddingBottom: 120, gap: ios.spacing.lg }}>
        <View style={s.titleBlock}>
          <Text style={s.titleName}>{cliente.nombre || "Sin nombre"}</Text>
          {cliente.razon_social ? <Text style={s.titleRazon}>{cliente.razon_social}</Text> : null}
          <View style={{ flexDirection: "row", gap: ios.spacing.md, marginTop: ios.spacing.xs }}>
            <Text style={s.titleMeta}>{cliente.tipo_documento_id || "NIF"}</Text>
            {cliente.poblacion ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} />
                <Text style={s.titleMeta}>{cliente.poblacion}{cliente.provincia ? `, ${cliente.provincia}` : ""}</Text>
              </View>
            ) : null}
          </View>
        </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>DATOS GENERALES</Text>

            <Text style={s.fieldLabel}>Nombre *</Text>
            <TextInput style={s.input} value={nombre} onChangeText={setNombre} placeholder="Nombre" placeholderTextColor={COLORS.textDisabled} />

            <Text style={s.fieldLabel}>Razon social</Text>
            <TextInput style={s.input} value={razonSocial} onChangeText={setRazonSocial} placeholder="Razon social" placeholderTextColor={COLORS.textDisabled} />

            <Text style={s.fieldLabel}>Tipo documento</Text>
            <View style={s.chipRow}>
              {["NIF", "CIF", "Otro"].map((t) => (
                <TouchableOpacity key={t} style={[s.chip, docId === t && s.chipActive]} onPress={() => setDocId(t)}>
                  <Text style={[s.chipText, docId === t && s.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.fieldLabel}>Numero documento</Text>
            <TextInput style={s.input} value={numDoc} onChangeText={setNumDoc} placeholder="Numero de documento" placeholderTextColor={COLORS.textDisabled} />

            <Text style={s.fieldLabel}>Direccion</Text>
            <TextInput style={s.input} value={direccion} onChangeText={setDireccion} placeholder="Direccion" placeholderTextColor={COLORS.textDisabled} />

            <View style={{ flexDirection: "row", gap: ios.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Provincia</Text>
                <TextInput style={s.input} value={provincia} onChangeText={setProvincia} placeholder="Provincia" placeholderTextColor={COLORS.textDisabled} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Poblacion</Text>
                <TextInput style={s.input} value={poblacion} onChangeText={setPoblacion} placeholder="Poblacion" placeholderTextColor={COLORS.textDisabled} />
              </View>
            </View>

            <Text style={s.fieldLabel}>Representante</Text>
            <TextInput style={s.input} value={representante} onChangeText={setRepresentante} placeholder="Representante" placeholderTextColor={COLORS.textDisabled} />

            <Text style={s.fieldLabel}>Telefono</Text>
            <TextInput style={s.input} value={telefono} onChangeText={setTelefono} placeholder="Telefono" placeholderTextColor={COLORS.textDisabled} keyboardType="phone-pad" />

            <Text style={s.fieldLabel}>Email</Text>
            <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={COLORS.textDisabled} keyboardType="email-address" autoCapitalize="none" />
          </View>

        {/* Direcciones */}
        <View style={s.section}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={s.sectionTitle}>DIRECCIONES</Text>
            <TouchableOpacity onPress={nuevaDireccion} style={s.addSmallBtn}>
              <Ionicons name="add" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          {direcciones.length === 0 ? (
            <Text style={{ color: COLORS.textDisabled, fontSize: ios.font.footnote.size, fontStyle: "italic" }}>Sin direcciones adicionales</Text>
          ) : (
            direcciones.map((d, idx) => (
              <View key={idx} style={{ borderBottomWidth: ios.hairline, borderBottomColor: COLORS.border, paddingVertical: ios.spacing.sm }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: ios.spacing.xs }}>
                  <Text style={{ fontWeight: "600", fontSize: ios.font.footnote.size, color: COLORS.textSecondary }}>Direccion {idx + 1}</Text>
                  <TouchableOpacity onPress={() => eliminarDireccion(idx)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.errorText} />
                  </TouchableOpacity>
                </View>
                <TextInput style={s.inputSmall} value={d.direccion} onChangeText={(v) => { const nd = [...direcciones]; nd[idx].direccion = v; setDirecciones(nd); }} placeholder="Direccion" placeholderTextColor={COLORS.textDisabled} />
                <TextInput style={s.inputSmall} value={d.representante} onChangeText={(v) => { const nd = [...direcciones]; nd[idx].representante = v; setDirecciones(nd); }} placeholder="Representante" placeholderTextColor={COLORS.textDisabled} />
                <View style={{ flexDirection: "row", gap: ios.spacing.sm }}>
                  <TextInput style={[s.inputSmall, { flex: 1 }]} value={d.telefono} onChangeText={(v) => { const nd = [...direcciones]; nd[idx].telefono = v; setDirecciones(nd); }} placeholder="Telefono" placeholderTextColor={COLORS.textDisabled} keyboardType="phone-pad" />
                  <TextInput style={[s.inputSmall, { flex: 1 }]} value={d.email} onChangeText={(v) => { const nd = [...direcciones]; nd[idx].email = v; setDirecciones(nd); }} placeholder="Email" placeholderTextColor={COLORS.textDisabled} keyboardType="email-address" autoCapitalize="none" />
                </View>
              </View>
            ))
          )}
        </View>

        {/* Mantenimiento */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>MANTENIMIENTO</Text>
          <TouchableOpacity style={s.switchRow} onPress={() => setMantenimiento(!mantenimiento)}>
            <Text style={s.switchLabel}>Mantenimiento contratado</Text>
            <View style={[s.toggle, mantenimiento && s.toggleOn]}>
              <View style={[s.toggleKnob, mantenimiento && s.toggleKnobOn]} />
            </View>
          </TouchableOpacity>
          {mantenimiento && (
            <>
              <Text style={s.fieldLabel}>Tipo de mantenimiento</Text>
              <TextInput style={s.input} value={tipoMantenimiento} onChangeText={setTipoMantenimiento} placeholder="Ej: Preventivo y correctivo" placeholderTextColor={COLORS.textDisabled} />
              <Text style={s.fieldLabel}>N revisiones al ano</Text>
               <TextInput style={s.input} value={revisiones} onChangeText={setRevisiones} placeholder="0" placeholderTextColor={COLORS.textDisabled} keyboardType="numeric" />
               <Text style={s.fieldLabel}>Alta mantenimiento</Text>
               <TextInput style={s.input} value={altaMantenimiento} onChangeText={setAltaMantenimiento} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textDisabled} />
               <Text style={s.fieldLabel}>Fecha primera revision</Text>
               <TextInput style={s.input} value={fechaPrimeraRevision} onChangeText={setFechaPrimeraRevision} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textDisabled} />
             </>
          )}
        </View>

        {/* Proyectos vinculados */}
        <TouchableOpacity style={s.section} onPress={() => setShowProy(!showProy)} activeOpacity={0.7}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={s.sectionTitle}>PROYECTOS ({proyectos.length})</Text>
            <Ionicons name={showProy ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textSecondary} />
          </View>
          {showProy && (
            <>
              {proyectos.length === 0 ? (
                <Text style={{ color: COLORS.textDisabled, fontSize: ios.font.footnote.size, fontStyle: "italic", marginTop: 8 }}>Sin proyectos vinculados</Text>
              ) : (
                proyectos.map((p: any) => (
                  <TouchableOpacity
                    key={p.id}
                    style={{ flexDirection: "row", alignItems: "center", paddingVertical: ios.spacing.sm, borderBottomWidth: ios.hairline, borderBottomColor: COLORS.border, gap: ios.spacing.sm }}
                    onPress={() => router.push(`/material/${p.id}`)}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: ios.font.callout.size, fontWeight: "600", color: COLORS.text }} numberOfLines={1}>
                        {p.materiales || "—"} {p.cliente ? `· ${p.cliente}` : ""}
                      </Text>
                      <Text style={{ fontSize: ios.font.caption.size, color: COLORS.textSecondary }}>
                        {p.updated_at ? new Date(p.updated_at).toLocaleDateString("es-ES") : ""}
                        {p.project_status ? ` · ${p.project_status}` : ""}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textDisabled} />
                  </TouchableOpacity>
                ))
              )}
            </>
          )}
        </TouchableOpacity>

        {/* Incidencias SAT */}
        <TouchableOpacity style={s.section} onPress={() => setShowInci(!showInci)} activeOpacity={0.7}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={s.sectionTitle}>INCIDENCIAS ({incidencias.length})</Text>
            <Ionicons name={showInci ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textSecondary} />
          </View>
          {showInci && (
            <>
              {incidencias.length === 0 ? (
                <Text style={{ color: COLORS.textDisabled, fontSize: ios.font.footnote.size, fontStyle: "italic", marginTop: 8 }}>Sin incidencias registradas</Text>
              ) : (
                incidencias.map((i: any) => (
                  <TouchableOpacity
                    key={i.id}
                    style={{ flexDirection: "row", alignItems: "center", paddingVertical: ios.spacing.sm, borderBottomWidth: ios.hairline, borderBottomColor: COLORS.border, gap: ios.spacing.sm }}
                    onPress={() => router.push(`/sat`)}
                    activeOpacity={0.6}
                  >
                    <Ionicons
                      name={i.status === "resuelta" ? "checkmark-circle" : i.status === "agendada" ? "calendar" : "alert-circle"}
                      size={20}
                      color={i.status === "resuelta" ? COLORS.syncedText : i.status === "agendada" ? COLORS.pendingText : COLORS.errorText}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: ios.font.callout.size, fontWeight: "600", color: COLORS.text }} numberOfLines={1}>
                        {i.observaciones || "Sin descripcion"}
                      </Text>
                      <Text style={{ fontSize: ios.font.caption.size, color: COLORS.textSecondary }}>
                        {i.created_at ? new Date(i.created_at).toLocaleDateString("es-ES") : ""} · {i.status || "pendiente"}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textDisabled} />
                  </TouchableOpacity>
                ))
              )}
            </>
          )}
        </TouchableOpacity>

        {/* Mantenimientos agendados */}
        <View style={s.section}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={s.sectionTitle}>MANTENIMIENTOS AGENDADOS ({mantenimientosList.length})</Text>
          </View>
          {mantenimientosList.length === 0 ? (
            <Text style={{ color: COLORS.textDisabled, fontSize: ios.font.footnote.size, fontStyle: "italic" }}>Sin mantenimientos agendados</Text>
          ) : (
            mantenimientosList.map((m: any) => (
              <View key={m.id} style={{ backgroundColor: COLORS.bg, borderRadius: ios.radius.md, padding: 12, marginTop: 8, borderWidth: 1, borderColor: COLORS.border }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontWeight: "700", color: COLORS.text, fontSize: 14 }}>{m.tipo || "Mantenimiento"}</Text>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: m.estado === "agendado" ? COLORS.primary : COLORS.textSecondary }}>
                    {m.estado}
                  </Text>
                </View>
                {(m.fechas || []).length > 0 && (
                  <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>
                    Fechas: {m.fechas.map((f: string) => f).join(", ")}
                  </Text>
                )}
                {m.fecha && (
                  <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>
                    Fecha: {m.fecha}
                  </Text>
                )}
                {m.observaciones ? (
                  <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4, fontStyle: "italic" }}>
                    {m.observaciones}
                  </Text>
                ) : null}
                <Text style={{ fontSize: 10, color: COLORS.textDisabled, marginTop: 4 }}>
                  {m.created_at ? new Date(m.created_at).toLocaleString("es-ES") : ""}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Documentos y Contratos */}
        <View
          ref={docsRef}
          style={[s.section, dragOver && { borderColor: COLORS.primary, borderWidth: 2, backgroundColor: COLORS.primarySoft }]}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 8 }} onPress={() => setShowDocs(!showDocs)} activeOpacity={0.7}>
            <Text style={s.sectionTitle}>DOCUMENTOS Y CONTRATOS ({documentos.length})</Text>
            <Ionicons name={showDocs ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleUploadDoc} style={{ padding: 4 }}>
              <Ionicons name="add-circle" size={22} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          {showDocs && (
            <>
              {documentos.length === 0 ? (
                <Text style={{ color: COLORS.textDisabled, fontSize: ios.font.footnote.size, fontStyle: "italic", marginTop: 8 }}>Sin documentos</Text>
              ) : (
                documentos.map((d: any) => (
                  <View key={d.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: ios.spacing.sm, borderBottomWidth: ios.hairline, borderBottomColor: COLORS.border, gap: ios.spacing.sm }}>
                    <TouchableOpacity style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }} onPress={() => {
                      const bytes = Uint8Array.from(atob(d.base64), c => c.charCodeAt(0));
                      const blob = new Blob([bytes], { type: d.mime_type || "application/pdf" });
                      window.open(URL.createObjectURL(blob), "_blank");
                    }}>
                      <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: ios.font.callout.size, fontWeight: "600", color: COLORS.text }} numberOfLines={1}>{d.nombre}</Text>
                        <Text style={{ fontSize: 10, color: COLORS.textDisabled }}>{new Date(d.created_at).toLocaleDateString("es-ES")}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={(e: any) => { if (e?.stopPropagation) e.stopPropagation(); e?.nativeEvent?.stopPropagation?.(); handleDeleteDoc(d.id, d.nombre); }} hitSlop={10}>
                      <Ionicons name="trash-outline" size={18} color={COLORS.errorText} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </>
          )}
        </View>

        <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.4 }]} onPress={guardar} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>GUARDAR CAMBIOS</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: ios.spacing.lg, paddingVertical: ios.spacing.sm,
    backgroundColor: COLORS.surface, borderBottomWidth: ios.hairline, borderBottomColor: COLORS.border,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: ios.font.title3.size, fontWeight: ios.font.title3.weight, color: COLORS.text },
  titleBlock: { gap: ios.spacing.xs },
  titleName: { fontSize: ios.font.title1.size, fontWeight: ios.font.title1.weight, color: COLORS.text },
  titleRazon: { fontSize: ios.font.callout.size, color: COLORS.textSecondary },
  titleMeta: { fontSize: ios.font.footnote.size, color: COLORS.textDisabled },
  section: {
    backgroundColor: COLORS.surface, borderRadius: ios.radius.lg, padding: ios.spacing.lg,
    borderWidth: 1, borderColor: COLORS.border, gap: ios.spacing.sm,
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
    height: 48, backgroundColor: COLORS.bg,
    borderWidth: 2, borderColor: COLORS.borderInput, borderRadius: ios.radius.md,
    paddingHorizontal: ios.spacing.md, fontSize: ios.font.callout.size, color: COLORS.text,
  },
  inputSmall: {
    height: 44, backgroundColor: COLORS.bg,
    borderWidth: 1, borderColor: COLORS.borderInput, borderRadius: ios.radius.sm,
    paddingHorizontal: ios.spacing.sm, fontSize: ios.font.footnote.size, color: COLORS.text,
    marginBottom: ios.spacing.xs,
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
  },
  toggleKnobOn: { alignSelf: "flex-end" },
  dirTitle: { fontSize: ios.font.callout.size, fontWeight: "600", color: COLORS.text },
  dirMeta: { flexDirection: "row", gap: ios.spacing.md, flexWrap: "wrap" },
  dirMetaText: { fontSize: ios.font.footnote.size, color: COLORS.textSecondary },
  addSmallBtn: {
    width: 36, height: 36, borderRadius: ios.radius.sm, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
  },
  saveBtn: {
    height: 52, borderRadius: ios.radius.card, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
  },
  saveBtnText: { color: "#fff", fontSize: ios.font.callout.size, fontWeight: "800", letterSpacing: 1 },
});
