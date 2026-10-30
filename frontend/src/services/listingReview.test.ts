import { describe, expect, it } from "vitest";
import { activityLimits, canReviewAction, isListingReviewRoute, listingReviewRoute, matchesReviewTab, parseListingReviewRoute, reviewDate, reviewFeedback, reviewMoney, reviewTabFromHash, safeActivityLink, takedownReason } from "./listingReview";

describe("bounded internal listing review helpers", () => {
  it("recognizes only the active queue and exact review detail routes", () => {
    expect(parseListingReviewRoute("admin/queue")).toEqual({ listingId: null });
    expect(parseListingReviewRoute("admin/review/FM%2F1")).toEqual({ listingId: "FM/1" });
    for (const route of ["admin", "admin/activity", "admin/queue/extra", "admin/review", "admin/review/", "admin/review/FM/1", "admin/review/FM?tab=pending", "admin/review/%", "admin/review/%00", "admin/review/%20"]) expect(isListingReviewRoute(route)).toBe(false);
    expect(listingReviewRoute()).toBe("#admin/queue");
    expect(listingReviewRoute("FM/1?#")).toBe("#admin/review/FM%2F1%3F%23");
  });
  it("uses only the three server tabs and combines sent-back statuses", () => {
    expect(reviewTabFromHash("#admin/queue?tab=approved")).toBe("approved");
    expect(reviewTabFromHash("#admin/queue?tab=changes")).toBe("changes");
    expect(reviewTabFromHash("#admin/queue?tab=rejected")).toBe("pending");
    expect(reviewTabFromHash("#admin/queue")).toBe("pending");
    expect(matchesReviewTab("rejected", "changes")).toBe(true);
    expect(matchesReviewTab("changes", "changes")).toBe(true);
    expect(matchesReviewTab("paused", "approved")).toBe(false);
  });
  it("allows pending decisions and only live/paused takedowns", () => {
    for (const status of ["draft", "pending", "approved", "paused", "changes", "rejected"] as const) {
      for (const action of ["approve", "reject", "request-changes"] as const) expect(canReviewAction(status, action)).toBe(status === "pending");
      expect(canReviewAction(status, "takedown")).toBe(status === "approved" || status === "paused");
    }
  });
  it("trims exact decision payloads and bounds required fields and step", () => {
    expect(reviewFeedback("  Fish details  ", "  Please supply full details.  ")).toEqual({ reason: "Fish details", feedback: "Please supply full details.", step: 1 });
    expect(reviewFeedback("r".repeat(120), "f".repeat(2000), 6).step).toBe(6);
    for (const reason of ["  ", "r".repeat(121)]) expect(() => reviewFeedback(reason, "Valid feedback text")).toThrow("reason");
    for (const feedback of [" short ", "f".repeat(2001)]) expect(() => reviewFeedback("Reason", feedback)).toThrow("feedback");
    for (const step of [0, 7, 1.5, NaN, Infinity]) expect(() => reviewFeedback("Reason", "Valid feedback text", step)).toThrow("step");
    expect(takedownReason("  Policy issue found.  ")).toBe("Policy issue found.");
    expect(takedownReason("r".repeat(2000))).toHaveLength(2000);
    for (const reason of ["short", "r".repeat(2001)]) expect(() => takedownReason(reason)).toThrow("reason");
  });
  it("clicks only bounded mounted Admin destinations, never unknown recorded URLs", () => {
    for (const link of ["#company/listings", "#company/orders", "#admin/queue", "#admin/activity", "#admin/disputes", "#admin/users", "#company/listing/FM-1", "#admin/review/FM-1", "#company/orders/ORD%2F1", "#admin/orders/ORD-1", "#admin/disputes/d%2F1"]) expect(safeActivityLink(link)).toBe(link);
    for (const link of [null, undefined, "", "javascript:alert(1)", "https://example.test", "//example.test", "#marketplace/orders/ORD-1", "#admin/batches/B-1", "#company/facilities/f1", "#admin/users/", "#admin/users/u1", "#admin/users?next=https://example.test", "#admin/users%00", "#admin/review/", "#admin/review/a/extra", "#admin/review/%", "#admin/review/%0A", "#admin/review/%20", "#admin/review/a?next=https://example.test", " #company/orders", "#company/orders\n"]) expect(safeActivityLink(link)).toBeNull();
  });
  it("allows canonical company batch destinations but not unmounted batch decisions", () => {
    for (const link of ["#company/batches", "#company/batches/BATCH-1", `#company/batches/c${"a".repeat(24)}`]) expect(safeActivityLink(link)).toBe(link);
    for (const link of ["#admin/batches", "#admin/batches/BATCH-1", "#company/batches/new", "#company/batches/BATCH-1/edit", "#company/batches/BATCH-1?x=1", "#company/batches/%42ATCH-1", "#company/batches/unknown", "#company/batches/"]) expect(safeActivityLink(link)).toBeNull();
  });
  it("allows canonical facility workspaces but never private content or submission links", () => {
    const id = `c${"a".repeat(24)}`;
    for (const link of ["#company/facilities", "#admin/facilities", `#company/facilities/${id}`, `#admin/facilities/${id}`, `#admin/facilities/${id}/review`]) expect(safeActivityLink(link)).toBe(link);
    for (const link of ["#company/facilities/new", `#company/facilities/${id}/verification`, `#company/facilities/${id}/edit`, `#admin/facilities/${id}/edit`, `#company/facilities/${id}?x=1`, `#company/facilities/%63${"a".repeat(24)}`, `#company/facilities/${id}/verification/documents/${id}/content`, "/uploads/private/document.pdf"]) expect(safeActivityLink(link)).toBeNull();
  });
  it("formats integer VND without conversion and dates explicitly in UTC", () => {
    expect(activityLimits).toEqual([100, 200, 300]);
    expect(reviewMoney(1250000, "en")).toBe("1,250,000 ₫");
    expect(reviewMoney(0, "vi")).toContain("0 ₫");
    expect(reviewDate(null, "en")).toBe("—");
    expect(reviewDate("not a date", "en")).toBe("—");
    expect(reviewDate("2026-10-28T07:08:09+07:00", "en")).toContain("00:08:09 UTC");
    expect(reviewDate("2026-10-28T00:08:09Z", "vi")).toContain("UTC");
  });
});
