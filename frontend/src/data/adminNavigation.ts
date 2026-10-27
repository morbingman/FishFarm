import type { NavItem } from "@/components/common/Portal";
export const ADMIN_NAV: NavItem[] = [
  { label: "Fish management", href: "#admin/listings", icon: "fish" },
  { label: "Purchase orders", href: "#admin/orders", icon: "bag" },
  { label: "Farming bookings", href: "#admin/bookings", icon: "waves" },
  { label: "Users", href: "#admin/users", icon: "users" },
];
export const ADMIN_VI: Record<string, string> = {
  "Fish management": "Quản lý cá",
  "Purchase orders": "Đơn mua cá",
  "Farming bookings": "Cá đặt nuôi",
  Users: "Người dùng",
};
export const adminLabel = (text: string, language: "en" | "vi") =>
  language === "vi" ? (ADMIN_VI[text] ?? text) : text;
export function adminActive(hash: string) {
  const path = hash.split("?")[0];
  if (/^#admin\/(edit|listing|add)(\/|$)/.test(path)) return "#admin/listings";
  if (path.startsWith("#admin/review/")) return "#admin/listings";
  return (
    [...ADMIN_NAV]
      .reverse()
      .find((item) => path === item.href || path.startsWith(item.href + "/"))
      ?.href ?? "#admin/listings"
  );
}
