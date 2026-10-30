import type { Sponsorship, SponsorshipStatus } from "./sponsorshipContracts";
import { BatchValidationError } from "./batches";

const ID = /^[A-Za-z0-9_-]{10,40}$/;

export function parseSponsorshipRoute(route: string): { sponsorshipId: string | null } | null {
  const value = route.startsWith("#") ? route.slice(1) : route;
  if (value === "marketplace/sponsorships") return { sponsorshipId: null };
  const match = /^marketplace\/sponsorships\/([A-Za-z0-9_-]{10,40})$/.exec(value);
  return match && match[0] === value ? { sponsorshipId: match[1] } : null;
}

export function sponsorshipRoute(id?: string): string {
  if (id === undefined) return "#marketplace/sponsorships";
  if (!ID.test(id) || /[\s\u0000-\u001f\u007f]/.test(id)) throw new BatchValidationError("id");
  return `#marketplace/sponsorships/${id}`;
}

export const sponsorshipStatuses: SponsorshipStatus[] = ["pending_payment", "funded", "growing", "ready_for_delivery", "delivered", "settled", "cancelled", "refunded"];

export function sponsorshipStatusLabel(status: SponsorshipStatus, vi: boolean): string {
  const labels: Record<SponsorshipStatus, [string, string]> = {
    pending_payment: ["Awaiting payment", "Chờ thanh toán"],
    funded: ["Funded", "Đã tài trợ"],
    growing: ["Growing", "Đang nuôi"],
    ready_for_delivery: ["Ready for delivery", "Sẵn sàng giao"],
    delivered: ["Delivered", "Đã giao"],
    settled: ["Settled", "Đã tất toán"],
    cancelled: ["Cancelled", "Đã hủy"],
    refunded: ["Refunded", "Đã hoàn tiền"],
  };
  return labels[status][vi ? 1 : 0];
}

export const canPaySponsorship = (status: SponsorshipStatus) => status === "pending_payment";
export const canCancelSponsorship = (status: SponsorshipStatus) => status === "pending_payment" || status === "funded";
export const canConfirmDelivery = (status: SponsorshipStatus) => status === "ready_for_delivery";

/** §11.4: unpaid reservations expire 24h after reservation; shares return to the pool.
 *  Mirrors the backend RESERVATION_TTL_MS — the deadline is derived, not stored. */
export const RESERVATION_TTL_MS = 24 * 60 * 60 * 1000;
export function reservationExpired(record: Pick<Sponsorship, "status" | "createdAt">, now = Date.now()): boolean {
  return record.status === "pending_payment" && Date.parse(record.createdAt) + RESERVATION_TTL_MS <= now;
}
export function reservationPayDeadline(record: Pick<Sponsorship, "status" | "createdAt">): string | null {
  return record.status === "pending_payment" ? new Date(Date.parse(record.createdAt) + RESERVATION_TTL_MS).toISOString() : null;
}

/** §11.4: the optional delivery fee charged at harvest sits outside escrow and
 *  must be paid before the sponsor can confirm delivery. */
export const deliveryFeeOutstanding = (record: Pick<Sponsorship, "status" | "deliveryFee" | "payments">): boolean =>
  record.status === "ready_for_delivery"
  && record.deliveryFee > 0
  && !record.payments.some(row => row.purpose === "delivery_fee" && row.state === "paid");

export function normalizeSponsorshipReason(reason: string): string {
  const value = reason.trim();
  if (value.length < 1 || value.length > 500) throw new BatchValidationError("reason");
  return value;
}

export function normalizeReservationInput(input: { shares: number; recipientName: string; phone: string; address: string; city?: string; province?: string; deliveryMethod?: string }) {
  if (!Number.isSafeInteger(input.shares) || input.shares < 1 || input.shares > 1_000_000) throw new BatchValidationError("shares");
  const shares = input.shares;
  const text = (value: string | undefined, max: number, required: boolean) => {
    const trimmed = (value ?? "").trim();
    if (required && trimmed.length < 1) throw new BatchValidationError("text");
    if (trimmed.length > max) throw new BatchValidationError("text");
    return trimmed || undefined;
  };
  return {
    shares,
    recipientName: text(input.recipientName, 120, true)!,
    phone: text(input.phone, 30, true)!,
    address: text(input.address, 200, true)!,
    city: text(input.city, 80, false),
    province: text(input.province, 80, false),
    deliveryMethod: text(input.deliveryMethod, 50, false),
  };
}

// The termsSnapshot is an immutable server copy; the sponsor reads it but the
// authoritative comparison for reconciliation is the sponsorship record itself.
export function snapshotCode(snapshot: Sponsorship["termsSnapshot"]): string | null {
  const value = snapshot.code;
  return typeof value === "string" && /^BATCH-[1-9]\d*$/.test(value) ? value : null;
}

// Payment and escrow totals must reconcile: tranches plus applied shortfall
// refunds sum exactly to the package amount (a shortfall reduces the harvest
// tranche and leaves the ledger as a refund, per §11.5).
export function escrowReconciles(sponsorship: Sponsorship): boolean {
  const total = sponsorship.escrowReleases.reduce((sum, tranche) => sum + tranche.amount, 0)
    + sponsorship.adjustments
      .filter(row => row.kind === "shortfall_refund" && row.status === "applied")
      .reduce((sum, row) => sum + row.amount, 0);
  return total === sponsorship.packageAmount;
}

export function retainedSponsorshipTerms(before: Sponsorship, after: Sponsorship): boolean {
  return JSON.stringify(before.termsSnapshot) === JSON.stringify(after.termsSnapshot)
    && before.shares === after.shares
    && before.packageAmount === after.packageAmount
    && before.totalAmount === after.totalAmount
    && before.recipientName === after.recipientName
    && before.address === after.address;
}
