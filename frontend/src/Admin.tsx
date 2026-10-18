import { useEffect, useMemo, useState } from "react"
import type { Lang } from "./i18n"
import { PortalShell, Icon, StatusChip, StatusBadge, StateBlock, Banner, ConfirmDialog, Crumbs, Pager, Skeleton, useLoading, useToast, useHash, go, STATUS_LABEL } from "./ui"
import { PERMS, decideListing, fmtDate, request, setUserStatus, takedownListing, timeAgo, useStore, type LStatus, type Listing, type Perm, type User } from "./store"
import { portalVi } from "./portal-vi"

const TABS: [string, string, (l: Listing) => boolean][] = [
  ["pending", "Pending Review", l => l.status === "pending"],
  ["changes", "Changes Requested", l => l.status === "changes"],
  ["rejected", "Rejected", l => l.status === "rejected"],
  ["approved", "Live", l => l.status === "approved"],
  ["paused", "Paused", l => l.status === "paused"],
  ["all", "All", l => l.status !== "draft"],
]
const REASONS: [string, number][] = [["Image quality", 4], ["Incomplete fish details", 2], ["Pricing concern", 3], ["Species policy", 1]]
const CHECKS = ["Photos are clear and show the actual fish", "Species and breed match the photos", "Price is within the market range", "Health status is credible"]
const money = (v: string) => `$${Number(v || 0).toLocaleString("en-US")}`
const waitingHours = (l: Listing) => Math.max(0, Math.round((Date.now() - new Date(l.submittedAt ?? l.createdAt).getTime()) / 3600_000))

export default function Admin({ user, language, setLanguage }: { user: User; language: Lang; setLanguage: (l: Lang) => void }) {
  const s = useStore()
  const { parts, params } = useHash()
  const [toast, show] = useToast()
  const pending = s.listings.filter(l => l.status === "pending").length
  const sec = parts[1] ?? ""
  const active = sec === "" ? "#admin" : sec === "review" ? "#admin/queue" : `#admin/${sec}`
  let body
  if (sec === "") body = <Overview />
  else if (sec === "queue") body = <Queue key={params.get("tab") ?? "pending"} initTab={params.get("tab") ?? "pending"} />
  else if (sec === "review" && parts[2]) body = <Review key={parts[2]} id={parts[2]} user={user} show={show} />
  else if (sec === "users") body = <Users user={user} show={show} />
  else if (sec === "activity") body = <ActivityLog />
  else if (sec === "roles") body = <Roles />
  else body = <StateBlock card icon="search" tone="info" title="Page not found" body="This admin page doesn't exist." actions={<a className="sl-btn sl-btn-primary" href="#admin">Back to overview</a>} />
  return <PortalShell user={user} active={active} language={language} setLanguage={setLanguage} dict={portalVi} badges={{ "#admin/queue": pending }} toast={toast}>{body}</PortalShell>
}

function Overview() {
  const s = useStore()
  const loading = useLoading()
  const c = (st: LStatus) => s.listings.filter(l => l.status === st).length
  const queue = s.listings.filter(l => l.status === "pending").sort((a, b) => waitingHours(b) - waitingHours(a))
  const kpis: [string, number, string, string, "shield" | "check" | "alert" | "users"][] = [
    ["Pending review", c("pending"), "#admin/queue?tab=pending", "Review queue", "shield"],
    ["Live listings", c("approved"), "#admin/queue?tab=approved", "View live listings", "check"],
    ["Changes / rejected", c("changes") + c("rejected"), "#admin/queue?tab=changes", "See sent back", "alert"],
    ["Active users", s.users.filter(u => u.status === "active").length, "#admin/users", "Manage users", "users"],
  ]
  return (
    <>
      <div className="sl-page-head"><div><span className="sl-eyebrow">Admin Console</span><h1>Marketplace overview</h1><p>Everything that needs your attention, in one place.</p></div>
        <button className="sl-btn sl-btn-primary lg" disabled={!queue.length} onClick={() => go(`admin/review/${queue[0].id}`)}>Review next listing <Icon name="arrow" /></button></div>
      <div className="sl-stats">
        {kpis.map(([label, n, href, cta, ic]) => (
          <button key={label} className="sl-stat pt-kpi" onClick={() => go(href)}>
            <div className="sl-stat-top"><span><Icon name={ic} /></span></div>
            <strong>{n}</strong><small>{label}</small><span className="go">{cta} <Icon name="arrow" size={13} /></span>
          </button>
        ))}
      </div>
      <div className="pt-grid2">
        <section className="sl-card">
          <div className="sl-card-head"><h2>Needs attention</h2><a className="sl-link" href="#admin/queue?tab=pending">View queue</a></div>
          {loading ? <Skeleton rows={3} /> : queue.length === 0 ?
            <StateBlock icon="check" title="Queue is clear" body="No listings are waiting for review. New submissions will appear here and in your notifications." /> :
            <div className="sl-table-wrap"><table className="sl-table"><thead><tr><th>Listing</th><th>Seller</th><th>Waiting</th></tr></thead><tbody>
              {queue.slice(0, 5).map(l => <tr key={l.id} className="pt-row-click" onClick={() => go(`admin/review/${l.id}`)}><td><b>{l.draft.name}</b><br /><small className="pt-mini">{l.id}</small></td><td>{l.sellerName}</td><td>{waitingHours(l)} h</td></tr>)}
            </tbody></table></div>}
        </section>
        <section className="sl-card">
          <div className="sl-card-head"><h2>Recent activity</h2><a className="sl-link" href="#admin/activity">View all</a></div>
          {loading ? <Skeleton rows={4} /> : <ul className="pt-timeline" style={{ padding: "12px 24px 8px" }}>
            {s.activity.slice(0, 5).map(a => <li key={a.id}><b>{a.action}</b>{a.target && (a.link ? <a href={a.link} className="sl-link">{a.target}</a> : <span>{a.target}</span>)}<small>{a.actor} · {timeAgo(a.at)}</small></li>)}
          </ul>}
        </section>
      </div>
    </>
  )
}

function Queue({ initTab }: { initTab: string }) {
  const s = useStore()
  const loading = useLoading(450)
  const [tab, setTab] = useState(TABS.some(t => t[0] === initTab) ? initTab : "pending")
  const [q, setQ] = useState("")
  const [sort, setSort] = useState<"oldest" | "newest">("oldest")
  const [page, setPage] = useState(1)
  const base = TABS.find(t => t[0] === tab)!
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return s.listings.filter(base[2]).filter(l => !needle || [l.draft.name, l.id, l.sellerName, l.draft.species].some(x => x.toLowerCase().includes(needle)))
      .sort((a, b) => (sort === "oldest" ? 1 : -1) * (new Date(a.submittedAt ?? a.createdAt).getTime() - new Date(b.submittedAt ?? b.createdAt).getTime()))
  }, [s.listings, tab, q, sort])
  const pageRows = rows.slice((page - 1) * 5, page * 5)
  return (
    <>
      <Crumbs items={[["Admin", "#admin"], ["Moderation Queue"]]} />
      <div className="sl-page-head"><div><h1>Moderation queue</h1><p>Review, approve or send back seller listings.</p></div></div>
      <section className="sl-card">
        <div className="pt-tabs" role="tablist">
          {TABS.map(([k, label, f]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); setPage(1) }}>{label}<em>{s.listings.filter(f).length}</em></button>)}
        </div>
        <div className="pt-toolbar">
          <label className="pt-search"><Icon name="search" size={16} /><input value={q} onChange={e => { setQ(e.target.value); setPage(1) }} placeholder="Search by name, ID or seller" aria-label="Search listings" /></label>
          <select className="pt-select" value={sort} onChange={e => setSort(e.target.value as "oldest" | "newest")} aria-label="Sort"><option value="oldest">Oldest first</option><option value="newest">Newest first</option></select>
        </div>
        {loading ? <Skeleton /> : rows.length === 0 ? (
          q ? <StateBlock icon="search" tone="info" title="No results" body={`No listings match "${q}" in this tab. Check the spelling or try a different search.`} actions={<button className="sl-btn sl-btn-ghost" onClick={() => setQ("")}>Clear search</button>} /> :
            <StateBlock icon="inbox" tone="info" title="Nothing here yet" body={tab === "pending" ? "There are no listings waiting for review. You're all caught up." : "No listings have this status."} />
        ) : (
          <div className="sl-table-wrap"><table className="sl-table"><thead><tr><th>Listing</th><th>Seller</th><th>Price</th><th>Status</th><th>Submitted</th></tr></thead><tbody>
            {pageRows.map(l => (
              <tr key={l.id} className="pt-row-click" tabIndex={0} onClick={() => go(`admin/review/${l.id}`)} onKeyDown={e => e.key === "Enter" && go(`admin/review/${l.id}`)}>
                <td><div className="sl-cell">{l.draft.images[0] && <img src={l.draft.images[0].url} alt="" />}<div><b>{l.draft.name}</b><small>{l.id} · {l.draft.species}</small></div></div></td>
                <td>{l.sellerName}</td><td>{money(l.draft.price)}</td><td><StatusChip s={l.status} /></td><td>{l.submittedAt ? timeAgo(l.submittedAt) : "—"}</td>
              </tr>
            ))}
          </tbody></table></div>
        )}
        {!loading && rows.length > 0 && <Pager page={page} size={5} total={rows.length} onPage={setPage} />}
      </section>
    </>
  )
}

type Mode = null | "approve" | "rejected" | "changes" | "takedown"
function Review({ id, user, show }: { id: string; user: User; show: (m: string) => void }) {
  const s = useStore()
  const l = s.listings.find(x => x.id === id)
  const [mode, setMode] = useState<Mode>(null)
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [reason, setReason] = useState(REASONS[0][0])
  const [feedback, setFeedback] = useState("")
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const loading = useLoading(350)
  useEffect(() => { setError("") }, [mode])

  if (!l) return (
    <>
      <Crumbs items={[["Admin", "#admin"], ["Moderation Queue", "#admin/queue"], [id]]} />
      <StateBlock card icon="trash" tone="warn" title={s.deleted.includes(id) ? "This listing was deleted" : "Listing not found"}
        body={s.deleted.includes(id) ? "The seller removed this listing, so there is nothing left to review. Related notifications now point to a record that no longer exists." : `We couldn't find a listing with ID ${id}. It may have been mistyped.`}
        actions={<a className="sl-btn sl-btn-primary" href="#admin/queue">Back to queue</a>} />
    </>
  )
  const seller = s.users.find(u => u.email === l.owner)
  const d = l.draft
  const allChecked = CHECKS.every(c => checks[c])
  const feedbackBad = feedback.trim().length < 10
  const next = s.listings.find(x => x.status === "pending" && x.id !== l.id)

  const run = async (fn: () => boolean, done: string) => {
    setBusy(true); setError("")
    try {
      const ok = await request(fn)
      if (!ok) { setError("This listing is no longer pending, so the decision couldn't be recorded. Refresh to see its current state."); setBusy(false); return }
      setBusy(false); setMode(null); setFeedback(""); show(done)
    } catch (e) {
      setBusy(false)
      setError((e as Error).message === "expired" ? "Your session expired. Sign in again to continue." : "Network error. The decision was not saved. Check your connection and try again.")
    }
  }
  const confirm = () => {
    if (mode === "approve") run(() => decideListing(user, l.id, "approved"), `"${d.name}" approved and published`)
    else if (mode === "rejected" || mode === "changes") run(() => decideListing(user, l.id, mode, reason, feedback.trim(), REASONS.find(r => r[0] === reason)![1]), mode === "rejected" ? "Listing rejected. The seller was notified." : "Changes requested. The seller was notified.")
    else if (mode === "takedown") run(() => { takedownListing(user, l.id, feedback.trim()); return true }, "Listing taken down")
  }
  const start = (m: Mode) => {
    setTried(true)
    if (m === "approve" && !allChecked) return
    if (m !== "approve" && feedbackBad) return
    setMode(m)
  }
  const dialog = mode && (
    <ConfirmDialog
      danger={mode !== "approve"} busy={busy} error={error} onCancel={() => setMode(null)} onConfirm={confirm}
      title={mode === "approve" ? "Approve this listing?" : mode === "changes" ? "Request changes?" : mode === "rejected" ? "Reject this listing?" : "Take down this listing?"}
      body={mode === "approve" ? `"${d.name}" will go live on the marketplace immediately and ${l.sellerName} will be notified.` : mode === "changes" ? "The seller will be asked to edit and resubmit. This is recorded in the listing history." : mode === "rejected" ? "The listing will be rejected. The seller can still edit and resubmit it." : "The listing will disappear from the marketplace and the seller will be notified."}
      confirmLabel={mode === "approve" ? "Approve & publish" : mode === "changes" ? "Send request" : mode === "rejected" ? "Reject listing" : "Take down"}
    />
  )

  return (
    <>
      <Crumbs items={[["Admin", "#admin"], ["Moderation Queue", "#admin/queue"], [l.id]]} />
      <div className="sl-page-head tight"><div><span className="sl-eyebrow">{l.id} · Submitted {l.submittedAt ? fmtDate(l.submittedAt) : "—"}</span><h1>{d.name}</h1></div><StatusChip s={l.status} /></div>
      {loading ? <Skeleton rows={6} /> : (
        <div className="sl-admin-cols">
          <div className="sl-admin-content">
            <section className="sl-card pad"><h3>Images</h3>
              {d.images.length ? <div className="sl-admin-imgs">{d.images.map((im, i) => <figure key={im.id}><img src={im.url} alt={`${d.name} ${i + 1}`} />{im.id === (d.mainId || d.images[0].id) && <figcaption>Main</figcaption>}</figure>)}</div> : <p className="pt-mini">No images uploaded.</p>}
            </section>
            <section className="sl-card pad"><h3>Listing information</h3>
              <dl className="sl-specs two">
                {([["Species", d.species], ["Breed", d.breed || "—"], ["Price", `${money(d.price)}${d.negotiable ? " · Negotiable" : ""}`], ["Quantity available", d.quantity], ["Age", d.age], ["Size", `${d.size} cm`], ["Gender", d.gender], ["Origin", d.origin], ["Health Status", d.health], ["Location", `${d.location}, ${d.region}`], ["Shipping", d.shipping.join(", ")]] as [string, string][]).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
              <h4>Description</h4><p className="sl-desc">{d.description}</p>
            </section>
            <section className="sl-card pad"><h3>History</h3>
              <ul className="pt-timeline">{[...l.history].reverse().map((h, i) => <li key={i}><b>{h.action}</b><small>{h.by} · {fmtDate(h.at)}</small>{h.note && <p>{h.note}</p>}</li>)}</ul>
            </section>
          </div>
          <div className="sl-admin-side">
            <section className="sl-card pad"><h3>Seller information</h3>
              <div className="sl-seller-card flat"><span className="sl-avatar">{l.sellerName.slice(0, 2).toUpperCase()}</span><div><b>{l.sellerName}</b><span><Icon name="shield" size={14} /> Verified Seller</span></div></div>
              <dl className="sl-specs one"><div><dt>Account status</dt><dd>{seller ? (seller.status === "active" ? "Active" : "Suspended") : "Unknown"}</dd></div><div><dt>Contact</dt><dd>{l.owner}</dd></div><div><dt>Joined</dt><dd>{seller?.joined ?? "—"}</dd></div><div><dt>Listings</dt><dd>{s.listings.filter(x => x.owner === l.owner).length}</dd></div></dl>
            </section>
            <section className="sl-card pad sl-decision"><h3>Moderation decision</h3>
              {l.status === "pending" ? (
                <>
                  <ul className="sl-checks">{CHECKS.map(c => <li key={c}><label><input type="checkbox" checked={!!checks[c]} onChange={e => setChecks(x => ({ ...x, [c]: e.target.checked }))} />{c}</label></li>)}</ul>
                  {tried && !allChecked && <p className="pt-mini" style={{ color: "var(--danger)", marginBottom: 10 }}>Complete the checklist before approving.</p>}
                  <div className="sl-reject">
                    <label className={`sl-field ${tried && feedbackBad ? "bad" : ""}`}><span>Reason<b className="pt-req">*</b></span><select value={reason} onChange={e => setReason(e.target.value)}>{REASONS.map(r => <option key={r[0]}>{r[0]}</option>)}</select></label>
                    <label className={`sl-field ${tried && feedbackBad ? "bad" : ""}`}><span>Feedback for the seller<b className="pt-req">*</b></span><textarea rows={3} value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Explain what needs to change… (needed to reject / request changes)" />{tried && feedbackBad && <em>Add at least 10 characters of feedback.</em>}</label>
                  </div>
                  <div className="sl-actions-stack" style={{ marginTop: 14 }}>
                    <button className="sl-btn sl-btn-primary" onClick={() => start("approve")}><Icon name="check" />Approve Listing</button>
                    <button className="sl-btn sl-btn-ghost" onClick={() => start("changes")}><Icon name="edit" />Request Changes</button>
                    <button className="sl-btn sl-btn-outline-danger" onClick={() => start("rejected")}><Icon name="x" />Reject Listing</button>
                  </div>
                </>
              ) : (
                <>
                  <Banner tone="info">This listing is <b>{STATUS_LABEL[l.status]}</b>, so no review decision is available.{l.status === "draft" && " The seller has not submitted it or withdrew it."}</Banner>
                  {l.decision && <div className="pt-mini" style={{ marginBottom: 12 }}><b>{l.decision.reason}</b> — {l.decision.feedback}<br />By {l.decision.by}, {timeAgo(l.decision.at)}</div>}
                  {(l.status === "approved" || l.status === "paused") && (
                    <>
                      <label className={`sl-field ${tried && feedbackBad ? "bad" : ""}`}><span>Reason for take-down<b className="pt-req">*</b></span><textarea rows={3} value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Why is this listing being removed?" />{tried && feedbackBad && <em>Add at least 10 characters.</em>}</label>
                      <button className="sl-btn sl-btn-outline-danger" style={{ marginTop: 12 }} onClick={() => start("takedown")}><Icon name="x" />Take down listing</button>
                    </>
                  )}
                </>
              )}
              {next && l.status !== "pending" && <a className="sl-link" style={{ marginTop: 14 }} href={`#admin/review/${next.id}`}>Next in queue: {next.draft.name} →</a>}
            </section>
          </div>
        </div>
      )}
      {!busy && !mode && l.status !== "pending" && !loading && <div style={{ marginTop: 20 }}><a className="sl-btn sl-btn-ghost" href="#admin/queue"><Icon name="left" />Back to queue</a></div>}
      {dialog}
    </>
  )
}

function Users({ user, show }: { user: User; show: (m: string) => void }) {
  const s = useStore()
  const loading = useLoading(450)
  const [q, setQ] = useState("")
  const [role, setRole] = useState("all")
  const [page, setPage] = useState(1)
  const [target, setTarget] = useState<User | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const rows = s.users.filter(u => (role === "all" || u.role === role) && (!q.trim() || [u.name, u.email].some(x => x.toLowerCase().includes(q.trim().toLowerCase()))))
  const toggle = async () => {
    if (!target) return
    setBusy(true); setError("")
    try { await request(() => setUserStatus(target.email, target.status === "active" ? "suspended" : "active", user.name)); show(target.status === "active" ? `${target.name} suspended` : `${target.name} reactivated`); setTarget(null) }
    catch { setError("Network error. The change was not saved. Try again.") }
    setBusy(false)
  }
  return (
    <>
      <Crumbs items={[["Admin", "#admin"], ["Users"]]} />
      <div className="sl-page-head"><div><h1>Users</h1><p>Suspend or reactivate buyer and seller accounts. Admin accounts can't be changed here.</p></div></div>
      <section className="sl-card">
        <div className="pt-toolbar">
          <label className="pt-search"><Icon name="search" size={16} /><input value={q} onChange={e => { setQ(e.target.value); setPage(1) }} placeholder="Search by name or email" aria-label="Search users" /></label>
          <select className="pt-select" value={role} onChange={e => { setRole(e.target.value); setPage(1) }} aria-label="Filter by role"><option value="all">All roles</option><option>Buyer</option><option>Seller</option><option>Admin</option></select>
        </div>
        {loading ? <Skeleton /> : rows.length === 0 ? <StateBlock icon="search" tone="info" title="No users found" body="No accounts match your search and filter." actions={<button className="sl-btn sl-btn-ghost" onClick={() => { setQ(""); setRole("all") }}>Reset filters</button>} /> : (
          <div className="sl-table-wrap"><table className="sl-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th><th>Listings</th><th /></tr></thead><tbody>
            {rows.slice((page - 1) * 6, page * 6).map(u => (
              <tr key={u.email}>
                <td><b>{u.name}</b><br /><small className="pt-mini">{u.email}</small></td><td>{u.role}</td>
                <td><StatusBadge kind={u.status === "active" ? "active" : "failed"} label={u.status === "active" ? "Active" : "Suspended"} /></td>
                <td>{u.joined}</td><td>{u.role === "Seller" ? s.listings.filter(l => l.owner === u.email).length : "—"}</td>
                <td>{u.role === "Admin" ? <span className="pt-mini">Protected</span> : <button className={`sl-btn ${u.status === "active" ? "sl-btn-outline-danger" : "sl-btn-ghost"}`} style={{ height: 36 }} onClick={() => setTarget(u)}>{u.status === "active" ? "Suspend" : "Reactivate"}</button>}</td>
              </tr>
            ))}
          </tbody></table></div>
        )}
        {!loading && rows.length > 0 && <Pager page={page} size={6} total={rows.length} onPage={setPage} />}
      </section>
      {target && <ConfirmDialog danger={target.status === "active"} busy={busy} error={error} onCancel={() => setTarget(null)} onConfirm={toggle}
        title={target.status === "active" ? `Suspend ${target.name}?` : `Reactivate ${target.name}?`}
        body={target.status === "active" ? "They will be signed out and unable to sign in until reactivated. Their live listings stay visible unless you take them down." : "They will be able to sign in again."}
        confirmLabel={target.status === "active" ? "Suspend account" : "Reactivate"} />}
    </>
  )
}

function ActivityLog() {
  const s = useStore()
  const loading = useLoading(400)
  const [role, setRole] = useState("all")
  const [page, setPage] = useState(1)
  const rows = s.activity.filter(a => role === "all" || a.role === role)
  return (
    <>
      <Crumbs items={[["Admin", "#admin"], ["Activity Log"]]} />
      <div className="sl-page-head"><div><h1>Activity log</h1><p>A record of every important action on the platform.</p></div></div>
      <section className="sl-card">
        <div className="pt-toolbar"><select className="pt-select" value={role} onChange={e => { setRole(e.target.value); setPage(1) }} aria-label="Filter by role"><option value="all">All roles</option><option>Admin</option><option>Seller</option><option>Buyer</option></select></div>
        {loading ? <Skeleton /> : rows.length === 0 ? <StateBlock icon="activity" tone="info" title="No activity yet" body="Actions taken by users and admins will be recorded here." /> :
          <div className="sl-table-wrap"><table className="sl-table"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Item</th></tr></thead><tbody>
            {rows.slice((page - 1) * 8, page * 8).map(a => <tr key={a.id}><td title={fmtDate(a.at)}>{timeAgo(a.at)}</td><td><b>{a.actor}</b><br /><small className="pt-mini">{a.role}</small></td><td>{a.action}</td><td>{a.target ? (a.link ? <a className="sl-link" href={a.link}>{a.target}</a> : a.target) : "—"}</td></tr>)}
          </tbody></table></div>}
        {!loading && rows.length > 0 && <Pager page={page} size={8} total={rows.length} onPage={setPage} />}
      </section>
    </>
  )
}

const MATRIX: [string, string, Perm][] = [
  ["Browse marketplace", "View", "market.view"], ["Place orders", "Create", "order.create"], ["View own orders", "View", "order.view"],
  ["Create listings", "Create", "listing.create"], ["Edit own listings", "Edit", "listing.edit"], ["Delete own listings", "Delete", "listing.delete"], ["Submit listings for review", "Create", "listing.submit"], ["Pause / resume live listings", "Edit", "listing.pause"],
  ["Open moderation queue", "View", "listing.review"], ["Approve listings", "Approve", "listing.approve"], ["Reject / request changes", "Reject", "listing.reject"], ["Take down live listings", "Manage", "listing.takedown"],
  ["View users", "View", "user.view"], ["Suspend / reactivate users", "Manage", "user.manage"], ["View platform activity", "View", "activity.all"], ["Edit own profile", "Edit", "profile.edit"],
]
function Roles() {
  return (
    <>
      <Crumbs items={[["Admin", "#admin"], ["Roles & Permissions"]]} />
      <div className="sl-page-head"><div><h1>Roles &amp; permissions</h1><p>What each role can do. These rules are enforced on every page and action.</p></div></div>
      <section className="sl-card"><div className="sl-table-wrap"><table className="sl-table pt-perm"><thead><tr><th>Capability</th><th>Type</th><th>Buyer</th><th>Seller</th><th>Admin</th></tr></thead><tbody>
        {MATRIX.map(([label, kind, p]) => <tr key={p}><td>{label}</td><td className="pt-mini">{kind}</td>{(["Buyer", "Seller", "Admin"] as const).map(r => <td key={r}>{PERMS[r].includes(p) ? <span className="pt-yes" aria-label="Allowed">✓</span> : <span className="pt-no" aria-label="Not allowed">—</span>}</td>)}</tr>)}
      </tbody></table></div></section>
    </>
  )
}

