import type { ReactNode } from "react";
import type { Img, User, Listing } from "@/services/demoStore";
import type { TFn } from "@/data/sellerData";
import "./SellerParts.css";
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
import { Button as UiButton } from "@/components/ui/button";
import { Label as UiLabel } from "@/components/ui/label";
import { useMemo, useState } from "react";
import { StatusChip, go } from "@/components/common/Portal";
import { timeAgo, useStore } from "@/services/demoStore";
import { money } from "@/data/sellerData";
export type IconName =
  | "dash"
  | "list"
  | "plus"
  | "bag"
  | "users"
  | "msg"
  | "chart"
  | "star"
  | "store"
  | "gear"
  | "upload"
  | "trash"
  | "left"
  | "right"
  | "check"
  | "clock"
  | "shield"
  | "pin"
  | "truck"
  | "x"
  | "fish"
  | "arrow"
  | "eye"
  | "heart"
  | "flag"
  | "edit"
  | "alert";
export const ICONS: Record<IconName, ReactNode> = {
  dash: <path d="M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  plus: <path d="M12 5v14M5 12h14" />,
  bag: (
    <>
      <path d="M5 7h14l1.5 14h-17z" />
      <path d="M8 9V6a4 4 0 0 1 8 0v3" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.5-4 3-6 6.5-6s6 2 6.5 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .6 3.3 2.4 3.5 5" />
    </>
  ),
  msg: (
    <path d="M21 14a3 3 0 0 1-3 3H9l-5 4V6a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3z" />
  ),
  chart: <path d="M4 20V4M4 20h16M8 16v-5M13 16V8M18 16v-3" />,
  star: (
    <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
  ),
  store: (
    <path d="M3 9l1.5-5h15L21 9M3 9v1a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9M5 13v8h14v-8M10 21v-5h4v5" />
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </>
  ),
  upload: <path d="M12 16V4m0 0L7 9m5-5 5 5M4 16v4h16v-4" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  left: <path d="m15 5-7 7 7 7" />,
  right: <path d="m9 5 7 7-7 7" />,
  check: <path d="m5 12 4.5 4.5L19 7" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  shield: (
    <>
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 22s7-6.3 7-12a7 7 0 0 0-14 0c0 5.7 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  truck: (
    <path d="M2 6h11v10H2zM13 9h4l4 4v3h-8M6.5 19a1.5 1.5 0 1 0 0-.01M17.5 19a1.5 1.5 0 1 0 0-.01" />
  ),
  x: <path d="m6 6 12 12M18 6 6 18" />,
  fish: (
    <>
      <path d="M3 12s4-6 10-6c4 0 8 6 8 6s-4 6-8 6c-6 0-10-6-10-6zm0 0L1 7v10z" />
      <circle cx="16" cy="11" r="1" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  heart: (
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8z" />
  ),
  flag: <path d="M5 21V4m0 0h12l-2 4 2 4H5" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  alert: (
    <>
      <path d="M12 3 2 20h20z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
};
export function Icon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      className={`sl-icon ${className}`}
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
export function Field({
  id,
  label,
  children,
  hint,
  bad,
  t,
  optional,
}: {
  id: string;
  label: string;
  children: ReactNode;
  hint?: string;
  bad: boolean;
  t: (s: string) => string;
  optional?: boolean;
}) {
  return (
    <UiLabel className={`sl-field ${bad ? "bad" : ""}`} data-field={id}>
      <span>
        {t(label)}
        {optional ? (
          <i className="seller-parts-view-2"> ({t("optional")})</i>
        ) : (
          " *"
        )}
      </span>
      {children}
      {bad ? <em>{t("Required")}</em> : hint ? <small>{hint}</small> : null}
    </UiLabel>
  );
}
export function Select({
  id,
  label,
  value,
  options,
  onChange,
  bad,
  t,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  bad: boolean;
  t: (s: string) => string;
}) {
  return (
    <Field t={t} bad={bad} id={id} label={label}>
      <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>
        <NativeSelectOption value="">{t("Select")}</NativeSelectOption>
        {options.map((o) => (
          <NativeSelectOption key={o} value={o}>
            {t(o)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );
}
export function Gallery({
  imgs,
  main,
  alt,
}: {
  imgs: Img[];
  main?: Img;
  alt: string;
}) {
  const [sel, setSel] = useState(main?.id ?? imgs[0]?.id);
  const cur = imgs.find((i) => i.id === sel) ?? main ?? imgs[0];
  return (
    <div className="sl-gallery">
      <div className="sl-gallery-main">
        {cur ? (
          <img src={cur.url} alt={alt} />
        ) : (
          <div className="sl-noimg">
            <Icon name="fish" />
          </div>
        )}
      </div>
      {imgs.length > 1 && (
        <div className="sl-gallery-thumbs">
          {imgs.map((i) => (
            <UiButton
              variant="plain"
              key={i.id}
              className={i.id === cur?.id ? "on" : ""}
              onClick={() => setSel(i.id)}
              aria-label="Show photo"
            >
              <img src={i.url} alt="" />
            </UiButton>
          ))}
        </div>
      )}
    </div>
  );
}
export function useMine(user: User) {
  const s = useStore();
  return useMemo(
    () =>
      s.listings
        .filter((l) => user.role === "Admin" || l.owner === user.email)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [s.listings, user.email],
  );
}
export function Table({
  rows,
  t,
  vi: isVi,
}: {
  rows: Listing[];
  t: TFn;
  vi: boolean;
}) {
  return (
    <div className="sl-table-wrap">
      <UiTable className="sl-table">
        <UiTableHeader>
          <UiTableRow>
            <UiTableHead>{t("Listing")}</UiTableHead>
            <UiTableHead>{t("Price")}</UiTableHead>
            <UiTableHead>{t("Status")}</UiTableHead>
            <UiTableHead>{t("Views")}</UiTableHead>
            <UiTableHead>{t("Updated")}</UiTableHead>
          </UiTableRow>
        </UiTableHeader>
        <UiTableBody>
          {rows.map((l) => (
            <UiTableRow
              key={l.id}
              className="pt-row-click"
              tabIndex={0}
              onClick={() => go(`admin/listing/${l.id}`)}
              onKeyDown={(e) =>
                e.key === "Enter" && go(`admin/listing/${l.id}`)
              }
            >
              <UiTableCell>
                <div className="sl-cell">
                  {l.draft.images[0] ? (
                    <img src={l.draft.images[0].url} alt="" />
                  ) : (
                    <span className="sl-noimg sm">
                      <Icon name="fish" />
                    </span>
                  )}
                  <div>
                    <b>{l.draft.name || "Untitled"}</b>
                    <small>
                      {l.id} · {t(l.draft.species) || "—"}
                    </small>
                  </div>
                </div>
              </UiTableCell>
              <UiTableCell>
                {l.draft.price ? money(l.draft.price) : "—"}
              </UiTableCell>
              <UiTableCell>
                <StatusChip s={l.status} />
              </UiTableCell>
              <UiTableCell>
                {l.status === "approved" || l.status === "paused"
                  ? l.views.toLocaleString()
                  : "—"}
              </UiTableCell>
              <UiTableCell>{timeAgo(l.updatedAt, isVi)}</UiTableCell>
            </UiTableRow>
          ))}
        </UiTableBody>
      </UiTable>
    </div>
  );
}
