import { Button as UiButton } from "@/components/ui/button";
import { money } from "@/data/buyerData";
import {
  BuyButton,
  Glyph,
  Verified,
  Rating,
  TrustRow,
} from "@/components/buyer/BuyerParts";
import { useBuyer } from "@/context/BuyerContext";
export function Detail() {
  const {
    selected,
    favorites,
    species,
    breed,
    size,
    location,
    cart,
    setCart,
    gallery,
    setGallery,
    setModal,
    setToast,
    rating,
    heading,
    galleryImages,
    go,
    favorite,
    beginCheckout,
  } = useBuyer();
  return (
    <>
      <div className="buy-detail-layout">
        <div>
          <div className="buy-detail-main-image">
            <img
              src={galleryImages[gallery]}
              alt={
                gallery === 0
                  ? selected.name
                  : `${selected.species} collection reference photo`
              }
            />
            <span className="buy-product-label">{selected.label}</span>
            <UiButton
              variant="plain"
              onClick={() => setModal("zoom")}
              aria-label="Zoom fish photo"
            >
              <Glyph name="zoom" />
            </UiButton>
            <span className="buy-gallery-note">
              {gallery === 0
                ? "Listing photography"
                : "Collection reference · not the exact specimen"}
            </span>
          </div>
          <div className="buy-thumbnails">
            {galleryImages.map((src, i) => (
              <UiButton
                variant="plain"
                className={gallery === i ? "selected" : ""}
                onClick={() => setGallery(i)}
                key={i}
                aria-label={`View ${
                  i === 0 ? "listing" : "reference"
                } photo ${i + 1}`}
                aria-pressed={gallery === i}
              >
                <img src={src} alt="" />
              </UiButton>
            ))}
          </div>
          <div className="buy-panel buy-about-fish">
            <span className="buy-eyebrow">RAISED WITH CARE</span>
            <h2>Exceptional stock. No guesswork.</h2>
            <p>
              Carefully selected by {selected.seller} for vibrant coloration,
              balanced form, and active behavior. Every listing includes a
              health review before dispatch and specialist packaging for a safe
              journey.
            </p>
            <p className="buy-fine-print">
              This is a demonstration listing. Photos are illustrative; confirm
              the exact specimen and delivery requirements with the seller
              before a real purchase.
            </p>
          </div>
        </div>
        <section className="buy-detail-info">
          <div className="buy-detail-topline">
            <Verified />
            <span className="buy-availability">
              <span />
              Available now
            </span>
          </div>
          <span className="buy-eyebrow">
            {selected.species.toUpperCase()} COLLECTION · FM-
            {10247 + selected.id}
          </span>
          <h1 ref={heading} tabIndex={-1}>
            {selected.name}
          </h1>
          <p className="buy-detail-subtitle">
            Selected quality. Expertly raised. Ready for your next chapter.
          </p>
          <div className="buy-detail-price">
            {money(selected.price)}
            <span>USD / fish</span>
          </div>
          <dl className="buy-specs">
            {[
              [
                "Species",
                selected.species === "Koi"
                  ? "Cyprinus carpio"
                  : selected.species === "Betta"
                    ? "Betta splendens"
                    : "Carassius auratus",
              ],
              ["Breed", selected.breed],
              ["Size", `${selected.size} cm`],
              ["Age", selected.age],
              ["Gender", selected.gender],
              ["Origin", selected.origin],
              ["Health Status", "Health checked"],
              ["Availability", "1 specimen"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="buy-detail-seller">
            <span className="buy-farm-avatar">
              <Glyph name="fish" />
            </span>
            <div>
              <strong>{selected.seller}</strong>
              <Verified />
              <span>
                <Rating value={selected.rating} /> · 128 Listings ·{" "}
                {selected.location}
              </span>
            </div>
            <UiButton
              variant="plain"
              aria-label="Contact seller"
              onClick={() => setModal("messages")}
            >
              <Glyph name="message" />
            </UiButton>
          </div>
          <div className="buy-detail-actions">
            <BuyButton onClick={() => beginCheckout([selected])}>
              Buy Now
              <Glyph name="arrow" />
            </BuyButton>
            <BuyButton
              secondary
              onClick={() => {
                if (cart.some((f) => f.id === selected.id)) {
                  go("cart");
                } else {
                  setCart((old) => [...old, selected]);
                  setToast(`${selected.name} added to your cart.`);
                }
              }}
            >
              <Glyph name="bag" />
              {cart.some((f) => f.id === selected.id)
                ? "View Cart"
                : "Add to Cart"}
            </BuyButton>
          </div>
          <div className="buy-detail-minor-actions">
            <UiButton variant="plain" onClick={() => setModal("messages")}>
              <Glyph name="message" />
              Contact Seller
            </UiButton>
            <UiButton
              variant="plain"
              aria-pressed={favorites.includes(selected.id)}
              onClick={() => favorite(selected.id)}
            >
              <Glyph name="heart" />
              {favorites.includes(selected.id)
                ? "Saved to Favorites"
                : "Add to Favorites"}
            </UiButton>
          </div>
          <TrustRow />
          <div className="buy-delivery-note">
            <Glyph name="truck" />
            <div>
              <strong>Handled with care. Delivered with confidence.</strong>
              <p>Insulated live-fish packaging. Express shipping from $35.</p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
