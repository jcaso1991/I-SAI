import { useState, useEffect, createElement } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS } from "../../src/api";
import ResponsiveLayout from "../../src/ResponsiveLayout";
import { useBreakpoint } from "../../src/useBreakpoint";
import { useThemedStyles } from "../../src/theme";
import { ios } from "../../src/ui/iosTheme";

export default function MuestrarioIndex() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const s = useThemedStyles(useS);
  const [families, setFamilies] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<any | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null);
  const [selectedFinish, setSelectedFinish] = useState<number>(0);
  const [showCatDropdown, setShowCatDropdown] = useState(false);
  const [fullImage, setFullImage] = useState<string | null>(null);
  const [mylockUrl, setMylockUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getMuestrario();
        setFamilies(data.families || []);
        setCategories(data.categories || []);
      } catch (e) {
        // fallback silencioso
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = families.filter((f) => {
    if (selectedCategory && f.category?.trim() !== selectedCategory) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const variants = (f.products || []).map((v: any) => v.title || "").join(" ");
      const haystack = `${f.name} ${f.description} ${f.category} ${variants}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const goBack = () => router.replace("/home");

  if (selectedVariant) {
    const v = selectedVariant;
    return (
      <ResponsiveLayout active="muestrario" isAdmin={false} onLogout={() => {}} userName="">
        <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
          <View style={s.header}>
            <TouchableOpacity style={s.iconBtn} onPress={() => setSelectedVariant(null)}>
              <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
            </TouchableOpacity>
            <Text style={s.headerTitle} numberOfLines={1}>Detalle</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={s.scroll}>
            {/* Imagen principal: tocar para ampliar */}
            {(() => {
              const heroImg = v.finishes?.[selectedFinish]?.image || v.image;
              if (!heroImg) return null;
              return (
                <TouchableOpacity onPress={() => setFullImage(heroImg)} activeOpacity={0.9}>
                  <Image source={{ uri: heroImg }} style={s.variantHeroImg} resizeMode="contain" />
                  <View style={s.zoomHint}>
                    <Ionicons name="expand-outline" size={16} color="#fff" />
                    <Text style={s.zoomHintText}>Tocá para ampliar</Text>
                  </View>
                </TouchableOpacity>
              );
            })()}
            
            <Text style={s.variantHeroTitle}>{v.title}</Text>
            
            {v.short_description ? (
              <Text style={s.variantHeroDesc}>{v.short_description}</Text>
            ) : null}
            
            {v.features ? (
              <View style={s.detailSection}>
                <Text style={s.detailSectionTitle}>Características</Text>
                <Text style={s.detailText}>{v.features}</Text>
              </View>
            ) : null}
            
            {v.tech_characteristics ? (
              <View style={s.detailSection}>
                <Text style={s.detailSectionTitle}>Especificaciones técnicas</Text>
                <Text style={s.detailText}>{v.tech_characteristics}</Text>
              </View>
            ) : null}
            
            {v.platforms?.length > 0 ? (
              <View style={s.detailSection}>
                <Text style={s.detailSectionTitle}>Plataformas compatibles</Text>
                <View style={s.tagRow}>
                  {v.platforms.map((p: string, i: number) => (
                    <View key={i} style={s.tag}>
                      <Text style={s.tagText}>{p}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            
            {v.carriers?.length > 0 ? (
              <View style={s.detailSection}>
                <Text style={s.detailSectionTitle}>Credenciales soportadas</Text>
                <View style={s.tagRow}>
                  {v.carriers.map((c: string, i: number) => (
                    <View key={i} style={s.tag}>
                      <Text style={s.tagText}>{c}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            
            {v.wireless_tech?.length > 0 ? (
              <View style={s.detailSection}>
                <Text style={s.detailSectionTitle}>Tecnología inalámbrica</Text>
                <View style={s.tagRow}>
                  {v.wireless_tech.map((w: string, i: number) => (
                    <View key={i} style={[s.tag, { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primary }]}>
                      <Text style={[s.tagText, { color: COLORS.primary }]}>{w}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            
            {/* Acabados */}
            {v.finishes?.length > 0 ? (
              <View style={s.detailSection}>
                <Text style={s.detailSectionTitle}>Acabados disponibles ({v.finishes.length})</Text>
                <View style={s.finishGrid}>
                  {v.finishes.map((f: any, i: number) => {
                    const isSelected = i === selectedFinish;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[s.finishCard, isSelected && s.finishCardSelected]}
                        onPress={() => setSelectedFinish(i)}
                        activeOpacity={0.7}
                      >
                        {f.swatch ? (
                          <Image source={{ uri: f.swatch }} style={s.finishSwatch} />
                        ) : f.image ? (
                          <Image source={{ uri: f.image }} style={s.finishImg} resizeMode="contain" />
                        ) : (
                          <View style={[s.finishImg, { backgroundColor: COLORS.bg }]} />
                        )}
                        <Text style={[s.finishName, isSelected && s.finishNameSelected]} numberOfLines={2}>
                          {f.name || `Acabado ${i+1}`}
                        </Text>
                        {isSelected && (
                          <View style={s.finishCheck}>
                            <Ionicons name="checkmark" size={12} color="#fff" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}
            
            {v.certifications?.length > 0 ? (
              <View style={s.detailSection}>
                <Text style={s.detailSectionTitle}>Certificaciones</Text>
                <View style={s.tagRow}>
                  {v.certifications.map((c: string, i: number) => (
                    <View key={i} style={[s.tag, { backgroundColor: '#DCFCE7', borderColor: '#10B981' }]}>
                      <Text style={[s.tagText, { color: '#166534' }]}>{c}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            
            {v.downloads?.length > 0 ? (
              <View style={s.detailSection}>
                <Text style={s.detailSectionTitle}>Descargas</Text>
                {v.downloads.map((d: any, i: number) => (
                  <TouchableOpacity key={i} style={s.downloadRow}>
                    <Ionicons name="document-outline" size={18} color={COLORS.primary} />
                    <Text style={s.downloadText}>{d.label}</Text>
                    <Ionicons name="download-outline" size={16} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            
            {!v.features && !v.tech_characteristics && v.description ? (
              <View style={s.detailSection}>
                <Text style={s.detailSectionTitle}>Descripción</Text>
                <Text style={s.detailText}>{v.description}</Text>
              </View>
            ) : null}

            {/* Botón MyLock para variantes sin acabados */}
            {(!v.finishes || v.finishes.length === 0) ? (
              <TouchableOpacity
                style={s.mylockBtn}
                onPress={() => {
                  // Buscar el slug del producto en MyLock
                  const productName = v.title?.toLowerCase() || "";
                  // Mapeo de nombres a slugs de MyLock
                  const slugMap: Record<string, string> = {
                    "xs4 original+": "xs4-original-plus",
                    "xs4 original +": "xs4-original-plus",
                    "xs4 one": "xs4-one",
                    "xs4 mini": "xs4-mini",
                    "xs4 locker": "xs4-locker",
                    "neo cylinder": "neo-cylinder",
                    "neo cilindro": "neo-cylinder",
                    "aelement fusion": "aelement-fusion",
                    "aelement": "aelement-original",
                    "dlok": "dlok",
                    "danalock": "danalock",
                    "glass xs": "glass-xs-reader",
                    "design xs": "wallreader",
                    "candado neoxx": "candado-neoxx",
                    "gantner net.lock": "gantner-net-lock",
                    "xs4 com": "xs4-com",
                  };
                  let slug = "";
                  for (const [key, val] of Object.entries(slugMap)) {
                    if (productName.includes(key)) { slug = val; break; }
                  }
                  if (slug) {
                    setMylockUrl(`https://mylock.saltosystems.com/es/custom/${slug}`);
                  } else {
                    setMylockUrl(`https://mylock.saltosystems.com/es`);
                  }
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="color-palette-outline" size={20} color="#fff" />
                <Text style={s.mylockBtnText}>Personalizar en MyLock</Text>
                <Text style={s.mylockBtnSub}>Ver todos los acabados, colores y opciones</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </SafeAreaView>
        {/* Modal imagen */}
        {fullImage && (
          <TouchableOpacity style={s.imageModal} activeOpacity={1} onPress={() => setFullImage(null)}>
            <TouchableOpacity style={s.imageModalClose} onPress={() => setFullImage(null)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Image source={{ uri: fullImage }} style={s.imageModalImg} resizeMode="contain" />
          </TouchableOpacity>
        )}
        {/* Modal MyLock iframe */}
        {mylockUrl && (
          <View style={s.imageModal}>
            <TouchableOpacity style={s.imageModalClose} onPress={() => setMylockUrl(null)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            {Platform.OS === "web" ? (
              createElement("iframe", {
                src: mylockUrl,
                style: { width: "95%", height: "85%", border: "none", borderRadius: 12 },
                title: "MyLock",
              })
            ) : (
              <View style={{ alignItems: "center", padding: 20 }}>
                <Text style={{ color: "#fff", fontSize: 16, textAlign: "center" }}>Abrir en navegador para personalizar</Text>
                <TouchableOpacity
                  style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: 8 }}
                  onPress={() => { if (typeof window !== "undefined") window.open(mylockUrl, "_blank"); }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Abrir MyLock</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ResponsiveLayout>
    );
  }

  if (selectedFamily) {
    return (
      <ResponsiveLayout active="muestrario" isAdmin={false} onLogout={() => {}} userName="">
        <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
          <View style={s.header}>
            <TouchableOpacity style={s.iconBtn} onPress={() => setSelectedFamily(null)}>
              <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>{selectedFamily.name}</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={s.scroll}>
            {selectedFamily.image && (
              <Image source={{ uri: selectedFamily.image }} style={s.detailImg} resizeMode="contain" />
            )}
            <Text style={s.detailDesc}>{selectedFamily.full_description || selectedFamily.description}</Text>
            <Text style={s.sectionTitle}>Variantes ({selectedFamily.products?.length || 0})</Text>
            {selectedFamily.products?.map((v: any, idx: number) => (
              <TouchableOpacity key={idx} style={s.variantCard} onPress={() => { setSelectedVariant(v); setSelectedFinish(0); }}>
                {v.image ? (
                  <Image source={{ uri: v.image }} style={s.variantImg} resizeMode="contain" />
                ) : (
                  <View style={[s.variantImg, s.productImgPlaceholder]}>
                    <Ionicons name="hardware-chip-outline" size={24} color={COLORS.textDisabled} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.variantName}>{v.title}</Text>
                  <Text style={s.variantDesc} numberOfLines={2}>{v.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout active="muestrario" isAdmin={false} onLogout={() => {}} userName="">
      <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
        {/* Header */}
        <View style={s.header}>
          {!isWide && (
            <TouchableOpacity style={s.iconBtn} onPress={goBack}>
              <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
            </TouchableOpacity>
          )}
          <Text style={s.headerTitle}>Muestrario</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <TouchableOpacity
              style={[s.iconBtn, { backgroundColor: "#10B981" }]}
              onPress={() => router.push("/muestrario/presupuesto-cliente" as any)}
            >
              <Ionicons name="cart-outline" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.iconBtn, { backgroundColor: COLORS.primary }]}
              onPress={() => router.push("/muestrario/mylock" as any)}
            >
              <Ionicons name="construct-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={s.searchBox}>
          <Ionicons name="search" size={18} color={COLORS.textSecondary} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar familia..."
            placeholderTextColor={COLORS.textDisabled}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category dropdown */}
        <View style={s.catContainer}>
          <TouchableOpacity
            style={s.catDropdown}
            onPress={() => setShowCatDropdown(!showCatDropdown)}
            activeOpacity={0.7}
          >
            <Ionicons name="options-outline" size={18} color={COLORS.primary} />
            <Text style={s.catDropdownText} numberOfLines={1}>
              {selectedCategory || "Todas las categorías"}
            </Text>
            <Text style={s.catDropdownCount}>{filtered.length} familias</Text>
            <Ionicons name={showCatDropdown ? "chevron-up" : "chevron-down"} size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
          {showCatDropdown && (
            <View style={s.catDropdownList}>
              <TouchableOpacity
                style={[s.catDropdownItem, !selectedCategory && s.catDropdownItemActive]}
                onPress={() => { setSelectedCategory(null); setShowCatDropdown(false); }}
              >
                <Text style={[s.catDropdownItemText, !selectedCategory && s.catDropdownItemTextActive]}>
                  Todas las categorías
                </Text>
                <Text style={s.catDropdownItemCount}>{families.length}</Text>
              </TouchableOpacity>
              {categories.map((cat) => {
                const count = families.filter((f) => f.category?.trim() === cat).length;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[s.catDropdownItem, selectedCategory === cat && s.catDropdownItemActive]}
                    onPress={() => { setSelectedCategory(cat); setShowCatDropdown(false); }}
                  >
                    <Text style={[s.catDropdownItemText, selectedCategory === cat && s.catDropdownItemTextActive]}>
                      {cat}
                    </Text>
                    <Text style={s.catDropdownItemCount}>{count}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Product list - ocupa el espacio restante */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll}>
          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
          ) : filtered.length === 0 ? (
            <Text style={s.empty}>No se encontraron familias</Text>
          ) : (
            <View style={{ gap: 12, maxWidth: isWide ? 900 : undefined, alignSelf: "center", width: "100%" }}>
              {filtered.map((f) => (
                <TouchableOpacity
                  key={f.name}
                  style={s.productCard}
                  onPress={() => setSelectedFamily(f)}
                  activeOpacity={0.85}
                >
                  {f.image ? (
                    <Image source={{ uri: f.image }} style={s.productImg} resizeMode="contain" />
                  ) : (
                    <View style={[s.productImg, s.productImgPlaceholder]}>
                      <Ionicons name="hardware-chip-outline" size={40} color={COLORS.textDisabled} />
                    </View>
                  )}
                  <View style={s.productInfo}>
                    <Text style={s.productName} numberOfLines={2}>{f.name}</Text>
                    <Text style={s.productCat}>
                      {f.category} · {f.products?.length || 0} variantes
                    </Text>
                    <Text style={s.productDesc} numberOfLines={3}>{f.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          </ScrollView>
        </SafeAreaView>
        {/* Modal de imagen a pantalla completa */}
        {fullImage && (
          <TouchableOpacity
            style={s.imageModal}
            activeOpacity={1}
            onPress={() => setFullImage(null)}
          >
            <TouchableOpacity style={s.imageModalClose} onPress={() => setFullImage(null)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Image
              source={{ uri: fullImage }}
              style={s.imageModalImg}
              resizeMode="contain"
            />
          </TouchableOpacity>
        )}
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
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginTop: 12,
    paddingHorizontal: 16, height: 48, backgroundColor: COLORS.surface,
    borderRadius: ios.radius.md, borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text },
  catContainer: { marginHorizontal: 16, marginTop: 8, marginBottom: 4, position: "relative", zIndex: 10 },
  catDropdown: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, height: 44, backgroundColor: COLORS.surface,
    borderRadius: ios.radius.md, borderWidth: 1, borderColor: COLORS.border,
  },
  catDropdownText: { flex: 1, fontSize: 14, fontWeight: "700", color: COLORS.text },
  catDropdownCount: { fontSize: 11, color: COLORS.textDisabled, fontWeight: "600" },
  catDropdownList: {
    position: "absolute", top: 48, left: 0, right: 0,
    backgroundColor: COLORS.surface, borderRadius: ios.radius.md,
    borderWidth: 1, borderColor: COLORS.border, maxHeight: 260,
    overflow: "hidden", ...ios.shadow.card, zIndex: 20,
  },
  catDropdownItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  catDropdownItemActive: { backgroundColor: COLORS.primarySoft },
  catDropdownItemText: { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary },
  catDropdownItemTextActive: { color: COLORS.primary },
  catDropdownItemCount: { fontSize: 11, color: COLORS.textDisabled, fontWeight: "600" },
  scroll: { padding: 16, paddingBottom: 40, gap: 10 },
  empty: { color: COLORS.textSecondary, textAlign: "center", padding: 20 },
  productCard: {
    flexDirection: "row", alignItems: "center", padding: 14,
    backgroundColor: COLORS.surface, borderRadius: ios.radius.lg,
    borderWidth: 1, borderColor: COLORS.border, gap: 12,
    ...ios.shadow.card,
  },
  productImg: { width: 80, height: 80, borderRadius: ios.radius.md },
  productImgPlaceholder: { backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border },
  productInfo: { flex: 1, gap: 2 },
  productName: { fontSize: 14, fontWeight: "800", color: COLORS.text },
  productCat: { fontSize: 11, fontWeight: "600", color: COLORS.primary },
  productDesc: { fontSize: 12, color: COLORS.textSecondary },
  detailImg: { width: "100%", height: 220, borderRadius: ios.radius.md, marginBottom: 12, backgroundColor: COLORS.bg },
  detailDesc: { fontSize: 14, color: COLORS.text, lineHeight: 21, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text, marginBottom: 12 },
  variantCard: {
    flexDirection: "row", alignItems: "center", padding: 12, gap: 12,
    backgroundColor: COLORS.surface, borderRadius: ios.radius.md,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 8,
  },
  variantImg: { width: 60, height: 60, borderRadius: ios.radius.sm },
  variantName: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  variantDesc: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  variantHeroImg: { width: "100%", height: 300, borderRadius: ios.radius.md, backgroundColor: COLORS.bg },
  zoomHint: {
    position: "absolute", bottom: 8, right: 8,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: ios.radius.pill,
  },
  zoomHintText: { fontSize: 10, color: "#fff", fontWeight: "600" },
  imageModal: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.92)", zIndex: 100,
    alignItems: "center", justifyContent: "center",
  },
  imageModalClose: {
    position: "absolute", top: 50, right: 16, zIndex: 101,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  imageModalImg: { width: "95%", height: "80%" },
  variantHeroTitle: { fontSize: 20, fontWeight: "900", color: COLORS.text, marginBottom: 8 },
  variantHeroDesc: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 21, marginBottom: 20 },
  detailSection: { marginBottom: 20 },
  detailSectionTitle: { fontSize: 15, fontWeight: "800", color: COLORS.text, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  detailText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: ios.radius.pill, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  tagText: { fontSize: 11, fontWeight: "700", color: COLORS.textSecondary },
  finishGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  finishCard: {
    width: 90, alignItems: "center", gap: 4, padding: 8,
    borderRadius: ios.radius.md, borderWidth: 2, borderColor: "transparent",
    backgroundColor: COLORS.bg, position: "relative",
  },
  finishCardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  finishSwatch: { width: 48, height: 48, borderRadius: ios.radius.sm, borderWidth: 1, borderColor: COLORS.border },
  finishImg: { width: 48, height: 48, borderRadius: ios.radius.sm, borderWidth: 1, borderColor: COLORS.border },
  finishName: { fontSize: 9, color: COLORS.textSecondary, textAlign: "center", lineHeight: 12 },
  finishNameSelected: { color: COLORS.primary, fontWeight: "700" },
  finishCheck: {
    position: "absolute", top: 4, right: 4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center",
  },
  downloadRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  downloadText: { flex: 1, fontSize: 13, color: COLORS.text, fontWeight: "600" },
  mylockBtn: {
    marginTop: 8, padding: 16, borderRadius: ios.radius.lg,
    backgroundColor: COLORS.primary, alignItems: "center", gap: 4,
  },
  mylockBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },
  mylockBtnSub: { fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: "600" },
});
