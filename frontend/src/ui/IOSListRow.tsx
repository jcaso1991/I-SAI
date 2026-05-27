import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ios } from "./iosTheme";
import { COLORS } from "../api";
import { useThemedStyles } from "../theme";

export default function IOSListRow({
  title,
  subtitle,
  icon,
  iconColor = ios.colors.brand,
  iconBg,
  rightLabel,
  rightSlot,
  onPress,
  destructive,
  showChevron,
  testID,
  _isFirst,
  _isLast,
  _showSeparator,
}: {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  rightLabel?: string;
  rightSlot?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  showChevron?: boolean;
  testID?: string;
  _isFirst?: boolean;
  _isLast?: boolean;
  _showSeparator?: boolean;
}) {
  const s = useThemedStyles(useS);
  const tappable = !!onPress;
  const wantChevron = showChevron ?? (tappable && !rightSlot);
  const titleColor = destructive ? COLORS.errorText : COLORS.text;

  const Inner = (
    <View style={s.row}>
      {icon && (
        <View style={[s.iconBox, { backgroundColor: iconBg || iconColor + "18" }]}>
          <Ionicons name={icon} size={18} color={iconBg ? "#fff" : iconColor} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[s.title, { color: titleColor }]} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={s.subtitle} numberOfLines={2}>{subtitle}</Text>}
      </View>
      {!!rightLabel && (
        <Text style={s.rightLabel} numberOfLines={1}>{rightLabel}</Text>
      )}
      {rightSlot}
      {wantChevron && (
        <Ionicons name="chevron-forward" size={16} color={COLORS.textDisabled} style={{ marginLeft: 4, opacity: 0.6 }} />
      )}
    </View>
  );

  return (
    <View>
      {tappable ? (
        <Pressable
          testID={testID}
          onPress={onPress}
          android_ripple={{ color: "rgba(0,0,0,0.04)" }}
          style={({ pressed }) => [
            pressed && { backgroundColor: COLORS.border },
          ]}
        >
          {Inner}
        </Pressable>
      ) : (
        Inner
      )}
      {_showSeparator && (
        <View style={s.separator} />
      )}
    </View>
  );
}

const useS = () => StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: ios.spacing.rowH,
    paddingVertical: ios.spacing.rowV,
    minHeight: 48,
    backgroundColor: COLORS.surface,
    gap: 14,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: ios.radius.icon,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: ios.font.family,
    fontSize: ios.font.body.size,
    fontWeight: "500",
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: ios.font.family,
    fontSize: ios.font.subhead.size,
    color: COLORS.textSecondary,
    marginTop: 3,
    fontWeight: "400",
  },
  rightLabel: {
    fontFamily: ios.font.family,
    fontSize: ios.font.callout.size,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  separator: {
    height: ios.hairline,
    backgroundColor: COLORS.border,
    marginLeft: 60,
  },
});
