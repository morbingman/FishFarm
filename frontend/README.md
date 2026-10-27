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
npm run test       # API/session and commerce transport/recovery tests
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

### Verified results and limits

On 2026-10-28, all 37 frontend tests in six files passed, including 10 company action/transport tests. Frontend TypeScript/build and dependency audit passed with zero reported vulnerabilities. Backend TypeScript/build/lint, 23 unit tests and all 71 isolated e2e tests passed. The known `pg` concurrent-query deprecation warning remains.

Real server-backed browser checks used one fresh local User and two Admins: preorder readiness, a 1,500 ₫ simulated balance payment, shipment metadata, delivery and buyer receipt completion; a separate in-stock order completed by an Admin with shipment fields blank; buyer and company cancellation/refunds; shared access across Admins; role denial, foreign-owner 404, reload, status filtering and failure/Refresh reconciliation. Vietnamese copy and mobile queue width were checked. The four fixture orders were created through the real API during setup; their subsequent lifecycle actions used the UI. This slice did not repeat the complete cart/checkout GUI journey, which was checked in the earlier slice.

Final database checks confirmed the two saved development orders (`ORD-10121` and `ORD-10122`) retained their status, totals, payment records and preorder amounts. Fresh `ORD-10123` and `ORD-10124` are completed; `ORD-10125` and `ORD-10126` are refunded. The preorder has exactly one deposit and one balance payment, and both cancellations returned stock once. Only the four inspected `LOCAL TEST ONLY` fixture listings were soft-archived from public browsing; their three accounts, orders and payment records remain for inspection. No database reset/reseed or migration replacement occurred.

Normal browser click commands were unreliable in this pass. Snapshot-grounded control fallbacks invoked the actual UI handlers and server requests; this is not a complete mouse/keyboard-only or visual-layout acceptance pass. Automatic deadline expiry, active-dispute blocking and concurrent invalid transitions retain backend test coverage but were not exercised as browser journeys here. No real payment gateway or shipping provider was tested. Integration changes remain uncommitted; deployment stays deferred.

Disputes/private evidence, reviews and messaging remain later integration passes.

Do not use exposed group-chat credentials for testing. Create a fresh local-only account instead. Any `devCode` shown in the auth screen comes from the non-production backend response, not a fixed client code.

The [integration map](../docs/INTEGRATION_MAP_2026-10-26.md) records source selection, verified results, and later passes.
