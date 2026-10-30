import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BatchFacility, BatchInput, BatchStatus, BatchUpdateInput, CompanyBatch, PublicBatch } from "./batchContracts";
const at = "2026-10-28T00:00:00.000Z";
const input = (): BatchInput => ({ title: "Pond fish", species: "Tilapia", description: "A complete description of this batch.", location: "Farm pond", region: "South", stockCount: 100, shareUnitType: "count", shareQuantity: 10, packagePricePerShare: 100, riskDisclosure: "Growth and harvest are subject to natural risks.", termsVersion: "v1", facilityId: "facility1", images: [{ url: "/uploads/pond.png" }], costs: [{ category: "feed", label: "Feed", amount: 100, allocation: "per_share" }] });
const update = () => ({ id: "update1", stage: "nursery" as const, averageWeightG: null, countAlive: null, note: null, photos: [] as { id: string; url: string }[], createdBy: "Admin", createdAt: at });
const company = (status: BatchStatus = "draft"): CompanyBatch => ({
  id: "BATCH-1024", title: "Pond fish", species: "Tilapia", breed: null, description: "A complete description of this batch.", location: "Farm pond", region: "South", status,
  stockingDate: null, expectedHarvestDate: null, stockCount: 100, shareUnitType: "count", shareUnit: "10 fish", shareQuantity: 10, expectedHarvestWeightG: null, totalShares: 10, sharesAvailable: 10, packagePricePerShare: 100, contingencyPct: 10, riskDisclosure: "Growth and harvest are subject to natural risks.", termsVersion: "v1",
  images: [{ id: "image1", batchId: "internal1", url: "/uploads/pond.png", position: 0, isMain: true, createdAt: at }],
  costs: [{ id: "cost1", batchId: "internal1", category: "feed", label: "Feed", amount: 100, allocation: "per_share", note: null }], updates: [], createdAt: at, updatedAt: at,
  farmVerified: status === "open", inspectedAt: null, inspector: null, createdBy: { id: "admin1", name: "Admin", email: "admin@example.test" },
  facility: { id: "facility1", name: "Pond", location: "Farm pond", verification: { id: "verification1", level: "registered", status: "approved", inspectedAt: null, inspector: null, validUntil: "2027-01-01T00:00:00Z", documents: [{ id: "document1", type: "Registration", controlled: true }] } },
  reviewedAt: status === "open" ? at : null, reviewedBy: status === "open" ? "Admin" : null, reviewNote: null, submittedAt: status === "open" ? at : null, cancelledAt: null, cancelReason: null, sponsorshipCount: 0,
});
const publicBatch = (): PublicBatch => {
  const { farmVerified: _f, inspectedAt: _i, inspector: _ins, createdBy: _cb, reviewedAt: _ra, reviewedBy: _rb, reviewNote: _rn, submittedAt: _s, cancelledAt: _ca, cancelReason: _cr, sponsorshipCount: _sc, facility: _facility, ...base } = company("open");
  return { ...base, status: "open", images: base.images.map(({ id, url, position, isMain }) => ({ id, url, position, isMain })), costs: base.costs.map(({ category, label, amount, allocation, note }) => ({ category, label, amount, allocation, note })), compliance: { level: "registered", inspectedAt: null, validUntil: "2027-01-01T00:00:00Z" }, facility: { id: "facility1", name: "Pond", location: "Farm pond" } };
};
const facility = (): BatchFacility => ({ id: "facility1", name: "Pond", location: "Farm pond", region: "South", batchCount: 1, createdAt: at, updatedAt: at, verification: { ...company().facility!.verification!, notes: null, submittedAt: null, reviewedAt: null, reviewedBy: null, documents: [{ id: "document1", type: "Registration", controlled: true, mimeType: "application/pdf", sizeBytes: 10, uploadedAt: at }] } });
const page = (items: PublicBatch[] = [publicBatch()]) => ({ items, page: 1, limit: 20, total: items.length, pages: Math.ceil(items.length / 20) });
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
beforeEach(() => { vi.resetModules(); vi.stubGlobal("sessionStorage", { removeItem: vi.fn() }); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("bounded batch transport", () => {
  it("uses credential-free public reads even with an authenticated session", async () => {
    const fetch = vi.fn(async (url: string, _init: RequestInit) => response(url.endsWith("/updates") ? [update()] : url.includes("BATCH-1024") ? publicBatch() : page())); vi.stubGlobal("fetch", fetch);
    const { authApi } = await import("./api"); fetch.mockResolvedValueOnce(response({ accessToken: "local-test-token", user: { id: "admin1", role: "Admin" } })); await authApi.login("admin@example.test", "LOCAL TEST ONLY"); fetch.mockClear();
    const { batchesApi } = await import("./batchesApi"); const signal = new AbortController().signal;
    await batchesApi.list({ q: "Pond fish", species: "tilapia", region: "south", priceMax: 100, page: 1, limit: 20 }, signal); await batchesApi.detail("BATCH-1024", signal); await batchesApi.updates("BATCH-1024", signal);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/v1/batches?q=Pond+fish&species=tilapia&region=south&priceMax=100&page=1&limit=20", "/v1/batches/BATCH-1024", "/v1/batches/BATCH-1024/updates"]);
    for (const [, init] of fetch.mock.calls) { expect(init.credentials).toBe("omit"); expect(new Headers(init.headers).has("Authorization")).toBe(false); expect(init.signal).toBeInstanceOf(AbortSignal); }
  });
  it("reads authenticated company lists, detail and readonly facilities", async () => {
    const fetch = vi.fn(async (url: string, _init: RequestInit) => response(url.endsWith("facilities") ? [facility()] : url.endsWith("BATCH-1024") ? company() : [company()])); vi.stubGlobal("fetch", fetch);
    const { batchesApi } = await import("./batchesApi"); await batchesApi.companyList("draft"); await batchesApi.companyDetail("BATCH-1024"); await batchesApi.facilities();
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/v1/company/batches?status=draft", "/v1/company/batches/BATCH-1024", "/v1/company/facilities"]);
    for (const [, init] of fetch.mock.calls) { expect(init.credentials).toBe("include"); expect(init.body).toBeUndefined(); expect(init.method).toBeUndefined(); }
    expect(Object.keys(batchesApi).sort()).toEqual(["addUpdate", "approve", "cancel", "companyDetail", "companyList", "create", "detail", "facilities", "list", "publish", "reject", "reviewQueue", "save", "submit", "updates"]);
  });
  it("normalizes exact create and partial save bodies, with a separate bodyless publish", async () => {
    const fetch = vi.fn(async (url: string, init: RequestInit) => { const value = company(url.endsWith("publish") ? "open" : "draft"); if (init.method === "PATCH") value.title = "Changed"; return response(value); }); vi.stubGlobal("fetch", fetch);
    const { batchesApi } = await import("./batchesApi"); const value = input(); value.title = " Pond fish "; await batchesApi.create(value); await batchesApi.save("BATCH-1024", { title: " Changed " }); await batchesApi.publish("BATCH-1024");
    expect(fetch.mock.calls.map(([url, init]) => [url, init.method])).toEqual([["/v1/company/batches", "POST"], ["/v1/company/batches/BATCH-1024", "PATCH"], ["/v1/company/batches/BATCH-1024/publish", "POST"]]);
    expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual({ ...input(), images: [{ url: "/uploads/pond.png", position: 0 }] }); expect(fetch.mock.calls[1][1].body).toBe('{"title":"Changed"}'); expect(fetch.mock.calls[2][1].body).toBeUndefined();
  });
  it("posts update scalar/media acknowledgements without an invented parentID", async () => {
    const u = { ...update(), averageWeightG: 5, countAlive: 0, note: "Care", photos: [{ id: "photo1", url: "/uploads/care.png" }] };
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => response(u)); vi.stubGlobal("fetch", fetch);
    const { batchesApi } = await import("./batchesApi"); await expect(batchesApi.addUpdate("BATCH-1024", { stage: "nursery", averageWeightG: 5, countAlive: 0, note: " Care ", photoUrls: ["/uploads/care.png"] })).resolves.toEqual(u);
    expect(fetch.mock.calls[0][0]).toBe("/v1/company/batches/BATCH-1024/updates"); expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual({ stage: "nursery", averageWeightG: 5, countAlive: 0, note: "Care", photoUrls: ["/uploads/care.png"] });
  });
  it("validates all inputs and unsafe IDs before making a request", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const { batchesApi } = await import("./batchesApi");
    for (const promise of [batchesApi.list({ q: "x".repeat(81) }), batchesApi.detail("bad/id"), batchesApi.companyList("unknown" as BatchStatus), batchesApi.create({ ...input(), stockCount: NaN }), batchesApi.save("BATCH-1024", { breed: null } as unknown as Partial<BatchInput>), batchesApi.addUpdate("BATCH-1024", { stage: "grow_out", countAlive: "100" } as unknown as BatchUpdateInput)]) await expect(promise).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("propagates public abort signals", async () => {
    const controller = new AbortController(); controller.abort();
    const fetch = vi.fn(async (_url: string, init: RequestInit) => { if (init.signal?.aborted) throw new DOMException("Aborted", "AbortError"); return response(page()); }); vi.stubGlobal("fetch", fetch); const { batchesApi } = await import("./batchesApi"); await expect(batchesApi.list({}, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});
describe("structural response safety and pagination", () => {
  it("retains immutable canonical codes and actual internal company row IDs", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(company()))); const { batchesApi } = await import("./batchesApi");
    const value = await batchesApi.companyDetail("internal1"); expect(value.id).toBe("BATCH-1024"); expect(value.images[0].batchId).toBe("internal1"); expect("company" in value).toBe(false);
    expect(() => Object.assign(value, { id: "BATCH-9999" })).toThrow(); expect(() => Object.assign(value.images[0], { id: "changed" })).toThrow();
  });
  it("does not invent a client-clock expiry rejection for a public response", async () => {
    const value = publicBatch(); value.compliance.validUntil = "2020-01-01T00:00:00Z";
    vi.stubGlobal("fetch", vi.fn(async () => response(value))); const { batchesApi } = await import("./batchesApi"); await expect(batchesApi.detail("BATCH-1024")).resolves.toEqual(value);
  });
  it.each([null, {}, { id: "BATCH-1024" }, { ...publicBatch(), status: "draft" }, { ...publicBatch(), id: "internal1" }, { ...publicBatch(), id: "BATCH-9999" }, { ...publicBatch(), stockCount: "100" }, { ...publicBatch(), stockCount: Infinity }, { ...publicBatch(), contingencyPct: 101 }, { ...publicBatch(), sharesAvailable: 0 }, { ...publicBatch(), sharesAvailable: 11 }, { ...publicBatch(), totalShares: 9 }, { ...publicBatch(), shareUnit: "10 kg" }, { ...publicBatch(), expectedHarvestDate: "2026-02-30T00:00:00Z" }, { ...publicBatch(), costs: [{ ...publicBatch().costs[0], note: {} }] }, { ...publicBatch(), compliance: { level: "none", inspectedAt: null, validUntil: at } }, { ...publicBatch(), images: [{ ...publicBatch().images[0], url: "/uploads/private/file.png" }] }])("rejects malformed or ineligible public detail %#", async value => {
    vi.stubGlobal("fetch", vi.fn(async () => response(value))); const { batchesApi } = await import("./batchesApi"); await expect(batchesApi.detail("BATCH-1024")).rejects.toMatchObject({ code: "batch.invalidResponse" });
  });
  it.each(["company", "createdBy", "farmVerified", "reviewNote", "cancelReason", "uploadId"])('rejects public projection leaking %s', async field => {
    vi.stubGlobal("fetch", vi.fn(async () => response({ ...publicBatch(), [field]: "private" }))); const { batchesApi } = await import("./batchesApi"); await expect(batchesApi.detail("BATCH-1024")).rejects.toMatchObject({ code: "batch.invalidResponse" });
  });
  it("rejects private nested public fields and malformed company/document summaries", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const { batchesApi } = await import("./batchesApi");
    for (const value of [{ ...publicBatch(), images: company().images }, { ...publicBatch(), costs: company().costs }, { ...publicBatch(), facility: { ...publicBatch().facility, verification: {} } }]) { fetch.mockResolvedValueOnce(response(value)); await expect(batchesApi.detail("BATCH-1024")).rejects.toMatchObject({ code: "batch.invalidResponse" }); }
    for (const patch of [{ reviewedAt: "yesterday" }, { createdBy: "Admin" }, { sponsorshipCount: 1.2 }, { images: [{ ...company().images[0], batchId: "BATCH-1024" }], costs: company().costs }, { company: { id: "private" } }, { facility: { ...company().facility, verification: { ...company().facility!.verification, documents: [{ id: "d1", type: "registration", controlled: "yes" }] } } }]) { fetch.mockResolvedValueOnce(response({ ...company(), ...patch })); await expect(batchesApi.companyDetail("BATCH-1024")).rejects.toMatchObject({ code: "batch.invalidResponse" }); }
    fetch.mockResolvedValueOnce(response([company("open")])); await expect(batchesApi.companyList("draft")).rejects.toMatchObject({ code: "batch.invalidResponse" });
  });
  it("checks duplicate batch/update/photo/cost IDs", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const { batchesApi } = await import("./batchesApi");
    fetch.mockResolvedValueOnce(response(page([publicBatch(), publicBatch()]))); await expect(batchesApi.list({})).rejects.toMatchObject({ code: "batch.invalidResponse" });
    fetch.mockResolvedValueOnce(response([company(), company()])); await expect(batchesApi.companyList()).rejects.toMatchObject({ code: "batch.invalidResponse" });
    fetch.mockResolvedValueOnce(response([update(), update()])); await expect(batchesApi.updates("BATCH-1024")).rejects.toMatchObject({ code: "batch.invalidResponse" });
    fetch.mockResolvedValueOnce(response([{ ...update(), photos: [{ id: "p1", url: "/uploads/a.png" }, { id: "p1", url: "/uploads/b.png" }] }])); await expect(batchesApi.updates("BATCH-1024")).rejects.toMatchObject({ code: "batch.invalidResponse" });
    fetch.mockResolvedValueOnce(response({ ...company(), costs: [...company().costs, ...company().costs] })); await expect(batchesApi.companyDetail("BATCH-1024")).rejects.toMatchObject({ code: "batch.invalidResponse" });
  });
  it("uses exact zero-page and out-of-range-page math, not Math.max(1,pages)", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response(page([]))).mockResolvedValueOnce(response({ items: [], page: 2, limit: 20, total: 1, pages: 1 })); vi.stubGlobal("fetch", fetch); const { batchesApi } = await import("./batchesApi");
    await expect(batchesApi.list({})).resolves.toMatchObject({ total: 0, pages: 0 }); await expect(batchesApi.list({ page: 2 })).resolves.toMatchObject({ page: 2, total: 1, pages: 1 });
  });
  it.each([{ ...page(), page: 2 }, { ...page(), limit: 10 }, { ...page(), total: 0 }, { ...page(), pages: 2 }, { ...page(), total: "1" }, { ...page(), total: 21 }, { ...page([]), pages: 1 }, { ...page(), items: [] }])("rejects wrong page/totals/cardinality %#", async value => {
    vi.stubGlobal("fetch", vi.fn(async () => response(value))); const { batchesApi } = await import("./batchesApi"); await expect(batchesApi.list({})).rejects.toMatchObject({ code: "batch.invalidResponse" });
  });
  it.each([{ q: "unmatched" }, { species: "Koi" }, { region: "North" }, { priceMax: 99 }, { harvestBefore: "2026-12-01" }])("checks each requested public filter %#", async query => {
    vi.stubGlobal("fetch", vi.fn(async () => response(page()))); const { batchesApi } = await import("./batchesApi"); await expect(batchesApi.list(query)).rejects.toMatchObject({ code: "batch.invalidResponse" });
  });
  it("preserves nullable facility region exactly without inventing a fallback", async () => {
    const f = { ...facility(), region: null };
    const fetch = vi.fn().mockResolvedValueOnce(response([f])).mockResolvedValueOnce(response([{ ...f, region: 123 }])); vi.stubGlobal("fetch", fetch); const { batchesApi } = await import("./batchesApi");
    await expect(batchesApi.facilities()).resolves.toEqual([f]); await expect(batchesApi.facilities()).rejects.toMatchObject({ code: "batch.invalidResponse" });
  });
  it("validates readonly facility documents without accepting private URL fields", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response([facility()])); vi.stubGlobal("fetch", fetch); const { batchesApi } = await import("./batchesApi"); await expect(batchesApi.facilities()).resolves.toEqual([facility()]);
    for (const patch of [{ url: "/uploads/private/doc.pdf" }, { uploadId: "u1" }, { sizeBytes: "10" }, { uploadedAt: "2026-02-30T00:00:00Z" }, { controlled: null }]) {
      const f = facility(); Object.assign(f.verification!.documents[0], patch); fetch.mockResolvedValueOnce(response([f])); await expect(batchesApi.facilities()).rejects.toMatchObject({ code: "batch.invalidResponse" });
    }
    fetch.mockResolvedValueOnce(response([facility(), facility()])); await expect(batchesApi.facilities()).rejects.toMatchObject({ code: "batch.invalidResponse" });
  });
});
describe("optional saved-draft submission transport", () => {
  const submitted = (): CompanyBatch => ({ ...company(), status: "pending_review", submittedAt: at, reviewedAt: "2026-10-27T00:00:00Z", reviewedBy: "Prior Admin", updates: [update()] });
  it("sends exactly one protected bodyless POST without clearing retained review or observation fields", async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => response(submitted())); vi.stubGlobal("fetch", fetch);
    const { authApi } = await import("./api"); fetch.mockResolvedValueOnce(response({ accessToken: "test-token", user: { id: "admin1", role: "Admin" } })); await authApi.login("admin@example.test", "LOCAL TEST ONLY"); fetch.mockClear();
    const { batchesApi } = await import("./batchesApi"); await expect(batchesApi.submit("BATCH-1024")).resolves.toEqual(submitted());
    expect(fetch).toHaveBeenCalledTimes(1); const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/v1/company/batches/BATCH-1024/submit"); expect(init.method).toBe("POST"); expect(init.body).toBeUndefined(); expect(init.credentials).toBe("include"); expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test-token");
  });
  it.each([
    null, {}, { ...submitted(), id: "BATCH-9999" }, { ...submitted(), status: "draft" }, { ...submitted(), status: "open" }, { ...submitted(), submittedAt: null }, { ...submitted(), submittedAt: "2026-02-30T00:00:00Z" }, { ...submitted(), reviewNote: "Retained rejection" }, { ...submitted(), sharesAvailable: 9 }, { ...submitted(), shareQuantity: null }, { ...submitted(), images: [] }, { ...submitted(), costs: [{ ...company().costs[0], amount: 99 }] }, { ...submitted(), facility: null },
    ...[{ status: "pending" }, { level: "none" }, { validUntil: null }, { documents: [] }, { documents: [{ id: "document1", type: "Registration", controlled: false }] }].map(patch => ({ ...submitted(), facility: { ...company().facility, verification: { ...company().facility!.verification, ...patch } } })),
  ])("rejects malformed or inconsistent submission acknowledgement %#", async value => {
    vi.stubGlobal("fetch", vi.fn(async () => response(value))); const { batchesApi } = await import("./batchesApi"); await expect(batchesApi.submit("BATCH-1024")).rejects.toMatchObject({ code: "batch.invalidResponse" });
  });
  it("does not reinterpret authoritative expiry using the client clock or require publication metadata", async () => {
    const value = submitted(); value.facility!.verification!.validUntil = "2020-01-01T00:00:00Z";
    vi.stubGlobal("fetch", vi.fn(async () => response(value))); const { batchesApi } = await import("./batchesApi"); await expect(batchesApi.submit("BATCH-1024")).resolves.toMatchObject({ farmVerified: false, inspectedAt: null, inspector: null, reviewedBy: "Prior Admin" });
  });
  it("rejects unsafe IDs before HTTP and passes server prerequisites/conflicts through", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const { batchesApi } = await import("./batchesApi");
    await expect(batchesApi.submit("bad/id")).rejects.toMatchObject({ field: "id" }); expect(fetch).not.toHaveBeenCalled();
    for (const [code, status] of [["batch.invalidTransition", 409], ["batch.complianceRequired", 409], ["batch.costMismatch", 400]] as const) {
      fetch.mockResolvedValueOnce(response({ code, params: { from: "pending_review", action: "submit" } }, status)); await expect(batchesApi.submit("BATCH-1024")).rejects.toMatchObject({ code, status });
    }
    fetch.mockResolvedValueOnce(response({})); await expect(batchesApi.submit("BATCH-1024")).rejects.toMatchObject({ code: "batch.invalidResponse" });
    fetch.mockResolvedValueOnce(response(submitted())); await expect(batchesApi.submit("BATCH-1024")).resolves.toMatchObject({ status: "pending_review" });
  });
  it("holds the shared cross-action lock through decode, including cancellation and reciprocal create", async () => {
    let finish: (value: unknown) => void = () => {};
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: () => new Promise(resolve => { finish = resolve; }) }); vi.stubGlobal("fetch", fetch); const { batchesApi } = await import("./batchesApi");
    const pending = batchesApi.submit("BATCH-1024");
    for (const promise of [batchesApi.submit("BATCH-1024"), batchesApi.cancel("BATCH-1024", "Reason"), batchesApi.create(input()), batchesApi.save("BATCH-1024", {}), batchesApi.publish("BATCH-1024"), batchesApi.addUpdate("BATCH-1024", { stage: "nursery" })]) await expect(promise).rejects.toMatchObject({ code: "batch.requestPending" });
    expect(fetch).toHaveBeenCalledTimes(1); finish(submitted()); await pending;
    fetch.mockResolvedValueOnce(response(company())); const creating = batchesApi.create(input()); await expect(batchesApi.submit("BATCH-1024")).rejects.toMatchObject({ code: "batch.requestPending" }); await creating;
  });
  it("never refreshes/replays a submission after 401 or uncertain network failure", async () => {
    const fetch = vi.fn(async () => response({ code: "auth.unauthorized" }, 401)); vi.stubGlobal("fetch", fetch); const { batchesApi } = await import("./batchesApi");
    await expect(batchesApi.submit("BATCH-1024")).rejects.toMatchObject({ status: 401 }); expect(fetch).toHaveBeenCalledTimes(1);
    fetch.mockRejectedValue(new TypeError("Lost response")); await expect(batchesApi.submit("BATCH-1024")).rejects.toThrow("Lost response"); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each(["same-account", "other-account", "logout", "role-change"] as const)("rejects late submission results after %s", async change => {
    let finish: (value: unknown) => void = () => {};
    const login = (id: string, role: string) => response({ accessToken: "test-token", user: { id, role } });
    const fetch = vi.fn().mockResolvedValueOnce(login("admin1", "Admin")); vi.stubGlobal("fetch", fetch); const { authApi, clearApiSession } = await import("./api"); await authApi.login("admin@example.test", "LOCAL TEST ONLY");
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => new Promise(resolve => { finish = resolve; }) }); const { batchesApi } = await import("./batchesApi"); const pending = batchesApi.submit("BATCH-1024");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    if (change === "logout") clearApiSession(); else { fetch.mockResolvedValueOnce(login(change === "other-account" ? "admin2" : "admin1", change === "role-change" ? "User" : "Admin")); await authApi.login("admin@example.test", "LOCAL TEST ONLY"); }
    finish(submitted()); await expect(pending).rejects.toMatchObject({ code: "auth.sessionChanged" });
  });
  it("does not adopt a previously anonymous write into a newly logged-in session", async () => {
    let finish: (value: unknown) => void = () => {};
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: () => new Promise(resolve => { finish = resolve; }) }); vi.stubGlobal("fetch", fetch); const { batchesApi } = await import("./batchesApi"); const pending = batchesApi.submit("BATCH-1024");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1)); const { authApi } = await import("./api"); fetch.mockResolvedValueOnce(response({ accessToken: "test-token", user: { id: "admin1", role: "Admin" } })); await authApi.login("admin@example.test", "LOCAL TEST ONLY");
    finish(submitted()); await expect(pending).rejects.toMatchObject({ code: "auth.sessionChanged" });
  });
});
describe("batch review queue and decisions transport", () => {
  const open = (): CompanyBatch => ({ ...company("open"), inspectedAt: null, inspector: null });
  it("reads the pending-only Admin queue with a protected authenticated GET", async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => response([company("pending_review")])); vi.stubGlobal("fetch", fetch);
    const { authApi } = await import("./api"); fetch.mockResolvedValueOnce(response({ accessToken: "test-token", user: { id: "admin1", role: "Admin" } })); await authApi.login("admin@example.test", "LOCAL TEST ONLY"); fetch.mockClear();
    const { batchesApi } = await import("./batchesApi"); await expect(batchesApi.reviewQueue()).resolves.toEqual([company("pending_review")]);
    expect(fetch).toHaveBeenCalledTimes(1); const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/v1/admin/batches"); expect(init.method).toBeUndefined(); expect(init.body).toBeUndefined(); expect(init.credentials).toBe("include"); expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test-token");
    fetch.mockResolvedValueOnce(response([company("open")])); await expect(batchesApi.reviewQueue()).rejects.toMatchObject({ code: "batch.invalidResponse" });
  });
  it("sends the exact bodyless approve POST and validates the opened record", async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => response(open())); vi.stubGlobal("fetch", fetch);
    const { authApi } = await import("./api"); fetch.mockResolvedValueOnce(response({ accessToken: "test-token", user: { id: "admin1", role: "Admin" } })); await authApi.login("admin@example.test", "LOCAL TEST ONLY"); fetch.mockClear();
    const { batchesApi } = await import("./batchesApi"); await expect(batchesApi.approve("BATCH-1024")).resolves.toEqual(open());
    expect(fetch).toHaveBeenCalledTimes(1); const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/v1/admin/batches/BATCH-1024/approve"); expect(init.method).toBe("POST"); expect(init.body).toBeUndefined(); expect(init.credentials).toBe("include"); expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test-token");
  });
  it.each([
    { ...company("open"), id: "BATCH-9999" }, { ...company("open"), status: "pending_review" as const }, { ...company("open"), submittedAt: null }, { ...company("open"), reviewedAt: null }, { ...company("open"), reviewedBy: null }, { ...company("open"), reviewNote: "Uncleared" }, { ...company("open"), farmVerified: false }, { ...company("open"), images: [] }, { ...company("open"), costs: [{ ...company().costs[0], amount: 99 }] },
    ...[{ status: "pending" }, { level: "none" }, { validUntil: null }, { documents: [] }, { documents: [{ id: "document1", type: "Registration", controlled: false }] }].map(patch => ({ ...company("open"), facility: { ...company().facility, verification: { ...company().facility!.verification, ...patch } } })),
    { ...company("open"), inspectedAt: "2026-10-29T00:00:00.000Z" }, { ...company("open"), inspector: "Unexpected" },
  ])("rejects malformed or inconsistent approval %#", async value => {
    vi.stubGlobal("fetch", vi.fn(async () => response(value))); const { batchesApi } = await import("./batchesApi");
    await expect(batchesApi.approve("BATCH-1024")).rejects.toMatchObject({ code: "batch.invalidResponse" });
  });
  it("sends the exact reject body and validates the returned draft metadata", async () => {
    const rejected = (): CompanyBatch => ({ ...company("draft"), reviewedAt: at, reviewedBy: "Reviewer", reviewNote: "Fix the budget.", submittedAt: at });
    const fetch = vi.fn(async (_url: string, init: RequestInit) => response(rejected())); vi.stubGlobal("fetch", fetch);
    const { authApi } = await import("./api"); fetch.mockResolvedValueOnce(response({ accessToken: "test-token", user: { id: "admin1", role: "Admin" } })); await authApi.login("admin@example.test", "LOCAL TEST ONLY"); fetch.mockClear();
    const { batchesApi } = await import("./batchesApi"); await expect(batchesApi.reject("BATCH-1024", "  Fix the budget.  ")).resolves.toEqual(rejected());
    expect(fetch).toHaveBeenCalledTimes(1); const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/v1/admin/batches/BATCH-1024/reject"); expect(init.method).toBe("POST"); expect(init.body).toBe('{"note":"Fix the budget."}'); expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test-token");
    for (const patch of [{ status: "open" as const }, { reviewedAt: null }, { reviewedBy: null }, { reviewNote: "Other" }]) {
      fetch.mockResolvedValueOnce(response({ ...rejected(), ...patch })); await expect(batchesApi.reject("BATCH-1024", "Fix the budget.")).rejects.toMatchObject({ code: "batch.invalidResponse" });
    }
    const fetch2 = vi.fn(); vi.stubGlobal("fetch", fetch2);
    for (const note of ["", " ", "x".repeat(1001), null, 7]) await expect(batchesApi.reject("BATCH-1024", note as string)).rejects.toMatchObject({ field: "note" });
    await expect(batchesApi.reject("bad/id", "Note")).rejects.toMatchObject({ field: "id" }); expect(fetch2).not.toHaveBeenCalled();
  });
  it("passes server review conflicts through and never refreshes/replays a decision", async () => {
    const fetch = vi.fn(async () => response({ code: "batch.invalidTransition", params: { from: "open", action: "approve" } }, 409)); vi.stubGlobal("fetch", fetch); const { batchesApi } = await import("./batchesApi");
    await expect(batchesApi.approve("BATCH-1024")).rejects.toMatchObject({ code: "batch.invalidTransition", status: 409 });
    await expect(batchesApi.reject("BATCH-1024", "Note")).rejects.toMatchObject({ code: "batch.invalidTransition", status: 409 });
    fetch.mockResolvedValue(new Response(JSON.stringify({ code: "auth.unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } }));
    await expect(batchesApi.approve("BATCH-1024")).rejects.toMatchObject({ status: 401 }); expect(fetch).toHaveBeenCalledTimes(3);
    fetch.mockRejectedValue(new TypeError("Lost response")); await expect(batchesApi.reject("BATCH-1024", "Note")).rejects.toThrow("Lost response"); expect(fetch).toHaveBeenCalledTimes(4);
  });
  it("holds the shared cross-action lock through queue decisions and releases it after malformed acknowledgements", async () => {
    let finish: (value: unknown) => void = () => {};
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: () => new Promise(resolve => { finish = resolve; }) }); vi.stubGlobal("fetch", fetch); const { batchesApi } = await import("./batchesApi");
    const pending = batchesApi.approve("BATCH-1024");
    for (const promise of [batchesApi.approve("BATCH-1024"), batchesApi.reject("BATCH-1024", "Note"), batchesApi.submit("BATCH-1024"), batchesApi.cancel("BATCH-1024", "Reason"), batchesApi.publish("BATCH-1024")]) await expect(promise).rejects.toMatchObject({ code: "batch.requestPending" });
    expect(fetch).toHaveBeenCalledTimes(1); finish({}); await expect(pending).rejects.toMatchObject({ code: "batch.invalidResponse" });
    fetch.mockResolvedValueOnce(response([company("pending_review")])); await expect(batchesApi.reviewQueue()).resolves.toHaveLength(1);
  });
  it.each(["same-account", "other-account", "logout", "role-change"] as const)("rejects late decision results after %s", async change => {
    let finish: (value: unknown) => void = () => {};
    const login = (id: string, role: string) => response({ accessToken: "test-token", user: { id, role } });
    const fetch = vi.fn().mockResolvedValueOnce(login("admin1", "Admin")); vi.stubGlobal("fetch", fetch); const { authApi, clearApiSession } = await import("./api"); await authApi.login("admin@example.test", "LOCAL TEST ONLY");
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => new Promise(resolve => { finish = resolve; }) }); const { batchesApi } = await import("./batchesApi"); const pending = batchesApi.approve("BATCH-1024");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    if (change === "logout") clearApiSession(); else { fetch.mockResolvedValueOnce(login(change === "other-account" ? "admin2" : "admin1", change === "role-change" ? "User" : "Admin")); await authApi.login("admin@example.test", "LOCAL TEST ONLY"); }
    finish(company("open")); await expect(pending).rejects.toMatchObject({ code: "auth.sessionChanged" });
  });
});
describe("unsponsored cancellation transport", () => {
  const cancelled = (note = "No sponsorships yet."): CompanyBatch => ({ ...company("open"), status: "cancelled", cancelledAt: at, cancelReason: note, updates: [update()] });
  it("sends the exact protected Admin POST and preserves retained review/share/observation data", async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => response(cancelled())); vi.stubGlobal("fetch", fetch);
    const { authApi } = await import("./api"); fetch.mockResolvedValueOnce(response({ accessToken: "test-token", user: { id: "admin1", role: "Admin" } })); await authApi.login("admin@example.test", "LOCAL TEST ONLY"); fetch.mockClear();
    const { batchesApi } = await import("./batchesApi"); await expect(batchesApi.cancel("BATCH-1024", "  No sponsorships yet.  ")).resolves.toEqual(cancelled());
    expect(fetch).toHaveBeenCalledTimes(1); const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/v1/admin/batches/BATCH-1024/cancel"); expect(init.method).toBe("POST"); expect(init.body).toBe('{"note":"No sponsorships yet."}'); expect(init.credentials).toBe("include"); expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test-token");
  });
  it("rejects invalid reasons and IDs before HTTP, then releases the shared lock", async () => {
    const fetch = vi.fn(async () => response(cancelled())); vi.stubGlobal("fetch", fetch); const { batchesApi } = await import("./batchesApi");
    for (const note of ["", " ", "x".repeat(1001), null, 7]) await expect(batchesApi.cancel("BATCH-1024", note as string)).rejects.toMatchObject({ field: "note" });
    await expect(batchesApi.cancel("bad/id", "Reason")).rejects.toMatchObject({ field: "id" }); expect(fetch).not.toHaveBeenCalled();
    await expect(batchesApi.cancel("BATCH-1024", "No sponsorships yet.")).resolves.toMatchObject({ status: "cancelled" });
  });
  it.each([null, {}, { ...cancelled(), id: "BATCH-9999" }, { ...cancelled(), status: "draft" }, { ...cancelled(), cancelledAt: null }, { ...cancelled(), cancelledAt: "2026-02-30T00:00:00Z" }, { ...cancelled(), cancelReason: null }, { ...cancelled(), cancelReason: "Different" }, { ...cancelled(), sponsorshipCount: 1 }, { ...cancelled(), cancelReason: "x".repeat(1001) }])("rejects wrong or malformed cancellation acknowledgements %#", async value => {
    vi.stubGlobal("fetch", vi.fn(async () => response(value))); const { batchesApi } = await import("./batchesApi"); await expect(batchesApi.cancel("BATCH-1024", "No sponsorships yet.")).rejects.toMatchObject({ code: "batch.invalidResponse" });
  });
  it("accepts backend-valid Unicode cancellation reasons in acknowledgements and later company reads", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const { batchesApi } = await import("./batchesApi");
    for (const note of ["🐟".repeat(1000), "✈️".repeat(1000)]) {
      fetch.mockResolvedValueOnce(response(cancelled(note))); await expect(batchesApi.cancel("BATCH-1024", ` ${note} `)).resolves.toMatchObject({ cancelReason: note });
      fetch.mockResolvedValueOnce(response(cancelled(note))); await expect(batchesApi.companyDetail("BATCH-1024")).resolves.toMatchObject({ cancelReason: note });
    }
  });
  it("preserves backend-valid Unicode review notes through cancellation and reconciliation", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const { batchesApi } = await import("./batchesApi");
    for (const unit of ["🐟", "✈️"]) {
      const value = { ...cancelled(), reviewNote: unit.repeat(1000) };
      fetch.mockResolvedValueOnce(response(value)); await expect(batchesApi.cancel("BATCH-1024", "No sponsorships yet.")).resolves.toMatchObject({ reviewNote: value.reviewNote });
      fetch.mockResolvedValueOnce(response(value)); await expect(batchesApi.companyDetail("BATCH-1024")).resolves.toMatchObject({ reviewNote: value.reviewNote });
      fetch.mockResolvedValueOnce(response({ ...value, reviewNote: unit.repeat(1001) })); await expect(batchesApi.cancel("BATCH-1024", "No sponsorships yet.")).rejects.toMatchObject({ code: "batch.invalidResponse" });
    }
  });
  it("never refreshes or replays cancellation after 401 or a lost response", async () => {
    const fetch = vi.fn(async () => response({ code: "auth.unauthorized" }, 401)); vi.stubGlobal("fetch", fetch); const { batchesApi } = await import("./batchesApi");
    await expect(batchesApi.cancel("BATCH-1024", "Reason")).rejects.toMatchObject({ status: 401 }); expect(fetch).toHaveBeenCalledTimes(1);
    fetch.mockRejectedValue(new TypeError("Lost response")); await expect(batchesApi.cancel("BATCH-1024", "Reason")).rejects.toThrow("Lost response"); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("shares the existing lock across every mutation through cancellation decode", async () => {
    let finish: (value: unknown) => void = () => {};
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: () => new Promise(resolve => { finish = resolve; }) }); vi.stubGlobal("fetch", fetch); const { batchesApi } = await import("./batchesApi");
    const pending = batchesApi.cancel("BATCH-1024", "No sponsorships yet.");
    for (const promise of [batchesApi.cancel("BATCH-1024", "Again"), batchesApi.create(input()), batchesApi.save("BATCH-1024", {}), batchesApi.publish("BATCH-1024"), batchesApi.addUpdate("BATCH-1024", { stage: "nursery" })]) await expect(promise).rejects.toMatchObject({ code: "batch.requestPending" });
    expect(fetch).toHaveBeenCalledTimes(1); finish(cancelled()); await pending;
    fetch.mockResolvedValueOnce(response(company())); const creating = batchesApi.create(input());
    await expect(batchesApi.cancel("BATCH-1024", "Again")).rejects.toMatchObject({ code: "batch.requestPending" }); await creating;
  });
  it.each(["same-account", "other-account", "logout", "role-change"] as const)("rejects a late cancellation result after %s session invalidation", async change => {
    let finish: (value: unknown) => void = () => {};
    const login = (id: string, role: string) => response({ accessToken: "test-token", user: { id, role } });
    const fetch = vi.fn().mockResolvedValueOnce(login("admin1", "Admin")); vi.stubGlobal("fetch", fetch); const { authApi, clearApiSession } = await import("./api"); await authApi.login("admin@example.test", "LOCAL TEST ONLY");
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => new Promise(resolve => { finish = resolve; }) }); const { batchesApi } = await import("./batchesApi"); const pending = batchesApi.cancel("BATCH-1024", "No sponsorships yet.");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    if (change === "logout") clearApiSession(); else { fetch.mockResolvedValueOnce(login(change === "other-account" ? "admin2" : "admin1", change === "role-change" ? "User" : "Admin")); await authApi.login("admin@example.test", "LOCAL TEST ONLY"); }
    finish(cancelled()); await expect(pending).rejects.toMatchObject({ code: "auth.sessionChanged" });
  });
  it("passes through sponsorship conflict and releases the lock after malformed acknowledgement", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response({ code: "batch.cancelForbidden" }, 409)).mockResolvedValueOnce(response({})).mockResolvedValueOnce(response(cancelled())); vi.stubGlobal("fetch", fetch); const { batchesApi } = await import("./batchesApi");
    await expect(batchesApi.cancel("BATCH-1024", "No sponsorships yet.")).rejects.toMatchObject({ code: "batch.cancelForbidden" });
    await expect(batchesApi.cancel("BATCH-1024", "No sponsorships yet.")).rejects.toMatchObject({ code: "batch.invalidResponse" });
    await expect(batchesApi.cancel("BATCH-1024", "No sponsorships yet.")).resolves.toMatchObject({ status: "cancelled" });
  });
});
describe("mutation acknowledgement, no replay and shared lock", () => {
  it("rejects saves whose submitted scalar or whole arrays were not persisted", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(company()))); const { batchesApi } = await import("./batchesApi");
    for (const patch of [{ title: "Changed" }, { facilityId: "facility2" }, { images: [] }, { images: [{ url: "/uploads/other.png" }] }, { costs: [] }, { costs: [{ ...input().costs[0], amount: 101 }] }]) await expect(batchesApi.save("BATCH-1024", patch)).rejects.toMatchObject({ code: "batch.invalidResponse" });
  });
  it("compares dates by instant and submitted image positions/first main after sorting", async () => {
    const value = company(); value.stockingDate = at; value.images = [{ ...value.images[0], id: "image2", url: "/uploads/second.png", position: 1, isMain: false }, { ...value.images[0], position: 5 }];
    const fetch = vi.fn(async () => response(value)); vi.stubGlobal("fetch", fetch); const { batchesApi } = await import("./batchesApi");
    const images = [{ url: "/uploads/pond.png", position: 5 }, { url: "/uploads/second.png", position: 1 }];
    await expect(batchesApi.save("BATCH-1024", { stockingDate: "2026-10-28T07:00:00+07:00", images })).resolves.toEqual(value);
    value.images[0].isMain = true; value.images[1].isMain = false; await expect(batchesApi.save("BATCH-1024", { images })).rejects.toMatchObject({ code: "batch.invalidResponse" });
  });
  it.each(["create", "save"] as const)("accepts reordered tied-position %s images with duplicate multiplicity", async action => {
    const main = company().images[0];
    const secondary = { ...main, id: "image2", url: "/uploads/second.png", isMain: false };
    const value = { ...company(), images: [secondary, { ...secondary, id: "image3" }, main] };
    const images = [{ url: main.url, position: 0 }, { url: secondary.url, position: 0 }, { url: secondary.url, position: 0 }];
    vi.stubGlobal("fetch", vi.fn(async () => response(value))); const { batchesApi } = await import("./batchesApi");
    await expect(action === "create" ? batchesApi.create({ ...input(), images }) : batchesApi.save("BATCH-1024", { images })).resolves.toEqual(value);
  });
  it("rejects tied-position wrong cover and missing/extra duplicate multiplicity", async () => {
    const main = company().images[0];
    const secondary = { ...main, id: "image2", url: "/uploads/second.png", isMain: false };
    const images = [{ url: main.url, position: 0 }, { url: secondary.url, position: 0 }, { url: secondary.url, position: 0 }];
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const { batchesApi } = await import("./batchesApi");
    for (const returned of [
      [{ ...secondary, isMain: true }, { ...secondary, id: "image3" }, { ...main, isMain: false }],
      [secondary, main],
      [secondary, { ...secondary, id: "image3" }, { ...secondary, id: "image4" }, main],
    ]) {
      for (const action of ["create", "save"] as const) {
        fetch.mockResolvedValueOnce(response({ ...company(), images: returned }));
        await expect(action === "create" ? batchesApi.create({ ...input(), images }) : batchesApi.save("BATCH-1024", { images })).rejects.toMatchObject({ code: "batch.invalidResponse" });
      }
    }
  });
  it("compares complete cost multisets rather than generated database ID order", async () => {
    const value = company(); value.costs = [{ ...value.costs[0], id: "cost2", category: "labour", label: "Labour", amount: 60 }, { ...value.costs[0], amount: 40 }];
    vi.stubGlobal("fetch", vi.fn(async () => response(value))); const { batchesApi } = await import("./batchesApi");
    await expect(batchesApi.save("BATCH-1024", { costs: [{ category: "feed", label: "Feed", amount: 40, allocation: "per_share" }, { category: "labour", label: "Labour", amount: 60, allocation: "per_share" }] })).resolves.toEqual(value);
  });
  it("honours backend count-mode weight discard without treating omission as clearing", async () => {
    const value = company(); value.breed = "Retained";
    vi.stubGlobal("fetch", vi.fn(async () => response(value))); const { batchesApi } = await import("./batchesApi");
    await expect(batchesApi.save("BATCH-1024", { expectedHarvestWeightG: 1000 })).resolves.toMatchObject({ expectedHarvestWeightG: null, breed: "Retained" });
  });
  it("rejects create defaults/publication wrong states and canonical mutation-ID changes", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const { batchesApi } = await import("./batchesApi");
    fetch.mockResolvedValueOnce(response({ ...company(), contingencyPct: 0 })); await expect(batchesApi.create(input())).rejects.toMatchObject({ code: "batch.invalidResponse" });
    fetch.mockResolvedValueOnce(response(company())); await expect(batchesApi.publish("BATCH-1024")).rejects.toMatchObject({ code: "batch.invalidResponse" });
    fetch.mockResolvedValueOnce(response({ ...company(), id: "BATCH-9999" })); await expect(batchesApi.save("BATCH-1024", {})).rejects.toMatchObject({ code: "batch.invalidResponse" });
    const open = company("open"); open.facility!.verification!.documents[0].controlled = false; fetch.mockResolvedValueOnce(response(open)); await expect(batchesApi.publish("BATCH-1024")).rejects.toMatchObject({ code: "batch.invalidResponse" });
  });
  it("rejects addUpdate acknowledgement changes to stage, optional measurements, note or photos", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(update()))); const { batchesApi } = await import("./batchesApi");
    for (const patch of [{ stage: "grow_out" as const }, { averageWeightG: 1 }, { countAlive: 0 }, { note: "Care" }, { photoUrls: ["/uploads/care.png"] }]) await expect(batchesApi.addUpdate("BATCH-1024", { stage: "nursery", ...patch })).rejects.toMatchObject({ code: "batch.invalidResponse" });
  });
  it.each(["create", "save", "publish", "addUpdate"] as const)("does not refresh/replay %s after 401 or uncertain network outcome", async action => {
    const fetch = vi.fn(async () => response({ code: "auth.unauthorized" }, 401)); vi.stubGlobal("fetch", fetch); const { batchesApi } = await import("./batchesApi");
    const invoke = () => action === "create" ? batchesApi.create(input()) : action === "save" ? batchesApi.save("BATCH-1024", {}) : action === "publish" ? batchesApi.publish("BATCH-1024") : batchesApi.addUpdate("BATCH-1024", { stage: "nursery" });
    await expect(invoke()).rejects.toMatchObject({ status: 401 }); expect(fetch).toHaveBeenCalledTimes(1);
    fetch.mockRejectedValue(new TypeError("Lost response")); await expect(invoke()).rejects.toThrow("Lost response"); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("holds a synchronous cross-mutation lock through JSON decode and validation", async () => {
    let finish: (value: unknown) => void = () => {};
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: () => new Promise(resolve => { finish = resolve; }) }); vi.stubGlobal("fetch", fetch); const { batchesApi } = await import("./batchesApi");
    const pending = batchesApi.create(input());
    await expect(batchesApi.create(input())).rejects.toMatchObject({ code: "batch.requestPending" }); await expect(batchesApi.save("BATCH-1024", {})).rejects.toMatchObject({ code: "batch.requestPending" }); await expect(batchesApi.publish("BATCH-1024")).rejects.toMatchObject({ code: "batch.requestPending" }); await expect(batchesApi.addUpdate("BATCH-1024", { stage: "nursery" })).rejects.toMatchObject({ code: "batch.requestPending" });
    expect(fetch).toHaveBeenCalledTimes(1); finish(company()); await pending;
    fetch.mockResolvedValueOnce(response(update())); await expect(batchesApi.addUpdate("BATCH-1024", { stage: "nursery" })).resolves.toMatchObject({ id: "update1" });
  });
  it("releases the lock after malformed acknowledgement or input validation", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response({})).mockResolvedValueOnce(response(company())); vi.stubGlobal("fetch", fetch); const { batchesApi } = await import("./batchesApi");
    await expect(batchesApi.create({} as BatchInput)).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled(); await expect(batchesApi.create(input())).rejects.toMatchObject({ code: "batch.invalidResponse" }); await expect(batchesApi.create(input())).resolves.toMatchObject({ id: "BATCH-1024" });
  });
  it("preserves retained backend error codes instead of inventing success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({ code: "batch.costMismatch", params: { expected: 1000, actual: 900 } }, 400))); const { batchesApi } = await import("./batchesApi");
    await expect(batchesApi.publish("BATCH-1024")).rejects.toMatchObject({ code: "batch.costMismatch", params: { expected: 1000, actual: 900 } });
  });
});
