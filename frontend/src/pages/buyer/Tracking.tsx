import { Button as UiButton } from "@/components/ui/button";
import { BuyButton, Glyph } from "@/components/buyer/BuyerParts";
import { useBuyer } from "@/context/BuyerContext";
import { OrderProduct } from "@/components/buyer/BuyerWidgets";
export function Tracking() {
  const {
    setModal,
    currentPurchase,
    shipping,
    delivered,
    completed,
    reviewSent,
    disputeSent,
    heading,
    go,
  } = useBuyer();
  const statusRank = {
    confirmed: 1,
    preparing: 2,
    shipped: 3,
    delivered: 4,
    completed: 5,
    cancelled: 0,
  }[currentPurchase?.status ?? "confirmed"];
  const dateTime = (value?: string) =>
    value
      ? new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(value))
      : "Pending";
  return (
    <>
      <div className="buy-page-heading">
        <span className="buy-eyebrow">EVERY STEP, IN THE CLEAR</span>
        <h1 ref={heading} tabIndex={-1}>
          Track Your Order<span>.</span>
        </h1>
        <p>
          {currentPurchase?.id} · {currentPurchase?.status}
        </p>
      </div>
      <div className="buy-tracking-layout">
        <section className="buy-panel">
          <OrderProduct />
          <div className="buy-tracking-status">
            <span className="buy-status-pill">
              {disputeSent
                ? "Support reviewing"
                : completed
                  ? "Order completed"
                  : delivered
                    ? "Delivered"
                    : "Farm preparing"}
            </span>
            <span>
              {delivered
                ? "Delivered to your shipping address"
                : "Estimated arrival: 1–2 business days after dispatch"}
            </span>
          </div>
          <ol className="buy-timeline">
            {[
              [
                "Order Placed",
                currentPurchase?.createdAt,
                "Your order has been received.",
              ],
              [
                "Payment Confirmed",
                currentPurchase?.paidAt,
                "Payment has been recorded.",
              ],
              [
                "Farm Preparing",
                currentPurchase?.readyAt,
                "The seller is preparing the order for dispatch.",
              ],
              [
                "Shipped",
                statusRank >= 3 ? currentPurchase?.updatedAt : undefined,
                "The order has been handed to the delivery service.",
              ],
              [
                "Delivered",
                currentPurchase?.deliveredAt,
                "Please inspect your fish and confirm receipt.",
              ],
            ].map(([title, at, description], i) => (
              <li
                key={title}
                className={
                  statusRank > i
                    ? "done"
                    : statusRank === i
                      ? "current"
                      : "pending"
                }
              >
                <span className="buy-timeline-marker">
                  {statusRank > i ? (
                    <Glyph name="check" />
                  ) : statusRank === i ? (
                    <Glyph name="box" />
                  ) : (
                    <span />
                  )}
                </span>
                <div>
                  <div className="buy-timeline-title">
                    <h3>{title}</h3>
                    <span>{dateTime(at)}</span>
                  </div>
                  <p>{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <aside className="buy-tracking-aside">
          <section className="buy-panel">
            <span className="buy-eyebrow">YOUR DELIVERY</span>
            <h2>
              <Glyph name="truck" />
              Handled with care.
            </h2>
            <strong>{shipping.name}</strong>
            <p>
              {shipping.address}
              <br />
              {shipping.city}, {shipping.province}
              <br />
              {shipping.phone}
            </p>
            <div className="buy-tracking-buttons">
              <BuyButton secondary onClick={() => setModal("messages")}>
                <Glyph name="message" />
                Contact Seller
              </BuyButton>
              <UiButton
                variant="plain"
                className="buy-text-link"
                onClick={() => setModal("support")}
              >
                Contact Support
                <Glyph name="arrow" />
              </UiButton>
            </div>
          </section>
          <section className="buy-panel">
            <span className="buy-eyebrow">ORDER ACTIONS</span>
            <h3>
              {disputeSent
                ? "Your issue is under review."
                : completed
                  ? "Thanks for completing your trade."
                  : "We'll update this page as your order progresses."}
            </h3>
            <p>
              {disputeSent
                ? "We've kept your order open while your report is reviewed. You can check your case details below."
                : completed
                  ? "You can view or submit your review below."
                  : "Delivery confirmation becomes available after the seller marks the order delivered."}
            </p>
            <BuyButton
              onClick={() => {
                if (disputeSent) go("dispute");
                else if (completed) go("review");
                else if (delivered) go("delivery");
              }}
              disabled={!disputeSent && !completed && !delivered}
            >
              {disputeSent
                ? "View Issue Report"
                : completed
                  ? reviewSent
                    ? "View Review"
                    : "Leave a Review"
                  : delivered
                    ? "Confirm Your Delivery"
                    : "Waiting for Delivery"}
              <Glyph name="arrow" />
            </BuyButton>
          </section>
        </aside>
      </div>
    </>
  );
}
