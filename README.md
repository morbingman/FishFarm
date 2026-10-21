# FishFarm

A Vietnamese aquatic-livestock business — koi, betta, goldfish and other farm-bred fish — with a
company-operated catalog and a prepaid batch-sponsorship product. The company that runs FishFarm
sells and farms the fish itself, so there is one company store rather than a multi-seller
marketplace.

This repository contains the NestJS API and the React frontend. The API is the source of truth for
business rules; the frontend is currently a standalone prototype using mock data (see
[Project status](#project-status)).

## Stack

| Part | Technology |
| --- | --- |
| API | NestJS 12, TypeScript, Prisma 7, PostgreSQL 17 |
| Frontend | React 19, Vite 8, Tailwind CSS 4 |
| Tooling | pnpm 12, Docker Compose, Vitest, oxlint |

## Prerequisites

- Node.js 22+
- pnpm 12+
- Docker Desktop (for the local Postgres database)

Use pnpm rather than npm — the lockfiles and the backend's build allowlist assume it.

## Run locally

Use two terminals, one for the API and one for the frontend.

### 1. Database

```bash
cd backend
docker compose up -d
```

### 2. API

```bash
cd backend
pnpm install
cp .env.example .env        # then set JWT_ACCESS_SECRET
pnpm db:migrate
pnpm db:seed                # demo users, listings and one sponsorship batch
pnpm start:dev              # http://localhost:4000
```

- API: `http://localhost:4000/v1`
- Swagger UI: `http://localhost:4000/docs`
- Health check: `http://localhost:4000/health`

The API listens on port **4000**. If you change `PORT` in `backend/.env`, update the frontend proxy
settings accordingly.

### 3. Frontend

```bash
cd frontend
pnpm install
pnpm dev                    # http://localhost:8443
```

Open **http://localhost:8443**.

The Vite dev server uses port **8443** with `strictPort`; set `PORT` when starting it only if that
port is already taken. The API's `CORS_ORIGINS` already allows 8443 and 5173.

## Demo accounts

| Email | Password | Role |
| --- | --- | --- |
| `buyer@fishmarket.demo` | `Buyer123` | User |
| `admin@fishmarket.demo` | `Admin123` | Admin |

Additional seeded accounts are listed in [`backend/README.md`](./backend/README.md).

## Project status

Implemented in the API:

- Authentication and users: register/login/refresh/logout, email verification, password reset,
  sessions, notification preferences. Two roles only: `User` and `Admin`.
- Listings: the company catalog with an optional internal review gate — create/save drafts,
  publish directly or submit for review, withdraw/pause/resume, approve/reject/request-changes/
  takedown, history, notifications and activity log.
- Marketplace: public search, filters, sorting, pagination, listing detail and the company store
  page.
- Uploads: multipart image/document storage with role and purpose rules; private documents are
  kept off the public static path.

Not implemented yet: cart and checkout, orders and simulated payments, reviews, messaging,
favourites, company analytics, and the batch-sponsorship flow.

**Frontend note:** the React app is the Figma Make prototype. It runs entirely on the in-memory
mock store (`frontend/src/store.ts`) and does not call the API yet, so the site is fully clickable
but changes are not persisted. Wiring it to the API is the next integration step.

## Structure

```
backend/        NestJS API, Prisma schema, migrations, seed and tests
frontend/       React + Vite prototype
docs/           progress report and screenshots
```

- API details, commands and environment variables: [`backend/README.md`](./backend/README.md)
- Full product specification: [`backend/REQUIREMENTS.md`](./backend/REQUIREMENTS.md)
- Team progress report: [`docs/PROGRESS.md`](./docs/PROGRESS.md)
