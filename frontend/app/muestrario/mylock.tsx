import { useState, useEffect, createElement } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../src/api";
import ResponsiveLayout from "../../src/ResponsiveLayout";
import { useBreakpoint } from "../../src/useBreakpoint";
import { useThemedStyles } from "../../src/theme";
import { ios } from "../../src/ui/iosTheme";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:8000";
const MYLOCK_BASE = "https://mylock.saltosystems.com";

export default function MyLockScreen() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const s = useThemedStyles(useS);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [webViewUrl, setWebViewUrl] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage?.getItem?.("token") || "";
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`${BACKEND}/api/mylock/products`, { headers });
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : data.items || []);
      } catch (e) {
        // fallback
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const categories = ["Todos", ...new Set(products.map((p) => p.category_name).filter(Boolean))];

  const filtered = products.filter((p) => {
    if (selectedCategory !== "Todos" && p.category_name !== selectedCategory) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const haystack = `${p.name} ${p.category_name} ${p.standard_name} ${p.text}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const openCustomizer = (product: any) => {
    const url = `${MYLOCK_BASE}/es/custom/${product.url}`;
    setWebViewUrl(url);
  };

  // Vista WebView (configurador)
  if (webViewUrl) {
    return (
      <ResponsiveLayout active="muestrario" isAdmin={false} onLogout={() => {}} userName="">
        <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
          <View style={s.header}>
            <TouchableOpacity style={s.iconBtn} onPress={() => setWebViewUrl(null)}>
              <Ionicons name="close" size={26} color={COLORS.navy} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>My Lock</Text>
            <TouchableOpacity style={s.iconBtn} onPress={() => {
              // Abrir en navegador externo
              if (typeof window !== "undefined") window.open(webViewUrl, "_blank");
            }}>
              <Ionicons name="open-outline" size={22} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          {Platform.OS === "web" ? (
            createElement("iframe", {
              src: webViewUrl,
              style: { width: "100%", height: "100%", border: "none", flex: 1 },
              title: "MyLock Configurator",
            })
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg }}>
              <Ionicons name="lock-closed-outline" size={48} color={COLORS.textDisabled} />
              <Text style={{ marginTop: 12, color: COLORS.textSecondary, textAlign: "center", paddingHorizontal: 20 }}>
                El configurador solo está disponible en la versión web.
              </Text>
              <TouchableOpacity
                style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: ios.radius.md }}
                onPress={() => { if (typeof window !== "undefined") window.open(webViewUrl, "_blank"); }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Abrir en navegador</Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </ResponsiveLayout>
    );
  }

  // Vista principal (catálogo)
  return (
    <ResponsiveLayout active="muestrario" isAdmin={false} onLogout={() => {}} userName="">
      <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
        <View style={s.header}>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>My Lock</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Search */}
          <View style={s.searchBox}>
            <Ionicons name="search" size={16} color={COLORS.textSecondary} />
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar cerradura..."
              placeholderTextColor={COLORS.textDisabled}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Categories */}
          <View style={s.catRow}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[s.catPill, selectedCategory === cat && s.catPillActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[s.catPillText, selectedCategory === cat && s.catPillTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Products */}
          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />
          ) : filtered.length === 0 ? (
            <Text style={s.empty}>No se encontraron productos</Text>
          ) : (
            <View style={{ paddingHorizontal: 12, gap: 8, maxWidth: isWide ? 900 : undefined, alignSelf: "center", width: "100%" }}>
              {filtered.map((p, idx) => (
                <TouchableOpacity
                  key={`${p.url}-${p.id_standard}-${idx}`}
                  style={s.productCard}
                  onPress={() => openCustomizer(p)}
                  activeOpacity={0.85}
                >
                  {p.main_image ? (
                    <Image
                      source={{ uri: `${MYLOCK_BASE}/img/product/${p.main_image}` }}
                      style={s.productImg}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={[s.productImg, s.productImgPlaceholder]}>
                      <Ionicons name="lock-closed-outline" size={28} color={COLORS.textDisabled} />
                    </View>
                  )}
                  <View style={s.productInfo}>
                    <Text style={s.productName} numberOfLines={1}>{p.name}</Text>
                    {p.subtitle ? <Text style={s.productSub} numberOfLines={1}>{p.subtitle}</Text> : null}
                    <View style={{ flexDirection: "row", gap: 4, marginTop: 2 }}>
                      <View style={s.badge}>
                        <Text style={s.badgeText}>{p.category_name}</Text>
                      </View>
                      <View style={[s.badge, { backgroundColor: COLORS.primarySoft }]}>
                        <Text style={[s.badgeText, { color: COLORS.primary }]}>{p.standard_name}</Text>
                      </View>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ResponsiveLayout>
  );
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: ios.spacing.lg, paddingVertical: 12, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 22, fontWeight: "900", color: COLORS.text, flex: 1, textAlign: "center", letterSpacing: -0.4 },
  iconBtn: { width: 40, height: 40, borderRadius: ios.radius.md, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  subtitle: {
    fontSize: 12, color: COLORS.textSecondary, textAlign: "center",
    paddingHorizontal: 16, paddingVertical: 6, lineHeight: 16,
  },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    margin: 8, marginBottom: 4,
    paddingHorizontal: 10, height: 36, backgroundColor: COLORS.surface,
    borderRadius: ios.radius.md, borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.text },
  catRow: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: 8, paddingBottom: 4, gap: 4,
  },
  catPill: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: ios.radius.pill,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  catPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catPillText: { fontSize: 11, fontWeight: "700", color: COLORS.textSecondary },
  catPillTextActive: { color: "#fff" },
  empty: { color: COLORS.textSecondary, textAlign: "center", padding: 20 },
  productCard: {
    flexDirection: "row", alignItems: "center", padding: 8, gap: 8,
    backgroundColor: COLORS.surface, borderRadius: ios.radius.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  productImg: { width: 56, height: 56, borderRadius: ios.radius.sm },
  productImgPlaceholder: { backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border },
  productInfo: { flex: 1, gap: 1 },
  productName: { fontSize: 13, fontWeight: "800", color: COLORS.text },
  productSub: { fontSize: 10, color: COLORS.primary, fontWeight: "600" },
  badge: {
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: ios.radius.pill,
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
  },
  badgeText: { fontSize: 9, fontWeight: "700", color: COLORS.textSecondary },
});
