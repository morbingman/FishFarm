import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
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
export function ActivityLog() {
  const s = useStore();
  const loading = useLoading(400);
  const [role, setRole] = useState("all");
  const [page, setPage] = useState(1);
  const rows = s.activity.filter((a) => role === "all" || a.role === role);
  return (
    <>
      <Crumbs items={[["Admin", "#admin"], ["Activity Log"]]} />
      <div className="sl-page-head">
        <div>
          <h1>Activity log</h1>
          <p>A record of every important action on the platform.</p>
        </div>
      </div>
      <section className="sl-card">
        <div className="pt-toolbar">
          <NativeSelect
            className="pt-select"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by role"
          >
            <NativeSelectOption value="all">All roles</NativeSelectOption>
            <NativeSelectOption>Admin</NativeSelectOption>
            <NativeSelectOption>Seller</NativeSelectOption>
            <NativeSelectOption>Buyer</NativeSelectOption>
          </NativeSelect>
        </div>
        {loading ? (
          <Skeleton />
        ) : rows.length === 0 ? (
          <StateBlock
            icon="activity"
            tone="info"
            title="No activity yet"
            body="Actions taken by users and admins will be recorded here."
          />
        ) : (
          <div className="sl-table-wrap">
            <UiTable className="sl-table">
              <UiTableHeader>
                <UiTableRow>
                  <UiTableHead>When</UiTableHead>
                  <UiTableHead>Who</UiTableHead>
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
                    <UiTableCell>
                      <b>{a.actor}</b>
                      <br />
                      <small className="pt-mini">{a.role}</small>
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
