import { Button as UiButton } from "@/components/ui/button";
import { Input as UiInput } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { money } from "@/data/buyerData";
import { BuyButton, Glyph } from "@/components/buyer/BuyerParts";
import { useBuyer } from "@/context/BuyerContext";
import { Summary, Stepper } from "@/components/buyer/BuyerWidgets";
export function Payment() {
  const {
    paymentMethod,
    errors,
    setErrors,
    processing,
    paymentState,
    setPaymentState,
    simulateFailure,
    setSimulateFailure,
    heading,
    total,
    go,
    pay,
  } = useBuyer();
  return (
    <>
      <div className="buy-page-heading">
        <span className="buy-eyebrow">THE FINAL STEP</span>
        <h1 ref={heading} tabIndex={-1}>
          Secure Payment<span>.</span>
        </h1>
        <p>Your next great find is almost yours.</p>
      </div>
      <Stepper active={2} />
      <div className="buy-checkout-layout">
        <section className="buy-panel buy-payment-panel">
          <div className="buy-panel-heading">
            <h2>
              <Glyph name="lock" />
              Payment details
            </h2>
            <span className="buy-secure-label">Secure Payment</span>
          </div>
          <div className="buy-payment-overview">
            <div>
              <span>Order ID</span>
              <strong>#FM-10248</strong>
            </div>
            <div>
              <span>Payment Method</span>
              <strong>{paymentMethod}</strong>
            </div>
            <div>
              <span>Payment Amount</span>
              <strong>{money(total)}</strong>
            </div>
          </div>
          {paymentState === "failed" ? (
            <div className="buy-payment-failed" role="alert">
              <span className="buy-state-icon is-error">
                <Glyph name="close" />
              </span>
              <h2>Payment Failed</h2>
              <p>
                Your demo payment couldn't be completed. No money has been
                charged. Your order details are safe.
              </p>
              <BuyButton
                onClick={() => {
                  setPaymentState("ready");
                  setErrors({});
                }}
              >
                Try Again
                <Glyph name="arrow" />
              </BuyButton>
            </div>
          ) : (
            <form noValidate onSubmit={pay}>
              <div className="buy-demo-payment">
                <Glyph name="shield" />
                <div>
                  <strong>You're in a safe demo environment.</strong>
                  <p>
                    Don't enter real financial information. Use the test details
                    below.
                  </p>
                </div>
              </div>
              {paymentMethod === "Bank Card" ? (
                <div className="buy-input-grid">
                  <div className="buy-field full-width">
                    <UiLabel htmlFor="card">Card number</UiLabel>
                    <UiInput
                      id="card"
                      name="card"
                      placeholder="4242 4242 4242 4242"
                      inputMode="numeric"
                      maxLength={19}
                      aria-invalid={!!errors.card}
                      disabled={processing}
                    />
                    {errors.card && (
                      <span className="buy-error">{errors.card}</span>
                    )}
                  </div>
                  <div className="buy-field full-width">
                    <UiLabel htmlFor="holder">Cardholder name</UiLabel>
                    <UiInput
                      id="holder"
                      name="holder"
                      placeholder="Demo Buyer"
                      aria-invalid={!!errors.holder}
                      disabled={processing}
                    />
                    {errors.holder && (
                      <span className="buy-error">{errors.holder}</span>
                    )}
                  </div>
                  <div className="buy-field">
                    <UiLabel htmlFor="expiry">Expiry date</UiLabel>
                    <UiInput
                      id="expiry"
                      name="expiry"
                      placeholder="12/30"
                      maxLength={5}
                      aria-invalid={!!errors.expiry}
                      disabled={processing}
                    />
                    {errors.expiry && (
                      <span className="buy-error">{errors.expiry}</span>
                    )}
                  </div>
                  <div className="buy-field">
                    <UiLabel htmlFor="cvc">Security code</UiLabel>
                    <UiInput
                      id="cvc"
                      name="cvc"
                      placeholder="123"
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      aria-invalid={!!errors.cvc}
                      disabled={processing}
                    />
                    {errors.cvc && (
                      <span className="buy-error">{errors.cvc}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="buy-alternative-payment">
                  <Glyph name={paymentMethod === "E-Wallet" ? "bag" : "card"} />
                  <h3>
                    {paymentMethod === "E-Wallet"
                      ? "Demo wallet connected"
                      : "Demo bank transfer"}
                  </h3>
                  <p>
                    {paymentMethod === "E-Wallet"
                      ? "Confirm below to simulate a successful wallet authorization."
                      : "Reference: FM-10248. Confirm below to simulate receipt of a bank transfer. Do not send money."}
                  </p>
                </div>
              )}
              <UiLabel className="buy-test-failure">
                <UiInput
                  type="checkbox"
                  checked={simulateFailure}
                  disabled={processing}
                  onChange={(e) => setSimulateFailure(e.target.checked)}
                />
                Simulate a failed payment to preview retry
              </UiLabel>
              <BuyButton type="submit" disabled={processing}>
                {processing ? (
                  <>
                    <span className="buy-spinner" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    Confirm Payment · {money(total)}
                    <Glyph name="lock" />
                  </>
                )}
              </BuyButton>
              <p className="buy-encryption">
                <Glyph name="lock" />
                Encrypted Transaction · Prototype only
              </p>
            </form>
          )}
          <UiButton
            variant="plain"
            className="buy-text-link"
            disabled={processing}
            onClick={() => go("checkout")}
          >
            ← Back to shipping & payment method
          </UiButton>
        </section>
        <Summary />
      </div>
    </>
  );
}
