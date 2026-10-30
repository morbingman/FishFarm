import { describe, expect, it } from "vitest";
import { disputeLabel, disputeLink, disputeSubject, isDisputeRoute, reasonsForOrder, sponsorshipDisputeEligible, validateEvidence } from "./disputes";

describe("dispute presentation rules", () => {
  it("allows only not-received while shipped and all reasons after delivery", () => {
    expect(reasonsForOrder("shipped")).toEqual(["not_received"]);
    expect(reasonsForOrder("delivered")).toHaveLength(5);
    expect(reasonsForOrder("completed")).toHaveLength(5);
    for (const status of ["pending_payment", "paid", "ready", "cancelled", "refunded"] as const) expect(reasonsForOrder(status)).toEqual([]);
  });
  it("bounds owner/admin routes and encodes identifiers", () => {
    for (const route of ["marketplace/disputes", "marketplace/disputes/id", "admin/disputes", "admin/disputes/id", "marketplace/orders/ORD-1/dispute"]) expect(isDisputeRoute(route)).toBe(true);
    for (const route of ["admin/disputes/", "admin/disputes/id/resolve", "marketplace/orders/ORD-1/dispute/extra", "https://external/disputes", "company/disputes"]) expect(isDisputeRoute(route)).toBe(false);
    expect(disputeLink(false, "id/a")).toBe("#marketplace/disputes/id%2Fa");
    expect(disputeLink(true)).toBe("#admin/disputes");
  });
  it("validates file count, type and default local size before uploading", () => {
    const file = (type: string, size = 1) => ({ type, size }) as File;
    expect(() => validateEvidence([file("image/png"), file("application/pdf")], 1)).not.toThrow();
    expect(() => validateEvidence([file("image/png")], 3)).toThrow();
    expect(() => validateEvidence([file("text/html")], 0)).toThrow();
    expect(() => validateEvidence([file("image/png", 0)], 0)).toThrow();
    expect(() => validateEvidence([file("application/pdf", 10 * 1024 * 1024 + 1)], 0)).toThrow();
  });
  it("labels canonical reasons and statuses in both languages", () => {
    expect(disputeLabel("not_received", "en")).toBe("Order not received");
    expect(disputeLabel("reviewing", "vi")).toBe("Đang xét duyệt");
  });
  it("gates sponsorship disputes on growing and later records only", () => {
    for (const status of ["growing", "ready_for_delivery", "delivered", "settled"] as const) expect(sponsorshipDisputeEligible(status)).toBe(true);
    for (const status of ["pending_payment", "funded", "cancelled", "refunded"] as const) expect(sponsorshipDisputeEligible(status)).toBe(false);
  });
  it("summarizes the disputed subject from either dispute kind", () => {
    expect(disputeSubject({ kind: "order", order: { id: "ORD/1", status: "delivered" }, sponsorship: null })).toEqual({ code: "ORD/1", title: "", kind: "order" });
    expect(disputeSubject({ kind: "sponsorship", order: null, sponsorship: { id: "s1", shares: 4, status: "growing", batch: { code: "BATCH-1024", title: "Autumn catfish" } } })).toEqual({ code: "BATCH-1024", title: "Autumn catfish", kind: "sponsorship" });
    expect(disputeSubject({ kind: "order", order: null, sponsorship: null })).toBeNull();
  });
});
