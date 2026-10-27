import { BuyButton, Glyph } from "@/components/buyer/BuyerParts";
import { useBuyer } from "@/context/BuyerContext";
import { Stepper, OrderProduct } from "@/components/buyer/BuyerWidgets";
export function Confirmation() {
  const { shipping, method, heading, go, purchaseId } = useBuyer();
  return (
    <div className="buy-success-page">
      <span className="buy-state-icon">
        <Glyph name="check" />
      </span>
      <span className="buy-eyebrow">A GREAT FIND. A GREAT CHOICE.</span>
      <h1 ref={heading} tabIndex={-1}>
        Order Placed Successfully
      </h1>
      <p>
        Your purchase is confirmed. We'll keep you in the loop every step of the
        way.
      </p>
      <Stepper active={3} />
      <section className="buy-panel">
        <OrderProduct />
        <div className="buy-confirmation-data">
          <div>
            <span>Order ID</span>
            <strong>{purchaseId}</strong>
          </div>
          <div>
            <span>Payment Status</span>
            <strong className="buy-paid">
              <Glyph name="check" />
              Paid
            </strong>
          </div>
          <div>
            <span>Delivery to</span>
            <strong>{shipping.name}</strong>
            <small>
              {shipping.city}, {shipping.province}
            </small>
          </div>
          <div>
            <span>Estimated delivery</span>
            <strong>
              {method === "Express" ? "1–2" : "3–5"} business days
            </strong>
          </div>
        </div>
      </section>
      <div className="buy-success-actions">
        <BuyButton onClick={() => go("tracking")}>
          Track Order
          <Glyph name="truck" />
        </BuyButton>
        <BuyButton secondary onClick={() => go("marketplace")}>
          Continue Shopping
          <Glyph name="arrow" />
        </BuyButton>
      </div>
    </div>
  );
}
