import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Modal,
  StyleSheet, ActivityIndicator, RefreshControl, Alert, Platform,
  LayoutAnimation, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, clearToken, COLORS } from "../src/api";
import { usePermissions } from "../src/permissions";
import ResponsiveLayout from "../src/ResponsiveLayout";
import { useBreakpoint } from "../src/useBreakpoint";
import { useThemedStyles, useTheme } from "../src/theme";
import { ios } from "../src/ui/iosTheme";

const STATUS_COLORS: Record<string, string> = {
  pendiente: COLORS.pendingText,
  planificado: COLORS.pillBlueText,
  a_facturar: COLORS.primary,
  facturado: COLORS.syncedText,
  terminado: COLORS.pillPurpleText,
  bloqueado: COLORS.pillOrangeText,
  anulado: COLORS.textSecondary,
  en_curso: COLORS.pillBlueText,
  completado: COLORS.syncedText,
  cancelado: COLORS.errorText,
};

const STATUS_BADGES: Record<string, { bg: string; fg: string; label: string }> = {
  a_facturar: { bg: COLORS.pillBlueBg, fg: COLORS.primary, label: "Facturar" },
  planificado: { bg: COLORS.pillBlueBg, fg: COLORS.pillBlueText, label: "Planif." },
  facturado: { bg: COLORS.syncedBg, fg: COLORS.syncedText, label: "Facturado" },
  terminado: { bg: COLORS.pillPurpleBg, fg: COLORS.pillPurpleText, label: "Terminado" },
  bloqueado: { bg: COLORS.pillOrangeBg, fg: COLORS.pillOrangeText, label: "Bloqueado" },
  anulado: { bg: COLORS.statusAnuladoBg, fg: COLORS.textSecondary, label: "Anulado" },
};

const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pend.", planificado: "Plan.", a_facturar: "Fact.",
  facturado: "Fact.", terminado: "Term.", bloqueado: "Bloq.", anulado: "Anul.",
};

const fmtFecha = (iso?: string) => {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

export default function Materiales() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const params = useLocalSearchParams<{ project_status?: string; year?: string; month?: string }>();
  const { isWide } = useBreakpoint();
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [stats, setStats] = useState<{ total: number; pending: number; synced: number } | null>(null);
  const [me, setMe] = useState<any>(null);
  const [managers, setManagers] = useState<any[]>([]);
  const [showManagerFilter, setShowManagerFilter] = useState(false);
  const [managerFilterIds, setManagerFilterIds] = useState<string[]>([]);
  const [statusFilterIds, setStatusFilterIds] = useState<string[]>(
    params.project_status ? params.project_status.split(",") : []
  );
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [managerStats, setManagerStats] = useState<any[]>([]);
  const [showManagerPanel, setShowManagerPanel] = useState(false);
  const [yearFilter, setYearFilter] = useState(params.year || "todos");
  const [monthFilter, setMonthFilter] = useState(params.month || "");
  const [sortField, setSortField] = useState<null | "fecha" | "fecha_prevista_planificacion">(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [viewMode, setViewMode] = useState<"lista" | "kanban" | "calendario">("lista");
  const [calCursor, setCalCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [calCollapsed, setCalCollapsed] = useState(false);
  const [pedidoFilter, setPedidoFilter] = useState<null | "si" | "no">(null);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [syncing, setSyncing] = useState(false);
  // Modal nuevo proyecto
  const [showNewProject, setShowNewProject] = useState(false);
  const [newMat, setNewMat] = useState("");
  const [newCli, setNewCli] = useState("");
  const [newUbi, setNewUbi] = useState("");
  const [newHoras, setNewHoras] = useState("");
  const [newGestor, setNewGestor] = useState("");
  const [newFecha, setNewFecha] = useState("");
  const [newStatus, setNewStatus] = useState("pendiente");
  const [newTecnico, setNewTecnico] = useState("");
  const [newComent, setNewComent] = useState("");
  const [newSaving, setNewSaving] = useState(false);
  const [quickEdit, setQuickEdit] = useState<any>(null);
  const [qeStatus, setQeStatus] = useState("pendiente");
  const [qePlan, setQePlan] = useState("");
  const [qePedido, setQePedido] = useState<null | "si" | "no">(null);
  const [qeNotas, setQeNotas] = useState("");
  const [qeSaving, setQeSaving] = useState(false);
  const [dashNotes, setDashNotes] = useState<any[]>([]);
  const [dashNoteText, setDashNoteText] = useState("");
  const NOTE_COLORS = ["#1E88E5", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];
  const [noteColorMenu, setNoteColorMenu] = useState<string | null>(null);

  const s = useThemedStyles(useS);
  const { theme } = useTheme();

  const PROJECT_STATUSES = [
    { key: "pendiente", label: "Pendiente", color: STATUS_COLORS.pendiente },
    { key: "planificado", label: "Planificado", color: STATUS_COLORS.planificado },
    { key: "a_facturar", label: "A facturar", color: STATUS_COLORS.a_facturar },
    { key: "facturado", label: "Facturado", color: STATUS_COLORS.facturado },
    { key: "terminado", label: "Terminado", color: STATUS_COLORS.terminado },
    { key: "bloqueado", label: "Bloqueado", color: STATUS_COLORS.bloqueado },
    { key: "anulado", label: "Anulado", color: STATUS_COLORS.anulado },
    { key: "en_curso", label: "En curso", color: STATUS_COLORS.en_curso },
    { key: "completado", label: "Completado", color: STATUS_COLORS.completado },
    { key: "cancelado", label: "Cancelado", color: STATUS_COLORS.cancelado },
  ];

  useEffect(() => {
    if (!params.project_status && !params.year && !params.month) {
      AsyncStorage.getItem("mat_manager_filter").then((v) => {
        if (v) try { setManagerFilterIds(JSON.parse(v)); } catch {}
      }).catch(() => {});
      AsyncStorage.getItem("mat_status_filter").then((v) => {
        if (v) try { setStatusFilterIds(JSON.parse(v)); } catch {}
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("mat_manager_filter", JSON.stringify(managerFilterIds)).catch(() => {});
  }, [managerFilterIds]);

  useEffect(() => {
    AsyncStorage.setItem("mat_status_filter", JSON.stringify(statusFilterIds)).catch(() => {});
  }, [statusFilterIds]);

  const load = useCallback(async () => {
    try {
      const managerId = managerFilterIds.length > 0 && !managerFilterIds.includes("__none__")
        ? managerFilterIds.join(",") : undefined;
      const unassigned = managerFilterIds.includes("__none__");
      const statusParam = statusFilterIds.length > 0 ? statusFilterIds.join(",") : undefined;
      const [list, st, u] = await Promise.all([
        api.listMateriales(q || undefined, pendingOnly, managerId, unassigned, statusParam, yearFilter, monthFilter),
        api.stats(),
        me ? Promise.resolve(me) : api.me(),
      ]);
      setItems(list);
      setStats(st);
      if (!me) setMe(u);
    } catch (e: any) {
      if (/401|Invalid|expired/i.test(e.message)) {
        await clearToken();
        routerRef.current.replace("/login");
      } else {
        Alert.alert("Error", e.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [q, pendingOnly, managerFilterIds, statusFilterIds, yearFilter, monthFilter, me]);

  useFocusEffect(useCallback(() => {
    load();
    api.listManagers().then(setManagers).catch(() => {});
    api.statsByManager(yearFilter).then(setManagerStats).catch(() => {});
    api.listDashboardNotes().then(setDashNotes).catch(() => {});
  }, [load, yearFilter]));

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const toggleManagerFilter = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setManagerFilterIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleStatusFilter = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStatusFilterIds((prev) => prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]);
  };

  const clearManagerFilter = () => setManagerFilterIds([]);

  const syncSheets = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await api.syncGoogleSheets();
      Alert.alert("Sincronización completada", `Proyectos añadidos: ${res.imported}\nProyectos modificados: ${res.updated}`);
      load();
    } catch (e: any) {
      Alert.alert("Error de sincronización", e.message || "No se pudo sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  const openQuickEdit = (item: any) => {
    setQuickEdit(item);
    setQeStatus(item.project_status || "pendiente");
    setQePlan(item.fecha_prevista_planificacion || "");
    setQePedido(item.pedido_realizado === true ? "si" : item.pedido_realizado === false ? "no" : null);
    setQeNotas(item.comentarios || "");
  };

  const saveQuickEdit = async () => {
    if (!quickEdit) return;
    setQeSaving(true);
    try {
      await api.updateMaterial(quickEdit.id, {
        project_status: qeStatus,
        fecha_prevista_planificacion: qePlan || null,
        pedido_realizado: qePedido === "si" ? true : qePedido === "no" ? false : null,
        comentarios: qeNotas || null,
      });
      setQuickEdit(null);
      load();
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo guardar");
    } finally {
      setQeSaving(false);
    }
  };

  const addDashNote = async () => {
    const t = dashNoteText.trim();
    if (!t) return;
    try {
      await api.createDashboardNote(t, NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)]);
      setDashNoteText("");
      const notes = await api.listDashboardNotes();
      setDashNotes(notes);
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo guardar la nota");
    }
  };

  const deleteDashNote = async (id: string) => {
    try {
      await api.deleteDashboardNote(id);
      setDashNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo borrar la nota");
    }
  };

  const changeNoteColor = async (id: string, color: string) => {
    try {
      await api.updateDashboardNote(id, color);
      setDashNotes((prev) => prev.map((n) => (n.id === id ? { ...n, color } : n)));
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo cambiar el color");
    }
  };

  const logout = async () => {
    await clearToken();
    router.replace("/login");
  };

  const isAdmin = me?.role === "admin";

  const { has } = usePermissions();
  const esEditorCompleto = has("proyectos.edit");

  const filteredItems = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    return items.filter((it: any) => {
      if (pedidoFilter === "si" && it.pedido_realizado !== true) return false;
      if (pedidoFilter === "no" && it.pedido_realizado === true) return false;
      return !overdueOnly || (it.fecha_prevista_planificacion && it.fecha_prevista_planificacion < hoy && !["terminado", "facturado", "anulado", "cancelado", "completado"].includes(it.project_status));
    });
  }, [items, pedidoFilter, overdueOnly]);

  const sortedItems = useMemo(() => {
    if (!sortField) return filteredItems;
    const arr = [...filteredItems];
    arr.sort((a: any, b: any) => {
      const fa = (a[sortField] || "").toString();
      const fb = (b[sortField] || "").toString();
      if (!fa && !fb) return 0;
      if (!fa) return 1;
      if (!fb) return -1;
      const cmp = fa.localeCompare(fb);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filteredItems, sortField, sortDir]);

  const planificadosCount = useMemo(() => items.filter((it: any) => it.project_status === "planificado").length, [items]);
  const vencidosCount = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    return items.filter((it: any) => {
      const fp = it.fecha_prevista_planificacion;
      return fp && fp < hoy && !["terminado", "facturado", "anulado", "cancelado", "completado"].includes(it.project_status);
    }).length;
  }, [items]);

  const groupedByStatus = useMemo(() => {
    if (statusFilterIds.length < 2) return null;
    return statusFilterIds.map((key) => {
      const st = PROJECT_STATUSES.find((x) => x.key === key);
      return {
        key,
        label: st?.label || key,
        color: st?.color || COLORS.primary,
        items: sortedItems.filter((it: any) => (it.project_status || "pendiente") === key),
      };
    });
  }, [statusFilterIds, sortedItems]);

  const kanbanColumns = useMemo(() => {
    const order = PROJECT_STATUSES.filter((st) => sortedItems.some((it: any) => (it.project_status || "pendiente") === st.key)).map((st) => st.key);
    return order.map((key) => {
      const st = PROJECT_STATUSES.find((x) => x.key === key);
      return {
        key,
        label: st?.label || key,
        color: st?.color || COLORS.primary,
        items: sortedItems.filter((it: any) => (it.project_status || "pendiente") === key),
      };
    });
  }, [sortedItems]);

  const calDays = useMemo(() => {
    const { year, month } = calCursor;
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (null | { day: number; date: string })[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, date: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
    }
    return cells;
  }, [calCursor]);

  const projectsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const it of sortedItems) {
      const fp = it.fecha_prevista_planificacion;
      if (!fp) continue;
      (map[fp] = map[fp] || []).push(it);
    }
    return map;
  }, [sortedItems]);

  const calMonthLabel = new Date(calCursor.year, calCursor.month, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const calTodayStr = new Date().toISOString().slice(0, 10);
  const calPrev = () => setCalCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }));
  const calNext = () => setCalCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }));
  const calToday = () => { const d = new Date(); setCalCursor({ year: d.getFullYear(), month: d.getMonth() }); };

  const renderItem = ({ item }: any) => {
    const pending = item.sync_status === "pending";
    const projectStatus = item.project_status || "pendiente";
    const statusColor = STATUS_COLORS[projectStatus] || COLORS.pendingText;
    const st = item.project_status && item.project_status !== "pendiente" ? STATUS_BADGES[item.project_status] : null;
    const horasPrev = parseFloat(item.horas_prev) || 0;
    const horasImp = parseFloat(item.horas_imputadas) || 0;
    const initials = (item.gestor || item.manager_name || "?")
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    const planRaw = item.fecha_prevista_planificacion;
    const doneState = ["terminado", "facturado", "anulado"].includes(projectStatus);
    let planTagStyle: any = null;
    if (planRaw && !doneState) {
      const hoy = new Date().toISOString().slice(0, 10);
      if (planRaw < hoy) planTagStyle = { backgroundColor: COLORS.errorBg, color: COLORS.errorText };
      else {
        const diff = (new Date(planRaw).getTime() - new Date(hoy).getTime()) / 86400000;
        if (diff <= 7) planTagStyle = { backgroundColor: COLORS.pendingBg, color: COLORS.pendingText };
        else planTagStyle = { backgroundColor: COLORS.syncedBg, color: COLORS.syncedText };
      }
    }

    return (
      <TouchableOpacity
        testID={`material-item-${item.id}`}
        style={s.card}
        onPress={() => openQuickEdit(item)}
        activeOpacity={0.7}
      >
        <View style={[s.cardBar, { backgroundColor: statusColor }]} />
        <View style={s.cardBody}>
          <View style={s.cardAvatar}>
            <Text style={s.cardAvatarText}>{initials || "?"}</Text>
          </View>
          <View style={s.cardInfo}>
            <View style={s.cardTopRow}>
              {item.numero_pedido ? (
                <Text style={s.cardNumero} numberOfLines={1}>{item.numero_pedido}</Text>
              ) : null}
              <Text style={s.cardCode} numberOfLines={1}>{item.materiales || "—"}</Text>
              {item.cliente && item.cliente !== item.materiales ? (
                <Text style={s.cardClient} numberOfLines={1}>{item.cliente}</Text>
              ) : null}
            </View>
            {item.ubicacion ? (
              <View style={s.cardAddressRow}>
                <Ionicons name="location-outline" size={10} color={COLORS.textSecondary} />
                <Text style={s.cardAddress} numberOfLines={1}>{item.ubicacion}</Text>
              </View>
            ) : null}
            <View style={s.cardMetaRow}>
              {item.fecha ? (
                <View style={s.cardMetaTag}>
                  <Ionicons name="calendar-outline" size={9} color={COLORS.textSecondary} />
                  <Text style={s.cardMetaText}>Alta: {fmtFecha(item.fecha)}</Text>
                </View>
              ) : null}
              {item.comentarios ? (
                <View style={s.cardMetaTag}>
                  <Ionicons name="document-text-outline" size={9} color={COLORS.textSecondary} />
                  <Text style={s.cardMetaText} numberOfLines={1}>{item.comentarios}</Text>
                </View>
              ) : null}
              {(horasPrev > 0 || horasImp > 0) && (
                <View style={[s.cardMetaTag, horasPrev > 0 && horasImp > horasPrev ? { backgroundColor: COLORS.errorBg } : null]}>
                  <Ionicons name="time-outline" size={11} color={horasPrev > 0 && horasImp > horasPrev ? COLORS.errorText : COLORS.textSecondary} />
                  <Text style={[s.cardMetaText, horasPrev > 0 && horasImp > horasPrev ? { color: COLORS.errorText, fontWeight: "700" } : null]}>{horasImp}/{horasPrev} h</Text>
                </View>
              )}
              {item.tecnicos?.length ? (
                <View style={s.cardMetaTag}>
                  <Text style={s.cardMetaText}>{item.tecnicos.join(", ")}</Text>
                </View>
              ) : null}
              {item.pedido_realizado === true && (
                <View style={[s.cardMetaTag, { backgroundColor: "#D1FAE5" }]}>
                  <Ionicons name="checkmark-circle" size={10} color="#059669" style={{ marginRight: 2 }} />
                  <Text style={[s.cardMetaText, { color: "#059669", fontWeight: "700" }]}>Pedido</Text>
                </View>
              )}
              {item.fecha_entrega_material ? (
                <View style={s.cardMetaTag}>
                  <Ionicons name="cube-outline" size={9} color={COLORS.textSecondary} />
                  <Text style={s.cardMetaText}>Entr: {item.fecha_entrega_material}</Text>
                </View>
              ) : null}
              {item.fecha_prevista_planificacion ? (
                <View style={[s.cardMetaTag, planTagStyle ? { backgroundColor: planTagStyle.backgroundColor } : null]}>
                  <Ionicons name="calendar-outline" size={9} color={planTagStyle ? planTagStyle.color : COLORS.textSecondary} />
                  <Text style={[s.cardMetaText, planTagStyle ? { color: planTagStyle.color, fontWeight: "700" } : null]}>Plan: {fmtFecha(item.fecha_prevista_planificacion)}</Text>
                </View>
              ) : null}
              {item.fecha_prevista_facturacion ? (
                <View style={[s.cardMetaTag, { backgroundColor: COLORS.pillPurpleBg }]}>
                  <Ionicons name="cash-outline" size={9} color={COLORS.pillPurpleText} />
                  <Text style={[s.cardMetaText, { color: COLORS.pillPurpleText }]}>Fact: {item.fecha_prevista_facturacion}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={s.cardRight}>
            <View style={{ flexDirection: "row", gap: 4 }}>
              {st && (
                <View style={[s.cardBadge, { backgroundColor: st.bg }]}>
                  <Text style={[s.cardBadgeText, { color: st.fg }]}>{st.label}</Text>
                </View>
              )}
              <View style={[s.cardBadge, { backgroundColor: pending ? COLORS.pendingBg : COLORS.syncedBg }]}>
                <Text style={[s.cardBadgeText, { color: pending ? COLORS.pendingText : COLORS.syncedText }]}>
                  {pending ? "PEND" : "SINC"}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={s.cardMoreBtn}>
              <Ionicons name="ellipsis-horizontal" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderNotesBlock = () => (
    <View style={s.managerSection}>
      <Text style={s.managerSectionTitle}>NOTAS</Text>
      <View style={{ flexDirection: "row", gap: 6, marginBottom: 8, alignItems: "flex-end" }}>
        <TextInput
          style={{ flex: 1, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: COLORS.text, minHeight: 40, textAlignVertical: "top" }}
          value={dashNoteText}
          onChangeText={setDashNoteText}
          placeholder="Escribe una anotación..."
          placeholderTextColor={COLORS.textDisabled}
          multiline
        />
        <TouchableOpacity onPress={addDashNote} style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      {dashNotes.map((n) => (
        <View key={n.id}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
            <Text style={{ flex: 1, fontSize: 13, color: COLORS.text, lineHeight: 18, textDecorationLine: "underline", textDecorationColor: n.color || COLORS.primary }}>{n.texto}</Text>
            <TouchableOpacity onPress={() => setNoteColorMenu(noteColorMenu === n.id ? null : n.id)} hitSlop={8}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: n.color || COLORS.primary, borderWidth: 2, borderColor: COLORS.border }} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteDashNote(n.id)} hitSlop={8}>
              <Ionicons name="close" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          {noteColorMenu === n.id && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6, paddingLeft: 4 }}>
              {NOTE_COLORS.map((c) => (
                <TouchableOpacity key={c} onPress={() => { changeNoteColor(n.id, c); setNoteColorMenu(null); }} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c, borderWidth: n.color === c ? 3 : 1, borderColor: n.color === c ? COLORS.text : "#fff" }} />
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );

  const renderStatsSidebar = () => {
    if (managerStats.length === 0) return <>{renderNotesBlock()}</>;
    const totalProyectos = managerStats.reduce((s, m) => s + m.total, 0);
    const totalByStatus: Record<string, number> = {};
    managerStats.forEach((m) => {
      Object.entries(m.by_status as Record<string, { count: number }>).forEach(([st, info]) => {
        totalByStatus[st] = (totalByStatus[st] || 0) + info.count;
      });
    });
    return (
      <>
        {Platform.OS === "web" ? (
          <select
            value={yearFilter}
            onChange={(e: any) => setYearFilter(e.target.value)}
            style={{
              width: "100%", fontSize: 12, fontWeight: "600", color: COLORS.text,
              backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
              borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 4,
              outline: "none", fontFamily: "inherit",
            } as any}
          >
            <option value="todos">Todos los años</option>
            {Array.from({ length: new Date().getFullYear() - 2021 }, (_, i) => 2022 + i).map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        ) : (
          <TouchableOpacity
            style={s.teamSelector}
            onPress={() => {
              const years = ["todos", ...Array.from({ length: new Date().getFullYear() - 2021 }, (_, i) => String(2022 + i))];
              const idx = years.indexOf(yearFilter);
              setYearFilter(years[(idx + 1) % years.length]);
            }}
          >
            <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
            <Text style={{ flex: 1, color: COLORS.text, fontSize: 13, fontWeight: "600" }}>
              {yearFilter === "todos" ? "Todos los años" : yearFilter}
            </Text>
            <Ionicons name="chevron-down" size={12} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={s.totalKpiCard}
          onPress={() => { setManagerFilterIds([]); setStatusFilterIds([]); }}
          activeOpacity={0.7}
        >
          <View style={s.totalKpiHeader}>
            <Ionicons name="layers-outline" size={14} color={COLORS.primary} />
            <Text style={s.totalKpiLabel}>TOTAL</Text>
          </View>
          <Text style={s.totalKpiNumber}>{totalProyectos}</Text>
          <View style={s.totalKpiPills}>
            {Object.entries(totalByStatus).sort(([a], [b]) => a.localeCompare(b)).map(([st, count]) => {
              const color = STATUS_COLORS[st] || COLORS.textSecondary;
              const active = statusFilterIds.includes(st);
              return (
                <TouchableOpacity
                  key={st}
                  style={[s.statusPill, { backgroundColor: active ? color : color + "18" }]}
                  onPress={() => {
                    setStatusFilterIds((p) => p.includes(st) ? p.filter((x) => x !== st) : [...p, st]);
                  }}
                >
                  <Text style={[s.statusPillText, { color: active ? "#fff" : color }]}>
                    {STATUS_LABELS[st] || st} {count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <View style={{ flex: 1, backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.pendingText }}>{totalByStatus["pendiente"] || 0}</Text>
            <Text style={{ fontSize: 10, fontWeight: "600", color: COLORS.textSecondary }}>Pendientes</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.primary }}>{planificadosCount}</Text>
            <Text style={{ fontSize: 10, fontWeight: "600", color: COLORS.textSecondary }}>Planificados</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.errorText }}>{vencidosCount}</Text>
            <Text style={{ fontSize: 10, fontWeight: "600", color: COLORS.textSecondary }}>Plan. vencida</Text>
          </View>
        </View>

        <View style={s.managerSection}>
          <Text style={s.managerSectionTitle}>RESPONSABLES</Text>
          {managerStats.map((mgr) => (
            <TouchableOpacity
              key={mgr.id}
              style={[s.managerRow, managerFilterIds.includes(mgr.id) && s.managerRowActive]}
              onPress={() => {
                setManagerFilterIds((p) => p.includes(mgr.id) ? p.filter((x) => x !== mgr.id) : [...p, mgr.id]);
              }}
              activeOpacity={0.7}
            >
              <View style={[s.managerDot, { backgroundColor: mgr.color }]} />
              <Text style={[s.managerName, managerFilterIds.includes(mgr.id) && { color: COLORS.text, fontWeight: "700" }]} numberOfLines={1}>
                {mgr.name.split(" ")[0]}
              </Text>
              <Text style={s.managerTotal}>{mgr.total}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {renderNotesBlock()}
      </>
    );
  };

  const renderMobileStats = () => {
    if (managerStats.length === 0) return null;
    const totalProyectos = managerStats.reduce((s, m) => s + m.total, 0);
    const totalByStatus: Record<string, number> = {};
    managerStats.forEach((m) => {
      Object.entries(m.by_status as Record<string, { count: number }>).forEach(([st, info]) => {
        totalByStatus[st] = (totalByStatus[st] || 0) + info.count;
      });
    });
    return (
      <View style={s.mobileStats}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: COLORS.textSecondary }}>Año:</Text>
          {Platform.OS === "web" ? (
            <select
              value={yearFilter}
              onChange={(e: any) => setYearFilter(e.target.value)}
              style={{
                fontSize: 12, fontWeight: "600", color: COLORS.text,
                backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
                borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10,
                outline: "none",
              } as any}
            >
              <option value="todos">Todos</option>
              {Array.from({ length: new Date().getFullYear() - 2021 }, (_, i) => 2022 + i).map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          ) : (
            <TouchableOpacity
              style={{
                flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface,
                borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
                paddingVertical: 6, paddingHorizontal: 10, gap: 6,
              }}
              onPress={() => {
                const years = ["todos", ...Array.from({ length: new Date().getFullYear() - 2021 }, (_, i) => String(2022 + i))];
                const idx = years.indexOf(yearFilter);
                setYearFilter(years[(idx + 1) % years.length]);
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: COLORS.text }}>
                {yearFilter === "todos" ? "Todos" : yearFilter}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={s.totalKpiCardMobile}
          onPress={() => { setManagerFilterIds([]); setStatusFilterIds([]); }}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Ionicons name="layers-outline" size={14} color={COLORS.primary} />
            <Text style={{ fontSize: 11, fontWeight: "700", color: COLORS.primary, letterSpacing: 1, textTransform: "uppercase", flex: 1 }}>TOTAL</Text>
            <Text style={{ fontSize: 20, fontWeight: "800", color: COLORS.text }}>{totalProyectos}</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {Object.entries(totalByStatus).sort(([a], [b]) => a.localeCompare(b)).map(([st, count]) => {
              const color = STATUS_COLORS[st] || COLORS.textSecondary;
              const active = statusFilterIds.includes(st);
              return (
                <TouchableOpacity
                  key={st}
                  style={{ backgroundColor: active ? color : color + "18", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}
                  onPress={() => {
                    setStatusFilterIds((p) => p.includes(st) ? p.filter((x) => x !== st) : [...p, st]);
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: active ? "#fff" : color }}>
                    {STATUS_LABELS[st] || st} {count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>

        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: COLORS.textSecondary, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>RESPONSABLES</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8, paddingRight: 8 }}>
              {managerStats.map((mgr) => (
                <TouchableOpacity
                  key={mgr.id}
                  style={{
                    backgroundColor: managerFilterIds.includes(mgr.id) ? COLORS.border : COLORS.surface,
                    borderRadius: 14, borderWidth: 1,
                    borderColor: managerFilterIds.includes(mgr.id) ? mgr.color : COLORS.border,
                    padding: 12, minWidth: 150,
                  }}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setManagerFilterIds((p) => p.includes(mgr.id) ? p.filter((x) => x !== mgr.id) : [...p, mgr.id]);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: mgr.color }} />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.text }} numberOfLines={1}>
                      {mgr.name.split(" ")[0]}
                    </Text>
                    <Text style={{ fontSize: 11, color: COLORS.textSecondary, fontWeight: "600" }}>{mgr.total}</Text>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                    {Object.entries(mgr.by_status as Record<string, { count: number; label: string; color: string }>).map(([st, info]) => (
                      <TouchableOpacity
                        key={st}
                        style={{
                          backgroundColor: info.color + "20", borderRadius: 6,
                          paddingHorizontal: 8, paddingVertical: 2,
                          borderWidth: statusFilterIds.includes(st) ? 1 : 0,
                          borderColor: info.color,
                        }}
                        onPress={() => {
                          setStatusFilterIds((p) => p.includes(st) ? p.filter((x) => x !== st) : [...p, st]);
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: "700", color: info.color }}>
                          {info.label} {info.count}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <TouchableOpacity style={s.newProjectBtnMobile} activeOpacity={0.8} onPress={() => setShowNewProject(true)}>
          <Text style={s.newProjectBtnText}>+ Nuevo proyecto</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ResponsiveLayout active="proyectos" isAdmin={isAdmin} onLogout={logout} userName={me?.name}>
      <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
        <View style={s.container}>
          {isWide && (
            <ScrollView style={s.leftPanel} contentContainerStyle={s.leftPanelContent}>
              {renderStatsSidebar()}
            </ScrollView>
          )}

          <View style={s.mainContent}>
            <View style={s.header}>
              <View style={s.headerLeft}>
                <Text style={s.headerTitle}>Proyectos</Text>
                <Text style={s.headerSubtitle}>Todos tus proyectos en un solo lugar</Text>
              </View>
              <View style={s.headerRight}>
                <TouchableOpacity style={[s.headerIcon, { backgroundColor: COLORS.primary }]} onPress={() => setShowNewProject(true)}>
                  <Ionicons name="add" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={s.headerIcon}>
                  <Ionicons name="notifications-outline" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={s.headerIcon}>
                  <Ionicons name="settings-outline" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {!isWide && renderMobileStats()}

            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              <View style={s.calHeader}>
                <TouchableOpacity onPress={calPrev} style={s.calNavBtn}>
                  <Ionicons name="chevron-back" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
                <Text style={s.calTitle}>{calMonthLabel}</Text>
                <TouchableOpacity onPress={calNext} style={s.calNavBtn}>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={calToday} style={[s.calNavBtn, { width: "auto", paddingHorizontal: 12 }]}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: COLORS.primary }}>Hoy</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setCalCollapsed((v) => !v)} style={s.calNavBtn}>
                  <Ionicons name={calCollapsed ? "chevron-down" : "chevron-up"} size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
              {!calCollapsed && (
                <>
                  <View style={s.calWeekdays}>
                    {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => (
                      <Text key={i} style={s.calWeekday}>{d}</Text>
                    ))}
                  </View>
                  <View style={s.calGrid}>
                    {calDays.map((cell, i) =>
                      cell === null ? (
                        <View key={i} style={s.calCell} />
                      ) : (
                        <View key={i} style={[s.calCell, cell.date === calTodayStr && s.calCellToday]}>
                          <Text style={[s.calDayNum, cell.date === calTodayStr && { color: COLORS.primary, fontWeight: "800" }]}>{cell.day}</Text>
                          {(projectsByDate[cell.date] || []).map((p: any) => (
                            <TouchableOpacity
                              key={p.id}
                              onPress={() => openQuickEdit(p)}
                              style={[s.calChip, { backgroundColor: (STATUS_COLORS[p.project_status] || COLORS.primary) + "22" }]}
                            >
                              <Text style={[s.calChipText, { color: STATUS_COLORS[p.project_status] || COLORS.primary }]} numberOfLines={1}>
                                {p.numero_pedido ? `${p.numero_pedido} · ${p.materiales || ""}` : (p.materiales || "")}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )
                    )}
                  </View>
                </>
              )}
            </View>

            <View style={s.viewSelector}>
              {[
                { key: "lista", label: "Lista", icon: "list-outline" },
                { key: "kanban", label: "Tablero", icon: "grid-outline" },
              ].map((v) => (
                <TouchableOpacity
                  key={v.key}
                  onPress={() => setViewMode(v.key as any)}
                  style={[s.viewBtn, viewMode === v.key && s.viewBtnActive]}
                >
                  <Ionicons name={v.icon as any} size={14} color={viewMode === v.key ? "#fff" : COLORS.textSecondary} />
                  <Text style={[s.viewBtnText, viewMode === v.key && s.viewBtnTextActive]}>{v.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.focusRow}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Ver todos los proyectos" onPress={() => setOverdueOnly(false)} style={[s.focusChip, !overdueOnly && s.focusChipActive]}>
                <Text style={[s.focusCount, !overdueOnly && s.focusTextActive]}>{items.length}</Text>
                <Text style={[s.focusLabel, !overdueOnly && s.focusTextActive]}>Todos</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Ver proyectos con planificación vencida" onPress={() => setOverdueOnly((v) => !v)} style={[s.focusChip, overdueOnly && { backgroundColor: COLORS.errorBg, borderColor: COLORS.errorText }]}>
                <Ionicons name="alert-circle-outline" size={16} color={COLORS.errorText} />
                <Text style={[s.focusCount, { color: COLORS.errorText }]}>{vencidosCount}</Text>
                <Text style={[s.focusLabel, overdueOnly && { color: COLORS.errorText }]}>Vencidos</Text>
              </TouchableOpacity>
              <Text style={s.focusHint}>{sortedItems.length} visibles · toca un proyecto para editarlo</Text>
            </View>

            <View style={s.searchRow}>
              <View style={s.searchBox}>
                <Ionicons name="search-outline" size={16} color={COLORS.textSecondary} />
                <TextInput
                  testID="input-search"
                  style={s.searchInput}
                  value={q}
                  onChangeText={setQ}
                  placeholder="Buscar cliente, proyecto, ubicación..."
                  placeholderTextColor={COLORS.textDisabled}
                />
                {q.length > 0 && (
                  <TouchableOpacity onPress={() => setQ("")}>
                    <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                testID="btn-filter-pending"
                style={[s.actionChip, pendingOnly && s.actionChipActive]}
                onPress={() => setPendingOnly(!pendingOnly)}
              >
                <Ionicons name="time-outline" size={14} color={pendingOnly ? "#fff" : COLORS.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                testID="btn-sort-date"
                style={[s.actionChip, sortField && s.actionChipActive]}
                onPress={() => setShowSortMenu((v) => !v)}
              >
                <Ionicons name="swap-vertical-outline" size={14} color={sortField ? "#fff" : COLORS.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                testID="btn-filter-pedido"
                style={[s.actionChip, pedidoFilter && s.actionChipActive]}
                onPress={() => setPedidoFilter((v) => (v === null ? "si" : v === "si" ? "no" : null))}
              >
                <Ionicons
                  name={pedidoFilter === "si" ? "checkmark-circle-outline" : pedidoFilter === "no" ? "close-circle-outline" : "cube-outline"}
                  size={14}
                  color={pedidoFilter ? "#fff" : COLORS.textSecondary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                testID="btn-sync-sheets"
                style={[s.actionChip, { borderColor: COLORS.primary }]}
                onPress={syncSheets}
              >
                {syncing ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Ionicons name="sync-outline" size={14} color={COLORS.primary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                testID="btn-filter-manager"
                style={[s.actionChip, managerFilterIds.length > 0 && s.actionChipActive]}
                onPress={() => { setShowManagerFilter((v) => !v); }}
              >
                <Ionicons name="people-outline" size={14} color={managerFilterIds.length > 0 ? "#fff" : COLORS.textSecondary} />
              </TouchableOpacity>
              {esEditorCompleto && (
                <TouchableOpacity
                  testID="btn-filter-status"
                  style={[s.actionChip, statusFilterIds.length > 0 && s.actionChipActive]}
                  onPress={() => { setShowStatusFilter((v) => !v); }}
                >
                  <Ionicons name="flag-outline" size={14} color={statusFilterIds.length > 0 ? "#fff" : COLORS.textSecondary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[s.actionChip, { borderColor: COLORS.syncedText }]}
                onPress={async () => {
                  try { await api.exportProjectsExcel(); }
                  catch (e: any) { Alert.alert("Error", "No se pudo exportar"); }
                }}
              >
                <Ionicons name="download-outline" size={13} color={COLORS.syncedText} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionChip, { borderColor: COLORS.primary }]}
                onPress={() => router.push("/mapa")}
              >
                <Ionicons name="map-outline" size={13} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionChip, { borderColor: COLORS.pendingText }]}
                onPress={() => router.push("/archivos")}
              >
                <Ionicons name="folder-open-outline" size={13} color={COLORS.pendingText} />
              </TouchableOpacity>
              {(managerFilterIds.length > 0 || statusFilterIds.length > 0) && (
                <TouchableOpacity
                  style={[s.actionChip, { borderColor: COLORS.errorText }]}
                  onPress={() => { clearManagerFilter(); setStatusFilterIds([]); }}
                >
                  <Ionicons name="close-outline" size={14} color={COLORS.errorText} />
                </TouchableOpacity>
              )}
            </View>

            {showManagerFilter && (
              <View style={s.filterChipsRow}>
                <View style={s.filterChips}>
                  <TouchableOpacity
                    style={[s.filterChip, managerFilterIds.includes("__none__") && s.filterChipActive]}
                    onPress={() => toggleManagerFilter("__none__")}
                  >
                    <Text style={[s.filterChipText, managerFilterIds.includes("__none__") && s.filterChipTextActive]}>⚡ Sin gestor</Text>
                  </TouchableOpacity>
                  {managers.map((mgr) => {
                    const on = managerFilterIds.includes(mgr.id);
                    return (
                      <TouchableOpacity
                        key={mgr.id}
                        style={[s.filterChip, on && s.filterChipActive]}
                        onPress={() => toggleManagerFilter(mgr.id)}
                      >
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: (mgr as any).color || COLORS.primary }} />
                        <Text style={[s.filterChipText, on && s.filterChipTextActive]} numberOfLines={1}>{mgr.name || mgr.email}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {showStatusFilter && (
              <View style={s.filterChipsRow}>
                <View style={s.filterChips}>
                  {PROJECT_STATUSES.filter((st) => !["facturado", "en_curso", "completado"].includes(st.key)).map((st) => {
                    const on = statusFilterIds.includes(st.key);
                    return (
                      <TouchableOpacity
                        key={st.key}
                        style={[s.filterChip, on && { backgroundColor: st.color + "18", borderColor: st.color }]}
                        onPress={() => toggleStatusFilter(st.key)}
                      >
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: st.color }} />
                        <Text style={[s.filterChipText, on && { color: st.color, fontWeight: "800" }]}>{st.label}</Text>
                        {on && <Ionicons name="checkmark" size={12} color={st.color} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {showSortMenu && (
              <View style={s.filterChipsRow}>
                <View style={s.filterChips}>
                  {[
                    { label: "Alta más reciente", field: "fecha", dir: "desc" },
                    { label: "Alta más antigua", field: "fecha", dir: "asc" },
                    { label: "Planificación próxima", field: "fecha_prevista_planificacion", dir: "asc" },
                    { label: "Planificación lejana", field: "fecha_prevista_planificacion", dir: "desc" },
                  ].map((opt) => {
                    const on = sortField === opt.field && sortDir === opt.dir;
                    return (
                      <TouchableOpacity
                        key={opt.label}
                        style={[s.filterChip, on && s.filterChipActive]}
                        onPress={() => { setSortField(opt.field as any); setSortDir(opt.dir as any); setShowSortMenu(false); }}
                      >
                        <Text style={[s.filterChipText, on && s.filterChipTextActive]}>{opt.label}</Text>
                        {on && <Ionicons name="checkmark" size={12} color={COLORS.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                  {sortField && (
                    <TouchableOpacity
                      style={s.filterChip}
                      onPress={() => { setSortField(null); setShowSortMenu(false); }}
                    >
                      <Text style={s.filterChipText}>Sin orden</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {loading ? (
              <View style={s.centerBox}>
                <ActivityIndicator color={COLORS.primary} size="large" />
              </View>
            ) : sortedItems.length === 0 ? (
              <View style={s.centerBox}>
                <Ionicons name="cube-outline" size={48} color={COLORS.textDisabled} />
                <Text style={{ color: COLORS.textSecondary, fontSize: 15, fontWeight: "500", marginTop: 8 }}>Sin resultados</Text>
                {overdueOnly && <TouchableOpacity onPress={() => setOverdueOnly(false)}><Text style={{ color: COLORS.primary, marginTop: 12, fontWeight: "700" }}>Ver todos</Text></TouchableOpacity>}
              </View>
            ) : viewMode === "kanban" ? (
              <ScrollView horizontal showsHorizontalScrollIndicator style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}>
                <View style={{ flex: 1, flexDirection: "row", padding: 16, gap: 16, alignItems: "stretch" }}>
                {kanbanColumns.map((col) => (
                  <View key={col.key} style={{ width: isWide ? 310 : 280, gap: 12 }}>
                    <View style={s.columnHeader}>
                      <View style={[s.columnDot, { backgroundColor: col.color }]} />
                      <Text style={s.columnTitle}>{col.label}</Text>
                      <View style={s.columnCount}>
                        <Text style={s.columnCountText}>{col.items.length}</Text>
                      </View>
                    </View>
                    {col.items.length === 0 ? (
                      <Text style={s.columnEmpty}>Sin proyectos</Text>
                    ) : (
                      col.items.map((item) => (
                        <View key={item.id}>
                          {renderItem({ item })}
                        </View>
                      ))
                    )}
                  </View>
                ))}
                </View>
                </ScrollView>
              </ScrollView>
            ) : groupedByStatus ? (
              <ScrollView
                testID="materiales-list"
                showsVerticalScrollIndicator={false}
                style={{ flex: 1 }}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => { setRefreshing(true); load(); }}
                    tintColor={COLORS.primary}
                  />
                }
                contentContainerStyle={{ flexGrow: 1 }}
              >
                <View style={s.columnsContainer}>
                  {groupedByStatus.map((col) => (
                    <View key={col.key} style={s.column}>
                      <View style={s.columnHeader}>
                        <View style={[s.columnDot, { backgroundColor: col.color }]} />
                        <Text style={s.columnTitle}>{col.label}</Text>
                        <View style={s.columnCount}>
                          <Text style={s.columnCountText}>{col.items.length}</Text>
                        </View>
                      </View>
                      {col.items.length === 0 ? (
                        <Text style={s.columnEmpty}>Sin proyectos</Text>
                      ) : (
                        col.items.map((item) => (
                          <View key={item.id}>
                            {renderItem({ item })}
                          </View>
                        ))
                      )}
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <ScrollView
                testID="materiales-list"
                contentContainerStyle={s.listContent}
                showsVerticalScrollIndicator={false}
                style={{ flex: 1 }}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => { setRefreshing(true); load(); }}
                    tintColor={COLORS.primary}
                  />
                }
              >
                {sortedItems.map((item) => (
                  <View key={item.id}>
                    {renderItem({ item })}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* Modal edición rápida */}
      <Modal visible={!!quickEdit} transparent animationType="slide" onRequestClose={() => setQuickEdit(null)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={{ backgroundColor: "#FFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: "90%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#0F172A", flex: 1 }} numberOfLines={1}>{quickEdit?.numero_pedido ? `${quickEdit.numero_pedido} · ` : ""}{quickEdit?.materiales || ""}</Text>
              <TouchableOpacity onPress={() => setQuickEdit(null)}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: "#64748B", marginBottom: 16 }}>{quickEdit?.cliente && quickEdit?.cliente !== quickEdit?.materiales ? quickEdit.cliente : ""}</Text>
            <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#475569", marginBottom: 6 }}>Estado</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {PROJECT_STATUSES.filter((st) => !["en_curso", "completado", "cancelado"].includes(st.key)).map((st) => (
                  <TouchableOpacity key={st.key} onPress={() => setQeStatus(st.key)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: qeStatus === st.key ? st.color : "#F1F5F9", borderWidth: 1, borderColor: qeStatus === st.key ? st.color : "#E2E8F0" }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: qeStatus === st.key ? "#fff" : "#475569" }}>{st.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ fontSize: 12, fontWeight: "600", color: "#475569", marginTop: 14, marginBottom: 6 }}>Fecha de planificación</Text>
              {Platform.OS === "web" ? (
                <input
                  type="date"
                  value={qePlan}
                  onChange={(e: any) => setQePlan(e.target.value)}
                  style={{ height: 42, backgroundColor: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: "#1E293B", width: "100%", boxSizing: "border-box" } as any}
                />
              ) : (
                <TextInput style={{ height: 42, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: "#1E293B" }} value={qePlan} onChangeText={setQePlan} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" />
              )}

              <Text style={{ fontSize: 12, fontWeight: "600", color: "#475569", marginTop: 14, marginBottom: 6 }}>Material pedido</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity onPress={() => setQePedido("si")} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: qePedido === "si" ? "#D1FAE5" : "#F1F5F9", borderWidth: 1, borderColor: qePedido === "si" ? "#059669" : "#E2E8F0" }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: qePedido === "si" ? "#059669" : "#475569" }}>Sí</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setQePedido("no")} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: qePedido === "no" ? "#FEE2E2" : "#F1F5F9", borderWidth: 1, borderColor: qePedido === "no" ? "#DC2626" : "#E2E8F0" }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: qePedido === "no" ? "#DC2626" : "#475569" }}>No</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setQePedido(null)} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: qePedido === null ? "#E2E8F0" : "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#475569" }}>—</Text>
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 12, fontWeight: "600", color: "#475569", marginTop: 14, marginBottom: 6 }}>Notas / detalles</Text>
              <TextInput style={{ height: 80, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 12, paddingTop: 10, fontSize: 14, color: "#1E293B", textAlignVertical: "top" }} value={qeNotas} onChangeText={setQeNotas} placeholder="Detalles, pendientes..." placeholderTextColor="#94A3B8" multiline />

              <TouchableOpacity
                style={{ height: 48, backgroundColor: COLORS.primary, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 16, opacity: qeSaving ? 0.6 : 1 }}
                onPress={saveQuickEdit}
                disabled={qeSaving}
              >
                {qeSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Guardar</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={{ height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 8, marginBottom: 20, borderWidth: 1, borderColor: "#CBD5E1" }}
                onPress={() => { const id = quickEdit?.id; setQuickEdit(null); if (id) router.push(`/material/${id}`); }}
              >
                <Text style={{ color: "#475569", fontSize: 13, fontWeight: "600" }}>Ver ficha completa</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal nuevo proyecto */}
      <Modal visible={showNewProject} transparent animationType="slide" onRequestClose={() => setShowNewProject(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={{ backgroundColor: "#FFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: "90%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: "#0F172A" }}>Nuevo proyecto</Text>
              <TouchableOpacity onPress={() => setShowNewProject(false)}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#475569", marginTop: 10, marginBottom: 4 }}>Código / Nombre del proyecto *</Text>
              <TextInput style={{ height: 42, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: "#1E293B" }} value={newMat} onChangeText={setNewMat} placeholder="Ej: 2026-001 Hotel Sevilla" placeholderTextColor="#94A3B8" />
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#475569", marginTop: 10, marginBottom: 4 }}>Cliente</Text>
              <TextInput style={{ height: 42, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: "#1E293B" }} value={newCli} onChangeText={setNewCli} placeholder="Nombre del cliente" placeholderTextColor="#94A3B8" />
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#475569", marginTop: 10, marginBottom: 4 }}>Ubicación</Text>
              <TextInput style={{ height: 42, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: "#1E293B" }} value={newUbi} onChangeText={setNewUbi} placeholder="Dirección de la obra" placeholderTextColor="#94A3B8" />
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#475569", marginTop: 10, marginBottom: 4 }}>Horas previstas</Text>
              <TextInput style={{ height: 42, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: "#1E293B" }} value={newHoras} onChangeText={setNewHoras} placeholder="Ej: 40" placeholderTextColor="#94A3B8" keyboardType="numeric" />
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#475569", marginTop: 10, marginBottom: 4 }}>Técnico asignado</Text>
              <TextInput style={{ height: 42, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: "#1E293B" }} value={newTecnico} onChangeText={setNewTecnico} placeholder="Nombre del técnico" placeholderTextColor="#94A3B8" />
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#475569", marginTop: 10, marginBottom: 4 }}>Gestor</Text>
              <TextInput style={{ height: 42, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: "#1E293B" }} value={newGestor} onChangeText={setNewGestor} placeholder="Nombre del gestor" placeholderTextColor="#94A3B8" />
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#475569", marginTop: 10, marginBottom: 4 }}>Fecha</Text>
              <TextInput style={{ height: 42, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: "#1E293B" }} value={newFecha} onChangeText={setNewFecha} placeholder="YYYY-MM-DD o DD/MM/AAAA" placeholderTextColor="#94A3B8" />
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#475569", marginTop: 10, marginBottom: 4 }}>Estado</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {["pendiente","planificado","a_facturar","facturado","terminado","bloqueado"].map(st => (
                  <TouchableOpacity key={st} onPress={() => setNewStatus(st)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: newStatus === st ? COLORS.primary : "#F1F5F9", borderWidth: 1, borderColor: newStatus === st ? COLORS.primary : "#E2E8F0" }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: newStatus === st ? "#fff" : "#475569" }}>{st}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#475569", marginTop: 10, marginBottom: 4 }}>Comentarios</Text>
              <TextInput style={{ height: 70, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: "#1E293B", textAlignVertical: "top" }} value={newComent} onChangeText={setNewComent} placeholder="Observaciones..." placeholderTextColor="#94A3B8" multiline />
              <TouchableOpacity
                style={{ height: 48, backgroundColor: COLORS.primary, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 16, marginBottom: 20, opacity: newSaving ? 0.6 : 1 }}
                onPress={async () => {
                  if (!newMat.trim()) { Alert.alert("Error", "El nombre del proyecto es obligatorio"); return; }
                  setNewSaving(true);
                  try {
                    await api.createMaterial({ materiales: newMat, cliente: newCli, ubicacion: newUbi, horas_prev: newHoras, gestor: newGestor, fecha: newFecha, project_status: newStatus, tecnico: newTecnico, comentarios: newComent });
                    setShowNewProject(false);
                    setNewMat(""); setNewCli(""); setNewUbi(""); setNewHoras(""); setNewGestor(""); setNewFecha(""); setNewStatus("pendiente"); setNewTecnico(""); setNewComent("");
                    load();
                    Alert.alert("Éxito", "Proyecto creado correctamente");
                  } catch (e: any) { Alert.alert("Error", e.message); }
                  finally { setNewSaving(false); }
                }}
                disabled={newSaving}
              >
                {newSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Crear proyecto</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ResponsiveLayout>
  );
}

const useS = () =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: COLORS.bg,
    },
    container: {
      flex: 1,
      flexDirection: "row",
    },
    leftPanel: {
      flex: 0.2,
      maxWidth: 280,
      backgroundColor: COLORS.surface,
      borderRightWidth: 1,
      borderRightColor: COLORS.border,
    },
    leftPanelContent: {
      padding: 16,
      gap: 14,
      paddingBottom: 40,
    },
    teamSelector: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: COLORS.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 10,
    },
    teamSelectorLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    teamSelectorText: {
      color: COLORS.text,
      fontSize: 13,
      fontWeight: "600",
      flex: 1,
    },
    totalKpiCard: {
      backgroundColor: COLORS.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 16,
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 5,
    },
    totalKpiHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 8,
    },
    totalKpiLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: COLORS.primary,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    totalKpiNumber: {
      fontSize: 32,
      fontWeight: "800",
      color: COLORS.text,
      marginBottom: 12,
    },
    totalKpiPills: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    statusPill: {
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: "700",
    },
    managerSection: {
      gap: 2,
    },
    managerSectionTitle: {
      fontSize: 10,
      fontWeight: "700",
      color: COLORS.textSecondary,
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 6,
    },
    managerRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 12,
      gap: 10,
    },
    managerRowActive: {
      backgroundColor: COLORS.surface,
    },
    managerDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    managerName: {
      flex: 1,
      fontSize: 13,
      fontWeight: "600",
      color: COLORS.textSecondary,
    },
    managerTotal: {
      fontSize: 12,
      fontWeight: "700",
      color: COLORS.textSecondary,
    },
    newProjectBtn: {
      backgroundColor: COLORS.primary,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 4,
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 8,
    },
    newProjectBtnText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "700",
    },
    mainContent: {
      flex: 0.8,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 12,
    },
    headerLeft: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: "800",
      color: COLORS.text,
    },
    headerSubtitle: {
      fontSize: 13,
      color: COLORS.textSecondary,
      fontWeight: "500",
      marginTop: 2,
    },
    headerRight: {
      flexDirection: "row",
      gap: 8,
    },
    headerIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: "center",
      justifyContent: "center",
    },
    mobileStats: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 12,
    },
    totalKpiCardMobile: {
      backgroundColor: COLORS.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 14,
    },
    newProjectBtnMobile: {
      backgroundColor: COLORS.primary,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: "center",
      marginTop: 4,
    },
    kpiStrip: {
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 24,
      paddingTop: 4,
      paddingBottom: 12,
    },
    kpiCard: {
      flex: 1,
      backgroundColor: COLORS.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 14,
      gap: 6,
      alignItems: "flex-start",
    },
    kpiCardActive: {
      borderColor: COLORS.pendingText,
      backgroundColor: COLORS.pendingBg,
    },
    kpiIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    kpiNumber: {
      fontSize: 22,
      fontWeight: "800",
      color: COLORS.text,
    },
    kpiLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: COLORS.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    searchRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 24,
      paddingVertical: 8,
      alignItems: "center",
    },
    viewSelector: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 24,
      paddingBottom: 8,
    },
    viewBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    viewBtnActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    viewBtnText: {
      fontSize: 12,
      fontWeight: "600",
      color: COLORS.textSecondary,
    },
    viewBtnTextActive: {
      color: "#fff",
      fontWeight: "700",
    },
    focusRow: {
      flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8,
      paddingHorizontal: 24, paddingBottom: 8,
    },
    focusChip: {
      flexDirection: "row", alignItems: "center", gap: 5,
      backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1,
      borderRadius: 12, paddingHorizontal: 12, minHeight: 36,
    },
    focusChipActive: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primary },
    focusCount: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
    focusLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "600" },
    focusTextActive: { color: COLORS.primary },
    focusHint: { color: COLORS.textSecondary, fontSize: 11 },
    calHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    calNavBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: "center",
      justifyContent: "center",
    },
    calTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: "800",
      color: COLORS.text,
      textTransform: "capitalize",
    },
    calWeekdays: {
      flexDirection: "row",
    },
    calWeekday: {
      width: "14.285%",
      textAlign: "center",
      fontSize: 11,
      fontWeight: "700",
      color: COLORS.textSecondary,
      paddingVertical: 6,
    },
    calGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    calCell: {
      width: "14.285%",
      minHeight: 76,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      padding: 3,
      gap: 2,
    },
    calCellToday: {
      backgroundColor: COLORS.primarySoft,
      borderRadius: 6,
    },
    calDayNum: {
      fontSize: 11,
      fontWeight: "600",
      color: COLORS.textSecondary,
      marginBottom: 2,
    },
    calChip: {
      borderRadius: 4,
      paddingHorizontal: 3,
      paddingVertical: 1,
    },
    calChipText: {
      fontSize: 9,
      fontWeight: "700",
    },
    searchBox: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: COLORS.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 14,
      height: 40,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: COLORS.text,
      outlineStyle: "none" as any,
    },
    actionChip: {
      height: 36,
      width: 36,
      borderRadius: 10,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: "center",
      justifyContent: "center",
    },
    actionChipActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    filterChipsRow: {
      paddingHorizontal: 24,
      paddingBottom: 8,
    },
    filterChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    filterChipActive: {
      backgroundColor: COLORS.pillBlueBg,
      borderColor: COLORS.primary,
    },
    filterChipText: {
      fontSize: 12,
      fontWeight: "600",
      color: COLORS.textSecondary,
    },
    filterChipTextActive: {
      color: COLORS.text,
      fontWeight: "800",
    },
    centerBox: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    listContent: {
      padding: 16,
      gap: 12,
      paddingBottom: 60,
      maxWidth: 900,
      alignSelf: "center",
      width: "100%",
    },
    columnsContainer: {
      flexDirection: "row",
      padding: 16,
      gap: 16,
      alignItems: "stretch",
    },
    column: {
      flex: 1,
      minWidth: 0,
      gap: 12,
    },
    columnHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 4,
    },
    columnDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    columnTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: COLORS.text,
      flex: 1,
    },
    columnCount: {
      backgroundColor: COLORS.surface,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    columnCountText: {
      fontSize: 12,
      fontWeight: "700",
      color: COLORS.textSecondary,
    },
    columnEmpty: {
      color: COLORS.textDisabled,
      fontSize: 12,
      paddingVertical: 20,
      textAlign: "center",
    },
    card: {
      flexDirection: "row",
      backgroundColor: COLORS.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      overflow: "hidden",
    },
    cardBar: {
      width: 4,
    },
    cardBody: {
      flex: 1,
      flexDirection: "row",
      padding: 14,
      alignItems: "center",
      gap: 12,
    },
    cardAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: COLORS.pillBlueBg,
      alignItems: "center",
      justifyContent: "center",
    },
    cardAvatarText: {
      fontSize: 12,
      fontWeight: "700",
      color: COLORS.primary,
    },
    cardInfo: {
      flex: 1,
      gap: 4,
    },
    cardTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    cardCode: {
      fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
      fontSize: 13,
      fontWeight: "700",
      color: COLORS.text,
      letterSpacing: 0.3,
    },
    cardClient: {
      fontSize: 13,
      fontWeight: "600",
      color: COLORS.textSecondary,
      flexShrink: 1,
    },
    cardNumero: {
      fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
      fontSize: 12,
      fontWeight: "700",
      color: COLORS.primary,
      letterSpacing: 0.2,
      flexShrink: 0,
    },
    cardAddressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    cardAddress: {
      fontSize: 11,
      color: COLORS.textSecondary,
      fontWeight: "500",
    },
    cardMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
    },
    cardMetaTag: {
      backgroundColor: COLORS.surface,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    cardMetaText: {
      fontSize: 10,
      color: COLORS.textSecondary,
      fontWeight: "600",
    },
    cardRight: {
      alignItems: "flex-end",
      gap: 6,
    },
    cardBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 7,
    },
    cardBadgeText: {
      fontSize: 9,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    cardMoreBtn: {
      width: 24,
      height: 24,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
    },
  });
