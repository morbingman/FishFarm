import type { Order } from "@/services/farmingStore";
import type { Lang } from "@/hooks/useTranslation";
import { type CSSProperties } from "react";
import "./OrderList.css";
import { TableCell as UiTableCell } from "@/components/ui/table";
import { TableBody as UiTableBody } from "@/components/ui/table";
import { TableHead as UiTableHead } from "@/components/ui/table";
import { TableRow as UiTableRow } from "@/components/ui/table";
import { TableHeader as UiTableHeader } from "@/components/ui/table";
import { Table as UiTable } from "@/components/ui/table";
import { Button as UiButton } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { Icon, StateBlock, Crumbs } from "@/components/common/Portal";
import {
  PKG_LABEL,
  L,
  fishById,
  fmtDay,
  fmtMoney,
  fmtNum,
} from "@/services/farmingStore";
import { OrderBadge, useT } from "@/components/farming/FarmingParts";
import { type Tab, TAB_OF, PAGE } from "@/data/farmingOrderData";
export /* ---------------------------------- list ---------------------------------- */
function OrderList({
  orders,
  loading,
  language,
}: {
  orders: Order[];
  loading: boolean;
  language: Lang;
}) {
  const t = useT(language);
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(1);
  const tabs: [Tab, string][] = [
    ["all", t("Tất cả", "All")],
    ["awaiting_deposit", t("Chờ đặt cọc", "Awaiting deposit")],
    ["pending", t("Chờ xác nhận", "Pending")],
    ["progress", t("Đang nuôi", "In progress")],
    ["ready", t("Sẵn sàng nhận", "Ready")],
    ["completed", t("Hoàn thành", "Completed")],
    ["cancelled", t("Đã hủy", "Cancelled")],
  ];
  const count = (k: Tab) =>
    k === "all"
      ? orders.length
      : orders.filter((o) => TAB_OF[o.status] === k).length;
  const list = useMemo(
    () => orders.filter((o) => tab === "all" || TAB_OF[o.status] === tab),
    [orders, tab],
  );
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const cur = Math.min(page, pages);
  const rows = list.slice((cur - 1) * PAGE, cur * PAGE);
  return (
    <>
      <Crumbs
        items={[
          [t("Tài khoản", "Account"), "#account/profile"],
          [t("Đơn nuôi của tôi", "My farming orders")],
        ]}
      />
      <div className="sl-page-head">
        <div>
          <h1>{t("Đơn nuôi của tôi", "My farming orders")}</h1>
          <p>
            {t(
              "Theo dõi đặt cọc, tiến độ nuôi và bàn giao cá của bạn.",
              "Track your deposits, farming progress and fish handover.",
            )}
          </p>
        </div>
        <a className="sl-btn sl-btn-primary" href="#farming">
          <Icon name="plus" size={16} />
          {t("Đặt nuôi mới", "New farming order")}
        </a>
      </div>
      <section className="sl-card">
        <div className="pt-tabs order-list-view-2" role="tablist">
          {tabs.map(([k, l]) => (
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
              {l} <span className="order-list-view-4">({count(k)})</span>
            </UiButton>
          ))}
        </div>
        {loading ? (
          <div aria-busy="true" className="order-list-view-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="pt-skel order-list-view-8" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <StateBlock
            icon="clipboard"
            tone="info"
            title={
              orders.length === 0
                ? t(
                    "Bạn chưa có đơn nuôi nào",
                    "You have no farming orders yet",
                  )
                : t("Không có đơn ở trạng thái này", "No orders in this status")
            }
            body={
              orders.length === 0
                ? t(
                    "Chọn loài cá bạn thích và đặt cọc để bắt đầu.",
                    "Pick a fish you like and pay a deposit to get started.",
                  )
                : t("Thử chọn thẻ trạng thái khác.", "Try another status tab.")
            }
            actions={
              <a className="sl-btn sl-btn-primary" href="#farming">
                {t("Khám phá đặt nuôi cá", "Explore fish farming")}
              </a>
            }
          />
        ) : (
          <>
            <div className="sl-table-wrap">
              <UiTable className="sl-table fm-table order-list-view-10">
                <UiTableHeader>
                  <UiTableRow>
                    <UiTableHead>{t("Mã đơn", "Order")}</UiTableHead>
                    <UiTableHead>{t("Loại cá", "Fish")}</UiTableHead>
                    <UiTableHead>{t("SL", "Qty")}</UiTableHead>
                    <UiTableHead>{t("Gói", "Package")}</UiTableHead>
                    <UiTableHead>{t("Ngày đặt", "Placed")}</UiTableHead>
                    <UiTableHead>{t("Tổng giá trị", "Total")}</UiTableHead>
                    <UiTableHead>{t("Đã cọc", "Deposit")}</UiTableHead>
                    <UiTableHead>{t("Trạng thái", "Status")}</UiTableHead>
                    <UiTableHead>
                      <span
                        className="order-list-view-12"
                        style={
                          {
                            "--order-list-layout-11-left": -9999,
                          } as CSSProperties
                        }
                      >
                        {t("Thao tác", "Actions")}
                      </span>
                    </UiTableHead>
                  </UiTableRow>
                </UiTableHeader>
                <UiTableBody>
                  {rows.map((o) => {
                    const f = fishById(o.fishId)!;
                    return (
                      <UiTableRow key={o.id}>
                        <UiTableCell
                          data-l={t("Mã đơn", "Order")}
                          className="mono"
                        >
                          {o.id}
                        </UiTableCell>
                        <UiTableCell data-l={t("Loại cá", "Fish")}>
                          <b className="order-list-view-14">
                            {L(f.name, language)}
                          </b>
                        </UiTableCell>
                        <UiTableCell data-l={t("Số lượng", "Qty")}>
                          {fmtNum(o.qty, language)}
                        </UiTableCell>
                        <UiTableCell data-l={t("Gói", "Package")}>
                          {L(PKG_LABEL[o.pkg], language)}
                        </UiTableCell>
                        <UiTableCell data-l={t("Ngày đặt", "Placed")}>
                          {fmtDay(o.createdAt, language)}
                        </UiTableCell>
                        <UiTableCell data-l={t("Tổng giá trị", "Total")}>
                          {fmtMoney(o.total, language)}
                        </UiTableCell>
                        <UiTableCell data-l={t("Đã cọc", "Deposit")}>
                          {o.status === "awaiting_deposit" ? (
                            <span className="order-list-view-16">
                              {t("Chưa thanh toán", "Unpaid")}
                            </span>
                          ) : (
                            fmtMoney(o.deposit, language)
                          )}
                        </UiTableCell>
                        <UiTableCell data-l={t("Trạng thái", "Status")}>
                          <OrderBadge s={o.status} lang={language} />
                        </UiTableCell>
                        <UiTableCell className="act">
                          <a
                            className="sl-btn sl-btn-ghost"
                            href={`#account/farming-orders/${o.id}`}
                          >
                            {o.status === "awaiting_deposit"
                              ? t("Đặt cọc", "Pay deposit")
                              : t("Xem chi tiết", "View")}
                          </a>
                        </UiTableCell>
                      </UiTableRow>
                    );
                  })}
                </UiTableBody>
              </UiTable>
            </div>
            <div className="fm-pager">
              <span>
                {t(
                  `Hiển thị ${(cur - 1) * PAGE + 1}–${(cur - 1) * PAGE + rows.length} trong ${list.length} đơn`,
                  `Showing ${(cur - 1) * PAGE + 1}–${(cur - 1) * PAGE + rows.length} of ${list.length}`,
                )}
              </span>
              <div>
                <UiButton
                  variant="plain"
                  onClick={() => setPage(cur - 1)}
                  disabled={cur === 1}
                  aria-label={t("Trang trước", "Previous page")}
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
                      className={cur === i + 1 ? "on" : ""}
                      aria-current={cur === i + 1 ? "page" : undefined}
                      onClick={() => setPage(i + 1)}
                    >
                      {i + 1}
                    </UiButton>
                  ),
                )}
                <UiButton
                  variant="plain"
                  onClick={() => setPage(cur + 1)}
                  disabled={cur === pages}
                  aria-label={t("Trang sau", "Next page")}
                >
                  <Icon name="arrow" size={14} />
                </UiButton>
              </div>
            </div>
          </>
        )}
      </section>
      <p className="fm-demo-note order-list-view-18">
        <Icon name="info" size={14} />
        {t(
          "Dữ liệu đơn mẫu chỉ để minh họa.",
          "Sample orders are for demonstration only.",
        )}
      </p>
    </>
  );
}

/* ---------------------------------- detail ---------------------------------- */
