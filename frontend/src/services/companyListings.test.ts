import { describe, expect, it } from "vitest";
import { canPublish, canSubmitForReview, isCompanyListingRoute, listingForm, listingInput, listingRoute, parseCompanyListingRoute, publicationMissing, validateListingFile } from "./companyListings";

describe("company catalog rules", () => {
  it("recognizes bounded company routes and encodes IDs", () => {
    for (const route of ["company/listings", "company/add", "company/edit/FM-1", "company/listing/FM-1"]) expect(isCompanyListingRoute(route)).toBe(true);
    for (const route of ["company", "company/listings/", "company/edit", "company/edit/FM-1/publish", "admin/listings", "https://example.test"]) expect(isCompanyListingRoute(route)).toBe(false);
    expect(listingRoute("edit", "FM/1")).toBe("#company/edit/FM%2F1");
  });
  it.each(["company/edit/%", "company/listing/%GG", "company/edit/%E0%A4", "company/edit/%20", "company/edit/%00", "company/edit/FM-1/extra", "company/edit/FM-1?other", "company/edit/FM-1#other"])("safely rejects malformed route %s", route => {
    expect(parseCompanyListingRoute(route)).toBeNull(); expect(isCompanyListingRoute(route)).toBe(false);
  });
  it("parses list/new routes and decodes aliases exactly once", () => {
    expect(parseCompanyListingRoute("company/listings")).toEqual({ mode: "list", listingId: null });
    expect(parseCompanyListingRoute("company/add")).toEqual({ mode: "new", listingId: null });
    expect(parseCompanyListingRoute("company/edit/database-id")).toEqual({ mode: "edit", listingId: "database-id" });
    expect(parseCompanyListingRoute("company/listing/FM%2F1")).toEqual({ mode: "detail", listingId: "FM/1" });
    expect(parseCompanyListingRoute("company/edit/FM%252F1")).toEqual({ mode: "edit", listingId: "FM%2F1" });
  });
  it("supports partial drafts without invented numeric zeroes", () => {
    const form = listingForm(); form.name = "  Draft fish  ";
    const input = listingInput(form);
    expect(input.name).toBe("Draft fish"); expect(input.price).toBeUndefined(); expect(input.sizeCm).toBeNull(); expect(input.ageMonths).toBeNull(); expect(input.quantity).toBe(1);
  });
  it("sends changed fields only and leaves unchanged image arrays alone", () => {
    const baseline = listingForm(); baseline.price = "1000"; baseline.images = [{ url: "/uploads/one.png", isMain: true, position: 0 }];
    const form = { ...baseline, name: "Changed" };
    expect(listingInput(form, baseline)).toEqual({ name: "Changed" });
  });
  it("validates integer bounds rather than coercing blank, decimal or negative values", () => {
    for (const [field, value] of [["quantity", "0"], ["ageMonths", "601"], ["sizeCm", "1.5"], ["price", "-1"], ["price", "2147483648"]] as const) {
      const form = listingForm(); form[field] = value; expect(() => listingInput(form)).toThrow(field);
    }
    const baseline = listingForm(); baseline.price = "1000"; expect(() => listingInput({ ...baseline, price: "" }, baseline)).toThrow("price");
  });
  it("requires deposit/date for partial preorder saves and clears terms by sale mode only", () => {
    const form = listingForm(); form.saleMode = "pre_order";
    expect(() => listingInput(form)).toThrow("depositPct"); form.depositPct = "25";
    expect(() => listingInput(form)).toThrow("expectedReadyDate"); form.expectedReadyDate = "2026-11-28T14:30";
    const input = listingInput(form); expect(input.depositPct).toBe(25); expect(input.expectedReadyDate).toBe(new Date(form.expectedReadyDate).toISOString());
    const current = { ...form, saleMode: "in_stock" as const };
    expect(listingInput(current, form)).toEqual({ saleMode: "in_stock" });
  });
  it("maps whole-array media replacements to sequential positions and one cover", () => {
    const form = listingForm(); form.images = [{ url: "/uploads/a.png", position: 8, isMain: false }, { url: "https://example.test/b.png", position: 2, isMain: true }];
    expect(listingInput(form).images).toEqual([{ url: "/uploads/a.png", position: 0, isMain: false }, { url: "https://example.test/b.png", position: 1, isMain: true }]);
    form.images[0].url = "blob:local"; expect(() => listingInput(form)).toThrow("images");
  });
  it("keeps publication completeness separate from saving", () => {
    const form = listingForm(); expect(publicationMissing(form)).toContain("images"); expect(() => listingInput(form)).not.toThrow();
    for (const status of ["draft", "changes", "rejected", "paused"] as const) expect(canPublish(status)).toBe(true);
    expect(canPublish("approved")).toBe(false); expect(canPublish("pending")).toBe(false);
  });
  it("keeps optional submission separate from publication and excludes paused records", () => {
    for (const status of ["draft", "changes", "rejected", "approved"] as const) expect(canSubmitForReview(status)).toBe(true);
    expect(canSubmitForReview("paused")).toBe(false); expect(canSubmitForReview("pending")).toBe(false);
    expect(canPublish("approved")).toBe(false); expect(canPublish("paused")).toBe(true);
  });
  it("accepts only bounded public image files", () => {
    expect(() => validateListingFile(new File(["png"], "a.png", { type: "image/png" }), 7)).not.toThrow();
    expect(() => validateListingFile(new File(["pdf"], "a.pdf", { type: "application/pdf" }), 0)).toThrow("images");
    expect(() => validateListingFile(new File(["png"], "a.png", { type: "image/png" }), 8)).toThrow("images");
  });
});
