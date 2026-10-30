import type { Dispute, DisputeReason, DisputeStatus, OrderStatus } from "./contracts";
import type { SponsorshipStatus } from "./sponsorshipContracts";

export const disputeReasons: DisputeReason[] = ["fish_unwell", "not_as_described", "damaged_packaging", "not_received", "other"];
export const disputeStatuses: DisputeStatus[] = ["open", "reviewing", "resolved", "rejected"];
export const reasonsForOrder = (status: OrderStatus) => status === "shipped" ? ["not_received" as const] : ["delivered", "completed"].includes(status) ? disputeReasons : [];
// §11: unpaid or funded records use the cancellation/refund flow instead;
// cancelled or refunded records cannot be disputed.
export const sponsorshipDisputeStatuses: SponsorshipStatus[] = ["growing", "ready_for_delivery", "delivered", "settled"];
export const sponsorshipDisputeEligible = (status: SponsorshipStatus) => sponsorshipDisputeStatuses.includes(status);
export const disputeSubject = (dispute: Pick<Dispute, "kind" | "order" | "sponsorship">) =>
  dispute.kind === "sponsorship" && dispute.sponsorship
    ? { code: dispute.sponsorship.batch.code, title: dispute.sponsorship.batch.title, kind: "sponsorship" as const }
    : dispute.order
      ? { code: dispute.order.id, title: "", kind: "order" as const }
      : null;
export const disputeLink = (admin: boolean, id?: string) => `#${admin ? "admin" : "marketplace"}/disputes${id ? `/${encodeURIComponent(id)}` : ""}`;
export function isDisputeRoute(route: string) {
  return /^(marketplace|admin)\/disputes(?:\/[^/]+)?$/.test(route) || /^marketplace\/orders\/[^/]+\/dispute$/.test(route);
}
export function disputeLabel(value: DisputeReason | DisputeStatus, language: "en" | "vi") {
  const labels: Record<DisputeReason | DisputeStatus, [string, string]> = {
    fish_unwell: ["Fish arrived unwell", "Cá đến không khỏe"], not_as_described: ["Not as described", "Không đúng mô tả"],
    damaged_packaging: ["Damaged packaging", "Bao bì hư hỏng"], not_received: ["Order not received", "Chưa nhận đơn"], other: ["Other issue", "Vấn đề khác"],
    open: ["Open", "Đang mở"], reviewing: ["Being reviewed", "Đang xét duyệt"], resolved: ["Resolved", "Đã giải quyết"], rejected: ["Rejected", "Đã từ chối"],
  };
  return labels[value][language === "vi" ? 1 : 0];
}
export const evidenceTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
export function validateEvidence(files: File[], existing: number) {
  if (files.length + existing > 3 || files.some(file => !evidenceTypes.includes(file.type) || file.size <= 0 || file.size > 10 * 1024 * 1024)) throw new Error("Use at most three JPEG, PNG, WebP, GIF or PDF files, up to 10 MiB each.");
}
