import type { User } from "@/services/demoStore";
import type { TFn } from "@/data/sellerData";
import "./Listings.css";
import { Input as UiInput } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { Button as UiButton } from "@/components/ui/button";
import { useState } from "react";
import {
  Crumbs,
  Pager,
  Skeleton,
  StateBlock,
  useLoading,
} from "@/components/common/Portal";
import { TABS } from "@/data/sellerData";
import { useMine, Icon, Table } from "@/components/seller/SellerParts";
export function Listings({
  user,
  t,
  initTab,
}: {
  user: User;
  t: TFn;
  initTab: string;
}) {
  const mine = useMine(user);
  const loading = useLoading(450);
  const [tab, setTab] = useState(
    TABS.some((x) => x[0] === initTab) ? initTab : "all",
  );
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const f = TABS.find((x) => x[0] === tab)![2];
  const rows = mine
    .filter(f)
    .filter(
      (l) =>
        !q.trim() ||
        `${l.draft.name} ${l.id}`
          .toLowerCase()
          .includes(q.trim().toLowerCase()),
    );
  const pageRows = rows.slice((page - 1) * 5, page * 5);
  return (
    <>
      <Crumbs items={[[t("Seller Center"), "#admin"], [t("My Listings")]]} />
      <div className="sl-page-head">
        <div>
          <h1>{t("My Listings")}</h1>
        </div>
        <a
          className="sl-btn sl-btn-primary lg listings-view-2"
          href="#admin/add"
        >
          {t("+ Add New Fish")}
        </a>
      </div>
      <section className="sl-card">
        <div className="pt-tabs" role="tablist">
          {TABS.map(([k, label, fn]) => (
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
              {t(label)}
              <em>{mine.filter(fn).length}</em>
            </UiButton>
          ))}
        </div>
        <div className="pt-toolbar">
          <UiLabel className="pt-search">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 5 5" />
            </svg>
            <UiInput
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder={t("Search by name or ID")}
              aria-label={t("Search by name or ID")}
            />
          </UiLabel>
        </div>
        {loading ? (
          <Skeleton />
        ) : rows.length === 0 ? (
          q ? (
            <StateBlock
              icon="search"
              tone="info"
              title={t("No results")}
              body={`"${q}"`}
              actions={
                <UiButton
                  variant="plain"
                  className="sl-btn sl-btn-ghost"
                  onClick={() => setQ("")}
                >
                  {t("Clear search")}
                </UiButton>
              }
            />
          ) : (
            <StateBlock
              icon="inbox"
              tone="info"
              title={mine.length ? t("Nothing here yet") : t("No listings yet")}
              body={t(
                "Create your first listing to start selling on FISHMARKET.",
              )}
              actions={
                <a className="sl-btn sl-btn-primary" href="#admin/add">
                  {t("Add New Fish")}
                </a>
              }
            />
          )
        ) : (
          <Table rows={pageRows} t={t} vi={t("Live") !== "Live"} />
        )}
        {!loading && rows.length > 0 && (
          <Pager page={page} size={5} total={rows.length} onPage={setPage} />
        )}
      </section>
    </>
  );
}
