import { describe, expect, it } from "vitest";
import { availableOrderActions, isOrderRoute, orderLabel, orderLink, paymentLabel } from "./orders";
import type { Order, OrderStatus } from "./contracts";
const now = Date.parse("2026-10-26T00:00:00Z");
const order = (input: Partial<Order> = {}) => ({ status: "paid", saleMode: "in_stock", paymentStatus: "paid", balanceDueAt: null, ...input }) as Order;
describe("owner order presentation rules", () => {
  it("offers cancellation only before shipment", () => {
    for (const status of ["pending_payment", "paid", "ready"] as OrderStatus[]) expect(availableOrderActions(order({ status }), now)).toContain("cancel");
    for (const status of ["shipped", "delivered", "completed", "cancelled", "refunded"] as OrderStatus[]) expect(availableOrderActions(order({ status }), now)).not.toContain("cancel");
  });
  it("requires a ready preorder, due balance and a future deadline for payment", () => {
    const due = order({ status: "ready", saleMode: "pre_order", paymentStatus: "balance_due", balanceDueAt: "2026-10-27T00:00:00Z" });
    expect(availableOrderActions(due, now)).toEqual(["cancel", "pay-balance"]);
    for (const change of [{ status: "paid" }, { saleMode: "in_stock" }, { paymentStatus: "paid" }, { paymentStatus: "refunded" }, { balanceDueAt: null }, { balanceDueAt: "invalid" }, { balanceDueAt: "2026-10-26T00:00:00Z" }, { balanceDueAt: "2026-10-25T00:00:00Z" }] as Partial<Order>[]) expect(availableOrderActions({ ...due, ...change }, now)).not.toContain("pay-balance");
  });
  it("offers receipt confirmation only when delivered, not when shipped", () => {
    expect(availableOrderActions(order({ status: "delivered" }), now)).toEqual(["confirm-delivery"]);
    expect(availableOrderActions(order({ status: "shipped" }), now)).toEqual([]);
    expect(availableOrderActions(order({ status: "completed" }), now)).toEqual([]);
  });
  it("recognizes canonical notification deep links without opening unrelated routes", () => {
    expect(orderLink("ORD-10122")).toBe("#marketplace/orders/ORD-10122");
    expect(orderLink("db/id")).toBe("#marketplace/orders/db%2Fid");
    expect(isOrderRoute("marketplace/orders")).toBe(true);
    expect(isOrderRoute("marketplace/orders/ORD-10122")).toBe(true);
    for (const route of ["marketplace/orders/", "marketplace/orders/ORD-1/extra", "company/orders/ORD-1", "https://example.test", "marketplace/orders-fake"]) expect(isOrderRoute(route)).toBe(false);
  });
  it("distinguishes deposit, balance, full payment and refund in both languages", () => {
    expect(paymentLabel("deposit_paid", "en")).toBe("Deposit paid");
    expect(paymentLabel("balance_due", "en")).toBe("Balance due");
    expect(paymentLabel("paid", "en")).toBe("Paid in full");
    expect(paymentLabel("refunded", "vi")).toBe("Đã hoàn tiền");
    expect(orderLabel("placed", "vi")).toBe("Đã đặt đơn");
    expect(orderLabel("ready", "en")).toBe("Ready");
  });
});
