import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { getToken } from "../src/api";
import { COLORS } from "../src/api";

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const t = await getToken();
      if (t) router.replace("/home");
      else router.replace("/login");
    })();
  }, []);
  return (
    <View style={styles.c} testID="splash-screen">
      <ActivityIndicator color={COLORS.primary} size="large" />
    </View>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg },
});
