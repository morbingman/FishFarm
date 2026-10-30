export type BatchStatus = "draft" | "pending_review" | "open" | "fully_sponsored" | "growing" | "harvesting" | "harvested" | "settled" | "cancelled";
export type BatchStage = "nursery" | "fingerling" | "juvenile" | "grow_out" | "pre_harvest";
export type CostCategory = "equipment" | "feed" | "labour" | "health" | "transport" | "platform_fee" | "contingency";
export type CostAllocation = "per_share" | "batch_total";
export type ShareUnitType = "weight" | "count";
export type VerificationLevel = "none" | "registered" | "inspected";
export type VerificationStatus = "pending" | "approved" | "rejected" | "revoked";

export interface BatchCostInput { category: CostCategory; label: string; amount: number; allocation: CostAllocation; note?: string }
export interface BatchImageInput { url: string; position?: number }
export interface BatchInput {
  title: string; species: string; breed?: string; description: string; location: string; region: string;
  stockingDate?: string; expectedHarvestDate?: string; stockCount: number; shareUnitType: ShareUnitType;
  shareQuantity: number; expectedHarvestWeightG?: number; packagePricePerShare: number; contingencyPct?: number;
  riskDisclosure: string; termsVersion: string; facilityId: string; images?: BatchImageInput[]; costs: BatchCostInput[];
}
export interface BatchUpdateInput { stage: BatchStage; averageWeightG?: number; countAlive?: number; note?: string; photoUrls?: string[] }
export interface RecordedBatchUpdate {
  readonly id: string; stage: BatchStage; averageWeightG: number | null; countAlive: number | null; note: string | null;
  photos: { readonly id: string; url: string }[]; createdBy: string; createdAt: string;
}
export interface BatchImage { readonly id: string; url: string; position: number; isMain: boolean }
export interface BatchCost { category: CostCategory; label: string; amount: number; allocation: CostAllocation; note: string | null }
export interface BatchBase {
  /** Canonical BATCH code, not the internal database ID. */
  readonly id: string; title: string; species: string; breed: string | null; description: string;
  location: string; region: string; status: BatchStatus; stockingDate: string | null; expectedHarvestDate: string | null;
  stockCount: number; shareUnitType: ShareUnitType; shareUnit: string; shareQuantity: number | null;
  expectedHarvestWeightG: number | null; totalShares: number; sharesAvailable: number; packagePricePerShare: number;
  contingencyPct: number; riskDisclosure: string; termsVersion: string; images: BatchImage[]; costs: BatchCost[];
  updates: RecordedBatchUpdate[]; createdAt: string; updatedAt: string;
}
export interface PublicBatch extends BatchBase {
  status: "open";
  compliance: { level: Exclude<VerificationLevel, "none">; inspectedAt: string | null; validUntil: string };
  facility: { readonly id: string; name: string; location: string };
}
export interface BatchDocumentSummary { readonly id: string; type: string; controlled: boolean }
export interface BatchVerification {
  readonly id: string; level: VerificationLevel; status: VerificationStatus; inspectedAt: string | null;
  inspector: string | null; validUntil: string | null; documents: BatchDocumentSummary[];
}
export interface CompanyBatch extends BatchBase {
  farmVerified: boolean; inspectedAt: string | null; inspector: string | null;
  images: (BatchImage & { readonly batchId: string; createdAt: string })[];
  costs: (BatchCost & { readonly id: string; readonly batchId: string })[];
  createdBy: { readonly id: string; name: string; email: string } | null;
  facility: { readonly id: string; name: string; location: string; verification: BatchVerification | null } | null;
  reviewedAt: string | null; reviewedBy: string | null; reviewNote: string | null;
  submittedAt: string | null; cancelledAt: string | null; cancelReason: string | null; sponsorshipCount: number;
}
export interface BatchPage { items: PublicBatch[]; page: number; limit: number; total: number; pages: number }
export interface PublicBatchQuery { q?: string; species?: string; region?: string; harvestBefore?: string; priceMax?: number; page?: number; limit?: number }
/** Read-only directory projection. Document URLs and upload identifiers are never exposed. */
export interface BatchFacility {
  readonly id: string; name: string; location: string; region: string | null; batchCount: number; createdAt: string; updatedAt: string;
  verification: (Omit<BatchVerification, "documents"> & {
    notes: string | null; submittedAt: string | null; reviewedAt: string | null; reviewedBy: string | null;
    documents: (BatchDocumentSummary & { mimeType: string | null; sizeBytes: number | null; uploadedAt: string })[];
  }) | null;
}
export type BatchRoute = { company: boolean; mode: "list" | "new" | "detail" | "edit"; id: string | null };
export interface BatchShareSummary {
  totalShares: number; shareUnit: string; totalCost: bigint; packageTotal: bigint; matches: boolean;
}
