import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/context/LanguageContext";
import { ApiError, errorMessage } from "@/services/api";
import { commerceApi } from "@/services/commerceApi";
import { availableOrderActions, orderFilters, orderLabel, orderLink, paymentLabel, type OrderAction } from "@/services/orders";
import { companyOrdersApi } from "@/services/companyOrdersApi";
import { availableCompanyOrderActions, companyOrderLink, companyTracking, shipmentInput, type CompanyOrderAction } from "@/services/companyOrders";
import type { Order, OrderFilter, OrderTracking, PaymentMethod } from "@/services/contracts";
import "./PublicMarketplace.css";
import "./Commerce.css";
import "./Orders.css";

type Action = OrderAction | CompanyOrderAction;
export default function Orders({ orderId, company = false }: { orderId: string | null; company?: boolean }) {
  const { language } = useTranslation();
  const tr = (en: string, vi: string) => language === "vi" ? vi : en;
  const money = (value: number) => new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
  const date = (value: string | null) => value ? new Date(value).toLocaleString(language === "vi" ? "vi-VN" : "en-US") : tr("Not recorded", "Chưa ghi nhận");
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [rows, setRows] = useState<Order[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [trackingError, setTrackingError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [estimate, setEstimate] = useState("");
  const [reason, setReason] = useState("");
  const link = company ? companyOrderLink : orderLink;
  const history = company ? "#company/orders" : "#marketplace/orders";
  const eligible = (value: Order): Action[] => company ? availableCompanyOrderActions(value) : availableOrderActions(value);
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [now, setNow] = useState(Date.now());
  const locked = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => { alive.current = false; clearInterval(timer); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setTrackingError(""); setRows([]); setOrder(null); setTracking(null); setConfirm(null);
    async function load() {
      if (orderId) {
        // Detail expires overdue balances first; tracking must reflect that same refreshed lifecycle.
        const detail = await (company ? companyOrdersApi.order(orderId, controller.signal) : commerceApi.order(orderId, controller.signal));
        if (controller.signal.aborted) return;
        setOrder(detail); setNeedsRefresh(false); setNow(Date.now());
        if (company) { setTracking(companyTracking(detail)); return; }
        try {
          const data = await commerceApi.tracking(orderId, controller.signal);
          if (!controller.signal.aborted) setTracking(data);
        } catch (failure) { if (!controller.signal.aborted) setTrackingError(errorMessage(failure, language)); }
      } else {
        const data = await (company ? companyOrdersApi.orders(filter, controller.signal) : commerceApi.orders(filter, controller.signal));
        if (!controller.signal.aborted) setRows(data);
      }
    }
    void load().catch((failure: unknown) => {
      if (!controller.signal.aborted) setError(errorMessage(failure, language));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [orderId, filter, reload, company]);
  const actions: Action[] = order ? company ? availableCompanyOrderActions(order) : availableOrderActions(order, now) : [];
  const actionLabel = (action: Action) => {
    const labels: Record<Action, [string, string]> = {
      cancel: ["Cancel order", "Hủy đơn"], "pay-balance": ["Pay balance · simulated", "Thanh toán phần còn lại · mô phỏng"],
      "confirm-delivery": ["Confirm receipt", "Xác nhận đã nhận hàng"], "mark-ready": ["Mark ready", "Đánh dấu sẵn sàng"],
      ship: ["Record shipment", "Ghi nhận vận chuyển"], deliver: ["Mark delivered", "Đánh dấu đã giao"], complete: ["Complete order", "Hoàn tất đơn"],
    };
    return tr(...labels[action]);
  };
  async function act(action: Action) {
    if (!order || locked.current || needsRefresh || !eligible(order).includes(action)) return;
    let shipment;
    if (company && action === "ship") {
      try { shipment = shipmentInput(carrier, trackingNumber, estimate); }
      catch { setError(tr("Check shipment lengths and the delivery date.", "Kiểm tra độ dài thông tin và ngày giao.")); return; }
    }
    if (company && action === "cancel" && (reason.trim().length < 4 || reason.trim().length > 300)) {
      setError(tr("Enter a cancellation reason of 4–300 characters.", "Nhập lý do hủy gồm 4–300 ký tự.")); return;
    }
    locked.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const updated = company
        ? action === "mark-ready" ? await companyOrdersApi.markReady(order.id)
          : action === "ship" ? await companyOrdersApi.ship(order.id, shipment ?? {})
          : action === "deliver" ? await companyOrdersApi.deliver(order.id)
          : action === "complete" ? await companyOrdersApi.complete(order.id)
          : await companyOrdersApi.cancel(order.id, reason.trim())
        : action === "cancel" ? await commerceApi.cancelOrder(order.id)
          : action === "pay-balance" ? await commerceApi.payBalance(order.id, method) : await commerceApi.confirmDelivery(order.id);
      if (!alive.current) return;
      setOrder(updated); setConfirm(null); setTracking(null); setTrackingError(""); setNow(Date.now());
      setNotice(tr("The server returned the updated order shown below.", "Máy chủ đã trả về đơn hàng được cập nhật bên dưới."));
      setCarrier(""); setTrackingNumber(""); setEstimate(""); setReason("");
      if (company) { setTracking(companyTracking(updated)); return; }
      try {
        const data = await commerceApi.tracking(updated.id);
        if (alive.current) setTracking(data);
      } catch (failure) { if (alive.current) setTrackingError(errorMessage(failure, language)); }
    } catch (failure) {
      if (!alive.current) return;
      setConfirm(null); setNeedsRefresh(true);
      const rejected = failure instanceof ApiError && [400, 404, 409].includes(failure.status);
      setError(errorMessage(failure, language) + " " + (rejected
        ? tr("Refresh the order before trying another action.", "Làm mới đơn hàng trước khi thử thao tác khác.")
        : company
          ? tr("The action may already have completed. Refresh the server record before retrying; fulfilment actions must not be blindly repeated.", "Thao tác có thể đã hoàn tất. Làm mới bản ghi máy chủ trước khi thử lại; không lặp lại thao tác giao hàng khi chưa kiểm tra.")
          : tr("The action may already have completed. Refresh to check the server record before retrying. Balance retries cannot create a second balance payment.", "Thao tác có thể đã hoàn tất. Làm mới để kiểm tra bản ghi máy chủ trước khi thử lại. Thử lại không tạo thêm thanh toán phần còn lại.")));
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  return <main className="public-market commerce orders">
    <a className="back-pill" href={orderId ? history : "#marketplace"}>← {orderId ? company ? tr("Company orders", "Đơn hàng công ty") : tr("Your orders", "Đơn hàng của bạn") : tr("Marketplace", "Chợ cá")}</a>
    <h1>{company ? orderId ? tr("Company order fulfilment", "Xử lý đơn hàng công ty") : tr("Company orders", "Đơn hàng công ty") : orderId ? tr("Order details and tracking", "Chi tiết và theo dõi đơn hàng") : tr("Your orders", "Đơn hàng của bạn")}</h1>
    {company && <p>{tr("All Admins operate this shared company queue. Only confirmed server transitions change an order; attribution does not restrict access to its creator.", "Mọi Admin cùng xử lý danh sách đơn của công ty. Chỉ chuyển trạng thái xác nhận từ máy chủ mới thay đổi đơn; không giới hạn theo người tạo.")}</p>}
    <p>{tr("Company fulfilment updates come from the server. Payments and refunds in this local integration are simulated, not real money transfers.", "Cập nhật giao hàng của công ty đến từ máy chủ. Thanh toán và hoàn tiền trong bản tích hợp cục bộ là mô phỏng, không chuyển tiền thật.")}</p>
    <div className="commerce-actions">
      {!orderId && <label htmlFor="orders-filter">{tr("Order status", "Trạng thái đơn")} <select id="orders-filter" value={filter} onChange={(event) => { setNotice(""); setFilter(event.target.value as OrderFilter); }}>
        {orderFilters.map((status) => <option key={status} value={status}>{status === "all" ? tr("All orders", "Tất cả đơn") : orderLabel(status, language)}</option>)}
      </select></label>}
      <button className="sl-btn sl-btn-ghost sm" disabled={busy || loading} onClick={() => { setNotice(""); setReload((n) => n + 1); }}>{tr("Refresh", "Làm mới")}</button>
    </div>
    {error && <p role="alert" className="commerce-alert">{error}</p>}
    {notice && <p role="status" className="commerce-alert">{notice}</p>}
    {loading && <p role="status">{tr("Loading…", "Đang tải…")}</p>}
    {!loading && !orderId && !error && !rows.length && <section className="commerce-panel"><h2>{tr("No orders found", "Không tìm thấy đơn hàng")}</h2><p>{filter === "all" ? company ? tr("The company queue is empty.", "Danh sách đơn công ty trống.") : tr("You have not placed any orders yet.", "Bạn chưa đặt đơn hàng nào.") : tr("No orders have this status. Try another filter.", "Không có đơn ở trạng thái này. Thử bộ lọc khác.")}</p><a href="#marketplace">{tr("Browse fish", "Xem cá")}</a></section>}
    {!loading && !orderId && rows.map((row) => <article className="commerce-panel" key={row.id}>
      <h2><a href={link(row.id)}>{row.id}</a></h2>
      <p>{row.company.name} · {date(row.placedAt)}</p>
      {company && <p>{tr("Customer", "Khách hàng")}: {row.buyer.name} · {row.buyer.email}</p>}
      <p>{tr("Order status", "Trạng thái đơn")}: <strong>{orderLabel(row.status, language)}</strong> · {tr("Payment", "Thanh toán")}: <strong>{paymentLabel(row.paymentStatus, language)}</strong></p>
      {row.items.map((item) => <p key={item.listingId}>{item.name || item.code} × {item.quantity} · {money(item.lineTotal)}</p>)}
      <p>{tr("Order total", "Tổng đơn")}: <strong>{money(row.total)}</strong></p>
      {row.balanceDueAt && <p>{tr("Balance deadline", "Hạn thanh toán phần còn lại")}: {date(row.balanceDueAt)}</p>}
      <a className="commerce-primary" href={link(row.id)}>{tr("View details and tracking", "Xem chi tiết và theo dõi")}</a>
    </article>)}
    {!loading && order && <div className="commerce-layout">
      <div><section className="commerce-panel"><h2>{order.id}</h2><p>{order.company.name} · {date(order.placedAt)}</p>
        {company && <><h3>{tr("Customer", "Khách hàng")}</h3><p>{order.buyer.name} · {order.buyer.email} · {order.buyer.phone ?? tr("No phone recorded", "Chưa có số điện thoại")}</p></>}
        <p>{tr("Order status", "Trạng thái đơn")}: <strong>{orderLabel(order.status, language)}</strong> <small>({order.status})</small></p>
        <p>{tr("Payment status", "Trạng thái thanh toán")}: <strong>{paymentLabel(order.paymentStatus, language)}</strong> <small>({order.paymentStatus})</small></p>
        {order.items.map((item) => <article className="commerce-line" key={item.listingId}>{item.image && <img src={item.image} alt={item.name} />}<div><strong>{item.name || item.code}</strong><p>{item.code} · {item.quantity} × {money(item.unitPrice)} = {money(item.lineTotal)}</p><p>{item.saleMode === "pre_order" ? tr("Pre-order", "Đặt trước") : tr("In stock", "Có sẵn")}</p></div></article>)}
        <h3>{tr("Delivery to", "Giao cho")}</h3><p>{order.delivery.recipientName} · {order.delivery.phone}</p><p>{[order.delivery.address, order.delivery.city, order.delivery.province].filter(Boolean).join(", ")}</p>
        {order.delivery.deliveryMethod && <p>{order.delivery.deliveryMethod}</p>}
      </section>
      <section className="commerce-panel"><h2>{tr("Shipment and recorded events", "Vận chuyển và sự kiện đã ghi nhận")}</h2>
        {trackingError && <p role="alert" className="commerce-alert">{trackingError} {tr("Refresh to reload tracking. Order details above remain available.", "Làm mới để tải lại theo dõi. Chi tiết đơn bên trên vẫn khả dụng.")}</p>}
        {tracking && <><p>{tr("Tracking status", "Trạng thái theo dõi")}: {orderLabel(tracking.status, language)}</p><p>{tr("Carrier", "Đơn vị vận chuyển")}: {tracking.carrier ?? tr("Not assigned", "Chưa chỉ định")}</p><p>{tr("Tracking number", "Mã vận đơn")}: {tracking.trackingNumber ?? tr("Not assigned", "Chưa chỉ định")}</p><p>{tr("Estimated delivery", "Dự kiến giao")}: {tracking.estimatedDeliveryAt ? date(tracking.estimatedDeliveryAt) : tr("Not scheduled", "Chưa có lịch")}</p>
          <ol className="orders-timeline">{tracking.events.map((event) => <li key={event.status}><strong>{orderLabel(event.status, language)}</strong><time dateTime={event.at}>{date(event.at)}</time></li>)}</ol>
          {!tracking.events.length && <p>{tr("No events recorded.", "Chưa ghi nhận sự kiện.")}</p>}</>}
        <p>{tr("Only recorded events are shown; future dates and delivery steps are not invented.", "Chỉ hiển thị sự kiện đã ghi nhận; không tạo ngày hoặc bước giao hàng tương lai.")}</p>
      </section></div>
      <aside><section className="commerce-panel"><h2>{tr("Order amounts", "Số tiền của đơn")}</h2>
        <p>{tr("Subtotal", "Tạm tính")}: {money(order.subtotal)}</p><p>{tr("Shipping", "Vận chuyển")}: {money(order.shippingFee)}</p><p>{tr("Order total", "Tổng đơn")}: <strong>{money(order.total)}</strong></p>
        {order.depositAmount !== null && <><p>{tr("Original deposit", "Tiền cọc ban đầu")}: {money(order.depositAmount)}</p><p>{tr("Original balance", "Phần còn lại ban đầu")}: {money(order.balanceAmount ?? 0)}</p>
          {order.balanceDueAt ? <p>{tr("Balance deadline", "Hạn thanh toán phần còn lại")}: <strong>{date(order.balanceDueAt)}</strong></p>
            : <p>{order.paymentStatus === "paid" ? tr("No outstanding balance.", "Không còn số tiền phải thanh toán.") : order.paymentStatus === "refunded" ? tr("Order refunded; no balance is due.", "Đơn đã hoàn tiền; không cần thanh toán phần còn lại.") : tr("The seven-day balance deadline is set when the company marks the order ready.", "Hạn thanh toán phần còn lại trong bảy ngày được xác định khi công ty đánh dấu đơn sẵn sàng.")}</p>}
          <p>{tr("Missing that deadline cancels and refunds the order; the deposit is not forfeited.", "Quá hạn sẽ hủy và hoàn tiền đơn hàng; không mất cọc.")}</p></>}
        <h3>{tr("Payment records", "Bản ghi thanh toán")}</h3>
        {order.payments.map((payment) => <div key={payment.id} className="orders-payment"><p>{payment.purpose} · {payment.provider} · {payment.method}</p><p><strong>{money(payment.amount)}</strong> · {payment.state}</p>{payment.paidAt && <p>{tr("Paid at", "Thanh toán lúc")}: {date(payment.paidAt)}</p>}{payment.refundedAt && <p>{tr("Refunded at", "Hoàn tiền lúc")}: {date(payment.refundedAt)}</p>}</div>)}
        {!order.payments.length && <p>{tr("No payment records.", "Chưa có bản ghi thanh toán.")}</p>}
      </section>
      <section className="commerce-panel"><h2>{tr("Order actions", "Thao tác đơn hàng")}</h2>
        {needsRefresh && <p role="status">{tr("Refresh to reconcile the order before another action.", "Làm mới để kiểm tra trạng thái đơn trước thao tác khác.")}</p>}
        {order.paymentStatus === "balance_due" && order.balanceDueAt && Date.parse(order.balanceDueAt) <= now && <p role="alert">{tr("The recorded balance deadline has passed. Refresh for the server's cancellation/refund result.", "Đã quá hạn thanh toán đã ghi nhận. Làm mới để xem kết quả hủy/hoàn tiền từ máy chủ.")}</p>}
        {actions.includes("pay-balance") && <label className="orders-method" htmlFor="balance-method">{tr("Simulated payment method", "Phương thức thanh toán mô phỏng")}<select id="balance-method" disabled={busy || needsRefresh || !!confirm} value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}><option value="bank_transfer">{tr("Bank transfer", "Chuyển khoản")}</option><option value="e_wallet">{tr("E-wallet", "Ví điện tử")}</option><option value="bank_card">{tr("Bank card", "Thẻ ngân hàng")}</option></select></label>}
        {company && order.status === "ready" && order.saleMode === "pre_order" && order.paymentStatus !== "paid" && <p>{tr("Shipment is blocked until the customer pays the balance in full. Refresh after payment to retrieve the new server state.", "Chưa thể vận chuyển cho đến khi khách thanh toán đủ phần còn lại. Làm mới sau thanh toán để lấy trạng thái máy chủ.")}</p>}
        {company && actions.includes("ship") && <fieldset className="commerce-fields" disabled={busy || needsRefresh || !!confirm}><legend>{tr("Shipment details · optional", "Thông tin vận chuyển · tùy chọn")}</legend>
          <label>{tr("Carrier", "Đơn vị vận chuyển")}<input maxLength={80} value={carrier} onChange={(event) => setCarrier(event.target.value)} /></label>
          <label>{tr("Tracking number", "Mã vận đơn")}<input maxLength={100} value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} /></label>
          <label>{tr("Estimated delivery · your local time", "Dự kiến giao · giờ địa phương")}<input type="datetime-local" value={estimate} onChange={(event) => setEstimate(event.target.value)} /></label>
          <p>{tr("Record only known shipment data. Empty fields stay unassigned. The optional estimate is sent as UTC, not a promised delivery time.", "Chỉ ghi thông tin vận chuyển đã biết. Trường trống giữ nguyên chưa chỉ định. Dự kiến được gửi theo UTC, không phải cam kết giờ giao.")}</p>
        </fieldset>}
        {company && confirm === "cancel" && <label className="orders-method">{tr("Cancellation reason · 4–300 characters", "Lý do hủy · 4–300 ký tự")}<textarea minLength={4} maxLength={300} disabled={busy} value={reason} onChange={(event) => setReason(event.target.value)} /></label>}
        {!confirm && actions.map((action) => <button key={action} disabled={busy || needsRefresh} onClick={() => setConfirm(action)}>{actionLabel(action)}</button>)}
        {confirm && <div className="commerce-alert" role="group" aria-label={tr("Confirm order action", "Xác nhận thao tác đơn")}>
          {company && confirm !== "cancel" ? <p>{confirm === "mark-ready"
            ? order.saleMode === "pre_order" ? tr("Mark this preorder ready? This starts the customer's seven-day balance deadline. Missing it cancels and refunds the order; the deposit is not forfeited.", "Đánh dấu đơn đặt trước sẵn sàng? Bắt đầu hạn bảy ngày thanh toán phần còn lại. Quá hạn hủy và hoàn tiền, không mất cọc.") : tr("Confirm that this order is ready for shipment.", "Xác nhận đơn đã sẵn sàng vận chuyển.")
            : confirm === "ship" ? tr(`Record shipment now? Carrier: ${carrier.trim() || "not assigned"}; tracking: ${trackingNumber.trim() || "not assigned"}; local estimate: ${estimate || "not scheduled"}. These fields cannot be edited in this screen after shipment.`, `Ghi nhận vận chuyển ngay? Đơn vị: ${carrier.trim() || "chưa chỉ định"}; vận đơn: ${trackingNumber.trim() || "chưa chỉ định"}; dự kiến địa phương: ${estimate || "chưa có lịch"}. Không thể sửa các trường này tại đây sau khi giao.`)
            : confirm === "deliver" ? tr("Confirm that delivery has actually occurred. Do not mark delivered merely because the estimate has passed.", "Xác nhận đã giao thực tế. Không đánh dấu đã giao chỉ vì đã qua giờ dự kiến.")
            : tr("Close this delivered order? The server blocks completion while a dispute is open or being reviewed.", "Hoàn tất đơn đã giao? Máy chủ chặn hoàn tất khi có khiếu nại đang mở hoặc xét duyệt.")}</p> : <p>{confirm === "cancel" ? tr("Cancel this order before shipment? Recorded paid amounts will be refunded and reserved stock returned by the server. This cannot be undone here.", "Hủy đơn trước khi giao? Máy chủ sẽ hoàn số tiền đã thanh toán và trả số lượng đã giữ. Không thể hoàn tác tại đây.") : confirm === "confirm-delivery" ? tr("Confirm only after you have received and inspected the fish. This completes the order. The server blocks completion while a dispute is open or being reviewed.", "Chỉ xác nhận sau khi đã nhận và kiểm tra cá. Thao tác hoàn tất đơn. Máy chủ chặn hoàn tất khi có khiếu nại đang mở hoặc xét duyệt.") : tr(`Record a simulated balance payment of ${money(order.balanceAmount ?? 0)}? No real money is charged. The server rechecks the deadline and may return a refund instead if it has passed.`, `Ghi nhận thanh toán mô phỏng phần còn lại ${money(order.balanceAmount ?? 0)}? Không thu tiền thật. Máy chủ kiểm tra lại hạn và có thể trả về hoàn tiền nếu đã quá hạn.`)}</p>}
          <button className="commerce-primary" disabled={busy || needsRefresh || !actions.includes(confirm) || (company && confirm === "cancel" && reason.trim().length < 4)} onClick={() => void act(confirm)}>{busy ? tr("Submitting…", "Đang gửi…") : tr("Confirm action", "Xác nhận thao tác")}</button><button disabled={busy} onClick={() => setConfirm(null)}>{tr("Keep order unchanged", "Giữ nguyên đơn")}</button>
        </div>}
        {!actions.length && <p>{company ? tr("No company action is available at this stage.", "Chưa có thao tác công ty ở giai đoạn này.") : tr("No buyer action is available at this stage.", "Chưa có thao tác cho người mua ở giai đoạn này.")}</p>}
        {!company && ["shipped", "delivered", "completed"].includes(order.status) && <a href={`#marketplace/orders/${encodeURIComponent(order.id)}/dispute`}>{tr("Report an issue or view existing dispute", "Báo cáo vấn đề hoặc xem khiếu nại hiện có")}</a>}
        {company && <a href="#admin/disputes">{tr("Open company dispute queue", "Mở danh sách khiếu nại công ty")}</a>}
        <p>{company ? tr("The customer pays any balance from their order screen. Dispute review is available in the separate company dispute queue.", "Khách thanh toán phần còn lại từ màn hình đơn hàng. Xét duyệt khiếu nại tại danh sách riêng của công ty.") : tr("The company records readiness, shipment and delivery. Reviews and messaging are not integrated in this screen.", "Công ty ghi nhận sẵn sàng, vận chuyển và giao hàng. Đánh giá và nhắn tin chưa được tích hợp ở màn hình này.")}</p>
      </section></aside>
    </div>}
  </main>;
}
