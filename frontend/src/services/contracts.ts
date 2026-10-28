export type SaleMode = "in_stock" | "pre_order";
export type CartLine = {
  listingId: string; code: string; name: string; species: string; breed: string;
  price: number; quantity: number; available: number; lineTotal: number;
  image: string | null; saleMode: SaleMode; depositPct: number | null;
  expectedReadyDate: string | null; negotiable: boolean;
};
export type Cart = { items: CartLine[]; itemCount: number; subtotal: number; saleMode: SaleMode | "mixed" | null };
export type PaymentMethod = "bank_card" | "e_wallet" | "bank_transfer";
export type CheckoutInput = {
  recipientName: string; phone: string; address: string; city?: string; province?: string;
  paymentMethod: PaymentMethod;
};
export type OrderStatus = "pending_payment" | "paid" | "ready" | "shipped" | "delivered" | "completed" | "cancelled" | "refunded";
export type ShipmentInput = { trackingCarrier?: string; trackingNumber?: string; estimatedDeliveryAt?: string };
export type OrderFilter = "all" | OrderStatus;
export type OrderTracking = {
  id: string; status: OrderStatus; carrier: string | null; trackingNumber: string | null;
  estimatedDeliveryAt: string | null;
  events: { status: "placed" | "paid" | "ready" | "shipped" | "delivered" | "completed" | "cancelled" | "refunded"; at: string }[];
};
export type Order = {
  id: string;
  status: OrderStatus;
  saleMode: SaleMode;
  paymentStatus: "unpaid" | "paid" | "deposit_paid" | "balance_due" | "refunded";
  subtotal: number; shippingFee: number; total: number;
  depositAmount: number | null; balanceAmount: number | null; balanceDueAt: string | null;
  company: { id: string; name: string; location: string | null };
  buyer: { id: string; name: string; email: string; phone: string | null };
  delivery: { recipientName: string; phone: string; address: string; city: string | null; province: string | null; deliveryMethod: string | null };
  items: { listingId: string; code: string; name: string; species: string; quantity: number; unitPrice: number; lineTotal: number; saleMode: SaleMode; image: string | null }[];
  payments: { id: string; purpose: string; method: PaymentMethod; provider: string; amount: number; state: "ready" | "paid" | "failed" | "refunded"; paidAt: string | null; refundedAt: string | null }[];
  placedAt: string; paidAt: string | null; readyAt: string | null; estimatedDeliveryAt: string | null;
  shippedAt: string | null; deliveredAt: string | null; completedAt: string | null;
  cancelledAt: string | null; refundedAt: string | null;
  trackingCarrier: string | null; trackingNumber: string | null;
};

export type DisputeStatus = "open" | "reviewing" | "resolved" | "rejected";
export type DisputeReason = "fish_unwell" | "not_as_described" | "damaged_packaging" | "not_received" | "other";
export type Dispute = {
  id: string; order: { id: string; status: OrderStatus }; buyer: { id: string; name: string; email: string };
  reason: DisputeReason; description: string; status: DisputeStatus; resolution: string | null;
  attachments: { id: string; mimeType: string | null; sizeBytes: number | null; createdAt: string }[];
  createdAt: string; resolvedAt: string | null;
};
export type DisputeInput = { reason: DisputeReason; description: string; uploadIds?: string[] };
export type EvidenceUpload = { id: string; url: string; mimeType: string; sizeBytes: number; purpose: string; isPrivate: boolean };

export type CompanyListingStatus = "draft" | "pending" | "approved" | "paused" | "changes" | "rejected";
export type CompanyListingFilter = "all" | "attention" | CompanyListingStatus;
export type ListingImageInput = { url: string; isMain: boolean; position: number };
export type CompanyListingDraft = {
  name: string; species: string; breed: string; description: string;
  ageMonths: number | null; sizeCm: number | null; gender: string | null; origin: string | null; health: string | null;
  price: number; quantity: number; negotiable: boolean; shipping: string[];
  location: string | null; region: string | null; saleMode: SaleMode;
  depositPct: number | null; expectedReadyDate: string | null; preorderPolicy: string | null;
  images: (ListingImageInput & { id: string })[]; mainId: string | null;
};
export type CompanyListingInput = Partial<Omit<CompanyListingDraft, "images" | "mainId"> & { images: ListingImageInput[] }>;
export type CompanyListing = {
  id: string; company: { id: string; name: string; location: string | null }; createdBy: string | null;
  status: CompanyListingStatus; draft: CompanyListingDraft | null;
  decision: { kind: string; reason: string | null; feedback: string | null; step: number | null; by: string; at: string } | null;
  createdAt: string; updatedAt: string; submittedAt: string | null; views: number;
  history: { at: string; by: string; action: string; note?: string }[];
};

export type ApiUser = {
  id: string;
  email: string;
  name: string;
  role: "User" | "Admin";
  status: "active" | "suspended";
  phone: string | null;
  location: string | null;
  joinedAt: string;
  emailVerifiedAt: string | null;
  prefs: { status: boolean; system: boolean; reminders: boolean };
};
export type AuthPayload = {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: ApiUser;
};
export type MarketplaceListing = {
  id: string;
  name: string;
  species: string;
  breed: string;
  description: string;
  sizeCm: number | null;
  ageMonths: number | null;
  price: number;
  quantity: number;
  negotiable: boolean;
  gender: string | null;
  origin: string | null;
  health: string | null;
  location: string | null;
  region: string | null;
  shipping: string[];
  images: { id: string; url: string; position: number; isMain: boolean }[];
  image: string | null;
  label: "pre_order" | "new" | "verified";
  company: { id: string; name: string; location: string | null; joinedAt: string; rating: number | null; reviewCount: number };
  rating: number | null;
  reviewCount: number;
  saleMode: "in_stock" | "pre_order";
  depositPct: number | null;
  expectedReadyDate: string | null;
  preorderPolicy: string | null;
  createdAt: string;
  views: number;
};
export type MarketplacePage = {
  items: MarketplaceListing[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
export type CompanyStore = {
  id: string;
  name: string;
  about: string | null;
  location: string | null;
  phone: string | null;
  email: string | null;
  joinedAt: string;
  rating: number | null;
  reviewCount: number;
  listings: number;
  species: string[];
};
