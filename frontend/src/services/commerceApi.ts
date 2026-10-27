import { api } from "./api";
import type { Cart, CheckoutInput, Order, OrderFilter, OrderTracking, PaymentMethod } from "./contracts";

export const commerceApi = {
  cart: (signal?: AbortSignal) => api<Cart>("/me/cart", { signal }),
  add: (listingId: string, quantity: number) => api<Cart>("/me/cart/items", { method: "POST", body: JSON.stringify({ listingId, quantity }) }),
  setQuantity: (listingId: string, quantity: number) => api<Cart>(`/me/cart/items/${encodeURIComponent(listingId)}`, { method: "PATCH", body: JSON.stringify({ quantity }) }),
  remove: (listingId: string) => api<Cart>(`/me/cart/items/${encodeURIComponent(listingId)}`, { method: "DELETE" }),
  clear: () => api<Cart>("/me/cart", { method: "DELETE" }),
  checkout: (input: CheckoutInput, idempotencyKey: string) => api<Order>("/orders", { method: "POST", body: JSON.stringify({
    recipientName: input.recipientName, phone: input.phone, address: input.address,
    ...(input.city ? { city: input.city } : {}), ...(input.province ? { province: input.province } : {}),
    paymentMethod: input.paymentMethod, idempotencyKey,
  }) }),
  order: (id: string, signal?: AbortSignal) => api<Order>(`/me/orders/${encodeURIComponent(id)}`, { signal }),
  orders: (status: OrderFilter = "all", signal?: AbortSignal) => api<Order[]>(`/me/orders?status=${encodeURIComponent(status)}`, { signal }),
  tracking: (id: string, signal?: AbortSignal) => api<OrderTracking>(`/me/orders/${encodeURIComponent(id)}/tracking`, { signal }),
  cancelOrder: (id: string) => api<Order>(`/me/orders/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
  payBalance: (id: string, paymentMethod: PaymentMethod) => api<Order>(`/me/orders/${encodeURIComponent(id)}/pay-balance`, { method: "POST", body: JSON.stringify({ paymentMethod }) }),
  confirmDelivery: (id: string) => api<Order>(`/me/orders/${encodeURIComponent(id)}/confirm-delivery`, { method: "POST" }),
};
