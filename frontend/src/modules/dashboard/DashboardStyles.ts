import { Platform, StyleSheet } from "react-native";
import { COLORS } from "../../api";
import { ios } from "../../ui/iosTheme";

export const useS = () =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: "center", justifyContent: "center",
    ...ios.shadow.card,
  },
  deskTopRight: { position: "absolute", top: 24, right: 32, zIndex: 10 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  skeleton: {
    backgroundColor: COLORS.border,
    borderRadius: 8,
    opacity: 0.5,
  },

  scroll: { padding: 16, paddingBottom: 32 },
  scrollWide: { padding: 24, paddingBottom: 80, maxWidth: 1100, alignSelf: "center", width: "100%" },

  hero: { paddingHorizontal: 4 },
  heroBg: {
    marginBottom: 24,
    borderRadius: 20,
    padding: 20,
    ...Platform.select({
      web: { backgroundImage: `linear-gradient(180deg, rgba(59,130,246,0.08) 0%, rgba(10,14,26,0) 100%)` } as any,
      default: { backgroundColor: COLORS.primarySoft },
    }),
  },
  heroGreet: {
    fontSize: 15,
    color: COLORS.textDisabled,
    fontWeight: '600',
  },
  heroName: {
    fontSize: 36, fontWeight: '700', color: COLORS.text,
    letterSpacing: -0.5, marginTop: 4,
  },
  heroDate: {
    fontSize: 15, color: COLORS.textSecondary, fontWeight: '400',
    marginTop: 8,
  },

  sectionTitle: {
    fontSize: 15, color: COLORS.textSecondary,
    fontWeight: "600",
    marginBottom: 8, marginLeft: 16,
  },

  tilesGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 8,
    justifyContent: "flex-start",
  },
  tilesGridWide: { gap: 18 },
  tile: {
    flexBasis: "31.5%", maxWidth: "31.5%",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 8,
    alignItems: "center", justifyContent: "center",
    minHeight: 96,
    borderWidth: 1, borderColor: COLORS.border,
    ...ios.shadow.card,
  },
  tileWide: {
    flexBasis: "calc(33.333% - 12px)",
    maxWidth: "calc(33.333% - 12px)",
    paddingVertical: 24,
    minHeight: 170,
  },
  tileIcon: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    marginBottom: 8,
  },
  tileIconWide: {
    width: 48, height: 48, borderRadius: 14,
    marginBottom: 12,
  },
  tileTitle: {
    fontSize: 13, fontWeight: '600', color: COLORS.text,
    letterSpacing: -0.1, textAlign: "center",
  },
  tileTitleWide: {
    fontSize: 15,
    letterSpacing: -0.2,
  },
  dashRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dashCard: {
    flex: 1, minWidth: 90, padding: 8, borderRadius: 8,
    alignItems: "center", gap: 4, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
  },
  dashVal: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  dashLbl: { fontSize: 10, color: COLORS.textSecondary, fontWeight: "600", textAlign: "center" },
  sectionSub: {
    fontSize: 11, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4,
  },
  hourRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  hourName: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  hourVal: { fontSize: 13, fontWeight: "800", color: COLORS.text, minWidth: 45, textAlign: "right" },
  hourCount: { fontSize: 12, color: COLORS.textSecondary, minWidth: 35 },
  hourBar: { height: 10, backgroundColor: COLORS.borderInput, borderRadius: 8, overflow: "hidden" },
  hourFill: { height: 10, borderRadius: 8 },

  dashStripRow: { flexDirection: "row", gap: 8, paddingHorizontal: 4 },
  dashMiniCard: {
    flex: 1, padding: 14, borderRadius: 8,
    backgroundColor: COLORS.surface, alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  dashMiniIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  dashMiniVal: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  dashMiniLbl: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary, textAlign: "center" },

  statusBarWrap: { paddingHorizontal: 4 },
  statusBar: { height: 12, borderRadius: 8, flexDirection: "row", overflow: "hidden", marginBottom: 10 },
  statusBarSegment: { height: 12, minWidth: 1 },
  statusLegend: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 4 },
  statusLegendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  statusLegendDot: { width: 8, height: 8, borderRadius: 4 },
  statusLegendText: { fontSize: 12, fontWeight: '400', color: COLORS.textSecondary },
  statusLegendCount: { fontSize: 12, fontWeight: "700", color: COLORS.text },

  overHoursBubble: {
    minWidth: 24, height: 24, borderRadius: 20,
    backgroundColor: COLORS.errorBg,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 8,
  },
  overHoursBubbleText: { fontSize: 12, fontWeight: "800", color: COLORS.errorText },
  overHoursRow: { gap: 8, paddingHorizontal: 4 },
  overHoursItem: { backgroundColor: COLORS.surface, borderRadius: 8, padding: 12 },

  monthScroll: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 8 },
  monthMiniCard: {
    width: 68, padding: 10, borderRadius: 8,
    backgroundColor: COLORS.surface, alignItems: "center", gap: 4,
    borderWidth: 2, borderColor: "transparent",
    ...ios.shadow.card,
  },
  monthMiniCurrent: { borderColor: COLORS.primary },
  monthMiniMonth: { fontSize: 9, fontWeight: "700", color: COLORS.textSecondary, textTransform: "uppercase" },
  monthMiniCount: { fontSize: 22, fontWeight: "900", color: COLORS.text },
  monthMiniHours: { fontSize: 9, fontWeight: "500", color: COLORS.textDisabled },

  cardWrap: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...ios.shadow.card,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  cardSubtitle: {
    fontSize: 12,
    color: COLORS.textDisabled,
    marginTop: 4,
  },
  kpiStrip: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...ios.shadow.card,
  },
  kpiIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  kpiValue: {
    fontSize: 30,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  donutContainer: {
    alignItems: "center",
    flexDirection: "row",
    gap: 20,
  },
  donutLegend: {
    flex: 1,
    gap: 8,
  },
  donutLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  donutLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 4,
  },
  donutLegendText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
    flex: 1,
  },
  donutLegendCount: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.text,
  },
  circularProgressWrap: {
    alignItems: "center",
    marginBottom: 16,
  },
} as Record<string, any>);
