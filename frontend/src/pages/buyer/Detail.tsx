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
    gallery,
    setGallery,
    setModal,
    rating,
    heading,
    galleryImages,
    go,
    favorite,
    beginCheckout,
    addToCart,
  } = useBuyer();
  return (
    <>
      <div className="buy-detail-layout">
        <div>
          <div className="buy-detail-main-image">
            <img src={galleryImages[gallery]} alt={selected.name} />
            <span className="buy-product-label">{selected.label}</span>
            <UiButton
              variant="plain"
              onClick={() => setModal("zoom")}
              aria-label="Zoom fish photo"
            >
              <Glyph name="zoom" />
            </UiButton>
            <span className="buy-gallery-note">Listing photography</span>
          </div>
          <div className="buy-thumbnails">
            {galleryImages.map((src, i) => (
              <UiButton
                variant="plain"
                className={gallery === i ? "selected" : ""}
                onClick={() => setGallery(i)}
                key={i}
                aria-label={`View listing photo ${i + 1}`}
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
              {selected.description ||
                `Listed by ${selected.seller}. Contact the seller if you need more information before ordering.`}
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
            {selected.species.toUpperCase()} COLLECTION · {selected.code}
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
              ["Health Status", selected.health || "Not provided"],
              ["Availability", `${selected.quantity ?? 0} available`],
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
                <Rating value={selected.rating} /> · {selected.reviewCount ?? 0}{" "}
                reviews · {selected.location}
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
                  void addToCart(selected);
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
