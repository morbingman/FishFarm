import { ApiError, errorMessage } from "./api";
import { reviewDate, reviewMoney } from "./listingReview";

export const notificationsRoute = "#account/notifications";
export const isNotificationsRoute = (route: string) => route === "account/notifications";
export const notificationTypes = ["success", "error", "system", "status", "approval", "reminder"] as const;
export const notificationReads = ["all", "unread", "read"] as const;
export type NotificationType = typeof notificationTypes[number];
export type NotificationRead = typeof notificationReads[number];
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type PersonalNotification = {
  id: string; type: NotificationType; titleKey: string; titleParams: JsonValue;
  bodyKey: string; bodyParams: JsonValue; link: string | null; readAt: string | null; createdAt: string;
};
export type NotificationsQuery = { read?: NotificationRead; type?: NotificationType; page?: number; limit?: number };
export type NotificationsRequest = NotificationsQuery & { read: NotificationRead; page: number; limit: number };
export type NotificationsPage = { items: PersonalNotification[]; total: number; unreadTotal: number; page: number; limit: number };
export type ReadAllResult = { updated: number; readAt: string };
export const notificationObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
export const notificationExactKeys = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && keys.every(key => hasOwn(value, key));
export const invalidNotificationsResponse = () => new ApiError(502, "notifications.invalidResponse");
export const notificationCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function notificationIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second] = match;
  const lastDay = new Date(`${year}-${month}-01T00:00:00Z`);
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0);
  return +month >= 1 && +month <= 12 && +day >= 1 && +day <= lastDay.getUTCDate() && +hour < 24 && +minute < 60 && +second < 60;
}

// Persisted JSON may be a primitive, null, an array or deeply nested objects.
// Iteration avoids imposing an artificial depth limit on otherwise valid history.
export function isNotificationJson(value: unknown): value is JsonValue {
  const stack: { value: unknown; exit?: boolean }[] = [{ value }];
  const active = new Set<object>();
  while (stack.length) {
    const entry = stack.pop()!;
    const item = entry.value;
    if (item === null || typeof item === "string" || typeof item === "boolean") continue;
    if (typeof item === "number") { if (!Number.isFinite(item)) return false; continue; }
    if (typeof item !== "object") return false;
    if (entry.exit) { active.delete(item); continue; }
    if (active.has(item)) return false;
    active.add(item); stack.push({ value: item, exit: true });
    if (Array.isArray(item)) {
      if (Object.keys(item).length !== item.length) return false;
      for (let index = 0; index < item.length; index++) stack.push({ value: item[index] });
    } else {
      if (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) return false;
      for (const child of Object.values(item)) stack.push({ value: child });
    }
  }
  return true;
}
export function snapshotNotificationJson(value: JsonValue): JsonValue {
  if (value === null || typeof value !== "object") return value;
  const root: JsonValue[] | { [key: string]: JsonValue } = Array.isArray(value) ? [] : {};
  const stack: { source: JsonValue[] | { [key: string]: JsonValue }; target: JsonValue[] | { [key: string]: JsonValue } }[] = [{ source: value, target: root }];
  while (stack.length) {
    const { source, target } = stack.pop()!;
    for (const [key, child] of Object.entries(source)) {
      const copy = child !== null && typeof child === "object" ? (Array.isArray(child) ? [] : {}) : child;
      Object.defineProperty(target, key, { value: copy, writable: true, enumerable: true, configurable: true });
      if (child !== null && typeof child === "object") stack.push({ source: child, target: copy as JsonValue[] | { [key: string]: JsonValue } });
    }
  }
  return root;
}
export function notificationJsonEqual(left: JsonValue, right: JsonValue): boolean {
  const stack: [JsonValue, JsonValue][] = [[left, right]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    if (a === b) continue;
    if (a === null || b === null || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false;
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    for (const key of keys) {
      if (!hasOwn(b, key)) return false;
      stack.push([(a as Record<string, JsonValue>)[key], (b as Record<string, JsonValue>)[key]]);
    }
  }
  return true;
}
export function validateNotification(value: unknown): PersonalNotification {
  if (!notificationObject(value) || !notificationExactKeys(value, ["id", "type", "titleKey", "titleParams", "bodyKey", "bodyParams", "link", "readAt", "createdAt"])
    || typeof value.id !== "string" || !value.id || !notificationTypes.includes(value.type as NotificationType)
    || typeof value.titleKey !== "string" || typeof value.bodyKey !== "string"
    || !isNotificationJson(value.titleParams) || !isNotificationJson(value.bodyParams)
    || (value.link !== null && typeof value.link !== "string") || !notificationIsoDate(value.createdAt)
    || (value.readAt !== null && !notificationIsoDate(value.readAt))) throw invalidNotificationsResponse();
  return { id: value.id, type: value.type as NotificationType, titleKey: value.titleKey, titleParams: value.titleParams,
    bodyKey: value.bodyKey, bodyParams: value.bodyParams, link: value.link, readAt: value.readAt, createdAt: value.createdAt };
}
export function notificationsQuery(input: NotificationsQuery = {}): NotificationsRequest {
  if (!notificationObject(input) || Object.keys(input).some(key => !["read", "type", "page", "limit"].includes(key))
    || (input.read !== undefined && !notificationReads.includes(input.read)) || (input.type !== undefined && !notificationTypes.includes(input.type))) throw new ApiError(400, "validation.failed");
  const page = input.page === undefined ? 1 : input.page;
  const limit = input.limit === undefined ? 25 : input.limit;
  if (!notificationCount(page) || page < 1 || page > 1_000_000 || !notificationCount(limit) || limit < 1 || limit > 100) throw new ApiError(400, "validation.failed");
  return { read: input.read ?? "all", ...(input.type === undefined ? {} : { type: input.type }), page, limit };
}
export function notificationsSearchParams(input: NotificationsQuery = {}) {
  const query = notificationsQuery(input);
  const params = new URLSearchParams({ read: query.read });
  if (query.type) params.set("type", query.type);
  params.set("page", String(query.page)); params.set("limit", String(query.limit));
  return params.toString();
}

export function safeNotificationLink(link: string | null | undefined, role: "User" | "Buyer" | "Admin"): string | null {
  if (!link || /[\u0000-\u0020\u007f]/.test(link)) return null;
  if (link === "#marketplace") return link;
  // Public detail has one exact supported query, never arbitrary hash/query URLs.
  if (/^#marketplace\/detail\?fish=(?:FM-\d+|c[a-z0-9]{24})$/.test(link)) return link;
  if (role === "Admin") {
    if (["#company/listings", "#company/orders", "#admin/queue", "#admin/activity", "#admin/disputes", "#admin/users"].includes(link)) return link;
    return /^#(?:company\/listing\/(?:FM-\d+|c[a-z0-9]{24})|(?:company|admin)\/orders\/ORD-\d+|admin\/review\/(?:FM-\d+|c[a-z0-9]{24})|admin\/disputes\/c[a-z0-9]{24})$/.test(link) ? link : null;
  }
  if (role !== "User" && role !== "Buyer") return null;
  if (["#marketplace/orders", "#marketplace/disputes"].includes(link)) return link;
  return /^#marketplace\/(?:orders\/ORD-\d+(?:\/dispute)?|disputes\/c[a-z0-9]{24})$/.test(link) ? link : null;
}
export const notificationDate = reviewDate;
export function notificationTypeLabel(type: NotificationType, language: "en" | "vi") {
  const labels: Record<NotificationType, [string, string]> = { success: ["Success", "Thành công"], error: ["Error", "Lỗi"], system: ["System", "Hệ thống"], status: ["Status", "Trạng thái"], approval: ["Approval", "Phê duyệt"], reminder: ["Reminder", "Nhắc nhở"] };
  return labels[type][language === "vi" ? 1 : 0];
}

// Only these explicit templates are interpreted. Substitutions remain React text.
// Unknown keys or unsuitable params remain visible as their original key + JSON.
type ParamFormat = "text" | "integer" | "money" | "utc";
type Template = { en: string; vi: string; params?: Record<string, ParamFormat> };
const templates: Record<string, Template> = {
  "notifications.welcome.title": { en: "Welcome to FISHMARKET", vi: "Chào mừng đến FISHMARKET" },
  "notifications.welcome.body": { en: "Browse the company marketplace and manage your orders securely.", vi: "Khám phá chợ cá của công ty và quản lý đơn hàng an toàn." },
  "notifications.buyer.welcome.title": { en: "Welcome to FISHMARKET", vi: "Chào mừng đến FISHMARKET" },
  "notifications.buyer.welcome.body": { en: "Browse the company marketplace and manage your orders securely.", vi: "Khám phá chợ cá của công ty và quản lý đơn hàng an toàn." },
  "notifications.company.welcome.title": { en: "Welcome to the company workspace", vi: "Chào mừng đến không gian công ty" },
  "notifications.company.welcome.body": { en: "Manage the company catalog and orders.", vi: "Quản lý danh mục và đơn hàng công ty." },
  "notifications.admin.pendingQueue.title": { en: "{count} listings awaiting review", vi: "{count} tin đăng chờ xét duyệt", params: { count: "integer" } },
  "notifications.admin.pendingQueue.body": { en: "{names} have been waiting for {hours} hours.", vi: "{names} đã chờ {hours} giờ.", params: { names: "text", hours: "integer" } },
  "notifications.admin.orderPlaced.title": { en: "New order {code}", vi: "Đơn hàng mới {code}", params: { code: "text" } },
  "notifications.admin.orderPlaced.body": { en: "{name} placed an order totaling {total}.", vi: "{name} đã đặt đơn trị giá {total}.", params: { name: "text", total: "money" } },
  "notifications.buyer.orderPlaced.title": { en: "Order {code} placed", vi: "Đã đặt đơn {code}", params: { code: "text" } },
  "notifications.buyer.orderPlaced.body": { en: "Your order total is {total}.", vi: "Tổng đơn hàng của bạn là {total}.", params: { total: "money" } },
  "notifications.admin.balancePaid.title": { en: "Balance paid for {code}", vi: "Đã thanh toán phần còn lại cho {code}", params: { code: "text" } },
  "notifications.admin.balancePaid.body": { en: "The buyer paid the remaining order balance.", vi: "Người mua đã thanh toán phần còn lại của đơn hàng." },
  "notifications.buyer.balancePaid.title": { en: "Balance paid for {code}", vi: "Đã thanh toán phần còn lại cho {code}", params: { code: "text" } },
  "notifications.buyer.balancePaid.body": { en: "Your remaining order balance has been paid.", vi: "Phần còn lại của đơn hàng đã được thanh toán." },
  "notifications.buyer.orderReadyBalanceDue.title": { en: "Order {code} ready · balance due", vi: "Đơn {code} sẵn sàng · cần thanh toán phần còn lại", params: { code: "text" } },
  "notifications.buyer.orderReadyBalanceDue.body": { en: "Pay the remaining {balance} within {days} days.", vi: "Thanh toán phần còn lại {balance} trong {days} ngày.", params: { balance: "money", days: "integer" } },
  "notifications.buyer.orderReady.title": { en: "Order {code} ready", vi: "Đơn {code} đã sẵn sàng", params: { code: "text" } },
  "notifications.buyer.orderReady.body": { en: "Your order is ready for shipping.", vi: "Đơn hàng của bạn đã sẵn sàng giao." },
  "notifications.buyer.orderShipped.title": { en: "Order {code} shipped", vi: "Đơn {code} đang giao", params: { code: "text" } },
  "notifications.buyer.orderShipped.body": { en: "Your order has been shipped. Open the order for tracking details.", vi: "Đơn hàng đã được gửi. Mở đơn để xem thông tin vận chuyển." },
  "notifications.buyer.orderDelivered.title": { en: "Order {code} delivered", vi: "Đã giao đơn {code}", params: { code: "text" } },
  "notifications.buyer.orderDelivered.body": { en: "Your order is marked delivered. Open the order to review delivery.", vi: "Đơn hàng được ghi nhận đã giao. Mở đơn để kiểm tra việc giao hàng." },
  "notifications.buyer.orderCompleted.title": { en: "Order {code} completed", vi: "Đơn {code} hoàn tất", params: { code: "text" } },
  "notifications.buyer.orderCompleted.body": { en: "Your order has been completed.", vi: "Đơn hàng của bạn đã hoàn tất." },
  "notifications.buyer.orderCancelled.title": { en: "Order {code} cancelled", vi: "Đã hủy đơn {code}", params: { code: "text" } },
  "notifications.buyer.orderCancelled.body": { en: "Your order was cancelled: {reason}", vi: "Đơn hàng đã bị hủy: {reason}", params: { reason: "text" } },
  "notifications.buyer.orderRefunded.title": { en: "Order {code} refunded", vi: "Đơn {code} đã hoàn tiền", params: { code: "text" } },
  "notifications.buyer.orderRefunded.body": { en: "Your order was cancelled and paid amounts refunded: {reason}", vi: "Đơn hàng đã bị hủy và khoản đã trả được hoàn tiền: {reason}", params: { reason: "text" } },
  "notifications.admin.disputeOpened.title": { en: "Dispute opened for {code}", vi: "Khiếu nại mới cho {code}", params: { code: "text" } },
  "notifications.admin.disputeOpened.body": { en: "{name} opened a dispute. Review its details.", vi: "{name} đã mở khiếu nại. Xem thông tin chi tiết.", params: { name: "text" } },
  "notifications.buyer.disputeReviewing.title": { en: "Dispute for {code} under review", vi: "Khiếu nại cho {code} đang xét duyệt", params: { code: "text" } },
  "notifications.buyer.disputeReviewing.body": { en: "Your dispute is being reviewed.", vi: "Khiếu nại của bạn đang được xét duyệt." },
  "notifications.buyer.disputeResolved.title": { en: "Dispute for {code} resolved", vi: "Đã giải quyết khiếu nại cho {code}", params: { code: "text" } },
  "notifications.buyer.disputeResolved.body": { en: "Your dispute has been resolved. Open it for details.", vi: "Khiếu nại đã được giải quyết. Mở để xem chi tiết." },
  "notifications.buyer.disputeRejected.title": { en: "Dispute for {code} rejected", vi: "Khiếu nại cho {code} bị từ chối", params: { code: "text" } },
  "notifications.buyer.disputeRejected.body": { en: "Your dispute has been rejected. Open it for details.", vi: "Khiếu nại đã bị từ chối. Mở để xem chi tiết." },
  "notifications.admin.batchSubmitted.title": { en: "Batch {code} submitted for review", vi: "Lô {code} gửi xét duyệt", params: { code: "text" } },
  "notifications.admin.batchSubmitted.body": { en: "A company batch is awaiting review. Batch management is not integrated here.", vi: "Một lô của công ty đang chờ xét duyệt. Quản lý lô chưa được tích hợp tại đây." },
  "notifications.admin.listingSubmitted.title": { en: "Listing submitted: {name}", vi: "Tin đăng gửi xét duyệt: {name}", params: { name: "text" } },
  "notifications.admin.listingSubmitted.body": { en: "{company} submitted {name} ({code}) for review.", vi: "{company} đã gửi {name} ({code}) để xét duyệt.", params: { company: "text", name: "text", code: "text" } },
  "notifications.admin.listingResubmitted.title": { en: "Listing resubmitted: {name}", vi: "Tin đăng gửi lại: {name}", params: { name: "text" } },
  "notifications.admin.listingResubmitted.body": { en: "{company} resubmitted {name} ({code}) for review.", vi: "{company} đã gửi lại {name} ({code}) để xét duyệt.", params: { company: "text", name: "text", code: "text" } },
};
export function notificationText(key: string, params: JsonValue, language: "en" | "vi"): string {
  const fallback = () => {
    try { return `${key} · ${JSON.stringify(params)}`; } catch { return `${key} · ${language === "vi" ? "Không thể hiển thị tham số" : "Parameters cannot be displayed"}`; }
  };
  const template = hasOwn(templates, key) ? templates[key] : undefined;
  if (!template) return fallback();
  const replacements: Record<string, string> = {};
  for (const [name, format] of Object.entries(template.params ?? {})) {
    if (!notificationObject(params) || !hasOwn(params, name)) return fallback();
    const value = params[name];
    if (format === "text") { if (typeof value !== "string") return fallback(); replacements[name] = value; }
    else if (format === "utc") { if (!notificationIsoDate(value)) return fallback(); replacements[name] = notificationDate(value, language); }
    else {
      if (!notificationCount(value)) return fallback();
      replacements[name] = format === "money" ? reviewMoney(value, language) : value.toLocaleString(language === "vi" ? "vi-VN" : "en-US");
    }
  }
  return template[language].replace(/\{([a-zA-Z]+)\}/g, (_match, name: string) => replacements[name] ?? `{${name}}`);
}
export function notificationsErrorMessage(failure: unknown, language: "en" | "vi") {
  const vi = language === "vi";
  if (failure instanceof ApiError) {
    if (failure.code === "notification.notFound") return vi ? "Không tìm thấy thông báo cá nhân. Làm mới để đối chiếu." : "The personal notification was not found. Refresh to reconcile.";
    if (failure.code === "notifications.invalidResponse") return vi ? "Máy chủ trả dữ liệu thông báo không hợp lệ. Cần làm mới để đối chiếu." : "The server returned an invalid notification response. Refresh to reconcile.";
    if (failure.code === "notifications.requestPending") return vi ? "Thao tác thông báo đang được gửi." : "A notification action is already being submitted.";
  }
  return errorMessage(failure, language);
}
