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

The API listens on **4000**: 3000 and 3001 are used by the PlotFarm project (frontend and API
respectively). Change `PORT` in `.env` if needed.

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
| `/v1/marketplace`, ... | Feature endpoints (see §5 of the requirements) |

All feature routes sit behind the `/v1` prefix. Money is integer VND; timestamps are ISO 8601 UTC.

### Auth (M2)

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
  Implemented so far: M1 scaffolding and M2 auth/users; listings start at M3.
- `pnpm test:e2e` boots the real app against the local database and cleans up the users it creates.
