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
npm run test       # Session, account, commerce, disputes, catalog, batches, facilities, review/activity, users, inbox and navigation tests
npm run check      # TypeScript and production build
npm audit
```

Vitest is pinned to 4.1.12. `--legacy-peer-deps` is used because npm 11.4.0's ordinary dependency resolution failed during the initial test-runner installation.

## Current integration boundary — 2026-10-29

**Scope decision:** chat/messaging is dropped, not a remaining integration task. Legacy chat widgets/providers remain unmounted; no chat API or UI is planned. Notifications and reviews are independent and unaffected.

The active app connects Home, the public marketplace/listing details, and login/registration/email verification/password reset to the retained backend. Access tokens and identity stay in memory; page reload bootstraps from the backend's httpOnly refresh cookie. Public signup creates a `User` only. The temporary adapter maps `User` to the legacy customer UI type `Buyer`, never to `Admin`.

The company order queue is integrated through the active order screen's Admin mode. Shared company catalog, batch browsing/management, facility/compliance management, optional review/activity, the bounded Admin account directory and own profile/preferences are standalone integrations. The broad legacy Admin, Account and farming workspaces and legacy BuyerContext/payment screens remain unmounted. Their source remains for later integration; its presence does not imply a working feature. Unsupported legacy API methods reject with `integration.unavailable`, and unfinished routes show unavailable/access-denied states rather than demo records or fake transaction success. Google sign-in is not enabled.

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

Public multipart uploads use `purpose=listing_image`, JPEG/PNG/WebP/GIF, up to eight references and the default local 10 MiB per file. Files are public immediately, even before publication; removing a reference does not delete a file. Existing registered `/uploads/...` or external HTTP(S) image URLs can be reused. External sources are not fetched or verified by the backend. There is no cleanup/recovery endpoint, version/concurrency lock or catalog-create idempotency key. An uncertain write is never automatically retried; Refresh reconciles existing records. An uncertain create blocks resubmission only in that mounted screen, not durably across leaving/reload—inspect the shared catalog before another create. Optional review submission/withdrawal are connected as described below; sponsorship remains outside this screen.

Saved detail/edit screens offer Pause only for approved records, Resume only for paused records, and Remove from catalog only for draft/changes/rejected records. Each confirmation identifies the saved code, name and status; unsaved edits must be saved or discarded first. Pause hides public browsing. Resume restores saved content without publication completeness validation or clearing review metadata; it is not a second Publish action. Removal is a soft-delete, not file/history deletion, and has no restore control. None of these actions cancels/refunds orders or payments. Pending/live/paused records cannot be removed, and no withdrawal/takedown/removal chain is automated.

Bodyless pause/resume POSTs and DELETE disable automatic 401 replay as well as uncertain transport replay. Pause/resume validate the returned code and expected status, then hide old detail and authoritatively refetch before another action. DELETE requires exact `{id,deleted:true}` rather than a listing projection, then replaces the route with the shared catalog. If history restoration refuses that redirect, the confirmed-deleted record stays permanently non-writable with an explicit catalog link; a missing edit record never becomes a create form. Failed or uncertain writes disable actions until Refresh succeeds; a detail 404 is not a deletion acknowledgement. Session-generation, abort and read-sequence guards reject old display, including fresh same-account logins. Page locks serialize its writes; the new adapter lock covers the three lifecycle actions only. The backend still has no atomic status/version check for concurrent Admin lifecycle writes.

### Batch browsing, company drafts and recorded observations

Public `#farming` and `#farming/:id` mount standalone `PublicBatches.tsx`, independently of
legacy sponsorship loaders. List filters are `q`, species, region, harvest-before and maximum
integer VND package price, with server `page`/`limit` pagination. An empty result has zero
available pages; no demo batch replaces it. Detail and its independent update-feed request
use credential-free public reads. The backend returns public data only for open batches
with available shares and current approved controlled facility compliance. A hidden or expired
batch returns not-found, including its feed. This is not permanent owner sponsorship tracking.

Admin-only `#company/batches`, `/new`, `/:id` and `/:id/edit` mount standalone
`CompanyBatches.tsx`. All Admins share records; creator identity is attribution. Status filtering
is server-side; search and ten-row paging are local to the loaded company array. Creation requires
a full draft, not a name-only listing. Only drafts are editable. Saves send changed fields only;
changed image/cost arrays replace the full collection. The read-only real facility directory
supplies choices, with no fictional IDs or facility-writing fallback. Nullable dates/measurements
are displayed as not recorded, not invented zero. Existing optional date/biomass clearing is
unsupported and must not be represented as a successful clear, except that switching to count
shares explicitly clears biomass in backend persistence.

Count shares use stocked fish divided by fish per share; weight shares use expected whole-batch
harvest biomass in grams divided by grams per share, rounded down. Allocated whole-batch cost
is the sum of batch-total lines plus per-share lines multiplied by total shares, and must exactly
match package price multiplied by total shares before publication. Contingency percentage is
metadata, not an automatic extra charge. Saving and direct publication are separate confirmed
writes. Publication is authoritative on the backend and additionally requires an image and
current approved facility compliance backed by controlled documents; frontend hints are not approval.

Recorded growth observations are append-only with a stage, optional integer average grams,
optional alive count (including real zero), note and public photos. Timestamps are server UTC
recording times, not measurement dates. Appending does not advance batch status and offers no
edit/delete, fabricated growth chart or harvest promise. Company detail is authoritatively
refetched after every accepted write before further actions. Session-generation, abort, sequence,
dirty-navigation/reload and synchronous duplicate guards protect private pages. Mutations disable
automatic 401 and uncertain transport replay. Unknown creation remains blocked in that mounted
screen; inspect the shared list before creating again, including after leaving/reload. An uncertain
append requires refreshed-feed inspection and explicit clearing of local input, not request replay.
Confirmed creation stays non-creatable even if canonical route replacement is refused.

Frontend draft numeric controls use the PostgreSQL Int storage ceiling (2,147,483,647),
not a promise that wider safe JavaScript integers can be persisted. Dates are entered/sent as UTC.

Media uses existing registered purpose-matched `/uploads/...` or external HTTP(S) URLs.
Listing images are not interchangeable with `batch_image` or `batch_update`. The backend does
not fetch/verify external images. No multipart batch upload is mounted. Facility/compliance
writing is a separate connected slice below. Sponsorship booking/payment/owner history,
ledger/releases, harvest/delivery/settlement, generic batch status changes and batch
review decisions/delete remain outside this slice; submission and unsponsored cancellation
are connected below. Chat remains dropped. Backend
source/schema/migrations/dependencies and lockfiles are unchanged; batch work is not
automatically committed or deployed.

### Optional saved-draft batch submission

Saved Admin detail offers a separate optional review submission for a clean draft; direct
publication remains available. Confirmation identifies the saved code/name/status and binds
local state, the current session, read sequence and route. Create/edit/list/public pages do not
offer submission. The bodyless `POST /v1/company/batches/:id/submit` disables automatic replay
and uses the existing cross-action lock. The backend locks and rereads batch/facility state and
requires the same exact costs, valid shares, images and current controlled compliance as
publication. Client hints are not approval or an atomic version check.

Submission changes draft to pending_review, writes submittedAt and clears reviewNote. It does
not publish, create sponsorships/orders/payments, approve the farm, or clear prior reviewer/time
or inspection fields. The company-only details show the actual nullable submission/review metadata
as escaped text and UTC times, with an explanation that prior reviewer/time can survive resubmission.
Pending batches are hidden publicly, non-editable and cannot be directly published or submitted
again. There is no withdrawal endpoint; separately eligible unsponsored cancellation is not withdrawal.

A validated acknowledgement must be followed by an authoritative company-detail reread with
matching pending status, submittedAt and cleared note before controls return. Failed, malformed,
lost or unreconciled results require Refresh; no blind retry is sent. Backend-recorded canonical
`#admin/batches/BATCH-code` notification/activity links are Admin-only aliases for supported saved
company detail, using the company endpoint. They do not mount a queue or approval/rejection workspace.
Those decisions remain a separate pass; no mandatory review or maker-checker rule is invented.

### Unsponsored-batch cancellation

Saved Admin company detail `#company/batches/:id` offers cancellation only for draft,
pending-review or open batches with zero sponsorship records. A nonblank reason of 1–1,000
backend-counted characters is required, with explicit confirmation of the saved code/name/status
and reason. No cancellation control is mounted on create/edit/list or public pages. The reason
participates in dirty-navigation/reload protection and can be discarded by confirmed Refresh.

Cancellation sends one `POST /v1/admin/batches/:id/cancel` with only `{note}`. The backend
rechecks status and **every** sponsorship record under its row lock; unpaid/cancelled sponsorship
records still forbid it. Cancellation sets cancelled status/time/reason, hides public availability,
and retains the batch, recorded observations and review metadata. It does not delete, restore,
refund, reverse escrow, settle sponsorships or change marketplace orders/payments. Repeating a
completed cancellation is a conflict, not idempotent success.

The page and adapter share cross-action locks within their respective scopes, bind the write to
the current full Admin session, disable 401/transport replay and validate the returned code,
cancelled status, timestamp, exact reason and zero sponsorship count. The company record is
then reread before any further action. Failed/uncertain requests require Refresh; a lost reply
never triggers a blind retry. The cancellation slice adds no review queue, approval/rejection,
hard deletion, new backend endpoint or sponsorship transaction. Optional submission was added
separately above.

### Facilities and controlled compliance documents

Admin-only `#company/facilities`, `/new`, `/:id` and `/:id/verification` connect the shared
facility list, creation, read-only detail and compliance submission/resubmission. There is no
facility edit/delete endpoint, and no such control is offered. `#admin/facilities` locally
filters the real company directory by its embedded verification status; it is not a server
review queue. `#admin/facilities/:id/review` supports explicit approval, rejection and
revocation; the backend-recorded `#admin/facilities/:id` alias resolves to the same review.
All Admins share these permissions, including self-review. User access remains denied.

Submission sends 1–20 unique confirmed `farm_document` upload references, replaces the complete
document collection and sets verification to pending from any previous status. Saved document
IDs are not upload IDs; saved responses expose neither reusable upload IDs nor private URLs.
After reload, resubmission therefore requires replacement upload references. Removing a local
reference does not delete the stored file. Omitted submission dates become null; omitted
inspector/notes retain existing values. Explicit inclusion controls allow empty text to clear
inspector/notes. Review omissions retain saved fields. Dates are entered/transmitted as UTC.

Approval requires an explicitly supplied future expiry, an effective non-none level and
controlled documents. Rejection/revocation have no invented mandatory reason or prior-status
restriction. Current compliance is derived from approval, level, future expiry and controlled
documents; expiry is not a new stored status. Resubmission, revocation or expiry can hide
otherwise-public batches without changing their stored status or cancelling/refunding
orders/sponsorships. No payment, batch progression or settlement action is coupled to review.

Uploads accept JPEG/PNG/WebP/GIF/PDF up to the server's default 10 MiB; there is no capability
endpoint for configured limits. Returned private storage URLs are validated then discarded.
Documents are fetched only from the authorized facility/document content endpoint, validated
against protected MIME/byte metadata, and offered through temporary Blob download URLs, never
inline previews or static/new-tab private links. Legacy uncontrolled documents cannot use
controlled downloads. Temporary URLs are revoked when replaced or the view/session is invalidated.
The retained declared-MIME and transient-upload-exposure limitations described above are not
fixed by this frontend integration; metadata cannot guarantee a file still exists on disk.

Page and adapter locks serialize local writes. Full session stamps, abort/sequence guards and
private-display invalidation protect accepted results. Every POST/upload disables automatic
401 replay and uncertain transport retry. Accepted writes are followed by authoritative reads
before another action; failures require Refresh/reconciliation. Unknown uploads require an
explicit acknowledgement to continue without that file, not replay. Unknown creation stays
blocked in that mounted page, including after Refresh; inspect the shared list before creating
again after leaving/reload. A confirmed created ID prevents duplicate creation even if route
replacement is refused. Submission/review preflight snapshots validate retained fields and
document changes, but separate GET/POST requests are not an atomic version check; concurrent
Admin writes may conservatively fail acknowledgement validation and require reconciliation.

### Optional internal listing review and recorded activity

Admin-only `#admin/queue`, `#admin/review/:id` and `#admin/activity` mount standalone company screens, not the legacy Admin/demo workspace. Guest login destinations are allowlisted and the active router enforces Admin access. Every Admin may review shared records, including their own; direct publication remains available without mandatory review.

Company submit/withdraw use bodyless POST actions. Submission of a complete saved draft, changes/rejected record or approved listing locks editing and immediately hides any live listing. Paused records cannot submit. Withdrawal returns pending to hidden draft and clears submission time. Current decision/history are shown from the server, with review timestamps explicitly UTC.

The queue uses server `pending`, `approved` and combined changes/rejected tabs; search and ten-row paging operate on the returned array. Detail shows six saved field groups, public media, nullable decisions and recorded history. The five backend completeness hints omit rules such as age, size and shipping: they are neither certification nor a full completeness guarantee. Approve publishes pending content; reject/request-changes require trimmed reason (1–120), feedback (10–2000) and integer field group 1–6. Approved/paused takedown requires a trimmed 10–2000-character explanation; it hides the listing but does not cancel or refund orders. No decision-notification promise is invented. Submission does emit backend preference-controlled Admin notifications; these now appear in the personal inbox described below.

Mutations require explicit confirmation, guard duplicate clicks and validate returned ID/state/decision acknowledgements. Review detail is hidden and re-read after success because mutation replies lack completeness hints. Failed or uncertain decisions disable actions until Refresh reconciles the record; uncertain transport writes are not automatically replayed. Dirty decision text guards navigation/reload and can be discarded by confirmed Refresh. Reads are aborted and private display is bound to the current Admin session. The retained backend has no atomic status/version check for moderation: two concurrent decisions can both commit, the last update wins, and audit records can contain both. Refresh and frontend locks do not solve that race; backend concurrency hardening is separate scope.

Activity independently loads a real newest-first array with integer window limits 100/200/300. Counts and local ten-row paging/search describe only that fetched window, not complete history or platform analytics. Recorded actor roles/actions remain unchanged; System appears only if recorded. Only known active Admin links are clickable; unknown, external, User-only and unintegrated links remain plain text. No fictional overview totals or editable roles were mounted.

### Admin account directory and User status

Standalone Admin-only `#admin/users` searches and pages the real account directory. Name/email search, role/status filters and totals come from `GET /admin/users`, not demo state. Rows use immutable IDs and expose only name, email, actual User/Admin role, active/suspended status and UTC joined time. All Admin accounts are visible but protected from status changes, including self; Admin recovery/provisioning policy is outside this slice.

Suspend/reactivate requires an explicit confirmation identifying the exact account and sends only `{status,expectedStatus}` to `PATCH /admin/users/{encodedEmail}/status`. The server locks the target and rejects stale/same-state confirmations. Suspension revokes all target sessions atomically with status/activity; reactivation requires fresh login and never revives old tokens. No reason, timed expiry, deletion, role change or bootstrap is offered. Orders/payments/carts/history are preserved, not cancelled/refunded. Already authorized in-flight work is not undone, and idle tabs discover revocation on their next protected request rather than a push notification.

Private reads are aborted and session-bound, actions have duplicate locks and returned identity/status validation, and failed/uncertain writes require Refresh before another confirmation. No optimistic state or uncertain automatic replay. A suspended-account 403 or invalid refresh clears the current local session and rejects late private results; ordinary permission denial and older-session errors cannot clear a newer login. Expected status is not a version token and cannot detect an intervening suspend/reactivate cycle ending in the same state. Legacy Admin/Portal/demo account-management screens remain unmounted.

### Own profile and notification preferences

Exact `#account/profile` and `#account/settings` work for both active User and Admin accounts,
with guest login-return and a Profile header link. Standalone `AccountDetails.tsx` uses `/me`
and `/me/prefs`, never legacy Account/Settings or demo mutations. Email, role, status, joined
and email-verification timestamps are read-only. Name must be nonblank (max 80); phone (max 32)
and location (max 120) are optional, trimmed and cleared by saving blank strings. Profile is
not the order delivery address. No password comparison/change, avatar or deactivation is offered.

Preferences save actual booleans for status/system/reminders, with all three choices explicitly
replaced. Backend partial merging is row-locked, but later full saves can overwrite another tab:
no version-conflict check is implemented. Switches affect future matching notifications, not
existing inbox history/read states; success/error/approval messages are not muted by them.

Exact public projections, immutable identity and returned saved fields are runtime-validated.
Accepted writes hide old details and authoritatively refetch before editing. Failed/uncertain
writes require successful Refresh, with no automatic 401/network replay. Dirty navigation/reload
and synchronous duplicate/cross-action guards protect local edits. Aborted reads, sequence guards
and session-generation checks prevent stale profile publication. Publishing verified display data
updates the header without replacing the access token or restoring a signed-out session.

### Personal notification inbox

Exact `#account/notifications` is available to both active User and Admin accounts, with guest
login-return and a plain signed-in Notifications header link. The standalone screen uses personal
`GET /me/notifications`, server read/type filters and 10/25/50/100-row paging. Filtered total is
separate from unread total across the entire owner's inbox. History is not capped at 200 rows.
Legacy Account/Portal/demo notification providers remain unmounted; failures cannot block catalog
or order loaders.

Known EN/VI title/body keys substitute escaped text and integer VND parameters; unknown keys or
unsuitable/arbitrary nullable JSON params remain readable key/JSON fallback. Only mounted,
role-appropriate canonical destinations are links, including public batch list/detail for both
roles and shared company batch list/detail for Admin. Unsupported, external and malformed
routes remain recorded text. Opening a destination does not mark a notification read.

Mark-read sends exact `{read:true}` and preserves an existing read timestamp. Mark-all requires an
explicit confirmation naming the account and entire inbox, then sends a bodyless POST. It affects
all owner unread history, not just filtered rows/page. Its returned count is not an unread-zero
promise: new arrivals may remain unread. Both actions use synchronous cross-action locks, validate
acknowledgements and refetch before another action. Failed/uncertain writes hide stale results and
require Refresh; no automatic 401/network write replay. Private reads are aborted/session-bound.
There is no deletion, mark-unread, bell, global badge, polling, cache or preference/generation change.

### Verified results and limits

Checkpoint `38f0dd7` saved auth/catalog/cart/checkout/buyer orders/company fulfilment, `90c00a0` saved disputes/private evidence, and `3c333f1` saved shared company catalog editing/publication on `integration/team-baseline`. Nothing was pushed. The verification paragraphs below distinguish the earlier dispute pass from the catalog pass.

On 2026-10-28, all 62 frontend tests in eight files passed, including 20 dispute helper/transport tests and five new shared identity/late-response tests. Frontend TypeScript/build passed and the final dependency audit reported zero vulnerabilities. Backend TypeScript/build/lint, 23 unit tests and all 71 isolated e2e tests passed. The known `pg` concurrent-query deprecation warning remains. Backend source, schema, migrations and tests were not changed by this dispute slice.

The earlier company browser pass covered preorder readiness/balance payment/shipment/delivery, buyer and Admin completion, buyer/company cancellation/refunds, shared Admin access, role/foreign-owner denial, filtering and failure/Refresh reconciliation. Vietnamese copy and mobile company queue width were checked. Fixture creation used the real API; subsequent actions used the UI. The complete cart/checkout GUI journey was checked separately in the earlier slice.

The dispute browser pass covered guest owner/Admin deep-link login, buyer creation with blank-description blocking and explicit confirmation, open-dispute receipt-completion rejection, shared Admin review followed by resolution, direct rejection from open, persisted final decisions after reload, owner history/readback and authenticated owner/Admin evidence fetches producing Blob download links. After resolution, the order remained delivered until the buyer explicitly confirmed receipt; only then did it become completed. Fixture orders and the second case with a 68-byte PNG were created through the actual API during setup. Setup verified exact evidence bytes for owner/Admin, private static 404, duplicate case 409 and Admin denial on the owner route.

Final database checks confirmed saved `ORD-10121`/`ORD-10122` and the previous four company fixtures were unchanged. New `ORD-10127` is completed/paid with a resolved case; `ORD-10128` is shipped/paid with a rejected case and retained attachment. Each has exactly one unchanged 1,000 ₫ payment, with no automatic refund. Only the inspected dispute fixture listing was soft-archived; stock remains two and public detail returns 404. Together with the four previously archived company fixture listings, all five test listings are hidden without deleting accounts, orders, payments, disputes or evidence. No database reset/reseed or migration replacement occurred.

Normal click commands were unreliable, so snapshot-grounded control fallbacks invoked actual UI handlers and requests. This is not complete mouse/keyboard-only or visual acceptance. The browser does not support file selection/upload automation; actual save-to-disk download was not verified. Dispute-specific failure/Refresh interaction, status-filter interaction, foreign-owner UI denial and Vietnamese/mobile layout checks remain unexercised; helper/transport tests and retained backend tests cover relevant rules, not full component interaction. Automatic deadline expiry and concurrent transitions also retain backend coverage rather than complete browser claims. Reviews and the full marketplace acceptance gate remain outstanding; deployment stays deferred.

During wrap-up the existing browser tab could no longer restore for activation; the final browser discovery returned no controlled or user tabs. Its last verified state was signed in as the local test User on `ORD-10127`, so final sign-out/guest handoff was not verified. Node heap exhaustion, Windows process-allocation failures and a login 500 were observed earlier, while `/health` still returned 200/database up. Guarded database-only cleanup succeeded, and a later authenticated API verification passed: terminal-case duplicate guards, owner/Admin evidence byte equality, unauthenticated/role denials, private static 404 and canonical Admin status filters. No blind server/system restart was performed; later API success does not establish the cause of the earlier resource/browser failures.

On 2026-10-28 the company catalog pass finished with **103 frontend tests in eleven files**, TypeScript/build passing and zero dependency audit vulnerabilities. Backend TypeScript/build/lint, **23 unit tests and 71 isolated e2e tests** passed again; backend source/schema/migrations/tests are unchanged. The known `pg` concurrent-query warning remains.

The catalog browser pass created `FM-48379` as a name-only draft, followed the returned edit route, completed all six field groups with a confirmed public PNG URL, saved separately, published, read the public listing and saved a live breed edit. Server readback confirmed the exact content, main image and Created/Updated/Published/Edited history. Pending filtering and local search empty state worked. Vietnamese controls were checked; the expanded Admin header initially overflowed mobile width, then wrapping corrections brought document width to 375 at a 390 × 844 viewport. Desktop width was 1280 at 1280 × 720. Cancelling a dirty header link preserved the editor and unsaved field. Malformed encoding, alias canonicalization and Back/Forward guard behavior have automated tests; a browser Back/dialog operation later stalled, so Back/Forward accept/cancel and final sign-out are not claimed verified. The final server-confirmed create route replacement passed automated checks but was not rerun through the browser.

A separate real API pass verified name-only create, shared Admin B list/detail/save, complete media save, direct publication, immediate public price change while remaining approved, incomplete publish 400, User 403 and pending PATCH 409. Public upload used a valid 76-byte PNG; anonymous retrieval matched exact bytes. Only inspected fixtures were hidden through supported APIs: `FM-48379` and `FM-48380` paused; `FM-48381` withdrawn then soft-deleted. All three public details return 404. Images/history/accounts were retained; the original four available public listings and all 13 existing orders are unchanged. No reset/reseed or file deletion occurred.

Catalog file-picker automation is unsupported, so media upload is API-verified, not GUI upload acceptance. Multi-image cover/reorder/removal, preorder form interaction, unknown-create recovery, failure/Refresh interaction, alias/login-return and User route-denial browser journeys remain unexercised; automated and backend checks cover their rules, not full component acceptance. A desktop screenshot was captured but this model could not inspect image input; no visual-layout acceptance is claimed. Normal browser clicks remained unreliable and verified-control fallbacks invoked actual UI handlers. Optional internal review/activity were still outstanding at the catalog checkpoint; they are implemented in the subsequent slice below. Account/farming integrations and the full marketplace acceptance gate remain outstanding; deployment stays deferred.

On 2026-10-28 the optional review/activity slice passed **130 frontend tests in thirteen files**, TypeScript/build and dependency audit (zero vulnerabilities). The 27 added regressions cover review helpers/transport, activity projections, nullable decisions and company submit/withdraw. Backend TypeScript/build/lint, **23 unit and 71 isolated e2e tests** passed again without backend/schema/migration edits; the known `pg` warning remains.

The real browser pass on fresh `FM-48383` verified all six read-only groups/hints, empty reason validation, trimmed reason/feedback and step 2 confirmation, request changes and persisted shared-company feedback, resubmit, pending editing lock, withdrawal to draft, submit, approve and takedown with the no-order/refund warning. Accepted decisions triggered authoritative detail/hint refetch. Server pending/live/combined sent-back tabs and local empty/matching search were exercised. Activity showed the actual events, ten-row Next paging, empty/matching search, the default 100 window and a 300 window returning 243 recorded rows, and a real link back to the rejected review detail. Vietnamese review/activity text and document width were checked: 375 pixels at 390 × 844; activity desktop width was 1265 at 1280 × 720. The local Admin was signed out to settled guest Home.

Independent localhost API verification used 96 requests, excluding browser requests, and recorded 42 successful assertion-group executions across 33 unique labels. It covered the full optional lifecycle (including rejection), shared/self-review, anonymous/User denials, pending edit/delete lock, queue/hint/activity contracts and exact audit projections. It confirmed public 200 while the UI fixture was approved, then public 404 for all three fixtures after takedown. `FM-48382` remains untouched draft; `FM-48383` is rejected with eight recorded history/activity entries; `FM-48384` retains its separate rejected API lifecycle. No dependencies, orders, payments or uploads were created for this slice. Original row fingerprints across nine protected tables, all 13 orders, 13 order items, 15 payments and two uploads are unchanged. Original available public IDs remain `FM-18420`, `FM-18877`, `FM-19544`, `FM-20761`; `available=false` also includes sold-out `FM-19102`. Fixtures/media/history/accounts are retained without deletes, reset or reseed.

Normal pointer commands repeatedly timed out; snapshot-grounded element controls invoked the actual UI handlers and requests. No full pointer/keyboard-only or screenshot visual acceptance is claimed. Direct rejection, approved resubmission hiding, guest login-return/User denial, uncertain decision/Refresh, dirty decision navigation, alias canonicalization, 200-window selection and unsafe-link rendering were not separately browser-exercised; helper/transport/API coverage is not component acceptance. Review queue paging lacked enough matching rows. The final catalog UTC decision/history formatting fix passed automated checks but was not separately browser-rerun. Concurrent moderation remains unfixed. Account/farming, notification inbox, analytics and sponsorship transactions/settlement remain separate; deployment stays deferred.

### Latest Admin users verification — 2026-10-28

All **152 frontend tests in fifteen files** passed after final query-bound and stored-name compatibility fixes; TypeScript/build passed and audit reported zero vulnerabilities. The 22 new regressions cover Admin-user helpers/transport, protected targets, exact status acknowledgements, duplicate/no-replay behavior and session invalidation/late results. Persisted string names remain escaped React text rather than being rejected by invented frontend-only name rules. Backend **27 unit and 162 isolated e2e tests** passed, including 91 Admin-user cases; TypeScript/build/lint passed with zero lint warnings/errors. The known `pg` concurrent-query warning remains. This slice changes backend user endpoints/session issuance but not schema, migrations or dependencies.

The browser verified guest users deep-link login-return, unique server email search, exact suspend/reactivate confirmations and authoritative Active/Suspended/Active readback on one fresh local User. Both roles and protected Admin rows were visible. Ten-row server paging returned ten then one row with total eleven; Admin filtering reset to page one and returned four protected accounts without status controls. Vietnamese labels/timestamps and mobile width were checked (375 at 390 × 844); desktop width was 1265 at 1280 × 720. English/desktop were restored, and sign-out reached settled guest Home with the original four available listings.

A corrected setup/final localhost API verifier recorded **30 requests and 11 assertion-group executions**, excluding browser calls and an earlier incomplete attempt. It checked permissions/validation/conflicts, all old target sessions remaining revoked after reactivation, suspended login denial, fresh login success, exact successful audit and read-only original-row fingerprints. The final fresh fixture is active with four retained status actions and no unrevoked sessions. A first fresh fixture also remains active after its API cycle; that verifier stopped on parsing an empty logout response, so no blind mutation replay or cleanup deletion was used. Both accounts/history remain for inspection. All ten baseline User rows and original 18 listings, 18 drafts, 15 images, 54 listing-history rows, 13 orders/items, 15 payments and two uploads are unchanged. No original account was status-mutated, and no listing/order/payment/upload, reset/reseed, direct database write or deletion was introduced.

Normal pointer and some keyboard/fill actions were unreliable; snapshot-grounded observed controls invoked actual handlers/HTTP after readback. No complete pointer/keyboard-only, component interaction suite or screenshot visual-layout acceptance is claimed. Keep-unchanged, failure/uncertainty with Refresh, an active User tab discovering suspension, User route denial, status-filter UI interaction, activity-to-users navigation and unusual-name rendering remain unexercised GUI journeys; automated/API checks are not substitutes. A pre-existing success notice retained its original English wording on language switch. Admin lifecycle/provisioning policy, profile/preferences, notifications, farming/compliance, analytics and sponsorship transactions/settlement remain separate. This and review/activity are saved as `f2d1b37` on `integration/team-baseline`; no push/merge/deployment occurred.

### Latest personal inbox verification — 2026-10-28

All **426 frontend tests in seventeen files** passed, including **274 new notification helper/transport tests**; TypeScript/build passed and audit reported zero vulnerabilities. Backend **27 unit and 266 isolated e2e tests** passed, including 104 notification cases; TypeScript/build/lint passed with zero lint warnings/errors. The known `pg` concurrent-query warning remains. Deep JSON snapshot and unparsed-body validation regressions were fixed before these final runs. No schema, migration, dependency or generation/preference changes occurred.

Real browser acceptance used two fresh local Users. Guest inbox login-return and independent welcomes worked; opening Marketplace did not mark read. Single read persisted across reload. Unread/ten-row filtering returned an empty result after reading. On the second account an Error filter showed zero rows but one owner-wide unread; Keep-unchanged plus Refresh preserved it, then explicit full-inbox confirmation updated one and refetched zero unread. Reload preserved the read timestamp. Vietnamese welcome/read/UTC labels and language-switch translation of the success notice worked. Width checks found no horizontal overflow at 390 × 844 and 1280 × 720; English/desktop were restored and both accounts signed out to guest Home.

Separate local API continuation passed **175 requests/736 assertions**, MIME regression **6 requests/124 assertions**, and final database-only verification **97 assertions with zero HTTP requests**. All 755 original rows across 35 tables retain exact fingerprints, including original Admin notifications. Only the two exact GUI welcomes' `readAt` fields changed; three fresh test accounts/welcomes are retained. Historical verifier-only timezone and Docker-address assumptions were corrected without replaying registrations; the complete ledger preserves those failures. No reset/reseed, deletion, direct development DB write or original read-state mutation occurred.

Limits: normal pointer/keyboard activation was unreliable; snapshot-grounded visible enabled controls invoked actual UI handlers after ineffective-action readback. This is not full pointer/keyboard-only acceptance. One welcome per fresh inbox did not exercise populated multi-page GUI history; Admin inbox behavior, arbitrary JSON/unsafe links, failure/uncertainty reconciliation and concurrent arrivals retain automated/API coverage, not full GUI claims. Mobile screenshot capture failed; a desktop screenshot was captured but image input could not be inspected, so no screenshot visual-layout acceptance is claimed. The complete marketplace gate and production moderation/upload hardening remain outstanding. Inbox changes are saved in `fb562af` with profile/preferences and chat-scope documentation; no push, merge or deployment occurred.

### Latest own profile/preferences verification — 2026-10-28

All **612 frontend tests in nineteen files** passed after the strict session-stamp/identity integration fix, including **180 new account helper/transport cases and six session-publication regressions**. TypeScript/build passed (87 modules), audit reported zero vulnerabilities and focused re-review found no remaining actionable issue. Backend **423 isolated e2e and 27 unit tests** passed, including 157 profile/preferences cases; TypeScript/build/lint passed. Known `pg` concurrent-query deprecation remains. No schema, migration, dependency or lockfile changes occurred.

A fresh User's real browser journey covered guest profile gating/registration, readonly identity, blank-name blocking, trimmed saved name, cleared phone/location, authoritative header update and profile/session reload persistence. Settings saved actual system false and survived reload. Discard restored an unsaved preference to its saved value without a write. EN/VI labels, UTC dates and immediate translation of the save notice passed. Both screens had document width 375 at 390 × 844; desktop profile width was 1265 at 1280 × 720. English/desktop were restored and actual sign-out reached guest Home with the original four available listing IDs.

Independent localhost API checks passed **760 assertions across 176 requests**, including **55 invalid profile/preferences PATCHes** with unchanged follow-up reads. Final combined read-only verification passed **56 assertions** and preserved complete fingerprints for **776 original rows across 35 tables**. Exactly two fresh Users/welcomes/sole Sessions/registration Activities remain; both Sessions are revoked, GUI welcome remains unread and unchanged, and no original account/read state was mutated. No direct development DB write, reset/reseed, deletion or new commerce/upload occurred.

Normal pointer actions were unreliable; observed visible enabled control fallbacks invoked real handlers after readback. No full pointer/keyboard-only, component interaction suite or screenshot visual-layout acceptance is claimed. Admin account UI, dirty navigation/Back/Forward/reload confirmations, failure/uncertainty with Refresh, cross-tab saves and post-save notification generation remain unexercised browser journeys. Helper/API tests are not substitutes. Inbox/profile/preferences and chat-scope docs are saved in `fb562af`; nothing was pushed, merged or deployed. Password change, avatars and self-deactivation stay outside this slice.

### Latest catalog lifecycle verification — 2026-10-29

All **645 frontend tests in nineteen files** passed, including **33 new catalog regressions** (72 tests across the two catalog helper/transport files). TypeScript/build passed (87 modules), audit reported zero vulnerabilities. A review found a post-delete history-restoration race; confirmed-removed state now blocks all editing/writes even if redirect is refused, and missing edit records cannot create. Focused re-review found no remaining issue. No component interaction suite was added.

Backend **423 isolated e2e tests and 27 unit tests**, TypeScript/build and lint passed. Docker/PostgreSQL initially was stopped; retained local services were started without resetting/reseeding. A subsequent 422/423 run exposed cross-suite status broadcasts reaching notification-test Admin inboxes. Only isolated test Admin preferences were changed atomically during promotion to prevent that interference; production code and read-all assertions are unchanged. The final full suite passed. Known `pg` concurrent-query deprecation remains. Schema, migrations, dependencies and lockfiles are unchanged. The lifecycle slice follows `fb562af` and is saved in the local catalog-lifecycle checkpoint dated 2026-10-30, without push/merge/deployment.

Separate localhost lifecycle verification passed **88 assertions across 30 successful-run HTTP requests**, including **11 mutations** for login/logout and fixture setup. Including the earlier halted attempt and standalone health preflights, the verifier completed 34 requests. Fresh `FM-48385` was inspected then soft-deleted: exact two-key acknowledgement, company/public 404 and list omission, retained row/draft/history. Fresh `FM-48386` completed publish/pause/resume and ends complete/paused with its reused public image. Resume accepted temporarily incomplete description without clearing metadata/media; complete description was restored before final pause. No uncertain responses or automatic mutation replay occurred.

Read-only aggregate preservation across both attempts found **784 original rows in 35 tables**, zero removals and **783 unchanged full-row fingerprints**. Only the existing listing Sequence changed, exactly +2 for the two creates. Exactly two Listings, two Drafts, one image reference, nine History rows, nine Activities and two verifier Sessions were added. Original accounts/profile/inbox/read states and prior fixtures remain unchanged. A fresh final 35-table READ ONLY check made zero HTTP requests and found no changes since the final-logout snapshot. No upload, new commerce, direct development DB write, reset/reseed or file deletion occurred.

The final exact verifier session logged out and was verified revoked. An earlier media-preflight attempt created no listing but left session `cmvtszvdb0000acj5k2ag204r` with logout unconfirmed after its cookie was lost; no broad Admin revocation or original password change was attempted. Initial tool-output redaction also missed one local-fixture credential literal. Secrets are not repeated in documentation/ledger, and exposed group-chat credentials were not used. External verifier/ledger paths and exact disposition are recorded in the integration map; do not blindly rerun a completed mutation verifier.

Current browser checks covered guest Home, the real login page and guest company-catalog gating only. Admin lifecycle actions/confirmations, dirty navigation and post-delete restoration, uncertain failure/Refresh, EN/VI lifecycle interaction, mobile layout and screenshot visual acceptance remain unexercised. The helper/transport/API passes and static review are not complete component/browser acceptance.

The pre-checkpoint regression reran on 2026-10-30 with the same **645 frontend / 423 backend e2e / 27 backend unit** tests passing, both typechecks/builds passing, lint clean, zero frontend audit vulnerabilities and `git diff --check` clean. A strict GUI/visual acceptance attempt then stopped at its image-input prerequisite: the runtime captured a screenshot, but both emitting and reading it reported that the selected model cannot receive image input. No screenshot was visually inspected, so this is a **blocked acceptance attempt**, not a browser pass or an application failure. No credential read, login, new fixture, lifecycle mutation, injected interaction or service restart occurred. Admin controls, dirty/delete/failure journeys, Vietnamese interactions and mobile visual layout remain unverified; the previous fixture/session disposition is unchanged.

### Saved batch/facility checkpoint

Public/company batches, facility compliance and unsponsored-batch cancellation are saved locally
as `bb04b11` on `integration/team-baseline`. Historical verification sections below retain their
then-uncommitted statements and test counts; this checkpoint supersedes those status statements.
Nothing was pushed, merged or deployed. The existing acceptance screenshot remains untracked and
untouched.

### Latest saved-draft submission verification — 2026-10-30

The full frontend suite passed **914 tests in 24 files**, including 32 new persisted Node
component-contract cases. TypeScript and production build passed (101 modules); npm audit
reported zero vulnerabilities. Tracked and new-source whitespace checks passed. The retained
backend again passed **423 isolated e2e tests in eleven suites and 27 unit tests**, TypeScript,
build and lint (zero warnings/errors). The known `pg` concurrent-query deprecation remains.
No backend production code, schema, migration, dependency or lockfile changed in this slice.

Submission transport coverage checks the exact bodyless protected POST, prerequisites and
malformed acknowledgements, server-authoritative compliance expiry, no 401/network replay,
cross-action locking through decoding, and full session-generation/ID/role invalidation.
The Node harness executes the actual transpiled component and event handlers with deterministic
hooks and mocked transport/session/navigation. It covers clean detail-only confirmation,
stale/changed-back local state and routes, duplicate writes, acknowledgement/reread conflicts,
retained observations, late session/unmount results and escaped company-only UTC review metadata.
It uses no mounted DOM, real HTTP, login or database; it is not browser acceptance.

Focused local source/test review completed. An exact-match check and regressions reject recorded
Admin batch aliases ending in a newline or carriage return. Independent transport and UI review
attempts, including bounded retries, failed at the provider without returning conclusions; no
independent reviewer sign-off is claimed. No new browser/visual acceptance was attempted because
the established image-input prerequisite remains unavailable. Real Admin submission/Refresh,
notification/activity deep-link login-return, pointer/keyboard interaction, EN/VI journeys and
mobile layout remain GUI-unverified.

Checkpoint `bb04b11` remains the saved local batch/facility/cancellation state; the new submission,
recorded-detail aliases and verification records remain uncommitted on `integration/team-baseline`.
Nothing was pushed, merged or deployed. No development login, live submission/cancellation,
upload, fixture creation, development database write, reset/reseed, cleanup or service restart
occurred in this slice. Existing data and the untracked acceptance screenshot were retained;
no new development preservation-fingerprint run is claimed. Review queue/approval/rejection,
hard deletion and sponsorship/financial actions remain outside this slice. Chat remains dropped.

### Latest owner ledger verification — 2026-10-31, closing

Milestone-15 slice: the §4.24 owner-history item — a read-only money history across all of a
sponsor's sponsorships, newest first. Backend surface consumed: `GET /v1/me/sponsorships/ledger`
(User `batch.sponsor`) with optional `skip` (1–10,000) / `take` (1–100, default 50); one read
over the Payment ledger filtered to the caller's sponsorships, ordered `createdAt desc, id asc`,
each entry flattened with shares, sponsorship status and batch code/title. Unpaid reservations
have no payment rows and never appear; refunds surface as `refunded` rows (funded-cancel flips
paid package rows, keeping paidAt and setting refundedAt; shortfall refunds are purpose-`refund`
rows with paidAt null). No schema or migration change.

Frontend changes: `services/sponsorshipContracts.ts` gained `SponsorshipLedgerEntry` /
`SponsorshipLedgerPage`; `services/sponsorshipsApi.ts` gained `ledger(skip?, take?, signal?)` —
local paging validation (invalid args throw with zero fetches), exact key-set row validation
enforcing the state/purpose/date invariants (paid rows carry paidAt and no refundedAt; refunded
rows carry refundedAt; refund-purpose rows never carry paidAt; duplicate ids rejected); the my-
sponsorships list effect now loads `mine()` and `ledger(undefined, 50)` together, and
`pages/marketplace/Sponsorships.tsx` gained a "Money history · newest first, refunds included"
table below the sponsorships table with batch links, EN/VI purpose/state labels, UTC dates and
an explicit empty state.

Verification: frontend **1006 tests in 27 files** (new: strict ledger row validation matrix
covering malformed totals, ids, purposes, states and dates, pagination query construction,
zero-fetch invalid paging and the corrected fetch-count window), typecheck and production build
clean. Backend regression: **442 isolated e2e tests in twelve suites** (one new: ledger
ordering, exact fee/refund/package row shapes and states, foreign-sponsor isolation, guest/Admin
refusals, four invalid paging params, skip/take pagination with stable totals), 27 unit tests,
lint clean, build clean, on the guarded `_test` database.

Limits: helper testing plus source review, not browser acceptance — the Money history table and
its EN/VI strings remain GUI-unverified. No development login, live mutations, uploads, database
writes or resets occurred. M15 remains uncommitted on `integration/team-baseline`; nothing was
pushed, merged or deployed. Chat remains dropped.

### Latest delivery fee verification — 2026-10-31, closing

Milestone-14 slice closing the last §11.4 item: the optional delivery fee charged per share at
harvest, outside the milestone escrow, paid by the sponsor before confirming delivery. Backend
surface consumed: `POST /v1/company/batches/:code/harvest` accepts optional `deliveryFeePerShare`
(integer VND ≥ 0) and charges `perShare × shares` to every growing sponsorship at once
(int-overflow checked for all rows before any write) as `deliveryFee` with
`totalAmount = packageAmount + deliveryFee`; `POST /v1/sponsorships/:id/pay-delivery-fee` is a
Buyer-only idempotent payment (fixed `sponsorship:<id>:delivery-fee` key, replay returns the
same record) that refuses nothing-due/late records with 409; `confirm-delivery` refuses 409
`sponsorship.deliveryFeeDue` while a charged fee is unpaid. No migration — the `delivery_fee`
Payment purpose already existed.

Frontend changes: `services/sponsorships.ts` gained `deliveryFeeOutstanding` (ready_for_delivery
+ fee > 0 + no paid `delivery_fee` payment); `services/sponsorshipsApi.ts` gained `payDeliveryFee`
with the shared mutation lock, session-stamp guard and strict ack validation (exactly one paid
fee payment matching `deliveryFee`, plus the package payment), and `companyHarvest` accepts the
optional fee field (validated, omitted when empty); `pages/marketplace/Sponsorships.tsx` gained
a Buyer "Pay the delivery fee" panel for outstanding fees and disables the confirm-delivery
button with an explanatory line until paid; `pages/company/CompanyBatches.tsx` gained the
optional integer harvest field with the confirmation summary line, and the stale M11 copy
("delivery fees and disputes are not connected yet") was replaced with current behavior;
`services/notifications.ts` gained the four EN/VI `sponsorshipDeliveryFeePaid` entries matching
the backend params.

Verification: frontend **1005 tests in 27 files** (new cases: outstanding-fee matrix across all
statuses, fee transport validation with malformed acks and a zero-fetch invalid method, harvest
body sending the fee only when entered, and a company contract case covering the fee input and
its fractional rejection), typecheck and production build clean. Backend regression: **441
isolated e2e tests in twelve suites** (two new: fee charged at harvest, confirm-delivery
refusing until the idempotent fee payment, delivery then settling with both notification pairs
and the activity row; and nothing-due/late-pay refusals with a working zero-fee delivery), 27
unit tests, lint clean, on the guarded `_test` database. A real flake was fixed: role-scoped
notification fan-out in the shared `_test` database crossfired between parallel e2e files, so
backend e2e suites now run serialized (`fileParallelism: false`).

Limits: helper testing plus source review, not browser acceptance — the fee panel, harvest field
and EN/VI strings remain GUI-unverified. §11 is fully implemented; owner ledger history remains
unbuilt. No development login, live mutations, uploads, database writes or resets occurred.
Everything from M10 through M14 remains uncommitted on `integration/team-baseline`; nothing was
pushed, merged or deployed. Chat remains dropped.

### Latest unpaid-reservation expiry verification — 2026-10-31, final

Milestone-13 slice closing the §11.4 `pending_payment ──expires (unpaid)──▶` lifecycle transition
(the spec sets no window; 24 hours was chosen and is documented on both sides). Backend surface
consumed: lazy expiry serialized under the batch advisory lock — inline in `reserve` (expired
holds release their shares before the availability check) and `grow` (before the batch leaves
open), and in per-batch locked transactions on the sponsor and company read paths (`mine`,
`one`/`escrow`, `companyList`, `companySponsors`). `pay` refuses an expired reservation with 409
`sponsorship.expired` before any write. Expiry cancels the record, restores its shares to the
pool, reopens a `fully_sponsored` batch, notifies buyer and Admin with the new
`reservationExpired` template pairs and logs a System actor activity row. No schema change — the
deadline is derived from `createdAt`; the backend holds no `expiresAt` field.

Frontend changes: `services/sponsorships.ts` mirrors the constant with `RESERVATION_TTL_MS` and
derives `reservationPayDeadline` (pay-by ISO time for `pending_payment` rows only) and
`reservationExpired` (true at exactly +24h); `pages/marketplace/Sponsorships.tsx` shows
"Pay by · UTC" in the list status cell and the detail reserved/paid/cancelled line and explains
the expiry in the payment panel; `services/notifications.ts` gained the four EN/VI
`reservationExpired` entries matching the backend params. No transport or validator changes were
needed — the response shape is unchanged.

Verification: frontend **1002 tests in 27 files** (one new matrix case: pay-by derivation for
pending only, expiry boundary at exactly +24h and not one millisecond before, and no expiry for
any other status), typecheck and production build clean. Backend regression: **439 isolated e2e
tests in twelve suites** (two new: late payment refused with the dedicated code, lazy expiry on
`mine` restoring shares/reopening the batch with the other user's fresh reservation untouched,
both notification pairs, a System activity row and a successful re-reservation of the restored
share; and expiry inline at `grow`), 27 unit tests, lint clean, on the guarded `_test` database.

Limits: helper testing plus source review, not browser acceptance — countdown rendering, EN/VI
strings and the admin company-list expiry view remain GUI-unverified. Only the optional delivery
fee at harvest remains unimplemented. No development login, live mutations, uploads, database
writes or resets occurred. Everything from M10 through M13 remains uncommitted on
`integration/team-baseline`; nothing was pushed, merged or deployed. Chat remains dropped.

### Latest sponsorship dispute verification — 2026-10-31, later

Milestone-12 slice per REQUIREMENTS §11 ("Disputes use the marketplace dispute flow"), on top of
the uncommitted M10/M11 work. Backend additions consumed: `POST /v1/sponsorships/:id/dispute`
(User-only `dispute.create`) files one dispute per eligible owned sponsorship — growing,
ready_for_delivery, delivered or settled (unpaid/funded records use the cancellation flow;
cancelled/refunded cannot be disputed) — serialized under the batch-level advisory lock, reusing
the marketplace reasons, 15–2000 description and up-to-three private `dispute_attachment`
uploads, with 409 on duplicates or already-used uploads and notifications/activity carrying the
batch code. The admin queue and open→reviewing→resolved/rejected transitions are unchanged and
shared with order disputes; the dispute response now carries `kind`, a nullable `order` and a
`sponsorship { id, shares, status, batch { code, title } }` object. Additive migration
`20261031000000_sponsorship_disputes` only (nullable `orderId`, unique optional `sponsorshipId`).

Frontend changes: the `Dispute` contract is dual-kind and the transport validator enforces
exactly-one-side; `services/disputes.ts` gained `sponsorshipDisputeEligible` and `disputeSubject`;
`services/disputesApi.ts` gained `createSponsorship` (canonical body, no-401-replay write,
session-stamp/`auth.sessionChanged` guards, strict ack validation incl. share positivity and
mismatched sponsorship rejection). `pages/marketplace/Sponsorships.tsx` gained a Buyer "Open a
dispute" panel on eligible statuses — reason select, 15–2000 description, optional ≤3-file
private evidence with the established upload-uncertainty handling, and a one-shot "File once"
confirmation that honours the page's blocked/attempted/Refresh-required machinery — plus a
read-only dispute record panel fetched with the detail and shown in place of the form afterwards.
The shared disputes screen renders both kinds: batch code plus a sponsorship tag in lists, the
order link only for order disputes, and reconciliation across kinds in the create/review
response check. No new notification keys were needed (existing dispute templates already take
the batch code as `{code}`).

Verification: frontend **1001 tests in 27 files** (7 new: the eligibility gate matrix, dual-kind
subject summary, canonical filing body and ack validation, a 7-case malformed-response sweep,
and conflict propagation with no replay of uncertain filings), typecheck and production build
clean. Backend regression: **437 isolated e2e tests in twelve suites** (two new sponsorship
dispute e2e cases covering permissions/eligibility/duplicate/owner visibility and the admin
review→resolve/reject path with buyer notifications and private-attachment access control) and
27 unit tests, lint clean, on the guarded `_test` database; one transient failure in an
intermediate full run did not reproduce in two subsequent clean full runs.

Limits: helper/transport testing plus source review, not browser acceptance — the filing and
admin review flows, EN/VI rendering and mobile layout remain GUI-unverified. Unpaid-reservation
expiry and delivery fees are not implemented. No development login, live mutations, uploads,
database writes or resets occurred. Everything from M10 through M12 remains uncommitted on
`integration/team-baseline`; nothing was pushed, merged or deployed. Chat remains dropped.

### Latest harvest, settlement and delivery verification — 2026-10-31

Milestone-11 core slice (disputes deliberately excluded as separate future work), built on the
uncommitted M10 sponsorship module. Backend additions consumed: `POST /v1/company/batches/:code/grow`
(`batch.update`, Admin-only growing transition that releases each funded sponsorship's stocking
escrow tranche — 30% floor — under the batch-level advisory lock `sponsor:batch:${code}`),
`POST /v1/company/batches/:code/harvest` (Admin-only harvest publication: computes mortality in
basis points and per-share yield, publishes a `Harvest` row, releases mid-growth tranches, refunds
any shortfall pro-rata from the held harvest tranche without ever exceeding it — refund Payment
with purpose `refund` plus an applied `shortfall_refund` Adjustment — and moves funded sponsorships
to ready_for_delivery) and `POST /v1/sponsorships/:id/confirm-delivery` (`batch.sponsor`, Buyer-only,
delivers the sponsorship and settles the whole batch once every sponsorship is delivered or
refunded, per §11.3). `pay` was also hardened for the pay-while-growing edge (status `growing` with
stocking tranche already released). Nine new notification template pairs cover growing, harvested,
shortfall refund, delivered and settled events in EN/VI with text/integer/money params only.

Frontend changes: contracts gained `adjustments`, `BatchGrowResult` and `BatchHarvestResult`; the
escrow ledger identity now reconciles as tranche sum + applied shortfall refunds = package amount;
`canConfirmDelivery` gates the Buyer confirm-delivery action in `marketplace/Sponsorships.tsx`,
which also renders the refunds-and-adjustments table; `services/sponsorshipsApi.ts` gained strictly
validated `confirmDelivery`, `companyGrow` and `companyHarvest` transports (mutation lock,
session-stamp guards, no replay) and status/timestamp consistency checks for growing → settled;
`pages/company/CompanyBatches.tsx` gained Admin grow (open/fully_sponsored) and harvest
(growing) panels integrated with the page's confirmation machinery — harvest takes the surviving
fish count plus, for weight-share batches, the whole-batch biomass in grams, validates bounds
locally, confirms once, validates the ack and reconciles against an authoritative company reread.

Verification: full frontend suite **990 tests in 27 files** (21 new M11 cases: shortfall-adjusted
escrow reconciliation, delivery gating matrix, confirm-delivery/companyGrow/companyHarvest exact
bodies and malformed-ack rejection, harvest input bounds, and seven Node component-contract cases
for grow/harvest eligibility, one-POST discipline, Refresh-gating without replay and weight-share
biomass requirement). TypeScript, production build, npm audit (0 vulnerabilities) and
`git diff --check` all passed. Backend regression retained: **435 isolated e2e tests in twelve
suites and 27 unit tests**, lint clean, including five new sponsorship e2e cases (grow escrow
release, harvest shortfall math, settlement sequencing, pay-while-growing).

Limits: helper/transport/component-contract testing plus source review, not browser acceptance —
real grow/harvest/delivery flows, EN/VI rendering and mobile layout remain GUI-unverified.
Disputes (`POST /sponsorships/:id/dispute`), unpaid-reservation expiry and delivery fees are not
implemented. No development login, live mutations, uploads, database writes or resets occurred.
Everything from M10 and M11 remains uncommitted on `integration/team-baseline`; nothing was
pushed, merged or deployed. Chat remains dropped.

### Latest sponsorship reservation, payment and cancellation verification — 2026-10-31

Connected the new milestone-10 sponsorship backend (`backend/src/sponsorships/`, uncommitted) to
the frontend. Backend surface consumed: `POST /v1/batches/:code/sponsorships` (`batch.sponsor`,
User-only reservation with advisory-lock share decrement and immutable terms snapshot),
`POST /v1/sponsorships/:id/pay` (full prepaid package, idempotency-key replay, exactly
reconciling 30/40/30 escrow tranches), `GET /v1/me/sponsorships`, `GET /v1/sponsorships/:id`,
`GET /v1/sponsorships/:id/escrow` and `POST /v1/sponsorships/:id/cancel` (pending → cancelled;
funded → refunded with reversed tranches, refunded payments and a refund adjustment), plus
Admin read views `GET /v1/company/sponsorships` and `GET /v1/company/batches/:code/sponsors`
(`batch.settle`). Eight new notification template pairs (admin/buyer × reserved/paid/cancelled/
refunded, text/integer/money params only) were added to the inbox dictionary. There is no
deposit or balance flow: the package is paid in full once, per the locked §11 decision.

New frontend files: `services/sponsorshipContracts.ts` (typed contract), `services/sponsorships.ts`
(route parse/build with unsafe-identifier rejection, pay/cancel eligibility, 1–500 reason and
strict reservation bounds — non-integer share counts are rejected, not truncated — snapshot-code
extraction, escrow reconciliation and retained-terms comparison), `services/sponsorshipsApi.ts`
(strict response validation incl. payment/escrow state invariants, mutation lock
`sponsorship.requestPending`, session-stamp `auth.sessionChanged` guards, no replay or network
retry) and pages `marketplace/Sponsorships.tsx` (my-sponsorships list/detail with snapshot-bound
pay/cancel confirmations and authoritative reread before adoption) plus `farming/SponsorPanel.tsx`
(Buyer-only inline reservation on public open batches, two-step confirm, guests see sign-in).
`App.tsx`, `Auth.tsx` login-return, the Buyer header link and `#farming` detail wiring route
`#marketplace/sponsorships[/id]`. Admin accounts see an explicit "sponsoring is User-only" note
and no form. Harvest publication, delivery confirmation, escrow release/settlement actions are
separate future work by design; this catalog is not an ownership dashboard.

Verification: the full frontend suite passed **969 tests in 27 files** (25 new sponsorship
helper/transport cases: route/eligibility matrices, bounds, exact GET/POST bodies, malformed and
inconsistent acknowledgements for reserve/pay/cancel, escrow-sum mismatch rejection, 409
pass-through, no 401 replay or uncertain-network retry, cross-action locking and late-result
session-change rejection). TypeScript and production build passed with a dedicated lazy
`Sponsorships` chunk; npm audit reported zero vulnerabilities; `git diff --check` was clean.
The retained backend passed its full regression with the new module: **430 isolated e2e tests
in twelve suites and 27 unit tests**, lint clean, on the guarded separate test database —
including seven new sponsorship e2e cases covering reserve contention, idempotent payment,
escrow sums, cross-user 403s, funded refund/reversal and fully-sponsored open/close cycling.

Limits: helper/transport testing plus source review, not browser acceptance — the established
image-input prerequisite remains unavailable, so real reservation, payment, cancel flows, EN/VI
rendering and mobile layout are GUI-unverified. Independent reviewer sign-off is not claimed.
No development login, live reservation/payment/cancellation, upload, fixture creation,
development database write, reset/reseed or service restart occurred. The backend sponsorships
module, its e2e suite and this frontend slice all remain uncommitted on
`integration/team-baseline`; nothing was pushed, merged or deployed. Chat remains dropped.

### Latest batch review queue verification — 2026-10-30

The full frontend suite passed **944 tests in 25 files** (30 new review helper/transport cases),
TypeScript and production build passed with a dedicated lazy `BatchReview` chunk, npm audit
reported zero vulnerabilities and `git diff --check` was clean. The retained backend passed
**423 isolated e2e tests in eleven suites and 27 unit tests** earlier the same day; no backend
production code, schema, migration, dependency or lockfile changed in this slice — the review
endpoints (`GET /v1/admin/batches`, bodyless `POST …/approve`, `POST …/reject` with a trimmed
1–1,000-note `BatchReviewDto`) are consumed as retained, verified against controller/service
source and the existing e2e review lifecycle.

New coverage: canonical `#admin/batches[/BATCH-code/review]` route parsing/building with unsafe
identifier rejection; pending-only decision eligibility; retained 1–1,000 note bounds;
content-ordering-independent retained-observation comparison; decision reconciliation of
acknowledgement against the authoritative company reread; exact protected queue GET and bodyless
approve POST with full approval invariant checks (open status, cleared note, facility/inspection
copy, valid controlled compliance, share/cost consistency); exact reject body; nineteen malformed
approval acknowledgements and four malformed rejection acknowledgements; 409 pass-through, no 401
replay or network retry, cross-action locking with submit/cancel/publish, and late-result
`auth.sessionChanged` rejection after same-account, other-account, logout and role-change.

The Admin-only screen loads the server pending queue (submitted-at ascending) or one saved batch,
hides all records/controls behind an active-Admin session guard, binds each confirmation to a
record/sequence/revision/hash snapshot, blocks approval while a rejection note is dirty, sends
exactly one decision, validates the acknowledgement, then re-reads the company record and adopts
it only if fully reconciled; failures and uncertain outcomes set a Refresh-required block with no
automatic replay. The header gains an Admin "Batch review" link and login returns respect review
routes. No withdrawal, deletion, sponsorship or financial action exists on this screen.

Limits: this was helper/transport testing plus a focused source review, not browser acceptance —
the established image-input prerequisite remains unavailable, so real queue navigation,
confirmation flows, EN/VI interaction and mobile layout are GUI-unverified. Independent reviewer
sign-off is not claimed. No development login, live decision, upload, fixture creation,
development database write, reset/reseed or service restart occurred. The submission slice,
review slice and records remain uncommitted on `integration/team-baseline`; nothing was pushed,
merged or deployed. Sponsorship/financial actions, batch hard deletion and facility scalar
editing remain outside the integration. Chat remains dropped.

### Latest batch integration verification

The complete frontend regression passed **785 tests in 21 files**, including **138 batch
helper/transport tests** and two new role-safe batch-link cases. TypeScript and production build
passed (95 modules), audit reported zero vulnerabilities, and whitespace checks passed.
The unchanged backend passed **423 isolated e2e tests in eleven suites and 27 unit tests**,
TypeScript/build and lint (zero warnings/errors). The known `pg` concurrent-query deprecation
warning remains. The e2e suite used the guarded separate test database, not development data.

Independent review found and repaired tied-position image acknowledgement ordering, public
detail remaining visible after a visibility-denying feed 404, and new-draft Refresh not discarding
local form values. Image validation now preserves complete tuple multiplicity and the actual cover
without requiring a backend-unspecified tie order. Feed 404 hides detail and requires a full reread;
ordinary feed errors remain independently retryable. Confirmed new-draft discard clears form/baseline
without clearing uncertain-create or confirmed-created recovery locks. Optional measurement and
budget displays retain nullable fields and exact BigInt totals.

Read-only local requests returned an empty public list (`total=0`, `pages=0`) and anonymous
company batch/facility 401 gates. No authenticated development write, login, upload, fixture
creation, reset/reseed, direct database write, cleanup or service restart occurred in this slice.
No new preservation-fingerprint run is claimed. Batch changes remain uncommitted on
`integration/team-baseline`; no push/merge/deployment occurred.

No batch GUI/visual acceptance was attempted because the established image-input prerequisite
remains unavailable. These helper/transport tests and retained backend tests are not a mounted
component suite or browser acceptance. Admin form/save/publish/update, failure/uncertainty recovery,
canonical-navigation refusal, dirty Back/Forward/reload, EN/VI interactions and mobile visual layout
remain browser-unverified.

### Latest facility integration verification

Final frontend regression passed **819 tests in 23 files**, including **31 facility helper/transport
tests** (11 helpers, 20 adapter), two facility-safe-link cases and a shared upload-error wording
regression. TypeScript/build passed (101 modules), audit reported zero vulnerabilities and tracked/
new-source whitespace checks passed. Retained backend TypeScript/build/lint, **27 unit tests and
423 isolated e2e tests** passed; the known `pg` concurrent-query deprecation warning remains.
Backend production code, schema, migrations, dependencies and lockfiles are unchanged.

Independent review repaired and re-reviewed two P2 issues. Text normalization/projections/form
counters now match the retained validator's supplementary-character/presentation-selector length
semantics; native UTF-16 maxlength barriers no longer reject valid input. Targeted re-review passed
all 31 facility tests. Document cleanup no longer aborts downloads merely because same-session
refresh/profile publication replaces the display-user object. An actual-component in-memory harness
with mocked transport passed fourteen targeted refresh/profile/revocation/reconciliation cases,
including no late download URLs after real session invalidation and URL revocation. No remaining
scoped P1/P2 findings were reported; this is not a persisted component suite or browser acceptance.

### Cancellation automated regression and acceptance limits

The cancellation helper/adapter and shared error-message additions contribute 25 tests
(three helpers, twenty-one adapter cases and one wording regression). The full frontend suite
passed **844 tests in 23 files**; focused batch/shared transport tests passed 189 cases.
TypeScript and production build passed (101 modules); audit reported zero vulnerabilities.
The retained backend passed **27 unit tests and 423 isolated e2e tests**, including sponsorship
refusal and concurrent cancellation yielding one success and one conflict. Backend TypeScript,
build and lint passed; its known `pg` concurrent-query deprecation warning remains. No
backend/schema/migration/dependency changes were made.

Independent transport review repaired and re-reviewed a P2: a backend-valid retained Unicode
review note made cancellation acknowledgement and later Refresh fail the company decoder.
The review-note bound now matches retained validator semantics; maximum/+1 supplementary and
presentation-selector regressions cover cancellation and authoritative rereads.

Independent UI recovery review also found a stale-handler session boundary: the final
confirmation used render-captured eligibility rather than checking the live session before dispatch.
Opening cancellation confirmation and sending any page action now synchronously check the current
full session before locking or sending. Actual-browser reachability of the pre-rerender window
was not established; this closes the reproducible handler-level boundary, not a claimed live exploit.
Narrow re-review passed nine actual-transpiled-component cases: eight stale opening/final handlers
under generation/identity/role/logout changes sent nothing; a valid current-session duplicate-click
flow sent one cancellation and one authoritative reread. Both findings are resolved with no remaining
scoped P1/P2 reports. This in-memory mocked-hook harness is not a persisted mounted DOM or browser suite.

No development login, cancellation, upload or fixture mutation was performed. Cancellation
confirmation/Refresh, dirty Back/Forward/reload, session invalidation, EN/VI and mobile layout
remain GUI-unverified because the established image-input prerequisite remains unavailable.
Mocked helper/transport tests are not browser acceptance. Batch, facility and cancellation work
remain uncommitted; nothing was pushed, merged or deployed.

### Facility acceptance limits

This slice used no development login, authenticated mutation, upload, fixture creation, original-record
mutation, direct development database write, reset/reseed, service restart or cleanup. Automated
backend regressions used the separately guarded `_test` database. No new development-preservation
fingerprint run is claimed; earlier fixture/session disposition is retained. Batch and facility
changes remain uncommitted on `integration/team-baseline`, with no push/merge/deployment.

No facility browser/visual pass was attempted because the established selected-model image-input
prerequisite remains unavailable. Helper/transport tests, read-only component harnesses and backend
tests are not full mounted-component or browser acceptance. File-picker/save-to-disk download,
creation/submission/review, two-Admin interaction, failure/uncertainty/Refresh, dirty Back/Forward/
reload, guest return, session refresh/revocation, EN/VI interaction and mobile layout remain
GUI-unverified. Production private-upload hardening and complete marketplace acceptance remain open.

Do not use exposed group-chat credentials for testing. Create a fresh local-only account instead. Any `devCode` shown in the auth screen comes from the non-production backend response, not a fixed client code.

The [integration map](../docs/INTEGRATION_MAP_2026-10-26.md) records source selection, verified results, and later passes.
