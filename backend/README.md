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
| `/v1/company/listings` | Company catalog CRUD, publish and submit/withdraw/pause/resume (Admin only) |
| `/v1/admin/listings` | Internal review queue, review detail and approve/reject/request-changes/takedown |
| `GET /v1/admin/activity` | Recent platform activity log |
| `GET /v1/marketplace/listings` | Public marketplace search, filters, sorting and pagination |
| `GET /v1/marketplace/listings/:id` | Public listing detail by `FM-…` code or internal id |
| `GET /v1/marketplace/store` | The company store profile with rating and catalog summary |
| `POST /v1/uploads` | Multipart upload (`file` + `purpose`); private purposes stay off the public path |

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
  Admin. Submitting for internal review also broadcasts a notification to the `Admin` role.
  Pre-order listings must have `depositPct` 20–30 and an `expectedReadyDate`.

### Marketplace

- The three `GET /v1/marketplace/*` routes are public (`@Public()`) and expose only `approved`,
  non-deleted listings. Pending, paused, rejected and soft-deleted listings return `404`.
- `GET /v1/marketplace/listings` filters on `q` (name, species, breed, company, location, region),
  `species` (repeat the param or comma-separate), `breed`, `priceMax`, `size` (`under15` |
  `15plus`), `location`, `rating` and `available` (`true` hides sold-out listings and is the
  default). `sort` is `recommended` (default), `price_asc`, `price_desc` or `newest`; the UI labels
  for size and sort are accepted too. `page`/`pageSize` are capped at 100.
- Items use a product projection: id (`FM-…`), name, species, breed, description, size, price,
  quantity, negotiable, age, gender, origin, health, location, region, shipping, images, a display
  label (`pre_order` | `new` | `verified`), sale-mode fields, views and the company summary with the
  company-level rating and review count.
- `rating` is the single company rating aggregated from `Review` rows. Because one company sells
  everything, a rating floor either matches the whole catalog or returns an empty page.
- `GET /v1/marketplace/store` returns the company profile (about, location, contact, join date),
  aggregate rating and a catalog summary (approved listing count and distinct species).

### Uploads

- `POST /v1/uploads` takes multipart fields `file` and `purpose` and is available to authenticated
  users. Purposes are `listing_image` and `batch_update` (Admin, images only), `farm_document`
  (Admin, images or PDF) and `dispute_attachment` (User, images or PDF).
- Files are stored on local disk under `UPLOAD_DIR` (default `backend/uploads`, gitignored) with
  random UUID names. The endpoint returns `{ id, url, mimeType, sizeBytes, purpose, isPrivate }`.
- `listing_image` and `batch_update` files are served publicly from `/uploads/<file>`.
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
listings (one pre-order example at `FM-20761`), a live grow-out batch (`BATCH-1024`) and one funded
sponsorship with escrow tranches.

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
  company/                # the single company scope used by every Admin
  listings/               # company catalog CRUD, lifecycle state machine, internal review
  marketplace/            # public search, listing detail and the company store page
  uploads/                # multipart file storage, purpose/role rules, private files
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
  Auth/users, listings, the public marketplace and uploads are implemented; cart, checkout and
  orders are next.
- `pnpm test:e2e` boots the real app against the local database and cleans up the users and listings
  it creates.
