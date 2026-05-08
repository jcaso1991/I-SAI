import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import ResponsiveLayout from "../src/ResponsiveLayout";
import { useBreakpoint } from "../src/useBreakpoint";
import IOSHeader from "../src/ui/IOSHeader";
import { COLORS } from "../src/api";
import { useThemedStyles } from "../src/theme";

export default function DocumentacionesScreen() {
  const { isWide } = useBreakpoint();
  const s = useThemedStyles(useS);

  const content = (
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      {!isWide && <IOSHeader title="Documentación y Software" />}

      <View style={s.body}>
        <Ionicons name="document-text-outline" size={48} color={COLORS.textDisabled} />
        <Text style={s.heading}>Documentación y Software</Text>
        <Text style={s.subtitle}>
          Próximamente: manuales, fichas técnicas y software de producto.
        </Text>
      </View>
    </SafeAreaView>
  );

  return (
    <ResponsiveLayout active="documentaciones">
      {content}
    </ResponsiveLayout>
  );
}

const useS = () =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.bg },
    body: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      gap: 12,
    },
    heading: {
      fontSize: 20,
      fontWeight: "800",
      color: COLORS.text,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 14,
      color: COLORS.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },
  });
