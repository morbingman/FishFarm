import { api, ApiError, apiSessionStamp, isApiSession } from "./api";
import { BatchValidationError, isRecord, safeInteger, validBatchDate, validBatchIdentifier, validBatchMediaUrl } from "./batches";
import type { BatchGrowResult, BatchHarvestResult, EscrowMilestone, EscrowState, PaymentMethod, Sponsorship, SponsorshipEscrow, SponsorshipLedgerEntry, SponsorshipLedgerPage, SponsorshipPage, SponsorshipStatus } from "./sponsorshipContracts";
import { paymentMethods } from "./sponsorshipContracts";
import { canCancelSponsorship, canConfirmDelivery, canPaySponsorship, escrowReconciles, normalizeReservationInput, normalizeSponsorshipReason, retainedSponsorshipTerms, sponsorshipStatuses, snapshotCode } from "./sponsorships";

function fail(): never { throw new ApiError(502, "sponsorship.invalidResponse"); }
const text = (v: unknown, min = 1, max = Number.MAX_SAFE_INTEGER): v is string => typeof v === "string" && v.trim().length >= min && v.length <= max;
const nullableText = (v: unknown, max = Number.MAX_SAFE_INTEGER) => v === null || text(v, 0, max);
const date = (v: unknown): v is string => validBatchDate(v) && v.length > 10;
const nullableDate = (v: unknown) => v === null || date(v);
const SPONSORSHIP_ID = /^[A-Za-z0-9_-]{10,40}$/;
const keys = ["id", "batchId", "sponsor", "batch", "shares", "packageAmount", "deliveryFee", "totalAmount", "status", "recipientName", "phone", "address", "city", "province", "deliveryMethod", "termsSnapshot", "paidAt", "growingAt", "readyAt", "deliveredAt", "settledAt", "cancelledAt", "refundedAt", "createdAt", "updatedAt", "payments", "escrowReleases", "adjustments"];
function object(v: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!isRecord(v) || Object.keys(v).some(key => !allowed.includes(key))) return fail(); return v;
}
function array(v: unknown, max = Number.MAX_SAFE_INTEGER): unknown[] { if (!Array.isArray(v) || v.length > max) return fail(); return v; }
function immutableId<T extends { id: string }>(v: T): T { Object.defineProperty(v, "id", { writable: false, configurable: false }); return v; }

function sponsorshipId(v: unknown): string {
  if (typeof v !== "string" || !SPONSORSHIP_ID.test(v)) fail();
  return v;
}
function batchSummary(value: unknown): Sponsorship["batch"] {
  const v = object(value, ["id", "code", "title", "species", "status", "location", "region", "shareUnitType", "shareUnit", "shareQuantity", "stockingDate", "expectedHarvestDate", "images"]);
  if (!validBatchIdentifier(v.id) || typeof v.code !== "string" || !/^BATCH-[1-9]\d*$/.test(v.code) || !text(v.title, 1, 120) || !text(v.species, 1, 80) || !text(v.location, 1, 120) || !text(v.region, 1, 80) || !["weight", "count"].includes(v.shareUnitType as string) || !text(v.shareUnit) || !(v.shareQuantity === null || safeInteger(v.shareQuantity, 1)) || !nullableDate(v.stockingDate) || !nullableDate(v.expectedHarvestDate)) fail();
  v.images = array(v.images, 1).map(row => {
    const img = object(row, ["id", "url"]);
    if (!validBatchIdentifier(img.id) || !validBatchMediaUrl(img.url)) fail();
    return immutableId(img as { id: string; url: string });
  });
  return immutableId(v as unknown as Sponsorship["batch"]);
}
function payment(value: unknown): Sponsorship["payments"][number] {
  const v = object(value, ["id", "purpose", "method", "amount", "state", "createdAt", "paidAt", "refundedAt"]);
  if (typeof v.id !== "string" || v.id.length < 8 || !text(v.purpose) || !text(v.method) || !safeInteger(v.amount) || !text(v.state) || !date(v.createdAt) || !nullableDate(v.paidAt) || !nullableDate(v.refundedAt)) fail();
  return immutableId(v as unknown as Sponsorship["payments"][number]);
}
function tranche(value: unknown): Sponsorship["escrowReleases"][number] {
  const v = object(value, ["id", "milestone", "amount", "state", "releasedAt", "createdAt"]);
  const milestones: EscrowMilestone[] = ["stocking", "mid_growth", "pre_harvest", "harvest"];
  const states: EscrowState[] = ["held", "released", "reversed"];
  if (typeof v.id !== "string" || v.id.length < 8 || !milestones.includes(v.milestone as EscrowMilestone) || !safeInteger(v.amount) || !states.includes(v.state as EscrowState) || !nullableDate(v.releasedAt) || !date(v.createdAt)) fail();
  return immutableId(v as unknown as Sponsorship["escrowReleases"][number]);
}
function adjustment(value: unknown): Sponsorship["adjustments"][number] {
  const v = object(value, ["id", "kind", "amount", "reason", "status", "createdAt", "appliedAt"]);
  const kinds = ["refund", "shortfall_refund", "extra_charge", "escrow_reversal"];
  if (typeof v.id !== "string" || v.id.length < 8 || !kinds.includes(v.kind as string) || !safeInteger(v.amount, 1) || !text(v.reason, 1, 500) || typeof v.status !== "string" || !v.status.length || !date(v.createdAt) || !nullableDate(v.appliedAt)) fail();
  return immutableId(v as unknown as Sponsorship["adjustments"][number]);
}
export function validateSponsorship(value: unknown): Sponsorship {
  const v = object(value, keys);
  if (!SPONSORSHIP_ID.test(v.id as string) || typeof v.batchId !== "string" || v.batchId.length < 8) fail();
  const sponsor = object(v.sponsor, ["id", "name", "email", "phone"]);
  if (typeof sponsor.id !== "string" || sponsor.id.length < 8 || !text(sponsor.name, 1, 120) || !text(sponsor.email, 3, 254) || !text(sponsor.phone, 1, 30)) fail();
  if (!safeInteger(v.shares, 1) || !safeInteger(v.packageAmount, 1) || !safeInteger(v.deliveryFee, 0) || !safeInteger(v.totalAmount, 1)) fail();
  if (v.totalAmount !== (v.packageAmount as number) + (v.deliveryFee as number)) fail();
  if (!sponsorshipStatuses.includes(v.status as SponsorshipStatus)) fail();
  if (!text(v.recipientName, 1, 120) || !text(v.phone, 1, 30) || !text(v.address, 1, 200) || !nullableText(v.city, 80) || !nullableText(v.province, 80) || !nullableText(v.deliveryMethod, 50)) fail();
  if (!isRecord(v.termsSnapshot) || typeof v.termsSnapshot.code !== "string" || !/^BATCH-[1-9]\d*$/.test(v.termsSnapshot.code) || typeof v.termsSnapshot.termsVersion !== "string" || !(v.termsSnapshot.termsVersion as string).length || typeof v.termsSnapshot.packagePricePerShare !== "number" || !Number.isSafeInteger(v.termsSnapshot.packagePricePerShare) || typeof v.termsSnapshot.riskDisclosure !== "string" || !(v.termsSnapshot.riskDisclosure as string).length) fail();
  if (!nullableDate(v.paidAt) || !nullableDate(v.growingAt) || !nullableDate(v.readyAt) || !nullableDate(v.deliveredAt) || !nullableDate(v.settledAt) || !nullableDate(v.cancelledAt) || !nullableDate(v.refundedAt) || !date(v.createdAt) || !date(v.updatedAt)) fail();
  if ((v.status === "funded" || v.status === "growing") && v.paidAt === null) fail();
  if (v.status === "growing" && v.growingAt === null) fail();
  if (v.status === "ready_for_delivery" && (v.growingAt === null || v.readyAt === null)) fail();
  if (v.status === "delivered" && (v.readyAt === null || v.deliveredAt === null)) fail();
  if (v.status === "settled" && (v.deliveredAt === null || v.settledAt === null)) fail();
  if ((v.status === "cancelled" || v.status === "refunded") && v.cancelledAt === null) fail();
  v.sponsor = immutableId(sponsor as { id: string; name: string; email: string; phone: string });
  v.batch = batchSummary(v.batch);
  v.payments = unique(array(v.payments, 10).map(payment));
  v.escrowReleases = unique(array(v.escrowReleases, 4).map(tranche));
  v.adjustments = unique(array(v.adjustments, 10).map(adjustment));
  // Only money that actually moved (funded onward, or refunded after funding) has payments.
  const status = v.status as SponsorshipStatus;
  const everFunded = status === "funded" || status === "growing" || status === "ready_for_delivery" || status === "delivered" || status === "settled" || status === "refunded";
  if (everFunded && (v.payments as unknown[]).length < 1) fail();
  if (!everFunded && ((v.payments as unknown[]).length || (v.escrowReleases as unknown[]).length)) fail();
  const record = v as unknown as Sponsorship;
  if (record.escrowReleases.length && !escrowReconciles(record)) fail();
  if (snapshotCode(record.termsSnapshot) !== record.batch.code) fail();
  return immutableId(record);
}
function unique<T extends { id: string }>(values: T[]): T[] { if (new Set(values.map(v => v.id)).size !== values.length) fail(); return values; }

const LEDGER_PURPOSES = ["sponsorship_package", "delivery_fee", "refund"] as const;
const LEDGER_STATES = ["paid", "refunded"] as const;
const LEDGER_KEYS = ["id", "sponsorshipId", "shares", "sponsorshipStatus", "batchCode", "batchTitle", "purpose", "method", "amount", "state", "createdAt", "paidAt", "refundedAt"];

// §11 owner history: sponsorship payments are the ledger source; the module only
// ever creates paid or refunded rows, so anything else is a foreign shape.
function validateLedgerEntry(value: unknown): SponsorshipLedgerEntry {
  const v = object(value, LEDGER_KEYS);
  if (typeof v.id !== "string" || v.id.length < 8 || !SPONSORSHIP_ID.test(v.sponsorshipId as string)) fail();
  if (!safeInteger(v.shares, 1) || typeof v.batchCode !== "string" || !/^BATCH-[1-9]\d*$/.test(v.batchCode) || !text(v.batchTitle, 1, 120)) fail();
  if (!LEDGER_PURPOSES.includes(v.purpose as typeof LEDGER_PURPOSES[number]) || !text(v.method) || !safeInteger(v.amount, 1)) fail();
  if (!LEDGER_STATES.includes(v.state as typeof LEDGER_STATES[number]) || !sponsorshipStatuses.includes(v.sponsorshipStatus as SponsorshipStatus)) fail();
  if (!date(v.createdAt) || !nullableDate(v.paidAt) || !nullableDate(v.refundedAt)) fail();
  if (v.state === "paid" && (v.paidAt === null || v.refundedAt !== null)) fail();
  if (v.state === "refunded" && v.refundedAt === null) fail();
  // Shortfall refunds are refund-purpose rows never marked paid; package and fee
  // refunds flip the original paid row, keeping paidAt.
  if (v.purpose === "refund" && v.paidAt !== null) fail();
  if (v.purpose !== "refund" && v.state === "refunded" && v.paidAt === null) fail();
  return immutableId(v as unknown as SponsorshipLedgerEntry);
}

function requestedId(id: string): string {
  if (!SPONSORSHIP_ID.test(id) || /[\s\u0000-\u001f\u007f]/.test(id)) throw new BatchValidationError("id");
  return id;
}

function normalizeHarvestInput(input: { actualCount: number; actualWeightG?: number; deliveryFeePerShare?: number }) {
  if (!Number.isSafeInteger(input.actualCount) || input.actualCount < 1 || input.actualCount > 1_000_000_000) throw new BatchValidationError("actualCount");
  if (input.actualWeightG !== undefined && (!Number.isSafeInteger(input.actualWeightG) || input.actualWeightG < 1 || input.actualWeightG > 2_000_000_000)) throw new BatchValidationError("actualWeightG");
  if (input.deliveryFeePerShare !== undefined && (!Number.isSafeInteger(input.deliveryFeePerShare) || input.deliveryFeePerShare < 0 || input.deliveryFeePerShare > 1_000_000_000)) throw new BatchValidationError("deliveryFeePerShare");
  return {
    actualCount: input.actualCount,
    ...(input.actualWeightG !== undefined ? { actualWeightG: input.actualWeightG } : {}),
    ...(input.deliveryFeePerShare !== undefined ? { deliveryFeePerShare: input.deliveryFeePerShare } : {}),
  };
}

let pendingMutation = false;
async function mutation<T>(action: () => Promise<T>): Promise<T> {
  if (pendingMutation) throw new ApiError(409, "sponsorship.requestPending");
  pendingMutation = true; try { return await action(); } finally { pendingMutation = false; }
}

export const sponsorshipsApi = {
  mine: async (signal?: AbortSignal): Promise<SponsorshipPage> => {
    const v = object(await api<unknown>("/me/sponsorships", { signal }), ["items", "total"]);
    if (!safeInteger(v.total, 0)) fail();
    const rows = unique(array(v.items).map(validateSponsorship));
    if (rows.length > v.total) fail();
    return { items: rows, total: v.total };
  },
  ledger: async (skip?: number, take?: number, signal?: AbortSignal): Promise<SponsorshipLedgerPage> => {
    if (skip !== undefined && (!Number.isSafeInteger(skip) || skip < 1 || skip > 10_000)) throw new BatchValidationError("skip");
    if (take !== undefined && (!Number.isSafeInteger(take) || take < 1 || take > 100)) throw new BatchValidationError("take");
    const query = [skip !== undefined ? `skip=${skip}` : "", take !== undefined ? `take=${take}` : ""].filter(Boolean).join("&");
    const v = object(await api<unknown>(`/me/sponsorships/ledger${query ? `?${query}` : ""}`, { signal }), ["items", "total"]);
    if (!safeInteger(v.total, 0)) fail();
    const rows = unique(array(v.items).map(validateLedgerEntry));
    if (rows.length > v.total) fail();
    return { items: rows, total: v.total };
  },
  detail: async (id: string, signal?: AbortSignal): Promise<Sponsorship> => {
    const value = validateSponsorship(await api<unknown>(`/sponsorships/${requestedId(id)}`, { signal }));
    if (value.id !== id) fail();
    return value;
  },
  escrow: async (id: string, signal?: AbortSignal): Promise<SponsorshipEscrow> => {
    const v = object(await api<unknown>(`/sponsorships/${requestedId(id)}/escrow`, { signal }), ["sponsorshipId", "packageAmount", "tranches", "held", "released", "reversed"]);
    if (v.sponsorshipId !== id || !safeInteger(v.packageAmount, 1) || !safeInteger(v.held, 0) || !safeInteger(v.released, 0) || !safeInteger(v.reversed, 0)) fail();
    const tranches = unique(array(v.tranches, 4).map(tranche));
    const sum = (state: EscrowState) => tranches.filter(t => t.state === state).reduce((total, t) => total + t.amount, 0);
    // A shortfall refund leaves the ledger with the refund, so the tranche sum can
    // be below the package amount; it can never exceed it.
    if (v.held !== sum("held") || v.released !== sum("released") || v.reversed !== sum("reversed") || tranches.reduce((total, t) => total + t.amount, 0) > v.packageAmount) fail();
    return { sponsorshipId: v.sponsorshipId as string, packageAmount: v.packageAmount as number, tranches, held: v.held as number, released: v.released as number, reversed: v.reversed as number };
  },
  reserve: (batchCode: string, input: { shares: number; recipientName: string; phone: string; address: string; city?: string; province?: string; deliveryMethod?: string }): Promise<Sponsorship> => mutation(async () => {
    const body = normalizeReservationInput(input);
    if (!/^BATCH-[1-9]\d*$/.test(batchCode)) throw new BatchValidationError("code");
    const stamp = apiSessionStamp();
    const value = validateSponsorship(await api<unknown>(`/batches/${batchCode}/sponsorships`, { method: "POST", body: JSON.stringify(body) }, false));
    if (stamp !== null ? !isApiSession(stamp) : apiSessionStamp() !== null) throw new ApiError(401, "auth.sessionChanged");
    if (value.status !== "pending_payment" || value.paidAt !== null || value.shares !== body.shares || value.batch.code !== batchCode || value.escrowReleases.length) fail();
    return value;
  }),
  pay: (id: string, method: PaymentMethod): Promise<Sponsorship> => mutation(async () => {
    if (!paymentMethods.includes(method)) throw new BatchValidationError("paymentMethod");
    const path = `/sponsorships/${requestedId(id)}/pay`, stamp = apiSessionStamp();
    const value = validateSponsorship(await api<unknown>(path, { method: "POST", body: JSON.stringify({ paymentMethod: method }) }, false));
    if (stamp !== null ? !isApiSession(stamp) : apiSessionStamp() !== null) throw new ApiError(401, "auth.sessionChanged");
    // A batch that is already growing accepts the payment straight into growing
    // (stocking escrow released); otherwise the record lands as funded.
    const okPay = value.id === id && value.paidAt !== null
      && (value.status === "funded" || (value.status === "growing" && value.growingAt !== null))
      && value.payments.length === 1 && value.payments[0].amount === value.packageAmount
      && value.payments[0].purpose === "sponsorship_package" && value.escrowReleases.length > 0
      && escrowReconciles(value);
    if (!okPay) fail();
    return value;
  }),
  confirmDelivery: (id: string): Promise<Sponsorship> => mutation(async () => {
    const path = `/sponsorships/${requestedId(id)}/confirm-delivery`, stamp = apiSessionStamp();
    const value = validateSponsorship(await api<unknown>(path, { method: "POST", body: JSON.stringify({}) }, false));
    if (stamp !== null ? !isApiSession(stamp) : apiSessionStamp() !== null) throw new ApiError(401, "auth.sessionChanged");
    const okDelivery = value.id === id && value.deliveredAt !== null
      && (value.status === "delivered" || (value.status === "settled" && value.settledAt !== null));
    if (!okDelivery) fail();
    return value;
  }),
  // §11.4: the harvest-time delivery fee sits outside escrow and is paid
  // separately before confirm-delivery; the fixed backend idempotency key makes
  // a replay return the same record with exactly one paid fee payment.
  payDeliveryFee: (id: string, method: PaymentMethod): Promise<Sponsorship> => mutation(async () => {
    if (!paymentMethods.includes(method)) throw new BatchValidationError("paymentMethod");
    const path = `/sponsorships/${requestedId(id)}/pay-delivery-fee`, stamp = apiSessionStamp();
    const value = validateSponsorship(await api<unknown>(path, { method: "POST", body: JSON.stringify({ paymentMethod: method }) }, false));
    if (stamp !== null ? !isApiSession(stamp) : apiSessionStamp() !== null) throw new ApiError(401, "auth.sessionChanged");
    const feePayments = value.payments.filter(row => row.purpose === "delivery_fee" && row.state === "paid" && row.paidAt !== null);
    const okFee = value.id === id && value.status === "ready_for_delivery" && value.deliveryFee > 0
      && feePayments.length === 1 && feePayments[0].amount === value.deliveryFee
      && value.payments.some(row => row.purpose === "sponsorship_package" && row.state === "paid");
    if (!okFee) fail();
    return value;
  }),
  companyGrow: (code: string): Promise<BatchGrowResult> => mutation(async () => {
    if (!/^BATCH-[1-9]\d*$/.test(code)) throw new BatchValidationError("code");
    const stamp = apiSessionStamp();
    const v = object(await api<unknown>(`/company/batches/${code}/grow`, { method: "POST", body: JSON.stringify({}) }, false), ["batch"]);
    if (stamp !== null ? !isApiSession(stamp) : apiSessionStamp() !== null) throw new ApiError(401, "auth.sessionChanged");
    const batch = object(v.batch, ["id", "code", "title", "status", "sharesAvailable", "stockCount", "stockingDate"]);
    if (!validBatchIdentifier(batch.id) || batch.code !== code || batch.status !== "growing" || !text(batch.title, 1, 120) || !safeInteger(batch.sharesAvailable, 0) || !safeInteger(batch.stockCount, 1) || !nullableDate(batch.stockingDate)) fail();
    return { batch: batch as unknown as BatchGrowResult["batch"] };
  }),
  companyHarvest: (code: string, input: { actualCount: number; actualWeightG?: number; deliveryFeePerShare?: number }): Promise<BatchHarvestResult> => mutation(async () => {
    const body = normalizeHarvestInput(input);
    if (!/^BATCH-[1-9]\d*$/.test(code)) throw new BatchValidationError("code");
    const stamp = apiSessionStamp();
    const v = object(await api<unknown>(`/company/batches/${code}/harvest`, { method: "POST", body: JSON.stringify(body) }, false), ["batch", "harvest"]);
    if (stamp !== null ? !isApiSession(stamp) : apiSessionStamp() !== null) throw new ApiError(401, "auth.sessionChanged");
    const batch = object(v.batch, ["id", "code", "status"]);
    const harvest = object(v.harvest, ["id", "batchId", "harvestedAt", "actualCount", "actualWeightG", "yieldPerShare", "mortalityRateBps", "status", "publishedAt", "createdAt", "updatedAt"]);
    if (!validBatchIdentifier(batch.id) || batch.code !== code || batch.status !== "harvested") fail();
    if (typeof harvest.id !== "string" || harvest.id.length < 8 || typeof harvest.batchId !== "string" || harvest.batchId.length < 8 || !date(harvest.harvestedAt)) fail();
    if (!safeInteger(harvest.actualCount, 1) || !(harvest.actualWeightG === null || safeInteger(harvest.actualWeightG, 1)) || !safeInteger(harvest.mortalityRateBps, 0) || (harvest.mortalityRateBps as number) > 10_000) fail();
    if (harvest.status !== "published" || !nullableDate(harvest.publishedAt) || !date(harvest.createdAt) || !date(harvest.updatedAt) || !(harvest.yieldPerShare === null || text(harvest.yieldPerShare, 1, 80))) fail();
    return { batch: batch as unknown as BatchHarvestResult["batch"], harvest: harvest as unknown as BatchHarvestResult["harvest"] };
  }),
  cancel: (id: string, reason: string): Promise<Sponsorship> => mutation(async () => {
    const normalized = normalizeSponsorshipReason(reason);
    const path = `/sponsorships/${requestedId(id)}/cancel`, stamp = apiSessionStamp();
    const value = validateSponsorship(await api<unknown>(path, { method: "POST", body: JSON.stringify({ reason: normalized }) }, false));
    if (stamp !== null ? !isApiSession(stamp) : apiSessionStamp() !== null) throw new ApiError(401, "auth.sessionChanged");
    if (value.id !== id || value.cancelledAt === null || (value.status !== "cancelled" && value.status !== "refunded")) fail();
    if (value.status === "refunded" && (value.refundedAt === null || !value.payments.some(row => row.state === "refunded") || value.escrowReleases.some(row => row.state === "held"))) fail();
    if (value.status === "cancelled" && (value.refundedAt !== null || value.payments.some(row => row.state === "refunded"))) fail();
    return value;
  }),
};

// Retained for reconciliation in the page: a saved record must keep its terms.
export { retainedSponsorshipTerms, canPaySponsorship, canCancelSponsorship, canConfirmDelivery };
