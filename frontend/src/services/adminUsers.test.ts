import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => { vi.resetModules(); vi.stubGlobal("sessionStorage", { removeItem: vi.fn() }); });
afterEach(() => vi.unstubAllGlobals());
const fixture = { id: "u1", email: "fish+buyer@example.test", name: "Fish Buyer", role: "User" as const, status: "active" as const, joinedAt: "2026-10-28T00:00:00Z" };

describe("bounded Admin user helpers", () => {
  it("recognizes only the standalone mounted route", async () => {
    const { adminUsersRoute, isAdminUsersRoute } = await import("./adminUsers");
    expect(adminUsersRoute).toBe("#admin/users");
    expect(isAdminUsersRoute("admin/users")).toBe(true);
    for (const route of ["admin", "admin/users/", "admin/users/u1", "admin/users?role=Admin", "admin/users#x", "admin/roles", "admin/users%00"]) expect(isAdminUsersRoute(route)).toBe(false);
  });
  it("trims server search and serializes only exact optional filters and bounded paging", async () => {
    const { adminUsersQuery, adminUsersSearchParams } = await import("./adminUsers");
    expect(adminUsersQuery()).toEqual({ q: "", page: 1, limit: 25 });
    expect(adminUsersSearchParams()).toBe("q=&page=1&limit=25");
    expect(adminUsersSearchParams({ q: "  Name + @ / Việt  ", status: "suspended", role: "Admin", page: 2, limit: 100 })).toBe("q=Name+%2B+%40+%2F+Vi%E1%BB%87t&status=suspended&role=Admin&page=2&limit=100");
    expect(adminUsersQuery({ limit: 1 }).limit).toBe(1);
    for (const input of [null, [], { q: 3 }, { q: "x".repeat(101) }, { page: 1_000_001 }, { status: "all" }, { role: "Buyer" }, { page: 0 }, { page: 1.5 }, { page: "1" }, { page: NaN }, { limit: 0 }, { limit: 101 }, { limit: Infinity }, { page: Number.MAX_SAFE_INTEGER, limit: 100 }, { reason: "not supported" }]) expect(() => adminUsersQuery(input as never)).toThrow("validation.failed");
  });
  it("validates the minimal projection, enums, email identity and actual ISO calendar dates", async () => {
    const { validateManagedUser } = await import("./adminUsers");
    expect(validateManagedUser(fixture)).toEqual(fixture);
    expect(validateManagedUser({ ...fixture, role: "Admin", status: "suspended", joinedAt: "2024-02-29T23:59:59.123+07:00" }).role).toBe("Admin");
    for (const value of [null, [], {}, { ...fixture, password: "private" }, { ...fixture, id: " " }, { ...fixture, id: "u\n1" }, { ...fixture, email: "fish" }, { ...fixture, email: " a@example.test" }, { ...fixture, email: "a@@example.test" }, { ...fixture, name: null }, { ...fixture, role: "Buyer" }, { ...fixture, role: "Seller" }, { ...fixture, status: "blocked" }, { ...fixture, joinedAt: "2026-10-28" }, { ...fixture, joinedAt: "2026-02-30T00:00:00Z" }, { ...fixture, joinedAt: "2026-10-28T24:00:00Z" }, { ...fixture, joinedAt: null }]) expect(() => validateManagedUser(value)).toThrow("user.invalidResponse");
    const { name: _name, ...missing } = fixture;
    expect(() => validateManagedUser(missing)).toThrow("user.invalidResponse");
  });
  it("preserves persisted names without inventing stricter registration rules", async () => {
    const { validateManagedUser } = await import("./adminUsers");
    for (const name of ["", "  ", "Fish\nBuyer", "Fish\tBuyer", "<script>not executable</script>"]) {
      expect(validateManagedUser({ ...fixture, name }).name).toBe(name);
    }
  });
  it("permits only opposite expected User states and protects ALL Admin targets", async () => {
    const { canChangeUserStatus, oppositeUserStatus, userStatusInput } = await import("./adminUsers");
    expect(canChangeUserStatus(fixture)).toBe(true);
    expect(oppositeUserStatus("active")).toBe("suspended"); expect(oppositeUserStatus("suspended")).toBe("active");
    expect(userStatusInput(fixture, { status: "suspended", expectedStatus: "active" })).toEqual({ status: "suspended", expectedStatus: "active" });
    expect(userStatusInput({ ...fixture, status: "suspended" }, { status: "active", expectedStatus: "suspended" })).toEqual({ status: "active", expectedStatus: "suspended" });
    for (const status of ["active", "suspended"] as const) {
      const target = { ...fixture, role: "Admin" as const, status };
      expect(canChangeUserStatus(target)).toBe(false);
      expect(() => userStatusInput(target, { status: oppositeUserStatus(status), expectedStatus: status })).toThrow("user.protectedAccount");
    }
    for (const input of [null, {}, { status: "active", expectedStatus: "active" }, { status: "active", expectedStatus: "suspended" }, { status: "blocked", expectedStatus: "active" }, { status: "suspended" }, { status: "suspended", expectedStatus: "active", reason: "no audit field" }, { status: "suspended", expectedStatus: "active", role: "Admin" }]) expect(() => userStatusInput(fixture, input as never)).toThrow("validation.failed");
  });
  it("provides EN/VI conflict, protected, missing and invalid-response messages without editing shared transport", async () => {
    const { adminUsersErrorMessage } = await import("./adminUsers"); const { ApiError } = await import("./api");
    for (const code of ["user.protectedAccount", "user.statusConflict", "user.notFound", "user.invalidResponse", "user.requestPending"]) {
      expect(adminUsersErrorMessage(new ApiError(409, code), "en")).not.toContain(code);
      expect(adminUsersErrorMessage(new ApiError(409, code), "vi")).not.toContain(code);
    }
    expect(adminUsersErrorMessage(new TypeError("network"), "en")).toContain("Unable to connect");
  });
});
