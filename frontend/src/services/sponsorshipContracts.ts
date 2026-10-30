export type SponsorshipStatus = "pending_payment" | "funded" | "growing" | "ready_for_delivery" | "delivered" | "settled" | "cancelled" | "refunded";
export type EscrowMilestone = "stocking" | "mid_growth" | "pre_harvest" | "harvest";
export type EscrowState = "held" | "released" | "reversed";
export type PaymentMethod = "bank_card" | "e_wallet" | "bank_transfer";
export const paymentMethods: PaymentMethod[] = ["bank_card", "e_wallet", "bank_transfer"];

export type SponsorshipBatchSummary = {
  id: string;
  code: string;
  title: string;
  species: string;
  status: string;
  location: string;
  region: string;
  shareUnitType: "weight" | "count";
  shareUnit: string;
  shareQuantity: number | null;
  stockingDate: string | null;
  expectedHarvestDate: string | null;
  images: { id: string; url: string }[];
};

export type Sponsorship = {
  id: string;
  batchId: string;
  sponsor: { id: string; name: string; email: string; phone: string };
  batch: SponsorshipBatchSummary;
  shares: number;
  packageAmount: number;
  deliveryFee: number;
  totalAmount: number;
  status: SponsorshipStatus;
  recipientName: string;
  phone: string;
  address: string;
  city: string | null;
  province: string | null;
  deliveryMethod: string | null;
  termsSnapshot: Record<string, unknown>;
  paidAt: string | null;
  growingAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  settledAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
  payments: { id: string; purpose: string; method: string; amount: number; state: string; createdAt: string; paidAt: string | null; refundedAt: string | null }[];
  escrowReleases: { id: string; milestone: EscrowMilestone; amount: number; state: EscrowState; releasedAt: string | null; createdAt: string }[];
  adjustments: { id: string; kind: string; amount: number; reason: string; status: string; createdAt: string; appliedAt: string | null }[];
}

export type BatchGrowResult = {
  batch: { id: string; code: string; title: string; status: string; sharesAvailable: number; stockCount: number; stockingDate: string | null };
};

export type BatchHarvestResult = {
  batch: { id: string; code: string; status: string };
  harvest: {
    id: string;
    batchId: string;
    harvestedAt: string;
    actualCount: number;
    actualWeightG: number | null;
    yieldPerShare: string | null;
    mortalityRateBps: number;
    status: string;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

export type SponsorshipEscrow = {
  sponsorshipId: string;
  packageAmount: number;
  tranches: Sponsorship["escrowReleases"];
  held: number;
  released: number;
  reversed: number;
};

export type SponsorshipPage = { items: Sponsorship[]; total: number };
