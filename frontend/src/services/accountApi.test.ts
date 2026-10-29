import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiUser } from "./contracts";
import type { AccountIdentity, NotificationPrefs, ProfileInput } from "./account";

const joinedAt = "2026-10-28T00:00:00.000Z";
const fixture = (changes: Partial<ApiUser> = {}): ApiUser => ({ id: "u1", email: "user@example.test", name: "User", role: "User",
  status: "active", phone: null, location: null, joinedAt, emailVerifiedAt: null,
  prefs: { status: true, system: false, reminders: true }, ...changes });
const identity: AccountIdentity = { id: "u1", role: "User" };
const input: ProfileInput = { name: " New name ", phone: " +84 123 ", location: " Hà Nội " };
const saved = { name: "New name", phone: "+84 123", location: "Hà Nội" };
const prefs: NotificationPrefs = { status: false, system: true, reminders: false };
const payload = (changes: Partial<ApiUser> = {}, token = "memory-token") => ({ accessToken: token, tokenType: "Bearer", expiresIn: 900, user: fixture(changes) });
const response = (value: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const deferred = <T>() => {
  let resolve!: (value: T) => void; let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
type Client = typeof import("./accountApi").accountApi;
const actions = ["profile", "prefs", "saveProfile", "savePrefs"] as const;
type Action = typeof actions[number];
const reads = ["profile", "prefs"] as const;
const writes = ["saveProfile", "savePrefs"] as const;
const perform = (client: Client, action: Action, signal?: AbortSignal) => action === "profile" ? client.profile(identity, signal)
  : action === "prefs" ? client.prefs(signal) : action === "saveProfile" ? client.saveProfile(input, fixture()) : client.savePrefs(prefs);
const resultFor = (action: Action) => action === "profile" ? fixture() : action === "saveProfile" ? fixture(saved) : prefs;

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("sessionStorage", { removeItem: vi.fn(), setItem: vi.fn() });
  vi.stubGlobal("localStorage", { removeItem: vi.fn(), setItem: vi.fn() });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("account transport and projection", () => {
  it("uses exact protected GET/PATCH endpoints, full snapshots and no automatic session publication", async () => {
    const fetch = vi.fn(async (url: string, init: RequestInit) => url.endsWith("/auth/login") ? response(payload())
      : url.endsWith("/me/prefs") ? response(prefs) : response(init.method === "PATCH" ? fixture(saved) : fixture()));
    vi.stubGlobal("fetch", fetch);
    const { authApi, onApiSession } = await import("./api"); const { accountApi } = await import("./accountApi");
    await authApi.login(fixture().email, "password"); const listener = vi.fn(); onApiSession(listener);
    await expect(accountApi.profile(identity)).resolves.toEqual(fixture());
    await expect(accountApi.profile(null)).resolves.toEqual(fixture());
    await expect(accountApi.prefs()).resolves.toEqual(prefs);
    await expect(accountApi.saveProfile(Object.freeze(input), Object.freeze(fixture()))).resolves.toEqual(fixture(saved));
    await expect(accountApi.savePrefs(Object.freeze(prefs))).resolves.toEqual(prefs);
    const calls = fetch.mock.calls.slice(1);
    expect(calls.map(([url]) => url)).toEqual(["/v1/me", "/v1/me", "/v1/me/prefs", "/v1/me", "/v1/me/prefs"]);
    for (const [, init] of calls.slice(0, 3)) {
      expect(init.method ?? "GET").toBe("GET"); expect(init.body).toBeUndefined(); expect(new Headers(init.headers).has("Content-Type")).toBe(false);
    }
    for (const [, init] of calls.slice(3)) {
      expect(init.method).toBe("PATCH"); expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    }
    expect(JSON.parse(calls[3][1].body as string)).toEqual(saved); expect(JSON.parse(calls[4][1].body as string)).toEqual(prefs);
    for (const [, init] of calls) {
      expect(init.credentials).toBe("include"); expect(new Headers(init.headers).get("Authorization")).toBe("Bearer memory-token");
    }
    expect(listener).not.toHaveBeenCalled(); expect(sessionStorage.setItem).not.toHaveBeenCalled(); expect(localStorage.setItem).not.toHaveBeenCalled();
  });
  it("sends empty optional strings to clear profile fields and requires exact empty acknowledgements", async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => response(fixture({ name: "x", phone: "", location: "" }))); vi.stubGlobal("fetch", fetch);
    const { accountApi } = await import("./accountApi");
    await expect(accountApi.saveProfile({ name: " x ", phone: " \t", location: " \n" }, fixture())).resolves.toMatchObject({ name: "x", phone: "", location: "" });
    expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual({ name: "x", phone: "", location: "" });
    fetch.mockResolvedValue(response(fixture({ name: "x", phone: null, location: null })));
    await expect(accountApi.saveProfile({ name: "x", phone: "", location: "" }, fixture())).rejects.toMatchObject({ code: "account.invalidResponse" });
  });
  it("rejects malformed identity/profile/prefs inputs and inactive expected accounts before dispatch", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const { accountApi } = await import("./accountApi");
    for (const expected of [undefined, {}, [], { id: "u1", role: "Buyer" }, { id: "u1", role: "User", extra: true }]) {
      await expect(accountApi.profile(expected as AccountIdentity)).rejects.toMatchObject({ code: "account.input" });
    }
    for (const value of [null, {}, { ...input, email: "other@example.test" }, { ...input, phone: null }, { ...input, name: "  " }]) {
      await expect(accountApi.saveProfile(value as ProfileInput, fixture())).rejects.toMatchObject({ code: "account.input" });
    }
    for (const value of [null, {}, { ...prefs, extra: true }, { ...prefs, system: 1 }]) {
      await expect(accountApi.savePrefs(value as NotificationPrefs)).rejects.toMatchObject({ code: "account.input" });
    }
    await expect(accountApi.saveProfile(input, fixture({ status: "suspended" }))).rejects.toMatchObject({ code: "account.input" });
    await expect(accountApi.saveProfile(input, { ...fixture(), passwordHash: "private" } as ApiUser)).rejects.toMatchObject({ code: "account.invalidResponse" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(actions)("rejects empty and malformed HTTP successes for %s", async action => {
    const fetch = vi.fn(async () => response(null, 204)); vi.stubGlobal("fetch", fetch); const { accountApi } = await import("./accountApi");
    for (const value of [undefined, null, {}, { ok: true }, [], { ...resultFor(action), private: true }]) {
      fetch.mockImplementation(async () => value === undefined ? response(null, 204) : response(value));
      await expect(perform(accountApi, action)).rejects.toMatchObject({ status: 502, code: "account.invalidResponse" });
    }
    expect(fetch).toHaveBeenCalledTimes(6);
  });
  it.each([null, identity])("rejects inactive profile reads, including initial identity %j", async expected => {
    vi.stubGlobal("fetch", vi.fn(async () => response(fixture({ status: "suspended" })))); const { accountApi } = await import("./accountApi");
    await expect(accountApi.profile(expected)).rejects.toMatchObject({ code: "account.invalidResponse" });
  });
  it.each([{ id: "other" }, { role: "Admin" }] as Partial<ApiUser>[])("rejects a different valid profile identity %j", async changes => {
    vi.stubGlobal("fetch", vi.fn(async () => response(fixture(changes)))); const { accountApi } = await import("./accountApi");
    await expect(accountApi.profile(identity)).rejects.toMatchObject({ code: "account.invalidResponse" });
  });
  it.each([{ email: "other@example.test" }, { joinedAt: "2026-10-28T00:00:00Z" }, { name: "New name " }, { phone: "wrong" }, { location: "wrong" }])("rejects successful profile PATCH mismatch %j", async changes => {
    vi.stubGlobal("fetch", vi.fn(async () => response(fixture({ ...saved, ...changes })))); const { accountApi } = await import("./accountApi");
    await expect(accountApi.saveProfile(input, fixture())).rejects.toMatchObject({ code: "account.invalidResponse" });
  });
  it.each(["status", "system", "reminders"] as const)("rejects a different valid preference acknowledgement %s", async key => {
    vi.stubGlobal("fetch", vi.fn(async () => response({ ...prefs, [key]: !prefs[key] }))); const { accountApi } = await import("./accountApi");
    await expect(accountApi.savePrefs(prefs)).rejects.toMatchObject({ code: "account.invalidResponse" });
  });
});

describe("pre-await snapshots", () => {
  it.each([false, true])("snapshots profile input and all expected immutable fields (changed ack: %s)", async changed => {
    const received = deferred<Response>(); const fetch = vi.fn((_url: string, _init: RequestInit) => received.promise); vi.stubGlobal("fetch", fetch);
    const { accountApi } = await import("./accountApi"); const mutableInput = { ...input }, expected = fixture();
    const pending = accountApi.saveProfile(mutableInput, expected);
    const expectation = changed ? expect(pending).rejects.toMatchObject({ code: "account.invalidResponse" }) : expect(pending).resolves.toEqual(fixture(saved));
    mutableInput.name = "Mutated"; mutableInput.phone = "different"; mutableInput.location = "changed";
    expected.id = "u2"; expected.role = "Admin"; expected.email = "other@example.test"; expected.joinedAt = "2026-10-27T00:00:00Z";
    expected.prefs.system = true; expected.status = "suspended";
    received.resolve(response(changed ? { ...expected, ...mutableInput, status: "active" } : fixture(saved))); await expectation;
    expect(fetch).toHaveBeenCalledTimes(1); expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual(saved);
  });
  it.each([false, true])("snapshots full prefs before await (changed ack: %s)", async changed => {
    const received = deferred<Response>(); const fetch = vi.fn((_url: string, _init: RequestInit) => received.promise); vi.stubGlobal("fetch", fetch);
    const { accountApi } = await import("./accountApi"); const mutable = { ...prefs };
    const pending = accountApi.savePrefs(mutable);
    const expectation = changed ? expect(pending).rejects.toMatchObject({ code: "account.invalidResponse" }) : expect(pending).resolves.toEqual(prefs);
    mutable.status = true; mutable.system = false; mutable.reminders = true;
    received.resolve(response(changed ? mutable : prefs)); await expectation;
    expect(fetch).toHaveBeenCalledTimes(1); expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual(prefs);
  });
  it("snapshots expected read identity before await", async () => {
    const received = deferred<Response>(); vi.stubGlobal("fetch", vi.fn(() => received.promise)); const { accountApi } = await import("./accountApi");
    const expected: AccountIdentity = { ...identity }; const pending = accountApi.profile(expected);
    expected.id = "other"; expected.role = "Admin"; received.resolve(response(fixture())); await expect(pending).resolves.toEqual(fixture());
  });
});

describe("no mutation replay and shared synchronous write lock", () => {
  it.each(writes)("never refreshes/replays a 401 %s even for an unchanged identity", async action => {
    const fetch = vi.fn(async (url: string) => url.endsWith("/auth/login") || url.endsWith("/auth/refresh") ? response(payload()) : response({ code: "auth.sessionExpired" }, 401));
    vi.stubGlobal("fetch", fetch); const { authApi } = await import("./api"); const { accountApi } = await import("./accountApi");
    await authApi.login(fixture().email, "password"); await expect(perform(accountApi, action)).rejects.toMatchObject({ status: 401, code: "auth.sessionExpired" });
    expect(fetch).toHaveBeenCalledTimes(2); expect(fetch.mock.calls.some(([url]) => url.endsWith("/auth/refresh"))).toBe(false);
  });
  it.each(writes)("does not replay uncertain network failure for %s and releases the lock", async action => {
    const failure = new TypeError("Lost acknowledgement"); const fetch = vi.fn().mockRejectedValue(failure); vi.stubGlobal("fetch", fetch);
    const { accountApi } = await import("./accountApi"); await expect(perform(accountApi, action)).rejects.toBe(failure); expect(fetch).toHaveBeenCalledTimes(1);
    fetch.mockResolvedValue(response(prefs)); await expect(accountApi.savePrefs(prefs)).resolves.toEqual(prefs); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each([400, 403, 404, 409, 500])("preserves structured server %s errors without mutation replay", async status => {
    const error = { code: "account.serverFailure", params: { field: "name" }, details: ["reconcile"] };
    const fetch = vi.fn(async () => response(error, status)); vi.stubGlobal("fetch", fetch); const { accountApi } = await import("./accountApi");
    for (const action of writes) await expect(perform(accountApi, action)).rejects.toMatchObject({ status, ...error });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each(writes)("blocks immediate duplicate and cross-action writes while %s is pending, but not reads", async action => {
    const received = deferred<Response>();
    const fetch = vi.fn((url: string, init: RequestInit) => init.method === "PATCH" ? received.promise : Promise.resolve(response(url.endsWith("/me") ? fixture() : prefs)));
    vi.stubGlobal("fetch", fetch); const { accountApi } = await import("./accountApi"); const pending = perform(accountApi, action);
    // Start both without a scheduling yield: the lock must be acquired synchronously.
    const second = accountApi.saveProfile(input, fixture()); const third = accountApi.savePrefs(prefs);
    await expect(second).rejects.toMatchObject({ status: 409, code: "account.requestPending" });
    await expect(third).rejects.toMatchObject({ status: 409, code: "account.requestPending" }); expect(fetch).toHaveBeenCalledTimes(1);
    await expect(accountApi.profile(identity)).resolves.toEqual(fixture()); await expect(accountApi.prefs()).resolves.toEqual(prefs);
    received.resolve(response(resultFor(action))); await expect(pending).resolves.toEqual(resultFor(action));
    fetch.mockImplementation(async () => response(prefs)); await accountApi.savePrefs(prefs); expect(fetch).toHaveBeenCalledTimes(4);
  });
  it.each(writes)("holds the write lock through delayed JSON for %s and releases it on invalid success", async action => {
    const parsed = deferred<unknown>(); const received = response({}); vi.spyOn(received, "json").mockImplementation(() => parsed.promise);
    const fetch = vi.fn(async () => received); vi.stubGlobal("fetch", fetch); const { accountApi } = await import("./accountApi");
    const pending = perform(accountApi, action); const expectation = expect(pending).rejects.toMatchObject({ code: "account.invalidResponse" });
    await vi.waitFor(() => expect(received.json).toHaveBeenCalledTimes(1));
    await expect(accountApi.saveProfile(input, fixture())).rejects.toMatchObject({ code: "account.requestPending" });
    await expect(accountApi.savePrefs(prefs)).rejects.toMatchObject({ code: "account.requestPending" }); expect(fetch).toHaveBeenCalledTimes(1);
    parsed.resolve({}); await expectation;
    fetch.mockImplementation(async () => response(fixture(saved))); await accountApi.saveProfile(input, fixture()); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each(writes)("does not replay timed-out %s and releases the lock", async action => {
    vi.useFakeTimers(); const fetch = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason), { once: true })));
    vi.stubGlobal("fetch", fetch); const { accountApi } = await import("./accountApi");
    const pending = perform(accountApi, action); const expectation = expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(15_000); await expectation; expect(fetch).toHaveBeenCalledTimes(1);
    fetch.mockImplementation(async () => response(prefs)); await accountApi.savePrefs(prefs); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each(reads)("permits one protected read refresh/retry for %s with unchanged identity", async action => {
    const fetch = vi.fn(async (url: string, init: RequestInit) => url.endsWith("/auth/login") ? response(payload()) : url.endsWith("/auth/refresh") ? response(payload({}, "fresh"))
      : new Headers(init.headers).get("Authorization") === "Bearer fresh" ? response(resultFor(action)) : response({ code: "auth.sessionExpired" }, 401));
    vi.stubGlobal("fetch", fetch); const { authApi } = await import("./api"); const { accountApi } = await import("./accountApi");
    await authApi.login(fixture().email, "password"); await expect(perform(accountApi, action)).resolves.toEqual(resultFor(action));
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/v1/auth/login", action === "profile" ? "/v1/me" : "/v1/me/prefs", "/v1/auth/refresh", action === "profile" ? "/v1/me" : "/v1/me/prefs"]);
  });
});

describe("read abort pre/post validation", () => {
  it.each(reads.flatMap(action => [false, true].map(custom => [action, custom] as const)))("does not dispatch aborted %s (custom reason: %s)", async (action, custom) => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const { accountApi } = await import("./accountApi");
    const controller = new AbortController(); controller.abort(custom ? new Error("View changed") : undefined);
    await expect(perform(accountApi, action, controller.signal)).rejects.toBe(controller.signal.reason); expect(fetch).not.toHaveBeenCalled();
  });
  it.each(reads)("forwards active %s abort to fetch with the exact reason", async action => {
    const fetch = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason), { once: true })));
    vi.stubGlobal("fetch", fetch); const { accountApi } = await import("./accountApi"); const controller = new AbortController(); const reason = new Error("Navigation");
    const pending = perform(accountApi, action, controller.signal); const expectation = expect(pending).rejects.toBe(reason); controller.abort(reason); await expectation;
    expect(fetch).toHaveBeenCalledTimes(1); expect(fetch.mock.calls[0][1].signal!.aborted).toBe(true);
  });
  it.each(reads)("rejects late %s success when fetch ignores abort", async action => {
    const received = deferred<Response>(); const fetch = vi.fn(() => received.promise); vi.stubGlobal("fetch", fetch);
    const { accountApi } = await import("./accountApi"); const controller = new AbortController();
    const pending = perform(accountApi, action, controller.signal); const expectation = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    controller.abort(); received.resolve(response(resultFor(action))); await expectation; expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each(reads)("checks abort after delayed %s JSON, before exposing a result", async action => {
    const parsed = deferred<unknown>(); const received = response({}); vi.spyOn(received, "json").mockImplementation(() => parsed.promise);
    const fetch = vi.fn(async () => received); vi.stubGlobal("fetch", fetch); const { accountApi } = await import("./accountApi");
    const controller = new AbortController(); const reason = new Error("Unmounted"); const pending = perform(accountApi, action, controller.signal);
    const expectation = expect(pending).rejects.toBe(reason); await vi.waitFor(() => expect(received.json).toHaveBeenCalledTimes(1));
    controller.abort(reason); parsed.resolve(resultFor(action)); await expectation; expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("session generation isolation without account publication", () => {
  it.each(actions.flatMap(action => ["logout", "clear", "account", "role", "same-account-login"].map(change => [action, change] as const)))("rejects late %s after %s without replacing the newer session", async (action, change) => {
    const received = deferred<Response>(); let logins = 0;
    const fetch = vi.fn((url: string) => url.endsWith("/auth/login") ? Promise.resolve(response(payload(++logins === 1 ? {} : change === "account" ? { id: "u2", email: "other@example.test" } : change === "role" ? { role: "Admin" } : {}, `token-${logins}`)))
      : url.endsWith("/auth/logout") ? Promise.resolve(response(null, 204)) : received.promise);
    vi.stubGlobal("fetch", fetch); const { authApi, clearApiSession, onApiSession } = await import("./api"); const { accountApi } = await import("./accountApi");
    await authApi.login(fixture().email, "password"); const listener = vi.fn(); onApiSession(listener);
    const pending = perform(accountApi, action); const expectation = expect(pending).rejects.toMatchObject({ status: 401, code: "auth.sessionChanged" });
    if (change === "logout") await authApi.logout(); else if (change === "clear") clearApiSession(); else await authApi.login("other@example.test", "password");
    received.resolve(response(resultFor(action))); await expectation;
    expect(listener).toHaveBeenCalledTimes(1); expect(listener).toHaveBeenLastCalledWith(change === "logout" || change === "clear" ? null : expect.objectContaining({ id: change === "account" ? "u2" : "u1", role: change === "role" ? "Admin" : "User" }));
    expect(fetch.mock.calls.some(([url]) => url.endsWith("/auth/refresh"))).toBe(false);
    // Even a rejected stale acknowledgement releases the cross-action write lock.
    fetch.mockImplementation(async () => response(prefs)); await expect(accountApi.savePrefs(prefs)).resolves.toEqual(prefs);
  });
  it.each(actions)("isolates %s during delayed successful JSON parsing", async action => {
    const parsed = deferred<unknown>(); const received = response({}); vi.spyOn(received, "json").mockImplementation(() => parsed.promise);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/auth/login") ? response(payload()) : received));
    const { authApi, clearApiSession } = await import("./api"); const { accountApi } = await import("./accountApi");
    await authApi.login(fixture().email, "password"); const pending = perform(accountApi, action); const expectation = expect(pending).rejects.toMatchObject({ code: "auth.sessionChanged" });
    await vi.waitFor(() => expect(received.json).toHaveBeenCalledTimes(1)); clearApiSession(); parsed.resolve(resultFor(action)); await expectation;
  });
  it.each(reads.flatMap(action => [{ id: "u2" }, { role: "Admin" }].map(changed => [action, changed] as const)))("does not replay old %s after refresh changes identity %j", async (action, changes) => {
    const fetch = vi.fn(async (url: string) => url.endsWith("/auth/login") ? response(payload()) : url.endsWith("/auth/refresh") ? response(payload(changes as Partial<ApiUser>, "fresh")) : response({ code: "auth.sessionExpired" }, 401));
    vi.stubGlobal("fetch", fetch); const { authApi } = await import("./api"); const { accountApi } = await import("./accountApi");
    await authApi.login(fixture().email, "password"); await expect(perform(accountApi, action)).rejects.toMatchObject({ code: "auth.sessionChanged" });
    expect(fetch.mock.calls.filter(([url]) => url === (action === "profile" ? "/v1/me" : "/v1/me/prefs"))).toHaveLength(1);
  });
  it("lets the API invalidate suspension and late reads without replaying a profile mutation", async () => {
    const received = deferred<Response>(); const fetch = vi.fn((url: string, init: RequestInit) => url.endsWith("/auth/login") ? Promise.resolve(response(payload()))
      : init.method === "PATCH" ? Promise.resolve(response({ code: "auth.accountSuspended" }, 403)) : received.promise);
    vi.stubGlobal("fetch", fetch); const { authApi, onApiSession } = await import("./api"); const { accountApi } = await import("./accountApi");
    await authApi.login(fixture().email, "password"); const listener = vi.fn(); onApiSession(listener);
    const pending = accountApi.profile(identity); const expectation = expect(pending).rejects.toMatchObject({ code: "auth.sessionChanged" });
    await expect(accountApi.saveProfile(input, fixture())).rejects.toMatchObject({ code: "auth.accountSuspended", status: 403 });
    received.resolve(response(fixture())); await expectation; expect(listener).toHaveBeenLastCalledWith(null);
    expect(fetch.mock.calls.filter(([, init]) => init.method === "PATCH")).toHaveLength(1); expect(fetch.mock.calls.some(([url]) => url.endsWith("/auth/refresh"))).toBe(false);
  });
});
