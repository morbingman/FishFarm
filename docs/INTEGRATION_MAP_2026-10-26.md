# FishFarm integration map — local and team snapshots

**Reviewed:** 2026-10-26

**Saved local baseline:** `integration/team-baseline` at `ca6eb49`
**Purpose:** decide what to keep, adapt, restore, build or defer for each component before changing application code.

This is an implementation guide and decision register, not a claim that integration is complete. The user requested incremental integration and deferred deployment. Recommendations below are not all approved product decisions. No application changes, branch merges or deployment are performed by creating this document.

## Company order queue and fulfilment slice — completed on 2026-10-28

This extends the buyer lifecycle slice below. Application integration remains uncommitted on `integration/team-baseline`; no push, merge, deployment, database reset/reseed or schema/migration replacement occurred. The retained backend order rules and tests were not modified. Earlier slice sections remain historical records, including their then-outstanding browser journeys.

### Connected scope

- Added typed `ShipmentInput`, dedicated `services/companyOrdersApi.ts`, action/route/shipment/timeline helpers in `services/companyOrders.ts`, and ten tests across their two test files. Extended active `pages/marketplace/Orders.tsx` and `Orders.css` with company mode; updated `App.tsx`, `Auth.tsx`, `SiteHeader.tsx` and the bilingual outstanding-balance error. The incompatible legacy `pages/admin/PurchaseOrders.tsx`, broad Admin workspace and `commerceStore` remain unmounted.
- Admin-only `#company/orders` and `#company/orders/ORD-…` read the shared `/company/orders` endpoints with canonical server filters. Queue/detail show actual buyer identity, VND amounts, quantities, delivery information, payments and recorded lifecycle timestamps. Guest login preserves company deep links; emitted links match backend activity URLs. `#admin`, `#admin/orders` and `#admin/orders/ORD-…` are compatibility aliases. Every Admin operates the same queue, regardless of listing creator attribution.
- Mark-ready, ship, deliver, complete and cancel await explicit backend POST actions. No generic status PATCH or confirmed/preparing stages were introduced. Preorder readiness starts the seven-day balance window, with cancellation/refund rather than deposit forfeiture; shipping stays unavailable until the buyer pays the balance.
- Shipment sends only known optional carrier/number/estimate, with bounded trimmed strings and browser-local estimate converted to UTC. Blank fields remain unassigned. Cancel requires a 4–300-character reason. Actions require confirmation, guard duplicate clicks and display the returned order. Failures disable further actions until a successful Refresh reconciles the record; uncertain fulfilment writes are not blindly replayed.
- Company tracking is derived only from timestamps and shipment fields already returned by the order projection; no company tracking endpoint or synthetic events were invented. Completion remains subject to the retained active-dispute guard. Buyer APIs/actions remain owner-scoped and separate from company operations.

### Verification and acceptance limits

- Frontend: all 37 tests in six files passed (the retained 27 plus five company helper and five company API tests). TypeScript and production build passed; audit reported zero vulnerabilities; whitespace check passed.
- Backend: TypeScript, build and lint passed with zero lint warnings/errors; all 23 unit and 71 e2e tests in eight suites passed using isolated `fishfarm_test`. Owner/role checks, balance idempotency/expiry, stock/refunds, shipment metadata, concurrent transitions and active-dispute guards were retained. The known `pg` concurrent-query deprecation warning remains.
- Browser: guest company deep link returned to the real detail after Admin sign-in. Admin A marked fresh preorder `ORD-10123` ready; it showed a real seven-day deadline and blocked shipment. Its owner paid the 1,500 ₫ simulated balance against a 500 ₫ deposit. Admin B then recorded `Local Test Carrier`, tracking `LOCAL-10123` and local estimate 2026-10-29 14:30, and marked delivery. The owner confirmed receipt; the server returned completed. This exercised shared Admin access rather than creator-only ownership.
- Browser: separate in-stock `ORD-10124` passed mark-ready, ship with all optional metadata blank, deliver and Admin complete. Reload restored the real Admin session and completed record. No invented carrier or estimate appeared.
- Browser: owner cancellation of `ORD-10126` and company cancellation of `ORD-10125` returned refunded order/payment states and actual events. Company cancellation required a reason; blank reason disabled confirmation. A one-request page-local transport failure intercepted the first cancel before reaching the server. The UI showed uncertainty and disabled changes; Refresh recovered the unchanged paid record, then explicit cancellation succeeded. This verified reconciliation, not an actual post-commit lost-response journey.
- Browser: User company routes and Admin buyer routes were denied; a foreign owner's order detail returned 404 without data. Refunded filtering returned the two fresh refunded orders. Vietnamese queue text and 390 × 844 mobile width were checked (document width 375). Desktop/English were restored, followed by verified sign-out to the settled guest Home page.
- Normal browser click commands were unreliable in this pass. Snapshot-grounded locator control fallbacks invoked the actual UI handlers and server requests; this is not complete mouse/keyboard-only black-box or visual-layout acceptance. No screenshot/layout gate, real-money gateway or shipping provider was tested. Automatic deadline expiry, open-dispute completion blocking and concurrent stale-Admin transitions retain automated coverage, not browser journey claims. Compatibility Admin route aliases were helper-tested, not specifically browser-tested.

### Local fixture disposition

A fresh local User and two Admins created on 2026-10-27 were used rather than exposed group-chat credentials. Four clearly labelled `LOCAL TEST ONLY` listings and four orders were created against local development `fishfarm`; initial orders were created through the actual API in fixture setup, while the subsequent lifecycle actions above used the UI. The earlier slice records the separate cart/checkout browser checks. Payments were simulated only.

Final database checks on 2026-10-28 confirmed:

| Order | Persisted result |
|---|---|
| Saved `ORD-10121` | Still paid/paid, 620 ₫ total, quantity two, one unchanged 620 ₫ payment |
| Saved `ORD-10122` | Still paid/deposit_paid, 450 ₫ total, 113 ₫ deposit, 337 ₫ balance, no deadline and one unchanged deposit payment |
| Fresh `ORD-10123` | Completed/paid; exactly one 500 ₫ deposit and one 1,500 ₫ balance payment; estimate stored as `2026-10-29T07:30:00.000Z` |
| Fresh `ORD-10124` | Completed/paid; one 1,000 ₫ payment; shipment fields remain null |
| Fresh `ORD-10125` and `ORD-10126` | Refunded/refunded; one refunded 1,000 ₫ payment each |

Completed fixture listing stock is three of the initial four; both cancellation fixture stocks returned to four, confirming one stock return each. After inspection and guarded verification, only the four fixture listings (`FM-LOCAL-FULFIL-PRE-20261027`, `FM-LOCAL-FULFIL-COMPLETE-20261027`, `FM-LOCAL-FULFIL-CANCEL-20261027`, `FM-LOCAL-FULFIL-BUYERCANCEL-20261027`) were soft-archived via `deletedAt`; all four archive markers were verified. Public API checks returned 404 for each fixture detail and zero results for the fixture-name search. Fixture accounts, orders, payments and lifecycle records remain for inspection. No original listing was archived or deleted, and no reset/reseed was used.

Company fulfilment is now connected. Disputes/private evidence remain the next bounded commerce integration; missing reviews and the complete marketplace acceptance gate remain outstanding. Deployment stays deferred.

## Buyer order history and lifecycle slice — completed on 2026-10-27

This extends the cart/checkout slice below. All application integration remains uncommitted on `integration/team-baseline`; no push, merge, deployment, database reset/reseed or migration change was performed. Backend commerce rules were not modified. Earlier sections are historical records of their individual slices.

### Connected scope

- Added active `pages/marketplace/Orders.tsx` and scoped CSS, typed tracking/lifecycle projections, `services/orders.ts` presentation/action rules, and dedicated owner API calls in `commerceApi.ts`. Legacy buyer order/tracking screens and `BuyerContext`/`commerceStore` remain unmounted rather than being made authoritative.
- User-only `#marketplace/orders` reads `GET /me/orders?status=…`, newest first, with canonical server filters and truthful empty/error states. `#marketplace/orders/ORD-…` matches existing backend notification links. Header and checkout confirmation link to the real pages; auth preserves these deep links. Remount keys and aborted reads isolate account/order changes.
- Detail reads the owner endpoint before tracking because detail performs overdue balance expiry. Recorded shipment carrier/number/estimate and actual lifecycle events are displayed without synthetic dates or status-rank assumptions. Tracking failure is separate from order detail failure.
- Order views preserve item quantities, snapshot prices, integer VND, delivery fields, original deposit/balance, actual deadline, and persisted payment/refund records. Paid/refunded preorders do not imply a new balance deadline.
- Cancellation before shipment, ready-preorder simulated balance payment, and delivered-order receipt confirmation use explicit owner POST endpoints. Every action asks for confirmation, guards duplicate clicks, and displays the returned order rather than optimistic local success. Server permissions, transitions, active-dispute guard, stock returns and refunds remain authoritative.
- Balance payment uses the retained backend's order-scoped idempotency; it does not create another initial payment request or collect card data. An action failure disables further changes until Refresh reconciles the owner record. A late balance response may be refunded rather than paid and is displayed as returned.

### Verification and acceptance limits

- Frontend: 27 tests passed in four files (9 API/session, 8 commerce transport, 5 checkout recovery, 5 order presentation/action rules). TypeScript and production build passed. Dependency audit reported zero vulnerabilities; whitespace check passed.
- Backend: TypeScript, build and lint passed, zero lint warnings/errors; 23 unit tests and all 71 e2e tests in eight suites passed on isolated `fishfarm_test`. Existing tests retain owner/role enforcement, cancellation/refunds, shipment metadata, repeat confirmation, balance idempotency/expiry and active-dispute guards. Known `pg` concurrent-query deprecation warning remains.
- Browser: guest `ORD-10122` deep link opened auth; sign-in returned to that real preorder. It showed 450 ₫ total, 113 ₫ original deposit, 337 ₫ original balance, `deposit_paid`, no invented deadline and only placed/payment events. Pay-balance and receipt-confirmation controls were correctly absent before readiness/delivery.
- Browser: cancellation opened the explicit confirmation text, then Keep-order-unchanged dismissed it without a server mutation. History showed both retained orders newest first; Refunded filter showed the accurate empty state. History restored with both records after page reload. `ORD-10121` detail showed quantity two, 620 ₫ total and its recorded simulated payment.
- Browser: a one-request page-local tracking failure showed an isolated connection alert while leaving order/payment details visible. Refresh restored the recorded events. A page-local cancel transport failure intercepted the request before reaching the server; no order was cancelled. The UI showed uncertainty, disabled the action, and Refresh restored actual `paid` state and enabled valid actions again.
- Browser: normal click, fill and select controls worked after the test tab was explicitly preserved. Earlier disappearing tabs were recovered after both tab lists were checked and are not counted as passing interactions. Vietnamese order text worked; at 390 × 844 the document width was 375, with no horizontal overflow. Desktop was restored.
- Successful cancel/refund, ready-balance payment, delivered receipt confirmation, populated shipment metadata, and cross-account/Admin browser journeys were not exercised in this slice's browser pass. Their transport/action rules and retained backend behavior are covered by automated tests, not a claim of complete GUI acceptance. No full visual-layout pass or real-money gateway was tested.

The two existing development orders and their stock reservations are preserved; no new order or payment was created in this slice. Company fulfilment UI and disputes/private evidence remain the next bounded commerce integrations. Account/company catalog/review/activity, batch/facility/compliance and unimplemented sponsorship transaction/settlement work remain separate. Deployment stays deferred.

## Cart and checkout slice — implemented on 2026-10-26

This extends the first slice below. Changes remain uncommitted on `integration/team-baseline`; nothing was pushed, merged into main or deployed. The retained backend/schema/migrations were not changed for commerce. No database reset, reseed or rollback was performed.

### Connected scope

- Added typed cart/order contracts and a dedicated `commerceApi.ts`. Legacy `BuyerContext`, `commerceStore`, Buyer payment screens and their unsupported domain methods remain unmounted. Their single-specimen assumptions, client cart reconstruction, USD shipping offers, 2% fee, card collection and separate initial `/pay` operation were not enabled.
- User-only listing quantity/add-to-cart, cart quantity changes, remove, clear and refresh now use the retained server endpoints. Add increments; PATCH sets quantity. Server line totals, stock and item counts are used directly. Admin purchase routes are denied; guests see real auth and return to the intended commerce route.
- Checkout sends one `POST /v1/orders`, omitting explicit items so the backend reads and clears its cart atomically. It sends only supported recipient fields, a supported payment method and an idempotency key. No card/bank credentials, arbitrary client totals or fabricated fee are sent. Shipping defaults to the backend's zero in this local integration; no production shipping schedule is promised.
- Payments are clearly labeled simulated. Preorder estimates match the backend's first-cart-line deposit percentage and integer rounding, with the seven-day balance window and cancellation/refund policy explained. Mixed sale modes and excess quantity block checkout. Final amounts and payment state are read from the order response/owner endpoint.
- Checkout key and exact delivery submission are saved in account-scoped tab `sessionStorage` before sending. Concurrent clicks are guarded; timeout/transport/auth failures retain recovery data. Definitive validation/not-found/stock-conflict rejections clear the attempt. A retry after reload uses the same key even when an earlier successful transaction has already emptied the cart. Corrupt/unavailable recovery storage cannot silently start another checkout. Recovery data includes delivery information, not access tokens, passwords or card details, and is cleared after confirmed success or definitive rejection.
- `#marketplace/confirmation?order=ORD-…` reads `GET /me/orders/:id`, showing actual quantities, status, payment records, deposit/balance and delivery information. It is not a client-created success record.

### Verification

- Frontend: 18 tests passed (9 retained API/session tests, 4 commerce transport tests, 5 checkout recovery/rounding tests); TypeScript and production build passed. Audit reported zero vulnerabilities; whitespace check passed.
- Backend: TypeScript/lint passed, 23 unit tests and 71 e2e tests passed against isolated `fishfarm_test`. Existing order e2e covers stock conflicts, empty cart, buyer ownership, User/Admin permissions, cancellation/refunds and concurrent buyer-scoped idempotency. Known `pg` concurrent-query deprecation warning remains.
- Browser: guest cart opened auth; sign-in returned to the actual empty server cart. Added Ginrin Chagoi, increased quantity from one to two, saw subtotal 620 ₫ and the stock cap disable further increases.
- Browser: deliberately dropped one successful checkout response in the page only, leaving the backend running. The error did not show fake success; reload restored the saved key/input despite the now-empty cart. Retry recovered `ORD-10121`, with two fish, 620 ₫ total and one simulated paid payment. A read-only development database query confirmed exactly one order and one payment for this account at that point. Confirmation also reloaded through the owner endpoint.
- Browser: preorder `ORD-10122` showed 450 ₫ total, a 113 ₫ deposit, 337 ₫ balance, `deposit_paid`, and a simulated payment of 113 ₫. No fabricated delivery date was shown. The checkout/confirmation document width stayed within the 390-pixel mobile viewport.
- Browser: mixed preorder/in-stock cart showed the correct warning and no Continue-to-checkout action. Removing the in-stock line restored that action. Clear-cart returned zero items; the local account was signed out at the end.

### Acceptance limits and remaining work

The browser interrupted several times during this slice; intended pages were recovered only after checking both controlled/user tab lists. Normal click and select operations were unreliable, so locator-scoped page clicks exercised actual React handlers. One e-wallet selection was interrupted and is not counted as verified. This is functional testing, not a complete visual/pointer hit-testing acceptance pass. No real-money gateway was tested. Admin denial is enforced by the active route and retained backend permissions; a separate Admin browser session was not exercised in this slice.

Recovery is scoped to the same tab. Cross-tab checkout/recovery is not implemented; users must not clear session data or start another tab while a response is unresolved. This limitation is stated in the frontend guide. The first-line preorder deposit rule is retained, not a newly approved multi-rate product policy. Production shipping/payment configuration and the unusually small seeded VND prices still need review.

Two local simulated orders remain for the fresh local testing account. Checkout consumed both available `FM-19102` fish and one `FM-20761` preorder unit, so the development catalog now has four available listings. The additional mixed-cart test was cleared without placing another order; no stock was reset to disguise the test. These are development records only; e2e fixtures remain isolated.

Order history, tracking, cancel/refund UI, balance payment, delivery confirmation and disputes are later passes. Company catalog/review/activity, account settings/users/notifications/favorites, batch/facility/compliance UI and sponsorship booking/payment/harvest/settlement remain unintegrated. Deployment stays deferred. The first slice below is historical: its statements that commerce is unavailable no longer describe the current active cart/checkout routes.

## First integration slice — implemented on 2026-10-26

This section describes the current working tree, not the saved mock-frontend baseline below. The guide was committed as `be8d2fc`; application integration changes remain uncommitted on `integration/team-baseline`. No push, branch merge, deployment, database reset/reseed, or migration rollback was performed.

### What is connected

- Retained our backend, schema, migration history and permission model. No remote backend or alternative migrations were imported.
- Used selected `origin/main` frontend source as the foundation, then selected `origin/frontend` Home presentation, guest marketplace and local image assets. This was file selection, not a wholesale merge. Local Admin review and seller-form/detail compatibility were preserved.
- Rebuilt the active API/auth boundary for `/v1`, structured errors, memory-only access tokens, coordinated refresh, and refresh-cookie bootstrap. Registration sends only supported fields and creates a `User`; password reset sends `newPassword`. Unknown roles are rejected rather than treated as Admin. The temporary legacy customer type remains `Buyer`, but users see `User`.
- Connected Home to the real public listings and company profile independently. Connected public marketplace search and detail to the retained backend projection (`sizeCm`, `company`, nullable ratings/images, integer VND and preorder fields). No fictitious business statistics, independent-seller claims or client-created catalog fallback is mounted.
- Restricted active routes to Home, public marketplace/details and real authentication. Admin/account/commerce/farming source is retained but unmounted. Unsupported legacy domain calls reject with `integration.unavailable`; unfinished routes show unavailable/access-denied states. Google sign-in is not enabled.
- Added `fishfarm_test` on the existing local Postgres instance and deployed all four retained migrations. `TEST_DATABASE_URL` may choose a separate database ending in `_test`; the guard rejects the same host/port/database even if credentials or query options differ. Tests never target the development database by default.
- Added frontend API/session tests and backend test-database safety tests. Limited e2e workers to two after eight parallel suites exhausted Argon2 memory alongside the local dev servers; hashing parameters were not changed.
- Corrected the registration Swagger summary, suspended-account error translation, 6-digit code validation, and mobile header CSS specificity. The request timeout now remains active while the response body is parsed.

### Verification of this slice

| Check | Result |
| --- | --- |
| Frontend API/session boundary tests | 9 passed |
| Frontend TypeScript + production build | Passed, including the mobile-header correction |
| Frontend dependency audit | Zero vulnerabilities after the targeted Vitest 4.1.12 patch upgrade |
| Backend TypeScript, lint and build | Passed; lint zero warnings/errors |
| Backend unit tests | 23 passed, including 6 database-selection safety tests |
| Backend e2e on isolated `fishfarm_test` | 71 passed in 8 suites with two workers |
| Test migrations | Four migrations; no pending migration after initial deployment |
| Git whitespace check | Passed |

Browser functional checks used the actual local API and a fresh local-only account, not exposed group-chat credentials:

- Home rendered five available listings, actual company information, VND prices and the preorder deposit.
- Guest catalog search returned the expected real listing; View Details opened `FM-19102` with its actual size, quantity, company and description.
- Registration created a User session. A newly opened page restored that session through the refresh cookie. Logout remained guest after reload.
- Wrong-password login showed a real error. Successful login returned to the saved listing-detail deep link, with purchasing explicitly unavailable.
- Password recovery displayed a backend-issued development code, reset the password, and allowed login with the new password.
- A User visiting Admin received access denied. Farming displayed an unavailable state rather than simulated commerce.
- A nonmatching search returned zero results. A deliberately nonexistent listing returned the translated not-found error with Retry.
- A temporary page-local request failure showed the connection error without demo fallback. Reload removed the test override and restored the real catalog; the backend was not stopped.
- English/Vietnamese text switched correctly. At 390 × 844, the corrected navigation was present with computed `display: flex`; document width did not exceed the viewport. The desktop viewport was restored afterward.

### Remaining acceptance limits and later passes

The browser's normal click operations repeatedly timed out despite unique visible controls; locator-scoped page clicks were used to exercise the actual React handlers, while text entry used normal fill operations. Two tab/stream interruptions were recovered. This verifies functional state transitions, not pointer hit-testing or complete visual acceptance. A desktop screenshot was captured but could not be visually assessed by the current model; no visual-layout pass is claimed. Browser pagination was not exercised because the development catalog has only five available records; backend pagination remains covered by e2e tests. Email verification code issuance/submission was exercised, but the tab disconnected before the final confirmation could be observed. A subsequent read-only database check confirmed the fresh local account is `User`, `active`, with a non-null `emailVerifiedAt`; persistence is verified, but the success-banner observation is not.

Cart/checkout/orders/tracking/disputes, company catalog/review/activity, account settings, users/notifications/favorites, and batch/facility/compliance UI remain later passes. Backend payments are still simulated as documented in the backend guide; this slice does not mount them. Sponsorship booking/payment/harvest/settlement remains unimplemented. The small demo prices were displayed as stored integer VND, not silently rescaled; production catalog content and pricing need a separate data review. Deployment remains deferred.

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

### 4.12 Company order queue and fulfilment — Adapted on 2026-10-28

**Reviewed legacy files:** `pages/admin/PurchaseOrders.tsx`, `services/commerceStore.ts`. **Active implementation:** `pages/marketplace/Orders.tsx`, `services/companyOrdersApi.ts`, `services/companyOrders.ts`; [company order controller](../backend/src/orders/company-orders.controller.ts) retained unchanged.

- **Local:** `/company/orders` and explicit POST mark-ready/ship/deliver/complete/cancel actions; ship accepts optional carrier/number/estimated date, cancellation takes a reason.
- **Remote:** `/admin/orders` plus generic PATCH `/admin/orders/:id/status`, optimistic updates and swallowed failures.
- **Implemented:** company mode in the shared active order presentation awaits explicit company actions and displays eligibility from canonical status/payment state. All Admins share the queue. Shipment metadata and required cancellation reason are supported; legacy local-state queue/store remain unmounted. A failed action requires Refresh before retry.
- **Verified:** fresh in-stock/preorder lifecycle, shared access across two Admins, outstanding-balance shipment blocking, buyer/Admin refund UI and failure reconciliation. Retained tests cover invalid transitions and active-dispute guards. Detailed browser limits and fixture disposition are recorded in the completed slice above.

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
- [x] Select frontend main files and compatible frontend-branch design/client improvements.
- [x] Implement shared transport, explicit role mapping and real session bootstrap.
- [x] Adapt register/login/reset/refresh/logout.
- [x] Connect Home and shared guest/authenticated catalog/detail.

**Gate:** types/build pass; guest links and auth refresh/logout browser-tested; no credential storage or fake fallback catalog.

### Pass B — Complete marketplace purchase journey

- [x] Integrate quantity-bearing server cart and atomic simulated checkout.
- [x] Integrate buyer order history/tracking and supported owner lifecycle actions (browser acceptance limits recorded above).
- [x] Integrate company fulfilment UI and exercise the buyer/Admin lifecycle on fresh local fixtures (browser control/visual acceptance limits recorded above).
- [x] Integrate pre-order deposit/balance/deadline presentation and owner balance endpoint (successful simulated balance UI journey verified on a fresh preorder).
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

The frontend now has 37 automated API/session, commerce recovery/transport and buyer/company order presentation/action tests; run `npm --prefix frontend run test` alongside type/build checks. Browser checks and their limits are recorded at the top; a production build alone does not prove integration. Backend end-to-end tests use isolated `fishfarm_test` (or an explicitly separate `_test` override) and create/clean their own fixtures, never a development database reset.

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

1. **Frontend baseline:** implemented using selected main UI source, compatible frontend improvements and preserved local supported source; only completed active routes are mounted.
2. **Local topology:** implemented unchanged `/v1` and `/uploads` proxies; auth refresh-cookie bootstrap and public-media behavior have been checked locally.
3. **Google:** retain/build Firebase flow, or leave unavailable during first marketplace integration.
4. **Admin timed blocks/password change:** initial recommendation is only server-backed suspension/reactivation and existing reset flow; richer controls require new backend work.
5. **Home content:** start with real catalog/company projections; add aggregate statistics only with a real data source.
6. **Engagement order:** recommendation is notifications/Admin users/favorites before full chat/reviews/analytics, after the purchase journey works.
7. **Individual-fish sponsorship:** possible one-count-share batch, subject to deliberate approval; retain canonical full-prepaid care rather than prototype deposit/balance semantics.

**Current outcome:** the saved backend remains intact. Foundation/auth/public catalog, quantity-bearing cart/atomic simulated checkout, buyer order history/tracking/lifecycle and shared company order fulfilment are implemented in the uncommitted working tree, with verification and acceptance limits above. Fresh preorder/in-stock completion and buyer/Admin refunds have been exercised against the local server; the two saved orders were preserved. Disputes/private evidence, missing reviews and complete browser/visual acceptance remain outstanding, so the full marketplace gate is not yet satisfied. Deployment remains deferred.
