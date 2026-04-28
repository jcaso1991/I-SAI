/**
 * IOSListRow — Single row in an iOS settings-style list.
 *
 * Variants:
 *  - Tap → chevron right (default if onPress supplied)
 *  - Toggle / value text on the right (rightLabel or rightSlot)
 *  - Destructive action (red text) via destructive prop
 */
import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ios } from "./iosTheme";

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
  // Internally injected by IOSGroup:
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
  const tappable = !!onPress;
  const wantChevron = showChevron ?? (tappable && !rightSlot);
  const titleColor = destructive ? ios.colors.destructive : ios.colors.text;

  const Inner = (
    <View style={[styles.row]}>
      {icon && (
        <View
          style={[
            styles.iconBox,
            { backgroundColor: iconBg || iconColor },
          ]}
        >
          <Ionicons name={icon} size={18} color="#fff" />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>}
      </View>
      {!!rightLabel && (
        <Text style={styles.rightLabel} numberOfLines={1}>{rightLabel}</Text>
      )}
      {rightSlot}
      {wantChevron && (
        <Ionicons name="chevron-forward" size={18} color={ios.colors.textMuted} style={{ marginLeft: 6 }} />
      )}
    </View>
  );

  return (
    <View>
      {tappable ? (
        <Pressable
          testID={testID}
          onPress={onPress}
          android_ripple={{ color: "rgba(0,0,0,0.06)" }}
          style={({ pressed }) => [
            pressed && { backgroundColor: ios.colors.separatorOpaque },
          ]}
        >
          {Inner}
        </Pressable>
      ) : (
        Inner
      )}
      {_showSeparator && (
        <View style={styles.separator} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: ios.spacing.rowH,
    paddingVertical: ios.spacing.rowV,
    minHeight: 44,
    backgroundColor: ios.colors.surface,
    gap: 12,
  },
  iconBox: {
    width: 30, height: 30, borderRadius: ios.radius.icon,
    alignItems: "center", justifyContent: "center",
  },
  title: {
    fontFamily: ios.font.family,
    fontSize: ios.font.body.size,
    fontWeight: "400",
    color: ios.colors.text,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: ios.font.family,
    fontSize: ios.font.subhead.size,
    color: ios.colors.textSub,
    marginTop: 2,
  },
  rightLabel: {
    fontFamily: ios.font.family,
    fontSize: ios.font.body.size,
    color: ios.colors.textSub,
    fontWeight: "400",
  },
  separator: {
    height: ios.hairline,
    backgroundColor: ios.colors.separator,
    marginLeft: 60, // align under text, not icon (iOS pattern)
  },
});
