import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiUser } from "./contracts";

const joinedAt = "2026-10-28T00:00:00.000Z";
const fixture = (changes: Partial<ApiUser> = {}): ApiUser => ({ id: "u1", email: "user@example.test", name: "User", role: "User",
  status: "active", phone: null, location: null, joinedAt, emailVerifiedAt: null,
  prefs: { status: true, system: false, reminders: true }, ...changes });
const prefs = { status: true, system: false, reminders: true };
const input = { name: " New name ", phone: " +84 123 ", location: " Hà Nội " };

beforeEach(() => { vi.resetModules(); vi.stubGlobal("sessionStorage", { removeItem: vi.fn() }); });
afterEach(() => vi.unstubAllGlobals());

describe("exact account routes", () => {
  it("recognizes only profile and settings", async () => {
    const { parseAccountRoute } = await import("./account");
    expect(parseAccountRoute("account/profile")).toBe("profile");
    expect(parseAccountRoute("account/settings")).toBe("settings");
    for (const route of ["account", "account/preferences", "account", "profile", "settings", "account/notifications", "Account/profile",
      "#account/profile", "/account/profile", "account/profile/", "account/settings/", "account/profile?tab=edit", "account/settings?",
      "account/settings#x", "account/profile/u1", "account/%70rofile", "account//profile", " account/profile", "account/profile\n", "account/profile\u0000"]) {
      expect(parseAccountRoute(route), route).toBeNull();
    }
  });
});

describe("strict normalized profile input", () => {
  it("trims and copies all fields, supports inclusive limits and optional-field clearing", async () => {
    const { profileInput } = await import("./account");
    const original = Object.freeze(input);
    expect(profileInput(original)).toEqual({ name: "New name", phone: "+84 123", location: "Hà Nội" });
    expect(original).toEqual(input);
    expect(profileInput({ name: " x ", phone: " \t ", location: "\n" })).toEqual({ name: "x", phone: "", location: "" });
    expect(profileInput({ name: ` ${"x".repeat(80)} `, phone: ` ${"p".repeat(32)} `, location: ` ${"l".repeat(120)} ` }))
      .toEqual({ name: "x".repeat(80), phone: "p".repeat(32), location: "l".repeat(120) });
    expect(profileInput(Object.assign(Object.create(null), { name: "x", phone: "", location: "" }))).toEqual({ name: "x", phone: "", location: "" });
  });
  it.each([null, undefined, [], "name", 1, true, {}, { name: "x", phone: "" }, { name: "x", phone: "", location: "", extra: undefined },
    { name: "", phone: "", location: "" }, { name: " \n\t ", phone: "", location: "" }, { name: "x".repeat(81), phone: "", location: "" },
    { name: "x", phone: "p".repeat(33), location: "" }, { name: "x", phone: "", location: "l".repeat(121) }])("rejects invalid input %#", async value => {
    const { profileInput } = await import("./account");
    expect(() => profileInput(value)).toThrowError(expect.objectContaining({ status: 400, code: "account.input" }));
  });
  it("requires each field as an own string, and rejects privilege/private additions", async () => {
    const { profileInput } = await import("./account");
    for (const field of ["name", "phone", "location"]) for (const value of [null, undefined, 1, false, [], {}, new String("x")]) {
      expect(() => profileInput({ ...input, [field]: value })).toThrow("account.input");
    }
    for (const key of ["id", "email", "role", "status", "password", "passwordHash", "prefs", "joinedAt", "__proto__", "constructor", "hasOwnProperty"]) {
      const value = { ...input }; Object.defineProperty(value, key, { value: "extra", enumerable: true });
      expect(() => profileInput(value)).toThrow("account.input");
    }
    expect(() => profileInput(Object.assign(Object.create({ name: "x" }), { phone: "", location: "" }))).toThrow("account.input");
    expect(() => profileInput(Object.assign({ ...input }, { [Symbol("extra")]: true }))).toThrow("account.input");
  });
});

describe("exact full-snapshot notification preferences", () => {
  it("copies all eight real boolean snapshots without defaulting false", async () => {
    const { notificationPrefsInput, validateNotificationPrefs, validateSavedPrefs } = await import("./account");
    for (const status of [false, true]) for (const system of [false, true]) for (const reminders of [false, true]) {
      const value = Object.freeze({ status, system, reminders });
      expect(notificationPrefsInput(value)).toEqual(value); expect(notificationPrefsInput(value)).not.toBe(value);
      expect(validateNotificationPrefs(value)).toEqual(value); expect(validateNotificationPrefs(value)).not.toBe(value);
      expect(validateSavedPrefs(value, value)).toEqual(value);
    }
  });
  it("rejects partial snapshots, extras, inherited booleans and all coercible non-booleans", async () => {
    const { notificationPrefsInput, validateNotificationPrefs } = await import("./account");
    const invalid: unknown[] = [null, undefined, [], true, {}, { ...prefs, extra: undefined }, { ...prefs, [Symbol("extra")]: true },
      Object.assign(Object.create({ status: true }), { system: false, reminders: true })];
    for (const key of ["status", "system", "reminders"]) {
      const missing: Record<string, unknown> = { ...prefs }; delete missing[key]; invalid.push(missing);
      for (const value of [null, undefined, 0, 1, "true", "false", [], {}, new Boolean(false)]) invalid.push({ ...prefs, [key]: value });
    }
    for (const value of invalid) {
      expect(() => notificationPrefsInput(value)).toThrowError(expect.objectContaining({ status: 400, code: "account.input" }));
      expect(() => validateNotificationPrefs(value)).toThrowError(expect.objectContaining({ status: 502, code: "account.invalidResponse" }));
    }
  });
  it("rejects valid but different acknowledgement booleans", async () => {
    const { validateSavedPrefs } = await import("./account");
    for (const key of ["status", "system", "reminders"] as const) expect(() => validateSavedPrefs({ ...prefs, [key]: !prefs[key] }, prefs)).toThrow("account.invalidResponse");
  });
});

describe("public account projection and UTC dates", () => {
  it("accepts exact supported roles/statuses and stored nullable/text fields without editing limits", async () => {
    const { validateAccountUser } = await import("./account");
    for (const role of ["User", "Admin"] as const) for (const status of ["active", "suspended"] as const) {
      const original = fixture({ role, status, phone: "", location: "", emailVerifiedAt: joinedAt });
      const result = validateAccountUser(original); expect(result).toEqual(original); expect(result).not.toBe(original); expect(result.prefs).not.toBe(original.prefs);
    }
    for (const text of ["", " \t ", "<script>text</script>", "x".repeat(2000)]) {
      expect(validateAccountUser(fixture({ name: text, phone: text, location: text }))).toEqual(fixture({ name: text, phone: text, location: text }));
    }
    expect(validateAccountUser(Object.assign(Object.create(null), fixture()))).toEqual(fixture());
  });
  it.each(["id", "email", "name", "role", "status", "phone", "location", "joinedAt", "emailVerifiedAt", "prefs"])("requires own field %s", async key => {
    const { validateAccountUser } = await import("./account");
    const missing: Record<string, unknown> = { ...fixture() }; delete missing[key];
    expect(() => validateAccountUser(missing)).toThrow("account.invalidResponse");
    expect(() => validateAccountUser(Object.assign(Object.create({ [key]: fixture()[key as keyof ApiUser] }), missing))).toThrow("account.invalidResponse");
  });
  it.each([null, undefined, [], {}, { ...fixture(), id: "" }, { ...fixture(), id: " u1" }, { ...fixture(), id: "u1\u0000" },
    { ...fixture(), email: "invalid" }, { ...fixture(), email: "a@@b" }, { ...fixture(), email: " user@example.test" }, { ...fixture(), name: null },
    { ...fixture(), role: "Buyer" }, { ...fixture(), role: "Seller" }, { ...fixture(), role: "System" }, { ...fixture(), role: "admin" },
    { ...fixture(), status: "pending" }, { ...fixture(), status: "Active" }, { ...fixture(), status: true }, { ...fixture(), phone: 1 },
    { ...fixture(), location: {} }, { ...fixture(), joinedAt: null }, { ...fixture(), emailVerifiedAt: false }, { ...fixture(), prefs: {} }])("rejects invalid public user %#", async value => {
    const { validateAccountUser } = await import("./account");
    expect(() => validateAccountUser(value)).toThrowError(expect.objectContaining({ status: 502, code: "account.invalidResponse" }));
  });
  it("rejects any sensitive or unsupported extra key, including hidden and prototype-named own fields", async () => {
    const { validateAccountUser } = await import("./account");
    for (const key of ["password", "passwordHash", "accessToken", "refreshToken", "sessions", "companyId", "extra", "__proto__", "constructor", "hasOwnProperty"]) {
      for (const enumerable of [true, false]) {
        const value = fixture(); Object.defineProperty(value, key, { value: undefined, enumerable });
        expect(() => validateAccountUser(value)).toThrow("account.invalidResponse");
      }
    }
    expect(() => validateAccountUser(Object.assign(fixture(), { [Symbol("private")]: true }))).toThrow("account.invalidResponse");
  });
  it.each(["2024-02-29T23:59:59Z", "2000-02-29T00:00:00.000Z", "2026-04-30T12:34:56.123456Z", "0000-02-29T00:00:00Z", joinedAt])("accepts actual ISO UTC date %s", async value => {
    const { accountIsoDate, validateAccountUser } = await import("./account");
    expect(accountIsoDate(value)).toBe(true);
    expect(validateAccountUser(fixture({ joinedAt: value, emailVerifiedAt: value })).joinedAt).toBe(value);
  });
  it.each([null, 1, new Date(joinedAt), "", "invalid", "2026-10-28", "2026-10-28T00:00:00", "2026-10-28T00:00:00+00:00", "2026-10-28T07:00:00+07:00",
    "2026-02-29T00:00:00Z", "1900-02-29T00:00:00Z", "2026-02-30T00:00:00Z", "2026-04-31T00:00:00Z", "2026-00-01T00:00:00Z",
    "2026-13-01T00:00:00Z", "2026-10-00T00:00:00Z", "2026-10-32T00:00:00Z", "2026-10-28T24:00:00Z", "2026-10-28T00:60:00Z",
    "2026-10-28T00:00:60Z", "2026-10-28t00:00:00z", "2026-10-28T00:00:00.Z", " 2026-10-28T00:00:00Z", "2026-10-28T00:00:00Z\n"])("rejects non-UTC or malformed date %#", async value => {
    const { accountIsoDate, validateAccountUser } = await import("./account");
    expect(accountIsoDate(value)).toBe(false);
    expect(() => validateAccountUser({ ...fixture(), joinedAt: value })).toThrow("account.invalidResponse");
    if (value !== null) expect(() => validateAccountUser({ ...fixture(), emailVerifiedAt: value })).toThrow("account.invalidResponse");
  });
});

describe("active profile identity and exact saved acknowledgement", () => {
  it("requires an active result for both initial and established identities", async () => {
    const { validateAccountProfile } = await import("./account");
    for (const expected of [null, { id: "u1", role: "User" } as const]) {
      expect(validateAccountProfile(fixture(), expected)).toEqual(fixture());
      expect(() => validateAccountProfile(fixture({ status: "suspended" }), expected)).toThrow("account.invalidResponse");
    }
    for (const changes of [{ id: "u2" }, { role: "Admin" }] as Partial<ApiUser>[]) {
      expect(() => validateAccountProfile(fixture(changes), { id: "u1", role: "User" })).toThrow("account.invalidResponse");
    }
  });
  it("rejects missing, malformed or privilege-expanded expected identities", async () => {
    const { accountIdentityInput } = await import("./account");
    for (const expected of [undefined, null, {}, [], { id: "", role: "User" }, { id: "u1", role: "Buyer" }, { id: "u1", role: "User", extra: true }]) {
      expect(() => accountIdentityInput(expected)).toThrow("account.input");
    }
    const original = { id: "u1", role: "User" } as const;
    expect(accountIdentityInput(original)).toEqual(original); expect(accountIdentityInput(original)).not.toBe(original);
  });
  it("matches trimmed saved fields, immutable identity and joinedAt, while allowing independently updated prefs/verification", async () => {
    const { validateSavedProfile } = await import("./account");
    const result = fixture({ name: "New name", phone: "+84 123", location: "Hà Nội", emailVerifiedAt: joinedAt,
      prefs: { status: false, system: true, reminders: false } });
    expect(validateSavedProfile(result, input, fixture())).toEqual(result);
    expect(validateSavedProfile(fixture({ name: "x", phone: "", location: "" }), { name: " x ", phone: " ", location: " " }, fixture()).phone).toBe("");
  });
  it.each([{ id: "u2" }, { role: "Admin" }, { email: "other@example.test" }, { joinedAt: "2026-10-28T00:00:00Z" }, { status: "suspended" },
    { name: " New name " }, { phone: null }, { phone: "other" }, { location: null }, { location: "other" }, { passwordHash: "secret" }])("rejects changed immutable or saved field %#", async changes => {
    const { validateSavedProfile } = await import("./account");
    expect(() => validateSavedProfile({ ...fixture(), name: "New name", phone: "+84 123", location: "Hà Nội", ...changes }, input, fixture())).toThrow("account.invalidResponse");
  });
  it("rejects a suspended expected account", async () => {
    const { validateSavedProfile } = await import("./account");
    expect(() => validateSavedProfile(fixture(), input, fixture({ status: "suspended" }))).toThrow("account.input");
  });
});

describe("localized account errors", () => {
  it("translates account errors and delegates API session, server and network errors", async () => {
    const { accountErrorMessage } = await import("./account"); const { ApiError, errorMessage } = await import("./api");
    for (const code of ["account.invalidResponse", "account.input", "account.requestPending"]) {
      const failure = new ApiError(409, code);
      const en = accountErrorMessage(failure, "en"), viText = accountErrorMessage(failure, "vi");
      expect(en).not.toContain(code); expect(viText).not.toContain(code); expect(en).not.toBe(viText);
    }
    for (const failure of [new TypeError("network"), new ApiError(401, "auth.sessionChanged"), new ApiError(403, "auth.accountSuspended"),
      new ApiError(400, "validation.failed"), new ApiError(500, "server.failure")]) {
      for (const language of ["en", "vi"] as const) expect(accountErrorMessage(failure, language)).toBe(errorMessage(failure, language));
    }
  });
});
