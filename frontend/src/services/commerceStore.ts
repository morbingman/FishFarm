import { useSyncExternalStore } from "react";
import { currentUser, log, notify } from "./demoStore";
export type SaleStatus =
  | "confirmed"
  | "preparing"
  | "shipped"
  | "delivered"
  | "completed"
  | "cancelled";
export type Sale = {
  id: string;
  owner: string;
  createdAt: string;
  items: { id: number; name: string; price: number; image: string }[];
  total: number;
  shipping: {
    name: string;
    phone: string;
    address: string;
    city: string;
    province: string;
  };
  status: SaleStatus;
  payment: "paid" | "refund_pending";
};
const KEY = "fishmarket-purchase-orders-v1";
const load = (): Sale[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
};
let orders = load();
const listeners = new Set<() => void>();
function save(next: Sale[]) {
  orders = next;
  localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((fn) => fn());
}
window.addEventListener("storage", (event) => {
  if (event.key === KEY) {
    orders = load();
    listeners.forEach((fn) => fn());
  }
});
export const useSales = () =>
  useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    () => orders,
  );
export function recordPurchase(
  input: Omit<Sale, "id" | "createdAt" | "status" | "payment">,
) {
  const actor = currentUser();
  if (actor?.role !== "Buyer" || actor.email !== input.owner)
    throw new Error("Buyer access required");
  const sale: Sale = {
    ...input,
    id: `PO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    status: "confirmed",
    payment: "paid",
  };
  save([sale, ...orders]);
  notify(
    "Admin",
    "status",
    "New purchase order",
    `${sale.id} · ${input.shipping.name}`,
    `#admin/orders/${sale.id}`,
  );
  return sale;
}
const NEXT: Partial<Record<SaleStatus, SaleStatus>> = {
  confirmed: "preparing",
  preparing: "shipped",
  shipped: "delivered",
  delivered: "completed",
};
export function updatePurchase(id: string, status: SaleStatus) {
  const admin = currentUser();
  const sale = orders.find((item) => item.id === id);
  if (admin?.role !== "Admin" || !sale) throw new Error("Access denied");
  if (
    status !== NEXT[sale.status] &&
    !(
      status === "cancelled" && ["confirmed", "preparing"].includes(sale.status)
    )
  )
    throw new Error("Invalid order transition");
  save(
    orders.map((item) =>
      item.id === id
        ? {
            ...item,
            status,
            payment: status === "cancelled" ? "refund_pending" : item.payment,
          }
        : item,
    ),
  );
  log(
    admin.name,
    "Admin",
    `Purchase order: ${status}`,
    id,
    `#admin/orders/${id}`,
  );
  notify(
    sale.owner,
    "status",
    "Purchase order updated",
    `${id}: ${status}`,
    "#marketplace/orders",
  );
}
