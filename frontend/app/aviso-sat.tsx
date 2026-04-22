/**
 * Público — Formulario de aviso SAT
 *
 * Página accesible sin autenticación. El SAT envía este enlace al cliente
 * y éste lo abre para comunicar una incidencia. Sólo muestra 4 campos:
 *   - Cliente
 *   - Dirección
 *   - Teléfono
 *   - Observaciones
 * Al enviar, crea la incidencia vía POST /api/sat/public y muestra un
 * mensaje de confirmación.
 */

import { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS } from "../src/api";

export default function PublicSATForm() {
  const [cliente, setCliente] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const nombre = cliente.trim();
    const obs = observaciones.trim();
    if (!nombre || !obs) {
      setError("Por favor indica al menos tu nombre y describe la incidencia.");
      return;
    }
    setSending(true);
    try {
      await api.satCreatePublic({
        cliente: nombre,
        direccion: direccion.trim(),
        telefono: telefono.trim(),
        observaciones: obs,
      });
      setSent(true);
    } catch (e: any) {
      setError(e?.message || "No se ha podido enviar el aviso. Inténtalo de nuevo.");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.successCard}>
          <View style={s.successIcon}>
            <Ionicons name="checkmark-circle" size={76} color="#10B981" />
          </View>
          <Text style={s.successTitle}>¡Aviso enviado!</Text>
          <Text style={s.successMsg}>
            Hemos recibido tu incidencia. Nuestro equipo SAT se pondrá en contacto
            contigo lo antes posible.
          </Text>
          <TouchableOpacity
            style={s.secondaryBtn}
            onPress={() => {
              setCliente(""); setDireccion(""); setTelefono(""); setObservaciones("");
              setSent(false);
            }}
          >
            <Text style={s.secondaryBtnText}>Enviar otro aviso</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <SafeAreaView style={s.root}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          <View style={s.card}>
            {/* Cabecera */}
            <View style={s.headerBlock}>
              <View style={s.logoCircle}>
                <Ionicons name="construct" size={34} color={COLORS.primary} />
              </View>
              <Text style={s.brand}>i-SAI</Text>
              <Text style={s.title}>Aviso SAT</Text>
              <Text style={s.subtitle}>
                Cuéntanos qué ha pasado y nos pondremos en contacto contigo.
              </Text>
            </View>

            {/* Formulario */}
            <View style={s.field}>
              <Text style={s.label}>Cliente *</Text>
              <TextInput
                testID="sat-input-cliente"
                value={cliente}
                onChangeText={setCliente}
                placeholder="Nombre completo o empresa"
                placeholderTextColor={COLORS.textDisabled}
                style={s.input}
                editable={!sending}
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>Dirección</Text>
              <TextInput
                testID="sat-input-direccion"
                value={direccion}
                onChangeText={setDireccion}
                placeholder="Calle, número, localidad..."
                placeholderTextColor={COLORS.textDisabled}
                style={s.input}
                editable={!sending}
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>Teléfono</Text>
              <TextInput
                testID="sat-input-telefono"
                value={telefono}
                onChangeText={setTelefono}
                placeholder="Ej: 612 345 678"
                placeholderTextColor={COLORS.textDisabled}
                keyboardType="phone-pad"
                style={s.input}
                editable={!sending}
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>Descripción de la incidencia *</Text>
              <TextInput
                testID="sat-input-observaciones"
                value={observaciones}
                onChangeText={setObservaciones}
                placeholder="Describe con detalle qué ha ocurrido..."
                placeholderTextColor={COLORS.textDisabled}
                multiline
                numberOfLines={5}
                style={[s.input, s.textarea]}
                editable={!sending}
              />
            </View>

            {error && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={18} color="#EF4444" />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              testID="sat-submit"
              style={[s.primaryBtn, sending && { opacity: 0.6 }]}
              onPress={submit}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#fff" />
                  <Text style={s.primaryBtnText}>Enviar aviso</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={s.disclaimer}>
              Al enviar aceptas que tus datos sean usados exclusivamente para
              atender tu incidencia.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 20, alignItems: "center", minHeight: "100%" as any },
  card: {
    width: "100%", maxWidth: 560,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 24,
    ...Platform.select<any>({
      web: { boxShadow: "0 12px 36px rgba(15,23,42,0.08)" },
      default: { shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
    }),
  },

  headerBlock: { alignItems: "center", marginBottom: 24 },
  logoCircle: {
    width: 68, height: 68, borderRadius: 20,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1, borderColor: COLORS.primary + "33",
    alignItems: "center", justifyContent: "center",
    marginBottom: 12,
  },
  brand: { fontSize: 12, color: COLORS.primary, fontWeight: "900", letterSpacing: 2 },
  title: { fontSize: 26, fontWeight: "900", color: COLORS.text, marginTop: 4, letterSpacing: -0.5 },
  subtitle: {
    fontSize: 13, color: COLORS.textSecondary, textAlign: "center",
    marginTop: 8, lineHeight: 19, fontWeight: "600",
  },

  field: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: "800", color: COLORS.text, marginBottom: 6, letterSpacing: 0.2 },
  input: {
    borderWidth: 1.5, borderColor: COLORS.borderInput,
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: COLORS.text,
    backgroundColor: COLORS.bg,
  },
  textarea: { minHeight: 110, textAlignVertical: "top" as any, paddingTop: 12 },

  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FEE2E2",
    borderRadius: 10, padding: 10, marginBottom: 12,
  },
  errorText: { flex: 1, color: "#EF4444", fontWeight: "700", fontSize: 13 },

  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: COLORS.primary, height: 50, borderRadius: 12, marginTop: 6,
  },
  primaryBtnText: { color: "#fff", fontWeight: "900", fontSize: 16, letterSpacing: 0.3 },
  secondaryBtn: {
    height: 48, borderRadius: 12, borderWidth: 2, borderColor: COLORS.primary,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 18,
  },
  secondaryBtnText: { color: COLORS.primary, fontWeight: "900", fontSize: 14 },

  disclaimer: {
    textAlign: "center", color: COLORS.textSecondary, fontSize: 11,
    marginTop: 16, lineHeight: 16,
  },

  // Success
  successCard: {
    flex: 1, alignItems: "center", justifyContent: "center", padding: 30,
  },
  successIcon: { marginBottom: 12 },
  successTitle: { fontSize: 28, fontWeight: "900", color: COLORS.text, letterSpacing: -0.5, marginBottom: 10, textAlign: "center" },
  successMsg: {
    fontSize: 15, color: COLORS.textSecondary, textAlign: "center",
    lineHeight: 22, fontWeight: "600", maxWidth: 420,
  },
});
