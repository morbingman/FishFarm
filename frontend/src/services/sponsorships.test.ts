import { describe, expect, it } from "vitest";
import type { Sponsorship } from "./sponsorshipContracts";
import { canCancelSponsorship, canConfirmDelivery, canPaySponsorship, deliveryFeeOutstanding, escrowReconciles, normalizeReservationInput, normalizeSponsorshipReason, parseSponsorshipRoute, reservationExpired, reservationPayDeadline, retainedSponsorshipTerms, snapshotCode, sponsorshipRoute, sponsorshipStatusLabel, sponsorshipStatuses } from "./sponsorships";
import { BatchValidationError } from "./batches";

const at = "2026-10-28T00:00:00.000Z";
const tranches = () => [
  { id: "tranche00001", milestone: "stocking" as const, amount: 60, state: "held" as const, releasedAt: null, createdAt: at },
  { id: "tranche00002", milestone: "mid_growth" as const, amount: 80, state: "held" as const, releasedAt: null, createdAt: at },
  { id: "tranche00003", milestone: "harvest" as const, amount: 60, state: "held" as const, releasedAt: null, createdAt: at },
];
const sponsorship = (status: Sponsorship["status"] = "pending_payment"): Sponsorship => ({
  id: "sponsorship0001", batchId: "internalbatch01",
  sponsor: { id: "user1account01", name: "User", email: "user@example.test", phone: "0900000000" },
  batch: { id: "internalbatch01", code: "BATCH-1024", title: "Pond fish", species: "Tilapia", status: "open", location: "Farm pond", region: "South", shareUnitType: "count", shareUnit: "10 fish", shareQuantity: 10, stockingDate: null, expectedHarvestDate: null, images: [{ id: "image1", url: "/uploads/pond.png" }] },
  shares: 2, packageAmount: 200, deliveryFee: 0, totalAmount: 200, status,
  recipientName: "User", phone: "0900000000", address: "12 Street", city: null, province: null, deliveryMethod: null,
  termsSnapshot: { code: "BATCH-1024", termsVersion: "v1", packagePricePerShare: 100, riskDisclosure: "Growth risks apply.", contingencyPct: 10 },
  paidAt: status === "pending_payment" || status === "cancelled" ? null : at, growingAt: null, readyAt: null, deliveredAt: null, settledAt: null,
  cancelledAt: status === "cancelled" || status === "refunded" ? at : null, refundedAt: status === "refunded" ? at : null,
  createdAt: at, updatedAt: at,
  payments: status === "pending_payment" || status === "cancelled" ? [] : [{ id: "payment00001", purpose: "sponsorship_package", method: "e_wallet", amount: 200, state: status === "refunded" ? "refunded" : "paid", createdAt: at, paidAt: at, refundedAt: status === "refunded" ? at : null }],
  escrowReleases: status === "pending_payment" || status === "cancelled" ? [] : tranches().map(t => status === "refunded" ? { ...t, state: "reversed" as const } : t),
  adjustments: [],
});

describe("sponsorship helpers", () => {
  it("parses only the canonical list and detail sponsorship routes", () => {
    expect(parseSponsorshipRoute("marketplace/sponsorships")).toEqual({ sponsorshipId: null });
    expect(parseSponsorshipRoute("#marketplace/sponsorships/sponsorship0001")).toEqual({ sponsorshipId: "sponsorship0001" });
    for (const route of ["", "#", "marketplace", "marketplace/sponsorships/", "marketplace/sponsorships/short", "marketplace/sponsorships/sponsorship0001/extra", "marketplace/sponsorships/sponsorship0001?x=1", "marketplace/sponsorships/internal1", "marketplace/sponsorships/sponsorship0001\n", "marketplace/orders", "farming"]) expect(parseSponsorshipRoute(route)).toBeNull();
  });
  it("builds canonical routes and rejects unsafe identifiers", () => {
    expect(sponsorshipRoute()).toBe("#marketplace/sponsorships");
    expect(sponsorshipRoute("sponsorship0001")).toBe("#marketplace/sponsorships/sponsorship0001");
    for (const id of ["short", "has space", "sponsorship0001\n", "sponsorship0001/..", ""]) expect(() => sponsorshipRoute(id)).toThrow(BatchValidationError);
  });
  it("allows payment only while unpaid and cancellation before growing", () => {
    expect(canPaySponsorship("pending_payment")).toBe(true);
    for (const status of ["funded", "growing", "ready_for_delivery", "delivered", "settled", "cancelled", "refunded"] as const) expect(canPaySponsorship(status)).toBe(false);
    expect(canCancelSponsorship("pending_payment")).toBe(true);
    expect(canCancelSponsorship("funded")).toBe(true);
    for (const status of ["growing", "ready_for_delivery", "delivered", "settled", "cancelled", "refunded"] as const) expect(canCancelSponsorship(status)).toBe(false);
  });
  it("labels every status in both languages", () => {
    for (const status of ["pending_payment", "funded", "growing", "ready_for_delivery", "delivered", "settled", "cancelled", "refunded"] as const) {
      expect(sponsorshipStatusLabel(status, false)).not.toBe(sponsorshipStatusLabel(status, true));
      expect(sponsorshipStatusLabel(status, true).length).toBeGreaterThan(0);
    }
  });
  it("derives the 24-hour pay deadline for unpaid reservations only", () => {
    expect(reservationPayDeadline(sponsorship("pending_payment"))).toBe("2026-10-29T00:00:00.000Z");
    for (const status of ["funded", "growing", "ready_for_delivery", "delivered", "settled", "cancelled", "refunded"] as const) {
      expect(reservationPayDeadline(sponsorship(status))).toBeNull();
      expect(reservationExpired(sponsorship(status), Date.parse(at) + 25 * 60 * 60 * 1000)).toBe(false);
    }
    expect(reservationExpired(sponsorship("pending_payment"), Date.parse(at) + 24 * 60 * 60 * 1000)).toBe(true);
    expect(reservationExpired(sponsorship("pending_payment"), Date.parse(at) + 24 * 60 * 60 * 1000 - 1)).toBe(false);
  });
  it("normalizes cancellation reasons within 1–500 characters", () => {
    expect(normalizeSponsorshipReason("  Changed plans.  ")).toBe("Changed plans.");
    for (const reason of ["", " ", "x".repeat(501)]) expect(() => normalizeSponsorshipReason(reason)).toThrow(BatchValidationError);
    expect(normalizeSponsorshipReason("x".repeat(500))).toBe("x".repeat(500));
  });
  it("normalizes reservation input with strict bounds", () => {
    const result = normalizeReservationInput({ shares: 2.0, recipientName: " User ", phone: " 090 ", address: " 12 Street ", city: " ", province: undefined, deliveryMethod: " cold_chain " });
    expect(result).toEqual({ shares: 2, recipientName: "User", phone: "090", address: "12 Street", city: undefined, deliveryMethod: "cold_chain" });
    for (const bad of [{ shares: 0 }, { shares: 1.5 }, { recipientName: "" }, { phone: "" }, { address: " ".repeat(1) }] as const) {
      expect(() => normalizeReservationInput({ shares: bad.shares ?? 1, recipientName: bad.recipientName ?? "U", phone: bad.phone ?? "090", address: bad.address ?? "A" })).toThrow(BatchValidationError);
    }
    expect(() => normalizeReservationInput({ shares: 1, recipientName: "x".repeat(121), phone: "090", address: "A" })).toThrow(BatchValidationError);
  });
  it("extracts the snapshot batch code only from matching snapshots", () => {
    expect(snapshotCode(sponsorship().termsSnapshot)).toBe("BATCH-1024");
    expect(snapshotCode({ code: "BATCH-0" })).toBeNull();
    expect(snapshotCode({})).toBeNull();
  });
  it("reconciles escrow only when tranches sum exactly to the package", () => {
    expect(escrowReconciles(sponsorship("funded"))).toBe(true);
    const short = sponsorship("funded");
    short.escrowReleases[2].amount = 59;
    expect(escrowReconciles(short)).toBe(false);
    // An unpaid reservation has no escrow yet, so there is nothing to reconcile.
    expect(escrowReconciles(sponsorship("pending_payment"))).toBe(false);
  });
  it("reconciles escrow when an applied shortfall refund reduces the harvest tranche", () => {
    const short = sponsorship("funded");
    short.escrowReleases[2].amount = 40;
    short.adjustments = [{ id: "adjustment001", kind: "shortfall_refund", amount: 20, reason: "Shortfall against the promised count", status: "applied", createdAt: at, appliedAt: at }];
    expect(escrowReconciles(short)).toBe(true);
    // Only applied shortfall refunds count toward the ledger identity.
    expect(escrowReconciles({ ...short, adjustments: [{ ...short.adjustments[0], status: "pending" }] })).toBe(false);
    expect(escrowReconciles({ ...short, adjustments: [{ ...short.adjustments[0], kind: "extra_charge" }] })).toBe(false);
    expect(escrowReconciles({ ...short, adjustments: [{ ...short.adjustments[0], amount: 21 }] })).toBe(false);
  });
  it("gates delivery confirmation on the ready_for_delivery status only", () => {
    for (const status of sponsorshipStatuses) expect(canConfirmDelivery(status)).toBe(status === "ready_for_delivery");
  });
  it("marks the delivery fee outstanding only until its paid payment exists on a ready record", () => {
    const feePayment = (state = "paid", id = "payment00002") => ({ id, purpose: "delivery_fee", method: "e_wallet", amount: 40, state, createdAt: at, paidAt: state === "paid" ? at : null, refundedAt: state === "refunded" ? at : null });
    const ready = { ...sponsorship("ready_for_delivery"), deliveryFee: 40, totalAmount: 240, growingAt: at, readyAt: at };
    expect(deliveryFeeOutstanding(ready)).toBe(true);
    expect(deliveryFeeOutstanding({ ...ready, payments: [...ready.payments, feePayment()] })).toBe(false);
    // Only a paid fee clears the outstanding flag; refunded or pending states do not.
    expect(deliveryFeeOutstanding({ ...ready, payments: [...ready.payments, feePayment("refunded")] })).toBe(true);
    expect(deliveryFeeOutstanding({ ...ready, payments: [...ready.payments, feePayment("pending")] })).toBe(true);
    expect(deliveryFeeOutstanding({ ...ready, deliveryFee: 0, totalAmount: 200 })).toBe(false);
    for (const status of sponsorshipStatuses.filter(value => value !== "ready_for_delivery")) {
      expect(deliveryFeeOutstanding({ ...sponsorship(status), deliveryFee: 40, totalAmount: 240 })).toBe(false);
    }
  });
  it("compares retained terms by content and identity fields", () => {
    expect(retainedSponsorshipTerms(sponsorship(), sponsorship())).toBe(true);
    expect(retainedSponsorshipTerms(sponsorship(), { ...sponsorship(), shares: 3 })).toBe(false);
    expect(retainedSponsorshipTerms(sponsorship(), { ...sponsorship(), totalAmount: 300 })).toBe(false);
    expect(retainedSponsorshipTerms(sponsorship(), { ...sponsorship(), termsSnapshot: { ...sponsorship().termsSnapshot, termsVersion: "v2" } })).toBe(false);
    expect(retainedSponsorshipTerms(sponsorship(), { ...sponsorship(), recipientName: "Other" })).toBe(false);
  });
});
