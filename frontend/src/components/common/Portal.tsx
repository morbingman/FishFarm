import { ADMIN_NAV } from "@/data/adminNavigation";
import type { ReactNode } from "react";
import type { LStatus, Notif, User, Role } from "@/services/demoStore";
import type { Lang } from "@/hooks/useTranslation";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { type CSSProperties } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button as UiButton } from "@/components/ui/button";
import { Input as UiInput } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { useEffect, useRef, useState } from "react";
import "@/pages/seller/Seller.css";
import "@/components/common/Portal.css";
import "@/styles/theme.css";
import { SiteFooter } from "@/components/layout/SiteHeader";
import { useDomTranslation } from "@/hooks/useTranslation";
import {
  markAllRead,
  markRead,
  notifsFor,
  signOut,
  timeAgo,
  useStore,
} from "@/services/demoStore";
export type IconName =
  | "bell"
  | "user"
  | "gear"
  | "list"
  | "dash"
  | "shield"
  | "users"
  | "clock"
  | "check"
  | "x"
  | "alert"
  | "search"
  | "logout"
  | "arrow"
  | "left"
  | "plus"
  | "fish"
  | "activity"
  | "lock"
  | "inbox"
  | "bag"
  | "chart"
  | "store"
  | "msg"
  | "star"
  | "swap"
  | "eye"
  | "edit"
  | "trash"
  | "pause"
  | "play"
  | "waves"
  | "clipboard"
  | "truck"
  | "calendar"
  | "camera"
  | "map"
  | "info"
  | "filter"
  | "minus"
  | "droplet"
  | "card";
const ICONS: Record<IconName, ReactNode> = {
  bell: (
    <path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0" />
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c.6-4.5 4-7 8-7s7.400 2.500 8 7" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </>
  ),
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  dash: <path d="M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z" />,
  shield: (
    <>
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" />
      <path d="m8.500 12 2.500 2.500 4.500-5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.500" />
      <path d="M2.500 20c.5-4 3-6 6.500-6s6 2 6.500 6M16 4.500a3.500 3.500 0 0 1 0 7M18 14c2 .6 3.300 2.400 3.500 5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  check: <path d="m5 12 4.500 4.500L19 7" />,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  alert: (
    <>
      <path d="M12 3 2 20h20z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.500-3.500" />
    </>
  ),
  logout: <path d="M10 4H5v16h5M16 8l4 4-4 4M20 12H9" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  left: <path d="m15 5-7 7 7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  fish: (
    <>
      <path d="M3 12s4-6 10-6c4 0 8 6 8 6s-4 6-8 6c-6 0-10-6-10-6zm0 0L1 7v10z" />
      <circle cx="16" cy="11" r="1" />
    </>
  ),
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  inbox: <path d="M3 13h5l1 3h6l1-3h5M5 5h14l2 8v6H3v-6z" />,
  bag: (
    <>
      <path d="M5 7h14l1.500 14h-17z" />
      <path d="M8 9V6a4 4 0 0 1 8 0v3" />
    </>
  ),
  chart: <path d="M4 20V4M4 20h16M8 16v-5M13 16V8M18 16v-3" />,
  store: (
    <path d="M3 9l1.500-5h15L21 9M3 9v1a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9M5 13v8h14v-8M10 21v-5h4v5" />
  ),
  msg: (
    <path d="M21 14a3 3 0 0 1-3 3H9l-5 4V6a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3z" />
  ),
  star: (
    <path d="m12 3 2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.9z" />
  ),
  swap: <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />,
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.500 6.500l4 4" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  pause: <path d="M8 5v14M16 5v14" />,
  play: <path d="m7 4 13 8-13 8z" />,
  waves: (
    <path d="M2 7c2.500-2 4.500-2 7 0s4.500 2 7 0 4-1.500 6 0M2 13c2.500-2 4.500-2 7 0s4.500 2 7 0 4-1.500 6 0M2 19c2.500-2 4.500-2 7 0s4.500 2 7 0 4-1.500 6 0" />
  ),
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1M9 11h6M9 15h4" />
    </>
  ),
  truck: (
    <path d="M2 6h12v10H2zM14 10h4l4 3v3h-8M6 19a1.500 1.500 0 1 0 0-.01M17 19a1.500 1.500 0 1 0 0-.01" />
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v12H4z" />
      <circle cx="12" cy="13" r="3.500" />
    </>
  ),
  map: (
    <>
      <path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.500" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.500h.01" />
    </>
  ),
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8z" />,
  minus: <path d="M5 12h14" />,
  droplet: <path d="M12 3s6 6.500 6 11a6 6 0 0 1-12 0c0-4.500 6-11 6-11z" />,
  card: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20M6 15h4" />
    </>
  ),
};
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}
export const go = (hash: string) => {
  window.location.hash = hash.replace(/^#/, "");
};
export const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
export const STATUS_LABEL: Record<LStatus, string> = {
  draft: "Draft",
  pending: "Pending Review",
  approved: "Live",
  changes: "Changes Requested",
  rejected: "Rejected",
  paused: "Paused",
};
export type StatusKind =
  | "pending"
  | "approved"
  | "rejected"
  | "processing"
  | "completed"
  | "cancelled"
  | "failed"
  | "active"
  | "inactive"
  | "draft";
const KIND_LABEL: Record<StatusKind, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  processing: "Processing",
  completed: "Completed",
  cancelled: "Cancelled",
  failed: "Failed",
  active: "Active",
  inactive: "Inactive",
  draft: "Draft",
};
const KIND_TONE: Record<StatusKind, string> = {
  pending: "warn",
  approved: "ok",
  rejected: "bad",
  processing: "info",
  completed: "ok",
  cancelled: "muted",
  failed: "bad",
  active: "ok",
  inactive: "muted",
  draft: "muted",
};
export function StatusBadge({
  kind,
  label,
}: {
  kind: StatusKind;
  label?: string;
}) {
  return (
    <span className={`ds-badge ds-badge-${KIND_TONE[kind]}`}>
      <i />
      {label ?? KIND_LABEL[kind]}
    </span>
  );
}
const LSTATUS_KIND: Record<LStatus, StatusKind> = {
  draft: "draft",
  pending: "pending",
  approved: "approved",
  changes: "pending",
  rejected: "rejected",
  paused: "inactive",
};
export function StatusChip({ s }: { s: LStatus }) {
  return <StatusBadge kind={LSTATUS_KIND[s]} label={STATUS_LABEL[s]} />;
}

/* ---------- toast ---------- */
export function useToast(): [ReactNode, (m: string) => void] {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(""), 3000);
    return () => clearTimeout(id);
  }, [msg]);
  return [
    msg ? (
      <div className="sl-toast" role="status" key="toast">
        {msg}
      </div>
    ) : null,
    setMsg,
  ];
}

/* ---------- state block (empty / error / denied / expired ...) ---------- */
export function StateBlock({
  icon,
  tone = "ok",
  title,
  body,
  actions,
  card,
}: {
  icon: IconName;
  tone?: "ok" | "error" | "warn" | "info";
  title: string;
  body: string;
  actions?: ReactNode;
  card?: boolean;
}) {
  return (
    <div
      className={`pt-state ${card ? "card" : ""}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <span className={`pt-state-ic ${tone}`}>
        <Icon name={icon} size={28} />
      </span>
      <h2>{title}</h2>
      <p>{body}</p>
      {actions && <div className="pt-state-actions">{actions}</div>}
    </div>
  );
}
export function Banner({
  tone,
  children,
  action,
}: {
  tone: "error" | "warn" | "ok" | "info";
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className={`pt-banner ${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon name={tone === "ok" ? "check" : "alert"} />
      {<span>{children}</span>}
      {action}
    </div>
  );
}
export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="portal-view-2">
      {Array.from(
        {
          length: rows,
        },
        (_, i) => (
          <div
            key={i}
            className="pt-skel portal-view-4"
            style={
              {
                "--portal-layout-3-width": `${95 - i * 9}%`,
              } as CSSProperties
            }
          />
        ),
      )}
    </div>
  );
}
export function useLoading(ms = 550) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setLoading(false), ms);
    return () => clearTimeout(id);
  }, [ms]);
  return loading;
}

/* ---------- confirm dialog ---------- */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger,
  busy,
  error,
  requireText,
  onConfirm,
  onCancel,
  children,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  error?: string;
  requireText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const [typed, setTyped] = useState("");
  const blocked = busy || (!!requireText && typed.trim() !== requireText);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
    >
      <DialogContent
        className="sl-app pt-modal"
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        {requireText && (
          <UiLabel className="sl-field">
            <span>
              Type <b>{requireText}</b> to confirm
            </span>
            <UiInput
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
            />
          </UiLabel>
        )}
        {children}
        {error && <Banner tone="error">{error}</Banner>}
        <DialogFooter>
          <UiButton
            variant="plain"
            className="sl-btn sl-btn-ghost"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </UiButton>
          <UiButton
            variant="plain"
            className={`sl-btn ${danger ? "sl-btn-danger" : "sl-btn-primary"}`}
            onClick={onConfirm}
            disabled={blocked}
          >
            {busy ? "Processing…" : confirmLabel}
          </UiButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- breadcrumbs / pagination ---------- */
export function Crumbs({ items }: { items: [string, string?][] }) {
  return (
    <nav className="pt-crumbs" aria-label="Breadcrumb">
      {items.map(([label, href], i) => (
        <span key={label + i} className="portal-view-6">
          {i > 0 && <span aria-hidden>/</span>}
          {href ? (
            <a href={href}>{label}</a>
          ) : (
            <span aria-current="page">{label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
export function Pager({
  page,
  size,
  total,
  onPage,
}: {
  page: number;
  size: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (total <= size)
    return (
      <div className="pt-pager">
        <span>
          Showing {total} of {total}
        </span>
      </div>
    );
  return (
    <div className="pt-pager">
      <span>
        Showing {(page - 1) * size + 1}–{Math.min(total, page * size)} of{" "}
        {total}
      </span>
      <div>
        <UiButton
          variant="plain"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <Icon name="left" size={14} />
        </UiButton>
        {Array.from(
          {
            length: pages,
          },
          (_, i) => (
            <UiButton
              variant="plain"
              key={i}
              className={page === i + 1 ? "on" : ""}
              onClick={() => onPage(i + 1)}
              aria-current={page === i + 1 ? "page" : undefined}
            >
              {i + 1}
            </UiButton>
          ),
        )}
        <UiButton
          variant="plain"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          aria-label="Next page"
          className="portal-view-8"
        >
          <Icon name="left" size={14} />
        </UiButton>
      </div>
    </div>
  );
}

/* ---------- notifications ---------- */
const NIC: Record<Notif["type"], IconName> = {
  success: "check",
  error: "alert",
  system: "shield",
  status: "activity",
  approval: "check",
  reminder: "clock",
};
export function NotifItem({
  n,
  vi,
  onGo,
}: {
  n: Notif;
  vi: boolean;
  onGo: (n: Notif) => void;
}) {
  return (
    <UiButton
      variant="plain"
      className={`pt-notif ${n.read ? "" : "unread"}`}
      onClick={() => onGo(n)}
    >
      <span className={`pt-notif-ic ${n.type}`}>
        <Icon name={NIC[n.type]} size={16} />
      </span>
      <div>
        <b>{n.title}</b>
        <span>{n.body}</span>
        <small>{timeAgo(n.at, vi)}</small>
      </div>
    </UiButton>
  );
}
export const openNotif = (n: Notif) => {
  markRead(n.id);
  go(n.link);
};
export function NotifBell({
  user,
  language,
  triggerLabel,
}: {
  user: User;
  language: Lang;
  triggerLabel?: string;
}) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const mine = notifsFor(s, user);
  const unread = mine.filter((n) => !n.read);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <UiButton
          variant="plain"
          className={triggerLabel ? "workspace-notifications" : "pt-iconbtn"}
          aria-label={`Notifications${
            unread.length ? `, ${unread.length} unread` : ""
          }`}
          aria-expanded={open}
        >
          <Icon name="bell" />
          {triggerLabel && (
            <span className="workspace-label">{triggerLabel}</span>
          )}
          {unread.length > 0 && (
            <span className="pt-badge">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </UiButton>
      </PopoverTrigger>
      <PopoverContent
        className="pt-pop sl-app ui-floating-panel"
        aria-label="Notifications"
        align="end"
        sideOffset={18}
        collisionPadding={12}
      >
        <div className="pt-pop-head">
          <b>Notifications</b>
          <UiButton
            variant="plain"
            className="sl-link"
            disabled={!unread.length}
            onClick={() => markAllRead(unread.map((n) => n.id))}
          >
            Mark all as read
          </UiButton>
        </div>
        <div className="pt-pop-list">
          {mine.length === 0 ? (
            <StateBlock
              icon="inbox"
              tone="info"
              title="You're all caught up"
              body="Status changes, approvals and reminders will show up here."
            />
          ) : (
            mine.slice(0, 4).map((n) => (
              <NotifItem
                key={n.id}
                n={n}
                vi={language === "vi"}
                onGo={(x) => {
                  setOpen(false);
                  openNotif(x);
                }}
              />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
export function UserMenu({ user, dark }: { user: User; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <UiButton
          variant="plain"
          className="pt-avatar-btn"
          aria-label="Account menu"
          aria-expanded={open}
        >
          <span className={`sl-avatar ${dark ? "light" : ""}`}>
            {initials(user.name)}
          </span>
        </UiButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="pt-menu sl-app ui-floating-panel"
        align="end"
      >
        <div className="pt-menu-head">
          <b>{user.name}</b>
          <small>
            {user.role} · {user.email}
          </small>
        </div>
        {user.role !== "Admin" && (
          <>
            <DropdownMenuItem asChild>
              <UiButton
                variant="plain"
                onClick={() => {
                  setOpen(false);
                  go("account/profile");
                }}
              >
                <Icon name="user" size={16} />
                Profile
              </UiButton>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <UiButton
                variant="plain"
                onClick={() => {
                  setOpen(false);
                  go("account/settings");
                }}
              >
                <Icon name="gear" size={16} />
                Account settings
              </UiButton>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <UiButton
                variant="plain"
                onClick={() => {
                  setOpen(false);
                  go("account/notifications");
                }}
              >
                <Icon name="bell" size={16} />
                Notifications
              </UiButton>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem asChild>
          <UiButton
            variant="plain"
            onClick={() => {
              setOpen(false);
              signOut(
                "Signed out. Sign in with another demo account to continue.",
              );
            }}
          >
            <Icon name="swap" size={16} />
            Switch account
          </UiButton>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <UiButton
            variant="plain"
            className="danger"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
          >
            <Icon name="logout" size={16} />
            Sign out
          </UiButton>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------- portal shell (Admin + Account) ---------- */
export type NavItem = {
  label: string;
  href: string;
  icon: IconName;
  badge?: number;
};
const FARM_NAV: NavItem = {
  label: "Farm a Fish",
  href: "#farming",
  icon: "waves",
};
export const FARM_ORDERS_NAV: NavItem = {
  label: "Farming Orders",
  href: "#account/farming-orders",
  icon: "clipboard",
};
export const ROLE_NAV: Record<Role, NavItem[]> = {
  Buyer: [
    {
      label: "Marketplace",
      href: "#marketplace",
      icon: "fish",
    },
    FARM_NAV,
  ],
  Admin: ADMIN_NAV,
};
export const ACCOUNT_NAV: NavItem[] = [
  {
    label: "Profile",
    href: "#account/profile",
    icon: "user",
  },
  {
    label: "Account Settings",
    href: "#account/settings",
    icon: "gear",
  },
  {
    label: "Notifications",
    href: "#account/notifications",
    icon: "bell",
  },
  {
    label: "Activity History",
    href: "#account/activity",
    icon: "activity",
  },
];
export function PortalShell({
  user,
  active,
  language,
  setLanguage,
  dict,
  children,
  badges,
  toast,
}: {
  user: User;
  active: string;
  language: Lang;
  setLanguage: (l: Lang) => void;
  dict: Record<string, string>;
  children: ReactNode;
  badges?: Record<string, number>;
  toast?: ReactNode;
}) {
  useDomTranslation(language, dict);
  return (
    <div className="sl-app pt-app">
      <main className="sl-main">
        {children}
        <SiteFooter language={language} />
      </main>
      {toast}
    </div>
  );
}

/* ---------- full-page states ---------- */
export function FullState({ children }: { children: ReactNode }) {
  return <div className="pt-fullpage sl-app">{children}</div>;
}
export function AccessDenied({
  user,
  needs,
  language,
  setLanguage,
}: {
  user: User;
  needs: string;
  language: Lang;
  setLanguage: (l: Lang) => void;
}) {
  useDomTranslation(language, {
    "Access denied": "Truy cập bị từ chối",
    "Go to my dashboard": "Về trang của tôi",
    "Switch account": "Đổi tài khoản",
    "Back to homepage": "Về trang chủ",
  });
  const home = user.role === "Admin" ? "#admin" : "#marketplace";
  return (
    <FullState>
      <div className="pt-fullbody">
        {" "}
        <StateBlock
          icon="lock"
          tone="error"
          title="Access denied"
          body={`This area is only available to ${needs} accounts. You are signed in as ${user.name} (${user.role}), which doesn't have permission to view it.`}
          actions={
            <>
              <a className="sl-btn sl-btn-primary" href={home}>
                Go to my dashboard
              </a>
              <UiButton
                variant="plain"
                className="sl-btn sl-btn-ghost"
                onClick={() =>
                  signOut("Signed out. Sign in with a different account.")
                }
              >
                Switch account
              </UiButton>
              <a className="sl-btn sl-btn-ghost" href="#home">
                Back to homepage
              </a>
            </>
          }
        />
      </div>
    </FullState>
  );
}
export function SessionExpired({
  language,
  setLanguage,
}: {
  language: Lang;
  setLanguage: (l: Lang) => void;
}) {
  useDomTranslation(language, {
    "Your session expired": "Phiên đăng nhập đã hết hạn",
    "Your seven-day session has expired. Sign in again to continue.": "Phiên đăng nhập 7 ngày đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.",
    "Sign in again": "Đăng nhập lại",
    "Back to homepage": "Về trang chủ",
  });
  return (
    <FullState>
      <div className="pt-fullbody">
        {" "}
        <StateBlock
          icon="clock"
          tone="warn"
          title="Your session expired"
          body="Your seven-day session has expired. Sign in again to continue."
          actions={
            <>
              <a className="sl-btn sl-btn-primary" href="#login">
                Sign in again
              </a>
              <a className="sl-btn sl-btn-ghost" href="#home">
                Back to homepage
              </a>
            </>
          }
        />
      </div>
    </FullState>
  );
}
export function NotFound({
  language,
  setLanguage,
  home,
}: {
  language: Lang;
  setLanguage: (l: Lang) => void;
  home: string;
}) {
  useDomTranslation(language, {
    "Page not found": "Không tìm thấy trang",
    "Go back": "Quay lại",
    "Take me home": "Về trang chủ",
  });
  return (
    <FullState>
      <div className="pt-fullbody">
        {" "}
        <StateBlock
          icon="search"
          tone="info"
          title="Page not found"
          body="The page you're looking for doesn't exist or has been moved. Check the address, or head back to somewhere familiar."
          actions={
            <>
              <UiButton
                variant="plain"
                className="sl-btn sl-btn-ghost"
                onClick={() => window.history.back()}
              >
                Go back
              </UiButton>
              <a className="sl-btn sl-btn-primary" href={home}>
                Take me home
              </a>
            </>
          }
        />
      </div>
    </FullState>
  );
}
export function useHash() {
  const [h, setH] = useState(() => window.location.hash);
  useEffect(() => {
    const f = () => setH(window.location.hash);
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  const [path, query = ""] = h.replace(/^#/, "").split("?");
  return {
    hash: h,
    parts: path.split("/").filter(Boolean),
    params: new URLSearchParams(query),
  };
}
