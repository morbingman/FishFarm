import "./App.css";
import { lazy, Suspense, useEffect, useState } from "react";
import { LanguageContext, type Language } from "@/context/LanguageContext";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { AppContent } from "@/pages/home/Home";
import { bootstrapSession, useSessionReady, useUser } from "@/services/session";
import { errorMessage } from "@/services/api";
import { isOrderRoute } from "@/services/orders";
import { isCompanyOrderRoute } from "@/services/companyOrders";
import { isDisputeRoute } from "@/services/disputes";
import { parseCompanyListingRoute } from "@/services/companyListings";
import { listenHashNavigation } from "@/services/hashNavigation";
export const Auth = lazy(() => import("@/pages/auth/Auth"));
const PublicMarketplace = lazy(() => import("@/pages/marketplace/PublicMarketplace"));
const Commerce = lazy(() => import("@/pages/marketplace/Commerce"));
const Orders = lazy(() => import("@/pages/marketplace/Orders"));
const Disputes = lazy(() => import("@/pages/marketplace/Disputes"));
const CompanyCatalog = lazy(() => import("@/pages/company/CompanyCatalog"));
export const topOf = (hash: string) => hash.replace(/^#/, "").split(/[/?]/)[0];
export const TOP = new Set(["", "home", "login", "marketplace", "company", "admin", "account", "farming", "expired"]);
export type View = "home" | "auth" | "buyer" | "admin" | "account" | "farming" | "expired" | "notfound";

export default function App() {
  const user = useUser();
  const ready = useSessionReady();
  const [hash, setHash] = useState(window.location.hash);
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem("fishmarket-language") === "vi" ? "vi" : "en");
  const [sessionError, setSessionError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => listenHashNavigation(setHash), []);
  useEffect(() => {
    setSessionError("");
    void bootstrapSession().catch((error: unknown) => setSessionError(errorMessage(error, language)));
  }, [retry]);
  useEffect(() => {
    localStorage.setItem("fishmarket-language", language);
    document.documentElement.lang = language;
  }, [language]);
  const top = topOf(hash);
  const route = hash.split("?")[0].replace(/^#/, "");
  const catalog = top === "marketplace" && ["marketplace", "marketplace/detail"].includes(route);
  const orders = isOrderRoute(route);
  const companyOrders = isCompanyOrderRoute(route);
  const companyCatalog = parseCompanyListingRoute(route);
  const disputes = isDisputeRoute(route);
  const buyerDisputes = disputes && top === "marketplace";
  const commerce = ["marketplace/cart", "marketplace/checkout", "marketplace/confirmation"].includes(route);
  const privateCommerce = commerce || orders || buyerDisputes;
  const gated = (["admin", "account", "company"].includes(top) || privateCommerce) && !user;
  useEffect(() => {
    if ((privateCommerce || companyOrders || companyCatalog || disputes) && !user) sessionStorage.setItem("fishmarket-return", route + (hash.includes("?") ? `?${hash.split("?")[1]}` : ""));
  }, [privateCommerce, companyOrders, companyCatalog, disputes, user, hash, route]);
  let page;
  if (top === "" || top === "home") page = <AppContent />;
  else if (catalog) page = <PublicMarketplace />;
  else if (top === "login" || gated) page = !ready ? <p role="status">{language === "vi" ? "Đang kiểm tra phiên…" : "Checking session…"}</p> : <Auth language={language} setLanguage={setLanguage} />;
  else if (privateCommerce && user?.role !== "Buyer") page = <main className="public-market"><h1>{language === "vi" ? "Không có quyền truy cập" : "Access denied"}</h1><p>{language === "vi" ? "Trang mua hàng và đơn hàng chỉ dành cho User." : "Purchase and buyer-order pages are for User accounts only."}</p></main>;
  else if (orders) page = <Orders key={`${user?.email}:${route}`} orderId={route === "marketplace/orders" ? null : route.slice("marketplace/orders/".length)} />;
  else if (commerce) page = <Commerce key={user?.email} route={route} orderId={new URLSearchParams(hash.split("?")[1] ?? "").get("order")} />;
  else if (["admin", "company"].includes(top) && user?.role !== "Admin") page = <main className="public-market"><h1>{language === "vi" ? "Không có quyền truy cập" : "Access denied"}</h1><p>{language === "vi" ? "Chỉ quản trị viên có thể mở trang này." : "Only Admin accounts can open this workspace."}</p></main>;
  else if (disputes) page = <Disputes key={`${user?.email}:${route}`} admin={top === "admin"} orderId={route.endsWith("/dispute") ? route.split("/")[2] : null} disputeId={route.endsWith("/dispute") || route.split("/").length !== 3 ? null : route.split("/")[2]} />;
  else if (companyCatalog) page = <CompanyCatalog key={`${user?.email}:${route}`} {...companyCatalog} />;
  else if (companyOrders) page = <Orders key={`${user?.email}:${route}`} company orderId={route.split("/").length === 3 ? route.split("/")[2] : null} />;
  else if (TOP.has(top)) page = <main className="public-market"><h1>{language === "vi" ? "Chức năng chưa khả dụng" : "Not available in this integration slice"}</h1><p>{language === "vi" ? "Chức năng này đang được tích hợp. Không có dữ liệu hay giao dịch mô phỏng." : "This feature is still being integrated. No demo records or simulated transactions are used."}</p><a href="#marketplace">{language === "vi" ? "Xem chợ cá" : "Browse marketplace"}</a></main>;
  else page = <main className="public-market"><h1>{language === "vi" ? "Không tìm thấy trang" : "Page not found"}</h1><a href="#home">Home</a></main>;
  return <LanguageContext.Provider value={{ language, setLanguage }}>
    <SiteHeader language={language} setLanguage={setLanguage} />
    {sessionError && <div className="public-market" role="alert">{sessionError} <button onClick={() => setRetry((n) => n + 1)}>{language === "vi" ? "Thử lại" : "Retry session"}</button></div>}
    <Suspense fallback={<p role="status">{language === "vi" ? "Đang tải…" : "Loading…"}</p>}>{page}</Suspense>
  </LanguageContext.Provider>;
}
