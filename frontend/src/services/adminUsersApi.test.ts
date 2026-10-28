import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ManagedUser, UserStatusInput } from "./adminUsers";
const fixture: ManagedUser = { id: "u1", email: "fish+/@example.test", name: "Fish Buyer", role: "User", status: "active", joinedAt: "2026-10-28T00:00:00Z" };
const input: UserStatusInput = { status: "suspended", expectedStatus: "active" };
const page = (items: unknown[] = [fixture], total = items.length, page = 1, limit = 25) => ({ items, total, page, limit });
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
beforeEach(() => { vi.resetModules(); vi.stubGlobal("sessionStorage", { removeItem: vi.fn() }); });
afterEach(() => vi.unstubAllGlobals());

describe("Admin users private transport", () => {
  it("uses server name/email search, both optional filters and default paging; reuses authentication", async () => {
    const admin = { ...fixture, id: "admin1", email: "admin@example.test", role: "Admin" };
    const fetch = vi.fn(async (url: string, _init: RequestInit) => response(url.endsWith("/auth/login") ? { accessToken: "access", user: admin } : url.includes("role=Admin") ? page([{ ...admin, status: "suspended" }], 2, 2, 1) : page([fixture, { ...admin, id: "u2" }])));
    vi.stubGlobal("fetch", fetch); const { authApi } = await import("./api"); await authApi.login(admin.email, "password");
    const { adminUsersApi } = await import("./adminUsersApi"); await adminUsersApi.list(); await adminUsersApi.list({ q: "  Fish +  ", role: "Admin", status: "suspended", page: 2, limit: 1 });
    expect(fetch.mock.calls.slice(1).map(([url]) => url)).toEqual(["/v1/admin/users?q=&page=1&limit=25", "/v1/admin/users?q=Fish+%2B&status=suspended&role=Admin&page=2&limit=1"]);
    expect(fetch.mock.calls[1][1].credentials).toBe("include"); expect(new Headers(fetch.mock.calls[1][1].headers).get("Authorization")).toBe("Bearer access");
  });
  it("passes abort to private reads and ignores invalid requests before fetching", async () => {
    const fetch = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true })));
    vi.stubGlobal("fetch", fetch); const { adminUsersApi } = await import("./adminUsersApi"); const controller = new AbortController();
    const read = adminUsersApi.list({}, controller.signal); controller.abort(); await expect(read).rejects.toMatchObject({ name: "AbortError" });
    for (const query of [{ limit: 101 }, { role: "Seller" }, { q: false }, { page: 0 }, { reason: "unused" }]) await expect(adminUsersApi.list(query as never)).rejects.toMatchObject({ code: "validation.failed" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("accepts empty and out-of-range pages without inventing totals", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(page([], 0)))); const { adminUsersApi, validateAdminUsersPage } = await import("./adminUsersApi");
    await expect(adminUsersApi.list()).resolves.toEqual(page([], 0));
    expect(validateAdminUsersPage(page([], 3, 4, 25), { page: 4 })).toEqual(page([], 3, 4, 25));
  });
  it("rejects malformed envelopes, totals, paging, duplicate identities and mismatched filters", async () => {
    const { validateAdminUsersPage } = await import("./adminUsersApi");
    for (const value of [null, [], [fixture], { ...page(), extra: true }, { ...page(), total: "1" }, { ...page(), total: -1 }, { ...page(), total: 1.5 }, { ...page(), page: 2 }, { ...page(), limit: 100 }, { ...page(), items: null }, page([], 1), page([fixture], 0), page([fixture, fixture]), page([fixture, { ...fixture, id: "u2", email: fixture.email.toUpperCase() }]), page([{ ...fixture, password: "secret" }])]) expect(() => validateAdminUsersPage(value)).toThrow("user.invalidResponse");
    expect(() => validateAdminUsersPage(page(), { status: "suspended" })).toThrow("user.invalidResponse");
    expect(() => validateAdminUsersPage(page(), { role: "Admin" })).toThrow("user.invalidResponse");
    const older = { ...fixture, id: "u2", email: "other@example.test", joinedAt: "2026-10-27T00:00:00Z" };
    expect(validateAdminUsersPage(page([fixture, older])).items).toHaveLength(2);
    expect(() => validateAdminUsersPage(page([older, fixture]))).toThrow("user.invalidResponse");
    expect(() => validateAdminUsersPage(page([{ ...older, joinedAt: fixture.joinedAt }, fixture]))).toThrow("user.invalidResponse");
  });
  it("does not reject an entire directory or status acknowledgement for a permitted stored name", async () => {
    const named = { ...fixture, name: "  \n" };
    const fetch = vi.fn(async (_url: string, init: RequestInit) => response(init.method === "PATCH" ? { ...named, status: "suspended" } : page([named])));
    vi.stubGlobal("fetch", fetch);
    const { adminUsersApi } = await import("./adminUsersApi");
    await expect(adminUsersApi.list()).resolves.toEqual(page([named]));
    await expect(adminUsersApi.setStatus(named, input)).resolves.toEqual({ ...named, status: "suspended" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("sends exact encoded-email opposite-state bodies both directions and validates minimal acknowledgement", async () => {
    const fetch = vi.fn(async (_url: string, init: RequestInit) => response({ ...fixture, status: JSON.parse(init.body as string).status })); vi.stubGlobal("fetch", fetch);
    const { adminUsersApi } = await import("./adminUsersApi"); const suspended = await adminUsersApi.setStatus(fixture, input); await adminUsersApi.setStatus(suspended, { status: "active", expectedStatus: "suspended" });
    expect(fetch.mock.calls.map(([url, init]) => [url, init.method, init.body])).toEqual([["/v1/admin/users/fish%2B%2F%40example.test/status", "PATCH", JSON.stringify(input)], ["/v1/admin/users/fish%2B%2F%40example.test/status", "PATCH", JSON.stringify({ status: "active", expectedStatus: "suspended" })]]);
    await expect(adminUsersApi.setStatus(fixture, { ...input, reason: "unsupported" } as UserStatusInput)).rejects.toMatchObject({ code: "validation.failed" });
    for (const status of ["active", "suspended"] as const) await expect(adminUsersApi.setStatus({ ...fixture, role: "Admin", status }, { status: status === "active" ? "suspended" : "active", expectedStatus: status })).rejects.toMatchObject({ code: "user.protectedAccount" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("rejects changed immutable identity, role, joined date, status and expanded acknowledgements", async () => {
    const fetch = vi.fn(async () => response(fixture)); vi.stubGlobal("fetch", fetch); const { adminUsersApi } = await import("./adminUsersApi");
    for (const value of [fixture, { ...fixture, status: "suspended", id: "wrong" }, { ...fixture, status: "suspended", email: "other@example.test" }, { ...fixture, status: "suspended", role: "Admin" }, { ...fixture, status: "suspended", joinedAt: "2026-10-27T00:00:00Z" }, { ...fixture, status: "suspended", sessions: [] }, null, { ok: true }]) {
      fetch.mockImplementation(async () => response(value)); await expect(adminUsersApi.setStatus(fixture, input)).rejects.toMatchObject({ code: "user.invalidResponse" });
    }
  });
  it("synchronously locks duplicate writes and releases after settlement", async () => {
    let resolve!: (value: Response) => void; const fetch = vi.fn(() => new Promise<Response>(done => { resolve = done; })); vi.stubGlobal("fetch", fetch); const { adminUsersApi } = await import("./adminUsersApi");
    const first = adminUsersApi.setStatus(fixture, input);
    await expect(adminUsersApi.setStatus({ ...fixture, email: fixture.email.toUpperCase() }, input)).rejects.toMatchObject({ code: "user.requestPending" }); expect(fetch).toHaveBeenCalledTimes(1);
    resolve(response({ ...fixture, status: "suspended" })); await first;
    fetch.mockImplementation(() => Promise.resolve(response({ ...fixture, status: "suspended" })));
    await expect(adminUsersApi.setStatus(fixture, input)).resolves.toMatchObject({ status: "suspended" }); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("propagates settled contract errors and NEVER retries network failures, invalid JSON or 401 writes", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("Lost response")); vi.stubGlobal("fetch", fetch); const { adminUsersApi } = await import("./adminUsersApi");
    await expect(adminUsersApi.setStatus(fixture, input)).rejects.toThrow("Lost response");
    fetch.mockImplementation(async () => new Response("not JSON", { status: 200 })); await expect(adminUsersApi.setStatus(fixture, input)).rejects.toThrow();
    for (const [code, status] of [["user.protectedAccount", 409], ["user.statusConflict", 409], ["user.notFound", 404], ["auth.invalidToken", 401]] as const) {
      fetch.mockImplementation(async () => response({ code }, status)); await expect(adminUsersApi.setStatus(fixture, input)).rejects.toMatchObject({ code, status });
    }
    expect(fetch).toHaveBeenCalledTimes(6);
  });
  it.each(["read", "write"])("rejects late private %s results after session changes", async mode => {
    const admin = { ...fixture, id: "admin1", role: "Admin" }; let resolve!: (value: Response) => void;
    const fetch = vi.fn((url: string) => url.endsWith("/auth/login") ? Promise.resolve(response({ accessToken: "access", user: admin })) : new Promise<Response>(done => { resolve = done; })); vi.stubGlobal("fetch", fetch);
    const { authApi, clearApiSession } = await import("./api"); await authApi.login("admin@example.test", "password"); const { adminUsersApi } = await import("./adminUsersApi");
    const pending = mode === "read" ? adminUsersApi.list() : adminUsersApi.setStatus(fixture, input); clearApiSession();
    resolve(response(mode === "read" ? page() : { ...fixture, status: "suspended" })); await expect(pending).rejects.toMatchObject({ code: "auth.sessionChanged" });
  });
});
