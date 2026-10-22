import { LogoMark } from "@/components/layout/LogoMark";
import type { listings, sellers } from "@/data/homeData";
import type { ReactNode, FormEvent } from "react";
import "./HomeParts.css";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Input as UiInput } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { Button as UiButton } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { useState } from "react";
import { useTranslation } from "@/context/LanguageContext";
import { photos } from "@/data/homeData";
export type IconName =
  | "arrow"
  | "bell"
  | "cart"
  | "check"
  | "chevron"
  | "fish"
  | "heart"
  | "instagram"
  | "linkedin"
  | "location"
  | "lock"
  | "mail"
  | "menu"
  | "message"
  | "quality"
  | "search"
  | "shield"
  | "star"
  | "store"
  | "user"
  | "x";
export function Icon({
  name,
  className = "home-parts-view-1",
}: {
  name: IconName;
  className?: string;
}) {
  const paths: Record<IconName, ReactNode> = {
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    cart: (
      <>
        <path d="M3 3h2l2.5 11h9.8l2-7H6.2" />
        <circle cx="9" cy="19" r="1.3" />
        <circle cx="17" cy="19" r="1.3" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    fish: (
      <>
        <path d="M3 12s4-6 10-6c4 0 7 3 8 6-1 3-4 6-8 6-6 0-10-6-10-6Z" />
        <path d="M3 12 1 7v10l2-5Z" />
        <circle cx="16" cy="10" r=".8" fill="currentColor" stroke="none" />
      </>
    ),
    heart: (
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
    ),
    instagram: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r=".6" fill="currentColor" />
      </>
    ),
    linkedin: (
      <>
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4V8h4v2" />
        <path d="M2 9h4v12H2z" />
        <circle cx="4" cy="4" r="2" />
      </>
    ),
    location: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
    message: (
      <>
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
        <path d="M8 9h8M8 13h5" />
      </>
    ),
    quality: (
      <>
        <path d="m12 3 2.4 3.7 4.3 1.1-2.8 3.4.3 4.4-4.2-1.7-4.2 1.7.3-4.4-2.8-3.4 4.3-1.1L12 3Z" />
        <path d="m9 18-1 4 4-2 4 2-1-4" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
        <path d="m9 12 2 2 4-5" />
      </>
    ),
    star: (
      <path d="m12 2.8 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9L6.4 20l1.1-6.2L3 9.4l6.2-.9L12 2.8Z" />
    ),
    store: (
      <>
        <path d="M4 10v10h16V10" />
        <path d="M3 4h18l-2 6H5L3 4Z" />
        <path d="M9 20v-6h6v6" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    x: (
      <>
        <path d="M5 5l14 14M19 5 5 19" />
      </>
    ),
  };
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <a href="#home" className="home-parts-view-2" aria-label="Fishmarket home">
      <LogoMark />
      <span
        className={`text-[17px] font-extrabold tracking-[0.08em] ${
          light ? "text-white" : "text-[#003152]"
        }`}
      >
        FISHMARKET
      </span>
    </a>
  );
}
export function Button({
  children,
  variant = "primary",
  className = "",
  type = "button",
  onClick,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "light";
  className?: string;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  const styles = {
    primary:
      "bg-[#003152] text-white shadow-[0_8px_24px_rgba(0,49,82,.2)] hover:bg-[#003152]",
    secondary:
      "border border-[#d4e9f3] bg-white text-[#003152] hover:border-[#003152] hover:text-[#003152]",
    light: "bg-white text-[#003152] shadow-lg hover:bg-[#eaf6fc]",
  };
  return (
    <UiButton
      variant="plain"
      type={type}
      onClick={onClick}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#003152]/20 ${styles[variant]} ${className}`}
    >
      {children}
    </UiButton>
  );
}
export function VerifiedBadge() {
  const { t } = useTranslation();
  return (
    <span className="home-parts-view-4">
      <Icon name="check" className="home-parts-view-5" /> {t("Verified Seller")}
    </span>
  );
}
export function Rating({ value }: { value: string }) {
  return (
    <span className="home-parts-view-6">
      <Icon name="star" className="home-parts-view-7" /> {value}
    </span>
  );
}
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="home-parts-view-8">
      <div>
        {eyebrow && <p className="home-parts-view-9">{t(eyebrow)}</p>}
        <h2 className="home-parts-view-10">{t(title)}</h2>
        {subtitle && <p className="home-parts-view-11">{t(subtitle)}</p>}
      </div>
      {action}
    </div>
  );
}
export function Header() {
  const { language, setLanguage } = useTranslation();
  return <SiteHeader language={language} setLanguage={setLanguage} />;
}
export function SearchPanel() {
  const [searched, setSearched] = useState(false);
  const { t } = useTranslation();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSearched(true);
    document.querySelector("#featured")?.scrollIntoView({
      behavior: "smooth",
    });
  };
  return (
    <form onSubmit={submit} className="home-parts-view-12">
      <div className="home-parts-view-13">
        <UiLabel className="home-parts-view-14">
          <Icon name="search" className="home-parts-view-15" />
          <span className="home-parts-view-16">Search marketplace</span>
          <UiInput
            className="home-parts-view-17"
            placeholder={t("Search fish, species, breed, or seller...")}
          />
        </UiLabel>
        {["Species", "Location", "Price Range"].map((label) => (
          <UiLabel key={label} className="home-parts-view-18">
            <span className="home-parts-view-16">{label}</span>
            <NativeSelect className="home-parts-view-19" defaultValue="">
              <NativeSelectOption value="" disabled>
                {t(label)}
              </NativeSelectOption>
              <NativeSelectOption>{t(`All ${label}`)}</NativeSelectOption>
            </NativeSelect>
            <Icon name="chevron" className="home-parts-view-20" />
          </UiLabel>
        ))}
        <Button type="submit" className="home-parts-view-21">
          <Icon name="search" className="home-parts-view-22" />
          {t(searched ? "Results" : "Search")}
        </Button>
      </div>
    </form>
  );
}
export function Hero() {
  const { t } = useTranslation();
  return (
    <section id="top" className="market-hero home-parts-view-23">
      <div className="home-parts-view-24">
        <div className="home-parts-view-25">
          <div className="hero-copy home-parts-view-26">
            <span className="home-parts-view-27">
              <span className="home-parts-view-28" />{" "}
              {t("The trusted marketplace for aquatic trade")}
            </span>
            <h1 className="home-parts-view-29">
              {t("Buy. Sell.")}
              <br />
              <span className="home-parts-view-30">{t("Trade. Fish.")}</span>
            </h1>
            <p className="home-parts-view-31">
              {t(
                "Discover quality fish from trusted breeders, farms, and sellers. Compare prices, verify sellers, and trade with confidence.",
              )}
            </p>
            <div className="home-parts-view-32">
              <Button>
                {t("Explore Marketplace")}{" "}
                <Icon name="arrow" className="home-parts-view-22" />
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  window.location.hash = "farming";
                }}
              >
                {t("Farm a Fish")}
              </Button>
            </div>
            <div className="pt-6">
              {[
                "10,000+ Fish Listed",
                "2,500+ Verified Sellers",
                "Secure Transactions",
              ].map((item) => (
                <span key={item} className="home-parts-view-34">
                  <span className="home-parts-view-35">
                    <Icon name="check" className="home-parts-view-36" />
                  </span>
                  {t(item)}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="home-parts-view-37">
          <img
            src={photos.hero}
            alt="Koi fish photographed in dark water"
            className="home-parts-view-38"
            fetchPriority="high"
          />
          <div className="home-parts-view-39" />
          <div className="home-parts-view-40">
            <div className="home-parts-view-41">
              <span className="home-parts-view-42">
                <Icon name="shield" />
              </span>
              <div>
                <p className="home-parts-view-43">{t("Buyer Protection")}</p>
                <p className="home-parts-view-44">
                  {t("Included on eligible trades")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="home-parts-view-45">
        <SearchPanel />
      </div>
      <div className="home-parts-view-46" />
    </section>
  );
}
export function CategoryCard({ item }: { item: string[] }) {
  const { t } = useTranslation();
  return (
    <a href="#home?section=featured" className="group home-parts-view-47">
      <img src={item[2]} alt={item[0]} className="home-parts-view-48" />
      <div className="home-parts-view-49" />
      <div className="home-parts-view-50">
        <div>
          <h3 className="home-parts-view-51">{t(item[0])}</h3>
          <p className="home-parts-view-52">
            {item[1].replace("listings", t("listings"))}
          </p>
        </div>
        <span className="home-parts-view-53">
          <Icon name="arrow" className="home-parts-view-22" />
        </span>
      </div>
    </a>
  );
}
export function ListingCard({
  item,
  index,
}: {
  item: (typeof listings)[0];
  index: number;
}) {
  const [favorite, setFavorite] = useState(false);
  const { t } = useTranslation();
  return (
    <article className="market-listing group home-parts-view-54">
      <div className="home-parts-view-55">
        <img
          src={item.image}
          alt={item.name}
          loading="lazy"
          className="home-parts-view-48"
        />
        <UiButton
          variant="plain"
          onClick={() => setFavorite(!favorite)}
          aria-label={`${t("Favorite")} ${item.name}`}
          aria-pressed={favorite}
          className={`absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow-md backdrop-blur transition ${
            favorite ? "text-[#E75A64]" : "text-[#214d68] hover:text-[#E75A64]"
          }`}
        >
          <Icon
            name="heart"
            className={`h-[18px] w-[18px] ${favorite ? "fill-current" : ""}`}
          />
        </UiButton>
        <span className="home-parts-view-56">ID FM-{2048 + index * 187}</span>
      </div>
      <div className="home-parts-view-57">
        <VerifiedBadge />
        <p className="home-parts-view-58">{item.species}</p>
        <h3 className="home-parts-view-59">{item.name}</h3>
        <div className="home-parts-view-60">
          <span>{t(item.detail)}</span>
          <span className="home-parts-view-61" />
          <span className="home-parts-view-62">
            <Icon name="location" className="home-parts-view-5" />
            {item.location}
          </span>
        </div>
        <div className="pt-4">
          <div>
            <p className="home-parts-view-64">{item.seller}</p>
            <Rating value={item.rating} />
          </div>
          <div className="home-parts-view-65">
            <p className="home-parts-view-66">{t("From")}</p>
            <p className="home-parts-view-67">{item.price}</p>
          </div>
        </div>
        <Button variant="secondary" className="home-parts-view-68">
          {t("View Details")}{" "}
          <Icon name="arrow" className="home-parts-view-22" />
        </Button>
      </div>
    </article>
  );
}
export function Stats() {
  const { t } = useTranslation();
  return (
    <section className="home-parts-view-69">
      <div className="home-parts-view-70">
        {[
          ["10,000+", "Active Listings"],
          ["2,500+", "Verified Sellers"],
          ["15,000+", "Successful Trades"],
          ["98%", "Satisfied Buyers"],
        ].map(([num, label], i) => (
          <div
            key={label}
            className={`text-center ${
              i ? "lg:border-l lg:border-white/15" : ""
            }`}
          >
            <p className="home-parts-view-71">{num}</p>
            <p className="home-parts-view-72">{t(label)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
export function SellerCard({ seller }: { seller: (typeof sellers)[0] }) {
  const { t } = useTranslation();
  return (
    <article className="home-parts-view-73">
      <div className="home-parts-view-74">
        <img src={seller.image} alt="" className="home-parts-view-75" />
        <div className="home-parts-view-76">
          <div className="home-parts-view-77">
            <h3 className="home-parts-view-78">{seller.name}</h3>
            <span className="home-parts-view-79">
              <Icon name="check" className="home-parts-view-36" />
            </span>
          </div>
          <p className="home-parts-view-80">{t(seller.specialty)}</p>
        </div>
      </div>
      <div className="home-parts-view-81">
        <span className="home-parts-view-82">
          <Icon name="location" className="home-parts-view-22" />
          {seller.location}
        </span>
        <Rating value={seller.rating} />
      </div>
      <div className="home-parts-view-83">
        <span className="home-parts-view-84">
          {seller.listings.replace("Listings", t("Listings"))}
        </span>
        <UiButton variant="plain" className="home-parts-view-85">
          {t("View Store")} <Icon name="arrow" className="home-parts-view-5" />
        </UiButton>
      </div>
    </article>
  );
}
export function HowItWorks() {
  const { t } = useTranslation();
  const steps = [
    [
      "search",
      "Find Your Fish",
      "Search thousands of listings and find the fish that matches your needs.",
    ],
    [
      "user",
      "Check the Seller",
      "Review ratings, verification, location, and previous transactions.",
    ],
    [
      "message",
      "Make a Deal",
      "Contact the seller or place an order securely through the platform.",
    ],
    [
      "shield",
      "Receive Your Fish",
      "Complete the transaction and receive your fish safely.",
    ],
  ] as [IconName, string, string][];
  return (
    <section id="how" className="home-parts-view-86">
      <div className="home-parts-view-87">
        <SectionHeading
          eyebrow="Simple. Secure. Transparent."
          title="Trade With Confidence"
          subtitle="A clear process designed to protect buyers and help trusted sellers grow."
        />
        <div className="home-parts-view-88">
          <div className="home-parts-view-89" />
          {steps.map(([icon, title, text], i) => (
            <div key={title} className="home-parts-view-90">
              <div className="home-parts-view-91">
                <span className="home-parts-view-92">
                  <Icon name={icon} className="home-parts-view-3" />
                </span>
                <span className="home-parts-view-93">0{i + 1}</span>
              </div>
              <h3 className="home-parts-view-94">{t(title)}</h3>
              <p className="home-parts-view-95">{t(text)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
export function Promo() {
  const { t } = useTranslation();
  return (
    <section className="home-parts-view-96">
      <div className="home-parts-view-97">
        <img
          src={photos.farm}
          alt="Professional fish farm seller at work"
          className="home-parts-view-98"
        />
        <div className="home-parts-view-99" />
        <div className="home-parts-view-100">
          <p className="home-parts-view-101">
            {t("Start your fish farming journey")}
          </p>
          <h2 className="home-parts-view-71">{t("Raise Your Fish With Us")}</h2>
          <p className="home-parts-view-102">
            {t(
              "Choose a farming package, place a deposit, and follow your fish until handover.",
            )}
          </p>
          <div className="home-parts-view-103">
            <Button
              variant="light"
              onClick={() => {
                window.location.hash = "farming";
              }}
            >
              {t("Farm a Fish")}{" "}
              <Icon name="arrow" className="home-parts-view-22" />
            </Button>
            <span className="home-parts-view-104">
              <Icon name="check" className="home-parts-view-105" />{" "}
              {t("Receive your fish when the farming cycle ends")}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
export function Footer() {
  const { t } = useTranslation();
  const columns = [
    [
      "Marketplace",
      "Browse Fish",
      "Categories",
      "Featured Listings",
      "Trusted Sellers",
    ],
    [
      "For Sellers",
      "Sell Your Fish",
      "Seller Dashboard",
      "Seller Guidelines",
      "Transaction Fees",
    ],
    [
      "Support",
      "Help Center",
      "Contact Us",
      "Safety & Security",
      "Terms & Conditions",
      "Privacy Policy",
    ],
  ];
  return (
    <footer id="about" className="home-parts-view-106">
      <div className="home-parts-view-107">
        <div>
          <Logo light />
          <p className="home-parts-view-108">
            {t(
              "Your trusted marketplace for buying, selling, and trading quality fish.",
            )}
          </p>
          <div className="home-parts-view-109">
            {(["instagram", "linkedin"] as IconName[]).map((icon) => (
              <UiButton
                variant="plain"
                key={icon}
                aria-label={icon}
                className="home-parts-view-110"
              >
                <Icon name={icon} className="home-parts-view-111" />
              </UiButton>
            ))}
          </div>
        </div>
        {columns.map(([title, ...links]) => (
          <div key={title}>
            <h3 className="home-parts-view-112">{t(title)}</h3>
            <ul className="home-parts-view-113">
              {links.map((link) => (
                <li key={link}>
                  <a href="#" className="home-parts-view-114">
                    {t(link)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="home-parts-view-115">
        <div className="home-parts-view-116">
          <p>© 2026 FISHMARKET. {t("All rights reserved.")}</p>
          <p>{t("Built for safer, smarter aquatic trade.")}</p>
        </div>
      </div>
    </footer>
  );
}
