import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ResponsiveLayout from "../src/ResponsiveLayout";
import { useBreakpoint } from "../src/useBreakpoint";
import { useThemedStyles } from "../src/theme";
import IOSHeader from "../src/ui/IOSHeader";
import { api, clearToken, COLORS } from "../src/api";
import { usePermissions } from "../src/permissions";

interface Producto {
  ref: string;
  descripcion: string;
  precio_unitario: number;
}

const DESCUENTOS = Array.from({ length: 101 }, (_, i) => i);
const STOCKS = Array.from({ length: 100 }, (_, i) => i + 1);

function formatPrecio(v: number | undefined | null): string {
  const n = typeof v === "number" && !isNaN(v) ? v : 0;
  return n.toFixed(2).replace(".", ",") + " €";
}

function calcPrecioConDescuento(precio: number, descuento: number): number {
  const p = typeof precio === "number" && !isNaN(precio) ? precio : 0;
  const d = typeof descuento === "number" && !isNaN(descuento) ? descuento : 0;
  return p * (1 - d / 100);
}

export default function PreciarioScreen() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const s = useThemedStyles(useS);
  const { has } = usePermissions();

  const puedeEditarDescuento = has("preciario.edit");
  const puedeVerPrecios = has("preciario.ver_precios");

  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [stockMin, setStockMin] = useState("");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pageSize = 50;

  const [descuentos, setDescuentos] = useState<Record<string, number>>({});
  const [stocks, setStocks] = useState<Record<string, number>>({});
  const [pickerOpen, setPickerOpen] = useState<string | null>(null);
  const [stockPickerOpen, setStockPickerOpen] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const fetchIdRef = useRef(0);

  const fetchData = useCallback(
    async (p: number, query: string, stock: string) => {
      const fetchId = ++fetchIdRef.current;
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (stock) params.set("stock_min", stock);
        params.set("page", String(p));
        params.set("page_size", String(pageSize));
        const data = await api.getPreciario(params.toString());
        if (fetchId !== fetchIdRef.current) return;
        setProductos(data.items || []);
        setDescuentos(data.descuentos || {});
        setStocks(data.stocks || {});
        setTotal(data.total || 0);
        setPage(data.page || p);
      } catch (e: any) {
        if (fetchId !== fetchIdRef.current) return;
        if (/401|Invalid|expired/i.test(e?.message || "")) {
          await clearToken();
          router.replace("/login");
          return;
        }
        setError(e?.message || "Error al cargar los datos");
        setProductos([]);
        setTotal(0);
      } finally {
        if (fetchId === fetchIdRef.current) setLoading(false);
      }
    },
    [router]
  );

  useFocusEffect(
    useCallback(() => {
      fetchData(1, "", "");
    }, [fetchData])
  );

  const onSearch = () => {
    fetchData(1, q, stockMin);
    setSearch(q);
  };

  const onClear = () => {
    setQ("");
    setSearch("");
    fetchData(1, "", stockMin);
  };

  const totalPages = Math.ceil(total / pageSize);

  const setDescuento = async (ref: string, valor: number) => {
    const prev = descuentos[ref];
    setDescuentos((p) => ({ ...p, [ref]: valor }));
    setSaveError("");
    try {
      await api.updateDescuento(ref, valor);
    } catch (e: any) {
      setDescuentos((p) => prev !== undefined ? { ...p, [ref]: prev } : (() => { const c = { ...p }; delete c[ref]; return c; })());
      setSaveError(e?.message || "Error al guardar el descuento");
    }
  };

  const setStock = async (ref: string, valor: number) => {
    const prev = stocks[ref];
    setStocks((p) => ({ ...p, [ref]: valor }));
    setSaveError("");
    try {
      await api.updateStock(ref, valor);
    } catch (e: any) {
      setStocks((p) => prev !== undefined ? { ...p, [ref]: prev } : (() => { const c = { ...p }; delete c[ref]; return c; })());
      setSaveError(e?.message || "Error al guardar el stock");
    }
  };

  const openPicker = (ref: string) => setPickerOpen(ref);
  const closePicker = () => setPickerOpen(null);
  const openStockPicker = (ref: string) => setStockPickerOpen(ref);
  const closeStockPicker = () => setStockPickerOpen(null);

  const content = (
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      {!isWide && <IOSHeader title="Preciario" />}

      <View style={s.body}>
        <Text style={s.heading}>Preciario</Text>

        <View style={s.searchRow}>
          <View style={s.searchInputWrap}>
            <Ionicons name="search" size={18} color={COLORS.textDisabled} />
            <TextInput
              style={s.searchInput}
              placeholder="Buscar por referencia o descripción..."
              placeholderTextColor={COLORS.textDisabled}
              value={q}
              onChangeText={setQ}
              onSubmitEditing={onSearch}
              returnKeyType="search"
            />
            {q.length > 0 && (
              <TouchableOpacity onPress={onClear}>
                <Ionicons name="close-circle" size={18} color={COLORS.textDisabled} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={s.searchBtn} onPress={onSearch}>
            <Text style={s.searchBtnText}>Buscar</Text>
          </TouchableOpacity>
        </View>

        <View style={s.filterRow}>
          <Text style={s.filterLabel}>Stock mínimo:</Text>
          {Platform.OS === "web" ? (
            <select
              value={stockMin}
              onChange={(e: any) => { setStockMin(e.target.value); fetchData(1, q, e.target.value); setSearch(q); }}
              style={{
                fontSize: 13,
                color: COLORS.text,
                backgroundColor: COLORS.surface,
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 8,
                paddingVertical: 6,
                paddingHorizontal: 10,
                outline: "none",
                minWidth: 100,
              } as any}
            >
              <option value="">Todos</option>
              <option value="1">&gt; 0</option>
              <option value="5">&gt; 5</option>
              <option value="10">&gt; 10</option>
              <option value="25">&gt; 25</option>
              <option value="50">&gt; 50</option>
              <option value="75">&gt; 75</option>
              <option value="100">&gt; 100</option>
            </select>
          ) : (
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: COLORS.surface,
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 8,
                paddingVertical: 8,
                paddingHorizontal: 12,
                gap: 8,
                minWidth: 100,
              }}
              onPress={() => {
                // Simple toggle on mobile: cycle through options
                const opts = ["", "1", "5", "10", "25", "50", "75", "100"];
                const idx = opts.indexOf(stockMin);
                const next = opts[(idx + 1) % opts.length];
                setStockMin(next);
                fetchData(1, q, next);
                setSearch(q);
              }}
            >
              <Text style={{ fontSize: 13, color: COLORS.text }}>
                {stockMin ? `> ${stockMin}` : "Todos"}
              </Text>
              <Ionicons name="chevron-down" size={12} color={COLORS.textDisabled} />
            </TouchableOpacity>
          )}
        </View>

        {search && (
          <Text style={s.resultInfo}>
            {total} resultados para "{search}"
          </Text>
        )}

        {saveError ? (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle" size={20} color={COLORS.errorText} />
            <Text style={s.errorText}>{saveError}</Text>
            <TouchableOpacity onPress={() => setSaveError("")}>
              <Ionicons name="close" size={18} color={COLORS.errorText} />
            </TouchableOpacity>
          </View>
        ) : null}

        {error ? (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle" size={20} color={COLORS.errorText} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={s.loadingText}>Cargando productos...</Text>
          </View>
        ) : (
          <>
            <ScrollView horizontal style={s.tableScroll}>
              <View style={s.table}>
                <View style={s.tableHeader}>
                  <Text style={[s.th, s.colRef]}>REF</Text>
                  <Text style={[s.th, s.colDesc]}>Descripción</Text>
                  {puedeVerPrecios && <Text style={[s.th, s.colPrecio]}>Precio Unitario</Text>}
                  {puedeVerPrecios && <Text style={[s.th, s.colDesc]}>Dto. %</Text>}
                  {puedeVerPrecios && <Text style={[s.th, s.colPrecio]}>Precio c/ Dto.</Text>}
                  <Text style={[s.th, s.colRef]}>Stock I-SAI</Text>
                </View>

                {productos.map((p) => {
                  const dto = Number(descuentos[p.ref]) || 0;
                  const stock = Number(stocks[p.ref]) || 0;
                  const precioDto = calcPrecioConDescuento(p.precio_unitario, dto);
                  return (
                    <View key={p.ref} style={s.tableRow}>
                      <Text style={[s.td, s.colRef]}>{p.ref}</Text>
                      <Text style={[s.td, s.colDesc]}>{p.descripcion}</Text>
                      {puedeVerPrecios && <Text style={[s.td, s.colPrecio]}>{formatPrecio(p.precio_unitario)}</Text>}
                      {puedeVerPrecios && (
                        <View style={[s.td, s.colDesc, s.selectWrap]}>
                          {Platform.OS === "web" ? (
                            <select
                              value={dto}
                              onChange={(e: any) => setDescuento(p.ref, Number(e.target.value))}
                              disabled={!puedeEditarDescuento}
                              style={{
                                fontSize: 13,
                                color: puedeEditarDescuento ? COLORS.text : COLORS.textDisabled,
                                backgroundColor: puedeEditarDescuento ? COLORS.surface : COLORS.readonly,
                                borderWidth: 1,
                                borderColor: COLORS.border,
                                borderRadius: 8,
                                paddingVertical: 4,
                                paddingHorizontal: 6,
                                outline: "none",
                                cursor: puedeEditarDescuento ? "pointer" : "not-allowed",
                              } as any}
                            >
                              {DESCUENTOS.map((d) => (
                                <option key={d} value={d}>{d}%</option>
                              ))}
                            </select>
                          ) : (
                            <TouchableOpacity
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                backgroundColor: puedeEditarDescuento ? COLORS.surface : COLORS.readonly,
                                borderWidth: 1,
                                borderColor: COLORS.border,
                                borderRadius: 8,
                                paddingVertical: 4,
                                paddingHorizontal: 8,
                                gap: 4,
                                minWidth: 60,
                                opacity: puedeEditarDescuento ? 1 : 0.6,
                              }}
                              onPress={puedeEditarDescuento ? () => openPicker(p.ref) : undefined}
                              disabled={!puedeEditarDescuento}
                            >
                              <Text style={{ fontSize: 13, color: puedeEditarDescuento ? COLORS.text : COLORS.textDisabled }}>{dto}%</Text>
                              <Ionicons name="chevron-down" size={12} color={COLORS.textDisabled} />
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                      {puedeVerPrecios && (
                        <Text style={[s.td, s.colPrecio, dto > 0 && s.precioDto]}>
                          {formatPrecio(precioDto)}
                        </Text>
                      )}
                      <View style={[s.td, s.colRef, s.selectWrap]}>
                        {Platform.OS === "web" ? (
                          <select
                            value={stock}
                            onChange={(e: any) => setStock(p.ref, Number(e.target.value))}
                            disabled={!puedeEditarDescuento}
                            style={{
                              fontSize: 13,
                              color: puedeEditarDescuento ? COLORS.text : COLORS.textDisabled,
                              backgroundColor: puedeEditarDescuento ? COLORS.surface : COLORS.readonly,
                              borderWidth: 1,
                              borderColor: COLORS.border,
                              borderRadius: 8,
                              paddingVertical: 4,
                              paddingHorizontal: 6,
                              outline: "none",
                              cursor: puedeEditarDescuento ? "pointer" : "not-allowed",
                            } as any}
                          >
                            <option value={0}>-</option>
                            {STOCKS.map((s) => (
                              <option key={s} value={s}>{s} uds.</option>
                            ))}
                          </select>
                        ) : (
                          <TouchableOpacity
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              backgroundColor: puedeEditarDescuento ? COLORS.surface : COLORS.readonly,
                              borderWidth: 1,
                              borderColor: COLORS.border,
                              borderRadius: 8,
                              paddingVertical: 4,
                              paddingHorizontal: 8,
                              gap: 4,
                              minWidth: 60,
                              opacity: puedeEditarDescuento ? 1 : 0.6,
                            }}
                            onPress={puedeEditarDescuento ? () => openStockPicker(p.ref) : undefined}
                            disabled={!puedeEditarDescuento}
                          >
                            <Text style={{ fontSize: 13, color: puedeEditarDescuento ? COLORS.text : COLORS.textDisabled }}>{stock > 0 ? `${stock} uds.` : "-"}</Text>
                            <Ionicons name="chevron-down" size={12} color={COLORS.textDisabled} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}

                {productos.length === 0 && (
                  <View style={s.emptyRow}>
                    <Ionicons name="search-outline" size={24} color={COLORS.textDisabled} />
                    <Text style={s.emptyText}>Sin resultados</Text>
                  </View>
                )}
              </View>
            </ScrollView>

            {totalPages > 1 && (
              <View style={s.pagination}>
                <TouchableOpacity
                  style={[s.pageBtn, page <= 1 && s.pageBtnDisabled]}
                  onPress={() => page > 1 && fetchData(page - 1, search, stockMin)}
                  disabled={page <= 1}
                >
                  <Ionicons
                    name="chevron-back"
                    size={18}
                    color={page <= 1 ? COLORS.textDisabled : COLORS.primary}
                  />
                </TouchableOpacity>
                <Text style={s.pageInfo}>
                  Pág. {page} de {totalPages}
                </Text>
                <TouchableOpacity
                  style={[s.pageBtn, page >= totalPages && s.pageBtnDisabled]}
                  onPress={() => page < totalPages && fetchData(page + 1, search, stockMin)}
                  disabled={page >= totalPages}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={page >= totalPages ? COLORS.textDisabled : COLORS.primary}
                  />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>

      {pickerOpen && Platform.OS !== "web" && (
        <Modal transparent animationType="fade" onRequestClose={closePicker}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center" }}
            activeOpacity={1}
            onPress={closePicker}
          >
            <View style={{ backgroundColor: COLORS.surface, borderRadius: 14, maxHeight: 300, width: 200, overflow: "hidden" }}>
              <View style={{ paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: COLORS.text }}>Descuento %</Text>
              </View>
              <FlatList
                data={DESCUENTOS}
                keyExtractor={(item) => String(item)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: item === descuentos[pickerOpen] ? COLORS.primarySoft : "transparent" }}
                    onPress={() => { setDescuento(pickerOpen, item); closePicker(); }}
                  >
                    <Text style={{ fontSize: 14, color: item === descuentos[pickerOpen] ? COLORS.primary : COLORS.text, fontWeight: item === descuentos[pickerOpen] ? "800" : "400" }}>
                      {item}%
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {stockPickerOpen && Platform.OS !== "web" && (
        <Modal transparent animationType="fade" onRequestClose={closeStockPicker}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center" }}
            activeOpacity={1}
            onPress={closeStockPicker}
          >
            <View style={{ backgroundColor: COLORS.surface, borderRadius: 14, maxHeight: 300, width: 200, overflow: "hidden" }}>
              <View style={{ paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: COLORS.text }}>Stock (uds.)</Text>
              </View>
              <FlatList
                data={STOCKS}
                keyExtractor={(item) => String(item)}
                renderItem={({ item }) => {
                  const current = stockPickerOpen ? (Number(stocks[stockPickerOpen]) || 0) : 0;
                  return (
                  <TouchableOpacity
                    style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: item === current ? COLORS.primarySoft : "transparent" }}
                    onPress={() => { setStock(stockPickerOpen!, item); closeStockPicker(); }}
                  >
                    <Text style={{ fontSize: 14, color: item === current ? COLORS.primary : COLORS.text, fontWeight: item === current ? "800" : "400" }}>
                      {item} uds.
                    </Text>
                  </TouchableOpacity>
                  );
                }}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  );

  return (
    <ResponsiveLayout active="documentos">
      {content}
    </ResponsiveLayout>
  );
}

const useS = () =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.bg },
    body: { flex: 1, padding: 20, paddingTop: 12 },
    heading: {
      fontSize: 26,
      fontWeight: "900",
      color: COLORS.text,
      letterSpacing: 0.2,
      marginBottom: 16,
    },
    searchRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 12,
    },
    searchInputWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: COLORS.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 14,
      gap: 8,
      height: 44,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: COLORS.text,
      paddingVertical: 0,
    },
    searchBtn: {
      backgroundColor: COLORS.primary,
      borderRadius: 12,
      paddingHorizontal: 18,
      alignItems: "center",
      justifyContent: "center",
      height: 44,
    },
    searchBtnText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "700",
    },
    resultInfo: {
      fontSize: 12.5,
      color: COLORS.textSecondary,
      marginBottom: 12,
    },
    filterRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    filterLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: COLORS.textSecondary,
    },
    tableScroll: { flex: 1, overflowX: "auto" as any },
    table: {
      minWidth: Platform.OS === "web" ? 1040 : 580,
    },
    tableHeader: {
      flexDirection: "row",
      backgroundColor: COLORS.readonly,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 4,
    },
    th: {
      fontSize: 11,
      fontWeight: "800",
      color: COLORS.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      paddingHorizontal: 6,
    },
    tableRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    td: {
      fontSize: 13,
      color: COLORS.text,
      paddingHorizontal: 6,
    },
    colRef: { width: 140, minWidth: 140 },
    colDesc: { flex: 1, minWidth: 180 },
    colPrecio: { width: 130, minWidth: 130, textAlign: "right" },
    selectWrap: {
      alignItems: "center",
      justifyContent: "center",
    },
    nativeSelect: {
      fontSize: 13,
      color: COLORS.text,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 8,
      paddingVertical: 4,
      paddingHorizontal: 6,
      outlineStyle: "none",
    } as any,
    precioDto: {
      color: COLORS.accent,
      fontWeight: "700",
    },
    emptyRow: {
      alignItems: "center",
      paddingVertical: 40,
      gap: 8,
    },
    emptyText: {
      fontSize: 14,
      color: COLORS.textDisabled,
    },
    pagination: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      marginTop: 8,
    },
    pageBtn: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: COLORS.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    pageBtnDisabled: {
      backgroundColor: COLORS.readonly,
    },
    pageInfo: {
      fontSize: 13,
      fontWeight: "700",
      color: COLORS.textSecondary,
    },
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: COLORS.errorBg,
      borderRadius: 12,
      padding: 16,
    },
    errorText: {
      fontSize: 13,
      color: COLORS.errorText,
      flex: 1,
    },
    loadingBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 40,
      justifyContent: "center",
    },
    loadingText: {
      fontSize: 13,
      color: COLORS.textSecondary,
    },
  });
