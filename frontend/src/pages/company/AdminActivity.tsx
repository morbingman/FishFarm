import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/context/LanguageContext";
import { errorMessage } from "@/services/api";
import type { AdminActivity as ActivityRecord } from "@/services/contracts";
import { activityApi } from "@/services/listingReviewApi";
import { activityLimits, reviewDate, safeActivityLink } from "@/services/listingReview";
import { currentUser, useUser } from "@/services/session";
import "@/pages/marketplace/PublicMarketplace.css";
import "@/pages/marketplace/Commerce.css";
import "./ListingReview.css";

export default function AdminActivity() {
  const { language } = useTranslation();
  const user = useUser();
  const tr = (en: string, vi: string) => language === "vi" ? vi : en;
  const [limit, setLimit] = useState<number>(100);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; rows: ActivityRecord[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const sessionKey = user ? `${user.email}:${user.role}` : "";
  const key = `${sessionKey}:${limit}:${reload}`;
  const sameSession = () => user?.role === "Admin" && currentUser()?.email === user.email && currentUser()?.role === user.role;
  const activeRead = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    const read = ++activeRead.current;
    setLoaded(null); setLoading(true); setError(""); setPage(1);
    if (!sameSession()) { setLoading(false); return () => controller.abort(); }
    void activityApi.list(limit, controller.signal).then(rows => {
      if (!controller.signal.aborted && read === activeRead.current && sameSession()) setLoaded({ key, rows });
    }).catch(failure => {
      if (!controller.signal.aborted && read === activeRead.current && sameSession()) { setLoaded(null); setError(errorMessage(failure, language)); }
    }).finally(() => {
      if (!controller.signal.aborted && read === activeRead.current && sameSession()) setLoading(false);
    });
    return () => controller.abort();
  }, [limit, reload, sessionKey]);
  const visible = sameSession() && !loading && !error && loaded?.key === key ? loaded.rows : null;
  const needle = search.trim().toLocaleLowerCase();
  const rows = (visible ?? []).filter(value => !needle || [value.id, value.actorLabel, value.role, value.action, value.target ?? "", value.link ?? "", value.createdAt, reviewDate(value.createdAt, language)].some(text => text.toLocaleLowerCase().includes(needle)));
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const currentPage = Math.min(page, pages);
  return <main className="public-market commerce listing-review admin-activity">
    <nav className="review-navigation" aria-label={tr("Activity navigation", "Điều hướng hoạt động")}><a href="#admin/queue">{tr("Internal review queue", "Hàng đợi xét duyệt nội bộ")}</a><a href="#company/listings">{tr("Company catalog", "Danh mục công ty")}</a><a href="#company/orders">{tr("Company orders", "Đơn hàng công ty")}</a></nav>
    <h1>{tr("Recent recorded platform activity", "Hoạt động nền tảng ghi nhận gần đây")}</h1>
    <p>{tr("A server-returned window of recent events, newest first—not a complete audit history or platform total. Recorded actor roles and action text are displayed unchanged; System appears only when recorded by the server.", "Một nhóm sự kiện gần đây do máy chủ trả về, mới nhất trước—không phải toàn bộ lịch sử kiểm toán hay tổng nền tảng. Vai trò và nội dung hành động được hiển thị nguyên văn; System chỉ xuất hiện nếu máy chủ ghi nhận.")}</p>
    <div className="review-toolbar"><label>{tr("Server window limit", "Giới hạn bản ghi máy chủ")}<select value={limit} disabled={loading} onChange={event => {
      const next = Number(event.target.value);
      if (!(activityLimits as readonly number[]).includes(next)) return;
      setLoaded(null); setLoading(true); setLimit(next); setPage(1);
    }}>{activityLimits.map(value => <option key={value} value={value}>{value}</option>)}</select></label><label>{tr("Search recorded actor, role, action, target or date · loaded window", "Tìm người, vai trò, hành động, đối tượng hoặc ngày · nhóm đã tải")}<input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label><button disabled={loading} onClick={() => { setLoaded(null); setLoading(true); setReload(value => value + 1); }}>{tr("Refresh", "Làm mới")}</button></div>
    {!sameSession() && <p role="alert">{tr("An active Admin session is required.", "Cần phiên Admin đang hoạt động.")}</p>}
    {error && <p role="alert" className="commerce-alert">{error}</p>}
    {loading && sameSession() && <p role="status">{tr("Loading private activity…", "Đang tải hoạt động riêng…")}</p>}
    {visible && <section className="commerce-panel"><p>{visible.length} {tr("returned records", "bản ghi trả về")} · {rows.length} {tr("local search matches", "kết quả tìm cục bộ")} · {tr("requested maximum", "tối đa yêu cầu")} {limit}</p>
      {!rows.length ? <p>{visible.length ? tr("No recorded events match your local search.", "Không có sự kiện ghi nhận phù hợp từ khóa cục bộ.") : tr("No activity was returned in this window.", "Không có hoạt động trả về trong nhóm này.")}</p> : <div className="review-table-wrap"><table><thead><tr><th>{tr("Recorded time · UTC", "Thời gian ghi nhận · UTC")}</th><th>{tr("Recorded actor / role", "Người / vai trò ghi nhận")}</th><th>{tr("Recorded action", "Hành động ghi nhận")}</th><th>{tr("Recorded target / link", "Đối tượng / liên kết ghi nhận")}</th></tr></thead><tbody>{rows.slice((currentPage - 1) * 10, currentPage * 10).map(value => {
        const link = safeActivityLink(value.link);
        return <tr key={value.id}><td><time dateTime={value.createdAt} title={value.createdAt}>{reviewDate(value.createdAt, language)}</time></td><td><b>{value.actorLabel}</b><br />{value.role}</td><td className="review-copy">{value.action}</td><td>{link ? <a href={link}>{value.target || link}</a> : <><span className="review-copy">{value.target ?? "—"}</span>{value.link && <p className="review-copy review-recorded-link">{value.link}<br /><small>{tr("Recorded link not available in this slice; plain text only.", "Liên kết ghi nhận chưa khả dụng trong phần này; chỉ văn bản.")}</small></p>}</>}</td></tr>;
      })}</tbody></table></div>}
      <div className="review-pager"><button disabled={currentPage <= 1} onClick={() => setPage(value => value - 1)}>{tr("Previous", "Trước")}</button><span>{currentPage} / {pages} · {tr("10 rows per page", "10 dòng mỗi trang")}</span><button disabled={currentPage >= pages} onClick={() => setPage(value => value + 1)}>{tr("Next", "Sau")}</button></div>
      <p>{tr("Links are clickable only for known active Admin destinations. Unknown, external, User-only and unavailable destinations remain recorded plain text. Nothing is inferred from missing events.", "Chỉ liên kết đến trang Admin đã tích hợp mới có thể bấm. Trang không rõ, bên ngoài, chỉ dành User hoặc chưa tích hợp giữ dạng văn bản ghi nhận. Không suy diễn từ sự kiện thiếu.")}</p>
    </section>}
  </main>;
}
