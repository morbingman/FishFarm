import { ApiError, errorMessage } from "./api";
import type { ApiUser } from "./contracts";

export type AccountRoute = "profile" | "settings";
export type AccountIdentity = { id: string; role: ApiUser["role"] };
export type ProfileInput = { name: string; phone: string; location: string };
export type NotificationPrefs = ApiUser["prefs"];

export function parseAccountRoute(route: string): AccountRoute | null {
  if (route === "account/profile") return "profile";
  if (route === "account/settings") return "settings";
  return null;
}

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object"
  && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) => Reflect.ownKeys(value).length === keys.length
  && keys.every(key => hasOwn(value, key));
const role = (value: unknown): value is ApiUser["role"] => value === "User" || value === "Admin";
const identityText = (value: unknown): value is string => typeof value === "string" && !!value
  && !/[\s\u0000-\u0020\u007f]/.test(value);
export const invalidAccountResponse = () => new ApiError(502, "account.invalidResponse");
const invalidInput = () => new ApiError(400, "account.input");

export function accountIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/.exec(value);
  if (!match || match[0] !== value || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second] = match;
  const leap = +year % 4 === 0 && (+year % 100 !== 0 || +year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return +month >= 1 && +month <= 12 && +day >= 1 && +day <= days[+month - 1] && +hour < 24 && +minute < 60 && +second < 60;
}

function prefsSnapshot(value: unknown, failure: () => ApiError): NotificationPrefs {
  if (!object(value) || !exactKeys(value, ["status", "system", "reminders"])
    || typeof value.status !== "boolean" || typeof value.system !== "boolean" || typeof value.reminders !== "boolean") throw failure();
  return { status: value.status, system: value.system, reminders: value.reminders };
}
export function validateNotificationPrefs(value: unknown): NotificationPrefs {
  return prefsSnapshot(value, invalidAccountResponse);
}
// The UI explicitly submits a full snapshot: last-write-wins, not a partial merge.
export function notificationPrefsInput(value: unknown): NotificationPrefs {
  return prefsSnapshot(value, invalidInput);
}

export function profileInput(value: unknown): ProfileInput {
  if (!object(value) || !exactKeys(value, ["name", "phone", "location"])
    || typeof value.name !== "string" || typeof value.phone !== "string" || typeof value.location !== "string") throw invalidInput();
  const input = { name: value.name.trim(), phone: value.phone.trim(), location: value.location.trim() };
  if (!input.name || input.name.length > 80 || input.phone.length > 32 || input.location.length > 120) throw invalidInput();
  return input;
}

// Stored public text is validated by type, not by registration/editing limits.
// Never silently discard private fields or coerce a persisted preference value.
export function validateAccountUser(value: unknown): ApiUser {
  if (!object(value) || !exactKeys(value, ["id", "email", "name", "role", "status", "phone", "location", "joinedAt", "emailVerifiedAt", "prefs"])
    || !identityText(value.id) || !identityText(value.email) || !/^[^@]+@[^@]+$/.test(value.email)
    || typeof value.name !== "string" || !role(value.role) || (value.status !== "active" && value.status !== "suspended")
    || (value.phone !== null && typeof value.phone !== "string") || (value.location !== null && typeof value.location !== "string")
    || !accountIsoDate(value.joinedAt) || (value.emailVerifiedAt !== null && !accountIsoDate(value.emailVerifiedAt))) throw invalidAccountResponse();
  return { id: value.id, email: value.email, name: value.name, role: value.role, status: value.status,
    phone: value.phone, location: value.location, joinedAt: value.joinedAt, emailVerifiedAt: value.emailVerifiedAt,
    prefs: validateNotificationPrefs(value.prefs) };
}

export function accountIdentityInput(value: unknown): AccountIdentity {
  if (!object(value) || !exactKeys(value, ["id", "role"]) || !identityText(value.id) || !role(value.role)) throw invalidInput();
  return { id: value.id, role: value.role };
}

// Null is only for the page's initial active-identity check. Session generations
// are guarded by api; callers publish validated /me themselves with their stamp.
export function validateAccountProfile(value: unknown, expected: AccountIdentity | null): ApiUser {
  const identity = expected === null ? null : accountIdentityInput(expected);
  const result = validateAccountUser(value);
  if (result.status !== "active" || (identity !== null && (result.id !== identity.id || result.role !== identity.role))) throw invalidAccountResponse();
  return result;
}

export function validateSavedProfile(value: unknown, input: ProfileInput, expected: ApiUser): ApiUser {
  const saved = profileInput(input);
  const original = validateAccountUser(expected);
  if (original.status !== "active") throw invalidInput();
  const result = validateAccountProfile(value, { id: original.id, role: original.role });
  if (result.email !== original.email || result.joinedAt !== original.joinedAt
    || result.name !== saved.name || result.phone !== saved.phone || result.location !== saved.location) throw invalidAccountResponse();
  return result;
}

export function validateSavedPrefs(value: unknown, input: NotificationPrefs): NotificationPrefs {
  const saved = notificationPrefsInput(input);
  const result = validateNotificationPrefs(value);
  if (result.status !== saved.status || result.system !== saved.system || result.reminders !== saved.reminders) throw invalidAccountResponse();
  return result;
}

export function accountErrorMessage(failure: unknown, language: "en" | "vi") {
  const vi = language === "vi";
  if (failure instanceof ApiError) {
    if (failure.code === "account.invalidResponse") return vi ? "Máy chủ trả dữ liệu tài khoản không hợp lệ. Chưa xác nhận thành công; cần làm mới để đối chiếu." : "The server returned an invalid account response. Success is not confirmed; refresh to reconcile.";
    if (failure.code === "account.input") return vi ? "Kiểm tra tên (1–80 ký tự), số điện thoại (tối đa 32), địa điểm (tối đa 120) và đầy đủ ba tùy chọn thông báo." : "Check the name (1–80 characters), phone (up to 32), location (up to 120), and all three notification preferences.";
    if (failure.code === "account.requestPending") return vi ? "Một thao tác tài khoản đang được gửi. Vui lòng chờ trước khi lưu tiếp." : "An account action is already being submitted. Wait before saving again.";
  }
  return errorMessage(failure, language);
}
