# FishFarm API

NestJS + Prisma + PostgreSQL backend for the FishFarm aquatic marketplace and the
batch-sponsorship product. The full specification lives in [`REQUIREMENTS.md`](./REQUIREMENTS.md);
this file covers how to run the service.

## Requirements

- Node.js 22+
- pnpm 12+ (the build allowlist uses pnpm 12's `allowBuilds` setting)
- Docker Desktop (local Postgres)

## First-time setup

```bash
cd backend
pnpm install                 # also runs `prisma generate`
cp .env.example .env         # then fill in JWT_ACCESS_SECRET
pnpm db:migrate              # create the schema
pnpm db:seed                 # demo users, listings, one sponsorship batch
pnpm start:dev               # http://localhost:4000
```

Docker Postgres:

```bash
docker compose up -d
```

The API listens on **4000**. Change `PORT` in `.env` if needed.

The FishFarm frontend is a Vite app on **5173** by default. Its development proxy
forwards `/v1` and `/uploads` to `http://127.0.0.1:4000` without rewriting the paths.
This keeps the refresh cookie's `/v1/auth` path valid. See the
[frontend setup guide](../frontend/README.md). Deployment routing is deferred.

## Endpoints

| URL | Purpose |
| --- | --- |
| `GET /health` | Liveness + database check (no `/v1` prefix) |
| `GET /v1` | API metadata |
| `GET /docs` | Swagger UI (OpenAPI JSON at `/docs-json`) |
| `POST /v1/auth/*` | register, login, refresh, logout, verify-email, forgot-password, reset-password |
| `GET/PATCH /v1/me` | Current profile; `GET/PATCH /v1/me/prefs` for notification prefs |
| `/v1/company/listings` | Company catalog CRUD, publish and submit/withdraw/pause/resume (Admin only) |
| `/v1/admin/listings` | Internal review queue, review detail and approve/reject/request-changes/takedown |
| `GET /v1/admin/activity` | Recent platform activity log |
| `GET /v1/admin/users`, `PATCH /v1/admin/users/:email/status` | Shared account directory and User suspension/reactivation (Admin only) |
| `GET /v1/marketplace/listings` | Public marketplace search, filters, sorting and pagination |
| `GET /v1/marketplace/listings/:id` | Public listing detail by `FM-…` code or internal id |
| `GET /v1/marketplace/store` | The company store profile with rating and catalog summary |
| `POST /v1/uploads` | Multipart upload (`file` + `purpose`); private purposes stay off the public path |
| `/v1/me/cart` | Cart read/add/update/remove/clear |
| `POST /v1/orders` | Checkout from the cart or explicit items (idempotent) |
| `/v1/me/orders` | Owner-scoped order history, detail, tracking, cancel, balance payment and delivery confirmation |
| `/v1/company/orders` | Company order queue, shipment data and fulfilment transitions (Admin only) |
| `/v1/me/orders/:id/dispute`, `/v1/me/disputes` | Customer dispute creation, history, detail and private evidence access |
| `/v1/admin/disputes` | Dispute queue, review, resolution/rejection and private evidence access |
| `GET /v1/batches`, `GET /v1/batches/:id`, `GET /v1/batches/:id/updates` | Public compliant open batches and growth updates |
| `/v1/company/batches` | Shared company drafts, partial edits, publish/submit and growth updates |
| `/v1/admin/batches` | Pending batch queue and approve/reject/cancel |
| `/v1/company/facilities`, `/v1/admin/facilities/:id` | Facility records, compliance submission, inspection and private documents |

All feature routes sit behind the `/v1` prefix. Money is integer VND; timestamps are ISO 8601 UTC.

### Auth

- `POST /v1/auth/login` returns a short-lived access token in the body. The refresh token is set in
  the httpOnly cookie `fishfarm_refresh` (path `/v1/auth`), rotated on every `/refresh`.
- Access tokens stay in frontend memory. Every protected request must send
  `Authorization: Bearer <token>`; the global `JwtAuthGuard` is default-deny, with `@Public()`
  opt-outs. Sessions are server-side (hashed refresh token) and slide on activity; after
  `SESSION_IDLE_MINUTES` (default 30) both refresh and access are rejected.
- Suspended accounts are rejected at login, at refresh and by the access guard.
- `POST /v1/auth/verify-email` without `code` sends a 6-digit code; with `code` it confirms the
  address. `forgot-password` always returns `{ sent: true }` for unknown emails so it cannot be used
  to probe accounts. Codes are 6 digits, valid 5 minutes, resend cooldown 45 seconds, max 5 attempts.
  In non-production the code is returned/logged as `devCode` for testing.
- Errors use the i18n contract `{ statusCode, code, params, details?, path, timestamp }`, where
  `code`/`details` are message keys (e.g. `auth.invalidCredentials`, `validation.email`).
- Capabilities are enforced with the `@RequirePermissions(...)` decorator backed by
  `src/auth/permissions.ts`. There are exactly two roles: `User` (customer) and `Admin` (company
  staff). Registration always creates a `User`; Admins are provisioned internally. Ordering and
  batch sponsorship are User-only.

### Roles and company scope

FishFarm is operated by a single company that owns every listing, order, batch and facility. There
are no per-user stores and no independent sellers.

- `User` — browses the catalog and batches, orders, sponsors, reviews, manages their own profile.
- `Admin` — runs the company's commercial side (catalog, inventory, orders, batches, harvest,
  settlements) plus platform administration (users, activity, disputes, compliance).

Every Admin can operate every company resource; `createdBy` on a listing or batch records which
Admin created it for audit only. The review stages (`pending`, `changes`, `rejected`) still exist
as an optional internal quality gate between Admins — `publish` moves a draft straight to `approved`.

### Account management

- `GET /v1/admin/users` requires `user.view`. Optional `q` searches name/email case-insensitively (trimmed, max 100 characters), `status=active|suspended` and `role=User|Admin` filter on the server. `page` defaults to 1 (1–1,000,000), `limit` to 25 (1–100). The response is `{items,total,page,limit}`, ordered by joined date descending then immutable ID. Items contain only `id,email,name,role,status,joinedAt`; no password, preferences, session or refresh data. Count and page share a repeatable-read snapshot.
- `PATCH /v1/admin/users/{encodedEmail}/status` requires `user.manage` and exactly `{status,expectedStatus}` using `active|suspended`. Email is normalized to lowercase. Requested status must differ from the expected current status. A row lock serializes changes; mismatched or same-state requests return `409 user.statusConflict`, missing accounts `404 user.notFound`. The response is the same minimal account projection.
- All Admin accounts, including the caller, are visible but protected from either status action (`409 user.protectedAccount`). This bounded integration manages User status only; Admin suspension/recovery policy and internal provisioning remain separate, not a last-Admin safeguard implemented implicitly by the UI.
- Suspension updates status, revokes every unrevoked target session and appends `Suspended user` activity in one transaction. Reactivation appends `Reactivated user` but never restores sessions: old access/refresh tokens stay invalid and a fresh login is required. Session issuance locks/rereads the account so a stale login cannot create a live session after suspension. Activity records actor, target email, action/time and `#admin/users`; no unpersisted reason or suspension-expiry field is accepted.
- Suspension does not delete accounts, cancel/refund orders, clear carts or undo previously authorized in-flight work. Access/session state is checked on subsequent protected requests, not pushed instantly into idle tabs. The expected-status check is not a version token and cannot detect an intervening suspend/reactivate cycle returning to the same status. Timed blocks, role changes, account deletion and automatic Admin provisioning are not exposed.
- Verified on 2026-10-28: 27 unit tests and 162 isolated e2e tests passed, including 91 Admin-user cases; TypeScript/build passed and lint reported zero warnings/errors. The existing `pg` concurrent-query deprecation warning remains. Development fixtures and browser acceptance limits are recorded in the [integration map](../docs/INTEGRATION_MAP_2026-10-26.md).

### Listings

- The company catalog lives at `/v1/company/listings`. Public ids are `FM-…` codes; internal cuids
  are also accepted by the route parameter.
- `POST /v1/company/listings` saves a partial draft (the six-step wizard can save at any point).
  `POST /v1/company/listings/{id}/publish` validates completeness and publishes directly:
  name, species, description ≥ 20 chars, age, size, gender, origin, health, price, quantity, at
  least one image, location, region and shipping.
- Lifecycle: `draft → approved` via `publish`, or `draft → pending → approved | changes | rejected`
  when an internal check is wanted. `withdraw` returns a pending listing to draft, `pause`/`resume`
  toggles catalog visibility, and only draft/changes/rejected listings can be deleted (soft delete).
- Editing an approved or paused listing keeps it live; only a listing that is `pending` is locked.
- Admin queue tabs: `pending`, `approved` (live), `changes` (changes + rejected). Review detail
  includes completeness checks. Decisions require a fixed reason plus ≥ 10 characters of feedback;
  takedown is limited to approved/paused listings and records `Policy violation`.
- Every transition appends a `ListingHistory` row and an `Activity` entry attributed to the acting
  Admin. Submitting for internal review creates an independent notification for each active Admin,
  honoring their preferences. Pre-order listings must have `depositPct` 20–30 and an `expectedReadyDate`.

### Marketplace

- The three `GET /v1/marketplace/*` routes are public (`@Public()`) and expose only `approved`,
  non-deleted listings. Pending, paused, rejected and soft-deleted listings return `404`.
- `GET /v1/marketplace/listings` filters on `q` (name, species, breed, company, location, region),
  `species` (repeat the param or comma-separate), `breed`, `priceMax`, `size` (`under15` |
  `15plus`), `location`, `rating` and `available` (`true` hides sold-out listings and is the
  default). `sort` is `recommended` (default), `price_asc`, `price_desc` or `newest`; the UI labels
  for size and sort are accepted too. `page`/`pageSize` are capped at 100.
- Items use a product projection: id (`FM-…`), name, species, breed, description, `sizeCm`, price,
  quantity, negotiable, `ageMonths`, gender, origin, health, location, region, shipping, images, a display
  label (`pre_order` | `new` | `verified`), sale-mode fields, views and the company summary with the
  company-level rating and review count.
- `rating` is the single company rating aggregated from `Review` rows. Because one company sells
  everything, a rating floor either matches the whole catalog or returns an empty page.
- `GET /v1/marketplace/store` returns the company profile (about, location, contact, join date),
  aggregate rating and a catalog summary (approved listing count and distinct species).

### Commerce

Payment is simulated: there is no gateway, so an order is created already `paid` (or
`deposit_paid` for a pre-order) and the `Payment` row records a `provider: "simulated"` transaction.

- Cart (`/v1/me/cart`, permission `order.create`): `GET /` returns lines with listing snapshot,
  `available` stock and `subtotal`; `POST /items` adds or increments; `PATCH /items/:listingId`
  sets a quantity; `DELETE /items/:listingId` and `DELETE /` remove one line or clear.
  Only `approved`, non-deleted listings can be added. Adding more than is in stock returns
  `409 cart.quantityExceedsStock` with `{ available, requested }`. `saleMode` in the summary is
  `in_stock`, `pre_order`, or `mixed`.
- Checkout (`POST /v1/orders`) accepts either `items: [{ listingId, quantity }]` or nothing, in
  which case it checks out the cart and clears it. Delivery details are required
  (`recipientName`, `phone`, `address`); `city`, `province`, `deliveryMethod` and `shippingFee` are
  optional. `paymentMethod` is `bank_card` | `e_wallet` | `bank_transfer`. A cart or item list may
  not mix `in_stock` and `pre_order` listings (`400 order.mixedSaleModes`).
- Stock is reserved inside the checkout transaction with a conditional `UPDATE … WHERE quantity >= n`,
  so concurrent checkouts cannot oversell; a failed reservation aborts the order.
- `idempotencyKey` (optional, 8–80 chars) is buyer-scoped. Concurrent retries return the existing
  order instead of reserving stock, charging, notifying or logging twice. New initial payment keys
  are `order:<buyerId>:<key>:initial`; safe same-owner legacy keys remain replayable.
  Balance keys remain `order:<code>:balance`.
- Pre-orders charge `depositPct` (20–30%) now. `mark-ready` sets `balance_due` and opens a
  7-day `balanceDueAt` window; `POST /v1/me/orders/{code}/pay-balance` creates the `order_balance`
  payment and moves the order to `paid`. Overdue balances are cancelled and refunded automatically
  when orders are read, and shipping before the balance is settled returns `409 order.balanceOutstanding`.
- Lifecycle: `paid → ready → shipped → delivered → completed`. `POST /v1/me/orders/{code}/cancel`
  works while the order is `paid` (not yet shipping); it refunds the recorded payments and returns
  the reserved stock. `POST /v1/company/orders/{code}/cancel` takes a `reason` and is the Admin
  equivalent. Invalid transitions return `409 order.invalidTransition` with `{ from, action }`.
- Buying is User-only (`order.create`) and fulfilment is Admin-only (`order.fulfill`); a User
  calling `/v1/company/orders` gets `403`. Order ids in URLs are the `ORD-…` codes.
- Order placement and lifecycle mutations are audited transactionally. Operational notifications
  fan out to active Admins as independent recipient rows, honoring each recipient's preferences.
- `POST /v1/company/orders/{id}/ship` accepts optional `trackingCarrier`, `trackingNumber` and
  `estimatedDeliveryAt`. `GET /v1/me/orders/{id}/tracking` returns persisted shipment information
  and recorded lifecycle events only. Another customer's order returns `404`.
- `POST /v1/me/orders/{id}/confirm-delivery` completes a delivered order. Repeating confirmation
  returns the same completed order. Both customer confirmation and company completion are blocked
  while a dispute is `open` or `reviewing`.
- Balance payment requires a ready pre-order with an unexpired deadline. Concurrent retries charge
  once; late payment instead returns the cancelled/refunded order. Cancellation restores stock once.

### Disputes

- `POST /v1/me/orders/{id}/dispute` accepts `reason`, a trimmed 15–2000-character `description`,
  and up to three unique `uploadIds`. Reasons: `fish_unwell`, `not_as_described`,
  `damaged_packaging`, `not_received`, `other`. `not_received` is eligible after shipment;
  other reasons require delivery or completion. There is one dispute per order.
- Evidence must be unused, owned by the buyer, and uploaded for `dispute_attachment`. The existing
  images/PDF policy and configured upload limit apply. Responses omit private URLs.
- Customer history/detail: `GET /v1/me/disputes` and `GET /v1/me/disputes/{id}`. Admins use
  `/v1/admin/disputes` and `POST /{id}/start-review | resolve | reject`. Final decisions require a
  nonblank `resolution`, set `resolvedAt`, and do not automatically issue a refund.
- Evidence streams through `GET /v1/me/disputes/{id}/attachments/{attachmentId}/content` or the
  equivalent `/v1/admin/disputes/...` endpoint, with authorization and `nosniff`. Another buyer gets
  `404`. Legacy URL-only attachments are not downloadable through these endpoints.

### Batches and facilities

- Every Admin operates the same facilities and batches. Facility create/list/detail is under
  `/v1/company/facilities`. Compliance is submitted through `POST /{id}/verification` with a
  `level` and `documents: [{ type, uploadId }]`; submission resets the file to `pending`.
- Compliance documents must be unused `farm_document` uploads belonging to any Admin. Replacement
  and inspection are serialized. `POST /v1/admin/facilities/{id}/inspect` accepts
  `approved | rejected | revoked`; approval requires non-`none` level, future `validUntil`, and
  controlled documents. Downloads use `/verification/documents/{documentId}/content` under either
  authorized facility route. Private URLs and legacy unlinked files are not exposed.
- `POST /v1/company/batches` creates a draft. `PATCH /{id}` is draft-only and partial; omitted
  fields and arrays remain intact. `totalShares` is derived as `floor(stockCount / shareQuantity)`
  for count shares or `floor(expectedHarvestWeightG / shareQuantity)` for weight shares.
  `shareQuantity` is fish or grams per share; expected weight is total batch biomass.
- Direct `POST /{id}/publish` opens a draft; optional `/submit` sends it to the Admin queue.
  `/v1/admin/batches/{id}/approve` opens pending batches, `/reject` returns them to draft.
  Opening requires images, consistent shares, current approved facility compliance, controlled
  documents and exact cost reconciliation:
  `sum(batch_total) + totalShares * sum(per_share) == packagePricePerShare * totalShares`.
- Draft deletion requires no sponsorships, updates or harvest. Cancellation is allowed only from
  draft/pending/open with no sponsorships, until the sponsorship refund workflow exists.
- Public batch list supports `q`, `species`, `region`, `harvestBefore`, `priceMax`, `page`, `limit`.
  Only open batches with available shares and current controlled compliance appear. Expiry or
  revocation immediately hides them. Public views omit private documents and internal review data.
  Growth updates use `POST /v1/company/batches/{id}/updates` and the public updates endpoint.
- Sponsorship reservation/payment, tranche releases, harvest and settlement APIs remain unimplemented.
  Batch sponsorship is prepaid fish/product commerce, never investment or profit-return commerce.

### Uploads

- `POST /v1/uploads` takes multipart fields `file` and `purpose` and is available to authenticated
  users. Purposes are `listing_image`, `batch_image` and `batch_update` (Admin, images only),
  `farm_document` (Admin, images or PDF) and `dispute_attachment` (User, images or PDF).
- Files are stored on local disk under `UPLOAD_DIR` (default `backend/uploads`, gitignored) with
  random UUID names. The endpoint returns `{ id, url, mimeType, sizeBytes, purpose, isPrivate }`.
- `listing_image`, `batch_image` and `batch_update` files are served publicly from `/uploads/<file>`.
  `farm_document` and `dispute_attachment` files are moved to `uploads/private` and that path
  returns `404` before the static middleware, so private evidence is never publicly reachable.
- Default limit is `UPLOAD_MAX_BYTES` (10 MB); oversized files return `413 uploads.fileTooLarge` and
  unsupported types return `415 uploads.unsupportedType`.
- Listing images may reference an uploaded file or an external `http(s)` URL. Uploaded URLs must
  exist for the `listing_image` purpose; since the catalog is company-owned any Admin may attach
  media another Admin uploaded. Non-http(s) schemes are rejected.

## Demo accounts

| Email | Password | Role |
| --- | --- | --- |
| `buyer@fishmarket.demo` | `Buyer123` | User |
| `admin@fishmarket.demo` | `Admin123` | Admin |
| `ops@fishmarket.demo` | `Ops12345` | Admin |
| `linh@fishmarket.demo` | `Demo1234` | User |
| `minh@fishmarket.demo` | `Demo1234` | User (suspended) |

Seeded data includes the single company (`fishfarm`), its main facility, seven company-owned
listings (one pre-order example at `FM-20761`), five orders for the demo buyers in different
states (completed, shipped, ready-with-balance-due, paid, cancelled), a two-line cart for
`buyer@fishmarket.demo`, an open-state grow-out batch (`BATCH-1024`) and one funded sponsorship with
escrow tranches. Seed compliance uses legacy URL-only documents, not controlled private uploads;
therefore that batch is hidden by the public API until real controlled compliance is submitted and
approved. Its share model is 40 × 5 kg from 200,000 g expected total biomass.

`pnpm db:seed` **resets demo data** and is guarded against `NODE_ENV=production` unless
`ALLOW_DEMO_SEED=1` is set.

## Isolated automated-test database

End-to-end tests use `fishfarm_test`, not the development database `fishfarm`.
`test-database.ts` loads the ordinary `.env`, preserves its host/credentials, and selects
`fishfarm_test` unless `TEST_DATABASE_URL` supplies a separate connection. The database
name must end in `_test` and its URL must differ from the development datasource; unsafe
configurations fail before the app starts.

Create this database once on the existing local Postgres instance. For the default
Docker setup (if it does not already exist):

```bash
docker exec fishfarm-postgres createdb -U fishfarm fishfarm_test
pnpm db:test:migrate
pnpm test:e2e
```

`db:test:migrate` deploys the retained migration history using `prisma.test.config.ts`.
It does not reset or seed either database. End-to-end suites create and clean up their
own fixtures. Use a separate disposable test instance in CI, or set `TEST_DATABASE_URL`
explicitly. Do not use `db:reset` or `db:seed` for routine regression checks.

The end-to-end runner uses at most two workers: eight concurrent suites exhausted
Argon2 allocation memory while both local dev servers were running. Password-hashing
settings were not weakened. The known `pg` concurrent-query deprecation warning still
appears and does not fail the tests.

## Commands

```bash
pnpm start:dev            # watch mode
pnpm build                # compile to dist/
pnpm start:prod           # run compiled build
pnpm test                 # unit tests (Vitest)
pnpm test:e2e             # e2e tests against isolated fishfarm_test
pnpm db:test:migrate      # deploy retained migrations to test database
pnpm lint                 # oxlint
pnpm prisma:generate      # regenerate the client after schema edits
pnpm db:migrate           # create + apply a migration in development
pnpm db:migrate:deploy    # apply migrations in CI/production
pnpm db:seed              # reset + load demo data
pnpm db:reset             # drop, migrate and seed
pnpm db:studio            # Prisma Studio
```

## Structure

```
prisma/
  schema.prisma           # marketplace + sponsorship data model
  seed.ts                 # demo data
  migrations/             # committed SQL migrations
src/
  auth/                   # login/refresh/OTP, guards, permission matrix
  users/                  # /me profile and notification prefs
  company/                # the single company scope used by every Admin
  listings/               # company catalog CRUD, lifecycle state machine, internal review
  marketplace/            # public search, listing detail and the company store page
  uploads/                # multipart file storage, purpose/role rules, private files
  orders/                 # cart, checkout, order lifecycle, tracking and simulated payments
  disputes/               # owner-scoped disputes, Admin decisions and private evidence
  batches/                # company batch management, public browsing and growth updates
  facilities/             # controlled compliance, inspection and private documents
  common/                 # AppException + API exception filter
  config/                 # env validation
  health/                 # GET /health
  prisma/                 # PrismaService + global module
  generated/prisma/       # generated client (gitignored)
```

## Notes

- Prisma 7 uses a driver adapter (`@prisma/adapter-pg`) and a `prisma7.config.ts` file; both are
  required. Do not downgrade the CLI below 7.
- The generated client is ignored by Git and rebuilt by `postinstall` and `prisma:generate`.
- The schema includes both products: marketplace entities (§3) and batch sponsorship (§11).
  Auth/users, listings, marketplace, uploads, cart/orders/tracking/disputes and batch/facility
  management are implemented. Engagement and sponsorship/payment/settlement APIs remain future work.
- `pnpm test:e2e` boots the real app against the isolated test database and cleans up its own
  fixtures. It does not reset or reseed the development database.
