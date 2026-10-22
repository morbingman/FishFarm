import type { User } from "@/services/demoStore";
import type { Lang } from "@/hooks/useTranslation";
import "./Notifications.css";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Button as UiButton } from "@/components/ui/button";
import { useState } from "react";
import {
  Icon,
  StateBlock,
  Crumbs,
  Pager,
  Skeleton,
  useLoading,
  NotifItem,
  openNotif,
} from "@/components/common/Portal";
import {
  markAllRead,
  markRead,
  notifsFor,
  removeNotif,
  useStore,
  type NotifType,
} from "@/services/demoStore";
import { TYPES } from "@/data/accountData";
export function Notifications({
  user,
  language,
}: {
  user: User;
  language: Lang;
}) {
  const s = useStore();
  const loading = useLoading(400);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const mine = notifsFor(s, user);
  const rows = mine.filter(
    (n) =>
      (tab === "all" || !n.read) &&
      (type === "all" || n.type === (type as NotifType)),
  );
  const unread = mine.filter((n) => !n.read);
  return (
    <>
      <Crumbs items={[["Account", "#account/profile"], ["Notifications"]]} />
      <div className="sl-page-head">
        <div>
          <h1>Notifications</h1>
          <p>
            Every update that needs your attention links straight to the right
            page.
          </p>
        </div>
        <UiButton
          variant="plain"
          className="sl-btn sl-btn-ghost"
          disabled={!unread.length}
          onClick={() => markAllRead(unread.map((n) => n.id))}
        >
          Mark all as read
        </UiButton>
      </div>
      <section className="sl-card">
        <div className="pt-tabs">
          <UiButton
            variant="plain"
            className={tab === "all" ? "on" : ""}
            onClick={() => {
              setTab("all");
              setPage(1);
            }}
          >
            All<em>{mine.length}</em>
          </UiButton>
          <UiButton
            variant="plain"
            className={tab === "unread" ? "on" : ""}
            onClick={() => {
              setTab("unread");
              setPage(1);
            }}
          >
            Unread<em>{unread.length}</em>
          </UiButton>
        </div>
        <div className="pt-toolbar">
          <NativeSelect
            className="pt-select"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by type"
          >
            {TYPES.map(([k, l]) => (
              <NativeSelectOption key={k} value={k}>
                {l}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        {loading ? (
          <Skeleton />
        ) : rows.length === 0 ? (
          <StateBlock
            icon="inbox"
            tone="info"
            title={
              mine.length ? "No notifications match" : "You're all caught up"
            }
            body={
              mine.length
                ? "Try a different filter."
                : "Status changes, approvals and reminders will appear here."
            }
            actions={
              mine.length ? (
                <UiButton
                  variant="plain"
                  className="sl-btn sl-btn-ghost"
                  onClick={() => {
                    setTab("all");
                    setType("all");
                  }}
                >
                  Clear filters
                </UiButton>
              ) : undefined
            }
          />
        ) : (
          <div>
            {rows.slice((page - 1) * 8, page * 8).map((n) => (
              <div key={n.id} className="notifications-view-2">
                <div className="notifications-view-4">
                  <NotifItem n={n} vi={language === "vi"} onGo={openNotif} />
                </div>
                <div className="notifications-view-6">
                  <UiButton
                    variant="plain"
                    className="pt-iconbtn notifications-view-8"
                    title={n.read ? "Mark as unread" : "Mark as read"}
                    aria-label={n.read ? "Mark as unread" : "Mark as read"}
                    onClick={() => markRead(n.id, !n.read)}
                  >
                    <Icon name={n.read ? "eye" : "check"} size={15} />
                  </UiButton>
                  <UiButton
                    variant="plain"
                    className="pt-iconbtn notifications-view-10"
                    title="Delete"
                    aria-label="Delete notification"
                    onClick={() => removeNotif(n.id)}
                  >
                    <Icon name="trash" size={15} />
                  </UiButton>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && rows.length > 0 && (
          <Pager page={page} size={8} total={rows.length} onPage={setPage} />
        )}
      </section>
    </>
  );
}
