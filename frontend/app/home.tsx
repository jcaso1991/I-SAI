import { useRouter } from "expo-router";
import { clearToken } from "../src/api";
import { DashboardScreen } from "../src/modules/dashboard";

export default function HomeScreen() {
  const router = useRouter();
  const logout = async () => { await clearToken(); router.replace("/login"); };
  return <DashboardScreen active="home" onLogout={logout} />;
}
