import { useSyncExternalStore } from "react";
import { api, authApi, ApiError } from "./api";
export type Role = "Buyer" | "Admin";
export type LStatus =
  "draft" | "pending" | "approved" | "changes" | "rejected" | "paused";
export type Img = {
  id: string;
  url: string;
};
export type Draft = {
  name: string;
  species: string;
  breed: string;
  description: string;
  age: string;
  size: string;
  gender: string;
  origin: string;
  health: string;
  price: string;
  quantity: string;
  negotiable: boolean;
  images: Img[];
  mainId: string;
  location: string;
  region: string;
  shipping: string[];
};
export type Decision = {
  kind: "rejected" | "changes";
  reason: string;
  feedback: string;
  step: number;
  by: string;
  at: string;
};
export type HistoryEntry = {
  at: string;
  by: string;
  action: string;
  note?: string;
};
export type Listing = {
  id: string;
  owner: string;
  sellerName: string;
  status: LStatus;
  draft: Draft;
  decision: Decision | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  views: number;
  history: HistoryEntry[];
};
export type User = {
  email: string;
  password: string;
  name: string;
  role: Role;
  status: "active" | "suspended";
  blockedUntil?: string | null;
  blockKind?: "24h" | "7d" | "permanent";
  deletedAt?: string;
  phone: string;
  location: string;
  joined: string;
  store?: string;
  prefs: {
    status: boolean;
    system: boolean;
    reminders: boolean;
  };
};
export type NotifType =
  "success" | "error" | "system" | "status" | "approval" | "reminder";
export type Notif = {
  id: string;
  to: string;
  type: NotifType;
  title: string;
  body: string;
  link: string;
  at: string;
  read: boolean;
};
export type Activity = {
  id: string;
  actor: string;
  role: Role | "System";
  legacyRole?: string;
  action: string;
  target?: string;
  link?: string;
  at: string;
};
type State = {
  users: User[];
  listings: Listing[];
  deleted: string[];
  notifs: Notif[];
  activity: Activity[];
  seq: number;
};
const PH = (id: string, i: number): Img => ({
  id: `p${i}`,
  url: `https://images.unsplash.com/${id}?w=1000&h=750&fit=crop&auto=format`,
});
const P = [
  "photo-1516408388733-2f8364f2e00b",
  "photo-1522720833375-9c27ffb02a5e",
  "photo-1572438131134-ec29490abfba",
  "photo-1640529837996-b81a91eaf7a5",
  "photo-1663892318998-d4b1a5acde66",
  "photo-1668349009169-93e19d2eba7a",
].map(PH);
export const SAMPLE_PHOTOS = P;
export const EMPTY_DRAFT: Draft = {
  name: "",
  species: "",
  breed: "",
  description: "",
  age: "",
  size: "",
  gender: "",
  origin: "",
  health: "",
  price: "",
  quantity: "1",
  negotiable: false,
  images: [],
  mainId: "",
  location: "",
  region: "",
  shipping: [],
};
export function listingMissingFields(draft: Draft): string[] {
  const checks: [string, boolean][] = [
    ["name", Boolean(draft.name.trim())],
    ["species", Boolean(draft.species)],
    ["description", draft.description.trim().length >= 20],
    ["age", Boolean(draft.age.trim())],
    ["size", Number(draft.size) > 0],
    ["gender", Boolean(draft.gender)],
    ["origin", Boolean(draft.origin)],
    ["health", Boolean(draft.health)],
    ["price", Number(draft.price) > 0],
    ["quantity", Number(draft.quantity) >= 1],
    [
      "Cloudinary image",
      draft.images.length > 0 &&
        draft.images.every((image) =>
          image.url.startsWith("https://res.cloudinary.com/"),
        ),
    ],
    ["location", Boolean(draft.location.trim())],
    ["region", Boolean(draft.region)],
    ["shipping", draft.shipping.length > 0],
  ];
  return checks.filter(([, valid]) => !valid).map(([field]) => field);
}
const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const GK = {
  email: "seller@fishmarket.demo",
  name: "Golden Koi Farm",
};
const mk = (
  id: string,
  owner: {
    email: string;
    name: string;
  },
  status: LStatus,
  d: Partial<Draft>,
  hoursAgo: number,
  extra: Partial<Listing> = {},
): Listing => ({
  id,
  owner: owner.email,
  sellerName: owner.name,
  status,
  decision: null,
  views: 0,
  createdAt: ago(hoursAgo + 5),
  updatedAt: ago(hoursAgo),
  submittedAt: status === "draft" ? null : ago(hoursAgo + 1),
  draft: {
    ...EMPTY_DRAFT,
    description:
      "Healthy, well-conditioned stock raised in clean water and fed a premium diet. Photographed in natural light.",
    age: "12 months",
    gender: "Female",
    origin: "Vietnam — farm bred",
    health: "Excellent — vet certified",
    quantity: "2",
    location: "128 Nguyen Van Huong, Thao Dien",
    region: "Ho Chi Minh City",
    shipping: ["Local pickup", "Domestic overnight"],
    ...d,
  },
  history: [
    {
      at: ago(hoursAgo + 5),
      by: owner.name,
      action: "Created draft",
    },
    ...(status === "draft"
      ? []
      : [
          {
            at: ago(hoursAgo + 1),
            by: owner.name,
            action: "Submitted for review",
          },
        ]),
    ...(status === "approved" || status === "paused"
      ? [
          {
            at: ago(hoursAgo),
            by: "Marketplace Admin",
            action: "Approved",
          },
        ]
      : []),
  ],
  ...extra,
});
function seed(): State {
  const joined = "2024-03-12";
  const u = (
    email: string,
    name: string,
    role: Role,
    status: User["status"] = "active",
    password = "Demo1234",
    store?: string,
  ): User => ({
    email,
    name,
    role,
    status,
    password,
    phone: "+84 90 123 4567",
    location: "Ho Chi Minh City",
    joined,
    store,
    prefs: {
      status: true,
      system: true,
      reminders: true,
    },
  });
  const BL = {
    email: "lagoon@fishmarket.demo",
    name: "Blue Lagoon Aquatics",
  };
  const MK = {
    email: "mekong@fishmarket.demo",
    name: "Mekong Aroworld",
  };
  return {
    seq: 48300,
    users: [
      u("buyer@fishmarket.demo", "Alex Nguyen", "Buyer", "active", "Buyer123"),
      u(
        "seller@fishmarket.demo",
        "Golden Koi Farm",
        "Admin",
        "active",
        "Seller123",
        "Golden Koi Farm",
      ),
      u(
        "admin@fishmarket.demo",
        "Marketplace Admin",
        "Admin",
        "active",
        "Admin123",
      ),
      u(
        "lagoon@fishmarket.demo",
        "Blue Lagoon Aquatics",
        "Admin",
        "active",
        "Demo1234",
        "Blue Lagoon Aquatics",
      ),
      u(
        "mekong@fishmarket.demo",
        "Mekong Aroworld",
        "Admin",
        "active",
        "Demo1234",
        "Mekong Aroworld",
      ),
      u("linh@fishmarket.demo", "Linh Tran", "Buyer"),
      u("minh@fishmarket.demo", "Minh Pham", "Buyer", "suspended"),
    ],
    listings: [
      mk(
        "FM-20817",
        BL,
        "pending",
        {
          name: "Betta Halfmoon Blue",
          species: "Betta",
          breed: "Halfmoon",
          price: "38",
          size: "6",
          images: [P[3]],
          mainId: "p3",
        },
        20,
      ),
      mk(
        "FM-20803",
        MK,
        "pending",
        {
          name: "Arowana Silver 28 cm",
          species: "Arowana",
          breed: "Silver",
          price: "260",
          size: "28",
          images: [P[4]],
          mainId: "p4",
        },
        30,
      ),
      mk(
        "FM-19544",
        GK,
        "approved",
        {
          name: "Kohaku Koi, 40 cm",
          species: "Koi",
          breed: "Kohaku",
          price: "720",
          size: "40",
          images: [P[0], P[1]],
          mainId: "p0",
        },
        48,
        {
          views: 1204,
        },
      ),
      mk(
        "FM-19102",
        GK,
        "approved",
        {
          name: "Ginrin Chagoi",
          species: "Koi",
          breed: "Chagoi",
          price: "310",
          size: "35",
          images: [P[2]],
          mainId: "p2",
        },
        120,
        {
          views: 846,
        },
      ),
      mk(
        "FM-18877",
        GK,
        "approved",
        {
          name: "Oranda Goldfish Pair",
          species: "Goldfish",
          breed: "Oranda",
          price: "95",
          size: "12",
          images: [P[4]],
          mainId: "p4",
        },
        170,
        {
          views: 512,
        },
      ),
      mk(
        "FM-18420",
        BL,
        "approved",
        {
          name: "Discus Pigeon Blood",
          species: "Discus",
          breed: "Pigeon Blood",
          price: "120",
          size: "14",
          images: [P[5]],
          mainId: "p5",
        },
        300,
        {
          views: 233,
        },
      ),
    ],
    deleted: [],
    notifs: [
      {
        id: "n2",
        to: "seller@fishmarket.demo",
        type: "system",
        title: "Welcome to Seller Center",
        body: "Create and publish your first listing on FISHMARKET.",
        link: "#admin/add",
        at: ago(72),
        read: false,
      },
      {
        id: "n3",
        to: "buyer@fishmarket.demo",
        type: "system",
        title: "Welcome to FISHMARKET",
        body: "Browse verified sellers and buy with buyer protection.",
        link: "#marketplace",
        at: ago(72),
        read: false,
      },
    ],
    activity: [
      {
        id: "a1",
        actor: "Marketplace Admin",
        role: "Admin",
        action: "Approved listing",
        target: "Kohaku Koi, 40 cm",
        link: "#admin/review/FM-19544",
        at: ago(48),
      },
      {
        id: "a2",
        actor: "Blue Lagoon Aquatics",
        role: "Buyer",
        legacyRole: "Seller",
        action: "Submitted listing for review",
        target: "Betta Halfmoon Blue",
        link: "#admin/review/FM-20817",
        at: ago(20),
      },
    ],
  };
}
const KEY = "fishmarket-api-cache-v3";
const emptyState = (): State => ({
  users: [],
  listings: [],
  deleted: [],
  notifs: [],
  activity: [],
  seq: 0,
});
function migrateState(input: State): State {
  const users = input.users.map((user) => ({
    ...user,
    role: (String(user.role) === "Seller" ? "Admin" : user.role) as Role,
    ...(user.blockedUntil && Date.parse(user.blockedUntil) <= Date.now()
      ? { status: "active" as const, blockedUntil: null, blockKind: undefined }
      : {}),
  }));
  return {
    ...input,
    users,
    listings: input.listings.map((listing) => {
      if (listing.status === "pending")
        return { ...listing, status: "approved" as const, decision: null };
      if (["changes", "rejected"].includes(listing.status))
        return { ...listing, status: "draft" as const };
      return listing;
    }),
    activity: input.activity.map((item) => ({
      ...item,
      role: String(item.role) === "Seller" ? ("Admin" as const) : item.role,
      ...(String(item.role) === "Seller" ? { legacyRole: "Seller" } : {}),
      link: item.link?.replace(/^#?seller/, "#admin"),
    })),
    notifs: input.notifs
      .filter((item) => !item.link.includes("admin/queue"))
      .map((item) => ({
        ...item,
        link: item.link.replace(/^#?seller/, "#admin"),
      })),
  };
}
let state: State = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrateState(JSON.parse(raw) as State);
  } catch {
    /* Invalid saved demo data falls back to seed. */
  }
  return emptyState();
})();
try {
  localStorage.setItem(KEY, JSON.stringify(state));
} catch {
  /* Storage can be unavailable. */
}
const subs = new Set<() => void>();
function commit(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full */
  }
  subs.forEach((f) => f());
}
window.addEventListener("storage", (e) => {
  if (e.key === KEY && e.newValue) {
    state = migrateState(JSON.parse(e.newValue));
    subs.forEach((f) => f());
  }
});
export function useStore(): State {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    () => state,
  );
}
export const getState = () => state;
export function resetDemoData() {
  commit(emptyState());
  void syncFromApi();
}
const nid = (p: string) =>
  `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const nowISO = () => new Date().toISOString();
export function notify(
  to: string,
  type: NotifType,
  title: string,
  body: string,
  link: string,
) {
  const u = state.users.find((x) => x.email === to);
  if (
    u &&
    ((type === "system" && !u.prefs.system) ||
      (type === "reminder" && !u.prefs.reminders) ||
      (type === "status" && !u.prefs.status))
  )
    return;
  commit({
    ...state,
    notifs: [
      {
        id: nid("n"),
        to,
        type,
        title,
        body,
        link,
        at: nowISO(),
        read: false,
      },
      ...state.notifs,
    ].slice(0, 200),
  });
}
export function log(
  actor: string,
  role: Role | "System",
  action: string,
  target?: string,
  link?: string,
) {
  commit({
    ...state,
    activity: [
      {
        id: nid("a"),
        actor,
        role,
        action,
        target,
        link,
        at: nowISO(),
      },
      ...state.activity,
    ].slice(0, 300),
  });
}
export function markRead(id: string, read = true) {
  commit({
    ...state,
    notifs: state.notifs.map((n) =>
      n.id === id
        ? {
            ...n,
            read,
          }
        : n,
    ),
  });
  void api(`/notifications/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ read }),
  }).catch(() => undefined);
}
export function markAllRead(ids: string[]) {
  commit({
    ...state,
    notifs: state.notifs.map((n) =>
      ids.includes(n.id)
        ? {
            ...n,
            read: true,
          }
        : n,
    ),
  });
  void api("/notifications/read-all", { method: "POST" }).catch(
    () => undefined,
  );
}
export function removeNotif(id: string) {
  commit({
    ...state,
    notifs: state.notifs.filter((n) => n.id !== id),
  });
  void api(`/notifications/${id}`, { method: "DELETE" }).catch(() => undefined);
}
export const notifsFor = (
  s: State,
  u: {
    email: string;
    role: Role;
  },
) => s.notifs.filter((n) => n.to === u.email || n.to === u.role);

/* ---------- accounts ---------- */
export const findUser = (email: string) =>
  state.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
function acceptApiUser(remote: any): User {
  const user: User = {
    email: remote.email,
    password: "",
    name: remote.name,
    role: remote.role === "Admin" ? "Admin" : "Buyer",
    status: remote.status,
    phone: remote.phone ?? "",
    location: remote.location ?? "",
    joined: String(remote.joinedAt ?? remote.createdAt ?? nowISO()).slice(
      0,
      10,
    ),
    store: remote.store ?? undefined,
    prefs: remote.prefs ?? { status: true, system: true, reminders: true },
  };
  commit({
    ...state,
    users: [user, ...state.users.filter((x) => x.email !== user.email)],
  });
  void syncFromApi(user);
  return user;
}

function mapApiListing(item: any): Listing {
  const d = item.draft ?? {};
  return {
    id: item.code,
    owner: item.owner?.email ?? "",
    sellerName: item.sellerName,
    status: item.status,
    decision: item.decisionKind
      ? {
          kind: item.decisionKind,
          reason: item.decisionReason ?? "",
          feedback: item.decisionFeedback ?? "",
          step: item.decisionStep ?? 1,
          by: item.decisionBy ?? "",
          at: item.decisionAt,
        }
      : null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    submittedAt: item.submittedAt,
    views: item.views,
    draft: {
      name: d.name ?? "",
      species: d.species ?? "",
      breed: d.breed ?? "",
      description: d.description ?? "",
      age: d.ageMonths == null ? "" : `${d.ageMonths} months`,
      size: d.sizeCm == null ? "" : String(d.sizeCm),
      gender: d.gender ?? "",
      origin: d.origin ?? "",
      health: d.health ?? "",
      price: String(d.price ?? ""),
      quantity: String(d.quantity ?? 1),
      negotiable: Boolean(d.negotiable),
      images: (d.images ?? []).map((x: any) => ({ id: x.id, url: x.url })),
      mainId:
        d.images?.find((x: any) => x.isMain)?.id ?? d.images?.[0]?.id ?? "",
      location: d.location ?? "",
      region: d.region ?? "",
      shipping: d.shipping ?? [],
    },
    history: (item.history ?? []).map((x: any) => ({
      at: x.at,
      by: x.actorLabel,
      action: x.action,
      note: x.note ?? undefined,
    })),
  };
}

export async function syncFromApi(user = currentUser()) {
  if (!user) return;
  try {
    const [listings, notifications] = await Promise.all([
      user.role === "Admin"
        ? api<any[]>("/admin/listings")
        : Promise.resolve([]),
      api<any[]>("/me/notifications"),
    ]);
    const next: State = {
      ...state,
      listings: listings.map(mapApiListing),
      notifs: notifications.map((n: any) => ({
        id: n.id,
        to: user.email,
        type: n.type,
        title: n.titleKey,
        body: n.bodyKey,
        link: n.link ?? "#account/notifications",
        at: n.createdAt,
        read: Boolean(n.readAt),
      })),
    };
    if (user.role === "Admin") {
      const [users, activity] = await Promise.all([
        api<any[]>("/admin/users"),
        api<any[]>("/admin/activity"),
      ]);
      next.users = users.map((x: any) => ({
        email: x.email,
        password: "",
        name: x.name,
        role: x.role,
        status: x.status,
        phone: x.phone ?? "",
        location: x.location ?? "",
        joined: String(x.joinedAt).slice(0, 10),
        store: x.store ?? undefined,
        prefs: { status: true, system: true, reminders: true },
      }));
      next.activity = activity.map((x: any) => ({
        id: x.id,
        actor: x.actorLabel,
        role: x.role,
        action: x.action,
        target: x.target ?? undefined,
        link: x.link ?? undefined,
        at: x.createdAt,
      }));
    }
    commit(next);
  } catch {
    /* The current screen keeps its loading/empty state and can retry after sign-in. */
  }
}
export async function authenticate(
  email: string,
  password: string,
): Promise<
  | {
      ok: true;
      user: User;
    }
  | {
      ok: false;
      reason:
        | "invalid"
        | "suspended"
        | "network"
        | "server"
        | "configuration"
        | "validation";
    }
> {
  try {
    const result = await authApi.login(email.trim().toLowerCase(), password);
    return { ok: true, user: acceptApiUser(result.user) };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof ApiError
          ? error.code === "network.unreachable"
            ? "network"
            : error.status >= 500
              ? "server"
              : error.code === "api.invalidResponse" || error.status === 404
                ? "configuration"
                : error.code === "auth.accountSuspended"
                  ? "suspended"
                  : error.code === "auth.invalidCredentials"
                    ? "invalid"
                    : error.status === 400
                      ? "validation"
                      : "server"
          : "server",
    };
  }
}
export async function addUser(u: Omit<User, "joined" | "status" | "prefs">) {
  const result = await authApi.register({
    email: u.email,
    password: u.password,
    name: u.name,
    role: u.role,
    phone: u.phone,
    location: u.location,
    store: u.store,
  });
  return acceptApiUser(result.user);
}
export function updateUser(email: string, patch: Partial<User>) {
  commit({
    ...state,
    users: state.users.map((u) =>
      u.email === email
        ? {
            ...u,
            ...patch,
          }
        : u,
    ),
  });
  const body = Object.fromEntries(
    Object.entries(patch).filter(([key]) =>
      ["name", "phone", "location", "store"].includes(key),
    ),
  );
  if (Object.keys(body).length)
    void api("/me", { method: "PATCH", body: JSON.stringify(body) }).catch(
      () => undefined,
    );
}
export function setUserStatus(
  email: string,
  status: User["status"],
  by: string,
) {
  const u = findUser(email);
  if (!u || u.role === "Admin") return;
  updateUser(email, {
    status,
    blockedUntil: null,
    blockKind: status === "suspended" ? "permanent" : undefined,
  });
  log(
    by,
    "Admin",
    status === "suspended" ? "Suspended account" : "Reactivated account",
    u.name,
  );
  notify(
    email,
    "system",
    status === "suspended"
      ? "Your account was suspended"
      : "Your account was reactivated",
    status === "suspended"
      ? "Contact support to appeal this decision."
      : "You can sign in again.",
    "#login",
  );
}

/* ---------- listing lifecycle ---------- */
export const getListing = (id: string) =>
  state.listings.find((l) => l.id === id);
const patchListing = (id: string, fn: (l: Listing) => Listing) =>
  commit({
    ...state,
    listings: state.listings.map((l) => (l.id === id ? fn(l) : l)),
  });
const hist = (
  l: Listing,
  by: string,
  action: string,
  note?: string,
): Listing => ({
  ...l,
  updatedAt: nowISO(),
  history: [
    ...l.history,
    {
      at: nowISO(),
      by,
      action,
      note,
    },
  ],
});
export async function saveDraft(
  owner: User,
  id: string | undefined,
  draft: Draft,
): Promise<string> {
  if (owner.role === "Buyer") throw new Error("Seller access required");
  const result = await api<any>(
    id ? `/admin/listings/${id}` : "/admin/listings",
    {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify({ ...toApiDraft(draft), publish: false }),
    },
  );
  await syncFromApi(owner);
  return result.code;
}
function toApiDraft(draft: Draft) {
  return {
    ...draft,
    ageMonths: Number(draft.age.replace(/\D/g, "")) || null,
    sizeCm: Number(draft.size) || null,
    price: Number(draft.price),
    quantity: Number(draft.quantity),
    images: draft.images,
  };
}
export async function publishListing(
  owner: User,
  id: string | undefined,
  draft: Draft,
) {
  if (owner.role === "Buyer") throw new Error("Seller access required");
  const result = await api<any>(
    id ? `/admin/listings/${id}` : "/admin/listings",
    {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify({ ...toApiDraft(draft), publish: true }),
    },
  );
  await syncFromApi(owner);
  notify(
    owner.email,
    "success",
    "Listing published",
    `"${draft.name}" is now live on the marketplace.`,
    `#admin/listing/${result.code}`,
  );
  return result.code as string;
}
export function setPaused(owner: User, id: string, paused: boolean) {
  if (owner.role === "Buyer") throw new Error("Seller access required");
  const l = getListing(id);
  if (!l || l.status !== (paused ? "approved" : "paused")) return;
  patchListing(id, (x) => ({
    ...hist(
      x,
      owner.name,
      paused ? "Paused (hidden from marketplace)" : "Resumed (live again)",
    ),
    status: paused ? "paused" : "approved",
  }));
  log(
    owner.name,
    owner.role,
    paused ? "Paused listing" : "Resumed listing",
    l.draft.name,
    `#admin/listing/${id}`,
  );
  void api(`/admin/listings/${id}/${paused ? "pause" : "resume"}`, {
    method: "POST",
    body: "{}",
  })
    .then(() => syncFromApi(owner))
    .catch(() => undefined);
}
export function deleteListing(owner: User, id: string) {
  if (owner.role === "Buyer") throw new Error("Seller access required");
  const l = getListing(id);
  if (!l || l.status === "pending" || l.status === "approved") return;
  commit({
    ...state,
    listings: state.listings.filter((x) => x.id !== id),
    deleted: [...state.deleted, id],
  });
  log(owner.name, owner.role, "Deleted listing", l.draft.name);
  void api(`/admin/listings/${id}`, { method: "DELETE" })
    .then(() => syncFromApi(owner))
    .catch(() => undefined);
}
/* ---------- session ---------- */
const SKEY = "fishmarket-session-v2";
export const SESSION_TTL = 7 * 24 * 60 * 60_000;
const ssubs = new Set<() => void>();
type Sess = { email: string; lastActive: number; expiresAt: number } | null;
function readSession(raw: string | null): Sess {
  try {
    const s = JSON.parse(raw || "null");
    if (!s || typeof s.email !== "string" || !Number.isFinite(s.lastActive))
      return null;
    const expiresAt = s.expiresAt ?? s.lastActive + SESSION_TTL;
    if (!Number.isFinite(expiresAt)) return null;
    return { email: s.email, lastActive: s.lastActive, expiresAt };
  } catch {
    return null;
  }
}
let sess = readSession(
  localStorage.getItem(SKEY) ?? sessionStorage.getItem(SKEY),
);
// Migrate the previous tab-only login without resetting its original age.
if (sess) localStorage.setItem(SKEY, JSON.stringify(sess));
sessionStorage.removeItem(SKEY);
const setSess = (s: Sess) => {
  sess = s;
  if (s) localStorage.setItem(SKEY, JSON.stringify(s));
  else localStorage.removeItem(SKEY);
  sessionStorage.removeItem(SKEY);
  ssubs.forEach((f) => f());
};
window.addEventListener("storage", (event) => {
  if (event.key !== SKEY && event.key !== null) return;
  sess = readSession(localStorage.getItem(SKEY));
  ssubs.forEach((f) => f());
});
export function startSession(email: string) {
  const now = Date.now();
  setSess({ email, lastActive: now, expiresAt: now + SESSION_TTL });
}
export function endSession() {
  setSess(null);
  void authApi.logout().catch(() => undefined);
}
export function touchSession(force = false) {
  if (!sess || sessionExpired()) return;
  const now = Date.now();
  if (force)
    setSess({ ...sess, lastActive: now, expiresAt: now + SESSION_TTL });
  else if (now - sess.lastActive > 10_000) {
    sess = { ...sess, lastActive: now };
    localStorage.setItem(SKEY, JSON.stringify(sess));
  }
}
export function forceExpire() {
  if (sess) setSess({ ...sess, expiresAt: 0 });
}
export const hasSession = () => !!sess;
export const remainingMs = () =>
  sess ? Math.max(0, sess.expiresAt - Date.now()) : 0;
export const sessionExpired = () => !!sess && Date.now() >= sess.expiresAt;
export function currentUser(): User | null {
  if (!sess || sessionExpired()) return null;
  const u = findUser(sess.email);
  return u && !u.deletedAt && !isAccountBlocked(u) ? u : null;
}
export function useUser(): User | null {
  useStore();
  useSyncExternalStore(
    (cb) => {
      ssubs.add(cb);
      return () => {
        ssubs.delete(cb);
      };
    },
    () => sess,
  );
  return currentUser();
}

/* ---------- permissions ---------- */
export type Perm =
  | "market.view"
  | "order.create"
  | "order.view"
  | "listing.create"
  | "listing.edit"
  | "listing.delete"
  | "listing.submit"
  | "listing.pause"
  | "listing.review"
  | "listing.approve"
  | "listing.reject"
  | "listing.takedown"
  | "user.view"
  | "user.manage"
  | "activity.all"
  | "profile.edit";
const B: Perm[] = ["market.view", "order.create", "order.view", "profile.edit"];
const S: Perm[] = [
  "market.view",
  "listing.create",
  "listing.edit",
  "listing.delete",
  "listing.submit",
  "listing.pause",
  "profile.edit",
];
const A: Perm[] = [
  "market.view",
  "listing.review",
  "listing.approve",
  "listing.reject",
  "listing.takedown",
  "user.view",
  "user.manage",
  "activity.all",
  "profile.edit",
];
export const PERMS: Record<Role, Perm[]> = {
  Buyer: B,
  Admin: [...new Set([...A, ...S])],
};
export const can = (role: Role | undefined, p: Perm) =>
  !!role && PERMS[role].includes(p);
export const homeFor = (role: Role) => (role === "Admin" ? "admin" : "home");

/* ---------- flash message + return-to ---------- */
export const flash = (msg: string) =>
  sessionStorage.setItem("fishmarket-flash", msg);
export const takeFlash = () => {
  const m = sessionStorage.getItem("fishmarket-flash");
  if (m) sessionStorage.removeItem("fishmarket-flash");
  return m;
};
export const setReturnTo = (h: string) =>
  sessionStorage.setItem("fishmarket-return", h);
export const takeReturnTo = () => {
  const m = sessionStorage.getItem("fishmarket-return");
  sessionStorage.removeItem("fishmarket-return");
  return m;
};
export function signOut(_message?: string) {
  const u = currentUser();
  if (u) log(u.name, u.role, "Signed out");
  endSession();
  window.location.hash = "home";
}

/* ---------- formatting ---------- */
export function timeAgo(iso: string, vi = false) {
  const m = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000),
  );
  if (m < 1) return vi ? "Vừa xong" : "Just now";
  if (m < 60) return vi ? `${m} phút trước` : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return vi ? `${h} giờ trước` : `${h} h ago`;
  const d = Math.round(h / 24);
  return vi ? `${d} ngày trước` : `${d} d ago`;
}
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/* ---------- simulated requests (loading / network failure / expiry) ---------- */
export const isOffline = () =>
  localStorage.getItem("fishmarket-offline") === "1";
export const setOffline = (v: boolean) => {
  if (v) localStorage.setItem("fishmarket-offline", "1");
  else localStorage.removeItem("fishmarket-offline");
};
export function request<T>(fn: () => T, ms = 700): Promise<T> {
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      if (sessionExpired()) return reject(new Error("expired"));
      if (isOffline()) return reject(new Error("network"));
      resolve(fn());
    }, ms),
  );
}

/* Account access policies: 24 hours, 7 days, permanent. Orders are retained. */
export type BlockKind = "24h" | "7d" | "permanent";
export function isAccountBlocked(user: User) {
  return (
    user.status === "suspended" &&
    (!user.blockedUntil || Date.parse(user.blockedUntil) > Date.now())
  );
}
export function refreshAccountLocks() {
  if (
    state.users.some(
      (u) =>
        u.blockedUntil &&
        Date.parse(u.blockedUntil) <= Date.now() &&
        u.status === "suspended",
    )
  )
    commit(migrateState(state));
}
export function manageAccount(
  email: string,
  action: BlockKind | "unblock" | "delete",
  reason: string,
) {
  const admin = currentUser();
  const target = findUser(email);
  if (
    admin?.role !== "Admin" ||
    !target ||
    target.role === "Admin" ||
    target.deletedAt
  )
    throw new Error("Protected account or access denied");
  if (!reason.trim()) throw new Error("Please enter a reason");
  const deleted = action === "delete";
  const until =
    action === "24h"
      ? new Date(Date.now() + 86400000).toISOString()
      : action === "7d"
        ? new Date(Date.now() + 7 * 86400000).toISOString()
        : null;
  updateUser(email, {
    status: action === "unblock" ? "active" : "suspended",
    blockedUntil: until,
    blockKind: ["24h", "7d", "permanent"].includes(action)
      ? (action as BlockKind)
      : undefined,
    ...(deleted ? { deletedAt: nowISO() } : {}),
  });
  log(
    admin.name,
    "Admin",
    `${deleted ? "Deleted" : action === "unblock" ? "Unblocked" : "Blocked (" + action + ")"} account: ${reason.trim()}`,
    target.name,
    "#admin/users",
  );
  if (!deleted)
    notify(
      email,
      "system",
      action === "unblock" ? "Account reactivated" : "Account blocked",
      reason.trim(),
      "#login",
    );
  void api(`/admin/users/${encodeURIComponent(email)}/status`, {
    method: "PATCH",
    body: JSON.stringify({
      status: action === "unblock" ? "active" : "suspended",
      reason,
    }),
  })
    .then(() => syncFromApi(admin))
    .catch(() => undefined);
}
