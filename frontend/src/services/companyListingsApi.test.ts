import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanyListing, CompanyListingInput } from "./contracts";
const fixture = (status: CompanyListing["status"] = "draft"): CompanyListing => ({ id: "FM/1", status, company: { id: "fishfarm", name: "FishFarm", location: null }, createdBy: "admin@example.test", draft: { name: "Fish", species: "Koi", breed: "", description: "", ageMonths: null, sizeCm: null, gender: null, origin: null, health: null, price: 1000, quantity: 1, negotiable: false, shipping: [], location: null, region: null, saleMode: "in_stock", depositPct: null, expectedReadyDate: null, preorderPolicy: null, images: [], mainId: null }, decision: null, createdAt: "2026-10-28T00:00:00Z", updatedAt: "2026-10-28T00:00:00Z", submittedAt: null, views: 0, history: [] });
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
beforeEach(() => { vi.resetModules(); vi.stubGlobal("sessionStorage", { removeItem: vi.fn() }); });
afterEach(() => vi.unstubAllGlobals());
describe("company catalog transport", () => {
  it("uses shared list/detail with canonical filters", async () => {
    const fetch = vi.fn(async (url: string) => response(url.includes("FM%2F1") ? fixture() : [fixture(url.includes("attention") ? "changes" : "draft")])); vi.stubGlobal("fetch", fetch);
    const { companyListingsApi } = await import("./companyListingsApi");
    await companyListingsApi.list(); await companyListingsApi.list("attention"); await companyListingsApi.detail("FM/1");
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/v1/company/listings", "/v1/company/listings?status=attention", "/v1/company/listings/FM%2F1"]);
  });
  it("whitelists draft fields and strips image IDs and prototype flags", async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => { const value = fixture(); value.draft!.images = [{ id: "image1", url: "/uploads/a.png", isMain: true, position: 0 }]; value.draft!.mainId = "image1"; return response(value); }); vi.stubGlobal("fetch", fetch);
    const { companyListingsApi } = await import("./companyListingsApi");
    await companyListingsApi.create({ name: "Fish", price: 1000, publish: true, id: "discard", images: [{ id: "discard", url: "/uploads/a.png", isMain: true, position: 0 }] } as unknown as CompanyListingInput);
    expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual({ name: "Fish", price: 1000, images: [{ url: "/uploads/a.png", isMain: true, position: 0 }] });
  });
  it("saves via PATCH and publishes via separate bodyless POST", async () => {
    const fetch = vi.fn(async (url: string, _init: RequestInit) => { const value = fixture(url.endsWith("/publish") ? "approved" : "draft"); value.draft!.name = "Changed"; return response(value); }); vi.stubGlobal("fetch", fetch);
    const { companyListingsApi } = await import("./companyListingsApi");
    await companyListingsApi.save("FM/1", { name: "Changed" }); await companyListingsApi.publish("FM/1");
    expect(fetch.mock.calls.map(([url, init]) => [url, init.method, init.body])).toEqual([["/v1/company/listings/FM%2F1", "PATCH", '{"name":"Changed"}'], ["/v1/company/listings/FM%2F1/publish", "POST", undefined]]);
  });
  it("uploads public listing images through the exact multipart purpose", async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => response({ id: "u1", url: "/uploads/a.png", mimeType: "image/png", sizeBytes: 3, purpose: "listing_image", isPrivate: false })); vi.stubGlobal("fetch", fetch);
    const { companyListingsApi } = await import("./companyListingsApi"); await companyListingsApi.upload(new File(["png"], "a.png", { type: "image/png" }));
    expect(fetch.mock.calls[0][0]).toBe("/v1/uploads"); expect((fetch.mock.calls[0][1].body as FormData).get("purpose")).toBe("listing_image"); expect(new Headers(fetch.mock.calls[0][1].headers).has("Content-Type")).toBe(false);
  });
  it.each([null, {}, { id: "FM/1" }])("rejects malformed success %#", async value => {
    vi.stubGlobal("fetch", vi.fn(async () => response(value))); const { companyListingsApi } = await import("./companyListingsApi");
    await expect(companyListingsApi.create({})).rejects.toMatchObject({ code: "listing.invalidResponse" });
  });
  it("rejects mismatched publication and private upload responses", async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => response(fixture())); vi.stubGlobal("fetch", fetch); const { companyListingsApi } = await import("./companyListingsApi");
    await expect(companyListingsApi.publish("FM/1")).rejects.toMatchObject({ code: "listing.invalidResponse" });
    fetch.mockImplementation(async () => response({ id: "u1", url: "/uploads/private/a.png", purpose: "dispute_attachment", isPrivate: true }));
    await expect(companyListingsApi.upload(new File(["png"], "a.png", { type: "image/png" }))).rejects.toMatchObject({ code: "listing.invalidResponse" });
  });
  it("does not replay uncertain create/save/publish/upload", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("Lost response")); vi.stubGlobal("fetch", fetch); const { companyListingsApi } = await import("./companyListingsApi");
    await expect(companyListingsApi.create({})).rejects.toThrow("Lost response"); await expect(companyListingsApi.save("FM/1", {})).rejects.toThrow("Lost response"); await expect(companyListingsApi.publish("FM/1")).rejects.toThrow("Lost response"); await expect(companyListingsApi.upload(new File(["png"], "a.png", { type: "image/png" }))).rejects.toThrow("Lost response");
    expect(fetch).toHaveBeenCalledTimes(4);
  });
  it("accepts canonical detail codes and case-insensitive external image schemes", async () => {
    const value = fixture(); value.draft!.images = [{ id: "image1", url: "HTTPS://images.example.test/fish.png", position: 0, isMain: true }]; value.draft!.mainId = "image1";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => response(url.endsWith("listings") ? [value] : value)));
    const { companyListingsApi } = await import("./companyListingsApi");
    expect((await companyListingsApi.detail("database-id")).id).toBe("FM/1");
    expect(await companyListingsApi.list()).toEqual([value]);
  });
  it.each(["expectedReadyDate", "images", "mainId", "shipping"])("rejects malformed draft %s before form hydration", async field => {
    const value = fixture(); const draft = value.draft! as unknown as Record<string, unknown>;
    draft[field] = field === "expectedReadyDate" ? "not-a-date" : field === "mainId" ? "foreign-image" : [{}];
    vi.stubGlobal("fetch", vi.fn(async () => response(value)));
    const { companyListingsApi } = await import("./companyListingsApi");
    await expect(companyListingsApi.detail("FM/1")).rejects.toMatchObject({ code: "listing.invalidResponse" });
  });
  it("rejects success that did not persist changed fields or media", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(fixture()))); const { companyListingsApi } = await import("./companyListingsApi");
    await expect(companyListingsApi.save("FM/1", { name: "Changed" })).rejects.toMatchObject({ code: "listing.invalidResponse" });
    await expect(companyListingsApi.create({ images: [{ url: "/uploads/a.png", isMain: true, position: 0 }] })).rejects.toMatchObject({ code: "listing.invalidResponse" });
  });
  it("compares preorder dates by instant rather than wire formatting", async () => {
    const value = fixture(); value.draft!.saleMode = "pre_order"; value.draft!.depositPct = 25; value.draft!.expectedReadyDate = "2026-11-28T00:00:00.000Z";
    vi.stubGlobal("fetch", vi.fn(async () => response(value))); const { companyListingsApi } = await import("./companyListingsApi");
    await expect(companyListingsApi.save("FM/1", { expectedReadyDate: "2026-11-28T00:00:00Z" })).resolves.toEqual(value);
  });
  it("rejects a list response outside the requested status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response([fixture("approved")]))); const { companyListingsApi } = await import("./companyListingsApi");
    await expect(companyListingsApi.list("pending")).rejects.toMatchObject({ code: "listing.invalidResponse" });
    await expect(companyListingsApi.list("attention")).rejects.toMatchObject({ code: "listing.invalidResponse" });
  });
  it("submits and withdraws through exact bodyless endpoints", async () => {
    const fetch = vi.fn(async (url: string, _init: RequestInit) => { const value = fixture(url.endsWith("submit") ? "pending" : "draft"); value.submittedAt = url.endsWith("submit") ? "2026-10-28T01:00:00Z" : null; return response(value); }); vi.stubGlobal("fetch", fetch);
    const { companyListingsApi } = await import("./companyListingsApi"); await companyListingsApi.submit("FM/1"); await companyListingsApi.withdraw("FM/1");
    expect(fetch.mock.calls.map(([url, init]) => [url, init.method, init.body])).toEqual([["/v1/company/listings/FM%2F1/submit", "POST", undefined], ["/v1/company/listings/FM%2F1/withdraw", "POST", undefined]]);
  });
  it("rejects inconsistent review transitions and does not replay unknown outcomes", async () => {
    const fetch = vi.fn(async () => response(fixture())); vi.stubGlobal("fetch", fetch); const { companyListingsApi } = await import("./companyListingsApi");
    await expect(companyListingsApi.submit("FM/1")).rejects.toMatchObject({ code: "listing.invalidResponse" });
    fetch.mockImplementation(async () => { const value = fixture(); value.submittedAt = "2026-10-28T01:00:00Z"; return response(value); });
    await expect(companyListingsApi.withdraw("FM/1")).rejects.toMatchObject({ code: "listing.invalidResponse" });
    fetch.mockRejectedValue(new TypeError("Lost response")); await expect(companyListingsApi.submit("FM/1")).rejects.toThrow("Lost response"); await expect(companyListingsApi.withdraw("FM/1")).rejects.toThrow("Lost response"); expect(fetch).toHaveBeenCalledTimes(4);
  });
  it("accepts nullable recorded decision fields and rejects malformed decision values", async () => {
    const value = fixture("changes"); value.decision = { kind: "changes", reason: null, feedback: null, by: null, at: null, step: 1 };
    const fetch = vi.fn(async () => response(value)); vi.stubGlobal("fetch", fetch); const { companyListingsApi } = await import("./companyListingsApi"); await expect(companyListingsApi.detail("FM/1")).resolves.toEqual(value);
    for (const bad of [{ ...value.decision, kind: "approved" }, { ...value.decision, step: 0 }, { ...value.decision, at: "invalid" }, { ...value.decision, feedback: {} }]) {
      fetch.mockImplementation(async () => response({ ...value, decision: bad })); await expect(companyListingsApi.detail("FM/1")).rejects.toMatchObject({ code: "listing.invalidResponse" });
    }
  });
  it("propagates incomplete/locked server responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({ code: "listing.incomplete", params: { field: "images" } }, 400))); const { companyListingsApi } = await import("./companyListingsApi");
    await expect(companyListingsApi.publish("FM/1")).rejects.toMatchObject({ code: "listing.incomplete", params: { field: "images" } });
  });
});
