import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckoutInput } from "./contracts";
const input: CheckoutInput = { recipientName: "User", phone: "0901234567", address: "Local", paymentMethod: "bank_card" };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
beforeEach(() => { vi.resetModules(); vi.stubGlobal("sessionStorage", { removeItem: vi.fn() }); });
afterEach(() => vi.unstubAllGlobals());
describe("commerce transport", () => {
  it("separates add/increment from set quantity and preserves the server cart", async () => {
    const cart = { items: [{ listingId: "db-id", quantity: 2, lineTotal: 620 }], subtotal: 620, itemCount: 2, saleMode: "in_stock" };
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(response(cart))); vi.stubGlobal("fetch", fetch);
    const { commerceApi } = await import("./commerceApi");
    expect(await commerceApi.cart()).toEqual(cart);
    await commerceApi.add("FM-1", 2); await commerceApi.setQuantity("db/id", 3); await commerceApi.remove("db/id"); await commerceApi.clear();
    expect(fetch.mock.calls.map(([url, init]) => [url, init.method ?? "GET", init.body ? JSON.parse(init.body) : null])).toEqual([
      ["/v1/me/cart", "GET", null], ["/v1/me/cart/items", "POST", { listingId: "FM-1", quantity: 2 }],
      ["/v1/me/cart/items/db%2Fid", "PATCH", { quantity: 3 }], ["/v1/me/cart/items/db%2Fid", "DELETE", null], ["/v1/me/cart", "DELETE", null],
    ]);
  });
  it("creates one atomic order with only allowed fields and no card data", async () => {
    const order = { id: "ORD-10024", paymentStatus: "paid", total: 620 };
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(response(order))); vi.stubGlobal("fetch", fetch);
    const { commerceApi } = await import("./commerceApi");
    expect(await commerceApi.checkout({ ...input, card: "must-not-send", listingCodes: ["FM-1"], shippingFee: 35 } as CheckoutInput, "retry-key-123")).toEqual(order);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe("/v1/orders");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ ...input, idempotencyKey: "retry-key-123" });
    await commerceApi.order(order.id);
    expect(fetch.mock.calls[1][0]).toBe("/v1/me/orders/ORD-10024");
  });
  it("preserves the checkout key through an authenticated refresh retry", async () => {
    const bodies: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/auth/refresh")) return response({ accessToken: "new-token", user: null });
      bodies.push(String(init.body));
      return new Headers(init.headers).has("Authorization") ? response({ id: "ORD-10025" }) : response({ code: "auth.sessionExpired" }, 401);
    }));
    const { commerceApi } = await import("./commerceApi");
    await expect(commerceApi.checkout(input, "same-key-123")).resolves.toEqual({ id: "ORD-10025" });
    expect(bodies).toHaveLength(2); expect(bodies[1]).toBe(bodies[0]);
  });
  it("uses owner history, tracking and explicit lifecycle endpoints", async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(response({ id: "ORD-1" }))); vi.stubGlobal("fetch", fetch);
    const { commerceApi } = await import("./commerceApi");
    await commerceApi.orders("refunded"); await commerceApi.tracking("db/id"); await commerceApi.cancelOrder("ORD-1");
    await commerceApi.payBalance("ORD-1", "e_wallet"); await commerceApi.confirmDelivery("ORD-1");
    expect(fetch.mock.calls.map(([url, init]) => [url, init.method ?? "GET", init.body ? JSON.parse(init.body) : null])).toEqual([
      ["/v1/me/orders?status=refunded", "GET", null], ["/v1/me/orders/db%2Fid/tracking", "GET", null],
      ["/v1/me/orders/ORD-1/cancel", "POST", null], ["/v1/me/orders/ORD-1/pay-balance", "POST", { paymentMethod: "e_wallet" }],
      ["/v1/me/orders/ORD-1/confirm-delivery", "POST", null],
    ]);
  });
  it("returns the actual refund response from a late balance payment", async () => {
    const refunded = { id: "ORD-1", status: "refunded", paymentStatus: "refunded", balanceDueAt: null };
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(response(refunded))));
    const { commerceApi } = await import("./commerceApi");
    await expect(commerceApi.payBalance("ORD-1", "bank_transfer")).resolves.toEqual(refunded);
  });
  it("propagates an active-dispute completion guard with a readable error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(response({ code: "order.openDispute" }, 409))));
    const { commerceApi } = await import("./commerceApi");
    const { ApiError, errorMessage } = await import("./api");
    await expect(commerceApi.confirmDelivery("ORD-1")).rejects.toMatchObject({ status: 409, code: "order.openDispute" });
    expect(errorMessage(new ApiError(409, "order.openDispute"), "en")).toContain("dispute is open");
    expect(errorMessage(new ApiError(409, "order.openDispute"), "vi")).toContain("khiếu nại");
  });
  it("passes abort signals to owner reads and rejects transport uncertainty", async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(response([]))); vi.stubGlobal("fetch", fetch);
    const { commerceApi } = await import("./commerceApi");
    const controller = new AbortController();
    await commerceApi.orders("all", controller.signal);
    const signal = fetch.mock.calls[0][1].signal as AbortSignal;
    expect(signal).toBeInstanceOf(AbortSignal);
    fetch.mockRejectedValue(new TypeError("Lost response"));
    await expect(commerceApi.payBalance("ORD-1", "bank_transfer")).rejects.toThrow("Lost response");
  });
  it("does not turn stock or mixed-mode rejection into success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(response({ code: "cart.quantityExceedsStock", params: { available: 1 } }, 409))));
    const { commerceApi } = await import("./commerceApi");
    await expect(commerceApi.checkout(input, "same-key-123")).rejects.toMatchObject({ code: "cart.quantityExceedsStock", params: { available: 1 } });
  });
});
