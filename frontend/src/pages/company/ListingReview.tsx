import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "@/context/LanguageContext";
import { errorMessage } from "@/services/api";
import { listingLabel, listingRoute } from "@/services/companyListings";
import type { CompanyListing, ListingReviewFeedback, ListingReviewTab, ReviewListing } from "@/services/contracts";
import { replaceHashRoute, useHashTransitionGuard } from "@/services/hashNavigation";
import { listingReviewApi } from "@/services/listingReviewApi";
import { canReviewAction, listingReviewRoute, reviewDate, reviewFeedback, reviewMoney, reviewTabFromHash, reviewTabs, ReviewValidationError, takedownReason, type ReviewAction } from "@/services/listingReview";
import { currentUser, useUser } from "@/services/session";
import "@/pages/marketplace/PublicMarketplace.css";
import "@/pages/marketplace/Commerce.css";
import "./ListingReview.css";

type Loaded = { key: string; rows: CompanyListing[]; detail: ReviewListing | null };
type Confirmation = { action: ReviewAction; feedback?: ListingReviewFeedback; reason?: string };

export default function ListingReview({ listingId }: { listingId: string | null }) {
  const { language } = useTranslation();
  const user = useUser();
  const tr = (en: string, vi: string) => language === "vi" ? vi : en;
  const [tab, setTab] = useState<ListingReviewTab>(() => reviewTabFromHash(window.location.hash));
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [step, setStep] = useState(1);
  const [confirm, setConfirm] = useState<Confirmation | "refresh" | null>(null);
  const locked = useRef(false);
  const alive = useRef(true);
  const sessionKey = user ? `${user.email}:${user.role}` : "";
  const [stateSession, setStateSession] = useState(sessionKey);
  const key = `${sessionKey}:${listingId ?? "queue"}:${tab}:${reload}`;
  const sameSession = () => user?.role === "Admin" && currentUser()?.email === user.email && currentUser()?.role === user.role;
  const dirty = stateSession === sessionKey && (!!reason || !!feedback || step !== 1);
  const visible = sameSession() && stateSession === sessionKey && loaded?.key === key && !loading && !error ? loaded : null;
  const detail = visible?.detail ?? null;
  const blocked = busy || loading || needsRefresh || !detail;

  useHashTransitionGuard(() => !sameSession() || stateSession !== sessionKey || (!busy && (!dirty || window.confirm(tr("Leave without recording this decision text?", "Rời trang mà không ghi nhận nội dung quyết định?")))));
  useEffect(() => {
    if (stateSession !== sessionKey) {
      setReason(""); setFeedback(""); setStep(1); setConfirm(null); setError(""); setNotice(""); setStateSession(sessionKey);
    }
  }, [sessionKey, stateSession]);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (sameSession() && stateSession === sessionKey && (dirty || busy)) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy, sessionKey, stateSession]);
  useEffect(() => {
    if (listingId) return;
    const sync = () => {
      if (window.location.hash.split("?")[0] === listingReviewRoute()) setTab(reviewTabFromHash(window.location.hash));
    };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [listingId]);
  useEffect(() => {
    const controller = new AbortController();
    const requestedHash = window.location.hash;
    setLoaded(null); setLoading(true); setError(""); setConfirm(null); setPage(1);
    if (!sameSession()) { setLoading(false); return () => controller.abort(); }
    const load = listingId ? listingReviewApi.detail(listingId, controller.signal).then(value => {
      if (controller.signal.aborted || !sameSession()) return;
      setLoaded({ key, rows: [], detail: value });
      if (value.id !== listingId) replaceHashRoute(listingReviewRoute(value.id) + (requestedHash.includes("?") ? requestedHash.slice(requestedHash.indexOf("?")) : ""), requestedHash);
    }) : listingReviewApi.queue(tab, controller.signal).then(rows => {
      if (!controller.signal.aborted && sameSession()) setLoaded({ key, rows, detail: null });
    });
    void load.then(() => { if (!controller.signal.aborted && sameSession()) setNeedsRefresh(false); })
      .catch(failure => { if (!controller.signal.aborted && sameSession()) { setLoaded(null); setError(errorMessage(failure, language)); setNeedsRefresh(true); } })
      .finally(() => { if (!controller.signal.aborted && sameSession()) setLoading(false); });
    return () => controller.abort();
  }, [listingId, tab, reload, sessionKey]);

  function validationMessage(failure: unknown) {
    if (!(failure instanceof ReviewValidationError)) return errorMessage(failure, language);
    return failure.field === "step" ? tr("Choose an integer field group from 1 to 6.", "Chọn nhóm trường nguyên từ 1 đến 6.")
      : failure.field === "feedback" ? tr("Trimmed feedback must contain 10–2000 characters.", "Phản hồi sau khi bỏ khoảng trắng phải có 10–2000 ký tự.")
      : tr("Use a 1–120 character reason for a review decision, or 10–2000 characters for takedown.", "Lý do quyết định dài 1–120 ký tự, lý do gỡ tin dài 10–2000 ký tự, sau khi bỏ khoảng trắng.");
  }
  function start(action: ReviewAction) {
    if (blocked || !detail || !canReviewAction(detail.status, action)) return;
    setError("");
    try {
      setConfirm(action === "approve" ? { action } : action === "takedown" ? { action, reason: takedownReason(reason) } : { action, feedback: reviewFeedback(reason, feedback, step) });
    } catch (failure) {
      setNotice(validationMessage(failure));
    }
  }
  function refresh() {
    if (busy || locked.current) return;
    if (dirty) { setConfirm("refresh"); return; }
    doRefresh();
  }
  function doRefresh() {
    setReason(""); setFeedback(""); setStep(1); setConfirm(null); setNotice("");
    setLoaded(null); setLoading(true); setReload(value => value + 1);
  }
  async function act() {
    if (!confirm || confirm === "refresh" || blocked || locked.current || !detail || !sameSession() || !canReviewAction(detail.status, confirm.action)) return;
    const captured = confirm;
    const original = detail;
    locked.current = true; setBusy(true); setNotice("");
    try {
      const value = captured.action === "approve" ? await listingReviewApi.approve(original.id)
        : captured.action === "reject" ? await listingReviewApi.reject(original.id, captured.feedback!)
        : captured.action === "request-changes" ? await listingReviewApi.requestChanges(original.id, captured.feedback!)
        : await listingReviewApi.takedown(original.id, { reason: captured.reason! });
      if (value.company.id !== original.company.id || value.id !== original.id) throw new Error("Unexpected listing decision response");
      if (!alive.current || !sameSession()) return;
      setReason(""); setFeedback(""); setStep(1); setConfirm(null);
      setNotice(tr("Decision confirmed by the server. Reading the current detail and completeness hints before another action.", "Máy chủ xác nhận quyết định. Đang đọc chi tiết và gợi ý đầy đủ hiện tại trước thao tác tiếp theo."));
      setNeedsRefresh(true); setLoaded(null); setLoading(true); setReload(value => value + 1);
    } catch (failure) {
      if (!alive.current || !sameSession()) return;
      setConfirm(null); setLoaded(null); setNeedsRefresh(true);
      setError(errorMessage(failure, language) + " " + tr("The outcome may be unknown. No uncertain write is automatically replayed. Refresh to reconcile the record before another action.", "Kết quả có thể chưa rõ. Không tự động gửi lại thao tác chưa xác nhận. Làm mới để đối chiếu bản ghi trước thao tác tiếp theo."));
    } finally { locked.current = false; if (alive.current && sameSession()) setBusy(false); }
  }

  const needle = search.trim().toLocaleLowerCase();
  const rows = (visible?.rows ?? []).filter(value => !needle || [value.id, value.company.name, value.createdBy ?? "", value.draft?.name ?? "", value.draft?.species ?? ""].some(text => text.toLocaleLowerCase().includes(needle)));
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const currentPage = Math.min(page, pages);
  const date = (value: string | null | undefined) => reviewDate(value, language);
  const field = (label: string, value: ReactNode) => <div key={label}><dt>{label}</dt><dd>{value === null || value === undefined || value === "" ? "—" : value}</dd></div>;
  const d = detail?.draft;
  const tabLabel = (value: ListingReviewTab) => value === "pending" ? tr("Pending review", "Chờ xét duyệt") : value === "approved" ? tr("Live approved", "Đã duyệt, công khai") : tr("Sent back · changes and rejected", "Trả lại · yêu cầu sửa và từ chối");
  const actionLabel = (value: ReviewAction) => value === "approve" ? tr("Approve and publish", "Duyệt và xuất bản") : value === "reject" ? tr("Reject listing", "Từ chối tin") : value === "request-changes" ? tr("Request changes", "Yêu cầu sửa") : tr("Take down listing", "Gỡ tin đăng");

  return <main className="public-market commerce listing-review">
    {/* One back button instead of a row of sibling links — the site header's
       dropdowns already reach every admin tool. */}
    {listingId ? <a className="back-pill" href={listingReviewRoute()}>← {tr("Internal review queue", "Hàng đợi xét duyệt nội bộ")}</a> : <a className="back-pill" href="#company/listings">← {tr("Company catalog", "Danh mục công ty")}</a>}
    <h1>{listingId ? tr("Company listing review", "Xét duyệt tin công ty") : tr("Optional internal listing review", "Xét duyệt nội bộ tùy chọn")}</h1>
    <p>{tr("All Admins share company inventory. Creator identity is attribution, not ownership. Direct publication remains the default; internal review is optional.", "Mọi Admin cùng quản lý kho công ty. Người tạo chỉ là thông tin ghi nhận, không phải chủ sở hữu. Xuất bản trực tiếp vẫn là mặc định; xét duyệt nội bộ là tùy chọn.")}</p>
    <div className="review-toolbar">
      {!listingId && <><label>{tr("Server status filter", "Lọc trạng thái máy chủ")}<select value={tab} disabled={busy || loading} onChange={event => {
        const next = event.target.value as ListingReviewTab; setLoaded(null); setLoading(true); setTab(next); setPage(1);
        replaceHashRoute(`${listingReviewRoute()}?tab=${next}`);
      }}>{reviewTabs.map(value => <option key={value} value={value}>{tabLabel(value)}</option>)}</select></label><label>{tr("Search loaded name, code, species, company or creator", "Tìm tên, mã, loài, công ty hoặc người tạo đã tải")}<input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label></>}
      <button className="sl-btn sl-btn-ghost sm" disabled={busy || loading} onClick={refresh}>{tr("Refresh", "Làm mới")}</button>
    </div>
    {!sameSession() && <p role="alert">{tr("An active Admin session is required.", "Cần phiên Admin đang hoạt động.")}</p>}
    {error && sameSession() && stateSession === sessionKey && <p role="alert" className="commerce-alert">{error}</p>}
    {notice && sameSession() && stateSession === sessionKey && <p role="status" className="commerce-alert">{notice}</p>}
    {needsRefresh && <p>{tr("Decisions are disabled until a successful read reconciles the current server record.", "Quyết định bị khóa đến khi đọc thành công bản ghi hiện tại từ máy chủ.")}</p>}
    {loading && sameSession() && <p role="status">{tr("Loading private records…", "Đang tải bản ghi riêng…")}</p>}
    {visible && !listingId && <section className="commerce-panel">
      <p>{rows.length} {tr("matching loaded records · search and paging are local, not platform totals", "bản ghi đã tải phù hợp · tìm kiếm và phân trang cục bộ, không phải tổng nền tảng")}</p>
      <p>{tab === "pending" ? tr("Server order: oldest submission first.", "Thứ tự máy chủ: gửi sớm nhất trước.") : tr("Server order: most recently updated first. The live tab excludes paused listings.", "Thứ tự máy chủ: cập nhật gần nhất trước. Nhóm công khai không gồm tin tạm dừng.")}</p>
      {!rows.length ? <p>{tr("No listings match this loaded tab and search.", "Không có tin phù hợp nhóm đã tải và từ khóa.")}</p> : <div className="review-table-wrap"><table><thead><tr><th>{tr("Listing", "Tin đăng")}</th><th>{tr("Company / creator attribution", "Công ty / ghi nhận người tạo")}</th><th>{tr("Price / available quantity", "Giá / số lượng có sẵn")}</th><th>{tr("Status", "Trạng thái")}</th><th>{tr("Submitted / updated · UTC", "Gửi / cập nhật · UTC")}</th></tr></thead><tbody>{rows.slice((currentPage - 1) * 10, currentPage * 10).map(value => <tr key={value.id}><td><a href={listingReviewRoute(value.id)}>{value.draft?.name || tr("Untitled draft", "Nháp chưa đặt tên")}</a><br />{value.id} · {value.draft?.species || "—"}</td><td>{value.company.name}<br />{value.createdBy ?? "—"}</td><td>{value.draft ? `${reviewMoney(value.draft.price, language)} / ${value.draft.quantity}` : "—"}</td><td>{listingLabel(value.status, language)}</td><td>{date(value.submittedAt)}<br />{date(value.updatedAt)}</td></tr>)}</tbody></table></div>}
      <div className="review-pager"><button disabled={currentPage <= 1} onClick={() => setPage(value => value - 1)}>{tr("Previous", "Trước")}</button><span>{currentPage} / {pages} · {tr("10 rows per page", "10 dòng mỗi trang")}</span><button disabled={currentPage >= pages} onClick={() => setPage(value => value + 1)}>{tr("Next", "Sau")}</button></div>
    </section>}
    {detail && <>
      <section className="commerce-panel"><h2>{detail.id} · {listingLabel(detail.status, language)}</h2><dl className="review-fields">
        {field(tr("Company", "Công ty"), `${detail.company.name} · ${detail.company.id}`)}{field(tr("Company location", "Vị trí công ty"), detail.company.location)}{field(tr("Creator attribution", "Ghi nhận người tạo"), detail.createdBy)}{field(tr("Recorded views", "Lượt xem ghi nhận"), detail.views)}{field(tr("Created", "Tạo lúc"), date(detail.createdAt))}{field(tr("Updated", "Cập nhật"), date(detail.updatedAt))}{field(tr("Submitted", "Gửi lúc"), date(detail.submittedAt))}
      </dl><a href={listingRoute("detail", detail.id)}>{tr("Open shared catalog record", "Mở bản ghi danh mục chung")}</a></section>
      {!d ? <p>{tr("This record has no draft content.", "Bản ghi này không có nội dung nháp.")}</p> : <div className="review-groups">
        <section className="commerce-panel"><h2>{tr("1. Basic information", "1. Thông tin cơ bản")}</h2><dl className="review-fields">{field(tr("Name", "Tên"), d.name)}{field(tr("Species", "Loài"), d.species)}{field(tr("Breed", "Giống"), d.breed)}{field(tr("Description", "Mô tả"), d.description)}</dl></section>
        <section className="commerce-panel"><h2>{tr("2. Fish details", "2. Thông tin cá")}</h2><dl className="review-fields">{field(tr("Age · months", "Tuổi · tháng"), d.ageMonths)}{field(tr("Size · cm", "Kích thước · cm"), d.sizeCm)}{field(tr("Gender", "Giới tính"), d.gender)}{field(tr("Origin", "Xuất xứ"), d.origin)}{field(tr("Health", "Sức khỏe"), d.health)}</dl></section>
        <section className="commerce-panel"><h2>{tr("3. Pricing and terms", "3. Giá và điều khoản")}</h2><dl className="review-fields">{field(tr("Price · integer VND", "Giá · VND nguyên"), reviewMoney(d.price, language))}{field(tr("Available quantity", "Số lượng có sẵn"), d.quantity)}{field(tr("Negotiable", "Thương lượng"), d.negotiable ? tr("Yes", "Có") : tr("No", "Không"))}{field(tr("Sale mode", "Hình thức bán"), d.saleMode === "pre_order" ? tr("Preorder", "Đặt trước") : tr("In stock", "Có sẵn"))}{field(tr("Deposit", "Đặt cọc"), d.depositPct === null ? null : `${d.depositPct}%`)}{field(tr("Expected ready date", "Ngày dự kiến sẵn sàng"), date(d.expectedReadyDate))}{field(tr("Preorder policy", "Chính sách đặt trước"), d.preorderPolicy)}</dl></section>
        <section className="commerce-panel"><h2>{tr("4. Public media", "4. Ảnh công khai")}</h2>{!d.images.length && <p>{tr("No recorded images.", "Không có ảnh ghi nhận.")}</p>}<div className="review-images">{d.images.map((image, index) => <figure key={image.id}><img src={image.url} alt={`${d.name || detail.id} · ${index + 1}`} loading="lazy" referrerPolicy="no-referrer" /><figcaption>{image.id === d.mainId ? tr("Main image", "Ảnh chính") : tr("Image", "Ảnh")} · {tr("Position", "Vị trí")} {image.position}</figcaption></figure>)}</div></section>
        <section className="commerce-panel"><h2>{tr("5. Location and shipping", "5. Vị trí và vận chuyển")}</h2><dl className="review-fields">{field(tr("Listing location", "Vị trí tin đăng"), d.location)}{field(tr("Region", "Khu vực"), d.region)}{field(tr("Shipping options", "Lựa chọn vận chuyển"), d.shipping.length ? d.shipping.join("\n") : null)}</dl></section>
        <section className="commerce-panel"><h2>{tr("6. Editorial preview · read only", "6. Xem trước nội dung · chỉ đọc")}</h2><p>{tr("Saved content only, not an exact buyer view. No edits or publication are performed by this preview.", "Chỉ nội dung đã lưu, không phải giao diện người mua chính xác. Xem trước không sửa hoặc xuất bản.")}</p><h3>{d.name || tr("Untitled", "Chưa đặt tên")}</h3><p>{d.species} · {d.breed || "—"}</p><p className="review-copy">{d.description}</p><p>{reviewMoney(d.price, language)} · {d.quantity} {tr("available", "có sẵn")} · {listingLabel(detail.status, language)}</p><p>{d.saleMode === "pre_order" ? `${tr("Preorder deposit", "Cọc đặt trước")} ${d.depositPct ?? "—"}% · ${date(d.expectedReadyDate)}` : tr("In stock", "Có sẵn")}</p><p>{d.location || "—"} · {d.region || "—"}</p><p className="review-copy">{d.preorderPolicy}</p></section>
      </div>}
      <section className="commerce-panel"><h2>{tr("Backend completeness hints", "Gợi ý đầy đủ từ máy chủ")}</h2><p>{tr("These server hints omit some submission rules, including age, size and shipping. They are not a quality certification or a guarantee of completeness, and do not enforce a second-Admin approval boundary.", "Gợi ý máy chủ không gồm tất cả quy tắc gửi, như tuổi, kích thước và vận chuyển. Đây không phải chứng nhận chất lượng hay bảo đảm đầy đủ, không bắt buộc Admin thứ hai duyệt.")}</p><ul>{detail.checks.map(check => <li key={check.key}>{({ images: tr("Images", "Ảnh"), details: tr("Details", "Thông tin"), pricing: tr("Pricing", "Giá"), location: tr("Location", "Vị trí"), preorder: tr("Preorder", "Đặt trước") })[check.key]}: {check.ok ? tr("Passed server hint", "Đạt gợi ý máy chủ") : tr("Needs attention", "Cần kiểm tra")}</li>)}</ul></section>
      <section className="commerce-panel"><h2>{tr("Recorded decision", "Quyết định ghi nhận")}</h2>{detail.decision ? <dl className="review-fields">{field(tr("Kind", "Loại"), detail.decision.kind)}{field(tr("Reason", "Lý do"), detail.decision.reason)}{field(tr("Feedback", "Phản hồi"), detail.decision.feedback)}{field(tr("Field group", "Nhóm trường"), detail.decision.step)}{field(tr("Recorded by", "Ghi nhận bởi"), detail.decision.by)}{field(tr("Recorded at", "Ghi nhận lúc"), date(detail.decision.at))}</dl> : <p>{tr("No current decision snapshot. Approvals are recorded in history rather than retained here.", "Không có ảnh chụp quyết định hiện tại. Duyệt tin được ghi trong lịch sử thay vì giữ tại đây.")}</p>}</section>
      <section className="commerce-panel"><h2>{tr("Recorded history · newest first", "Lịch sử ghi nhận · mới nhất trước")}</h2>{!detail.history.length && <p>{tr("No recorded history.", "Không có lịch sử ghi nhận.")}</p>}<ol className="review-history">{[...detail.history].reverse().map((entry, index) => <li key={`${entry.at}:${index}`}><b>{entry.action}</b><p>{entry.by} · {date(entry.at)}</p>{entry.note && <p className="review-copy">{entry.note}</p>}</li>)}</ol></section>
      <section className="commerce-panel"><h2>{tr("Internal review actions", "Thao tác xét duyệt nội bộ")}</h2>
        {detail.status === "pending" ? <><p>{tr("Approve publishes the saved listing. Reject or request changes returns it to the shared catalog for editing. These decisions record history and activity; do not assume a notification was sent.", "Duyệt sẽ xuất bản tin đã lưu. Từ chối hoặc yêu cầu sửa trả tin về danh mục chung để chỉnh sửa. Quyết định ghi lịch sử và hoạt động; không mặc định đã gửi thông báo.")}</p><fieldset className="review-editor" disabled={blocked || !!confirm}><label>{tr("Reason · 1–120 trimmed characters", "Lý do · 1–120 ký tự sau khi bỏ khoảng trắng")}<input value={reason} maxLength={120} onChange={event => { setReason(event.target.value); setNotice(""); }} /></label><label>{tr("Feedback · 10–2000 trimmed characters", "Phản hồi · 10–2000 ký tự sau khi bỏ khoảng trắng")}<textarea rows={5} maxLength={2000} value={feedback} onChange={event => { setFeedback(event.target.value); setNotice(""); }} /></label><label>{tr("Field group to revisit · 1–6", "Nhóm trường cần sửa · 1–6")}<select value={step} onChange={event => setStep(Number(event.target.value))}>{[1, 2, 3, 4, 5, 6].map(value => <option key={value} value={value}>{value}</option>)}</select></label></fieldset><div className="review-actions">{(["approve", "request-changes", "reject"] as const).map(action => <button key={action} disabled={blocked || !!confirm} onClick={() => start(action)}>{actionLabel(action)}</button>)}</div></>
        : canReviewAction(detail.status, "takedown") ? <><p className="commerce-alert">{tr("Takedown hides the listing and records a rejection. It does not cancel existing orders or issue refunds. Any Admin can subsequently edit and directly publish the shared record.", "Gỡ tin sẽ ẩn tin và ghi nhận từ chối. Không hủy đơn hiện có hay hoàn tiền. Bất kỳ Admin nào sau đó có thể sửa và xuất bản trực tiếp bản ghi chung.")}</p><fieldset className="review-editor" disabled={blocked || !!confirm}><label>{tr("Takedown reason · 10–2000 trimmed characters", "Lý do gỡ tin · 10–2000 ký tự sau khi bỏ khoảng trắng")}<textarea rows={5} value={reason} maxLength={2000} onChange={event => { setReason(event.target.value); setNotice(""); }} /></label></fieldset><button disabled={blocked || !!confirm} onClick={() => start("takedown")}>{actionLabel("takedown")}</button></>
        : <p>{tr("No review decision is allowed in this status. Use the shared catalog to edit or optionally resubmit; direct publication does not require review.", "Trạng thái này không cho phép quyết định xét duyệt. Dùng danh mục chung để sửa hoặc gửi lại tùy chọn; xuất bản trực tiếp không cần xét duyệt.")}</p>}
        {dirty && <p>{tr("Unrecorded decision text", "Nội dung quyết định chưa ghi nhận")}</p>}
        <p>{tr("The backend has no atomic status or version check for review decisions. Two concurrent decisions can both commit; the last update wins and history/activity can contain both. Refresh before acting, but refreshing does not prevent this race.", "Máy chủ chưa kiểm tra nguyên tử trạng thái hay phiên bản quyết định. Hai quyết định đồng thời có thể cùng được ghi; cập nhật cuối cùng có hiệu lực và lịch sử/hoạt động có thể chứa cả hai. Làm mới trước thao tác, nhưng làm mới không ngăn được xung đột này.")}</p>
      </section>
    </>}
    {confirm && sameSession() && stateSession === sessionKey && (confirm === "refresh" || !!detail) && <section className="commerce-alert review-confirm" role="group" aria-label={tr("Confirm review action", "Xác nhận thao tác xét duyệt")}>
      <h2>{confirm === "refresh" ? tr("Discard local decision text and refresh?", "Bỏ nội dung quyết định cục bộ và làm mới?") : `${actionLabel(confirm.action)}?`}</h2>
      <p>{confirm === "refresh" ? tr("Only local unrecorded text is discarded. No decision will be submitted.", "Chỉ bỏ nội dung chưa ghi cục bộ. Không gửi quyết định.") : confirm.action === "approve" ? tr("Publish the currently saved listing immediately? Approval is optional internal review, not a creator-ownership or mandatory second-Admin boundary.", "Xuất bản ngay tin hiện đã lưu? Đây là xét duyệt nội bộ tùy chọn, không phải quyền sở hữu người tạo hay bắt buộc Admin thứ hai.") : confirm.action === "takedown" ? tr("Hide this live or paused listing and record a policy rejection? Existing orders are not cancelled or refunded.", "Ẩn tin công khai hoặc tạm dừng và ghi nhận từ chối do chính sách? Không hủy hay hoàn tiền đơn hiện có.") : tr("Record this decision and return the listing for shared company editing? No automatic refund or notification is promised.", "Ghi quyết định và trả tin để công ty cùng sửa? Không tự động hoàn tiền hay bảo đảm gửi thông báo.")}</p>
      {confirm !== "refresh" && <>{confirm.feedback && <><p className="review-copy">{confirm.feedback.reason}</p><p className="review-copy">{confirm.feedback.feedback}</p><p>{tr("Field group", "Nhóm trường")}: {confirm.feedback.step}</p></>}{confirm.reason && <p className="review-copy">{confirm.reason}</p>}</>}
      <button disabled={busy || (confirm !== "refresh" && blocked)} onClick={() => confirm === "refresh" ? doRefresh() : void act()}>{busy ? tr("Submitting…", "Đang gửi…") : tr("Confirm action", "Xác nhận thao tác")}</button><button disabled={busy} onClick={() => setConfirm(null)}>{tr("Keep unchanged", "Giữ nguyên")}</button>
    </section>}
  </main>;
}
