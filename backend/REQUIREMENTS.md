# FishFarm — Backend Requirements

Derived from the Figma Make frontend export (`frontend/Design Premium Fish Marketplace Homepage.zip`).
The frontend is a **localStorage-backed demo** (`src/store.ts`): all entities, the listing
lifecycle, permissions and notifications already exist there as a de-facto domain spec, just
without a server. This document turns that into a backend contract.

**Scope — two products:**
- **§1–§10: Marketplace** — browse, list, moderate, buy/sell. Reverse-engineered from the existing frontend.
- **§11: Batch Sponsorship** — a customer pays the **full cost of care** (equipment, feed, labour,
  health, transport) up front to sponsor a growing batch, follows its growth, and receives the fish
  in kind at harvest. **Not present in the frontend at all**; this is new product and needs a
  matching frontend workstream.

Status: **v1.0 — final for implementation** (2026-10-18). All product and technical decisions are
locked or recorded as defaults (§9, §11.8); there are no open items. Implementation may start at M1.

---

## 1. Project state (as of 2026-10-18)

| Area | State |
| --- | --- |
| Git | Repo initialised, **no commits yet** (`main` unborn). |
| `frontend/` | Extracted Figma Make export (the original zip was deleted by the author). Owned by teammate. React 19 + Vite + Tailwind v4 + TypeScript, hash-based routing (`#marketplace`, `#seller/...`, `#admin/...`). No API/network layer at all. |
| `backend/` | Empty except this requirements doc. Owned by me. |

Because the frontend has **zero network calls**, every operation it performs today is local
state mutation. The NestJS API is now the source of truth; the legacy stores remain compatibility adapters while screens migrate.

---

## 2. Roles

Two application roles, fixed (not user-definable): `Buyer` and `Admin`.

- Admin is also the selling/operator role: Admin creates and fulfils listings as well as moderating the marketplace.
- Users have a `status`: `active` | `suspended`. Suspended users cannot authenticate.
- Admin operators may have an optional `store` name; listings surface `sellerName = store || name`.
- Buyers/admin operators belong to Vietnam-market locations (HCMC, Hanoi, Da Nang, Can Tho, Dong Nai).

### Permission matrix (verbatim from `Admin.tsx` `MATRIX`, enforced today client-side only)

| Capability | Type | Buyer | Admin |
| --- | --- | --- | --- |
| Browse marketplace | View | ✓ | ✓ |
| Place orders | Create | ✓ | — |
| View own orders | View | ✓ | — |
| Create listings | Create | — | ✓ |
| Edit own listings | Edit | — | ✓ |
| Delete own listings | Delete | — | ✓ |
| Submit listings for review | Create | — | ✓ |
| Pause / resume live listings | Edit | — | ✓ |
| Open moderation queue | View | — | ✓ |
| Approve listings | Approve | — | ✓ |
| Reject / request changes | Reject | — | ✓ |
| Take down live listings | Manage | — | ✓ |
| View users | View | — | ✓ |
| Suspend / reactivate users | Manage | — | ✓ |
| View platform activity | View | — | ✓ |
| Edit own profile | Edit | ✓ | ✓ |

**Requirement:** this matrix is currently advisory (client-side `can()`). The backend must be
the enforcement point — the same permission keys (`market.view`, `listing.approve`, …) applied
server-side per endpoint, so a forged request cannot exceed the role.

**Confirmed:** ordering is Buyer-only. Admins cannot place orders, even though they
can browse the marketplace. Do not widen this without an explicit product decision.

---

## 3. Domain entities

Field names below are taken from the frontend verbatim so the eventual API maps 1:1.

### 3.1 User
```
email (PK, unique)  password  name  role: Buyer|Admin
status: active|suspended   phone  location   joined (date)
store?   prefs: { status, system, reminders }   # notification preferences
```

### 3.2 Listing (canonical, workflow-bearing)
```
id            # "FM-20817" — human-readable, sequential (frontend seq starts 48300)
owner         # user email
sellerName    # store name shown publicly
status: draft|pending|approved|changes|rejected|paused
draft: Draft  # the mutable content
decision: { kind: rejected|changes, reason, feedback, step, by, at } | null
createdAt updatedAt submittedAt (nullable)  views: number
history: [{ at, by, action, note? }]      # append-only audit of the listing itself
```

### 3.3 Draft (listing content — the seller's form)
```
name species breed description
age size gender origin health
price (string) quantity (string) negotiable (bool)
images: [{ id, url }]   mainId    # image ordering + cover selection
location region
shipping: string[]      # "Local pickup" | "Domestic overnight" | "International air freight"
```
Controlled vocabularies already fixed in the UI (`Seller.tsx`):
- species: Koi, Goldfish, Betta, Arowana, Discus, Tropical, Freshwater food fish
- gender: Male, Female, Unsexed, Breeding pair
- health: Excellent — vet certified | Good — quarantined 14 days | Fair — treated and stable
- origins: Niigata/Japan, Hiroshima/Japan, Vietnam — farm bred, Thailand, Indonesia
- regions: HCMC, Hanoi, Da Nang, Can Tho, Dong Nai

Add-listing wizard steps: **Basic Information → Fish Details → Pricing → Media → Location → Preview**.

### 3.4 Notification
```
id  to        # recipient email OR role broadcast ("Admin")
type: success|error|system|status|approval|reminder
title body link   at   read: bool
```
Filtering rule already expressed in `notifsFor()`: a user sees notifications addressed to their
email **or** to their role. Respect `prefs` when creating (`notify()` skips muted categories).
Cap: 200 most recent per the demo.

### 3.5 Activity (platform audit log, admin-visible)
```
id  actor  role: Buyer|Seller|Admin|System   action  target?  link?  at
```
Cap: 300 most recent. Every mutating operation logs one entry.

### 3.6 Session
`{ email, lastActive }`, **TTL 15 minutes** (`SESSION_TTL`), sliding (touch on activity).
Server must own this — currently `sessionStorage`.

### 3.7 Entities the store does **not** model but the UI needs
These are rendered from hardcoded/page-local data today and are the real new build:
- **Order** — buyer checkout produces one (buyer `page: cart → checkout → payment → confirmation → tracking → delivery → review`; statuses include `pending`, `paid`, `completed`, and a `failed` payment state). Seller side has `#seller/orders`.
- **Payment** — methods: `Bank Card`, `E-Wallet`, `Bank Transfer`; states `ready | failed | paid`.
- **Cart** — currently client-only (`Fish[]`); needs persistence or server cart.
- **Review / Rating** — buyer posts rating + text after delivery; seller has `#seller/reviews`; listings show `rating`.
- **Message / Conversation** — buyer↔seller messaging (`#seller/messages`, buyer message modal).
- **Favorite** — buyer favourites list (client-only `number[]` today).
- **Dispute** — buyer "Report a Problem" with reason + description + attachments.
- **Customer** (seller view) and **Analytics** (Revenue, Orders, Views, Conversion; ranges This month / Last 7 days / Last 30 days / All time) — derived from orders + listing views.
- **File upload** — listing media (multiple images, drag-to-reorder) and dispute attachments.

---

### 3.8 Pre-order (deposit) marketplace variant

A normal listing may be sold as a **pre-order** for fish that are still growing or not yet ready for
delivery. This is marketplace commerce, **not** batch sponsorship (§11): the buyer reserves specific
fish from a listing with a deposit and pays the balance when the seller marks them ready.

Draft additions:
```
saleMode: in_stock | pre_order      # default in_stock
depositPct                          # e.g. 20–30, only when pre_order
expectedReadyDate                   # ISO date, only when pre_order
preorderPolicy                      # seller terms text (cancellation / forfeit / refund)
```

Order additions:
```
saleMode, depositAmount, balanceAmount, balanceDueAt
paymentStatus: unpaid | deposit_paid | balance_due | paid | refunded
```

Rules:
- Pre-order requires an **admin-approved listing** (same review as normal) and a verified seller.
- The deposit is held (simulated) until ready; the balance is due within **7 days of the seller
  marking the order ready**.
- Buyer misses the balance deadline → order is cancelled and the **deposit is refunded** (no forfeit).
- Seller fails to deliver → **full refund including deposit**.
- The listing must show a “Pre-order” badge, expected ready date and deposit terms.
- Pre-order does **not** create a batch, growth feed or escrow tranches — that is §11 only.

## 4. Listing lifecycle (state machine)

```
                 submit                 approve
  draft ───────────────▶ pending ────────────────▶ approved ──┐
    ▲                      │  │                        │  ▲    │ pause
    │        withdraw      │  │ reject / request      │  └──── paused
    └─────────────────────┘  │ changes               │        │
                              ▼                      │ takedown
                        rejected / changes ◀─────────┘  (→ rejected)
```
Rules to enforce server-side (from `store.ts`):
- **submit**: only from `draft | changes | rejected | approved`; sets `submittedAt`, clears `decision`, status → `pending`. Re-submissions are logged as "Resubmitted".
- **withdraw**: only `pending` → `draft`.
- **pause/resume**: `approved ↔ paused`.
- **delete**: forbidden for `pending` and `approved` (only draft/changes/rejected deletable). Deleted ids retained in a `deleted` list.
- **approve/reject/request-changes**: admin only, only from `pending`. Request-changes/reject store a `decision` with reason + feedback + step.
- **takedown**: admin, from `approved | paused` → `rejected` with reason "Policy violation".
- **editing a live listing** (`approved` or `paused`): the edit requires re-review — the listing
  returns to `pending` and is **hidden from the marketplace** until re-approved. There is no
  separate draft-while-live version; the single `draft` is the content under review.
- Only `approved` listings appear on the marketplace. Pausing/resuming is effectively soft visibility.

Each transition appends to `history` and emits a notification to the counterparty (seller ↔ admin)
plus an activity-log entry.

---

## 5. API surface (proposed v1)

Auth
- `POST /auth/register` (role, name, email, phone, location, password, [store, storeLocation])
- `POST /auth/login` → token + user; rejects `suspended`
- `POST /auth/logout`
- `POST /auth/verify-email`, `POST /auth/forgot-password`, `POST /auth/reset-password` (OTP flow: 6-digit, 5-min expiry, 45s resend)
- `GET  /me`, `PATCH /me`, `PATCH /me/prefs`

Marketplace (public / buyer)
- `GET  /marketplace/listings` — filters: `q, species[], breed, priceMax, size, location, sellerRating, available`; sort `Recommended|…`; pagination
- `GET  /marketplace/listings/{id}` — product projection (name, species, breed, size, price, location, seller, rating, images, label, age, gender, origin)
- `GET  /marketplace/sellers/{name}`

Favorites
- `GET/POST/DELETE /me/favorites`

Cart & checkout (buyer)
- `GET/PUT/DELETE /me/cart`
- `POST /orders` — from cart; honours the listing's `saleMode`. `in_stock` takes full payment;
  `pre_order` takes the deposit and sets `balanceDueAt`
- `POST /orders/{id}/pay` (payment state `ready|failed|paid`)
- `POST /orders/{id}/pay-balance` (pre-order balance)
- `GET  /me/orders`, `GET /orders/{id}`, `GET /orders/{id}/tracking`
- `POST /orders/{id}/confirm-delivery`
- `POST /orders/{id}/review` (rating + text)
- `POST /orders/{id}/dispute` (reason, description, attachments)

Messaging
- `GET  /me/conversations`, `GET /conversations/{id}/messages`, `POST /conversations/{id}/messages`

Seller
- `GET  /seller/summary` (analytics: revenue, orders, views, conversion; ranges)
- `GET  /seller/listings` (filter by status tab: all/pending/approved/attention)
- `POST /seller/listings` (save draft), `GET/PATCH/DELETE /seller/listings/{id}`
- `POST /seller/listings/{id}/submit`, `/withdraw`, `/pause`, `/resume`
- `GET  /seller/orders`, `GET /seller/customers`, `GET /seller/reviews`
- `POST /seller/orders/{id}/mark-ready` (pre-order: triggers the balance request to the buyer)

Admin
- `GET  /admin/queue` (tab: pending|approved|changes)
- `GET  /admin/listings/{id}` (review detail + checks)
- `POST /admin/listings/{id}/approve | reject | request-changes | takedown`
- `GET  /admin/users`, `PATCH /admin/users/{email}/status`
- `GET  /admin/roles` (the matrix)
- `GET  /admin/activity`

Notifications (all roles)
- `GET /me/notifications`, `PATCH /notifications/{id}` (read), `POST /notifications/read-all`, `DELETE /notifications/{id}`

Uploads
- `POST /uploads` (multipart) → `{ id, url }` for listing media and dispute attachments.

Admin review-detail reasons (fixed list from `Admin.tsx`): Image quality, Incomplete fish details,
Pricing concern, Species policy — plus free-text feedback. Review checklist items are also fixed.

---

## 6. Cross-cutting requirements

1. **Auth**: token-based (JWT access [+ refresh]), server-enforced 15-minute idle TTL to match the UI's `SESSION_TTL`, sliding renewal. Suspended accounts rejected at login and on refresh.
2. **Authorization**: permission keys from §2 checked per endpoint; ownership checks for seller-scoped resources (`listing.owner == user`).
3. **Notifications**: emitted server-side on lifecycle events; role-addressed broadcasts (`to: "Admin"`); honour `prefs`.
4. **Activity log**: one entry per mutation, with actor/role/action/target/deep-link; admin-only read.
5. **Uploads**: image storage for listing media (multi-image, ordered, cover flag) and disputes.
6. **Pagination/filtering**: list endpoints paginate (admin activity UI pages of 8); marketplace filters as above.
7. **i18n**: system strings and notifications are **message keys + params**, never hard English
   sentences. User-generated content (listing titles/descriptions, etc.) is stored **once** with a
   `contentLocale`; add a `listing_translations` table later if both languages are needed. Enum
   labels are keys too.
8. **Money**: currency is **VND**, stored as integer đồng (no minor unit). Prices are strings in the
   listing draft (`"720"`) and numbers in the buyer view; convert at the boundary and format in the
   client (e.g. `850.000 ₫`). Never use floats. Orders support two schedules: full payment
   (`in_stock`) or deposit + balance (`pre_order`, §3.8).
9. **Timestamps**: ISO-8601 UTC everywhere (frontend already uses `new Date().toISOString()`).
10. **IDs**: listings `FM-<seq>` sequential; other entities opaque ids.

---

## 7. Non-functional targets

- Reproducible local dev: one command to boot API + DB; seed data mirroring the demo
  (users: buyer/seller/admin demo accounts, ~6 listings across statuses, notifications, activity).
- Demo accounts to preserve: `buyer@fishmarket.demo`/`Buyer123`, `seller@fishmarket.demo`/`Seller123`,
  `admin@fishmarket.demo`/`Admin123`.
- Test coverage on the lifecycle state machine and permission checks (the rules most likely to regress).
- API contract documented (OpenAPI) so the frontend can generate a typed client — this is the
  handoff artifact to the teammate replacing `store.ts`.

---

## 8. Phased targets (milestones)

| # | Milestone | Outcome | Depends on |
| --- | --- | --- | --- |
| M0 | **Agree contract** | This doc reviewed; stack + auth + i18n + money decisions locked (§9). | — |
| M1 | **Skeleton** | API project, DB schema for §3, migrations, seed, health check, OpenAPI stub. | M0 |
| M2 | **Auth & users** | register/login/logout, verify/forgot/reset, `/me`, prefs, status enforcement, permission middleware. | M1 |
| M3 | **Listings core** | Full lifecycle state machine + history + notifications + activity log; seller CRUD + admin decisions. **This unblocks the largest part of the existing UI.** | M2 |
| M4 | **Marketplace read** | Public listing list w/ filters/sort/pagination + product projection + seller pages. Turns the buyer browse UI live. | M3 |
| M5 | **Uploads** | Image storage wired to listing media. | M3 |
| M6 | **Commerce** | Cart, checkout, orders, payment states, pre-order deposit/balance, tracking, delivery, disputes. | M4 |
| M7 | **Engagement** | Reviews/ratings, messaging, favourites, seller analytics + customers. | M6 |
| M8 | **Hardening** | OpenAPI finalised + generated client handed to frontend; tests; rate limiting; observability. | M7 |
| M9 | **Batch sponsorship schema + seller CRUD** | Grow-out batches, admin review, farm verification; batches publishable but not yet sponsorable. | M3, M5 |
| M10 | **Sponsorship + full-care payments** | Reserve shares, full package payment, escrow tranches, batch update feed, my-sponsorships. | M9, M6 |
| M11 | **Harvest & settlement** | Publish yield, delivery, shortfall refunds, disputes, close-out. | M10 |

Suggested critical path: **M0 → M1 → M2 → M3** gets the seller/admin flows (the most complete part
of the frontend) servable earliest; M4 makes browsing real; commerce/engagement follow.
Batch sponsorship (M9–M11) is a **second track** that can run in parallel once M3 and M6 are stable;
it is not required for the marketplace launch.

---

## 9. Decisions

### Locked (2026-10-18)
1. **Stack = Node + TypeScript + PostgreSQL + Prisma.** Framework: NestJS or Fastify (pick at M1).
   Chosen so the frontend can consume a generated TypeScript API client.
2. **Commerce = simulated orders only.** Model cart, orders and payment states
   (`ready | failed | paid`) with no real gateway. Keep a single payment-provider interface so a
   real VN gateway (VNPay/MoMo/ZaloPay) can slot in later without touching order logic.
   No escrow / payouts.
3. **Currency = VND**, integer đồng, no minor unit. Never floats.
4. **Ordering is Buyer-only** — Sellers and Admins cannot place orders.
5. **Live-listing edits require re-review** — editing an `approved`/`paused` listing moves it to
   `pending` and hides it from the marketplace until re-approved (no draft-while-live versioning).
6. **Auth transport = JWT access token (kept in memory) + refresh token in an httpOnly cookie.**
   Server-side idle timeout, configurable; default 30–60 min (not the demo's 15).
7. **i18n = message keys + params.** System strings and notifications are never hard English
   sentences. User-generated content is stored once with `contentLocale`; add a
   `listing_translations` table later if both languages are needed for listings.
8. **Pre-order = 25% deposit.** Balance due within 7 days of the seller marking ready; if missed,
   cancel and refund the deposit (no forfeit).
9. **Sponsorship funding = share-based, with a whole-batch option** (one sponsor may buy all shares).

### Adopted defaults (2026-10-18 — no open items)
1. **Image storage** — storage interface; local disk in dev, S3-compatible object storage in prod.
2. **Search** — Postgres full-text + trigram initially; swap in an index only if needed.
3. **Realtime** — polling for messaging (M7) first; WebSockets later.
4. **Takedown resubmission** — blocked after an admin takedown unless an admin reactivates.
5. **Notification role broadcasts** — one row per admin, so read state is per person.
6. **Seller order scope** — a distinct `order.fulfill` capability for incoming orders.

### Batch sponsorship decisions
All batch sponsorship decisions are resolved in §11.8.

---

## 10. Notes / gotchas found in the frontend

- The frontend models **two listing shapes**: the workflow `Listing` (with `draft`) and a flat
  marketplace `Fish` projection built on the fly from `approved` listings. Keep them as one entity
  server-side with two read projections rather than two tables.
- `Draft.price` and `Draft.quantity` are **strings**; convert at the boundary.
- Marketplace `Fish.id` is derived as `1000 + digits(id)`, colliding-ish with hardcoded demo
  stock ids 1..N — a client convention, not a backend concern, but note it when seeding.
- The demo has an "offline" toggle and simulated network delays (`request()` in `store.ts`) —
  a nice source of expected error states (network failure, session expiry) for the API's error contract.
- Notifications and activity are capped (200 / 300) in the demo. **Adopted:** the real backend keeps
  full history with pagination (no cap); unread counts are derived.

---

## 11. Batch Sponsorship product (full-care prepaid grow-out)

**Not in the current frontend.** This is a second product area: a customer pays the **full cost of
raising a batch of fish up front** — equipment, feed, labour/care, health, transport and platform
fee — follows the batch's growth updates, and **receives the fish in kind at harvest**. It is a
prepaid purchase of future goods — **not** an investment, profit share, or fractional ownership.
No cash returns.

This is the **CSA/CSF model** applied to fish: members cover the season's production costs in
advance and receive a share of the harvest, bearing disclosed production risk. Closest real-world
references: community-supported fisheries (e.g. Sitka Salmon Shares), CrowdFarming's “adopt an
animal/tree and receive its produce”, and contract farming where the buyer funds inputs. The
customer pays once at reservation; the farm receives funds **in milestone tranches from escrow**,
not as a lump sum on day one.

**Product language:** use “Sponsor a batch”, “Reserve”, “Pre-order”. Never “invest”, “ROI”,
“profit”, or “yield” in the financial sense. This distinction is deliberate: cash-return schemes are
regulated and have a history of fraud in regional aquaculture; in-kind settlement keeps the product
in commerce. (See §11.5.)

### 11.1 Actors & permissions

- Any **Buyer** can sponsor (Buyer-only, consistent with ordering).
- A **Seller** (verified farm) publishes batches and posts growth updates.
- **Admin** reviews/approves batches, verifies farms, and can cancel a batch.
- New permission keys: `batch.browse`, `batch.sponsor`, `batch.create`, `batch.update`,
  `batch.review`, `batch.settle`. Map them into the §2 matrix at implementation time.

### 11.2 Entities

**GrowOutBatch**
```
id                  # "BATCH-1024" (human-readable sequence)
sellerId            # owning Seller user (verified farm)
title species breed description
images: [{ id, url }]  mainId
location region
status: draft | pending_review | open | fully_sponsored | growing | harvesting | harvested | settled | cancelled
stockingDate expectedHarvestDate
stockCount          # animals stocked
shareUnitType       # weight | count
shareUnit           # what ONE share delivers at harvest, e.g. "5 kg" or "4 fish"
expectedHarvestWeightG  # required when shareUnitType = weight
totalShares sharesAvailable
packagePricePerShare # FULL care cost for one share, VND integer đồng
costBreakdown: [{ category, label, amount, allocation, note }]
                    # equipment | feed | labour | health | transport | platform_fee | contingency
                    # allocation: per_share | batch_total (one-time / amortised)
contingencyPct      # buffer included in packagePricePerShare; farm bears overruns
riskDisclosure      # mortality / force-majeure / shortfall policy text
termsVersion        # version of the policy snapshot
verification: { farmVerified, inspectedAt, inspector }
createdAt updatedAt
```

**BatchUpdate** (growth log; visible to sponsors)
```
id batchId at
stage: nursery | fingerling | juvenile | grow_out | pre_harvest
averageWeightG countAlive note
photos: [{ id, url }]
createdBy
```

**Sponsorship** (the customer's reservation)
```
id batchId sponsorUserId
shares
packageAmount        # full care cost paid at reservation, VND
deliveryFee          # optional, due at delivery, VND
totalAmount          # packageAmount + deliveryFee
status: pending_payment | funded | growing
      | ready_for_delivery | delivered | settled
      | cancelled | refunded
paidAt
delivery: { name, phone, address, city, province, method }
termsSnapshot        # immutable copy of batch terms at reservation time
createdAt updatedAt
```

**Harvest** (one per batch)
```
id batchId harvestedAt
actualCount actualWeightG
yieldPerShare mortalityRate
status: draft | published
publishedAt
```

**CostLineItem** — part of a batch's cost breakdown:
```
{ category: equipment | feed | labour | health | transport | platform_fee | contingency,
  label, amount, allocation: per_share | batch_total, note }
```
Equipment is a **batch/farm capital cost**: the sponsor funds it, but it remains farm-owned and
reusable across batches.

**EscrowRelease** — the farm is not paid a lump sum at reservation. The sponsorship amount sits in
platform escrow (simulated) and is released in milestone tranches:
```
{ sponsorshipId, milestone: stocking | mid_growth | pre_harvest | harvest,
  amount, status: held | released, releasedAt }
```
Default split: 30% at stocking, 40% at mid-growth, 30% at harvest. A cancelled or failed batch
returns unreleased funds to the sponsor.

**FarmVerification** — one per seller/farm (see §11.11):
```
{ sellerId, level: none | registered | inspected,
  documents: [{ type, url, uploadedAt }],
  inspectedAt, inspector, notes,
  status: pending | approved | rejected | revoked,
  validUntil }
```

**Adjustment** — refund, shortfall settlement or extra charge tied to a sponsorship.

### 11.3 Batch lifecycle

```
 draft ──submit──▶ pending_review ──approve──▶ open ──shares sold──▶ fully_sponsored
                                                  │                        │
                                                  └────── growing ◀────────┘
                                                             │
                                                 harvesting ─┴─▶ harvested ──▶ settled
        cancelled  ◀── from draft / pending_review / open / growing (refund all reservations)
```

Rules:
- Seller creates drafts; **admin approves** `pending_review → open` (same trust model as listings).
  Only **verified farms** can submit a batch.
- `open → fully_sponsored` when `sharesAvailable` reaches 0; seller may also close early.
- `growing` begins at/after stocking; batch updates are allowed throughout.
- `harvesting → harvested` when actual yield is published; `settled` when every sponsorship is
  delivered or refunded.
- Cancellation before harvest refunds the unreleased escrow in full (per policy).

### 11.4 Sponsorship lifecycle

```
 pending_payment ──full package paid──▶ funded ──batch grows──▶ growing
      │                                   │
      └── expires (unpaid)                └── cancel (before growing; refund policy)
 growing ──harvest published──▶ ready_for_delivery ──confirm──▶ delivered ──▶ settled
```

- **Reserve**: choose shares + delivery address, pay the **full package price** (simulated).
  Freeze `termsSnapshot`. There is no balance on the care cost.
- **No balance step.** The only possible later charge is an optional delivery fee at harvest.
- **Escrow**: the package amount is held and released to the farm in milestone tranches (§11.2).
- **Delivery**: reuses the marketplace order/delivery machinery (M6).
- **Settlement**: apply actual yield per share (§11.5), then deliver/refund.
- **Cancel**: allowed before `growing`; unreleased escrow is refunded per batch policy.

### 11.5 Cost, overrun & risk policy (must be explicit on every batch)

- **Fixed package price.** `packagePricePerShare` is quoted up front and covers the full care
  package. The customer owes nothing extra on care costs at harvest — no top-up requests.
- **Cost overruns** (feed price spikes, disease, energy) are borne by the farm; a contingency
  percentage is built into the package and disclosed in `costBreakdown`.
- **Under-spend** stays with the farm (or funds extra fish; not v1).
- **Equipment** is funded by the sponsor but remains **farm-owned** and reusable across batches.
  It is a batch capital cost, not a purchase of physical gear.
- One share entitles the sponsor to `shareUnit` at harvest, **subject to disclosed mortality risk**.
- **Shortfall** (actual < promised): pro-rata **refund** of the undelivered portion from escrow, or
  partial delivery + refund. Policy is snapshotted into `termsSnapshot`.
- **Surplus** (actual > promised): deliver up to `shareUnit`; surplus stays with the farm.
- **Mortality / force majeure**: refund unreleased escrow per batch policy; optional insurance (not v1).
- **No cash returns.** Settlement is always fish/product or a refund of money paid — never a profit
  above the amount paid.

### 11.6 API surface (proposed)

Public / Buyer
- `GET  /batches` — filters: `species, region, status=open, harvestBefore, priceMax`; pagination
- `GET  /batches/{id}` — detail, terms, shares available, latest updates
- `GET  /batches/{id}/updates`
- `POST /batches/{id}/sponsorships` — `{ shares, delivery }` → `pending_payment`
- `POST /sponsorships/{id}/pay` — full package amount (idempotent)
- `GET  /sponsorships/{id}/escrow` — held/released tranches (sponsor-visible)
- `GET  /me/sponsorships`, `GET /sponsorships/{id}`
- `POST /sponsorships/{id}/cancel`
- `POST /sponsorships/{id}/confirm-delivery`
- `POST /sponsorships/{id}/dispute`

Seller
- `POST /seller/batches`, `GET/PATCH/DELETE /seller/batches/{id}`
- `POST /seller/batches/{id}/submit` (→ `pending_review`)
- `POST /seller/batches/{id}/updates`
- `POST /seller/batches/{id}/harvest` (publish actual yield)
- `GET  /seller/batches/{id}/sponsors`, `GET /seller/sponsorships`
- `POST /seller/farm/verification` (submit documents), `GET /seller/farm/verification`

Admin
- `GET  /admin/batches?status=pending_review`
- `POST /admin/batches/{id}/approve | reject | cancel`
- `POST /admin/farms/{sellerId}/verify`
- `GET  /admin/farms/{sellerId}/verification`

Notifications: batch update, payment confirmed, escrow tranche released, batch fully sponsored,
harvest published, ready for delivery, refund issued, batch cancelled.

### 11.7 Cross-cutting

- The full package payment goes through the **same simulated payment provider** as orders (no real gateway).
- **Escrow is mandatory**: each sponsorship's payment creates release tranches; no lump-sum payout.
- `termsSnapshot` is **immutable**; bump `termsVersion` when policy text changes.
- Payment endpoints idempotent (double-click / retry safe).
- Every transition logs to the activity feed and notifies affected users.
- Money in **VND integer đồng**; `sum(costBreakdown at batch_total) + contingency + platform_fee`
  must reconcile to `packagePricePerShare * totalShares` on publish.
- `sharesAvailable` must be decremented atomically (no overselling under concurrency).
- Farm verification is required before a batch can reach `open`.
- Batch updates are public to sponsors; sponsor↔farm chat is out of scope for v1 (reuse messaging later).

### 11.8 Decisions (all resolved, 2026-10-18)

**Funding & money**
- Funding is **share-based**; a single sponsor may buy all shares (whole-batch).
- **Equipment is farm-owned** and reusable; the sponsor funds it, does not own it.
- **Fixed package price** with a disclosed contingency; the farm bears overruns; no top-ups.
- **Escrow tranches 30 / 40 / 30** at stocking / mid-growth / harvest.
- **Cancellation** before `growing` refunds the unreleased escrow in full.
- **Every batch is admin-reviewed**; only verified farms can submit.
- **No transfer/gift** and **no per-sponsor cap** in v1.

**Shares**
- The seller chooses `shareUnitType` per batch: `weight` (default for food fish) or `count`
  (ornamental fish).
- `shareUnit` is the promised delivery per share (`5 kg` or `4 fish`); `expectedHarvestWeightG` is
  required for weight-based batches.
- `totalShares` is derived from stock and validated on publish (no overselling).

**Shortfall**
- Default: **pro-rata refund** of the undelivered portion, computed as
  `packageAmount * (1 - deliveredQty / shareUnit)`, paid from unreleased escrow.
- If partial stock is available, the sponsor may choose **partial delivery + refund** instead.
- Total loss: the sponsor is refunded in full; released tranches are reversed or recovered from the
  farm. This is a platform guarantee for verified farms and is simulated in v1.
- Surplus above `shareUnit` stays with the farm. Disputes use the marketplace dispute flow.

The standard package cost template is §11.10; farm verification is §11.11.

### 11.9 Frontend implication

None of this exists in the current UI. The teammate needs a new workstream: sponsor-facing batch
browse/detail/checkout/“my sponsorships”/update feed, seller batch management + update posting,
and admin batch review. The landing page also needs a section explaining the sponsor model, since
today it only markets buy/sell. The pre-order variant (§3.8) additionally needs a “Pre-order”
badge, expected ready date and deposit terms on listing cards and the product detail page.

### 11.10 Standard package cost template

Every batch's `costBreakdown` uses these categories so sponsors can compare packages:

| Category | Allocation | Guidance |
| --- | --- | --- |
| `equipment` | `batch_total`, amortised per share | Pumps, tanks, nets, aerators. Farm-owned; amortise over the batch or expected useful life. |
| `feed` | `per_share` | Usually the largest variable cost; quote at the current feed price. |
| `labour` | `per_share` | Daily care, monitoring, harvesting. |
| `health` | `per_share` | Quarantine, medication, vet visits. |
| `transport` | `per_share` | Farm to delivery hub. Excludes last-mile delivery, which is charged separately. |
| `platform_fee` | `per_share` | Fixed fee or percentage of the package. |
| `contingency` | `per_share` | Default **10%**; covers feed/energy swings and minor losses. The farm bears anything beyond it. |

Rules:
- Reconciliation on publish:
  `sum(amortised batch_total lines) + sum(per_share lines) == packagePricePerShare * totalShares`.
- A seller may only edit costs while the batch is `draft`; after `open`, cost changes require the
  batch to return to `pending_review`.
- `costBreakdown` is shown to sponsors in full; no hidden fees.

### 11.11 Farm verification

Only `inspected` farms can publish batches. Verification is admin-owned (M9).

**Levels**
- `registered` — business and identity documents checked; **cannot** publish batches.
- `inspected` — documents plus a site check passed; **can** publish batches.

**Required documents**
- Business registration / household business licence (or cooperative certificate).
- Owner identity document.
- Pond/land use rights or lease agreement.
- Environmental / water-use permit where required.
- Veterinary / quarantine records for current stock.
- Geo-tagged photos or video of the site and facilities.
- Bank account in the business name.

**Inspection checklist**
- Pond/tank capacity matches the stated `stockCount`.
- Water source and biosecurity (inflow/outflow, disease controls).
- Feed storage and sourcing.
- Mortality handling and record-keeping.
- Previous harvest evidence or references.
- Delivery capability for the promised `shareUnit`.

**Lifecycle & policy**
- Submit → admin reviews documents → optional site inspection → `approved` / `rejected` with notes.
- `validUntil`: re-verify annually; re-inspect after a failed batch or policy breach.
- Revocation hides open batches and blocks new ones; existing sponsorships are resolved by refund.
- Verification level and inspection date are shown on the public batch page.

