import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const user = { id: "u1", email: "user@example.test", name: "Test User", role: "User", status: "active", phone: null, location: null, joinedAt: "2026-10-26T00:00:00Z", emailVerifiedAt: null, prefs: { status: true, system: true, reminders: true } };
const payload = (token = "memory-token") => ({ accessToken: token, tokenType: "Bearer", expiresIn: 900, user });
const response = (data: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("sessionStorage", { removeItem: vi.fn(), setItem: vi.fn(), getItem: vi.fn() });
  vi.stubGlobal("localStorage", { removeItem: vi.fn(), setItem: vi.fn(), getItem: vi.fn() });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("API integration boundary", () => {
  it("keeps tokens out of storage and sends only supported signup fields", async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(response(payload()))); vi.stubGlobal("fetch", fetch);
    const { authApi, api } = await import("./api");
    await authApi.register({ email: user.email, name: user.name, password: "Test12345" });
    await api("/me");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ email: user.email, name: user.name, password: "Test12345" });
    expect(fetch.mock.calls[0][0]).toBe("/v1/auth/register");
    expect(new Headers(fetch.mock.calls[1][1].headers).get("Authorization")).toBe("Bearer memory-token");
    expect(sessionStorage.setItem).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });
  it("coordinates concurrent refreshes and retries protected reads", async () => {
    let finish: (value: Response) => void = () => {};
    const refresh = new Promise<Response>((resolve) => { finish = resolve; });
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/auth/refresh")) return refresh;
      return new Headers(init.headers).has("Authorization") ? response({ ok: true }) : response({ code: "auth.sessionExpired" }, 401);
    }); vi.stubGlobal("fetch", fetch);
    const { api } = await import("./api");
    const first = api("/me"); const second = api("/me/prefs");
    await vi.waitFor(() => expect(fetch.mock.calls.filter(([url]) => url.endsWith("/auth/refresh"))).toHaveLength(1));
    finish(response(payload()));
    expect(await Promise.all([first, second])).toEqual([{ ok: true }, { ok: true }]);
    expect(fetch.mock.calls.filter(([url]) => url.endsWith("/auth/refresh"))).toHaveLength(1);
  });
  it.each([{ id: "u2", role: "User" }, { id: "u1", role: "Admin" }])("does not replay a write after refresh changes identity %j", async changed => {
    const fetch = vi.fn(async (url: string) => url.endsWith("/auth/login") ? response(payload()) : url.endsWith("/auth/refresh") ? response({ ...payload("different-token"), user: { ...user, ...changed } }) : response({ code: "auth.sessionExpired" }, 401)); vi.stubGlobal("fetch", fetch);
    const { authApi, api } = await import("./api");
    await authApi.login(user.email, "Test12345");
    await expect(api("/admin/disputes/d1/resolve", { method: "POST", body: JSON.stringify({ resolution: "Decision" }) })).rejects.toMatchObject({ code: "auth.sessionChanged" });
    expect(fetch.mock.calls.filter(([url]) => url.includes("/disputes/"))).toHaveLength(1);
  });
  it("retries a rejected write once when refresh preserves identity", async () => {
    const fetch = vi.fn(async (url: string, init: RequestInit) => url.endsWith("/auth/login") ? response(payload()) : url.endsWith("/auth/refresh") ? response(payload("fresh")) : new Headers(init.headers).get("Authorization") === "Bearer fresh" ? response({ ok: true }) : response({ code: "auth.sessionExpired" }, 401)); vi.stubGlobal("fetch", fetch);
    const { authApi, api } = await import("./api");
    await authApi.login(user.email, "Test12345");
    await expect(api("/me/orders/ORD-1/dispute", { method: "POST", body: "{}" })).resolves.toEqual({ ok: true });
    expect(fetch.mock.calls.filter(([url]) => url.includes("/dispute"))).toHaveLength(2);
  });
  it("does not replay an unauthenticated write as a newly refreshed account", async () => {
    const fetch = vi.fn(async (url: string) => url.endsWith("/auth/refresh") ? response(payload()) : response({ code: "auth.sessionExpired" }, 401)); vi.stubGlobal("fetch", fetch);
    const { api } = await import("./api");
    await expect(api("/uploads", { method: "POST", body: new FormData() })).rejects.toMatchObject({ code: "auth.sessionChanged" });
    expect(fetch.mock.calls.filter(([url]) => url.endsWith("/uploads"))).toHaveLength(1);
  });
  it("rejects late successful private responses after logout", async () => {
    let finish: (value: Response) => void = () => {};
    const fetch = vi.fn((url: string) => url.endsWith("/auth/login") ? Promise.resolve(response(payload())) : url.endsWith("/auth/logout") ? Promise.resolve(response(null, 204)) : new Promise<Response>(resolve => { finish = resolve; })); vi.stubGlobal("fetch", fetch);
    const { authApi, api } = await import("./api");
    await authApi.login(user.email, "Test12345"); const pending = api("/me/disputes");
    await authApi.logout(); finish(response([]));
    await expect(pending).rejects.toMatchObject({ code: "auth.sessionChanged" });
  });
  it("does not refresh failed login credentials", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ code: "auth.invalidCredentials", params: {} }, 401)); vi.stubGlobal("fetch", fetch);
    const { authApi } = await import("./api");
    await expect(authApi.login(user.email, "wrong")).rejects.toMatchObject({ status: 401, code: "auth.invalidCredentials" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("preserves structured error parameters and details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ code: "validation.failed", params: { field: "email" }, details: ["validation.email"] }, 400)));
    const { authApi } = await import("./api");
    await expect(authApi.login("bad", "bad")).rejects.toMatchObject({ status: 400, params: { field: "email" }, details: ["validation.email"] });
  });
  it("uses public reads without cookies or authorization", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ items: [], total: 0 })); vi.stubGlobal("fetch", fetch);
    const { authApi, domainApi } = await import("./api");
    fetch.mockResolvedValueOnce(response(payload())); await authApi.login(user.email, "Test12345");
    await domainApi.listings("page=2");
    expect(fetch.mock.calls[1][0]).toBe("/v1/marketplace/listings?page=2");
    expect(fetch.mock.calls[1][1].credentials).toBe("omit");
    expect(fetch.mock.calls[1][1].headers.has("Authorization")).toBe(false);
  });
  it("sends newPassword and does not fake unsupported feature success", async () => {
    const fetch = vi.fn().mockResolvedValue(response(null, 204)); vi.stubGlobal("fetch", fetch);
    const { authApi, domainApi } = await import("./api");
    await authApi.resetPassword(user.email, "123456", "New12345");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ email: user.email, code: "123456", newPassword: "New12345" });
    await expect(domainApi.putCart("FM-1")).rejects.toMatchObject({ status: 501 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("does not revive a session from a refresh completed after logout", async () => {
    let finish: (value: Response) => void = () => {};
    const fetch = vi.fn().mockImplementation((url: string) => url.endsWith("/auth/refresh") ? new Promise<Response>((resolve) => { finish = resolve; }) : response(null, 204)); vi.stubGlobal("fetch", fetch);
    const { authApi, refreshSession, onApiSession } = await import("./api");
    const listener = vi.fn(); onApiSession(listener);
    const pending = refreshSession(); await authApi.logout(); finish(response(payload()));
    expect(await pending).toBeNull(); expect(listener).toHaveBeenLastCalledWith(null);
  });
  it("clears a suspended session without refresh or write replay and rejects late private data", async () => {
    let finish: (value: Response) => void = () => {};
    const fetch = vi.fn((url: string) => url.endsWith("/auth/login") ? Promise.resolve(response(payload())) : url.endsWith("/me/orders") ? new Promise<Response>(resolve => { finish = resolve; }) : Promise.resolve(response({ code: "auth.accountSuspended" }, 403)));
    vi.stubGlobal("fetch", fetch);
    const { authApi, api, onApiSession } = await import("./api");
    await authApi.login(user.email, "Test12345");
    const listener = vi.fn(); onApiSession(listener);
    const pending = api("/me/orders");
    await expect(api("/me/profile", { method: "PATCH", body: "{}" })).rejects.toMatchObject({ status: 403, code: "auth.accountSuspended" });
    expect(listener).toHaveBeenLastCalledWith(null);
    finish(response([]));
    await expect(pending).rejects.toMatchObject({ code: "auth.sessionChanged" });
    expect(fetch.mock.calls.filter(([url]) => url.endsWith("/me/profile"))).toHaveLength(1);
    expect(fetch.mock.calls.some(([url]) => url.endsWith("/auth/refresh"))).toBe(false);
  });
  it.each([401, 403])("clears invalid refresh %s and invalidates concurrent private results", async status => {
    let finish: (value: Response) => void = () => {};
    const fetch = vi.fn((url: string) => url.endsWith("/auth/login") ? Promise.resolve(response(payload())) : url.endsWith("/auth/refresh") ? Promise.resolve(response({ code: status === 403 ? "auth.accountSuspended" : "auth.sessionExpired" }, status)) : new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal("fetch", fetch);
    const { authApi, api, refreshSession, onApiSession } = await import("./api");
    await authApi.login(user.email, "Test12345");
    const listener = vi.fn(); onApiSession(listener);
    const pending = api("/me/orders");
    if (status === 401) expect(await refreshSession()).toBeNull();
    else await expect(refreshSession()).rejects.toMatchObject({ code: "auth.accountSuspended" });
    expect(listener).toHaveBeenLastCalledWith(null);
    finish(response([]));
    await expect(pending).rejects.toMatchObject({ code: "auth.sessionChanged" });
  });
  it("does not let a late suspension error clear a newly signed-in account", async () => {
    let finish: (value: Response) => void = () => {};
    let logins = 0;
    const fetch = vi.fn((url: string) => url.endsWith("/auth/login") ? Promise.resolve(response({ ...payload(), user: { ...user, id: ++logins === 1 ? "u1" : "u2" } })) : new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal("fetch", fetch);
    const { authApi, api, onApiSession } = await import("./api");
    await authApi.login(user.email, "Test12345");
    const listener = vi.fn(); onApiSession(listener);
    const pending = api("/me");
    await authApi.login("other@example.test", "Test12345");
    finish(response({ code: "auth.accountSuspended" }, 403));
    await expect(pending).rejects.toMatchObject({ code: "auth.accountSuspended" });
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ id: "u2" }));
  });
  it("does not clear an active session for an ordinary permission denial", async () => {
    const fetch = vi.fn((url: string) => Promise.resolve(url.endsWith("/auth/login") ? response(payload()) : response({ code: "auth.forbidden" }, 403)));
    vi.stubGlobal("fetch", fetch);
    const { authApi, api, onApiSession } = await import("./api");
    await authApi.login(user.email, "Test12345");
    const listener = vi.fn(); onApiSession(listener);
    await expect(api("/admin/users")).rejects.toMatchObject({ status: 403 });
    expect(listener).not.toHaveBeenCalled();
  });
  it("translates the backend suspended-account error in both languages", async () => {
    const { ApiError, errorMessage } = await import("./api");
    const error = new ApiError(403, "auth.accountSuspended");
    expect(errorMessage(error, "en")).toBe("This account is suspended. Contact support.");
    expect(errorMessage(error, "vi")).toBe("Tài khoản đã bị tạm khóa.");
  });
  it("publishes server profile display without replacing tokens or invalidating pending reads", async () => {
    let finish: (value: Response) => void = () => {};
    const fetch = vi.fn((url: string, _init: RequestInit) => url.endsWith("/auth/login") ? Promise.resolve(response(payload())) : new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal("fetch", fetch);
    const { authApi, api, apiSessionStamp, publishApiUser, isApiSession } = await import("./api");
    const { currentUser } = await import("./session");
    await authApi.login(user.email, "Test12345");
    const stamp = apiSessionStamp()!;
    const pending = api("/me/orders");
    expect(publishApiUser({ ...user, name: "Saved name", prefs: { status: false, system: true, reminders: false } } as import("./contracts").ApiUser, stamp)).toBe(true);
    expect(currentUser()).toMatchObject({ name: "Saved name", prefs: { status: false, system: true, reminders: false } });
    expect(isApiSession(stamp)).toBe(true);
    expect(apiSessionStamp()).toEqual(stamp);
    finish(response([]));
    await expect(pending).resolves.toEqual([]);
    expect(new Headers(fetch.mock.calls[1][1].headers).get("Authorization")).toBe("Bearer memory-token");
    expect(sessionStorage.setItem).not.toHaveBeenCalled();
  });
  it("rejects stale profile publication after a fresh login to the same account", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(response(payload()))));
    const { authApi, apiSessionStamp, publishApiUser, isApiSession } = await import("./api");
    const { currentUser } = await import("./session");
    await authApi.login(user.email, "Test12345");
    const old = apiSessionStamp()!;
    await authApi.login(user.email, "Test12345");
    expect(isApiSession(old)).toBe(false);
    expect(publishApiUser({ ...user, name: "Stale name" } as import("./contracts").ApiUser, old)).toBe(false);
    expect(currentUser()?.name).toBe(user.name);
  });
  it.each([{ id: "u2" }, { role: "Admin" }, { status: "suspended" }])("rejects profile publication that changes session identity or status %j", async changed => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(payload())));
    const { authApi, apiSessionStamp, publishApiUser } = await import("./api");
    const { currentUser } = await import("./session");
    await authApi.login(user.email, "Test12345");
    expect(publishApiUser({ ...user, ...changed } as import("./contracts").ApiUser, apiSessionStamp()!)).toBe(false);
    expect(currentUser()?.name).toBe(user.name);
  });
  it("rejects profile publication after logout and leaves identity empty", async () => {
    const fetch = vi.fn((url: string) => Promise.resolve(url.endsWith("/auth/logout") ? response(null, 204) : response(payload())));
    vi.stubGlobal("fetch", fetch);
    const { authApi, apiSessionStamp, publishApiUser } = await import("./api");
    const { currentUser } = await import("./session");
    expect(apiSessionStamp()).toBeNull();
    await authApi.login(user.email, "Test12345");
    const old = apiSessionStamp()!;
    await authApi.logout();
    expect(publishApiUser(user as import("./contracts").ApiUser, old)).toBe(false);
    expect(currentUser()).toBeNull();
  });
  it("maps backend User explicitly to customer UI and rejects unknown roles", async () => {
    const { mapSessionUser } = await import("./session");
    expect(mapSessionUser(user as import("./contracts").ApiUser).role).toBe("Buyer");
    expect(mapSessionUser({ ...user, role: "Admin" } as import("./contracts").ApiUser).role).toBe("Admin");
    expect(() => mapSessionUser({ ...user, role: "Seller" } as unknown as import("./contracts").ApiUser)).toThrow("Unsupported account role");
  });
});
