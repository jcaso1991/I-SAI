/**
 * IOSGroup — "grouped" list container that imitates iOS Settings.
 * Children are usually <IOSListRow /> or any custom row View.
 *
 * Use:
 *   <IOSGroup header="APARIENCIA" footer="Cambia el tema visual">
 *     <IOSListRow title="Tema" right={...} />
 *   </IOSGroup>
 */
import React, { Children, isValidElement, cloneElement } from "react";
import { View, Text, StyleSheet } from "react-native";
import { ios } from "./iosTheme";

export default function IOSGroup({
  header,
  footer,
  children,
  inset = true,
}: {
  header?: string;
  footer?: string;
  children: React.ReactNode;
  /** Adds horizontal padding around the card (default true). */
  inset?: boolean;
}) {
  // Add isFirst/isLast and showSeparator props automatically
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
    <View style={[styles.wrap, inset && styles.inset]}>
      {!!header && <Text style={styles.header}>{header}</Text>}
      <View style={styles.card}>{enhanced}</View>
      {!!footer && <Text style={styles.footer}>{footer}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 24 },
  inset: { paddingHorizontal: 16 },
  header: {
    fontFamily: ios.font.family,
    fontSize: 13, fontWeight: "400",
    color: ios.colors.sectionHeader,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6, marginLeft: 16,
  },
  card: {
    backgroundColor: ios.colors.surface,
    borderRadius: ios.radius.card,
    overflow: "hidden",
  },
  footer: {
    fontFamily: ios.font.family,
    fontSize: 13, color: ios.colors.footnote,
    marginTop: 6, marginLeft: 16, marginRight: 16,
    lineHeight: 18,
  },
});
