/**
 * IOSSwitch — wraps the platform Switch but with consistent iOS colours.
 */
import React from "react";
import { Switch, Platform } from "react-native";
import { ios } from "./iosTheme";

export default function IOSSwitch({
  value, onValueChange, testID,
}: { value: boolean; onValueChange: (v: boolean) => void; testID?: string }) {
  return (
    <Switch
      testID={testID}
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: "#E9E9EA", true: ios.colors.green }}
      thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
      ios_backgroundColor="#E9E9EA"
    />
  );
}
