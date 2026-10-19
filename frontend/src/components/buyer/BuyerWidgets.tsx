import { Button as UiButton } from "@/components/ui/button";
import { Input as UiInput } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { money } from "@/data/buyerData";
import { BuyButton, Glyph, Verified } from "@/components/buyer/BuyerParts";
import { useBuyer } from "@/context/BuyerContext";
export function Summary({ showAction = false }: { showAction?: boolean }) {
  const { size, items, method, shippingPrice, subtotal, fee, total } =
    useBuyer();
  return (
    <aside className="buy-summary buy-panel">
      <div className="buy-panel-heading">
        <h2>Order summary</h2>
        <span>
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>
      {items.map((fish) => (
        <div className="buy-summary-item" key={fish.id}>
          <img src={fish.image} alt={fish.name} />
          <div>
            <strong>{fish.name}</strong>
            <span>{fish.seller}</span>
            <small>Qty 1 · {fish.size} cm</small>
          </div>
          <b>{money(fish.price)}</b>
        </div>
      ))}
      <div className="buy-price-lines">
        <div>
          <span>Subtotal</span>
          <span>{money(subtotal)}</span>
        </div>
        <div>
          <span>{method} shipping</span>
          <span>{money(shippingPrice)}</span>
        </div>
        <div>
          <span>
            Platform fee <small>(2%)</small>
          </span>
          <span>{money(fee)}</span>
        </div>
        <div className="buy-total">
          <strong>
            Total <small>USD</small>
          </strong>
          <strong>{money(total)}</strong>
        </div>
      </div>
      {showAction && (
        <BuyButton type="submit">
          Continue to Payment
          <Glyph name="arrow" />
        </BuyButton>
      )}
      <p className="buy-summary-safety">
        <Glyph name="shield" />
        Your purchase is protected from checkout to delivery.
      </p>
      <p className="buy-fine-print">
        Live-fish shipping includes insulated packaging and oxygen support. All
        amounts are demo prices.
      </p>
    </aside>
  );
}
export function Stepper({ active }: { active: number }) {
  const {} = useBuyer();
  return (
    <ol className="buy-stepper">
      {["Cart", "Shipping", "Payment", "Confirmation"].map((step, i) => (
        <li
          key={step}
          className={`${i < active ? "done" : ""} ${
            i === active ? "active" : ""
          }`}
        >
          <span>{i < active ? <Glyph name="check" /> : `0${i + 1}`}</span>
          <strong>{step}</strong>
        </li>
      ))}
    </ol>
  );
}
export function OrderProduct() {
  const { items, total } = useBuyer();
  return (
    <div className="buy-order-product">
      <img src={items[0].image} alt={items[0].name} />
      <div>
        <span className="buy-eyebrow">ORDER #FM-10248</span>
        <h2>
          {items[0].name}
          {items.length > 1 ? ` + ${items.length - 1} more` : ""}
        </h2>
        <p>
          {items[0].seller} <Verified />
        </p>
      </div>
      <strong>{money(total)}</strong>
    </div>
  );
}
export function FileUpload() {
  const { size, errors, setErrors, files, setFiles } = useBuyer();
  return (
    <div className="buy-upload">
      <UiLabel htmlFor="buyer-photos">
        <Glyph name="upload" />
        <strong>Add photos</strong>
        <span>Up to 3 JPG, PNG, or WebP images · 5 MB each</span>
      </UiLabel>
      <UiInput
        id="buyer-photos"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const chosen = Array.from(e.target.files || []);
          if (
            chosen.length > 3 ||
            chosen.some(
              (file) =>
                file.size > 5 * 1024 * 1024 ||
                !["image/jpeg", "image/png", "image/webp"].includes(file.type),
            )
          ) {
            setErrors((old) => ({
              ...old,
              files:
                "Choose up to 3 JPG, PNG, or WebP images, each under 5 MB.",
            }));
            return;
          }
          setFiles(chosen);
          setErrors((old) => ({
            ...old,
            files: "",
          }));
        }}
      />
      {files.map((file, i) => (
        <div className="buy-file" key={`${file.name}-${i}`}>
          <span>{file.name}</span>
          <UiButton
            variant="plain"
            type="button"
            onClick={() => setFiles((old) => old.filter((_, n) => n !== i))}
            aria-label={`Remove ${file.name}`}
          >
            <Glyph name="close" />
          </UiButton>
        </div>
      ))}
      {errors.files && <span className="buy-error">{errors.files}</span>}
    </div>
  );
}
