import "./Home.css";
import { useEffect, useState } from "react";
import { useTranslation } from "@/context/LanguageContext";
import { domainApi, errorMessage } from "@/services/api";
import type { CompanyStore, MarketplacePage } from "@/services/contracts";
import { Hero, SectionHeading, Button, ListingCard, Footer } from "@/components/home/HomeParts";

export function AppContent() {
  const { language } = useTranslation();
  const [catalog, setCatalog] = useState<MarketplacePage | null>(null);
  const [company, setCompany] = useState<CompanyStore | null>(null);
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
    return () => controller.abort();
  }, [reload]);
  return <div className="home-view-1"><main>
    <Hero />
    <section id="featured" className="home-view-7"><div className="home-view-3">
      <SectionHeading title={tr("Available fish", "Cá đang bán")} subtitle={tr("Browse the company's live catalog.", "Xem danh mục cá đang bán của công ty.")} action={<Button variant="secondary" onClick={() => { window.location.hash = "marketplace"; }}>{tr("Browse all listings", "Xem tất cả tin")}</Button>} />
      {loading && <p role="status">{tr("Loading fish…", "Đang tải cá…")}</p>}
      {catalogError !== null && <div role="alert"><p>{errorMessage(catalogError, language)}</p><Button onClick={() => setReload((n) => n + 1)}>{tr("Retry", "Thử lại")}</Button></div>}
      {!loading && catalogError === null && catalog && <><p>{catalog.total} {tr("available listings", "tin đang bán")}</p><div className="home-view-9">{catalog.items.map((item) => <ListingCard key={item.id} item={item} />)}</div>{!catalog.items.length && <p>{tr("No available fish yet.", "Chưa có cá đang bán.")}</p>}</>}
    </div></section>
    <section id="company" className="home-view-2"><div className="home-view-3">
      <SectionHeading title={tr("Our company", "Công ty của chúng tôi")} />
      {companyError !== null && <div role="alert"><p>{errorMessage(companyError, language)}</p><Button onClick={() => setReload((n) => n + 1)}>{tr("Retry", "Thử lại")}</Button></div>}
      {companyError === null && company && <><h3>{company.name}</h3><p>{company.about}</p><p>{company.location}</p><p>{company.species.join(" · ")}</p></>}
    </div></section>
  </main><Footer /></div>;
}
