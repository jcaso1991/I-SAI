import React, { createContext, useContext, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ConfirmOptions {
  title: string;
  message?: string;
  onConfirm: () => void;
  confirmLabel?: string;
  destructive?: boolean;
}

type ToastContextType = {
  showToast: (message: string, type?: ToastType) => void;
  showConfirm: (opts: ConfirmOptions) => void;
};

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  showConfirm: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const showConfirm = useCallback((opts: ConfirmOptions) => {
    setConfirm(opts);
  }, []);

  const colors: Record<ToastType, string> = {
    success: "#10B981",
    error: "#EF4444",
    warning: "#F59E0B",
    info: "#3B82F6",
  };
  const icons: Record<ToastType, string> = {
    success: "checkmark-circle",
    error: "alert-circle",
    warning: "warning",
    info: "information-circle",
  };

  return (
    <ToastContext.Provider value={{ showToast, showConfirm }}>
      {children}

      {/* Toast notifications */}
      <View style={styles.toastContainer} pointerEvents="box-none">
        {toasts.map((t) => (
          <View key={t.id} style={[styles.toast, { borderLeftColor: colors[t.type] }]}>
            <Ionicons name={icons[t.type] as any} size={18} color={colors[t.type]} />
            <Text style={styles.toastText}>{t.message}</Text>
          </View>
        ))}
      </View>

      {/* Confirm dialog modal */}
      {confirm && (
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{confirm.title}</Text>
            {confirm.message ? <Text style={styles.dialogMsg}>{confirm.message}</Text> : null}
            <View style={styles.dialogRow}>
              <TouchableOpacity
                style={[styles.dialogBtn, styles.dialogCancel]}
                onPress={() => setConfirm(null)}
              >
                <Text style={styles.dialogCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogBtn, confirm.destructive ? styles.dialogDestructive : styles.dialogConfirm]}
                onPress={() => { confirm.onConfirm(); setConfirm(null); }}
              >
                <Text style={styles.dialogConfirmText}>{confirm.confirmLabel || (confirm.destructive ? "Eliminar" : "Aceptar")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: "absolute", top: 60, left: 20, right: 20, zIndex: 9999,
    gap: 8, alignItems: "center",
  },
  toast: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#FFF", borderRadius: 12, padding: 14,
    borderLeftWidth: 4,
    ...Platform.select({
      web: { boxShadow: "0 4px 20px rgba(0,0,0,0.1)", minWidth: 300 } as any,
      default: { shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
    }),
  },
  toastText: { fontSize: 14, fontWeight: "600", color: "#0F172A", flex: 1 },
  overlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9998,
    alignItems: "center", justifyContent: "center", padding: 20,
  },
  dialog: {
    backgroundColor: "#FFF", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400,
    ...Platform.select({ web: { boxShadow: "0 8px 32px rgba(0,0,0,0.2)" } as any }),
  },
  dialogTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  dialogMsg: { fontSize: 14, color: "#64748B", marginTop: 8, lineHeight: 20 },
  dialogRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  dialogBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  dialogCancel: { backgroundColor: "#F1F5F9" },
  dialogCancelText: { fontSize: 14, fontWeight: "600", color: "#475569" },
  dialogConfirm: { backgroundColor: "#3B82F6" },
  dialogDestructive: { backgroundColor: "#EF4444" },
  dialogConfirmText: { fontSize: 14, fontWeight: "700", color: "#FFF" },
});
