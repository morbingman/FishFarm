import type { Order } from "@/services/farmingStore";
import type { Lang } from "@/hooks/useTranslation";
import { type CSSProperties } from "react";
import "./OrderDetail.css";
import { TableCell as UiTableCell } from "@/components/ui/table";
import { TableBody as UiTableBody } from "@/components/ui/table";
import { TableHead as UiTableHead } from "@/components/ui/table";
import { TableRow as UiTableRow } from "@/components/ui/table";
import { TableHeader as UiTableHeader } from "@/components/ui/table";
import { Table as UiTable } from "@/components/ui/table";
import { Button as UiButton } from "@/components/ui/button";
import { useState } from "react";
import { Icon, StateBlock, Banner, Crumbs } from "@/components/common/Portal";
import {
  CARE_LABEL,
  METHOD_LABEL,
  PKG_LABEL,
  STATUS_LABEL,
  ADDONS,
  L,
  cancelOrder,
  demoAdvance,
  fishById,
  fmtDay,
  fmtMoney,
  fmtNum,
  fmtTime,
  payPendingDeposit,
  type CareType,
  type OrderStatus,
} from "@/services/farmingStore";
import {
  Badge,
  Modal,
  OrderBadge,
  PayBadge,
  PayPanel,
  useT,
} from "@/components/farming/FarmingParts";
import { CUR, CARE_ICON } from "@/data/farmingOrderData";
import { HandoverForm } from "@/pages/farming/HandoverForm";
export /* ---------------------------------- detail ---------------------------------- */
function OrderDetail({
  o,
  language,
  show,
}: {
  o: Order;
  language: Lang;
  show: (m: string) => void;
}) {
  const t = useT(language);
  const f = fishById(o.fishId)!;
  const [modal, setModal] = useState<"pay" | "cancel" | "handover" | null>(
    null,
  );
  const [metric, setMetric] = useState<"sizeCm" | "weightG" | "survival">(
    "sizeCm",
  );
  const [careFilter, setCareFilter] = useState<"all" | CareType>("all");
  const close = () => setModal(null);
  const cur = CUR[o.status];
  const steps = [
    t("Đặt cọc", "Deposit"),
    t("Xác nhận", "Confirmed"),
    t("Chuẩn bị", "Preparing"),
    t("Đang nuôi", "Farming"),
    t("Sẵn sàng", "Ready"),
    t("Bàn giao", "Handover"),
  ];
  const growing = o.meas.length > 0;
  const unit = metric === "sizeCm" ? "cm" : metric === "weightG" ? "g" : "%";
  const maxV = Math.max(1, ...o.meas.map((m) => m[metric]));
  const last = o.meas[o.meas.length - 1];
  const careList = o.care
    .filter((c) => careFilter === "all" || c.type === careFilter)
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at));
  const payTotal = o.payments.filter(
    (p) => p.kind === "deposit" && p.status !== "failed",
  ).length;
  const canCancel = o.status === "awaiting_deposit" || o.status === "pending";
  const hv = o.handover;
  const hvSteps: [string, string][] = [
    ["requested", t("Đã yêu cầu", "Requested")],
    ["scheduled", t("Đã lên lịch", "Scheduled")],
    ["in_transit", t("Đang giao", "In transit")],
    ["done", t("Hoàn tất", "Done")],
  ];
  const hvIdx = hv ? hvSteps.findIndex((x) => x[0] === hv.status) : -1;
  const next = (
    {
      pending: t("Trang trại xác nhận đơn", "Farm confirms the order"),
      confirmed: t("Bắt đầu chuẩn bị cá", "Start preparing fish"),
      preparing: t("Bắt đầu nuôi", "Start farming"),
      farming: t("Cá sẵn sàng bàn giao", "Fish ready for handover"),
      handover: t("Tiến trình bàn giao kế tiếp", "Next handover step"),
    } as Partial<Record<OrderStatus, string>>
  )[o.status];
  return (
    <>
      <Crumbs
        items={[
          [t("Tài khoản", "Account"), "#account/profile"],
          [
            t("Đơn nuôi của tôi", "My farming orders"),
            "#account/farming-orders",
          ],
          [o.id],
        ]}
      />
      <div className="sl-page-head">
        <div>
          <div className="fm-order-head">
            <h1 className="fm-mono order-detail-view-2">{o.id}</h1>
            <OrderBadge s={o.status} lang={language} />
            {o.sample && (
              <Badge tone="muted">{t("Dữ liệu mẫu", "Sample data")}</Badge>
            )}
          </div>
          <p>
            {L(f.name, language)} × {fmtNum(o.qty, language)} ·{" "}
            {t("đặt ngày", "placed")} {fmtDay(o.createdAt, language)}
          </p>
        </div>
        <div className="fm-actions">
          {o.status === "awaiting_deposit" && (
            <UiButton
              variant="plain"
              className="sl-btn sl-btn-primary"
              onClick={() => setModal("pay")}
            >
              {t("Thanh toán đặt cọc", "Pay deposit")}
            </UiButton>
          )}
          {o.status === "ready" && (
            <UiButton
              variant="plain"
              className="sl-btn sl-btn-primary"
              onClick={() => setModal("handover")}
            >
              <Icon name="truck" size={16} />
              {t("Yêu cầu nhận cá", "Request handover")}
            </UiButton>
          )}
          {canCancel && (
            <UiButton
              variant="plain"
              className="sl-btn sl-btn-ghost"
              onClick={() => setModal("cancel")}
            >
              {t("Hủy đơn", "Cancel order")}
            </UiButton>
          )}
        </div>
      </div>

      {o.status === "awaiting_deposit" && (
        <Banner tone="warn">
          {t(
            "Đơn chưa giữ chỗ cho đến khi bạn thanh toán tiền đặt cọc. Số chỗ nuôi có thể thay đổi.",
            "Your slot is not reserved until the deposit is paid. Availability may change.",
          )}
        </Banner>
      )}
      {o.status === "pending" && (
        <Banner tone="info">
          {t(
            "Đã nhận tiền cọc. Đang chờ trang trại xác nhận đơn. Bạn có thể hủy trước khi được xác nhận.",
            "Deposit received. Waiting for the farm to confirm. You can cancel before confirmation.",
          )}
        </Banner>
      )}
      {o.status === "cancelled" && (
        <Banner tone="error">
          {o.payments.some((p) => p.status === "refund_pending")
            ? t(
                "Đơn đã hủy. Tiền cọc đang được hoàn lại.",
                "Order cancelled. Your deposit refund is in progress.",
              )
            : o.payments.some((p) => p.status === "refunded")
              ? t(
                  "Đơn đã hủy. Tiền cọc đã được hoàn.",
                  "Order cancelled. Your deposit has been refunded.",
                )
              : t(
                  "Đơn đã hủy. Chưa có khoản thanh toán nào bị trừ.",
                  "Order cancelled. No payment was taken.",
                )}
        </Banner>
      )}

      <section className="sl-card fm-section order-detail-view-4">
        <div className="fm-ocard">
          <div className="fm-kv">
            <small>{t("Loại cá", "Fish")}</small>
            <b>{L(f.name, language)}</b>
          </div>
          <div className="fm-kv">
            <small>{t("Số lượng", "Quantity")}</small>
            <b>
              {fmtNum(o.qty, language)}
              {o.confirmedQty != null && o.confirmedQty !== o.qty
                ? ` → ${fmtNum(o.confirmedQty, language)}`
                : ""}
            </b>
          </div>
          <div className="fm-kv">
            <small>{t("Gói dịch vụ", "Package")}</small>
            <b>{L(PKG_LABEL[o.pkg], language)}</b>
          </div>
          <div className="fm-kv">
            <small>{t("Bắt đầu dự kiến", "Expected start")}</small>
            <b>{fmtDay(o.startDate, language)}</b>
          </div>
          <div className="fm-kv">
            <small>{t("Thời gian nuôi", "Duration")}</small>
            <b>{t(`~${o.months} tháng`, `~${o.months} months`)}</b>
          </div>
          <div className="fm-kv">
            <small>{t("Hình thức nhận", "Handover")}</small>
            <b>
              {o.delivery === "pickup"
                ? t("Tại trang trại", "Farm pickup")
                : `${o.area}`}
            </b>
          </div>
          <div className="fm-kv">
            <small>{t("Tổng giá trị", "Order total")}</small>
            <b>{fmtMoney(o.total, language)}</b>
          </div>
          <div className="fm-kv">
            <small>{t("Tiền cọc", "Deposit")}</small>
            <b>{fmtMoney(o.deposit, language)}</b>
          </div>
          <div className="fm-kv">
            <small>{t("Số dư còn lại", "Remaining balance")}</small>
            <b>
              {o.status === "completed"
                ? t("Đã thanh toán", "Paid")
                : fmtMoney(o.balance, language)}
            </b>
          </div>
        </div>
        {o.pkg === "custom" && o.addons.length > 0 && (
          <p className="order-detail-view-6">
            {t("Dịch vụ:", "Services:")}{" "}
            {o.addons
              .map((a) => L(ADDONS.find((x) => x.id === a)!.name, language))
              .join(", ")}
          </p>
        )}
      </section>

      <section className="sl-card fm-section">
        <header>
          <h2>{t("Tiến độ đơn nuôi", "Order progress")}</h2>
        </header>
        <ol
          className={`fm-prog ${o.status === "cancelled" ? "cancelled" : ""}`}
          aria-label={t("Tiến độ", "Progress")}
        >
          {steps.map((l, i) => {
            const done = cur > i;
            const now = cur === i;
            return (
              <li
                key={l}
                className={done ? "done" : now ? "cur" : ""}
                aria-current={now ? "step" : undefined}
              >
                <span className="dot">
                  {done ? (
                    <Icon name="check" size={18} />
                  ) : (
                    <b className="order-detail-view-8">{i + 1}</b>
                  )}
                </span>
                <span>{l}</span>
              </li>
            );
          })}
        </ol>
        <p className="order-detail-view-10">
          {L(STATUS_LABEL[o.status], language)}.{" "}
          {t(
            "Thời gian nuôi chỉ là ước tính và có thể thay đổi.",
            "The farming period is an estimate and may change.",
          )}
        </p>
      </section>

      <section className="sl-card fm-section">
        <header>
          <h2>{t("Theo dõi tăng trưởng", "Growth monitoring")}</h2>
          <Badge tone="muted">{t("Dữ liệu mẫu", "Sample data")}</Badge>
        </header>
        {!growing ? (
          <StateBlock
            icon="activity"
            tone="info"
            title={t("Chưa có số liệu tăng trưởng", "No growth data yet")}
            body={
              o.status === "cancelled"
                ? t(
                    "Đơn đã hủy nên không có số liệu.",
                    "This order was cancelled, so there is no data.",
                  )
                : t(
                    "Số liệu sẽ xuất hiện khi trang trại bắt đầu nuôi và đo cá.",
                    "Measurements appear once the farm starts raising and measuring your fish.",
                  )
            }
          />
        ) : (
          <div className="fm-growth">
            <div className="order-detail-view-12">
              <div
                className="fm-chips"
                role="group"
                aria-label={t("Chỉ số", "Metric")}
              >
                {(
                  [
                    ["sizeCm", t("Kích thước", "Size")],
                    ["weightG", t("Cân nặng", "Weight")],
                    ["survival", t("Tỷ lệ sống", "Survival")],
                  ] as ["sizeCm" | "weightG" | "survival", string][]
                ).map(([k, l]) => (
                  <UiButton
                    variant="plain"
                    key={k}
                    className={`fm-chip ${metric === k ? "on" : ""}`}
                    aria-pressed={metric === k}
                    onClick={() => setMetric(k)}
                  >
                    {l}
                  </UiButton>
                ))}
              </div>
              <div className="fm-kv order-detail-view-14">
                <small>{t("Số đo gần nhất", "Latest measurement")}</small>
                <b>
                  {last.sizeCm} cm · {last.weightG} g · {last.survival}%{" "}
                  {t("sống", "survival")}
                </b>
              </div>
              <div className="fm-kv order-detail-view-16">
                <small>
                  {t("Kích thước mục tiêu bàn giao", "Target handover size")}
                </small>
                <b>~{f.sizeTarget} cm</b>
              </div>
              <p className="fm-demo-note order-detail-view-18">
                <Icon name="info" size={14} />
                {t(
                  "Số liệu minh họa; thực tế có thể khác. Tỷ lệ sống phản ánh hao hụt thực tế.",
                  "Illustrative figures; actual results may differ. Survival reflects real losses.",
                )}
              </p>
            </div>
            <div>
              <div
                className="fm-chart"
                role="img"
                aria-label={t("Biểu đồ tăng trưởng", "Growth chart")}
              >
                {o.meas.map((m) => (
                  <div key={m.at}>
                    <span>
                      {m[metric]}
                      {unit}
                    </span>
                    <i
                      style={
                        {
                          "--order-detail-layout-19-height": `${Math.max(4, (m[metric] / maxV) * 100)}%`,
                        } as CSSProperties
                      }
                      className="order-detail-view-20"
                    />
                  </div>
                ))}
              </div>
              <div className="fm-chart-x">
                {o.meas.map((m) => (
                  <span key={m.at}>{fmtDay(m.at, language).slice(0, 5)}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="sl-card fm-section">
        <header>
          <h2>{t("Lịch sử chăm sóc", "Care history")}</h2>
          {o.care.length > 0 && (
            <div
              className="fm-chips"
              role="group"
              aria-label={t("Lọc", "Filter")}
            >
              {(
                ["all", "feeding", "water", "health", "photo", "note"] as const
              ).map((k) => (
                <UiButton
                  variant="plain"
                  key={k}
                  className={`fm-chip ${careFilter === k ? "on" : ""}`}
                  aria-pressed={careFilter === k}
                  onClick={() => setCareFilter(k)}
                >
                  {k === "all"
                    ? t("Tất cả", "All")
                    : L(CARE_LABEL[k], language)}
                </UiButton>
              ))}
            </div>
          )}
        </header>
        {o.care.length === 0 ? (
          <StateBlock
            icon="clipboard"
            tone="info"
            title={t("Chưa có hoạt động chăm sóc", "No care activity yet")}
            body={t(
              "Nhật ký cho ăn, kiểm tra nước và sức khỏe sẽ hiện ở đây sau khi bắt đầu nuôi.",
              "Feeding, water and health logs show here once farming starts.",
            )}
          />
        ) : careList.length === 0 ? (
          <p className="order-detail-view-22">
            {t(
              "Không có hoạt động thuộc loại này.",
              "No activity of this type.",
            )}
          </p>
        ) : (
          <ul className="fm-care">
            {careList.map((c) => (
              <li key={c.id}>
                <span className={`ic ${c.type}`}>
                  <Icon name={CARE_ICON[c.type]} size={16} />
                </span>
                <div>
                  <b>{L(CARE_LABEL[c.type], language)}</b>
                  <small>
                    {fmtTime(c.at, language)} · {L(c.by, language)}
                  </small>
                  <p>{L(c.text, language)}</p>
                  {c.photo && (
                    <img
                      src={c.photo}
                      alt={`${L(f.name, language)}, ${fmtDay(c.at, language)}`}
                      loading="lazy"
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="sl-card fm-section">
        <header>
          <h2>{t("Lịch sử thanh toán", "Payment history")}</h2>
        </header>
        {o.payments.length === 0 ? (
          <p className="order-detail-view-24">
            {t(
              "Chưa có giao dịch nào. Thanh toán đặt cọc để giữ chỗ.",
              "No transactions yet. Pay the deposit to reserve your slot.",
            )}
          </p>
        ) : (
          <div className="sl-table-wrap">
            <UiTable className="sl-table fm-table order-detail-view-26">
              <UiTableHeader>
                <UiTableRow>
                  <UiTableHead>{t("Mã giao dịch", "Reference")}</UiTableHead>
                  <UiTableHead>{t("Loại", "Type")}</UiTableHead>
                  <UiTableHead>{t("Thời gian", "Date")}</UiTableHead>
                  <UiTableHead>{t("Phương thức", "Method")}</UiTableHead>
                  <UiTableHead>{t("Số tiền", "Amount")}</UiTableHead>
                  <UiTableHead>{t("Trạng thái", "Status")}</UiTableHead>
                </UiTableRow>
              </UiTableHeader>
              <UiTableBody>
                {o.payments.map((p) => (
                  <UiTableRow key={p.id}>
                    <UiTableCell data-l={t("Mã", "Ref")} className="mono">
                      {p.ref}
                    </UiTableCell>
                    <UiTableCell data-l={t("Loại", "Type")}>
                      {p.kind === "deposit"
                        ? t("Đặt cọc", "Deposit")
                        : p.kind === "balance"
                          ? t("Số dư", "Balance")
                          : t("Hoàn tiền", "Refund")}
                    </UiTableCell>
                    <UiTableCell data-l={t("Thời gian", "Date")}>
                      {fmtTime(p.at, language)}
                    </UiTableCell>
                    <UiTableCell data-l={t("Phương thức", "Method")}>
                      {L(METHOD_LABEL[p.method], language)}
                    </UiTableCell>
                    <UiTableCell data-l={t("Số tiền", "Amount")}>
                      {fmtMoney(p.amount, language)}
                    </UiTableCell>
                    <UiTableCell data-l={t("Trạng thái", "Status")}>
                      <PayBadge s={p.status} lang={language} />
                    </UiTableCell>
                  </UiTableRow>
                ))}
              </UiTableBody>
            </UiTable>
          </div>
        )}
        {o.status !== "cancelled" &&
          o.status !== "completed" &&
          o.status !== "awaiting_deposit" && (
            <p className="order-detail-view-28">
              {t(
                `Số dư ${fmtMoney(o.balance, language)} sẽ thanh toán khi nhận cá. Tiền cọc đã nằm trong tổng đơn.`,
                `The ${fmtMoney(o.balance, language)} balance is paid at handover. The deposit is already part of the total.`,
              )}
              {payTotal === 0 ? "" : ""}
            </p>
          )}
      </section>

      <section className="sl-card fm-section">
        <header>
          <h2>{t("Bàn giao cá", "Fish handover")}</h2>
        </header>
        <div className="fm-handover">
          {hv ? (
            <>
              <ol
                className="fm-track"
                aria-label={t("Tiến trình bàn giao", "Handover progress")}
              >
                {hvSteps.map(([k, l], i) => (
                  <li key={k} className={i <= hvIdx ? "done" : ""}>
                    <i>{i <= hvIdx && <Icon name="check" size={12} />}</i>
                    {l}
                  </li>
                ))}
              </ol>
              <div className="fm-ocard order-detail-view-30">
                <div className="fm-kv">
                  <small>{t("Hình thức", "Method")}</small>
                  <b>
                    {hv.method === "pickup"
                      ? t("Nhận tại trang trại", "Farm pickup")
                      : t("Giao tận nơi", "Home delivery")}
                  </b>
                </div>
                <div className="fm-kv">
                  <small>{t("Ngày mong muốn", "Preferred date")}</small>
                  <b>{fmtDay(hv.date, language)}</b>
                </div>
                <div className="fm-kv">
                  <small>{t("Địa điểm", "Location")}</small>
                  <b>{hv.address}</b>
                </div>
              </div>
              {o.status !== "completed" && (
                <p className="fm-demo-note">
                  {t(
                    `Số dư ${fmtMoney(o.balance, language)} thanh toán khi nhận cá.`,
                    `The ${fmtMoney(o.balance, language)} balance is due at handover.`,
                  )}
                </p>
              )}
            </>
          ) : o.status === "ready" ? (
            <Banner tone="ok">
              {t(
                "Cá của bạn đã sẵn sàng. Gửi yêu cầu nhận cá để trang trại sắp xếp lịch.",
                "Your fish are ready. Send a handover request so the farm can schedule it.",
              )}
            </Banner>
          ) : (
            <p className="order-detail-view-32">
              {o.status === "cancelled"
                ? t(
                    "Đơn đã hủy, không có bàn giao.",
                    "Order cancelled; no handover.",
                  )
                : t(
                    "Yêu cầu nhận cá chỉ khả dụng khi trang trại báo cá sẵn sàng.",
                    "Handover requests open once the farm marks the fish as ready.",
                  )}
            </p>
          )}
        </div>
      </section>

      {next && (
        <div className="fm-demo">
          <p>
            <b className="order-detail-view-34">
              {t("Điều khiển demo", "Demo control")}
            </b>
            <br />
            {t(
              "Mô phỏng phía trang trại để xem các trạng thái. Không có ở bản thật.",
              "Simulates the farm side so you can preview each state. Not in the real product.",
            )}
          </p>
          <UiButton
            variant="plain"
            className="sl-btn sl-btn-secondary"
            onClick={() => {
              demoAdvance(o.id);
              show(t("Đã cập nhật trạng thái (demo)", "Status updated (demo)"));
            }}
          >
            {t("Demo:", "Demo:")} {next}
          </UiButton>
        </div>
      )}

      {modal === "pay" && (
        <Modal title={t("Thanh toán đặt cọc", "Pay deposit")} onClose={close}>
          <p className="order-detail-view-36">
            {t(
              `Thanh toán ${fmtMoney(o.deposit, language)} để giữ chỗ cho đơn ${o.id}.`,
              `Pay ${fmtMoney(o.deposit, language)} to reserve your slot for ${o.id}.`,
            )}
          </p>
          <PayPanel
            amount={o.deposit}
            lang={language}
            cta={t("Xác nhận đặt cọc", "Confirm deposit")}
            run={async (m, fail) => {
              await payPendingDeposit(o.id, m, fail);
              close();
              show(t("Đặt cọc thành công", "Deposit paid successfully"));
            }}
          />
        </Modal>
      )}
      {modal === "cancel" && (
        <Modal title={t("Hủy đơn nuôi?", "Cancel this order?")} onClose={close}>
          <p className="order-detail-view-38">
            {o.status === "pending"
              ? t(
                  `Đơn ${o.id} chưa được xác nhận nên bạn sẽ được hoàn lại ${fmtMoney(o.deposit, language)} tiền cọc.`,
                  `${o.id} is not yet confirmed, so your ${fmtMoney(o.deposit, language)} deposit will be refunded.`,
                )
              : t(
                  "Đơn chưa đặt cọc sẽ bị hủy và không phát sinh chi phí.",
                  "This unpaid order will be cancelled at no cost.",
                )}
          </p>
          <div className="pt-modal-actions">
            <UiButton
              variant="plain"
              className="sl-btn sl-btn-ghost"
              onClick={close}
            >
              {t("Giữ đơn", "Keep order")}
            </UiButton>
            <UiButton
              variant="plain"
              className="sl-btn sl-btn-primary"
              onClick={() => {
                cancelOrder(o.id);
                close();
                show(t("Đã hủy đơn", "Order cancelled"));
              }}
            >
              {t("Xác nhận hủy", "Confirm cancel")}
            </UiButton>
          </div>
        </Modal>
      )}
      {modal === "handover" && (
        <HandoverForm
          o={o}
          language={language}
          onClose={close}
          onDone={() => {
            close();
            show(t("Đã gửi yêu cầu nhận cá", "Handover request sent"));
          }}
        />
      )}
    </>
  );
}
