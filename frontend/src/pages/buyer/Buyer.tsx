import "./Buyer.css";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea as UiTextarea } from "@/components/ui/textarea";
import { Button as UiButton } from "@/components/ui/button";
import { Input as UiInput } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { pageTitles } from "@/data/buyerData";
import {
  BuyButton,
  Glyph,
  type GlyphName,
} from "@/components/buyer/BuyerParts";
import { useBuyer } from "@/context/BuyerContext";
export function BuyerLayout() {
  const {
    language,
    setLanguage,
    page,
    selected,
    favorites,
    favoritesOnly,
    setFavoritesOnly,
    query,
    setQuery,
    setSpecies,
    setSort,
    cart,
    gallery,
    modal,
    setModal,
    message,
    setMessage,
    sent,
    setSent,
    toast,
    setToast,
    hasOrder,
    dialog,
    galleryImages,
    go,
    clearFilters,
  } = useBuyer();
  return (
    <div className="buyer-app">
      <header className="buy-header">
        <div className="buy-header-main">
          <UiLabel className="buy-header-search">
            <Glyph name="search" />
            <UiInput
              aria-label="Search marketplace"
              placeholder="Search fish, species, or sellers..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (page !== "marketplace") {
                  setFavoritesOnly(false);
                  go("marketplace");
                }
              }}
            />
            <kbd>⌕</kbd>
          </UiLabel>
          <div className="buy-header-actions">
            <UiButton
              variant="plain"
              onClick={() => go("orders")}
              className={
                page === "orders" || page === "tracking" ? "active" : ""
              }
            >
              <Glyph name="box" />
              <span>Orders</span>
            </UiButton>
            <UiButton
              variant="plain"
              onClick={() => {
                setFavoritesOnly(!favoritesOnly);
                go("marketplace");
              }}
              className={
                favoritesOnly && page === "marketplace" ? "active" : ""
              }
            >
              <Glyph name="heart" />
              <span>Favorites</span>
              {favorites.length > 0 && <b>{favorites.length}</b>}
            </UiButton>
            <UiButton
              variant="plain"
              onClick={() => setModal("messages")}
              aria-label="Messages"
            >
              <Glyph name="message" />
              <span>Messages</span>
            </UiButton>
            <span className="buy-header-divider" />
            <UiButton
              variant="plain"
              onClick={() => go("cart")}
              aria-label={`Cart, ${cart.length} items`}
            >
              <Glyph name="bag" />
              {cart.length > 0 && <b>{cart.length}</b>}
            </UiButton>
          </div>
        </div>
        <nav className="buy-nav">
          <div>
            <UiButton
              variant="plain"
              className={page === "marketplace" ? "active" : ""}
              onClick={() => {
                setFavoritesOnly(false);
                clearFilters();
                go("marketplace");
              }}
            >
              Marketplace
            </UiButton>
            {["Koi", "Betta", "Goldfish"].map((s) => (
              <UiButton
                variant="plain"
                key={s}
                onClick={() => {
                  clearFilters();
                  setSpecies([s]);
                  setFavoritesOnly(false);
                  go("marketplace");
                }}
              >
                {s === "Koi" ? "Koi Fish" : `${s} Fish`}
              </UiButton>
            ))}
            <UiButton
              variant="plain"
              onClick={() => {
                clearFilters();
                setSort("Newest");
                setFavoritesOnly(false);
                go("marketplace");
              }}
            >
              New Arrivals
              <span className="buy-new-dot" />
            </UiButton>
            <span className="buy-nav-spacer" />
            <span className="buy-nav-assurance">
              <Glyph name="truck" />
              Specialist live-fish delivery
            </span>
          </div>
        </nav>
      </header>

      {page === "marketplace" ? (
        <Marketplace />
      ) : (
        <main className="buy-container buy-flow-main">
          <div className="buy-breadcrumb">
            <UiButton
              variant="plain"
              onClick={() => {
                setFavoritesOnly(false);
                go("marketplace");
              }}
            >
              Marketplace
            </UiButton>
            <Glyph name="chevron" />
            <span>{pageTitles[page]}</span>
            {page !== "detail" && (
              <span className="buy-prototype-tag">
                <span />
                BUYER JOURNEY PROTOTYPE
              </span>
            )}
          </div>
          {page === "detail" && <Detail />}

          {page === "cart" && <Cart />}

          {page === "checkout" && <Checkout />}

          {page === "payment" && <Payment />}

          {page === "confirmation" && <Confirmation />}

          {page === "orders" && <Orders />}

          {page === "tracking" && <Tracking />}

          {page === "delivery" && <Delivery />}

          {page === "review" && <Review />}

          {page === "dispute" && <Dispute />}
        </main>
      )}
      <section className="buy-bottom-trust">
        <div className="buy-container">
          {[
            [
              "shield",
              "Verified by people. Not promises.",
              "Identity-checked sellers and transparent listings.",
            ],
            [
              "truck",
              "Specialist shipping. Safer arrivals.",
              "Live-fish handling from dispatch to your door.",
            ],
            [
              "message",
              "Real support. Every step.",
              "Here to help you trade with confidence.",
            ],
          ].map(([icon, title, description]) => (
            <div key={title}>
              <span>
                <Glyph name={icon as GlyphName} />
              </span>
              <div>
                <strong>{title}</strong>
                <p>{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <footer className="buy-footer buy-container">
        <UiButton
          variant="plain"
          className="buy-footer-brand"
          onClick={() => go("marketplace")}
        >
          <Glyph name="fish" />
          FISHMARKET
        </UiButton>
        <span>Better fish. Better connections. Better trade.</span>
        <div>
          <a href="#home">About FISHMARKET</a>
          <UiButton variant="plain" onClick={() => setModal("support")}>
            Help & Support
          </UiButton>
          <span>© 2026 FISHMARKET</span>
        </div>
      </footer>
      <div className="buy-prototype-footer">
        <span>
          <span />
          BUYER PURCHASE PROTOTYPE
        </span>
        <span>
          Discover <Glyph name="chevron" /> Purchase <Glyph name="chevron" />{" "}
          Track <Glyph name="chevron" /> Review
        </span>
        <span>No real payments or shipments</span>
      </div>
      {toast && (
        <div className="buy-toast" role="status">
          <Glyph name="check" />
          {toast}
          <UiButton
            variant="plain"
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <Glyph name="close" />
          </UiButton>
        </div>
      )}
      {modal && (
        <Dialog
          open={!!modal}
          onOpenChange={(open) => {
            if (!open) setModal(null);
          }}
        >
          <DialogContent
            aria-label={
              modal === "zoom"
                ? "Fish photo zoom"
                : modal === "messages"
                  ? "Contact seller"
                  : modal === "notifications"
                    ? "Notifications"
                    : "FISHMARKET support"
            }
            className={
              "buyer-app " +
              `buy-modal ${modal === "zoom" ? "buy-zoom-modal" : ""}`
            }
            aria-describedby={undefined}
          >
            <DialogTitle className="buyer-view-1">FISHMARKET</DialogTitle>
            <UiButton
              variant="plain"
              className="buy-modal-close"
              onClick={() => setModal(null)}
              aria-label="Close dialog"
            >
              <Glyph name="close" />
            </UiButton>
            {modal === "zoom" ? (
              <>
                <img src={galleryImages[gallery]} alt={selected.name} />
                <p>
                  {gallery === 0
                    ? selected.name
                    : "Collection reference photo — illustrative specimen"}
                </p>
              </>
            ) : modal === "notifications" ? (
              <>
                <span className="buy-state-icon is-neutral">
                  <Glyph name="bell" />
                </span>
                <h2>You're all caught up.</h2>
                <p>
                  {hasOrder
                    ? "Your demo order #FM-10248 is confirmed. Follow its progress in your orders."
                    : "Order updates and important marketplace news will appear here."}
                </p>
                <BuyButton
                  onClick={() => {
                    setModal(null);
                    go("orders");
                  }}
                >
                  View Orders
                  <Glyph name="arrow" />
                </BuyButton>
              </>
            ) : (
              <>
                <span className="buy-state-icon is-neutral">
                  <Glyph name={modal === "messages" ? "message" : "shield"} />
                </span>
                <h2>
                  {modal === "messages"
                    ? `Chat with ${selected.seller}`
                    : "A little help. A lot of confidence."}
                </h2>
                <p>
                  {modal === "messages"
                    ? "Ask about health, shipping, or the exact specimen before you buy."
                    : "Verified sellers, transparent listings, and dispute assistance help protect eligible trades. Tell us what you need."}
                </p>
                <div className="buy-chat-history">
                  <div className="buy-chat-system">
                    {modal === "messages"
                      ? "Hello! How can we help with your next great find?"
                      : "Welcome to FISHMARKET support. How can we help?"}
                  </div>
                  {sent.map((text, i) => (
                    <div className="buy-chat-sent" key={i}>
                      {text}
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (message.trim()) {
                      setSent((old) => [...old, message.trim()]);
                      setMessage("");
                    }
                  }}
                >
                  <UiLabel className="buy-field">
                    <span>Your message</span>
                    <UiTextarea
                      rows={3}
                      value={message}
                      maxLength={1000}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Write your message..."
                    />
                  </UiLabel>
                  <BuyButton type="submit" disabled={!message.trim()}>
                    Send Message
                    <Glyph name="arrow" />
                  </BuyButton>
                </form>
                <p className="buy-fine-print">
                  Local prototype chat. Messages aren't sent to real people.
                </p>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
import { BuyerProvider } from "@/context/BuyerContext";
import { Marketplace } from "./Marketplace";
import { Detail } from "./Detail";
import { Cart } from "./Cart";
import { Checkout } from "./Checkout";
import { Payment } from "./Payment";
import { Confirmation } from "./Confirmation";
import { Orders } from "./Orders";
import { Tracking } from "./Tracking";
import { Delivery } from "./Delivery";
import { Review } from "./Review";
import { Dispute } from "./Dispute";
export default function Buyer(
  props: Omit<Parameters<typeof BuyerProvider>[0], "children">,
) {
  return (
    <BuyerProvider {...props}>
      <BuyerLayout />
    </BuyerProvider>
  );
}
