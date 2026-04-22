import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
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
  listMateriales: (q?: string, pendingOnly?: boolean) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (pendingOnly) p.set("pending_only", "true");
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
  createUser: (body: { email: string; password: string; name?: string; role: "admin" | "user" }) =>
    request("/users", { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id: string, body: { name?: string; role?: "admin" | "user" }) =>
    request(`/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  resetPassword: (id: string, password: string) =>
    request(`/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ password }) }),
  deleteUser: (id: string) => request(`/users/${id}`, { method: "DELETE" }),
  listTechnicians: () => request("/technicians"),
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
  // Stamps
  listStamps: () => request("/stamps"),
  createStamp: (body: { name: string; image_base64: string }) =>
    request("/stamps", { method: "POST", body: JSON.stringify(body) }),
  deleteStamp: (id: string) => request(`/stamps/${id}`, { method: "DELETE" }),
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
};
