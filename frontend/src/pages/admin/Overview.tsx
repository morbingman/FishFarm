import type { LStatus } from "@/services/demoStore";
import "./Overview.css";
import { TableCell as UiTableCell } from "@/components/ui/table";
import { TableBody as UiTableBody } from "@/components/ui/table";
import { TableHead as UiTableHead } from "@/components/ui/table";
import { TableRow as UiTableRow } from "@/components/ui/table";
import { TableHeader as UiTableHeader } from "@/components/ui/table";
import { Table as UiTable } from "@/components/ui/table";
import { Button as UiButton } from "@/components/ui/button";
import {
  Icon,
  StateBlock,
  Skeleton,
  useLoading,
  go,
} from "@/components/common/Portal";
import { timeAgo, useStore } from "@/services/demoStore";
import { waitingHours } from "@/data/adminData";
export function Overview() {
  const s = useStore();
  const loading = useLoading();
  const c = (st: LStatus) => s.listings.filter((l) => l.status === st).length;
  const queue = s.listings
    .filter((l) => l.status === "pending")
    .sort((a, b) => waitingHours(b) - waitingHours(a));
  const kpis: [
    string,
    number,
    string,
    string,
    "shield" | "check" | "alert" | "users",
  ][] = [
    [
      "Pending review",
      c("pending"),
      "#admin/queue?tab=pending",
      "Review queue",
      "shield",
    ],
    [
      "Live listings",
      c("approved"),
      "#admin/queue?tab=approved",
      "View live listings",
      "check",
    ],
    [
      "Changes / rejected",
      c("changes") + c("rejected"),
      "#admin/queue?tab=changes",
      "See sent back",
      "alert",
    ],
    [
      "Active users",
      s.users.filter((u) => u.status === "active").length,
      "#admin/users",
      "Manage users",
      "users",
    ],
  ];
  return (
    <>
      <div className="sl-page-head">
        <div>
          <span className="sl-eyebrow">Admin Console</span>
          <h1>Marketplace overview</h1>
          <p>Everything that needs your attention, in one place.</p>
        </div>
        <UiButton
          variant="plain"
          className="sl-btn sl-btn-primary lg"
          disabled={!queue.length}
          onClick={() => go(`admin/review/${queue[0].id}`)}
        >
          Review next listing <Icon name="arrow" />
        </UiButton>
      </div>
      <div className="sl-stats">
        {kpis.map(([label, n, href, cta, ic]) => (
          <UiButton
            variant="plain"
            key={label}
            className="sl-stat pt-kpi"
            onClick={() => go(href)}
          >
            <div className="sl-stat-top">
              <span>
                <Icon name={ic} />
              </span>
            </div>
            <strong>{n}</strong>
            <small>{label}</small>
            <span className="go">
              {cta} <Icon name="arrow" size={13} />
            </span>
          </UiButton>
        ))}
      </div>
      <div className="pt-grid2">
        <section className="sl-card">
          <div className="sl-card-head">
            <h2>Needs attention</h2>
            <a className="sl-link" href="#admin/queue?tab=pending">
              View queue
            </a>
          </div>
          {loading ? (
            <Skeleton rows={3} />
          ) : queue.length === 0 ? (
            <StateBlock
              icon="check"
              title="Queue is clear"
              body="No listings are waiting for review. New submissions will appear here and in your notifications."
            />
          ) : (
            <div className="sl-table-wrap">
              <UiTable className="sl-table">
                <UiTableHeader>
                  <UiTableRow>
                    <UiTableHead>Listing</UiTableHead>
                    <UiTableHead>Seller</UiTableHead>
                    <UiTableHead>Waiting</UiTableHead>
                  </UiTableRow>
                </UiTableHeader>
                <UiTableBody>
                  {queue.slice(0, 5).map((l) => (
                    <UiTableRow
                      key={l.id}
                      className="pt-row-click"
                      onClick={() => go(`admin/review/${l.id}`)}
                    >
                      <UiTableCell>
                        <b>{l.draft.name}</b>
                        <br />
                        <small className="pt-mini">{l.id}</small>
                      </UiTableCell>
                      <UiTableCell>{l.sellerName}</UiTableCell>
                      <UiTableCell>{waitingHours(l)} h</UiTableCell>
                    </UiTableRow>
                  ))}
                </UiTableBody>
              </UiTable>
            </div>
          )}
        </section>
        <section className="sl-card">
          <div className="sl-card-head">
            <h2>Recent activity</h2>
            <a className="sl-link" href="#admin/activity">
              View all
            </a>
          </div>
          {loading ? (
            <Skeleton rows={4} />
          ) : (
            <ul className="pt-timeline overview-view-2">
              {s.activity.slice(0, 5).map((a) => (
                <li key={a.id}>
                  <b>{a.action}</b>
                  {a.target &&
                    (a.link ? (
                      <a href={a.link} className="sl-link">
                        {a.target}
                      </a>
                    ) : (
                      <span>{a.target}</span>
                    ))}
                  <small>
                    {a.actor} · {timeAgo(a.at)}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
