import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ResponsiveLayout from "../src/ResponsiveLayout";
import { useBreakpoint } from "../src/useBreakpoint";
import IOSHeader from "../src/ui/IOSHeader";
import { COLORS } from "../src/api";
import { useThemedStyles } from "../src/theme";
import { ios, fontStyle } from "../src/ui/iosTheme";

export default function DocumentosScreen() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const s = useThemedStyles(useS);

  const cards = [
    {
      title: "Preciario",
      subtitle: "Consulta de tarifas y productos con descuentos",
      icon: "pricetags",
      route: "/preciario",
    },
    {
      title: "Documentación y Software",
      subtitle: "Manuales, fichas técnicas y software de producto",
      icon: "document-text",
      route: "/documentaciones",
    },
    {
      title: "Muestrario Salto",
      subtitle: "Catálogo de productos Salto con personalización",
      icon: "grid",
      route: "/muestrario",
    },
  ];

  const content = (
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      {!isWide && <IOSHeader title="Documentos Internos" showBack />}

      <View style={s.body}>
        <Text style={s.heading}>Documentos Internos</Text>
        <Text style={s.subtitle}>
          Accedé al preciario, documentación técnica y muestrario de productos
        </Text>

        <View style={s.cards}>
          {cards.map((card) => (
            <TouchableOpacity
              key={card.route}
              style={s.card}
              onPress={() => router.push(card.route as any)}
              activeOpacity={0.8}
            >
              <View style={s.cardIcon}>
                <Ionicons name={card.icon as any} size={32} color={COLORS.primary} />
              </View>
              <View style={s.cardBody}>
                <Text style={s.cardTitle}>{card.title}</Text>
                <Text style={s.cardSubtitle}>{card.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textDisabled} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );

  return (
    <ResponsiveLayout active="documentos">
      {content}
    </ResponsiveLayout>
  );
}

const useS = () =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.bg },
    body: {
      flex: 1, padding: 20, paddingTop: 12,
      gap: ios.spacing.sectionGap,
    },
    heading: {
      ...fontStyle("title1"),
      color: COLORS.text,
    },
    subtitle: {
      ...fontStyle("callout"),
      color: COLORS.textSecondary,
      marginTop: 4,
    },
    cards: { gap: ios.spacing.lg },
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: COLORS.surface,
      borderRadius: ios.radius.lg,
      padding: ios.spacing.lg,
      gap: ios.spacing.lg,
      borderWidth: 1,
      borderColor: COLORS.border,
      ...ios.shadow.card,
    },
    cardIcon: {
      width: 56,
      height: 56,
      borderRadius: ios.radius.lg,
      backgroundColor: COLORS.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    cardBody: { flex: 1 },
    cardTitle: {
      ...fontStyle("title3"),
      color: COLORS.text,
    },
    cardSubtitle: {
      ...fontStyle("footnote"),
      color: COLORS.textSecondary,
      marginTop: 2,
    },
  });
