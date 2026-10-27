import { useEffect, useSyncExternalStore } from "react";
import { currentUser, log, notify } from "./demoStore";
import { api } from "./api";
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
  paidAt?: string;
  readyAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  updatedAt?: string;
};
let orders: Sale[] = [];
const listeners = new Set<() => void>();
function save(next: Sale[]) {
  orders = next;
  listeners.forEach((fn) => fn());
}
export async function refreshSales() {
  const user = currentUser();
  if (!user) return;
  try {
    const rows = await api<any[]>(
      user.role === "Admin" ? "/admin/orders" : "/me/orders",
    );
    const status = (value: string): SaleStatus =>
      (({
        pending_payment: "confirmed",
        paid: "confirmed",
        ready: "preparing",
        shipped: "shipped",
        delivered: "delivered",
        completed: "completed",
        cancelled: "cancelled",
        refunded: "cancelled",
      })[value] as SaleStatus) ?? "confirmed";
    save(
      rows.map((row) => ({
        id: row.code,
        owner: row.buyer?.email ?? user.email,
        createdAt: row.placedAt,
        items: row.items.map((item: any) => ({
          id: Number(String(item.listing.code).replace(/\D/g, "")),
          name: item.listing.draft?.name ?? item.listing.code,
          price: item.unitPrice,
          image:
            item.listing.draft?.images?.find((x: any) => x.isMain)?.url ??
            item.listing.draft?.images?.[0]?.url ??
            "",
        })),
        total: row.total,
        shipping: {
          name: row.recipientName,
          phone: row.phone,
          address: row.address,
          city: row.city ?? "",
          province: row.province ?? "",
        },
        status: status(row.status),
        payment: row.paymentStatus === "refunded" ? "refund_pending" : "paid",
        paidAt: row.paidAt ?? undefined,
        readyAt: row.readyAt ?? undefined,
        deliveredAt: row.deliveredAt ?? undefined,
        completedAt: row.completedAt ?? undefined,
        updatedAt: row.updatedAt ?? undefined,
      })),
    );
  } catch {
    /* Authentication bootstrap will retry when the screen mounts again. */
  }
}
export const useSales = () => {
  useEffect(() => {
    void refreshSales();
  }, []);
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    () => orders,
  );
};
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
  const apiStatus = (
    {
      confirmed: "paid",
      preparing: "ready",
      shipped: "shipped",
      delivered: "delivered",
      completed: "completed",
      cancelled: "cancelled",
    } as const
  )[status];
  void api(`/admin/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: apiStatus }),
  })
    .then(refreshSales)
    .catch(() => undefined);
}
