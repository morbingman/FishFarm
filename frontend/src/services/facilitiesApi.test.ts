import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Facility, FacilityDecision, FacilityDocument, FacilityInput, Verification, VerificationInput } from "./facilityContracts";
const at = "2026-10-29T00:00:00.000Z", future = "2027-01-01T00:00:00.000Z";
const doc = (id = "document1", type = "Registration"): FacilityDocument => ({ id, type, controlled: true, mimeType: "application/pdf", sizeBytes: 3, uploadedAt: at });
const verification = (status: Verification["status"] = "pending"): Verification => ({ id: "verification1", level: "registered", status, inspectedAt: null, inspector: "Retained", notes: "Retained note", validUntil: null, submittedAt: at, reviewedAt: null, reviewedBy: null, documents: [doc()] });
const facility = (value: Verification | null = null): Facility => ({ id: "facility1", name: "Pond", location: "Farm pond", region: null, verification: value, batchCount: 0, createdAt: at, updatedAt: at });
const create = (): FacilityInput => ({ name: " Pond ", location: " Farm pond " });
const submit = (): VerificationInput => ({ level: "registered", documents: [{ type: " Registration ", uploadId: "upload1" }] });
const saved = (previous: Verification | null = null): Verification => ({ ...verification(), inspector: previous?.inspector ?? null, notes: previous?.notes ?? null, documents: [doc("document2")] });
const decision = (status: FacilityDecision["status"] = "approved"): FacilityDecision => ({ status, ...(status === "approved" ? { validUntil: future } : {}) });
const inspected = (previous = verification(), input = decision()): Verification => ({ ...previous, ...input, reviewedAt: at, reviewedBy: "Admin" });
const upload = () => ({ id: "upload1", url: "/uploads/private/12345678-1234-1234-1234-123456789abc.pdf", mimeType: "application/pdf", sizeBytes: 3, purpose: "farm_document", isPrivate: true });
const file = () => new File(["pdf"], "document.pdf", { type: "application/pdf" });
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
beforeEach(() => { vi.resetModules(); vi.stubGlobal("sessionStorage", { removeItem: vi.fn() }); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("facility transport routes and sanitization", () => {
  it("exports only retained operations and uses authenticated company/Admin reads", async () => {
    const fetch = vi.fn(async (url: string, _init: RequestInit) => response(url.endsWith("verification") ? verification() : url.endsWith("facility1") ? facility(verification()) : [facility()])); vi.stubGlobal("fetch", fetch);
    const { facilitiesApi } = await import("./facilitiesApi"), signal = new AbortController().signal;
    await facilitiesApi.list(signal); await facilitiesApi.detail("facility1", signal); await facilitiesApi.verification("facility1", false, signal); await facilitiesApi.verification("facility1", true, signal);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/v1/company/facilities", "/v1/company/facilities/facility1", "/v1/company/facilities/facility1/verification", "/v1/admin/facilities/facility1/verification"]);
    for (const [, init] of fetch.mock.calls) { expect(init.credentials).toBe("include"); expect(init.signal).toBeInstanceOf(AbortSignal); expect(init.body).toBeUndefined(); }
    expect(Object.keys(facilitiesApi).sort()).toEqual(["create", "detail", "document", "inspect", "list", "submit", "upload", "verification"]);
  });
  it("sends exact normalized create body and validates the new facility defaults", async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => response(facility())); vi.stubGlobal("fetch", fetch); const { facilitiesApi } = await import("./facilitiesApi");
    const value = await facilitiesApi.create(create()); expect(value).toEqual(facility()); expect(() => Object.assign(value, { id: "different" })).toThrow();
    expect(fetch.mock.calls[0][0]).toBe("/v1/company/facilities"); expect(fetch.mock.calls[0][1].method).toBe("POST"); expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual({ name: "Pond", location: "Farm pond" });
    for (const patch of [{ name: "Other" }, { region: "Other" }, { batchCount: 1 }, { verification: verification() }]) { fetch.mockResolvedValueOnce(response({ ...facility(), ...patch })); await expect(facilitiesApi.create(create())).rejects.toMatchObject({ code: "facility.invalidResponse" }); }
  });
  it("uploads exact farm_document FormData and discards the private storage URL", async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => response(upload())); vi.stubGlobal("fetch", fetch); const { facilitiesApi } = await import("./facilitiesApi");
    const value = await facilitiesApi.upload(file()); expect(value).toEqual({ id: "upload1", mimeType: "application/pdf", sizeBytes: 3, purpose: "farm_document", isPrivate: true }); expect(value).not.toHaveProperty("url");
    expect(fetch.mock.calls[0][0]).toBe("/v1/uploads"); const init = fetch.mock.calls[0][1]; expect(init.method).toBe("POST"); expect(init.body).toBeInstanceOf(FormData); expect([...((init.body as FormData).keys())]).toEqual(["file", "purpose"]); expect((init.body as FormData).get("purpose")).toBe("farm_document"); expect(new Headers(init.headers).has("Content-Type")).toBe(false);
  });
  it("rejects public/traversal/private URL shape and MIME extension/metadata mismatches", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const { facilitiesApi } = await import("./facilitiesApi");
    for (const patch of [{ url: "/uploads/a.pdf" }, { url: "/uploads/private/../a.pdf" }, { url: "https://example.test/uploads/private/a.pdf" }, { url: `${upload().url}?x=1` }, { url: upload().url.replace(".pdf", ".png") }, { isPrivate: false }, { purpose: "dispute_attachment" }, { sizeBytes: 4 }, { mimeType: "image/png" }, { ownerId: "private" }]) { fetch.mockResolvedValueOnce(response({ ...upload(), ...patch })); await expect(facilitiesApi.upload(file())).rejects.toMatchObject({ code: "facility.invalidResponse" }); }
  });
  it("downloads only protected resource-scoped content with matching controlled metadata", async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => new Response("pdf", { headers: { "Content-Type": "application/pdf" } })); vi.stubGlobal("fetch", fetch); const { facilitiesApi } = await import("./facilitiesApi"), controller = new AbortController();
    await expect(facilitiesApi.document("facility1", doc(), false, controller.signal)).resolves.toMatchObject({ size: 3, type: "application/pdf" }); await facilitiesApi.document("facility1", doc(), true);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/v1/company/facilities/facility1/verification/documents/document1/content", "/v1/admin/facilities/facility1/verification/documents/document1/content"]); expect(fetch.mock.calls.every(([, init]) => init.credentials === "include")).toBe(true);
    for (const patch of [{ controlled: false }, { sizeBytes: null }, { mimeType: null }]) await expect(facilitiesApi.document("facility1", { ...doc(), ...patch }, false)).rejects.toMatchObject({ field: "document" });
    for (const result of [new Response("wrong", { headers: { "Content-Type": "application/pdf" } }), new Response("pdf", { headers: { "Content-Type": "text/html" } })]) { fetch.mockResolvedValueOnce(result); await expect(facilitiesApi.document("facility1", doc(), false)).rejects.toMatchObject({ code: "facility.invalidResponse" }); }
  });
  it("rejects unsafe IDs, bad selectors, inputs and files before transport; forwards abort", async () => {
    const fetch = vi.fn(async (_url: string, init: RequestInit) => { if (init.signal?.aborted) throw new DOMException("Aborted", "AbortError"); return response([]); }); vi.stubGlobal("fetch", fetch); const { facilitiesApi } = await import("./facilitiesApi");
    for (const invoke of [() => facilitiesApi.detail("bad/id"), () => facilitiesApi.create({ name: "", location: "South" }), () => facilitiesApi.submit("facility1", { ...submit(), documents: [] }), () => facilitiesApi.inspect("facility1", { status: "approved" }), () => facilitiesApi.verification("facility1", "admin" as unknown as boolean), () => facilitiesApi.upload(new File(["x"], "a.svg", { type: "image/svg+xml" }))]) await expect(invoke()).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled(); const controller = new AbortController(); controller.abort(); await expect(facilitiesApi.list(controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});
describe("strict DTO projection validation", () => {
  it("preserves nullable/legacy document projections and immutable IDs", async () => {
    const value = verification(); value.documents[0] = { ...doc(), controlled: false, mimeType: null, sizeBytes: null };
    vi.stubGlobal("fetch", vi.fn(async () => response(facility(value)))); const { facilitiesApi } = await import("./facilitiesApi"); const result = await facilitiesApi.detail("facility1"); expect(result.region).toBeNull(); expect(result.verification).toEqual(value); expect(() => Object.assign(result.verification!.documents[0], { id: "changed" })).toThrow();
  });
  it("accepts saved Unicode boundary text in facility, verification and protected document projections", async () => {
    const { validateFacility, validateVerification, facilitiesApi } = await import("./facilitiesApi");
    for (const unit of ["\u{10437}", "\u2764\uFE0F", "\u{10437}\uFE0E"]) {
      const value = { ...verification(), inspector: unit.repeat(120), notes: unit.repeat(2000), documents: [doc("d1", unit.repeat(80))] };
      const directory = { ...facility(value), name: unit.repeat(120), location: unit.repeat(200), region: unit.repeat(80) };
      expect(validateFacility(directory)).toEqual(directory); expect(validateVerification(value)).toEqual(value);
      for (const key of ["name", "location", "region"] as const) expect(() => validateFacility({ ...directory, [key]: `${directory[key]}x` })).toThrow("facility.invalidResponse");
      for (const key of ["inspector", "notes"] as const) expect(() => validateVerification({ ...value, [key]: `${value[key]}x` })).toThrow("facility.invalidResponse");
      expect(() => validateVerification({ ...value, documents: [doc("d1", `${unit.repeat(80)}x`)] })).toThrow("facility.invalidResponse");
      const fetch = vi.fn(async () => new Response("pdf", { headers: { "Content-Type": "application/pdf" } })); vi.stubGlobal("fetch", fetch);
      await expect(facilitiesApi.document("facility1", value.documents[0], false)).resolves.toMatchObject({ size: 3 });
    }
  });
  it("acknowledges Unicode create/submit/inspect inputs without rejecting backend-valid saved text", async () => {
    const unit = "\u{10437}", creation = { name: unit.repeat(61), location: unit.repeat(200), region: unit.repeat(80) };
    const input: VerificationInput = { level: "registered", inspector: unit.repeat(120), notes: unit.repeat(2000), documents: [{ type: unit.repeat(80), uploadId: "upload1" }] };
    const submission = { ...saved(), inspector: input.inspector!, notes: input.notes!, documents: [doc("d2", input.documents[0].type)] };
    const review: FacilityDecision = { status: "rejected", inspector: input.inspector!, notes: input.notes! };
    const fetch = vi.fn().mockResolvedValueOnce(response({ ...facility(), ...creation })).mockResolvedValueOnce(response(facility())).mockResolvedValueOnce(response(submission)).mockResolvedValueOnce(response(submission)).mockResolvedValueOnce(response(inspected(submission, review))); vi.stubGlobal("fetch", fetch);
    const { facilitiesApi } = await import("./facilitiesApi");
    await expect(facilitiesApi.create(creation)).resolves.toMatchObject(creation);
    await expect(facilitiesApi.submit("facility1", input)).resolves.toEqual(submission);
    await expect(facilitiesApi.inspect("facility1", review)).resolves.toEqual(inspected(submission, review));
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual(input);
  });
  it("rejects extra/missing fields, unsafe IDs, calendar dates, integer and duplicate errors", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const { facilitiesApi } = await import("./facilitiesApi");
    for (const patch of [{ id: "other" }, { region: 1 }, { batchCount: 1.1 }, { batchCount: Number.MAX_SAFE_INTEGER + 1 }, { createdAt: "2026-02-30T00:00:00Z" }, { updatedAt: "2026-10-29T07:00:00+07:00" }, { url: "private" }]) { fetch.mockResolvedValueOnce(response({ ...facility(), ...patch })); await expect(facilitiesApi.detail("facility1")).rejects.toMatchObject({ code: "facility.invalidResponse" }); }
    for (const patch of [{ sizeBytes: "3" }, { sizeBytes: 0 }, { controlled: "true" }, { uploadedAt: "yesterday" }, { uploadId: "upload1" }, { url: upload().url }]) { const value = verification(); Object.assign(value.documents[0], patch); fetch.mockResolvedValueOnce(response(value)); await expect(facilitiesApi.verification("facility1", false)).rejects.toMatchObject({ code: "facility.invalidResponse" }); }
    for (const value of [{ ...verification(), notes: undefined }, { ...verification(), status: "other" }, { ...verification(), documents: [doc(), doc()] }]) { fetch.mockResolvedValueOnce(response(value)); await expect(facilitiesApi.verification("facility1", true)).rejects.toMatchObject({ code: "facility.invalidResponse" }); }
    fetch.mockResolvedValueOnce(response([facility(), facility()])); await expect(facilitiesApi.list()).rejects.toMatchObject({ code: "facility.invalidResponse" });
  });
});
describe("strict submission and inspection acknowledgement", () => {
  it("submits first verification, resets review/dates, retains omitted text and replaces IDs", async () => {
    const previous = { ...verification("revoked"), inspectedAt: at, validUntil: future, reviewedAt: at, reviewedBy: "Old reviewer" };
    const fetch = vi.fn().mockResolvedValueOnce(response(facility())).mockResolvedValueOnce(response(saved())).mockResolvedValueOnce(response(facility(previous))).mockResolvedValueOnce(response(saved(previous))); vi.stubGlobal("fetch", fetch); const { facilitiesApi } = await import("./facilitiesApi");
    await expect(facilitiesApi.submit("facility1", submit())).resolves.toEqual(saved()); await expect(facilitiesApi.submit("facility1", submit())).resolves.toEqual(saved(previous));
    expect(fetch.mock.calls.map(([url, init]) => [url, init.method])).toEqual([["/v1/company/facilities/facility1", undefined], ["/v1/company/facilities/facility1/verification", "POST"], ["/v1/company/facilities/facility1", undefined], ["/v1/company/facilities/facility1/verification", "POST"]]); expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ level: "registered", documents: [{ type: "Registration", uploadId: "upload1" }] });
  });
  it("validates complete type multiplicities after reorder, not unavailable upload mappings", async () => {
    const value = saved(); value.documents = [doc("d2", "Other"), doc("d3"), doc("d4")]; const fetch = vi.fn(async (url: string) => response(url.endsWith("verification") ? value : facility())); vi.stubGlobal("fetch", fetch); const { facilitiesApi } = await import("./facilitiesApi");
    await expect(facilitiesApi.submit("facility1", { level: "registered", documents: [{ type: "Registration", uploadId: "u1" }, { type: "Other", uploadId: "u2" }, { type: "Registration", uploadId: "u3" }] })).resolves.toEqual(value);
    value.documents.pop(); await expect(facilitiesApi.submit("facility1", { ...submit(), documents: [{ type: "Registration", uploadId: "u1" }, { type: "Other", uploadId: "u2" }, { type: "Registration", uploadId: "u3" }] })).rejects.toMatchObject({ code: "facility.invalidResponse" });
  });
  it("does not claim success for stale submitted state, changed retention, reused IDs or uncontrolled docs", async () => {
    const previous = verification("approved"), fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const { facilitiesApi } = await import("./facilitiesApi");
    for (const patch of [{ status: "approved" }, { inspectedAt: at }, { reviewedAt: at }, { reviewedBy: "Admin" }, { submittedAt: null }, { inspector: null }, { notes: null }, { documents: [doc()] }, { documents: [{ ...doc("d2"), controlled: false }] }, { documents: [doc("d2", "Wrong")] }]) { fetch.mockResolvedValueOnce(response(facility(previous))).mockResolvedValueOnce(response({ ...saved(previous), ...patch })); await expect(facilitiesApi.submit("facility1", submit())).rejects.toMatchObject({ code: "facility.invalidResponse" }); }
  });
  it("inspects any prior status, retaining omitted fields/documents and setting review metadata", async () => {
    const previous = { ...verification("revoked"), inspectedAt: at, validUntil: future };
    const fetch = vi.fn(async (url: string, init: RequestInit) => response(url.endsWith("inspect") ? inspected(previous, JSON.parse(init.body as string)) : previous)); vi.stubGlobal("fetch", fetch); const { facilitiesApi } = await import("./facilitiesApi");
    for (const input of [decision(), decision("rejected"), { status: "revoked", notes: "" } as FacilityDecision]) await expect(facilitiesApi.inspect("facility1", input)).resolves.toEqual(inspected(previous, input));
    expect(fetch.mock.calls[1][0]).toBe("/v1/admin/facilities/facility1/inspect"); expect(fetch.mock.calls[1][1].method).toBe("POST");
  });
  it("uses effective non-none level and controlled docs before approval, without inventing a prior-state rule", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const { facilitiesApi } = await import("./facilitiesApi");
    for (const previous of [{ ...verification(), level: "none" }, { ...verification(), documents: [] }, { ...verification(), documents: [{ ...doc(), controlled: false }] }]) { fetch.mockResolvedValueOnce(response(previous)); await expect(facilitiesApi.inspect("facility1", decision())).rejects.toBeInstanceOf(Error); }
    expect(fetch).toHaveBeenCalledTimes(3);
    const previous = { ...verification("rejected"), level: "none" as const }; const input = { ...decision(), level: "inspected" as const }; fetch.mockResolvedValueOnce(response(previous)).mockResolvedValueOnce(response(inspected(previous, input))); await expect(facilitiesApi.inspect("facility1", input)).resolves.toMatchObject({ status: "approved", level: "inspected" });
  });
  it("rejects changed retained scalars/documents or absent review metadata conservatively", async () => {
    const previous = verification(), fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const { facilitiesApi } = await import("./facilitiesApi");
    for (const patch of [{ status: "pending" }, { inspector: "Changed" }, { reviewedAt: null }, { reviewedBy: null }, { validUntil: null }, { documents: [doc("changed")] }]) { fetch.mockResolvedValueOnce(response(previous)).mockResolvedValueOnce(response({ ...inspected(previous), ...patch })); await expect(facilitiesApi.inspect("facility1", decision())).rejects.toMatchObject({ code: "facility.invalidResponse" }); }
  });
});
describe("shared lock, snapshot, session binding and no replay", () => {
  it("locks all mutations synchronously through delayed decode, snapshots before await and releases on failure", async () => {
    let finish: (value: unknown) => void = () => {};
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: () => new Promise(resolve => { finish = resolve; }) }); vi.stubGlobal("fetch", fetch); const { facilitiesApi } = await import("./facilitiesApi");
    const original = create(), pending = facilitiesApi.create(original); original.name = "Changed";
    for (const invoke of [() => facilitiesApi.create(create()), () => facilitiesApi.submit("facility1", submit()), () => facilitiesApi.inspect("facility1", decision()), () => facilitiesApi.upload(file())]) await expect(invoke()).rejects.toMatchObject({ code: "facility.requestPending" });
    expect(fetch).toHaveBeenCalledTimes(1); finish(facility()); await pending;
    fetch.mockResolvedValueOnce(response({})).mockResolvedValueOnce(response(facility())); await expect(facilitiesApi.create(create())).rejects.toMatchObject({ code: "facility.invalidResponse" }); await expect(facilitiesApi.create(create())).resolves.toEqual(facility());
  });
  it("snapshots nested submission and download metadata while preflight/content is pending", async () => {
    let resolve: (value: Response) => void = () => {};
    const fetch = vi.fn().mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; })).mockResolvedValueOnce(response(saved())); vi.stubGlobal("fetch", fetch); const { facilitiesApi } = await import("./facilitiesApi");
    const original = submit(), pending = facilitiesApi.submit("facility1", original); original.documents[0].type = "Changed"; original.level = "none"; resolve(response(facility())); await expect(pending).resolves.toEqual(saved()); expect(JSON.parse(fetch.mock.calls[1][1].body).level).toBe("registered");
    fetch.mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; })); const metadata = doc(), download = facilitiesApi.document("facility1", metadata, false); metadata.sizeBytes = 100; metadata.mimeType = "text/html"; resolve(new Response("pdf", { headers: { "Content-Type": "application/pdf" } })); await expect(download).resolves.toMatchObject({ size: 3 });
  });
  it("does not refresh/replay any mutation after 401 or uncertain network outcome", async () => {
    const fetch = vi.fn(async (url: string, init: RequestInit) => init.method === "POST" ? response({ code: "auth.unauthorized" }, 401) : response(url.startsWith("/v1/admin") ? verification() : facility())); vi.stubGlobal("fetch", fetch); const { facilitiesApi } = await import("./facilitiesApi");
    for (const invoke of [() => facilitiesApi.create(create()), () => facilitiesApi.submit("facility1", submit()), () => facilitiesApi.inspect("facility1", decision("rejected")), () => facilitiesApi.upload(file())]) await expect(invoke()).rejects.toMatchObject({ status: 401 });
    expect(fetch.mock.calls.filter(([, init]) => init.method === "POST")).toHaveLength(4); expect(fetch.mock.calls.some(([url]) => url.includes("/auth/refresh"))).toBe(false);
    fetch.mockRejectedValueOnce(new TypeError("Lost response")); await expect(facilitiesApi.upload(file())).rejects.toThrow("Lost response"); expect(fetch.mock.calls.filter(([url]) => url === "/v1/uploads")).toHaveLength(2);
  });
  it("rejects late responses across session changes rather than publishing mutation/download success", async () => {
    let resolve: (value: Response) => void = () => {};
    const fetch = vi.fn().mockImplementation(() => new Promise<Response>(done => { resolve = done; })); vi.stubGlobal("fetch", fetch); const { facilitiesApi } = await import("./facilitiesApi"), { clearApiSession } = await import("./api");
    const pending = facilitiesApi.create(create()); clearApiSession(); resolve(response(facility())); await expect(pending).rejects.toMatchObject({ code: "auth.sessionChanged" });
    const download = facilitiesApi.document("facility1", doc(), true); clearApiSession(); resolve(new Response("pdf", { headers: { "Content-Type": "application/pdf" } })); await expect(download).rejects.toMatchObject({ code: "auth.sessionChanged" });
  });
});
