import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ResponsiveLayout from "../src/ResponsiveLayout";
import { useBreakpoint } from "../src/useBreakpoint";
import IOSHeader from "../src/ui/IOSHeader";
import { COLORS } from "../src/api";
import { useThemedStyles } from "../src/theme";

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
  ];

  const content = (
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      {!isWide && <IOSHeader title="Documentos Internos" showBack />}

      <View style={s.body}>
        <Text style={s.heading}>Documentos Internos</Text>
        <Text style={s.subtitle}>
          Accedé al preciario oficial y a la documentación técnica
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
    body: { flex: 1, padding: 20, paddingTop: 12 },
    heading: {
      fontSize: 26,
      fontWeight: "900",
      color: COLORS.text,
      letterSpacing: 0.2,
    },
    subtitle: {
      fontSize: 14,
      color: COLORS.textSecondary,
      marginTop: 4,
      marginBottom: 24,
    },
    cards: { gap: 12 },
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: COLORS.surface,
      borderRadius: 14,
      padding: 16,
      gap: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      ...Platform.select({
        web: { boxShadow: `0 1px 3px ${COLORS.text}08` } as any,
        default: {
          shadowColor: COLORS.text,
          shadowOpacity: 0.05,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
        },
      }),
    },
    cardIcon: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: COLORS.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    cardBody: { flex: 1 },
    cardTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: COLORS.text,
    },
    cardSubtitle: {
      fontSize: 12.5,
      color: COLORS.textSecondary,
      marginTop: 2,
    },
  });
