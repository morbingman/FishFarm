import type { ApiUser, AuthPayload, CompanyStore, MarketplaceListing, MarketplacePage } from "./contracts";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/v1";
let accessToken: string | null = null;
let generation = 0;
let refreshPending: Promise<AuthPayload | null> | null = null;
const sessionListeners = new Set<(user: ApiUser | null) => void>();
sessionStorage.removeItem("fishfarm-access-token");

export class ApiError extends Error {
  constructor(public status: number, public code: string, public details?: unknown, public params: Record<string, unknown> = {}) {
    super(code);
  }
}

export function onApiSession(listener: (user: ApiUser | null) => void) {
  sessionListeners.add(listener);
  return () => { sessionListeners.delete(listener); };
}
function acceptSession(payload: AuthPayload | null) {
  accessToken = payload?.accessToken ?? null;
  sessionListeners.forEach((listener) => listener(payload?.user ?? null));
}
export function clearApiSession() {
  generation++;
  refreshPending = null;
  acceptSession(null);
}

async function request<T>(path: string, init: RequestInit, authenticated: boolean): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) abort();
  else init.signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), 15_000);
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (authenticated && accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init, headers, signal: controller.signal,
      credentials: authenticated || path.startsWith("/auth/") ? "include" : "omit",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.code ?? `http.${response.status}`, error.details, error.params ?? {});
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abort);
  }
}

export function refreshSession(): Promise<AuthPayload | null> {
  if (refreshPending) return refreshPending;
  const version = generation;
  const pending = request<AuthPayload>("/auth/refresh", { method: "POST" }, false)
    .then((payload) => {
      if (version !== generation) return null;
      acceptSession(payload);
      return payload;
    })
    .catch((error: unknown) => {
      if (version === generation && error instanceof ApiError && error.status === 401) acceptSession(null);
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    })
    .finally(() => { if (refreshPending === pending) refreshPending = null; });
  refreshPending = pending;
  return pending;
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const version = generation;
  try {
    return await request<T>(path, init, true);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && retry && version === generation) {
      if (await refreshSession()) {
        if (version === generation) return api<T>(path, init, false);
      }
    }
    throw error;
  }
}
export const publicApi = <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }, false);

async function signIn(path: string, body: unknown) {
  const version = ++generation;
  const payload = await request<AuthPayload>(path, { method: "POST", body: JSON.stringify(body) }, false);
  if (version === generation) acceptSession(payload);
  return payload;
}
const unavailable = (..._args: unknown[]): Promise<any> => Promise.reject(new ApiError(501, "integration.unavailable"));
export const authApi = {
  login: (email: string, password: string) => signIn("/auth/login", { email, password }),
  register: (body: { email: string; password: string; name: string; phone?: string; location?: string }) => signIn("/auth/register", body),
  google: unavailable,
  async logout() {
    clearApiSession();
    await request<void>("/auth/logout", { method: "POST" }, false);
  },
  forgotPassword: (email: string) => request<{ sent: boolean; devCode?: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }, false),
  resetPassword: (email: string, code: string, newPassword: string) => request<void>("/auth/reset-password", { method: "POST", body: JSON.stringify({ email, code, newPassword }) }, false),
  verifyEmail: (email: string, code?: string) => request<{ sent?: boolean; verified?: boolean; devCode?: string }>("/auth/verify-email", { method: "POST", body: JSON.stringify({ email, ...(code ? { code } : {}) }) }, false),
};

export const domainApi = {
  listings: (params = "", signal?: AbortSignal) => publicApi<MarketplacePage>(`/marketplace/listings${params ? `?${params}` : ""}`, signal),
  listing: (id: string, signal?: AbortSignal) => publicApi<MarketplaceListing>(`/marketplace/listings/${encodeURIComponent(id)}`, signal),
  store: (signal?: AbortSignal) => publicApi<CompanyStore>("/marketplace/store", signal),
  favorites: unavailable, addFavorite: unavailable, removeFavorite: unavailable,
  cart: unavailable, putCart: unavailable, removeCart: unavailable,
  createOrder: unavailable, payOrder: unavailable, orders: unavailable,
  reviewOrder: unavailable, disputeOrder: unavailable, confirmDelivery: unavailable,
  startConversation: unavailable, sendMessage: unavailable, notifications: unavailable,
  batches: unavailable, adminBatches: unavailable, createBatch: unavailable,
  adminSponsorships: unavailable, updateSponsorshipStatus: unavailable,
  sponsorships: unavailable, sponsor: unavailable, paySponsorship: unavailable, uploadImage: unavailable,
};

export function errorMessage(error: unknown, language: "en" | "vi") {
  const vi = language === "vi";
  if (!(error instanceof ApiError)) return vi ? "Không thể kết nối. Vui lòng thử lại." : "Unable to connect. Please try again.";
  if (error.code === "cart.quantityExceedsStock") return vi ? `Số lượng vượt tồn kho (còn ${error.params.available ?? 0}). Làm mới giỏ hàng.` : `Quantity exceeds available stock (${error.params.available ?? 0} remaining). Refresh your cart.`;
  if (error.code === "order.mixedSaleModes") return vi ? "Cá có sẵn và đặt trước phải thanh toán riêng." : "In-stock fish and pre-orders must be checked out separately.";
  if (error.code === "cart.empty") return vi ? "Giỏ hàng đang trống." : "Your cart is empty.";
  if (error.code === "order.missingDepositTerms") return vi ? "Chưa có điều khoản đặt cọc. Vui lòng liên hệ công ty." : "Deposit terms are missing. Contact the company before ordering.";
  if (error.code === "order.balanceOutstanding") return vi ? "Chưa thể giao đơn đặt trước khi chưa thanh toán đủ phần còn lại." : "A pre-order cannot ship until its balance is paid in full.";
  if (error.code === "order.openDispute") return vi ? "Không thể hoàn tất đơn khi khiếu nại đang mở hoặc xét duyệt." : "This order cannot be completed while a dispute is open or being reviewed.";
  if (error.code === "order.balanceNotDue") return vi ? "Chưa đến hạn thanh toán phần còn lại hoặc trạng thái đã thay đổi." : "The balance is not currently due or the order state has changed.";
  if (error.code === "order.invalidTransition") return vi ? "Trạng thái đơn đã thay đổi hoặc không cho phép thao tác này." : "The order state has changed or does not allow this action.";
  if (error.code === "auth.accountSuspended") return vi ? "Tài khoản đã bị tạm khóa." : "This account is suspended. Contact support.";
  if (error.code.includes("invalidCredentials")) return vi ? "Email hoặc mật khẩu không đúng." : "Incorrect email or password.";
  if (error.code.includes("emailTaken") || error.code.includes("emailExists")) return vi ? "Email đã được đăng ký." : "This email is already registered.";
  if (error.status === 404) return vi ? "Không tìm thấy dữ liệu." : "The requested record was not found.";
  if (error.status === 400) return vi ? `Kiểm tra thông tin đã nhập (${error.code}).` : `Please check your input (${error.code}).`;
  if (error.status === 401) return vi ? "Đăng nhập không hợp lệ hoặc đã hết hạn." : "Invalid credentials or expired session.";
  return vi ? `Yêu cầu thất bại (${error.code}).` : `Request failed (${error.code}).`;
}
