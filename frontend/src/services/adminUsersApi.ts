import { api, ApiError } from "./api";
import { adminUsersQuery, adminUsersSearchParams, exactKeys, invalidAdminUsersResponse, object, userStatusInput, validateManagedUser, type AdminUsersPage, type AdminUsersQuery, type ManagedUser, type UserStatusInput } from "./adminUsers";

export function validateAdminUsersPage(value: unknown, input: AdminUsersQuery = {}): AdminUsersPage {
  const query = adminUsersQuery(input);
  if (!object(value) || !exactKeys(value, ["items", "total", "page", "limit"]) || !Array.isArray(value.items)
    || typeof value.total !== "number" || !Number.isSafeInteger(value.total) || value.total < 0
    || value.page !== query.page || value.limit !== query.limit) throw invalidAdminUsersResponse();
  const items = value.items.map(validateManagedUser);
  const expectedCount = Math.min(query.limit, Math.max(0, value.total - (query.page - 1) * query.limit));
  if (items.length !== expectedCount || new Set(items.map(user => user.id)).size !== items.length
    || new Set(items.map(user => user.email.toLowerCase())).size !== items.length
    || items.some((user, index) => (query.status !== undefined && user.status !== query.status) || (query.role !== undefined && user.role !== query.role)
      || (index > 0 && (Date.parse(items[index - 1].joinedAt) < Date.parse(user.joinedAt)
        || (Date.parse(items[index - 1].joinedAt) === Date.parse(user.joinedAt) && items[index - 1].id > user.id))))) throw invalidAdminUsersResponse();
  return { items, total: value.total, page: query.page, limit: query.limit };
}

// Lock synchronously, before any await: two handlers cannot dispatch the same write.
const pendingEmails = new Set<string>();
export const adminUsersApi = {
  list: async (input: AdminUsersQuery = {}, signal?: AbortSignal): Promise<AdminUsersPage> => {
    const query = adminUsersQuery(input);
    return validateAdminUsersPage(await api<unknown>(`/admin/users?${adminUsersSearchParams(query)}`, { signal }), query);
  },
  setStatus: async (target: ManagedUser, input: UserStatusInput): Promise<ManagedUser> => {
    const original = validateManagedUser(target);
    const body = userStatusInput(original, input);
    const lock = original.email.toLowerCase();
    if (pendingEmails.has(lock)) throw new ApiError(409, "user.requestPending");
    pendingEmails.add(lock);
    try {
      // Never automatically replay a write, including on an expired session.
      const value = validateManagedUser(await api<unknown>(`/admin/users/${encodeURIComponent(original.email)}/status`, { method: "PATCH", body: JSON.stringify(body) }, false));
      if (value.id !== original.id || value.email !== original.email || value.role !== original.role || value.status !== body.status
        || value.joinedAt !== original.joinedAt) throw invalidAdminUsersResponse();
      return value;
    } finally { pendingEmails.delete(lock); }
  },
};
