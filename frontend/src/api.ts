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
};

export const COLORS = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  readonly: "#F1F5F9",
  text: "#0F172A",
  textSecondary: "#475569",
  textDisabled: "#94A3B8",
  primary: "#EA580C",
  primaryHover: "#C2410C",
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
