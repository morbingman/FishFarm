import type { FacilityComplianceHint, FacilityDecision, FacilityInput, FacilityRoute, Verification, VerificationInput, VerificationLevel, VerificationStatus } from "./facilityContracts";

export const facilityLevels: VerificationLevel[] = ["none", "registered", "inspected"];
export const verificationStatuses: VerificationStatus[] = ["pending", "approved", "rejected", "revoked"];
export const facilityDocumentMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"] as const;
/** Backend default only; a lower server-configured limit can still reject the upload. */
export const facilityDocumentMaxBytes = 10 * 1024 * 1024;
export class FacilityValidationError extends Error {
  constructor(public field: string) { super(field); this.name = "FacilityValidationError"; }
}
export const isFacilityRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export const facilityInteger = (value: unknown, min = 0): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= min;
/** Match retained class-validator/validator isLength: count surrogate pairs and
 * presentation-selector sequences once, not UTF-16 units or grapheme clusters. */
export function facilityTextLength(text: string): number {
  const presentationSequences = text.match(/[^\uFE0F\uFE0E][\uFE0F\uFE0E]/g)?.length ?? 0;
  const surrogatePairs = text.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g)?.length ?? 0;
  return text.length - presentationSequences - surrogatePairs;
}
const reserved = ["new", "edit", "delete", "verification", "review", "inspect", "documents", "content", "submit"];
export const validFacilityIdentifier = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(value) && !reserved.includes(value.toLowerCase());

/** Calendar validation precedes Date.parse, which otherwise rolls impossible dates forward. */
function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return false;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]) return false;
  if (value.length > 10 && (Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59 || (/[+-]\d{2}:\d{2}$/.test(value) && (Number(value.slice(-5, -3)) > 23 || Number(value.slice(-2)) > 59)))) return false;
  const at = Date.parse(value);
  return Number.isFinite(at) && new Date(at).getUTCFullYear() >= 1 && new Date(at).getUTCFullYear() <= 9999;
}
export const validFacilityDate = (value: unknown): value is string => validDate(value) && value.endsWith("Z") && value.length > 10;
function keys(value: unknown, allowed: readonly string[], field: string): asserts value is Record<string, unknown> {
  if (!isFacilityRecord(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new FacilityValidationError(field);
}
function trimmed(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string") throw new FacilityValidationError(field);
  const text = value.trim();
  const length = facilityTextLength(text);
  if (length < min || length > max) throw new FacilityValidationError(field);
  return text;
}
export function normalizeFacilityInput(input: FacilityInput): FacilityInput {
  keys(input, ["name", "location", "region"], "input");
  return { name: trimmed(input.name, "name", 1, 120), location: trimmed(input.location, "location", 1, 200), ...(input.region !== undefined ? { region: trimmed(input.region, "region", 0, 80) } : {}) };
}
const verificationScalars = ["level", "inspectedAt", "inspector", "notes", "validUntil"] as const;
function scalars(input: Record<string, unknown>): Omit<FacilityDecision, "status"> {
  const out: Omit<FacilityDecision, "status"> = {};
  if (input.level !== undefined) {
    if (!facilityLevels.includes(input.level as VerificationLevel)) throw new FacilityValidationError("level");
    out.level = input.level as VerificationLevel;
  }
  for (const field of ["inspector", "notes"] as const) if (input[field] !== undefined) out[field] = trimmed(input[field], field, 0, field === "inspector" ? 120 : 2000);
  for (const field of ["inspectedAt", "validUntil"] as const) if (input[field] !== undefined) {
    if (!validDate(input[field])) throw new FacilityValidationError(field);
    out[field] = new Date(input[field] as string).toISOString();
  }
  return out;
}
export function normalizeVerificationInput(input: VerificationInput): VerificationInput {
  keys(input, [...verificationScalars, "documents"], "input");
  const normalized = scalars(input);
  if (normalized.level === undefined) throw new FacilityValidationError("level");
  if (!Array.isArray(input.documents) || input.documents.length < 1 || input.documents.length > 20) throw new FacilityValidationError("documents");
  const documents = input.documents.map(document => {
    keys(document, ["type", "uploadId"], "documents");
    const uploadId = trimmed(document.uploadId, "documents", 1, 200);
    if (!validFacilityIdentifier(uploadId)) throw new FacilityValidationError("documents");
    return { type: trimmed(document.type, "documents", 1, 80), uploadId };
  });
  if (new Set(documents.map(document => document.uploadId)).size !== documents.length) throw new FacilityValidationError("documents");
  return { ...normalized, level: normalized.level, documents };
}
export function normalizeFacilityDecision(input: FacilityDecision, now = Date.now()): FacilityDecision {
  keys(input, ["status", ...verificationScalars], "input");
  if (!["approved", "rejected", "revoked"].includes(input.status)) throw new FacilityValidationError("status");
  const normalized: FacilityDecision = { status: input.status, ...scalars(input) };
  if (normalized.status === "approved") {
    if (!Number.isFinite(now) || !normalized.validUntil || Date.parse(normalized.validUntil) <= now) throw new FacilityValidationError("validUntil");
    if (normalized.level === "none") throw new FacilityValidationError("level");
  }
  return normalized;
}
export function validateFacilityDocument(file: File): void {
  if (typeof File === "undefined" || !(file instanceof File)) throw new FacilityValidationError("file");
  if (!(facilityDocumentMimeTypes as readonly string[]).includes(file.type)) throw new FacilityValidationError("mimeType");
  if (!facilityInteger(file.size, 1) || file.size > facilityDocumentMaxBytes) throw new FacilityValidationError("sizeBytes");
}
export function verificationStatusLabel(status: VerificationStatus, lang: "en" | "vi"): string {
  const labels: Record<VerificationStatus, [string, string]> = { pending: ["Pending review", "Chờ xét duyệt"], approved: ["Approved", "Đã phê duyệt"], rejected: ["Rejected", "Bị từ chối"], revoked: ["Revoked", "Đã thu hồi"] };
  return labels[status][lang === "vi" ? 1 : 0];
}
export function verificationLevelLabel(level: VerificationLevel, lang: "en" | "vi"): string {
  const labels: Record<VerificationLevel, [string, string]> = { none: ["None", "Chưa xác minh"], registered: ["Registered", "Đã đăng ký"], inspected: ["Inspected", "Đã kiểm tra"] };
  return labels[level][lang === "vi" ? 1 : 0];
}
/** Advisory only: publication eligibility remains authoritative on the backend. */
export function facilityComplianceHint(verification: Verification | null, now = Date.now()): FacilityComplianceHint {
  if (!verification) return "missing";
  if (verification.status !== "approved") return verification.status;
  if (verification.level === "none") return "level";
  if (!validFacilityDate(verification.validUntil) || !Number.isFinite(now) || Date.parse(verification.validUntil) <= now) return "expired";
  if (!verification.documents.length || verification.documents.some(document => !document.controlled)) return "documents";
  return "compliant";
}
export function parseFacilityRoute(route: string): FacilityRoute | null {
  if (typeof route !== "string") return null;
  const value = route.startsWith("#") ? route.slice(1) : route;
  if (value === "company/facilities") return { mode: "list", id: null };
  if (value === "company/facilities/new") return { mode: "new", id: null };
  if (value === "admin/facilities") return { mode: "review-list", id: null };
  const match = /^(company|admin)\/facilities\/([^/?#]+)(?:\/(verification|review))?$/.exec(value);
  if (!match || (match[1] === "admin" ? match[3] !== undefined && match[3] !== "review" : match[3] === "review")) return null;
  try {
    const id = decodeURIComponent(match[2]);
    if (!validFacilityIdentifier(id)) return null;
    return { mode: match[1] === "admin" ? "review" : match[3] ? "submit" : "detail", id };
  } catch { return null; }
}
export function facilityRoute(mode: FacilityRoute["mode"], id?: string): string {
  if (["list", "new", "review-list"].includes(mode)) {
    if (id !== undefined) throw new FacilityValidationError("route");
    return mode === "review-list" ? "#admin/facilities" : `#company/facilities${mode === "new" ? "/new" : ""}`;
  }
  if (!["detail", "submit", "review"].includes(mode) || !validFacilityIdentifier(id)) throw new FacilityValidationError("route");
  return `#${mode === "review" ? "admin" : "company"}/facilities/${encodeURIComponent(id)}${mode === "submit" ? "/verification" : mode === "review" ? "/review" : ""}`;
}
