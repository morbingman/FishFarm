import type { CompanyListingStatus, ListingReviewFeedback, ListingReviewTab } from "./contracts";

export type ReviewAction = "approve" | "reject" | "request-changes" | "takedown";
export const reviewTabs: ListingReviewTab[] = ["pending", "approved", "changes"];
export const activityLimits = [100, 200, 300] as const;

function routeId(segment: string): string | null {
  try {
    const id = decodeURIComponent(segment);
    return id.trim() && !/[\u0000-\u001f\u007f]/.test(id) ? id : null;
  } catch { return null; }
}
export function parseListingReviewRoute(route: string): { listingId: string | null } | null {
  if (route === "admin/queue") return { listingId: null };
  const match = /^admin\/review\/([^/?#]+)$/.exec(route);
  const listingId = match ? routeId(match[1]) : null;
  return listingId ? { listingId } : null;
}
export const isListingReviewRoute = (route: string) => parseListingReviewRoute(route) !== null;
export const listingReviewRoute = (id?: string) => id === undefined ? "#admin/queue" : `#admin/review/${encodeURIComponent(id)}`;
export function reviewTabFromHash(hash: string): ListingReviewTab {
  const value = new URLSearchParams(hash.split("?")[1] ?? "").get("tab");
  return reviewTabs.includes(value as ListingReviewTab) ? value as ListingReviewTab : "pending";
}
export function matchesReviewTab(status: CompanyListingStatus, tab: ListingReviewTab) {
  return tab === "changes" ? status === "changes" || status === "rejected" : status === tab;
}
export function canReviewAction(status: CompanyListingStatus, action: ReviewAction) {
  return action === "takedown" ? status === "approved" || status === "paused" : status === "pending";
}
export class ReviewValidationError extends Error {
  constructor(public field: "reason" | "feedback" | "step") { super(field); }
}
export function reviewFeedback(reason: string, feedback: string, step = 1): ListingReviewFeedback {
  const trimmedReason = reason.trim();
  const trimmedFeedback = feedback.trim();
  if (trimmedReason.length < 1 || trimmedReason.length > 120) throw new ReviewValidationError("reason");
  if (trimmedFeedback.length < 10 || trimmedFeedback.length > 2000) throw new ReviewValidationError("feedback");
  if (!Number.isInteger(step) || step < 1 || step > 6) throw new ReviewValidationError("step");
  return { reason: trimmedReason, feedback: trimmedFeedback, step };
}
export function takedownReason(reason: string) {
  const value = reason.trim();
  if (value.length < 10 || value.length > 2000) throw new ReviewValidationError("reason");
  return value;
}

// Only mounted Admin destinations are links; document content URLs stay non-navigable.
export function safeActivityLink(link: string | null | undefined): string | null {
  if (!link || /[\u0000-\u0020\u007f]/.test(link)) return null;
  if (["#company/listings", "#company/orders", "#admin/queue", "#admin/activity", "#admin/disputes", "#admin/users"].includes(link)) return link;
  if (/^#admin\/batches\/BATCH-[1-9]\d*$/.test(link)) return link;
  if (link === "#company/batches" || /^#company\/batches\/(?:BATCH-\d+|c[a-z0-9]{24})$/.test(link)) return link;
  if (link === "#company/facilities" || link === "#admin/facilities" || /^#(?:company\/facilities\/c[a-z0-9]{24}|admin\/facilities\/c[a-z0-9]{24}(?:\/review)?)$/.test(link)) return link;
  const match = /^#(?:company\/(?:listing|orders)|admin\/(?:review|disputes|orders))\/([^/?#]+)$/.exec(link);
  return match && routeId(match[1]) ? link : null;
}
export function reviewDate(value: string | null | undefined, language: "en" | "vi") {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return `${new Date(value).toLocaleString(language === "vi" ? "vi-VN" : "en-GB", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })} UTC`;
}
export function reviewMoney(value: number, language: "en" | "vi") {
  return `${value.toLocaleString(language === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 0 })} ₫`;
}
