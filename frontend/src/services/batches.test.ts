import { describe, expect, it } from "vitest";
import type { BatchInput, BatchUpdateInput, PublicBatchQuery } from "./batchContracts";
import { batchRoute, batchShareSummary, batchStageLabel, batchStages, batchStatusLabel, batchStatuses, canCancelBatch, canEditBatch, canPostBatchUpdate, costCategories, deriveBatchShares, normalizeBatchCancellationNote, normalizeBatchInput, normalizeBatchUpdateInput, normalizePublicBatchQuery, parseBatchRoute, validBatchDate, validBatchIdentifier, validBatchMediaUrl } from "./batches";
const input = (): BatchInput => ({ title: "Pond fish", species: "Tilapia", description: "A complete description of this batch.", location: "Farm pond", region: "South", stockCount: 101, shareUnitType: "count", shareQuantity: 10, packagePricePerShare: 100, riskDisclosure: "Growth and harvest are subject to natural risks.", termsVersion: "v1", facilityId: "facility1", costs: [{ category: "feed", label: "Feed", amount: 100, allocation: "per_share" }] });
describe("batch routes and lifecycle helpers", () => {
  it("roundtrips only bounded public/company modes", () => {
    for (const company of [false, true]) for (const mode of company ? ["list", "new", "detail", "edit"] as const : ["list", "detail"] as const) {
      const route = batchRoute(mode, "BATCH-1024", company);
      expect(parseBatchRoute(route)).toEqual({ company, mode, id: ["detail", "edit"].includes(mode) ? "BATCH-1024" : null });
      expect(parseBatchRoute(route.slice(1))).toEqual(parseBatchRoute(route));
    }
    expect(parseBatchRoute("company/batches/BATCH%2D1024/edit")?.id).toBe("BATCH-1024");
  });
  it.each(["", "#", "farming/", "farming//", "farming/%", "farming/%20", "farming/%00", "farming/BATCH-1/edit", "farming/BATCH-1/booking", "farming/BATCH-1?shares=2", "farming/BATCH-1#x", "company/batches/new/", "company/batches/new/edit", "company/batches/edit", "company/batches/BATCH-1/edit/extra", "company/batches/BATCH%2F1", "company/batches/%252F", "batches", "admin/batches/BATCH-1", "sponsor/BATCH-1", "company/batch/BATCH-1", "##farming"])('rejects malformed/legacy/booking route %s', route => expect(parseBatchRoute(route)).toBeNull());
  it("excludes public booking destinations without restricting adapter identifiers", () => {
    for (const route of ["#farming/booking", "#farming/%62ooking", "#farming/booking?shares=1", "#farming/%62ooking?shares=1"]) expect(parseBatchRoute(route)).toBeNull();
    expect(() => batchRoute("detail", "booking")).toThrow();
    expect(validBatchIdentifier("booking")).toBe(true);
    expect(parseBatchRoute(batchRoute("detail", "booking", true))).toEqual({ company: true, mode: "detail", id: "booking" });
  });
  it("does not manufacture unsupported or empty routes", () => {
    expect(() => batchRoute("edit", "BATCH-1")).toThrow(); expect(() => batchRoute("new")).toThrow(); expect(() => batchRoute("detail", "")).toThrow();
  });
  it("uses exactly retained lifecycle enums and bilingual labels", () => {
    expect(batchStatuses).toHaveLength(9); expect(batchStages).toHaveLength(5); expect(costCategories).toHaveLength(7);
    for (const status of batchStatuses) { expect(canEditBatch(status)).toBe(status === "draft"); expect(canPostBatchUpdate(status)).toBe(!["draft", "pending_review", "cancelled"].includes(status)); expect(batchStatusLabel(status, "en")).toBeTruthy(); expect(batchStatusLabel(status, "vi")).toBeTruthy(); }
    for (const stage of batchStages) expect(batchStageLabel(stage, "vi")).not.toBe(batchStageLabel(stage, "en"));
  });
});
describe("bounded input and share calculations", () => {
  it("trims create text and normalizes positions without mutating the caller", () => {
    const value = { ...input(), title: "  Pond fish  ", images: [{ url: " /uploads/pond.png " }, { url: "HTTPS://images.example.test/pond.png", position: 8 }], costs: [{ ...input().costs[0], label: " Feed ", note: " Care " }] };
    const normalized = normalizeBatchInput(value);
    expect(normalized.title).toBe("Pond fish"); expect(normalized.images).toEqual([{ url: "/uploads/pond.png", position: 0 }, { url: "HTTPS://images.example.test/pond.png", position: 8 }]); expect(normalized.costs[0].note).toBe("Care"); expect(value.images[0].url).toBe(" /uploads/pond.png ");
    expect(normalizeBatchInput({ title: " Changed " }, true)).toEqual({ title: "Changed" }); expect(normalizeBatchInput({}, true)).toEqual({});
  });
  it.each([{}, { ...input(), title: " " }, { ...input(), description: "short" }, { ...input(), stockCount: "100" }, { ...input(), stockCount: Infinity }, { ...input(), stockCount: 1.5 }, { ...input(), stockCount: Number.MAX_SAFE_INTEGER + 1 }, { ...input(), shareQuantity: 102 }, { ...input(), contingencyPct: 101 }, { ...input(), shareUnitType: "kg" }, { ...input(), companyId: "private" }, { ...input(), images: [{ url: "/uploads/a.png", id: "extra" }] }, { ...input(), costs: [{ ...input().costs[0], allocation: "total" }] }, { ...input(), costs: [{ ...input().costs[0], amount: -1 }] }, { ...input(), costs: [{ ...input().costs[0], note: null }] }])("rejects incomplete/coerced/unknown/bad-bound create %#", value => expect(() => normalizeBatchInput(value as unknown as BatchInput)).toThrow());
  it.each(["breed", "stockingDate", "expectedHarvestDate", "expectedHarvestWeightG", "contingencyPct", "images", "costs"])('rejects null patch %s rather than assuming it clears', field => expect(() => normalizeBatchInput({ [field]: null } as Partial<BatchInput>, true)).toThrow());
  it("enforces collection and update DTO limits", () => {
    expect(() => normalizeBatchInput({ images: Array.from({ length: 13 }, () => ({ url: "/uploads/a.png" })) }, true)).toThrow();
    expect(() => normalizeBatchInput({ costs: Array.from({ length: 31 }, () => input().costs[0]) }, true)).toThrow();
    expect(normalizeBatchUpdateInput({ stage: "grow_out", countAlive: 0, averageWeightG: 1, note: " Care ", photoUrls: [" /uploads/a.png "] })).toEqual({ stage: "grow_out", countAlive: 0, averageWeightG: 1, note: "Care", photoUrls: ["/uploads/a.png"] });
    for (const patch of [{ stage: "growing" }, { averageWeightG: 0 }, { countAlive: -1 }, { countAlive: "10" }, { note: null }, { note: "a".repeat(2001) }, { photoUrls: Array(11).fill("/uploads/a.png") }, { photoUrls: ["/uploads/private/a.png"] }, { batchId: "invented" }]) expect(() => normalizeBatchUpdateInput({ stage: "nursery", ...patch } as BatchUpdateInput)).toThrow();
  });
  it("derives count and gram-based weight units and exact BigInt budget totals", () => {
    expect(batchShareSummary(input())).toEqual({ totalShares: 10, shareUnit: "10 fish", totalCost: 1000n, packageTotal: 1000n, matches: true });
    const weight = { ...input(), shareUnitType: "weight" as const, expectedHarvestWeightG: 25500, shareQuantity: 2500, costs: [{ ...input().costs[0], amount: 1000, allocation: "batch_total" as const }] };
    expect(batchShareSummary(weight)).toMatchObject({ totalShares: 10, shareUnit: "2.5 kg", matches: true });
    expect(() => deriveBatchShares({ ...weight, expectedHarvestWeightG: undefined })).toThrow(); expect(() => deriveBatchShares({ ...weight, expectedHarvestWeightG: 2000 })).toThrow();
    const large = { ...input(), stockCount: 3, shareQuantity: 1, packagePricePerShare: Number.MAX_SAFE_INTEGER, costs: [{ ...input().costs[0], amount: Number.MAX_SAFE_INTEGER }] };
    expect(batchShareSummary(large).packageTotal).toBe(27021597764222973n);
    expect(batchShareSummary({ ...large, costs: [{ ...large.costs[0], amount: Number.MAX_SAFE_INTEGER - 1 }] }).matches).toBe(false);
  });
});
describe("unsponsored cancellation", () => {
  it("allows only draft, pending-review and open with exactly zero sponsorship records", () => {
    for (const status of batchStatuses) {
      expect(canCancelBatch(status, 0)).toBe(["draft", "pending_review", "open"].includes(status));
      for (const count of [1, 2, -1, NaN, Infinity]) expect(canCancelBatch(status, count)).toBe(false);
    }
    expect(canCancelBatch("unknown" as typeof batchStatuses[number], 0)).toBe(false);
  });
  it("trims a required reason without coercion", () => {
    expect(normalizeBatchCancellationNote("  No sponsorships yet. \n")).toBe("No sponsorships yet.");
    for (const note of ["", " \n ", null, undefined, 1, {}, "x".repeat(1001)]) expect(() => normalizeBatchCancellationNote(note as string)).toThrow(expect.objectContaining({ field: "note" }));
  });
  it("uses backend length semantics at maximum and one over for Unicode", () => {
    for (const unit of ["x", "🐟", "✈️"]) {
      expect(normalizeBatchCancellationNote(` ${unit.repeat(1000)} `)).toBe(unit.repeat(1000));
      expect(() => normalizeBatchCancellationNote(unit.repeat(1001))).toThrow();
    }
    expect(normalizeBatchCancellationNote("a\u0301".repeat(500))).toHaveLength(1000);
    expect(() => normalizeBatchCancellationNote("a\u0301".repeat(501))).toThrow();
  });
});
describe("genuine ISO dates, safe media and public queries", () => {
  it.each(["2026-02-30", "2025-02-29T00:00:00Z", "2026-13-01", "2026-01-01T24:00:00Z", "2026-01-01T12:61:00Z", "2026-01-01T12:00:00+25:00", "01/01/2026", "tomorrow", "2026-01-01 garbage"])('rejects non-ISO calendar date %s', date => expect(validBatchDate(date)).toBe(false));
  it.each(["2024-02-29", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00.000Z", "2026-01-01T07:00:00+07:00"])('accepts genuine date %s', date => expect(validBatchDate(date)).toBe(true));
  it.each(["javascript:alert(1)", "/uploads/private/a.png", "/uploads/../a.png", "/uploads/%2Fprivate.png", "/uploads/a.png?x=1", "https://user:password@example.test/a.png", "http://", "https://example.test/a b.png"])('rejects unsafe media %s', url => expect(validBatchMediaUrl(url)).toBe(false));
  it("validates exact query keys and bounds without coercion or mutation", () => {
    expect(normalizePublicBatchQuery({ q: "tilapia", priceMax: 0, page: 1, limit: 100, harvestBefore: "2026-12-01" })).toEqual({ q: "tilapia", priceMax: 0, page: 1, limit: 100, harvestBefore: "2026-12-01" });
    for (const value of [{ q: "a".repeat(81) }, { species: null }, { region: [] }, { priceMax: -1 }, { priceMax: "0" }, { page: 0 }, { page: Number.MAX_SAFE_INTEGER, limit: 100 }, { limit: 101 }, { limit: 1.5 }, { harvestBefore: "2026-02-30" }, { booking: true }]) expect(() => normalizePublicBatchQuery(value as PublicBatchQuery)).toThrow();
  });
});
