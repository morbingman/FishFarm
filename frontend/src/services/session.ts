import { useSyncExternalStore } from "react";
import { authApi, onApiSession, refreshSession } from "./api";
import type { ApiUser } from "./contracts";
import type { User } from "./demoStore";

let user: User | null = null;
let ready = false;
let bootstrapPending: Promise<void> | null = null;
const listeners = new Set<() => void>();
export function mapSessionUser(remote: ApiUser): User {
  if (remote.role !== "User" && remote.role !== "Admin") throw new Error("Unsupported account role");
  return {
    email: remote.email, name: remote.name, password: "",
    role: remote.role === "User" ? "Buyer" : "Admin",
    status: remote.status, phone: remote.phone ?? "", location: remote.location ?? "",
    joined: remote.joinedAt.slice(0, 10), prefs: remote.prefs,
  };
}
onApiSession((remote) => {
  user = remote?.status === "active" ? mapSessionUser(remote) : null;
  listeners.forEach((listener) => listener());
});
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const currentUser = () => user;
export const useUser = () => useSyncExternalStore(subscribe, currentUser);
export const useSessionReady = () => useSyncExternalStore(subscribe, () => ready);
export function bootstrapSession() {
  if (bootstrapPending) return bootstrapPending;
  bootstrapPending = refreshSession().then(() => {}).finally(() => {
    ready = true;
    bootstrapPending = null;
    listeners.forEach((listener) => listener());
  });
  return bootstrapPending;
}
export async function signOut() {
  await authApi.logout();
  window.location.hash = "home";
}
