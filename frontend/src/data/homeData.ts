import type { MarketplaceListing } from "@/services/contracts";
export type HomeListing = MarketplaceListing;
export type HomeCategory = { name: string; count: number; image: string | null };
export type HomeSeller = { name: string; location: string; rating: number; count: number; image: string | null; specialty: string };
export const photos = { hero: "/hero-koi.jpg", farm: "/home/fish-03.jpg" };
