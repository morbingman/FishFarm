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
    setDelivered,
    completed,
    reviewSent,
    disputeSent,
    heading,
    go,
  } = useBuyer();
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
                "10 Jul 2026",
                "09:30 AM",
                "Your order has been received. A great find is on its way.",
              ],
              [
                "Payment Confirmed",
                "10 Jul 2026",
                "09:31 AM",
                "Payment verified. Your purchase is covered by buyer protection.",
              ],
              [
                "Farm Preparing",
                "10 Jul 2026",
                "11:15 AM",
                "Health check, oxygen support, and insulated packaging are underway.",
              ],
              [
                "Shipped",
                delivered ? "11 Jul 2026" : "Expected 11 Jul",
                delivered ? "08:00 AM" : "Awaiting dispatch",
                "Specialist live-fish courier. Tracking reference: LF-829104.",
              ],
              [
                "Delivered",
                delivered ? "12 Jul 2026" : "Expected 12 Jul",
                delivered ? "10:20 AM" : "Before 6:00 PM",
                "Delivered with care. Please inspect your fish and confirm receipt.",
              ],
            ].map(([title, date, time, description], i) => (
              <li
                key={title}
                className={
                  delivered || i < 2 ? "done" : i === 2 ? "current" : "pending"
                }
              >
                <span className="buy-timeline-marker">
                  {delivered || i < 2 ? (
                    <Glyph name="check" />
                  ) : i === 2 ? (
                    <Glyph name="box" />
                  ) : (
                    <span />
                  )}
                </span>
                <div>
                  <div className="buy-timeline-title">
                    <h3>{title}</h3>
                    <span>
                      {date} · {time}
                    </span>
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
          <section className="buy-demo-advance">
            <span className="buy-eyebrow">EXPLORE THE PROTOTYPE</span>
            <h3>
              {disputeSent
                ? "Your issue is under review."
                : completed
                  ? "Thanks for completing your trade."
                  : "Ready to see the next step?"}
            </h3>
            <p>
              {disputeSent
                ? "We've kept your order open while your report is reviewed. You can check your case details below."
                : completed
                  ? "Your receipt and review are attached to this demo order."
                  : "Skip the wait and preview delivery confirmation. No shipment is actually sent."}
            </p>
            <BuyButton
              onClick={() => {
                if (disputeSent) go("dispute");
                else if (completed) go("review");
                else {
                  setDelivered(true);
                  go("delivery");
                }
              }}
            >
              {disputeSent
                ? "View Issue Report"
                : completed
                  ? reviewSent
                    ? "View Review"
                    : "Leave a Review"
                  : delivered
                    ? "Confirm Your Delivery"
                    : "Simulate Delivery"}
              <Glyph name="arrow" />
            </BuyButton>
          </section>
        </aside>
      </div>
    </>
  );
}
