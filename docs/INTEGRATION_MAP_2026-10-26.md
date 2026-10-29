# FishFarm integration map — local and team snapshots

**Reviewed:** 2026-10-26

**Saved local baseline:** `integration/team-baseline` at `ca6eb49`
**Saved application integration checkpoint:** `38f0dd7` — real auth, marketplace, checkout and order fulfilment (2026-10-28; not pushed)
**Saved dispute checkpoint:** `90c00a0` — buyer disputes, company review and protected evidence (2026-10-28; not pushed)
**Saved catalog checkpoint:** `3c333f1` — shared company catalog editing and direct publication (2026-10-28; not pushed)
**Saved review/activity and User-management checkpoint:** `f2d1b37` — optional listing review, recorded activity and Admin account directory/status/session enforcement (2026-10-28; not pushed)
**Saved account/inbox checkpoint:** `fb562af` — personal notifications, own profile/preferences and dropped chat scope (2026-10-29; not pushed)
**Purpose:** decide what to keep, adapt, restore, build or defer for each component before changing application code.

This is an implementation guide and decision register, not a claim that integration is complete. The user requested incremental integration and deferred deployment. Recommendations below are not all approved product decisions. No application changes, branch merges or deployment are performed by creating this document.

**Scope decision — 2026-10-28:** chat/messaging is dropped from the project scope, not deferred to a later integration pass. Do not build conversation endpoints or mount chat widgets. Unmounted legacy code and existing schema/migration history are retained; no deletion or database migration is part of this decision. References to outstanding messaging in historical slice records below describe their earlier scope and are superseded by this decision. Notifications and reviews remain separate features.

## Catalog pause, resume and soft-delete — implemented on 2026-10-29

This bounded slice follows saved account/inbox checkpoint `fb562af` on `integration/team-baseline`. Its local catalog-lifecycle checkpoint is dated 2026-10-30; no push, merge or deployment occurred. Backend production source, schema, migrations, dependencies and lockfiles are unchanged. One isolated notification e2e fixture was corrected after the full regression run exposed a parallel-suite broadcast race; production notification behavior and assertions are unchanged. Earlier lifecycle exclusions below describe their historical slices and are superseded here.

### Connected scope

- Existing Admin-only company detail/edit routes show Pause for approved, Resume for paused, and Remove from catalog for draft/changes/rejected only. Confirmations identify the saved code/name/status and describe the consequences in EN/VI. Unsaved local edits block availability actions until saved or discarded; pending records remain locked. No new route, broad legacy workspace or third role is mounted.
- Bodyless `POST /v1/company/listings/:id/pause` hides public browsing. Bodyless resume restores approved saved content without publication completeness validation or clearing submission/decision metadata; it is deliberately distinct from Publish. Neither action cancels/refunds orders or payments. Returned canonical code/company/status are validated before authoritative detail refetch and further actions.
- Bodyless `DELETE /v1/company/listings/:id` requires exact own two-key `{id,deleted:true}` acknowledgement. It soft-deletes only eligible records, retaining row/draft/media/history; there is no restore or file deletion. Pending/approved/paused remain forbidden. No withdrawal/takedown/removal chain is automated. Confirmed removal replaces the route with the shared catalog. If asynchronous history restoration refuses that replacement, permanent confirmed-removed state hides the editor and all writes, with a catalog link; an edit route without a saved record never becomes a create form.
- New lifecycle writes disable automatic 401 and uncertain network replay. A synchronous adapter lock covers these three actions through response decoding/validation; the page lock serializes all its actions. Failures hide old detail and require successful Refresh. A 404 after an uncertain DELETE is not deletion acknowledgement. Abort/read-sequence and session-generation guards reject stale display, including a fresh same-account login. Navigation/reload is guarded during current-session writes; logout/session changes bypass dirty guards.
- The retained backend reads/checks status then updates by ID, without atomic version/status comparison or row lock. Concurrent Admin lifecycle/moderation writes can race; frontend locks/refetch do not solve that. Password/avatar/deactivation, favorites, farming/compliance and sponsorship remain separate. Chat remains dropped.

### Verification and acceptance limits

- Frontend: **645 tests in nineteen files passed**, including **33 added catalog eligibility/transport/removed-editor regressions**. The two catalog files contain 72 tests. TypeScript and production build passed (87 modules), dependency audit reported zero vulnerabilities. A focused review identified a refused post-delete redirect that could expose a create form; permanent removed state and new-route-only missing-record editing fixed it, and focused re-review returned no findings. No component interaction suite was added.
- Backend: **423 isolated e2e tests in eleven suites and 27 unit tests passed**, TypeScript/build passed and lint reported zero warnings/errors. Initial full regression setup failed while Docker/PostgreSQL was stopped; the retained volume and unchanged API/frontend were started without reset/reseed. The healthy rerun then exposed one read-all repeat assertion receiving a legitimate parallel-suite Admin status notification. Only test Admin promotion now atomically disables generated status notifications; exact read-all/idempotence/controlled-arrival assertions and fan-out unit coverage remain unchanged. Final full regression passed. Known `pg` concurrent-query deprecation remains.
- Separate localhost API verification passed **88 assertions across 30 successful-run HTTP requests**: **11 successful mutations**, including login/logout and fixture setup, 17 reads, one health GET and one image HEAD. Including the earlier halted attempt and two standalone health preflights, the verifier completed 34 requests. It verified bodyless pause/resume, expected status/history, public detail/search visibility, and resume without completeness revalidation or metadata/media loss. A temporarily empty fixture description was restored before final pause. DELETE returned the exact two-key acknowledgement; company/public detail returned 404, both lists omitted the record, and its row/draft/history remained retained. No uncertain mutation response or automatic replay occurred.
- Browser acceptance in this slice is limited to guest Home, the real login page, and the guest company-catalog gate. Admin lifecycle confirmations/actions, dirty navigation, the refused post-delete redirect, failure/Refresh, EN/VI lifecycle interactions, mobile layout and screenshot visual acceptance were not browser-exercised. Automated/helper/API checks and focused review are not complete component or browser acceptance.

### Fixture disposition and verification limits

Exactly two fresh uniquely labelled LOCAL TEST ONLY listings were created through supported HTTP: `FM-48385` is soft-deleted draft with its draft/empty media/history retained; `FM-48386` is complete and paused, with one reference to an inspected existing registered public image. No upload, original account/profile/read-state/catalog mutation, new commerce, direct development database write, reset/reseed, file deletion or migration replacement occurred.

Aggregate read-only verification across both attempts preserves all **784 original rows across 35 tables**, with zero removals. **783 complete-row fingerprints are unchanged**; the sole original change is the existing listing Sequence advancing exactly **+2** for the two supported creates. Additions are exactly two Listings, two ListingDrafts, one ListingImage reference, nine ListingHistory rows, nine Activities and two verifier Sessions. All prior profile/inbox fixtures are part of this preserved baseline. A fresh final 35-table READ ONLY verification made zero HTTP requests and confirmed zero further changes, additions or removals since the final-logout snapshot.

Final verifier session `cmvtt46o40001acj50jb34g77` logged out with 204 and was verified revoked; its private token file was removed. An earlier media-selection preflight stopped before creating any listing, but its issued session `cmvtszvdb0000acj5k2ag204r` remains retained with logout unconfirmed because the cookie was cleared. No broad Admin revocation, password change or direct database repair was attempted. That first inspection also missed a local-fixture credential literal during tool-output redaction; no secret is repeated in these documents or the ledger, and exposed group-chat credentials were not used. This is an explicit verification-handling limit, not a claim of a clean credential/sign-out handoff.

External evidence is retained outside the repository: `C:/Users/mythic/AppData/Local/Temp/fishfarm-lifecycle-local-20261029171805542-c5a4d1d6.json` and `C:/Users/mythic/AppData/Local/Temp/fishfarm-lifecycle-local-verifier-20261029.mjs`. Do not blindly rerun the mutation verifier; the two fixtures already exist and its earlier session cannot be repaired by logging in again.

### Browser acceptance attempt and checkpoint — 2026-10-30

The complete pre-checkpoint regression reran successfully: 645 frontend tests, 423 isolated backend e2e tests, 27 backend unit tests, both typechecks/builds, lint with zero warnings/errors, frontend audit with zero vulnerabilities, and `git diff --check`.

The strict GUI/visual acceptance attempt was **blocked**, not passed or failed as an application test. Current controlled/user tab discovery found no existing page, so one guest tab was opened normally at `http://localhost:5173`. The runtime captured a PNG, but both emitted image input and reading that PNG reported that the selected model does not support image input. Without visually inspected evidence, no screenshot-backed test point is accepted. Testing stopped at that prerequisite without an alternative click, state injection, login, credential read, fixture creation, lifecycle mutation or service restart. Existing fixture/session disposition above is unchanged by this browser attempt; no new database fingerprint verification was performed in that attempt. Admin lifecycle confirmations/actions, dirty-edit protection, post-delete navigation, failure/Refresh, Vietnamese interaction and mobile visual layout therefore remain unverified in the GUI. Do not switch models/providers without user choice or relabel captured-but-unviewed screenshots as visual acceptance.

The captured-but-unviewed evidence is retained at `gui-test-screenshots/acceptance-t0-guest-visual-blocked.png`, outside the code checkpoint. Last successful navigation was localhost guest Home in English; exact final tab URL/title/ID were not collected because final discovery was interrupted. No console-log capability was advertised, so no browser console logs were collected.

## Own profile and notification preferences — implemented on 2026-10-28

This bounded slice follows `f2d1b37` on `integration/team-baseline`. It, the personal inbox and chat-scope documentation are saved in `fb562af`; nothing was pushed, merged or deployed. Schema, migrations, dependencies and lockfiles are unchanged. Historical profile/preferences exclusions below describe their earlier slices and are superseded by this section.

### Connected scope

- Standalone `pages/account/AccountDetails.tsx` and scoped CSS mount exact `#account/profile` and `#account/settings` for both active roles, with guest login-return, a Profile header link and account-area navigation. Legacy Account/Profile/Settings/History, Portal and demo providers remain unmounted.
- Separate authenticated `GET/PATCH /v1/me` and `GET/PATCH /v1/me/prefs` target only the current ID. Profile accepts optional raw strings: nonblank name 1–80, phone max 32 and location max 120. Frontend trims submissions; empty optional strings clear fields. Null, nonstrings and extra fields reject rather than being implicitly converted. Email, role, status and joined/verification timestamps are read-only; profile location is not a delivery address.
- Preferences require actual booleans for status/system/reminders, preserving false and normalizing missing stored choices to true. Backend User-row locking serializes partial read/merge/write and preserves independent concurrent keys. Same-key writes remain last-writer-wins. UI explicitly saves all three switches, so a later tab's complete save can overwrite them; no version-conflict check exists. Switches affect future matching categories, not existing inbox history/read state or success/error/approval messages.
- Exact input/public projections, immutable identity, calendar-valid UTC timestamps and submitted acknowledgements are validated. Synchronous cross-action locks, aborted/sequence-bound reads, dirty navigation/reload guards and session-generation checks prevent stale display. Accepted saves hide details and authoritatively refetch before editing/publication; failed or uncertain writes require successful Refresh. No automatic 401/network mutation replay. Verified display publication updates the header without replacing the token/generation or reviving a signed-out session; a fresh same-account login remounts the account screen.
- Password change/comparison, avatars, self-deactivation and general personal activity remain excluded. Existing Auth password reset and own order history remain separate working screens.

### Verification and acceptance limits

- Frontend: **612 tests in nineteen files passed**, including **180 new account helper/transport tests and six session-publication regressions**. TypeScript and production build passed (87 modules); audit reported zero vulnerabilities. A focused review caught a strict identity-input mismatch before acceptance; the page now passes only ID/role to the adapter while retaining generation for guards. Final full checks ran after that correction; focused re-review found no remaining actionable issue. No component interaction suite was added.
- Backend: **423 isolated e2e tests in eleven suites and 27 unit tests passed**, including **157 new profile/preferences cases**. TypeScript, lint (zero warnings/errors) and build passed. Coverage includes both roles, ownership/public projection, raw types/null/blank/length bounds, clearing/defaults/partial preservation, session validity and barrier-controlled independent-key concurrency. Known `pg` concurrent-query deprecation remains. E2E uses isolated `fishfarm_test`, not development data.
- Browser: a fresh User registered from the guest profile gate and reached the real profile. Blank-name validation blocked locally without header mutation. A padded name saved trimmed; optional phone/location cleared, authoritative readback disabled unchanged saves and updated the header. Reload restored the refresh-cookie session and saved profile. Settings saved status true/system false/reminders true, and reload preserved them. An unsaved system-true edit was discarded locally back to the saved false value without a write. EN/VI profile/settings labels, UTC identity and immediate translation of the save notice were checked. Both account screens had document width 375 at 390 × 844; desktop profile width was 1265 at 1280 × 720. English/desktop were restored and sign-out reached settled guest Home with the original four available listing IDs.
- Separate localhost API verification: **760 assertions passed across 176 `/v1` requests**, with zero unknown outcomes or automatic retries. **31 invalid profile PATCHes and 24 invalid preferences PATCHes** returned 400 and unchanged follow-up reads. Full/partial saves, actual false, optional clearing, exact public projection and two refresh-identity persistence checks passed. All three captured API refresh-cookie generations logged out. An initial `/v1/health` preparation 404 was resolved using canonical `/health` before baseline capture or writes; no restart/config change was made.
- Limits: normal pointer actions timed out repeatedly; snapshot-grounded unique visible enabled controls invoked actual UI handlers after ineffective-action readback. No full pointer/keyboard-only or screenshot visual-layout acceptance is claimed. Admin account screens, dirty navigation/Back/Forward/reload confirmations, failure/uncertainty with Refresh, cross-tab saves and notification generation after preference changes were not separately browser-exercised. Automated/helper/API coverage is not full component acceptance.

### Fixture disposition

Final combined verification passed **56 assertions with zero failures**, using 48 SELECTs in one READ ONLY transaction and zero HTTP requests. All **776 original rows across 35 tables** retain exact IDs and complete-row fingerprints, including all prior notification fixtures. Exactly eight additions are retained: two fresh uniquely labelled LOCAL TEST ONLY Users, two welcome Notifications, two sole Sessions and two expected registration Activities; every other table has zero additions. Both sole Sessions are revoked. GUI welcome remains unread with its complete fingerprint unchanged; its registration Activity is unchanged. GUI profile/prefs match the accepted values above; the API fixture retains cleared optional fields and all three prefs false. No original account/read-state mutation, direct development database write, new commerce/upload, reset/reseed, deletion or exposed group-chat credentials were used. External verifier, ledger and separate credentials remain outside the repository.

## Personal notification inbox — implemented on 2026-10-28

This bounded slice follows saved checkpoint `f2d1b37` on `integration/team-baseline` and is saved in `fb562af` with profile/preferences and chat-scope documentation. Nothing was pushed, merged or deployed. Schema, migrations, dependencies, lockfiles, existing notification generation and preferences are unchanged.

### Connected scope

- Standalone `pages/account/NotificationInbox.tsx` and scoped CSS mount exact `#account/notifications` for both active User and Admin accounts, with guest login-return and a plain signed-in header link. Legacy Account/Portal/demo providers remain unmounted; no global bell, unread badge, cache or polling was introduced.
- `GET /v1/me/notifications` returns exact `{items,total,unreadTotal,page,limit}` with server read/type filters, strict page/limit bounds and newest-first/ID tie ordering. Filtered total and owner-wide unread total are distinct. Page and both counts share a RepeatableRead snapshot. Recipient ID is the sole ownership predicate; foreign, legacy role-only and unassigned rows are excluded. Full history has no 200-row cap.
- `PATCH /v1/notifications/{encodedId}` accepts only exact raw `{read:true}` and returns the minimal projection. Repeat/concurrent reads preserve the first timestamp; foreign/missing/role-only IDs share `404 notification.notFound`. Bodyless `POST /v1/notifications/read-all` also accepts parsed `{}` but rejects other bodies, including nonempty unparsed plain-text/octet-stream requests. One UPDATE marks all owner unread history across filters/pages, preserves earlier timestamps and returns `{updated,readAt}`; later arrivals may remain unread.
- Helpers/transport validate exact projections, calendar-valid UTC timestamps, paging/filter consistency and acknowledgements. Nullable arbitrary JSON is preserved, with iterative validation/equality/snapshot handling for deeply nested data and safe own-property copying. EN/VI templates render escaped text; unsuitable/unknown keys retain key/JSON fallback. Only mounted, role-appropriate canonical destinations are clickable. Opening a destination and marking read are separate actions.
- Server page sizes are 10/25/50/100. Full-inbox confirmation names the current account and scope. Synchronous duplicate/cross-action locks and identity-bound aborted reads prevent stale private display. Accepted writes hide old results and authoritatively refetch; failed/uncertain writes require successful Refresh. No automatic 401/network mutation replay, deletion, mark-unread or generation/preferences changes.

### Verification and acceptance limits

- Frontend: **426 tests in seventeen files passed**, including **274 new notification helper/transport tests**; TypeScript/build passed, dependency audit reported zero vulnerabilities. No component interaction suite was added. Deep valid JSON initially exposed native clone stack overflow; iterative snapshots fixed it and the final full suite passed.
- Backend: **27 unit and 266 isolated e2e tests passed**, including **104 notification cases**; TypeScript/build passed and lint reported zero warnings/errors. Coverage includes 237-row history, independent User/Admin ownership, all filters, arbitrary JSON, strict raw bodies/query bounds, concurrency/idempotence, consistent page/count snapshots and post-UPDATE arrivals. Four ignored-MIME regressions exposed a route validation gap; route-local framing validation and preservation of accepted `{}` fixed it. Final full verification passed. Known `pg` concurrent-query deprecation remains.
- Browser: both fresh Users logged in from the guest inbox deep link and saw only their own welcome. Opening Marketplace left the first welcome unread; single-read authoritatively returned unread zero/read timestamp, disabled repeat action and persisted across reload. Unread filtering with ten-row page size returned a truthful empty result. The second account's Error filter returned zero matching rows while owner-wide unread remained one. Keep-unchanged dismissed full-inbox confirmation and Refresh confirmed unchanged unread one; explicit confirmation then updated one notification despite zero filtered rows. Read-all persisted across reload.
- Browser: EN/VI welcome/body/category/read labels and UTC timestamps were verified. The read-all success notice translated immediately on language change. Document width was 375 at a 390 × 844 viewport and 1265 at 1280 × 720; English/desktop were restored. Both browser accounts were signed out; the final guest Home retained the original four available listings.
- Separate localhost verification: the successful API continuation recorded **175 requests and 736/736 assertions**; a separate MIME regression recorded **6 requests and 124/124 assertions**. Final database-only verification passed **97/97 assertions**, with zero HTTP requests. The retained overall API ledger includes 191 requests and 1034/1036 assertions: two earlier timezone-normalization helper failures were corrected without replaying successful registrations. A separate zero-request preflight archive preserves a corrected Docker-address assumption. No unknown outcomes, automatic request retries or direct development database writes occurred.
- Limits: normal pointer clicks and a keyboard activation were unreliable, so snapshot-grounded unique visible enabled controls invoked actual UI handlers only after ineffective-action readback. No complete pointer/keyboard-only acceptance is claimed. Each fresh inbox contained one welcome, so populated multi-page GUI navigation and arbitrary-JSON/unsafe-link rendering were not exercised; isolated/helper tests are not component acceptance. Admin inbox ownership/read behavior was API/e2e-verified, not browser-accepted. Failure/uncertainty with Refresh and concurrent arrivals remain automated coverage, not full GUI journeys. Mobile screenshot capture failed at surface preparation; a later desktop screenshot was captured but this model could not inspect image input. No screenshot visual-layout acceptance is claimed.

### Fixture disposition

Only three fresh uniquely labelled `LOCAL TEST ONLY` User accounts were registered; each welcome was read through its assigned API/UI path and retained. Browser-single welcome `cmvs1di7k00023sj5qneqldgv` records `2026-10-28T11:53:07.589Z`; browser-all `cmvs1di9i00063sj5q2ss0yek` records `2026-10-28T12:00:45.742Z`. Final read-only verification proves each changed only `readAt`, with every other field unchanged, and preserves the API welcome's first timestamp. All ten verifier-issued sessions were logged out; browser sign-outs were separately verified.

All **755 original rows across 35 tables** retain exact ID/full-row fingerprints, including the original 11 Users, 255 notifications, 18 listings, 18 drafts, 15 images, 54 listing-history rows, 13 orders/items, 15 payments, two uploads and 251 activity rows. The original Admin inbox had 17 recipient-owned rows and excluded 30 foreign/role-only rows; its recipient/role notification fingerprints remain untouched. PostgreSQL verification used read-only pool/transactions against configured `localhost:5432/fishfarm`, with client TCP peer `::1`. No original read-state mutation, reset/reseed, deletion, new commerce/upload, migration replacement or exposed group-chat credentials were used. External verifier/ledgers/credentials are outside the repository; credentials are not recorded here.

Profile/preferences/favorites, farming/compliance UI, reviews/analytics, sponsorship transactions/settlement, moderation concurrency and production upload hardening remain separate; deployment stays deferred.

## Admin account directory and User status — implemented on 2026-10-28

This bounded slice follows catalog checkpoint `3c333f1` on `integration/team-baseline`. It and the preceding review/activity slice are saved as `f2d1b37`; nothing was pushed, merged or deployed. Backend user endpoints and session issuance changed, but schema, migrations, dependencies and lockfiles did not. Backend-unchanged statements in earlier sections describe those earlier slices only.

### Connected scope

- Standalone Admin-only `#admin/users` mounts `pages/company/AdminUsers.tsx`, scoped CSS and dedicated helpers/transport. Header, guest login-return and activity link allowlists recognize the route. Broad legacy Admin/Portal/demo workspaces remain unmounted.
- `GET /v1/admin/users` reuses `user.view` with server name/email search (trimmed, max 100), role/status filters, bounded page/limit and authoritative totals. A repeatable-read page/count snapshot returns only immutable ID, email, name, actual User/Admin role, active/suspended status and joined timestamp, newest first then ID. Stored names remain escaped display text, without stricter frontend-only registration rules that could reject a whole directory page.
- `PATCH /v1/admin/users/{encodedEmail}/status` reuses `user.manage` and accepts exactly `{status,expectedStatus}`. A target row lock rejects stale/same-state transitions with `409 user.statusConflict`. All Admin targets, including self, are visible but protected from either action (`409 user.protectedAccount`). This is a conservative User-management boundary, not approval or implementation of the complete staff suspension/recovery/provisioning policy.
- Suspension updates User status, revokes every target session and records activity atomically. Reactivation permits fresh login without restoring old access/refresh tokens. Session issuance uses the same account lock and rereads current status/password so a stale login cannot issue a live session after suspension. Existing orders, payments, carts, evidence and profile/history remain intact.
- UI actions confirm the exact email and expected transition, guard duplicates and validate server identity/status acknowledgements. Accepted writes hide old rows and refetch. Failed/uncertain writes require successful Refresh before another action; status writes never replay automatically, including on 401. Private reads are aborted/session-bound. Suspended-account errors or invalid refresh invalidate the current session and late private results, while ordinary permission errors and older-session failures cannot clear a newer login.
- No deletion, timed block, reason collection, role editing or Admin bootstrap was added. Idle tabs discover revocation on the next protected request; already authorized in-flight work is not undone. `expectedStatus` is not a version token and cannot detect an intervening cycle ending in the same state.

### Verification and acceptance limits

- Frontend: **152 tests in fifteen files passed**, including 22 added helper/transport/session regressions; TypeScript/build passed and audit reported zero vulnerabilities. The final run includes search/page bounds and permitted stored-name regression fixes. No component interaction suite was added.
- Backend: **27 unit and 162 isolated e2e tests passed**, TypeScript/build passed and lint reported zero warnings/errors. The new 91-case users suite covers exact permissions/projection/validation, protected active/suspended Admins, concurrent duplicate transitions, transactional audit/session behavior, stale-login race and nonempty customer-data preservation. Known `pg` concurrent-query deprecation remains.
- Browser: actual guest users deep-link login returned to the directory. Search uniquely identified fresh User `cmvrzc1ak000aekj5e7b24q5w`; explicit suspend/reactivate confirmations and authoritative refetch completed the Active/Suspended/Active cycle. Both roles and protected Admin rows were visible. Ten-row server paging returned ten then one row while preserving total 11; applying Admin filtering reset page 1 and returned four protected rows with no status controls. Vietnamese text and mobile width were checked (375 pixels at 390 × 844); desktop width was 1265 at 1280 × 720. English/desktop were restored and Admin sign-out reached settled guest Home with the original four available fish.
- Separate localhost API verification: **30 HTTP requests and 11 assertion-group executions** across the corrected setup/final pass, excluding browser requests and an earlier incomplete verifier attempt. Verified guest/User denial, strict bodies, missing/protected accounts, stale duplicate conflict, role/status/search/paging, both old sessions revoked before and after reactivation, suspended login denial, fresh login success, exact audit and original row fingerprints. PostgreSQL verification was read-only; mutations used actual HTTP.
- Limits: normal pointer clicks and some keyboard/fill actions were unreliable; snapshot-grounded observed controls invoked actual UI handlers/requests only after readback. No full pointer/keyboard-only or screenshot visual-layout acceptance is claimed. Keep-unchanged, failed/uncertain action with Refresh, active User tab discovering suspension, User route denial, status-filter UI interaction, activity-to-users link and unusual-name rendering remain unexercised GUI journeys. Their automated/API coverage is not component acceptance. An existing success notice retained its original English wording after a language switch; fresh Vietnamese labels/timestamps were verified.

### Fixture disposition

Only two uniquely labelled fresh local test Users were created; only those targets were status-mutated. The first (`cmvrz9zn20001ekj5gasgckh5`) completed its API cycle but the verifier stopped on parsing bodyless logout; it remains active and retained, with no blind mutation replay or cleanup deletion. The corrected fixture (`cmvrzc1ak000aekj5e7b24q5w`) is active with exactly four successful status audit entries (API suspend/reactivate, then UI suspend/reactivate), all attributed to Local Fulfilment Admin A with `#admin/users`, and no unrevoked target sessions. No broad Admin-session cleanup was performed.

All ten User rows in the corrected-pass baseline, including the first fixture, are unchanged; the final count is eleven. Original 18 listings, 18 drafts, 15 images, 54 listing-history rows, 13 orders, 13 order items, 15 payments and two uploads retain exact fingerprints. No new listing/order/payment/upload, reset/reseed, direct database write, migration replacement or deletion occurred. Exposed group-chat credentials were not used. Profile/preferences, notifications, farming/compliance, analytics, sponsorship transactions/settlement and Admin lifecycle policy remain separate; deployment stays deferred.

## Optional listing review and recorded activity — implemented on 2026-10-28

This slice follows saved catalog checkpoint `3c333f1` on `integration/team-baseline` and is saved together with User management as `f2d1b37`. Nothing was pushed, merged or deployed. Backend source/schema/migrations/tests and dependencies are unchanged. Earlier sections remain historical slice records.

### Connected scope

- Standalone `pages/company/ListingReview.tsx`, `AdminActivity.tsx` and scoped CSS mount Admin-only `#admin/queue`, `#admin/review/:id` and `#admin/activity`. Active auth preserves allowlisted destinations; malformed encodings fail safely and database aliases canonicalize. Broad legacy Admin/demo workspaces remain unmounted.
- Shared company catalog now offers bodyless submit/withdraw for complete saved records. Submission locks editing, clears current decision and immediately hides approved content; paused cannot submit. Pending withdrawal returns to hidden draft and clears submission time. Direct publication remains available/default; Admins may review their own or other Admins' submissions.
- Dedicated `listingReviewApi.ts` validates canonical queue filters, complete unique five-check detail projections, nullable decisions and exact returned decision acknowledgements. Feedback bodies whitelist trimmed reason (1–120), feedback (10–2000) and integer step 1–6. Takedown accepts trimmed reason 10–2000 and validates the returned policy rejection. All writes use explicit existing endpoints, confirmation, duplicate locks and no uncertain transport replay.
- Queue server tabs are pending, approved excluding paused, and combined changes/rejected. Search and ten-row paging are local to the returned array. Detail renders all six saved field groups/media, backend hints, nullable current decision and recorded history, with integer VND/UTC. Hints omit submission rules such as age/size/shipping and are not certification or full completeness guarantees. Approval publishes; takedown hides without cancelling/refunding orders. Submit emits preference-controlled Admin notifications; decisions record history/activity without an invented notification promise. Inbox UI remains absent.
- Private review reads are aborted/session-bound; dirty text guards navigation/reload and confirmed Refresh discards it. Accepted decisions hide old detail and refetch because mutation responses lack checks. Failures disable decisions until successful reconciliation. Retained backend moderation is not atomic: concurrent decisions can both commit, last update wins and history/activity can contain both. Frontend locks/Refresh do not fix this; backend concurrency hardening is separate scope.
- Activity is an independent real newest-first array with integer 100/200/300 windows. Local search/ten-row paging and counts are explicitly window-scoped, not analytics or complete audit history. Recorded roles/actions are unchanged; System is only server-recorded. Only known active Admin links are clickable; external/unknown/User-only/unintegrated links remain recorded text. Fictional Overview totals and editable roles remain unmounted.

### Verification and acceptance limits

- Frontend: **130 tests in thirteen files passed**, TypeScript/build passed, audit zero vulnerabilities. Added 27 regressions for review helpers/transport/activity, company submit/withdraw and nullable decisions. No component interaction suite was added.
- Backend: **23 unit and 71 isolated e2e tests**, TypeScript/build/lint passed again, with no changed behavior/assertions. Known `pg` concurrent-query deprecation remains.
- Browser: fresh `FM-48383` showed six field groups/hints and shared creator attribution. Empty reason blocked; whitespace was trimmed into exact feedback/step 2 confirmation. Request changes persisted in review/company readback, resubmission locked editing, withdrawal returned draft, submission and approval succeeded, then takedown recorded the exact policy rejection with no order/refund promise. Accepted decisions read authoritative detail/checks before re-enabling.
- Browser: pending/live/combined sent-back server filters and local empty/matching search passed. Activity showed actual events, ten-row Next paging, empty/matching search, 100 and 300 windows (243 returned at the latter) and a real review deep link. Vietnamese text and mobile document width were checked for review/activity: 375 pixels at 390 × 844; activity desktop width 1265 at 1280 × 720. Desktop English restored and Admin sign-out confirmed settled guest Home.
- Separate localhost API verification: **96 HTTP requests**, browser requests excluded; 42 successful assertion-group executions across 33 unique labels. Verified full optional lifecycle including reject, shared/self-review, anonymous/User denial, pending edit/delete lock, canonical queue/check/activity projections and exact history/activity decisions. Confirmed UI fixture public 200 when approved and 404 after takedown, with read-only fingerprints preserving original data.
- Limits: normal pointer clicks timed out repeatedly; snapshot-grounded controls invoked actual UI handlers/requests. No full pointer/keyboard-only or screenshot visual acceptance is claimed. Direct reject, approved resubmission hiding, guest login-return/User denial, uncertain decision/Refresh, dirty decision navigation, alias canonicalization, 200-window selection and unsafe-link rendering remain unexercised GUI journeys; helper/transport/API tests are not component acceptance. Queue pagination lacked enough matching rows. Final catalog UTC decision/history formatting passed automated checks but was not separately browser-rerun. Backend concurrent decisions remain unfixed.

### Fixture disposition

Only fresh labelled local test listings were mutated. `FM-48382` remains untouched draft; `FM-48383` is rejected after UI takedown, retaining eight exact history/activity entries; `FM-48384` retains its independent rejected API lifecycle. All three anonymous public details return 404 and have zero dependencies. Draft/media/history/accounts are retained; no cleanup deletion was needed. Original row fingerprints across nine protected tables, all 13 orders, 13 order items, 15 payments and two uploads are unchanged. Available public IDs are again exactly `FM-18420`, `FM-18877`, `FM-19544`, `FM-20761`; `available=false` also retains sold-out `FM-19102`. No reset/reseed, direct database write, new upload or migration replacement occurred. Exposed group-chat credentials were not used.

Optional review/activity are connected with these limits. Account/farming, notification inbox, analytics, sponsorship transactions/settlement and full marketplace acceptance remain separate; deployment stays deferred.

## Company catalog slice — implemented on 2026-10-28

This catalog slice is saved as `3c333f1` on `integration/team-baseline`, following dispute checkpoint `90c00a0`. Nothing was pushed, merged or deployed. Backend source, schema, migration history and tests are unchanged. Earlier sections are historical slice records.

### Connected scope

- Active standalone `pages/company/CompanyCatalog.tsx` and scoped CSS mount shared Admin list/create/edit/detail routes: `#company/listings`, `#company/add`, `#company/edit/:id`, `#company/listing/:id`. Legacy Seller/Portal/demo stores remain unmounted. Backend database-ID aliases canonicalize to returned listing codes for future writes; malformed encoded routes reject safely.
- `companyListings.ts` maps six-step form strings to whitelisted DTO fields, nullable fish fields, integer VND/quantity, ISO UTC preorder dates and `{url,isMain,position}` media. PATCH sends changed fields only; changed media replaces the entire array. Save and direct publication are separate confirmed requests. Approved saves immediately update public content; pending editing is locked. Preorder deposit/date are required even for partial saves. No sample data, third Seller role, mandatory review or prototype `publish` flags were enabled.
- `companyListingsApi.ts` validates management projections, requested list statuses and returned submitted fields/media before acknowledging success. Public upload confirmation requires the exact listing purpose, nonprivate URL and matching MIME/size. HTTP(S) schemes match the backend case-insensitively. Shared transport retains identity-bound refresh and no uncertain transport replay.
- Local search and ten-row pagination operate over the full server-filtered array. Preview is editorial, not a fabricated buyer page. Unsaved hash navigation is guarded before the rendered route changes, including header links/history; alias/server-confirmed create route replacement avoids another create history entry. Logout/session changes bypass the dirty guard. Full reload uses beforeunload protection.
- Public `listing_image` uploads are immediately visible, even before publication. Removing a reference does not delete a file. There is no upload recovery/cleanup, catalog-create idempotency key, version or concurrency lock. Changed-field writes reduce but do not eliminate concurrent Admin overwrites. Unknown creates block repeat submission only within the mounted screen, not durably across leaving/reload. Inspect the shared catalog before another create. Optional review/activity, pause/resume/delete UI and sponsorship remain separate.

### Verification and acceptance limits

- Frontend: **103 tests in eleven files passed**, TypeScript/build passed and audit reported zero vulnerabilities. This includes 17 catalog helper/route, 18 catalog transport and six hash-navigation tests. No component interaction suite was added.
- Backend: **23 unit and 71 isolated e2e tests**, TypeScript/build/lint passed again. Known `pg` concurrent-query deprecation remains. No backend assertions or behavior were weakened.
- Browser: `FM-48379` name-only partial create returned its edit route; all six field groups completed with a confirmed public image URL, save remained draft, publication became live, public detail showed saved content, and a confirmed live breed edit persisted. Pending server filtering and local search empty state passed. Vietnamese controls and mobile width were checked; correcting expanded Admin header wrapping reduced document width to 375 pixels at a 390 × 844 viewport. Desktop width remained 1280 pixels at a 1280 × 720 viewport.
- Browser: cancelled dirty header navigation preserved the editor and unsaved value. Later Back/dialog automation stalled; Back/Forward acceptance and final sign-out are not verified. Malformed encoding/alias and guard rules are covered by automated tests, not claimed complete browser journeys. The final server-confirmed create route replacement passed automated checks but was not rerun through the browser. Normal clicks were unreliable; observed-control fallbacks invoked actual UI handlers. File selection is unsupported, and a captured desktop screenshot could not be visually assessed by this model. No mouse-only or visual-layout acceptance is claimed.
- Separate local API pass: 48 requests passed for partial create, shared access and saving by Admin B, actual public upload/complete save/direct publish/live update, User denial (403), incomplete publication (400) and pending PATCH rejection (409). The valid 76-byte PNG was anonymously retrieved byte-for-byte. Final UI fixture readback/cleanup added 12 requests and verified its exact saved content/media/history.
- Unexercised GUI acceptance: multi-image order/cover/removal, preorder input interaction, uncertain create/reload recovery, failure/Refresh, alias/login-return and User denial. Automated rules/transport/backend coverage is not a substitute. Reviews and full marketplace acceptance remain outstanding; deployment is deferred.

### Fixture disposition

Fresh local test identities were reused; exposed credentials were not used. Exact targets were inspected before supported API cleanup. `FM-48379` (UI) and `FM-48380` (API live edit) are paused; `FM-48381` (pending-lock test) was withdrawn then soft-deleted. All three public details return 404. Images, drafts, audit history and accounts are retained; no files were deleted. The UI fixture records Created draft, Updated draft, Published, Edited live listing and Paused. All 13 existing orders and original listing/upload fingerprints are unchanged. The original available public IDs are again exactly `FM-18420`, `FM-18877`, `FM-19544`, `FM-20761` (`available=false` also retains sold-out `FM-19102`). No reset/reseed or migration replacement occurred.

## Disputes and private evidence slice — implemented on 2026-10-28

The dispute slice is saved as `90c00a0` on `integration/team-baseline`; nothing was pushed. The retained backend source, schema, migrations and tests are unchanged. Earlier slice sections below remain historical records; their uncommitted statements were superseded by the saved checkpoints.

### Connected scope

- Added active `pages/marketplace/Disputes.tsx`, typed dispute/upload projections, dedicated `services/disputesApi.ts`, canonical eligibility/route/label/evidence helpers in `services/disputes.ts`, and their tests. Updated `App.tsx`, `Auth.tsx`, `SiteHeader.tsx` and order links. Legacy `pages/buyer/Dispute.tsx`, BuyerContext, Cloudinary/public-URL submissions and broad mock Admin workspace remain unmounted.
- User-only `#marketplace/disputes`, `#marketplace/disputes/:id` and `#marketplace/orders/ORD-…/dispute` read actual owner data. The creation screen joins owner history by public order code, including terminal cases, rather than inventing an order dispute flag. An order permits only one dispute for its lifetime. Shipped orders allow only `not_received`; delivered/completed allow all five canonical reasons; description is trimmed and 15–2000 characters.
- Admin-only `#admin/disputes` and `#admin/disputes/:id` operate the shared company queue with canonical status filtering. Explicit POST start-review/resolve/reject await the returned projection; finalization requires a trimmed explanation, may start directly from open, and cannot be changed. Backend notification/activity deep links use these dispute database IDs. No automatic refund/replacement/cancellation/completion, owner edits/withdrawal/appeal, fabricated review history or dispute deadline was added.
- Actions require confirmation and guard duplicate clicks. Failed, malformed or uncertain responses disable mutations until successful Refresh reads the actual record. No idempotency key or automatic transport replay is added. Shared authenticated transport now binds retries to the original user ID/role and rejects late results after session changes; a 401 refresh may retry once only for the same known identity. Dispute responses are runtime-validated for canonical structure and expected case/order/reason/state/decision; the page additionally checks buyer/order identity and attachment count before acknowledging success.
- Optional multipart `/uploads` uses `purpose=dispute_attachment`; creation sends at most three returned upload IDs. Upload confirmation requires a nonempty ID, private purpose and matching file type/size; duplicate confirmed IDs are rejected. JPEG/PNG/WebP/GIF/PDF and the default local 10 MiB limit are checked. Confirmed references are memory-only and lost on leaving/reload before submission. Unconfirmed uploads are not automatically retried and require acknowledgement before continuing without that file. There is no upload recovery/delete/orphan-cleanup endpoint.
- Protected content uses shared bearer/refresh/timeout handling and Blob download links, not public static URLs or inline file rendering. Object URLs are revoked on replacement/unmount. The retained backend trusts declared MIME, initially writes private uploads into the public upload directory before moving them (potential transient exposure), and does not verify linked disk existence on creation. Multer exception translation may give generic error codes; this was code-inspected, not runtime-tested. Permanent private static paths are blocked. Production upload hardening remains a separate scoped task.

### Verification and limits

- Frontend: **62 tests in eight files passed**, TypeScript/build passed, and audit reported zero vulnerabilities. This includes 20 dispute helper/transport tests and five new identity-retry/late-response tests in the shared API suite. Existing checkout/shipment retry tests now establish the same identity before testing exact payload preservation rather than mocking an anonymous refresh. No component-level interaction test suite was added.
- Backend: TypeScript/build/lint passed; all **23 unit and 71 isolated e2e tests** passed. The known `pg` concurrent-query deprecation warning remains. No backend behavior or assertions were weakened to fit the frontend.
- Browser: guest owner/Admin deep links returned after real login. Buyer creation checked blank-description blocking and explicit one-case confirmation. An open dispute blocked actual buyer receipt completion with the backend conflict, leaving the order delivered/paid. A second Admin reviewed then resolved the case, and directly rejected the evidence case from open. Final decisions persisted on reload and in owner history/detail. Resolution did not complete the order: a later explicit buyer receipt action was required and succeeded.
- Evidence: actual API setup uploaded a local 68-byte PNG and linked it by upload ID; owner/Admin protected content matched exact bytes. Setup verified private static 404, duplicate creation 409 and Admin denial on the owner route. Owner and Admin UI fetches produced temporary Blob download links. File-selection/upload GUI is unsupported by the browser host; actual save-to-disk download was not verified.
- Snapshot-grounded locator control fallbacks invoked real UI handlers/requests because normal clicks were unreliable. No complete mouse/keyboard-only or visual acceptance pass was claimed. Dispute failure/Refresh, Admin filter, foreign-owner UI denial and Vietnamese/mobile layout interactions remain unexercised; automated rule/transport/backend coverage is not a substitute for those journeys. The final response-validation fixes passed automated checks but were not rerun through the browser.
- During wrap-up the existing browser tab failed restoration; final discovery returned no controlled/user tabs. Its last verified state was the signed-in local User on `ORD-10127`; final sign-out/guest handoff was not verified. Node heap exhaustion, Windows process-allocation failures and login 500 were observed while health returned 200/database up. Database-only guarded cleanup succeeded. Later authenticated API verification passed terminal-case duplicate guards, exact owner/Admin evidence bytes, unauthenticated/role denials, private static 404 and canonical status filters. No blind restart was performed; the cause of the earlier browser/resource failures was not established.

### Fixture disposition

Fresh local fixture identities from the company slice were reused; exposed group-chat credentials were not used. Two order creations, initial fulfilment and the second evidence dispute used the actual API during setup; subsequent dispute review and buyer actions used the UI. Payments were simulated.

- `ORD-10127`: completed/paid, resolved `fish_unwell` dispute, no attachments, exactly one unchanged 1,000 ₫ full payment.
- `ORD-10128`: shipped/paid, rejected `not_received` dispute, retained private PNG attachment, exactly one unchanged 1,000 ₫ full payment.
- Final database assertions checked statuses, amounts, quantities, decisions, finalization and attachment counts. Stock remains two. Only the inspected `FM-LOCAL-DISPUTE-20261028` listing was soft-archived; its archive marker persisted and public detail returned 404. Orders, disputes, payments, evidence and accounts were retained.
- Saved `ORD-10121`/`ORD-10122` and previous `ORD-10123`–`ORD-10126` payment/stock/shipment results remained unchanged; the four earlier company fixture listings remain archived. No reset/reseed, hard deletion or migration replacement occurred.

Disputes/private evidence are now connected with these acceptance limits. Missing reviews, complete browser/visual acceptance and production private-upload hardening remain outstanding; deployment stays deferred.

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

### 4.13 Disputes and private evidence — Adapted / Admin UI connected

**Files:** active `pages/marketplace/Disputes.tsx`, `services/disputesApi.ts`, `services/disputes.ts`, shared `services/api.ts`; retained `backend/src/disputes/*`, `uploads/private-files.service.ts`. Legacy `pages/buyer/Dispute.tsx` and `context/BuyerContext.tsx` remain unmounted.

- **Local:** one dispute per order; eligible reasons/statuses; description and max-three attachment validation; owner-scoped history/detail; Admin review/finalization and authorized evidence routes.
- **Remote:** sends `attachments: [url]` to `/orders/:id/dispute` via Cloudinary. Our contract is `uploadIds` to `/me/orders/:id/dispute`.
- **Implemented:** dedicated owner creation/history/detail and shared Admin queue/review; canonical payloads, confirmations and reconciliation; identity-bound refresh retries and response validation; local multipart private upload references and protected Blob downloads, never public static links.
- **Verified/remaining:** actual owner/Admin decisions, private bytes/static denial and completion block/unblock passed with fixture preservation. Detailed automated/browser limits, upload hardening caveats and remaining interactions are recorded in the completed slice above.

### 4.14 Company catalog forms and media — Implemented; acceptance limits remain

**Active files:** `pages/company/CompanyCatalog.*`, `services/companyListings.ts`, `services/companyListingsApi.ts`, their tests, and `services/hashNavigation.*`. Legacy `pages/seller/*`, seller components/data and demo stores remain unmounted. The retained `backend/src/listings/*` contract is unchanged.

- **Implemented:** shared Admin list/create/edit/detail with six-step form mapping, bounded integer VND/quantity, nullable fish fields, preorder terms and URL-based media. DTO whitelisting strips prototype fields and image IDs; changed-field PATCH avoids replacing unchanged media. Partial draft saving and bodyless direct publication are separate confirmed actions. Approved edits immediately change public content; pending records are read-only.
- **Verified:** name-only draft, complete save, direct publication, public readback and live edit passed through the UI. Separate API checks verified shared access across Admins, public media bytes, incomplete publication and pending-write rejection. Catalog helper/transport and navigation regressions passed; failed or malformed writes are not acknowledged as saved or automatically replayed.
- **Limits:** media order/cover/removal, preorder form interaction and failure/Refresh still need GUI acceptance. Public uploads are not deleted when references are removed; uncertain creates have no durable idempotent recovery. Optional review/activity are connected in §4.15–4.16; pause/resume/soft-delete controls are connected in the subsequent lifecycle slice above. Full verification and browser limitations are recorded in the slice sections above.

### 4.15 Optional internal listing review — Implemented; acceptance limits remain

**Active files:** `pages/company/ListingReview.*`, `services/listingReview.ts`, `services/listingReviewApi.ts`, their tests and company submit/withdraw controls. Legacy `pages/admin/Queue.tsx`, `Review.*` and broad Admin workspace remain unmounted; retained listing controllers are unchanged.

- **Implemented:** optional shared queue/detail, pending/approved/combined changes tabs, six read-only groups, server hints/history/nullable decision and confirmed approve/reject/request-changes/takedown. Exact feedback bodies and acknowledgements are validated; successful decisions refetch detail/checks, failures require reconciliation. Submit/withdraw use company endpoints; direct publication still does not require review.
- **Verified:** UI request changes/resubmit/withdraw/submit/approve/takedown, feedback readback, filtering/search and activity links; full lifecycle/permissions/projections separately API-verified. Detailed results are above.
- **Limits:** hints are incomplete, self-review is allowed, decision notifications are not emitted and takedown does not cancel/refund orders. Concurrent backend decisions can both commit with last-write-wins; atomic moderation and outstanding GUI journeys remain separate.

### 4.16 Admin overview, activity and role information — Activity implemented; overview/roles deferred

**Active files:** `pages/company/AdminActivity.tsx`, `services/listingReviewApi.ts`, `services/listingReview.ts` and tests. Legacy `pages/admin/Overview.*`, `ActivityLog.tsx`, `Roles.tsx` and `data/adminData.ts` remain unmounted; retained activity controller is unchanged.

- **Implemented:** independent real activity loader, integer 100/200/300 windows, local ten-row paging/search, raw roles/actions and UTC timestamps. Counts describe returned windows rather than platform totals. Only active Admin destinations are clickable; other recorded links remain plain text.
- **Verified:** real review/company events, Next paging, empty/matching search, 100/300 windows, review deep link, Vietnamese/mobile width and final sign-out. Adapter/helper tests validate limits/projections/safe links; complete GUI limits are above.
- **Deferred:** complete audit pagination, Overview analytics and deliberately designed read-only role capabilities require separate work. No fictional totals or editable-role claims were restored.

### 4.17 Admin users, suspension and provisioning — Implemented bounded directory/status slice; provisioning deferred

**Active files:** `pages/company/AdminUsers.*`, `services/adminUsers*`, `backend/src/users/admin-users.*`, `users/dto/admin-users.dto.ts`, `auth/auth.service.ts`; legacy `pages/admin/Users.*` and demo helpers remain unmounted.

- **Implemented:** `GET /admin/users` requires `user.view`, searches/paginates on the server and returns only immutable ID, email, name, role, status and join time. Both roles appear; all Admin targets, including self, are protected from either status action. This is an explicit conservative slice boundary, not an imported legacy filter or complete Admin recovery policy.
- **Status contract:** `PATCH /admin/users/{encodedEmail}/status` requires `user.manage` and exact `{status,expectedStatus}`. Row-locked transitions reject mismatched/same-state confirmation with `409 user.statusConflict`. Suspension/status/activity/session revocation commit atomically. Login issuance locks/rereads the same account; reactivation never restores old sessions. Activity records only actor/action/email/time/link, not an invented reason or expiry.
- **Frontend:** standalone Admin-only `#admin/users`, guest-return/header/safe activity navigation, server search/status/role filters and paging, exact runtime projection/acknowledgement validation and confirmed actions. Private reads are aborted/session-bound; failed or uncertain mutations hide stale data and require Refresh. No optimistic state or uncertain replay. Suspended-account 403 and invalid refresh clear the current frontend session and invalidate pending private data; ordinary permission denial and late errors from an older identity do not clear a newer session.
- **Retained/deferred:** no deletion, timed client unlocking, role changes, Admin provisioning or automatic bootstrap. Suspension preserves orders, payments, carts, evidence and history and cannot undo already authorized in-flight requests. Idle tabs are not instantly notified; enforcement occurs on subsequent requests. Expected status is not a durable version and cannot detect a full intervening cycle returning to the same state. Full component/browser acceptance limits are recorded in the latest slice section.


### 4.18 Account profile and preferences — Implemented; password and history gaps remain

**Active files:** `pages/account/AccountDetails.*`, `services/account.*`, `services/accountApi.*`, `backend/src/users/*`. Legacy Account/Profile/Settings/History and demo account providers remain unmounted.

- **Connected:** exact `#account/profile` and `#account/settings` for both active roles; guest-return, header Profile and account-area links. Profile GET/PATCH and preferences GET/PATCH are separate real server requests, with strict projection, payload and saved-value validation. The session display is published only after an identity/generation-bound authoritative read, without replacing tokens or reviving an old session.
- **Safety:** nonblank name (1–80), phone (max 32) and location (max 120) use raw strings; frontend trims and empty optional fields clear. Prefs require actual booleans, including false. Backend row-locked partial preference merging fixes independent-key lost updates. UI saves all three switches explicitly, so later saves can still overwrite another tab; there is no version conflict check.
- **Interaction:** dirty navigation/reload guards, synchronous cross-action locks, aborted/sequence-bound reads and no automatic write replay. Accepted saves hide old details and refetch; failed/uncertain saves require Refresh, never optimistic demo success.
- **Retained gaps:** no password comparison or authenticated password change, avatar upload, self-deactivation or general personal activity UI. Existing password reset remains in Auth and actual own orders remain in the order screen. Inbox history/read states are unaffected by preference saves. Full verification and GUI limitations are recorded in the account slice section.

### 4.19 Personal notification inbox — Build / Adapt implemented

**Active files:** `pages/account/NotificationInbox.*`, `services/notifications.*`, `services/notificationsApi.*`, `backend/src/notifications/*`. Legacy `Notifications.*`, `Portal.tsx`, `WorkspaceFrame.tsx` and `demoStore.ts` remain unmounted.

- **Backend:** personal `GET /me/notifications`, exact one-way `PATCH /notifications/{id}` and bodyless `POST /notifications/read-all`. Strict recipient ID only; no role-wide fallback. Full-history server filters/page/counts with owner-wide unread total and RepeatableRead snapshot. Single read preserves its first timestamp; read-all uses one UPDATE across all owner history, with post-snapshot arrivals possibly still unread.
- **Frontend:** exact `#account/notifications` for both active User and Admin, guest login-return and plain signed-in header link. Filters and 10/25/50/100-row server pages are independent of catalog/orders. Known EN/VI message templates render escaped text; unknown keys/arbitrary JSON remain readable fallback. Open destination is separate from read, with role-aware mounted canonical destination allowlist; unsupported/external/batch/malformed links remain recorded text.
- **Actions:** duplicate/cross-action locks, aborted/session-bound reads, exact acknowledgement validation, no automatic 401/network write replay and authoritative refetch after success. Uncertain/failed writes hide stale data until successful Refresh. Mark-all explicitly confirms the entire personal inbox, not current filter/page; previous timestamps remain intact.
- **Deferred:** no global unread badge, bell, polling, cache, notification generation changes, deletion or mark-unread. Existing preference-controlled generation is retained; the subsequent profile/preferences slice in §4.18 adds its settings UI separately. The inbox slice section records actual API/browser/automated verification and limits.

### 4.20 Chat and conversation history — Dropped from scope (2026-10-28)

**Retained legacy files:** `pages/buyer/Buyer.*`, `components/buyer/BuyerWidgets.tsx`, `context/BuyerContext.tsx`, remote conversation API methods; Prisma Conversation/Message models.

- **Decision:** no chat/conversation API or UI will be integrated. This is removed scope, not deferred work or an acceptance blocker.
- **Current state:** no retained conversation endpoints; legacy widgets/providers remain unmounted. Existing source, models and migration history are retained without destructive cleanup.
- **Independent features:** notifications, disputes and reviews are unaffected; none requires a chat implementation.

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

- **Action:** preserve components not needing contract changes. Import matching CSS/assets with selected screens. Main's dialog stacking and farming overlay fixes differ from frontend; do not undo them while adding Home styles. Leave legacy chat layouts unmounted; their retained source is not an integration requirement. Normalize User/company/VND/UTC labels across dictionaries. Separate static copy/options from fake domain records; remove mock persistence, offline toggles/reset tools and fabricated histories from live journeys.
- **Verify:** dialogs above overlays, focus/close behavior, mobile layouts, language switching, backend message-key parameters, no USD leakage and no runtime import of demo accounts.

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
- [x] Integrate disputes/private evidence (remaining GUI/security acceptance limits recorded above).
- [ ] Integrate missing review screens.

**Gate:** User purchase and Admin fulfilment verified end-to-end, including retries, refunds, ownership and active-dispute guards.

### Pass C — Company operations and contained missing features

- [x] Adapt shared company catalog forms, public media and direct publication (GUI acceptance limits recorded above).
- [x] Connect optional internal listing review and real activity screens; remaining acceptance limits are recorded above.
- [x] Build Admin list/suspend/reactivate and personal notification inbox operations (bounded scope and acceptance limits recorded above).
- [ ] Integrate profile/prefs and remove client-only password/block/deletion claims.
- [ ] Build favorites if included in this pass.
- [ ] Integrate batch/facility/compliance management and real public updates.

**Gate:** two Admins operate the same resources; writes survive reload; notification failure does not block catalog/order loaders; private evidence remains private.

### Pass D — Separately scoped features

- [ ] Decide/test Google sign-in if retained.
- [ ] Implement complete review flows. Chat/messaging is dropped from scope.
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

The frontend now has 645 automated tests in nineteen files covering API/session behavior, account profile/preferences, commerce/dispute/catalog/review/activity/users/inbox transport and rules, catalog lifecycle eligibility and acknowledgements, checkout recovery, buyer/company presentation and guarded hash navigation; run `npm --prefix frontend run test` alongside type/build checks. Browser checks and their limits are recorded at the top; a production build alone does not prove integration. Backend end-to-end tests use isolated `fishfarm_test` (or an explicitly separate `_test` override) and create/clean their own fixtures, never a development database reset.

Preserve all eleven backend end-to-end suites: app, auth, profile/preferences, listings, marketplace, uploads, orders, disputes, batches-facilities, Admin users and notifications. Preserve unit coverage for permissions, session issuance and notification fan-out. Add tests for new endpoints/adapters instead of weakening existing assertions to match remote behavior.

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
6. **Engagement order:** recommendation is notifications/Admin users/favorites before full reviews/analytics, after the purchase journey works.
7. **Individual-fish sponsorship:** possible one-count-share batch, subject to deliberate approval; retain canonical full-prepaid care rather than prototype deposit/balance semantics.

**Current outcome:** auth/public catalog, cart/atomic simulated checkout, buyer lifecycle and company fulfilment are saved in `38f0dd7`; disputes/private evidence in `90c00a0`; shared catalog in `3c333f1`; optional review/activity and Admin User management in `f2d1b37`; personal inbox/read operations, own profile/preferences and dropped chat scope in `fb562af`. Catalog pause/resume/soft-delete controls, API/automated verification and the blocked visual-acceptance report are saved in the local catalog-lifecycle checkpoint dated 2026-10-30. Nothing was pushed, merged or deployed. Existing development records and migration history remain intact. Chat is dropped, not deferred. Favorites, farming/compliance UI, reviews/analytics, password/avatar/self-deactivation and sponsorship transactions/settlement remain separate. Outstanding full GUI journeys, moderation/lifecycle concurrency and production private-upload hardening are not declared solved by passing helper/API tests. The full marketplace acceptance gate is not yet satisfied; deployment remains deferred.
