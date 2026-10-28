# FishFarm frontend

React 19 + Vite + TypeScript + Tailwind/shadcn-style components. Component-specific CSS lives beside its component.

## Local development

Use Node.js 22+ and npm. Start the retained API and PostgreSQL using the [backend guide](../backend/README.md), then run from `frontend/`:

```bash
npm ci --legacy-peer-deps
npm run dev -- --host 127.0.0.1
```

Open http://localhost:5173. Vite proxies `/v1` and `/uploads` to `http://127.0.0.1:4000` without path rewriting. The default API base is `/v1`; a custom `VITE_API_URL` must point at a compatible API prefix and preserve the refresh cookie's `/v1/auth` path. Do not substitute the team's old `/api` contract. Deployment and preview-server routing are not configured in this slice.

## Verification

```bash
npm run test       # Session, commerce, disputes, catalog and navigation tests
npm run check      # TypeScript and production build
npm audit
```

Vitest is pinned to 4.1.12. `--legacy-peer-deps` is used because npm 11.4.0's ordinary dependency resolution failed during the initial test-runner installation.

## Current integration boundary — 2026-10-28

The active app connects Home, the public marketplace/listing details, and login/registration/email verification/password reset to the retained backend. Access tokens and identity stay in memory; page reload bootstraps from the backend's httpOnly refresh cookie. Public signup creates a `User` only. The temporary adapter maps `User` to the legacy customer UI type `Buyer`, never to `Admin`.

The company order queue is integrated through the active order screen's Admin mode. The broad legacy Admin workspace, account/farming workspaces and legacy BuyerContext/payment screens remain unmounted. Their source remains for later integration; its presence does not imply a working feature. Unsupported legacy API methods reject with `integration.unavailable`, and unfinished routes show unavailable/access-denied states rather than demo records or fake transaction success. Google sign-in is not enabled.

### Cart and checkout

Users can add quantities from listing details, change/remove/clear server cart lines, and open `#marketplace/checkout`. Admins cannot purchase. Active commerce uses `commerceApi.ts`, not the incompatible legacy buyer context. In-stock and preorder items must be checked out separately.

Checkout sends one `POST /v1/orders`, using the backend cart, integer VND and a buyer-scoped idempotency key. It does not reconstruct the cart or call a separate initial payment endpoint. Payments are explicitly simulated; no card details are collected. Shipping uses the backend default of zero for this local integration, with no fabricated delivery timetable or platform fee. This is not a production shipping/payment offer.

A pending key and delivery submission are stored in this tab's `sessionStorage` before sending, scoped by account. A timeout or lost response retains them across reload so retry returns the same order even if the cart has already been cleared. This recovery data contains delivery information, not tokens, passwords or card data, and is removed after confirmed success or a definitive transaction rejection. Do not start checkout in another tab or clear session data while a response is unresolved; cross-tab recovery is not implemented.

Confirmation URLs use `#marketplace/confirmation?order=ORD-…` and reload from the owner order endpoint. They show actual order/payment state and totals, including preorder deposit and balance, with links to order history and tracking.

### Order history and buyer lifecycle

`#marketplace/orders` loads the owner's orders newest first with server status filtering. `#marketplace/orders/ORD-…` loads details followed by tracking, so overdue balance expiry is reflected in the recorded timeline. Both routes are User-only, preserve guest login destinations, and reset displayed data when the account or order changes. No demo buyer context is mounted.

Order details show quantities, snapshot prices, payment/refund records, recipient information, assigned shipment metadata, and only recorded events. Cancellation is offered before shipment; balance payment only for ready preorders with `balance_due` and a future server deadline; receipt confirmation only when delivered. Every action requires an explicit confirmation and awaits the server response. The backend remains authoritative for concurrent transitions, automatic overdue refunds and active-dispute completion guards.

Balance payment is simulated and uses the backend's order-scoped idempotent operation. A failed action does not show success: actions are disabled until Refresh reloads the owner record. If a response was lost, refresh/reload reads the actual result before another attempt. No card credentials or authoritative order/payment state are persisted in browser storage.

### Company order queue and fulfilment

Admin-only `#company/orders` and `#company/orders/ORD-…` use `companyOrdersApi.ts` and the shared active `Orders.tsx` presentation. Guest login preserves these destinations. `#admin`, `#admin/orders` and `#admin/orders/ORD-…` are compatibility aliases, not the legacy Admin workspace. Every Admin operates the same company queue; creator attribution is not an ownership filter. Users cannot open company pages, and Admins cannot open buyer purchase/order pages.

Mark-ready, ship, deliver, complete and cancel use the retained backend's explicit POST actions, not a generic status PATCH. Preorder readiness starts the seven-day balance deadline; shipment stays unavailable until the customer pays the balance. Shipment accepts only optional carrier, tracking number and delivery estimate, with length checks, trimming and local-time-to-UTC conversion. Empty fields remain unassigned. Company cancellation requires a 4–300-character reason. All actions require confirmation, guard duplicate clicks and display the returned server record. After a failure, Refresh must reconcile the record before another action; uncertain fulfilment writes are not blindly replayed. Completion remains subject to the backend's active-dispute guard.

### Disputes and private evidence

User-only `#marketplace/disputes`, `#marketplace/disputes/:id` and `#marketplace/orders/ORD-…/dispute` use the retained owner endpoints. The order-specific screen checks actual order eligibility and joins the owner's dispute history, including finalized cases: each order allows only one dispute for its lifetime. Shipped orders allow only `not_received`; delivered/completed orders allow all five canonical reasons. Description is trimmed and must contain 15–2000 characters. No edit, withdrawal, appeal, dispute deadline or mandatory evidence is invented.

Admin-only `#admin/disputes` and `#admin/disputes/:id` use the shared company queue, optional canonical status filter and explicit start-review/resolve/reject actions. Resolve/reject require a trimmed explanation and may finalize an open case without review. Final decisions cannot be changed. Actions require confirmation and await the server projection; failed or uncertain writes disable further decisions/submission until Refresh reads the actual record. Dispute submissions and Admin decisions have no idempotency key and are not automatically replayed after transport failure. Shared transport allows one 401 refresh retry only when the original known user ID and role are unchanged, rejects late private responses after session changes, and does not replay anonymous writes as a newly refreshed account. Canonical dispute/upload responses and expected case/order/state/decision are runtime-validated before success; malformed replies require reconciliation rather than clearing evidence references. Resolution/rejection alone does not refund, replace, cancel or complete the order.

Optional evidence uses multipart `/uploads` with `purpose=dispute_attachment`; submission sends up to three returned upload IDs, not URLs. The UI accepts JPEG/PNG/WebP/GIF/PDF up to the local server's default 10 MiB per file. Confirmed references stay in memory until submission and are lost when leaving/reloading. An unconfirmed upload is not automatically retried; the user must acknowledge continuing without that file. There is no upload lookup/recovery/delete or orphan-cleanup endpoint. Protected attachment content is fetched through the shared authenticated transport as a Blob, with the existing refresh/timeout behavior. Download links use temporary object URLs revoked on replacement/unmount; evidence is never rendered inline or linked through public static upload URLs.

The retained upload backend was not hardened in this frontend slice. It trusts declared MIME rather than inspecting content signatures; private uploads are initially written to the public upload directory before being moved, leaving a potential transient exposure window. A linked file can later be missing on disk. Multer's HTTP-exception mapping may produce generic error codes for malformed/oversize multipart requests; that mapping was inspected, not runtime-tested here. Permanent private static paths are blocked. Treat this as local integration, not production private-file security acceptance.

### Company catalog and public media

Admin-only `#company/listings`, `#company/add`, `#company/edit/:id` and `#company/listing/:id` mount `CompanyCatalog.tsx`, not the legacy Seller/Portal/demo store. All Admins share inventory; creator email is attribution. The list uses canonical server status filters and client search/pagination over the returned array. The six-step editor covers basic/fish fields, integer VND, quantity, preorder terms, public media, location/shipping and an explicitly editorial preview.

Draft creation and changed-field PATCH saves are separate from bodyless direct publication. Save first, then publish the returned clean record. Pending records are locked. Approved saves change public content immediately, with a warning and explicit confirmation. Preorder deposit (20–30%) and ready date are required even on partial saves; switching to in-stock lets the server clear those terms. Media saves replace the whole image array, sending URLs, sequential positions and a cover flag, never image IDs. Response validation checks structure, requested filters and the fields/media submitted before acknowledging success.

Public multipart uploads use `purpose=listing_image`, JPEG/PNG/WebP/GIF, up to eight references and the default local 10 MiB per file. Files are public immediately, even before publication; removing a reference does not delete a file. Existing registered `/uploads/...` or external HTTP(S) image URLs can be reused. External sources are not fetched or verified by the backend. There is no cleanup/recovery endpoint, version/concurrency lock or catalog-create idempotency key. An uncertain write is never automatically retried; Refresh reconciles existing records. An uncertain create blocks resubmission only in that mounted screen, not durably across leaving/reload—inspect the shared catalog before another create. Optional review/activity, pause/resume/delete controls and sponsorship remain outside this screen.

### Verified results and limits

Checkpoint `38f0dd7` saved auth/catalog/cart/checkout/buyer orders/company fulfilment, and `90c00a0` saved disputes/private evidence on `integration/team-baseline`. Nothing was pushed. The company catalog integration remains uncommitted. The verification paragraphs below distinguish the earlier dispute pass from the latest catalog pass.

On 2026-10-28, all 62 frontend tests in eight files passed, including 20 dispute helper/transport tests and five new shared identity/late-response tests. Frontend TypeScript/build passed and the final dependency audit reported zero vulnerabilities. Backend TypeScript/build/lint, 23 unit tests and all 71 isolated e2e tests passed. The known `pg` concurrent-query deprecation warning remains. Backend source, schema, migrations and tests were not changed by this dispute slice.

The earlier company browser pass covered preorder readiness/balance payment/shipment/delivery, buyer and Admin completion, buyer/company cancellation/refunds, shared Admin access, role/foreign-owner denial, filtering and failure/Refresh reconciliation. Vietnamese copy and mobile company queue width were checked. Fixture creation used the real API; subsequent actions used the UI. The complete cart/checkout GUI journey was checked separately in the earlier slice.

The dispute browser pass covered guest owner/Admin deep-link login, buyer creation with blank-description blocking and explicit confirmation, open-dispute receipt-completion rejection, shared Admin review followed by resolution, direct rejection from open, persisted final decisions after reload, owner history/readback and authenticated owner/Admin evidence fetches producing Blob download links. After resolution, the order remained delivered until the buyer explicitly confirmed receipt; only then did it become completed. Fixture orders and the second case with a 68-byte PNG were created through the actual API during setup. Setup verified exact evidence bytes for owner/Admin, private static 404, duplicate case 409 and Admin denial on the owner route.

Final database checks confirmed saved `ORD-10121`/`ORD-10122` and the previous four company fixtures were unchanged. New `ORD-10127` is completed/paid with a resolved case; `ORD-10128` is shipped/paid with a rejected case and retained attachment. Each has exactly one unchanged 1,000 ₫ payment, with no automatic refund. Only the inspected dispute fixture listing was soft-archived; stock remains two and public detail returns 404. Together with the four previously archived company fixture listings, all five test listings are hidden without deleting accounts, orders, payments, disputes or evidence. No database reset/reseed or migration replacement occurred.

Normal click commands were unreliable, so snapshot-grounded control fallbacks invoked actual UI handlers and requests. This is not complete mouse/keyboard-only or visual acceptance. The browser does not support file selection/upload automation; actual save-to-disk download was not verified. Dispute-specific failure/Refresh interaction, status-filter interaction, foreign-owner UI denial and Vietnamese/mobile layout checks remain unexercised; helper/transport tests and retained backend tests cover relevant rules, not full component interaction. Automatic deadline expiry and concurrent transitions also retain backend coverage rather than complete browser claims. Reviews/messaging and the full marketplace acceptance gate remain outstanding; deployment stays deferred.

During wrap-up the existing browser tab could no longer restore for activation; the final browser discovery returned no controlled or user tabs. Its last verified state was signed in as the local test User on `ORD-10127`, so final sign-out/guest handoff was not verified. Node heap exhaustion, Windows process-allocation failures and a login 500 were observed earlier, while `/health` still returned 200/database up. Guarded database-only cleanup succeeded, and a later authenticated API verification passed: terminal-case duplicate guards, owner/Admin evidence byte equality, unauthenticated/role denials, private static 404 and canonical Admin status filters. No blind server/system restart was performed; later API success does not establish the cause of the earlier resource/browser failures.

On 2026-10-28 the company catalog pass finished with **103 frontend tests in eleven files**, TypeScript/build passing and zero dependency audit vulnerabilities. Backend TypeScript/build/lint, **23 unit tests and 71 isolated e2e tests** passed again; backend source/schema/migrations/tests are unchanged. The known `pg` concurrent-query warning remains.

The catalog browser pass created `FM-48379` as a name-only draft, followed the returned edit route, completed all six field groups with a confirmed public PNG URL, saved separately, published, read the public listing and saved a live breed edit. Server readback confirmed the exact content, main image and Created/Updated/Published/Edited history. Pending filtering and local search empty state worked. Vietnamese controls were checked; the expanded Admin header initially overflowed mobile width, then wrapping corrections brought document width to 375 at a 390 × 844 viewport. Desktop width was 1280 at 1280 × 720. Cancelling a dirty header link preserved the editor and unsaved field. Malformed encoding, alias canonicalization and Back/Forward guard behavior have automated tests; a browser Back/dialog operation later stalled, so Back/Forward accept/cancel and final sign-out are not claimed verified. The final server-confirmed create route replacement passed automated checks but was not rerun through the browser.

A separate real API pass verified name-only create, shared Admin B list/detail/save, complete media save, direct publication, immediate public price change while remaining approved, incomplete publish 400, User 403 and pending PATCH 409. Public upload used a valid 76-byte PNG; anonymous retrieval matched exact bytes. Only inspected fixtures were hidden through supported APIs: `FM-48379` and `FM-48380` paused; `FM-48381` withdrawn then soft-deleted. All three public details return 404. Images/history/accounts were retained; the original four available public listings and all 13 existing orders are unchanged. No reset/reseed or file deletion occurred.

Catalog file-picker automation is unsupported, so media upload is API-verified, not GUI upload acceptance. Multi-image cover/reorder/removal, preorder form interaction, unknown-create recovery, failure/Refresh interaction, alias/login-return and User route-denial browser journeys remain unexercised; automated and backend checks cover their rules, not full component acceptance. A desktop screenshot was captured but this model could not inspect image input; no visual-layout acceptance is claimed. Normal browser clicks remained unreliable and verified-control fallbacks invoked actual UI handlers. Optional internal review/activity, account/farming integrations and the full marketplace acceptance gate remain outstanding; deployment stays deferred.

Do not use exposed group-chat credentials for testing. Create a fresh local-only account instead. Any `devCode` shown in the auth screen comes from the non-production backend response, not a fixed client code.

The [integration map](../docs/INTEGRATION_MAP_2026-10-26.md) records source selection, verified results, and later passes.
