import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "@/context/LanguageContext";
import { ApiError, errorMessage } from "@/services/api";
import { batchesApi } from "@/services/batchesApi";
import { batchRoute, batchStatusLabel } from "@/services/batches";
import type { PublicBatch, PublicBatchQuery, RecordedBatchUpdate } from "@/services/batchContracts";
import { replaceHashRoute } from "@/services/hashNavigation";
import BatchDetails, { BatchUpdateFeed, batchUtc } from "@/components/batches/BatchDetails";
import { SponsorPanel } from "./SponsorPanel";
import "../marketplace/PublicMarketplace.css";
import "./PublicBatches.css";

type Filters = { q: string; species: string; region: string; harvestBefore: string; priceMax: string; limit: number };
const emptyFilters: Filters = { q: "", species: "", region: "", harvestBefore: "", priceMax: "", limit: 20 };

export default function PublicBatches({ mode, batchId }: { mode: "list" | "detail"; batchId: string | null }) {
  const { language } = useTranslation();
  const tr = (en: string, vi: string) => language === "vi" ? vi : en;
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PublicBatch[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 });
  const [detail, setDetail] = useState<PublicBatch | null>(null);
  const [feed, setFeed] = useState<RecordedBatchUpdate[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [reload, setReload] = useState(0);
  const [feedReload, setFeedReload] = useState(0);
  const alive = useRef(true);
  const sequence = useRef(0);
  const feedSequence = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    const read = ++sequence.current;
    const current = () => alive.current && !controller.signal.aborted && read === sequence.current;
    const expectedHash = window.location.hash;
    setLoading(true); setError(""); setNotFound(false); setDetail(null); setRows([]);
    const query: PublicBatchQuery = { page, limit: applied.limit };
    for (const field of ["q", "species", "region"] as const) if (applied[field].trim()) query[field] = applied[field].trim();
    if (applied.priceMax.trim()) query.priceMax = Number(applied.priceMax);
    if (applied.harvestBefore) query.harvestBefore = `${applied.harvestBefore}T23:59:59.999Z`;
    const request = mode === "list" ? batchesApi.list(query, controller.signal).then(value => {
      if (current()) { setRows(value.items); setPagination({ page: value.page, pages: value.pages, total: value.total }); }
    }) : batchId ? batchesApi.detail(batchId, controller.signal).then(value => {
      if (current()) { setDetail(value); if (value.id !== batchId) replaceHashRoute(batchRoute("detail", value.id), expectedHash); }
    }) : Promise.reject(new ApiError(404, "batch.notFound"));
    void request.catch(failure => { if (current()) { setError(errorMessage(failure, language)); setNotFound(failure instanceof ApiError && failure.status === 404); } })
      .finally(() => { if (current()) setLoading(false); });
    return () => controller.abort();
  }, [mode, batchId, applied, page, reload]);
  useEffect(() => {
    const controller = new AbortController();
    const read = ++feedSequence.current;
    const current = () => alive.current && !controller.signal.aborted && read === feedSequence.current;
    setFeed([]); setFeedError("");
    if (!detail || mode !== "detail" || loading) { setFeedLoading(false); return () => controller.abort(); }
    setFeedLoading(true);
    void batchesApi.updates(detail.id, controller.signal).then(value => { if (current()) setFeed(value); })
      .catch(failure => {
        if (!current()) return;
        if (failure instanceof ApiError && failure.status === 404) {
          setDetail(null); setFeed([]); setFeedError(""); setNotFound(true); setError(errorMessage(failure, language));
        } else setFeedError(errorMessage(failure, language));
      })
      .finally(() => { if (current()) setFeedLoading(false); });
    return () => controller.abort();
  }, [detail, mode, loading, feedReload]);
  function apply(event: FormEvent) {
    event.preventDefault();
    if (filters.priceMax && (!/^\d+$/.test(filters.priceMax) || !Number.isSafeInteger(Number(filters.priceMax)) || Number(filters.priceMax) > 2147483647)) {
      setError(tr("Maximum price must be a non-negative integer VND amount up to 2,147,483,647.", "Giá tối đa phải là số nguyên VND không âm, tối đa 2.147.483.647.")); return;
    }
    setLoading(true); setRows([]); setPage(1); setApplied({ ...filters, q: filters.q.trim(), species: filters.species.trim(), region: filters.region.trim() });
  }
  const fields: [keyof Pick<Filters, "q" | "species" | "region" | "harvestBefore" | "priceMax">, string, string][] = [
    ["q", tr("Search title, species or description", "Tìm tiêu đề, loài hoặc mô tả"), "search"],
    ["species", tr("Species · exact match", "Loài · khớp chính xác"), "text"],
    ["region", tr("Region · exact match", "Khu vực · khớp chính xác"), "text"],
    ["harvestBefore", tr("Expected harvest on or before · UTC", "Thu hoạch dự kiến vào hoặc trước · UTC"), "date"],
    ["priceMax", tr("Maximum package price per share · VND", "Giá gói mỗi phần tối đa · VND"), "number"],
  ];
  return <main className="public-market public-batches">
    <div className="public-market-heading"><div><a href="#home">← {tr("Home", "Trang chủ")}</a><h1>{mode === "list" ? tr("Public grow-out batches", "Lô nuôi công khai") : tr("Grow-out batch details", "Chi tiết lô nuôi")}</h1><p>{tr("Browse only open batches with available shares and current approved facility compliance backed by controlled documents. Public visibility can change as availability or compliance changes.", "Chỉ xem lô đang mở, còn phần có sẵn và cơ sở có tuân thủ được phê duyệt còn hiệu lực với hồ sơ được kiểm soát. Hiển thị công khai có thể đổi theo số phần còn lại hoặc tuân thủ.")}</p></div>{mode === "detail" && <a href="#farming">{tr("Back to batches", "Về danh sách lô")}</a>}</div>
    <aside className="batch-notice">{tr("Sponsoring is User-only: reserve shares here, then pay the full package once on the sponsorship page — no deposit, no balance. After harvest the sponsor pays any charged delivery fee and confirms delivery from My sponsorships; refunds stay capped at money paid. This catalog is not an ownership dashboard.", "Bảo trợ chỉ dành cho User: giữ phần tại đây rồi thanh toán trọn gói một lần trên trang bảo trợ — không đặt cọc, không trả góp. Sau thu hoạch, người bảo trợ trả phí giao hàng (nếu có) và xác nhận giao hàng từ trang Bảo trợ của tôi; hoàn tiền vẫn giới hạn trong số tiền đã trả. Danh mục này không phải bảng sở hữu.")}</aside>
    {mode === "list" && <form className="batch-filter-form" onSubmit={apply}><fieldset disabled={loading}><legend>{tr("Server filters", "Bộ lọc máy chủ")}</legend><div className="batch-form-grid">{fields.map(([key, label, type]) => <div key={key}><label htmlFor={`public-batch-${key}`}>{label}</label><input id={`public-batch-${key}`} type={type} maxLength={type === "text" || type === "search" ? 80 : undefined} min={type === "number" ? 0 : undefined} step={type === "number" ? 1 : undefined} value={filters[key]} onChange={event => setFilters(value => ({ ...value, [key]: event.target.value }))} /></div>)}<div><label htmlFor="public-batch-limit">{tr("Records per page", "Số bản ghi mỗi trang")}</label><select id="public-batch-limit" value={filters.limit} onChange={event => setFilters(value => ({ ...value, limit: Number(event.target.value) }))}>{[10, 20, 50, 100].map(limit => <option key={limit} value={limit}>{limit}</option>)}</select></div></div><div className="batch-actions"><button type="submit">{tr("Apply filters", "Áp dụng bộ lọc")}</button><button type="button" onClick={() => { setFilters(emptyFilters); setApplied({ ...emptyFilters }); setPage(1); setRows([]); setLoading(true); }}>{tr("Reset filters", "Đặt lại bộ lọc")}</button></div></fieldset></form>}
    {loading && <p role="status">{tr("Reading batches…", "Đang đọc lô…")}</p>}
    {error && <div role="alert" className="batch-notice"><p>{notFound ? tr("This batch was not found or is not publicly visible now. No private batch data is shown.", "Không tìm thấy lô hoặc hiện lô không công khai. Không hiển thị dữ liệu lô riêng tư.") : error}</p><button onClick={() => { setLoading(true); setReload(value => value + 1); }}>{tr("Retry server read", "Thử đọc lại máy chủ")}</button></div>}
    {!loading && !error && mode === "list" && <><p>{pagination.total} {tr("matching public records · server pagination", "bản ghi công khai phù hợp · phân trang máy chủ")}</p>{!rows.length ? <p>{tr("No public batches match these filters on this page.", "Không có lô công khai khớp bộ lọc trên trang này.")}</p> : <div className="batch-card-grid">{rows.map(batch => <article className="batch-card" key={batch.id}>{batch.images[0] && <img loading="lazy" src={batch.images[0].url} alt={batch.title} />}<p>{batch.id} · {batchStatusLabel(batch.status, language)}</p><h2><a href={batchRoute("detail", batch.id)}>{batch.title}</a></h2><p>{batch.species} · {batch.region}</p><p>{batch.packagePricePerShare.toLocaleString(language === "vi" ? "vi-VN" : "en-US")} ₫ {tr("per share", "mỗi phần")}</p><p>{batch.shareQuantity} {batch.shareUnitType === "weight" ? tr("g per share", "g mỗi phần") : tr("fish per share", "con mỗi phần")} · {batch.sharesAvailable} {tr("shares available", "phần có sẵn")}</p><p>{tr("Expected harvest", "Thu hoạch dự kiến")}: {batchUtc(batch.expectedHarvestDate, tr("Not recorded", "Chưa ghi nhận"))}</p><a href={batchRoute("detail", batch.id)}>{tr("Read details and recorded updates", "Đọc chi tiết và cập nhật đã ghi nhận")}</a></article>)}</div>}<nav className="public-market-pages" aria-label={tr("Batch pagination", "Phân trang lô")}><button disabled={pagination.page <= 1} onClick={() => { setLoading(true); setPage(value => value - 1); }}>{tr("Previous", "Trước")}</button><span>{pagination.pages === 0 ? tr("No pages available", "Chưa có trang dữ liệu") : `${pagination.page} / ${pagination.pages}`}</span><button disabled={pagination.pages === 0 || pagination.page >= pagination.pages} onClick={() => { setLoading(true); setPage(value => value + 1); }}>{tr("Next", "Sau")}</button></nav></>}
    {!loading && !error && detail && <><BatchDetails batch={detail} includeFeed={false} /><SponsorPanel batch={detail} />{feedLoading ? <p role="status">{tr("Reading recorded updates…", "Đang đọc cập nhật đã ghi nhận…")}</p> : feedError ? <div className="batch-notice" role="alert"><p>{tr("The recorded feed could not be read. No substitute history is shown.", "Không đọc được bảng cập nhật đã ghi nhận. Không hiển thị lịch sử thay thế")} {feedError}</p><button onClick={() => setFeedReload(value => value + 1)}>{tr("Retry feed", "Thử đọc lại cập nhật")}</button></div> : <BatchUpdateFeed updates={feed} />}</>}
  </main>;
}
