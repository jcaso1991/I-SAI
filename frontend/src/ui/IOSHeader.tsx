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
  compact?: boolean;
  showBack?: boolean;
  backLabel?: string;
  onBack?: () => void;
}) {
  const s = useThemedStyles(useS);
  const router = useRouter();
  const handleBack = () => {
    if (onBack) return onBack();
    try {
      if ((router as any).canGoBack?.()) {
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
      <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
      <Text style={{ fontSize: 15, color: COLORS.primary, fontWeight: "500", letterSpacing: -0.2 }} numberOfLines={1}>
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
      <View style={s.separator} />
    </View>
  );
}

const useS = () => StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.bg,
    paddingTop: Platform.select({ ios: 6, default: 12 }) as number,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  topRow: { minHeight: 32, flexDirection: "row", alignItems: "center" },
  title: {
    fontFamily: ios.font.family,
    fontSize: ios.font.title1.size,
    fontWeight: ios.font.title1.weight,
    color: COLORS.text,
    letterSpacing: ios.font.title1.letter,
    marginTop: 6,
  },
  subtitle: {
    fontFamily: ios.font.family,
    fontSize: ios.font.subhead.size,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontWeight: "400",
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginTop: 12,
    marginHorizontal: -20,
    opacity: 0.5,
  },
  barRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: ios.hairline,
    borderBottomColor: COLORS.border,
  },
  barTitle: {
    flex: 1, textAlign: "center",
    fontFamily: ios.font.family,
    fontSize: 16, fontWeight: "600", color: COLORS.text,
    letterSpacing: -0.3,
  },
});
