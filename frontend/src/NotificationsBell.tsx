/**
 * NotificationsBell — reusable notifications bell icon with dropdown/sheet.
 *
 * Used from multiple screens (Inicio header, Calendario header, ...) so the
 * unread badge and the full list of notifications are visible app-wide.
 *
 * Features:
 * - Badge with unread count.
 * - Tap a notification → navigates to /calendario?openEvent=<id> and
 *   triggers the Calendar screen to auto-open that event's details modal.
 * - Per-item delete button (X icon).
 * - Selection mode: long-press or tap "Seleccionar" → checkbox per row,
 *   then "Eliminar (N)" deletes them in bulk.
 * - Header action: "Eliminar todas" — bulk-wipes the entire list with a
 *   cross-platform confirmation prompt.
 * - Mark all as read.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Platform, Alert,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS } from "./api";
import { useBreakpoint } from "./useBreakpoint";
import { useThemedStyles } from "./theme";

type Notif = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  event_id?: string;
  from_user_name?: string;
  type?: string;
  link?: string;
};

/** Cross-platform confirmation. On web uses window.confirm (works reliably
 *  in RN-Web, Alert.alert buttons do NOT render on web). */
function confirmAsync(title: string, message: string, okText = "Eliminar"): Promise<boolean> {
  if (Platform.OS === "web") {
    // @ts-ignore window exists on web
    return Promise.resolve(typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
      { text: okText, style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

export default function NotificationsBell({
  size = 22,
  color,
  style,
}: {
  size?: number;
  color?: string;
  style?: any;
}) {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const { width: winW } = useWindowDimensions();
  // Re-check isWide against live window width (the hook's state can lag on
  // fast resizes in web previews). This keeps the dropdown correctly sized
  // whether the user is on desktop, tablet or phone.
  const wide = isWide && winW >= 768;
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const pollRef = useRef<any>(null);
  // Inline confirmation banner (more reliable than Alert/confirm over an open Modal,
  // which on iOS can be dismissed by the parent Modal and on web sometimes blocks).
  const [confirmKind, setConfirmKind] = useState<null | "all" | "selected">(null);

  const load = useCallback(async () => {
    try {
      const res = await api.listNotifications();
      setItems(res.items || []);
      setUnread(res.unread || 0);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 60000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  // Exit selection mode when the sheet closes.
  useEffect(() => {
    if (!open) { setSelectMode(false); setSelected(new Set()); }
  }, [open]);

  const openNotif = async (n: Notif) => {
    if (selectMode) {
      // In selection mode, taps toggle checkboxes instead of navigating.
      toggleSelected(n.id);
      return;
    }
    if (!n.read) {
      try { await api.markNotificationRead(n.id); } catch {}
      load();
    }
    setOpen(false);
    if (n.link && n.type === "chat_message") {
      setTimeout(() => {
        router.push(n.link as any);
      }, 80);
      return;
    }
    if (n.event_id) {
      // Navigate to calendar with the target event id so the calendar screen
      // can auto-open its EventDetailsModal. Using a URL string keeps the
      // param in the URL reliably (expo-router on web sometimes drops
      // params from object syntax). A small delay avoids racing the modal
      // close animation.
      const targetId = n.event_id;
      setTimeout(() => {
        router.push(`/calendario?openEvent=${encodeURIComponent(targetId)}` as any);
      }, 80);
    }
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const deleteOne = async (n: Notif) => {
    try { await api.deleteNotification(n.id); } catch {}
    load();
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    setConfirmKind("selected");
  };

  const performDeleteSelected = async () => {
    const ids = Array.from(selected);
    setConfirmKind(null);
    await Promise.all(ids.map((id) => api.deleteNotification(id).catch(() => {})));
    setSelected(new Set());
    setSelectMode(false);
    load();
  };

  const deleteAll = async () => {
    if (items.length === 0) return;
    setConfirmKind("all");
  };

  const performDeleteAll = async () => {
    setConfirmKind(null);
    try {
      await api.deleteAllNotifications();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "No se pudieron eliminar las notificaciones");
      return;
    }
    setSelected(new Set());
    setSelectMode(false);
    load();
  };

  const iconColor = color || COLORS.navy;
  const s = useThemedStyles(useS);

  return (
    <>
      <TouchableOpacity
        testID="btn-notifications"
        style={[s.iconBtn, style]}
        onPress={() => { load(); setOpen(true); }}
      >
        <Ionicons name="notifications-outline" size={size} color={iconColor} />
        {unread > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{unread > 9 ? "9+" : unread}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        {/* Backdrop — tapping outside the panel closes it. */}
        <View style={s.sheetRoot}>
          <TouchableOpacity
            testID="notif-backdrop"
            activeOpacity={1}
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          />
          {/* Top-anchored panel (dropdown style). It grows with content up to
              a max height; when content exceeds that, the inner ScrollView
              shows a vertical scrollbar on the right. */}
          <View style={[s.sheet, wide ? s.sheetWide : s.sheetNarrow]}>
            {/* Header */}
            <View style={s.hdr}>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>
                  {selectMode ? `${selected.size} seleccionada${selected.size !== 1 ? "s" : ""}` : "Notificaciones"}
                </Text>
                <Text style={s.sub}>
                  {selectMode ? "Toca para seleccionar" : `${unread} sin leer · ${items.length} total`}
                </Text>
              </View>
              <TouchableOpacity
                testID="btn-close-notif"
                onPress={() => setOpen(false)}
                hitSlop={14}
                style={s.closeBtn}
              >
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Inline confirmation banner */}
            {confirmKind && (
              <View style={s.confirmBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={s.confirmTitle}>
                    {confirmKind === "all"
                      ? `¿Eliminar las ${items.length} notificaciones?`
                      : `¿Eliminar ${selected.size} notificación${selected.size !== 1 ? "es" : ""}?`}
                  </Text>
                  <Text style={s.confirmSub}>Esta acción no se puede deshacer.</Text>
                </View>
                <TouchableOpacity
                  testID="btn-confirm-cancel"
                  style={[s.confirmBtn, s.confirmBtnGhost]}
                  onPress={() => setConfirmKind(null)}
                >
                  <Text style={s.confirmBtnGhostTxt}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="btn-confirm-delete"
                  style={[s.confirmBtn, s.confirmBtnDanger]}
                  onPress={() => confirmKind === "all" ? performDeleteAll() : performDeleteSelected()}
                >
                  <Ionicons name="trash" size={14} color="#fff" />
                  <Text style={s.confirmBtnDangerTxt}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Action row */}
            {items.length > 0 && (
              <View style={s.actionRow}>
                {selectMode ? (
                  <>
                    <TouchableOpacity
                      testID="btn-cancel-select"
                      style={[s.actionBtn, s.actionBtnGhost]}
                      onPress={() => { setSelectMode(false); setSelected(new Set()); }}
                    >
                      <Ionicons name="close" size={16} color={COLORS.textSecondary} />
                      <Text style={s.actionBtnGhostText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID="btn-select-all"
                      style={[s.actionBtn, s.actionBtnGhost]}
                      onPress={() => {
                        if (selected.size === items.length) setSelected(new Set());
                        else setSelected(new Set(items.map((i) => i.id)));
                      }}
                    >
                      <Ionicons
                        name={selected.size === items.length ? "square-outline" : "checkbox-outline"}
                        size={16} color={COLORS.primary}
                      />
                      <Text style={[s.actionBtnGhostText, { color: COLORS.primary }]}>
                        {selected.size === items.length ? "Ninguna" : "Todas"}
                      </Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity
                      testID="btn-delete-selected"
                      disabled={selected.size === 0}
                      style={[s.actionBtn, s.actionBtnDanger, selected.size === 0 && { opacity: 0.4 }]}
                      onPress={deleteSelected}
                    >
                      <Ionicons name="trash-outline" size={16} color="#fff" />
                      <Text style={s.actionBtnDangerText}>
                        Eliminar{selected.size > 0 ? ` (${selected.size})` : ""}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      testID="btn-select-mode"
                      style={[s.actionBtn, s.actionBtnGhost]}
                      onPress={() => setSelectMode(true)}
                    >
                      <Ionicons name="checkbox-outline" size={16} color={COLORS.primary} />
                      <Text style={[s.actionBtnGhostText, { color: COLORS.primary }]}>Seleccionar</Text>
                    </TouchableOpacity>
                    {unread > 0 && (
                      <TouchableOpacity
                        testID="btn-mark-all-read"
                        style={[s.actionBtn, s.actionBtnGhost]}
                        onPress={async () => {
                          try { await api.markAllNotificationsRead(); } catch {}
                          load();
                        }}
                      >
                        <Ionicons name="checkmark-done" size={16} color={COLORS.primary} />
                        <Text style={[s.actionBtnGhostText, { color: COLORS.primary }]}>
                          Marcar leídas
                        </Text>
                      </TouchableOpacity>
                    )}
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity
                      testID="btn-delete-all"
                      style={[s.actionBtn, s.actionBtnDangerSoft]}
                      onPress={deleteAll}
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      <Text style={s.actionBtnDangerSoftText}>Eliminar todas</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {/* List */}
            {items.length === 0 ? (
              <View style={{ padding: 40, alignItems: "center" }}>
                <Ionicons name="notifications-off-outline" size={44} color={COLORS.textDisabled} />
                <Text style={{ color: COLORS.textSecondary, marginTop: 10, fontWeight: "700" }}>
                  Sin notificaciones
                </Text>
              </View>
            ) : (
              <ScrollView
                style={{ flexGrow: 0, flexShrink: 1 }}
                contentContainerStyle={{ padding: 12, gap: 8 }}
                showsVerticalScrollIndicator
              >
                {items.map((n) => {
                  const isCompleted = n.type === "event_completed";
                  const isPending = n.type === "event_pending_completion";
                  const accent = isPending ? "#F59E0B" : isCompleted ? "#10B981" : COLORS.primary;
                  const isSel = selected.has(n.id);
                  return (
                    <TouchableOpacity
                      key={n.id}
                      testID={`notif-${n.id}`}
                      activeOpacity={0.7}
                      onLongPress={() => {
                        // Long-press → enter selection mode and pre-select this item.
                        if (!selectMode) setSelectMode(true);
                        toggleSelected(n.id);
                      }}
                      style={[
                        s.item,
                        !n.read && { borderLeftColor: accent, borderLeftWidth: 4, backgroundColor: COLORS.primarySoft },
                        isSel && { borderColor: COLORS.primary, backgroundColor: COLORS.highlightBg },
                      ]}
                      onPress={() => openNotif(n)}
                    >
                      {selectMode ? (
                        <View style={[s.check, isSel && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}>
                          {isSel && <Ionicons name="checkmark" size={14} color="#fff" />}
                        </View>
                      ) : (
                        <View style={[s.dot, { backgroundColor: accent }]} />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemTitle}>{n.title}</Text>
                        <Text style={s.itemMsg} numberOfLines={3}>{n.message}</Text>
                        <Text style={s.itemDate}>
                          {new Date(n.created_at).toLocaleString("es-ES", {
                            day: "2-digit", month: "short",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </Text>
                      </View>
                      {!selectMode && (
                        <TouchableOpacity
                          testID={`notif-del-${n.id}`}
                          hitSlop={10}
                          onPress={async (e: any) => {
                            e?.stopPropagation?.();
                            await deleteOne(n);
                          }}
                          style={s.delBtn}
                        >
                          <Ionicons name="close-circle" size={20} color={COLORS.textDisabled} />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const useS = () =>
  StyleSheet.create({
  iconBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: COLORS.border,
    position: "relative",
    ...Platform.select<any>({
      web: { boxShadow: "0 1px 4px rgba(15,23,42,0.08)" },
      default: { shadowColor: "#0F172A", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
    }),
  },
  badge: {
    position: "absolute", top: 2, right: 2,
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: "#EF4444",
    borderWidth: 2, borderColor: COLORS.surface,
    alignItems: "center", justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },

  // Top-anchored dropdown panel (opens from the top-right, near the bell).
  // Grows with content; inner ScrollView shows a scrollbar when there are
  // many notifications.
  sheetRoot: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    position: "absolute",
    top: Platform.OS === "web" ? 70 : 60,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border,
    // Grow with content up to ~80% of the viewport; inner list scrolls.
    maxHeight: Platform.OS === "web" ? ("80vh" as any) : ("82%" as any),
    overflow: "hidden",
    ...Platform.select<any>({
      web: { boxShadow: "0 16px 48px rgba(15,23,42,0.22)" },
      default: { shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
    }),
  },
  // Desktop / tablet: fixed width anchored to top-right.
  sheetWide: {
    right: 20,
    width: 420,
  },
  // Phones: stretch across the screen with small side margins.
  sheetNarrow: {
    left: 12,
    right: 12,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.bg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  hdr: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title: { fontSize: 18, fontWeight: "900", color: COLORS.text, letterSpacing: -0.3 },
  sub: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "700", marginTop: 2 },

  // Action bar
  actionRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
    flexWrap: "wrap",
  },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
  },
  actionBtnGhost: {
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
  },
  actionBtnGhostText: { fontSize: 12, fontWeight: "800", color: COLORS.textSecondary },
  actionBtnDangerSoft: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1, borderColor: "#FEE2E2",
  },
  actionBtnDangerSoftText: { fontSize: 12, fontWeight: "800", color: "#EF4444" },
  actionBtnDanger: { backgroundColor: "#EF4444" },
  actionBtnDangerText: { fontSize: 12, fontWeight: "800", color: "#fff" },

  // Item
  item: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    padding: 12, backgroundColor: COLORS.bg, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  check: {
    width: 20, height: 20, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.surface,
    marginTop: 2,
  },
  itemTitle: { fontSize: 13.5, fontWeight: "800", color: COLORS.text },
  itemMsg: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, lineHeight: 17 },
  itemDate: { fontSize: 10.5, color: COLORS.textDisabled, marginTop: 4, fontWeight: "700" },
  delBtn: { padding: 2 },

  // Inline confirmation banner shown above the action row
  confirmBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: "#FEF2F2",
    borderBottomWidth: 1, borderBottomColor: "#FECACA",
  },
  confirmTitle: { fontSize: 13, fontWeight: "900", color: "#991B1B" },
  confirmSub: { fontSize: 11, color: "#B91C1C", marginTop: 1, fontWeight: "600" },
  confirmBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  confirmBtnGhost: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#FECACA" },
  confirmBtnGhostTxt: { fontSize: 12, fontWeight: "800", color: "#991B1B" },
  confirmBtnDanger: { backgroundColor: "#EF4444" },
  confirmBtnDangerTxt: { fontSize: 12, fontWeight: "800", color: "#fff" },
});
