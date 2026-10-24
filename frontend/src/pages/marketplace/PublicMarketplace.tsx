import { useEffect, useState } from "react";
import { useTranslation } from "@/context/LanguageContext";
import { domainApi } from "@/services/api";
import { Button, Footer, ListingCard } from "@/components/home/HomeParts";
import type { HomeListing } from "@/data/homeData";
import "./PublicMarketplace.css";

type PublicFish = HomeListing & {
  description: string;
  quantity: number;
  health?: string;
  images: { url: string }[];
};

export default function PublicMarketplace() {
  const { t, language } = useTranslation();
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en);
  const [hash, setHash] = useState(window.location.hash);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<HomeListing[]>([]);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<PublicFish | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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
    setError(false);
    setDetail(null);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      q: search,
    });
    const request = code
      ? domainApi.listing(code, controller.signal)
      : domainApi.listings(params.toString(), controller.signal);
    void request
      .then((data) => {
        if (controller.signal.aborted) return;
        if (code) setDetail(data);
        else {
          setItems(data.items);
          setTotal(data.total);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [code, page, search, reload]);
  return (
    <>
      <main className="public-market">
        <div className="public-market-heading">
          <div>
            <a href="#home">← {tr("Trang chủ", "Home")}</a>
            <h1>
              {code ? tr("Chi tiết cá", "Fish details") : t("Marketplace")}
            </h1>
            <p>
              {tr(
                "Khám phá cá đang bán. Đăng nhập khi bạn sẵn sàng mua.",
                "Browse available fish. Sign in when you are ready to buy.",
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
              placeholder={t("Search fish, species, breed, or seller...")}
            />
            <Button type="submit">{t("Search")}</Button>
          </form>
        )}
        {loading && <p role="status">{tr("Đang tải cá…", "Loading fish…")}</p>}
        {error && (
          <div role="alert">
            <p>
              {tr(
                "Chưa tải được dữ liệu cá. Vui lòng thử lại.",
                "Unable to load fish. Please try again.",
              )}
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
                  [tr("Người bán", "Seller"), detail.seller],
                  [tr("Khu vực", "Location"), detail.location],
                  [
                    tr("Kích thước", "Size"),
                    detail.size ? `${detail.size} cm` : null,
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
              <Button
                onClick={() => {
                  window.location.hash = "login";
                }}
              >
                {tr("Đăng nhập để mua cá", "Sign in to buy")}
              </Button>
            </div>
          </article>
        )}
      </main>
      <Footer />
    </>
  );
}
