import { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { api, clearToken, COLORS, getToken, BACKEND_URL } from "../../../src/api";
import { useThemedStyles } from "../../../src/theme";
import { ios, fontStyle } from "../../../src/ui/iosTheme";

type Linea = {
  concepto: string;
  cantidad_alcance: string;
  precio_alcance: string;
  cantidad_ejecutado: string;
  precio_ejecutado: string;
};

function emptyLinea(): Linea { return { concepto: "", cantidad_alcance: "", precio_alcance: "", cantidad_ejecutado: "", precio_ejecutado: "" }; }

function CertSection({ s, title, children }: { s: any; title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

function CertField({ s, label, value, onChange, placeholder, multiline, keyboardType }: {
  s: any; label?: string; value?: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; keyboardType?: any;
}) {
  return (
    <View style={{ gap: 4, flex: 1 }}>
      {label && <Text style={s.lbl}>{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textDisabled}
        multiline={multiline}
        keyboardType={keyboardType}
        style={[s.inp, multiline ? { minHeight: 80, textAlignVertical: "top" } : undefined]}
      />
    </View>
  );
}

function DatePickerWeb({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  useEffect(() => {
    const input = document.createElement("input");
    input.type = "date";
    input.value = value;
    input.style.position = "absolute";
    input.style.left = "-9999px";
    input.onchange = (e: any) => { onChange(e.target.value); };
    input.onblur = () => { setTimeout(() => { if (document.body.contains(input)) document.body.removeChild(input); }, 200); };
    document.body.appendChild(input);
    input.showPicker?.();
    return () => { if (document.body.contains(input)) document.body.removeChild(input); };
  }, []);
  return null;
}

export default function CertificacionEditor() {
  const router = useRouter();
  const p = useLocalSearchParams<{ id?: string; material_id?: string }>();
  const isNew = !p.id || p.id === "nuevo";
  const s = useThemedStyles(useS);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [certId, setCertId] = useState<string | null>(isNew ? null : String(p.id));
  const [showDate, setShowDate] = useState(false);

  const emptyLinea = (): Linea => ({ concepto: "", cantidad_alcance: "", precio_alcance: "", cantidad_ejecutado: "", precio_ejecutado: "" });

  const [f, setF] = useState<any>({
    material_id: p.material_id || "",
    nombre: "",
    cliente: "",
    direccion: "",
    poblacion: "",
    provincia: "",
    fecha_certificacion: "",
    lineas: [emptyLinea()],
    certificaciones_anteriores: "",
    iva: "21",
    observaciones: "",
  });

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      try {
        if (certId) {
          const c = await api.getCertificacion(certId);
          setF((prev: any) => ({
            ...prev,
            ...c,
            lineas: (c.lineas || []).length > 0 ? c.lineas.map((l: any) => ({
              concepto: l.concepto || "",
              cantidad_alcance: l.cantidad_alcance != null ? String(l.cantidad_alcance) : "",
              precio_alcance: l.precio_alcance != null ? String(l.precio_alcance) : "",
              cantidad_ejecutado: l.cantidad_ejecutado != null ? String(l.cantidad_ejecutado) : "",
              precio_ejecutado: l.precio_ejecutado != null ? String(l.precio_ejecutado) : "",
            })) : [emptyLinea()],
            certificaciones_anteriores: c.certificaciones_anteriores != null ? String(c.certificaciones_anteriores) : "",
            iva: c.iva != null ? String(c.iva) : "21",
          }));
        } else if (p.material_id) {
          try {
            const m = await api.getMaterial(p.material_id);
            if (m) {
              const existing = await api.listCertificaciones(p.material_id).catch(() => []);
              const num = (existing.length || 0) + 1;
              const projectName = m.materiales || "Sin nombre";
              const clientName = m.cliente ? ` - ${m.cliente}` : "";
              const today = new Date().toISOString().slice(0, 10);

              // Calcular total ejecutado de todas las certificaciones anteriores
              let certsAnteriores = 0;
              existing.forEach((c: any) => {
                (c.lineas || []).forEach((l: any) => {
                  certsAnteriores += (l.cantidad_ejecutado || 0) * (l.precio_ejecutado || 0);
                });
              });

              // Datos de la ultima certificacion como base
              const lastCert = existing.length > 0 ? existing[0] : null;
              const lastLineas = lastCert?.lineas?.length > 0
                ? lastCert.lineas.map((l: any) => ({
                    concepto: l.concepto || "",
                    cantidad_alcance: l.cantidad_alcance != null ? String(l.cantidad_alcance) : "",
                    precio_alcance: l.precio_alcance != null ? String(l.precio_alcance) : "",
                    cantidad_ejecutado: l.cantidad_ejecutado != null ? String(l.cantidad_ejecutado) : "",
                    precio_ejecutado: l.precio_ejecutado != null ? String(l.precio_ejecutado) : "",
                  }))
                : [emptyLinea()];

              setF((prev: any) => ({
                ...prev,
                material_id: p.material_id,
                nombre: `${projectName}${clientName} (Certificacion ${num} - ${today})`,
                cliente: lastCert?.cliente || m.cliente || "",
                poblacion: lastCert?.poblacion || "",
                fecha_certificacion: today,
                certificaciones_anteriores: certsAnteriores > 0 ? String(certsAnteriores) : "",
                iva: lastCert?.iva != null ? String(lastCert.iva) : "21",
                lineas: lastLineas,
              }));
            }
          } catch {}
        }
      } catch (e: any) {
        if (/401|expired/i.test(e?.message || "")) { await clearToken(); router.replace("/login"); }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []));

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const setLn = (idx: number, k: keyof Linea, v: string) => {
    setF((p: any) => ({
      ...p,
      lineas: p.lineas.map((l: Linea, i: number) => i === idx ? { ...l, [k]: v } : l),
    }));
  };
  const addLn = () => setF((p: any) => ({ ...p, lineas: [...p.lineas, emptyLinea()] }));
  const delLn = (idx: number) => setF((p: any) => ({ ...p, lineas: p.lineas.filter((_: any, i: number) => i !== idx) }));

  const toNum = (v: string) => {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  };

  const saveCert = async (): Promise<string | null> => {
    setSaving(true);
    try {
      const payload: any = {
        material_id: f.material_id,
        nombre: f.nombre || "",
        cliente: f.cliente || "",
        direccion: f.direccion || "",
        poblacion: f.poblacion || "",
        provincia: f.provincia || "",
        fecha_certificacion: f.fecha_certificacion || "",
        lineas: f.lineas.map((l: Linea) => ({
          concepto: l.concepto || "",
          cantidad_alcance: l.cantidad_alcance ? toNum(l.cantidad_alcance) : null,
          precio_alcance: l.precio_alcance ? toNum(l.precio_alcance) : null,
          cantidad_ejecutado: l.cantidad_ejecutado ? toNum(l.cantidad_ejecutado) : null,
          precio_ejecutado: l.precio_ejecutado ? toNum(l.precio_ejecutado) : null,
        })),
        certificaciones_anteriores: f.certificaciones_anteriores ? toNum(f.certificaciones_anteriores) : null,
        iva: f.iva ? toNum(f.iva) : 21,
        observaciones: f.observaciones || "",
      };
      if (certId) {
        await api.updateCertificacion(certId, payload);
        return certId;
      } else {
        const c = await api.createCertificacion(payload);
        setCertId(c.id);
        return c.id;
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo guardar");
      return null;
    } finally { setSaving(false); }
  };

  const exportExcel = async () => {
    const id = await saveCert();
    if (!id) return;
    const token = await getToken();
    const url = `${BACKEND_URL}/api/certificaciones/${id}/excel`;
    window.open(`${url}?token=${encodeURIComponent(token || "")}`, "_blank");
  };

  const exportPdf = async () => {
    const id = await saveCert();
    if (!id) return;
    const token = await getToken();
    const url = `${BACKEND_URL}/api/certificaciones/${id}/pdf`;
    window.open(`${url}?token=${encodeURIComponent(token || "")}`, "_blank");
  };

  const del = () => {
    if (!certId) { router.back(); return; }
    Alert.alert("Eliminar certificacion", "¿Seguro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: async () => {
        try { await api.deleteCertificacion(certId); router.back(); }
        catch (e: any) { Alert.alert("Error", e.message); }
      }},
    ]);
  };

  const totalAlcance = f.lineas.reduce((sum: number, l: Linea) => sum + toNum(l.cantidad_alcance) * toNum(l.precio_alcance), 0);
  const totalEjecutado = f.lineas.reduce((sum: number, l: Linea) => sum + toNum(l.cantidad_ejecutado) * toNum(l.precio_ejecutado), 0);
  const anteriores = toNum(f.certificaciones_anteriores);
  const ivaPct = toNum(f.iva);
  const totalCertificacion = totalEjecutado - anteriores;
  const acumulado = totalEjecutado + anteriores;
  const ivaImp = Math.round(totalCertificacion * ivaPct) / 100;
  const liquido = totalCertificacion + ivaImp;

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => {
          try { if (router.canGoBack && router.canGoBack()) { router.back(); return; } } catch {}
          router.replace("/materiales");
        }}>
          <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>
          {certId ? "Editar certificacion" : "Nueva certificacion"}
        </Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {certId && (
            <TouchableOpacity style={s.iconBtn} onPress={del}>
              <Ionicons name="trash-outline" size={22} color={COLORS.errorText} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.iconBtn, { backgroundColor: COLORS.primary }]} onPress={saveCert} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="save" size={20} color="#fff" />}
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView contentContainerStyle={[s.scroll]}>
         <CertSection s={s} title="DATOS DE LA CERTIFICACION">
           <CertField s={s} label="Nombre proyecto" value={f.nombre} onChange={(v) => set("nombre", v)} />
           <CertField s={s} label="Cliente" value={f.cliente} onChange={(v) => set("cliente", v)} />
           <CertField s={s} label="Poblacion" value={f.poblacion} onChange={(v) => set("poblacion", v)} />
           <View style={{ gap: 4 }}>
             <Text style={s.lbl}>Fecha certificacion</Text>
             <TouchableOpacity
               style={[s.inp, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}
               onPress={() => setShowDate(!showDate)}
             >
               <Text style={{ color: f.fecha_certificacion ? COLORS.text : COLORS.textDisabled }}>
                 {f.fecha_certificacion || "Seleccionar fecha"}
               </Text>
               <Ionicons name="calendar-outline" size={16} color={COLORS.textSecondary} />
             </TouchableOpacity>
             {showDate && Platform.OS !== "web" && (
               <DateTimePicker
                 value={f.fecha_certificacion ? new Date(f.fecha_certificacion + "T00:00:00") : new Date()}
                 mode="date"
                 display="default"
                 onChange={(ev: any, d?: Date) => {
                   setShowDate(false);
                   if (d) {
                     const y = d.getFullYear();
                     const m = String(d.getMonth() + 1).padStart(2, "0");
                     const day = String(d.getDate()).padStart(2, "0");
                     set("fecha_certificacion", `${y}-${m}-${day}`);
                   }
                 }}
               />
             )}
             {showDate && Platform.OS === "web" && (
               <DatePickerWeb value={f.fecha_certificacion} onChange={(v) => { set("fecha_certificacion", v); setShowDate(false); }} />
             )}
           </View>
        </CertSection>

        <CertSection s={s} title="LINEAS DE CERTIFICACION">
          <View style={s.eqHeader}>
            <Text style={[s.eqHeaderTxt, { flex: 2 }]}>Concepto</Text>
            <Text style={[s.eqHeaderTxt, { flex: 0.7, textAlign: "center" }]}>Cant. Alc.</Text>
            <Text style={[s.eqHeaderTxt, { flex: 0.8, textAlign: "center" }]}>P.U. Alc.</Text>
            <Text style={[s.eqHeaderTxt, { flex: 0.8, textAlign: "right" }]}>Total Alc.</Text>
            <Text style={[s.eqHeaderTxt, { flex: 0.7, textAlign: "center" }]}>Cant. Eje.</Text>
            <Text style={[s.eqHeaderTxt, { flex: 0.8, textAlign: "center" }]}>P.U. Eje.</Text>
            <Text style={[s.eqHeaderTxt, { flex: 0.8, textAlign: "right" }]}>Total Eje.</Text>
            <View style={{ width: 28 }} />
          </View>
          {f.lineas.map((l: Linea, i: number) => {
            const totA = toNum(l.cantidad_alcance) * toNum(l.precio_alcance);
            const totE = toNum(l.cantidad_ejecutado) * toNum(l.precio_ejecutado);
            return (
              <View key={i} style={s.eqRow}>
                <TextInput value={l.concepto} onChangeText={(v) => setLn(i, "concepto", v)} style={[s.eqInp, { flex: 2 }]} placeholder="Concepto" placeholderTextColor={COLORS.textDisabled} />
                <TextInput value={l.cantidad_alcance} onChangeText={(v) => setLn(i, "cantidad_alcance", v)} style={[s.eqInp, { flex: 0.7, textAlign: "center" }]} placeholder="0" placeholderTextColor={COLORS.textDisabled} keyboardType="numeric" />
                <TextInput value={l.precio_alcance} onChangeText={(v) => setLn(i, "precio_alcance", v)} style={[s.eqInp, { flex: 0.8, textAlign: "center" }]} placeholder="0" placeholderTextColor={COLORS.textDisabled} keyboardType="numeric" />
                <View style={[s.eqInpR, { flex: 0.8 }]}>
                  <Text style={s.eqInpRTxt}>{totA.toFixed(2)}</Text>
                </View>
                <TextInput value={l.cantidad_ejecutado} onChangeText={(v) => setLn(i, "cantidad_ejecutado", v)} style={[s.eqInp, { flex: 0.7, textAlign: "center" }]} placeholder="0" placeholderTextColor={COLORS.textDisabled} keyboardType="numeric" />
                <TextInput value={l.precio_ejecutado} onChangeText={(v) => setLn(i, "precio_ejecutado", v)} style={[s.eqInp, { flex: 0.8, textAlign: "center" }]} placeholder="0" placeholderTextColor={COLORS.textDisabled} keyboardType="numeric" />
                <View style={[s.eqInpR, { flex: 0.8 }]}>
                  <Text style={s.eqInpRTxt}>{totE.toFixed(2)}</Text>
                </View>
                <TouchableOpacity onPress={() => delLn(i)} style={s.eqDelBtn}>
                  <Ionicons name="close" size={16} color={COLORS.errorText} />
                </TouchableOpacity>
              </View>
            );
          })}
          <TouchableOpacity style={s.addRow} onPress={addLn}>
            <Ionicons name="add" size={18} color={COLORS.primary} />
            <Text style={s.addRowTxt}>Anadir fila</Text>
          </TouchableOpacity>
        </CertSection>

        <CertSection s={s} title="TOTALES">
          <View style={s.totalsGrid}>
            <View style={s.totalRow}>
              <Text style={s.totalLbl}>Total Alcance</Text>
              <Text style={s.totalVal}>{totalAlcance.toFixed(2)} €</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLbl}>Total Ejecutado</Text>
              <Text style={s.totalVal}>{totalEjecutado.toFixed(2)} €</Text>
            </View>
            <View style={[s.totalRow, { backgroundColor: COLORS.primarySoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 4 }]}>
              <Text style={[s.totalLbl, { fontWeight: "800" }]}>Total Certificacion</Text>
              <Text style={[s.totalVal, { fontWeight: "800", color: totalCertificacion >= 0 ? COLORS.syncedText : COLORS.errorText }]}>
                {totalCertificacion.toFixed(2)} €
              </Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLbl}>Certificaciones anteriores (€)</Text>
              <TextInput
                value={f.certificaciones_anteriores}
                onChangeText={(v) => set("certificaciones_anteriores", v)}
                placeholder="0"
                placeholderTextColor={COLORS.textDisabled}
                keyboardType="numeric"
                style={s.totalInp}
              />
            </View>
            <View style={[s.totalRow, { backgroundColor: COLORS.primarySoft, borderRadius: 8, padding: 10 }]}>
              <Text style={[s.totalLbl, { fontWeight: "800" }]}>Total acumulado</Text>
              <Text style={[s.totalVal, { fontWeight: "800", color: COLORS.primary }]}>{acumulado.toFixed(2)} €</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLbl}>IVA (%)</Text>
              <TextInput
                value={f.iva}
                onChangeText={(v) => set("iva", v)}
                placeholder="21"
                placeholderTextColor={COLORS.textDisabled}
                keyboardType="numeric"
                style={s.totalInp}
              />
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLbl}>IVA ({ivaPct}%)</Text>
              <Text style={s.totalVal}>{ivaImp.toFixed(2)} €</Text>
            </View>
            <View style={[s.totalRow, { backgroundColor: COLORS.syncedBg, borderRadius: 8, padding: 10 }]}>
              <Text style={[s.totalLbl, { fontWeight: "800", fontSize: 16, color: COLORS.syncedText }]}>Liquido a percibir</Text>
              <Text style={[s.totalVal, { fontWeight: "900", fontSize: 16, color: COLORS.syncedText }]}>{liquido.toFixed(2)} €</Text>
            </View>
          </View>
        </CertSection>

        <CertSection s={s} title="OBSERVACIONES">
          <CertField s={s} multiline value={f.observaciones} onChange={(v) => set("observaciones", v)} placeholder="Observaciones..." />
        </CertSection>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <TouchableOpacity style={[s.bigBtn, { backgroundColor: COLORS.primary, flex: 1 }]} onPress={exportExcel}>
            <Ionicons name="document-text" size={22} color="#fff" />
            <Text style={s.bigBtnTxt}>Exportar Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.bigBtn, { backgroundColor: COLORS.accent, flex: 1 }]} onPress={exportPdf}>
            <Ionicons name="document-text" size={22} color="#fff" />
            <Text style={s.bigBtnTxt}>Exportar PDF</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[s.bigBtn, { backgroundColor: "#10B981", marginBottom: 40 }]} onPress={saveCert}>
          <Ionicons name="save" size={22} color="#fff" />
          <Text style={s.bigBtnTxt}>Guardar</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: ios.spacing.md, paddingVertical: 10, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "800", color: COLORS.text, letterSpacing: -0.3 },
  iconBtn: { width: 40, height: 40, borderRadius: ios.radius.md, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  scroll: { padding: ios.spacing.lg, paddingBottom: 40, gap: ios.spacing.lg },
  section: {
    backgroundColor: COLORS.surface, padding: ios.spacing.lg, borderRadius: ios.radius.lg,
    borderWidth: 1, borderColor: COLORS.border, gap: 12, overflow: "visible",
    ...ios.shadow.card,
  },
  sectionTitle: { ...fontStyle("section"), color: COLORS.primary, textTransform: "uppercase" as any },
  lbl: { ...fontStyle("caption"), fontWeight: "800" as any, color: COLORS.textSecondary, marginBottom: 2 },
  inp: {
    backgroundColor: COLORS.bg, borderRadius: ios.radius.md, borderWidth: 2, borderColor: COLORS.borderInput,
    paddingHorizontal: ios.spacing.md, paddingVertical: 12, fontSize: 14, color: COLORS.text,
  },
  eqHeader: { flexDirection: "row", gap: 4, paddingHorizontal: ios.spacing.xs, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 4 },
  eqHeaderTxt: { ...fontStyle("caption"), color: COLORS.textSecondary, fontWeight: "800" as any },
  eqRow: { flexDirection: "row", gap: 4, alignItems: "center", paddingVertical: 4 },
  eqDelBtn: {
    width: 30, height: 30, borderRadius: ios.radius.sm,
    backgroundColor: COLORS.errorBg, alignItems: "center", justifyContent: "center",
  },
  eqInp: { backgroundColor: COLORS.bg, borderRadius: ios.radius.sm, paddingHorizontal: 8, paddingVertical: 10, fontSize: 12, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  eqInpR: {
    backgroundColor: COLORS.readonly, borderRadius: ios.radius.sm, paddingHorizontal: 8, paddingVertical: 10,
    alignItems: "flex-end", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border,
  },
  eqInpRTxt: { fontSize: 12, fontWeight: "700", color: COLORS.text },
  addRow: {
    flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start",
    paddingHorizontal: ios.spacing.lg, paddingVertical: 10, borderRadius: ios.radius.sm,
    backgroundColor: COLORS.bg, borderWidth: 2, borderColor: COLORS.primary, borderStyle: "dashed" as any,
  },
  addRowTxt: { color: COLORS.primary, fontWeight: "800", fontSize: 14 },
  totalsGrid: { gap: 8 },
  totalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 6, paddingHorizontal: 8,
  },
  totalLbl: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  totalVal: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  totalInp: {
    backgroundColor: COLORS.bg, borderRadius: ios.radius.sm, borderWidth: 2, borderColor: COLORS.borderInput,
    paddingHorizontal: ios.spacing.md, paddingVertical: 8, fontSize: 14, color: COLORS.text,
    width: 100, textAlign: "right",
  },
  bigBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 56, borderRadius: ios.radius.card },
  bigBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 16, letterSpacing: 0.5 },
});
