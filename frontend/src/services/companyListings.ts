import type { CompanyListingDraft, CompanyListingInput, CompanyListingStatus, ListingImageInput } from "./contracts";

export const listingStatuses: CompanyListingStatus[] = ["draft", "pending", "approved", "paused", "changes", "rejected"];
export const listingFields = ["name", "species", "breed", "description", "ageMonths", "sizeCm", "gender", "origin", "health", "price", "quantity", "negotiable", "shipping", "location", "region", "saleMode", "depositPct", "expectedReadyDate", "preorderPolicy", "images"] as const;
export const textLimits = { name: 120, species: 40, breed: 80, description: 4000, gender: 40, origin: 80, health: 120, location: 200, region: 80, preorderPolicy: 2000 };
export type ListingForm = Record<keyof typeof textLimits | "ageMonths" | "sizeCm" | "price" | "quantity" | "depositPct" | "expectedReadyDate" | "shipping", string> & { saleMode: "in_stock" | "pre_order"; negotiable: boolean; images: ListingImageInput[] };
export const listingRoute = (mode: "list" | "new" | "edit" | "detail", id?: string) => mode === "list" ? "#company/listings" : mode === "new" ? "#company/add" : `#company/${mode === "edit" ? "edit" : "listing"}/${encodeURIComponent(id ?? "")}`;
export type CompanyListingRoute = { mode: "list" | "new" | "edit" | "detail"; listingId: string | null };
export function parseCompanyListingRoute(route: string): CompanyListingRoute | null {
  if (route === "company/listings") return { mode: "list", listingId: null };
  if (route === "company/add") return { mode: "new", listingId: null };
  const match = /^company\/(edit|listing)\/([^/?#]+)$/.exec(route);
  if (!match) return null;
  try {
    const listingId = decodeURIComponent(match[2]);
    if (!listingId.trim() || /[\u0000-\u001f\u007f]/.test(listingId)) return null;
    return { mode: match[1] === "edit" ? "edit" : "detail", listingId };
  } catch { return null; }
}
export const isCompanyListingRoute = (route: string) => parseCompanyListingRoute(route) !== null;
export const canPublish = (status: CompanyListingStatus) => ["draft", "changes", "rejected", "paused"].includes(status);
export function listingLabel(status: CompanyListingStatus, language: "en" | "vi") {
  const labels = { draft: ["Draft", "Bản nháp"], pending: ["Under review", "Đang xét duyệt"], approved: ["Live", "Đang hiển thị"], paused: ["Paused", "Tạm dừng"], changes: ["Changes requested", "Yêu cầu sửa"], rejected: ["Rejected", "Đã từ chối"] };
  return labels[status][language === "vi" ? 1 : 0];
}
function localDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function listingForm(draft: CompanyListingDraft | null = null): ListingForm {
  const result = { saleMode: draft?.saleMode ?? "in_stock", negotiable: draft?.negotiable ?? false, images: draft?.images.map((image, position) => ({ url: image.url, isMain: image.id === draft.mainId, position })) ?? [], shipping: draft?.shipping.join("\n") ?? "", expectedReadyDate: localDate(draft?.expectedReadyDate ?? null) } as ListingForm;
  for (const field of Object.keys(textLimits) as (keyof typeof textLimits)[]) result[field] = draft?.[field] ?? "";
  for (const field of ["ageMonths", "sizeCm", "price", "quantity", "depositPct"] as const) result[field] = draft?.[field] == null ? field === "quantity" ? "1" : "" : String(draft[field]);
  return result;
}
export class ListingValidationError extends Error { constructor(public field: string) { super(field); } }
export function listingInput(form: ListingForm, baseline?: ListingForm): CompanyListingInput {
  const input: CompanyListingInput = {};
  const changed = (field: keyof ListingForm) => !baseline || JSON.stringify(form[field]) !== JSON.stringify(baseline[field]);
  for (const field of Object.keys(textLimits) as (keyof typeof textLimits)[]) {
    if (field === "preorderPolicy" && form.saleMode === "in_stock") continue;
    if (!changed(field)) continue;
    const value = form[field].trim();
    if (value.length > textLimits[field]) throw new ListingValidationError(field);
    input[field] = value;
  }
  for (const [field, min, max] of [["ageMonths", 0, 600], ["sizeCm", 1, 500], ["price", 0, 2147483647], ["quantity", 1, 100000]] as const) {
    if (!changed(field)) continue;
    const value = form[field].trim();
    if (!value) {
      if (field === "ageMonths" || field === "sizeCm") input[field] = null;
      else if (baseline) throw new ListingValidationError(field);
      continue;
    }
    const number = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < min || number > max) throw new ListingValidationError(field);
    input[field] = number;
  }
  if (changed("shipping")) {
    input.shipping = form.shipping.split("\n").map(value => value.trim()).filter(Boolean);
    if (input.shipping.length > 10 || input.shipping.some(value => value.length > 80)) throw new ListingValidationError("shipping");
  }
  if (changed("saleMode")) input.saleMode = form.saleMode;
  if (changed("negotiable")) input.negotiable = form.negotiable;
  if (form.saleMode === "pre_order") {
    const deposit = Number(form.depositPct);
    if (!/^\d+$/.test(form.depositPct) || deposit < 20 || deposit > 30) throw new ListingValidationError("depositPct");
    if (!form.expectedReadyDate || !Number.isFinite(Date.parse(form.expectedReadyDate))) throw new ListingValidationError("expectedReadyDate");
    if (changed("depositPct") || changed("saleMode")) input.depositPct = deposit;
    if (changed("expectedReadyDate") || changed("saleMode")) input.expectedReadyDate = new Date(form.expectedReadyDate).toISOString();
  }
  if (changed("images")) {
    if (form.images.length > 8 || form.images.some(image => !validImageUrl(image.url))) throw new ListingValidationError("images");
    const main = Math.max(0, form.images.findIndex(image => image.isMain));
    input.images = form.images.map((image, position) => ({ url: image.url, position, isMain: position === main }));
  }
  return input;
}
export const validImageUrl = (url: string) => url.length <= 2048 && (/^\/uploads\/[^/]+$/.test(url) || /^https?:\/\//i.test(url));
export const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export function validateListingFile(file: File, count: number) {
  if (count >= 8 || !imageTypes.includes(file.type) || file.size <= 0 || file.size > 10 * 1024 * 1024) throw new ListingValidationError("images");
}
export function publicationMissing(form: ListingForm) {
  const missing: string[] = [];
  for (const field of ["name", "species", "gender", "origin", "health", "location", "region"] as const) if (!form[field].trim()) missing.push(field);
  if (form.description.trim().length < 20) missing.push("description");
  if (!form.ageMonths.trim()) missing.push("ageMonths");
  if (!(Number(form.sizeCm) > 0)) missing.push("sizeCm");
  if (!(Number(form.price) > 0)) missing.push("price");
  if (!(Number(form.quantity) >= 1)) missing.push("quantity");
  if (!form.images.length) missing.push("images");
  if (!form.shipping.trim()) missing.push("shipping");
  if (form.saleMode === "pre_order") {
    if (!(Number(form.depositPct) >= 20 && Number(form.depositPct) <= 30)) missing.push("depositPct");
    if (!form.expectedReadyDate) missing.push("expectedReadyDate");
  }
  return missing;
}
