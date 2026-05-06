import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useBreakpoint } from "../../useBreakpoint";
import { useS } from "./DashboardStyles";
import { useThemedStyles } from "../../theme";

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
  return (
    <TouchableOpacity
      testID={testID}
      style={[s.tile, isWide && s.tileWide]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[s.tileIcon, { backgroundColor: accent }]}>
        {iconFamily === "ion" ? (
          <Ionicons name={icon as any} size={32} color="#fff" />
        ) : (
          <MaterialCommunityIcons name={icon as any} size={34} color="#fff" />
        )}
      </View>
      <Text style={s.tileTitle} numberOfLines={1}>{title}</Text>
    </TouchableOpacity>
  );
}
