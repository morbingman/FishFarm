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
    expect(fetch.mock.calls[1][1].headers.get("Authorization")).toBe("Bearer memory-token");
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
  it("translates the backend suspended-account error in both languages", async () => {
    const { ApiError, errorMessage } = await import("./api");
    const error = new ApiError(403, "auth.accountSuspended");
    expect(errorMessage(error, "en")).toBe("This account is suspended. Contact support.");
    expect(errorMessage(error, "vi")).toBe("Tài khoản đã bị tạm khóa.");
  });
  it("maps backend User explicitly to customer UI and rejects unknown roles", async () => {
    const { mapSessionUser } = await import("./session");
    expect(mapSessionUser(user as import("./contracts").ApiUser).role).toBe("Buyer");
    expect(mapSessionUser({ ...user, role: "Admin" } as import("./contracts").ApiUser).role).toBe("Admin");
    expect(() => mapSessionUser({ ...user, role: "Seller" } as unknown as import("./contracts").ApiUser)).toThrow("Unsupported account role");
  });
});
