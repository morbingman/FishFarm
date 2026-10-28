import { api, ApiError } from "./api";
import type { CompanyListing, CompanyListingFilter, CompanyListingInput, EvidenceUpload } from "./contracts";
import { imageTypes, listingFields, listingStatuses, validImageUrl } from "./companyListings";

const path = (id?: string) => `/company/listings${id ? `/${encodeURIComponent(id)}` : ""}`;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const date = (value: unknown): value is string => text(value) && Number.isFinite(Date.parse(value));
const nullableText = (value: unknown) => value === null || typeof value === "string";
const integer = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
export function validateCompanyListing(value: unknown, id?: string): CompanyListing {
  if (!record(value) || !text(value.id) || (id && id !== value.id) || !listingStatuses.includes(value.status as CompanyListing["status"])
    || !record(value.company) || !text(value.company.id) || !text(value.company.name) || !nullableText(value.company.location)
    || !nullableText(value.createdBy) || !date(value.createdAt) || !date(value.updatedAt) || !(value.submittedAt === null || date(value.submittedAt))
    || !integer(value.views) || !Array.isArray(value.history) || value.history.some(entry => !record(entry) || !date(entry.at) || !text(entry.by) || !text(entry.action) || !(entry.note === undefined || typeof entry.note === "string"))
    || !(value.draft === null || record(value.draft))) throw new ApiError(502, "listing.invalidResponse");
  if (value.draft) {
    const draft = value.draft as Record<string, unknown>;
    if (["name", "species", "breed", "description"].some(field => typeof draft[field] !== "string")
      || ["gender", "origin", "health", "location", "region", "preorderPolicy"].some(field => !nullableText(draft[field]))
      || ["ageMonths", "sizeCm", "depositPct"].some(field => !(draft[field] === null || integer(draft[field])))
      || !(draft.expectedReadyDate === null || date(draft.expectedReadyDate))
      || !integer(draft.price) || !integer(draft.quantity) || typeof draft.negotiable !== "boolean"
      || !["in_stock", "pre_order"].includes(draft.saleMode as string) || !Array.isArray(draft.shipping) || draft.shipping.some(item => typeof item !== "string")
      || !Array.isArray(draft.images) || draft.images.length > 8 || draft.images.some(image => !record(image) || !text(image.id) || !text(image.url) || !validImageUrl(image.url) || !integer(image.position) || typeof image.isMain !== "boolean")
      || !(draft.mainId === null || (text(draft.mainId) && draft.images.some(image => image.id === draft.mainId)))
      || new Set(draft.images.map(image => image.id)).size !== draft.images.length) throw new ApiError(502, "listing.invalidResponse");
  }
  if (value.decision !== null) {
    const decision = value.decision;
    if (!record(decision) || !["changes", "rejected"].includes(decision.kind as string)
      || !nullableText(decision.reason) || !nullableText(decision.feedback) || !nullableText(decision.by)
      || !(decision.at === null || date(decision.at)) || !integer(decision.step) || (decision.step as number) < 1 || (decision.step as number) > 6) throw new ApiError(502, "listing.invalidResponse");
  }
  return value as CompanyListing;
}
function saved(value: CompanyListing, input: CompanyListingInput) {
  if (!value.draft) throw new ApiError(502, "listing.invalidResponse");
  for (const field of listingFields) {
    if (input[field] === undefined) continue;
    if (["depositPct", "expectedReadyDate", "preorderPolicy"].includes(field) && value.draft.saleMode === "in_stock") continue;
    if (field === "images") {
      const images = input.images!;
      const main = Math.max(0, images.findIndex(image => image.isMain));
      const expected = images.map((image, index) => ({ url: image.url, position: image.position, isMain: index === main })).sort((a, b) => a.position - b.position);
      const actual = value.draft.images.map(image => ({ url: image.url, position: image.position, isMain: image.isMain }));
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new ApiError(502, "listing.invalidResponse");
    } else if (field === "expectedReadyDate") {
      if (Date.parse(value.draft.expectedReadyDate ?? "") !== Date.parse(input.expectedReadyDate ?? "")) throw new ApiError(502, "listing.invalidResponse");
    } else if (JSON.stringify(value.draft[field]) !== JSON.stringify(input[field])) throw new ApiError(502, "listing.invalidResponse");
  }
  return value;
}
function body(input: CompanyListingInput) {
  return JSON.stringify(Object.fromEntries(listingFields.filter(field => input[field] !== undefined).map(field => [field, field === "images" ? input.images?.map(image => ({ url: image.url, isMain: image.isMain, position: image.position })) : input[field]])));
}
export const companyListingsApi = {
  list: async (status: CompanyListingFilter = "all", signal?: AbortSignal) => {
    const values = await api<unknown>(`${path()}${status === "all" ? "" : `?status=${encodeURIComponent(status)}`}`, { signal });
    if (!Array.isArray(values)) throw new ApiError(502, "listing.invalidResponse");
    const rows = values.map(value => validateCompanyListing(value));
    if (rows.some(value => status !== "all" && (status === "attention" ? !["changes", "rejected"].includes(value.status) : value.status !== status))) throw new ApiError(502, "listing.invalidResponse");
    return rows;
  },
  detail: async (id: string, signal?: AbortSignal) => validateCompanyListing(await api<unknown>(path(id), { signal })),
  create: async (input: CompanyListingInput) => {
    const value = validateCompanyListing(await api<unknown>(path(), { method: "POST", body: body(input) }));
    if (value.status !== "draft" || !value.draft) throw new ApiError(502, "listing.invalidResponse");
    return saved(value, input);
  },
  save: async (id: string, input: CompanyListingInput) => saved(validateCompanyListing(await api<unknown>(path(id), { method: "PATCH", body: body(input) }), id), input),
  publish: async (id: string) => {
    const value = validateCompanyListing(await api<unknown>(`${path(id)}/publish`, { method: "POST" }), id);
    if (value.status !== "approved") throw new ApiError(502, "listing.invalidResponse");
    return value;
  },
  submit: async (id: string) => {
    const value = validateCompanyListing(await api<unknown>(`${path(id)}/submit`, { method: "POST" }), id);
    if (value.status !== "pending" || value.decision !== null || !date(value.submittedAt)) throw new ApiError(502, "listing.invalidResponse");
    return value;
  },
  withdraw: async (id: string) => {
    const value = validateCompanyListing(await api<unknown>(`${path(id)}/withdraw`, { method: "POST" }), id);
    if (value.status !== "draft" || value.decision !== null || value.submittedAt !== null) throw new ApiError(502, "listing.invalidResponse");
    return value;
  },
  upload: async (file: File) => {
    const form = new FormData(); form.append("file", file); form.append("purpose", "listing_image");
    const value = await api<unknown>("/uploads", { method: "POST", body: form });
    if (!record(value) || !text(value.id) || !text(value.url) || !/^\/uploads\/[^/]+$/.test(value.url) || value.isPrivate !== false || value.purpose !== "listing_image"
      || !imageTypes.includes(value.mimeType as string) || value.mimeType !== file.type || value.sizeBytes !== file.size) throw new ApiError(502, "listing.invalidResponse");
    return value as EvidenceUpload;
  },
};
