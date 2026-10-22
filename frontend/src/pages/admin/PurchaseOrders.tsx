import { useState } from "react";
import { useTranslation } from "@/context/LanguageContext";
import {
  useSales,
  updatePurchase,
  type SaleStatus,
} from "@/services/commerceStore";
import { ConfirmDialog, Pager } from "@/components/common/Portal";
export function PurchaseOrders({
  id,
  show,
}: {
  id?: string;
  show: (message: string) => void;
}) {
  const { language } = useTranslation();
  const t = (vi: string, en: string) => (language === "vi" ? vi : en);
  const orders = useSales();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [action, setAction] = useState<SaleStatus | null>(null);
  const [error, setError] = useState("");
  const labels: Record<SaleStatus, string> = {
    confirmed: t("Đã xác nhận", "Confirmed"),
    preparing: t("Đang chuẩn bị", "Preparing"),
    shipped: t("Đang giao", "Shipped"),
    delivered: t("Đã giao", "Delivered"),
    completed: t("Hoàn tất", "Completed"),
    cancelled: t("Đã hủy", "Cancelled"),
  };
  const next: Partial<Record<SaleStatus, SaleStatus>> = {
    confirmed: "preparing",
    preparing: "shipped",
    shipped: "delivered",
    delivered: "completed",
  };
  const order = orders.find((item) => item.id === id);
  const money = (amount: number) =>
    new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  const rows = orders.filter(
    (item) =>
      (status === "all" || item.status === status) &&
      `${item.id} ${item.owner} ${item.shipping.name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / 10)));
  if (id && !order)
    return (
      <div data-no-translate>
        <h1>{t("Không tìm thấy đơn mua", "Purchase not found")}</h1>
        <a href="#admin/orders">{t("Về danh sách", "Back to orders")}</a>
      </div>
    );
  return (
    <div data-no-translate>
      <header className="sl-page-head">
        <div>
          <span className="sl-eyebrow">
            {t("Đơn mua cá", "Fish purchases")}
          </span>
          <h1>
            {order ? order.id : t("Quản lý đơn mua cá", "Purchase orders")}
          </h1>
          <p>
            {t(
              "Các đơn được tạo từ luồng mua và thanh toán của khách hàng.",
              "Orders created by customer checkout and payment.",
            )}
          </p>
        </div>
        {order && (
          <a className="sl-btn sl-btn-ghost" href="#admin/orders">
            {t("Về danh sách", "Back to orders")}
          </a>
        )}
      </header>
      {order ? (
        <section className="sl-card admin-pad">
          <h2>{order.shipping.name}</h2>
          <p>
            {order.owner} · {order.shipping.phone}
          </p>
          <p>
            {[
              order.shipping.address,
              order.shipping.city,
              order.shipping.province,
            ].join(", ")}
          </p>
          <div className="sl-table-wrap">
            <table className="sl-table">
              <thead>
                <tr>
                  <th>{t("Cá", "Fish")}</th>
                  <th>{t("Giá", "Price")}</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, index) => (
                  <tr key={`${item.id}-${index}`}>
                    <td>{item.name}</td>
                    <td>{money(item.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            <b>
              {t("Tổng cộng", "Total")}: {money(order.total)}
            </b>
          </p>
          <p>
            {labels[order.status]} ·{" "}
            {order.payment === "paid"
              ? t("Đã thanh toán", "Paid")
              : t("Chờ hoàn tiền", "Refund pending")}
          </p>
          <div className="admin-inline-actions">
            {next[order.status] && (
              <button
                className="sl-btn sl-btn-primary"
                onClick={() => {
                  setAction(next[order.status]!);
                  setError("");
                }}
              >
                {t("Chuyển sang", "Move to")}: {labels[next[order.status]!]}
              </button>
            )}
            {["confirmed", "preparing"].includes(order.status) && (
              <button
                className="sl-btn sl-btn-outline-danger"
                onClick={() => {
                  setAction("cancelled");
                  setError("");
                }}
              >
                {t("Hủy đơn", "Cancel order")}
              </button>
            )}
          </div>
        </section>
      ) : (
        <section className="sl-card">
          <div className="admin-toolbar">
            <input
              aria-label={t("Tìm đơn mua", "Search purchases")}
              placeholder={t(
                "Mã đơn, tên hoặc email",
                "Order ID, name or email",
              )}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
            <select
              value={status}
              aria-label={t("Trạng thái đơn mua", "Purchase status")}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">
                {t("Tất cả trạng thái", "All statuses")}
              </option>
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="sl-table-wrap">
            <table className="sl-table">
              <thead>
                <tr>
                  <th>{t("Mã đơn", "Order")}</th>
                  <th>{t("Khách hàng", "Customer")}</th>
                  <th>{t("Tổng cộng", "Total")}</th>
                  <th>{t("Trạng thái", "Status")}</th>
                  <th>{t("Chi tiết", "Details")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice((safePage - 1) * 10, safePage * 10).map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>
                      {item.shipping.name}
                      <br />
                      <small>{item.owner}</small>
                    </td>
                    <td>{money(item.total)}</td>
                    <td>{labels[item.status]}</td>
                    <td>
                      <a
                        className="sl-btn sl-btn-ghost"
                        href={`#admin/orders/${item.id}`}
                      >
                        {t("Xem đơn", "View order")}
                      </a>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={5}>
                      {t(
                        "Chưa có đơn mua cá phù hợp.",
                        "No matching purchases yet.",
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {rows.length > 0 && (
            <Pager
              page={safePage}
              size={10}
              total={rows.length}
              onPage={setPage}
            />
          )}
        </section>
      )}
      {order && action && (
        <ConfirmDialog
          title={t("Cập nhật đơn mua cá", "Update purchase")}
          body={`${labels[order.status]} → ${labels[action]}`}
          confirmLabel={t("Xác nhận", "Confirm")}
          error={error}
          danger={action === "cancelled"}
          onCancel={() => setAction(null)}
          onConfirm={() => {
            try {
              updatePurchase(order.id, action);
              show(t("Đã cập nhật đơn mua", "Purchase updated"));
              setAction(null);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Error");
            }
          }}
        />
      )}
    </div>
  );
}
