import { BuyButton, Glyph } from "@/components/buyer/BuyerParts";
import { useBuyer } from "@/context/BuyerContext";
import { OrderProduct } from "@/components/buyer/BuyerWidgets";
export function Delivery() {
  const { setCompleted, setFiles, heading, go } = useBuyer();
  return (
    <div className="buy-centered-flow">
      <span className="buy-state-icon">
        <Glyph name="box" />
      </span>
      <span className="buy-eyebrow">A SAFE ARRIVAL</span>
      <h1 ref={heading} tabIndex={-1}>
        Have you received your order?
      </h1>
      <p>
        Take a moment to check your fish. Confirm receipt only when everything
        looks right.
      </p>
      <section className="buy-panel">
        <OrderProduct />
        <div className="buy-inspection">
          <h3>A quick arrival checklist</h3>
          {[
            "Check the packaging for damage.",
            "Confirm the fish matches your listing.",
            "Inspect health and activity before acclimation.",
          ].map((item) => (
            <p key={item}>
              <Glyph name="check" />
              {item}
            </p>
          ))}
        </div>
      </section>
      <BuyButton
        onClick={() => {
          setCompleted(true);
          setFiles([]);
          go("review");
        }}
      >
        <Glyph name="check" />
        Confirm Received
      </BuyButton>
      <BuyButton
        secondary
        onClick={() => {
          setFiles([]);
          go("dispute");
        }}
      >
        Report a Problem
        <Glyph name="arrow" />
      </BuyButton>
      <p className="buy-fine-print">
        <Glyph name="shield" />
        Confirming receipt completes your demo order. Report any issue first.
      </p>
    </div>
  );
}
