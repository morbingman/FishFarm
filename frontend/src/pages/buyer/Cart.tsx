import { Button as UiButton } from "@/components/ui/button";
import { money } from "@/data/buyerData";
import { BuyButton, Glyph, TrustRow } from "@/components/buyer/BuyerParts";
import { useBuyer } from "@/context/BuyerContext";
import { Stepper } from "@/components/buyer/BuyerWidgets";
export function Cart() {
  const { size, cart, setCart, heading, go, openFish, beginCheckout } =
    useBuyer();
  return (
    <>
      <div className="buy-page-heading">
        <span className="buy-eyebrow">ONE STEP CLOSER</span>
        <h1 ref={heading} tabIndex={-1}>
          Your Cart<span>.</span>
        </h1>
        <p>Exceptional finds, ready for their next home.</p>
      </div>
      <Stepper active={0} />
      {cart.length ? (
        <div className="buy-cart-layout">
          <div className="buy-panel">
            {cart.map((fish) => (
              <div className="buy-cart-item" key={fish.id}>
                <img src={fish.image} alt={fish.name} />
                <div>
                  <UiButton variant="plain" onClick={() => openFish(fish)}>
                    {fish.name}
                  </UiButton>
                  <p>{fish.seller}</p>
                  <span>Qty 1 · Unique specimen · {fish.size} cm</span>
                </div>
                <strong>{money(fish.price)}</strong>
                <UiButton
                  variant="plain"
                  className="buy-icon-button"
                  onClick={() =>
                    setCart((old) => old.filter((f) => f.id !== fish.id))
                  }
                  aria-label={`Remove ${fish.name}`}
                >
                  <Glyph name="close" />
                </UiButton>
              </div>
            ))}
          </div>
          <aside className="buy-panel buy-cart-total">
            <h2>Ready to make it yours?</h2>
            <div>
              <span>Subtotal</span>
              <strong>
                {money(cart.reduce((sum, f) => sum + f.price, 0))}
              </strong>
            </div>
            <p>
              Shipping and the 2% platform fee are calculated at checkout. Each
              listing is one unique live specimen.
            </p>
            <BuyButton onClick={() => beginCheckout(cart)}>
              Continue to Checkout
              <Glyph name="arrow" />
            </BuyButton>
            <TrustRow />
          </aside>
        </div>
      ) : (
        <div className="buy-empty">
          <Glyph name="bag" />
          <h2>Your cart is waiting for a great find.</h2>
          <p>Discover exceptional fish from verified sellers.</p>
          <BuyButton onClick={() => go("marketplace")}>
            Browse Marketplace
            <Glyph name="arrow" />
          </BuyButton>
        </div>
      )}
    </>
  );
}
