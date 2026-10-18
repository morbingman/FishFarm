import { useState, type FormEvent } from "react"
import type { Lang } from "./i18n"
import { PortalShell, Icon, StateBlock, Banner, ConfirmDialog, Crumbs, Pager, Skeleton, useLoading, useToast, useHash, NotifItem, openNotif } from "./ui"
import { fmtDate, forceExpire, isOffline, markAllRead, markRead, notifsFor, removeNotif, request, resetDemoData, setOffline, setUserStatus, signOut, timeAgo, updateUser, useStore, type NotifType, type User } from "./store"
import { portalVi } from "./portal-vi"

export default function Account({ user, language, setLanguage }: { user: User; language: Lang; setLanguage: (l: Lang) => void }) {
  const { parts } = useHash()
  const [toast, show] = useToast()
  const sec = parts[1] ?? "profile"
  const body = sec === "profile" ? <Profile user={user} show={show} />
    : sec === "settings" ? <Settings user={user} language={language} setLanguage={setLanguage} show={show} />
      : sec === "notifications" ? <Notifications user={user} language={language} />
        : sec === "activity" ? <History user={user} />
          : <StateBlock card icon="search" tone="info" title="Page not found" body="This account page doesn't exist." actions={<a className="sl-btn sl-btn-primary" href="#account/profile">Go to profile</a>} />
  const unread = notifsFor(useStore(), user).filter(n => !n.read).length
  return <PortalShell user={user} active={`#account/${sec}`} language={language} setLanguage={setLanguage} dict={portalVi} badges={{ "#account/notifications": unread }} toast={toast}>{body}</PortalShell>
}

const Req = () => <b className="pt-req" aria-hidden>*</b>
const Opt = () => <span className="pt-opt">Optional</span>

function Profile({ user, show }: { user: User; show: (m: string) => void }) {
  const loading = useLoading(400)
  const [f, setF] = useState({ name: user.name, phone: user.phone, location: user.location, store: user.store ?? "" })
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const dirty = f.name !== user.name || f.phone !== user.phone || f.location !== user.location || f.store !== (user.store ?? "")
  const errs: Record<string, string> = {}
  if (!f.name.trim()) errs.name = "Enter your name."
  if (f.phone && !/^\+?[\d\s()-]{7,20}$/.test(f.phone)) errs.phone = "Enter a valid phone number."
  if (!f.location.trim()) errs.location = "Enter your location."
  if (user.role === "Seller" && !f.store.trim()) errs.store = "Enter your store name."
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF(x => ({ ...x, [k]: e.target.value })); setSaved(false) }
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setTried(true); setError("")
    if (Object.keys(errs).length || busy) return
    setBusy(true)
    try {
      await request(() => updateUser(user.email, { name: f.name.trim(), phone: f.phone.trim(), location: f.location.trim(), ...(user.role === "Seller" ? { store: f.store.trim() } : {}) }))
      setSaved(true); show("Profile updated")
    } catch (x) { setError((x as Error).message === "expired" ? "Your session expired. Sign in again." : "Network error. Your changes were not saved. Try again.") }
    setBusy(false)
  }
  const field = (k: keyof typeof f, label: string, opts: { req?: boolean; type?: string; hint?: string } = {}) => (
    <label className={`sl-field ${tried && errs[k] ? "bad" : ""}`}><span>{label}{opts.req ? <Req /> : <Opt />}</span>
      <input value={f[k]} onChange={set(k)} type={opts.type ?? "text"} aria-invalid={!!(tried && errs[k])} />
      {tried && errs[k] ? <em>{errs[k]}</em> : opts.hint ? <small style={{ textAlign: "left" }}>{opts.hint}</small> : null}</label>
  )
  return (
    <>
      <Crumbs items={[["Account", "#account/profile"], ["Profile"]]} />
      <div className="sl-page-head"><div><h1>Profile</h1><p>Your personal details and public information.</p></div></div>
      <section className="sl-card pad">
        {loading ? <Skeleton rows={5} /> : (
          <form className="pt-form" onSubmit={submit} noValidate>
            {error && <Banner tone="error" action={<button type="button" onClick={submit as never}>Retry</button>}>{error}</Banner>}
            {saved && !dirty && <Banner tone="ok">Your profile was saved.</Banner>}
            <label className="sl-field"><span>Email<span className="pt-opt">Can't be changed</span></span><input value={user.email} disabled /><small style={{ textAlign: "left" }}>Role: {user.role}. Member since {user.joined}.</small></label>
            {field("name", user.role === "Seller" ? "Contact name" : "Full name", { req: true })}
            {user.role === "Seller" && field("store", "Store name", { req: true, hint: "Shown to buyers on every listing." })}
            <div className="row2">{field("phone", "Phone", { type: "tel" })}{field("location", "Location", { req: true })}</div>
            <div className="sl-row" style={{ display: "flex", gap: 10 }}>
              <button className="sl-btn sl-btn-primary" type="submit" disabled={busy || !dirty}>{busy ? <><span className="pt-spin" />Saving…</> : "Save changes"}</button>
              <button className="sl-btn sl-btn-ghost" type="button" disabled={busy || !dirty} onClick={() => { setF({ name: user.name, phone: user.phone, location: user.location, store: user.store ?? "" }); setTried(false) }}>Discard</button>
            </div>
          </form>
        )}
      </section>
    </>
  )
}

function Toggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return <div className="pt-toggle"><div><b>{label}</b><span>{hint}</span></div><button type="button" role="switch" aria-checked={on} aria-label={label} className="pt-switch" onClick={() => onChange(!on)} /></div>
}

function Settings({ user, language, setLanguage, show }: { user: User; language: Lang; setLanguage: (l: Lang) => void; show: (m: string) => void }) {
  const loading = useLoading(400)
  const [pw, setPw] = useState({ cur: "", next: "", confirm: "" })
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [offline, setOff] = useState(isOffline())
  const [deact, setDeact] = useState(false)
  const errs: Record<string, string> = {}
  if (!pw.cur) errs.cur = "Enter your current password."
  else if (pw.cur !== user.password) errs.cur = "Current password is incorrect."
  if (pw.next.length < 8 || !/[A-Z]/.test(pw.next) || !/\d/.test(pw.next)) errs.next = "Use 8+ characters, an uppercase letter, and a number."
  else if (pw.next === pw.cur) errs.next = "Choose a password you haven't used before."
  if (pw.confirm !== pw.next) errs.confirm = "Your passwords don't match."
  const change = async (e: FormEvent) => {
    e.preventDefault(); setTried(true); setError("")
    if (Object.keys(errs).length || busy) return
    setBusy(true)
    try { await request(() => updateUser(user.email, { password: pw.next })); setPw({ cur: "", next: "", confirm: "" }); setTried(false); show("Password changed") }
    catch (x) { setError((x as Error).message === "expired" ? "Your session expired. Sign in again." : "Network error. Your password was not changed. Try again.") }
    setBusy(false)
  }
  const pf = (k: keyof typeof pw, label: string) => (
    <label className={`sl-field ${tried && errs[k] ? "bad" : ""}`}><span>{label}<Req /></span>
      <input type="password" value={pw[k]} onChange={e => setPw(x => ({ ...x, [k]: e.target.value }))} autoComplete={k === "cur" ? "current-password" : "new-password"} aria-invalid={!!(tried && errs[k])} />
      {tried && errs[k] && <em>{errs[k]}</em>}</label>
  )
  const setPref = (k: keyof User["prefs"]) => (v: boolean) => { updateUser(user.email, { prefs: { ...user.prefs, [k]: v } }); show("Preference saved") }
  return (
    <>
      <Crumbs items={[["Account", "#account/profile"], ["Account Settings"]]} />
      <div className="sl-page-head"><div><h1>Account settings</h1><p>Security, notifications and preferences.</p></div></div>
      {loading ? <section className="sl-card pad"><Skeleton rows={6} /></section> : (
        <div style={{ display: "grid", gap: 20 }}>
          <section className="sl-card pad"><h3>Language</h3>
            <div className="pt-form"><label className="sl-field"><span>Display language</span><select value={language} onChange={e => { setLanguage(e.target.value as Lang); show(e.target.value === "vi" ? "Đã chuyển sang Tiếng Việt" : "Switched to English") }}><option value="en">English</option><option value="vi">Tiếng Việt</option></select></label></div>
          </section>
          <section className="sl-card pad"><h3>Change password</h3>
            <form className="pt-form" onSubmit={change} noValidate>
              {error && <Banner tone="error">{error}</Banner>}
              {pf("cur", "Current password")}{pf("next", "New password")}{pf("confirm", "Confirm new password")}
              <div><button className="sl-btn sl-btn-primary" type="submit" disabled={busy}>{busy ? <><span className="pt-spin" />Updating…</> : "Update password"}</button></div>
            </form>
          </section>
          <section className="sl-card pad"><h3>Notification preferences</h3>
            <Toggle label="Status updates" hint="When your listings or orders change status." on={user.prefs.status} onChange={setPref("status")} />
            <Toggle label="Reminders" hint="Nudges about pending reviews and unfinished drafts." on={user.prefs.reminders} onChange={setPref("reminders")} />
            <Toggle label="System announcements" hint="Product news and policy changes." on={user.prefs.system} onChange={setPref("system")} />
            <p className="pt-mini" style={{ marginTop: 12 }}>Approval, rejection and security notifications can't be turned off.</p>
          </section>
          <section className="sl-card pad"><h3>Prototype tools</h3>
            <Toggle label="Simulate network failure" hint="Saving, submitting and approving will fail so you can see the error and retry states." on={offline} onChange={v => { setOffline(v); setOff(v); show(v ? "Network failure simulation on" : "Back online") }} />
            <div className="pt-toggle"><div><b>Expire my session now</b><span>Shows the session-expired screen you'd see after 15 minutes idle.</span></div><button className="sl-btn sl-btn-ghost" onClick={() => { forceExpire(); window.location.hash = "expired" }}>Expire</button></div>
            <div className="pt-toggle" style={{ borderBottom: 0 }}><div><b>Reset demo data</b><span>Restore all listings, users and notifications to their starting state.</span></div><button className="sl-btn sl-btn-ghost" onClick={() => { resetDemoData(); show("Demo data reset") }}>Reset</button></div>
          </section>
          {user.role !== "Admin" && (
            <section className="pt-danger-zone"><h3 style={{ margin: "0 0 6px", color: "var(--danger)" }}>Deactivate account</h3>
              <p className="pt-mini" style={{ marginBottom: 14 }}>You'll be signed out immediately and won't be able to sign in until an admin reactivates your account.</p>
              <button className="sl-btn sl-btn-outline-danger" onClick={() => setDeact(true)}>Deactivate my account</button></section>
          )}
        </div>
      )}
      {deact && <ConfirmDialog danger requireText="DEACTIVATE" title="Deactivate your account?" body="This signs you out right away. Contact support or an admin to get access back." confirmLabel="Deactivate account" onCancel={() => setDeact(false)}
        onConfirm={() => { setUserStatus(user.email, "suspended", user.name); signOut("Your account was deactivated.") }} />}
    </>
  )
}

const TYPES: [string, string][] = [["all", "All types"], ["approval", "Approvals"], ["status", "Status changes"], ["success", "Success"], ["error", "Errors"], ["reminder", "Reminders"], ["system", "System"]]
function Notifications({ user, language }: { user: User; language: Lang }) {
  const s = useStore()
  const loading = useLoading(400)
  const [tab, setTab] = useState<"all" | "unread">("all")
  const [type, setType] = useState("all")
  const [page, setPage] = useState(1)
  const mine = notifsFor(s, user)
  const rows = mine.filter(n => (tab === "all" || !n.read) && (type === "all" || n.type === (type as NotifType)))
  const unread = mine.filter(n => !n.read)
  return (
    <>
      <Crumbs items={[["Account", "#account/profile"], ["Notifications"]]} />
      <div className="sl-page-head"><div><h1>Notifications</h1><p>Every update that needs your attention links straight to the right page.</p></div>
        <button className="sl-btn sl-btn-ghost" disabled={!unread.length} onClick={() => markAllRead(unread.map(n => n.id))}>Mark all as read</button></div>
      <section className="sl-card">
        <div className="pt-tabs"><button className={tab === "all" ? "on" : ""} onClick={() => { setTab("all"); setPage(1) }}>All<em>{mine.length}</em></button><button className={tab === "unread" ? "on" : ""} onClick={() => { setTab("unread"); setPage(1) }}>Unread<em>{unread.length}</em></button></div>
        <div className="pt-toolbar"><select className="pt-select" value={type} onChange={e => { setType(e.target.value); setPage(1) }} aria-label="Filter by type">{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        {loading ? <Skeleton /> : rows.length === 0 ? <StateBlock icon="inbox" tone="info" title={mine.length ? "No notifications match" : "You're all caught up"} body={mine.length ? "Try a different filter." : "Status changes, approvals and reminders will appear here."} actions={mine.length ? <button className="sl-btn sl-btn-ghost" onClick={() => { setTab("all"); setType("all") }}>Clear filters</button> : undefined} /> :
          <div>{rows.slice((page - 1) * 8, page * 8).map(n => (
            <div key={n.id} style={{ display: "flex", alignItems: "stretch" }}>
              <div style={{ flex: 1 }}><NotifItem n={n} vi={language === "vi"} onGo={openNotif} /></div>
              <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "0 14px", borderBottom: "1px solid #edf1f4" }}>
                <button className="pt-iconbtn" style={{ width: 34, height: 34 }} title={n.read ? "Mark as unread" : "Mark as read"} aria-label={n.read ? "Mark as unread" : "Mark as read"} onClick={() => markRead(n.id, !n.read)}><Icon name={n.read ? "eye" : "check"} size={15} /></button>
                <button className="pt-iconbtn" style={{ width: 34, height: 34 }} title="Delete" aria-label="Delete notification" onClick={() => removeNotif(n.id)}><Icon name="trash" size={15} /></button>
              </div>
            </div>))}</div>}
        {!loading && rows.length > 0 && <Pager page={page} size={8} total={rows.length} onPage={setPage} />}
      </section>
    </>
  )
}

function History({ user }: { user: User }) {
  const s = useStore()
  const loading = useLoading(400)
  const [page, setPage] = useState(1)
  const rows = s.activity.filter(a => a.actor === user.name && a.role === user.role)
  return (
    <>
      <Crumbs items={[["Account", "#account/profile"], ["Activity History"]]} />
      <div className="sl-page-head"><div><h1>Activity history</h1><p>A record of your important actions.</p></div></div>
      <section className="sl-card">
        {loading ? <Skeleton /> : rows.length === 0 ? <StateBlock icon="activity" tone="info" title="No activity yet" body="When you submit listings, change settings or sign out, it will be recorded here." actions={<a className="sl-btn sl-btn-primary" href={user.role === "Seller" ? "#seller/add" : user.role === "Admin" ? "#admin" : "#marketplace"}>Get started</a>} /> :
          <div className="sl-table-wrap"><table className="sl-table"><thead><tr><th>When</th><th>Action</th><th>Item</th></tr></thead><tbody>
            {rows.slice((page - 1) * 8, page * 8).map(a => <tr key={a.id}><td title={fmtDate(a.at)}>{timeAgo(a.at)}</td><td>{a.action}</td><td>{a.target ? (a.link ? <a className="sl-link" href={a.link}>{a.target}</a> : a.target) : "—"}</td></tr>)}
          </tbody></table></div>}
        {!loading && rows.length > 0 && <Pager page={page} size={8} total={rows.length} onPage={setPage} />}
      </section>
    </>
  )
}

