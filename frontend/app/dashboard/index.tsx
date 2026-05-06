import { useCallback, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { api, clearToken } from "../../src/api";
import ResponsiveLayout from "../../src/ResponsiveLayout";
import { useBreakpoint } from "../../src/useBreakpoint";
import { ios } from "../../src/ui/iosTheme";
import IOSHeader from "../../src/ui/IOSHeader";
import DashboardData from "../../src/modules/dashboard/DashboardData";
import { useS } from "../../src/modules/dashboard/DashboardStyles";
import { useThemedStyles } from "../../src/theme";
import { greetingForNow, spanishToday } from "../../src/modules/dashboard/DashboardUtils";

export default function DashboardPage() {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const s = useThemedStyles(useS);

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      try {
        const u = await api.me();
        if (!alive) return;
        setMe(u);
      } catch (e: any) {
        if (/401|Invalid|expired/i.test(e?.message || "")) {
          await clearToken();
          router.replace("/login");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []));

  const logout = async () => { await clearToken(); router.replace("/login"); };
  const firstName = me?.name ? me.name.split(" ")[0] : "";
  const isAdmin = me?.role === "admin";

  const content = (
    <SafeAreaView style={s.root} edges={isWide ? [] : ["top"]}>
      {!isWide && (
        <IOSHeader
          title="Dashboard"
          subtitle={spanishToday()}
        />
      )}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={ios.colors.brand} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.scroll, isWide && s.scrollWide]}
          showsVerticalScrollIndicator={false}
        >
          {isWide && (
            <View style={s.hero}>
              <Text style={s.heroGreet}>{greetingForNow()},</Text>
              <Text style={s.heroName}>{firstName || "Bienvenido"}</Text>
              <Text style={s.heroDate}>{spanishToday()}</Text>
            </View>
          )}

          <DashboardData />
        </ScrollView>
      )}
    </SafeAreaView>
  );

  return (
    <ResponsiveLayout
      active="dashboard"
      isAdmin={isAdmin}
      onLogout={logout}
      userName={me?.name}
    >
      {content}
    </ResponsiveLayout>
  );
}
