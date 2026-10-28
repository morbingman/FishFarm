import { describe, expect, it } from "vitest";
import { disputeLabel, disputeLink, isDisputeRoute, reasonsForOrder, validateEvidence } from "./disputes";

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
});
