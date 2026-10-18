import { useSyncExternalStore } from "react"

export type Role = "Buyer" | "Seller" | "Admin"
export type LStatus = "draft" | "pending" | "approved" | "changes" | "rejected" | "paused"
export type Img = { id: string; url: string }
export type Draft = {
  name: string; species: string; breed: string; description: string
  age: string; size: string; gender: string; origin: string; health: string
  price: string; quantity: string; negotiable: boolean
  images: Img[]; mainId: string
  location: string; region: string; shipping: string[]
}
export type Decision = { kind: "rejected" | "changes"; reason: string; feedback: string; step: number; by: string; at: string }
export type HistoryEntry = { at: string; by: string; action: string; note?: string }
export type Listing = {
  id: string; owner: string; sellerName: string; status: LStatus; draft: Draft; decision: Decision | null
  createdAt: string; updatedAt: string; submittedAt: string | null; views: number; history: HistoryEntry[]
}
export type User = {
  email: string; password: string; name: string; role: Role; status: "active" | "suspended"
  phone: string; location: string; joined: string; store?: string; prefs: { status: boolean; system: boolean; reminders: boolean }
}
export type NotifType = "success" | "error" | "system" | "status" | "approval" | "reminder"
export type Notif = { id: string; to: string; type: NotifType; title: string; body: string; link: string; at: string; read: boolean }
export type Activity = { id: string; actor: string; role: Role | "System"; action: string; target?: string; link?: string; at: string }
type State = { users: User[]; listings: Listing[]; deleted: string[]; notifs: Notif[]; activity: Activity[]; seq: number }

const PH = (id: string, i: number): Img => ({ id: `p${i}`, url: `https://images.unsplash.com/${id}?w=1000&h=750&fit=crop&auto=format` })
const P = [
  "photo-1516408388733-2f8364f2e00b", "photo-1522720833375-9c27ffb02a5e", "photo-1572438131134-ec29490abfba",
  "photo-1640529837996-b81a91eaf7a5", "photo-1663892318998-d4b1a5acde66", "photo-1668349009169-93e19d2eba7a",
].map(PH)
export const SAMPLE_PHOTOS = P

export const EMPTY_DRAFT: Draft = {
  name: "", species: "", breed: "", description: "", age: "", size: "", gender: "", origin: "", health: "",
  price: "", quantity: "1", negotiable: false, images: [], mainId: "", location: "", region: "", shipping: [],
}

const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()
const GK = { email: "seller@fishmarket.demo", name: "Golden Koi Farm" }
const mk = (id: string, owner: { email: string; name: string }, status: LStatus, d: Partial<Draft>, hoursAgo: number, extra: Partial<Listing> = {}): Listing => ({
  id, owner: owner.email, sellerName: owner.name, status, decision: null, views: 0,
  createdAt: ago(hoursAgo + 5), updatedAt: ago(hoursAgo), submittedAt: status === "draft" ? null : ago(hoursAgo + 1),
  draft: {
    ...EMPTY_DRAFT, description: "Healthy, well-conditioned stock raised in clean water and fed a premium diet. Photographed in natural light.",
    age: "12 months", gender: "Female", origin: "Vietnam — farm bred", health: "Excellent — vet certified", quantity: "2",
    location: "128 Nguyen Van Huong, Thao Dien", region: "Ho Chi Minh City", shipping: ["Local pickup", "Domestic overnight"], ...d,
  },
  history: [{ at: ago(hoursAgo + 5), by: owner.name, action: "Created draft" }, ...(status === "draft" ? [] : [{ at: ago(hoursAgo + 1), by: owner.name, action: "Submitted for review" }]), ...(status === "approved" || status === "paused" ? [{ at: ago(hoursAgo), by: "Marketplace Admin", action: "Approved" }] : [])],
  ...extra,
})

function seed(): State {
  const joined = "2024-03-12"
  const u = (email: string, name: string, role: Role, status: User["status"] = "active", password = "Demo1234", store?: string): User => ({
    email, name, role, status, password, phone: "+84 90 123 4567", location: "Ho Chi Minh City", joined, store, prefs: { status: true, system: true, reminders: true },
  })
  const BL = { email: "lagoon@fishmarket.demo", name: "Blue Lagoon Aquatics" }
  const MK = { email: "mekong@fishmarket.demo", name: "Mekong Aroworld" }
  return {
    seq: 48300,
    users: [
      u("buyer@fishmarket.demo", "Alex Nguyen", "Buyer", "active", "Buyer123"),
      u("seller@fishmarket.demo", "Golden Koi Farm", "Seller", "active", "Seller123", "Golden Koi Farm"),
      u("admin@fishmarket.demo", "Marketplace Admin", "Admin", "active", "Admin123"),
      u("lagoon@fishmarket.demo", "Blue Lagoon Aquatics", "Seller", "active", "Demo1234", "Blue Lagoon Aquatics"),
      u("mekong@fishmarket.demo", "Mekong Aroworld", "Seller", "active", "Demo1234", "Mekong Aroworld"),
      u("linh@fishmarket.demo", "Linh Tran", "Buyer"),
      u("minh@fishmarket.demo", "Minh Pham", "Buyer", "suspended"),
    ],
    listings: [
      mk("FM-20817", BL, "pending", { name: "Betta Halfmoon Blue", species: "Betta", breed: "Halfmoon", price: "38", size: "6", images: [P[3]], mainId: "p3" }, 20),
      mk("FM-20803", MK, "pending", { name: "Arowana Silver 28 cm", species: "Arowana", breed: "Silver", price: "260", size: "28", images: [P[4]], mainId: "p4" }, 30),
      mk("FM-19544", GK, "approved", { name: "Kohaku Koi, 40 cm", species: "Koi", breed: "Kohaku", price: "720", size: "40", images: [P[0], P[1]], mainId: "p0" }, 48, { views: 1204 }),
      mk("FM-19102", GK, "approved", { name: "Ginrin Chagoi", species: "Koi", breed: "Chagoi", price: "310", size: "35", images: [P[2]], mainId: "p2" }, 120, { views: 846 }),
      mk("FM-18877", GK, "approved", { name: "Oranda Goldfish Pair", species: "Goldfish", breed: "Oranda", price: "95", size: "12", images: [P[4]], mainId: "p4" }, 170, { views: 512 }),
      mk("FM-18420", BL, "approved", { name: "Discus Pigeon Blood", species: "Discus", breed: "Pigeon Blood", price: "120", size: "14", images: [P[5]], mainId: "p5" }, 300, { views: 233 }),
    ],
    deleted: [],
    notifs: [
      { id: "n1", to: "Admin", type: "reminder", title: "2 listings are waiting for review", body: "Betta Halfmoon Blue and Arowana Silver 28 cm have been in the queue for over 20 hours.", link: "#admin/queue?tab=pending", at: ago(1), read: false },
      { id: "n2", to: "seller@fishmarket.demo", type: "system", title: "Welcome to Seller Center", body: "Create your first listing. Every listing is reviewed by our team before it goes live.", link: "#seller/add", at: ago(72), read: false },
      { id: "n3", to: "buyer@fishmarket.demo", type: "system", title: "Welcome to FISHMARKET", body: "Browse verified sellers and buy with buyer protection.", link: "#marketplace", at: ago(72), read: false },
    ],
    activity: [
      { id: "a1", actor: "Marketplace Admin", role: "Admin", action: "Approved listing", target: "Kohaku Koi, 40 cm", link: "#admin/review/FM-19544", at: ago(48) },
      { id: "a2", actor: "Blue Lagoon Aquatics", role: "Seller", action: "Submitted listing for review", target: "Betta Halfmoon Blue", link: "#admin/review/FM-20817", at: ago(20) },
    ],
  }
}

const KEY = "fishmarket-data-v2"
let state: State = (() => {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) as State } catch { /* ignore corrupt data */ }
  return seed()
})()
const subs = new Set<() => void>()
function commit(next: State) {
  state = next
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* storage full */ }
  subs.forEach(f => f())
}
window.addEventListener("storage", e => { if (e.key === KEY && e.newValue) { state = JSON.parse(e.newValue); subs.forEach(f => f()) } })
export function useStore(): State {
  return useSyncExternalStore(cb => { subs.add(cb); return () => { subs.delete(cb) } }, () => state)
}
export const getState = () => state
export function resetDemoData() { commit(seed()) }

const nid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
const nowISO = () => new Date().toISOString()

export function notify(to: string, type: NotifType, title: string, body: string, link: string) {
  const u = state.users.find(x => x.email === to)
  if (u && ((type === "system" && !u.prefs.system) || (type === "reminder" && !u.prefs.reminders) || (type === "status" && !u.prefs.status))) return
  commit({ ...state, notifs: [{ id: nid("n"), to, type, title, body, link, at: nowISO(), read: false }, ...state.notifs].slice(0, 200) })
}
export function log(actor: string, role: Role | "System", action: string, target?: string, link?: string) {
  commit({ ...state, activity: [{ id: nid("a"), actor, role, action, target, link, at: nowISO() }, ...state.activity].slice(0, 300) })
}
export function markRead(id: string, read = true) { commit({ ...state, notifs: state.notifs.map(n => n.id === id ? { ...n, read } : n) }) }
export function markAllRead(ids: string[]) { commit({ ...state, notifs: state.notifs.map(n => ids.includes(n.id) ? { ...n, read: true } : n) }) }
export function removeNotif(id: string) { commit({ ...state, notifs: state.notifs.filter(n => n.id !== id) }) }
export const notifsFor = (s: State, u: { email: string; role: Role }) => s.notifs.filter(n => n.to === u.email || n.to === u.role)

/* ---------- accounts ---------- */
export const findUser = (email: string) => state.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase())
export function authenticate(email: string, password: string): { ok: true; user: User } | { ok: false; reason: "invalid" | "suspended" } {
  const u = findUser(email)
  if (!u || u.password !== password) return { ok: false, reason: "invalid" }
  if (u.status === "suspended") return { ok: false, reason: "suspended" }
  return { ok: true, user: u }
}
export function addUser(u: Omit<User, "joined" | "status" | "prefs">) {
  commit({ ...state, users: [...state.users, { ...u, status: "active", joined: nowISO().slice(0, 10), prefs: { status: true, system: true, reminders: true } }] })
  notify(u.email, "system", "Welcome to FISHMARKET", u.role === "Seller" ? "Your seller account is ready. Create your first listing." : "Your account is ready. Start exploring the marketplace.", u.role === "Seller" ? "#seller/add" : "#marketplace")
  log(u.name, u.role, "Created an account")
}
export function updateUser(email: string, patch: Partial<User>) { commit({ ...state, users: state.users.map(u => u.email === email ? { ...u, ...patch } : u) }) }
export function setUserStatus(email: string, status: User["status"], by: string) {
  const u = findUser(email); if (!u) return
  updateUser(email, { status })
  log(by, "Admin", status === "suspended" ? "Suspended account" : "Reactivated account", u.name)
  notify(email, "system", status === "suspended" ? "Your account was suspended" : "Your account was reactivated", status === "suspended" ? "Contact support to appeal this decision." : "You can sign in again.", "#login")
}

/* ---------- listing lifecycle ---------- */
export const getListing = (id: string) => state.listings.find(l => l.id === id)
const patchListing = (id: string, fn: (l: Listing) => Listing) => commit({ ...state, listings: state.listings.map(l => l.id === id ? fn(l) : l) })
const hist = (l: Listing, by: string, action: string, note?: string): Listing => ({ ...l, updatedAt: nowISO(), history: [...l.history, { at: nowISO(), by, action, note }] })

export function saveDraft(owner: User, id: string | undefined, draft: Draft): string {
  const existing = id ? getListing(id) : undefined
  if (existing) { patchListing(existing.id, l => ({ ...l, draft, updatedAt: nowISO() })); return existing.id }
  const newId = `FM-${state.seq + 1}`
  const l: Listing = { id: newId, owner: owner.email, sellerName: owner.store || owner.name, status: "draft", draft, decision: null, createdAt: nowISO(), updatedAt: nowISO(), submittedAt: null, views: 0, history: [{ at: nowISO(), by: owner.name, action: "Created draft" }] }
  commit({ ...state, seq: state.seq + 1, listings: [l, ...state.listings] })
  return newId
}
export function submitListing(owner: User, id: string, draft: Draft) {
  const l = getListing(id); if (!l || !["draft", "changes", "rejected", "approved"].includes(l.status)) return false
  const resubmit = l.status !== "draft"
  patchListing(id, x => ({ ...hist(x, owner.name, resubmit ? "Resubmitted for review" : "Submitted for review"), draft, status: "pending", decision: null, submittedAt: nowISO() }))
  notify(owner.email, "success", "Listing submitted", `"${draft.name}" is now pending review. We usually respond within 24 hours.`, `#seller/listing/${id}`)
  notify("Admin", "status", resubmit ? "Listing resubmitted for review" : "New listing awaiting review", `${l.sellerName} submitted "${draft.name}" (${id}).`, `#admin/review/${id}`)
  log(owner.name, "Seller", resubmit ? "Resubmitted listing" : "Submitted listing for review", draft.name, `#seller/listing/${id}`)
  return true
}
export function withdrawListing(owner: User, id: string) {
  const l = getListing(id); if (!l || l.status !== "pending") return
  patchListing(id, x => ({ ...hist(x, owner.name, "Withdrawn from review"), status: "draft", submittedAt: null }))
  notify("Admin", "status", "Listing withdrawn", `${l.sellerName} withdrew "${l.draft.name}" (${id}) from review.`, "#admin/queue")
  log(owner.name, "Seller", "Withdrew listing from review", l.draft.name, `#seller/listing/${id}`)
}
export function setPaused(owner: User, id: string, paused: boolean) {
  const l = getListing(id); if (!l || l.status !== (paused ? "approved" : "paused")) return
  patchListing(id, x => ({ ...hist(x, owner.name, paused ? "Paused (hidden from marketplace)" : "Resumed (live again)"), status: paused ? "paused" : "approved" }))
  log(owner.name, "Seller", paused ? "Paused listing" : "Resumed listing", l.draft.name, `#seller/listing/${id}`)
}
export function deleteListing(owner: User, id: string) {
  const l = getListing(id); if (!l || l.status === "pending" || l.status === "approved") return
  commit({ ...state, listings: state.listings.filter(x => x.id !== id), deleted: [...state.deleted, id] })
  log(owner.name, "Seller", "Deleted listing", l.draft.name)
}
export function decideListing(admin: User, id: string, kind: "approved" | "rejected" | "changes", reason = "", feedback = "", step = 1) {
  const l = getListing(id); if (!l || l.status !== "pending") return false
  const at = nowISO()
  patchListing(id, x => ({
    ...hist(x, admin.name, kind === "approved" ? "Approved" : kind === "rejected" ? "Rejected" : "Changes requested", feedback || undefined),
    status: kind, decision: kind === "approved" ? null : { kind, reason, feedback, step, by: admin.name, at },
  }))
  if (kind === "approved") notify(l.owner, "approval", "Your listing is now live!", `"${l.draft.name}" was approved and is visible to buyers.`, `#seller/listing/${id}`)
  else notify(l.owner, kind === "rejected" ? "error" : "approval", kind === "rejected" ? "Listing rejected" : "Changes requested", `${reason}: ${feedback}`, `#seller/listing/${id}`)
  log(admin.name, "Admin", kind === "approved" ? "Approved listing" : kind === "rejected" ? "Rejected listing" : "Requested changes", l.draft.name, `#admin/review/${id}`)
  return true
}
export function takedownListing(admin: User, id: string, reason: string) {
  const l = getListing(id); if (!l || (l.status !== "approved" && l.status !== "paused")) return
  patchListing(id, x => ({ ...hist(x, admin.name, "Taken down", reason), status: "rejected", decision: { kind: "rejected", reason: "Policy violation", feedback: reason, step: 1, by: admin.name, at: nowISO() } }))
  notify(l.owner, "error", "Listing removed from marketplace", `"${l.draft.name}" was taken down: ${reason}`, `#seller/listing/${id}`)
  log(admin.name, "Admin", "Took down listing", l.draft.name, `#admin/review/${id}`)
}

/* ---------- session ---------- */
const SKEY = "fishmarket-session-v2"
const ssubs = new Set<() => void>()
type Sess = { email: string; lastActive: number } | null
let sess: Sess = (() => { try { return JSON.parse(sessionStorage.getItem(SKEY) || "null") } catch { return null } })()
const setSess = (s: Sess) => { sess = s; if (s) sessionStorage.setItem(SKEY, JSON.stringify(s)); else sessionStorage.removeItem(SKEY); ssubs.forEach(f => f()) }
export const SESSION_TTL = 15 * 60_000
export function startSession(email: string) { setSess({ email, lastActive: Date.now() }) }
export function endSession() { setSess(null) }
export function touchSession(force = false) { if (sess && (force || Date.now() - sess.lastActive > 10_000)) { sess = { ...sess, lastActive: Date.now() }; sessionStorage.setItem(SKEY, JSON.stringify(sess)) } }
export function forceExpire() { if (sess) { sess = { ...sess, lastActive: 0 }; sessionStorage.setItem(SKEY, JSON.stringify(sess)) } }
export const hasSession = () => !!sess
export const remainingMs = () => (sess ? SESSION_TTL - (Date.now() - sess.lastActive) : 0)
export const sessionExpired = () => !!sess && Date.now() - sess.lastActive > SESSION_TTL
export function currentUser(): User | null {
  if (!sess) return null
  const u = findUser(sess.email)
  return u && u.status === "active" ? u : null
}
export function useUser(): User | null {
  useStore()
  useSyncExternalStore(cb => { ssubs.add(cb); return () => { ssubs.delete(cb) } }, () => sess)
  return currentUser()
}

/* ---------- permissions ---------- */
export type Perm =
  | "market.view" | "order.create" | "order.view"
  | "listing.create" | "listing.edit" | "listing.delete" | "listing.submit" | "listing.pause"
  | "listing.review" | "listing.approve" | "listing.reject" | "listing.takedown"
  | "user.view" | "user.manage" | "activity.all" | "profile.edit"
const B: Perm[] = ["market.view", "order.create", "order.view", "profile.edit"]
const S: Perm[] = ["market.view", "listing.create", "listing.edit", "listing.delete", "listing.submit", "listing.pause", "profile.edit"]
const A: Perm[] = ["market.view", "listing.review", "listing.approve", "listing.reject", "listing.takedown", "user.view", "user.manage", "activity.all", "profile.edit"]
export const PERMS: Record<Role, Perm[]> = { Buyer: B, Seller: S, Admin: A }
export const can = (role: Role | undefined, p: Perm) => !!role && PERMS[role].includes(p)
export const homeFor = (role: Role) => (role === "Seller" ? "seller" : role === "Admin" ? "admin" : "marketplace")

/* ---------- flash message + return-to ---------- */
export const flash = (msg: string) => sessionStorage.setItem("fishmarket-flash", msg)
export const takeFlash = () => { const m = sessionStorage.getItem("fishmarket-flash"); if (m) sessionStorage.removeItem("fishmarket-flash"); return m }
export const setReturnTo = (h: string) => sessionStorage.setItem("fishmarket-return", h)
export const takeReturnTo = () => { const m = sessionStorage.getItem("fishmarket-return"); sessionStorage.removeItem("fishmarket-return"); return m }

export function signOut(message = "You've been signed out.") {
  const u = currentUser()
  if (u) log(u.name, u.role, "Signed out")
  endSession(); flash(message); window.location.hash = "home"
}

/* ---------- formatting ---------- */
export function timeAgo(iso: string, vi = false) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 1) return vi ? "Vừa xong" : "Just now"
  if (m < 60) return vi ? `${m} phút trước` : `${m} min ago`
  const h = Math.round(m / 60); if (h < 24) return vi ? `${h} giờ trước` : `${h} h ago`
  const d = Math.round(h / 24); return vi ? `${d} ngày trước` : `${d} d ago`
}
export const fmtDate = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

/* ---------- simulated requests (loading / network failure / expiry) ---------- */
export const isOffline = () => localStorage.getItem("fishmarket-offline") === "1"
export const setOffline = (v: boolean) => { if (v) localStorage.setItem("fishmarket-offline", "1"); else localStorage.removeItem("fishmarket-offline") }
export function request<T>(fn: () => T, ms = 700): Promise<T> {
  return new Promise((resolve, reject) => setTimeout(() => {
    if (sessionExpired()) return reject(new Error("expired"))
    if (isOffline()) return reject(new Error("network"))
    resolve(fn())
  }, ms))
}
