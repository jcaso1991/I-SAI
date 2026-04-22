import { useCallback, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS } from "../src/api";
import BottomNav from "../src/BottomNav";
import ResponsiveLayout from "../src/ResponsiveLayout";
import { useTheme } from "../src/theme";

export default function Admin() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const load = async () => {
    try {
      const [st, me] = await Promise.all([api.onedriveStatus(), api.me()]);
      setStatus(st);
      setUser(me);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const connectOneDrive = async () => {
    try {
      setBusy("connect");
      const { auth_url } = await api.onedriveLogin();
      await Linking.openURL(auth_url);
      Alert.alert(
        "Conectando con OneDrive",
        "Completa el inicio de sesión en tu navegador y vuelve a esta pantalla. Luego pulsa 'Actualizar estado'."
      );
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setBusy(null);
    }
  };

  /** Abre el portfolio público (presentación para clientes) en el navegador. */
  const openPortfolio = async () => {
    try {
      const base = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/+$/, "");
      const url = base ? `${base}/portfolio` : "/portfolio";
      // En web abrimos en pestaña nueva; en iOS/Android usamos Linking.
      // @ts-ignore
      if (typeof window !== "undefined" && window.open) {
        // @ts-ignore
        window.open(url, "_blank");
      } else {
        await Linking.openURL(url);
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "No se pudo abrir la presentación");
    }
  };

  const disconnect = async () => {
    Alert.alert("Desconectar OneDrive", "¿Seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Desconectar", style: "destructive",
        onPress: async () => {
          try {
            setBusy("disconnect");
            await api.onedriveDisconnect();
            await load();
          } catch (e: any) {
            Alert.alert("Error", e.message);
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const importFromOD = async () => {
    try {
      setBusy("import");
      const res = await api.syncImport();
      Alert.alert("Importación completa", `${res.imported} materiales importados desde OneDrive`);
      await load();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setBusy(null);
    }
  };

  const pushToOD = async () => {
    try {
      setBusy("push");
      const res = await api.syncPush();
      Alert.alert("Subida completa", `${res.pushed} materiales actualizados en OneDrive`);
      await load();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setBusy(null);
    }
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

  const isAdmin = user?.role === "admin";
  const connected = status?.connected;

  return (
    <ResponsiveLayout active="ajustes" isAdmin={isAdmin} userName={user?.name}>
    <SafeAreaView style={s.root} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.replace("/home")}>
          <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Ajustes</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Selector de tema (visible para todos) */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={[s.iconCircle, { backgroundColor: COLORS.bg }]}>
              <Ionicons
                name={theme === "dark" ? "moon" : "sunny"}
                size={22}
                color={theme === "dark" ? "#60A5FA" : "#F59E0B"}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Apariencia</Text>
              <Text style={s.cardSub}>Elige el tema de la aplicación</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
            <TouchableOpacity
              testID="theme-light"
              onPress={() => setTheme("light")}
              style={[
                s.themeOption,
                theme === "light" && { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
              ]}
            >
              <Ionicons name="sunny" size={22} color={theme === "light" ? COLORS.primary : COLORS.textSecondary} />
              <Text style={[s.themeOptionTxt, theme === "light" && { color: COLORS.primary, fontWeight: "800" }]}>Claro</Text>
              {theme === "light" && <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} style={{ position: "absolute", top: 6, right: 6 }} />}
            </TouchableOpacity>
            <TouchableOpacity
              testID="theme-dark"
              onPress={() => setTheme("dark")}
              style={[
                s.themeOption,
                theme === "dark" && { borderColor: COLORS.primary, backgroundColor: "rgba(59, 130, 246, 0.15)" },
              ]}
            >
              <Ionicons name="moon" size={22} color={theme === "dark" ? COLORS.primary : COLORS.textSecondary} />
              <Text style={[s.themeOptionTxt, theme === "dark" && { color: COLORS.primary, fontWeight: "800" }]}>Oscuro</Text>
              {theme === "dark" && <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} style={{ position: "absolute", top: 6, right: 6 }} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Presentación pública para clientes */}
        <View style={s.card} testID="portfolio-card">
          <View style={s.cardHeader}>
            <View style={[s.iconCircle, { backgroundColor: "#DBEAFE" }]}>
              <Ionicons name="albums" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Presentación para clientes</Text>
              <Text style={s.cardSub}>
                Portfolio gráfico con capturas, beneficios y PDF descargable. Ideal para enseñar la app a un cliente.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            testID="btn-open-portfolio"
            style={[s.btnPrimary, { marginTop: 12 }]}
            onPress={openPortfolio}
          >
            <Ionicons name="open-outline" size={20} color="#fff" />
            <Text style={s.btnPrimaryText}>VER PRESENTACIÓN</Text>
          </TouchableOpacity>
        </View>

        {!isAdmin && (
          <View style={[s.card, { backgroundColor: COLORS.pendingBg, borderColor: "#FDE68A" }]}>
            <Ionicons name="information-circle" size={22} color={COLORS.pendingText} />
            <Text style={[s.cardText, { color: COLORS.pendingText }]}>
              Solo el administrador puede gestionar la conexión con OneDrive.
            </Text>
          </View>
        )}

        <View style={s.card} testID="onedrive-status-card">
          <View style={s.cardHeader}>
            <View style={[s.iconCircle, { backgroundColor: connected ? COLORS.syncedBg : COLORS.errorBg }]}>
              <Ionicons
                name={connected ? "cloud-done" : "cloud-offline"}
                size={22}
                color={connected ? COLORS.syncedText : COLORS.errorText}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>OneDrive</Text>
              <Text style={s.cardSub}>
                {connected ? status.admin_email : "No conectado"}
              </Text>
            </View>
          </View>

          {connected && (
            <View style={s.metaBlock}>
              <Text style={s.metaLabel}>Archivo</Text>
              <Text style={s.metaValue}>
                {status.file_name || status.file_path}
                {status.using_share_url ? " (enlace compartido)" : ""}
              </Text>
              {status.last_import_at && (
                <>
                  <Text style={s.metaLabel}>Última importación</Text>
                  <Text style={s.metaValue}>{new Date(status.last_import_at).toLocaleString("es-ES")}</Text>
                </>
              )}
              {status.last_push_at && (
                <>
                  <Text style={s.metaLabel}>Última subida</Text>
                  <Text style={s.metaValue}>{new Date(status.last_push_at).toLocaleString("es-ES")}</Text>
                </>
              )}
            </View>
          )}

          {isAdmin && (
            <View style={{ gap: 10, marginTop: 12 }}>
              {!connected ? (
                <TouchableOpacity
                  testID="btn-connect-onedrive"
                  style={s.btnPrimary}
                  onPress={connectOneDrive}
                  disabled={busy === "connect"}
                >
                  {busy === "connect" ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Ionicons name="cloud-upload" size={20} color="#fff" />
                      <Text style={s.btnPrimaryText}>CONECTAR ONEDRIVE</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  testID="btn-disconnect-onedrive"
                  style={s.btnSecondary}
                  onPress={disconnect}
                  disabled={busy === "disconnect"}
                >
                  <Text style={s.btnSecondaryText}>Desconectar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={s.btnGhost} onPress={load}>
                <Ionicons name="refresh" size={18} color={COLORS.primary} />
                <Text style={s.btnGhostText}>Actualizar estado</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {connected && isAdmin && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Sincronización automática</Text>
            <Text style={s.cardSub}>
              La app se sincroniza sola con OneDrive. Los cambios se suben automáticamente al guardar, y los cambios externos se traen cada 5 minutos.
            </Text>
            <TouchableOpacity
              testID="btn-import"
              style={[s.btnSecondary, { marginTop: 12 }]}
              onPress={importFromOD}
              disabled={busy === "import"}
            >
              {busy === "import" ? <ActivityIndicator color={COLORS.navy} /> : (
                <>
                  <Ionicons name="refresh" size={20} color={COLORS.navy} />
                  <Text style={s.btnSecondaryText}>FORZAR SINCRONIZACIÓN AHORA</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={s.card}>
          <Text style={s.cardTitle}>Usuarios</Text>
          <Text style={s.cardSub}>
            Gestiona administradores y técnicos: crear, editar roles, cambiar contraseñas.
          </Text>
          <TouchableOpacity
            testID="btn-open-users"
            style={[s.btnPrimary, { marginTop: 12 }]}
            onPress={() => router.push("/users")}
          >
            <Ionicons name="people" size={20} color="#fff" />
            <Text style={s.btnPrimaryText}>GESTIONAR USUARIOS</Text>
          </TouchableOpacity>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Sesión</Text>
          <Text style={s.cardSub}>{user?.email} · {user?.role}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
    </ResponsiveLayout>
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
  card: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.border, gap: 4,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
  },
  themeOption: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 2,
    borderColor: COLORS.border, backgroundColor: COLORS.readonly, position: "relative",
  },
  themeOptionTxt: { fontSize: 14, fontWeight: "700", color: COLORS.textSecondary },
  cardTitle: { fontSize: 17, fontWeight: "800", color: COLORS.text },
  cardSub: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  cardText: { flex: 1, fontSize: 14, fontWeight: "600" },
  metaBlock: {
    backgroundColor: COLORS.bg, borderRadius: 10, padding: 12, marginTop: 12, gap: 2,
  },
  metaLabel: {
    fontSize: 10, fontWeight: "800", color: COLORS.textSecondary,
    letterSpacing: 1, marginTop: 6,
  },
  metaValue: { fontSize: 14, color: COLORS.text, fontWeight: "600" },
  btnPrimary: {
    height: 52, borderRadius: 10, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 8,
  },
  btnPrimaryText: { color: "#fff", fontSize: 14, fontWeight: "800", letterSpacing: 0.8 },
  btnSecondary: {
    height: 52, borderRadius: 10, backgroundColor: COLORS.bg,
    borderWidth: 2, borderColor: COLORS.borderInput,
    alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8,
  },
  btnSecondaryText: { color: COLORS.navy, fontSize: 14, fontWeight: "800", letterSpacing: 0.5 },
  btnGhost: {
    height: 44, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 6,
  },
  btnGhostText: { color: COLORS.primary, fontWeight: "700", fontSize: 14 },
});
