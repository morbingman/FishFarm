import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/context/LanguageContext";
import { errorMessage } from "@/services/api";
import { commerceApi } from "@/services/commerceApi";
import { disputesApi } from "@/services/disputesApi";
import { disputeLabel, disputeLink, disputeStatuses, evidenceTypes, reasonsForOrder, validateEvidence } from "@/services/disputes";
import type { Dispute, DisputeReason, DisputeStatus, Order } from "@/services/contracts";
import "./PublicMarketplace.css";
import "./Commerce.css";
import "./Orders.css";

export default function Disputes({ admin, disputeId, orderId }: { admin: boolean; disputeId: string | null; orderId: string | null }) {
  const { language } = useTranslation();
  const tr = (en: string, vi: string) => language === "vi" ? vi : en;
  const date = (value: string) => new Date(value).toLocaleString(language === "vi" ? "vi-VN" : "en-US");
  const [rows, setRows] = useState<Dispute[]>([]);
  const [detail, setDetail] = useState<Dispute | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<"all" | DisputeStatus>("all");
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [reason, setReason] = useState<DisputeReason>("not_received");
  const [description, setDescription] = useState("");
  const [resolution, setResolution] = useState("");
  const [confirm, setConfirm] = useState<"create" | "review" | "resolve" | "reject" | null>(null);
  const [uploads, setUploads] = useState<{ id: string; name: string }[]>([]);
  const [uploadUncertain, setUploadUncertain] = useState(false);
  const [download, setDownload] = useState<{ url: string; name: string } | null>(null);
  const locked = useRef(false);
  const alive = useRef(true);
  const blobUrl = useRef<string | null>(null);
  const evidenceController = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; evidenceController.current?.abort(); if (blobUrl.current) URL.revokeObjectURL(blobUrl.current); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setDetail(null); setOrder(null); setRows([]); setConfirm(null);
    async function load() {
      if (orderId) {
        const current = await commerceApi.order(orderId, controller.signal);
        const history = await disputesApi.list(false, "all", controller.signal);
        if (controller.signal.aborted) return;
        setOrder(current);
        setDetail(history.find(value => value.order.id === current.id) ?? null);
      } else if (disputeId) {
        const value = await disputesApi.detail(admin, disputeId, controller.signal);
        if (!controller.signal.aborted) setDetail(value);
      } else {
        const values = await disputesApi.list(admin, status, controller.signal);
        if (!controller.signal.aborted) setRows(values);
      }
      if (!controller.signal.aborted) setNeedsRefresh(false);
    }
    void load().catch(failure => { if (!controller.signal.aborted) setError(errorMessage(failure, language)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [admin, disputeId, orderId, status, reload]);
  const reasons = order ? reasonsForOrder(order.status) : [];
  const creating = !!orderId && !!order && !detail && reasons.length > 0;
  const validCreate = creating && reasons.includes(reason) && description.trim().length >= 15 && description.trim().length <= 2000;
  const mutable = detail && ["open", "reviewing"].includes(detail.status);
  async function act() {
    if (!confirm || locked.current || needsRefresh || uploadUncertain) return;
    if (confirm === "create" && !validCreate) return;
    if (confirm !== "create" && (!admin || !mutable || (confirm === "review" && detail?.status !== "open") || (confirm !== "review" && !resolution.trim()))) return;
    locked.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const updated = confirm === "create" && order
        ? await disputesApi.create(order.id, { reason, description, uploadIds: uploads.map(value => value.id) })
        : confirm === "review" && detail ? await disputesApi.review(detail.id)
        : await disputesApi.finish(detail!.id, confirm as "resolve" | "reject", resolution);
      if (updated.order.id !== (order?.id ?? detail?.order.id) || updated.buyer.id !== (order?.buyer.id ?? detail?.buyer.id)
        || (confirm === "create" && updated.attachments.length !== uploads.length)) throw new Error("Unexpected dispute response");
      if (!alive.current) return;
      setDetail(updated); setConfirm(null); setResolution(""); setUploads([]);
      setNotice(tr("The server returned the dispute shown below.", "Máy chủ đã trả về khiếu nại bên dưới."));
    } catch (failure) {
      if (!alive.current) return;
      setConfirm(null); setNeedsRefresh(true);
      setError(errorMessage(failure, language) + " " + tr("Refresh before trying again. This action may already have completed; submissions and review decisions are not automatically replayed.", "Làm mới trước khi thử lại. Thao tác có thể đã hoàn tất; không tự động gửi lại khiếu nại hoặc quyết định."));
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  async function upload(file: File) {
    if (locked.current || needsRefresh || uploadUncertain || !creating) return;
    try { validateEvidence([file], uploads.length); }
    catch { setError(tr("Use at most three JPEG, PNG, WebP, GIF or PDF files, up to 10 MiB each.", "Tối đa ba tệp JPEG, PNG, WebP, GIF hoặc PDF, mỗi tệp tối đa 10 MiB.")); return; }
    locked.current = true; setBusy(true); setError("");
    try {
      const result = await disputesApi.upload(file);
      if (!result.isPrivate || result.purpose !== "dispute_attachment" || uploads.some(value => value.id === result.id)) throw new Error("Unexpected evidence response");
      if (alive.current) setUploads(values => [...values, { id: result.id, name: file.name }]);
    } catch (failure) {
      if (alive.current) { setUploadUncertain(true); setError(errorMessage(failure, language) + " " + tr("The upload was not confirmed. No automatic retry was sent. A file may remain on the server without a linked dispute.", "Chưa xác nhận tải tệp. Không tự động thử lại. Máy chủ có thể còn tệp chưa liên kết khiếu nại.")); }
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  async function fetchEvidence(id: string) {
    if (!detail || locked.current) return;
    locked.current = true; setBusy(true); setError("");
    const controller = new AbortController(); evidenceController.current = controller;
    try {
      const blob = await disputesApi.evidence(admin, detail.id, id, controller.signal);
      if (!alive.current) return;
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
      blobUrl.current = URL.createObjectURL(blob);
      const extension = blob.type === "application/pdf" ? "pdf" : blob.type === "image/jpeg" ? "jpg" : ["image/png", "image/webp", "image/gif"].includes(blob.type) ? blob.type.split("/")[1] : "bin";
      setDownload({ url: blobUrl.current, name: `evidence-${id}.${extension}` });
    } catch (failure) { if (alive.current) setError(errorMessage(failure, language)); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  return <main className="public-market commerce orders">
    <a href={orderId ? `#marketplace/orders/${encodeURIComponent(orderId)}` : disputeId ? disputeLink(admin) : admin ? "#company/orders" : "#marketplace/orders"}>← {tr("Back", "Quay lại")}</a>
    <h1>{admin ? tr("Company dispute review", "Xét duyệt khiếu nại công ty") : orderId ? tr("Report an order issue", "Báo cáo vấn đề đơn hàng") : tr("Your disputes", "Khiếu nại của bạn")}</h1>
    <p>{tr("One dispute per order. Decisions are recorded by the company; resolving a dispute does not automatically refund, replace or complete the order.", "Mỗi đơn chỉ có một khiếu nại. Công ty ghi nhận quyết định; giải quyết khiếu nại không tự động hoàn tiền, thay cá hoặc hoàn tất đơn.")}</p>
    <div className="commerce-actions">
      {admin && !disputeId && <label>{tr("Dispute status", "Trạng thái khiếu nại")}<select value={status} disabled={busy} onChange={event => setStatus(event.target.value as "all" | DisputeStatus)}><option value="all">{tr("All", "Tất cả")}</option>{disputeStatuses.map(value => <option key={value} value={value}>{disputeLabel(value, language)}</option>)}</select></label>}
      <button disabled={loading || busy} onClick={() => { setNotice(""); setReload(value => value + 1); }}>{tr("Refresh", "Làm mới")}</button>
    </div>
    {error && <p role="alert" className="commerce-alert">{error}</p>}{notice && <p role="status" className="commerce-alert">{notice}</p>}
    {needsRefresh && <p>{tr("Actions are disabled until Refresh reconciles the server record.", "Thao tác bị khóa đến khi làm mới bản ghi máy chủ.")}</p>}
    {loading && <p role="status">{tr("Loading…", "Đang tải…")}</p>}
    {!loading && !error && !orderId && !disputeId && !rows.length && <p>{tr("No disputes found.", "Không tìm thấy khiếu nại.")}</p>}
    {!loading && rows.map(value => <article key={value.id} className="commerce-panel"><h2><a href={disputeLink(admin, value.id)}>{value.order.id}</a></h2><p>{disputeLabel(value.reason, language)} · {disputeLabel(value.status, language)} · {date(value.createdAt)}</p>{admin && <p>{value.buyer.name} · {value.buyer.email}</p>}<p>{value.description}</p><a href={disputeLink(admin, value.id)}>{tr("View dispute", "Xem khiếu nại")}</a></article>)}
    {!loading && detail && <section className="commerce-panel"><h2>{detail.order.id} · {disputeLabel(detail.status, language)}</h2>
      <a href={`#${admin ? "company" : "marketplace"}/orders/${encodeURIComponent(detail.order.id)}`}>{tr("View current order", "Xem đơn hiện tại")}</a>
      {admin && <p>{detail.buyer.name} · {detail.buyer.email}</p>}<p>{disputeLabel(detail.reason, language)}</p><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{detail.description}</p><p>{tr("Opened", "Mở lúc")}: {date(detail.createdAt)}</p>
      {detail.resolution && <><h3>{tr("Company decision", "Quyết định công ty")}</h3><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{detail.resolution}</p></>}{detail.resolvedAt && <p>{tr("Finalized", "Kết thúc lúc")}: {date(detail.resolvedAt)}</p>}
      <h3>{tr("Private evidence", "Bằng chứng riêng tư")}</h3>
      {!detail.attachments.length && <p>{tr("No evidence attached.", "Không có tệp đính kèm.")}</p>}
      {detail.attachments.map((attachment, index) => <p key={attachment.id}>{tr("Attachment", "Tệp")} {index + 1} · {attachment.mimeType ?? tr("Type unavailable", "Chưa có loại tệp")} · {attachment.sizeBytes ?? "?"} bytes <button disabled={busy} onClick={() => void fetchEvidence(attachment.id)}>{tr("Fetch securely", "Tải an toàn")} {index + 1}</button></p>)}
      {download && <a href={download.url} download={download.name}>{tr("Download fetched evidence", "Lưu bằng chứng đã tải")}</a>}
      <p>{tr("Evidence is fetched with your authenticated session, never from a public upload URL. Downloads are not rendered inline.", "Bằng chứng được tải qua phiên xác thực, không dùng URL tải công khai. Không hiển thị nội dung tệp trực tiếp.")}</p>
      {admin && mutable && <><h3>{tr("Review actions", "Thao tác xét duyệt")}</h3><label>{tr("Decision explanation · required for resolve or reject", "Giải thích quyết định · bắt buộc khi giải quyết hoặc từ chối")}<textarea maxLength={2000} disabled={busy || needsRefresh || !!confirm} value={resolution} onChange={event => setResolution(event.target.value)} /></label><div className="commerce-actions">{detail.status === "open" && <button disabled={busy || needsRefresh} onClick={() => setConfirm("review")}>{tr("Start review", "Bắt đầu xét duyệt")}</button>}<button disabled={busy || needsRefresh || !resolution.trim()} onClick={() => setConfirm("resolve")}>{tr("Resolve dispute", "Giải quyết khiếu nại")}</button><button disabled={busy || needsRefresh || !resolution.trim()} onClick={() => setConfirm("reject")}>{tr("Reject dispute", "Từ chối khiếu nại")}</button></div></>}
    </section>}
    {!loading && order && !detail && !reasons.length && <p>{tr("This order is not eligible for a dispute. Reports are accepted after shipment; shipped orders only allow 'not received'.", "Đơn chưa đủ điều kiện khiếu nại. Chấp nhận sau vận chuyển; đơn đang giao chỉ cho phép 'chưa nhận'.")}</p>}
    {!loading && creating && <section className="commerce-panel"><h2>{order!.id}</h2><fieldset className="commerce-fields" disabled={busy || needsRefresh || !!confirm || uploadUncertain}>
      <label>{tr("Issue", "Vấn đề")}<select value={reason} onChange={event => setReason(event.target.value as DisputeReason)}>{reasons.map(value => <option key={value} value={value}>{disputeLabel(value, language)}</option>)}</select></label>
      <label>{tr("Describe the problem · 15–2000 characters", "Mô tả vấn đề · 15–2000 ký tự")}<textarea minLength={15} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} /></label>
      <label>{tr("Add private evidence · optional, up to three files", "Thêm bằng chứng riêng tư · tùy chọn, tối đa ba tệp")}<input type="file" accept={evidenceTypes.join(",")} disabled={uploads.length >= 3} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} /></label>
    </fieldset><p>{tr("JPEG, PNG, WebP, GIF or PDF, up to 10 MiB per file. Uploaded evidence is linked only when submission succeeds. Leaving or reloading before submission loses these local references; unused uploads have no cleanup endpoint.", "JPEG, PNG, WebP, GIF hoặc PDF, tối đa 10 MiB mỗi tệp. Chỉ liên kết khi gửi thành công. Rời trang hoặc tải lại trước khi gửi sẽ mất tham chiếu cục bộ; chưa có API dọn tệp chưa dùng.")}</p>
      {uploads.map(value => <p key={value.id}>{tr("Upload confirmed", "Đã xác nhận tải")}: {value.name}</p>)}
      {uploadUncertain && <button disabled={busy} onClick={() => { setUploadUncertain(false); setError(""); }}>{tr("Continue without retrying the unconfirmed file", "Tiếp tục, không tải lại tệp chưa xác nhận")}</button>}
      <button disabled={busy || needsRefresh || uploadUncertain || !validCreate} onClick={() => setConfirm("create")}>{tr("Submit dispute", "Gửi khiếu nại")}</button>
    </section>}
    {confirm && <section className="commerce-alert" role="group" aria-label={tr("Confirm dispute action", "Xác nhận thao tác khiếu nại")}><p>{confirm === "create" ? tr("Submit this report and link the confirmed evidence? An order can have only one dispute, and it cannot be edited or withdrawn here.", "Gửi báo cáo và liên kết bằng chứng đã xác nhận? Mỗi đơn chỉ một khiếu nại, không thể sửa hoặc rút tại đây.") : confirm === "review" ? tr("Mark this dispute as being reviewed?", "Đánh dấu khiếu nại đang xét duyệt?") : tr("Record this final decision? It cannot be changed here and will not automatically refund or complete the order.", "Ghi nhận quyết định cuối cùng? Không thể sửa tại đây, không tự động hoàn tiền hoặc hoàn tất đơn.")}</p>{(confirm === "resolve" || confirm === "reject") && <p style={{ whiteSpace: "pre-wrap" }}>{resolution}</p>}<button disabled={busy || needsRefresh || uploadUncertain} onClick={() => void act()}>{busy ? tr("Submitting…", "Đang gửi…") : tr("Confirm action", "Xác nhận thao tác")}</button><button disabled={busy} onClick={() => setConfirm(null)}>{tr("Keep unchanged", "Giữ nguyên")}</button></section>}
  </main>;
}
