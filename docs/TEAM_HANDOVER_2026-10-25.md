# FishFarm team handover — 2026-10-25

## Takeover status

Fetched the team's latest remote commits and inspected their compatibility. No application files were
changed, no branches merged, and no database connections or migrations were run during this review.
The existing uncommitted backend implementation remains on `integration/frontend-admin-ui` at
`52a75a1`. Its last verified checkpoint is 71 end-to-end tests and 17 unit tests passing, with successful
type-check/build and zero-warning lint. Those results do not validate the remote team's implementation.

No new written task list or handoff document was found in either remote snapshot. The user's request
hands the work back to us but does not specify individual fixes. The earlier instruction explicitly
deferred frontend integration; the recommendation below is a proposed integration boundary, not a
record of user approval to replace the implementation or deploy it.

## Exact team snapshots

| Branch | Commit | Contents |
| --- | --- | --- |
| `origin/backend` | `24d6994` | API-integrated prototype, Supabase/Prisma, Cloudinary and email services |
| `origin/main` | `81ef74b` | Google/Firebase sign-in, registration/error fixes, farming overlay and floating-chat fixes |
| `origin/frontend` | `53a78ed` | Home/login redesign, guest marketplace, separate auth/backend/bootstrap changes |

`main` and `frontend` both descend from `24d6994`; neither includes the other's subsequent work.
`main` has eleven unique commits and `frontend` one large unique commit. Do not assume the newest
frontend timestamp means it includes all main fixes.

## Recommended foundation

Retain our tested, company-owned User/Admin backend and applied migration. Use `origin/main` as the
frontend starting point, then selectively bring in the Home/public-marketplace and compatible login
improvements from `53a78ed`. Do not merge either remote backend wholesale or replay its migration
history against our database.

The remote backend still uses Buyer/Seller/Admin and individually owned listings/batches, with a
large `DomainService`. Our backend has a single company, User/Admin permissions, feature modules,
controlled compliance and private evidence. Frontend API calls need deliberate adaptation to our
contracts; copying the remote frontend alone does not produce a working combined app.

## Findings to preserve during integration

- **Home and guest marketplace:** `53a78ed` adds improved Home cards, video/poster handling, VND
  presentation, abortable loading, guest list/detail browsing and fish deep links. Keep these useful
  changes, adapting projections and endpoints to our marketplace APIs.
- **Google:** main has Firebase popup/token integration. The newer frontend's `GoogleSignIn` is
  explicitly display-only, without a handler, SDK or request; its accompanying backend verifies
  direct Google tokens and adds `GoogleIdentity`. These are incompatible implementations. Do not
  import a Google migration merely to preserve a placeholder button.
- **Registration:** newer frontend calls `/auth/register-account`, which main and our backend do not
  expose. Adapt registration to the selected backend contract rather than copying that adapter.
- **Refresh cookies:** remote frontend defaults to `/api` through a development proxy, while main
  backend scopes its cookie to `/v1/auth`. The newer backend uses `/`. Select a coherent proxy/cookie
  arrangement and test refresh and logout in the actual intended topology.
- **Chat:** main's floating-window and spacing fixes are absent from `53a78ed`. Preserve them. The
  baseline chat still needs real history/reply loading; a message-send endpoint is not a complete
  chat feature. Our backend does not yet implement messaging.
- **UI regressions:** preserve main's farming-overlay fix, New Arrivals removal and removal of the
  misleading Delete Account action. The newer branch labels suspension as deletion again.
- **Admin provisioning:** newer frontend branch includes automatic application-start Admin bootstrap
  with source defaults. Do not import it blindly. Prefer explicit, controlled provisioning, with no
  public signup privilege escalation or default production credentials.
- **Farming:** remote sponsorship offerings are single-fish/one-share, not our documented batch-share
  product. Reservation, payments, release, harvest and settlement remain deferred in our backend;
  do not present them as available merely because remote frontend screens exist.
- **Deployment:** hosted origins/API routing, email configuration and public/private media storage need
  explicit configuration. Never use the credentials previously pasted into group chat for testing;
  those should be treated as exposed and rotated by their owners.

## Validation boundary for a later combined implementation

Preserve the original working tree, applied migration and test fixtures before integration. Validate
frontend types/build and our full backend regression suite. Add contract tests for adapted frontend
requests, then browser-test signup/login/logout/refresh, guest catalog/detail links, checkout/order
history, tracking/disputes and Admin operations. Google and externally hosted services require valid,
authorized configuration; no success should be claimed without testing them.

No commit, push, reset, reseed, shared-database operation or deployment is authorized by this document.
See [the completed backend checkpoint](SESSION_HANDOFF_2026-10-23.md) for existing scope and constraints.
