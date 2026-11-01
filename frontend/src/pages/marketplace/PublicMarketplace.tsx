import { useEffect, useState } from "react";
import { useTranslation } from "@/context/LanguageContext";
import { domainApi, errorMessage } from "@/services/api";
import { AddToCart } from "./AddToCart";
import { Button, Footer, ListingCard } from "@/components/home/HomeParts";
import type { HomeListing } from "@/data/homeData";
import "./PublicMarketplace.css";

type PublicFish = HomeListing;

export default function PublicMarketplace() {
  const { t, language } = useTranslation();
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en);
  const [hash, setHash] = useState(window.location.hash);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  // Server-side filter params (ListMarketplaceDto): sort order, size bucket
  // and stock availability. Empty string means "no filter".
  const [sort, setSort] = useState("recommended");
  const [size, setSize] = useState("");
  const [available, setAvailable] = useState("");
  const [items, setItems] = useState<HomeListing[]>([]);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<PublicFish | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [reload, setReload] = useState(0);
  const code =
    hash.split("?")[0] === "#marketplace/detail"
      ? new URLSearchParams(hash.split("?")[1] ?? "").get("fish")
      : null;
  useEffect(() => {
    const sync = () => {
      setHash(window.location.hash);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setDetail(null);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      q: search,
    });
    if (sort !== "recommended") params.set("sort", sort);
    if (size) params.set("size", size);
    if (available) params.set("available", available);
    const request = code
      ? domainApi.listing(code, controller.signal).then((data) => {
          if (!controller.signal.aborted) setDetail(data);
        })
      : domainApi.listings(params.toString(), controller.signal).then((data) => {
          if (!controller.signal.aborted) { setItems(data.items); setTotal(data.total); }
        });
    void request
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(failure);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [code, page, search, reload, sort, size, available]);
  return (
    <>
      <main className="public-market">
        <div className="public-market-heading">
          <div>
            {!code && <a href="#home">← {tr("Trang chủ", "Home")}</a>}
            <h1>
              {code ? tr("Chi tiết cá", "Fish details") : t("Marketplace")}
            </h1>
            <p>
              {tr(
                "Khám phá cá và giá trong danh mục của công ty. Thanh toán hiện được mô phỏng.",
                "Browse fish and prices in the company catalog. Checkout currently uses simulated payments.",
              )}
            </p>
          </div>
          {code && (
            <a href="#marketplace">
              ← {tr("Quay lại chợ cá", "Back to marketplace")}
            </a>
          )}
        </div>
        {!code && (
          <form
            className="public-market-search"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(query.trim());
              setPage(1);
            }}
          >
            <label htmlFor="public-fish-search">
              {tr("Tìm cá", "Search fish")}
            </label>
            <input
              id="public-fish-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr("Tìm cá, loài, giống hoặc khu vực…", "Search fish, species, breed, or location…")}
            />
            <label htmlFor="public-fish-sort">{tr("Sắp xếp", "Sort")}</label>
            <select
              id="public-fish-sort"
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1); }}
            >
              <option value="recommended">{tr("Đề xuất", "Recommended")}</option>
              <option value="price_asc">{tr("Giá thấp → cao", "Price low → high")}</option>
              <option value="price_desc">{tr("Giá cao → thấp", "Price high → low")}</option>
              <option value="newest">{tr("Mới nhất", "Newest")}</option>
            </select>
            <label htmlFor="public-fish-size">{tr("Kích thước", "Size")}</label>
            <select
              id="public-fish-size"
              value={size}
              onChange={(e) => { setSize(e.target.value); setPage(1); }}
            >
              <option value="">{tr("Mọi kích thước", "All sizes")}</option>
              <option value="under15">{tr("Dưới 15 cm", "Under 15 cm")}</option>
              <option value="15plus">{tr("Từ 15 cm", "15 cm and above")}</option>
            </select>
            <label htmlFor="public-fish-available">{tr("Tình trạng", "Availability")}</label>
            <select
              id="public-fish-available"
              value={available}
              onChange={(e) => { setAvailable(e.target.value); setPage(1); }}
            >
              <option value="">{tr("Tất cả", "All")}</option>
              <option value="true">{tr("Còn hàng", "In stock only")}</option>
            </select>
            <Button type="submit">{t("Search")}</Button>
          </form>
        )}
        {loading && <p role="status">{tr("Đang tải cá…", "Loading fish…")}</p>}
        {error !== null && (
          <div role="alert">
            <p>
              {errorMessage(error, language)}
            </p>
            <Button onClick={() => setReload((n) => n + 1)}>
              {tr("Thử lại", "Retry")}
            </Button>
          </div>
        )}
        {!loading && !error && !code && (
          <>
            <p className="public-market-total">
              {total} {tr("tin đang bán", "available listings")}
            </p>
            <div className="home-view-9 public-market-grid">
              {items.map((item) => (
                <ListingCard key={item.id} item={item} />
              ))}
            </div>
            {!items.length && (
              <p>{tr("Chưa có cá phù hợp.", "No matching fish yet.")}</p>
            )}
            {total > 20 && (
              <nav
                className="public-market-pages"
                aria-label={tr("Phân trang", "Pagination")}
              >
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((n) => n - 1)}
                >
                  {tr("Trước", "Previous")}
                </button>
                <span>
                  {page} / {Math.ceil(total / 20)}
                </span>
                <button
                  disabled={page * 20 >= total}
                  onClick={() => setPage((n) => n + 1)}
                >
                  {tr("Sau", "Next")}
                </button>
              </nav>
            )}
          </>
        )}
        {!loading && !error && detail && (
          <article className="public-fish-detail">
            <div className="public-fish-image">
              {detail.image && <img src={detail.image} alt={detail.name} />}
            </div>
            <div className="public-fish-copy">
              <p>
                {detail.id} · {detail.species}
              </p>
              <h2>{detail.name}</h2>
              <strong className="public-fish-price">
                {new Intl.NumberFormat(
                  language === "vi" ? "vi-VN" : "en-US",
                ).format(detail.price)}{" "}
                ₫
              </strong>
              <dl>
                {[
                  [tr("Công ty", "Company"), detail.company.name],
                  [tr("Khu vực", "Location"), detail.location],
                  [
                    tr("Kích thước", "Size"),
                    detail.sizeCm === null ? null : `${detail.sizeCm} cm`,
                  ],
                  [tr("Xuất xứ", "Origin"), detail.origin],
                  [tr("Số lượng", "Quantity"), detail.quantity],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value ?? "—"}</dd>
                  </div>
                ))}
              </dl>
              <p className="public-fish-description">{detail.description}</p>
              {detail.saleMode === "pre_order" && <p>{tr("Đặt trước", "Pre-order")} · {detail.depositPct}% {tr("đặt cọc", "deposit")} · {detail.expectedReadyDate ? new Date(detail.expectedReadyDate).toLocaleDateString(language === "vi" ? "vi-VN" : "en-US") : "—"}</p>}
              {detail.preorderPolicy && <p>{detail.preorderPolicy}</p>}
              <AddToCart key={detail.id} listing={detail} />
            </div>
          </article>
        )}
      </main>
      <Footer />
    </>
  );
}
