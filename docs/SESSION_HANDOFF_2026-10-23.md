# FishFarm implementation handoff — 2026-10-23

> **Current status:** The requested tracking/disputes and batch/facility backend scope is implemented
> and verified. See [Verified completion checkpoint](#verified-completion-checkpoint--2026-10-23)
> below. The original handoff is retained as historical context; its missing-module and failing-check
> statements describe the earlier state, not the current working tree. Do not repeat that work.

## Resume instruction

Read this handoff, then implement directly. Do not perform another broad investigation or launch another planning/approval cycle. The user has already approved finishing backend tracking/disputes, then batch management, and repeatedly asked to continue. They paused this session because it stalled and suspect context problems. Preserve all existing changes; do not reset the database, roll back the migration, merge into main, commit, or push without authorization. Chat in English. README must not mention PlotFarm or milestone labels.

## Repository and checkpoint

- Workspace: `C:\Mythic\Works\Projects\FishFarm`.
- Branch: `integration/frontend-admin-ui`.
- HEAD: `52a75a1 feat: add cart checkout and order lifecycle`.
- Prior merge: `29f4f1c` merges `origin/frontend` (`9cce1d7 Update User and Admin UI`) and preserves `docs/PROGRESS.md` and historical screenshots.
- Two-role checkpoint: `b6ac6de feat: move to a two-role company-operated model`.
- Nothing pushed. New implementation is uncommitted.
- Last fully verified checkpoint before the new partial work: 56 backend e2e tests passed; frontend npm check passed. These results do NOT validate the current partial changes.

## Verified state at handoff

`pnpm --dir C:/Mythic/Works/Projects/FishFarm/backend exec prisma migrate status` succeeded: four migrations, database schema up to date.

Migration `20261023000100_tracking_private_evidence` was generated from the live datasource diff, inspected, written and successfully applied using `prisma migrate deploy`. No database reset or reseed occurred.

`pnpm --dir C:/Mythic/Works/Projects/FishFarm/backend exec tsc --noEmit` FAILED with exactly:

```text
src/orders/orders.controller.ts(48,24): error TS2339: Property 'trackingMine' does not exist on type 'OrdersService'.
src/orders/orders.controller.ts(56,24): error TS2339: Property 'confirmDelivery' does not exist on type 'OrdersService'.
```

These are unfinished implementations, not infrastructure failures. `OrdersService` remains completely unchanged from HEAD. Do not report tracking/disputes as implemented.

No new e2e/build/lint checks have run. No `src/disputes`, `src/batches`, or `src/facilities` modules exist.

## Exact uncommitted work

Modified:

- `backend/prisma/schema.prisma`
- `backend/src/common/notifications.ts`
- `backend/src/orders/company-orders.controller.ts`
- `backend/src/orders/dto/order.dto.ts`
- `backend/src/orders/orders.controller.ts`
- `backend/src/uploads/uploads.module.ts`
- `backend/src/uploads/uploads.service.ts`

New:

- `backend/prisma/migrations/20261023000100_tracking_private_evidence/migration.sql`
- `backend/src/common/activity.ts`
- `backend/src/uploads/private-files.service.ts`

### Schema and applied migration

Nullable additive fields preserve old records:

- Order: `trackingCarrier`, `trackingNumber`, `estimatedDeliveryAt`, `shippedAt`.
- GrowOutBatch: `shareQuantity Int?`, grams or fish per share; `expectedHarvestWeightG` comment now describes total expected batch biomass.
- DisputeAttachment: optional unique `uploadId`, relation to Upload with Restrict delete.
- VerificationDocument: optional unique `uploadId`, relation to Upload with Restrict delete.
- Upload: inverse optional `disputeAttachment` and `verificationDocument`.
- Prisma formatter also changed alignment throughout schema.
- Local generated Prisma client was already regenerated before this resumed portion; tsc recognizes added types.

### Upload plumbing now actually wired

`UploadsModule` now provides and exports `PrivateFilesService` alongside `UploadsService`. Resource modules must import UploadsModule to use it.

`UploadsService` now accepts `batch_image` for Admins, image MIME only, public storage. Existing `dispute_attachment` remains User-only, images/PDF up to generic configured upload size (default 10 MB). `farm_document` remains Admin-only, private images/PDF.

`private-files.service.ts`:

- `privateUploadFilename(url)` strictly matches `/uploads/private/<lowercase UUID>.(jpg|png|webp|gif|pdf)`.
- `privateUploadsFor(tx, ids, purpose, ownerId?)` rejects duplicate ids, mismatched purpose/ownership, noncanonical URL, unsupported MIME, extension mismatch or nonpositive size. Without ownerId it permits uploads owned by any Admin, matching company ownership.
- DOES NOT check reuse, resource-specific size/MIME limits, or authorize downloads. Add those at the resource layer.
- `PrivateFilesService.stream(upload)` validates canonical filename/MIME, opens only configured private dir, returns attachment StreamableFile, maps missing files to structured 404. Caller MUST authorize first.
- Existing main/test static middleware blocks `/uploads/private`; preserve it. Add `X-Content-Type-Options: nosniff` at private content endpoints.
- No content endpoint currently calls the service.

### Notification fan-out changed but untested

`notify(tx,input)` now finds direct recipient or active recipients of requested role; filters each recipient's status/system/reminder preferences; calls createMany with one `recipientId` row per enabled recipient. It no longer writes a single shared `recipientRole` row. Neither target produces no rows. Direct recipient takes precedence if both fields supplied.

Needs tests, especially independent Admin read states, active-only role recipients, and preference behavior. Existing tests/mocks may assume `user.findUnique` and `notification.create`; adapt where necessary.

### Activity helper

`logActivity(tx,actor,action,target,link)` inserts transactional Activity. Actor is Pick<AuthenticatedUser,'id'|'name'|'role'> or null; null uses label/role System. Not called anywhere yet.

### Partial order endpoints / DTO

`ShipOrderDto` exists with optional:

- `trackingCarrier`: string, min1/max80.
- `trackingNumber`: string, min1/max100.
- `estimatedDeliveryAt`: strict ISO8601 string.

Company controller ONLY imports ShipOrderDto. Its ship method STILL takes no body and calls `orders.ship(admin,id)`. Wire `@Body() dto: ShipOrderDto` and pass it through. Existing no-body ship calls should keep working; optional fields preserve compatibility. Whitespace-only fields currently pass length validation; normalize/validate deliberately.

OrdersController now has:

- GET `me/orders/:id/tracking`, permission `order.view`, calls missing `trackingMine(user.id,id)`.
- POST `me/orders/:id/confirm-delivery`, 200, permission `order.view`, calls missing `confirmDelivery(user,id)`.

No service methods exist, so the backend does not currently compile.

## Required immediate implementation

1. Implement `OrdersService.trackingMine` with owner-scoped 404, actual persisted shipment fields and recorded lifecycle timestamps only. No fabricated timeline dates.
2. Implement buyer delivery confirmation: delivered -> completed; repeat deterministic; blocks open/reviewing dispute. Keep company complete endpoint for existing tests/compatibility and enforce dispute guard there too.
3. Wire ship DTO through company controller and persist fields/shippedAt.
4. Fix order mutation consistency and security while changing service:
   - Checkout currently uses globally unique `order:<clientKey>:initial` and returns replay order WITHOUT buyer ownership check. Scope keys to buyer or explicitly reject other-owner collisions; handle concurrent repeated checkout transactionally without double reservation/payment/notifications. Preserve safe handling of existing keys as needed.
   - Balance currently allows payment before ready/after deadline and throws on repeated paid state. Require ready/balance_due/unexpired deadline; refund expired deposits; make retries/concurrency charge once using existing `order:<code>:balance` key.
   - Cancel currently restores stock before an unconditional status update. Use transactional lock or conditional update guard so concurrent cancel restores stock exactly once. Avoid refund/payment race.
   - Ready/ship/deliver/complete currently lack consistent audit and notifications, and most transitions unconditionally update stale state. Add transactional guards and activity.
   - Multiple permission args have AND semantics. Actual permission is `order.fulfill`, not `order.fulfil`.
5. Implement disputes DTO/service/User and Admin controllers, module and app wiring; secure attachment stream via PrivateFilesService.
6. Run targeted tsc and order/dispute e2e, then docs before declaring this checkpoint complete.
7. Then implement batch/facility management and tests described below. No frontend API integration yet.

## Dispute scope

- User-only create/read under own order; Admin list/read/start-review/resolve/reject, authorized evidence access.
- Permissions already exist: User `dispute.create`; Admin `dispute.manage`.
- Reasons proposed: `fish_unwell`, `not_as_described`, `damaged_packaging`, `not_received`, `other`.
- Proposed eligibility: not_received after shipped/delivered/completed; others after delivered/completed.
- Description 15–2000; max3 unique upload IDs; validate owner, purpose, canonical private URL, unused upload relation. One dispute per order (schema unique orderId).
- Lifecycle: open -> reviewing -> resolved/rejected. Final action requires nonblank resolution and resolvedAt. Do NOT silently issue refunds on resolution; that is not modeled yet.
- Resource-specific evidence policy (JPEG/PNG/WebP <=5MB) was a suggestion, not a locked requirement. Current generic upload accepts PDF/GIF/10MB; reconcile consciously and document if introducing tighter dispute limits.
- Schema Dispute: id,unique orderId,buyerId,reason,description,status,resolution?,createdAt,resolvedAt?,attachments.
- Each attachment stores URL snapshot and optional unique Upload relation. Legacy URL-only rows must not be streamed without controlled linkage.

## Batch/facility scope after commerce

Requirements are in `backend/REQUIREMENTS.md` §11; milestone status in §8.

- Company Admin batch draft CRUD, publish, submit, updates.
- Admin queue/approve/reject/cancel.
- Public GET `/batches`, `/batches/:id`, `/batches/:id/updates` with search/filtering and safe projections.
- Facility creation/list/detail, verification documents, review/inspection and authorized document retrieval.
- Draft -> open direct publication when compliance valid; draft -> pending_review -> open; rejection -> draft (no rejected enum).
- Draft-only financial edits initially. Cancel draft/pending/open only if no sponsorship until refund workflow implemented. Delete draft only without dependent sponsorship/update/harvest.
- Require current approved facility compliance and controlled documents before open; expired/revoked compliance hides affected public open batches. Copy inspection snapshot but do not rely only on snapshot for visibility.
- Public must not expose reviewer IDs, internal notes or private document URLs.
- Costs must reconcile:
  `sum(batch_total amounts) + totalShares * sum(per_share amounts) == packagePricePerShare * totalShares`.
- Structured shares proposed: count totalShares=floor(stockCount/shareQuantity); weight totalShares=floor(expectedHarvestWeightG/shareQuantity); derive display shareUnit. These are sensible clarification proposals, not yet documented as locked requirements.
- Correct demo batch seed if adopting this model: currently stockCount400, weight shareUnit5kg, expectedHarvestWeightG5000,totalShares40. Use shareQuantity5000 and total biomass200000 for40x5kg, not existing5000 as total biomass.
- Current compliance seed uses external URLs, not controlled upload relations. Do not claim those are safely retrievable private evidence.
- M9 only management/compliance/browsing. Sponsorship payment/releases (M10) and harvest settlement (M11) remain future work.

## Locked business/security rules

- Exactly User and Admin. One company owns listings/orders/facilities/batches; all Admins operate company-owned resources, not per-Admin stores.
- Public signup only User. Ordering and sponsorship User-only; Admin cannot buy/sponsor.
- Customer resources owner-scoped; prefer 404 for another owner's resource.
- Sponsorship prepaid full-care fish in kind, not investment. No ROI/profit returns. Refund only money paid.
- Public catalog images open; dispute/compliance files never public static.
- Integer VND; ISO UTC timestamps.
- Pre-orders simulated deposit20–30%, default25%, seven-day balance window after ready. Missed deadline refunds, never forfeits deposit.

## Stack and commands

Backend: NestJS12, Prisma7.10.1, TS6 ESM NodeNext with `.js` relative imports, PostgreSQL17 adapter-pg, Vitest4/supertest, pnpm. Generated client gitignored at `src/generated/prisma`.

Prisma config: `backend/prisma7.config.ts`, .env DATABASE_URL. Use additive migrate diff/deploy; `--from-url` removed in Prisma7. Migration has ALREADY been deployed; do not generate duplicate SQL or reset.

```bash
pnpm --dir C:/Mythic/Works/Projects/FishFarm/backend exec tsc --noEmit
pnpm --dir C:/Mythic/Works/Projects/FishFarm/backend test:e2e
pnpm --dir C:/Mythic/Works/Projects/FishFarm/backend test
pnpm --dir C:/Mythic/Works/Projects/FishFarm/backend build
pnpm --dir C:/Mythic/Works/Projects/FishFarm/backend lint
pnpm --dir C:/Mythic/Works/Projects/FishFarm/backend db:seed
npm --prefix C:/Mythic/Works/Projects/FishFarm/frontend run check
```

Seed command resets demo rows; do not run automatically merely to test new schema against existing data.

API4000 `/v1`; health is `/health`, Swagger `/docs`, JSON `/docs-json`.
Auth default-deny JWT+permission guards; `@Public()` only for intended public routes. Refresh httpOnly cookie `fishfarm_refresh` at `/v1/auth`, access memory, sliding idle sessions.
AppException gives `{statusCode,code,params,details?,path,timestamp}`.
Global ValidationPipe implicit conversion is enabled: boolean transforms must read raw obj[key], not converted value.

Use absolute shell paths and `git -C` consistently because shell working directory persists. Dedicated Read is required before Edit/Write of existing files. Some edits initially failed despite prior context reads; reading in current context resolved them. Do not waste time rerunning unchanged reads.

## Existing tests and docs

`backend/test/orders.e2e-spec.ts`: 11 tests. In-stock fixture500; pre-order fixture2; stock rejection9999. Existing company lifecycle sends ship with NO body and completes via company endpoint. Retain those semantics. Increase/create pre-order fixtures if adding tests; avoid stock exhaustion. Cleanup needs dispute/upload/activity changes accounted for.

Root README still incorrectly references deleted `frontend/src/store.ts`; current frontend stores in services, npm/package-lock. Frontend is React19/Vite8, entirely localStorage mocks, Buyer/Admin UI, USD formatting, different local order statuses and deposit/balance farming flow. Do not equate frontend farming with prepaid batch sponsorship; integration deliberately deferred.

`backend/REQUIREMENTS.md`: M6 commerce mostly built, tracking/disputes missing; M9 schema/seed only runtime missing; M10/M11 schema only. Update truthfully only after implementation/test verification. `docs/PROGRESS.md` is historical Oct12–18 report, not current implementation handoff.

## Why the previous session stalled

Multiple agents previously hit provider token limits without writing code. One exploration was extremely slow. Repeated narration/reads did not finish implementation. Do not repeat delegation immediately or assume agent claims mean files changed. User asked for this transfer specifically; prioritize actual edits and verified results in the next session.

## Starting prompt for new chat

Continue backend implementation from `docs/SESSION_HANDOFF_2026-10-23.md` on the existing integration/frontend-admin-ui branch. Preserve uncommitted work and the applied migration. First fix the two missing OrdersService methods and finish tracking/disputes with tests; then batch/facility APIs. No more broad exploration or approval questions, no commits/pushes, and no frontend integration yet.

---

## Verified completion checkpoint — 2026-10-23

The requested backend scope is complete in the uncommitted working tree. This checkpoint supersedes
historical statements above about missing services/modules and failed type-checks. Further feature
work requires a new request; frontend integration remains deliberately deferred.

### Implemented and covered

- Owner-scoped order tracking with persisted carrier, tracking number, estimated delivery and actual
  lifecycle timestamps; idempotent customer delivery confirmation and active-dispute completion guards.
- Buyer-scoped checkout idempotency and transactional concurrency guards for checkout, balance payment,
  cancellation and fulfilment. Checkout charges a pre-order deposit; mark-ready starts the seven-day
  balance deadline. Late balances refund instead of forfeiting deposits. Stock restoration happens once.
- Customer dispute create/list/detail, Admin queue/review/resolve/reject, one dispute per order,
  eligibility validation and controlled private evidence. Resolution does not automatically refund.
- Company-wide facility create/list/detail, compliance submission/replacement, Admin inspection and
  authorized private document downloads. Approval requires controlled documents, non-none level and
  future expiry. Evidence uploaded by either Admin can be used for company compliance.
- Company batch draft create/read/partial-edit/delete, direct publish, optional submit/approve/reject,
  restricted cancellation and growth updates. Share counts are derived from fish or total biomass;
  cost lines must reconcile exactly to total package prices.
- Public batch search/filter/pagination and safe detail/update projections. Current compliance is
  checked for visibility; expired, revoked or legacy-uncontrolled evidence hides affected batches.
- Transactional activity entries and independent notification rows for active Admins, with per-recipient
  preferences and read state. Recipient key-share locks prevent deletion between selection and insert.
- Concurrency tests for repeated checkout/payment/cancel, partial batch edits, duplicate disputes and
  competing evidence references. Shared upload locks prevent raw unique-constraint failures.

Private evidence remains unavailable through static `/uploads/private` paths. Resource endpoints
check authorization first, return attachments with `nosniff`, and omit private URLs from projections.
Legacy URL-only evidence has no controlled download. The existing configured images/PDF upload policy
(default 10 MB) remains in effect; no narrower suggested evidence policy was silently introduced.

### Final verification

All commands ran successfully against the existing local database:

| Check | Result |
| --- | --- |
| `pnpm exec tsc --noEmit` | Passed |
| `pnpm test` | 17 tests passed across 3 files |
| `pnpm test:e2e` | 71 tests passed across 8 files, with file parallelism retained |
| `pnpm build` | Passed |
| `pnpm lint` | 0 warnings, 0 errors |
| `prisma migrate status` | 4 migrations; database schema up to date |
| Applied migration checksum | Local SQL matches the database checksum; finished and not rolled back |
| `git diff --check` | Passed |

The end-to-end run still emits the PostgreSQL driver deprecation warning about calling
`client.query()` while another query is executing, slated for removal in `pg@9.0`. This is a known
remaining warning, not a failed assertion. The earlier notification foreign-key failures and obsolete
shared-role-row assertion are fixed and the full suite passes.

### Preserved state and documentation

- Branch remains `integration/frontend-admin-ui`; HEAD remains `52a75a1`.
- All implementation remains uncommitted. No commit, push, merge or frontend modification was made.
- Applied migration `20261023000100_tracking_private_evidence` was not changed, regenerated or rolled back.
- No database reset or reseed was performed; tests clean up only their own fixtures.
- `backend/README.md` documents implemented endpoints and limitations without prohibited project names
  or milestone labels. `backend/REQUIREMENTS.md` now records actual scope and the mark-ready deadline.
- Seed source now describes 40 shares of 5 kg using 200,000 g total biomass and `shareQuantity: 5000`.
  The seed was not executed; legacy demo compliance remains intentionally hidden from public batches.

### Explicitly deferred

Sponsorship reservation/payment, escrow tranche release APIs, sponsored-batch refund workflows,
harvest/delivery/settlement APIs, engagement features, notification read/delete endpoints and frontend
API integration are not implemented in this checkpoint. Do not infer API availability from schema or
seed rows. Existing batch cancellation is intentionally blocked when sponsorships exist.
