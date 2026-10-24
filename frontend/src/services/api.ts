const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)
    ?.trim()
    .replace(/\/+$/, "") || "/api";
let accessToken = sessionStorage.getItem("fishfarm-access-token");
let refreshPending: Promise<boolean> | null = null;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public details?: unknown,
  ) {
    super(code);
  }
}

function saveToken(token: string | null) {
  accessToken = token;
  if (token) sessionStorage.setItem("fishfarm-access-token", token);
  else sessionStorage.removeItem("fishfarm-access-token");
}

async function request(
  path: string,
  init: RequestInit = {},
  credentials: RequestCredentials = "include",
) {
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      credentials,
      signal: init.signal ?? AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ApiError(0, "network.unreachable");
  }
}

async function responseData(response: Response) {
  if (response.status === 204) return undefined;
  try {
    return await response.json();
  } catch {
    throw new ApiError(response.status, "api.invalidResponse");
  }
}

async function refresh(): Promise<boolean> {
  if (!refreshPending) {
    refreshPending = (async () => {
      const response = await request("/auth/refresh", { method: "POST" });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) saveToken(null);
        if (response.status >= 500)
          throw new ApiError(response.status, "error.internal");
        return false;
      }
      const data = await responseData(response);
      if (typeof data?.accessToken !== "string")
        throw new ApiError(response.status, "api.invalidResponse");
      saveToken(data.accessToken);
      return true;
    })().finally(() => {
      refreshPending = null;
    });
  }
  return refreshPending;
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await request(path, { ...init, headers });
  if (response.status === 401 && retry && (await refresh()))
    return api<T>(path, init, false);
  const data = await responseData(response);
  if (!response.ok)
    throw new ApiError(
      response.status,
      data?.code ?? `http.${response.status}`,
      data?.details,
    );
  return data as T;
}

// Catalogue requests never depend on a login session or trigger token refresh.
async function publicApi<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await request(
    path,
    { method: "GET", cache: "no-store", signal },
    "omit",
  );
  const data = await responseData(response);
  if (!response.ok)
    throw new ApiError(
      response.status,
      data?.code ?? `http.${response.status}`,
      data?.details,
    );
  return data as T;
}

export const authApi = {
  async login(email: string, password: string) {
    const data = await api<any>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
      false,
    );
    if (typeof data?.accessToken !== "string" || !data.user)
      throw new ApiError(200, "api.invalidResponse");
    saveToken(data.accessToken);
    return data;
  },
  async createAccount(body: unknown) {
    const data = await api<{ created: true; email: string }>(
      "/auth/register-account",
      { method: "POST", body: JSON.stringify(body) },
      false,
    );
    if (data?.created !== true || typeof data.email !== "string")
      throw new ApiError(200, "api.invalidResponse");
    return data;
  },
  async register(body: unknown) {
    const data = await api<any>(
      "/auth/register",
      { method: "POST", body: JSON.stringify(body) },
      false,
    );
    saveToken(data.accessToken);
    return data;
  },
  async logout() {
    try {
      await api<void>("/auth/logout", { method: "POST" }, false);
    } finally {
      saveToken(null);
    }
  },
  verifyEmail(email: string, code?: string) {
    return api<any>(
      "/auth/verify-email",
      { method: "POST", body: JSON.stringify({ email, code }) },
      false,
    );
  },
  forgotPassword(email: string) {
    return api<any>(
      "/auth/forgot-password",
      { method: "POST", body: JSON.stringify({ email }) },
      false,
    );
  },
  resetPassword(email: string, code: string, password: string) {
    return api<void>(
      "/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({ email, code, newPassword: password }),
      },
      false,
    );
  },
};

export const domainApi = {
  home: (signal?: AbortSignal) =>
    publicApi<import("@/data/homeData").HomeData>("/marketplace/home", signal),
  listings: (params = "", signal?: AbortSignal) =>
    publicApi<any>(
      `/marketplace/listings${params ? `?${params}` : ""}`,
      signal,
    ),
  listing: (code: string, signal?: AbortSignal) =>
    publicApi<any>(`/marketplace/listings/${encodeURIComponent(code)}`, signal),
  favorites: () => api<any[]>("/me/favorites"),
  addFavorite: (id: string) => api(`/me/favorites/${id}`, { method: "POST" }),
  removeFavorite: (id: string) =>
    api(`/me/favorites/${id}`, { method: "DELETE" }),
  cart: () => api<any[]>("/me/cart"),
  putCart: (id: string, quantity = 1) =>
    api(`/me/cart/${id}`, {
      method: "PUT",
      body: JSON.stringify({ quantity }),
    }),
  removeCart: (id: string) => api(`/me/cart/${id}`, { method: "DELETE" }),
  createOrder: (body: unknown) =>
    api<any>("/orders", { method: "POST", body: JSON.stringify(body) }),
  payOrder: (id: string, body: unknown) =>
    api<any>(`/orders/${id}/pay`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  orders: () => api<any[]>("/me/orders"),
  reviewOrder: (id: string, body: unknown) =>
    api(`/orders/${id}/review`, { method: "POST", body: JSON.stringify(body) }),
  disputeOrder: (id: string, body: unknown) =>
    api(`/orders/${id}/dispute`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  confirmDelivery: (id: string) =>
    api(`/orders/${id}/confirm-delivery`, { method: "POST" }),
  startConversation: (listingId: string) =>
    api<any>("/me/conversations", {
      method: "POST",
      body: JSON.stringify({ listingId }),
    }),
  sendMessage: (id: string, body: string) =>
    api(`/conversations/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  notifications: () => api<any[]>("/me/notifications"),
  batches: () => api<any[]>("/batches"),
  adminBatches: () => api<any[]>("/admin/batches"),
  createBatch: (body: unknown) =>
    api<any>("/admin/batches", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  adminSponsorships: () => api<any[]>("/admin/sponsorships"),
  updateSponsorshipStatus: (id: string, status: string) =>
    api<any>(`/admin/sponsorships/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  sponsorships: () => api<any[]>("/me/sponsorships"),
  sponsor: (code: string, body: unknown) =>
    api<any>(`/batches/${code}/sponsor`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  paySponsorship: (id: string, body: unknown) =>
    api<any>(`/sponsorships/${id}/pay`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  async uploadImage(
    file: File,
    purpose:
      | "listing_image"
      | "dispute_attachment"
      | "batch_update"
      | "profile_avatar",
  ) {
    const signed = await api<any>("/uploads/signature", {
      method: "POST",
      body: JSON.stringify({ purpose }),
    });
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", signed.apiKey);
    form.append("timestamp", String(signed.timestamp));
    form.append("folder", signed.folder);
    form.append("signature", signed.signature);
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/image/upload`,
      { method: "POST", body: form },
    );
    const uploaded = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(
        response.status,
        uploaded.error?.message ?? "upload.cloudinaryFailed",
      );
    }
    return api<{ id: string; url: string }>("/uploads/complete", {
      method: "POST",
      body: JSON.stringify({
        purpose,
        secureUrl: uploaded.secure_url,
        publicId: uploaded.public_id,
        bytes: uploaded.bytes,
        format: uploaded.format,
        width: uploaded.width,
        height: uploaded.height,
      }),
    });
  },
};
