import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/context/LanguageContext";
import { apiSessionStamp, errorMessage, isApiSession } from "@/services/api";
import { currentUser, useUser } from "@/services/session";
import { batchesApi } from "@/services/batchesApi";
import { batchRoute, batchStatusLabel } from "@/services/batches";
import { batchReviewRoute, canReviewBatch, normalizeBatchReviewNote, reconciledBatchDecision, retainedBatchObservations, type BatchReviewAction } from "@/services/batchReview";
import { facilityTextLength } from "@/services/facilities";
import { useHashTransitionGuard } from "@/services/hashNavigation";
import type { CompanyBatch } from "@/services/batchContracts";
import BatchDetails, { batchUtc } from "@/components/batches/BatchDetails";
import "../marketplace/PublicMarketplace.css";
import "../farming/PublicBatches.css";
import "./CompanyBatches.css";

type Confirmation = { action: BatchReviewAction; id: string; title: string; record: string; rawNote: string; note: string; sequence: number; revision: number; hash: string };
export default function BatchReview({ batchId }: { batchId: string | null }) {
  const { language } = useTranslation();
  const user = useUser();
  const tr = (en: string, vi: string) => language === "vi" ? vi : en;
  const [stamp] = useState(apiSessionStamp);
  const [rows, setRows] = useState<CompanyBatch[]>([]);
  const [batch, setBatch] = useState<CompanyBatch | null>(null);
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const alive = useRef(true), locked = useRef(false), reading = useRef(true), refreshRequired = useRef(false), sequence = useRef(0), revision = useRef(0), attempted = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const confirmRef = useRef<HTMLElement | null>(null), opener = useRef<HTMLButtonElement | null>(null);
  const sameSession = () => isApiSession(stamp) && stamp?.role === "Admin" && user?.role === "Admin" && user.status === "active" && currentUser()?.email === user.email && currentUser()?.role === "Admin" && currentUser()?.status === "active";
  const blocked = loading || busy || needsRefresh || !sameSession();
  const visible = !blocked ? batch : null;
  const dirty = note !== "";
  const invalidate = () => { ++revision.current; setConfirmation(null); };
  const currentConfirmation = !!confirmation && !!visible && visible.id === batchId && canReviewBatch(visible.status)
    && !attempted.current && confirmation.id === visible.id && confirmation.record === JSON.stringify(visible)
    && confirmation.rawNote === note && confirmation.sequence === sequence.current && confirmation.revision === revision.current && confirmation.hash === window.location.hash;
  useHashTransitionGuard(() => { invalidate(); return !sameSession() || (!locked.current && (!dirty || window.confirm(tr("Leave without recording this rejection note?", "Rời trang mà không ghi nhận ghi chú từ chối?")))); });
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => {
    const hash = () => invalidate();
    const unload = (event: BeforeUnloadEvent) => { if (sameSession() && (dirty || locked.current)) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("hashchange", hash); window.addEventListener("beforeunload", unload);
    return () => { window.removeEventListener("hashchange", hash); window.removeEventListener("beforeunload", unload); };
  }, [dirty, stamp, user]);
  useEffect(() => { if (confirmation && !currentConfirmation) setConfirmation(null); }, [confirmation, currentConfirmation]);
  useEffect(() => { if (confirmation) confirmRef.current?.focus(); }, [confirmation]);
  useEffect(() => {
    const abort = new AbortController(); controller.current?.abort(); controller.current = abort;
    const read = ++sequence.current;
    const current = () => alive.current && !abort.signal.aborted && sameSession() && sequence.current === read;
    reading.current = true; invalidate(); setRows([]); setBatch(null); setLoading(true); setError("");
    if (!sameSession()) { reading.current = false; setLoading(false); return () => abort.abort(); }
    const request = batchId ? batchesApi.companyDetail(batchId, abort.signal).then(value => { if (value.id !== batchId) throw new Error("Unexpected batch identity"); if (current()) setBatch(value); })
      : batchesApi.reviewQueue(abort.signal).then(values => { if (current()) { setRows(values); setPage(1); } });
    void request.then(() => { if (current()) { refreshRequired.current = false; attempted.current = false; setNeedsRefresh(false); } })
      .catch(failure => { if (current()) { refreshRequired.current = true; setNeedsRefresh(true); setError(errorMessage(failure, language)); } })
      .finally(() => { if (current()) { reading.current = false; setLoading(false); } });
    return () => abort.abort();
  }, [batchId, reload, stamp]);
  function refresh() {
    if (!sameSession() || locked.current || reading.current) return;
    if (dirty && !window.confirm(tr("Discard the local rejection note and read the authoritative server record?", "Bỏ ghi chú từ chối cục bộ và đọc bản ghi máy chủ chính thức?"))) return;
    invalidate(); reading.current = true; ++sequence.current; controller.current?.abort(); setNote(""); setNotice(""); setLoading(true); setReload(value => value + 1);
  }
  function changeNote(value: string) {
    if (!sameSession() || locked.current || reading.current || refreshRequired.current || blocked) return;
    invalidate(); setNote(value); setError("");
  }
  function ask(action: BatchReviewAction, button: HTMLButtonElement) {
    if (!sameSession() || blocked || locked.current || reading.current || refreshRequired.current || attempted.current || confirmation || !visible || visible.id !== batchId || !canReviewBatch(visible.status)) return;
    if (action === "approve" && dirty) { setError(tr("Discard the local rejection note with Refresh before approving.", "Bỏ ghi chú từ chối cục bộ bằng Làm mới trước khi phê duyệt.")); return; }
    let normalized = "";
    try { if (action === "reject") normalized = normalizeBatchReviewNote(note); }
    catch { setError(tr("Enter a rejection note of 1–1,000 server-counted characters after trimming.", "Nhập ghi chú từ chối gồm 1–1.000 ký tự theo máy chủ sau khi bỏ khoảng trắng đầu và cuối.")); return; }
    opener.current = button; setError("");
    setConfirmation({ action, id: visible.id, title: visible.title, record: JSON.stringify(visible), rawNote: note, note: normalized, sequence: sequence.current, revision: revision.current, hash: window.location.hash });
  }
  function keep() { if (!locked.current) { invalidate(); opener.current?.focus(); } }
  async function decide() {
    if (!sameSession() || locked.current || reading.current || refreshRequired.current || blocked || !currentConfirmation || !confirmation || !batch) return;
    const captured = confirmation, original = batch;
    if (captured.revision !== revision.current || captured.sequence !== sequence.current || captured.hash !== window.location.hash || captured.rawNote !== note || attempted.current) return;
    locked.current = true; attempted.current = true; const write = ++sequence.current;
    const current = () => alive.current && sameSession() && write === sequence.current;
    controller.current?.abort(); invalidate(); setBusy(true); setError(""); setNotice("");
    let acknowledged = false;
    try {
      const ack = captured.action === "approve" ? await batchesApi.approve(captured.id) : await batchesApi.reject(captured.id, captured.note);
      if (ack.id !== captured.id || ack.status !== (captured.action === "approve" ? "open" : "draft") || ack.reviewedAt === null || ack.reviewedBy === null || ack.reviewNote !== (captured.action === "approve" ? null : captured.note) || (original.submittedAt !== null && ack.submittedAt !== original.submittedAt) || !retainedBatchObservations(original, ack)) throw new Error("Unexpected batch review acknowledgement");
      acknowledged = true;
      if (!current()) return;
      refreshRequired.current = true; setNeedsRefresh(true);
      const abort = new AbortController(); controller.current = abort;
      const saved = await batchesApi.companyDetail(captured.id, abort.signal);
      if (!reconciledBatchDecision(ack, saved) || !retainedBatchObservations(original, saved)) throw new Error("Review acknowledgement not reconciled with the saved record");
      if (!current() || abort.signal.aborted) return;
      setBatch(saved); setNote(""); refreshRequired.current = false; setNeedsRefresh(false);
      setNotice(captured.action === "approve" ? tr("Approval acknowledged and the authoritative company record read again. The batch is Open; public availability still depends on shares and current controlled facility compliance. No sponsorship, payment or settlement was performed.", "Đã xác nhận phê duyệt và đọc lại bản ghi công ty chính thức. Lô Đang mở; hiển thị công khai vẫn phụ thuộc phần còn lại và tuân thủ cơ sở hiện hành với hồ sơ được kiểm soát. Không thực hiện bảo trợ, thanh toán hoặc quyết toán.") : tr("Rejection acknowledged and the authoritative company record read again. The batch is Draft with the saved note and reviewer/time. Submission time and recorded observations remain; company editing and optional resubmission are separate actions.", "Đã xác nhận từ chối và đọc lại bản ghi công ty chính thức. Lô là Bản nháp với ghi chú, người và thời điểm xét duyệt đã lưu. Thời điểm gửi và quan sát được giữ lại; sửa và gửi lại tùy chọn là thao tác riêng."));
    } catch (failure) {
      if (current()) { refreshRequired.current = true; setNeedsRefresh(true); setError(errorMessage(failure, language) + " " + (acknowledged ? tr("The decision was acknowledged but could not be reconciled. Use Refresh before any further decision. No replay is sent.", "Quyết định đã được xác nhận nhưng chưa đối chiếu được. Dùng Làm mới trước quyết định tiếp theo. Không gửi lại.") : tr("The decision failed or its outcome is unknown; the server may already have recorded it. Use Refresh to inspect the actual record. No automatic retry or replay is sent.", "Quyết định thất bại hoặc chưa rõ kết quả; máy chủ có thể đã ghi nhận. Dùng Làm mới để kiểm tra bản ghi thực tế. Không tự thử lại hoặc gửi lại."))); }
    } finally { locked.current = false; if (current()) setBusy(false); }
  }
  if (!sameSession()) return <main className="public-market"><h1>{tr("Batch review", "Xét duyệt lô")}</h1><p role="alert">{tr("An active Admin session is required. Private records and controls are hidden.", "Cần phiên Admin đang hoạt động. Dữ liệu riêng tư và thao tác đã được ẩn.")}</p></main>;
  const filtered = rows.filter(value => [value.id, value.title, value.species, value.createdBy?.name ?? ""].some(text => text.toLowerCase().includes(search.trim().toLowerCase())));
  const pages = Math.max(1, Math.ceil(filtered.length / 10)), selected = Math.min(page, pages);
  return <main className="public-market company-batches">
    {/* One back button instead of a row of sibling links — the site header's
       dropdowns already reach every admin tool. */}
    {batchId ? <a className="back-pill" href={batchReviewRoute()}>← {tr("Pending batch review queue", "Hàng đợi lô chờ xét duyệt")}</a> : <a className="back-pill" href="#company/batches">← {tr("Company batches", "Lô công ty")}</a>}
    <h1>{batchId ? tr("Review a saved company batch", "Xét duyệt lô công ty đã lưu") : tr("Optional batch review queue", "Hàng đợi xét duyệt lô tùy chọn")}</h1>
    <p>{tr("All Admins share batches and may review their own submissions. Review is optional; direct draft publication remains available. This screen has no withdrawal, deletion, sponsorship or financial actions.", "Mọi Admin dùng chung lô và có thể xét duyệt lô mình gửi. Xét duyệt là tùy chọn; vẫn có thể xuất bản trực tiếp bản nháp. Trang không có rút yêu cầu, xóa, bảo trợ hay thao tác tài chính.")}</p>
    <button className="sl-btn sl-btn-ghost sm" disabled={loading || busy} onClick={refresh}>{tr("Refresh server data", "Làm mới dữ liệu máy chủ")}</button>
    {loading && <p role="status">{tr("Reading private server records…", "Đang đọc bản ghi máy chủ riêng tư…")}</p>}{busy && <p role="status">{tr("Sending one decision and reconciling the saved record…", "Đang gửi một quyết định và đối chiếu bản ghi đã lưu…")}</p>}
    {error && <p role="alert" className="batch-notice">{error}</p>}{notice && <p role="status" className="batch-notice">{notice}</p>}
    {needsRefresh && <p className="batch-notice">{tr("Private records and decisions are hidden or blocked until a successful authoritative Refresh. Refresh discards local rejection text.", "Dữ liệu riêng tư và quyết định bị ẩn hoặc khóa đến khi Làm mới chính thức thành công. Làm mới bỏ ghi chú từ chối cục bộ.")}</p>}
    {!batchId && !blocked && <section className="batch-panel"><label htmlFor="batch-review-search">{tr("Search loaded code, title, species or creator", "Tìm mã, tiêu đề, loài hoặc người tạo đã tải")}</label><input id="batch-review-search" type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /><p>{tr("Server queue: pending review only, oldest submission first. Search and ten-row pagination are local, not platform totals.", "Hàng đợi máy chủ: chỉ đang xét duyệt, gửi sớm nhất trước. Tìm kiếm và phân trang mười dòng là cục bộ, không phải tổng nền tảng")} {filtered.length} {tr("matching loaded records", "bản ghi đã tải phù hợp")}</p>
      {!filtered.length ? <p>{tr("No pending batches match this loaded queue and search.", "Không có lô đang xét duyệt phù hợp hàng đợi đã tải và từ khóa.")}</p> : <div className="batch-table-wrap"><table><caption>{tr("Pending company batches", "Lô công ty đang xét duyệt")}</caption><thead><tr><th>{tr("Batch", "Lô")}</th><th>{tr("Creator attribution", "Ghi nhận người tạo")}</th><th>{tr("Submitted · UTC", "Gửi · UTC")}</th><th>{tr("Available / total shares", "Phần còn / tổng")}</th></tr></thead><tbody>{filtered.slice((selected - 1) * 10, selected * 10).map(value => <tr key={value.id}><td><a href={batchReviewRoute(value.id)}>{value.title}</a><br />{value.id} · {value.species}</td><td>{value.createdBy?.name ?? tr("Not recorded", "Chưa ghi nhận")}</td><td>{batchUtc(value.submittedAt, tr("Not recorded", "Chưa ghi nhận"))}</td><td>{value.sharesAvailable} / {value.totalShares}</td></tr>)}</tbody></table></div>}
      <nav className="public-market-pages" aria-label={tr("Local review pagination", "Phân trang xét duyệt cục bộ")}><button disabled={selected <= 1} onClick={() => setPage(value => value - 1)}>{tr("Previous", "Trước")}</button><span>{selected} / {pages}</span><button disabled={selected >= pages} onClick={() => setPage(value => value + 1)}>{tr("Next", "Sau")}</button></nav>
    </section>}
    {visible && <><section className="batch-panel"><h2>{visible.id} · {batchStatusLabel(visible.status, language)}</h2><a href={batchRoute("detail", visible.id, true)}>{tr("Open saved company detail", "Mở chi tiết công ty đã lưu")}</a><p>{tr("The backend locks and rechecks the batch transition. Approval also locks and rereads its facility and rechecks valid shares, exact costs, images and current controlled compliance. Refresh and local confirmations are not an atomic version check against another Admin.", "Máy chủ khóa và kiểm tra lại chuyển trạng thái lô. Phê duyệt còn khóa và đọc lại cơ sở, kiểm tra phần hợp lệ, chi phí khớp, ảnh và tuân thủ hiện hành với hồ sơ được kiểm soát. Làm mới và xác nhận cục bộ không phải kiểm tra phiên bản nguyên tử với Admin khác.")}</p></section><BatchDetails batch={visible} includeCompanyReview />
      <section className="batch-panel"><h2>{tr("Explicit review decision", "Quyết định xét duyệt rõ ràng")}</h2>{canReviewBatch(visible.status) ? <><p>{tr("Approve opens the saved batch and records reviewer/time, clears the review note and copies current facility inspection metadata. Rejection returns it to Draft with this trimmed note; submitted time, prior inspection fields and observations are retained. Decisions record activity; no decision notification or payment is promised.", "Phê duyệt mở lô đã lưu, ghi người/thời điểm xét duyệt, xóa ghi chú và sao chép dữ liệu kiểm tra cơ sở hiện hành. Từ chối trả về Bản nháp với ghi chú đã bỏ khoảng trắng; thời điểm gửi, dữ liệu kiểm tra trước và quan sát được giữ lại. Quyết định ghi hoạt động; không bảo đảm thông báo quyết định hoặc thanh toán.")}</p><fieldset disabled={blocked || !!confirmation}><label htmlFor="batch-review-note">{tr("Rejection note · 1–1,000 trimmed server-counted characters", "Ghi chú từ chối · 1–1.000 ký tự theo máy chủ sau khi bỏ khoảng trắng")}</label><textarea id="batch-review-note" rows={4} value={note} onChange={event => changeNote(event.target.value)} /><small>{facilityTextLength(note.trim())} / 1,000</small></fieldset><div className="batch-actions"><button disabled={blocked || !!confirmation || dirty || attempted.current} onClick={event => ask("approve", event.currentTarget)}>{tr("Review approval and opening", "Kiểm tra phê duyệt và mở lô")}</button><button disabled={blocked || !!confirmation || attempted.current} onClick={event => ask("reject", event.currentTarget)}>{tr("Review rejection to draft", "Kiểm tra từ chối về nháp")}</button></div>{dirty && <p>{tr("Unrecorded rejection note. Approval requires discarding it with Refresh first.", "Ghi chú từ chối chưa ghi nhận. Cần bỏ bằng Làm mới trước khi phê duyệt.")}</p>}</> : <p>{tr("This saved status is not pending review. No decision can be sent. Use company detail for separately supported actions.", "Trạng thái đã lưu không đang xét duyệt. Không thể gửi quyết định. Dùng chi tiết công ty cho thao tác riêng được hỗ trợ.")}</p>}</section>
    </>}
    {confirmation && currentConfirmation && <section className="batch-notice" ref={confirmRef} tabIndex={-1} role="group" aria-labelledby="batch-review-confirm-title"><h2 id="batch-review-confirm-title">{confirmation.action === "approve" ? tr("Confirm approval and opening", "Xác nhận phê duyệt và mở lô") : tr("Confirm rejection to draft", "Xác nhận từ chối về nháp")}</h2><p><strong>{confirmation.id} · {confirmation.title}</strong> · {tr("Saved status: Under review", "Trạng thái đã lưu: Đang xét duyệt")}</p>{confirmation.action === "reject" && <p className="batch-copy">{confirmation.note}</p>}<p>{tr("Send this decision exactly once for the saved code? The server rechecks eligibility. No withdrawal, deletion, sponsorship, refund or settlement occurs. An acknowledgement must be reconciled with a fresh company read before further actions; unknown outcomes require Refresh, never automatic replay.", "Gửi quyết định đúng một lần cho mã đã lưu? Máy chủ kiểm tra lại điều kiện. Không rút yêu cầu, xóa, bảo trợ, hoàn tiền hay quyết toán. Phải đối chiếu xác nhận với bản ghi công ty đọc mới trước thao tác tiếp theo; kết quả chưa rõ cần Làm mới, không tự gửi lại.")}</p><div className="batch-actions"><button disabled={blocked || !currentConfirmation} onClick={() => void decide()}>{confirmation.action === "approve" ? tr("Approve and open once", "Phê duyệt và mở một lần") : tr("Reject to draft once", "Từ chối về nháp một lần")}</button><button onClick={keep}>{tr("Keep batch unchanged", "Giữ nguyên lô")}</button></div></section>}
  </main>;
}
