import type { User } from "@/services/demoStore";
import { TableCell as UiTableCell } from "@/components/ui/table";
import { TableBody as UiTableBody } from "@/components/ui/table";
import { TableHead as UiTableHead } from "@/components/ui/table";
import { TableRow as UiTableRow } from "@/components/ui/table";
import { TableHeader as UiTableHeader } from "@/components/ui/table";
import { Table as UiTable } from "@/components/ui/table";
import { useState } from "react";
import {
  StateBlock,
  Crumbs,
  Pager,
  Skeleton,
  useLoading,
} from "@/components/common/Portal";
import { fmtDate, timeAgo, useStore } from "@/services/demoStore";
export function History({ user }: { user: User }) {
  const s = useStore();
  const loading = useLoading(400);
  const [page, setPage] = useState(1);
  const rows = s.activity.filter(
    (a) => a.actor === user.name && a.role === user.role,
  );
  return (
    <>
      <Crumbs items={[["Account", "#account/profile"], ["Activity History"]]} />
      <div className="sl-page-head">
        <div>
          <h1>Activity history</h1>
          <p>A record of your important actions.</p>
        </div>
      </div>
      <section className="sl-card">
        {loading ? (
          <Skeleton />
        ) : rows.length === 0 ? (
          <StateBlock
            icon="activity"
            tone="info"
            title="No activity yet"
            body="When you submit listings, change settings or sign out, it will be recorded here."
            actions={
              <a
                className="sl-btn sl-btn-primary"
                href={
                  user.role === "Seller"
                    ? "#seller/add"
                    : user.role === "Admin"
                      ? "#admin"
                      : "#marketplace"
                }
              >
                Get started
              </a>
            }
          />
        ) : (
          <div className="sl-table-wrap">
            <UiTable className="sl-table">
              <UiTableHeader>
                <UiTableRow>
                  <UiTableHead>When</UiTableHead>
                  <UiTableHead>Action</UiTableHead>
                  <UiTableHead>Item</UiTableHead>
                </UiTableRow>
              </UiTableHeader>
              <UiTableBody>
                {rows.slice((page - 1) * 8, page * 8).map((a) => (
                  <UiTableRow key={a.id}>
                    <UiTableCell title={fmtDate(a.at)}>
                      {timeAgo(a.at)}
                    </UiTableCell>
                    <UiTableCell>{a.action}</UiTableCell>
                    <UiTableCell>
                      {a.target ? (
                        a.link ? (
                          <a className="sl-link" href={a.link}>
                            {a.target}
                          </a>
                        ) : (
                          a.target
                        )
                      ) : (
                        "—"
                      )}
                    </UiTableCell>
                  </UiTableRow>
                ))}
              </UiTableBody>
            </UiTable>
          </div>
        )}
        {!loading && rows.length > 0 && (
          <Pager page={page} size={8} total={rows.length} onPage={setPage} />
        )}
      </section>
    </>
  );
}
