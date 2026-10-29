import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JsonValue, NotificationsPage, NotificationsQuery, PersonalNotification } from "./notifications";

const createdAt = "2026-10-28T00:00:00.000Z";
const readAt = "2026-10-28T01:00:00.000Z";
const fixture = (overrides: Partial<PersonalNotification> = {}): PersonalNotification => ({
  id: "n1", type: "status", titleKey: "notifications.buyer.orderPlaced.title", titleParams: { code: "ORD-1" },
  bodyKey: "notifications.buyer.orderPlaced.body", bodyParams: { total: 1250000 },
  link: "#marketplace/orders/ORD-1", readAt: null, createdAt, ...overrides,
});
const page = (overrides: Partial<NotificationsPage> = {}): NotificationsPage => ({ items: [fixture()], total: 1, unreadTotal: 1, page: 1, limit: 25, ...overrides });
const response = (value: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const user = { id: "u1", email: "buyer@example.test", name: "Buyer", role: "User", status: "active", phone: null, location: null,
  joinedAt: createdAt, emailVerifiedAt: null, prefs: { status: true, system: true, reminders: true } };
const payload = (changes: Partial<typeof user> = {}, token = "memory-token") => ({ accessToken: token, tokenType: "Bearer", expiresIn: 900, user: { ...user, ...changes } });
type Client = typeof import("./notificationsApi").notificationsApi;
const actions = ["list", "markRead", "markAllRead"] as const;
type Action = typeof actions[number];
const perform = (client: Client, action: Action) => action === "list" ? client.list() : action === "markRead" ? client.markRead(fixture()) : client.markAllRead();
const resultFor = (action: Action) => action === "list" ? page() : action === "markRead" ? fixture({ readAt }) : { updated: 1, readAt };

beforeEach(() => { vi.resetModules(); vi.stubGlobal("sessionStorage", { removeItem: vi.fn(), setItem: vi.fn() }); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("exact server notification page envelope", () => {
  it("validates the default page without rewriting counts, timestamps, IDs or content", async () => {
    const { validateNotificationsPage } = await import("./notificationsApi");
    const value = page({ items: [fixture({ id: "n/a", titleParams: [null, { nested: [true, -1.5] }], bodyParams: null, link: null })] });
    expect(validateNotificationsPage(value)).toEqual(value);
    expect(validateNotificationsPage(page({ items: [], total: 0, unreadTotal: 0 }))).toEqual(page({ items: [], total: 0, unreadTotal: 0 }));
  });
  it.each([
    [{ read: "all", type: "status" }, page({ total: 1, unreadTotal: 20 })],
    [{ read: "unread", type: "status" }, page({ total: 1, unreadTotal: 20 })],
    [{ read: "read" }, page({ items: [fixture({ readAt })], total: 1, unreadTotal: 20 })],
    [{ read: "read", type: "status" }, page({ items: [fixture({ readAt })], total: 1, unreadTotal: 20 })],
    [{ read: "all", type: "error" }, page({ items: [], total: 0, unreadTotal: 20 })],
    [{ read: "unread", type: "error" }, page({ items: [], total: 0, unreadTotal: 20 })],
    [{ read: "read" }, page({ items: [], total: 0, unreadTotal: 20 })],
  ] as [NotificationsQuery, NotificationsPage][])("keeps filtered total independent from owner-wide unreadTotal %#", async (query, value) => {
    const { validateNotificationsPage } = await import("./notificationsApi");
    expect(validateNotificationsPage(value, query)).toEqual(value);
  });
  it("requires exact page cardinality for full, partial and past-end windows up to page one million", async () => {
    const { validateNotificationsPage } = await import("./notificationsApi");
    const items = Array.from({ length: 100 }, (_, index) => fixture({ id: `n${String(index).padStart(3, "0")}` }));
    expect(validateNotificationsPage(page({ items, total: 202, unreadTotal: 202, limit: 100 }), { limit: 100 }).items).toHaveLength(100);
    const partial = page({ items: items.slice(0, 2), total: 202, unreadTotal: 202, page: 3, limit: 100 });
    expect(validateNotificationsPage(partial, { page: 3, limit: 100 })).toEqual(partial);
    const empty = page({ items: [], total: 202, unreadTotal: 202, page: 4, limit: 100 });
    expect(validateNotificationsPage(empty, { page: 4, limit: 100 })).toEqual(empty);
    const last = page({ items: [fixture()], total: 99_999_901, unreadTotal: 99_999_901, page: 1_000_000, limit: 100 });
    expect(validateNotificationsPage(last, { page: 1_000_000, limit: 100 })).toEqual(last);
    for (const [value, query] of [
      [page({ items: [], total: 1 }), {}], [page({ items: [fixture()], total: 26 }), {}],
      [page({ items: items.slice(0, 3), total: 202, unreadTotal: 202, page: 3, limit: 100 }), { page: 3, limit: 100 }],
      [page({ items: [fixture()], total: 1, page: 2 }), { page: 2 }],
    ] as [NotificationsPage, NotificationsQuery][]) expect(() => validateNotificationsPage(value, query)).toThrow("notifications.invalidResponse");
  });
  it.each([
    null, [], {}, { ...page(), extra: true }, { ...page(), recipientId: "owner" }, { ...page(), items: {} }, { ...page(), items: [null] },
    { ...page(), total: -1 }, { ...page(), total: 1.5 }, { ...page(), total: "1" }, { ...page(), total: Number.MAX_SAFE_INTEGER + 1 },
    { ...page(), unreadTotal: -1 }, { ...page(), unreadTotal: 1.5 }, { ...page(), unreadTotal: "1" }, { ...page(), unreadTotal: Infinity },
    { ...page(), unreadTotal: Number.MAX_SAFE_INTEGER + 1 }, { ...page(), unreadTotal: 0 }, { ...page(), page: 2 }, { ...page(), page: "1" },
    { ...page(), limit: 24 }, { ...page(), limit: "25" }, { ...page(), items: [fixture({ id: "duplicate" }), fixture({ id: "duplicate" })], total: 2, unreadTotal: 2 },
  ])("rejects malformed, mismatched or duplicate page %#", async value => {
    const { validateNotificationsPage } = await import("./notificationsApi");
    expect(() => validateNotificationsPage(value)).toThrowError(expect.objectContaining({ status: 502, code: "notifications.invalidResponse" }));
  });
  it.each(["items", "total", "unreadTotal", "page", "limit"])("requires the exact envelope field %s", async key => {
    const { validateNotificationsPage } = await import("./notificationsApi");
    const value: Record<string, unknown> = { ...page() }; delete value[key];
    expect(() => validateNotificationsPage(value)).toThrow("notifications.invalidResponse");
  });
  it("rejects filter violations and contradictory all/unread counts without confusing read totals", async () => {
    const { validateNotificationsPage } = await import("./notificationsApi");
    for (const [value, query] of [
      [page(), { read: "read" }], [page({ items: [fixture({ readAt })] }), { read: "unread" }],
      [page(), { type: "error" }], [page({ items: [], total: 0, unreadTotal: 1 }), {}],
      [page({ unreadTotal: 2 }), { read: "unread" }],
      [page({ items: [fixture(), fixture({ id: "n2" })], total: 2, unreadTotal: 1 }), { read: "unread", type: "status" }],
      [page({ items: [fixture()], total: 26, unreadTotal: 25, page: 2 }), { read: "unread", type: "status", page: 2 }],
    ] as [NotificationsPage, NotificationsQuery][]) expect(() => validateNotificationsPage(value, query)).toThrow("notifications.invalidResponse");
  });
  it("checks descending actual timestamps then ascending IDs, preserving server values rather than sorting", async () => {
    const { validateNotificationsPage } = await import("./notificationsApi");
    const items = [fixture({ id: "z", createdAt: "2026-10-28T00:00:01Z" }), fixture({ id: "a", createdAt }), fixture({ id: "b", createdAt: "2026-10-28T00:00:00Z" })];
    const value = page({ items, total: 3, unreadTotal: 3 });
    expect(validateNotificationsPage(value).items).toEqual(items);
    for (const invalid of [[items[1], items[0], items[2]], [items[0], items[2], items[1]]]) {
      const originalOrder = invalid.map(item => item.id);
      expect(() => validateNotificationsPage(page({ items: invalid, total: 3, unreadTotal: 3 }))).toThrow("notifications.invalidResponse");
      expect(invalid.map(item => item.id)).toEqual(originalOrder);
    }
    const precise = [fixture({ id: "z", createdAt: "2026-10-28T00:00:00.002Z" }), fixture({ id: "a", createdAt: "2026-10-28T00:00:00.001Z" })];
    expect(validateNotificationsPage(page({ items: precise, total: 2, unreadTotal: 2 })).items).toEqual(precise);
  });
});

describe("exact single-read and read-all acknowledgements", () => {
  it("allows only readAt to change and compares JSON semantically rather than object-key order", async () => {
    const { validateNotificationRead } = await import("./notificationsApi");
    const target = fixture({ titleParams: { a: 1, nested: { nullable: null, values: [true, "x"] } }, bodyParams: [null, -1.5, { key: false }] });
    const value = { ...target, titleParams: { nested: { values: [true, "x"], nullable: null }, a: 1 }, readAt };
    expect(validateNotificationRead(value, target)).toEqual(value);
    expect(validateNotificationRead(value, { ...target, readAt })).toEqual(value);
    const nullable = fixture({ titleParams: null, bodyParams: null, link: null });
    expect(validateNotificationRead({ ...nullable, readAt }, nullable)).toEqual({ ...nullable, readAt });
  });
  it.each([
    { id: "other" }, { type: "success" }, { titleKey: "other" }, { titleParams: { code: "ORD-2" } },
    { bodyKey: "other" }, { bodyParams: { total: 1250001 } }, { link: null }, { createdAt: "2026-10-28T00:00:00Z" },
    { readAt: null }, { readAt: "invalid" }, { recipientId: "owner" },
  ])("rejects single-read acknowledgement mismatch %#", async changes => {
    const { validateNotificationRead } = await import("./notificationsApi");
    expect(() => validateNotificationRead({ ...fixture(), readAt, ...changes }, fixture())).toThrow("notifications.invalidResponse");
  });
  it("requires an already-read timestamp to stay byte-for-byte unchanged", async () => {
    const { validateNotificationRead } = await import("./notificationsApi");
    const target = fixture({ readAt });
    for (const changed of [null, "2026-10-28T01:00:01.000Z", "2026-10-28T01:00:00Z"]) {
      expect(() => validateNotificationRead({ ...target, readAt: changed }, target)).toThrow("notifications.invalidResponse");
    }
    expect(() => validateNotificationRead({ ...target, readAt }, { ...target, extra: "invalid target" } as PersonalNotification)).toThrow("notifications.invalidResponse");
  });
  it("detects deeply nested changes, array reordering and primitive/null substitutions", async () => {
    const { validateNotificationRead } = await import("./notificationsApi");
    const params: JsonValue = { level: [{ nested: { values: [null, 1, "1", false] } }] };
    const target = fixture({ titleParams: params, bodyParams: params });
    for (const changed of [{ level: [{ nested: { values: [null, 1, "2", false] } }] }, { level: [{ nested: { values: [1, null, "1", false] } }] }, null, []]) {
      for (const field of ["titleParams", "bodyParams"]) expect(() => validateNotificationRead({ ...target, readAt, [field]: changed }, target)).toThrow("notifications.invalidResponse");
    }
  });
  it("accepts exact bodyless read-all counts including zero without expecting a local unread count", async () => {
    const { validateNotificationsReadAll } = await import("./notificationsApi");
    for (const updated of [0, 1, 500, Number.MAX_SAFE_INTEGER]) expect(validateNotificationsReadAll({ updated, readAt })).toEqual({ updated, readAt });
  });
  it.each([null, [], {}, { updated: 1 }, { readAt }, { updated: "1", readAt }, { updated: -1, readAt }, { updated: 1.5, readAt },
    { updated: NaN, readAt }, { updated: Infinity, readAt }, { updated: Number.MAX_SAFE_INTEGER + 1, readAt }, { updated: 1, readAt: null },
    { updated: 1, readAt: "2026-02-30T00:00:00Z" }, { updated: 1, readAt, unreadTotal: 0 }, { updated: 1, readAt, extra: undefined }])("rejects malformed or expanded read-all result %#", async value => {
    const { validateNotificationsReadAll } = await import("./notificationsApi");
    expect(() => validateNotificationsReadAll(value)).toThrow("notifications.invalidResponse");
  });
});

describe("personal notification HTTP transport", () => {
  it("uses exact owner query endpoints with auth, cookies and no list body", async () => {
    const fetch = vi.fn(async (url: string, _init: RequestInit) => url.endsWith("/auth/login") ? response(payload()) : response(page({ items: [], total: 0, unreadTotal: 0, page: url.includes("page=1000000") ? 1_000_000 : 1, limit: url.includes("limit=100") ? 100 : 25 })));
    vi.stubGlobal("fetch", fetch);
    const { authApi } = await import("./api"); const { notificationsApi } = await import("./notificationsApi");
    await authApi.login(user.email, "password");
    await notificationsApi.list(); await notificationsApi.list({ read: "unread", type: "reminder", page: 1_000_000, limit: 100 });
    expect(fetch.mock.calls.slice(1).map(([url]) => url)).toEqual(["/v1/me/notifications?read=all&page=1&limit=25", "/v1/me/notifications?read=unread&type=reminder&page=1000000&limit=100"]);
    for (const [, init] of fetch.mock.calls.slice(1) as unknown as [string, RequestInit][]) {
      expect(init.method ?? "GET").toBe("GET"); expect(init.body).toBeUndefined(); expect(init.credentials).toBe("include");
      expect(new Headers(init.headers).get("Authorization")).toBe("Bearer memory-token");
      expect(new Headers(init.headers).has("Content-Type")).toBe(false);
    }
    expect(sessionStorage.setItem).not.toHaveBeenCalled();
  });
  it("rejects invalid queries and targets before any network dispatch", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const { notificationsApi } = await import("./notificationsApi");
    for (const query of [null, [], { read: "all", owner: "other" }, { read: "Unread" }, { type: "all" }, { page: "1" }, { page: 1_000_001 }, { limit: 101 }]) {
      await expect(notificationsApi.list(query as NotificationsQuery)).rejects.toMatchObject({ status: 400, code: "validation.failed" });
    }
    for (const target of [null, {}, fixture({ id: "" }), { ...fixture(), recipientId: "other" }]) {
      await expect(notificationsApi.markRead(target as PersonalNotification)).rejects.toMatchObject({ code: "notifications.invalidResponse" });
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it("encodes the entire notification ID and sends only PATCH {read:true} plus a bodyless POST read-all", async () => {
    const target = fixture({ id: "n/1 ?#% Việt" });
    const fetch = vi.fn(async (url: string) => url.endsWith("/auth/login") ? response(payload()) : response(url.endsWith("/read-all") ? { updated: 0, readAt } : { ...target, readAt }));
    vi.stubGlobal("fetch", fetch);
    const { authApi } = await import("./api"); const { notificationsApi } = await import("./notificationsApi");
    await authApi.login(user.email, "password");
    await expect(notificationsApi.markRead(target)).resolves.toEqual({ ...target, readAt });
    await expect(notificationsApi.markAllRead()).resolves.toEqual({ updated: 0, readAt });
    const [[url, patch], [allUrl, post]] = fetch.mock.calls.slice(1) as unknown as [string, RequestInit][];
    expect(url).toBe(`/v1/notifications/${encodeURIComponent(target.id)}`); expect(patch.method).toBe("PATCH");
    expect(patch.body).toBe('{"read":true}'); expect(new Headers(patch.headers).get("Content-Type")).toBe("application/json");
    expect(allUrl).toBe("/v1/notifications/read-all"); expect(post.method).toBe("POST"); expect(post.body).toBeUndefined();
    expect(new Headers(post.headers).has("Content-Type")).toBe(false);
    for (const init of [patch, post]) { expect(init.credentials).toBe("include"); expect(new Headers(init.headers).get("Authorization")).toBe("Bearer memory-token"); }
  });
  it.each([false, true])("deeply snapshots both param trees before transport awaits (changed acknowledgement: %s)", async changedAcknowledgement => {
    const pendingResponse = deferred<Response>(); const fetch = vi.fn((_url: string, _init: RequestInit) => pendingResponse.promise); vi.stubGlobal("fetch", fetch);
    const { notificationsApi } = await import("./notificationsApi");
    const titleParams = { nested: [{ code: "ORD-1", flags: [true, null] }] };
    const bodyParams = { nested: { values: [1250000, { text: "original" }] } };
    const target = fixture({ titleParams, bodyParams });
    const original = structuredClone(target);
    const pending = notificationsApi.markRead(target);
    const expectation = changedAcknowledgement ? expect(pending).rejects.toMatchObject({ code: "notifications.invalidResponse" }) : expect(pending).resolves.toEqual({ ...original, readAt });
    titleParams.nested[0].code = "ORD-2"; titleParams.nested[0].flags[0] = false;
    (bodyParams.nested.values[1] as { text: string }).text = "mutated";
    target.id = "other"; target.titleKey = "changed"; target.readAt = readAt;
    pendingResponse.resolve(response({ ...(changedAcknowledgement ? { ...original, titleParams, bodyParams } : original), readAt }));
    await expectation;
    expect(fetch).toHaveBeenCalledTimes(1); expect(fetch.mock.calls[0][0]).toBe("/v1/notifications/n1");
  });
  it.each([false, true])("preserves own __proto__ params in its independent pending-write snapshot (changed ack: %s)", async changed => {
    const pendingResponse = deferred<Response>(); const fetch = vi.fn(() => pendingResponse.promise); vi.stubGlobal("fetch", fetch);
    const { notificationsApi } = await import("./notificationsApi");
    const originalParams = () => JSON.parse('{"__proto__":{"nested":[{"text":"original"}]},"constructor":null}');
    const target = fixture({ titleParams: originalParams(), bodyParams: originalParams() });
    const original = fixture({ titleParams: originalParams(), bodyParams: originalParams() });
    const pending = notificationsApi.markRead(target);
    const expectation = changed ? expect(pending).rejects.toMatchObject({ code: "notifications.invalidResponse" }) : expect(pending).resolves.toEqual({ ...original, readAt });
    for (const params of [target.titleParams, target.bodyParams]) {
      const object = params as Record<string, { nested: { text: string }[] }>;
      object.__proto__.nested[0].text = "mutated";
    }
    pendingResponse.resolve(response({ ...(changed ? target : original), readAt })); await expectation;
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("does not impose a native-clone depth limit on otherwise valid persisted JSON when marking read", async () => {
    const deepParams = (): JsonValue => {
      let value: JsonValue = null;
      for (let depth = 0; depth < 2000; depth++) value = { nested: [value] };
      return value;
    };
    const target = fixture({ titleParams: deepParams(), bodyParams: deepParams() });
    const acknowledgement = fixture({ titleParams: deepParams(), bodyParams: deepParams(), readAt });
    const received = response({}); vi.spyOn(received, "json").mockResolvedValue(acknowledgement);
    const fetch = vi.fn(async () => received); vi.stubGlobal("fetch", fetch);
    const { notificationsApi } = await import("./notificationsApi");
    const result = await notificationsApi.markRead(target);
    expect(result.id).toBe(target.id); expect(result.readAt).toBe(readAt); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each(actions)("does not accept an empty or malformed HTTP success for %s", async action => {
    const fetch = vi.fn(async () => response(null, 204)); vi.stubGlobal("fetch", fetch);
    const { notificationsApi } = await import("./notificationsApi");
    for (const value of [undefined, null, {}, { ok: true }]) {
      fetch.mockImplementation(async () => value === undefined ? response(null, 204) : response(value));
      await expect(perform(notificationsApi, action)).rejects.toMatchObject({ code: "notifications.invalidResponse" });
    }
    expect(fetch).toHaveBeenCalledTimes(4);
  });
  it.each(["markRead", "markAllRead"] as const)("never refreshes or replays a 401 %s, even with a same-user refresh available", async action => {
    const fetch = vi.fn(async (url: string) => url.endsWith("/auth/login") || url.endsWith("/auth/refresh") ? response(payload()) : response({ code: "auth.sessionExpired" }, 401));
    vi.stubGlobal("fetch", fetch);
    const { authApi } = await import("./api"); const { notificationsApi } = await import("./notificationsApi");
    await authApi.login(user.email, "password");
    await expect(perform(notificationsApi, action)).rejects.toMatchObject({ status: 401, code: "auth.sessionExpired" });
    expect(fetch).toHaveBeenCalledTimes(2); expect(fetch.mock.calls.some(([url]) => url.endsWith("/auth/refresh"))).toBe(false);
  });
  it.each(["markRead", "markAllRead"] as const)("does not replay uncertain network failure for %s and releases its write lock", async action => {
    const failure = new TypeError("Lost acknowledgement"); const fetch = vi.fn().mockRejectedValue(failure); vi.stubGlobal("fetch", fetch);
    const { notificationsApi } = await import("./notificationsApi");
    await expect(perform(notificationsApi, action)).rejects.toBe(failure); expect(fetch).toHaveBeenCalledTimes(1);
    fetch.mockResolvedValue(response({ updated: 0, readAt }));
    await expect(notificationsApi.markAllRead()).resolves.toEqual({ updated: 0, readAt }); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each([404, 409, 500])("preserves structured status %s errors without write replay", async status => {
    const error = { code: status === 404 ? "notification.notFound" : "notifications.serverConflict", params: { id: "n1" }, details: ["reconcile"] };
    const fetch = vi.fn(async () => response(error, status)); vi.stubGlobal("fetch", fetch);
    const { notificationsApi } = await import("./notificationsApi");
    await expect(notificationsApi.markRead(fixture())).rejects.toMatchObject({ status, ...error });
    await expect(notificationsApi.markAllRead()).rejects.toMatchObject({ status, ...error }); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("allows one read-only refresh/retry for the current unchanged identity", async () => {
    const fetch = vi.fn(async (url: string, init: RequestInit) => url.endsWith("/auth/login") ? response(payload()) : url.endsWith("/auth/refresh") ? response(payload({}, "fresh"))
      : new Headers(init.headers).get("Authorization") === "Bearer fresh" ? response(page()) : response({ code: "auth.sessionExpired" }, 401));
    vi.stubGlobal("fetch", fetch);
    const { authApi } = await import("./api"); const { notificationsApi } = await import("./notificationsApi");
    await authApi.login(user.email, "password"); await expect(notificationsApi.list()).resolves.toEqual(page());
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/v1/auth/login", "/v1/me/notifications?read=all&page=1&limit=25", "/v1/auth/refresh", "/v1/me/notifications?read=all&page=1&limit=25"]);
  });
});

describe("synchronous cross-action notification write lock", () => {
  it.each(["markRead", "markAllRead"] as const)("blocks duplicate and cross-action dispatches while %s is pending, but not reads", async action => {
    const pendingResponse = deferred<Response>();
    const fetch = vi.fn((url: string) => url.includes("/me/notifications?") ? Promise.resolve(response(page())) : pendingResponse.promise); vi.stubGlobal("fetch", fetch);
    const { notificationsApi } = await import("./notificationsApi");
    const first = perform(notificationsApi, action);
    await expect(notificationsApi.markRead(fixture())).rejects.toMatchObject({ status: 409, code: "notifications.requestPending" });
    await expect(notificationsApi.markRead(fixture({ id: "n2" }))).rejects.toMatchObject({ status: 409, code: "notifications.requestPending" });
    await expect(notificationsApi.markAllRead()).rejects.toMatchObject({ status: 409, code: "notifications.requestPending" });
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(notificationsApi.list()).resolves.toEqual(page()); expect(fetch).toHaveBeenCalledTimes(2);
    pendingResponse.resolve(response(resultFor(action))); await expect(first).resolves.toEqual(resultFor(action));
    fetch.mockImplementation(async () => response({ updated: 0, readAt })); await notificationsApi.markAllRead(); expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("holds the lock through acknowledgement parsing/validation and releases it after invalid success", async () => {
    const parsed = deferred<unknown>(); const received = new Response("{}"); vi.spyOn(received, "json").mockImplementation(() => parsed.promise);
    const fetch = vi.fn(async () => received); vi.stubGlobal("fetch", fetch);
    const { notificationsApi } = await import("./notificationsApi");
    const first = notificationsApi.markRead(fixture()); const expectation = expect(first).rejects.toMatchObject({ code: "notifications.invalidResponse" });
    await vi.waitFor(() => expect(received.json).toHaveBeenCalledTimes(1));
    await expect(notificationsApi.markAllRead()).rejects.toMatchObject({ code: "notifications.requestPending" }); expect(fetch).toHaveBeenCalledTimes(1);
    parsed.resolve({}); await expectation;
    fetch.mockImplementation(async () => response({ updated: 0, readAt })); await notificationsApi.markAllRead(); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("does not replay a timed-out write and releases its lock after transport rejects", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason), { once: true })));
    vi.stubGlobal("fetch", fetch); const { notificationsApi } = await import("./notificationsApi");
    const pending = notificationsApi.markAllRead(); const expectation = expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(15_000); await expectation; expect(fetch).toHaveBeenCalledTimes(1);
    fetch.mockImplementation(async () => response({ updated: 0, readAt })); await notificationsApi.markAllRead(); expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("notification list abort and late-result isolation", () => {
  it.each([false, true])("does not dispatch an already aborted read (custom reason: %s)", async custom => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const { notificationsApi } = await import("./notificationsApi");
    const controller = new AbortController(); const reason = new Error("View changed"); controller.abort(custom ? reason : undefined);
    await expect(notificationsApi.list({}, controller.signal)).rejects.toBe(controller.signal.reason); expect(fetch).not.toHaveBeenCalled();
  });
  it("forwards an active abort to fetch with its reason and never refreshes or replays", async () => {
    const fetch = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason), { once: true })));
    vi.stubGlobal("fetch", fetch); const { notificationsApi } = await import("./notificationsApi");
    const controller = new AbortController(); const reason = new DOMException("Navigation", "AbortError");
    const pending = notificationsApi.list({}, controller.signal); const expectation = expect(pending).rejects.toBe(reason);
    controller.abort(reason); await expectation;
    expect(fetch).toHaveBeenCalledTimes(1); expect(fetch.mock.calls[0][1].signal!.aborted).toBe(true);
  });
  it("rejects a late successful fetch even if transport ignores the aborted signal", async () => {
    const received = deferred<Response>(); const fetch = vi.fn(() => received.promise); vi.stubGlobal("fetch", fetch);
    const { notificationsApi } = await import("./notificationsApi"); const controller = new AbortController();
    const pending = notificationsApi.list({}, controller.signal); const expectation = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    controller.abort(); received.resolve(response(page())); await expectation; expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("checks abort after delayed JSON parsing before exposing otherwise valid history", async () => {
    const parsed = deferred<unknown>(); const received = response({}); vi.spyOn(received, "json").mockImplementation(() => parsed.promise);
    const fetch = vi.fn(async () => received); vi.stubGlobal("fetch", fetch); const { notificationsApi } = await import("./notificationsApi");
    const controller = new AbortController(); const reason = new Error("Unmounted");
    const pending = notificationsApi.list({}, controller.signal); const expectation = expect(pending).rejects.toBe(reason);
    await vi.waitFor(() => expect(received.json).toHaveBeenCalledTimes(1)); controller.abort(reason); parsed.resolve(page());
    await expectation; expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("current-session notification reads and write acknowledgements", () => {
  it.each(actions.flatMap(action => ["logout", "clear", "account", "role", "same-account-login"].map(change => [action, change] as const)))("rejects late %s success after %s and keeps the new session usable", async (action, change) => {
    const received = deferred<Response>(); let logins = 0; let settled = false;
    const fetch = vi.fn((url: string, _init: RequestInit) => {
      if (url.endsWith("/auth/login")) return Promise.resolve(response(payload(++logins === 1 ? {} : change === "role" ? { role: "Admin" } : change === "account" ? { id: "u2", email: "other@example.test" } : {}, `token-${logins}`)));
      if (url.endsWith("/auth/logout")) return Promise.resolve(response(null, 204));
      return settled ? Promise.resolve(response(page())) : received.promise;
    }); vi.stubGlobal("fetch", fetch);
    const { authApi, clearApiSession, onApiSession } = await import("./api"); const { notificationsApi } = await import("./notificationsApi");
    await authApi.login(user.email, "password"); const listener = vi.fn(); onApiSession(listener);
    const pending = perform(notificationsApi, action); const expectation = expect(pending).rejects.toMatchObject({ status: 401, code: "auth.sessionChanged" });
    if (change === "logout") await authApi.logout(); else if (change === "clear") clearApiSession(); else await authApi.login("other@example.test", "password");
    received.resolve(response(resultFor(action))); await expectation; settled = true;
    expect(listener).toHaveBeenLastCalledWith(change === "logout" || change === "clear" ? null : expect.objectContaining({ id: change === "account" ? "u2" : "u1", role: change === "role" ? "Admin" : "User" }));
    await expect(notificationsApi.list()).resolves.toEqual(page());
    const init = fetch.mock.calls[fetch.mock.calls.length - 1][1];
    expect(new Headers(init.headers).get("Authorization")).toBe(change === "logout" || change === "clear" ? null : "Bearer token-2");
    expect(fetch.mock.calls.some(([url]) => url.endsWith("/auth/refresh"))).toBe(false);
  });
  it.each(actions)("also isolates %s while a successful response's JSON is still being parsed", async action => {
    const parsed = deferred<unknown>(); const received = response({}); vi.spyOn(received, "json").mockImplementation(() => parsed.promise);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/auth/login") ? response(payload()) : received));
    const { authApi, clearApiSession } = await import("./api"); const { notificationsApi } = await import("./notificationsApi");
    await authApi.login(user.email, "password"); const pending = perform(notificationsApi, action);
    const expectation = expect(pending).rejects.toMatchObject({ code: "auth.sessionChanged" });
    await vi.waitFor(() => expect(received.json).toHaveBeenCalledTimes(1)); clearApiSession(); parsed.resolve(resultFor(action)); await expectation;
  });
  it.each([{ id: "u2" }, { role: "Admin" }])("never replays an old owner's list after refresh changes identity %j", async changed => {
    const fetch = vi.fn(async (url: string) => url.endsWith("/auth/login") ? response(payload()) : url.endsWith("/auth/refresh") ? response(payload(changed, "fresh")) : response({ code: "auth.sessionExpired" }, 401));
    vi.stubGlobal("fetch", fetch); const { authApi } = await import("./api"); const { notificationsApi } = await import("./notificationsApi");
    await authApi.login(user.email, "password"); await expect(notificationsApi.list()).rejects.toMatchObject({ code: "auth.sessionChanged" });
    expect(fetch.mock.calls.filter(([url]) => url.includes("/me/notifications?"))).toHaveLength(1);
  });
  it("does not refresh a late old-session 401 or clear a new account for a late suspension", async () => {
    for (const status of [401, 403]) {
      const received = deferred<Response>(); let logins = 0;
      const fetch = vi.fn((url: string) => url.endsWith("/auth/login") ? Promise.resolve(response(payload({ id: ++logins === 1 ? "u1" : "u2" }))) : received.promise);
      vi.stubGlobal("fetch", fetch); const { authApi, onApiSession } = await import("./api"); const { notificationsApi } = await import("./notificationsApi");
      await authApi.login(user.email, "password"); const listener = vi.fn(); const unsubscribe = onApiSession(listener);
      const pending = notificationsApi.list(); const code = status === 401 ? "auth.sessionExpired" : "auth.accountSuspended";
      const expectation = expect(pending).rejects.toMatchObject({ status, code });
      await authApi.login("other@example.test", "password"); received.resolve(response({ code }, status)); await expectation;
      expect(listener).toHaveBeenCalledTimes(1); expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ id: "u2" }));
      expect(fetch.mock.calls.some(([url]) => url.endsWith("/auth/refresh"))).toBe(false); unsubscribe();
    }
  });
  it("clears a suspended current session, invalidates concurrent history and never replays its write", async () => {
    const received = deferred<Response>();
    const fetch = vi.fn((url: string) => url.endsWith("/auth/login") ? Promise.resolve(response(payload())) : url.includes("/me/notifications?") ? received.promise : Promise.resolve(response({ code: "auth.accountSuspended" }, 403)));
    vi.stubGlobal("fetch", fetch); const { authApi, onApiSession } = await import("./api"); const { notificationsApi } = await import("./notificationsApi");
    await authApi.login(user.email, "password"); const listener = vi.fn(); onApiSession(listener);
    const pending = notificationsApi.list(); const expectation = expect(pending).rejects.toMatchObject({ code: "auth.sessionChanged" });
    await expect(notificationsApi.markAllRead()).rejects.toMatchObject({ status: 403, code: "auth.accountSuspended" });
    expect(listener).toHaveBeenLastCalledWith(null); received.resolve(response(page())); await expectation;
    expect(fetch.mock.calls.filter(([url]) => url.endsWith("/notifications/read-all"))).toHaveLength(1);
    expect(fetch.mock.calls.some(([url]) => url.endsWith("/auth/refresh"))).toBe(false);
  });
});
