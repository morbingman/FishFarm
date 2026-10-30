import type { ApiUser, AuthPayload, CompanyStore, MarketplaceListing, MarketplacePage } from "./contracts";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/v1";
let accessToken: string | null = null;
let identity: { id: string; role: ApiUser["role"] } | null = null;
let generation = 0;
let refreshPending: Promise<AuthPayload | null> | null = null;
const sessionListeners = new Set<(user: ApiUser | null) => void>();
sessionStorage.removeItem("fishfarm-access-token");

export class ApiError extends Error {
  constructor(public status: number, public code: string, public details?: unknown, public params: Record<string, unknown> = {}) {
    super(code);
  }
}

export type ApiSessionStamp = { generation: number; id: string; role: ApiUser["role"] };
export const apiSessionStamp = (): ApiSessionStamp | null => identity ? { generation, ...identity } : null;
export function isApiSession(stamp: ApiSessionStamp | null): boolean {
  return stamp !== null && stamp.generation === generation && stamp.id === identity?.id && stamp.role === identity?.role;
}
// Profile publication changes display data, never tokens or the session generation.
export function publishApiUser(remote: ApiUser, stamp: ApiSessionStamp): boolean {
  if (!isApiSession(stamp) || remote.id !== stamp.id || remote.role !== stamp.role || remote.status !== "active") return false;
  sessionListeners.forEach(listener => listener(remote));
  return true;
}
export function onApiSession(listener: (user: ApiUser | null) => void) {
  sessionListeners.add(listener);
  return () => { sessionListeners.delete(listener); };
}
function acceptSession(payload: AuthPayload | null) {
  accessToken = payload?.accessToken ?? null;
  identity = payload?.user ? { id: payload.user.id, role: payload.user.role } : null;
  sessionListeners.forEach((listener) => listener(payload?.user ?? null));
}
export function clearApiSession() {
  generation++;
  refreshPending = null;
  acceptSession(null);
}

async function request<T>(path: string, init: RequestInit, authenticated: boolean, binary = false): Promise<T> {
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
    return binary ? await response.blob() as T : await response.json() as T;
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
      const invalidSession = error instanceof ApiError && (error.status === 401 || (error.status === 403 && error.code === "auth.accountSuspended"));
      if (version === generation && invalidSession) clearApiSession();
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    })
    .finally(() => { if (refreshPending === pending) refreshPending = null; });
  refreshPending = pending;
  return pending;
}

async function protectedRequest<T>(path: string, init: RequestInit, retry: boolean, binary = false): Promise<T> {
  const version = generation;
  const originalIdentity = identity;
  try {
    const result = await request<T>(path, init, true, binary);
    if (version !== generation || originalIdentity?.id !== identity?.id || originalIdentity?.role !== identity?.role) throw new ApiError(401, "auth.sessionChanged");
    return result;
  } catch (error) {
    if (error instanceof ApiError && error.status === 403 && error.code === "auth.accountSuspended" && version === generation) {
      clearApiSession();
      throw error;
    }
    if (error instanceof ApiError && error.status === 401 && error.code !== "auth.sessionChanged" && retry && version === generation) {
      if (await refreshSession()) {
        if (originalIdentity && (originalIdentity.id !== identity?.id || originalIdentity.role !== identity?.role)) throw new ApiError(401, "auth.sessionChanged");
        if (!originalIdentity && !["GET", "HEAD"].includes((init.method ?? "GET").toUpperCase())) throw new ApiError(401, "auth.sessionChanged");
        if (version === generation) return protectedRequest<T>(path, init, false, binary);
      }
    }
    throw error;
  }
}
export const api = <T>(path: string, init: RequestInit = {}, retry = true) => protectedRequest<T>(path, init, retry);
export const apiBlob = (path: string, signal?: AbortSignal) => protectedRequest<Blob>(path, { signal }, true, true);
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
  if (error.code === "facility.notFound") return vi ? "Không tìm thấy cơ sở đã chọn. Làm mới danh sách cơ sở." : "The selected facility was not found. Refresh the facility directory.";
  if (error.code === "facility.verificationNotFound") return vi ? "Cơ sở chưa có hồ sơ tuân thủ. Cần gửi hồ sơ trước khi xét duyệt." : "This facility has no compliance submission. Submit one before review.";
  if (error.code === "facility.documentNotFound" || error.code === "uploads.notFound") return vi ? "Không tìm thấy tài liệu được bảo vệ. Làm mới hồ sơ; không có đường dẫn công khai thay thế." : "The protected document was not found. Refresh the verification; there is no public-link fallback.";
  if (error.code === "facility.approvalIncomplete") return vi ? "Phê duyệt cần mức tuân thủ khác Không có, hồ sơ được kiểm soát và ngày hết hạn tương lai được gửi rõ ràng." : "Approval requires a non-none compliance level, controlled documents and an explicitly supplied future expiry.";
  if (error.code === "facility.invalidDecision") return vi ? "Chỉ có thể phê duyệt, từ chối hoặc thu hồi. Đang chờ không phải quyết định xét duyệt." : "Choose approval, rejection or revocation. Pending is not a review decision.";
  if (error.code === "facility.invalidResponse") return vi ? "Dữ liệu cơ sở không hợp lệ. Chưa xác nhận thành công; làm mới để đối chiếu." : "The facility response is invalid. Success is not confirmed; refresh to reconcile.";
  if (error.code === "facility.requestPending") return vi ? "Đang xử lý một thao tác cơ sở hoặc tài liệu." : "A facility or document action is already being processed.";
  if (error.code === "uploads.alreadyUsed") return vi ? "Tệp này đang được liên kết với tài nguyên khác. Làm mới trước khi chọn tài liệu thay thế." : "This upload is linked to another resource. Refresh before selecting replacement evidence.";
  if (error.code === "uploads.invalidReference") return vi ? "Tham chiếu tệp không hợp lệ cho mục đích hoặc tài nguyên này. Không dùng URL công khai thay thế." : "The upload reference is invalid for this purpose or resource. Do not substitute a public URL.";
  if (error.code === "batch.draftOnly") return vi ? "Chỉ có thể sửa bản nháp lô cá. Làm mới để xem trạng thái." : "Only batch drafts can be edited. Refresh to read the current state.";
  if (error.code === "batch.invalidTransition") return vi ? "Trạng thái lô cá đã thay đổi hoặc không cho phép thao tác. Làm mới trước khi thử lại." : "The batch state changed or does not allow this action. Refresh before another attempt.";
  if (error.code === "batch.complianceRequired") return vi ? "Cần cơ sở có hồ sơ được kiểm soát và phê duyệt còn hiệu lực trước khi công khai." : "Publication requires current approved facility compliance with controlled documents.";
  if (error.code === "batch.invalidResponse") return vi ? "Dữ liệu lô cá không hợp lệ. Chưa xác nhận thành công; cần làm mới để đối chiếu." : "The batch response is invalid. Success is not confirmed; refresh to reconcile.";
  if (error.code === "batch.requestPending") return vi ? "Đang gửi thao tác lô cá." : "A batch action is already being submitted.";
  if (error.code === "batch.invalidBudget" || error.code === "batch.costMismatch") return vi ? "Tổng chi phí phải khớp chính xác với giá gói nhân số phần." : "Total allocated costs must exactly match package price multiplied by total shares.";
  if (error.code === "batch.expectedHarvestWeightRequired") return vi ? "Phần theo khối lượng cần khối lượng thu hoạch dự kiến của toàn lô, tính bằng gam." : "Weight shares require expected whole-batch harvest biomass in grams.";
  if (error.code === "batch.imagesRequired") return vi ? "Cần ít nhất một ảnh công khai trước khi xuất bản." : "At least one public image is required before publication.";
  if (error.code === "batch.controlledDocumentsRequired") return vi ? "Cần hồ sơ cơ sở được liên kết qua tệp được kiểm soát trước khi xuất bản." : "Publication requires facility documents linked through controlled uploads.";
  if (error.code === "batch.cancelForbidden") return vi ? "Chỉ có thể hủy lô nháp, đang chờ duyệt hoặc đang mở khi chưa có bản ghi tài trợ nào. Làm mới để đối chiếu; không hoàn tiền hoặc thanh toán." : "Only draft, pending-review or open batches with no sponsorship records can be cancelled. Refresh to reconcile; no refund or payment is performed.";
  if (error.code === "batch.updateForbidden") return vi ? "Không thể thêm cập nhật ở trạng thái lô cá hiện tại. Làm mới để đối chiếu." : "Updates cannot be added in the current batch state. Refresh to reconcile.";
  if (error.code === "batch.invalidShares") return vi ? "Kiểm tra số cá, khối lượng thu hoạch toàn lô và đơn vị phần." : "Check stock count, whole-batch harvest biomass and share units.";
  if (error.code === "batch.invalidMedia" || error.code === "batch.invalidImageUrl") return vi ? "Dùng URL ảnh công khai đúng mục đích lô cá hoặc cập nhật; tệp tin đăng không được dùng thay." : "Use public image URLs registered for the matching batch or update purpose; listing uploads are not interchangeable.";
  if (error.code === "cart.empty") return vi ? "Giỏ hàng đang trống." : "Your cart is empty.";
  if (error.code === "order.missingDepositTerms") return vi ? "Chưa có điều khoản đặt cọc. Vui lòng liên hệ công ty." : "Deposit terms are missing. Contact the company before ordering.";
  if (error.code === "order.balanceOutstanding") return vi ? "Chưa thể giao đơn đặt trước khi chưa thanh toán đủ phần còn lại." : "A pre-order cannot ship until its balance is paid in full.";
  if (error.code === "order.openDispute") return vi ? "Không thể hoàn tất đơn khi khiếu nại đang mở hoặc xét duyệt." : "This order cannot be completed while a dispute is open or being reviewed.";
  if (error.code === "order.balanceNotDue") return vi ? "Chưa đến hạn thanh toán phần còn lại hoặc trạng thái đã thay đổi." : "The balance is not currently due or the order state has changed.";
  if (error.code === "order.invalidTransition") return vi ? "Trạng thái đơn đã thay đổi hoặc không cho phép thao tác này." : "The order state has changed or does not allow this action.";
  if (error.code === "listing.incomplete") return vi ? `Cần bổ sung trước khi xuất bản hoặc gửi xét duyệt: ${error.params.field ?? "thông tin tin đăng"}.` : `Required before publication or review submission: ${error.params.field ?? "listing details"}.`;
  if (error.code === "listing.underReview") return vi ? "Không thể sửa khi đang xét duyệt. Làm mới để xem trạng thái hiện tại." : "Editing is locked while under review. Refresh to read the current state.";
  if (error.code === "listing.invalidTransition") return vi ? "Trạng thái tin đã thay đổi hoặc không cho phép thao tác này. Làm mới trước khi thử lại." : "The listing state changed or does not allow this action. Refresh before another attempt.";
  if (error.code === "listing.invalidResponse" || error.code === "activity.invalidResponse") return vi ? "Máy chủ trả dữ liệu không hợp lệ. Chưa xác nhận thành công; cần làm mới để đối chiếu." : "The server returned an invalid response. Success is not confirmed; refresh to reconcile.";
  if (error.code === "dispute.alreadyExists") return vi ? "Đơn này đã có khiếu nại. Làm mới để xem bản ghi." : "This order already has a dispute. Refresh to view it.";
  if (error.code === "dispute.orderNotEligible") return vi ? "Đơn hoặc lý do chưa đủ điều kiện khiếu nại." : "This order or reason is not eligible for a dispute.";
  if (error.code === "dispute.invalidTransition") return vi ? "Trạng thái khiếu nại đã thay đổi. Làm mới trước khi thao tác." : "The dispute state has changed. Refresh before another action.";
  if (error.status === 413) return vi ? "Tệp vượt giới hạn tải lên của máy chủ." : "The file exceeds the server upload limit.";
  if (error.status === 415) return vi ? "Loại tệp không được hỗ trợ." : "This file type is not supported.";
  if (error.code === "user.statusConflict") return vi ? "Trạng thái tài khoản đã thay đổi. Làm mới trước khi xác nhận lại." : "The account status changed. Refresh before confirming again.";
  if (error.code === "user.protectedAccount") return vi ? "Tài khoản Admin được bảo vệ; không thể đổi trạng thái tại đây." : "Admin accounts are protected; their status cannot be changed here.";
  if (error.code === "user.invalidResponse") return vi ? "Dữ liệu tài khoản không hợp lệ. Chưa xác nhận thành công; cần làm mới." : "The account response is invalid. Success is not confirmed; refresh to reconcile.";
  if (error.code === "auth.accountSuspended") return vi ? "Tài khoản đã bị tạm khóa." : "This account is suspended. Contact support.";
  if (error.code.includes("invalidCredentials")) return vi ? "Email hoặc mật khẩu không đúng." : "Incorrect email or password.";
  if (error.code.includes("emailTaken") || error.code.includes("emailExists")) return vi ? "Email đã được đăng ký." : "This email is already registered.";
  if (error.status === 404) return vi ? "Không tìm thấy dữ liệu." : "The requested record was not found.";
  if (error.status === 400) return vi ? `Kiểm tra thông tin đã nhập (${error.code}).` : `Please check your input (${error.code}).`;
  if (error.status === 401) return vi ? "Đăng nhập không hợp lệ hoặc đã hết hạn." : "Invalid credentials or expired session.";
  return vi ? `Yêu cầu thất bại (${error.code}).` : `Request failed (${error.code}).`;
}
