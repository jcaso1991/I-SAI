/**
 * NotificationsBell — reusable notifications bell icon with dropdown/sheet.
 *
 * Used from multiple screens (Inicio header, Calendario header, ...) so the
 * unread badge and the full list of notifications are visible app-wide.
 *
 * When the user taps an event-type notification we navigate to the calendar
 * with an `openEvent` search-param so the calendar can auto-open that event
 * modal when it loads.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS } from "./api";

type Notif = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  event_id?: string;
  from_user_name?: string;
  type?: string;
};

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
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const pollRef = useRef<any>(null);

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

  const openNotif = async (n: Notif) => {
    if (!n.read) {
      try { await api.markNotificationRead(n.id); } catch {}
      load();
    }
    setOpen(false);
    if (n.event_id) {
      // Navigate to calendar with the target event id so the calendar screen
      // can auto-open its EventDetailsModal. Small delay avoids racing the
      // modal close animation.
      setTimeout(() => {
        router.push({ pathname: "/calendario", params: { openEvent: n.event_id } } as any);
      }, 60);
    }
  };

  const iconColor = color || COLORS.navy;

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
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={s.sheetRoot}>
          <View style={s.sheet}>
            <View style={s.hdr}>
              <View>
                <Text style={s.title}>Notificaciones</Text>
                <Text style={s.sub}>{unread} sin leer</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {unread > 0 && (
                  <TouchableOpacity
                    testID="btn-mark-all-read"
                    style={s.hdrBtn}
                    onPress={async () => {
                      try { await api.markAllNotificationsRead(); } catch {}
                      load();
                    }}
                  >
                    <Text style={{ color: COLORS.primary, fontWeight: "800", fontSize: 12 }}>
                      Marcar todas
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setOpen(false)}>
                  <Ionicons name="close" size={26} color={COLORS.text} />
                </TouchableOpacity>
              </View>
            </View>

            {items.length === 0 ? (
              <View style={{ padding: 34, alignItems: "center" }}>
                <Ionicons name="notifications-off-outline" size={40} color={COLORS.textDisabled} />
                <Text style={{ color: COLORS.textSecondary, marginTop: 8, fontWeight: "700" }}>
                  Sin notificaciones
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ padding: 12, gap: 8 }}>
                {items.map((n) => {
                  const isCompleted = n.type === "event_completed";
                  const isPending = n.type === "event_pending_completion";
                  const accent = isPending ? "#F59E0B" : isCompleted ? "#10B981" : COLORS.primary;
                  return (
                    <TouchableOpacity
                      key={n.id}
                      testID={`notif-${n.id}`}
                      style={[
                        s.item,
                        !n.read && { borderLeftColor: accent, borderLeftWidth: 4, backgroundColor: COLORS.primarySoft },
                      ]}
                      onPress={() => openNotif(n)}
                    >
                      <View style={[s.dot, { backgroundColor: accent }]} />
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
                      <TouchableOpacity
                        hitSlop={10}
                        onPress={async (e: any) => {
                          e?.stopPropagation?.();
                          try { await api.deleteNotification(n.id); } catch {}
                          load();
                        }}
                      >
                        <Ionicons name="close-circle-outline" size={18} color={COLORS.textDisabled} />
                      </TouchableOpacity>
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

const s = StyleSheet.create({
  iconBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: COLORS.border,
    position: "relative",
  },
  badge: {
    position: "absolute", top: 4, right: 4,
    minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4,
    backgroundColor: "#EF4444",
    borderWidth: 1.5, borderColor: COLORS.surface,
    alignItems: "center", justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "900" },

  // Sheet
  sheetRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: "82%",
    ...Platform.select<any>({
      web: { boxShadow: "0 -8px 32px rgba(15,23,42,0.18)" },
      default: { shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: -8 } },
    }),
  },
  hdr: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title: { fontSize: 18, fontWeight: "900", color: COLORS.text, letterSpacing: -0.3 },
  sub: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "700", marginTop: 2 },
  hdrBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: COLORS.primarySoft },

  // Item
  item: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    padding: 12, backgroundColor: COLORS.bg, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  itemTitle: { fontSize: 13.5, fontWeight: "800", color: COLORS.text },
  itemMsg: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, lineHeight: 17 },
  itemDate: { fontSize: 10.5, color: COLORS.textDisabled, marginTop: 4, fontWeight: "700" },
});
