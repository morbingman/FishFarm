import type { OrderStatus, CareType } from "@/services/farmingStore";
import type { IconName } from "@/components/common/Portal";
export type Tab =
  | "all"
  | "awaiting_deposit"
  | "pending"
  | "progress"
  | "ready"
  | "completed"
  | "cancelled";
export const TAB_OF: Record<OrderStatus, Tab> = {
  awaiting_deposit: "awaiting_deposit",
  pending: "pending",
  confirmed: "progress",
  preparing: "progress",
  farming: "progress",
  ready: "ready",
  handover: "ready",
  completed: "completed",
  cancelled: "cancelled",
};
export const PAGE = 5;
export const CUR: Record<OrderStatus, number> = {
  awaiting_deposit: 0,
  pending: 1,
  confirmed: 2,
  preparing: 2,
  farming: 3,
  ready: 4,
  handover: 5,
  completed: 6,
  cancelled: -1,
};
export const CARE_ICON: Record<CareType, IconName> = {
  feeding: "fish",
  water: "droplet",
  health: "activity",
  note: "edit",
  photo: "camera",
};
export const isoDay = (n: number) =>
  new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
