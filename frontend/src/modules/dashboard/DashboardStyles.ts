import { StyleSheet } from "react-native";
import { COLORS } from "../../api";
import { ios } from "../../ui/iosTheme";

export const useS = () =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 } as any, elevation: 1,
  },
  deskTopRight: { position: "absolute", top: 24, right: 32, zIndex: 10 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  scroll: { padding: 16, paddingBottom: 40 },
  scrollWide: { padding: 48, paddingBottom: 80, maxWidth: 1100, alignSelf: "center", width: "100%" },

  hero: { marginBottom: 32, paddingHorizontal: 4 },
  heroGreet: {
    fontFamily: ios.font.family,
    fontSize: 17, color: COLORS.textSecondary, fontWeight: "500",
  },
  heroName: {
    fontFamily: ios.font.family,
    fontSize: 38, fontWeight: "700", color: COLORS.text,
    letterSpacing: -0.8, marginTop: 4,
  },
  heroDate: {
    fontFamily: ios.font.family,
    fontSize: 15, color: COLORS.textSecondary, fontWeight: "500",
    marginTop: 6,
  },

  sectionTitle: {
    fontFamily: ios.font.family,
    fontSize: 13, color: COLORS.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5,
    marginBottom: 8, marginLeft: 16,
  },

  tilesGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 12,
    justifyContent: "flex-start",
  },
  tilesGridWide: { gap: 18 },
  tile: {
    flexBasis: "48%", maxWidth: "48%",
    backgroundColor: COLORS.surface,
    borderRadius: ios.radius.card,
    paddingVertical: 22, paddingHorizontal: 16,
    alignItems: "center", justifyContent: "center",
    minHeight: 140,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 } as any, elevation: 1,
  },
  tileWide: {
    flexBasis: "calc(33.333% - 12px)",
    maxWidth: "calc(33.333% - 12px)",
    paddingVertical: 32,
    minHeight: 170,
  },
  tileIcon: {
    width: 56, height: 56, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    marginBottom: 12,
  },
  tileTitle: {
    fontFamily: ios.font.family,
    fontSize: 15, fontWeight: "600", color: COLORS.text,
    letterSpacing: -0.2,
  },
  dashRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dashCard: {
    flex: 1, minWidth: 90, padding: 12, borderRadius: 10,
    alignItems: "center", gap: 2, backgroundColor: COLORS.surface,
  },
  dashVal: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  dashLbl: { fontSize: 10, color: COLORS.textSecondary, fontWeight: "600", textAlign: "center" },
  sectionSub: {
    fontSize: 12, fontWeight: "800", color: COLORS.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4,
  },
  hourRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  hourName: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  hourVal: { fontSize: 13, fontWeight: "800", color: COLORS.text, minWidth: 45, textAlign: "right" },
  hourCount: { fontSize: 11, color: COLORS.textSecondary, minWidth: 35 },
  hourBar: { height: 10, backgroundColor: COLORS.borderInput, borderRadius: 5, overflow: "hidden" },
  hourFill: { height: 10, borderRadius: 5 },

  // ── TodayRow: strip de 3 mini-tarjetas ──
  dashStripRow: { flexDirection: "row", gap: 8, paddingHorizontal: 4 },
  dashMiniCard: {
    flex: 1, padding: 14, borderRadius: 12,
    backgroundColor: COLORS.surface, alignItems: "center", gap: 6,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 } as any, elevation: 2,
  },
  dashMiniIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  dashMiniVal: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  dashMiniLbl: { fontSize: 10, fontWeight: "600", color: COLORS.textSecondary, textAlign: "center" },

  // ── ProjectsByStatus: barra apilada ──
  statusBarWrap: { paddingHorizontal: 4 },
  statusBar: { height: 12, borderRadius: 6, flexDirection: "row", overflow: "hidden", marginBottom: 10 },
  statusBarSegment: { height: 12, minWidth: 1 },
  statusLegend: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 4 },
  statusLegendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  statusLegendDot: { width: 8, height: 8, borderRadius: 4 },
  statusLegendText: { fontSize: 11, fontWeight: "500", color: COLORS.textSecondary },
  statusLegendCount: { fontSize: 11, fontWeight: "700", color: COLORS.text },

  // ── ProjectsOverHours ──
  overHoursBubble: {
    minWidth: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.errorBg,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 6,
  },
  overHoursBubbleText: { fontSize: 12, fontWeight: "800", color: COLORS.errorText },
  overHoursRow: { gap: 8, paddingHorizontal: 4 },
  overHoursItem: { backgroundColor: COLORS.surface, borderRadius: 10, padding: 12 },

  // ── ProjectsByMonth / SatByMonth: mini-tarjetas horizontales ──
  monthScroll: { flexDirection: "row", gap: 8, paddingHorizontal: 8 },
  monthMiniCard: {
    width: 68, padding: 10, borderRadius: 10,
    backgroundColor: COLORS.surface, alignItems: "center", gap: 4,
    borderWidth: 2, borderColor: "transparent",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 } as any, elevation: 1,
  },
  monthMiniCurrent: { borderColor: COLORS.primary },
  monthMiniMonth: { fontSize: 9, fontWeight: "700", color: COLORS.textSecondary, textTransform: "uppercase" },
  monthMiniCount: { fontSize: 22, fontWeight: "900", color: COLORS.text },
  monthMiniHours: { fontSize: 9, fontWeight: "500", color: COLORS.textDisabled },
} as Record<string, any>);
