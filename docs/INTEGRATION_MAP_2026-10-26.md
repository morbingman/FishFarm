# FishFarm integration map — local and team snapshots

**Reviewed:** 2026-10-26

**Saved local baseline:** `integration/team-baseline` at `ca6eb49`
**Purpose:** decide what to keep, adapt, restore, build or defer for each component before changing application code.

This is an implementation guide and decision register, not a claim that integration is complete. The user requested incremental integration and deferred deployment. Recommendations below are not all approved product decisions. No application changes, branch merges or deployment are performed by creating this document.

## 1. Exact sources and verified state

| Source | Commit | What it represents |
| --- | --- | --- |
| Local `integration/team-baseline` | `ca6eb49` | Our verified company-operated backend, earlier frontend prototype, tests, migration and handovers |
| Local `integration/frontend-admin-ui` | `52a75a1` | Previous checkpoint before the latest backend work was committed |
| Local `main` | `b6ac6de` | Older local branch; **not** the latest team frontend |
| Remote `origin/backend` | `24d6994` | Team API-integrated prototype with its alternative backend and hosted-service integrations |
| Remote `origin/main` | `81ef74b` | Team prototype plus registration/error fixes, Firebase Google sign-in, farming-overlay and floating-chat fixes |
| Remote `origin/frontend` | `53a78ed` | Separate Home/login redesign, guest marketplace and API-client changes |

`origin/main` and `origin/frontend` both descend from `24d6994`, but have diverged: main has eleven unique commits, frontend one large unique commit. The latter does not contain all main fixes. Remote refs were fetched during the review; pin the hashes above when comparing so later pushes do not silently change the integration source.

The backend work was committed as `ca6eb49 feat: complete tracking disputes and batch facility management`. The working tree was clean immediately afterward. The branch has not been pushed. Existing ignored environment files, uploads and build output were not added.

### Verification performed on the saved application state

| Check | Result on 2026-10-26 |
| --- | --- |
| Backend TypeScript, `tsc --noEmit` | Passed |
| Backend unit tests | 17 passed in 3 files |
| Backend end-to-end tests against local PostgreSQL | 71 passed in 8 files |
| Backend build | Passed |
| Backend lint | Zero warnings/errors |
| Frontend `npm run check` | TypeScript and production build passed |
| Prisma migration status | Four migrations; local schema up to date |
| Git whitespace check | Passed |

The end-to-end run emits the known `pg` concurrent-query deprecation warning. Remote snapshots have been source-reviewed, not built or browser-validated in this review. A passing local frontend build validates a **mock frontend**, not an integrated application.

## 2. Baseline and rules to preserve

### Recommended source selection

1. Retain our backend, schema, applied migration history and regression tests.
2. Use the **frontend from remote main** as the principal UI starting point, not remote main's backend.
3. Selectively bring in remote frontend's Home/login presentation, guest marketplace, deep links and useful request handling.
4. Restore local UI where remote main removed a feature our backend supports, especially listing review and activity.
5. Adapt frontend contracts to the retained backend. Do not create a second competing order/auth implementation merely to accept old frontend requests.

This is selective integration, not an instruction to merge either remote branch wholesale. Keep `ca6eb49` available as the recovery checkpoint. Do not replay the team's alternative migrations onto our existing database.

### Existing canonical requirements

- Exactly `User` and `Admin`; one company owns listings, facilities and batches.
- Every Admin operates company resources. Creator IDs are audit data, not store ownership boundaries.
- Only Users place orders or sponsor batches. UI role checks complement, never replace, backend permissions.
- Public signup cannot request Admin privileges.
- Integer VND, ISO UTC timestamps, and translated system message keys with parameters.
- Marketplace pre-order: deposit, then balance within seven days of mark-ready; an overdue deposit is refunded.
- Batch sponsorship: full-care package prepaid, fish delivered in kind, no investment/profit return. Sponsorship payments and settlement are **not implemented locally**.
- Public catalog media may be open. Dispute/compliance evidence is downloaded only through authorized resource endpoints.
- Deployment remains out of scope. Local routing, cookies and authorized local tests remain in scope.

Authoritative detail: [backend requirements](../backend/REQUIREMENTS.md), [backend runtime guide](../backend/README.md), [completed backend checkpoint](SESSION_HANDOFF_2026-10-23.md#verified-completion-checkpoint--2026-10-23), [team snapshot review](TEAM_HANDOVER_2026-10-25.md).

## 3. Action vocabulary and ownership

- **Keep:** preserve the implementation and its tests.
- **Adapt:** retain the UI/interaction, change its contracts and source of truth.
- **Restore:** bring back a local component removed from the remote frontend.
- **Build:** required runtime functionality is missing; this is feature work, not just wiring.
- **Defer:** keep unavailable in the integrated UI until implementation and verification exist.
- **Decide:** a recommendation requires an explicit product/feature choice before implementation.

Suggested responsibilities: backend owner defines DTOs, projections and missing endpoints; frontend owner handles screens, adapters and interaction states; both verify the complete journey. These are proposed work assignments, not a record of who has accepted a task.

## 4. Component-by-component integration guide

### 4.1 Application shell, routing and navigation — Adapt

**Files:** [App.tsx](../frontend/src/App.tsx), [main.tsx](../frontend/src/main.tsx), `components/layout/*`, `components/common/Portal.*`, `data/adminNavigation.ts`.

- **Local:** hash routes, client session checks, Buyer/Admin labels, forced Admin redirection, login-gated marketplace and farming screens.
- **Remote:** main retains the operational shell; frontend adds guest marketplace routing and shared presentation changes.
- **Action:** combine main's shell with frontend's guest routes. Normalize the role model to User/Admin. Permit catalog/batch browsing for both roles while keeping purchasing User-only. Review the blanket Admin redirect rather than preserving it automatically. Preserve intended destinations through signup/login and support invalid/stale deep links.
- **Verify:** guest product link, login return-to, User denied Admin actions, Admin browsing without purchase controls, reload/back/forward, unknown IDs and expired sessions.

### 4.2 API transport, configuration and typed contracts — Adapt

**Files:** remote-only `frontend/src/services/api.ts`, [vite.config.ts](../frontend/vite.config.ts), `frontend/.env.example`, [backend main.ts](../backend/src/main.ts), `common/filters/*`.

- **Local:** no shared frontend API client or real network calls; backend uses `/v1`, bearer access tokens and structured `{ statusCode, code, params, details?, path, timestamp }` errors.
- **Remote:** main's client stores tokens in sessionStorage. Frontend adds coordinated refresh, public requests, timeout and abort handling, but retains incompatible feature endpoints and a different registration adapter.
- **Action:** use useful transport improvements, not the remote endpoint table unchanged. Keep access tokens in memory per the canonical contract. Refresh once for concurrent expired requests; retry protected requests once, never loop on login/register. Preserve `params` as well as `details` for translations. Define typed feature DTOs/projections rather than spreading `any` payloads through pages.
- **Local routing recommendation:** proxy `/v1` and `/uploads` without rewriting the API prefix, and use `/v1` as the browser API base. This preserves the current `/v1/auth` cookie path. If keeping `/api`, deliberately rewrite cookie paths too. Select one topology and test it.
- **Verify:** network errors differ from invalid credentials, cancellation is not shown as an error, public requests do not refresh, concurrent 401s rotate once, private downloads include authorization, relative public image URLs load.

### 4.3 Authentication and role mapping — Adapt

**Files:** `pages/auth/Auth.*`, `components/auth/AuthParts.tsx`, `data/authData.ts`, [demoStore.ts](../frontend/src/services/demoStore.ts), [backend auth](../backend/src/auth/auth.controller.ts), `backend/src/auth/dto/*`.

- **Local:** frontend authentication is simulated; backend register/login/refresh/logout/verify-email/forgot/reset are implemented.
- **Remote:** main contains useful registration/error fixes; frontend offers redesigned auth screens but calls `/auth/register-account`, absent locally.
- **Action:** send only supported registration fields to `/auth/register`; do not send `role` or per-user `store`. Map `User` explicitly to the customer UI. Remote main's `acceptApiUser()` currently maps every non-Buyer role to Admin, which would misclassify our Users. Use server session state, not local seven-day session promises or client-only unlocks. Confirm the retained reset-password DTO before wiring its field names.
- **Verify:** customer registration, duplicate email, malformed input, suspended accounts, refresh after reload, logout/revocation and reset-password session invalidation. Correct stale Swagger registration wording that still mentions Buyer/Seller.

### 4.4 Google sign-in — Decide / Build

**Files:** main-only `components/auth/GoogleSignInButton.tsx`, `services/firebase.ts`; frontend-only `components/auth/GoogleSignIn.tsx`; remote backend Google auth code.

- **Local:** no Google endpoint or Firebase dependencies.
- **Remote:** main uses Firebase popup and Firebase ID-token verification. Frontend has a display-only Google button and a backend that verifies direct Google credentials with a separate identity migration.
- **Recommendation:** if Google is included, preserve the functional main interaction and port a compatible Firebase token-verification flow into our auth module. Use configured project values and deliberate account-linking rules. Do not import a Google migration solely for a placeholder button.
- **Until implemented:** hide/disable the button with clear messaging. A visible nonfunctional button is not acceptance.
- **Verify:** authorized configuration, new/existing account behavior, verified identity linking, suspension, logout and popup failure. Do not claim success without testing the provider.

### 4.5 Home, cards and public marketing content — Adapt

**Files:** `pages/home/*`, `components/home/*`, `data/homeData.ts`, remote `public/hero-koi.*`, frontend-only `public/home/fish-*.jpg`.

- **Local:** static/demo home content.
- **Remote:** Home calls `/marketplace/home`; frontend improves cards, imagery, VND display and abortable loading. Our backend has no Home aggregation endpoint.
- **Recommendation:** retain frontend's presentation, initially source featured cards from `/marketplace/listings` and company information from `/marketplace/store`. Build a typed public Home aggregate only if real statistics/categories need it. Do not fabricate sales, satisfaction or verified-seller counts.
- **Action:** replace multi-seller/investment language with company/store and prepaid-sponsorship language. Keep main's removed New Arrivals navigation removed unless the feature is deliberately reintroduced. Import matching assets and stylesheet changes together.
- **Verify:** loading/error/empty states, links to real listing codes, image/video poster fallback, integer VND, responsive layout and no misleading financial/trust claims.

### 4.6 Guest marketplace and product details — Adapt

**Files:** frontend-only `pages/marketplace/PublicMarketplace.*`; `pages/buyer/Marketplace.*`, `pages/buyer/Detail.tsx`, `components/buyer/*`, `data/buyerData.ts`.

- **Local backend:** public list/detail/store, approved-only visibility, filters, pagination and safe company projections.
- **Remote:** frontend's guest page already supports search, pagination and `#marketplace/detail?fish=<code>`; buyer pages use a separate product adapter.
- **Action:** reuse guest interactions but share one typed product projection with authenticated browsing. Read `sizeCm`, `ageMonths`, `company`, `images`, `saleMode` and canonical string listing IDs. Remote adapters expect `size`, `age`, `seller` and derive numeric IDs; do not let that lose identity or quantity. The local marketplace formatter uses USD and must become VND.
- **Verify:** filters/sorts, unavailable listing 404, unknown IDs, multi-image detail, missing rating, sold-out behavior and identical guest/authenticated links.

### 4.7 Favorites — Build, then Adapt

**Files:** `context/BuyerContext.tsx`, favorite controls in buyer pages, remote `domainApi` favorite methods; local Prisma Favorite model.

- **Local:** frontend-only favorite IDs; no favorite endpoints.
- **Remote:** GET/POST/DELETE favorite calls exist against the alternative backend.
- **Recommendation:** implement a small owner-scoped favorite module, then reuse the controls with canonical listing IDs. Use explicit loading/failure rollback; do not silently persist a favorite locally after the server rejects it.
- **Verify:** add/remove idempotency, isolation between Users, deleted/unpublished listings and guest sign-in prompts.

### 4.8 Cart and quantity model — Adapt

**Files:** [BuyerContext.tsx](../frontend/src/context/BuyerContext.tsx), `pages/buyer/Cart.tsx`, [backend cart controller](../backend/src/orders/cart.controller.ts), [cart service](../backend/src/orders/cart.service.ts).

- **Local API:** GET `/me/cart`; POST `/me/cart/items`; PATCH/DELETE `/me/cart/items/:listingId`; DELETE `/me/cart`. Returns `{ items, itemCount, subtotal, saleMode }` with quantity on each line.
- **Remote:** expects an array with nested listings; sends PUT `/me/cart/:code`. Buyer UI state is largely a list of Fish, not quantity-bearing cart lines.
- **Action:** use server cart lines as the authoritative model. Preserve quantities and server totals; map add versus set-quantity semantics correctly. Handle stock changes, removed listings and mixed sale-mode rejection. Avoid recreating cart lines immediately before checkout merely to compensate for a broken local cart.
- **Verify:** quantities greater than one, increment/set/remove/clear, reload persistence, account switching, sold-out rejection and no local-only success.

### 4.9 Checkout, simulated payments and confirmation — Adapt

**Files:** `pages/buyer/Checkout.tsx`, `Payment.tsx`, `Confirmation.tsx`, `context/BuyerContext.tsx`, [order DTO](../backend/src/orders/dto/order.dto.ts), [orders service](../backend/src/orders/orders.service.ts).

- **Local API:** POST `/orders` creates and simulates payment atomically. Requires recipient details and `paymentMethod`; accepts optional `items: [{ listingId, quantity }]`, shipping fields and buyer-scoped `idempotencyKey`.
- **Remote:** sends `listingCodes` without paymentMethod, then `/orders/:code/pay`. Our backend has no separate initial-pay endpoint.
- **Action:** one checkout request, with a stable key for retries of the same submission. Use response `id` as the human-readable ORD code, not an assumed `code` property. Show the returned payment state and server totals. No real payment gateway/card processing is included; do not send or persist card details in this simulated flow.
- **Verify:** double-submit/concurrent retries, stock contention, failed requests, quantity totals, cart cleanup, confirmation reload and no phantom local order.

### 4.10 Marketplace pre-order deposit and balance — Adapt

**Files:** listing forms, buyer detail/checkout/payment/order pages, `orders.service.ts`, `company-orders.controller.ts`.

- **Local:** configured 20–30% deposit, default requirement 25%; mark-ready opens seven-day balance window. Late balances cancel/refund; initial payment already occurs at checkout.
- **Action:** expose sale mode and terms in catalog forms and product views. Show deposit, outstanding balance and actual deadline. Pay balance through POST `/me/orders/:id/pay-balance` with `paymentMethod`. Do not borrow farming's 30% deposit/minimum-deposit/package rules.
- **Verify:** payment before ready rejected, repeated balance charged once, shipping blocked until paid, overdue refund and mixed cart modes rejected.

### 4.11 Order history, tracking and delivery — Adapt

**Files:** [commerceStore.ts](../frontend/src/services/commerceStore.ts), `pages/buyer/Orders.tsx`, `Tracking.tsx`, `Delivery.tsx`, `pages/account/History.tsx`.

- **Local:** owner-scoped `/me/orders`, detail/tracking/cancel/pay-balance/confirm-delivery; persisted shipment metadata and lifecycle timestamps.
- **Remote:** reads raw nested listings/top-level addresses, expects `row.code`; local API returns `id`, nested `delivery`, flat line projections and payment rows. Remote UI also maps paid/ready to confirmed/preparing.
- **Action:** use typed order projections and canonical statuses. Presentation labels may differ, but backend transitions must not. Preserve quantity, deposit/balance/refund distinctions and actual recorded events. Clear cached orders on account changes. Never synthesize tracking dates to make a timeline look complete.
- **Verify:** only owner's orders, history reload, shipment metadata, no fabricated events, repeat delivery confirmation and active-dispute completion guard.

### 4.12 Company order queue and fulfilment — Adapt

**Files:** `pages/admin/PurchaseOrders.tsx`, `services/commerceStore.ts`, [company order controller](../backend/src/orders/company-orders.controller.ts).

- **Local:** `/company/orders` and explicit POST mark-ready/ship/deliver/complete/cancel actions; ship accepts optional carrier/number/estimated date, cancellation takes a reason.
- **Remote:** `/admin/orders` plus generic PATCH `/admin/orders/:id/status`, optimistic updates and swallowed failures.
- **Action:** retain queue UI but call explicit company actions and await confirmed responses. Display applicable actions from status/payment state. Every Admin shares the queue. Include refund/cancellation reason and shipment fields.
- **Verify:** full in-stock/pre-order lifecycle, another Admin's order access, invalid transitions, outstanding balance, cancelled/refunded state and visible server failures.

### 4.13 Disputes and private evidence — Adapt / Build missing Admin UI

**Files:** `pages/buyer/Dispute.tsx`, `context/BuyerContext.tsx`, `backend/src/disputes/*`, `uploads/private-files.service.ts`.

- **Local:** one dispute per order; eligible reasons/statuses; description and max-three attachment validation; owner-scoped history/detail; Admin review/finalization and authorized evidence routes.
- **Remote:** sends `attachments: [url]` to `/orders/:id/dispute` via Cloudinary. Our contract is `uploadIds` to `/me/orders/:id/dispute`.
- **Action:** upload evidence through local multipart API, then link returned IDs. Reuse customer form with canonical reasons and server eligibility. Add customer dispute history/detail and Admin queue/review UI where absent. Fetch evidence with bearer authorization as a blob; do not render protected URLs as public static links.
- **Verify:** other-user 404, static private path blocked, unauthorized content denied, max/reused/foreign uploads rejected, final decision persisted, no automatic refund implied by resolution.

### 4.14 Company catalog forms and media — Adapt

**Files:** `pages/seller/Listings.*`, `ListingForm.tsx`, `Detail.*`, `ListingView.*`, `components/seller/*`, `data/sellerData.ts`, `services/demoStore.ts`, `backend/src/listings/*`.

- **Local:** six-step prototype; backend draft CRUD and live edits under `/company/listings`.
- **Remote:** useful API-connected form, but writes `/admin/listings` and spreads prototype fields with `publish: true/false`.
- **Action:** explicitly map string fields to `ageMonths`, `sizeCm`, integer price/quantity. Send only accepted DTO fields; map main image to `{ url, isMain, position }`, not prototype `id/mainId` fields. Save draft separately from POST `/:id/publish`. Maintain partial saves and show validation failures. Treat the seller directory name as legacy organization, not a third role; rename later only if it aids maintainability.
- **Verify:** partial draft, publish completeness, media order/cover, pre-order terms, live edit remains live, shared access across Admins and failed writes do not look successful.

### 4.15 Optional internal listing review — Restore / Adapt

**Files:** local `pages/admin/Queue.tsx`, `Review.*`, `data/adminNavigation.ts`, `pages/admin/Admin.tsx`; `backend/src/listings/admin-listings.controller.ts`.

- **Local:** supported queue and decision screens plus backend review transitions.
- **Remote:** main deletes Queue/Review and redirects their routes to listings, presenting direct publication only.
- **Recommendation:** restore local review screens as optional company quality-control functionality. Direct publish remains the default path. Use the existing Admin review routes, not company draft CRUD routes.
- **Verify:** pending/approved/changes tabs, approve/reject/request-changes/takedown, feedback, status restrictions and review notification/activity links.

### 4.16 Admin overview, activity and role information — Restore selectively / Build gaps

**Files:** local `pages/admin/Overview.*`, `ActivityLog.tsx`, `Roles.tsx`, `data/adminData.ts`; `backend/src/listings/admin-activity.controller.ts`, `backend/src/auth/permissions.ts`.

- **Local:** activity endpoint exists; overview is largely mock-derived. Roles component exists but the current router redirects it to Users.
- **Remote:** main removes Overview and disables activity routing; its broader backend has summary/role endpoints absent locally.
- **Action:** restore activity using its real array projection and `limit` parameter (default 100, bounded to 300). Adapt actual actor/action fields. Server-side page/offset pagination is not implemented; use client pagination over the fetched window or add a separate backend enhancement. Do not restore fictional KPI totals as live analytics. A read-only two-role capability view can be added deliberately; it must not suggest roles are editable.
- **Verify:** real activity from integrated mutations, paging/empty states, role restrictions and valid links. Analytics needs a separate backend feature pass.

### 4.17 Admin users, suspension and provisioning — Build, then Adapt

**Files:** `pages/admin/Users.*`, account-management helpers in `services/demoStore.ts`, `backend/src/users/*`, `auth/permissions.ts`; frontend-branch Admin bootstrap code.

- **Local:** account status enforced by auth, but no Admin list/status mutation endpoints. Schema supports active/suspended, not the UI's timed block/deletion policy.
- **Remote:** main removes misleading Delete Account behavior, but timed blocks still live mostly in local client state; status requests send active/suspended. Frontend branch reintroduces deletion language and automatic Admin bootstrap with source defaults.
- **Recommendation:** implement explicit list and suspend/reactivate operations with audit/session enforcement first. Hide timed block choices until server-backed expiry exists. Preserve main's non-deletion wording and retain orders/history. Do not import automatic startup Admin provisioning blindly.
- **Verify:** permission restrictions, suspended access/refresh denied, reactivation, cross-client consistency and no client-only timed unlocking.

### 4.18 Account profile, preferences, password and history — Adapt / Build gaps

**Files:** `pages/account/Account.tsx`, `Profile.*`, `Settings.*`, `History.tsx`, `components/account/*`, `backend/src/users/*`.

- **Local:** profile GET/PATCH and prefs GET/PATCH exist. Password reset exists, but authenticated current-password change/self-suspension do not.
- **Remote:** profile requests are partly wired; `updateUser()` mutates local state first and drops prefs/password from its outgoing profile body. Settings still compares current password with `user.password`, which API-loaded users do not receive.
- **Action:** await profile/prefs saves against their separate routes and display errors. Remove password from client user models and never compare it locally. Offer the working reset flow, or build a proper authenticated change-password endpoint as a separate feature. Hide self-deactivation until supported. Label account history accurately: own orders are supported, general user activity history is not.
- **Verify:** profile/prefs survive reload, unknown fields rejected, failed saves not acknowledged, password/session behavior and account navigation for both roles.

### 4.19 Notification inbox and badges — Build, then Adapt

**Files:** `pages/account/Notifications.*`, `Portal.tsx`, `WorkspaceFrame.tsx`, `services/demoStore.ts`, `backend/src/common/notifications.*`.

- **Local:** backend emits independent recipient rows with preferences, but inbox/read/read-all/delete endpoints are missing.
- **Remote:** API-connected inbox exists. `syncFromApi()` combines listings and missing notifications in one Promise.all, so one unavailable endpoint can prevent catalog state synchronization too.
- **Action:** implement owner-scoped read/mutation endpoints and typed message-key/parameter projection. Decouple feature loaders so notifications failing cannot erase/block listings or orders. Derive badges from server unread state; stop creating duplicate client notifications for server-emitted events.
- **Verify:** independent Admin read states, muted categories, read-all/delete ownership, reload persistence and translated message parameters.

### 4.20 Chat and conversation history — Preserve layout / Build functionality

**Files:** `pages/buyer/Buyer.*`, `components/buyer/BuyerWidgets.tsx`, `context/BuyerContext.tsx`, remote conversation API methods; Prisma Conversation/Message models.

- **Local:** UI demo and schema only; no conversation endpoints.
- **Remote:** main has persistent floating-window/spacing fixes absent from frontend. Send calls exist, but source review did not establish a complete history/reply experience.
- **Recommendation:** preserve main's floating layout, then implement User-to-company conversations, history loading, sending and polling with owner/Admin authorization. Define a company inbox rather than per-seller conversations. Do not show an enabled fake send action while the backend is absent.
- **Verify:** persisted messages/replies, two-session communication, reload, paging, polling cleanup, unread state as supported, permission boundaries and send retry without duplicates.

### 4.21 Reviews, ratings, company customers and analytics — Build / Defer

**Files:** `pages/buyer/Review.tsx`, `pages/seller/Dashboard.*`, `Placeholder.tsx`, `data/buyerData.ts`; local Review schema and marketplace rating aggregation; remote `/admin/summary`, `/admin/customers`, `/admin/reviews` implementations.

- **Local:** public rating aggregation exists, but review-write, customer and analytics endpoints do not. Some company views are placeholders.
- **Action:** port suitable logic into company-scoped modules only after defining eligible delivered/completed orders, duplicate-review policy and public content rules. Aggregate real orders/refunds for analytics and define date ranges. Do not import third-party seller ownership or pretend a static dashboard is live.
- **Verify:** eligible owner-only review, duplicate policy, real rating updates, refunds excluded/handled consistently in revenue, authorized customer projections and no fabricated metrics.

### 4.22 Batch browsing and growth updates — Adapt

**Files:** `pages/farming/Catalog.*`, `Detail.*`, `components/farming/*`, `data/farmingFilters.ts`, [farmingStore.ts](../frontend/src/services/farmingStore.ts), `backend/src/batches/batches.controller.ts`.

- **Local:** public open/compliant batch list/detail/updates implemented; local frontend models fish types, packages and facilities as demo objects.
- **Remote:** maps batches into fish offerings. Loader combines batches with missing sponsorship endpoints, which can fail the whole experience. It expects an array; local public batches are paginated (`items/total/page/limit`).
- **Action:** make a typed batch projection, preserve real shares/costs/terms and load public browsing independently of sponsorship history. Do not present synthetic care entries, measurements or fixture facilities as real progress. Public visibility requires current approved controlled compliance; the seeded legacy batch is intentionally hidden.
- **Verify:** public filters/pagination/detail/update feed, unavailable/expired/revoked compliance, actual share units, truthful empty state and no fake sample batch substituted for an empty response.

### 4.23 Admin batches, facilities and compliance — Adapt / Build missing forms

**Files:** `pages/admin/Bookings.tsx`; main-only `pages/admin/BatchForm.tsx`; `backend/src/batches/*`, `backend/src/facilities/*`.

- **Local:** company batch draft CRUD/publish/submit/updates; Admin review/cancel; company facilities, controlled documents and Admin inspection.
- **Remote:** BatchForm creates and immediately opens an individual-fish offering through `/admin/batches`; lacks our share/cost/compliance contract. Bookings mixes batch administration with sponsorship status actions.
- **Action:** reuse presentation only. Create drafts under `/company/batches`; supply facility, dates, stock, share quantity/unit, cost lines, price and terms. Separate draft-save, publish and review. Add facility/compliance submission/inspection and protected-document UI. Keep sponsorship status operations disabled until implemented.
- **Verify:** exact cost reconciliation, derived count/weight shares, partial edits, current compliance, private document authorization, two-Admin operation and no cancellation where sponsorship/refund constraints forbid it.

### 4.24 Sponsorship booking, payments, harvest and handover — Decide / Build

**Files:** `pages/farming/Booking.*`, `OrderList.*`, `OrderDetail.*`, `HandoverForm.tsx`, `FarmingOrders.*`, `data/farmingOrderData.ts`, `services/farmingStore.ts`; local Sponsorship/EscrowRelease/Harvest schema.

- **Local:** schemas/seeds, not transaction APIs. Prototype offers care packages, deposits/balances and generated progress.
- **Remote:** single-fish/one-share reservation/payment/status flow, not a complete port of our documented batch ledger/compliance/settlement contract.
- **Recommendation:** keep the canonical prepaid batch model. A one-fish, one-count-share batch could represent an individual-fish offering without a second incompatible system; this is a proposal, not an approved expansion. Preserve package/escrow/terms/refund semantics. Do not reuse marketplace deposit logic for sponsorship.
- **Initial integration:** browsing and Admin management only; booking/payment/my-sponsorship/harvest controls stay unavailable.
- **Later feature pass:** reservations and idempotent simulated package payment, owner history, ledger/releases, permitted cancellation/refunds, harvest/shortfall and delivery/settlement. Specify and test each stage before enabling its UI.
- **Verify:** quantity/share contention, price/terms snapshot, no care balance top-up, ledger reconciliation, refunds capped to money paid, no invented growth/delivery data and no investment language.

### 4.25 Upload transport, public assets and evidence downloads — Keep backend / Adapt frontend

**Files:** `backend/src/uploads/*`, remote `domainApi.uploadImage`, file inputs across catalog/disputes/batches/account.

- **Local:** multipart POST `/uploads` with `file` and `purpose`; listing_image/batch_image/batch_update are Admin public images, farm_document Admin private evidence, dispute_attachment User private evidence.
- **Remote:** Cloudinary `/uploads/signature` and `/uploads/complete`; also assumes profile_avatar, which local upload purpose rules do not support.
- **Action:** replace signature flow with multipart calls for the retained backend. Preserve type/size/purpose checks and authorized evidence streaming. Do not silently treat avatar upload as supported or convert private evidence into public Cloudinary links. Keep ignored runtime uploads out of source commits.
- **Verify:** public URL loading through local routing, role/purpose/type/size failures, cover-image reuse across Admins, private paths 404 and authorized resource download with correct attachment headers.

### 4.26 Shared UI, styles, translations and data fixtures — Keep / Selectively combine

**Files:** `components/ui/*`, `components/layout/*`, `components/common/*`, `components/account/*`, `utils/cn.ts`, `styles/*`, `App.css`, language context/hooks and `data/*`.

- **Action:** preserve components not needing contract changes. Import matching CSS/assets with selected screens. Main's dialog stacking and farming overlay fixes differ from frontend; do not undo them while adding Home styles. Keep main's chat layout fixes. Normalize User/company/VND/UTC labels across dictionaries. Separate static copy/options from fake domain records; remove mock persistence, offline toggles/reset tools and fabricated histories from live journeys.
- **Verify:** dialogs above overlays, focus/close behavior, floating chat, mobile layouts, language switching, backend message-key parameters, no USD leakage and no runtime import of demo accounts.

## 5. Backend disposition

Keep the following modules as the foundation; extend them rather than replacing them with the remote DomainService.

| Local area | Disposition |
| --- | --- |
| `auth/*`, `users/*` | Keep auth/profile/prefs; add approved Google/password/Admin-user capabilities separately |
| `company/*` | Keep single-company scope; do not recreate per-Admin stores |
| `listings/*`, `marketplace/*` | Keep lifecycle/public contracts; optional real Home aggregation is new work |
| `orders/*` | Keep stock/payment/idempotency/concurrency/fulfilment behavior and tests |
| `disputes/*` | Keep eligibility/evidence/ownership/review; build missing screens |
| `batches/*`, `facilities/*` | Keep shares/cost/compliance/visibility rules; sponsorship is separate work |
| `uploads/*` | Keep public/private policy and protected streaming |
| `common/*` | Keep error filter, independent notification fan-out, locks and transactional activity |
| `prisma/*`, `config/*`, `health/*`, app bootstrap | Keep adapter/config/validation/runtime wiring; extend only when required |
| `src/generated/prisma/*` | Generated and ignored; regenerate from retained schema, never copy from another branch |

Remote backend modules for mail, Cloudinary, Google, engagement, admin bootstrap and the large `domain/*` service are **reference implementations**, not merge targets. Extract a feature only after adapting company/role/data/privacy rules and adding tests. Real email delivery is a separate integration: local OTP generation/verification is implemented, but production email delivery is not established by those tests.

### Database and seed

- Keep the existing four-migration lineage, including `20261023000100_tracking_private_evidence`; it is already applied locally.
- Do not import remote migrations that restore Seller/owner relations, change sponsorship semantics or replace our lineage.
- Future missing fields require reviewed additive migrations. Do not run reset/reseed to make mismatches disappear.
- Seed source fixes the 40 × 5 kg batch to 200,000 g expected biomass. Existing demo compliance is URL-only and intentionally fails public controlled-compliance visibility. Use explicit controlled local fixtures when testing batch publication, not a blanket bypass.
- Seeds contain schema examples for future sponsorship features; those rows do not establish endpoint availability.

## 6. File coverage index

Feature sections above cover the following source groups, including components that remote snapshots remove. Revisit unused files only after imports/routes are integrated; do not delete them merely because remote main deleted them.

| Source group | Guide section |
| --- | --- |
| `App.tsx`, `main.tsx`, layout/navigation/Portal components | 4.1, 4.26 |
| `services/api.ts`, Vite config, environment template | 4.2 |
| `services/demoStore.ts` | Split auth/profile/catalog/notifications/session concerns across 4.3, 4.14, 4.17–4.19; remove live mock authority |
| Auth pages/parts/Google/Firebase and auth data | 4.3–4.4 |
| Home pages/parts/data/public imagery | 4.5 |
| PublicMarketplace, buyer Marketplace/Detail/BuyerParts/BuyerWidgets | 4.6, 4.20 |
| BuyerContext, buyer Cart/Checkout/Payment/Confirmation | 4.7–4.10 |
| commerceStore, buyer Orders/Tracking/Delivery, Admin PurchaseOrders | 4.11–4.12 |
| Buyer Dispute/Review | 4.13, 4.21 |
| Seller Listings/ListingForm/Detail/ListingView/SellerParts/sellerData | 4.14 |
| Admin Queue/Review/Overview/ActivityLog/Roles/adminData/navigation | 4.15–4.16 |
| Admin Users and account-management helpers | 4.17 |
| Account/Profile/Settings/History/AccountParts/accountData | 4.18 |
| Account Notifications and shell notification badges | 4.19 |
| Seller Dashboard/Placeholder/Seller wrapper | 4.21; not an independent seller role |
| Farming/FarmingParts/FishCard/Summary/Catalog/Detail/filter data | 4.22 |
| Admin Bookings/BatchForm and facility/compliance forms | 4.23 |
| farmingStore/Booking/OrderList/OrderDetail/HandoverForm/FarmingOrders/farmingOrderData | 4.24 |
| File inputs and backend upload services | 4.25 |
| Remaining UI primitives, CSS/theme files, language context/hooks/dictionaries, `useSessionState`, `utils/cn.ts` | 4.26; use session storage only for non-sensitive drafts/preferences, not authoritative domain state |
| `data/demoAccounts.ts` | Prototype-only; remote removes it; do not retain it as live authentication |
| Backend modules, Prisma/config and runtime | Section 5 |
| Tests, manifests/lockfiles, docs | Sections 7–8 |

## 7. Recommended integration order and gates

This is a proposed sequence. It prevents missing secondary APIs from blocking a small working marketplace journey.

### Pass A — Foundation and catalog

- [x] Save our backend implementation on a new branch (`ca6eb49`).
- [x] Record local/remote component decisions in this guide.
- [ ] Select frontend main files and compatible frontend-branch design/client improvements.
- [ ] Implement shared transport, explicit role mapping and real session bootstrap.
- [ ] Adapt register/login/reset/refresh/logout.
- [ ] Connect Home and shared guest/authenticated catalog/detail.

**Gate:** types/build pass; guest links and auth refresh/logout browser-tested; no credential storage or fake fallback catalog.

### Pass B — Complete marketplace purchase journey

- [ ] Integrate quantity-bearing server cart and atomic simulated checkout.
- [ ] Integrate order history/tracking and company fulfilment.
- [ ] Integrate pre-order deposit/balance/deadline states.
- [ ] Integrate disputes/private evidence and missing review screens.

**Gate:** User purchase and Admin fulfilment verified end-to-end, including retries, refunds, ownership and active-dispute guards.

### Pass C — Company operations and contained missing features

- [ ] Adapt company catalog forms/publication and restore optional listing review/activity.
- [ ] Build Admin list/suspend/reactivate and notification inbox operations.
- [ ] Integrate profile/prefs and remove client-only password/block/deletion claims.
- [ ] Build favorites if included in this pass.
- [ ] Integrate batch/facility/compliance management and real public updates.

**Gate:** two Admins operate the same resources; writes survive reload; notification failure does not block catalog/order loaders; private evidence remains private.

### Pass D — Separately scoped features

- [ ] Decide/test Google sign-in if retained.
- [ ] Implement complete messaging and review flows.
- [ ] Implement company analytics/customers where required.
- [ ] Decide individual-fish representation and implement sponsorship/ledger/harvest/settlement stages.

**Gate:** enable a screen/action only when its API, permissions and real-state verification pass. No deployment work is included.

### Regression commands

Use the existing installed toolchains: **npm/package-lock for frontend**, **pnpm/pnpm-lock for backend**. Do not copy conflicting remote lockfiles or mix package managers in one package.

```bash
npm --prefix C:/Mythic/Works/Projects/FishFarm/frontend run check
pnpm --dir C:/Mythic/Works/Projects/FishFarm/backend exec tsc --noEmit
pnpm --dir C:/Mythic/Works/Projects/FishFarm/backend test
pnpm --dir C:/Mythic/Works/Projects/FishFarm/backend test:e2e
pnpm --dir C:/Mythic/Works/Projects/FishFarm/backend build
pnpm --dir C:/Mythic/Works/Projects/FishFarm/backend lint
git diff --check
```

The frontend currently has type/build checks, not an automated feature test suite. Add contract/adapter tests and a documented browser acceptance pass; a production build alone does not prove integration. Backend end-to-end tests need authorized local PostgreSQL and create/clean their own fixtures, not a database reset.

Preserve all eight backend end-to-end suites: app, auth, listings, marketplace, uploads, orders, disputes, batches-facilities. Preserve unit coverage for permissions and notification fan-out. Add tests for new endpoints/adapters instead of weakening existing assertions to match remote behavior.

## 8. Documentation and maintenance

- **Root README:** update the stale `src/store.ts` reference, non-persistence claim, package-manager instructions and backend feature inventory. Describe integrated versus deferred features accurately.
- **backend/README.md:** retain runtime contract detail; update only for implemented/tested changes. Keep setup/reset commands clearly distinguished from safe verification.
- **backend/REQUIREMENTS.md:** introductory project state is historical; refresh it without erasing locked company/prepaid decisions. Mark proposed endpoints explicitly.
- **frontend/README.md:** retain npm commands; its `HUONG_DAN.md` link points to a file absent in this reviewed checkout and needs repair/removal. Document API/proxy setup after implementation.
- **docs/PROGRESS.md and screenshots:** retain as the historical October 12–18 report; do not rewrite history as current status.
- **SESSION_HANDOFF_2026-10-23.md:** preserve its historical/completed distinction. Its statement that work was uncommitted is now superseded by the checkpoint recorded here.
- **TEAM_HANDOVER_2026-10-25.md:** retain snapshot evidence; link this guide when maintaining it rather than duplicating component decisions.
- **This guide:** record accepted decisions, actual changed files and verification results as each pass finishes. Do not check an item merely because a screen or schema exists.

## 9. Decisions still to settle

1. **Frontend baseline:** recommendation is main UI plus selective frontend improvements plus restored local supported screens; no application import has happened yet.
2. **Local topology:** recommendation is an unchanged `/v1` proxy plus `/uploads` proxy. Cookie/public-media behavior must be verified.
3. **Google:** retain/build Firebase flow, or leave unavailable during first marketplace integration.
4. **Admin timed blocks/password change:** initial recommendation is only server-backed suspension/reactivation and existing reset flow; richer controls require new backend work.
5. **Home content:** start with real catalog/company projections; add aggregate statistics only with a real data source.
6. **Engagement order:** recommendation is notifications/Admin users/favorites before full chat/reviews/analytics, after the purchase journey works.
7. **Individual-fish sponsorship:** possible one-count-share batch, subject to deliberate approval; retain canonical full-prepaid care rather than prototype deposit/balance semantics.

**Current outcome:** the backend is safely committed and verified; the component map exists; frontend adaptation and missing-feature implementation have not started. Deployment remains deferred.
