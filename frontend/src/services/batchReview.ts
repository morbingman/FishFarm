import type { BatchStatus, CompanyBatch } from "./batchContracts";
import { BatchValidationError, normalizeBatchCancellationNote } from "./batches";

export type BatchReviewAction = "approve" | "reject";
export function parseBatchReviewRoute(route: string): { batchId: string | null } | null {
  const value = route.startsWith("#") ? route.slice(1) : route;
  if (value === "admin/batches") return { batchId: null };
  const match = /^admin\/batches\/(BATCH-[1-9]\d*)\/review$/.exec(value);
  return match && match[0] === value ? { batchId: match[1] } : null;
}
export function batchReviewRoute(id?: string): string {
  if (id === undefined) return "#admin/batches";
  if (!/^BATCH-[1-9]\d*$/.test(id) || /[\s\u0000-\u001f\u007f]/.test(id)) throw new BatchValidationError("id");
  return `#admin/batches/${id}/review`;
}
export const normalizeBatchReviewNote = normalizeBatchCancellationNote;
export const canReviewBatch = (status: BatchStatus) => status === "pending_review";

// Collection ordering has no tie-order guarantee; compare saved content, not array order.
export function retainedBatchObservations(before: CompanyBatch, after: CompanyBatch): boolean {
  const signature = (entry: CompanyBatch["updates"][number]) => JSON.stringify({ ...entry, photos: [...entry.photos].sort((a, b) => a.id.localeCompare(b.id)) });
  return before.updates.every(entry => after.updates.some(saved => signature(saved) === signature(entry)));
}
export function reconciledBatchDecision(ack: CompanyBatch, saved: CompanyBatch): boolean {
  return ack.id === saved.id && ack.status === saved.status && ack.submittedAt === saved.submittedAt
    && ack.reviewedAt === saved.reviewedAt && ack.reviewedBy === saved.reviewedBy && ack.reviewNote === saved.reviewNote
    && retainedBatchObservations(ack, saved);
}
