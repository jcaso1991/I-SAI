import React from "react";
import { Switch, Platform } from "react-native";
import { ios } from "./iosTheme";
import { COLORS } from "../api";

export default function IOSSwitch({
  value, onValueChange, testID,
}: { value: boolean; onValueChange: (v: boolean) => void; testID?: string }) {
  return (
    <Switch
      testID={testID}
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: COLORS.border, true: ios.colors.green }}
      thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
      ios_backgroundColor={COLORS.border}
    />
  );
}
