import { money } from "@/data/buyerData";
import { BuyButton, Glyph } from "@/components/buyer/BuyerParts";
import { useBuyer } from "@/context/BuyerContext";
import { OrderProduct } from "@/components/buyer/BuyerWidgets";
export function Orders() {
  const { hasOrder, delivered, completed, disputeSent, heading, total, go } =
    useBuyer();
  return (
    <>
      <div className="buy-page-heading">
        <span className="buy-eyebrow">YOUR TRADING JOURNEY</span>
        <h1 ref={heading} tabIndex={-1}>
          Your Orders<span>.</span>
        </h1>
        <p>Every great find, all in one place.</p>
      </div>
      {hasOrder ? (
        <section className="buy-panel">
          <OrderProduct />
          <div className="buy-order-row">
            <span className="buy-status-pill">
              {disputeSent
                ? "Issue reported"
                : completed
                  ? "Completed"
                  : delivered
                    ? "Delivered"
                    : "Seller preparing"}
            </span>
            <span>Paid · {money(total)}</span>
            <BuyButton onClick={() => go("tracking")}>
              View Order
              <Glyph name="arrow" />
            </BuyButton>
          </div>
        </section>
      ) : (
        <div className="buy-empty">
          <Glyph name="box" />
          <h2>Your first great trade starts here.</h2>
          <p>You haven't placed an order in this session yet.</p>
          <BuyButton onClick={() => go("marketplace")}>
            Discover Fish
            <Glyph name="arrow" />
          </BuyButton>
        </div>
      )}
    </>
  );
}
