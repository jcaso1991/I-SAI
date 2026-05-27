import React from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useBreakpoint } from "../../useBreakpoint";
import { useThemedStyles } from "../../theme";
import { useS } from "./DashboardStyles";


interface DashboardTileProps {
  testID: string;
  icon: string;
  iconFamily?: "ion" | "mat";
  title: string;
  accent: string;
  onPress: () => void;
}

export default function DashboardTile({
  testID, icon, iconFamily = "ion", title, accent, onPress,
}: DashboardTileProps) {
  const { isWide } = useBreakpoint();
  const s = useThemedStyles(useS);
  const glow = Platform.select({
    web: { boxShadow: `0 0 20px ${accent}33, 0 0 40px ${accent}1A` } as any,
    default: {},
  });
  return (
    <TouchableOpacity
      testID={testID}
      style={[s.tile, isWide && s.tileWide, glow]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[s.tileIcon, isWide && s.tileIconWide, { backgroundColor: accent + "1F" }, Platform.select({ web: { boxShadow: `0 0 12px ${accent}33` } as any, default: {} })]}>
        {iconFamily === "ion" ? (
          <Ionicons name={icon as any} size={isWide ? 24 : 20} color={accent} />
        ) : (
          <MaterialCommunityIcons name={icon as any} size={isWide ? 26 : 20} color={accent} />
        )}
      </View>
      <Text style={[s.tileTitle, isWide && s.tileTitleWide]} numberOfLines={1}>{title}</Text>
    </TouchableOpacity>
  );
}
