import type { ReactNode } from "react";
import { Button as UiButton } from "@/components/ui/button";
export type GlyphName =
  | "fish"
  | "search"
  | "chevron"
  | "arrow"
  | "heart"
  | "bag"
  | "message"
  | "bell"
  | "shield"
  | "check"
  | "pin"
  | "filter"
  | "close"
  | "truck"
  | "lock"
  | "star"
  | "plus"
  | "zoom"
  | "upload"
  | "card"
  | "box"
  | "store";
export function Glyph({
  name,
  className = "",
}: {
  name: GlyphName;
  className?: string;
}) {
  const paths: Record<GlyphName, ReactNode> = {
    fish: (
      <>
        <path d="M4 12s4-6 10-6c4 0 7 6 7 6s-3 6-7 6c-6 0-10-6-10-6Zm0 0L1 7v10l3-5Z" />
        <circle cx="16" cy="10" r="1" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    chevron: <path d="m9 5 7 7-7 7" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    heart: (
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8Z" />
    ),
    bag: (
      <>
        <path d="M5 7h14l2 14H3L5 7Z" />
        <path d="M8 8V6a4 4 0 0 1 8 0v2" />
      </>
    ),
    message: (
      <>
        <path d="M21 14a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
        <path d="M8 8h8M8 12h5" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    pin: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    filter: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="2" fill="currentColor" />
        <circle cx="15" cy="17" r="2" fill="currentColor" />
      </>
    ),
    close: <path d="m5 5 14 14M19 5 5 19" />,
    truck: (
      <>
        <path d="M2 5h12v12H2zm12 5h4l4 4v3h-8" />
        <circle cx="6" cy="19" r="2" />
        <circle cx="18" cy="19" r="2" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
      </>
    ),
    star: (
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    zoom: (
      <>
        <circle cx="10" cy="10" r="7" />
        <path d="m15 15 6 6M7 10h6m-3-3v6" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6" />
      </>
    ),
    card: (
      <>
        <rect x="2" y="4" width="20" height="16" rx="3" />
        <path d="M2 9h20M6 15h4" />
      </>
    ),
    box: (
      <>
        <path d="m12 2 9 5-9 5-9-5 9-5Zm-9 5v10l9 5 9-5V7M12 12v10M7 4.5l10 5" />
      </>
    ),
    store: <path d="M4 10v10h16V10M3 4h18l-2 6H5L3 4Zm6 16v-6h6v6" />,
  };
  return (
    <svg
      className={`buy-icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function BuyButton({
  children,
  onClick,
  secondary = false,
  disabled = false,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <UiButton
      variant="plain"
      type={type}
      className={`buy-button ${secondary ? "is-secondary" : ""} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </UiButton>
  );
}
export function Verified() {
  return (
    <span className="buy-verified">
      <Glyph name="shield" /> Verified Seller
    </span>
  );
}
export function Rating({ value }: { value: number }) {
  return (
    <span className="buy-rating">
      <Glyph name="star" />
      {value.toFixed(1)}
    </span>
  );
}
export function TrustRow() {
  return (
    <div className="buy-trust-row">
      <span>
        <Glyph name="shield" />
        Verified sellers
      </span>
      <span>
        <Glyph name="lock" />
        Secure transactions
      </span>
      <span>
        <Glyph name="check" />
        Buyer protection
      </span>
    </div>
  );
}
