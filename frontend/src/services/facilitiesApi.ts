import { api, apiBlob, ApiError, apiSessionStamp, isApiSession } from "./api";
import type { Facility, FacilityDecision, FacilityDocument, FacilityInput, FarmDocumentUpload, Verification, VerificationInput, VerificationLevel, VerificationStatus } from "./facilityContracts";
import { facilityDocumentMimeTypes, facilityInteger, facilityLevels, facilityTextLength, isFacilityRecord, normalizeFacilityDecision, normalizeFacilityInput, normalizeVerificationInput, validFacilityDate, validFacilityIdentifier, validateFacilityDocument, verificationStatuses, FacilityValidationError } from "./facilities";

function fail(): never { throw new ApiError(502, "facility.invalidResponse"); }
const text = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is string => typeof value === "string" && facilityTextLength(value.trim()) >= min && facilityTextLength(value) <= max;
const nullableText = (value: unknown, max = Number.MAX_SAFE_INTEGER) => value === null || text(value, 0, max);
const nullableDate = (value: unknown) => value === null || validFacilityDate(value);
const mime = (value: unknown): value is string => (facilityDocumentMimeTypes as readonly unknown[]).includes(value);
function object(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!isFacilityRecord(value) || Object.keys(value).length !== fields.length || fields.some(field => !Object.prototype.hasOwnProperty.call(value, field))) return fail();
  return { ...value };
}
function rows(value: unknown): unknown[] { if (!Array.isArray(value)) return fail(); return value; }
function unique<T extends { id: string }>(value: T[]): T[] {
  if (new Set(value.map(row => row.id)).size !== value.length) fail();
  return value;
}
function immutableId<T extends { id: string }>(value: T): T {
  Object.defineProperty(value, "id", { writable: false, configurable: false });
  return value;
}
function documentProjection(value: unknown): FacilityDocument {
  const v = object(value, ["id", "type", "controlled", "mimeType", "sizeBytes", "uploadedAt"]);
  if (!validFacilityIdentifier(v.id) || !text(v.type, 1, 80) || typeof v.controlled !== "boolean" || !(v.mimeType === null || mime(v.mimeType)) || !(v.sizeBytes === null || facilityInteger(v.sizeBytes, 1)) || !validFacilityDate(v.uploadedAt)) fail();
  return immutableId(v as unknown as FacilityDocument);
}
export function validateVerification(value: unknown): Verification {
  const v = object(value, ["id", "level", "status", "inspectedAt", "inspector", "notes", "validUntil", "submittedAt", "reviewedAt", "reviewedBy", "documents"]);
  if (!validFacilityIdentifier(v.id) || !facilityLevels.includes(v.level as VerificationLevel) || !verificationStatuses.includes(v.status as VerificationStatus) || !nullableDate(v.inspectedAt) || !nullableDate(v.validUntil) || !nullableDate(v.submittedAt) || !nullableDate(v.reviewedAt) || !nullableText(v.inspector, 120) || !nullableText(v.notes, 2000) || !nullableText(v.reviewedBy)) fail();
  v.documents = unique(rows(v.documents).map(documentProjection));
  return immutableId(v as unknown as Verification);
}
export function validateFacility(value: unknown, id?: string): Facility {
  const v = object(value, ["id", "name", "location", "region", "verification", "batchCount", "createdAt", "updatedAt"]);
  if (!validFacilityIdentifier(v.id) || (id !== undefined && v.id !== id) || !text(v.name, 1, 120) || !text(v.location, 1, 200) || !nullableText(v.region, 80) || !facilityInteger(v.batchCount) || !validFacilityDate(v.createdAt) || !validFacilityDate(v.updatedAt)) fail();
  v.verification = v.verification === null ? null : validateVerification(v.verification);
  return immutableId(v as unknown as Facility);
}
function requestedId(id: string): string {
  if (!validFacilityIdentifier(id)) throw new FacilityValidationError("id");
  return encodeURIComponent(id);
}
function path(id?: string, admin = false): string {
  if (typeof admin !== "boolean") throw new FacilityValidationError("admin");
  return `/${admin ? "admin" : "company"}/facilities${id === undefined ? "" : `/${requestedId(id)}`}`;
}
function sessionGuard(stamp: ReturnType<typeof apiSessionStamp>): void {
  if (stamp !== null ? !isApiSession(stamp) : apiSessionStamp() !== null) throw new ApiError(401, "auth.sessionChanged");
}
function sameDate(actual: string | null, expected: string | null): boolean {
  return actual === null || expected === null ? actual === expected : Date.parse(actual) === Date.parse(expected);
}
const sortedTypes = (documents: { type: string }[]) => JSON.stringify(documents.map(document => document.type).sort());
function submitted(value: Verification, input: VerificationInput, previous: Verification | null): Verification {
  if ((previous && value.id !== previous.id) || value.level !== input.level || value.status !== "pending" || value.submittedAt === null || value.reviewedAt !== null || value.reviewedBy !== null || !sameDate(value.inspectedAt, input.inspectedAt ?? null) || !sameDate(value.validUntil, input.validUntil ?? null) || value.inspector !== (input.inspector ?? previous?.inspector ?? null) || value.notes !== (input.notes ?? previous?.notes ?? null)) fail();
  const oldIds = new Set(previous?.documents.map(document => document.id));
  // The response deliberately has no uploadId: acknowledge the complete type multiset,
  // controlled metadata and recreated resource IDs, not a fabricated upload-ID mapping.
  if (sortedTypes(value.documents) !== sortedTypes(input.documents) || value.documents.some(document => oldIds.has(document.id) || !document.controlled || !mime(document.mimeType) || !facilityInteger(document.sizeBytes, 1))) fail();
  return value;
}
function inspected(value: Verification, input: FacilityDecision, previous: Verification): Verification {
  if (value.id !== previous.id || value.status !== input.status || value.level !== (input.level ?? previous.level) || value.reviewedAt === null || !text(value.reviewedBy, 1) || !sameDate(value.submittedAt, previous.submittedAt) || !sameDate(value.inspectedAt, input.inspectedAt ?? previous.inspectedAt) || !sameDate(value.validUntil, input.validUntil ?? previous.validUntil) || value.inspector !== (input.inspector ?? previous.inspector) || value.notes !== (input.notes ?? previous.notes)) fail();
  const serialize = (document: FacilityDocument) => JSON.stringify([document.id, document.type, document.controlled, document.mimeType, document.sizeBytes, Date.parse(document.uploadedAt)]);
  if (JSON.stringify(value.documents.map(serialize).sort()) !== JSON.stringify(previous.documents.map(serialize).sort())) fail();
  if (input.status === "approved" && (value.level === "none" || !value.documents.length || value.documents.some(document => !document.controlled))) fail();
  return value;
}
let pendingMutation = false;
async function mutation<T>(action: () => Promise<T>): Promise<T> {
  if (pendingMutation) throw new ApiError(409, "facility.requestPending");
  pendingMutation = true;
  try { return await action(); } finally { pendingMutation = false; }
}
export const facilitiesApi = {
  list: async (signal?: AbortSignal): Promise<Facility[]> => unique(rows(await api<unknown>(path(), { signal })).map(value => validateFacility(value))),
  detail: async (id: string, signal?: AbortSignal): Promise<Facility> => validateFacility(await api<unknown>(path(id), { signal }), id),
  create: (input: FacilityInput): Promise<Facility> => mutation(async () => {
    const normalized = normalizeFacilityInput(input);
    const value = validateFacility(await api<unknown>(path(), { method: "POST", body: JSON.stringify(normalized) }, false));
    if (value.name !== normalized.name || value.location !== normalized.location || value.region !== (normalized.region ?? null) || value.verification !== null || value.batchCount !== 0) fail();
    return value;
  }),
  verification: async (id: string, admin: boolean, signal?: AbortSignal): Promise<Verification> => validateVerification(await api<unknown>(`${path(id, admin)}/verification`, { signal })),
  submit: (id: string, input: VerificationInput): Promise<Verification> => mutation(async () => {
    const normalized = normalizeVerificationInput(input), base = path(id), initial = apiSessionStamp();
    // Separate preflight reads are NOT atomic/versioned snapshots. A concurrent write
    // can conservatively fail acknowledgement validation; never retry the mutation.
    const previous = validateFacility(await api<unknown>(base), id).verification;
    if (initial !== null && !isApiSession(initial)) throw new ApiError(401, "auth.sessionChanged");
    const stamp = apiSessionStamp();
    const value = validateVerification(await api<unknown>(`${base}/verification`, { method: "POST", body: JSON.stringify(normalized) }, false));
    sessionGuard(stamp);
    return submitted(value, normalized, previous);
  }),
  inspect: (id: string, input: FacilityDecision): Promise<Verification> => mutation(async () => {
    const normalized = normalizeFacilityDecision(input), base = path(id, true), initial = apiSessionStamp();
    const previous = validateVerification(await api<unknown>(`${base}/verification`));
    if (initial !== null && !isApiSession(initial)) throw new ApiError(401, "auth.sessionChanged");
    if (normalized.status === "approved") {
      if ((normalized.level ?? previous.level) === "none") throw new FacilityValidationError("level");
      if (!previous.documents.length || previous.documents.some(document => !document.controlled)) throw new FacilityValidationError("documents");
      if (Date.parse(normalized.validUntil!) <= Date.now()) throw new FacilityValidationError("validUntil");
    }
    const stamp = apiSessionStamp();
    const value = validateVerification(await api<unknown>(`${base}/inspect`, { method: "POST", body: JSON.stringify(normalized) }, false));
    sessionGuard(stamp);
    return inspected(value, normalized, previous);
  }),
  upload: (file: File): Promise<FarmDocumentUpload> => mutation(async () => {
    validateFacilityDocument(file);
    const expected = { mimeType: file.type, sizeBytes: file.size };
    const body = new FormData(); body.append("file", file); body.append("purpose", "farm_document");
    const v = object(await api<unknown>("/uploads", { method: "POST", body }, false), ["id", "url", "mimeType", "sizeBytes", "purpose", "isPrivate"]);
    const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf" };
    const match = typeof v.url === "string" && /^\/uploads\/private\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif|pdf)$/.exec(v.url);
    if (!validFacilityIdentifier(v.id) || v.purpose !== "farm_document" || v.isPrivate !== true || !mime(v.mimeType) || v.mimeType !== expected.mimeType || !facilityInteger(v.sizeBytes, 1) || v.sizeBytes !== expected.sizeBytes || !match || match[1] !== extensions[v.mimeType]) fail();
    return immutableId<FarmDocumentUpload>({ id: v.id, ...expected, purpose: "farm_document", isPrivate: true });
  }),
  document: async (id: string, doc: FacilityDocument, admin: boolean, signal?: AbortSignal): Promise<Blob> => {
    const base = path(id, admin), snapshot = documentProjection(doc);
    if (!snapshot.controlled || !mime(snapshot.mimeType) || !facilityInteger(snapshot.sizeBytes, 1)) throw new FacilityValidationError("document");
    const blob = await apiBlob(`${base}/verification/documents/${requestedId(snapshot.id)}/content`, signal);
    if (!(blob instanceof Blob) || blob.size !== snapshot.sizeBytes || blob.type !== snapshot.mimeType) fail();
    return blob;
  },
};
