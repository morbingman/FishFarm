import type { Avail, Category, Kind, Water } from "@/services/farmingStore";
export const AV_TONE: Record<Avail, string> = {
  available: "ok",
  limited: "warn",
  full: "muted",
  paused: "muted",
};
export const day = 86_400_000;
export const isoDay = (offset: number) =>
  new Date(Date.now() + offset * day).toISOString().slice(0, 10);
export /* ---------------------------------- catalog ---------------------------------- */
type Filters = {
  q: string;
  cat: "" | Category;
  kind: "" | Kind;
  water: "" | Water;
  dur: string;
  price: string;
  slots: string;
  sort: string;
};
export const F0: Filters = {
  q: "",
  cat: "",
  kind: "",
  water: "",
  dur: "",
  price: "",
  slots: "",
  sort: "name",
};
export const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();
