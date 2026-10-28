import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminActivity, CompanyListing, ListingReviewFeedback } from "./contracts";
const fixture = (status: CompanyListing["status"] = "pending"): CompanyListing => ({ id: "FM/1", status, company: { id: "fishfarm", name: "FishFarm", location: null }, createdBy: null, draft: null, decision: null, createdAt: "2026-10-28T00:00:00Z", updatedAt: "2026-10-28T00:00:00Z", submittedAt: "2026-10-28T00:00:00Z", views: 0, history: [] });
const checks = ["images", "details", "pricing", "location", "preorder"].map(key => ({ key, ok: true }));
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const input: ListingReviewFeedback = { reason: "Fish details", feedback: "Please clarify fish health.", step: 2 };
const decision = (status: "changes" | "rejected", feedback = input): CompanyListing => ({ ...fixture(status), decision: { kind: status, ...feedback, step: feedback.step ?? 1, by: "Admin B", at: "2026-10-28T01:00:00Z" } });
const event: AdminActivity = { id: "a1", actorId: null, actorLabel: "System", role: "System", action: "Recorded event", target: null, link: null, createdAt: "2026-10-28T00:00:00Z" };
beforeEach(() => { vi.resetModules(); vi.stubGlobal("sessionStorage", { removeItem: vi.fn() }); });
afterEach(() => vi.unstubAllGlobals());
describe("optional listing review transport", () => {
  it("uses canonical queue tabs and accepts database-ID aliases in detail", async () => {
    const fetch = vi.fn(async (url: string) => response(url.includes("database-id") ? { ...fixture(), checks } : url.includes("changes") ? [decision("changes"), decision("rejected")] : [fixture()])); vi.stubGlobal("fetch", fetch);
    const { listingReviewApi } = await import("./listingReviewApi");
    await listingReviewApi.queue(); await listingReviewApi.queue("changes"); expect((await listingReviewApi.detail("database-id")).id).toBe("FM/1");
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/v1/admin/listings?tab=pending", "/v1/admin/listings?tab=changes", "/v1/admin/listings/database-id"]);
  });
  it("sends exact whitelisted decision bodies and separate bodyless approval", async () => {
    const fetch = vi.fn(async (url: string, _init: RequestInit) => response(url.endsWith("approve") ? fixture("approved") : decision(url.endsWith("request-changes") ? "changes" : "rejected"))); vi.stubGlobal("fetch", fetch);
    const { listingReviewApi } = await import("./listingReviewApi");
    await listingReviewApi.approve("FM/1"); await listingReviewApi.reject("FM/1", { ...input, publish: true } as ListingReviewFeedback); await listingReviewApi.requestChanges("FM/1", input);
    expect(fetch.mock.calls.map(([url, init]) => [url, init.method, init.body])).toEqual([["/v1/admin/listings/FM%2F1/approve", "POST", undefined], ["/v1/admin/listings/FM%2F1/reject", "POST", JSON.stringify(input)], ["/v1/admin/listings/FM%2F1/request-changes", "POST", JSON.stringify(input)]]);
  });
  it("checks takedown acknowledgement against the policy decision", async () => {
    const reason = "Local test policy takedown."; vi.stubGlobal("fetch", vi.fn(async () => response(decision("rejected", { reason: "Policy violation", feedback: reason, step: 1 }))));
    const { listingReviewApi } = await import("./listingReviewApi"); await expect(listingReviewApi.takedown("FM/1", { reason })).resolves.toMatchObject({ status: "rejected" });
  });
  it.each([null, [], [{ key: "images", ok: true }], [...checks.slice(0, 4), checks[0]], checks.map(value => ({ ...value, ok: "true" }))])("rejects malformed completeness checks %#", async value => {
    vi.stubGlobal("fetch", vi.fn(async () => response({ ...fixture(), checks: value }))); const { listingReviewApi } = await import("./listingReviewApi"); await expect(listingReviewApi.detail("FM/1")).rejects.toMatchObject({ code: "listing.invalidResponse" });
  });
  it("rejects wrong queue states and wrong decision ID/content/state", async () => {
    const fetch = vi.fn(async () => response([fixture("approved")])); vi.stubGlobal("fetch", fetch); const { listingReviewApi } = await import("./listingReviewApi");
    await expect(listingReviewApi.queue("pending")).rejects.toMatchObject({ code: "listing.invalidResponse" });
    for (const value of [fixture(), { ...fixture("approved"), id: "FM-other" }, { ...fixture("approved"), decision: decision("rejected").decision }]) {
      fetch.mockImplementation(async () => response(value)); await expect(listingReviewApi.approve("FM/1")).rejects.toMatchObject({ code: "listing.invalidResponse" });
    }
    fetch.mockImplementation(async () => response(decision("changes", { ...input, feedback: "Not your feedback" }))); await expect(listingReviewApi.requestChanges("FM/1", input)).rejects.toMatchObject({ code: "listing.invalidResponse" });
  });
  it("propagates conflicts and does not retry uncertain decisions", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("Lost response")); vi.stubGlobal("fetch", fetch); const { listingReviewApi } = await import("./listingReviewApi");
    await expect(listingReviewApi.approve("FM/1")).rejects.toThrow("Lost response"); await expect(listingReviewApi.reject("FM/1", input)).rejects.toThrow("Lost response"); await expect(listingReviewApi.requestChanges("FM/1", input)).rejects.toThrow("Lost response"); await expect(listingReviewApi.takedown("FM/1", { reason: "Local test reason" })).rejects.toThrow("Lost response"); expect(fetch).toHaveBeenCalledTimes(4);
    fetch.mockImplementation(async () => response({ code: "listing.invalidTransition", params: { from: "approved", action: "rejected" } }, 409)); await expect(listingReviewApi.reject("FM/1", input)).rejects.toMatchObject({ code: "listing.invalidTransition", params: { from: "approved" } });
  });
});
describe("recorded activity transport", () => {
  it("uses bounded integer limits and retains nullable system fields", async () => {
    const fetch = vi.fn(async (url: string) => response([event])); vi.stubGlobal("fetch", fetch); const { activityApi } = await import("./listingReviewApi");
    await expect(activityApi.list()).resolves.toEqual([event]); await activityApi.list(300); expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/v1/admin/activity?limit=100", "/v1/admin/activity?limit=300"]);
    for (const limit of [0, 301, 1.5, NaN]) await expect(activityApi.list(limit)).rejects.toMatchObject({ code: "validation.failed" }); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each([{ ...event, role: "Seller" }, { ...event, createdAt: "invalid" }, { ...event, link: {} }, { ...event, actorLabel: null }, { ...event, actorId: 1 }])("rejects malformed activity rows %#", async value => {
    vi.stubGlobal("fetch", vi.fn(async () => response([value]))); const { activityApi } = await import("./listingReviewApi"); await expect(activityApi.list()).rejects.toMatchObject({ code: "activity.invalidResponse" });
  });
  it("rejects duplicate events and a response beyond the requested window", async () => {
    const fetch = vi.fn(async () => response([event, event])); vi.stubGlobal("fetch", fetch); const { activityApi } = await import("./listingReviewApi"); await expect(activityApi.list()).rejects.toMatchObject({ code: "activity.invalidResponse" });
    fetch.mockImplementation(async () => response([event, { ...event, id: "a2" }])); await expect(activityApi.list(1)).rejects.toMatchObject({ code: "activity.invalidResponse" });
  });
});
