import { api } from "./api";
import type { Order, OrderFilter, ShipmentInput } from "./contracts";

const path = (id: string) => `/company/orders/${encodeURIComponent(id)}`;
export const companyOrdersApi = {
  orders: (status: OrderFilter = "all", signal?: AbortSignal) => api<Order[]>(`/company/orders?status=${encodeURIComponent(status)}`, { signal }),
  order: (id: string, signal?: AbortSignal) => api<Order>(path(id), { signal }),
  markReady: (id: string) => api<Order>(`${path(id)}/mark-ready`, { method: "POST" }),
  ship: (id: string, input: ShipmentInput) => api<Order>(`${path(id)}/ship`, { method: "POST", body: JSON.stringify({
    ...(input.trackingCarrier ? { trackingCarrier: input.trackingCarrier } : {}),
    ...(input.trackingNumber ? { trackingNumber: input.trackingNumber } : {}),
    ...(input.estimatedDeliveryAt ? { estimatedDeliveryAt: input.estimatedDeliveryAt } : {}),
  }) }),
  deliver: (id: string) => api<Order>(`${path(id)}/deliver`, { method: "POST" }),
  complete: (id: string) => api<Order>(`${path(id)}/complete`, { method: "POST" }),
  cancel: (id: string, reason: string) => api<Order>(`${path(id)}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }),
};
