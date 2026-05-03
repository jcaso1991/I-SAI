/**
 * Permissions helper — provides a single source of truth for what
 * the current user can do, derived from `/api/auth/me`.
 *
 * Usage:
 *   const { perms, has, ready } = usePermissions();
 *   if (has("calendario.edit")) { ... }
 */
import { useEffect, useState, useCallback } from "react";
import { api } from "./api";

export type PermissionKey =
  | "proyectos.view" | "proyectos.edit"
  | "calendario.view" | "calendario.edit"
  | "planos.view" | "planos.edit"
  | "presupuestos.view" | "presupuestos.edit"
  | "sat.view" | "sat.edit"
  | "chat.view"
  | "users.manage" | "roles.manage" | "onedrive.manage";

export type Me = {
  id: string;
  email: string;
  name?: string;
  role: string;          // legacy: "admin" | "user" | "comercial"
  role_id?: string | null;
  role_name?: string | null;
  permissions?: string[] | null;
  color?: string | null;
};

export function usePermissions() {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    try {
      const u = await api.me();
      setMe(u as Me);
    } catch {
      setMe(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const perms: string[] = me?.permissions || [];
  const has = useCallback((p: PermissionKey | string) => perms.includes(p), [perms]);
  const isAdmin = me?.role === "admin"; // legacy/full-access flag
  const isSuperAdmin = !!(me?.permissions || []).includes("users.manage")
    && !!(me?.permissions || []).includes("roles.manage");

  return { me, perms, has, isAdmin, isSuperAdmin, ready, reload };
}

/**
 * Given a list of permissions, decide which tab keys to show in the
 * bottom/side navigation. Order is the global navigation order.
 */
export type NavItem =
  | "home" | "calendario" | "planos" | "proyectos"
  | "presupuestos" | "chat" | "sat" | "ajustes";

export function visibleNav(perms: string[]): NavItem[] {
  const items: NavItem[] = ["home"]; // home is always visible
  if (perms.includes("calendario.view")) items.push("calendario");
  if (perms.includes("planos.view")) items.push("planos");
  if (perms.includes("proyectos.view")) items.push("proyectos");
  if (perms.includes("presupuestos.view")) items.push("presupuestos");
  if (perms.includes("chat.view")) items.push("chat");
  if (perms.includes("sat.view")) items.push("sat");
  // Ajustes is visible to everyone (theme + portfolio etc)
  items.push("ajustes");
  return items;
}
