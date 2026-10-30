import { describe, expect, it } from "vitest";
import type { CompanyBatch } from "./batchContracts";
import { batchReviewRoute, canReviewBatch, normalizeBatchReviewNote, parseBatchReviewRoute, reconciledBatchDecision, retainedBatchObservations } from "./batchReview";
import { BatchValidationError } from "./batches";

const at = "2026-10-28T00:00:00.000Z";
const batch = (status: CompanyBatch["status"] = "pending_review"): CompanyBatch => ({
  id: "BATCH-1024", title: "Pond fish", species: "Tilapia", breed: null, description: "A complete description of this batch.", location: "Farm pond", region: "South", status,
  stockingDate: null, expectedHarvestDate: null, stockCount: 100, shareUnitType: "count", shareUnit: "10 fish", shareQuantity: 10, expectedHarvestWeightG: null, totalShares: 10, sharesAvailable: 10, packagePricePerShare: 100, contingencyPct: 10, riskDisclosure: "Growth and harvest are subject to natural risks.", termsVersion: "v1",
  images: [{ id: "image1", batchId: "internal1", url: "/uploads/pond.png", position: 0, isMain: true, createdAt: at }], costs: [], updates: [], createdAt: at, updatedAt: at,
  farmVerified: false, inspectedAt: null, inspector: null, createdBy: null, facility: null,
  reviewedAt: null, reviewedBy: null, reviewNote: null, submittedAt: status === "pending_review" ? at : null, cancelledAt: null, cancelReason: null, sponsorshipCount: 0,
});

describe("batch review helpers", () => {
  it("parses the queue and canonical recorded review routes only", () => {
    expect(parseBatchReviewRoute("admin/batches")).toEqual({ batchId: null });
    expect(parseBatchReviewRoute("#admin/batches/BATCH-1024/review")).toEqual({ batchId: "BATCH-1024" });
    for (const route of ["", "#", "admin", "admin/batches/", "admin/batches/BATCH-0", "admin/batches/BATCH-01", "admin/batches/BATCH-1", "admin/batches/internal1/review", "admin/batches/BATCH-1/reject", "admin/batches/BATCH-1/review/extra", "admin/batches/BATCH-1/review?x=1", "admin/batches/%42ATCH-1/review", "admin/batches/BATCH-1/review\n", "company/batches", "farming"]) expect(parseBatchReviewRoute(route)).toBeNull();
  });
  it("builds canonical review routes and rejects unsafe identifiers", () => {
    expect(batchReviewRoute()).toBe("#admin/batches");
    expect(batchReviewRoute("BATCH-1024")).toBe("#admin/batches/BATCH-1024/review");
    for (const id of ["BATCH-0", "BATCH-01", "internal1", "BATCH-1/reject", "BATCH-1\n", ""]) expect(() => batchReviewRoute(id)).toThrow(BatchValidationError);
  });
  it("allows decisions only while pending and reuses the retained 1–1,000 note bounds", () => {
    expect(canReviewBatch("pending_review")).toBe(true);
    for (const status of ["draft", "open", "cancelled", "settled"] as const) expect(canReviewBatch(status)).toBe(false);
    expect(normalizeBatchReviewNote("  Reasonable note.  ")).toBe("Reasonable note.");
    for (const note of ["", " ", "x".repeat(1001)]) expect(() => normalizeBatchReviewNote(note)).toThrow(BatchValidationError);
    expect(normalizeBatchReviewNote("x".repeat(1000))).toBe("x".repeat(1000));
  });
  it("compares retained observations by content, not ordering", () => {
    const before = batch();
    before.updates = [
      { id: "u1", stage: "nursery", averageWeightG: 4, countAlive: 100, note: "First", photos: [{ id: "p1", url: "/uploads/a.png" }, { id: "p2", url: "/uploads/b.png" }], createdBy: "Admin", createdAt: at },
      { id: "u2", stage: "grow_out", averageWeightG: null, countAlive: 90, note: null, photos: [], createdBy: "Admin", createdAt: at },
    ];
    const reordered = batch();
    reordered.updates = [{ ...before.updates[1] }, { ...before.updates[0], photos: [{ ...before.updates[0].photos[1] }, { ...before.updates[0].photos[0] }] }];
    expect(retainedBatchObservations(before, reordered)).toBe(true);
    const changed = batch();
    changed.updates = [{ ...before.updates[0] }, { ...before.updates[1], countAlive: 89 }];
    expect(retainedBatchObservations(before, changed)).toBe(false);
    const missing = batch();
    missing.updates = [{ ...before.updates[0] }];
    expect(retainedBatchObservations(before, missing)).toBe(false);
  });
  it("reconciles a decision only with identical identity, status and review metadata", () => {
    const ack = batch("draft"), saved = batch("draft");
    ack.submittedAt = at; saved.submittedAt = at;
    ack.reviewedAt = ack.reviewedAt ?? at; saved.reviewedAt = at;
    ack.reviewedBy = "Reviewer"; saved.reviewedBy = "Reviewer";
    ack.reviewNote = "Note"; saved.reviewNote = "Note";
    expect(reconciledBatchDecision(ack, saved)).toBe(true);
    for (const patch of [{ id: "BATCH-2000" }, { status: "open" as const }, { submittedAt: null }, { reviewedAt: null }, { reviewedBy: "Other" }, { reviewNote: null }]) {
      expect(reconciledBatchDecision({ ...ack, ...patch }, saved)).toBe(false);
    }
  });
});
