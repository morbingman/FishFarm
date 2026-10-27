import "./Marketplace.css";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Button as UiButton } from "@/components/ui/button";
import { Input as UiInput } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { pictures, money } from "@/data/buyerData";
import {
  BuyButton,
  Glyph,
  Verified,
  Rating,
} from "@/components/buyer/BuyerParts";
import { useBuyer } from "@/context/BuyerContext";
export function Marketplace() {
  const {
    stock,
    favorites,
    favoritesOnly,
    setFavoritesOnly,
    query,
    setQuery,
    species,
    setSpecies,
    breed,
    setBreed,
    maxPrice,
    setMaxPrice,
    size,
    setSize,
    location,
    setLocation,
    sellerRating,
    setSellerRating,
    available,
    setAvailable,
    sort,
    setSort,
    filtersOpen,
    setFiltersOpen,
    setModal,
    rating,
    heading,
    openFish,
    favorite,
    clearFilters,
    filtered,
    activeFilters,
  } = useBuyer();
  const speciesOptions = [...new Set(stock.map((fish) => fish.species))];
  const locationOptions = [
    ...new Set(stock.map((fish) => fish.location).filter(Boolean)),
  ];
  const ratingOptions = [
    ...new Set(stock.map((fish) => fish.rating).filter((value) => value > 0)),
  ]
    .sort((a, b) => b - a)
    .map(String);
  return (
    <>
      <section className="buy-market-hero">
        <div className="buy-market-hero-inner">
          <div className="buy-market-hero-copy">
            <span className="buy-eyebrow">
              <span />
              QUALITY STOCK. TRUSTED SOURCES.
            </span>
            <h1 ref={heading} tabIndex={-1}>
              {favoritesOnly ? "Your Favorite Finds" : "Find Your Perfect Fish"}
              <span>.</span>
            </h1>
            <p>
              Exceptional fish from verified breeders and farms. Your next great
              find starts here.
            </p>
            <UiLabel className="buy-hero-search">
              <Glyph name="search" />
              <UiInput
                aria-label="Search fish, species, breed, or seller"
                placeholder="Search fish, species, breed, or seller..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <span className="buy-search-hint">
                {stock.length} curated listings
              </span>
            </UiLabel>
            <div className="buy-hero-pills">
              <span>
                <Glyph name="shield" />
                Verified sellers
              </span>
              <span>
                <Glyph name="lock" />
                Secure payments
              </span>
              <span>
                <Glyph name="truck" />
                Safe live-fish shipping
              </span>
            </div>
          </div>
          <div className="buy-hero-image">
            <img
              src={pictures.koi}
              alt="Premium koi photographed in deep water"
            />
            <div className="buy-hero-image-overlay" />
            <div className="buy-hero-caption">
              <span>EXCEPTIONAL BY NATURE</span>
              <strong>Quality worth discovering.</strong>
              <span>Responsibly raised. Carefully selected.</span>
            </div>
            <span className="buy-hero-number">01 / 03</span>
          </div>
        </div>
      </section>
      <main className="buy-container buy-market-body">
        <aside className={`buy-filters ${filtersOpen ? "is-open" : ""}`}>
          <div className="buy-filter-heading">
            <h2>
              <Glyph name="filter" />
              Filters {activeFilters > 0 && <span>{activeFilters}</span>}
            </h2>
            <UiButton variant="plain" onClick={clearFilters}>
              Reset all
            </UiButton>
            <UiButton
              variant="plain"
              className="buy-mobile-filter-close"
              onClick={() => setFiltersOpen(false)}
              aria-label="Close filters"
            >
              <Glyph name="close" />
            </UiButton>
          </div>
          <div className="buy-filter-group">
            <h3>
              Species <Glyph name="chevron" />
            </h3>
            {speciesOptions.map((s) => (
              <UiLabel className="buy-filter-check" key={s}>
                <UiInput
                  type="checkbox"
                  checked={species.includes(s)}
                  onChange={() =>
                    setSpecies((old) =>
                      old.includes(s)
                        ? old.filter((x) => x !== s)
                        : [...old, s],
                    )
                  }
                />
                <span>{s === "Koi" ? "Koi Fish" : s}</span>
                <small>{stock.filter((f) => f.species === s).length}</small>
              </UiLabel>
            ))}
          </div>
          <div className="buy-filter-group">
            <h3>Breed</h3>
            <NativeSelect
              aria-label="Filter by breed"
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
            >
              {["All breeds", ...stock.map((f) => f.breed)].map((b) => (
                <NativeSelectOption key={b}>{b}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="buy-filter-group">
            <h3>
              Price range <span>VND</span>
            </h3>
            <UiInput
              className="buy-range"
              type="range"
              min="50"
              max="1500"
              step="10"
              value={maxPrice}
              aria-label="Maximum price"
              onChange={(e) => setMaxPrice(Number(e.target.value))}
            />
            <div className="buy-range-values">
              <span>$0</span>
              <span>
                {money(maxPrice)}
                {maxPrice === 1500 ? "+" : ""}
              </span>
            </div>
          </div>
          {[
            {
              label: "Size",
              value: size,
              setter: setSize,
              options: ["Any size", "Under 15 cm", "15 cm and above"],
            },
            {
              label: "Location",
              value: location,
              setter: setLocation,
              options: ["All locations", ...locationOptions],
            },
            {
              label: "Seller Rating",
              value: sellerRating,
              setter: setSellerRating,
              options: ["Any rating", ...ratingOptions],
            },
          ].map(({ label, value, setter, options }) => (
            <div className="buy-filter-group" key={label}>
              <h3>{label}</h3>
              <NativeSelect
                aria-label={`Filter by ${label}`}
                value={value}
                onChange={(e) => setter(e.target.value)}
              >
                {options.map((o) => (
                  <NativeSelectOption key={o} value={o}>
                    {label === "Seller Rating" && o !== "Any rating"
                      ? `${o} stars & up`
                      : o}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          ))}
          <div className="buy-filter-group">
            <h3>Availability</h3>
            <UiLabel className="buy-filter-check">
              <UiInput
                type="checkbox"
                checked={available}
                onChange={(e) => setAvailable(e.target.checked)}
              />
              <span>In stock only</span>
              <span className="buy-instock-dot" />
            </UiLabel>
            <p className="buy-filter-note">
              All current listings are ready to ship.
            </p>
          </div>
          <div className="buy-sidebar-trust">
            <Glyph name="shield" />
            <strong>Trade with confidence.</strong>
            <p>
              Verified sellers. Transparent listings. Support at every step.
            </p>
            <UiButton variant="plain" onClick={() => setModal("support")}>
              How we protect you <Glyph name="arrow" />
            </UiButton>
          </div>
          {filtersOpen && (
            <BuyButton onClick={() => setFiltersOpen(false)}>
              Show {filtered.length} results
            </BuyButton>
          )}
        </aside>
        <section className="buy-listings-section">
          <div className="buy-listing-toolbar">
            <div>
              <span className="buy-eyebrow">THE MARKETPLACE</span>
              <h2>
                {favoritesOnly
                  ? "Saved for later"
                  : species.length === 1
                    ? `${species[0]} collection`
                    : "Discover exceptional fish"}{" "}
                <span>({filtered.length})</span>
              </h2>
              <p>
                {query
                  ? `Results for “${query}”`
                  : favoritesOnly
                    ? "Your shortlist of exceptional finds."
                    : "Handpicked quality. Direct from the source."}
              </p>
            </div>
            <div>
              <UiButton
                variant="plain"
                className="buy-mobile-filter-button"
                onClick={() => setFiltersOpen(true)}
              >
                <Glyph name="filter" />
                Filters
              </UiButton>
              <UiLabel className="buy-sort">
                <span>Sort by:</span>
                <NativeSelect
                  aria-label="Sort listings"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  {[
                    "Recommended",
                    "Newest",
                    "Price Low to High",
                    "Price High to Low",
                  ].map((o) => (
                    <NativeSelectOption key={o}>{o}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </UiLabel>
            </div>
          </div>
          <div className="buy-collection-tabs">
            {["All fish", ...speciesOptions].map((s) => (
              <UiButton
                variant="plain"
                className={
                  s === "All fish"
                    ? !species.length
                      ? "active"
                      : ""
                    : species.length === 1 && species[0] === s
                      ? "active"
                      : ""
                }
                onClick={() => setSpecies(s === "All fish" ? [] : [s])}
                key={s}
              >
                {s === "All fish"
                  ? "All fish"
                  : s === "Koi"
                    ? "Koi & Nishikigoi"
                    : s}
                <span>
                  {s === "All fish"
                    ? stock.length
                    : stock.filter((f) => f.species === s).length}
                </span>
              </UiButton>
            ))}
          </div>
          {activeFilters > 0 && (
            <div className="buy-active-filters">
              {species.map((s) => (
                <UiButton
                  variant="plain"
                  onClick={() =>
                    setSpecies((old) => old.filter((x) => x !== s))
                  }
                  key={s}
                >
                  {s}
                  <Glyph name="close" />
                </UiButton>
              ))}
              <UiButton variant="plain" onClick={clearFilters}>
                Clear all filters <Glyph name="close" />
              </UiButton>
            </div>
          )}
          <div className="buy-product-grid">
            {filtered.map((fish) => (
              <article className="buy-product-card" key={fish.id}>
                <div className="buy-product-image">
                  <UiButton
                    variant="plain"
                    className="buy-image-link"
                    aria-label={`View ${fish.name}`}
                    onClick={() => openFish(fish)}
                  >
                    <img src={fish.image} alt={fish.name} loading="lazy" />
                  </UiButton>
                  <span className="buy-product-label">{fish.label}</span>
                  <UiButton
                    variant="plain"
                    className={`buy-favorite ${
                      favorites.includes(fish.id) ? "saved" : ""
                    }`}
                    onClick={() => favorite(fish.id)}
                    aria-label={`${
                      favorites.includes(fish.id) ? "Remove" : "Add"
                    } ${fish.name} ${
                      favorites.includes(fish.id) ? "from" : "to"
                    } favorites`}
                    aria-pressed={favorites.includes(fish.id)}
                  >
                    <Glyph name="heart" />
                  </UiButton>
                  <span className="buy-image-stock">
                    <span />
                    Ready to ship
                  </span>
                </div>
                <div className="buy-product-content">
                  <div className="buy-product-meta">
                    <span>
                      {fish.species === "Koi"
                        ? "NISHIKIGOI"
                        : fish.species.toUpperCase()}
                    </span>
                    <span>{fish.size} cm</span>
                  </div>
                  <UiButton
                    variant="plain"
                    className="buy-product-title"
                    onClick={() => openFish(fish)}
                  >
                    {fish.name}
                  </UiButton>
                  <p className="buy-product-location">
                    <Glyph name="pin" />
                    {fish.location}
                  </p>
                  <div className="buy-card-verification">
                    <Verified />
                  </div>
                  <div className="buy-product-seller">
                    <span>
                      <span className="buy-seller-avatar">
                        {fish.seller
                          .split(" ")
                          .slice(0, 2)
                          .map((w) => w[0])
                          .join("")}
                      </span>
                      {fish.seller}
                      <Glyph name="shield" />
                    </span>
                    <Rating value={fish.rating} />
                  </div>
                  <div className="buy-product-footer">
                    <div>
                      <span>Asking price</span>
                      <strong>{money(fish.price)}</strong>
                    </div>
                    <UiButton variant="plain" onClick={() => openFish(fish)}>
                      View Details
                      <Glyph name="arrow" />
                    </UiButton>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!filtered.length && (
            <div className="buy-empty">
              <Glyph name={favoritesOnly ? "heart" : "search"} />
              <h2>
                {favoritesOnly
                  ? "Your next favorite is out there."
                  : "No fish match your search."}
              </h2>
              <p>
                {favoritesOnly
                  ? "Tap the heart on a listing to keep it here."
                  : "Try a different search or widen your filters."}
              </p>
              <BuyButton
                onClick={() => {
                  clearFilters();
                  setFavoritesOnly(false);
                }}
              >
                Explore all fish
              </BuyButton>
            </div>
          )}
          <div className="buy-results-end">
            <span>
              Showing {filtered.length} of {filtered.length} curated listings
            </span>
            <span>Quality over quantity. Always.</span>
          </div>
          <div className="buy-sourcing-banner">
            <div className="buy-sourcing-icon">
              <Glyph name="message" />
            </div>
            <div>
              <h3>Looking for something specific?</h3>
              <p>
                Our team can help you find the right fish from the right source.
              </p>
            </div>
            <BuyButton secondary onClick={() => setModal("support")}>
              Let's talk
              <Glyph name="arrow" />
            </BuyButton>
          </div>
        </section>
      </main>
    </>
  );
}
