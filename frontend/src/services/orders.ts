import type { Order, OrderStatus } from "./contracts";

export type OrderAction = "cancel" | "pay-balance" | "confirm-delivery";
export const orderFilters = ["all", "pending_payment", "paid", "ready", "shipped", "delivered", "completed", "cancelled", "refunded"] as const;
const labels: Record<OrderStatus | "placed", [string, string]> = {
  placed: ["Order placed", "Đã đặt đơn"], pending_payment: ["Pending payment", "Chờ thanh toán"],
  paid: ["Payment recorded", "Đã ghi nhận thanh toán"], ready: ["Ready", "Sẵn sàng"],
  shipped: ["Shipped", "Đang giao"], delivered: ["Delivered", "Đã giao"],
  completed: ["Completed", "Hoàn tất"], cancelled: ["Cancelled", "Đã hủy"], refunded: ["Refunded", "Đã hoàn tiền"],
};
export function orderLabel(status: OrderStatus | "placed", language: "en" | "vi") {
  return labels[status][language === "vi" ? 1 : 0];
}
export function paymentLabel(status: Order["paymentStatus"], language: "en" | "vi") {
  const labels: Record<Order["paymentStatus"], [string, string]> = {
    unpaid: ["Unpaid", "Chưa thanh toán"], paid: ["Paid in full", "Đã thanh toán đủ"],
    deposit_paid: ["Deposit paid", "Đã thanh toán cọc"], balance_due: ["Balance due", "Cần thanh toán phần còn lại"],
    refunded: ["Refunded", "Đã hoàn tiền"],
  };
  return labels[status][language === "vi" ? 1 : 0];
}
export function availableOrderActions(order: Order, now = Date.now()): OrderAction[] {
  const actions: OrderAction[] = [];
  if (["pending_payment", "paid", "ready"].includes(order.status)) actions.push("cancel");
  if (order.saleMode === "pre_order" && order.status === "ready" && order.paymentStatus === "balance_due"
    && order.balanceDueAt && Date.parse(order.balanceDueAt) > now) actions.push("pay-balance");
  if (order.status === "delivered") actions.push("confirm-delivery");
  return actions;
}
export const orderLink = (id: string) => `#marketplace/orders/${encodeURIComponent(id)}`;
export function isOrderRoute(route: string) {
  return route === "marketplace/orders" || /^marketplace\/orders\/[^/]+$/.test(route);
}
