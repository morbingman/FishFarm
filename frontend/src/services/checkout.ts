import type { Cart, CheckoutInput } from "./contracts";

export type CheckoutAttempt = { key: string; input: CheckoutInput };
const storageKey = (account: string) => `fishfarm-checkout:${account}`;
export function pendingCheckout(account: string): CheckoutAttempt | null {
  const raw = sessionStorage.getItem(storageKey(account));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as CheckoutAttempt;
    if (/^[A-Za-z0-9._:-]{8,80}$/.test(value.key) && value.input
      && [value.input.recipientName, value.input.phone, value.input.address].every((field) => typeof field === "string")
      && ["bank_card", "e_wallet", "bank_transfer"].includes(value.input.paymentMethod)) return value;
  } catch {}
  throw new Error("Unreadable pending checkout. Restore this tab's session data before placing another order.");
}
export function beginCheckout(account: string, input: CheckoutInput): CheckoutAttempt {
  const existing = pendingCheckout(account);
  if (existing) return existing;
  const attempt = { key: crypto.randomUUID(), input: { ...input } };
  // Persist before sending: a lost response must replay the same buyer-scoped operation.
  sessionStorage.setItem(storageKey(account), JSON.stringify(attempt));
  return attempt;
}
export function finishCheckout(account: string, key: string) {
  if (pendingCheckout(account)?.key === key) sessionStorage.removeItem(storageKey(account));
}
export function checkoutEstimate(cart: Cart) {
  const pct = cart.saleMode === "pre_order" ? cart.items[0]?.depositPct : null;
  const dueNow = cart.saleMode === "pre_order" && pct != null ? Math.round(cart.subtotal * pct / 100) : cart.subtotal;
  return { dueNow, balance: cart.subtotal - dueNow, pct };
}
