import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "@/context/LanguageContext";
import { useUser } from "@/services/session";
import { ApiError, errorMessage } from "@/services/api";
import { commerceApi } from "@/services/commerceApi";
import { orderLink } from "@/services/orders";
import { beginCheckout, checkoutEstimate, finishCheckout, pendingCheckout, type CheckoutAttempt } from "@/services/checkout";
import type { Cart, CheckoutInput, Order, PaymentMethod } from "@/services/contracts";
import "./PublicMarketplace.css";
import "./Commerce.css";

export default function Commerce({ route, orderId }: { route: string; orderId: string | null }) {
  const user = useUser();
  const { language } = useTranslation();
  const tr = (en: string, vi: string) => language === "vi" ? vi : en;
  const money = (value: number) => new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
  const [cart, setCart] = useState<Cart | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [recoveryError, setRecoveryError] = useState(false);
  const [attempt, setAttempt] = useState<CheckoutAttempt | null>(null);
  const [input, setInput] = useState<CheckoutInput>({ recipientName: user?.name ?? "", phone: user?.phone ?? "", address: "", city: "", province: "", paymentMethod: "bank_transfer" });
  const confirmation = route === "marketplace/confirmation";
  const checkout = route === "marketplace/checkout";
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    setLoading(true); setError(""); setCart(null); setOrder(null);
    setRecoveryError(false);
    try {
      const saved = pendingCheckout(user.email);
      setAttempt(saved);
      if (saved) setInput(saved.input);
    } catch (failure) { setRecoveryError(true); setError(failure instanceof Error ? failure.message : String(failure)); }
    const request = confirmation
      ? orderId ? commerceApi.order(orderId, controller.signal).then((data) => {
          if (!controller.signal.aborted) setOrder(data);
        }) : Promise.reject(new ApiError(404, "order.notFound"))
      : commerceApi.cart(controller.signal).then((data) => { if (!controller.signal.aborted) setCart(data); });
    void request.catch((failure: unknown) => {
      if (!controller.signal.aborted) setError(errorMessage(failure, language));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [route, orderId, user?.email, reload]);
  async function change(action: () => Promise<Cart>) {
    if (locked.current || attempt || recoveryError) return;
    locked.current = true; setBusy(true); setError("");
    try { setCart(await action()); }
    catch (failure) { setError(errorMessage(failure, language)); }
    finally { locked.current = false; setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current || !user) return;
    if (!attempt && (!input.recipientName.trim() || !input.phone.trim() || !input.address.trim())) {
      setError(tr("Recipient name, phone, and address are required.", "Cần nhập tên người nhận, số điện thoại và địa chỉ.")); return;
    }
    locked.current = true; setBusy(true); setError("");
    let current: CheckoutAttempt | null = attempt;
    try {
      current = beginCheckout(user.email, {
        recipientName: input.recipientName.trim(), phone: input.phone.trim(), address: input.address.trim(),
        city: input.city?.trim(), province: input.province?.trim(), paymentMethod: input.paymentMethod,
      });
      setAttempt(current);
      const result = await commerceApi.checkout(current.input, current.key);
      finishCheckout(user.email, current.key);
      setAttempt(null);
      window.location.hash = `marketplace/confirmation?order=${encodeURIComponent(result.id)}`;
    } catch (failure) {
      // These transaction rejections cannot hide a committed order; auth and transport failures can.
      if (current && failure instanceof ApiError && [400, 404, 409].includes(failure.status)) {
        finishCheckout(user.email, current.key); setAttempt(null);
      }
      setError(errorMessage(failure, language));
    } finally { locked.current = false; setBusy(false); }
  }
  const estimate = cart ? checkoutEstimate(cart) : null;
  const invalidCart = recoveryError || !cart?.items.length || cart.saleMode === "mixed" || cart.items.some((line) => line.quantity > line.available)
    || (cart.saleMode === "pre_order" && estimate?.pct == null);
  return <main className="public-market commerce">
    <a href="#marketplace">← {tr("Marketplace", "Chợ cá")}</a>
    <h1>{confirmation ? tr("Order confirmation", "Xác nhận đơn hàng") : checkout ? tr("Checkout", "Thanh toán") : tr("Your cart", "Giỏ hàng")}</h1>
    <nav className="commerce-steps" aria-label={tr("Purchase steps", "Các bước mua hàng")}>
      <a href="#marketplace/cart" aria-current={!confirmation && !checkout ? "step" : undefined}>{tr("Cart", "Giỏ hàng")}</a>
      <a href="#marketplace/checkout" aria-current={checkout ? "step" : undefined}>{tr("Checkout", "Thanh toán")}</a>
      <span aria-current={confirmation ? "step" : undefined}>{tr("Confirmation", "Xác nhận")}</span>
    </nav>
    {error && <p className="commerce-alert" role="alert">{error}</p>}
    {loading && <p role="status">{tr("Loading…", "Đang tải…")}</p>}
    {!loading && !cart && !order && <button onClick={() => setReload((n) => n + 1)}>{tr("Retry", "Thử lại")}</button>}
    {!confirmation && attempt && <section className="commerce-alert" role="status">
      <p>{tr("A checkout response is unresolved. Retry the saved submission before changing your cart or placing another order. Retrying uses the same key and delivery details, even if the cart is now empty.", "Chưa xác định kết quả thanh toán. Thử lại yêu cầu đã lưu trước khi thay đổi giỏ hoặc đặt đơn khác. Yêu cầu dùng cùng mã và thông tin giao hàng, kể cả khi giỏ đã trống.")}</p>
      {!checkout && <a href="#marketplace/checkout">{tr("Resolve checkout", "Kiểm tra thanh toán")}</a>}
    </section>}
    {!loading && cart && (!checkout ? <>
      {!cart.items.length && <p>{tr("Your cart is empty.", "Giỏ hàng đang trống.")}</p>}
      <div className="commerce-layout">
        <section className="commerce-panel">
          {cart.items.map((line) => <article className="commerce-line" key={line.listingId}>
            {line.image && <img src={line.image} alt={line.name} />}
            <div><a href={`#marketplace/detail?fish=${encodeURIComponent(line.code)}`}>{line.name}</a>
              <p>{line.code} · {line.saleMode === "pre_order" ? tr("Pre-order", "Đặt trước") : tr("In stock", "Có sẵn")}</p>
              <p>{money(line.price)} × {line.quantity} = <strong>{money(line.lineTotal)}</strong></p>
              <p>{tr("Available", "Có sẵn")}: {line.available}</p>
              <div className="commerce-actions">
                <button aria-label={`${tr("Decrease", "Giảm")} ${line.name}`} disabled={busy || !!attempt || recoveryError || line.quantity <= 1} onClick={() => void change(() => commerceApi.setQuantity(line.listingId, line.quantity - 1))}>−</button>
                <span aria-label={tr("Quantity", "Số lượng")}>{line.quantity}</span>
                <button aria-label={`${tr("Increase", "Tăng")} ${line.name}`} disabled={busy || !!attempt || recoveryError || line.quantity >= line.available} onClick={() => void change(() => commerceApi.setQuantity(line.listingId, line.quantity + 1))}>+</button>
                <button disabled={busy || !!attempt || recoveryError} onClick={() => void change(() => commerceApi.remove(line.listingId))}>{tr("Remove", "Xóa")}</button>
              </div>
            </div>
          </article>)}
          {!!cart.items.length && <button disabled={busy || !!attempt || recoveryError} onClick={() => void change(commerceApi.clear)}>{tr("Clear cart", "Xóa giỏ hàng")}</button>}
        </section>
        <aside className="commerce-panel"><h2>{tr("Cart summary", "Tổng giỏ hàng")}</h2>
          <p>{cart.itemCount} {tr("fish", "cá")}</p><p>{tr("Subtotal", "Tạm tính")}: <strong>{money(cart.subtotal)}</strong></p>
          <p>{tr("Stock and prices are checked again at checkout. Adding to your cart does not reserve stock.", "Số lượng và giá được kiểm tra lại khi thanh toán. Thêm vào giỏ không giữ chỗ.")}</p>
          {cart.saleMode === "mixed" && <p role="alert">{tr("In-stock fish and pre-orders must be checked out separately. Remove one sale mode to continue.", "Cá có sẵn và đặt trước phải thanh toán riêng. Xóa một loại để tiếp tục.")}</p>}
          {cart.items.some((line) => line.quantity > line.available) && <p role="alert">{tr("Stock has changed. Reduce or remove unavailable quantities.", "Số lượng đã thay đổi. Giảm số lượng hoặc xóa sản phẩm hết hàng.")}</p>}
          {!invalidCart && !attempt && <a className="commerce-primary" href="#marketplace/checkout">{tr("Continue to checkout", "Tiếp tục thanh toán")}</a>}
          <button disabled={busy} onClick={() => setReload((n) => n + 1)}>{tr("Refresh cart", "Làm mới giỏ")}</button>
        </aside>
      </div>
    </> : <form onSubmit={(event) => { void submit(event); }} className="commerce-layout">
      <div><fieldset disabled={busy || !!attempt || recoveryError} className="commerce-panel commerce-fields"><legend>{tr("Delivery details", "Thông tin giao hàng")}</legend>
        {([
          ["recipientName", tr("Recipient name", "Tên người nhận"), "name", 80, true],
          ["phone", tr("Phone", "Số điện thoại"), "tel", 32, true],
          ["address", tr("Address", "Địa chỉ"), "street-address", 200, true],
          ["city", tr("City (optional)", "Thành phố (không bắt buộc)"), "address-level2", 80, false],
          ["province", tr("Province (optional)", "Tỉnh (không bắt buộc)"), "address-level1", 80, false],
        ] as const).map(([key, label, autocomplete, max, required]) => <label key={key} htmlFor={`checkout-${key}`}>{label}<input id={`checkout-${key}`} name={key} type={key === "phone" ? "tel" : "text"} autoComplete={autocomplete} required={required} maxLength={max} value={input[key] ?? ""} onChange={(event) => setInput((old) => ({ ...old, [key]: event.target.value }))} /></label>)}
        <label htmlFor="checkout-method">{tr("Simulated payment method", "Phương thức thanh toán mô phỏng")}
          <select id="checkout-method" value={input.paymentMethod} onChange={(event) => setInput((old) => ({ ...old, paymentMethod: event.target.value as PaymentMethod }))}>
            <option value="bank_transfer">{tr("Bank transfer", "Chuyển khoản")}</option><option value="e_wallet">{tr("E-wallet", "Ví điện tử")}</option><option value="bank_card">{tr("Bank card", "Thẻ ngân hàng")}</option>
          </select>
        </label>
      </fieldset><section className="commerce-panel"><h2>{tr("Local payment simulation", "Mô phỏng thanh toán cục bộ")}</h2>
        <p>{tr("No real money is charged. Do not enter card numbers or bank credentials. The backend records a simulated payment when it creates the order.", "Không thu tiền thật. Không nhập số thẻ hay thông tin ngân hàng. Backend ghi nhận thanh toán mô phỏng khi tạo đơn.")}</p>
        <p>{tr("Use this tab to finish checkout. If a response is unresolved, do not clear session data or submit from another tab.", "Hoàn tất thanh toán trong tab này. Nếu kết quả chưa xác định, không xóa dữ liệu phiên hoặc gửi từ tab khác.")}</p>
        <p>{tr("Shipping defaults to 0 ₫ in this integration. Delivery schedules are not quoted; this is not a production shipping offer.", "Phí vận chuyển mặc định là 0 ₫ trong bản tích hợp. Chưa có lịch giao hàng; đây không phải báo giá vận chuyển thật.")}</p>
      </section></div>
      <aside className="commerce-panel"><h2>{tr("Order summary", "Tóm tắt đơn hàng")}</h2>
        {attempt ? <p>{tr("Retrying the saved submission, not the current cart. Its order and payment amounts will be read from the server after recovery.", "Thử lại yêu cầu đã lưu, không phải giỏ hiện tại. Số tiền của đơn và thanh toán sẽ được đọc từ máy chủ sau khi khôi phục.")}</p> : <>
        {cart.items.map((line) => <p key={line.listingId}>{line.name} × {line.quantity} <strong>{money(line.lineTotal)}</strong></p>)}
        <p>{tr("Subtotal", "Tạm tính")}: {money(cart.subtotal)}</p><p>{tr("Shipping", "Vận chuyển")}: {money(0)}</p>
        <p>{tr("Estimated total", "Tổng dự kiến")}: <strong>{money(cart.subtotal)}</strong></p>
        {estimate && cart.saleMode === "pre_order" && <><p>{tr("Deposit now", "Đặt cọc ngay")} ({estimate.pct}%): <strong>{money(estimate.dueNow)}</strong></p><p>{tr("Remaining balance", "Số tiền còn lại")}: {money(estimate.balance)}</p>
          <p>{tr("The backend uses the first cart line's deposit rate for this order. The balance is due within seven days after the company marks it ready. Missing the deadline cancels and refunds the order; the deposit is not forfeited.", "Backend dùng tỷ lệ cọc của dòng đầu tiên cho đơn này. Thanh toán phần còn lại trong bảy ngày sau khi công ty đánh dấu sẵn sàng. Quá hạn sẽ hủy và hoàn tiền, không mất cọc.")}</p></>}
        <p>{tr("Final amounts and stock availability are determined by the server.", "Số tiền cuối cùng và số lượng do máy chủ xác định.")}</p></>}
        {invalidCart && !attempt && <p role="alert">{tr("Your cart cannot be checked out. Return to the cart to resolve empty, mixed, or unavailable items.", "Giỏ hàng chưa thể thanh toán. Quay lại để xử lý giỏ trống, loại bán khác nhau hoặc hết hàng.")}</p>}
        <button className="commerce-primary" type="submit" disabled={busy || (!attempt && invalidCart) || (!!error && !attempt && !cart)}>{busy ? tr("Submitting…", "Đang gửi…") : attempt ? tr("Retry saved checkout", "Thử lại thanh toán đã lưu") : tr("Place order · simulated payment", "Đặt đơn · thanh toán mô phỏng")}</button>
      </aside>
    </form>)}
    {!loading && order && <div className="commerce-layout">
      <section className="commerce-panel"><h2>{order.id}</h2><p>{order.company.name}</p>
        <p>{tr("Order status", "Trạng thái đơn")}: <strong>{order.status}</strong></p><p>{tr("Payment status", "Trạng thái thanh toán")}: <strong>{order.paymentStatus}</strong></p>
        {order.items.map((line) => <article className="commerce-line" key={line.listingId}>{line.image && <img src={line.image} alt={line.name} />}<div><strong>{line.name}</strong><p>{line.code} · {line.quantity} × {money(line.unitPrice)} = {money(line.lineTotal)}</p></div></article>)}
        <h3>{tr("Delivery to", "Giao cho")}</h3><p>{order.delivery.recipientName} · {order.delivery.phone}</p><p>{[order.delivery.address, order.delivery.city, order.delivery.province].filter(Boolean).join(", ")}</p>
        <p>{tr("Estimated delivery", "Dự kiến giao")}: {order.estimatedDeliveryAt ? new Date(order.estimatedDeliveryAt).toLocaleString(language) : tr("Not scheduled", "Chưa có lịch")}</p>
      </section>
      <aside className="commerce-panel"><h2>{tr("Server totals", "Số tiền từ máy chủ")}</h2>
        <p>{tr("Subtotal", "Tạm tính")}: {money(order.subtotal)}</p><p>{tr("Shipping", "Vận chuyển")}: {money(order.shippingFee)}</p><p>{tr("Total", "Tổng cộng")}: <strong>{money(order.total)}</strong></p>
        {order.depositAmount !== null && <><p>{tr("Original deposit", "Tiền cọc ban đầu")}: {money(order.depositAmount)}</p><p>{tr("Original balance", "Phần còn lại ban đầu")}: {money(order.balanceAmount ?? 0)}</p><p>{tr("Balance deadline", "Hạn thanh toán còn lại")}: {order.balanceDueAt ? new Date(order.balanceDueAt).toLocaleString(language) : order.paymentStatus === "paid" || order.paymentStatus === "refunded" ? tr("No balance due", "Không cần thanh toán thêm") : tr("Set when ready", "Xác định khi sẵn sàng")}</p></>}
        {order.payments.map((payment) => <p key={payment.id}>{tr("Payment record", "Bản ghi thanh toán")}: {payment.provider} · {payment.method} · {payment.state} · {money(payment.amount)}</p>)}
        <p>{tr("This order uses simulated payments, not real charges.", "Đơn hàng dùng thanh toán mô phỏng, không thu tiền thật.")}</p>
        <a className="commerce-primary" href={orderLink(order.id)}>{tr("View details and tracking", "Xem chi tiết và theo dõi")}</a><p><a href="#marketplace/orders">{tr("Your orders", "Đơn hàng của bạn")}</a></p>
        <a href="#marketplace">{tr("Continue browsing", "Tiếp tục xem cá")}</a>
      </aside>
    </div>}
  </main>;
}
