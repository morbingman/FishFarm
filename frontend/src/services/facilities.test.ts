import { describe, expect, it } from "vitest";
import type { FacilityDecision, FacilityInput, FacilityRoute, Verification, VerificationInput } from "./facilityContracts";
import { facilityComplianceHint, facilityDocumentMaxBytes, facilityLevels, facilityRoute, facilityTextLength, FacilityValidationError, normalizeFacilityDecision, normalizeFacilityInput, normalizeVerificationInput, parseFacilityRoute, validateFacilityDocument, verificationLevelLabel, verificationStatuses, verificationStatusLabel } from "./facilities";

const future = "2027-01-01T00:00:00.000Z";
const now = Date.parse("2026-10-29T00:00:00.000Z");
const input = (): VerificationInput => ({ level: "registered", documents: [{ type: "Registration", uploadId: "upload1" }] });
const verification = (): Verification => ({ id: "verification1", level: "registered", status: "approved", inspectedAt: null, inspector: null, notes: null, validUntil: future, submittedAt: null, reviewedAt: null, reviewedBy: null, documents: [{ id: "document1", type: "Registration", controlled: true, mimeType: "application/pdf", sizeBytes: 1, uploadedAt: future }] });
function field(action: () => unknown, expected: string): void {
  try { action(); throw new Error("Expected validation failure"); } catch (error) {
    expect(error).toBeInstanceOf(FacilityValidationError); expect(error).toMatchObject({ field: expected });
  }
}
describe("facility input helpers", () => {
  it("trims create input without adding fields, clearing omission or permitting PATCH fields", () => {
    expect(normalizeFacilityInput({ name: " Pond ", location: " South farm ", region: "  " })).toEqual({ name: "Pond", location: "South farm", region: "" });
    expect(normalizeFacilityInput({ name: "Pond", location: "South" })).toEqual({ name: "Pond", location: "South" });
    for (const [patch, expected] of [[{ name: " " }, "name"], [{ location: "x".repeat(201) }, "location"], [{ region: "x".repeat(81) }, "region"], [{ region: null }, "region"], [{ id: "facility1" }, "input"]] as const) field(() => normalizeFacilityInput(Object.assign({ name: "Pond", location: "South" }, patch) as FacilityInput), expected);
  });
  it("matches retained Unicode character limits for every bounded facility text field", () => {
    const supplementary = "\u{10437}";
    // Reviewer repro: 61 supplementary characters are 122 UTF-16 units, below max120.
    expect(normalizeFacilityInput({ name: supplementary.repeat(61), location: "South" }).name).toBe(supplementary.repeat(61));
    for (const unit of [supplementary, "\u2764\uFE0F", `${supplementary}\uFE0E`]) {
      for (const [key, max] of [["name", 120], ["location", 200], ["region", 80]] as const) {
        const value = ` ${unit.repeat(max)} `;
        expect(normalizeFacilityInput({ name: "Pond", location: "South", [key]: value })[key]).toBe(value.trim());
        field(() => normalizeFacilityInput({ name: "Pond", location: "South", [key]: `${value.trim()}x` }), key);
      }
      for (const [key, max] of [["inspector", 120], ["notes", 2000]] as const) {
        const value = unit.repeat(max);
        expect(normalizeVerificationInput({ ...input(), [key]: value })[key]).toBe(value);
        expect(normalizeFacilityDecision({ status: "rejected", [key]: value }, now)[key]).toBe(value);
        field(() => normalizeVerificationInput({ ...input(), [key]: `${value}x` }), key);
        field(() => normalizeFacilityDecision({ status: "revoked", [key]: `${value}x` }, now), key);
      }
      const type = unit.repeat(80);
      expect(normalizeVerificationInput({ ...input(), documents: [{ type, uploadId: "u1" }] }).documents[0].type).toBe(type);
      field(() => normalizeVerificationInput({ ...input(), documents: [{ type: `${type}x`, uploadId: "u1" }] }), "documents");
    }
    // Match validator, not grapheme segmentation: combining/ZWJ sequences remain multiple characters.
    expect(facilityTextLength(`A\u0301${supplementary}\u200D${supplementary}\uFE0F`)).toBe(5);
    expect(facilityTextLength("\uFE0F\uFE0E\uD800")).toBe(3);
    field(() => normalizeFacilityInput({ name: "A\u0301".repeat(61), location: "South" }), "name");
  });
  it("snapshots normalized documents and UTC dates without fabricating clearable optional text", () => {
    const value = { ...input(), inspectedAt: "2026-10-29", validUntil: "2027-01-01T07:00:00+07:00", inspector: " Admin ", notes: " Note " };
    const normalized = normalizeVerificationInput(value);
    value.documents[0].type = "Changed";
    expect(normalized).toEqual({ level: "registered", inspectedAt: "2026-10-29T00:00:00.000Z", validUntil: future, inspector: "Admin", notes: "Note", documents: [{ type: "Registration", uploadId: "upload1" }] });
    expect(normalizeVerificationInput(input())).not.toHaveProperty("notes");
    expect(normalizeVerificationInput({ ...input(), level: "none", inspector: " " })).toMatchObject({ level: "none", inspector: "" });
  });
  it("bounds document lists and deduplicates after trimming safe upload IDs", () => {
    for (const documents of [[], Array.from({ length: 21 }, (_, i) => ({ type: "Doc", uploadId: `u${i}` })), [{ type: "Doc", uploadId: "u1" }, { type: "Other", uploadId: " u1 " }], [{ type: " ", uploadId: "u1" }], [{ type: "Doc", uploadId: "../private" }], [{ type: "Doc", uploadId: "u1", url: "/uploads/private/file.pdf" }]]) field(() => normalizeVerificationInput({ ...input(), documents } as VerificationInput), "documents");
    expect(normalizeVerificationInput({ ...input(), documents: Array.from({ length: 20 }, (_, i) => ({ type: "Doc", uploadId: `u${i}` })) }).documents).toHaveLength(20);
  });
  it("rejects impossible/permissive dates and malformed scalars", () => {
    for (const value of ["2026-02-30", "2026-10-29T24:00:00Z", "2026-10-29T00:00:00", "2026-10-29T00:00:00+24:00", "October 29 2026", null]) field(() => normalizeVerificationInput({ ...input(), inspectedAt: value } as VerificationInput), "inspectedAt");
    field(() => normalizeVerificationInput({ ...input(), level: "other" } as unknown as VerificationInput), "level");
    field(() => normalizeVerificationInput({ ...input(), notes: "x".repeat(2001) }), "notes");
    field(() => normalizeVerificationInput({ ...input(), inspector: "x".repeat(121) }), "inspector");
  });
  it("requires explicit future approval validity, without requiring notes or a prior state", () => {
    for (const validUntil of [undefined, "2026-10-29", "2026-10-28"]) field(() => normalizeFacilityDecision({ status: "approved", validUntil }, now), "validUntil");
    field(() => normalizeFacilityDecision({ status: "approved", validUntil: future, level: "none" }, now), "level");
    field(() => normalizeFacilityDecision({ status: "pending" } as unknown as FacilityDecision, now), "status");
    expect(normalizeFacilityDecision({ status: "approved", validUntil: future }, now)).toEqual({ status: "approved", validUntil: future });
    expect(normalizeFacilityDecision({ status: "rejected" }, now)).toEqual({ status: "rejected" });
    expect(normalizeFacilityDecision({ status: "revoked", notes: " " }, now)).toEqual({ status: "revoked", notes: "" });
  });
});
describe("bounded file validation and labels", () => {
  it("accepts the five MIME types at the default cap and rejects unsupported, empty or oversized files", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]) expect(() => validateFacilityDocument(new File(["x"], "document", { type }))).not.toThrow();
    expect(() => validateFacilityDocument(new File([new Uint8Array(facilityDocumentMaxBytes)], "cap.pdf", { type: "application/pdf" }))).not.toThrow();
    field(() => validateFacilityDocument(new File([new Uint8Array(facilityDocumentMaxBytes + 1)], "large.pdf", { type: "application/pdf" })), "sizeBytes");
    field(() => validateFacilityDocument(new File([], "empty.pdf", { type: "application/pdf" })), "sizeBytes");
    field(() => validateFacilityDocument(new File(["x"], "script.svg", { type: "image/svg+xml" })), "mimeType");
    field(() => validateFacilityDocument({ size: 1, type: "application/pdf" } as File), "file");
  });
  it("provides bilingual level/status labels and advisory expiry/controlled-document hints", () => {
    for (const level of facilityLevels) expect(verificationLevelLabel(level, "vi")).not.toBe(verificationLevelLabel(level, "en"));
    for (const status of verificationStatuses) expect(verificationStatusLabel(status, "vi")).not.toBe(verificationStatusLabel(status, "en"));
    expect(facilityComplianceHint(null, now)).toBe("missing");
    const value = verification(); expect(facilityComplianceHint(value, now)).toBe("compliant");
    for (const status of ["pending", "rejected", "revoked"] as const) expect(facilityComplianceHint({ ...value, status }, now)).toBe(status);
    expect(facilityComplianceHint({ ...value, level: "none" }, now)).toBe("level");
    expect(facilityComplianceHint({ ...value, validUntil: "2026-10-29T00:00:00Z" }, now)).toBe("expired");
    expect(facilityComplianceHint({ ...value, documents: [] }, now)).toBe("documents");
    expect(facilityComplianceHint({ ...value, documents: [{ ...value.documents[0], controlled: false }] }, now)).toBe("documents");
  });
});
describe("strict facility routes", () => {
  it("round-trips canonical company and Admin modes", () => {
    for (const mode of ["list", "new", "review-list", "detail", "submit", "review"] as FacilityRoute["mode"][]) {
      const id = ["detail", "submit", "review"].includes(mode) ? "facility-1" : undefined;
      const route = facilityRoute(mode, id);
      expect(parseFacilityRoute(route)).toEqual({ mode, id: id ?? null }); expect(parseFacilityRoute(route.slice(1))).toEqual({ mode, id: id ?? null });
    }
  });
  it("accepts retained backend Admin activity detail aliases but builds canonical review links", () => {
    expect(parseFacilityRoute("#admin/facilities/facility1")).toEqual({ mode: "review", id: "facility1" });
    expect(facilityRoute("review", "facility1")).toBe("#admin/facilities/facility1/review");
  });
  it("rejects queries, escapes, reserved IDs, unsupported edit/delete and extra segments", () => {
    for (const route of ["#company/facilities?x=1", "company/facilities/", "company/facilities/edit", "company/facilities/New", "company/facilities/verification", "company/facilities/f1/edit", "company/facilities/f1/review", "admin/facilities/f1/verification", "company/facilities/f1/verification/extra", "admin/facilities/f1/review?x=1", "company/facilities/f%2F1", "company/facilities/%2e%2e", "company/facilities/f%3F1", "company/facilities/%", "#company/facilities/f1#other"]) expect(parseFacilityRoute(route)).toBeNull();
    field(() => facilityRoute("edit" as FacilityRoute["mode"], "f1"), "route");
    field(() => facilityRoute("detail", "new"), "route");
    field(() => facilityRoute("list", "f1"), "route");
  });
});
