import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, G } from "react-native-svg";
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
      <TodayRow dash={dash} router={router} />
      <View style={{ flexDirection: "row", gap: 16 }}>
        <View style={{ flex: 1 }}><ProjectsByStatus dash={dash} router={router} /></View>
        <View style={{ flex: 1 }}><GlobalHours dash={dash} /></View>
      </View>
      <ProjectsOverHours dash={dash} router={router} />
      <ManagerHours dash={dash} />
      <BudgetsKPI />
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
