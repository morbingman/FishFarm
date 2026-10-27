import type { Order, OrderTracking, ShipmentInput } from "./contracts";

export type CompanyOrderAction = "mark-ready" | "ship" | "deliver" | "complete" | "cancel";
export function availableCompanyOrderActions(order: Order): CompanyOrderAction[] {
  const actions: CompanyOrderAction[] = [];
  if (order.status === "paid") actions.push("mark-ready");
  if (order.status === "ready" && (order.saleMode === "in_stock" || order.paymentStatus === "paid")) actions.push("ship");
  if (order.status === "shipped") actions.push("deliver");
  if (order.status === "delivered") actions.push("complete");
  if (["pending_payment", "paid", "ready"].includes(order.status)) actions.push("cancel");
  return actions;
}
export const companyOrderLink = (id: string) => `#company/orders/${encodeURIComponent(id)}`;
export function isCompanyOrderRoute(route: string) {
  return ["admin", "admin/orders", "company/orders"].includes(route) || /^(company|admin)\/orders\/[^/]+$/.test(route);
}
export function companyTracking(order: Order): OrderTracking {
  const fields = [
    ["placed", order.placedAt], ["paid", order.paidAt], ["ready", order.readyAt],
    ["shipped", order.shippedAt], ["delivered", order.deliveredAt], ["completed", order.completedAt],
    ["cancelled", order.cancelledAt], ["refunded", order.refundedAt],
  ] as const;
  return {
    id: order.id, status: order.status, carrier: order.trackingCarrier,
    trackingNumber: order.trackingNumber, estimatedDeliveryAt: order.estimatedDeliveryAt,
    events: fields.flatMap(([status, at]) => at ? [{ status, at }] : []),
  };
}
export function shipmentInput(carrier: string, number: string, localEstimate: string): ShipmentInput {
  const trackingCarrier = carrier.trim();
  const trackingNumber = number.trim();
  if (trackingCarrier.length > 80 || trackingNumber.length > 100) throw new Error("Invalid shipment metadata");
  const estimate = localEstimate ? new Date(localEstimate) : null;
  if (estimate && !Number.isFinite(estimate.getTime())) throw new Error("Invalid delivery estimate");
  return {
    ...(trackingCarrier ? { trackingCarrier } : {}),
    ...(trackingNumber ? { trackingNumber } : {}),
    ...(estimate ? { estimatedDeliveryAt: estimate.toISOString() } : {}),
  };
}
