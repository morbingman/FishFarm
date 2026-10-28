import { api, ApiError } from "./api";
import { validateCompanyListing } from "./companyListingsApi";
import type { AdminActivity, CompanyListing, ListingReviewFeedback, ListingReviewTab, ReviewListing } from "./contracts";

const path = (id?: string) => `/admin/listings${id ? `/${encodeURIComponent(id)}` : ""}`;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const nullableText = (value: unknown) => value === null || typeof value === "string";
const date = (value: unknown) => text(value) && Number.isFinite(Date.parse(value));
const invalid = () => new ApiError(502, "listing.invalidResponse");
const checks = ["images", "details", "pricing", "location", "preorder"];
function detail(value: unknown): ReviewListing {
  const listing = validateCompanyListing(value);
  const values = (value as Record<string, unknown>).checks;
  if (!Array.isArray(values) || values.length !== checks.length || values.some(check => !record(check) || !checks.includes(check.key as string) || typeof check.ok !== "boolean")
    || new Set(values.map(check => check.key)).size !== checks.length) throw invalid();
  return { ...listing, checks: values } as ReviewListing;
}
async function decide(id: string, action: string, status: CompanyListing["status"], body?: ListingReviewFeedback | { reason: string }) {
  const value = validateCompanyListing(await api<unknown>(`${path(id)}/${action}`, { method: "POST", ...(body ? { body: JSON.stringify(body) } : {}) }), id);
  if (value.status !== status || (status === "approved" ? value.decision !== null : value.decision?.kind !== status)) throw invalid();
  if (body && "feedback" in body) {
    if (value.decision?.reason !== body.reason || value.decision.feedback !== body.feedback || value.decision.step !== (body.step ?? 1)) throw invalid();
  } else if (body) {
    if (value.decision?.reason !== "Policy violation" || value.decision.feedback !== body.reason || value.decision.step !== 1) throw invalid();
  }
  if (body && (!text(value.decision?.by) || !date(value.decision?.at))) throw invalid();
  return value;
}
const feedbackBody = (input: ListingReviewFeedback): ListingReviewFeedback => ({ reason: input.reason, feedback: input.feedback, ...(input.step === undefined ? {} : { step: input.step }) });
export const listingReviewApi = {
  queue: async (tab: ListingReviewTab = "pending", signal?: AbortSignal) => {
    const values = await api<unknown>(`${path()}?tab=${encodeURIComponent(tab)}`, { signal });
    if (!Array.isArray(values)) throw invalid();
    const rows = values.map(value => validateCompanyListing(value));
    if (rows.some(value => tab === "changes" ? !["changes", "rejected"].includes(value.status) : value.status !== tab)) throw invalid();
    return rows;
  },
  detail: async (id: string, signal?: AbortSignal) => detail(await api<unknown>(path(id), { signal })),
  approve: (id: string) => decide(id, "approve", "approved"),
  reject: (id: string, input: ListingReviewFeedback) => decide(id, "reject", "rejected", feedbackBody(input)),
  requestChanges: (id: string, input: ListingReviewFeedback) => decide(id, "request-changes", "changes", feedbackBody(input)),
  takedown: (id: string, input: { reason: string }) => decide(id, "takedown", "rejected", { reason: input.reason }),
};
export const activityApi = {
  list: async (limit = 100, signal?: AbortSignal): Promise<AdminActivity[]> => {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 300) throw new ApiError(400, "validation.failed");
    const values = await api<unknown>(`/admin/activity?limit=${limit}`, { signal });
    if (!Array.isArray(values) || values.length > limit || values.some(value => !record(value) || !text(value.id) || !nullableText(value.actorId)
      || !text(value.actorLabel) || !["User", "Admin", "System"].includes(value.role as string) || !text(value.action) || !nullableText(value.target)
      || !nullableText(value.link) || !date(value.createdAt)) || new Set(values.map(value => value.id)).size !== values.length) throw new ApiError(502, "activity.invalidResponse");
    return values as AdminActivity[];
  },
};
