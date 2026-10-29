import { api, ApiError } from "./api";
import type { ApiUser } from "./contracts";
import { accountIdentityInput, notificationPrefsInput, profileInput, validateAccountProfile, validateAccountUser,
  validateNotificationPrefs, validateSavedPrefs, validateSavedProfile, type AccountIdentity, type NotificationPrefs, type ProfileInput } from "./account";

const checkAbort = (signal?: AbortSignal) => { if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError"); };

// Profile and preferences overlap the same account. Acquire synchronously before
// dispatch, and hold through response validation, including on failed writes.
let pendingWrite = false;
async function write<T>(action: () => Promise<T>): Promise<T> {
  if (pendingWrite) throw new ApiError(409, "account.requestPending");
  pendingWrite = true;
  try { return await action(); } finally { pendingWrite = false; }
}

export const accountApi = {
  profile: async (expected: AccountIdentity | null, signal?: AbortSignal): Promise<ApiUser> => {
    const identity = expected === null ? null : accountIdentityInput(expected);
    checkAbort(signal);
    const value = await api<unknown>("/me", { signal });
    checkAbort(signal);
    return validateAccountProfile(value, identity);
  },
  prefs: async (signal?: AbortSignal): Promise<NotificationPrefs> => {
    checkAbort(signal);
    const value = await api<unknown>("/me/prefs", { signal });
    checkAbort(signal);
    return validateNotificationPrefs(value);
  },
  saveProfile: async (input: ProfileInput, expected: ApiUser): Promise<ApiUser> => {
    const saved = profileInput(input);
    // Both public identity and nested preferences are copied before any await.
    const original = validateAccountUser(expected);
    if (original.status !== "active") throw new ApiError(400, "account.input");
    return write(async () => validateSavedProfile(await api<unknown>("/me", { method: "PATCH", body: JSON.stringify(saved) }, false), saved, original));
  },
  savePrefs: async (input: NotificationPrefs): Promise<NotificationPrefs> => {
    const saved = notificationPrefsInput(input);
    return write(async () => validateSavedPrefs(await api<unknown>("/me/prefs", { method: "PATCH", body: JSON.stringify(saved) }, false), saved));
  },
};
