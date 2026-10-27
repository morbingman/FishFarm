import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShipmentInput } from "./contracts";
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
beforeEach(() => { vi.resetModules(); vi.stubGlobal("sessionStorage", { removeItem: vi.fn() }); });
afterEach(() => vi.unstubAllGlobals());
describe("company fulfilment transport", () => {
  it("uses the shared company queue and explicit POST actions with allowed fields only", async () => {
    const projection = { id: "ORD-1", status: "shipped", paymentStatus: "paid" };
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(response(projection))); vi.stubGlobal("fetch", fetch);
    const { companyOrdersApi } = await import("./companyOrdersApi");
    await companyOrdersApi.orders("ready"); await companyOrdersApi.order("db/id"); await companyOrdersApi.markReady("ORD-1");
    expect(await companyOrdersApi.ship("ORD-1", { trackingCarrier: "Post", trackingNumber: "ABC", estimatedDeliveryAt: "2026-10-28T05:00:00.000Z", status: "completed", creatorId: "admin", note: "discard" } as ShipmentInput)).toEqual(projection);
    await companyOrdersApi.deliver("ORD-1"); await companyOrdersApi.complete("ORD-1"); await companyOrdersApi.cancel("ORD-1", "Stock issue");
    expect(fetch.mock.calls.map(([url, init]) => [url, init.method ?? "GET", init.body ? JSON.parse(init.body) : null])).toEqual([
      ["/v1/company/orders?status=ready", "GET", null], ["/v1/company/orders/db%2Fid", "GET", null], ["/v1/company/orders/ORD-1/mark-ready", "POST", null],
      ["/v1/company/orders/ORD-1/ship", "POST", { trackingCarrier: "Post", trackingNumber: "ABC", estimatedDeliveryAt: "2026-10-28T05:00:00.000Z" }],
      ["/v1/company/orders/ORD-1/deliver", "POST", null], ["/v1/company/orders/ORD-1/complete", "POST", null], ["/v1/company/orders/ORD-1/cancel", "POST", { reason: "Stock issue" }],
    ]);
  });
  it("allows shipping without inventing optional metadata", async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(response({ id: "ORD-1" }))); vi.stubGlobal("fetch", fetch);
    const { companyOrdersApi } = await import("./companyOrdersApi");
    await companyOrdersApi.ship("ORD-1", {});
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({});
  });
  it("preserves the exact shipment payload during one auth refresh retry", async () => {
    const bodies: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/auth/refresh")) return response({ accessToken: "new-token", user: null });
      bodies.push(String(init.body));
      return new Headers(init.headers).has("Authorization") ? response({ id: "ORD-1", status: "shipped" }) : response({ code: "auth.sessionExpired" }, 401);
    }));
    const { companyOrdersApi } = await import("./companyOrdersApi");
    await companyOrdersApi.ship("ORD-1", { trackingNumber: "ABC" });
    expect(bodies).toHaveLength(2); expect(bodies[1]).toBe(bodies[0]);
  });
  it("propagates balance, dispute and transition conflicts rather than fabricating success", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const { companyOrdersApi } = await import("./companyOrdersApi");
    const { ApiError, errorMessage } = await import("./api");
    fetch.mockImplementation(() => Promise.resolve(response({ code: "order.balanceOutstanding" }, 409)));
    await expect(companyOrdersApi.ship("ORD-1", {})).rejects.toMatchObject({ status: 409, code: "order.balanceOutstanding" });
    expect(errorMessage(new ApiError(409, "order.balanceOutstanding"), "en")).toContain("balance is paid");
    expect(errorMessage(new ApiError(409, "order.balanceOutstanding"), "vi")).toContain("thanh toán");
    fetch.mockImplementation(() => Promise.resolve(response({ code: "order.openDispute" }, 409)));
    await expect(companyOrdersApi.complete("ORD-1")).rejects.toMatchObject({ code: "order.openDispute" });
    fetch.mockImplementation(() => Promise.resolve(response({ code: "order.invalidTransition" }, 409)));
    await expect(companyOrdersApi.markReady("ORD-1")).rejects.toMatchObject({ code: "order.invalidTransition" });
  });
  it("rejects uncertain writes without automatic transport retry", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("Lost response")); vi.stubGlobal("fetch", fetch);
    const { companyOrdersApi } = await import("./companyOrdersApi");
    await expect(companyOrdersApi.deliver("ORD-1")).rejects.toThrow("Lost response");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
