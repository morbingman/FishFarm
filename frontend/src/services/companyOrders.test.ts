import { describe, expect, it } from "vitest";
import type { Order } from "./contracts";
import { availableCompanyOrderActions, companyOrderLink, companyTracking, isCompanyOrderRoute, shipmentInput } from "./companyOrders";
const order = (overrides: Partial<Order> = {}) => ({ status: "paid", saleMode: "in_stock", paymentStatus: "paid", ...overrides }) as Order;
describe("company order policy", () => {
  it("matches explicit server transitions instead of legacy status updates", () => {
    const expected = { pending_payment: ["cancel"], paid: ["mark-ready", "cancel"], ready: ["ship", "cancel"], shipped: ["deliver"], delivered: ["complete"], completed: [], cancelled: [], refunded: [] };
    for (const [status, actions] of Object.entries(expected)) expect(availableCompanyOrderActions(order({ status: status as Order["status"] }))).toEqual(actions);
  });
  it("blocks shipment of a preorder with an unpaid balance", () => {
    for (const paymentStatus of ["unpaid", "deposit_paid", "balance_due", "refunded"] as const) expect(availableCompanyOrderActions(order({ status: "ready", saleMode: "pre_order", paymentStatus }))).toEqual(["cancel"]);
    expect(availableCompanyOrderActions(order({ status: "ready", saleMode: "pre_order", paymentStatus: "paid" }))).toEqual(["ship", "cancel"]);
  });
  it("accepts bounded company notification and legacy Admin links only", () => {
    for (const route of ["admin", "admin/orders", "admin/orders/ORD-1", "company/orders", "company/orders/ORD-1"]) expect(isCompanyOrderRoute(route)).toBe(true);
    for (const route of ["company", "company/orders/", "company/orders/ORD-1/ship", "marketplace/orders/ORD-1", "https://other/orders"]) expect(isCompanyOrderRoute(route)).toBe(false);
    expect(companyOrderLink("db/id")).toBe("#company/orders/db%2Fid");
  });
  it("projects exactly the recorded lifecycle without synthetic future events", () => {
    const result = companyTracking(order({ id: "ORD-1", placedAt: "2026-10-26T00:00:00Z", paidAt: "2026-10-26T00:00:01Z", readyAt: null, shippedAt: null, deliveredAt: null, completedAt: null, cancelledAt: null, refundedAt: null, trackingCarrier: null, trackingNumber: null, estimatedDeliveryAt: null }));
    expect(result.events).toEqual([{ status: "placed", at: "2026-10-26T00:00:00Z" }, { status: "paid", at: "2026-10-26T00:00:01Z" }]);
    expect(result.carrier).toBeNull(); expect(result.estimatedDeliveryAt).toBeNull();
  });
  it("trims optional shipment fields and converts the supplied date to UTC", () => {
    expect(shipmentInput("  ", "", "")).toEqual({});
    expect(shipmentInput(" Post ", " ABC ", "2026-10-28T12:00:00+07:00")).toEqual({ trackingCarrier: "Post", trackingNumber: "ABC", estimatedDeliveryAt: "2026-10-28T05:00:00.000Z" });
    expect(() => shipmentInput("a".repeat(81), "", "")).toThrow();
    expect(() => shipmentInput("", "a".repeat(101), "")).toThrow();
    expect(() => shipmentInput("", "", "invalid")).toThrow();
  });
});
