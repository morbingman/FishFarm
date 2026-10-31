# GUI Review Checklist — integration/team-baseline

Manual acceptance pass for the integrated frontend before merging into `main`.
Scope: every mounted route, both roles, EN/VI, desktop + mobile widths.
After this review passes, the plan is: merge to `main` → push to remote → deployment work.

---

## 0. Setup

- Backend: `pnpm start:dev` in `backend/` (port 4000; check `GET /v1` returns metadata).
- Frontend: `pnpm dev` in `frontend/` (port 8443, strict).
- **Accounts:** register fresh accounts through the UI (one User, one Admin). Do **not**
  use credentials that were ever pasted into group chat — those are treated as exposed.
- Use two separate browser profiles (or a normal + private window) so a Buyer session and
  an Admin session can run side by side — several checks below need both at once.
- Demo data: `pnpm db:seed` (backend/) resets the dev database to demo data if you want a
  clean start. **Caution: this wipes everything in the dev DB** — only do it if the current
  local data is disposable.
- Keep screenshots/notes as you go; record findings in the issue log at the bottom.

## 1. Global checks — apply to every page

- [ ] EN/VI toggle in the header translates the page **and survives reload**.
- [ ] Mobile width (~390px): layout doesn't overflow, tables scroll or wrap, buttons tappable.
- [ ] Loading state shows while fetching; empty state shows when there's no data (never a blank table).
- [ ] Server failure (stop the backend, reload): a readable error appears with a retry, not a crash.
- [ ] Refresh mid-flow doesn't lose the session or land on a broken page.
- [ ] Money renders as integer VND with thousands separators; dates render as UTC (no local-timezone drift).
- [ ] Role gating: opening a Buyer page as Admin (and vice versa) shows the access-denied page, not data.
- [ ] Browser console: no errors or unhandled promise rejections during normal use.

## 2. Public pages (no login)

### Home (`#home`)
- [ ] Header navigation points only at mounted pages; no dead links.
- [ ] Content renders from the real company projections (no placeholder stats).

### Marketplace catalog + listing detail (`#marketplace`, `#marketplace/listings/:id`)
- [ ] Catalog lists published listings with images, price, region filters/search working.
- [ ] Listing detail shows gallery, description, seller info; Add-to-cart appears only when logged in as User.
- [ ] Unpublished/paused/deleted listings are not reachable by direct URL (404/empty, not stale data).

### Public batches list + detail (`#farming`, `#farming/:code` — buyer-facing batch browse)
- [ ] Only open/active batches appear; sold-out shows correct availability.
- [ ] Batch detail: title, species, share unit/quantity, stocking/expected-harvest dates, facility, images.
- [ ] "Reserve / sponsor" entry point visible for a logged-in User; hidden or login-redirected for guests.
- [ ] A fully_sponsored batch shows closed state; a cancelled batch is not listed.

## 3. Auth

- [ ] Register: new User account, validation errors (short password, bad email) readable.
- [ ] Login as User and as Admin; wrong password shows a clear error.
- [ ] Gated redirect: as a guest, open `#marketplace/sponsorships` → login screen; after login you land back on it (return-path chip).
- [ ] Logout returns to public view; protected pages then deny access.

## 4. Buyer commerce (cart → order lifecycle)

### Cart (`#marketplace/cart`) and checkout (`#marketplace/checkout`)
- [ ] Add to cart, change quantity (respects remaining stock), remove, cart persists across reload.
- [ ] Checkout: recipient fields validate; order total matches cart; double-submit doesn't create two orders.

### Confirmation (`#marketplace/confirmation?order=…`)
- [ ] Order code shown; success copy; link into order detail.

### Orders (`#marketplace/orders`, `#marketplace/orders/:code`)
- [ ] List shows the buyer's orders only (not another user's — cross-check with the second profile).
- [ ] Detail shows items, payment rows (simulated provider), status timeline.
- [ ] Pre-order deposit flow (if a listing offers it): deposit → balance_due → pay balance.

### Buyer dispute (`#marketplace/orders/:code/dispute`, dispute detail)
- [ ] File a dispute with reason + optional private attachment; appears in the Admin queue.
- [ ] Dispute detail shows Admin responses; buyer can't file on non-eligible orders.

## 5. Sponsorships (§11 journey — the core of this integration)

### Reserve (from public batch detail)
- [ ] Reserve form: shares, recipient name/phone/address; terms snapshot shown before confirm.
- [ ] Over-reserving beyond `sharesAvailable` is refused with a readable error and doesn't corrupt availability.
- [ ] After reserving: batch availability drops by the reserved shares (check public page in the other profile).

### My sponsorships list (`#marketplace/sponsorships`)
- [ ] Status labels correct per row (Awaiting payment / Funded / Growing / Ready for delivery / Delivered / Settled / Cancelled / Refunded).
- [ ] Awaiting-payment rows show "Pay by · UTC" deadline (~24h after reservation) and pay/cancel actions.
- [ ] **Money history table** (new in M15): newest first, batch + purpose + amount + state + created;
  appears only once a payment exists; batch links navigate to the detail; EN/VI labels correct;
  empty state text shows before any payment.

### Sponsorship detail (`#marketplace/sponsorships/:id`)
- [ ] Terms snapshot matches what was shown at reserve time; escrow view shows 30/40/30 tranches.
- [ ] Pay: one-shot; double-click/replay doesn't create a second payment; status → Funded.
- [ ] Cancel while unpaid: simple release, shares return to the pool.
- [ ] Cancel while funded: refund shown; payments flip to Refunded (paidAt kept); shares restored.
- [ ] Dispute filing from the detail on eligible statuses; renders kind-aware in the Admin queue.
- [ ] When the company grows/harvests (Admin side, below): status transitions appear here after refresh.
- [ ] **Delivery fee panel** (M14): on ready_for_delivery with a charged fee, the "Pay the delivery fee"
  panel shows; confirm-delivery button is disabled with the explanatory line; after paying the fee
  (once — replay is a no-op) the button enables and delivery can be confirmed.
- [ ] Zero-fee batch: confirm-delivery works immediately, no fee panel.

## 6. Account & notifications

### Profile (`#account/profile`)
- [ ] Shows real identity data; logout works from here.

### Settings/preferences (`#account/settings`)
- [ ] Notification preference toggles persist and actually suppress/allow the matching notifications.
- [ ] Language default respected.

### Notification inbox (`#account/notifications`)
- [ ] Lifecycle events arrive (reservation, payment, expiry, delivery fee paid, dispute updates) with batch/order references.
- [ ] Mark read / mark all read; unread count in header updates; EN/VI templates with correct parameters.
- [ ] Buyer sees only their own notifications; Admin sees their own (cross-check profiles).

## 7. Company / Admin workspace

### Company catalog (`#company/listings`, draft/edit modes)
- [ ] Create draft → publish (direct or via review); edit; pause/resume; withdraw; soft-delete.
- [ ] Published changes appear on the public marketplace in the other profile; paused listings disappear from it.

### Listing review queue (`#company/listings/review/:id` or queue route)
- [ ] Optional internal review: pending listing appears in queue; approve/reject records a decision and notifies the seller.

### Company orders (`#company/orders`, detail)
- [ ] Queue shows User orders; fulfil/mark-ready/balance flows update the buyer's view in the other profile.

### Company facilities (`#company/facilities`, new/edit)
- [ ] Facility list/create/edit works; compliance document upload works; private documents download only for Admin.
- [ ] Known gap (not a bug): facility scalar edit/delete has no endpoint — the UI shouldn't pretend otherwise.

### Company batches (`#company/batches`, new, detail)
- [ ] Draft → submit for review → Admin approve/reject; or direct publish; reverse-to-draft paths.
- [ ] Grow transition: open/fully_sponsored → Growing; stocking tranche released in sponsor escrow view.
- [ ] Harvest: enter actual count/weight and **optional delivery fee per share** (integer; fraction rejected
  client-side); shortfall produces a refund row on the sponsor's ledger; status → Ready for delivery.
- [ ] Batch review queue (`#company/batches/review/...`): pending submissions appear with snapshot; decision recorded.

### Admin disputes queue (`#admin/disputes`)
- [ ] Both order disputes and sponsorship disputes appear in one queue, kind-aware; resolve/reject updates the buyer.

### Admin activity log (`#admin/activity`)
- [ ] Actor + action rows for the flows exercised above; nothing for actions that shouldn't log.

### Admin users (`#admin/users`)
- [ ] Directory lists Users/Admins; suspend/reactivate works — a suspended account can't log in or act.

## 8. Known limits — do NOT report these as bugs

- Favorites, reviews/analytics, password change, avatar upload, self-deactivation: not in scope.
- Chat: dropped by decision.
- Facility edit/delete: no retained endpoint.
- Payment is simulated (no gateway) by design.
- Deployment: deferred until after merge/push.

## 9. Issue log

Record each finding as:

```
[ ] P? | page/route | role+language | what you did | what you saw | what you expected
```

(P1 = blocker for merge, P2 = should fix before merge, P3 = nice to fix, P4 = note only)

| # | Priority | Route | Role/Lang | Steps | Actual | Expected |
|---|----------|-------|-----------|-------|--------|----------|
|   |          |       |           |       |        |          |

**Verdict:** ☐ ready to merge ☐ fix first (list P1/P2 above)
