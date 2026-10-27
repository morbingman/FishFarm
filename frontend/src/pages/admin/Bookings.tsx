import { useEffect, useState } from "react";
import { useTranslation } from "@/context/LanguageContext";
import { ConfirmDialog, Pager } from "@/components/common/Portal";
import { BatchForm } from "./BatchForm";
import { domainApi } from "@/services/api";
import {
  useFarming,
  fishById,
  facilityOf,
  STATUS_LABEL,
  PAY_LABEL,
  ADMIN_BOOKING_NEXT,
  adminSetBookingStatus,
  adminRecordBookingPayment,
  fmtMoney,
  type OrderStatus,
} from "@/services/farmingStore";
export function Bookings({
  id,
  show,
}: {
  id?: string;
  show: (message: string) => void;
}) {
  const { language } = useTranslation();
  const t = (vi: string, en: string) => (language === "vi" ? vi : en);
  const state = useFarming();
  const [juveniles, setJuveniles] = useState<any[]>([]);
  const [juvenilesLoading, setJuvenilesLoading] = useState(true);
  const [juvenilesError, setJuvenilesError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<
    OrderStatus | "deposit" | "balance" | "refund" | null
  >(null);
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const order = state.orders.find((item) => item.id === id);
  useEffect(() => {
    if (id === "add") return;
    setJuvenilesLoading(true);
    setJuvenilesError("");
    void domainApi
      .adminBatches()
      .then(setJuveniles)
      .catch(() =>
        setJuvenilesError(
          t(
            "Không tải được danh sách cá con đã đăng.",
            "Could not load published juvenile fish.",
          ),
        ),
      )
      .finally(() => setJuvenilesLoading(false));
  }, [id]);
  const start = (next: NonNullable<typeof action>) => {
    setAction(next);
    setReference("");
    setError("");
  };
  const paymentAction =
    action === "deposit" || action === "balance" || action === "refund";
  const rows = state.orders
    .filter(
      (item) =>
        (status === "all" || item.status === status) &&
        `${item.id} ${item.owner} ${item.name} ${fishById(item.fishId)?.name[language]}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / 10)));
  if (id === "add") return <BatchForm show={show} />;
  if (id && !order)
    return (
      <div data-no-translate>
        <h1>{t("Không tìm thấy đơn đặt nuôi", "Booking not found")}</h1>
        <a href="#admin/bookings">{t("Về danh sách", "Back to bookings")}</a>
      </div>
    );
  return (
    <div data-no-translate>
      <header className="sl-page-head">
        <div>
          <span className="sl-eyebrow">
            {t("Dịch vụ nuôi cá", "Fish farming service")}
          </span>
          <h1>
            {order ? order.id : t("Quản lý cá đặt nuôi", "Bookings & deposits")}
          </h1>
          <p>
            {t(
              "Tiếp nhận đơn, đối soát tiền cọc và theo dõi tiến độ nuôi đến bàn giao.",
              "Review orders, reconcile deposits, and manage farming through handover.",
            )}
          </p>
        </div>
        {order ? (
          <a className="sl-btn sl-btn-ghost" href="#admin/bookings">
            {t("Về danh sách", "Back to bookings")}
          </a>
        ) : (
          <a className="sl-btn sl-btn-primary" href="#admin/bookings/add">
            + {t("Đăng cá con", "Add juvenile fish")}
          </a>
        )}
      </header>
      {order ? (
        <>
          <div className="admin-kpis">
            <section className="sl-card admin-pad">
              <small>{t("Trạng thái", "Status")}</small>
              <h2>{STATUS_LABEL[order.status][language]}</h2>
            </section>
            <section className="sl-card admin-pad">
              <small>{t("Tổng giá trị", "Total")}</small>
              <h2>{fmtMoney(order.total, language)}</h2>
            </section>
            <section className="sl-card admin-pad">
              <small>{t("Đặt cọc", "Deposit")}</small>
              <h2>{fmtMoney(order.deposit, language)}</h2>
            </section>
          </div>
          <div className="admin-detail-grid">
            <section className="sl-card admin-pad">
              <h2>{t("Thông tin khách hàng & cá", "Customer & fish")}</h2>
              <dl className="admin-facts">
                <dt>{t("Khách hàng", "Customer")}</dt>
                <dd>
                  {order.name} · {order.owner}
                </dd>
                <dt>{t("Điện thoại", "Phone")}</dt>
                <dd>{order.phone}</dd>
                <dt>{t("Cá", "Fish")}</dt>
                <dd>
                  {fishById(order.fishId)?.name[language]} × {order.qty}
                </dd>
                <dt>{t("Trang trại", "Farm")}</dt>
                <dd>{facilityOf(order.facility)?.name[language]}</dd>
                <dt>{t("Bắt đầu / thời gian", "Start / duration")}</dt>
                <dd>
                  {order.startDate} · {order.months} {t("tháng", "months")}
                </dd>
                <dt>{t("Nhận cá", "Delivery")}</dt>
                <dd>
                  {order.delivery === "pickup"
                    ? t("Nhận tại trại", "Farm pickup")
                    : order.address}
                </dd>
                <dt>{t("Ghi chú", "Notes")}</dt>
                <dd>{order.notes || "—"}</dd>
              </dl>
            </section>
            <section className="sl-card admin-pad">
              <h2>{t("Xử lý đơn đặt nuôi", "Booking actions")}</h2>
              <div className="admin-action-stack">
                {ADMIN_BOOKING_NEXT[order.status] && (
                  <button
                    className="sl-btn sl-btn-primary"
                    onClick={() => start(ADMIN_BOOKING_NEXT[order.status]!)}
                  >
                    {t("Chuyển sang", "Move to")}:{" "}
                    {STATUS_LABEL[ADMIN_BOOKING_NEXT[order.status]!][language]}
                  </button>
                )}
                {!order.payments.some(
                  (item) => item.kind === "deposit" && item.status === "paid",
                ) &&
                  order.status === "awaiting_deposit" && (
                    <button
                      className="sl-btn sl-btn-ghost"
                      onClick={() => start("deposit")}
                    >
                      {t("Ghi nhận đã nhận cọc", "Record deposit received")}
                    </button>
                  )}
                {["ready", "handover"].includes(order.status) &&
                  order.balance > 0 &&
                  !order.payments.some(
                    (item) => item.kind === "balance" && item.status === "paid",
                  ) && (
                    <button
                      className="sl-btn sl-btn-ghost"
                      onClick={() => start("balance")}
                    >
                      {t(
                        "Ghi nhận phần thanh toán còn lại",
                        "Record balance received",
                      )}
                    </button>
                  )}
                {order.status === "cancelled" &&
                  order.payments.some(
                    (item) => item.status === "refund_pending",
                  ) && (
                    <button
                      className="sl-btn sl-btn-ghost"
                      onClick={() => start("refund")}
                    >
                      {t("Ghi nhận đã hoàn tiền", "Record refund completed")}
                    </button>
                  )}
                {[
                  "awaiting_deposit",
                  "pending",
                  "confirmed",
                  "preparing",
                ].includes(order.status) && (
                  <button
                    className="sl-btn sl-btn-outline-danger"
                    onClick={() => start("cancelled")}
                  >
                    {t("Hủy đơn đặt nuôi", "Cancel booking")}
                  </button>
                )}
                {["completed", "cancelled"].includes(order.status) && (
                  <p>
                    {t(
                      "Đơn đã kết thúc. Kiểm tra giao dịch và lịch sử bên dưới.",
                      "This order has ended. Review payments and history below.",
                    )}
                  </p>
                )}
              </div>
              <p className="admin-note">
                {t(
                  "Chỉ ghi nhận thanh toán sau khi đã đối soát giao dịch. Đơn hủy có tiền đã thu sẽ chuyển sang chờ hoàn tiền.",
                  "Record payments only after reconciliation. Paid cancelled orders enter refund pending.",
                )}
              </p>
            </section>
          </div>
          <section className="sl-card admin-pad">
            <h2>{t("Lịch sử thanh toán", "Payment history")}</h2>
            <div className="sl-table-wrap">
              <table className="sl-table">
                <thead>
                  <tr>
                    <th>{t("Giao dịch", "Transaction")}</th>
                    <th>{t("Loại", "Type")}</th>
                    <th>{t("Số tiền", "Amount")}</th>
                    <th>{t("Trạng thái", "Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        {payment.ref}
                        <br />
                        <small>{new Date(payment.at).toLocaleString()}</small>
                      </td>
                      <td>{payment.kind}</td>
                      <td>{fmtMoney(payment.amount, language)}</td>
                      <td>{PAY_LABEL[payment.status][language]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {action && (
            <ConfirmDialog
              title={
                paymentAction
                  ? t("Xác nhận giao dịch", "Confirm transaction")
                  : t("Cập nhật trạng thái đơn nuôi", "Update booking status")
              }
              body={
                paymentAction
                  ? t(
                      "Nhập mã tham chiếu giao dịch đã được đối soát.",
                      "Enter the reconciled transaction reference.",
                    )
                  : `${STATUS_LABEL[order.status][language]} → ${STATUS_LABEL[action as OrderStatus][language]}`
              }
              confirmLabel={t("Xác nhận", "Confirm")}
              danger={action === "cancelled"}
              error={error}
              onCancel={() => setAction(null)}
              onConfirm={async () => {
                try {
                  if (paymentAction)
                    adminRecordBookingPayment(
                      order.id,
                      action as "deposit" | "balance" | "refund",
                      reference,
                    );
                  else
                    await adminSetBookingStatus(
                      order.id,
                      action as OrderStatus,
                    );
                  show(t("Đã cập nhật đơn đặt nuôi", "Booking updated"));
                  setAction(null);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Error");
                }
              }}
            >
              {paymentAction && (
                <label className="sl-field">
                  <span>{t("Mã giao dịch", "Transaction reference")}</span>
                  <input
                    aria-label={t("Mã giao dịch", "Transaction reference")}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </label>
              )}
            </ConfirmDialog>
          )}
        </>
      ) : (
        <>
          <section className="sl-card admin-pad admin-juvenile-list">
            <div className="admin-section-heading">
              <div>
                <h2>{t("Cá con đã đăng", "Published juvenile fish")}</h2>
                <p className="admin-note">
                  {t(
                    "Các hồ sơ dưới đây được lưu trên hệ thống và đang chờ người đầu tư.",
                    "These profiles are saved and waiting for an investor.",
                  )}
                </p>
              </div>
              <strong>{juveniles.length}</strong>
            </div>
            {juvenilesLoading ? (
              <p>{t("Đang tải...", "Loading...")}</p>
            ) : juvenilesError ? (
              <p className="batch-error" role="alert">
                {juvenilesError}
              </p>
            ) : juveniles.length ? (
              <div className="sl-table-wrap">
                <table className="sl-table">
                  <thead>
                    <tr>
                      <th>{t("Cá con", "Juvenile fish")}</th>
                      <th>{t("Loài", "Species")}</th>
                      <th>{t("Chi phí đầu tư", "Sponsorship cost")}</th>
                      <th>{t("Trạng thái", "Status")}</th>
                      <th>{t("Nhà đầu tư", "Investor")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {juveniles.map((fish) => {
                      const sponsorship = fish.sponsorships?.find(
                        (item: any) =>
                          !["cancelled", "refunded"].includes(item.status),
                      );
                      return (
                        <tr key={fish.id}>
                          <td>
                            <div className="admin-juvenile-cell">
                              {fish.images?.[0]?.url && (
                                <img src={fish.images[0].url} alt="" />
                              )}
                              <span>
                                <b>{fish.title}</b>
                                <small>{fish.code}</small>
                              </span>
                            </div>
                          </td>
                          <td>{fish.species}</td>
                          <td>
                            {fmtMoney(fish.packagePricePerShare, language)}
                          </td>
                          <td>
                            <span className="admin-pill">{fish.status}</span>
                          </td>
                          <td>
                            {sponsorship
                              ? t("Đã có nhà đầu tư", "Investor assigned")
                              : t("Đang chờ", "Waiting")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>
                {t(
                  "Chưa có cá con nào được đăng.",
                  "No juvenile fish published yet.",
                )}
              </p>
            )}
          </section>
          <section className="sl-card">
            <div className="admin-toolbar">
              <input
                aria-label={t("Tìm đơn đặt nuôi", "Search bookings")}
                placeholder={t(
                  "Tìm mã đơn, khách hàng hoặc cá",
                  "Search order, customer or fish",
                )}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
              <select
                aria-label={t("Trạng thái đơn nuôi", "Booking status")}
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">
                  {t("Tất cả trạng thái", "All statuses")}
                </option>
                {Object.entries(STATUS_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label[language]}
                  </option>
                ))}
              </select>
            </div>
            <div className="sl-table-wrap">
              <table className="sl-table">
                <thead>
                  <tr>
                    <th>{t("Đơn đặt nuôi", "Booking")}</th>
                    <th>{t("Khách hàng", "Customer")}</th>
                    <th>{t("Cá / số lượng", "Fish / quantity")}</th>
                    <th>{t("Đặt cọc", "Deposit")}</th>
                    <th>{t("Trạng thái", "Status")}</th>
                    <th>{t("Chi tiết", "Details")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .slice((safePage - 1) * 10, safePage * 10)
                    .map((item) => (
                      <tr key={item.id}>
                        <td>
                          <b>{item.id}</b>
                          <br />
                          <small>{item.createdAt.slice(0, 10)}</small>
                        </td>
                        <td>
                          {item.name}
                          <br />
                          <small>{item.owner}</small>
                        </td>
                        <td>
                          {fishById(item.fishId)?.name[language]} × {item.qty}
                        </td>
                        <td>
                          {fmtMoney(item.deposit, language)}
                          <br />
                          <small>
                            {item.payments.some(
                              (payment) =>
                                payment.kind === "deposit" &&
                                payment.status === "paid",
                            )
                              ? t("Đã nhận", "Received")
                              : item.payments.some(
                                    (payment) =>
                                      payment.status === "refund_pending",
                                  )
                                ? t("Chờ hoàn", "Refund pending")
                                : t("Chưa nhận / đã hoàn", "Unpaid / refunded")}
                          </small>
                        </td>
                        <td>
                          <span className="admin-pill">
                            {STATUS_LABEL[item.status][language]}
                          </span>
                        </td>
                        <td>
                          <a
                            className="sl-btn sl-btn-ghost"
                            href={`#admin/bookings/${item.id}`}
                          >
                            {t("Xem đơn", "View order")}
                          </a>
                        </td>
                      </tr>
                    ))}
                  {!rows.length && (
                    <tr>
                      <td colSpan={6}>
                        {t(
                          "Không có đơn đặt nuôi phù hợp.",
                          "No matching bookings.",
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
        </>
      )}
    </div>
  );
}
