export type VerificationLevel = "none" | "registered" | "inspected";
export type VerificationStatus = "pending" | "approved" | "rejected" | "revoked";

/** Resource-scoped projection: never a URL or an upload identifier. */
export interface FacilityDocument {
  readonly id: string;
  type: string;
  controlled: boolean;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
}
export interface Verification {
  readonly id: string;
  level: VerificationLevel;
  status: VerificationStatus;
  inspectedAt: string | null;
  inspector: string | null;
  notes: string | null;
  validUntil: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  documents: FacilityDocument[];
}
export interface Facility {
  readonly id: string;
  name: string;
  location: string;
  region: string | null;
  verification: Verification | null;
  batchCount: number;
  createdAt: string;
  updatedAt: string;
}
export interface FacilityInput { name: string; location: string; region?: string }
export interface VerificationDocumentInput { type: string; uploadId: string }
export interface VerificationInput {
  level: VerificationLevel;
  inspectedAt?: string;
  inspector?: string;
  notes?: string;
  validUntil?: string;
  documents: VerificationDocumentInput[];
}
export interface FacilityDecision {
  status: Exclude<VerificationStatus, "pending">;
  level?: VerificationLevel;
  inspectedAt?: string;
  inspector?: string;
  notes?: string;
  validUntil?: string;
}
/** A validated private upload receipt; its storage URL is deliberately discarded. */
export interface FarmDocumentUpload {
  readonly id: string;
  mimeType: string;
  sizeBytes: number;
  purpose: "farm_document";
  isPrivate: true;
}
export type FacilityRoute = {
  mode: "list" | "new" | "detail" | "submit" | "review-list" | "review";
  id: string | null;
};
export type FacilityComplianceHint = "missing" | "pending" | "rejected" | "revoked" | "level" | "expired" | "documents" | "compliant";
