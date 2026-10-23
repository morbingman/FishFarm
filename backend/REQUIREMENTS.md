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

Status: **v2.0 — revised 2026-10-22**. The mentor's direction replaces the three-role
marketplace with a **two-role company-operated model**: the company behind FishFarm sells the fish
and runs the farming service itself, so there is no independent Seller. Everything else from v1.0
(currency, auth, simulated payments, sponsorship mechanics) stands. See §2 and decision 10 in §9.

---

## 1. Project state (as of 2026-10-22)

| Area | State |
| --- | --- |
| Git | `main` has the backend through M5. The teammate's rewrite lives on the `frontend` branch. |
| `frontend/` | Rewritten React 19 + Vite + shadcn/ui app with a new farm-a-fish flow. Still a localStorage demo with no API calls. |
| `backend/` | NestJS API: auth, company catalog, marketplace read, uploads, cart and orders — with unit and e2e tests. |

The frontend still has **zero network calls**, so every operation it performs today is local
state mutation. The backend replaces the mock store function-for-function when the two are wired
together.

---

## 2. Roles (revised 2026-10-22)

Two roles, fixed (not user-definable): **`User`** and **`Admin`**.

**Business model:** FishFarm is operated by a single company. That company owns the fish
inventory, the grow-out facilities and the farming service. It is the only commercial seller on
the platform. There is no independent-seller marketplace and no public seller onboarding.

- **`User`** — customer. Browses the public catalog and batches, places orders, sponsors batches,
  tracks deliveries, writes reviews, and manages favourites, conversations and their own profile.
- **`Admin`** — company staff. Runs the commercial side (catalog, listings, inventory, orders,
  fulfilment, batches, harvest, settlements) and the platform side (users, activity, disputes,
  compliance). Admin is a company operator, not a moderator of third parties.

Rules:

- Public registration always creates a `User`. `Admin` accounts are provisioned internally (seed
  data or an existing Admin); a registrant can never choose or request an elevated role.
- Catalog listings and batches belong to **the company**, not to an individual Admin account.
  Every mutation records the acting Admin in the audit trail.
- Every Admin can operate every company resource. The old `ownerId === currentUser.id` checks
  become company-scope checks; otherwise records created by one Admin would be invisible to the
  rest of the team.
- Third-party moderation disappears. The old `pending → approved` review is no longer a trust
  boundary; it becomes an optional internal quality check between Admins. By default an Admin can
  create, edit and publish a listing directly.
- `store` is company branding, not a per-user field. The public seller page becomes the company
  store page.
- Ordering and sponsorship are **User-only**.
- The `status` field (`active | suspended`) still applies to every account.

### Permission matrix (revised)

| Capability | Type | User | Admin |
| --- | --- | --- | --- |
| Browse catalog and batches | View | ✓ | ✓ |
| Place orders | Create | ✓ | — |
| View own orders | View | ✓ | — |
| Sponsor batches | Create | ✓ | — |
| View own sponsorships | View | ✓ | — |
| Write reviews | Create | ✓ | — |
| Edit own profile | Edit | ✓ | ✓ |
| Create / edit / delete / publish listings | Manage | — | ✓ |
| Manage inventory and pricing | Manage | — | ✓ |
| Fulfil orders, mark ready, hand over | Manage | — | ✓ |
| Create / publish batches, post updates, harvest | Manage | — | ✓ |
| Manage sponsorships, escrow tranches, refunds | Manage | — | ✓ |
| View users, suspend / reactivate accounts | Manage | — | ✓ |
| View platform activity | View | — | ✓ |
| Handle disputes | Manage | — | ✓ |

**Requirement:** the backend remains the enforcement point. The permission keys (`market.view`,
`listing.approve`, `batch.settle`, …) are applied server-side per endpoint; the table above is
descriptive, not advisory.

**Confirmed:** ordering and sponsorship are User-only. Admins cannot place orders or sponsor
batches, even though they can browse the catalog. Do not widen this without an explicit product
decision.

---

## 3. Domain entities

Field names below are taken from the frontend verbatim so the eventual API maps 1:1.

### 3.1 User
```
email (PK, unique)  password  name  role: User|Admin
status: active|suspended   phone  location   joined (date)
prefs: { status, system, reminders }   # notification preferences
```
Company branding (store name, location, description) is a platform setting, not a per-user
field. Admins are provisioned internally; only `User` is publicly registerable.

### 3.2 Listing (canonical, company-owned)
```
id            # "FM-20817" — human-readable, sequential (frontend seq starts 48300)
company       # the single company identity that owns all listings
createdBy     # acting Admin (audit only)
status: draft|pending|approved|changes|rejected|paused
draft: Draft  # the mutable content
decision: { kind: rejected|changes, reason, feedback, step, by, at } | null
createdAt updatedAt submittedAt (nullable)  views: number
history: [{ at, by, action, note? }]      # append-only audit of the listing itself
```

### 3.3 Draft (listing content — the catalog form)
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
id  actor  role: User|Admin|System   action  target?  link?  at
```
Cap: 300 most recent. Every mutating operation logs one entry.

### 3.6 Session
`{ email, lastActive }`, **TTL 15 minutes** (`SESSION_TTL`), sliding (touch on activity).
Server must own this — currently `sessionStorage`.

### 3.7 Entities the store does **not** model but the UI needs
These are rendered from hardcoded/page-local data today and are the real new build:
- **Order** — built (§5). User flow: cart → checkout → confirmation → tracking → delivery →
  review. Company side is `/v1/company/orders`.
- **Payment** — built. Methods `bank_card | e_wallet | bank_transfer`; states `ready | failed |
  paid`; simulated (no gateway), so orders start already paid.
- **Cart** — built, persisted server-side at `/v1/me/cart`.
- **Review / Rating** — user posts rating + text after delivery; the company sees reviews at `#company/reviews`; listings show `rating`.
- **Message / Conversation** — user↔company messaging.
- **Favorite** — user favourites list (client-only `number[]` today).
- **Dispute** — user "Report a Problem" with reason + description + attachments.
- **Customer** (company view) and **Analytics** (Revenue, Orders, Views, Conversion; ranges This month / Last 7 days / Last 30 days / All time) — derived from orders + listing views.
- **File upload** — listing media (multiple images, drag-to-reorder) and dispute attachments.

---

### 3.8 Pre-order (deposit) marketplace variant

A normal listing may be sold as a **pre-order** for fish that are still growing or not yet ready for
delivery. This is catalog commerce, **not** batch sponsorship (§11): the user reserves specific
fish from a listing with a deposit and pays the balance when the company marks them ready.

Draft additions:
```
saleMode: in_stock | pre_order      # default in_stock
depositPct                          # e.g. 20–30, only when pre_order
expectedReadyDate                   # ISO date, only when pre_order
preorderPolicy                      # company terms text (cancellation / forfeit / refund)
```

Order additions:
```
saleMode, depositAmount, balanceAmount, balanceDueAt
paymentStatus: unpaid | deposit_paid | balance_due | paid | refunded
```

Rules:
- Pre-order requires a published listing and an Admin confirming the fish are still growing.
- The deposit is held (simulated) until ready; the balance is due within **7 days of the company
  marking the order ready**.
- User misses the balance deadline → order is cancelled and the **deposit is refunded** (no forfeit).
- Company fails to deliver → **full refund including deposit**.
- The listing must show a “Pre-order” badge, expected ready date and deposit terms.
- Pre-order does **not** create a batch, growth feed or escrow tranches — that is §11 only.

## 4. Listing lifecycle (state machine)

With one company owning the catalog, the review stages are an **optional internal quality gate**
between Admin accounts, not a trust boundary against third-party sellers. The transitions below
stay valid because the frontend already speaks them, but publishing directly from `draft` is
allowed for Admins.

```
                 submit                 approve
  draft ───────────────▶ pending ────────────────▶ approved ──┐
    ▲                      │  │                        │  ▲    │ pause
    │        withdraw      │  │ reject / request      │  └──── paused
    └─────────────────────┘  │ changes               │        │
                              ▼                      │ takedown
                        rejected / changes ◀─────────┘  (→ rejected)
```
Rules to enforce server-side:
- **publish (direct)**: Admin may move `draft → approved` in one step, since the reviewer and the
  author are the same company.
- **submit**: only from `draft | changes | rejected | approved`; sets `submittedAt`, clears `decision`, status → `pending`. Re-submissions are logged as "Resubmitted".
- **withdraw**: only `pending` → `draft`.
- **pause/resume**: `approved ↔ paused`.
- **delete**: forbidden for `pending` and `approved` (only draft/changes/rejected deletable). Deleted ids retained in a `deleted` list.
- **approve/reject/request-changes**: Admin only, only from `pending` (internal review). Request-changes/reject store a `decision` with reason + feedback + step.
- **takedown**: Admin, from `approved | paused` → `rejected` with reason "Policy violation" — now used for company compliance, not policing a third party.
- **editing a live listing** (`approved` or `paused`): the edit stays live. With one company
  authoring and reviewing its own content there is no trust boundary to re-check, so the catalog
  updates in place and the change is recorded in `history`. `submit` remains available when the
  company wants a second Admin to look at a change before it goes live.
- Only `approved` listings appear in the public catalog. Pausing/resuming is soft visibility.

Each transition appends to `history` and an activity-log entry, attributed to the acting Admin.
Seller↔admin notifications no longer apply; remaining notifications are operational (for example
a listing awaiting a second Admin's review).

---

## 5. API surface (proposed v1)

Auth
- `POST /auth/register` (name, email, phone, location, password) → always creates a `User`
- `POST /auth/login` → token + user; rejects `suspended`
- `POST /auth/logout`
- `POST /auth/verify-email`, `POST /auth/forgot-password`, `POST /auth/reset-password` (OTP flow: 6-digit, 5-min expiry, 45s resend)
- `GET  /me`, `PATCH /me`, `PATCH /me/prefs`

Catalog (public) — implemented as `/v1/marketplace/*`
- `GET  /marketplace/listings` — filters: `q, species[], breed, priceMax, size, location, rating, available`; sort `recommended|price_asc|price_desc|newest`; pagination
- `GET  /marketplace/listings/{id}` — product projection (name, species, breed, size, price, location, company rating, images, label, age, gender, origin)
- `GET  /marketplace/store` — the company store profile (about, location, rating, catalog summary)

Favorites
- `GET/POST/DELETE /me/favorites`

Cart & checkout (User) — implemented as `/v1/me/cart` and `/v1/orders`
- `GET /me/cart`, `POST /me/cart/items`, `PATCH|DELETE /me/cart/items/{listingId}`, `DELETE /me/cart`
- `POST /orders` — from cart or explicit items; honours the listing's `saleMode`. `in_stock` takes
  full payment; `pre_order` takes the deposit and sets `balanceDueAt`. Idempotent by
  `idempotencyKey`.
- `POST /me/orders/{id}/pay-balance` (pre-order balance; creates the `order_balance` payment)
- `GET /me/orders` (optional `status` filter), `GET /me/orders/{id}`
- `POST /me/orders/{id}/cancel` (refunds payments and returns stock)
- Not yet built: `/orders/{id}/tracking`, `/orders/{id}/confirm-delivery` (covered by the company
  lifecycle transitions for now), review and dispute creation.

Messaging
- `GET  /me/conversations`, `GET /conversations/{id}/messages`, `POST /conversations/{id}/messages`

Company operations (Admin only)
- `GET  /company/summary` (analytics: revenue, orders, views, conversion; ranges)
- `GET  /company/listings` (filter by status tab: all/pending/approved/attention)
- `POST /company/listings` (create), `GET/PATCH/DELETE /company/listings/{id}`
- `POST /company/listings/{id}/publish` (direct draft → approved)
- `POST /company/listings/{id}/submit`, `/withdraw`, `/pause`, `/resume`
- `GET /company/orders` — implemented as `/v1/company/orders`; also `GET /company/orders/{id}`,
  `POST /company/orders/{id}/mark-ready | ship | deliver | complete | cancel`
- `GET  /company/customers`, `GET /company/reviews`

Admin (Admin only)
- `GET  /admin/queue` (tab: pending|approved|changes) — optional internal review
- `GET  /admin/listings/{id}` (review detail + checks)
- `POST /admin/listings/{id}/approve | reject | request-changes | takedown`
- `GET  /admin/users`, `PATCH /admin/users/{email}/status`
- `GET  /admin/roles` (the matrix)
- `GET  /admin/activity`

Notifications (all signed-in accounts)
- `GET /me/notifications`, `PATCH /notifications/{id}` (read), `POST /notifications/read-all`, `DELETE /notifications/{id}`

Uploads
- `POST /uploads` (multipart) → `{ id, url }` for catalog media and dispute attachments.

Admin review-detail reasons (internal quality gate): Image quality, Incomplete fish details,
Pricing concern, Species policy — plus free-text feedback. Review checklist items are also fixed.

---

## 6. Cross-cutting requirements

1. **Auth**: token-based (JWT access [+ refresh]), server-enforced idle TTL, sliding renewal. Suspended accounts rejected at login and on refresh. Only `User` accounts are publicly registerable; `Admin` accounts are provisioned internally.
2. **Authorization**: permission keys from §2 checked per endpoint. Company-owned resources (listings, batches, orders, uploads) are accessible to **any** Admin; customer-owned resources (orders, sponsorships, favourites, profile) are scoped to the owning User.
3. **Notifications**: emitted server-side on operational and commerce events; honour `prefs`.
4. **Activity log**: one entry per mutation, with acting Admin, action, target and deep-link; admin-only read.
5. **Uploads**: media storage for catalog listings and disputes. Public catalog media is served openly; private documents (dispute attachments, compliance files) must not be served from the public static path.
6. **Pagination/filtering**: list endpoints paginate (admin activity UI pages of 8); catalog filters as above.
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
  (a customer and company-admin demo account, ~6 listings across statuses, notifications, activity).
- Seed accounts: `buyer@fishmarket.demo`/`Buyer123` (User), `admin@fishmarket.demo`/`Admin123` and
  `ops@fishmarket.demo`/`Ops12345` (Admin).
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
| M3 | **Listings core** | Full lifecycle state machine + history + notifications + activity log; company-owned catalog CRUD + internal review. **This unblocks the largest part of the existing UI.** | M2 |
| M4 | **Marketplace read** | Public catalog list w/ filters/sort/pagination + product projection + company store page. Turns the browse UI live. | M3 |
| M5 | **Uploads** | Image storage wired to catalog media. | M3 |
| M6 | **Commerce** | Cart, checkout, orders, payment states, pre-order deposit/balance, tracking, delivery, disputes. | M4 |
| M7 | **Engagement** | Reviews/ratings, messaging, favourites, company analytics + customers. | M6 |
| M8 | **Hardening** | OpenAPI finalised + generated client handed to frontend; tests; rate limiting; observability. | M7 |
| M9 | **Batch sponsorship schema + company batch management** | Grow-out batches, company publishing, compliance records; batches publishable but not yet sponsorable. | M3, M5 |
| M10 | **Sponsorship + full-care payments** | Reserve shares, full package payment, milestone release ledger, batch update feed, my-sponsorships. | M9, M6 |
| M11 | **Harvest & settlement** | Publish yield, delivery, shortfall refunds, disputes, close-out. | M10 |

Suggested critical path: **M0 → M1 → M2 → M3** gets the company catalog and operations flows (the
most complete part of the frontend) servable earliest; M4 makes browsing real; commerce/engagement
follow. Batch sponsorship (M9–M11) is a **second track** that can run in parallel once M3 and M6 are
stable; it is not required for the catalog launch.

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
4. **Ordering and sponsorship are User-only** — Admins cannot place orders or sponsor batches.
5. ~~**Live-listing edits require re-review.**~~ **Superseded 2026-10-22 (decision 10):** with one
   company owning the catalog there is no trust boundary, so editing an `approved`/`paused` listing
   keeps it live; `submit` remains an optional second-Admin check.
6. **Auth transport = JWT access token (kept in memory) + refresh token in an httpOnly cookie.**
   Server-side idle timeout, configurable; default 30–60 min (not the demo's 15).
7. **i18n = message keys + params.** System strings and notifications are never hard English
   sentences. User-generated content is stored once with `contentLocale`; add a
   `listing_translations` table later if both languages are needed for listings.
8. **Pre-order = 25% deposit.** Balance due within 7 days of the company marking ready; if missed,
   cancel and refund the deposit (no forfeit).
9. **Sponsorship funding = share-based, with a whole-batch option** (one sponsor may buy all shares).
10. **Two roles only — `User` and `Admin` (2026-10-22).** The company that runs FishFarm is the only
    commercial seller and farming operator, so there is no independent Seller role and no public
    seller onboarding. Admin covers both company operations and platform administration. Catalog
    listings and batches belong to the company; every Admin can operate them, with the acting Admin
    recorded in the audit trail. Ordering and sponsorship stay User-only.

### Adopted defaults (2026-10-22 — no open items)
1. **Image storage** — storage interface; local disk in dev, S3-compatible object storage in prod.
2. **Search** — Postgres full-text + trigram initially; swap in an index only if needed.
3. **Realtime** — polling for messaging (M7) first; WebSockets later.
4. **Takedown resubmission** — blocked after an admin takedown unless an admin reactivates.
5. **Admin notifications** — operational events create one row per Admin, so read state is per person.
6. **Company order scope** — Admin receives incoming orders through a dedicated company-operations
   permission (the old `order.fulfill`).
7. **Internal publication** — an Admin may publish a listing or batch directly; the
   submit→approve stages remain available as an optional second-Admin check.

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

- Any **User** can sponsor (User-only, consistent with ordering).
- **Admin** (the company) creates and publishes batches, posts growth updates, harvests, and
  settles sponsorships.
- New permission keys: `batch.browse`, `batch.sponsor`, `batch.create`, `batch.update`,
  `batch.review`, `batch.settle`. Map them into the §2 matrix at implementation time.
- There is no farm-verification gate between companies; the company documents its own facilities
  and inspections as compliance evidence shown on the public batch page.

### 11.2 Entities

**GrowOutBatch**
```
id                  # "BATCH-1024" (human-readable sequence)
companyId           # the company operating the batch
createdBy           # acting Admin (audit only)
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
contingencyPct      # buffer included in packagePricePerShare; company bears overruns
riskDisclosure      # mortality / force-majeure / shortfall policy text
termsVersion        # version of the policy snapshot
verification: { farmVerified, inspectedAt, inspector }   # compliance evidence, not a gate
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

**FarmVerification** — compliance evidence for the company's facilities (see §11.11):
```
{ facilityId, level: none | registered | inspected,
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
- Admin creates and publishes batches. `pending_review → open` remains an optional internal
  second-Admin check; an Admin may publish directly. Compliance evidence is attached by the
  company, not verified against a third party.
- `open → fully_sponsored` when `sharesAvailable` reaches 0; the company may also close early.
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

Public / User
- `GET  /batches` — filters: `species, region, status=open, harvestBefore, priceMax`; pagination
- `GET  /batches/{id}` — detail, terms, shares available, latest updates
- `GET  /batches/{id}/updates`
- `POST /batches/{id}/sponsorships` — `{ shares, delivery }` → `pending_payment`
- `POST /sponsorships/{id}/pay` — full package amount (idempotent)
- `GET  /sponsorships/{id}/escrow` — held/released tranches (sponsor-visible)
- `GET  /me/sponsorships`, `GET  /sponsorships/{id}`
- `POST /sponsorships/{id}/cancel`
- `POST /sponsorships/{id}/confirm-delivery`
- `POST /sponsorships/{id}/dispute`

Company operations (Admin)
- `POST /company/batches`, `GET/PATCH/DELETE /company/batches/{id}`
- `POST /company/batches/{id}/publish` (direct `draft → open`)
- `POST /company/batches/{id}/submit` (→ `pending_review`, optional internal check)
- `POST /company/batches/{id}/updates`
- `POST /company/batches/{id}/harvest` (publish actual yield)
- `GET  /company/batches/{id}/sponsors`, `GET /company/sponsorships`
- `GET/POST /company/facilities/{id}/verification` (compliance documents and inspection record)

Admin (management)
- `GET  /admin/batches?status=pending_review`
- `POST /admin/batches/{id}/approve | reject | cancel`
- `POST /admin/facilities/{id}/inspect`
- `GET  /admin/facilities/{id}/verification`

Notifications: batch update, payment confirmed, escrow tranche released, batch fully sponsored,
harvest published, ready for delivery, refund issued, batch cancelled.

### 11.7 Cross-cutting

- The full package payment goes through the **same simulated payment provider** as orders (no real gateway).
- **Milestone releases are mandatory**: each sponsorship's payment creates release tranches; the
  company cannot draw the whole package at once. With one company on both sides this is an internal
  release ledger rather than a third-party escrow; the sponsor-visible tranche view stays.
- `termsSnapshot` is **immutable**; bump `termsVersion` when policy text changes.
- Payment endpoints idempotent (double-click / retry safe).
- Every transition logs to the activity feed and notifies affected users.
- Money in **VND integer đồng**; `sum(costBreakdown at batch_total) + contingency + platform_fee`
  must reconcile to `packagePricePerShare * totalShares` on publish.
- `sharesAvailable` must be decremented atomically (no overselling under concurrency).
- Compliance evidence must be on file before a batch can reach `open`; the company publishes its
  own inspection record rather than an Admin approving a third-party farm.
- Batch updates are public to sponsors; sponsor↔company chat is out of scope for v1 (reuse messaging later).

### 11.8 Decisions (all resolved, 2026-10-18)

**Funding & money**
- Funding is **share-based**; a single sponsor may buy all shares (whole-batch).
- **Equipment is farm-owned** and reusable; the sponsor funds it, does not own it.
- **Fixed package price** with a disclosed contingency; the farm bears overruns; no top-ups.
- **Escrow tranches 30 / 40 / 30** at stocking / mid-growth / harvest.
- **Cancellation** before `growing` refunds the unreleased escrow in full.
- **Every batch is admin-reviewed**; a batch can only be published once the facility's compliance
  file is current. Since the company operates both sides, publishing directly is also allowed and
  the review remains an optional internal check.
- **No transfer/gift** and **no per-sponsor cap** in v1.

**Shares**
- The company chooses `shareUnitType` per batch: `weight` (default for food fish) or `count`
  (ornamental fish).
- `shareUnit` is the promised delivery per share (`5 kg` or `4 fish`); `expectedHarvestWeightG` is
  required for weight-based batches.
- `totalShares` is derived from stock and validated on publish (no overselling).

**Shortfall**
- Default: **pro-rata refund** of the undelivered portion, computed as
  `packageAmount * (1 - deliveredQty / shareUnit)`, paid from unreleased escrow.
- If partial stock is available, the sponsor may choose **partial delivery + refund** instead.
- Total loss: the sponsor is refunded in full; released tranches are reversed. This remains a
  platform guarantee and is simulated in v1.
- Surplus above `shareUnit` stays with the company. Disputes use the marketplace dispute flow.

The standard package cost template is §11.10; compliance evidence is §11.11.

### 11.9 Frontend implication

The teammate's `frontend` branch now ships a farm-a-fish flow (catalog, booking with deposit and
balance, order tracking, growth updates, handover). The remaining work is sponsor-facing polish
(“my sponsorships”, update feed) plus company-side batch management and an admin batch queue. The
landing page needs a section explaining the sponsor model. The pre-order variant (§3.8) additionally
needs a “Pre-order” badge, expected ready date and deposit terms on catalog cards and the product
detail page.

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
| `contingency` | `per_share` | Default **10%**; covers feed/energy swings and minor losses. The company bears anything beyond it. |

Rules:
- Reconciliation on publish:
  `sum(amortised batch_total lines) + sum(per_share lines) == packagePricePerShare * totalShares`.
- Costs may only be edited while the batch is `draft`; after `open`, cost changes require the
  batch to return to `pending_review`.
- `costBreakdown` is shown to sponsors in full; no hidden fees.

### 11.11 Facility compliance

With one company operating the farms, verification is no longer a gate against third-party sellers.
It is **compliance evidence** the company publishes on each batch, and it is admin-managed (M9).

**Levels**
- `registered` — business and identity documents on file.
- `inspected` — documents plus a site check recorded.

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
- An Admin records the compliance file and inspection result; no cross-company approval is involved.
- `validUntil`: review annually; re-inspect after a failed batch or policy incident.
- A lapsed or revoked file hides affected open batches and blocks new ones; existing sponsorships
  are resolved by refund.
- Compliance level and inspection date are shown on the public batch page.

