/**
 * IOSHeader — iOS-style large title header.
 *
 * On mobile shows the title big at the top (à la iOS). The right slot is
 * for the notifications bell / actions. Optional subtitle.
 *
 * Pass `showBack` to render an iOS chevron-style back button on the left.
 */
import React from "react";
import { View, Text, StyleSheet, Platform, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ios } from "./iosTheme";
import { useThemedStyles } from "../theme";
import { COLORS } from "../api";

export default function IOSHeader({
  title,
  subtitle,
  rightSlot,
  leftSlot,
  compact,
  showBack,
  backLabel,
  onBack,
}: {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  leftSlot?: React.ReactNode;
  /** When true renders a slim navigation-bar style (no large title). */
  compact?: boolean;
  /** Show iOS-style back button at the left. */
  showBack?: boolean;
  /** Optional label next to the back chevron (defaults to "Atrás"). */
  backLabel?: string;
  /** Custom back handler (defaults to router.back()). */
  onBack?: () => void;
}) {
  const s = useThemedStyles(useS);
  const router = useRouter();
  const handleBack = () => {
    if (onBack) return onBack();
    try {
      // @ts-ignore
      if (router.canGoBack && router.canGoBack()) {
        router.back();
      } else {
        router.replace("/" as any);
      }
    } catch {
      router.replace("/" as any);
    }
  };
  const BackBtn = (
    <TouchableOpacity
      onPress={handleBack}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={{ flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: 4, paddingRight: 8 }}
      accessibilityLabel="Atrás"
    >
      <Ionicons name="chevron-back" size={26} color={COLORS.primary} />
      <Text style={{ fontSize: 16, color: COLORS.primary, fontWeight: "500", letterSpacing: -0.2 }} numberOfLines={1}>
        {backLabel || "Atrás"}
      </Text>
    </TouchableOpacity>
  );
  const renderedLeft = leftSlot ?? (showBack ? BackBtn : null);

  if (compact) {
    return (
      <View style={s.barRow}>
        <View style={{ minWidth: 40, flexDirection: "row", alignItems: "center" }}>{renderedLeft}</View>
        <Text style={s.barTitle} numberOfLines={1}>{title}</Text>
        <View style={{ minWidth: 40, alignItems: "flex-end" }}>{rightSlot}</View>
      </View>
    );
  }
  return (
    <View style={s.wrap}>
      <View style={s.topRow}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>{renderedLeft}</View>
        <View>{rightSlot}</View>
      </View>
      <Text style={s.title} numberOfLines={1}>{title}</Text>
      {!!subtitle && <Text style={s.subtitle} numberOfLines={2}>{subtitle}</Text>}
    </View>
  );
}

const useS = () => StyleSheet.create({
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
