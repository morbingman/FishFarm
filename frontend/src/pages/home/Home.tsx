import "./Home.css";
import { useEffect, useState } from "react";
import { useTranslation } from "@/context/LanguageContext";
import { domainApi, errorMessage } from "@/services/api";
import { batchesApi } from "@/services/batchesApi";
import type { CompanyStore, MarketplacePage } from "@/services/contracts";
import { Hero, SectionHeading, Button, ListingCard, Footer } from "@/components/home/HomeParts";

export function AppContent() {
  const { language } = useTranslation();
  const [catalog, setCatalog] = useState<MarketplacePage | null>(null);
  const [company, setCompany] = useState<CompanyStore | null>(null);
  const [batchTotal, setBatchTotal] = useState<number | null>(null);
  const [catalogError, setCatalogError] = useState<unknown>(null);
  const [companyError, setCompanyError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const tr = (en: string, vi: string) => language === "vi" ? vi : en;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setCatalogError(null); setCompanyError(null);
    void domainApi.listings("page=1&pageSize=4", controller.signal)
      .then((data) => { if (!controller.signal.aborted) setCatalog(data); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setCatalogError(error); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    void domainApi.store(controller.signal)
      .then((data) => { if (!controller.signal.aborted) setCompany(data); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setCompanyError(error); });
    // Decorative stat only — a failed count is silently left as "—".
    void batchesApi.list({ page: 1, limit: 1 }, controller.signal)
      .then((page) => { if (!controller.signal.aborted) setBatchTotal(page.total); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [reload]);
  const steps = [
    {
      title: tr("Browse the catalog", "Xem danh mục"),
      body: tr("Live fish listings and open grow-out batches, published and operated by the company.", "Danh sách cá đang bán và lô nuôi đang mở, do công ty công bố và vận hành."),
    },
    {
      title: tr("Order or reserve shares", "Đặt hàng hoặc giữ phần"),
      body: tr("Buy available fish straight from the catalog, or reserve shares in a batch while it is still growing — the package is paid once, at reservation.", "Mua cá có sẵn trong danh mục, hoặc giữ phần trong lô nuôi khi lô vẫn đang nuôi — gói được thanh toán một lần khi giữ phần."),
    },
    {
      title: tr("Track to delivery", "Theo dõi đến giao hàng"),
      body: tr("Follow your order status or the batch's recorded updates, pay any delivery fee after harvest, and confirm delivery from your account.", "Theo dõi trạng thái đơn hoặc cập nhật đã ghi nhận của lô, trả phí giao hàng (nếu có) sau thu hoạch, rồi xác nhận giao hàng trong tài khoản của bạn."),
    },
  ];
  return <div className="home-view-1"><main>
    <Hero />
    <section id="featured" className="home-view-7"><div className="home-view-3">
      <SectionHeading title={tr("Available fish", "Cá đang bán")} subtitle={tr("Browse the company's live catalog.", "Xem danh mục cá đang bán của công ty.")} action={<Button variant="secondary" onClick={() => { window.location.hash = "marketplace"; }}>{tr("Browse all listings", "Xem tất cả tin")}</Button>} />
      {loading && <p role="status">{tr("Loading fish…", "Đang tải cá…")}</p>}
      {catalogError !== null && <div role="alert"><p>{errorMessage(catalogError, language)}</p><Button onClick={() => setReload((n) => n + 1)}>{tr("Retry", "Thử lại")}</Button></div>}
      {!loading && catalogError === null && catalog && <><p>{catalog.total} {tr("available listings", "tin đang bán")}</p><div className="home-view-9">{catalog.items.map((item) => <ListingCard key={item.id} item={item} />)}</div>{!catalog.items.length && <p>{tr("No available fish yet.", "Chưa có cá đang bán.")}</p>}</>}
    </div></section>
    <section id="how-it-works" className="home-steps-section"><div className="home-view-3">
      <SectionHeading title={tr("How it works", "Cách hoạt động")} subtitle={tr("Two ways to buy — direct orders and grow-out batch sponsorship.", "Hai cách mua — đặt hàng trực tiếp và bảo trợ lô nuôi.")} />
      <div className="home-view-10">{steps.map((step, index) => <article key={step.title} className="home-step-card"><span className="home-step-badge">{index + 1}</span><h3 className="home-view-14">{step.title}</h3><p className="home-view-15">{step.body}</p></article>)}</div>
    </div></section>
    <section id="company" className="home-company-section"><div className="home-view-3">
      <h2 className="home-company-heading">{tr("Our company", "Công ty của chúng tôi")}</h2>
      <p className="home-company-sub">{tr("One team raises every fish on this site — from our own facilities to your door.", "Một đội ngũ nuôi toàn bộ cá trên trang này — từ cơ sở của công ty đến tay bạn.")}</p>
      {companyError !== null && <div role="alert"><p>{errorMessage(companyError, language)}</p><Button variant="secondary" onClick={() => setReload((n) => n + 1)}>{tr("Retry", "Thử lại")}</Button></div>}
      {companyError === null && company && <>
        <div className="home-company-grid">
          <div>
            <h3 className="home-company-name">{company.name}</h3>
            <p className="home-company-about">{company.about}</p>
          </div>
          <div>
            <p className="home-company-location">{company.location}</p>
            <div className="home-chips">{company.species.map((species) => <span key={species} className="home-chip">{species}</span>)}</div>
          </div>
        </div>
        <dl className="home-stats">
          <div className="home-stat"><dt className="home-stat-value">{catalog?.total ?? "—"}</dt><dd className="home-stat-label">{tr("fish for sale now", "cá đang bán")}</dd></div>
          <div className="home-stat"><dt className="home-stat-value">{batchTotal ?? "—"}</dt><dd className="home-stat-label">{tr("open grow-out batches", "lô nuôi đang mở")}</dd></div>
          <div className="home-stat"><dt className="home-stat-value">{company.species.length}</dt><dd className="home-stat-label">{tr("species raised", "loài đang nuôi")}</dd></div>
        </dl>
      </>}
    </div></section>
    <section className="home-cta">
      {/* Decorative filmstrip of shipped fish photos scrolling left in a
         seamless loop; hidden from assistive tech and frozen for
         reduced-motion users. The list is rendered twice so the -50%
         translation loops without a visible seam. */}
      <div className="home-cta-slides" aria-hidden="true">
        {[0, 1].map((copy) => (
          <div className="home-cta-strip" key={copy}>
            {["/home/fish-01.jpg", "/home/fish-03.jpg", "/hero-koi.jpg"].map((source) => (
              <img key={source} src={source} alt="" className="home-cta-slide" loading={copy === 0 ? "eager" : "lazy"} />
            ))}
          </div>
        ))}
      </div>
      <div className="home-cta-veil" aria-hidden="true" />
      <div className="home-view-3 home-cta-inner">
        <h2>{tr("Ready to explore the catalog?", "Sẵn sàng khám phá danh mục?")}</h2>
        <p>{tr("Browse today's fish, or follow a batch from stocking to harvest.", "Xem cá đang bán hôm nay, hoặc theo dõi một lô từ thả giống đến thu hoạch.")}</p>
        <div className="home-cta-actions"><Button variant="light" onClick={() => { window.location.hash = "marketplace"; }}>{tr("Browse marketplace", "Xem chợ cá")}</Button><Button variant="outline" onClick={() => { window.location.hash = "farming"; }}>{tr("View grow-out batches", "Xem lô nuôi")}</Button></div>
      </div>
    </section>
  </main><Footer /></div>;
}
