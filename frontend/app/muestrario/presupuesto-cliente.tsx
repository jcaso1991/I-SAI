import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS } from "../../src/api";
import { useThemedStyles } from "../../src/theme";
import { ios } from "../../src/ui/iosTheme";

interface CartItem {
  family: string;
  variant: string;
  image: string;
  quantity: number;
  mylockUrl?: string;
}

export default function PresupuestoClienteScreen() {
  const router = useRouter();
  const s = useThemedStyles(useS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [families, setFamilies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [clientPostal, setClientPostal] = useState("");
  const [clientProvince, setClientProvince] = useState("");
  const [sending, setSending] = useState(false);
  const [detailVariant, setDetailVariant] = useState<any | null>(null);

  useEffect(() => {
    api.getMuestrario().then((d) => {
      setFamilies(d.families || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage?.getItem?.("mylock_cart");
      if (saved) setCart(JSON.parse(saved));
    } catch {}
  }, []);

  const saveCart = (items: CartItem[]) => {
    setCart(items);
    try { localStorage?.setItem?.("mylock_cart", JSON.stringify(items)); } catch {}
  };

  const addToCart = (family: string, variant: string, image: string, mylockUrl?: string) => {
    const existing = cart.find((c) => c.variant === variant);
    if (existing) {
      saveCart(cart.map((c) => c.variant === variant ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      saveCart([...cart, { family, variant, image, quantity: 1, mylockUrl }]);
    }
  };

  const removeFromCart = (variant: string) => {
    saveCart(cart.filter((c) => c.variant !== variant));
  };

  const updateQuantity = (variant: string, qty: number) => {
    if (qty <= 0) { removeFromCart(variant); return; }
    saveCart(cart.map((c) => c.variant === variant ? { ...c, quantity: qty } : c));
  };

  const submitRequest = async () => {
    if (!clientName.trim() || !clientEmail.trim() || !clientPhone.trim() || !clientAddress.trim()) {
      Alert.alert("Faltan datos", "Nombre, email, teléfono y dirección son obligatorios");
      return;
    }
    setSending(true);
    try {
      await api.createBudgetRequest({
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
        client_address: clientAddress,
        client_city: clientCity,
        client_postal: clientPostal,
        client_province: clientProvince,
        items: cart.map((c) => ({ family: c.family, variant: c.variant, image: c.image, quantity: c.quantity })),
      });
      setSubmitted(true);
      saveCart([]);
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo enviar");
    } finally {
      setSending(false);
    }
  };

  if (submitted) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.successContainer}>
          <Ionicons name="checkmark-circle" size={80} color="#10B981" />
          <Text style={s.successTitle}>Solicitud enviada</Text>
          <Text style={s.successText}>Tu presupuesto será revisado y te contactaremos pronto.</Text>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backBtnText}>Volver al muestrario</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (showForm) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <TouchableOpacity style={s.iconBtn} onPress={() => setShowForm(false)}>
            <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Tus datos</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={s.formScroll}>
          <Text style={s.formLabel}>Nombre completo *</Text>
          <TextInput style={s.formInput} value={clientName} onChangeText={setClientName} placeholder="Nombre y apellidos" placeholderTextColor={COLORS.textDisabled} />
          
          <Text style={s.formLabel}>Correo electrónico *</Text>
          <TextInput style={s.formInput} value={clientEmail} onChangeText={setClientEmail} placeholder="email@ejemplo.com" keyboardType="email-address" placeholderTextColor={COLORS.textDisabled} />
          
          <Text style={s.formLabel}>Teléfono *</Text>
          <TextInput style={s.formInput} value={clientPhone} onChangeText={setClientPhone} placeholder="612345678" keyboardType="phone-pad" placeholderTextColor={COLORS.textDisabled} />
          
          <Text style={s.formLabel}>Dirección de envío *</Text>
          <TextInput style={s.formInput} value={clientAddress} onChangeText={setClientAddress} placeholder="Calle, número, piso" placeholderTextColor={COLORS.textDisabled} />
          
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.formLabel}>Ciudad</Text>
              <TextInput style={s.formInput} value={clientCity} onChangeText={setClientCity} placeholder="Ciudad" placeholderTextColor={COLORS.textDisabled} />
            </View>
            <View style={{ width: 80 }}>
              <Text style={s.formLabel}>C.P.</Text>
              <TextInput style={s.formInput} value={clientPostal} onChangeText={setClientPostal} placeholder="28001" keyboardType="numeric" placeholderTextColor={COLORS.textDisabled} />
            </View>
          </View>
          
          <Text style={s.formLabel}>Provincia</Text>
          <TextInput style={s.formInput} value={clientProvince} onChangeText={setClientProvince} placeholder="Madrid" placeholderTextColor={COLORS.textDisabled} />
          
          <TouchableOpacity
            style={[s.submitBtn, sending && { opacity: 0.6 }]}
            onPress={submitRequest}
            disabled={sending}
          >
            {sending ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="send" size={20} color="#fff" />
                <Text style={s.submitBtnText}>Enviar solicitud ({cart.reduce((t, c) => t + c.quantity, 0)} productos)</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const filtered = families.filter((f) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const vars = (f.products || []).map((v: any) => v.title || "").join(" ");
    return `${f.name} ${f.category} ${vars}`.toLowerCase().includes(q);
  });

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={COLORS.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Presupuesto Cliente</Text>
        <TouchableOpacity style={[s.iconBtn, cart.length > 0 && { backgroundColor: COLORS.primary }]} onPress={() => {}}>
          <Ionicons name="cart" size={22} color={cart.length > 0 ? "#fff" : COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {cart.length > 0 && (
        <View style={s.cartBar}>
          <View style={{ flex: 1 }}>
            <Text style={s.cartBarTitle}>{cart.reduce((t, c) => t + c.quantity, 0)} productos en la cesta</Text>
          </View>
          <TouchableOpacity style={s.cartBarBtn} onPress={() => { if (cart.length > 0) setShowForm(true); }}>
            <Text style={s.cartBarBtnText}>Solicitar presupuesto</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <View style={s.searchBox}>
        <Ionicons name="search" size={16} color={COLORS.textSecondary} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar producto..."
          placeholderTextColor={COLORS.textDisabled}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 100 }}>
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : filtered.map((f) => (
          <View key={f.name} style={s.familyBlock}>
            <Text style={s.familyName}>{f.name}</Text>
            {(f.products || []).map((v: any, idx: number) => {
              const inCart = cart.find((c) => c.variant === v.title);
              return (
                <View key={idx} style={s.variantRow}>
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 8 }}
                    onPress={() => setDetailVariant(v)}
                  >
                    {v.image ? (
                      <Image source={{ uri: v.image }} style={s.variantThumb} resizeMode="contain" />
                    ) : (
                      <View style={[s.variantThumb, { backgroundColor: COLORS.bg }]} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={s.variantTitle} numberOfLines={2}>{v.title}</Text>
                      {v.features ? (
                        <Text style={{ fontSize: 10, color: COLORS.primary, fontWeight: "600" }}>Ver ficha completa →</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                  <View style={s.qtyRow}>
                    {inCart ? (
                      <>
                        <TouchableOpacity style={s.qtyBtn} onPress={() => updateQuantity(v.title, inCart.quantity - 1)}>
                          <Ionicons name="remove" size={16} color={COLORS.primary} />
                        </TouchableOpacity>
                        <Text style={s.qtyText}>{inCart.quantity}</Text>
                        <TouchableOpacity style={s.qtyBtn} onPress={() => updateQuantity(v.title, inCart.quantity + 1)}>
                          <Ionicons name="add" size={16} color={COLORS.primary} />
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity style={s.addBtn} onPress={() => addToCart(f.name, v.title, v.image)}>
                        <Ionicons name="cart-outline" size={14} color="#fff" />
                        <Text style={s.addBtnText}>Añadir</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
        {filtered.length === 0 && !loading && (
          <Text style={{ color: COLORS.textSecondary, textAlign: "center", padding: 20 }}>No se encontraron productos</Text>
        )}
      </ScrollView>

      {/* Modal de detalle de variante */}
      {detailVariant && (
        <View style={s.detailOverlay}>
          <View style={s.detailContent}>
            <View style={s.detailHeader}>
              <Text style={s.detailTitle} numberOfLines={2}>{detailVariant.title}</Text>
              <TouchableOpacity onPress={() => setDetailVariant(null)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              {detailVariant.image && (
                <Image source={{ uri: detailVariant.image }} style={s.detailImg} resizeMode="contain" />
              )}
              {detailVariant.short_description && (
                <Text style={s.detailText}>{detailVariant.short_description}</Text>
              )}
              {detailVariant.features && (
                <>
                  <Text style={s.detailLabel}>Características</Text>
                  <Text style={s.detailText}>{detailVariant.features}</Text>
                </>
              )}
              {detailVariant.tech_characteristics && (
                <>
                  <Text style={s.detailLabel}>Especificaciones técnicas</Text>
                  <Text style={s.detailText}>{detailVariant.tech_characteristics}</Text>
                </>
              )}
              {detailVariant.finishes?.length > 0 && (
                <>
                  <Text style={s.detailLabel}>Acabados ({detailVariant.finishes.length})</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                    {detailVariant.finishes.map((f: any, i: number) => (
                      <View key={i} style={{ alignItems: "center", marginRight: 10, width: 70 }}>
                        {f.swatch ? (
                          <Image source={{ uri: f.swatch }} style={{ width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border }} />
                        ) : null}
                        <Text style={{ fontSize: 8, color: COLORS.textSecondary, textAlign: "center", marginTop: 2 }} numberOfLines={2}>{f.name || ""}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </>
              )}
              {(detailVariant.platforms?.length > 0 || detailVariant.carriers?.length > 0) && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                  {[...(detailVariant.platforms || []), ...(detailVariant.carriers || [])].map((t: string, i: number) => (
                    <View key={i} style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border }}>
                      <Text style={{ fontSize: 10, color: COLORS.textSecondary, fontWeight: "600" }}>{t}</Text>
                    </View>
                  ))}
                </View>
              )}
              {!detailVariant.features && !detailVariant.tech_characteristics && detailVariant.description && (
                <>
                  <Text style={s.detailLabel}>Descripción</Text>
                  <Text style={s.detailText}>{detailVariant.description}</Text>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const useS = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: ios.spacing.lg, paddingVertical: 10, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 20, fontWeight: "900", color: COLORS.text, flex: 1, textAlign: "center" },
  iconBtn: { width: 38, height: 38, borderRadius: ios.radius.md, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    margin: 8, paddingHorizontal: 10, height: 36, backgroundColor: COLORS.surface,
    borderRadius: ios.radius.md, borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.text },
  cartBar: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: COLORS.primary, gap: 10,
  },
  cartBarTitle: { color: "#fff", fontWeight: "700", fontSize: 13 },
  cartBarBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: ios.radius.pill },
  cartBarBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  familyBlock: { marginTop: 12, backgroundColor: COLORS.surface, borderRadius: ios.radius.md, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  familyName: { fontSize: 13, fontWeight: "800", color: COLORS.text, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.bg },
  variantRow: { flexDirection: "row", alignItems: "center", padding: 8, gap: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  variantThumb: { width: 40, height: 40, borderRadius: ios.radius.sm },
  variantTitle: { flex: 1, fontSize: 12, fontWeight: "600", color: COLORS.text },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primarySoft, alignItems: "center", justifyContent: "center" },
  qtyText: { fontSize: 14, fontWeight: "800", color: COLORS.text, minWidth: 20, textAlign: "center" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: COLORS.primary, borderRadius: ios.radius.pill },
  addBtnText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  formScroll: { padding: 16, gap: 4 },
  formLabel: { fontSize: 12, fontWeight: "700", color: COLORS.textSecondary, marginTop: 10, marginBottom: 4 },
  formInput: {
    height: 44, paddingHorizontal: 12, fontSize: 14, color: COLORS.text,
    backgroundColor: COLORS.surface, borderRadius: ios.radius.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 24, height: 50, backgroundColor: COLORS.primary,
    borderRadius: ios.radius.md,
  },
  submitBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },
  successContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 },
  successTitle: { fontSize: 22, fontWeight: "900", color: COLORS.text },
  successText: { fontSize: 14, color: COLORS.textSecondary, textAlign: "center" },
  backBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: COLORS.primary, borderRadius: ios.radius.md },
  backBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  detailOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", zIndex: 100,
  },
  detailContent: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: "80%", paddingBottom: 20,
  },
  detailHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  detailTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text, flex: 1, marginRight: 10 },
  detailImg: { width: "100%", height: 180, borderRadius: ios.radius.md, marginBottom: 10, backgroundColor: COLORS.bg },
  detailLabel: { fontSize: 12, fontWeight: "800", color: COLORS.primary, textTransform: "uppercase", marginTop: 10, marginBottom: 4 },
  detailText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
});
