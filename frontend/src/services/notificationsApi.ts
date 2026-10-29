import { api, ApiError } from "./api";
import { invalidNotificationsResponse, notificationCount, notificationExactKeys, notificationIsoDate, notificationJsonEqual, notificationObject, notificationsQuery, notificationsSearchParams, snapshotNotificationJson, validateNotification, type NotificationsPage, type NotificationsQuery, type PersonalNotification, type ReadAllResult } from "./notifications";

export function validateNotificationsPage(value: unknown, input: NotificationsQuery = {}): NotificationsPage {
  const query = notificationsQuery(input);
  if (!notificationObject(value) || !notificationExactKeys(value, ["items", "total", "unreadTotal", "page", "limit"])
    || !Array.isArray(value.items) || !notificationCount(value.total) || !notificationCount(value.unreadTotal)
    || value.page !== query.page || value.limit !== query.limit) throw invalidNotificationsResponse();
  const items = value.items.map(validateNotification);
  const expectedCount = Math.min(query.limit, Math.max(0, value.total - (query.page - 1) * query.limit));
  if (items.length !== expectedCount || new Set(items.map(item => item.id)).size !== items.length
    || items.filter(item => item.readAt === null).length > value.unreadTotal
    || (query.read === "unread" && value.total > value.unreadTotal)
    || (query.type === undefined && query.read === "unread" && value.total !== value.unreadTotal)
    || (query.type === undefined && query.read === "all" && value.unreadTotal > value.total)
    || items.some((item, index) => (query.type !== undefined && item.type !== query.type)
      || (query.read === "read" && item.readAt === null) || (query.read === "unread" && item.readAt !== null)
      || (index > 0 && (Date.parse(items[index - 1].createdAt) < Date.parse(item.createdAt)
        || (Date.parse(items[index - 1].createdAt) === Date.parse(item.createdAt) && items[index - 1].id > item.id))))) throw invalidNotificationsResponse();
  return { items, total: value.total, unreadTotal: value.unreadTotal, page: query.page, limit: query.limit };
}
export function validateNotificationRead(value: unknown, target: PersonalNotification): PersonalNotification {
  const original = validateNotification(target);
  const result = validateNotification(value);
  if (result.id !== original.id || result.type !== original.type || result.titleKey !== original.titleKey
    || !notificationJsonEqual(result.titleParams, original.titleParams) || result.bodyKey !== original.bodyKey
    || !notificationJsonEqual(result.bodyParams, original.bodyParams) || result.link !== original.link
    || result.createdAt !== original.createdAt || result.readAt === null
    || (original.readAt !== null && result.readAt !== original.readAt)) throw invalidNotificationsResponse();
  return result;
}
export function validateNotificationsReadAll(value: unknown): ReadAllResult {
  if (!notificationObject(value) || !notificationExactKeys(value, ["updated", "readAt"])
    || !notificationCount(value.updated) || !notificationIsoDate(value.readAt)) throw invalidNotificationsResponse();
  return { updated: value.updated, readAt: value.readAt };
}
const checkAbort = (signal?: AbortSignal) => { if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError"); };

// Single reads and read-all overlap the same personal history. One synchronous
// write lock prevents duplicate handlers AND cross-action dispatches before await.
let pendingWrite = false;
async function write<T>(action: () => Promise<T>): Promise<T> {
  if (pendingWrite) throw new ApiError(409, "notifications.requestPending");
  pendingWrite = true;
  try { return await action(); } finally { pendingWrite = false; }
}
export const notificationsApi = {
  list: async (input: NotificationsQuery = {}, signal?: AbortSignal): Promise<NotificationsPage> => {
    const query = notificationsQuery(input);
    checkAbort(signal);
    const value = await api<unknown>(`/me/notifications?${notificationsSearchParams(query)}`, { signal });
    checkAbort(signal);
    return validateNotificationsPage(value, query);
  },
  markRead: async (target: PersonalNotification): Promise<PersonalNotification> => {
    const original = validateNotification(target);
    // Snapshot nested persisted params as well as content before transport awaits.
    const snapshot: PersonalNotification = { ...original, titleParams: snapshotNotificationJson(original.titleParams), bodyParams: snapshotNotificationJson(original.bodyParams) };
    return write(async () => validateNotificationRead(await api<unknown>(`/notifications/${encodeURIComponent(snapshot.id)}`, { method: "PATCH", body: JSON.stringify({ read: true }) }, false), snapshot));
  },
  markAllRead: async (): Promise<ReadAllResult> => write(async () => {
    // BODYLESS. No expected count, optimistic decrement, or automatic 401 replay.
    return validateNotificationsReadAll(await api<unknown>("/notifications/read-all", { method: "POST" }, false));
  }),
};
