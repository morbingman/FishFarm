import { api, apiBlob, ApiError } from "./api";
import type { Dispute, DisputeInput, DisputeStatus, EvidenceUpload } from "./contracts";
import { disputeReasons, disputeStatuses, evidenceTypes } from "./disputes";

const path = (admin: boolean, id?: string) => `${admin ? "/admin" : "/me"}/disputes${id ? `/${encodeURIComponent(id)}` : ""}`;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const date = (value: unknown) => text(value) && Number.isFinite(Date.parse(value));
const invalid = () => new ApiError(502, "dispute.invalidResponse");
function dispute(value: unknown, expected: Partial<Pick<Dispute, "id" | "status" | "reason" | "description" | "resolution">> = {}, orderId?: string): Dispute {
  if (!record(value) || !text(value.id) || !record(value.order) || !text(value.order.id)
    || !["pending_payment", "paid", "ready", "shipped", "delivered", "completed", "cancelled", "refunded"].includes(value.order.status as string)
    || !record(value.buyer) || !text(value.buyer.id) || typeof value.buyer.name !== "string" || !text(value.buyer.email)
    || !disputeReasons.includes(value.reason as Dispute["reason"]) || !text(value.description)
    || !disputeStatuses.includes(value.status as DisputeStatus) || !(value.resolution === null || text(value.resolution))
    || !date(value.createdAt) || !(value.resolvedAt === null || date(value.resolvedAt))
    || !Array.isArray(value.attachments) || value.attachments.length > 3
    || value.attachments.some(attachment => !record(attachment) || !text(attachment.id) || !(attachment.mimeType === null || text(attachment.mimeType))
      || !(attachment.sizeBytes === null || (Number.isInteger(attachment.sizeBytes) && Number(attachment.sizeBytes) > 0)) || !date(attachment.createdAt))) throw invalid();
  const result = value as Dispute;
  if (Object.entries(expected).some(([key, expectedValue]) => result[key as keyof typeof expected] !== expectedValue)
    || (orderId !== undefined && result.order.id !== orderId)
    || new Set(result.attachments.map(attachment => attachment.id)).size !== result.attachments.length
    || (["resolved", "rejected"].includes(result.status) ? !result.resolution || !result.resolvedAt : result.resolution !== null || result.resolvedAt !== null)) throw invalid();
  return result;
}
export const disputesApi = {
  list: async (admin: boolean, status: "all" | DisputeStatus = "all", signal?: AbortSignal) => {
    const values = await api<unknown>(`${path(admin)}${admin && status !== "all" ? `?status=${encodeURIComponent(status)}` : ""}`, { signal });
    if (!Array.isArray(values)) throw invalid();
    return values.map(value => dispute(value, admin && status !== "all" ? { status } : {}));
  },
  detail: async (admin: boolean, id: string, signal?: AbortSignal) => dispute(await api<unknown>(path(admin, id), { signal }), { id }),
  create: async (orderId: string, input: DisputeInput) => {
    const description = input.description.trim();
    return dispute(await api<unknown>(`/me/orders/${encodeURIComponent(orderId)}/dispute`, { method: "POST", body: JSON.stringify({ reason: input.reason, description, ...(input.uploadIds?.length ? { uploadIds: input.uploadIds } : {}) }) }), { status: "open", reason: input.reason, description }, orderId);
  },
  review: async (id: string) => dispute(await api<unknown>(`${path(true, id)}/start-review`, { method: "POST" }), { id, status: "reviewing" }),
  finish: async (id: string, action: "resolve" | "reject", resolution: string) => dispute(await api<unknown>(`${path(true, id)}/${action}`, { method: "POST", body: JSON.stringify({ resolution: resolution.trim() }) }), { id, status: action === "resolve" ? "resolved" : "rejected", resolution: resolution.trim() }),
  upload: async (file: File) => {
    const body = new FormData(); body.append("file", file); body.append("purpose", "dispute_attachment");
    const value = await api<unknown>("/uploads", { method: "POST", body });
    if (!record(value) || !text(value.id) || value.isPrivate !== true || value.purpose !== "dispute_attachment"
      || !evidenceTypes.includes(value.mimeType as string) || value.mimeType !== file.type || value.sizeBytes !== file.size || !text(value.url)) throw invalid();
    return value as EvidenceUpload;
  },
  evidence: (admin: boolean, id: string, attachmentId: string, signal?: AbortSignal) => apiBlob(`${path(admin, id)}/attachments/${encodeURIComponent(attachmentId)}/content`, signal),
};
