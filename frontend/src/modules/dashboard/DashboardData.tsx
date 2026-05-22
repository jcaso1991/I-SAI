import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, G } from "react-native-svg";
import { api, COLORS } from "../../api";
import { ios } from "../../ui/iosTheme";
import { useS } from "./DashboardStyles";
import { useThemedStyles } from "../../theme";
import { useBreakpoint } from "../../useBreakpoint";

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

function DonutChart({ data, size = 140 }: { data: Array<{ label: string; value: number; color: string }>; size?: number }) {
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, d) => sum + d.value, 0);

  let cumulativeOffset = 0;

  return (
    <View style={{ position: "relative", width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${center}, ${center}`}>
          {data.map((item, i) => {
            const pct = total > 0 ? item.value / total : 0;
            const dashLength = Math.max(pct * circumference, pct > 0 ? 2 : 0);
            const offset = -cumulativeOffset;
            cumulativeOffset += dashLength;
            return (
              <Circle
                key={i}
                cx={center}
                cy={center}
                r={radius}
                stroke={item.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="butt"
                strokeDasharray={`${dashLength} ${circumference}`}
                strokeDashoffset={offset}
              />
            );
          })}
        </G>
      </Svg>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 22, fontWeight: "900", color: COLORS.text }}>{total}</Text>
        <Text style={{ fontSize: 11, color: COLORS.textSecondary }}>proyectos</Text>
      </View>
    </View>
  );
}

function CircularProgress({ value, max, size = 110, color, label }: { value: number; max: number; size?: number; color?: string; label?: string }) {
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const dashLength = pct * circumference;
  const progressColor = color || (pct >= 1 ? COLORS.errorText : COLORS.primary);

  return (
    <View style={{ position: "relative", width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${center}, ${center}`}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={COLORS.borderInput}
            strokeOpacity={0.5}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={progressColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${dashLength} ${circumference}`}
            strokeDashoffset={0}
          />
        </G>
      </Svg>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 20, fontWeight: "900", color: COLORS.text }}>{value}h</Text>
        <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>de {max}h previstas</Text>
        <Text style={{ fontSize: 12, fontWeight: "800", color: progressColor }}>{Math.round(pct * 100)}%</Text>
      </View>
    </View>
  );
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
    <View style={{ gap: 16, marginBottom: 8 }}>
      <TechAvailability3W dash={dash} router={router} />
      <WeekSummary dash={dash} router={router} />
      <TodayRow dash={dash} router={router} />
      <View style={{ flexDirection: "row", gap: 16, flexWrap: "wrap" }}>
        <View style={{ flex: 1, minWidth: 280 }}><ProjectsByStatus dash={dash} router={router} /></View>
        <View style={{ flex: 1, minWidth: 280 }}><GlobalHours dash={dash} /></View>
      </View>
      <TopTechnicians dash={dash} router={router} />
      <ProjectsOverHours dash={dash} router={router} />
      <ManagerHours dash={dash} />
      <BudgetPipeline dash={dash} router={router} />
      <BudgetsKPI />
      <SatHealth dash={dash} router={router} />
      <MiniMap dash={dash} router={router} />
      <YoYComparison dash={dash} />
      <GeoDistribution dash={dash} router={router} />
      <ProjectsByMonth dash={dash} />
      <SatByMonth dash={dash} />
    </View>
  );
}

function TodayRow({ dash, router }: { dash: any; router: any }) {
  const s = useThemedStyles(useS);
  return (
    <View style={s.kpiStrip}>
      <TouchableOpacity style={s.kpiCard} onPress={() => router.push("/calendario")}>
        <View style={[s.kpiIconCircle, { backgroundColor: COLORS.primarySoft }]}>
          <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
        </View>
        <Text style={s.kpiValue}>{dash.today?.events || 0}</Text>
        <Text style={s.kpiLabel}>Eventos hoy</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.kpiCard} onPress={() => router.push("/sat")}>
        <View style={[s.kpiIconCircle, { backgroundColor: COLORS.pendingBg }]}>
          <Ionicons name="alert-circle-outline" size={20} color={COLORS.pendingText} />
        </View>
        <Text style={s.kpiValue}>{dash.today?.pending_sat || 0}</Text>
        <Text style={s.kpiLabel}>SAT pendiente</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.kpiCard} onPress={() => router.push("/presupuestos")}>
        <View style={[s.kpiIconCircle, { backgroundColor: COLORS.pillPurpleBg }]}>
          <Ionicons name="document-text-outline" size={20} color={COLORS.pillPurpleText} />
        </View>
        <Text style={s.kpiValue}>{dash.today?.pending_budgets || 0}</Text>
        <Text style={s.kpiLabel}>Presup. pendientes</Text>
      </TouchableOpacity>
    </View>
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
    .map(status => ({ label: status.replace("_", " "), value: dash.projects_by_status[status] as number, color: PROJECT_STATUS_COLORS[status] || "#999" }));

  if (!ordered.length) return null;

  return (
    <View style={s.cardWrap}>
      <View style={s.cardHeader}>
        <Text style={s.cardTitle}>Proyectos por estado</Text>
      </View>
      <View style={{ alignItems: "center", gap: 12 }}>
        <DonutChart data={ordered} size={140} />
        <View style={[s.donutLegend, { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" }]}>
          {ordered.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={s.donutLegendItem}
              onPress={() => router.push(`/materiales?status=${item.label.replace(" ", "_")}` as any)}
            >
              <View style={[s.donutLegendDot, { backgroundColor: item.color }]} />
              <Text style={s.donutLegendText}>{item.label}</Text>
              <Text style={s.donutLegendCount}>{item.value}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

function GlobalHours({ dash }: { dash: any }) {
  const s = useThemedStyles(useS);
  const prev = dash.total_previstas_hours || 0;
  const imp = dash.total_imputadas_hours || 0;
  const over = imp > prev;
  return (
    <View style={s.cardWrap}>
      <View style={s.cardHeader}>
        <Text style={s.cardTitle}>Horas totales</Text>
      </View>
      <View style={s.circularProgressWrap}>
        <CircularProgress value={imp} max={prev} size={110} />
      </View>
      {over && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, justifyContent: "center" }}>
          <Ionicons name="warning" size={14} color={COLORS.errorText} />
          <Text style={{ fontSize: 12, fontWeight: "700", color: COLORS.errorText }}>
            +{Math.round(imp - prev)}h por encima de lo previsto
          </Text>
        </View>
      )}
    </View>
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
    <View style={s.cardWrap}>
      <TouchableOpacity
        style={[s.cardHeader, { marginBottom: open || count === 0 ? 16 : 0 }]}
        onPress={() => setOpen(!open)}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          <Ionicons name="warning-outline" size={16} color={COLORS.pendingText} />
          <Text style={s.cardTitle}>Proyectos fuera de horas</Text>
        </View>
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
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
    </View>
  );
}

function ManagerHours({ dash }: { dash: any }) {
  const s = useThemedStyles(useS);
  if (!dash.manager_hours?.length) return null;
  return (
    <View style={s.cardWrap}>
      <View style={s.cardHeader}>
        <Text style={s.cardTitle}>Horas por gestor</Text>
      </View>
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
    </View>
  );
}

function ProjectsByMonth({ dash }: { dash: any }) {
  const s = useThemedStyles(useS);
  const router = useRouter();
  if (!dash.projects_by_month?.length) return null;
  const currentMonth = getCurrentMonthAbbr();
  return (
    <View style={s.cardWrap}>
      <View style={s.cardHeader}>
        <Text style={s.cardTitle}>Proyectos cerrados por mes</Text>
        <Text style={{ fontSize: 12, fontWeight: "800", color: COLORS.textSecondary }}>{dash.total_active_hours || 0}h activas</Text>
      </View>
      <View style={s.monthScroll}>
        {dash.projects_by_month.map((m: any, i: number) => {
          const isCurrent = m.month === currentMonth;
          return (
            <TouchableOpacity
              key={i}
              style={[s.monthMiniCard, isCurrent && s.monthMiniCurrent]}
              onPress={() => {
                const status = "terminado,facturado";
                const params = new URLSearchParams();
                params.set("project_status", status);
                if (m.year) params.set("year", m.year);
                if (m.month_num) params.set("month", m.month_num);
                router.push(`/materiales?${params.toString()}` as any);
              }}
              activeOpacity={0.7}
            >
              <Text style={s.monthMiniMonth}>{m.month}</Text>
              <Text style={s.monthMiniCount}>{m.count}</Text>
              <Text style={s.monthMiniHours}>{m.hours}h</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function SatByMonth({ dash }: { dash: any }) {
  const s = useThemedStyles(useS);
  const router = useRouter();
  if (!dash.sat_by_month?.length) return null;
  const currentMonth = getCurrentMonthAbbr();
  return (
    <View style={s.cardWrap}>
      <View style={s.cardHeader}>
        <Text style={s.cardTitle}>Incidencias SAT por mes</Text>
      </View>
      <View style={s.monthScroll}>
        {dash.sat_by_month.map((m: any, i: number) => {
          const isCurrent = m.month === currentMonth;
          return (
            <TouchableOpacity
              key={i}
              style={[s.monthMiniCard, isCurrent && s.monthMiniCurrent]}
              onPress={() => {
                const params = new URLSearchParams();
                params.set("status", "resuelta");
                if (m.year) params.set("year", m.year);
                if (m.month_num) params.set("month", m.month_num);
                router.push(`/sat?${params.toString()}` as any);
              }}
              activeOpacity={0.7}
            >
              <Text style={s.monthMiniMonth}>{m.month}</Text>
              <Text style={s.monthMiniCount}>{m.total}</Text>
              <Text style={s.monthMiniHours}>{m.resolved} res.</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const BUDGET_STATUS_COLORS: Record<string, string> = {
  pendiente: "#F59E0B",
  en_revision: "#8B5CF6",
  aceptado: "#10B981",
  rechazado: "#EF4444",
  facturado: "#3B82F6",
};
const BUDGET_STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendientes",
  en_revision: "En revisión",
  aceptado: "Aceptados",
  rechazado: "Rechazados",
  facturado: "Facturados",
};
const BUDGET_STATUS_ORDER = ["pendiente", "en_revision", "aceptado", "rechazado", "facturado"];

function BudgetsKPI() {
  const s = useThemedStyles(useS);
  const [stats, setStats] = useState<any>(null);

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      try {
        const d = await api.getBudgetsStats().catch(() => null);
        if (!alive) return;
        setStats(d);
      } catch {}
    })();
    return () => { alive = false; };
  }, []));

  if (!stats || !stats.by_status) return null;

  const total = BUDGET_STATUS_ORDER.reduce((sum, st) => sum + (stats.by_status[st] || 0), 0);
  if (total === 0) return null;

  return (
    <View style={s.cardWrap}>
      <View style={s.cardHeader}>
        <Text style={s.cardTitle}>Presupuestos</Text>
        <Text style={{ fontSize: 12, fontWeight: "800", color: COLORS.textSecondary }}>Total: {total}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {BUDGET_STATUS_ORDER.map((st) => {
          const count = stats.by_status[st] || 0;
          return (
            <View key={st} style={[s.dashCard, { minWidth: 70, borderLeftWidth: 3, borderLeftColor: BUDGET_STATUS_COLORS[st] || "#999" }]}>
              <Text style={[s.dashVal, { fontSize: 18 }]}>{count}</Text>
              <Text style={s.dashLbl}>{BUDGET_STATUS_LABELS[st] || st}</Text>
            </View>
          );
        })}
        <View style={[s.dashCard, { minWidth: 70, borderLeftWidth: 3, borderLeftColor: "#6B7280" }]}>
          <Text style={[s.dashVal, { fontSize: 18 }]}>{total}</Text>
          <Text style={s.dashLbl}>Total</Text>
        </View>
      </View>
      {stats.accepted_this_month != null && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, paddingHorizontal: 4 }}>
          <Ionicons name="checkmark-circle" size={18} color={BUDGET_STATUS_COLORS.aceptado} />
          <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.text }}>
            Aceptados este mes: <Text style={{ color: BUDGET_STATUS_COLORS.aceptado }}>{stats.accepted_this_month}</Text>
          </Text>
        </View>
      )}
      {stats.by_commercial && stats.by_commercial.length > 0 && (
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, paddingHorizontal: 4 }}>
            Por comercial
          </Text>
          {stats.by_commercial.map((c: any, i: number) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: COLORS.text, flex: 1 }} numberOfLines={1}>
                {c.name || c.email || "—"}
              </Text>
              <View style={{ flexDirection: "row", gap: 4 }}>
                {BUDGET_STATUS_ORDER.map((st) => {
                  const v = c[st] || 0;
                  if (v <= 0) return null;
                  return (
                    <View key={st} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: BUDGET_STATUS_COLORS[st] || "#999" }} />
                      <Text style={{ fontSize: 10, fontWeight: "700", color: COLORS.textSecondary }}>{v}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ============================================================================
// NEW EXTENDED DASHBOARD COMPONENTS
// ============================================================================

function formatEur(n: number | undefined | null): string {
  if (n == null) return "0 €";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k €`;
  return `${Math.round(n)} €`;
}

function CriticalAlerts({ dash, router }: { dash: any; router: any }) {
  const s = useThemedStyles(useS);
  const alerts = dash?.alerts;
  if (!alerts || alerts.total === 0) return null;

  const items: Array<{ icon: any; label: string; value: number; color: string; onPress: () => void }> = [];
  if (alerts.sat_urgent_open > 0) {
    items.push({
      icon: "warning",
      label: `${alerts.sat_urgent_open} incidencia${alerts.sat_urgent_open === 1 ? "" : "s"} SAT urgente${alerts.sat_urgent_open === 1 ? "" : "s"}`,
      value: alerts.sat_urgent_open,
      color: "#DC2626",
      onPress: () => router.push("/sat"),
    });
  }
  if (alerts.events_no_tech > 0) {
    items.push({
      icon: "calendar-outline",
      label: `${alerts.events_no_tech} evento${alerts.events_no_tech === 1 ? "" : "s"} sin técnico`,
      value: alerts.events_no_tech,
      color: "#EA580C",
      onPress: () => router.push("/calendario"),
    });
  }
  if (alerts.budgets_pending_30d > 0) {
    items.push({
      icon: "document-text-outline",
      label: `${alerts.budgets_pending_30d} presupuesto${alerts.budgets_pending_30d === 1 ? "" : "s"} >30 días`,
      value: alerts.budgets_pending_30d,
      color: "#B45309",
      onPress: () => router.push("/presupuestos"),
    });
  }

  return (
    <View style={{
      backgroundColor: "#FEF2F2",
      borderWidth: 1,
      borderColor: "#FECACA",
      borderRadius: 12,
      padding: 12,
      gap: 8,
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="alert-circle" size={22} color="#DC2626" />
        <Text style={{ fontSize: 15, fontWeight: "800", color: "#991B1B" }}>
          Alertas críticas
        </Text>
        <View style={{ backgroundColor: "#DC2626", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: "#fff" }}>{alerts.total}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {items.map((it, i) => (
          <TouchableOpacity
            key={i}
            onPress={it.onPress}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 6,
              paddingHorizontal: 10,
              backgroundColor: "#fff",
              borderRadius: 8,
              borderLeftWidth: 3,
              borderLeftColor: it.color,
            }}
          >
            <Ionicons name={it.icon} size={14} color={it.color} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: COLORS.text }}>{it.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function WeekSummary({ dash, router }: { dash: any; router: any }) {
  const s = useThemedStyles(useS);
  const w = dash?.week_summary;
  if (!w) return null;
  const pct = w.hours_planned_week > 0 ? Math.round((w.hours_real_week / w.hours_planned_week) * 100) : 0;
  const busyPct = w.technicians_total > 0 ? Math.round((w.technicians_busy / w.technicians_total) * 100) : 0;

  return (
    <View style={s.cardWrap}>
      <View style={s.cardHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="speedometer-outline" size={18} color={COLORS.primary} />
          <Text style={s.cardTitle}>Resumen de la semana</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        {/* Eventos hoy */}
        <TouchableOpacity onPress={() => router.push("/calendario")} style={{
          flex: 1, minWidth: 130, backgroundColor: "#EFF6FF", borderRadius: 10, padding: 12,
          borderLeftWidth: 3, borderLeftColor: "#3B82F6",
        }}>
          <Text style={{ fontSize: 11, color: COLORS.textSecondary, fontWeight: "700" }}>HOY</Text>
          <Text style={{ fontSize: 22, fontWeight: "900", color: COLORS.text, marginTop: 2 }}>{w.events_today}</Text>
          <Text style={{ fontSize: 11, color: COLORS.textSecondary }}>eventos</Text>
        </TouchableOpacity>
        {/* Eventos semana */}
        <TouchableOpacity onPress={() => router.push("/calendario")} style={{
          flex: 1, minWidth: 130, backgroundColor: "#F0FDF4", borderRadius: 10, padding: 12,
          borderLeftWidth: 3, borderLeftColor: "#10B981",
        }}>
          <Text style={{ fontSize: 11, color: COLORS.textSecondary, fontWeight: "700" }}>ESTA SEMANA</Text>
          <Text style={{ fontSize: 22, fontWeight: "900", color: COLORS.text, marginTop: 2 }}>{w.events_week}</Text>
          <Text style={{ fontSize: 11, color: COLORS.textSecondary }}>eventos</Text>
        </TouchableOpacity>
        {/* Horas plan vs real */}
        <View style={{
          flex: 1.4, minWidth: 180, backgroundColor: "#FAF5FF", borderRadius: 10, padding: 12,
          borderLeftWidth: 3, borderLeftColor: "#8B5CF6",
        }}>
          <Text style={{ fontSize: 11, color: COLORS.textSecondary, fontWeight: "700" }}>HORAS SEMANA</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 2 }}>
            <Text style={{ fontSize: 22, fontWeight: "900", color: COLORS.text }}>{w.hours_real_week}h</Text>
            <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>/ {w.hours_planned_week}h</Text>
          </View>
          <View style={{ height: 6, backgroundColor: "#E9D5FF", borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
            <View style={{ height: 6, width: `${Math.min(pct, 100)}%`, backgroundColor: "#8B5CF6", borderRadius: 3 }} />
          </View>
          <Text style={{ fontSize: 10, color: "#8B5CF6", fontWeight: "700", marginTop: 4 }}>{pct}% completado</Text>
        </View>
        {/* Técnicos · 3 semanas (resumen) */}
        <View style={{
          flex: 1.2, minWidth: 160, backgroundColor: "#FFF7ED", borderRadius: 10, padding: 12,
          borderLeftWidth: 3, borderLeftColor: "#F97316",
        }}>
          <Text style={{ fontSize: 11, color: COLORS.textSecondary, fontWeight: "700" }}>TÉCNICOS · MES</Text>
          {(() => {
            const t3 = dash?.tech_three_weeks;
            const totalTech = t3?.technicians?.length || 0;
            const totalFree = (t3?.technicians || []).reduce((acc: number, x: any) => acc + (x.free_days || 0), 0);
            const totalSlots = totalTech * (t3?.total_workdays || 0);
            const pctFree = totalSlots > 0 ? Math.round((totalFree / totalSlots) * 100) : 0;
            return (
              <>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 2 }}>
                  <Text style={{ fontSize: 22, fontWeight: "900", color: "#EA580C" }}>{totalFree}</Text>
                  <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>días libres</Text>
                </View>
                <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>
                  {totalTech} técnicos · {pctFree}% libre
                </Text>
              </>
            );
          })()}
        </View>
      </View>
    </View>
  );
}

function TopTechnicians({ dash, router }: { dash: any; router: any }) {
  const s = useThemedStyles(useS);
  const techs: any[] = dash?.top_technicians || [];
  if (!techs.length) return null;
  return (
    <View style={s.cardWrap}>
      <View style={s.cardHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="trophy-outline" size={18} color="#F59E0B" />
          <Text style={s.cardTitle}>Top técnicos del mes</Text>
        </View>
        <Text style={{ fontSize: 11, color: COLORS.textSecondary }}>productividad</Text>
      </View>
      {techs.slice(0, 6).map((t, i) => {
        const rate = t.completion_rate || 0;
        const color = rate >= 80 ? "#10B981" : rate >= 50 ? "#F59E0B" : "#EF4444";
        return (
          <View key={i} style={{ paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: i < techs.length - 1 ? 1 : 0, borderBottomColor: COLORS.borderInput }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: t.color || "#3B82F6", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#fff" }}>{i + 1}</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.text, flex: 1 }} numberOfLines={1}>{t.name}</Text>
              <Text style={{ fontSize: 13, fontWeight: "800", color }}>{rate}%</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ flex: 1, height: 5, backgroundColor: COLORS.borderInput, borderRadius: 3, overflow: "hidden" }}>
                <View style={{ height: 5, width: `${Math.min(rate, 100)}%`, backgroundColor: color, borderRadius: 3 }} />
              </View>
              <Text style={{ fontSize: 10, color: COLORS.textSecondary, minWidth: 80, textAlign: "right" }}>
                {t.hours_real}h / {t.hours_planned}h · {t.events} ev.
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function BudgetPipeline({ dash, router }: { dash: any; router: any }) {
  const s = useThemedStyles(useS);
  const bp = dash?.budget_pipeline;
  if (!bp || !bp.stages) return null;
  const stages = [
    { key: "borrador", label: "Borrador", color: "#9CA3AF", icon: "create-outline" },
    { key: "enviado", label: "Enviado", color: "#3B82F6", icon: "paper-plane-outline" },
    { key: "aceptado", label: "Aceptado", color: "#10B981", icon: "checkmark-circle-outline" },
    { key: "rechazado", label: "Rechazado", color: "#EF4444", icon: "close-circle-outline" },
  ];
  const maxCount = Math.max(...stages.map(s2 => bp.stages[s2.key]?.count || 0), 1);

  return (
    <View style={s.cardWrap}>
      <View style={s.cardHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="funnel-outline" size={18} color={COLORS.primary} />
          <Text style={s.cardTitle}>Embudo de presupuestos</Text>
        </View>
        <View style={{ backgroundColor: "#10B98120", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
          <Text style={{ fontSize: 12, fontWeight: "800", color: "#059669" }}>Conversión: {bp.conversion_rate}%</Text>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        {stages.map(st => {
          const data = bp.stages[st.key] || { count: 0, amount: 0 };
          const widthPct = (data.count / maxCount) * 100;
          return (
            <TouchableOpacity key={st.key} onPress={() => router.push("/presupuestos")} style={{ paddingVertical: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Ionicons name={st.icon as any} size={14} color={st.color} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.text, flex: 1 }}>{st.label}</Text>
                <Text style={{ fontSize: 12, fontWeight: "800", color: COLORS.text }}>{data.count}</Text>
                <Text style={{ fontSize: 11, color: COLORS.textSecondary, minWidth: 60, textAlign: "right" }}>{formatEur(data.amount)}</Text>
              </View>
              <View style={{ height: 8, backgroundColor: COLORS.borderInput, borderRadius: 4, overflow: "hidden" }}>
                <View style={{ height: 8, width: `${Math.max(widthPct, 2)}%`, backgroundColor: st.color, borderRadius: 4 }} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.borderInput }}>
        <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>Total presupuestos: <Text style={{ fontWeight: "800", color: COLORS.text }}>{bp.total_count}</Text></Text>
        <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>Importe total: <Text style={{ fontWeight: "800", color: COLORS.text }}>{formatEur(bp.total_amount)}</Text></Text>
      </View>
    </View>
  );
}

function SatHealth({ dash, router }: { dash: any; router: any }) {
  const s = useThemedStyles(useS);
  const h = dash?.sat_health;
  if (!h || h.total_resolved === 0) return null;
  const heatmap: any[] = h.heatmap || [];

  // Mini visual: bounding box ES + dots
  const minLat = 36.0, maxLat = 44.0, minLng = -9.5, maxLng = 3.5;
  const w = 260, hgt = 130;
  const dots = heatmap.slice(0, 200).map((p) => {
    const x = ((p.lng - minLng) / (maxLng - minLng)) * w;
    const y = hgt - ((p.lat - minLat) / (maxLat - minLat)) * hgt;
    const color = p.priority === "urgente" ? "#DC2626" : p.priority === "alta" ? "#F97316" : "#3B82F6";
    return { x, y, color };
  });

  return (
    <View style={s.cardWrap}>
      <View style={s.cardHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="heart-circle-outline" size={18} color="#DC2626" />
          <Text style={s.cardTitle}>SAT — Salud del servicio</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <View style={{ flex: 1, minWidth: 130, backgroundColor: "#FEF2F2", padding: 10, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: "#DC2626" }}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: COLORS.textSecondary }}>RESOLUCIÓN MEDIA</Text>
          <Text style={{ fontSize: 20, fontWeight: "900", color: COLORS.text, marginTop: 2 }}>{h.avg_resolution_hours}h</Text>
          <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>tiempo medio</Text>
        </View>
        <View style={{ flex: 1, minWidth: 130, backgroundColor: "#F0FDF4", padding: 10, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: "#10B981" }}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: COLORS.textSecondary }}>RESUELTAS 1ª VISITA</Text>
          <Text style={{ fontSize: 20, fontWeight: "900", color: COLORS.text, marginTop: 2 }}>{h.first_visit_rate}%</Text>
          <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>de {h.total_resolved} resueltas</Text>
        </View>
      </View>
      {/* Top clientes */}
      {h.top_clients && h.top_clients.length > 0 && (
        <View style={{ marginTop: 12, gap: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 4 }}>Top 5 clientes por incidencias</Text>
          {h.top_clients.map((c: any, i: number) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 3 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: COLORS.textSecondary, width: 18 }}>{i + 1}.</Text>
              <Text style={{ flex: 1, fontSize: 12, color: COLORS.text }} numberOfLines={1}>{c.name}</Text>
              <View style={{ backgroundColor: "#FEF2F2", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#DC2626" }}>{c.count}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
      {/* Mini heatmap visual */}
      {dots.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 6 }}>Mapa de calor (incidencias)</Text>
          <View style={{ width: w, height: hgt, backgroundColor: "#F3F4F6", borderRadius: 8, position: "relative", alignSelf: "center" }}>
            <Svg width={w} height={hgt}>
              {dots.map((d, i) => (
                <Circle key={i} cx={d.x} cy={d.y} r={3} fill={d.color} opacity={0.55} />
              ))}
            </Svg>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#DC2626" }} />
              <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>Urgente</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#F97316" }} />
              <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>Alta</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#3B82F6" }} />
              <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>Media/Baja</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function MiniMap({ dash, router }: { dash: any; router: any }) {
  const s = useThemedStyles(useS);
  const pts: any[] = dash?.active_projects_map || [];
  if (!pts.length) return null;

  // Mini map de España con dots
  const minLat = 36.0, maxLat = 44.0, minLng = -9.5, maxLng = 3.5;
  const w = 320, hgt = 170;
  const statusColor: Record<string, string> = {
    pendiente: "#F59E0B",
    planificado: "#3B82F6",
    a_facturar: "#8B5CF6",
  };

  return (
    <TouchableOpacity onPress={() => router.push("/mapa")} style={s.cardWrap} activeOpacity={0.85}>
      <View style={s.cardHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="map-outline" size={18} color={COLORS.primary} />
          <Text style={s.cardTitle}>Proyectos activos en mapa</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: "800", color: COLORS.textSecondary }}>{pts.length}</Text>
          <Ionicons name="arrow-forward" size={14} color={COLORS.primary} />
        </View>
      </View>
      <View style={{ width: "100%", height: hgt, backgroundColor: "#EFF6FF", borderRadius: 10, alignItems: "center", justifyContent: "center" }}>
        <Svg width={w} height={hgt}>
          {pts.map((p, i) => {
            const x = ((p.lng - minLng) / (maxLng - minLng)) * w;
            const y = hgt - ((p.lat - minLat) / (maxLat - minLat)) * hgt;
            const color = statusColor[p.project_status] || "#9CA3AF";
            return <Circle key={i} cx={x} cy={y} r={4} fill={color} opacity={0.75} />;
          })}
        </Svg>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 8 }}>
        {Object.entries(statusColor).map(([k, c]) => (
          <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
            <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>{k.replace("_", " ")}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

function YoYComparison({ dash }: { dash: any }) {
  const s = useThemedStyles(useS);
  const y = dash?.yoy_comparison;
  if (!y) return null;
  const max = Math.max(...(y.quarters_this || []), ...(y.quarters_last || []), 1);
  const growthColor = y.growth_pct >= 0 ? "#10B981" : "#EF4444";
  const growthIcon = y.growth_pct >= 0 ? "trending-up" : "trending-down";

  return (
    <View style={s.cardWrap}>
      <View style={s.cardHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="stats-chart-outline" size={18} color={COLORS.primary} />
          <Text style={s.cardTitle}>Comparativa año vs año</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: `${growthColor}20`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
          <Ionicons name={growthIcon} size={12} color={growthColor} />
          <Text style={{ fontSize: 12, fontWeight: "800", color: growthColor }}>{y.growth_pct > 0 ? "+" : ""}{y.growth_pct}%</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
        <View style={{ flex: 1, backgroundColor: "#EFF6FF", padding: 10, borderRadius: 8 }}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: COLORS.textSecondary }}>{y.this_year}</Text>
          <Text style={{ fontSize: 22, fontWeight: "900", color: COLORS.primary, marginTop: 2 }}>{y.closed_this_year}</Text>
          <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>proyectos cerrados</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: "#F3F4F6", padding: 10, borderRadius: 8 }}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: COLORS.textSecondary }}>{y.last_year}</Text>
          <Text style={{ fontSize: 22, fontWeight: "900", color: COLORS.textSecondary, marginTop: 2 }}>{y.closed_last_year}</Text>
          <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>proyectos cerrados</Text>
        </View>
      </View>
      {/* Quarter bars */}
      <View style={{ gap: 8 }}>
        {["Q1", "Q2", "Q3", "Q4"].map((q, i) => {
          const cur = y.quarters_this?.[i] || 0;
          const prev = y.quarters_last?.[i] || 0;
          return (
            <View key={i}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: COLORS.textSecondary, width: 24 }}>{q}</Text>
                <View style={{ flex: 1, height: 8, backgroundColor: COLORS.borderInput, borderRadius: 4, overflow: "hidden" }}>
                  <View style={{ height: 8, width: `${(cur / max) * 100}%`, backgroundColor: COLORS.primary, borderRadius: 4 }} />
                </View>
                <Text style={{ fontSize: 10, fontWeight: "800", color: COLORS.primary, width: 28, textAlign: "right" }}>{cur}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 24 }} />
                <View style={{ flex: 1, height: 5, backgroundColor: COLORS.borderInput, borderRadius: 3, overflow: "hidden" }}>
                  <View style={{ height: 5, width: `${(prev / max) * 100}%`, backgroundColor: "#9CA3AF", borderRadius: 3 }} />
                </View>
                <Text style={{ fontSize: 10, fontWeight: "700", color: COLORS.textSecondary, width: 28, textAlign: "right" }}>{prev}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function GeoDistribution({ dash, router }: { dash: any; router: any }) {
  const s = useThemedStyles(useS);
  const g = dash?.geo_distribution;
  if (!g) return null;
  const maxCity = Math.max(...((g.top_cities || []).map((c: any) => c.count)), 1);
  const maxProv = Math.max(...((g.by_province || []).map((p: any) => p.amount)), 1);

  return (
    <View style={s.cardWrap}>
      <View style={s.cardHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="location-outline" size={18} color={COLORS.primary} />
          <Text style={s.cardTitle}>Distribución geográfica</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 16, flexWrap: "wrap" }}>
        {/* Top ciudades */}
        <View style={{ flex: 1, minWidth: 240 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 8 }}>Top ciudades (activos)</Text>
          {(g.top_cities || []).slice(0, 5).map((c: any, i: number) => (
            <TouchableOpacity key={i} onPress={() => router.push(`/materiales?q=${encodeURIComponent(c.city)}` as any)} style={{ paddingVertical: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: COLORS.text, flex: 1 }} numberOfLines={1}>{c.city}</Text>
                <Text style={{ fontSize: 12, fontWeight: "800", color: COLORS.primary }}>{c.count}</Text>
              </View>
              <View style={{ height: 5, backgroundColor: COLORS.borderInput, borderRadius: 3, overflow: "hidden" }}>
                <View style={{ height: 5, width: `${(c.count / maxCity) * 100}%`, backgroundColor: COLORS.primary, borderRadius: 3 }} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
        {/* Por provincia */}
        <View style={{ flex: 1, minWidth: 240 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 8 }}>Facturación por provincia</Text>
          {(g.by_province || []).slice(0, 5).map((p: any, i: number) => {
            const colors = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];
            const c = colors[i % colors.length];
            return (
              <View key={i} style={{ paddingVertical: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: COLORS.text, flex: 1 }} numberOfLines={1}>{p.province}</Text>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: COLORS.textSecondary }}>{p.pct}%</Text>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: COLORS.text, minWidth: 60, textAlign: "right" }}>{formatEur(p.amount)}</Text>
                </View>
                <View style={{ height: 5, backgroundColor: COLORS.borderInput, borderRadius: 3, overflow: "hidden", marginLeft: 14 }}>
                  <View style={{ height: 5, width: `${(p.amount / maxProv) * 100}%`, backgroundColor: c, borderRadius: 3 }} />
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}



// ============================================================================
// TechAvailability3W — Disponibilidad de técnicos en las próximas 3 semanas
// ============================================================================
const DAY_LETTERS = ["L", "M", "X", "J", "V"]; // lun..vie
function shortDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()}`;
}
function fmtDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const dia = d.getDate().toString().padStart(2, "0");
  const mes = (d.getMonth() + 1).toString().padStart(2, "0");
  return `${dia}/${mes}`;
}

function TechAvailability3W({ dash, router }: { dash: any; router: any }) {
  const s = useThemedStyles(useS);
  const { isWide } = useBreakpoint();
  const t3 = dash?.tech_three_weeks;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // En mobile mostramos 1 semana a la vez; en desktop todas
  const [visibleWeek, setVisibleWeek] = useState<number>(0);
  if (!t3 || !t3.technicians || t3.technicians.length === 0) return null;

  const techs: any[] = t3.technicians;
  // Días agrupados por semanas de 5 (lun-vie)
  const groupByWeeks = (days: any[]) => {
    const weeks: any[][] = [];
    for (let i = 0; i < days.length; i += 5) {
      weeks.push(days.slice(i, i + 5));
    }
    return weeks;
  };

  const totalWeeks = Math.ceil((techs[0]?.days?.length || 0) / 5);
  const weekLabels = (t3.weeks_meta || []).map((w: any) => w.label);
  // En mobile: solo una semana (visibleWeek). En desktop: todas
  const visibleWeekIndices = isWide
    ? Array.from({ length: totalWeeks }, (_, i) => i)
    : [visibleWeek];

  return (
    <View style={s.cardWrap}>
      <View style={s.cardHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          <Ionicons name="calendar-clear-outline" size={18} color={COLORS.primary} />
          <Text style={s.cardTitle}>Planificación mensual</Text>
        </View>
        <Text style={{ fontSize: 11, color: COLORS.textSecondary }}>
          {t3.from?.slice(8, 10)}/{t3.from?.slice(5, 7)} – {t3.to?.slice(8, 10)}/{t3.to?.slice(5, 7)}
        </Text>
      </View>

      {/* Selector de semana (solo mobile) */}
      {!isWide && (
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {weekLabels.map((lbl: string, i: number) => {
            const active = visibleWeek === i;
            return (
              <TouchableOpacity
                key={i}
                onPress={() => setVisibleWeek(i)}
                style={{
                  flex: 1,
                  minWidth: 70,
                  paddingVertical: 6,
                  paddingHorizontal: 8,
                  borderRadius: 8,
                  backgroundColor: active ? COLORS.primary : COLORS.primarySoft || "#F0F9FF",
                  borderWidth: 1,
                  borderColor: active ? COLORS.primary : COLORS.borderInput,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "800", color: active ? "#fff" : COLORS.primary }}>{lbl}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Leyenda */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: "#D1FAE5", borderWidth: 1, borderColor: "#10B981" }} />
          <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>Libre</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: "#FEE2E2", borderWidth: 1, borderColor: "#EF4444" }} />
          <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>Ocupado</Text>
        </View>
      </View>

      {/* Cabecera con los días de cada semana visible */}
      <View style={{ flexDirection: "row", marginBottom: 6, alignItems: "center" }}>
        <View style={{ width: isWide ? 110 : 88 }} />
        {visibleWeekIndices.map((wi: number) => {
          const week = groupByWeeks(techs[0]?.days || [])[wi] || [];
          return (
            <View key={wi} style={{ flex: 1, alignItems: "center", marginHorizontal: 2 }}>
              {isWide && (
                <Text style={{ fontSize: 9, fontWeight: "800", color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 2 }}>
                  {weekLabels[wi] || `S${wi + 1}`}
                </Text>
              )}
              <View style={{ flexDirection: "row", gap: 2 }}>
                {week.map((d, i) => (
                  <View key={i} style={{ width: isWide ? 22 : 32, alignItems: "center" }}>
                    <Text style={{ fontSize: 9, fontWeight: "700", color: COLORS.textSecondary }}>{DAY_LETTERS[i]}</Text>
                    <Text style={{ fontSize: 9, color: COLORS.textSecondary }}>{shortDay(d.date)}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>

      {/* Filas por técnico */}
      {techs.map((tech, i) => {
        const isOpen = expandedId === tech.id;
        const pct = Math.round((tech.free_days / tech.total_days) * 100);
        const ringColor = pct >= 60 ? "#10B981" : pct >= 30 ? "#F59E0B" : "#EF4444";
        const techWeeks = groupByWeeks(tech.days);
        return (
          <View key={tech.id} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: COLORS.borderInput, paddingVertical: 6 }}>
            <TouchableOpacity
              onPress={() => setExpandedId(isOpen ? null : tech.id)}
              activeOpacity={0.7}
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: tech.color, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#fff" }}>{tech.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ width: isWide ? 80 : 58 }}>
                <Text style={{ fontSize: isWide ? 12 : 11, fontWeight: "700", color: COLORS.text }} numberOfLines={1}>{tech.name}</Text>
                <Text style={{ fontSize: 10, color: ringColor, fontWeight: "800" }}>{tech.free_days}/{tech.total_days}</Text>
              </View>
              {/* Cuadrícula: semanas visibles */}
              {visibleWeekIndices.map((wi: number) => (
                <View key={wi} style={{ flex: 1, flexDirection: "row", justifyContent: "center", gap: 2, marginHorizontal: 2 }}>
                  {(techWeeks[wi] || []).map((d, di) => (
                    <View
                      key={di}
                      style={{
                        width: isWide ? 20 : 30, height: isWide ? 18 : 26, borderRadius: 4,
                        backgroundColor: d.free ? "#D1FAE5" : "#FEE2E2",
                        borderWidth: 1,
                        borderColor: d.free ? "#10B981" : "#EF4444",
                        alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {!d.free && <Ionicons name="close" size={isWide ? 11 : 14} color="#EF4444" />}
                      {d.free && <Ionicons name="checkmark" size={isWide ? 11 : 14} color="#10B981" />}
                    </View>
                  ))}
                </View>
              ))}
              <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>

            {/* Detalle desplegable */}
            {isOpen && (
              <View style={{ marginTop: 8, marginLeft: 30, padding: 10, backgroundColor: COLORS.primarySoft || "#F0F9FF", borderRadius: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: COLORS.textSecondary, textTransform: "uppercase", marginBottom: 6 }}>
                  Días libres del mes ({tech.free_days})
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {tech.days.filter((d: any) => d.free).map((d: any, k: number) => (
                    <TouchableOpacity
                      key={k}
                      onPress={() => router.push(`/calendario?date=${d.date}` as any)}
                      style={{
                        backgroundColor: "#D1FAE5",
                        borderWidth: 1, borderColor: "#10B981",
                        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
                        flexDirection: "row", alignItems: "center", gap: 4,
                      }}
                    >
                      <Ionicons name="calendar-outline" size={11} color="#065F46" />
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#065F46" }}>{DAY_LETTERS[d.weekday]} {fmtDayLabel(d.date)}</Text>
                    </TouchableOpacity>
                  ))}
                  {tech.free_days === 0 && (
                    <Text style={{ fontSize: 12, color: COLORS.textSecondary, fontStyle: "italic" }}>
                      Sin días libres en este rango
                    </Text>
                  )}
                </View>
                {tech.free_days > 0 && (
                  <Text style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 6, fontStyle: "italic" }}>
                    Toca un día para ir al calendario
                  </Text>
                )}
              </View>
            )}
          </View>
        );
      })}

      {/* Barra de navegación inferior (solo mobile) */}
      {!isWide && totalWeeks > 1 && (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.borderInput }}>
          <TouchableOpacity
            onPress={() => setVisibleWeek(Math.max(0, visibleWeek - 1))}
            disabled={visibleWeek === 0}
            style={{
              flexDirection: "row", alignItems: "center", gap: 4,
              paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8,
              backgroundColor: visibleWeek === 0 ? COLORS.borderInput : COLORS.primary,
              opacity: visibleWeek === 0 ? 0.5 : 1,
            }}
          >
            <Ionicons name="chevron-back" size={14} color="#fff" />
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>Anterior</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 12, fontWeight: "800", color: COLORS.text }}>
            {weekLabels[visibleWeek] || ""}
          </Text>
          <TouchableOpacity
            onPress={() => setVisibleWeek(Math.min(totalWeeks - 1, visibleWeek + 1))}
            disabled={visibleWeek === totalWeeks - 1}
            style={{
              flexDirection: "row", alignItems: "center", gap: 4,
              paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8,
              backgroundColor: visibleWeek === totalWeeks - 1 ? COLORS.borderInput : COLORS.primary,
              opacity: visibleWeek === totalWeeks - 1 ? 0.5 : 1,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>Siguiente</Text>
            <Ionicons name="chevron-forward" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
