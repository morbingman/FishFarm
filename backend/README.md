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

The FishFarm frontend is a Vite app whose exported config uses port **8443** (`strictPort`).
`CORS_ORIGINS` therefore allows 8443 and 5173; if you override the frontend port with
`PORT=5173 pnpm dev`, both are covered.

## Endpoints

| URL | Purpose |
| --- | --- |
| `GET /health` | Liveness + database check (no `/v1` prefix) |
| `GET /v1` | API metadata |
| `GET /docs` | Swagger UI (OpenAPI JSON at `/docs-json`) |
| `POST /v1/auth/*` | register, login, refresh, logout, verify-email, forgot-password, reset-password |
| `GET/PATCH /v1/me` | Current profile; `GET/PATCH /v1/me/prefs` for notification prefs |
| `/v1/seller/listings` | Seller CRUD plus submit/withdraw/pause/resume |
| `/v1/admin/listings` | Moderation queue, review detail and approve/reject/request-changes/takedown |
| `GET /v1/admin/activity` | Recent platform activity log |
| `GET /v1/marketplace/listings` | Public marketplace search, filters, sorting and pagination |
| `GET /v1/marketplace/listings/:id` | Public listing detail by `FM-…` code or internal id |
| `GET /v1/marketplace/sellers/:name` | Public seller page with an approved-listing page |

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
  `src/auth/permissions.ts` (the server-side copy of the frontend `MATRIX`). Ordering remains
  Buyer-only.

### Listings

- Sellers manage only their own listings. Public ids are `FM-…` codes; internal cuids are also
  accepted by the route parameter.
- `POST /v1/seller/listings` saves a partial draft (the six-step wizard can save at any point).
  `POST /v1/seller/listings/{id}/submit` enforces completeness: name, species, description ≥ 20
  chars, age, size, gender, origin, health, price, quantity, at least one image, location, region
  and shipping.
- Lifecycle: `draft → pending → approved | changes | rejected`; sellers can withdraw a pending
  listing back to draft, pause/resume an approved one, and delete only draft/changes/rejected
  listings (soft delete).
- Editing an `approved` or `paused` listing immediately returns it to `pending` and hides it from
  the marketplace until re-approved. Pending listings cannot be edited; withdraw first.
- Admin queue tabs: `pending`, `approved` (live), `changes` (changes + rejected). Review detail
  includes completeness checks. Decisions require a fixed reason plus ≥ 10 characters of feedback;
  takedown is limited to approved/paused listings and records `Policy violation`.
- Every transition appends a `ListingHistory` row, writes an `Activity` entry, and notifies the
  counterparty (seller ↔ admin) subject to `prefs`. Pre-order listings must have `depositPct` 20–30
  and an `expectedReadyDate`.

### Marketplace

- The three `GET /v1/marketplace/*` routes are public (`@Public()`) and expose only `approved`,
  non-deleted listings. Pending, paused, rejected and soft-deleted listings return `404`.
- `GET /v1/marketplace/listings` filters on `q` (name, species, breed, seller, location, region),
  `species` (repeat the param or comma-separate), `breed`, `priceMax`, `size` (`under15` |
  `15plus`), `location`, `sellerRating` and `available` (`true` hides sold-out listings and is the
  default). `sort` is `recommended` (default), `price_asc`, `price_desc` or `newest`; the UI labels
  for size and sort are accepted too. `page`/`pageSize` are capped at 100.
- Items use a product projection: id (`FM-…`), name, species, breed, description, size, price,
  quantity, negotiable, age, gender, origin, health, location, region, shipping, images, a display
  label (`pre_order` | `new` | `verified`), sale-mode fields, views and the seller summary with
  aggregate rating/review count.
- `sellerRating` is computed from `Review` rows; when no seller meets the threshold the response is
  an empty page.
- The seller route resolves an active seller by store name or owner name (case-insensitive) and
  returns the seller profile plus a paginated list of their approved listings.

## Demo accounts

| Email | Password | Role |
| --- | --- | --- |
| `buyer@fishmarket.demo` | `Buyer123` | Buyer |
| `seller@fishmarket.demo` | `Seller123` | Seller (Golden Koi Farm) |
| `admin@fishmarket.demo` | `Admin123` | Admin |
| `lagoon@fishmarket.demo` | `Demo1234` | Seller |
| `mekong@fishmarket.demo` | `Demo1234` | Seller |
| `linh@fishmarket.demo` | `Demo1234` | Buyer |
| `minh@fishmarket.demo` | `Demo1234` | Buyer (suspended) |

Seeded data includes seven listings (one pre-order example at `FM-20761`), a live grow-out batch
(`BATCH-1024`) and one funded sponsorship with escrow tranches.

`pnpm db:seed` **resets demo data** and is guarded against `NODE_ENV=production` unless
`ALLOW_DEMO_SEED=1` is set.

## Commands

```bash
pnpm start:dev            # watch mode
pnpm build                # compile to dist/
pnpm start:prod           # run compiled build
pnpm test                 # unit tests (Vitest)
pnpm test:e2e             # e2e tests (needs Postgres running)
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
  listings/               # seller CRUD, lifecycle state machine, admin moderation
  marketplace/            # public search, listing detail and seller pages
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
  Auth/users, listings and the public marketplace read endpoints are implemented; ordering and
  batch sponsorship are next.
- `pnpm test:e2e` boots the real app against the local database and cleans up the users and listings
  it creates.
