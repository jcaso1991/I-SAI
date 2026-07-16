import React from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useBreakpoint } from "../../useBreakpoint";
import { useThemedStyles } from "../../theme";
import { COLORS } from "../../api";
import { useS } from "./DashboardStyles";

interface DashboardTileProps {
  testID: string;
  icon: string;
  iconFamily?: "ion" | "mat";
  title: string;
  accent: string;
  onPress: () => void;
  selected?: boolean;
}

export default function DashboardTile({
  testID, icon, iconFamily = "ion", title, accent, onPress, selected,
}: DashboardTileProps) {
  const { isWide } = useBreakpoint();
  const s = useThemedStyles(useS);

  const webStyle = Platform.select({
    web: {
      transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease",
      cursor: "pointer",
    } as any,
    default: {},
  });

  return (
    <TouchableOpacity
      testID={testID}
      style={[
        s.tile,
        isWide && s.tileWide,
        webStyle,
        selected && {
          borderWidth: 2,
          borderColor: COLORS.primary,
          borderStyle: "dashed",
        } as any,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[
        s.tileIcon,
        isWide && s.tileIconWide,
        { backgroundColor: accent + "12" }
      ]}>
        {iconFamily === "ion" ? (
          <Ionicons name={icon as any} size={isWide ? 22 : 20} color={accent} />
        ) : (
          <MaterialCommunityIcons name={icon as any} size={isWide ? 24 : 20} color={accent} />
        )}
      </View>

      <Text
        style={[s.tileTitle, isWide && s.tileTitleWide]}
        numberOfLines={2}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}
