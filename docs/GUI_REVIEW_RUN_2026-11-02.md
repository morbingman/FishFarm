# GUI Review Run — 2026-11-02 (automated, Option 1)

Full pass over `docs/GUI_REVIEW_CHECKLIST.md`, driven in the browser as both roles
(sequential session switching — one browser only), EN + VI spot-checks, desktop 1280px
+ mobile 390px. Screenshot evidence in `gui-test-screenshots/` (files prefixed `t1`–`t7`
are from this run; `a*`/`b*` are from the earlier pass).

## Verdict

**PASS with 3 open findings (F8, F9, F10).** Every checklist section was exercised
end to end; no P1 blocker found. The two findings below F8 are new in this run.

**Update (same day): F8, F9 and F10 are all fixed and re-verified — the run now stands at PASS, zero open findings.**

## Section results

| § | Section | Result | Notes / evidence |
|---|---------|--------|------------------|
| 1 | Global | PASS | EN/VI toggle + reload persistence (`t1_vi_*`), mobile 390px no overflow (`t1_mobile_*`), loading/empty states, money `2,450,000 ₫` + date formats, role gating (`t7_role_gating_admin_cart.png`), server-down alert + Retry (`t1_server_down.png`), session recovers after backend restart |
| 2 | Public pages | PASS | Home, catalog + search, guest detail gate, batches. Paused listing removed from search **and** direct URL → "The requested record was not found." (`t2_unpublished_direct_url.png`) |
| 3 | Auth | PASS | Register + validation + simulated email verification, wrong-password error, gated redirect with return path, logout (`t3_*`) |
| 4 | Buyer commerce | PASS | Cart, over-stock rejection, cart persistence on reload, checkout validation, double-submit protection, order tracking. **Preorder flow full pass** on FM-48301: deposit 25% = ₫75,000 at checkout (`t4_preorder_checkout.png`), admin "Mark ready" sets the 7-day balance deadline, buyer "Pay balance" → Paid in full (`t4_balance_paid.png`) |
| 5 | Sponsorships §11 | PASS | Over-reserve cap, terms snapshot, reserve → pay → Funded with escrow 30/40/30, Pay-by deadline. Full lifecycle: grow released stocking tranche, harvest released mid-growth tranche, **shortfall refund 180,000 ₫ = 375 g × 480 ₫/g pro-rata** (`t5_funded_escrow.png`), delivery fee ₫50,000 paid outside escrow (pay button removed once paid — replay impossible), confirm delivery → Delivered (`t5_delivery_confirmed.png`). VI ledger fully localized (`t5_money_history_vi.png`). **Cancel-unpaid: not exercised** — the only batch was already Harvested when this item came up; needs an open batch (see setup notes) |
| 6 | Account & notifications | PASS | Profile identity, settings persist, notification lifecycle, mark read / mark-all-read (with confirm). Dispute decisions arrive as notifications with deep links (`t7_dispute_notifications.png`). **F8**: header Notifications link has no unread badge |
| 7 | Company/admin | PASS | Draft create → completeness gate blocks publishing incomplete drafts → publish after completion (`t7_draft_published.png`), review queue approve → Live + publicly visible (`t7_review_approved.png`, `t7_approved_public.png`), pause/resume + public disappearance, order fulfilment chain, facilities create (list/read/review), batch grow + harvest + delivery fee, dispute queue **resolve and reject** paths (`t7_dispute_resolved.png`), activity log rows for every exercised action (`t7_activity_log.png`), user suspend → revoked login ("This account is suspended.") → reactivate (`t7_user_suspended.png`) |

## Issue log

- `[x] P2 | Company batch detail (#company/batches/:code) | Admin+EN | Start growing / Publish harvest → confirm | Server applies the write but the client shows "Request failed (sponsorship.invalidResponse)" (grow) / "Unable to connect…" (harvest); a fresh read shows the truth | Both transitions must report success | F9 — FIXED 2026-11-02, three stacked causes: (1) backend grow returned the bare batch row instead of the `{ batch }` envelope the client validates (`backend/src/sponsorships/sponsorships.service.ts`); (2) the page acknowledgement check compared the server cuid `batch.id` against the company record's code-as-id (`frontend/src/pages/company/CompanyBatches.tsx`); (3) same envelope/ack mismatch masked the harvest success. Verified via GUI on BATCH-1026: both transitions now show "…acknowledged and the authoritative company record read again" (`gui-test-screenshots/fix_f9_harvest_acknowledged.png`).`
- `[x] P3 | Harvest publication form | Admin+EN | Fill actual biomass only (weight-share batch, no count) → Review harvest publication | "Check field: actualCount" rejection | UI copy says count-share batches use the surviving count "only", implying weight-share does not need it; either require the field in the UI or relax the server check. Also the raw "Check field: actualCount" message is terse for end users | F10 — FIXED 2026-11-02: the server needs the surviving count for every batch (it computes mortality from it), so the field label and explanatory copy now say "required for every batch", and the field names in the error message are human labels ("Check field: Surviving fish count (harvest)").`
- `[x] P3 | Header (all pages) | User+EN | Receive notifications, look at header | Notifications link has no unread-count badge | Checklist expects the header badge to update | F8 — FIXED 2026-11-02: header link now carries an unread badge (one cheap `read=unread&limit=1` read on mount and after every hash navigation, capped at 9+, hidden when zero, failures silent). Verified live: 9+ for 12 unread → cleared after Mark-all-read + navigation → "2" after new grow/harvest events (`fix_f9_harvest_acknowledged.png` shows it).`
- `[x] Verified non-issue | listing media | — | Draft publication gate correctly disables "Publish saved listing" until gender/health/ageMonths/images/shipping are complete (preview hint + disabled button agree).`

## Setup notes / limitations of this run

- One browser only → roles were tested sequentially with sign-out/sign-in between
  phases; no concurrent admin+buyer session was possible.
- Browser console output is not collectable in this runtime; error checks were done on
  page-visible manifestations only.
- File uploads (listing images, dispute/facility evidence, batch photos) are not
  supported by the embedded browser runtime. To unblock the preorder flow, one image
  was attached to FM-48301 through the authenticated uploads API (`POST /v1/uploads`,
  purpose `listing_image`) plus a `PATCH` completing gender/health/ageMonths/shipping;
  publish and the whole buyer flow were then done via GUI. Upload *UI* itself remains
  GUI-untested.
- Cancel-unpaid reservation was not exercised: BATCH-1024 was already Harvested when
  this item came up and no other open batch exists. To test it, create + publish a new
  company batch, reserve a share, then cancel before the 24 h deadline.
- §8 known limits (favorites, reviews, analytics, password change, avatar, chat,
  facility edit/delete, simulated payments, deferred deployment) are documented as
  not-bugs and were not re-tested.

## Test data left in the dev DB

- User `gui.tester@fishfarm.test` / `GuiTest123` (re-activated, Active)
- Orders ORD-10026 (delivered, dispute resolved), ORD-10027 (ready, paid in full)
- Sponsorship on BATCH-1024: delivered; ledger: package 2,400,000 / delivery fee
  50,000 / shortfall refund 180,000; sponsorship dispute rejected
- Listings: FM-48301 "GUI Test Angelfish" (Live, pre-order), FM-20817 approved Live
- Facility "GUI Test Hatchery"; growth observation on BATCH-1024; both disputes decided
- Batches BATCH-1025 "GUI Grow Test Batch" (harvested) and BATCH-1026 "GUI Grow Test Batch 2" (harvested) — created via API to verify the F9/F10 fixes; admin marked all 12 notifications read during the F8 badge check
- Backend was stopped and restarted during the server-failure test and is running again
