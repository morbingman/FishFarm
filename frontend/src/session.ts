import type { Role } from "./store"

export const DEMO_ACCOUNTS: Record<Role, { email: string; password: string; name: string }> = {
  Buyer: { email: "buyer@fishmarket.demo", password: "Buyer123", name: "Alex Nguyen" },
  Seller: { email: "seller@fishmarket.demo", password: "Seller123", name: "Golden Koi Farm" },
  Admin: { email: "admin@fishmarket.demo", password: "Admin123", name: "Marketplace Admin" },
}
