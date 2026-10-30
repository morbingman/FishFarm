import { api, ApiError, apiSessionStamp, isApiSession, publicApi } from "./api";
import type { BatchBase, BatchCost, BatchDocumentSummary, BatchFacility, BatchImage, BatchInput, BatchPage, BatchStage, BatchStatus, BatchUpdateInput, BatchVerification, CompanyBatch, PublicBatch, PublicBatchQuery, RecordedBatchUpdate } from "./batchContracts";
import { batchFields, batchShareSummary, batchStages, batchStatuses, batchTextLimits, costCategories, deriveBatchShares, isRecord, normalizeBatchCancellationNote, normalizeBatchInput, normalizeBatchUpdateInput, normalizePublicBatchQuery, safeInteger, validBatchDate, validBatchIdentifier, validBatchMediaUrl, BatchValidationError } from "./batches";
import { facilityTextLength } from "./facilities";

function fail(): never { throw new ApiError(502, "batch.invalidResponse"); }
const text = (v: unknown, min = 1, max = Number.MAX_SAFE_INTEGER): v is string => typeof v === "string" && v.trim().length >= min && v.length <= max;
const nullableText = (v: unknown, max = Number.MAX_SAFE_INTEGER) => v === null || text(v, 0, max);
const date = (v: unknown): v is string => validBatchDate(v) && v.length > 10;
const nullableDate = (v: unknown) => v === null || date(v);
const nullableInteger = (v: unknown, min = 0) => v === null || safeInteger(v, min);
const canonical = (v: unknown): v is string => typeof v === "string" && /^BATCH-[1-9]\d*$/.test(v);
function object(v: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!isRecord(v) || Object.keys(v).some(key => !allowed.includes(key))) return fail(); return v;
}
function array(v: unknown, max = Number.MAX_SAFE_INTEGER): unknown[] { if (!Array.isArray(v) || v.length > max) return fail(); return v; }
function unique<T extends { id: string }>(values: T[]): T[] { if (new Set(values.map(v => v.id)).size !== values.length) fail(); return values; }
function immutableId<T extends { id: string }>(v: T): T { Object.defineProperty(v, "id", { writable: false, configurable: false }); return v; }
const baseKeys = ["id", "title", "species", "breed", "description", "location", "region", "status", "stockingDate", "expectedHarvestDate", "stockCount", "shareUnitType", "shareUnit", "shareQuantity", "expectedHarvestWeightG", "totalShares", "sharesAvailable", "packagePricePerShare", "contingencyPct", "riskDisclosure", "termsVersion", "images", "costs", "updates", "createdAt", "updatedAt"];
const companyKeys = ["farmVerified", "inspectedAt", "inspector", "createdBy", "facility", "reviewedAt", "reviewedBy", "reviewNote", "submittedAt", "cancelledAt", "cancelReason", "sponsorshipCount"];
const verificationKeys = ["id", "level", "status", "inspectedAt", "inspector", "validUntil", "documents"];
function image(value: unknown, company: boolean): BatchImage {
  const v = object(value, ["id", "url", "position", "isMain", ...(company ? ["batchId", "createdAt"] : [])]);
  if (!validBatchIdentifier(v.id) || !validBatchMediaUrl(v.url) || !safeInteger(v.position) || typeof v.isMain !== "boolean" || (company && (!validBatchIdentifier(v.batchId) || !date(v.createdAt)))) fail();
  return immutableId(v as unknown as BatchImage);
}
function cost(value: unknown, company: boolean): BatchCost {
  const v = object(value, ["category", "label", "amount", "allocation", "note", ...(company ? ["id", "batchId"] : [])]);
  if (!costCategories.includes(v.category as BatchCost["category"]) || !text(v.label, 1, 120) || !safeInteger(v.amount) || !["per_share", "batch_total"].includes(v.allocation as string) || !nullableText(v.note, 500) || (company && (!validBatchIdentifier(v.id) || !validBatchIdentifier(v.batchId)))) fail();
  if (company) immutableId(v as { id: string }); return v as unknown as BatchCost;
}
export function validateRecordedBatchUpdate(value: unknown): RecordedBatchUpdate {
  const v = object(value, ["id", "stage", "averageWeightG", "countAlive", "note", "photos", "createdBy", "createdAt"]);
  if (!validBatchIdentifier(v.id) || !batchStages.includes(v.stage as BatchStage) || !nullableInteger(v.averageWeightG, 1) || !nullableInteger(v.countAlive) || !nullableText(v.note, 2000) || !text(v.createdBy) || !date(v.createdAt)) fail();
  v.photos = unique(array(v.photos, 10).map(value => {
    const p = object(value, ["id", "url"]); if (!validBatchIdentifier(p.id) || !validBatchMediaUrl(p.url)) fail(); return immutableId(p as { id: string; url: string });
  }));
  return immutableId(v as unknown as RecordedBatchUpdate);
}
function document(value: unknown, directory: boolean): BatchDocumentSummary {
  const v = object(value, ["id", "type", "controlled", ...(directory ? ["mimeType", "sizeBytes", "uploadedAt"] : [])]);
  if (!validBatchIdentifier(v.id) || !text(v.type) || typeof v.controlled !== "boolean" || (directory && (!(v.mimeType === null || text(v.mimeType)) || !nullableInteger(v.sizeBytes) || !date(v.uploadedAt)))) fail();
  return immutableId(v as unknown as BatchDocumentSummary);
}
function verification(value: unknown, directory: boolean): BatchVerification | null {
  if (value === null) return null;
  const v = object(value, [...verificationKeys, ...(directory ? ["notes", "submittedAt", "reviewedAt", "reviewedBy"] : [])]);
  if (!validBatchIdentifier(v.id) || !["none", "registered", "inspected"].includes(v.level as string) || !["pending", "approved", "rejected", "revoked"].includes(v.status as string) || !nullableDate(v.inspectedAt) || !nullableText(v.inspector) || !nullableDate(v.validUntil) || (directory && (!nullableText(v.notes) || !nullableDate(v.submittedAt) || !nullableDate(v.reviewedAt) || !nullableText(v.reviewedBy)))) fail();
  v.documents = unique(array(v.documents).map(d => document(d, directory)));
  return immutableId(v as unknown as BatchVerification);
}
function base(value: unknown, company: boolean, id?: string): BatchBase {
  const v = object(value, [...baseKeys, ...(company ? companyKeys : ["compliance", "facility"])]);
  if (!canonical(v.id) || (id && canonical(id) && v.id !== id) || !batchStatuses.includes(v.status as BatchStatus) || !date(v.createdAt) || !date(v.updatedAt) || !nullableText(v.breed, 80) || !nullableDate(v.stockingDate) || !nullableDate(v.expectedHarvestDate) || !safeInteger(v.stockCount, 1) || !["weight", "count"].includes(v.shareUnitType as string) || !text(v.shareUnit) || !nullableInteger(v.shareQuantity, 1) || !nullableInteger(v.expectedHarvestWeightG, 1) || !safeInteger(v.totalShares, 1) || !safeInteger(v.sharesAvailable) || v.sharesAvailable > v.totalShares || !safeInteger(v.packagePricePerShare, 1) || !safeInteger(v.contingencyPct, 0, 100)) fail();
  for (const [field, [min, max]] of Object.entries(batchTextLimits)) if (field !== "breed" && !text(v[field], min, max)) fail();
  v.images = unique(array(v.images, 12).map(value => image(value, company)));
  v.costs = array(v.costs, 30).map(value => cost(value, company));
  v.updates = unique(array(v.updates).map(validateRecordedBatchUpdate));
  const images = v.images as BatchImage[];
  if (images.some((img, i) => i > 0 && img.position < images[i - 1].position) || (images.length > 0 && images.filter(img => img.isMain).length !== 1)) fail();
  if (company) {
    unique(v.costs as { id: string }[]);
    const parents = [...images, ...(v.costs as BatchCost[])].map(row => (row as unknown as { batchId: string }).batchId);
    // Internal batchId is deliberately NOT compared with the public BATCH code.
    if (new Set(parents).size > 1 || (id && !canonical(id) && parents.some(parent => parent !== id))) fail();
  }
  if (v.shareQuantity !== null) {
    try {
      if (deriveBatchShares(v as unknown as BatchInput) !== v.totalShares || v.shareUnit !== (v.shareUnitType === "weight" ? `${(v.shareQuantity as number) / 1000} kg` : `${v.shareQuantity} fish`)) fail();
    } catch { fail(); }
  }
  return immutableId(v as unknown as BatchBase);
}
export function validatePublicBatch(value: unknown, id?: string): PublicBatch {
  const v = base(value, false, id) as PublicBatch;
  const compliance = object(v.compliance, ["level", "inspectedAt", "validUntil"]);
  const facility = object(v.facility, ["id", "name", "location"]);
  if (v.status !== "open" || v.sharesAvailable < 1 || v.shareQuantity === null || !v.images.length || !["registered", "inspected"].includes(compliance.level as string) || !nullableDate(compliance.inspectedAt) || !date(compliance.validUntil) || !validBatchIdentifier(facility.id) || !text(facility.name) || !text(facility.location)) fail();
  // Availability/compliance expiry is authoritative on the server, not this browser's clock.
  try { if (!batchShareSummary(v as unknown as BatchInput).matches) fail(); } catch { fail(); }
  immutableId(facility as { id: string }); return v;
}
export function validateCompanyBatch(value: unknown, id?: string): CompanyBatch {
  const v = base(value, true, id) as CompanyBatch;
  if (typeof v.farmVerified !== "boolean" || !nullableDate(v.inspectedAt) || !nullableText(v.inspector) || !nullableDate(v.reviewedAt) || !nullableText(v.reviewedBy) || !(v.reviewNote === null || (typeof v.reviewNote === "string" && facilityTextLength(v.reviewNote) <= 1000)) || !nullableDate(v.submittedAt) || !nullableDate(v.cancelledAt) || !(v.cancelReason === null || (typeof v.cancelReason === "string" && facilityTextLength(v.cancelReason) <= 1000)) || !safeInteger(v.sponsorshipCount)) fail();
  if (v.createdBy !== null) {
    const creator = object(v.createdBy, ["id", "name", "email"]); if (!validBatchIdentifier(creator.id) || !text(creator.name) || !text(creator.email)) fail(); immutableId(creator as { id: string });
  }
  if (v.facility !== null) {
    const f = object(v.facility, ["id", "name", "location", "verification"]); if (!validBatchIdentifier(f.id) || !text(f.name) || !text(f.location)) fail();
    f.verification = verification(f.verification, false); immutableId(f as { id: string });
  }
  return v;
}
export function validateBatchFacility(value: unknown): BatchFacility {
  const v = object(value, ["id", "name", "location", "region", "verification", "batchCount", "createdAt", "updatedAt"]);
  if (!validBatchIdentifier(v.id) || !text(v.name) || !text(v.location) || !nullableText(v.region) || !safeInteger(v.batchCount) || !date(v.createdAt) || !date(v.updatedAt)) fail();
  v.verification = verification(v.verification, true); return immutableId(v as unknown as BatchFacility);
}
function requestedId(id: string): string { if (!validBatchIdentifier(id)) throw new BatchValidationError("id"); return encodeURIComponent(id); }
const companyPath = (id?: string) => `/company/batches${id === undefined ? "" : `/${requestedId(id)}`}`;
function saved(v: CompanyBatch, input: Partial<BatchInput>): CompanyBatch {
  if (v.status !== "draft" || v.sharesAvailable !== v.totalShares) fail();
  for (const field of batchFields) {
    const expected = input[field]; if (expected === undefined) continue;
    if (field === "facilityId") { if (v.facility?.id !== expected) fail(); }
    else if (field === "expectedHarvestWeightG" && v.shareUnitType === "count") { if (v.expectedHarvestWeightG !== null) fail(); }
    else if (field === "stockingDate" || field === "expectedHarvestDate") { if (Date.parse(v[field] ?? "") !== Date.parse(expected as string)) fail(); }
    else if (field === "images") {
      const serialize = (img: Pick<BatchImage, "url" | "position" | "isMain">) => JSON.stringify([img.url, img.position, img.isMain]);
      // Position ties have no backend ordering guarantee; preserve all tuple multiplicities and the submitted cover.
      const images = input.images!.map((img, i) => serialize({ url: img.url, position: img.position ?? i, isMain: i === 0 })).sort();
      if (JSON.stringify(v.images.map(serialize).sort()) !== JSON.stringify(images)) fail();
    } else if (field === "costs") {
      const serialize = (c: BatchCost | BatchInput["costs"][number]) => JSON.stringify({ category: c.category, label: c.label, amount: c.amount, allocation: c.allocation, note: c.note ?? null });
      // Backend sorts generated cost IDs, not submission order. Compare the complete multiset.
      if (JSON.stringify(v.costs.map(serialize).sort()) !== JSON.stringify(input.costs!.map(serialize).sort())) fail();
    } else if (v[field as keyof CompanyBatch] !== expected) fail();
  }
  return v;
}
let pendingMutation = false;
async function mutation<T>(action: () => Promise<T>): Promise<T> {
  if (pendingMutation) throw new ApiError(409, "batch.requestPending");
  pendingMutation = true; try { return await action(); } finally { pendingMutation = false; }
}
export const batchesApi = {
  list: async (query: PublicBatchQuery, signal?: AbortSignal): Promise<BatchPage> => {
    const q = normalizePublicBatchQuery(query), params = new URLSearchParams();
    for (const [key, value] of Object.entries(q)) params.set(key, String(value));
    const v = object(await publicApi<unknown>(`/batches${params.size ? `?${params}` : ""}`, signal), ["items", "page", "limit", "total", "pages"]);
    if (!safeInteger(v.page, 1) || !safeInteger(v.limit, 1, 100) || !safeInteger(v.total) || !safeInteger(v.pages) || v.page !== (q.page ?? 1) || v.limit !== (q.limit ?? 20) || v.pages !== Math.ceil(v.total / v.limit)) fail();
    const rows = unique(array(v.items, v.limit).map(value => validatePublicBatch(value)));
    const offset = (v.page - 1) * v.limit;
    if (rows.length !== Math.max(0, Math.min(v.limit, v.total - offset))) fail();
    for (const row of rows) {
      if ((q.species && row.species.toLowerCase() !== q.species.toLowerCase()) || (q.region && row.region.toLowerCase() !== q.region.toLowerCase()) || (q.priceMax !== undefined && row.packagePricePerShare > q.priceMax) || (q.harvestBefore && (row.expectedHarvestDate === null || Date.parse(row.expectedHarvestDate) > Date.parse(q.harvestBefore))) || (q.q && ![row.title, row.species, row.description].some(text => text.toLowerCase().includes(q.q!.toLowerCase())))) fail();
    }
    return { items: rows, page: v.page, limit: v.limit, total: v.total, pages: v.pages };
  },
  detail: async (id: string, signal?: AbortSignal) => validatePublicBatch(await publicApi<unknown>(`/batches/${requestedId(id)}`, signal), id),
  updates: async (id: string, signal?: AbortSignal) => unique(array(await publicApi<unknown>(`/batches/${requestedId(id)}/updates`, signal)).map(validateRecordedBatchUpdate)),
  companyList: async (status?: BatchStatus, signal?: AbortSignal) => {
    if (status !== undefined && !batchStatuses.includes(status)) throw new BatchValidationError("status");
    const rows = unique(array(await api<unknown>(`${companyPath()}${status ? `?status=${encodeURIComponent(status)}` : ""}`, { signal })).map(value => validateCompanyBatch(value)));
    if (status && rows.some(row => row.status !== status)) fail(); return rows;
  },
  companyDetail: async (id: string, signal?: AbortSignal) => validateCompanyBatch(await api<unknown>(companyPath(id), { signal }), id),
  facilities: async (signal?: AbortSignal) => unique(array(await api<unknown>("/company/facilities", { signal })).map(validateBatchFacility)),
  create: (input: BatchInput) => mutation(async () => {
    const normalized = normalizeBatchInput(input);
    const value = saved(validateCompanyBatch(await api<unknown>(companyPath(), { method: "POST", body: JSON.stringify(normalized) }, false)), normalized);
    if (normalized.contingencyPct === undefined && value.contingencyPct !== 10) fail();
    if (normalized.images === undefined && value.images.length) fail(); return value;
  }),
  save: (id: string, input: Partial<BatchInput>) => mutation(async () => {
    const normalized = normalizeBatchInput(input, true);
    return saved(validateCompanyBatch(await api<unknown>(companyPath(id), { method: "PATCH", body: JSON.stringify(normalized) }, false), id), normalized);
  }),
  publish: (id: string) => mutation(async () => {
    const value = validateCompanyBatch(await api<unknown>(`${companyPath(id)}/publish`, { method: "POST" }, false), id);
    const verification = value.facility?.verification;
    if (value.status !== "open" || value.sharesAvailable !== value.totalShares || value.shareQuantity === null || !value.images.length || !value.farmVerified || value.submittedAt === null || value.reviewedAt === null || !verification || verification.status !== "approved" || verification.level === "none" || verification.validUntil === null || !verification.documents.length || verification.documents.some(d => !d.controlled)) fail();
    try { if (!batchShareSummary(value as unknown as BatchInput).matches) fail(); } catch { fail(); } return value;
  }),
  cancel: (id: string, note: string): Promise<CompanyBatch> => mutation(async () => {
    const normalized = normalizeBatchCancellationNote(note), path = `/admin/batches/${requestedId(id)}/cancel`, stamp = apiSessionStamp();
    const response = await api<unknown>(path, { method: "POST", body: JSON.stringify({ note: normalized }) }, false);
    if (stamp !== null ? !isApiSession(stamp) : apiSessionStamp() !== null) throw new ApiError(401, "auth.sessionChanged");
    const value = validateCompanyBatch(response, id);
    if (value.status !== "cancelled" || value.cancelledAt === null || value.cancelReason !== normalized || value.sponsorshipCount !== 0) fail();
    return value;
  }),
  addUpdate: (id: string, input: BatchUpdateInput) => mutation(async () => {
    const normalized = normalizeBatchUpdateInput(input);
    const value = validateRecordedBatchUpdate(await api<unknown>(`${companyPath(id)}/updates`, { method: "POST", body: JSON.stringify(normalized) }, false));
    if (value.stage !== normalized.stage) fail();
    for (const field of ["averageWeightG", "countAlive", "note"] as const) if (normalized[field] !== undefined && value[field] !== normalized[field]) fail();
    if (JSON.stringify(value.photos.map(p => p.url).sort()) !== JSON.stringify([...(normalized.photoUrls ?? [])].sort())) fail(); return value;
  }),
};
