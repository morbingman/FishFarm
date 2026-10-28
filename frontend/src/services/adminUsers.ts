import { ApiError, errorMessage } from "./api";

export const adminUsersRoute = "#admin/users";
export const isAdminUsersRoute = (route: string) => route === "admin/users";
export const managedUserStatuses = ["active", "suspended"] as const;
export const managedUserRoles = ["User", "Admin"] as const;
export type ManagedUserStatus = typeof managedUserStatuses[number];
export type ManagedUserRole = typeof managedUserRoles[number];
export type ManagedUser = { id: string; email: string; name: string; role: ManagedUserRole; status: ManagedUserStatus; joinedAt: string };
export type AdminUsersQuery = { q?: string; status?: ManagedUserStatus; role?: ManagedUserRole; page?: number; limit?: number };
export type AdminUsersRequest = AdminUsersQuery & { q: string; page: number; limit: number };
export type AdminUsersPage = { items: ManagedUser[]; total: number; page: number; limit: number };
export type UserStatusInput = { status: ManagedUserStatus; expectedStatus: ManagedUserStatus };

export const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
export const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
const status = (value: unknown): value is ManagedUserStatus => managedUserStatuses.includes(value as ManagedUserStatus);
const role = (value: unknown): value is ManagedUserRole => managedUserRoles.includes(value as ManagedUserRole);
const positiveInteger = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
const identityText = (value: unknown): value is string => typeof value === "string" && !!value.trim() && value === value.trim() && !/[\u0000-\u0020\u007f]/.test(value);
export const invalidAdminUsersResponse = () => new ApiError(502, "user.invalidResponse");

function isoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second, , zoneHour, zoneMinute] = match;
  const days = new Date(`${year}-${month}-01T00:00:00Z`);
  days.setUTCMonth(days.getUTCMonth() + 1, 0);
  return +month >= 1 && +month <= 12 && +day >= 1 && +day <= days.getUTCDate() && +hour < 24 && +minute < 60 && +second < 60
    && (zoneHour === undefined || (+zoneHour < 24 && +zoneMinute < 60));
}
export function validateManagedUser(value: unknown): ManagedUser {
  if (!object(value) || !exactKeys(value, ["id", "email", "name", "role", "status", "joinedAt"])
    || !identityText(value.id) || !identityText(value.email) || !/^[^@]+@[^@]+$/.test(value.email)
    || typeof value.name !== "string"
    || !role(value.role) || !status(value.status) || !isoDate(value.joinedAt)) throw invalidAdminUsersResponse();
  return { id: value.id, email: value.email, name: value.name, role: value.role, status: value.status, joinedAt: value.joinedAt };
}
export function adminUsersQuery(input: AdminUsersQuery = {}): AdminUsersRequest {
  if (!object(input) || Object.keys(input).some(key => !["q", "status", "role", "page", "limit"].includes(key))
    || (input.q !== undefined && typeof input.q !== "string") || (input.status !== undefined && !status(input.status))
    || (input.role !== undefined && !role(input.role))) throw new ApiError(400, "validation.failed");
  const page = input.page === undefined ? 1 : input.page;
  const limit = input.limit === undefined ? 25 : input.limit;
  const q = (input.q ?? "").trim();
  if (!positiveInteger(page) || page > 1_000_000 || !positiveInteger(limit) || limit > 100 || q.length > 100 || !Number.isSafeInteger((page - 1) * limit)) throw new ApiError(400, "validation.failed");
  return { q, ...(input.status === undefined ? {} : { status: input.status }), ...(input.role === undefined ? {} : { role: input.role }), page, limit };
}
export function adminUsersSearchParams(input: AdminUsersQuery = {}) {
  const query = adminUsersQuery(input);
  const params = new URLSearchParams({ q: query.q });
  if (query.status) params.set("status", query.status);
  if (query.role) params.set("role", query.role);
  params.set("page", String(query.page)); params.set("limit", String(query.limit));
  return params.toString();
}
export const oppositeUserStatus = (value: ManagedUserStatus): ManagedUserStatus => value === "active" ? "suspended" : "active";
export const canChangeUserStatus = (value: ManagedUser) => value.role === "User" && status(value.status);
export function userStatusInput(target: ManagedUser, input: UserStatusInput): UserStatusInput {
  const user = validateManagedUser(target);
  if (user.role === "Admin") throw new ApiError(409, "user.protectedAccount");
  if (!object(input) || !exactKeys(input, ["status", "expectedStatus"]) || !status(input.status) || !status(input.expectedStatus)
    || input.status === input.expectedStatus || input.expectedStatus !== user.status) throw new ApiError(400, "validation.failed");
  return { status: input.status, expectedStatus: input.expectedStatus };
}
export function adminUsersErrorMessage(failure: unknown, language: "en" | "vi") {
  const vi = language === "vi";
  if (failure instanceof ApiError) {
    if (failure.code === "user.protectedAccount") return vi ? "Tài khoản Admin được bảo vệ; không thể khóa hoặc kích hoạt lại." : "Admin accounts are protected and cannot be suspended or reactivated.";
    if (failure.code === "user.statusConflict") return vi ? "Trạng thái tài khoản đã thay đổi. Làm mới trước thao tác tiếp theo." : "The account status has changed. Refresh before another action.";
    if (failure.code === "user.notFound") return vi ? "Không tìm thấy tài khoản. Làm mới danh sách." : "The account was not found. Refresh the list.";
    if (failure.code === "user.invalidResponse") return vi ? "Máy chủ trả dữ liệu không hợp lệ. Chưa xác nhận thành công; cần làm mới để đối chiếu." : "The server returned an invalid response. Success is not confirmed; refresh to reconcile.";
    if (failure.code === "user.requestPending") return vi ? "Thao tác cho tài khoản này đang được gửi." : "An action for this account is already being submitted.";
  }
  return errorMessage(failure, language);
}
