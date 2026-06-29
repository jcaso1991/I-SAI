import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
export const BACKEND_URL = (BASE || "").replace(/\/+$/, "");
const TOKEN_KEY = "materiales_token";

function backendBase() {
  if (!BACKEND_URL) {
    throw new Error("Backend no configurado: falta EXPO_PUBLIC_BACKEND_URL.");
  }
  return BACKEND_URL;
}

function apiUrl(path: string) {
  return `${backendBase()}/api${path}`;
}

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
  if (!opts.method || opts.method === "GET") {
    headers["Cache-Control"] = "no-cache";
  }
  if (auth) {
    const t = await getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  const res = await fetch(apiUrl(path), { ...opts, headers });
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
  updateHomepage: (homepage: string) =>
    request("/auth/homepage", { method: "PATCH", body: JSON.stringify({ homepage }) }),
  listMateriales: (q?: string, pendingOnly?: boolean, managerId?: string, unassigned?: boolean, projectStatus?: string, year?: string, month?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (pendingOnly) p.set("pending_only", "true");
    if (managerId) p.set("manager_id", managerId);
    if (unassigned) p.set("unassigned", "true");
    if (projectStatus) p.set("project_status", projectStatus);
    if (year && year !== "todos") p.set("year", year);
    if (month && month !== "todos") p.set("month", month);
    const qs = p.toString();
    return request(`/materiales${qs ? "?" + qs : ""}`);
  },
  getMaterial: (id: string) => request(`/materiales/${id}`),
  updateMaterial: (id: string, body: any) =>
    request(`/materiales/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  uploadMaterialAttachment: (mid: string, body: { filename: string; mime_type: string; base64: string }) =>
    request(`/materiales/${mid}/attachments`, { method: "POST", body: JSON.stringify(body) }),
  getMaterialHistory: (id: string) => request(`/materiales/${id}/history`),
  stats: () => request("/stats"),
  statsByManager: (year?: string) => request(`/stats/by-manager${year && year !== "todos" ? "?year=" + year : ""}`),
  getDashboard: () => request("/dashboard"),
  exportProjectsExcel: async () => {
    const token = await getToken();
    const res = await fetch(`${backendBase()}/api/materiales/export-excel`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proyectos.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  },
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
  createRole: (body: { name: string; permissions: string[]; notification_prefs?: string[]; tipos_mano_obra?: string[] }) =>
    request("/roles", { method: "POST", body: JSON.stringify(body) }),
  updateRole: (id: string, body: { name?: string; permissions?: string[]; notification_prefs?: string[]; tipos_mano_obra?: string[] }) =>
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

  // Guards (técnicos de guardia por día)
  listGuards: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return request(`/guards${params.toString() ? "?" + params.toString() : ""}`);
  },
  createGuard: (body: { date: string; user_id: string; note?: string }) =>
    request(`/guards`, { method: "POST", body: JSON.stringify(body) }),
  deleteGuard: (id: string) => request(`/guards/${id}`, { method: "DELETE" }),

  // Event attachments
  uploadEventAttachment: (eid: string, body: { filename: string; mime_type: string; base64: string }) =>
    request(`/events/${encodeURIComponent(eid)}/attachments`, { method: "POST", body: JSON.stringify(body) }),
  getEventAttachment: (eid: string, aid: string) =>
    request(`/events/${encodeURIComponent(eid)}/attachments/${aid}`),
  deleteEventAttachment: (eid: string, aid: string) =>
    request(`/events/${encodeURIComponent(eid)}/attachments/${aid}`, { method: "DELETE" }),

  getAttachmentShareToken: (eid: string, aid: string) =>
    request(`/events/${encodeURIComponent(eid)}/attachments/${aid}/share-token`),

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

  setProjectStatusFromNotification: (notificationId: string, projectStatus: string) =>
    request("/notifications/project-status", { method: "POST", body: JSON.stringify({ notification_id: notificationId, project_status: projectStatus }) }),

  setEventGestorList: (eventId: string, gestorList: string) =>
    request(`/events/${encodeURIComponent(eventId)}/gestor-list`, { method: "PATCH", body: JSON.stringify({ gestor_list: gestorList }) }),

  // CRM SAT — customer-facing public form + internal management
  satCreatePublic: (body: {
    cliente: string; direccion?: string; telefono?: string; observaciones: string;
  }) => {
    // Public endpoint: no auth header required. We still hit the /api prefix.
    return fetch(apiUrl("/sat/public"), {
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
  satList: (status?: "pendiente" | "resuelta" | "agendada", year?: string, month?: string) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (year && year !== "todos") params.set("year", year);
    if (month && month !== "todos") params.set("month", month);
    const qs = params.toString();
    return request(`/sat/incidents${qs ? "?" + qs : ""}`);
  },
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
    const res = await fetch(apiUrl("/sat/export-excel"), {
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
  // Preciario
  getPreciario: (queryString?: string) => request(`/preciario/productos${queryString ? "?" + queryString : ""}`),
  getDescuentos: () => request("/preciario/descuentos"),
  updateDescuento: (ref: string, descuento: number) =>
    request("/preciario/descuentos", { method: "PATCH", body: JSON.stringify({ ref, descuento }) }),
  updateStock: (ref: string, stock: number) =>
    request("/preciario/stock", { method: "PATCH", body: JSON.stringify({ ref, stock }) }),

  // Notas personales
  listNotas: (fecha?: string, marcada?: boolean, search?: string, priority?: string, tag?: string, material_id?: string, pinned?: boolean, archived?: boolean) => {
    const params = new URLSearchParams();
    if (fecha) params.set("fecha", fecha);
    if (marcada !== undefined) params.set("marcada", String(marcada));
    if (search) params.set("search", search);
    if (priority) params.set("priority", priority);
    if (tag) params.set("tag", tag);
    if (material_id) params.set("material_id", material_id);
    if (pinned !== undefined) params.set("pinned", String(pinned));
    if (archived !== undefined) params.set("archived", String(archived));
    const qs = params.toString();
    return request(`/notas${qs ? "?" + qs : ""}`);
  },
  createNota: (body: { titulo?: string; contenido?: string; fecha?: string; material_id?: string; marcada?: boolean; color?: string; priority?: string; tags?: string[]; pinned?: boolean; archived?: boolean }) =>
    request("/notas", { method: "POST", body: JSON.stringify(body) }),
  updateNota: (id: string, body: { titulo?: string; contenido?: string; fecha?: string; material_id?: string; marcada?: boolean; color?: string; priority?: string; tags?: string[]; pinned?: boolean; archived?: boolean }) =>
    request(`/notas/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteNota: (id: string) => request(`/notas/${id}`, { method: "DELETE" }),

  // Documentos (fichas técnicas / manuales)
  listDocumentos: (categoria?: string) => request(`/documentos${categoria ? "?categoria=" + categoria : ""}`),
  createDocumento: (body: { titulo: string; categoria: string; filename: string; file_base64: string }) =>
    request("/documentos", { method: "POST", body: JSON.stringify(body) }),
  getDocumento: (id: string) => request(`/documentos/${id}`),
  deleteDocumento: (id: string) => request(`/documentos/${id}`, { method: "DELETE" }),

  // Archivos ordenados
  getArchivos: (path?: string) => request(`/archivos${path ? "?path=" + encodeURIComponent(path) : ""}`),

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
    const res = await fetch(apiUrl(`/sat/clients/import?replace=${replace ? "true" : "false"}`), {
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
  listBudgets: (materialId?: string) => {
    const params = new URLSearchParams();
    if (materialId) params.set("material_id", materialId);
    const qs = params.toString();
    return request(`/budgets${qs ? "?" + qs : ""}`);
  },
  listAcceptedBudgets: () => request("/budgets/accepted"),
  getBudget: (id: string) => request(`/budgets/${id}`),
  createBudget: (body: any) => request("/budgets", { method: "POST", body: JSON.stringify(body) }),
  updateBudget: (id: string, body: any) => request(`/budgets/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  setBudgetStatus: (id: string, status: string) => request(`/budgets/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  duplicateBudget: (id: string) => request(`/budgets/${id}/duplicate`, { method: "POST" }),
  uploadBudgetAttachment: (bid: string, body: { name: string; data: string; mime: string }) => request(`/budgets/${bid}/attachments`, { method: "POST", body: JSON.stringify(body) }),
  deleteBudgetAttachment: (bid: string, aid: string) => request(`/budgets/${bid}/attachments/${aid}`, { method: "DELETE" }),
  getBudgetAttachmentUrl: (bid: string, aid: string) => apiUrl(`/budgets/${bid}/attachments/${aid}`),
  deleteBudget: (id: string) => request(`/budgets/${id}`, { method: "DELETE" }),
  budgetsDefaultEquipos: () => request("/budgets-defaults/equipos"),

  // Versions
  listBudgetVersions: (bid: string) => request(`/budgets/${bid}/versions`),
  getBudgetVersion: (bid: string, vid: string) => request(`/budgets/${bid}/versions/${vid}`),

  // Templates
  listBudgetTemplates: () => request("/budget-templates"),
  createBudgetTemplate: (body: { name: string; equipos: any[] }) => request("/budget-templates", { method: "POST", body: JSON.stringify(body) }),
  deleteBudgetTemplate: (tid: string) => request(`/budget-templates/${tid}`, { method: "DELETE" }),

  // Stats (para el dashboard KPI)
  getBudgetsStats: () => request("/budgets/stats"),

  // Get budget PDF URL (authenticated blob fetch)
  getBudgetPdfUrl: (id: string) => apiUrl(`/budgets/${id}/pdf`),
  getBudgetPdfBlob: async (id: string): Promise<Blob> => {
    const t = await getToken();
    const res = await fetch(apiUrl(`/budgets/${id}/pdf`), {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.blob();
  },
  getBudgetPdfPreviewBlob: async (body: any): Promise<Blob> => {
    const t = await getToken();
    const res = await fetch(apiUrl("/budgets/pdf-preview"), {
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
  imageToPdfBase64: async (base64: string, mime_type: string = "image/jpeg", orientation?: string): Promise<string> => {
    const t = await getToken();
    const res = await fetch(apiUrl("/utils/image-to-pdf"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
      body: JSON.stringify({ base64, mime_type, orientation }),
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
  microsoftStatus: () => request("/auth/microsoft/status", {}, false),
  microsoftLoginUrl: () => request("/auth/microsoft/login"),
  microsoftExchange: (code: string, state: string) =>
    request("/auth/microsoft/exchange", { method: "POST", body: JSON.stringify({ code, state }) }, false),

  // Chat
  chatList: () => request("/chats"),
  chatMessages: (cid: string, before?: string) => request(`/chats/${cid}/messages${before ? `?before=${before}` : ""}`),
  chatSend: (cid: string, text: string) => request(`/chats/${cid}/messages`, { method: "POST", body: JSON.stringify({ text }) }),
  chatSendFile: (cid: string, fileBase64: string, fileName: string, fileMime: string) => request(`/chats/${cid}/messages`, { method: "POST", body: JSON.stringify({ text: "", file_base64: fileBase64, file_name: fileName, file_mime: fileMime }) }),
  chatCreate: (body: { participant_ids: string[]; name?: string; project_id?: string; event_id?: string }) => request("/chats", { method: "POST", body: JSON.stringify(body) }),
  chatUnreadTotal: () => request("/chats/unread-total"),

  // Muestrario
  getMuestrario: () => request("/muestrario"),

  // Solicitudes de presupuesto (cliente)
  createBudgetRequest: (body: any) => request("/budget-requests", { method: "POST", body: JSON.stringify(body) }, false),
  listBudgetRequests: () => request("/budget-requests"),
  updateBudgetRequest: (id: string, body: any) => request(`/budget-requests/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  // Precios mano de obra
  getPrecios: () => request("/config/precios", {}, false),
  updatePrecios: (body: any) => request("/config/precios", { method: "PUT", body: JSON.stringify(body) }),

  // Tipos de mano de obra disponibles para el usuario actual
  getTiposManoObra: () => request("/auth/tipos-mano-obra"),

  // Dashboard financiero
  getDashboardFinanciero: (year?: string) => {
    const params = new URLSearchParams();
    if (year) params.set("year", year);
    return request(`/dashboard/financiero${params.toString() ? "?" + params.toString() : ""}`);
  },
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
  pillOrangeText: "#92400E",
  // Project status badge colours
  statusPlanifBg: "#DBEAFE",
  statusPlanifFg: "#1E40AF",
  statusFacturarBg: "#EDE9FE",
  statusFacturarFg: "#5B21B6",
  statusFacturadoBg: "#DCFCE7",
  statusFacturadoFg: "#166534",
  statusTerminadoBg: "#E0E7FF",
  statusTerminadoFg: "#3730A3",
  statusBloqueadoBg: "#FEE2E2",
  statusBloqueadoFg: "#991B1B",
  statusAnuladoBg: "#F3F4F6",
  statusAnuladoFg: "#6B7280",
  // Completed event colours
  statusCompletedBg: "#E5E7EB",
  statusCompletedFg: "#6B7280",
};
