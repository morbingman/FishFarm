import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { beginCheckout, checkoutEstimate, finishCheckout, pendingCheckout } from "./checkout";
import type { Cart, CheckoutInput } from "./contracts";

const input: CheckoutInput = { recipientName: "Local User", phone: "0901234567", address: "Local address", paymentMethod: "bank_transfer" };
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("sessionStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } });
});
afterEach(() => vi.unstubAllGlobals());
describe("checkout recovery", () => {
  it("replays the saved key and exact input across retries and module reloads", async () => {
    const first = beginCheckout("local@example.test", input);
    expect(beginCheckout("local@example.test", { ...input, address: "Changed" })).toEqual(first);
    vi.resetModules();
    const reloaded = await import("./checkout");
    expect(reloaded.pendingCheckout("local@example.test")).toEqual(first);
    expect(reloaded.beginCheckout("local@example.test", input)).toEqual(first);
  });
  it("isolates attempts by account and only clears the matching operation", () => {
    const first = beginCheckout("a@example.test", input);
    const second = beginCheckout("b@example.test", input);
    expect(second.key).not.toBe(first.key);
    finishCheckout("a@example.test", second.key);
    expect(pendingCheckout("a@example.test")).toEqual(first);
    finishCheckout("a@example.test", first.key);
    expect(pendingCheckout("a@example.test")).toBeNull();
    expect(pendingCheckout("b@example.test")).toEqual(second);
    expect(beginCheckout("a@example.test", input).key).not.toBe(first.key);
  });
  it("does not send an operation when recovery cannot be stored", () => {
    vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: () => { throw new Error("Storage unavailable"); } });
    expect(() => beginCheckout("a@example.test", input)).toThrow("Storage unavailable");
  });
  it("blocks corrupt pending data instead of silently creating another checkout", () => {
    sessionStorage.setItem("fishfarm-checkout:a@example.test", "broken");
    expect(() => beginCheckout("a@example.test", input)).toThrow("Unreadable pending checkout");
  });
  it("matches backend integer deposit rounding and first-line terms", () => {
    const cart = { subtotal: 451, saleMode: "pre_order", items: [{ depositPct: 25 }, { depositPct: 30 }] } as Cart;
    expect(checkoutEstimate(cart)).toEqual({ dueNow: 113, balance: 338, pct: 25 });
    expect(checkoutEstimate({ ...cart, saleMode: "in_stock" })).toEqual({ dueNow: 451, balance: 0, pct: null });
  });
});
