import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
export const BACKEND_URL = BASE || "";
const TOKEN_KEY = "materiales_token";

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}
export async function setToken(t: string) {
  await AsyncStorage.setItem(TOKEN_KEY, t);
}
export async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

async function request(path: string, opts: RequestInit = {}, auth = true) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (auth) {
    const t = await getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  const txt = await res.text();
  let data: any = null;
  try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || `HTTP ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
}

export const api = {
  login: (email: string, password: string) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, false),
  register: (email: string, password: string, name?: string) =>
    request("/auth/register", { method: "POST", body: JSON.stringify({ email, password, name }) }, false),
  me: () => request("/auth/me"),
  listMateriales: (q?: string, pendingOnly?: boolean, managerId?: string, unassigned?: boolean, projectStatus?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (pendingOnly) p.set("pending_only", "true");
    if (managerId) p.set("manager_id", managerId);
    if (unassigned) p.set("unassigned", "true");
    if (projectStatus) p.set("project_status", projectStatus);
    const qs = p.toString();
    return request(`/materiales${qs ? "?" + qs : ""}`);
  },
  getMaterial: (id: string) => request(`/materiales/${id}`),
  updateMaterial: (id: string, body: any) =>
    request(`/materiales/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  stats: () => request("/stats"),
  onedriveStatus: () => request("/auth/onedrive/status"),
  onedriveLogin: () => request("/auth/onedrive/login"),
  onedriveDisconnect: () => request("/auth/onedrive/disconnect", { method: "POST" }),
  syncImport: () => request("/sync/import-from-onedrive", { method: "POST" }),
  syncPush: () => request("/sync/push-to-onedrive", { method: "POST" }),
  // Users mgmt
  listUsers: () => request("/users"),
  createUser: (body: { email: string; password: string; name?: string; role_id?: string; role?: string; color?: string }) =>
    request("/users", { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id: string, body: { name?: string; role_id?: string; role?: string; color?: string }) =>
    request(`/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  resetPassword: (id: string, password: string) =>
    request(`/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ password }) }),
  deleteUser: (id: string) => request(`/users/${id}`, { method: "DELETE" }),
  // Roles & Permissions
  listRoles: () => request("/roles"),
  createRole: (body: { name: string; permissions: string[]; notification_prefs?: string[] }) =>
    request("/roles", { method: "POST", body: JSON.stringify(body) }),
  updateRole: (id: string, body: { name?: string; permissions?: string[] }) =>
    request(`/roles/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteRole: (id: string) => request(`/roles/${id}`, { method: "DELETE" }),
  listPermissions: () => request("/permissions"),
  listNotificationPrefs: () => request("/notification-prefs"),
  listTechnicians: () => request("/technicians"),
  listManagers: () => request("/managers"),
  // Plans
  listPlans: () => request("/plans"),
  createPlan: (body: { title: string; data?: any; material_id?: string; source_event_id?: string; source_attachment_id?: string }) => request("/plans", { method: "POST", body: JSON.stringify(body) }),
  getPlan: (id: string) => request(`/plans/${id}`),
  updatePlan: (id: string, body: { title?: string; data?: any; source_attachment_id?: string }) =>
    request(`/plans/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deletePlan: (id: string) => request(`/plans/${id}`, { method: "DELETE" }),
  uploadBackground: (id: string, body: { file_base64: string; mime_type: string }) =>
    request(`/plans/${id}/background`, { method: "POST", body: JSON.stringify(body) }),
  removeBackground: (id: string) => request(`/plans/${id}/background`, { method: "DELETE" }),
  // Events (calendar)
  listEvents: (from?: string, to?: string) => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const qs = p.toString();
    return request(`/events${qs ? "?" + qs : ""}`);
  },
  createEvent: (body: {
    title: string; start_at: string; end_at: string;
    description?: string; material_id?: string;
  }) => request("/events", { method: "POST", body: JSON.stringify(body) }),
  getEvent: (id: string) => request(`/events/${encodeURIComponent(id)}`),
  updateEvent: (id: string, body: any) =>
    request(`/events/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteEvent: (id: string) => request(`/events/${id}`, { method: "DELETE" }),
  // Event attachments
  uploadEventAttachment: (eid: string, body: { filename: string; mime_type: string; base64: string }) =>
    request(`/events/${encodeURIComponent(eid)}/attachments`, { method: "POST", body: JSON.stringify(body) }),
  getEventAttachment: (eid: string, aid: string) =>
    request(`/events/${encodeURIComponent(eid)}/attachments/${aid}`),
  deleteEventAttachment: (eid: string, aid: string) =>
    request(`/events/${encodeURIComponent(eid)}/attachments/${aid}`, { method: "DELETE" }),

  // Notifications (in-app bell) — the backend creates these when a
  // technician marks an event as completed / pending-completion.
  listNotifications: (unreadOnly = false) =>
    request(`/notifications${unreadOnly ? "?unread_only=true" : ""}`),
  markNotificationRead: (id: string) =>
    request(`/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () =>
    request("/notifications/read-all", { method: "POST" }),
  deleteNotification: (id: string) =>
    request(`/notifications/${id}`, { method: "DELETE" }),
  deleteAllNotifications: (onlyRead = false) =>
    request(`/notifications${onlyRead ? "?only_read=true" : ""}`, { method: "DELETE" }),

  // CRM SAT — customer-facing public form + internal management
  satCreatePublic: (body: {
    cliente: string; direccion?: string; telefono?: string; observaciones: string;
  }) => {
    // Public endpoint: no auth header required. We still hit the /api prefix.
    return fetch(`${BASE}/api/sat/public`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      return res.json();
    });
  },
  satList: (status?: "pendiente" | "resuelta") =>
    request(`/sat/incidents${status ? `?status=${status}` : ""}`),
  satGet: (id: string) => request(`/sat/incidents/${id}`),
  satUpdate: (id: string, body: any) =>
    request(`/sat/incidents/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  satChangeStatus: (id: string, status: "pendiente" | "resuelta", comment: string, facturable?: boolean) =>
    request(`/sat/incidents/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status, comment, facturable }),
    }),
  satScheduleIncident: (id: string, scheduledFor: string, comment: string) =>
    request(`/sat/incidents/${id}/schedule`, {
      method: "POST",
      body: JSON.stringify({ scheduled_for: scheduledFor, comment }),
    }),
  satListByClient: (clientId: string) =>
    request(`/sat/incidents?client_id=${encodeURIComponent(clientId)}`),
  satAddNote: (id: string, comment: string) =>
    request(`/sat/incidents/${id}/note`, {
      method: "POST",
      body: JSON.stringify({ status: "pendiente", comment }),
    }),
  satDelete: (id: string) =>
    request(`/sat/incidents/${id}`, { method: "DELETE" }),

  // CRM SAT — clients catalog (with Excel import)
  satClientList: () => request("/sat/clients"),
  satExportExcel: async () => {
    const token = await getToken();
    const res = await fetch(`${BASE}/api/sat/export-excel`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `informe_incidencias_SAT.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  },
  satClientGet: (id: string) => request(`/sat/clients/${id}`),
  satClientCreate: (body: { cliente: string; direccion?: string; contacto?: string; telefono?: string }) =>
    request("/sat/clients", { method: "POST", body: JSON.stringify(body) }),
  satClientUpdate: (id: string, body: any) =>
    request(`/sat/clients/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  satClientDelete: (id: string) =>
    request(`/sat/clients/${id}`, { method: "DELETE" }),
  satClientImport: async (file: { uri: string; name: string; mimeType?: string } | File, replace = false) => {
    const form = new FormData();
    // Web File object vs native { uri, name }
    if (typeof File !== "undefined" && file instanceof File) {
      form.append("file", file);
    } else {
      // @ts-ignore — native form-data with uri
      form.append("file", { uri: (file as any).uri, name: (file as any).name, type: (file as any).mimeType || "application/vnd.ms-excel.sheet.macroenabled.12" } as any);
    }
    const token = await getToken();
    const res = await fetch(`${BASE}/api/sat/clients/import?replace=${replace ? "true" : "false"}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  },

  // Budgets (presupuestos)
  listBudgets: () => request("/budgets"),
  listAcceptedBudgets: () => request("/budgets/accepted"),
  getBudget: (id: string) => request(`/budgets/${id}`),
  createBudget: (body: any) => request("/budgets", { method: "POST", body: JSON.stringify(body) }),
  updateBudget: (id: string, body: any) => request(`/budgets/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  toggleBudgetStatus: (id: string) => request(`/budgets/${id}/status`, { method: "PATCH" }),
  deleteBudget: (id: string) => request(`/budgets/${id}`, { method: "DELETE" }),
  budgetsDefaultEquipos: () => request("/budgets-defaults/equipos"),
  // Get budget PDF URL (authenticated blob fetch)
  getBudgetPdfUrl: (id: string) => `${BASE}/api/budgets/${id}/pdf`,
  getBudgetPdfBlob: async (id: string): Promise<Blob> => {
    const t = await getToken();
    const res = await fetch(`${BASE}/api/budgets/${id}/pdf`, {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.blob();
  },
  getBudgetPdfPreviewBlob: async (body: any): Promise<Blob> => {
    const t = await getToken();
    const res = await fetch(`${BASE}/api/budgets/pdf-preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `HTTP ${res.status}`);
    }
    return await res.blob();
  },
  // Convert JPEG/PNG base64 to a single-page PDF (returns base64 of the PDF)
  imageToPdfBase64: async (base64: string, mime_type: string = "image/jpeg"): Promise<string> => {
    const t = await getToken();
    const res = await fetch(`${BASE}/api/utils/image-to-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
      body: JSON.stringify({ base64, mime_type }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || "").split(",").pop() || "");
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  },
  // Stamps
  listStamps: () => request("/stamps"),
  createStamp: (body: { name: string; image_base64: string }) =>
    request("/stamps", { method: "POST", body: JSON.stringify(body) }),
  deleteStamp: (id: string) => request(`/stamps/${id}`, { method: "DELETE" }),

  // Microsoft login (Entra ID)
  microsoftLoginUrl: () => request("/auth/microsoft/login"),
  microsoftExchange: (code: string, state: string) =>
    request("/auth/microsoft/exchange", { method: "POST", body: JSON.stringify({ code, state }) }, false),
};

export const COLORS = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  readonly: "#F1F5F9",
  text: "#0F172A",
  textSecondary: "#475569",
  textDisabled: "#94A3B8",
  primary: "#1E88E5",
  primaryHover: "#1565C0",
  border: "#E2E8F0",
  borderInput: "#CBD5E1",
  syncedBg: "#DCFCE7",
  syncedText: "#166534",
  pendingBg: "#FEF3C7",
  pendingText: "#92400E",
  errorBg: "#FEE2E2",
  errorText: "#991B1B",
  navy: "#0F172A",
  primarySoft: "#EFF6FF",
  pillBlueBg: "#DBEAFE",
  pillBlueText: "#1E40AF",
  pillPurpleBg: "#EDE9FE",
  pillPurpleText: "#5B21B6",
  highlightBg: "#EFF6FF",
  canvasPaper: "#F1F5F9",
  accent: "#EA580C",
  pillOrangeBg: "#FFF7ED",
};
