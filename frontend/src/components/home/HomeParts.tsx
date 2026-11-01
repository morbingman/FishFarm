import { LogoMark } from "@/components/layout/LogoMark";
import { Button as UiButton } from "@/components/ui/button";
import { useTranslation } from "@/context/LanguageContext";
import { SiteHeader } from "@/components/layout/SiteHeader";
import type { MarketplaceListing } from "@/services/contracts";
import type { ReactNode } from "react";
import "./HomeParts.css";

export function Logo({ light = false }: { light?: boolean }) {
  return <a href="#home" className="home-parts-view-2" aria-label="Fishmarket home"><LogoMark /><span className={light ? "text-white" : "text-[#003152]"}>FISHMARKET</span></a>;
}
export function Button({ children, variant = "primary", className = "", type = "button", onClick }: {
  children: ReactNode; variant?: "primary" | "secondary" | "light" | "outline"; className?: string; type?: "button" | "submit"; onClick?: () => void;
}) {
  const styles = {
    primary: "bg-[#003152] text-white shadow-lg hover:bg-[#214d68]",
    secondary: "border border-[#d4e9f3] bg-white text-[#003152] hover:border-[#003152]",
    light: "bg-white text-[#003152] shadow-lg hover:bg-[#eaf6fc]",
    outline: "border border-white/80 bg-white/10 text-white hover:bg-white/25",
  };
  return <UiButton variant="plain" type={type} onClick={onClick} className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold transition-all focus:outline-none focus:ring-4 focus:ring-[#003152]/20 ${styles[variant]} ${className}`}>{children}</UiButton>;
}
export function SectionHeading({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  const { t } = useTranslation();
  return <div className="home-parts-view-8"><div>{eyebrow && <p className="home-parts-view-9">{t(eyebrow)}</p>}<h2 className="home-parts-view-10">{t(title)}</h2>{subtitle && <p className="home-parts-view-11">{t(subtitle)}</p>}</div>{action}</div>;
}
export function Header() {
  const { language, setLanguage } = useTranslation();
  return <SiteHeader language={language} setLanguage={setLanguage} />;
}
export function Hero() {
  const { language } = useTranslation();
  const vi = language === "vi";
  return <section id="top" className="market-hero home-video-hero">
    <div className="home-video-background" aria-hidden="true"><img src="/hero-koi.jpg" alt="" className="integration-hero-image" /></div>
    <div className="home-video-overlay" aria-hidden="true" />
    <div className="home-video-layout"><div className="hero-copy home-video-copy">
      <span className="home-parts-view-27">{vi ? "Danh mục cá của công ty" : "Company-operated fish catalog"}</span>
      <h1>{vi ? "Khám phá." : "Discover."}<br />{vi ? "Cá chất lượng." : "Quality fish."}</h1>
      <p>{vi ? "Xem cá đang bán và giá cả từ công ty của chúng tôi." : "Explore available fish and prices from our company."}</p>
      <div className="home-video-actions"><Button variant="light" onClick={() => { window.location.hash = "marketplace"; }}>{vi ? "Khám phá chợ cá" : "Explore Marketplace"}</Button><Button variant="outline" onClick={() => { window.location.hash = "farming"; }}>{vi ? "Xem lô nuôi" : "See grow-out batches"}</Button></div>
    </div></div>
  </section>;
}
export function ListingCard({ item }: { item: MarketplaceListing }) {
  const { language, t } = useTranslation();
  const detail = [item.sizeCm === null ? null : `${item.sizeCm} cm`, item.origin].filter(Boolean).join(" · ");
  const price = new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(item.price);
  return <article className="market-listing group home-parts-view-54">
    <div className="home-parts-view-55">{item.image ? <img src={item.image} alt={item.name} loading="lazy" className="home-parts-view-48" /> : <p className="integration-no-image">{language === "vi" ? "Chưa có hình ảnh" : "No image available"}</p>}<span className="home-parts-view-56">{item.id}</span></div>
    <div className="home-parts-view-57">
      <p title={item.species} className="home-parts-view-58">{item.species}</p><h3 title={item.name} className="home-parts-view-59">{item.name}</h3>
      <div className="home-parts-view-60"><span>{detail || "—"}</span><span className="home-parts-view-62">{item.location || "—"}</span></div>
      <div className="listing-card-summary"><div><p title={item.company.name} className="home-parts-view-64">{item.company.name}</p>{item.rating !== null && <span>{item.rating.toFixed(1)} · {item.reviewCount} {language === "vi" ? "đánh giá" : "reviews"}</span>}</div><p className="home-parts-view-67">{price}</p></div>
      {item.saleMode === "pre_order" && <p>{language === "vi" ? "Đặt trước" : "Pre-order"} · {item.depositPct}% {language === "vi" ? "đặt cọc" : "deposit"}</p>}
      <Button className="home-parts-view-68" onClick={() => { window.location.hash = `marketplace/detail?fish=${encodeURIComponent(item.id)}`; }}>{t("View Details")}</Button>
    </div>
  </article>;
}
export function Footer() {
  const { language } = useTranslation();
  const vi = language === "vi";
  // The grid expects four columns; every link targets a real route, and the
  // "good to know" note repeats the honest simulated-payments wording used
  // elsewhere instead of inventing contact details.
  return <footer id="about" className="home-parts-view-106"><div className="home-parts-view-107">
    <div><Logo light /><p className="home-parts-view-108">{vi ? "Danh mục cá của công ty." : "Our company fish catalog."}</p></div>
    <nav aria-label="Footer" className="home-parts-view-113">
      <p className="home-parts-view-117">{vi ? "Khám phá" : "Explore"}</p>
      <a href="#marketplace" className="home-parts-view-114">{vi ? "Chợ cá" : "Marketplace"}</a>
      <a href="#farming" className="home-parts-view-114">{vi ? "Lô nuôi và cập nhật" : "Batches and updates"}</a>
      <a href="#home" className="home-parts-view-114">{vi ? "Trang chủ" : "Home"}</a>
    </nav>
    <nav aria-label={vi ? "Tài khoản" : "Account"} className="home-parts-view-113">
      <p className="home-parts-view-117">{vi ? "Tài khoản" : "Account"}</p>
      <a href="#login" className="home-parts-view-114">{vi ? "Đăng nhập" : "Sign in"}</a>
      <a href="#login" className="home-parts-view-114">{vi ? "Tạo tài khoản" : "Create account"}</a>
    </nav>
    <div className="mt-5">
      <p className="home-parts-view-117">{vi ? "Cần biết" : "Good to know"}</p>
      <p className="home-parts-view-118">{vi ? "Toàn bộ thanh toán và hoàn tiền trong bản tích hợp này là mô phỏng — không có giao dịch thật nào diễn ra." : "All payments and refunds in this integration are simulated — no real money moves."}</p>
    </div>
  </div><div className="home-parts-view-115"><p className="home-parts-view-116">© 2026 FISHMARKET</p></div></footer>;
}
