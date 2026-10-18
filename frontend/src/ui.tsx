import { useEffect, useRef, useState, type ReactNode } from "react"
import "./seller.css"
import "./ui.css"
import "./design-system.css"
import { SiteHeader, SiteFooter } from "./SiteHeader"
import { LangSwitch, useDomTranslation, type Lang } from "./i18n"
import { markAllRead, markRead, notifsFor, signOut, timeAgo, useStore, type LStatus, type Notif, type Role, type User } from "./store"

export type IconName = "bell" | "user" | "gear" | "list" | "dash" | "shield" | "users" | "clock" | "check" | "x" | "alert" | "search" | "logout" | "arrow" | "left" | "plus" | "fish" | "activity" | "lock" | "inbox" | "bag" | "chart" | "store" | "msg" | "star" | "swap" | "eye" | "edit" | "trash" | "pause" | "play"
const ICONS: Record<IconName, ReactNode> = {
  bell: <path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.6-4.5 4-7 8-7s7.400 2.500 8 7" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  dash: <path d="M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z" />,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" /><path d="m8.500 12 2.500 2.500 4.500-5" /></>,
  users: <><circle cx="9" cy="8" r="3.500" /><path d="M2.500 20c.5-4 3-6 6.500-6s6 2 6.500 6M16 4.500a3.500 3.500 0 0 1 0 7M18 14c2 .6 3.300 2.400 3.500 5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  check: <path d="m5 12 4.500 4.500L19 7" />,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  alert: <><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h.01" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.500-3.500" /></>,
  logout: <path d="M10 4H5v16h5M16 8l4 4-4 4M20 12H9" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  left: <path d="m15 5-7 7 7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  fish: <><path d="M3 12s4-6 10-6c4 0 8 6 8 6s-4 6-8 6c-6 0-10-6-10-6zm0 0L1 7v10z" /><circle cx="16" cy="11" r="1" /></>,
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  inbox: <path d="M3 13h5l1 3h6l1-3h5M5 5h14l2 8v6H3v-6z" />,
  bag: <><path d="M5 7h14l1.500 14h-17z" /><path d="M8 9V6a4 4 0 0 1 8 0v3" /></>,
  chart: <path d="M4 20V4M4 20h16M8 16v-5M13 16V8M18 16v-3" />,
  store: <path d="M3 9l1.500-5h15L21 9M3 9v1a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9M5 13v8h14v-8M10 21v-5h4v5" />,
  msg: <path d="M21 14a3 3 0 0 1-3 3H9l-5 4V6a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3z" />,
  star: <path d="m12 3 2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.9z" />,
  swap: <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.500 6.500l4 4" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  pause: <path d="M8 5v14M16 5v14" />,
  play: <path d="m7 4 13 8-13 8z" />,
}
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>
}

export const go = (hash: string) => { window.location.hash = hash.replace(/^#/, "") }
export const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase()

export const STATUS_LABEL: Record<LStatus, string> = { draft: "Draft", pending: "Pending Review", approved: "Live", changes: "Changes Requested", rejected: "Rejected", paused: "Paused" }
export type StatusKind = "pending" | "approved" | "rejected" | "processing" | "completed" | "cancelled" | "failed" | "active" | "inactive" | "draft"
const KIND_LABEL: Record<StatusKind, string> = { pending: "Pending", approved: "Approved", rejected: "Rejected", processing: "Processing", completed: "Completed", cancelled: "Cancelled", failed: "Failed", active: "Active", inactive: "Inactive", draft: "Draft" }
const KIND_TONE: Record<StatusKind, string> = { pending: "warn", approved: "ok", rejected: "bad", processing: "info", completed: "ok", cancelled: "muted", failed: "bad", active: "ok", inactive: "muted", draft: "muted" }
export function StatusBadge({ kind, label }: { kind: StatusKind; label?: string }) {
  return <span className={`ds-badge ds-badge-${KIND_TONE[kind]}`}><i />{label ?? KIND_LABEL[kind]}</span>
}
const LSTATUS_KIND: Record<LStatus, StatusKind> = { draft: "draft", pending: "pending", approved: "approved", changes: "pending", rejected: "rejected", paused: "inactive" }
export function StatusChip({ s }: { s: LStatus }) {
  return <StatusBadge kind={LSTATUS_KIND[s]} label={STATUS_LABEL[s]} />
}

/* ---------- toast ---------- */
export function useToast(): [ReactNode, (m: string) => void] {
  const [msg, setMsg] = useState("")
  useEffect(() => { if (!msg) return; const id = setTimeout(() => setMsg(""), 3000); return () => clearTimeout(id) }, [msg])
  return [msg ? <div className="sl-toast" role="status" key="toast">{msg}</div> : null, setMsg]
}

/* ---------- state block (empty / error / denied / expired ...) ---------- */
export function StateBlock({ icon, tone = "ok", title, body, actions, card }: { icon: IconName; tone?: "ok" | "error" | "warn" | "info"; title: string; body: string; actions?: ReactNode; card?: boolean }) {
  return (
    <div className={`pt-state ${card ? "card" : ""}`} role={tone === "error" ? "alert" : "status"}>
      <span className={`pt-state-ic ${tone}`}><Icon name={icon} size={28} /></span>
      <h2>{title}</h2><p>{body}</p>
      {actions && <div className="pt-state-actions">{actions}</div>}
    </div>
  )
}
export function Banner({ tone, children, action }: { tone: "error" | "warn" | "ok" | "info"; children: ReactNode; action?: ReactNode }) {
  return <div className={`pt-banner ${tone}`} role={tone === "error" ? "alert" : "status"}><Icon name={tone === "ok" ? "check" : "alert"} />{<span>{children}</span>}{action}</div>
}
export function Skeleton({ rows = 5 }: { rows?: number }) {
  return <div style={{ padding: 24, display: "grid", gap: 16 }} aria-busy="true" aria-label="Loading">{Array.from({ length: rows }, (_, i) => <div key={i} className="pt-skel" style={{ width: `${95 - i * 9}%` }} />)}</div>
}
export function useLoading(ms = 550) {
  const [loading, setLoading] = useState(true)
  useEffect(() => { const id = setTimeout(() => setLoading(false), ms); return () => clearTimeout(id) }, [ms])
  return loading
}

/* ---------- confirm dialog ---------- */
export function ConfirmDialog({ title, body, confirmLabel, danger, busy, error, requireText, onConfirm, onCancel, children }: {
  title: string; body: string; confirmLabel: string; danger?: boolean; busy?: boolean; error?: string; requireText?: string
  onConfirm: () => void; onCancel: () => void; children?: ReactNode
}) {
  const [typed, setTyped] = useState("")
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    ref.current?.focus()
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onCancel() }
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k)
  }, [busy, onCancel])
  const blocked = busy || (!!requireText && typed.trim() !== requireText)
  return (
    <div className="pt-modal-bg" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onCancel() }}>
      <div className="pt-modal" role="alertdialog" aria-modal="true" aria-label={title}>
        <span className={`pt-modal-ic ${danger ? "danger" : ""}`}><Icon name={danger ? "alert" : "check"} size={22} /></span>
        <h2>{title}</h2><p>{body}</p>
        {requireText && <label className="sl-field"><span>Type <b>{requireText}</b> to confirm</span><input value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" /></label>}
        {children}
        {error && <Banner tone="error">{error}</Banner>}
        <div className="pt-modal-actions">
          <button ref={ref} className="sl-btn sl-btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className={`sl-btn ${danger ? "sl-btn-danger" : "sl-btn-primary"}`} onClick={onConfirm} disabled={blocked}>{busy ? <><span className="pt-spin" />Processing…</> : confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

/* ---------- breadcrumbs / pagination ---------- */
export function Crumbs({ items }: { items: [string, string?][] }) {
  return (
    <nav className="pt-crumbs" aria-label="Breadcrumb">
      {items.map(([label, href], i) => (
        <span key={label + i} style={{ display: "contents" }}>
          {i > 0 && <span aria-hidden>/</span>}
          {href ? <a href={href}>{label}</a> : <span aria-current="page">{label}</span>}
        </span>
      ))}
    </nav>
  )
}
export function Pager({ page, size, total, onPage }: { page: number; size: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size))
  if (total <= size) return <div className="pt-pager"><span>Showing {total} of {total}</span></div>
  return (
    <div className="pt-pager">
      <span>Showing {(page - 1) * size + 1}–{Math.min(total, page * size)} of {total}</span>
      <div>
        <button onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><Icon name="left" size={14} /></button>
        {Array.from({ length: pages }, (_, i) => <button key={i} className={page === i + 1 ? "on" : ""} onClick={() => onPage(i + 1)} aria-current={page === i + 1 ? "page" : undefined}>{i + 1}</button>)}
        <button onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page" style={{ transform: "scaleX(-1)" }}><Icon name="left" size={14} /></button>
      </div>
    </div>
  )
}

/* ---------- notifications ---------- */
const NIC: Record<Notif["type"], IconName> = { success: "check", error: "alert", system: "shield", status: "activity", approval: "check", reminder: "clock" }
export function NotifItem({ n, vi, onGo }: { n: Notif; vi: boolean; onGo: (n: Notif) => void }) {
  return (
    <button className={`pt-notif ${n.read ? "" : "unread"}`} onClick={() => onGo(n)}>
      <span className={`pt-notif-ic ${n.type}`}><Icon name={NIC[n.type]} size={16} /></span>
      <div><b>{n.title}</b><span>{n.body}</span><small>{timeAgo(n.at, vi)}</small></div>
    </button>
  )
}
export const openNotif = (n: Notif) => { markRead(n.id); go(n.link) }

function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const d = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", d); document.addEventListener("keydown", k)
    return () => { document.removeEventListener("mousedown", d); document.removeEventListener("keydown", k) }
  }, [open])
  return { open, setOpen, ref }
}

export function NotifBell({ user, language }: { user: User; language: Lang }) {
  const s = useStore()
  const { open, setOpen, ref } = usePopover()
  const mine = notifsFor(s, user)
  const unread = mine.filter(n => !n.read)
  return (
    <div className="pt-bell" ref={ref}>
      <button className="pt-iconbtn" onClick={() => setOpen(!open)} aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ""}`} aria-expanded={open}>
        <Icon name="bell" />{unread.length > 0 && <span className="pt-badge">{unread.length > 9 ? "9+" : unread.length}</span>}
      </button>
      {open && (
        <div className="pt-pop" role="dialog" aria-label="Notifications">
          <div className="pt-pop-head"><b>Notifications</b><button className="sl-link" disabled={!unread.length} onClick={() => markAllRead(unread.map(n => n.id))}>Mark all as read</button></div>
          <div className="pt-pop-list">
            {mine.length === 0 ? <StateBlock icon="inbox" tone="info" title="You're all caught up" body="Status changes, approvals and reminders will show up here." /> :
              mine.slice(0, 6).map(n => <NotifItem key={n.id} n={n} vi={language === "vi"} onGo={x => { setOpen(false); openNotif(x) }} />)}
          </div>
          <div className="pt-pop-foot"><button className="sl-link" onClick={() => { setOpen(false); go("account/notifications") }}>View all notifications</button></div>
        </div>
      )}
    </div>
  )
}

export function UserMenu({ user, dark }: { user: User; dark?: boolean }) {
  const { open, setOpen, ref } = usePopover()
  return (
    <div className="pt-bell" ref={ref}>
      <button className="pt-avatar-btn" onClick={() => setOpen(!open)} aria-label="Account menu" aria-expanded={open}><span className={`sl-avatar ${dark ? "light" : ""}`}>{initials(user.name)}</span></button>
      {open && (
        <div className="pt-menu" role="menu">
          <div className="pt-menu-head"><b>{user.name}</b><small>{user.role} · {user.email}</small></div>
          <button onClick={() => { setOpen(false); go("account/profile") }}><Icon name="user" size={16} />Profile</button>
          <button onClick={() => { setOpen(false); go("account/settings") }}><Icon name="gear" size={16} />Account settings</button>
          <button onClick={() => { setOpen(false); go("account/notifications") }}><Icon name="bell" size={16} />Notifications</button>
          <button onClick={() => { setOpen(false); signOut("Signed out. Sign in with another demo account to continue.") }}><Icon name="swap" size={16} />Switch account</button>
          <button className="danger" onClick={() => { setOpen(false); signOut() }}><Icon name="logout" size={16} />Sign out</button>
        </div>
      )}
    </div>
  )
}

/* ---------- portal shell (Admin + Account) ---------- */
export type NavItem = { label: string; href: string; icon: IconName; badge?: number }
const ROLE_NAV: Record<Role, NavItem[]> = {
  Buyer: [{ label: "Marketplace", href: "#marketplace", icon: "fish" }],
  Seller: [{ label: "Dashboard", href: "#seller", icon: "dash" }, { label: "My Listings", href: "#seller/listings", icon: "list" }, { label: "Add New Fish", href: "#seller/add", icon: "plus" }, { label: "Orders", href: "#seller/orders", icon: "bag" }, { label: "Customers", href: "#seller/customers", icon: "users" }, { label: "Messages", href: "#seller/messages", icon: "msg" }, { label: "Analytics", href: "#seller/analytics", icon: "chart" }, { label: "Reviews", href: "#seller/reviews", icon: "star" }],
  Admin: [{ label: "Overview", href: "#admin", icon: "dash" }, { label: "Moderation Queue", href: "#admin/queue", icon: "shield" }, { label: "Users", href: "#admin/users", icon: "users" }, { label: "Activity Log", href: "#admin/activity", icon: "activity" }, { label: "Roles & Permissions", href: "#admin/roles", icon: "lock" }],
}
const ACCOUNT_NAV: NavItem[] = [{ label: "Profile", href: "#account/profile", icon: "user" }, { label: "Account Settings", href: "#account/settings", icon: "gear" }, { label: "Notifications", href: "#account/notifications", icon: "bell" }, { label: "Activity History", href: "#account/activity", icon: "activity" }]

export function PortalShell({ user, active, language, setLanguage, dict, children, badges, toast }: {
  user: User; active: string; language: Lang; setLanguage: (l: Lang) => void; dict: Record<string, string>
  children: ReactNode; badges?: Record<string, number>; toast?: ReactNode
}) {
  useDomTranslation(language, dict)
  const nav = ROLE_NAV[user.role]
  const Item = (n: NavItem) => (
    <a key={n.href} href={n.href} className={active === n.href ? "on" : ""} aria-current={active === n.href ? "page" : undefined}>
      <Icon name={n.icon} /><span className="pt-nav-label">{n.label}</span>{badges?.[n.href] ? <b className="pt-nav-badge">{badges[n.href]}</b> : null}
    </a>
  )
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("fishmarket-side") === "1")
  const toggle = () => setCollapsed(c => { localStorage.setItem("fishmarket-side", c ? "0" : "1"); return !c })
  return (
    <div className={`sl-app pt-app ${collapsed ? "side-collapsed" : ""}`}>
      <SiteHeader language={language} setLanguage={setLanguage} />
      <div className="sl-layout">
        <aside className="sl-side">
          <nav className="pt-sidenav" aria-label="Main">
            <small className="pt-nav-title">{user.role === "Admin" ? "Manage" : "Workspace"}</small>
            {nav.map(Item)}
            <small className="pt-nav-title">Account</small>
            {ACCOUNT_NAV.map(Item)}
          </nav>
          <div className="pt-side-foot">
            <div className="sl-side-card"><Icon name="shield" /><b>{user.store || user.name}</b><small>{user.role}</small></div>
            <button className="pt-collapse" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={collapsed}><Icon name="left" size={16} /></button>
          </div>
        </aside>
        <main className="sl-main">{children}<SiteFooter language={language} /></main>
      </div>
      {toast}
    </div>
  )
}

/* ---------- full-page states ---------- */
export function FullState({ children }: { children: ReactNode }) { return <div className="pt-fullpage sl-app">{children}</div> }

export function AccessDenied({ user, needs, language, setLanguage }: { user: User; needs: string; language: Lang; setLanguage: (l: Lang) => void }) {
  useDomTranslation(language, { "Access denied": "Truy cập bị từ chối", "Go to my dashboard": "Về trang của tôi", "Switch account": "Đổi tài khoản", "Back to homepage": "Về trang chủ" })
  const home = user.role === "Seller" ? "#seller" : user.role === "Admin" ? "#admin" : "#marketplace"
  return (
    <FullState>
      <SiteHeader language={language} setLanguage={setLanguage} />
      <div className="pt-fullbody">      <StateBlock icon="lock" tone="error" title="Access denied" body={`This area is only available to ${needs} accounts. You are signed in as ${user.name} (${user.role}), which doesn't have permission to view it.`}
        actions={<>
          <a className="sl-btn sl-btn-primary" href={home}>Go to my dashboard</a>
          <button className="sl-btn sl-btn-ghost" onClick={() => signOut("Signed out. Sign in with a different account.")}>Switch account</button>
          <a className="sl-btn sl-btn-ghost" href="#home">Back to homepage</a>
        </>} />
      </div>
    </FullState>
  )
}
export function SessionExpired({ language, setLanguage }: { language: Lang; setLanguage: (l: Lang) => void }) {
  useDomTranslation(language, { "Your session expired": "Phiên đăng nhập đã hết hạn", "Sign in again": "Đăng nhập lại", "Back to homepage": "Về trang chủ" })
  return (
    <FullState>
      <SiteHeader language={language} setLanguage={setLanguage} />
      <div className="pt-fullbody">      <StateBlock icon="clock" tone="warn" title="Your session expired" body="For your security you were signed out after 15 minutes of inactivity. Anything you hadn't saved may need to be redone. Sign in again to pick up where you left off."
        actions={<><a className="sl-btn sl-btn-primary" href="#login">Sign in again</a><a className="sl-btn sl-btn-ghost" href="#home">Back to homepage</a></>} />
      </div>
    </FullState>
  )
}
export function NotFound({ language, setLanguage, home }: { language: Lang; setLanguage: (l: Lang) => void; home: string }) {
  useDomTranslation(language, { "Page not found": "Không tìm thấy trang", "Go back": "Quay lại", "Take me home": "Về trang chủ" })
  return (
    <FullState>
      <SiteHeader language={language} setLanguage={setLanguage} />
      <div className="pt-fullbody">      <StateBlock icon="search" tone="info" title="Page not found" body="The page you're looking for doesn't exist or has been moved. Check the address, or head back to somewhere familiar."
        actions={<><button className="sl-btn sl-btn-ghost" onClick={() => window.history.back()}>Go back</button><a className="sl-btn sl-btn-primary" href={home}>Take me home</a></>} />
      </div>
    </FullState>
  )
}

export function useHash() {
  const [h, setH] = useState(() => window.location.hash)
  useEffect(() => { const f = () => setH(window.location.hash); window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f) }, [])
  const [path, query = ""] = h.replace(/^#/, "").split("?")
  return { hash: h, parts: path.split("/").filter(Boolean), params: new URLSearchParams(query) }
}
