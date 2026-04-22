import { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import { api, clearToken, COLORS } from "../../src/api";
import ResponsiveLayout from "../../src/ResponsiveLayout";
import { useBreakpoint } from "../../src/useBreakpoint";
import SignaturePad from "../../src/SignaturePad";

type Equipo = { elemento: string; cantidad?: string; ubicacion?: string; observaciones?: string };

export default function BudgetEditor() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; material_id?: string }>();
  const isNew = !params.id || params.id === "nuevo";
  const { isWide } = useBreakpoint();

  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [budgetId, setBudgetId] = useState<string | null>(isNew ? null : String(params.id));
  const [defaultEquipos, setDefaultEquipos] = useState<string[]>([]);

  // Form state
  const [f, setF] = useState<any>({
    n_proyecto: "", cliente: "", nombre_instalacion: "", direccion: "",
    contacto_1: "", contacto_2: "",
    observaciones_presupuesto: "",
    fecha_inicio: "", fecha_fin: "",
    observaciones_ejecucion: "",
    equipos: [] as Equipo[],
    entrega_tarjeta_mantenimiento: false,
    entrega_llave_salto: false,
    entrega_eps100: false,
    firma_isai: "", nombre_isai: "", cargo_isai: "",
    firma_cliente: "", nombre_cliente: "", cargo_cliente: "",
    material_id: params.material_id || null,
  });

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      try {
        const u = await api.me();
        if (!alive) return;
        setMe(u);
        if (u.role !== "admin" && u.role !== "comercial") {
          Alert.alert("Acceso restringido", "Solo admins y comerciales");
          router.replace("/home"); return;
        }
        // Always load default equipment suggestions (used by the combo)
        try {
          const def = await api.budgetsDefaultEquipos();
          setDefaultEquipos(def.items || []);
        } catch {}
        if (budgetId) {
          const b = await api.getBudget(budgetId);
          setF((prev: any) => ({ ...prev, ...b }));
        } else {
          // Start with one empty equipo row (user fills with combo or free text)
          setF((prev: any) => ({
            ...prev,
            equipos: [{ elemento: "", cantidad: "", ubicacion: "", observaciones: "" }],
          }));
          if (params.material_id) {
            try {
              const m = await (api as any).getMaterial?.(params.material_id);
              if (m) {
                setF((prev: any) => ({
                  ...prev,
                  n_proyecto: m.materiales || "",
                  cliente: m.cliente || "",
                  nombre_instalacion: m.cliente || "",
                  direccion: m.ubicacion || "",
                  material_id: m.id,
                }));
              }
            } catch {}
          }
        }
      } catch (e: any) {
        if (/401|expired/i.test(e?.message || "")) { await clearToken(); router.replace("/login"); }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []));

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const setEq = (idx: number, k: keyof Equipo, v: string) => {
    setF((p: any) => ({
      ...p,
      equipos: p.equipos.map((e: Equipo, i: number) => i === idx ? { ...e, [k]: v } : e),
    }));
  };
  const addEq = () => setF((p: any) => ({ ...p, equipos: [...p.equipos, { elemento: "", cantidad: "", ubicacion: "", observaciones: "" }] }));
  const delEq = (idx: number) => setF((p: any) => ({ ...p, equipos: p.equipos.filter((_: any, i: number) => i !== idx) }));

  const saveBudget = async (): Promise<string | null> => {
    setSaving(true);
    try {
      if (budgetId) {
        await api.updateBudget(budgetId, f);
        return budgetId;
      } else {
        const b = await api.createBudget(f);
        setBudgetId(b.id);
        return b.id;
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo guardar");
      return null;
    } finally { setSaving(false); }
  };

  const generatePdf = async () => {
    const id = await saveBudget();
    if (!id) return;
    try {
      if (Platform.OS === "web") {
        // Fetch the PDF (generated from exact template with editable AcroForm fields)
        const blob = await api.getBudgetPdfBlob(id);
        const url = URL.createObjectURL(blob);
        const baseName = (f.n_proyecto || id).toString().replace(/[^\w.-]+/g, "_").slice(0, 40) || "hoja";
        // Try open in new tab; browsers will allow downloading from the PDF viewer
        const w = window.open(url, "_blank");
        if (!w) {
          // fallback: force download
          const a = document.createElement("a");
          a.href = url;
          a.download = `hoja_instalacion_${baseName}.pdf`;
          document.body.appendChild(a); a.click(); a.remove();
        }
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
      } else {
        // Native: download blob, write to FS, share
        const blob = await api.getBudgetPdfBlob(id);
        const reader = new FileReader();
        const b64: string = await new Promise((res, rej) => {
          reader.onload = () => res(String(reader.result || "").split(",").pop() || "");
          reader.onerror = () => rej(reader.error);
          reader.readAsDataURL(blob);
        });
        const FS = await import("expo-file-system/legacy");
        const baseName = (f.n_proyecto || id).toString().replace(/[^\w.-]+/g, "_").slice(0, 40) || "hoja";
        const uri = `${FS.cacheDirectory}hoja_instalacion_${baseName}.pdf`;
        await FS.writeAsStringAsync(uri, b64, { encoding: FS.EncodingType.Base64 });
        const Sharing = await import("expo-sharing").catch(() => null as any);
        if (Sharing?.isAvailableAsync && await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: "application/pdf",
            dialogTitle: "Hoja de instalación",
            UTI: "com.adobe.pdf",
          });
        } else {
          Alert.alert("PDF guardado", uri);
        }
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo generar PDF");
    }
  };

  const del = () => {
    if (!budgetId) { router.back(); return; }
    Alert.alert("Eliminar presupuesto", "¿Seguro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: async () => {
        try { await api.deleteBudget(budgetId); router.replace("/presupuestos"); }
        catch (e: any) { Alert.alert("Error", e.message); }
      }},
    ]);
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  return (
    <ResponsiveLayout active="presupuestos" isAdmin={me?.role === "admin"} userName={me?.name}
      onLogout={async () => { await clearToken(); router.replace("/login"); }}>
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => {
          try { if (router.canGoBack && router.canGoBack()) { router.back(); return; } } catch {}
          router.replace("/presupuestos");
        }}>
          <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>
          {budgetId ? "Editar presupuesto" : "Nuevo presupuesto"}
        </Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {budgetId && (
            <TouchableOpacity style={s.iconBtn} onPress={del}>
              <Ionicons name="trash-outline" size={22} color={COLORS.errorText} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.iconBtn, { backgroundColor: COLORS.primary }]} onPress={saveBudget} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="save" size={20} color="#fff" />}
          </TouchableOpacity>
          <TouchableOpacity style={[s.iconBtn, { backgroundColor: "#8B5CF6" }]} onPress={generatePdf}>
            <Ionicons name="document-text" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView contentContainerStyle={[s.scroll, isWide && { maxWidth: 900, alignSelf: "center", width: "100%" }]}>
        <Section title="DATOS DEL PROYECTO">
          <Field label="Nº Proyecto" value={f.n_proyecto} onChange={(v) => set("n_proyecto", v)} />
          <Field label="Cliente" value={f.cliente} onChange={(v) => set("cliente", v)} />
          <Field label="Nombre instalación" value={f.nombre_instalacion} onChange={(v) => set("nombre_instalacion", v)} />
          <Field label="Dirección" value={f.direccion} onChange={(v) => set("direccion", v)} />
          <Field label="Contacto 1" value={f.contacto_1} onChange={(v) => set("contacto_1", v)} />
          <Field label="Contacto 2" value={f.contacto_2} onChange={(v) => set("contacto_2", v)} />
        </Section>

        <Section title="OBSERVACIONES PRESUPUESTO">
          <Field multiline value={f.observaciones_presupuesto} onChange={(v) => set("observaciones_presupuesto", v)} />
        </Section>

        <Section title="FECHAS INSTALACIÓN">
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Field label="Inicio" value={f.fecha_inicio} onChange={(v) => set("fecha_inicio", v)} placeholder="DD/MM/AAAA" />
            <Field label="Fin" value={f.fecha_fin} onChange={(v) => set("fecha_fin", v)} placeholder="DD/MM/AAAA" />
          </View>
        </Section>

        <Section title="OBSERVACIONES EJECUCIÓN">
          <Field multiline value={f.observaciones_ejecucion} onChange={(v) => set("observaciones_ejecucion", v)} />
        </Section>

        <Section title="LISTADO DE EQUIPOS">
          <View style={s.eqHeader}>
            <Text style={[s.eqHeaderTxt, { flex: 2 }]}>ELEMENTO</Text>
            <Text style={[s.eqHeaderTxt, { flex: 0.6 }]}>CANT</Text>
            <Text style={[s.eqHeaderTxt, { flex: 1.2 }]}>UBICACIÓN</Text>
            <Text style={[s.eqHeaderTxt, { flex: 1.5 }]}>OBSERV.</Text>
            <View style={{ width: 28 }} />
          </View>
          {f.equipos.map((e: Equipo, i: number) => (
            <View key={i} style={s.eqRow}>
              <ElementoCombo
                value={e.elemento}
                onChange={(v) => setEq(i, "elemento", v)}
                suggestions={defaultEquipos}
                style={{ flex: 2 }}
              />
              <TextInput value={e.cantidad} onChangeText={(v) => setEq(i, "cantidad", v)} style={[s.eqInp, { flex: 0.6 }]} placeholder="0" placeholderTextColor={COLORS.textDisabled} keyboardType="number-pad" />
              <TextInput value={e.ubicacion} onChangeText={(v) => setEq(i, "ubicacion", v)} style={[s.eqInp, { flex: 1.2 }]} placeholder="—" placeholderTextColor={COLORS.textDisabled} />
              <TextInput value={e.observaciones} onChangeText={(v) => setEq(i, "observaciones", v)} style={[s.eqInp, { flex: 1.5 }]} placeholder="—" placeholderTextColor={COLORS.textDisabled} />
              <TouchableOpacity onPress={() => delEq(i)} style={{ width: 28, alignItems: "center" }}>
                <Ionicons name="close" size={18} color={COLORS.errorText} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={s.addRow} onPress={addEq}>
            <Ionicons name="add" size={18} color={COLORS.primary} />
            <Text style={s.addRowTxt}>Añadir fila</Text>
          </TouchableOpacity>
        </Section>

        <Section title="ENTREGAS">
          <Check label="Entrega tarjeta mantenimiento" value={f.entrega_tarjeta_mantenimiento} onChange={(v) => set("entrega_tarjeta_mantenimiento", v)} />
          <Check label="Entrega de llave técnica Salto (cilindro/mini)" value={f.entrega_llave_salto} onChange={(v) => set("entrega_llave_salto", v)} />
          <Check label="Entrega EPS100" value={f.entrega_eps100} onChange={(v) => set("entrega_eps100", v)} />
        </Section>

        <Section title="FIRMA I-SAI">
          <SignaturePad value={f.firma_isai} onChange={(v) => set("firma_isai", v)} />
          <Field label="Nombre y Apellidos" value={f.nombre_isai} onChange={(v) => set("nombre_isai", v)} />
          <Field label="Cargo" value={f.cargo_isai} onChange={(v) => set("cargo_isai", v)} />
        </Section>

        <Section title="FIRMA CLIENTE">
          <SignaturePad value={f.firma_cliente} onChange={(v) => set("firma_cliente", v)} />
          <Field label="Nombre y Apellidos" value={f.nombre_cliente} onChange={(v) => set("nombre_cliente", v)} />
          <Field label="Cargo" value={f.cargo_cliente} onChange={(v) => set("cargo_cliente", v)} />
        </Section>

        <TouchableOpacity style={[s.bigBtn, { backgroundColor: "#8B5CF6" }]} onPress={generatePdf}>
          <Ionicons name="document-text" size={22} color="#fff" />
          <Text style={s.bigBtnTxt}>Guardar y generar PDF</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
    </ResponsiveLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}
function Field({ label, value, onChange, placeholder, multiline }: any) {
  return (
    <View style={{ gap: 4, flex: 1 }}>
      {label && <Text style={s.lbl}>{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textDisabled}
        multiline={multiline}
        style={[s.inp, multiline && { minHeight: 80, textAlignVertical: "top" }]}
      />
    </View>
  );
}
function Check({ label, value, onChange }: any) {
  return (
    <TouchableOpacity style={s.check} onPress={() => onChange(!value)} activeOpacity={0.7}>
      <View style={[s.checkBox, value && s.checkBoxOn]}>
        {value && <Ionicons name="checkmark" size={16} color="#fff" />}
      </View>
      <Text style={s.checkLbl}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * Combobox editable: texto libre + botón desplegable con sugerencias.
 * El usuario puede escribir manualmente o elegir uno de los preestablecidos.
 */
function ElementoCombo({ value, onChange, suggestions, style }: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  style?: any;
}) {
  const [open, setOpen] = useState(false);
  const q = (value || "").toLowerCase().trim();
  const filtered = q
    ? suggestions.filter((it) => it.toLowerCase().includes(q))
    : suggestions;
  const showList = open && filtered.length > 0;

  return (
    <View style={[{ position: "relative", zIndex: open ? 50 : 1 }, style]}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <TextInput
          testID="elemento-input"
          value={value}
          onChangeText={(v) => { onChange(v); if (v.length > 0 && !open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          style={[s.eqInp, { flex: 1, paddingRight: 28 }]}
          placeholder="Elemento (escribir o elegir…)"
          placeholderTextColor={COLORS.textDisabled}
        />
        <TouchableOpacity
          testID="elemento-dropdown"
          style={{ position: "absolute", right: 2, padding: 4 }}
          onPress={() => setOpen((v) => !v)}
        >
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      {showList && (
        <View style={s.comboList}>
          <ScrollView
            style={{ maxHeight: 220 }}
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled
          >
            {filtered.slice(0, 50).map((it, idx) => (
              <TouchableOpacity
                key={idx}
                style={s.comboItem}
                onPress={() => { onChange(it); setOpen(false); }}
              >
                <Text style={s.comboItemTxt}>{it}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}


function renderPdfHtml(f: any): string {
  const row = (label: string, v: string) => `<tr><td style="font-weight:700;padding:4px 8px;width:35%;border-bottom:1px solid #ccc">${label}</td><td style="padding:4px 8px;border-bottom:1px solid #ccc">${escapeHtml(v || "")}</td></tr>`;
  const check = (v: boolean) => v ? "☑" : "☐";
  const eqRows = (f.equipos || []).map((e: any) => `<tr>
    <td style="padding:4px 6px;border:1px solid #999">${check(!!e.elemento)} ${escapeHtml(e.elemento || "")}</td>
    <td style="padding:4px 6px;border:1px solid #999;text-align:center">${escapeHtml(e.cantidad || "")}</td>
    <td style="padding:4px 6px;border:1px solid #999">${escapeHtml(e.ubicacion || "")}</td>
    <td style="padding:4px 6px;border:1px solid #999">${escapeHtml(e.observaciones || "")}</td>
  </tr>`).join("");
  return `<html><head><meta charset="utf-8"><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#0F172A;margin:28px;font-size:12px}
    h1{font-size:22px;color:#3B82F6;margin:0 0 6px}
    h2{font-size:14px;color:#0F172A;margin:18px 0 8px;padding-bottom:4px;border-bottom:2px solid #3B82F6}
    table.info{width:100%;border-collapse:collapse;margin-bottom:10px}
    table.eq{width:100%;border-collapse:collapse;margin-top:6px}
    table.eq th{background:#3B82F6;color:#fff;padding:6px;border:1px solid #1e40af}
    .box{border:1px solid #999;padding:8px;min-height:50px;border-radius:4px}
    .sign{display:flex;gap:20px;margin-top:20px}
    .signCard{flex:1;border:1px solid #999;padding:10px;border-radius:6px}
    .signImg{height:80px;margin:8px 0;border-bottom:1px solid #999}
    .brand{display:flex;justify-content:space-between;align-items:center}
    .logo{font-weight:900;color:#3B82F6;font-size:18px}
    .sub{color:#64748B;font-size:10px}
    @media print{.nop{display:none}}
  </style></head><body>
    <div class="brand">
      <div><div class="logo">i-SAI</div><div class="sub">PARTNER SALTO</div></div>
      <h1>HOJA DE INSTALACIÓN</h1>
    </div>
    <table class="info">
      ${row("Nº Proyecto", f.n_proyecto)}
      ${row("Cliente", f.cliente)}
      ${row("Nombre instalación", f.nombre_instalacion)}
      ${row("Dirección", f.direccion)}
      ${row("Contacto 1", f.contacto_1)}
      ${row("Contacto 2", f.contacto_2)}
    </table>
    <h2>Observaciones presupuesto</h2>
    <div class="box">${escapeHtml(f.observaciones_presupuesto || "")}</div>
    <h2>Fechas instalación</h2>
    <table class="info">
      ${row("Fecha inicio", f.fecha_inicio)}
      ${row("Fecha fin", f.fecha_fin)}
    </table>
    <h2>Observaciones ejecución</h2>
    <div class="box">${escapeHtml(f.observaciones_ejecucion || "")}</div>
    <h2>LISTADO DE EQUIPOS</h2>
    <table class="eq">
      <thead><tr><th>ELEMENTO</th><th style="width:60px">CANT</th><th style="width:120px">UBICACIÓN</th><th style="width:160px">OBSERVACIONES</th></tr></thead>
      <tbody>${eqRows}</tbody>
    </table>
    <h2>Entregas</h2>
    <div>${check(!!f.entrega_tarjeta_mantenimiento)} Entrega tarjeta mantenimiento</div>
    <div>${check(!!f.entrega_llave_salto)} Entrega de llave técnica Salto (cilindro/mini)</div>
    <div>${check(!!f.entrega_eps100)} Entrega EPS100</div>
    <div class="sign">
      <div class="signCard">
        <div style="font-weight:800">FIRMA I-SAI</div>
        ${f.firma_isai ? `<img class="signImg" src="${f.firma_isai}" style="max-width:100%;height:80px;object-fit:contain"/>` : `<div class="signImg"></div>`}
        <div><b>Nombre:</b> ${escapeHtml(f.nombre_isai || "")}</div>
        <div><b>Cargo:</b> ${escapeHtml(f.cargo_isai || "")}</div>
      </div>
      <div class="signCard">
        <div style="font-weight:800">FIRMA CLIENTE</div>
        ${f.firma_cliente ? `<img class="signImg" src="${f.firma_cliente}" style="max-width:100%;height:80px;object-fit:contain"/>` : `<div class="signImg"></div>`}
        <div><b>Nombre:</b> ${escapeHtml(f.nombre_cliente || "")}</div>
        <div><b>Cargo:</b> ${escapeHtml(f.cargo_cliente || "")}</div>
      </div>
    </div>
  </body></html>`;
}
function escapeHtml(s: string): string {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]);
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "800", color: COLORS.text },
  iconBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, paddingBottom: 40, gap: 16 },
  section: { backgroundColor: COLORS.surface, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, gap: 10 },
  sectionTitle: { fontSize: 12, fontWeight: "900", color: COLORS.primary, letterSpacing: 1.5 },
  lbl: { fontSize: 11, fontWeight: "800", color: COLORS.textSecondary, letterSpacing: 0.8 },
  inp: {
    backgroundColor: COLORS.bg, borderRadius: 10, borderWidth: 2, borderColor: COLORS.borderInput,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.text,
  },
  eqHeader: { flexDirection: "row", gap: 4, paddingHorizontal: 4, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  eqHeaderTxt: { fontSize: 10, fontWeight: "900", color: COLORS.textSecondary, letterSpacing: 1 },
  eqRow: { flexDirection: "row", gap: 4, alignItems: "center" },
  eqInp: { backgroundColor: COLORS.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, fontSize: 13, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  comboList: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 2,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    zIndex: 100,
    // web box-shadow (RN web maps this)
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  comboItem: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  comboItemTxt: { fontSize: 13, color: COLORS.text },
  addRow: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: COLORS.bg, borderWidth: 2, borderColor: COLORS.primary, borderStyle: "dashed" as any,
  },
  addRowTxt: { color: COLORS.primary, fontWeight: "800", fontSize: 13 },
  check: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  checkBox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.borderInput,
    backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center",
  },
  checkBoxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkLbl: { fontSize: 14, fontWeight: "700", color: COLORS.text, flex: 1 },
  bigBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 54, borderRadius: 14 },
  bigBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 16, letterSpacing: 0.5 },
});
