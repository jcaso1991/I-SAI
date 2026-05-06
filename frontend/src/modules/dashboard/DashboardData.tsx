import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS } from "../../api";
import { ios } from "../../ui/iosTheme";
import { useS } from "./DashboardStyles";
import { useThemedStyles } from "../../theme";

type DashboardData = {
  projects_by_status: Record<string, number>;
  manager_hours: Array<{ name: string; color: string; hours: number; count: number; by_status: Record<string, number> }>;
  sat_by_month: Array<{ month: string; total: number; resolved: number }>;
  projects_by_month: Array<{ month: string; count: number; hours: number }>;
  total_active_hours: number;
  projects_over_hours: number;
  top_over_hours: Array<{ id: string; materiales: string; cliente: string; previstas: number; imputadas: number; exceso: number }>;
  total_imputadas_hours: number;
  total_previstas_hours: number;
  today: { events: number; pending_sat: number; pending_budgets: number };
};

const PROJECT_STATUS_COLORS: Record<string, string> = {
  planificado: "#3B82F6",
  pendiente: "#F59E0B",
  a_facturar: "#8B5CF6",
  terminado: "#10B981",
  facturado: "#10B981",
  bloqueado: "#EF4444",
  anulado: "#6B7280",
};

const STATUS_ORDER = ["planificado", "pendiente", "a_facturar", "terminado", "facturado", "bloqueado", "anulado"];

const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function getCurrentMonthAbbr(): string {
  return MONTHS_ES[new Date().getMonth()] ?? "";
}

export default function DashboardData() {
  const router = useRouter();
  const [dash, setDash] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const s = useThemedStyles(useS);

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      try {
        const d = await api.getDashboard().catch(() => null);
        if (!alive) return;
        setDash(d);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []));

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={ios.colors.brand} />
      </View>
    );
  }

  if (!dash) {
    return (
      <View style={{ padding: 24, alignItems: "center" }}>
        <Ionicons name="bar-chart-outline" size={48} color={COLORS.textDisabled} />
        <Text style={{ marginTop: 12, fontSize: 15, color: COLORS.textSecondary }}>Sin datos disponibles</Text>
        <Text style={{ marginTop: 4, fontSize: 13, color: COLORS.textDisabled }}>
          Conectá OneDrive o cargá materiales para ver estadísticas
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 12, marginBottom: 8 }}>
      <TodayRow dash={dash} router={router} />
      <ProjectsByStatus dash={dash} router={router} />
      <GlobalHours dash={dash} />
      <ProjectsOverHours dash={dash} router={router} />
      <ManagerHours dash={dash} />
      <ProjectsByMonth dash={dash} />
      <SatByMonth dash={dash} />
    </View>
  );
}

function TodayRow({ dash, router }: { dash: any; router: any }) {
  const s = useThemedStyles(useS);
  return (
    <>
      <Text style={s.sectionTitle}>Hoy</Text>
      <View style={s.dashStripRow}>
        <TouchableOpacity style={s.dashMiniCard} onPress={() => router.push("/calendario")}>
          <View style={[s.dashMiniIcon, { backgroundColor: COLORS.primarySoft }]}>
            <Ionicons name="today-outline" size={18} color={COLORS.primary} />
          </View>
          <Text style={s.dashMiniVal}>{dash.today?.events || 0}</Text>
          <Text style={s.dashMiniLbl}>Eventos hoy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.dashMiniCard} onPress={() => router.push("/sat")}>
          <View style={[s.dashMiniIcon, { backgroundColor: COLORS.pendingBg }]}>
            <Ionicons name="alert-circle-outline" size={18} color={COLORS.pendingText} />
          </View>
          <Text style={s.dashMiniVal}>{dash.today?.pending_sat || 0}</Text>
          <Text style={s.dashMiniLbl}>SAT pendiente</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.dashMiniCard} onPress={() => router.push("/presupuestos")}>
          <View style={[s.dashMiniIcon, { backgroundColor: COLORS.pillPurpleBg }]}>
            <Ionicons name="document-text-outline" size={18} color={COLORS.pillPurpleText} />
          </View>
          <Text style={s.dashMiniVal}>{dash.today?.pending_budgets || 0}</Text>
          <Text style={s.dashMiniLbl}>Presup. pendientes</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

function GlobalHours({ dash }: { dash: any }) {
  const s = useThemedStyles(useS);
  const prev = dash.total_previstas_hours || 0;
  const imp = dash.total_imputadas_hours || 0;
  const pct = prev > 0 ? Math.min((imp / prev) * 100, 100) : 0;
  const over = imp > prev;
  return (
    <>
      <Text style={s.sectionTitle}>Horas totales</Text>
      <View style={{ backgroundColor: COLORS.surface, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: COLORS.border }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
            <Text style={{ fontSize: 28, fontWeight: "900", color: over ? COLORS.errorText : COLORS.text }}>{imp}h</Text>
            <Text style={{ fontSize: 14, color: COLORS.textSecondary }}>de {prev}h previstas</Text>
          </View>
          <Text style={{ fontSize: 18, fontWeight: "800", color: over ? COLORS.errorText : COLORS.primary }}>
            {Math.round(pct)}%
          </Text>
        </View>
        <View style={{ height: 12, backgroundColor: COLORS.bg, borderRadius: 6, overflow: "hidden" }}>
          <View style={{
            height: 12,
            width: `${Math.min(pct, 100)}%`,
            backgroundColor: over ? COLORS.errorText : COLORS.primary,
            borderRadius: 6,
          }} />
        </View>
        {over && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
            <Ionicons name="warning" size={14} color={COLORS.errorText} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: COLORS.errorText }}>
              +{Math.round(imp - prev)}h por encima de lo previsto
            </Text>
          </View>
        )}
      </View>
    </>
  );
}

function ProjectsByStatus({ dash, router }: { dash: any; router: any }) {
  const s = useThemedStyles(useS);
  if (!dash.projects_by_status) return null;
  const entries = Object.entries(dash.projects_by_status) as [string, number][];
  if (!entries.length) return null;
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (total === 0) return null;

  const ordered = STATUS_ORDER
    .filter(status => dash.projects_by_status[status] != null)
    .map(status => [status, dash.projects_by_status[status] as number] as const);

  if (!ordered.length) return null;

  return (
    <>
      <Text style={s.sectionTitle}>Proyectos por estado</Text>
      <View style={s.statusBarWrap}>
        <View style={s.statusBar}>
          {ordered.map(([status, count]) => (
            <View
              key={status}
              style={[s.statusBarSegment, { width: `${(count / total) * 100}%`, backgroundColor: PROJECT_STATUS_COLORS[status] || "#999" }]}
            />
          ))}
        </View>
        <View style={s.statusLegend}>
          {ordered.map(([status, count]) => (
            <TouchableOpacity
              key={status}
              style={s.statusLegendItem}
              onPress={() => router.push(`/materiales?status=${status}` as any)}
            >
              <View style={[s.statusLegendDot, { backgroundColor: PROJECT_STATUS_COLORS[status] || "#999" }]} />
              <Text style={s.statusLegendText}>{status.replace("_", " ")}</Text>
              <Text style={s.statusLegendCount}>{count}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </>
  );
}

function ProjectsOverHours({ dash, router }: { dash: any; router: any }) {
  const s = useThemedStyles(useS);
  const [open, setOpen] = useState(false);
  const count: number = dash.projects_over_hours ?? 0;
  const totalOver: number = dash.total_over_hours ?? 0;
  const top = (dash.top_over_hours || []) as Array<{
    id: string; materiales: string; cliente: string; previstas: number; imputadas: number; exceso: number;
  }>;

  return (
    <>
      <TouchableOpacity
        style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, marginLeft: 16 }}
        onPress={() => setOpen(!open)}
        activeOpacity={0.7}
      >
        <Ionicons name="warning-outline" size={16} color={COLORS.pendingText} />
        <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, flex: 1 }}>
          Proyectos fuera de horas
        </Text>
        {count > 0 && (
          <View style={s.overHoursBubble}>
            <Text style={s.overHoursBubbleText}>{count}</Text>
          </View>
        )}
        {totalOver > 0 && (
          <Text style={{ fontSize: 12, fontWeight: "800", color: COLORS.errorText }}>
            +{totalOver}h
          </Text>
        )}
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {count === 0 ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, marginBottom: 4 }}>
          <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.syncedText} />
          <Text style={{ fontSize: 13, color: COLORS.syncedText, fontWeight: "500" }}>
            Todos los proyectos están dentro de lo previsto
          </Text>
        </View>
      ) : open ? (
        <View style={s.overHoursRow}>
          {top.slice(0, 5).map((item, i) => {
            const previstas = item.previstas || 0;
            const imputadas = item.imputadas || 0;
            const exceso = item.exceso || 0;
            const totalH = previstas + exceso;
            const redPct = totalH > 0 ? (exceso / totalH) * 100 : 0;
            const excessPct = previstas > 0 ? Math.round((exceso / previstas) * 100) : 0;
            const fullName = item.cliente ? `${item.materiales} — ${item.cliente}` : (item.materiales || `Proyecto ${i + 1}`);

            return (
              <TouchableOpacity
                key={i}
                style={s.overHoursItem}
                activeOpacity={0.7}
                onPress={() => item.id && router.push(`/material/${item.id}`)}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.text, flex: 1 }} numberOfLines={1}>
                    {fullName}
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: COLORS.errorText, marginLeft: 8 }}>
                    +{excessPct}%
                  </Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: COLORS.borderInput, flexDirection: "row" }}>
                  {redPct > 0 && (
                    <View style={{ height: 6, width: `${redPct}%`, backgroundColor: COLORS.errorText, borderRadius: 3 }} />
                  )}
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                  <Text style={{ fontSize: 9, color: COLORS.textDisabled }}>{previstas}h previstas</Text>
                  <Text style={{ fontSize: 9, color: COLORS.textDisabled }}>{imputadas}h imputadas</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </>
  );
}

function ManagerHours({ dash }: { dash: any }) {
  const s = useThemedStyles(useS);
  if (!dash.manager_hours?.length) return null;
  return (
    <>
      <Text style={s.sectionTitle}>Horas por gestor</Text>
      {dash.manager_hours.slice(0, 5).map((m: any, i: number) => {
        const byStatus = m.by_status || {};
        const statusColors: Record<string, string> = {
          pendiente: "#F59E0B", planificado: "#3B82F6", a_facturar: "#8B5CF6",
          facturado: "#10B981", terminado: "#6366F1",
        };
        const statusKeys = ["pendiente", "planificado", "a_facturar", "facturado", "terminado"];
        const totalH = m.hours || 1;
        return (
          <View key={i} style={{ gap: 4, paddingVertical: 4, paddingHorizontal: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: m.color || COLORS.primary }} />
              <Text style={s.hourName} numberOfLines={1}>{m.name}</Text>
              <Text style={s.hourVal}>{m.hours}h</Text>
              <Text style={s.hourCount}>({m.count})</Text>
            </View>
            <View style={{ flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", marginLeft: 16 }}>
              {statusKeys.map((st) => {
                const h = byStatus[st] || 0;
                if (h <= 0) return null;
                return <View key={st} style={{ width: `${(h / totalH) * 100}%`, backgroundColor: statusColors[st] || "#999", minWidth: 1 }} />;
              })}
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginLeft: 16, flexWrap: "wrap" }}>
              {statusKeys.map((st) => {
                const h = byStatus[st] || 0;
                if (h <= 0) return null;
                return (
                  <View key={st} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColors[st] || "#999" }} />
                    <Text style={{ fontSize: 8, color: COLORS.textSecondary }}>{st.replace("_"," ")} {h}h</Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </>
  );
}

function ProjectsByMonth({ dash }: { dash: any }) {
  const s = useThemedStyles(useS);
  if (!dash.projects_by_month?.length) return null;
  const currentMonth = getCurrentMonthAbbr();
  return (
    <>
      <Text style={s.sectionTitle}>Proyectos cerrados por mes · {dash.total_active_hours || 0}h activas</Text>
      <View style={s.monthScroll}>
        {dash.projects_by_month.map((m: any, i: number) => {
          const isCurrent = m.month === currentMonth;
          return (
            <View key={i} style={[s.monthMiniCard, isCurrent && s.monthMiniCurrent]}>
              <Text style={s.monthMiniMonth}>{m.month}</Text>
              <Text style={s.monthMiniCount}>{m.count}</Text>
              <Text style={s.monthMiniHours}>{m.hours}h</Text>
            </View>
          );
        })}
      </View>
    </>
  );
}

function SatByMonth({ dash }: { dash: any }) {
  const s = useThemedStyles(useS);
  if (!dash.sat_by_month?.length) return null;
  const currentMonth = getCurrentMonthAbbr();
  return (
    <>
      <Text style={s.sectionTitle}>Incidencias SAT por mes</Text>
      <View style={s.monthScroll}>
        {dash.sat_by_month.map((m: any, i: number) => {
          const isCurrent = m.month === currentMonth;
          return (
            <View key={i} style={[s.monthMiniCard, isCurrent && s.monthMiniCurrent]}>
              <Text style={s.monthMiniMonth}>{m.month}</Text>
              <Text style={s.monthMiniCount}>{m.total}</Text>
              <Text style={s.monthMiniHours}>{m.resolved} res.</Text>
            </View>
          );
        })}
      </View>
    </>
  );
}
