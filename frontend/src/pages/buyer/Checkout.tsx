import { Input as UiInput } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { Glyph } from "@/components/buyer/BuyerParts";
import { useBuyer } from "@/context/BuyerContext";
import { Summary, Stepper } from "@/components/buyer/BuyerWidgets";
export function Checkout() {
  const {
    shipping,
    setShipping,
    method,
    setMethod,
    paymentMethod,
    setPaymentMethod,
    errors,
    heading,
    checkout,
  } = useBuyer();
  return (
    <>
      <div className="buy-page-heading">
        <span className="buy-eyebrow">A CONFIDENT NEXT STEP</span>
        <h1 ref={heading} tabIndex={-1}>
          Make It Yours<span>.</span>
        </h1>
        <p>A few details, then we'll take care of the rest.</p>
      </div>
      <Stepper active={1} />
      <form className="buy-checkout-layout" noValidate onSubmit={checkout}>
        <div className="buy-checkout-fields">
          <section className="buy-panel">
            <div className="buy-panel-heading">
              <h2>
                <Glyph name="pin" />
                Shipping information
              </h2>
              <span>All fields required</span>
            </div>
            <div className="buy-input-grid">
              {(
                [
                  ["name", "Full Name", "Alex Tran", "name"],
                  ["phone", "Phone", "+84 901 234 567", "tel"],
                  [
                    "address",
                    "Address",
                    "Street address, building, apartment",
                    "street-address",
                  ],
                  ["city", "City", "Ho Chi Minh City", "address-level2"],
                  ["province", "Province", "Ho Chi Minh", "address-level1"],
                ] as const
              ).map(([key, label, placeholder, autocomplete]) => (
                <div
                  className={`buy-field ${
                    key === "address" ? "full-width" : ""
                  }`}
                  key={key}
                >
                  <UiLabel htmlFor={`ship-${key}`}>{label}</UiLabel>
                  <UiInput
                    id={`ship-${key}`}
                    name={key}
                    type={key === "phone" ? "tel" : "text"}
                    autoComplete={autocomplete}
                    placeholder={placeholder}
                    value={shipping[key]}
                    onChange={(e) =>
                      setShipping((old) => ({
                        ...old,
                        [key]: e.target.value,
                      }))
                    }
                    aria-invalid={!!errors[key]}
                    aria-describedby={errors[key] ? `${key}-error` : undefined}
                  />
                  {errors[key] && (
                    <span id={`${key}-error`} className="buy-error">
                      {errors[key]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
          <section className="buy-panel">
            <div className="buy-panel-heading">
              <h2>
                <Glyph name="truck" />
                Shipping method
              </h2>
            </div>
            <div className="buy-shipping-methods">
              {["Standard", "Express"].map((m) => (
                <UiLabel
                  className={`buy-choice ${method === m ? "selected" : ""}`}
                  key={m}
                >
                  <UiInput
                    name="shippingMethod"
                    type="radio"
                    checked={method === m}
                    onChange={() => setMethod(m)}
                  />
                  <span>
                    <strong>
                      {m} delivery{" "}
                      {m === "Express" && <small>RECOMMENDED</small>}
                    </strong>
                    <span>
                      {m === "Express"
                        ? "1–2 business days · Priority live-fish handling"
                        : "3–5 business days · Insulated live-fish packaging"}
                    </span>
                  </span>
                  <b>{m === "Express" ? "$35" : "$20"}</b>
                </UiLabel>
              ))}
            </div>
          </section>
          <section className="buy-panel">
            <div className="buy-panel-heading">
              <h2>
                <Glyph name="card" />
                Payment method
              </h2>
            </div>
            <div className="buy-payment-methods">
              {["Bank Card", "E-Wallet", "Bank Transfer"].map((m) => (
                <UiLabel
                  className={`buy-choice ${
                    paymentMethod === m ? "selected" : ""
                  }`}
                  key={m}
                >
                  <UiInput
                    name="paymentMethod"
                    type="radio"
                    checked={paymentMethod === m}
                    onChange={() => setPaymentMethod(m)}
                  />
                  <Glyph
                    name={
                      m === "Bank Card"
                        ? "card"
                        : m === "E-Wallet"
                          ? "bag"
                          : "lock"
                    }
                  />
                  <strong>{m}</strong>
                </UiLabel>
              ))}
            </div>
            <p className="buy-fine-print">
              <Glyph name="lock" />
              Payment status is recorded with your order after authorization.
            </p>
          </section>
        </div>
        <Summary showAction />
      </form>
    </>
  );
}
