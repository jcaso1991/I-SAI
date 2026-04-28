/**
 * IOSHeader — iOS-style large title header.
 *
 * On mobile shows the title big at the top (à la iOS). The right slot is
 * for the notifications bell / actions. Optional subtitle.
 */
import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { ios } from "./iosTheme";
import { COLORS } from "../api";

export default function IOSHeader({
  title,
  subtitle,
  rightSlot,
  leftSlot,
  compact,
}: {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  leftSlot?: React.ReactNode;
  /** When true renders a slim navigation-bar style (no large title). */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <View style={s.barRow}>
        <View style={{ width: 40 }}>{leftSlot}</View>
        <Text style={s.barTitle} numberOfLines={1}>{title}</Text>
        <View style={{ width: 40, alignItems: "flex-end" }}>{rightSlot}</View>
      </View>
    );
  }
  return (
    <View style={s.wrap}>
      <View style={s.topRow}>
        <View style={{ flex: 1 }}>{leftSlot}</View>
        <View>{rightSlot}</View>
      </View>
      <Text style={s.title} numberOfLines={1}>{title}</Text>
      {!!subtitle && <Text style={s.subtitle} numberOfLines={2}>{subtitle}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.bg,
    paddingTop: Platform.select({ ios: 6, default: 10 }) as number,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  topRow: { minHeight: 32, flexDirection: "row", alignItems: "center" },
  title: {
    fontFamily: ios.font.family,
    fontSize: ios.font.largeTitle.size,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: ios.font.largeTitle.letter,
    marginTop: 4,
  },
  subtitle: {
    fontFamily: ios.font.family,
    fontSize: ios.font.subhead.size,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontWeight: "500",
  },
  // compact / nav-bar mode
  barRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: ios.hairline,
    borderBottomColor: COLORS.border,
  },
  barTitle: {
    flex: 1, textAlign: "center",
    fontFamily: ios.font.family,
    fontSize: 17, fontWeight: "600", color: COLORS.text,
    letterSpacing: -0.4,
  },
});
