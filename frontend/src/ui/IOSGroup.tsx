import React, { Children, isValidElement, cloneElement } from "react";
import { View, Text, StyleSheet } from "react-native";
import { ios } from "./iosTheme";
import { COLORS } from "../api";
import { useThemedStyles } from "../theme";

export default function IOSGroup({
  header,
  footer,
  children,
  inset = true,
}: {
  header?: string;
  footer?: string;
  children: React.ReactNode;
  inset?: boolean;
}) {
  const s = useThemedStyles(useS);

  const items = Children.toArray(children).filter(Boolean);
  const total = items.length;
  const enhanced = items.map((child, idx) => {
    if (!isValidElement(child)) return child;
    return cloneElement(child as any, {
      _isFirst: idx === 0,
      _isLast: idx === total - 1,
      _showSeparator: idx < total - 1,
    });
  });

  return (
    <View style={[s.wrap, inset && s.inset]}>
      {!!header && <Text style={s.header}>{header}</Text>}
      <View style={s.card}>{enhanced}</View>
      {!!footer && <Text style={s.footer}>{footer}</Text>}
    </View>
  );
}

const useS = () => StyleSheet.create({
  wrap: { marginBottom: ios.spacing.sectionGap },
  inset: { paddingHorizontal: 16 },
  header: {
    fontFamily: ios.font.family,
    fontSize: ios.font.section.size,
    fontWeight: ios.font.section.weight,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: ios.font.section.letter,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: ios.radius.lg,
    overflow: "hidden",
    ...ios.shadow.card,
  },
  footer: {
    fontFamily: ios.font.family,
    fontSize: ios.font.footnote.size,
    color: COLORS.textDisabled,
    marginTop: 8,
    marginLeft: 4,
    marginRight: 4,
    lineHeight: ios.font.footnote.lh,
  },
});
