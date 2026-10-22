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
import { Input as UiInput } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { Button as UiButton } from "@/components/ui/button";
import { useMemo, useState } from "react";
import {
  Icon,
  StatusChip,
  StateBlock,
  Crumbs,
  Pager,
  Skeleton,
  useLoading,
  go,
} from "@/components/common/Portal";
import { timeAgo, useStore } from "@/services/demoStore";
import { TABS, money } from "@/data/adminData";
export function Queue({ initTab }: { initTab: string }) {
  const s = useStore();
  const loading = useLoading(450);
  const [tab, setTab] = useState(
    TABS.some((t) => t[0] === initTab) ? initTab : "pending",
  );
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"oldest" | "newest">("oldest");
  const [page, setPage] = useState(1);
  const base = TABS.find((t) => t[0] === tab)!;
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return s.listings
      .filter(base[2])
      .filter(
        (l) =>
          !needle ||
          [l.draft.name, l.id, l.sellerName, l.draft.species].some((x) =>
            x.toLowerCase().includes(needle),
          ),
      )
      .sort(
        (a, b) =>
          (sort === "oldest" ? 1 : -1) *
          (new Date(a.submittedAt ?? a.createdAt).getTime() -
            new Date(b.submittedAt ?? b.createdAt).getTime()),
      );
  }, [s.listings, tab, q, sort]);
  const pageRows = rows.slice((page - 1) * 5, page * 5);
  return (
    <>
      <Crumbs items={[["Admin", "#admin"], ["Moderation Queue"]]} />
      <div className="sl-page-head">
        <div>
          <h1>Moderation queue</h1>
          <p>Review, publish or request changes to fish listings.</p>
        </div>
      </div>
      <section className="sl-card">
        <div className="pt-tabs" role="tablist">
          {TABS.map(([k, label, f]) => (
            <UiButton
              variant="plain"
              key={k}
              role="tab"
              aria-selected={tab === k}
              className={tab === k ? "on" : ""}
              onClick={() => {
                setTab(k);
                setPage(1);
              }}
            >
              {label}
              <em>{s.listings.filter(f).length}</em>
            </UiButton>
          ))}
        </div>
        <div className="pt-toolbar">
          <UiLabel className="pt-search">
            <Icon name="search" size={16} />
            <UiInput
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, ID or farm"
              aria-label="Search listings"
            />
          </UiLabel>
          <NativeSelect
            className="pt-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as "oldest" | "newest")}
            aria-label="Sort"
          >
            <NativeSelectOption value="oldest">Oldest first</NativeSelectOption>
            <NativeSelectOption value="newest">Newest first</NativeSelectOption>
          </NativeSelect>
        </div>
        {loading ? (
          <Skeleton />
        ) : rows.length === 0 ? (
          q ? (
            <StateBlock
              icon="search"
              tone="info"
              title="No results"
              body={`No listings match "${q}" in this tab. Check the spelling or try a different search.`}
              actions={
                <UiButton
                  variant="plain"
                  className="sl-btn sl-btn-ghost"
                  onClick={() => setQ("")}
                >
                  Clear search
                </UiButton>
              }
            />
          ) : (
            <StateBlock
              icon="inbox"
              tone="info"
              title="Nothing here yet"
              body={
                tab === "pending"
                  ? "There are no listings waiting for review. You're all caught up."
                  : "No listings have this status."
              }
            />
          )
        ) : (
          <div className="sl-table-wrap">
            <UiTable className="sl-table">
              <UiTableHeader>
                <UiTableRow>
                  <UiTableHead>Listing</UiTableHead>
                  <UiTableHead>Farm / source</UiTableHead>
                  <UiTableHead>Price</UiTableHead>
                  <UiTableHead>Status</UiTableHead>
                  <UiTableHead>Submitted</UiTableHead>
                </UiTableRow>
              </UiTableHeader>
              <UiTableBody>
                {pageRows.map((l) => (
                  <UiTableRow
                    key={l.id}
                    className="pt-row-click"
                    tabIndex={0}
                    onClick={() => go(`admin/review/${l.id}`)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && go(`admin/review/${l.id}`)
                    }
                  >
                    <UiTableCell>
                      <div className="sl-cell">
                        {l.draft.images[0] && (
                          <img src={l.draft.images[0].url} alt="" />
                        )}
                        <div>
                          <b>{l.draft.name}</b>
                          <small>
                            {l.id} · {l.draft.species}
                          </small>
                        </div>
                      </div>
                    </UiTableCell>
                    <UiTableCell>{l.sellerName}</UiTableCell>
                    <UiTableCell>{money(l.draft.price)}</UiTableCell>
                    <UiTableCell>
                      <StatusChip s={l.status} />
                    </UiTableCell>
                    <UiTableCell>
                      {l.submittedAt ? timeAgo(l.submittedAt) : "—"}
                    </UiTableCell>
                  </UiTableRow>
                ))}
              </UiTableBody>
            </UiTable>
          </div>
        )}
        {!loading && rows.length > 0 && (
          <Pager page={page} size={5} total={rows.length} onPage={setPage} />
        )}
      </section>
    </>
  );
}
