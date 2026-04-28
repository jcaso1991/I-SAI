/**
 * BottomNav (legacy entry-point) — re-exports the iOS-style tab bar so all
 * existing screens automatically pick up the new visual language.
 */
import IOSTabBar from "./ui/IOSTabBar";
export type { BottomTab } from "./ui/IOSTabBar";
export default IOSTabBar;
