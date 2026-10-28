import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Dispute, DisputeInput } from "./contracts";
const fixture = (overrides: Partial<Dispute> = {}): Dispute => ({ id: "d1", order: { id: "ORD/1", status: "delivered" }, buyer: { id: "buyer", name: "Buyer", email: "buyer@example.test" }, reason: "other", description: "Actual detailed report", status: "open", resolution: null, attachments: [], createdAt: "2026-10-28T00:00:00Z", resolvedAt: null, ...overrides });
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
beforeEach(() => { vi.resetModules(); vi.stubGlobal("sessionStorage", { removeItem: vi.fn() }); });
afterEach(() => { vi.unstubAllGlobals(); });
describe("dispute transport", () => {
  it("uses owner/admin routes and omits all from the Admin query", async () => {
    const fetch = vi.fn().mockImplementation((url: string) => Promise.resolve(response(url.includes("/id%2Fa") ? fixture({ id: "id/a" }) : []))); vi.stubGlobal("fetch", fetch);
    const { disputesApi } = await import("./disputesApi");
    await disputesApi.list(false, "resolved"); await disputesApi.list(true); await disputesApi.list(true, "reviewing"); await disputesApi.detail(false, "id/a");
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/v1/me/disputes", "/v1/admin/disputes", "/v1/admin/disputes?status=reviewing", "/v1/me/disputes/id%2Fa"]);
  });
  it("sends only canonical create and decision fields", async () => {
    const fetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
      const action = url.split("/").pop();
      const decision = action === "resolve" || action === "reject";
      return Promise.resolve(response(fixture({ status: action === "start-review" ? "reviewing" : decision ? action === "resolve" ? "resolved" : "rejected" : "open", resolution: decision ? JSON.parse(init.body as string).resolution : null, resolvedAt: decision ? "2026-10-28T01:00:00Z" : null })));
    }); vi.stubGlobal("fetch", fetch);
    const { disputesApi } = await import("./disputesApi");
    await disputesApi.create("ORD/1", { reason: "other", description: "  Actual detailed report  ", uploadIds: ["u1"], attachments: ["public-url"], idempotencyKey: "discard" } as DisputeInput);
    await disputesApi.review("d1"); await disputesApi.finish("d1", "resolve", "  Agreed resolution  "); await disputesApi.finish("d1", "reject", "  Not supported  ");
    expect(fetch.mock.calls.map(([url, init]) => [url, init.method, init.body ? JSON.parse(init.body) : null])).toEqual([
      ["/v1/me/orders/ORD%2F1/dispute", "POST", { reason: "other", description: "Actual detailed report", uploadIds: ["u1"] }],
      ["/v1/admin/disputes/d1/start-review", "POST", null], ["/v1/admin/disputes/d1/resolve", "POST", { resolution: "Agreed resolution" }], ["/v1/admin/disputes/d1/reject", "POST", { resolution: "Not supported" }],
    ]);
  });
  it("uploads multipart evidence without forcing a JSON content type", async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(response({ id: "upload", isPrivate: true, purpose: "dispute_attachment", mimeType: "image/png", sizeBytes: 3, url: "/uploads/private/file.png" }))); vi.stubGlobal("fetch", fetch);
    const { disputesApi } = await import("./disputesApi");
    const file = new File(["png"], "evidence.png", { type: "image/png" }); await disputesApi.upload(file);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/v1/uploads"); expect(init.body.get("purpose")).toBe("dispute_attachment"); expect(init.body.get("file").name).toBe("evidence.png");
    expect(init.headers.has("Content-Type")).toBe(false);
  });
  it("fetches private bytes with bearer auth and one refresh retry", async () => {
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/auth/refresh")) return response({ accessToken: "fresh", user: null });
      return new Headers(init.headers).get("Authorization") === "Bearer fresh" ? new Response("private bytes", { headers: { "Content-Type": "application/pdf" } }) : response({ code: "auth.sessionExpired" }, 401);
    }); vi.stubGlobal("fetch", fetch);
    const { disputesApi } = await import("./disputesApi");
    const blob = await disputesApi.evidence(true, "d/1", "a/1");
    expect(blob.type).toBe("application/pdf"); expect(await blob.text()).toBe("private bytes");
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/v1/admin/disputes/d%2F1/attachments/a%2F1/content", "/v1/auth/refresh", "/v1/admin/disputes/d%2F1/attachments/a%2F1/content"]);
  });
  it("preserves owner evidence errors and never calls a public upload URL", async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(response({ code: "dispute.attachmentNotFound" }, 404))); vi.stubGlobal("fetch", fetch);
    const { disputesApi } = await import("./disputesApi");
    await expect(disputesApi.evidence(false, "d1", "a1")).rejects.toMatchObject({ status: 404, code: "dispute.attachmentNotFound" });
    expect(fetch.mock.calls[0][0]).toBe("/v1/me/disputes/d1/attachments/a1/content");
  });
  it("does not automatically replay uncertain creation, review or upload writes", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("Lost response")); vi.stubGlobal("fetch", fetch);
    const { disputesApi } = await import("./disputesApi");
    await expect(disputesApi.create("ORD-1", { reason: "other", description: "Detailed issue report" })).rejects.toThrow("Lost response");
    await expect(disputesApi.review("d1")).rejects.toThrow("Lost response");
    await expect(disputesApi.upload(new File(["pdf"], "a.pdf", { type: "application/pdf" }))).rejects.toThrow("Lost response");
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it.each([null, {}, { id: "d1" }, fixture({ order: { id: "foreign", status: "delivered" } }), fixture({ status: "reviewing" })])("rejects unusable or mismatched creation success %#", async value => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(response(value))); vi.stubGlobal("fetch", fetch);
    const { disputesApi } = await import("./disputesApi");
    await expect(disputesApi.create("ORD/1", { reason: "other", description: "Actual detailed report" })).rejects.toMatchObject({ code: "dispute.invalidResponse" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects a decision response with the wrong state or explanation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(response(fixture({ status: "resolved", resolution: "Wrong decision", resolvedAt: "2026-10-28T01:00:00Z" })))));
    const { disputesApi } = await import("./disputesApi");
    await expect(disputesApi.finish("d1", "resolve", "Expected decision")).rejects.toMatchObject({ code: "dispute.invalidResponse" });
    await expect(disputesApi.review("d1")).rejects.toMatchObject({ code: "dispute.invalidResponse" });
  });
  it.each([null, { isPrivate: true, purpose: "dispute_attachment" }, { id: "", isPrivate: true, purpose: "dispute_attachment" }])("rejects unconfirmed upload references %#", async value => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(response(value))); vi.stubGlobal("fetch", fetch);
    const { disputesApi } = await import("./disputesApi");
    await expect(disputesApi.upload(new File(["png"], "a.png", { type: "image/png" }))).rejects.toMatchObject({ code: "dispute.invalidResponse" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("propagates dispute conflicts instead of claiming success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(response({ code: "dispute.alreadyExists" }, 409))));
    const { disputesApi } = await import("./disputesApi");
    await expect(disputesApi.create("ORD-1", { reason: "other", description: "Detailed issue report" })).rejects.toMatchObject({ code: "dispute.alreadyExists", status: 409 });
  });
});
