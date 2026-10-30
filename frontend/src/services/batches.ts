import type { BatchInput, BatchRoute, BatchShareSummary, BatchStage, BatchStatus, BatchUpdateInput, CostCategory, PublicBatchQuery } from "./batchContracts";
import { facilityTextLength } from "./facilities";

export const batchStatuses: BatchStatus[] = ["draft", "pending_review", "open", "fully_sponsored", "growing", "harvesting", "harvested", "settled", "cancelled"];
export const batchStages: BatchStage[] = ["nursery", "fingerling", "juvenile", "grow_out", "pre_harvest"];
export const costCategories: CostCategory[] = ["equipment", "feed", "labour", "health", "transport", "platform_fee", "contingency"];
export class BatchValidationError extends Error { constructor(public field: string) { super(field); } }
export const batchFields = ["title", "species", "breed", "description", "location", "region", "stockingDate", "expectedHarvestDate", "stockCount", "shareUnitType", "shareQuantity", "expectedHarvestWeightG", "packagePricePerShare", "contingencyPct", "riskDisclosure", "termsVersion", "facilityId", "images", "costs"] as const;
export const batchTextLimits = { title: [1, 120], species: [1, 80], breed: [0, 80], description: [20, 4000], location: [1, 160], region: [1, 80], riskDisclosure: [20, 4000], termsVersion: [1, 60] } as const;
export const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export const safeInteger = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
/** Reject Date.parse's permissive spellings and invalid calendar dates (e.g. February 30). */
export function validBatchDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return false;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  if (month < 1 || month > 12 || day < 1 || day > [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]) return false;
  if (value.length > 10) {
    const hour = Number(value.slice(11, 13)), minute = Number(value.slice(14, 16)), second = Number(value.slice(17, 19));
    if (hour > 23 || minute > 59 || second > 59 || (/[+-]\d{2}:\d{2}$/.test(value) && (Number(value.slice(-5, -3)) > 23 || Number(value.slice(-2)) > 59))) return false;
  }
  return Number.isFinite(Date.parse(value));
}
export function validBatchMediaUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 500 || /[\s\u0000-\u001f\u007f\\]/.test(value)) return false;
  if (/^\/uploads\/[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(value)) return true;
  if (!/^https?:\/\//i.test(value)) return false;
  try { const url = new URL(value); return !!url.hostname && !url.username && !url.password; } catch { return false; }
}
function keys(value: unknown, allowed: readonly string[], field: string): asserts value is Record<string, unknown> {
  if (!isRecord(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new BatchValidationError(field);
}
function trimmed(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string") throw new BatchValidationError(field);
  const text = value.trim();
  if (text.length < min || text.length > max) throw new BatchValidationError(field);
  return text;
}
export function normalizeBatchInput(input: BatchInput): BatchInput;
export function normalizeBatchInput(input: Partial<BatchInput>, partial: true): Partial<BatchInput>;
export function normalizeBatchInput(input: Partial<BatchInput>, partial = false): Partial<BatchInput> {
  keys(input, batchFields, "input");
  const out: Record<string, unknown> = {};
  if (!partial) for (const field of ["title", "species", "description", "location", "region", "stockCount", "shareUnitType", "shareQuantity", "packagePricePerShare", "riskDisclosure", "termsVersion", "facilityId", "costs"] as const) if (input[field] === undefined) throw new BatchValidationError(field);
  for (const field of batchFields) {
    const value = input[field];
    if (value === undefined) continue;
    if (field in batchTextLimits) {
      const [min, max] = batchTextLimits[field as keyof typeof batchTextLimits]; out[field] = trimmed(value, field, min, max);
    } else if (field === "facilityId") {
      const id = trimmed(value, field, 1, Number.MAX_SAFE_INTEGER);
      if (!validBatchIdentifier(id)) throw new BatchValidationError(field); out[field] = id;
    } else if (["stockingDate", "expectedHarvestDate"].includes(field)) {
      if (!validBatchDate(value)) throw new BatchValidationError(field); out[field] = value;
    } else if (field === "shareUnitType") {
      if (value !== "weight" && value !== "count") throw new BatchValidationError(field); out[field] = value;
    } else if (field === "images") {
      if (!Array.isArray(value) || value.length > 12) throw new BatchValidationError(field);
      out.images = value.map((image, index) => {
        keys(image, ["url", "position"], "images"); const url = trimmed(image.url, "images", 1, 500);
        if (!validBatchMediaUrl(url) || (image.position !== undefined && !safeInteger(image.position))) throw new BatchValidationError("images");
        return { url, position: image.position ?? index };
      });
    } else if (field === "costs") {
      if (!Array.isArray(value) || value.length > 30) throw new BatchValidationError(field);
      out.costs = value.map(cost => {
        keys(cost, ["category", "label", "amount", "allocation", "note"], "costs");
        if (!costCategories.includes(cost.category as CostCategory) || !safeInteger(cost.amount) || !["per_share", "batch_total"].includes(cost.allocation as string)) throw new BatchValidationError("costs");
        return { category: cost.category, label: trimmed(cost.label, "costs", 1, 120), amount: cost.amount, allocation: cost.allocation, ...(cost.note !== undefined ? { note: trimmed(cost.note, "costs", 0, 500) } : {}) };
      });
    } else {
      if (!safeInteger(value, field === "contingencyPct" ? 0 : 1, field === "contingencyPct" ? 100 : Number.MAX_SAFE_INTEGER)) throw new BatchValidationError(field); out[field] = value;
    }
  }
  if (!partial || (out.shareUnitType !== undefined && out.shareQuantity !== undefined && (out.shareUnitType === "weight" ? out.expectedHarvestWeightG !== undefined : out.stockCount !== undefined))) deriveBatchShares(out as unknown as BatchInput);
  return out as Partial<BatchInput>;
}
export function normalizeBatchUpdateInput(input: BatchUpdateInput): BatchUpdateInput {
  keys(input, ["stage", "averageWeightG", "countAlive", "note", "photoUrls"], "update");
  if (!batchStages.includes(input.stage as BatchStage)) throw new BatchValidationError("stage");
  const out: BatchUpdateInput = { stage: input.stage };
  for (const field of ["averageWeightG", "countAlive"] as const) if (input[field] !== undefined) {
    if (!safeInteger(input[field], field === "countAlive" ? 0 : 1)) throw new BatchValidationError(field); out[field] = input[field];
  }
  if (input.note !== undefined) out.note = trimmed(input.note, "note", 0, 2000);
  if (input.photoUrls !== undefined) {
    if (!Array.isArray(input.photoUrls) || input.photoUrls.length > 10) throw new BatchValidationError("photoUrls");
    out.photoUrls = input.photoUrls.map(url => { const normalized = trimmed(url, "photoUrls", 1, 500); if (!validBatchMediaUrl(normalized)) throw new BatchValidationError("photoUrls"); return normalized; });
  }
  return out;
}
export function normalizePublicBatchQuery(query: PublicBatchQuery): PublicBatchQuery {
  keys(query, ["q", "species", "region", "harvestBefore", "priceMax", "page", "limit"], "query");
  const out: PublicBatchQuery = {};
  for (const field of ["q", "species", "region"] as const) if (query[field] !== undefined) {
    if (typeof query[field] !== "string" || query[field].length > 80) throw new BatchValidationError(field); out[field] = query[field];
  }
  if (query.harvestBefore !== undefined) { if (!validBatchDate(query.harvestBefore)) throw new BatchValidationError("harvestBefore"); out.harvestBefore = query.harvestBefore; }
  for (const field of ["priceMax", "page", "limit"] as const) if (query[field] !== undefined) {
    if (!safeInteger(query[field], field === "priceMax" ? 0 : 1, field === "limit" ? 100 : Number.MAX_SAFE_INTEGER)) throw new BatchValidationError(field); out[field] = query[field];
  }
  if (!Number.isSafeInteger(((out.page ?? 1) - 1) * (out.limit ?? 20))) throw new BatchValidationError("page");
  return out;
}
export function deriveBatchShares(input: Pick<BatchInput, "shareUnitType" | "shareQuantity" | "stockCount" | "expectedHarvestWeightG">): number {
  if (!["count", "weight"].includes(input.shareUnitType) || !safeInteger(input.shareQuantity, 1)) throw new BatchValidationError("shareQuantity");
  const stock = input.shareUnitType === "weight" ? input.expectedHarvestWeightG : input.stockCount;
  if (!safeInteger(stock, 1)) throw new BatchValidationError(input.shareUnitType === "weight" ? "expectedHarvestWeightG" : "stockCount");
  const total = Number(BigInt(stock) / BigInt(input.shareQuantity));
  if (total < 1) throw new BatchValidationError("shareQuantity"); return total;
}
export function batchShareSummary(input: Pick<BatchInput, "shareUnitType" | "shareQuantity" | "stockCount" | "expectedHarvestWeightG" | "packagePricePerShare" | "costs">): BatchShareSummary {
  const totalShares = deriveBatchShares(input);
  if (!safeInteger(input.packagePricePerShare, 1) || !Array.isArray(input.costs) || input.costs.some(cost => !safeInteger(cost.amount) || !["per_share", "batch_total"].includes(cost.allocation))) throw new BatchValidationError("costs");
  const totalCost = input.costs.reduce((sum, cost) => sum + BigInt(cost.amount) * (cost.allocation === "per_share" ? BigInt(totalShares) : 1n), 0n);
  const packageTotal = BigInt(input.packagePricePerShare) * BigInt(totalShares);
  return { totalShares, shareUnit: input.shareUnitType === "weight" ? `${input.shareQuantity / 1000} kg` : `${input.shareQuantity} fish`, totalCost, packageTotal, matches: totalCost === packageTotal };
}
export function normalizeBatchCancellationNote(note: string): string {
  if (typeof note !== "string") throw new BatchValidationError("note");
  const normalized = note.trim(), length = facilityTextLength(normalized);
  if (length < 1 || length > 1000) throw new BatchValidationError("note");
  return normalized;
}
export const canEditBatch = (status: BatchStatus) => status === "draft";
/** Advisory only; the backend checks current state and sponsorships under its transaction lock. */
export function canCancelBatch(status: BatchStatus, sponsorshipCount: number): boolean {
  return ["draft", "pending_review", "open"].includes(status) && sponsorshipCount === 0;
}
export const canPostBatchUpdate = (status: BatchStatus) => batchStatuses.includes(status) && !["draft", "pending_review", "cancelled"].includes(status);
export function batchStatusLabel(status: BatchStatus, lang: "en" | "vi"): string {
  const labels: Record<BatchStatus, [string, string]> = { draft: ["Draft", "Bản nháp"], pending_review: ["Under review", "Đang xét duyệt"], open: ["Open", "Đang mở"], fully_sponsored: ["Fully sponsored", "Đã đủ bảo trợ"], growing: ["Growing", "Đang nuôi"], harvesting: ["Harvesting", "Đang thu hoạch"], harvested: ["Harvested", "Đã thu hoạch"], settled: ["Settled", "Đã quyết toán"], cancelled: ["Cancelled", "Đã hủy"] };
  return labels[status][lang === "vi" ? 1 : 0];
}
export function batchStageLabel(stage: BatchStage, lang: "en" | "vi"): string {
  const labels: Record<BatchStage, [string, string]> = { nursery: ["Nursery", "Ươm giống"], fingerling: ["Fingerling", "Cá giống"], juvenile: ["Juvenile", "Cá non"], grow_out: ["Grow-out", "Nuôi thương phẩm"], pre_harvest: ["Pre-harvest", "Trước thu hoạch"] };
  return labels[stage][lang === "vi" ? 1 : 0];
}
export const validBatchIdentifier = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_-]+$/.test(id) && !["new", "edit"].includes(id);
export function parseBatchRoute(route: string): BatchRoute | null {
  if (typeof route !== "string") return null;
  const value = route.startsWith("#") ? route.slice(1) : route;
  if (value === "farming") return { company: false, mode: "list", id: null };
  if (value === "company/batches") return { company: true, mode: "list", id: null };
  if (value === "company/batches/new") return { company: true, mode: "new", id: null };
  const recordedReview = /^admin\/batches\/(BATCH-[1-9]\d*)$/.exec(value);
  if (recordedReview && recordedReview[0] === value) return { company: true, mode: "detail", id: recordedReview[1] };
  const match = /^(farming|company\/batches)\/([^/?#]+)(\/edit)?$/.exec(value);
  if (!match || (match[3] && match[1] === "farming")) return null;
  try { const id = decodeURIComponent(match[2]); return validBatchIdentifier(id) && !(match[1] === "farming" && id === "booking") ? { company: match[1] !== "farming", mode: match[3] ? "edit" : "detail", id } : null; } catch { return null; }
}
export function batchRoute(mode: BatchRoute["mode"], id?: string, company = false): string {
  const base = company ? "#company/batches" : "#farming";
  if (mode === "list") return base;
  if (company && mode === "new") return `${base}/new`;
  if (!["detail", "edit"].includes(mode) || (!company && (mode === "edit" || id === "booking")) || !validBatchIdentifier(id)) throw new BatchValidationError("route");
  return `${base}/${encodeURIComponent(id)}${mode === "edit" ? "/edit" : ""}`;
}
