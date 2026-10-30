import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/context/LanguageContext";
import { apiSessionStamp, errorMessage, isApiSession } from "@/services/api";
import { currentUser, useUser } from "@/services/session";
import { sponsorshipsApi } from "@/services/sponsorshipsApi";
import { disputesApi } from "@/services/disputesApi";
import { disputeLabel, disputeReasons, evidenceTypes, sponsorshipDisputeEligible, validateEvidence } from "@/services/disputes";
import type { Dispute, DisputeReason } from "@/services/contracts";
import { batchRoute } from "@/services/batches";
import { canCancelSponsorship, canConfirmDelivery, canPaySponsorship, deliveryFeeOutstanding, normalizeSponsorshipReason, reservationPayDeadline, retainedSponsorshipTerms, sponsorshipRoute, sponsorshipStatusLabel, parseSponsorshipRoute } from "@/services/sponsorships";
import { paymentMethods, type PaymentMethod, type Sponsorship, type SponsorshipStatus } from "@/services/sponsorshipContracts";
import { useHashTransitionGuard } from "@/services/hashNavigation";
import { batchUtc } from "@/components/batches/BatchDetails";
import "./PublicMarketplace.css";
import "./Orders.css";

type Confirmation = { action: "pay" | "cancel" | "deliver" | "fee"; id: string; record: string; reason: string; method: PaymentMethod | null; sequence: number; revision: number; hash: string };
const money = (value: number, vi: boolean) => `${value.toLocaleString(vi ? "vi-VN" : "en-US")} ₫`;
const fundedAck = (status: SponsorshipStatus) => status === "funded" || status === "growing";

export default function Sponsorships({ sponsorshipId }: { sponsorshipId: string | null }) {
  const { language } = useTranslation();
  const user = useUser();
  const tr = (en: string, vi: string) => language === "vi" ? vi : en;
  const vi = language === "vi";
  const [stamp] = useState(apiSessionStamp);
  const [rows, setRows] = useState<Sponsorship[]>([]);
  const [record, setRecord] = useState<Sponsorship | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("e_wallet");
  const [reason, setReason] = useState("");
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [disputeReason, setDisputeReason] = useState<DisputeReason>("fish_unwell");
  const [disputeText, setDisputeText] = useState("");
  const [disputeUploads, setDisputeUploads] = useState<{ id: string; name: string }[]>([]);
  const [disputeConfirm, setDisputeConfirm] = useState(false);
  const alive = useRef(true), locked = useRef(false), reading = useRef(true), refreshRequired = useRef(false), sequence = useRef(0), revision = useRef(0), attempted = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const confirmRef = useRef<HTMLElement | null>(null);
  const sameSession = () => isApiSession(stamp) && stamp?.role === "User" && user?.role === "Buyer" && user.status === "active" && currentUser()?.email === user.email && currentUser()?.role === "Buyer" && currentUser()?.status === "active";
  const blocked = loading || busy || needsRefresh || !sameSession();
  const dirty = reason.trim() !== "" || disputeText.trim() !== "";
  const invalidate = () => { ++revision.current; setConfirmation(null); setDisputeConfirm(false); };
  const currentConfirmation = !!confirmation && !!record && record.id === sponsorshipId && !attempted.current
    && confirmation.id === record.id && confirmation.record === JSON.stringify(record)
    && confirmation.reason === reason && confirmation.sequence === sequence.current && confirmation.revision === revision.current && confirmation.hash === window.location.hash;
  useHashTransitionGuard(() => { invalidate(); return !sameSession() || (!locked.current && (!dirty || window.confirm(tr("Leave without recording this reason text?", "Rời trang mà không ghi nhận lý do?")))); });
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
    reading.current = true; invalidate(); setRows([]); setRecord(null); setDispute(null); setDisputeText(""); setDisputeUploads([]); setLoading(true); setError("");
    if (!sameSession()) { reading.current = false; setLoading(false); return () => abort.abort(); }
    const request = sponsorshipId ? Promise.all([
      sponsorshipsApi.detail(sponsorshipId, abort.signal),
      disputesApi.list(false, "all", abort.signal),
    ]).then(([value, existing]) => {
      if (value.id !== sponsorshipId) throw new Error("Unexpected sponsorship identity");
      if (current()) {
        setRecord(value);
        setDispute(existing.find(row => row.kind === "sponsorship" && row.sponsorship?.id === value.id) ?? null);
      }
    })
      : sponsorshipsApi.mine(abort.signal).then(page => { if (current()) setRows(page.items); });
    void request.then(() => { if (current()) { refreshRequired.current = false; attempted.current = false; setNeedsRefresh(false); } })
      .catch(failure => { if (current()) { refreshRequired.current = true; setNeedsRefresh(true); setError(errorMessage(failure, language)); } })
      .finally(() => { if (current()) { reading.current = false; setLoading(false); } });
    return () => abort.abort();
  }, [sponsorshipId, reload, stamp]);
  function refresh() {
    if (!sameSession() || locked.current || reading.current) return;
    if (dirty && !window.confirm(tr("Discard the local reason text and read the authoritative server record?", "Bỏ lý do cục bộ và đọc bản ghi máy chủ chính thức?"))) return;
    invalidate(); reading.current = true; ++sequence.current; controller.current?.abort(); setReason(""); setDisputeText(""); setDisputeUploads([]); setNotice(""); setLoading(true); setReload(value => value + 1);
  }
  function changeReason(value: string) {
    if (!sameSession() || locked.current || reading.current || refreshRequired.current || blocked) return;
    invalidate(); setReason(value); setError("");
  }
  function ask(action: "pay" | "cancel" | "deliver" | "fee") {
    if (!sameSession() || blocked || locked.current || reading.current || refreshRequired.current || attempted.current || confirmation || disputeConfirm || !record || record.id !== sponsorshipId) return;
    if (action === "pay" && !canPaySponsorship(record.status)) return;
    if (action === "deliver" && !canConfirmDelivery(record.status)) return;
    if (action === "fee" && !deliveryFeeOutstanding(record)) return;
    if (action === "cancel") {
      if (!canCancelSponsorship(record.status)) return;
      try { normalizeSponsorshipReason(reason); } catch { setError(tr("Enter a cancellation reason of 1–500 characters after trimming.", "Nhập lý do hủy gồm 1–500 ký tự sau khi bỏ khoảng trắng.")); return; }
    }
    setError(""); setConfirmation({ action, id: record.id, record: JSON.stringify(record), reason, method: action === "pay" || action === "fee" ? method : null, sequence: sequence.current, revision: revision.current, hash: window.location.hash });
    requestAnimationFrame(() => confirmRef.current?.focus());
  }
  function keep() { if (!locked.current) { invalidate(); } }
  function askDispute() {
    if (!sameSession() || blocked || locked.current || reading.current || refreshRequired.current || attempted.current || confirmation || disputeConfirm || !record || record.id !== sponsorshipId || dispute) return;
    if (!sponsorshipDisputeEligible(record.status)) return;
    const description = disputeText.trim();
    if (description.length < 15 || description.length > 2000) { setError(tr("Describe the dispute in 15–2000 characters after trimming.", "Mô tả khiếu nại gồm 15–2000 ký tự sau khi bỏ khoảng trắng.")); return; }
    setError(""); setDisputeConfirm(true);
    requestAnimationFrame(() => confirmRef.current?.focus());
  }
  function keepDispute() { if (!locked.current) setDisputeConfirm(false); }
  async function uploadDisputeEvidence(file: File) {
    if (blocked || locked.current || reading.current || disputeUploads.length >= 3 || dispute || disputeConfirm) return;
    try { validateEvidence([file], disputeUploads.length); }
    catch { setError(tr("Use at most three JPEG, PNG, WebP, GIF or PDF files, up to 10 MiB each.", "Tối đa ba tệp JPEG, PNG, WebP, GIF hoặc PDF, mỗi tệp tối đa 10 MiB.")); return; }
    locked.current = true; setBusy(true); setError("");
    try {
      const result = await disputesApi.upload(file);
      if (!result.isPrivate || result.purpose !== "dispute_attachment" || disputeUploads.some(value => value.id === result.id)) throw new Error("Unexpected evidence response");
      if (alive.current) setDisputeUploads(values => [...values, { id: result.id, name: file.name }]);
    } catch (failure) {
      if (alive.current) setError(errorMessage(failure, language) + " " + tr("The upload was not confirmed. No automatic retry was sent. A file may remain on the server without a linked dispute.", "Chưa xác nhận tải tệp. Không tự động thử lại. Máy chủ có thể còn tệp chưa liên kết khiếu nại."));
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  async function submitDispute() {
    if (!sameSession() || blocked || locked.current || reading.current || refreshRequired.current || !record || !disputeConfirm || attempted.current || dispute) return;
    locked.current = true; attempted.current = true;
    setBusy(true); setError(""); setNotice("");
    try {
      const ack = await disputesApi.createSponsorship(record.id, { reason: disputeReason, description: disputeText, uploadIds: disputeUploads.map(value => value.id) });
      if (ack.kind !== "sponsorship" || ack.sponsorship?.id !== record.id || ack.status !== "open") throw new Error("Unexpected dispute acknowledgement");
      if (!alive.current) return;
      setDisputeConfirm(false); setDispute(ack); setDisputeText(""); setDisputeUploads([]);
      setNotice(tr("Dispute filed exactly once. The company reviews it in its own queue; the decision appears here and in your notifications.", "Đã gửi khiếu nại đúng một lần. Công ty xét duyệt trong hàng đợi riêng; quyết định hiển thị tại đây và trong thông báo của bạn."));
    } catch (failure) {
      if (alive.current) { setDisputeConfirm(false); setNeedsRefresh(true); setError(errorMessage(failure, language) + " " + tr("The filing failed or its outcome is unknown; the server may already have recorded it. Use Refresh to inspect the actual record. No automatic retry is sent.", "Gửi khiếu nại thất bại hoặc chưa rõ kết quả; máy chủ có thể đã ghi nhận. Dùng Làm mới để kiểm tra bản ghi thực tế. Không tự gửi lại.")); }
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  async function decide() {
    if (!sameSession() || locked.current || reading.current || refreshRequired.current || blocked || !currentConfirmation || !confirmation || !record) return;
    const captured = confirmation, original = record;
    if (captured.revision !== revision.current || captured.sequence !== sequence.current || captured.hash !== window.location.hash || captured.reason !== reason || attempted.current) return;
    locked.current = true; attempted.current = true; const write = ++sequence.current;
    const current = () => alive.current && sameSession() && write === sequence.current;
    controller.current?.abort(); invalidate(); setBusy(true); setError(""); setNotice("");
    let acknowledged = false;
    try {
      const ack = captured.action === "pay" ? await sponsorshipsApi.pay(captured.id, captured.method as PaymentMethod)
        : captured.action === "deliver" ? await sponsorshipsApi.confirmDelivery(captured.id)
        : captured.action === "fee" ? await sponsorshipsApi.payDeliveryFee(captured.id, captured.method as PaymentMethod)
        : await sponsorshipsApi.cancel(captured.id, captured.reason);
      if (captured.action === "pay" ? (ack.id !== captured.id || !fundedAck(ack.status) || ack.paidAt === null)
        : captured.action === "deliver" ? (ack.id !== captured.id || ack.deliveredAt === null || (ack.status !== "delivered" && ack.status !== "settled"))
        : captured.action === "fee" ? (ack.id !== captured.id || ack.status !== "ready_for_delivery" || !ack.payments.some(row => row.purpose === "delivery_fee" && row.state === "paid"))
        : (ack.id !== captured.id || ack.cancelledAt === null || (ack.status !== "cancelled" && ack.status !== "refunded"))) throw new Error("Unexpected sponsorship acknowledgement");
      if (!retainedSponsorshipTerms(original, ack)) throw new Error("Sponsorship terms were not retained");
      acknowledged = true;
      if (!current()) return;
      refreshRequired.current = true; setNeedsRefresh(true);
      const abort = new AbortController(); controller.current = abort;
      const saved = await sponsorshipsApi.detail(captured.id, abort.signal);
      if (saved.id !== captured.id || !retainedSponsorshipTerms(original, saved)) throw new Error("Sponsorship not reconciled with the saved record");
      if (captured.action === "pay" && (!fundedAck(saved.status) || saved.paidAt === null)) throw new Error("Payment not reconciled");
      if (captured.action === "deliver" && (saved.deliveredAt === null || (saved.status !== "delivered" && saved.status !== "settled"))) throw new Error("Delivery not reconciled");
      if (captured.action === "fee" && (saved.status !== "ready_for_delivery" || !saved.payments.some(row => row.purpose === "delivery_fee" && row.state === "paid"))) throw new Error("Delivery fee not reconciled");
      if (captured.action === "cancel" && (saved.cancelledAt === null || (saved.status !== "cancelled" && saved.status !== "refunded"))) throw new Error("Cancellation not reconciled");
      if (!current() || abort.signal.aborted) return;
      setRecord(saved); setReason(""); refreshRequired.current = false; setNeedsRefresh(false);
      setNotice(captured.action === "pay"
        ? tr("Payment acknowledged and the authoritative record read again. The full package sits in milestone escrow; no delivery or settlement is promised yet.", "Đã xác nhận thanh toán và đọc lại bản ghi chính thức. Toàn bộ gói nằm trong quỹ theo cột mốc; chưa bảo đảm giao hàng hoặc tất toán.")
        : captured.action === "deliver"
        ? tr("Delivery confirmed and the authoritative record read again. The batch settles only when every sponsorship is delivered or refunded.", "Đã xác nhận giao hàng và đọc lại bản ghi chính thức. Lô chỉ tất toán khi mọi bảo trợ đã giao hoặc hoàn tiền.")
        : captured.action === "fee"
        ? tr("Delivery fee acknowledged and the authoritative record read again. You can now confirm delivery of the saved record.", "Đã xác nhận phí giao hàng và đọc lại bản ghi chính thức. Bạn có thể xác nhận nhận hàng cho bản ghi đã lưu.")
        : tr("Cancellation acknowledged and the authoritative record read again. Funded sponsorships were refunded in full; unpaid reservations simply released their shares.", "Đã xác nhận hủy và đọc lại bản ghi chính thức. Bảo trợ đã thanh toán được hoàn tiền toàn phần; đơn giữ chưa trả chỉ trả lại số phần."));
    } catch (failure) {
      if (current()) { refreshRequired.current = true; setNeedsRefresh(true); setError(errorMessage(failure, language) + " " + (acknowledged ? tr("The action was acknowledged but could not be reconciled. Use Refresh before any further action. No replay is sent.", "Thao tác đã được xác nhận nhưng chưa đối chiếu được. Dùng Làm mới trước thao tác tiếp theo. Không gửi lại.") : tr("The action failed or its outcome is unknown; the server may already have recorded it. Use Refresh to inspect the actual record. No automatic retry or replay is sent.", "Thao tác thất bại hoặc chưa rõ kết quả; máy chủ có thể đã ghi nhận. Dùng Làm mới để kiểm tra bản ghi thực tế. Không tự thử lại hoặc gửi lại."))); }
    } finally { locked.current = false; if (current()) setBusy(false); }
  }
  if (!sameSession()) return <main className="public-market"><h1>{tr("My sponsorships", "Bảo trợ của tôi")}</h1><p role="alert">{tr("An active User session is required. Sponsorship records are private.", "Cần phiên User đang hoạt động. Bản ghi bảo trợ là riêng tư.")}</p></main>;
  return <main className="public-market">
    <nav className="batch-actions" aria-label={tr("Sponsorship navigation", "Điều hướng bảo trợ")}><a href={sponsorshipRoute()}>{tr("My sponsorships", "Bảo trợ của tôi")}</a><a href="#farming">{tr("Open batches", "Lô đang mở")}</a><a href="#marketplace/orders">{tr("My orders", "Đơn hàng của tôi")}</a></nav>
    <h1>{sponsorshipId ? tr("Sponsorship detail", "Chi tiết bảo trợ") : tr("My sponsorships", "Bảo trợ của tôi")}</h1>
    <p>{tr("Sponsoring pays the full cost of care up front for a share of the harvest in kind — not an investment and not a cash return. Payments are held in milestone escrow and disclosed risk applies. Unpaid reservations expire 24 hours after reservation and their shares return to the pool.", "Bảo trợ trả trước toàn bộ chi phí chăm sóc để nhận một phần cá khi thu hoạch theo hiện vật — không phải đầu tư hay hoàn tiền bằng tiền. Khoản trả được giữ trong quỹ theo cột mốc và có rủi ro đã công bố. Đơn giữ chưa trả hết hạn sau 24 giờ và số phần được trả lại còn dự trữ.")}</p>
    <button disabled={loading || busy} onClick={refresh}>{tr("Refresh server data", "Làm mới dữ liệu máy chủ")}</button>
    {loading && <p role="status">{tr("Reading private server records…", "Đang đọc bản ghi máy chủ riêng tư…")}</p>}{busy && <p role="status">{tr("Sending one action and reconciling the saved record…", "Đang gửi một thao tác và đối chiếu bản ghi đã lưu…")}</p>}
    {error && <p role="alert" className="batch-notice">{error}</p>}{notice && <p role="status" className="batch-notice">{notice}</p>}
    {needsRefresh && <p className="batch-notice">{tr("Private records and actions are hidden or blocked until a successful authoritative Refresh. Refresh discards local cancellation text.", "Bản ghi riêng tư và thao tác bị ẩn hoặc khóa đến khi Làm mới chính thức thành công. Làm mới bỏ lý do hủy cục bộ.")}</p>}
    {!sponsorshipId && !blocked && <div className="batch-table-wrap"><table><caption>{tr("My reservations and sponsorships", "Đơn giữ chỗ và bảo trợ của tôi")}</caption><thead><tr><th>{tr("Batch", "Lô")}</th><th>{tr("Shares", "Số phần")}</th><th>{tr("Total", "Tổng")}</th><th>{tr("Status", "Trạng thái")}</th><th>{tr("Created · UTC", "Tạo · UTC")}</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id}><td><a href={sponsorshipRoute(row.id)}>{row.batch.title}</a><br />{row.batch.code} · {row.batch.species}</td><td>{row.shares}</td><td>{money(row.totalAmount, vi)}</td><td>{sponsorshipStatusLabel(row.status, vi)}{reservationPayDeadline(row) && <><br /><span>{tr("Pay by", "Trả trước")}: {batchUtc(reservationPayDeadline(row)!, "—")}</span></>}</td><td>{batchUtc(row.createdAt, "—")}</td></tr>) : <tr><td colSpan={5}>{tr("No sponsorships recorded on this account.", "Tài khoản này chưa có bảo trợ nào.")}</td></tr>}</tbody></table></div>}
    {sponsorshipId && record && <div>
      <section className="batch-panel"><h2>{record.batch.code} · {sponsorshipStatusLabel(record.status, vi)}</h2><a href={batchRoute("detail", record.batch.code, false)}>{tr("Open public batch detail", "Mở chi tiết lô công khai")}</a><p>{record.shares} × {record.batch.shareUnit} · {money(record.packageAmount, vi)}{record.deliveryFee ? ` + ${money(record.deliveryFee, vi)} ${tr("delivery", "giao hàng")}` : ""}</p><p>{record.batch.title} · {record.batch.species} · {record.batch.location}</p>{record.batch.images[0] && <img src={record.batch.images[0].url} alt={record.batch.title} className="batch-cover" />}<p>{tr("Delivery", "Giao hàng")}: {record.recipientName}, {record.phone}, {record.address}{record.city ? `, ${record.city}` : ""}{record.province ? `, ${record.province}` : ""}{record.deliveryMethod ? ` · ${record.deliveryMethod}` : ""}</p><p>{tr("Reserved", "Đặt lúc")}: {batchUtc(record.createdAt, "—")}{reservationPayDeadline(record) ? ` · ${tr("Pay by", "Trả trước")}: ${batchUtc(reservationPayDeadline(record)!, "—")}` : ""}{record.paidAt ? ` · ${tr("Paid", "Trả lúc")}: ${batchUtc(record.paidAt, "—")}` : ""}{record.cancelledAt ? ` · ${tr("Cancelled", "Hủy lúc")}: ${batchUtc(record.cancelledAt, "—")}` : ""}</p></section>
      <section className="batch-panel"><h2>{tr("Terms snapshot", "Bản ghi điều khoản đã khóa")}</h2><p>{tr("termsVersion", "phiên bản điều khoản")}: {String(record.termsSnapshot.termsVersion ?? "—")} · {tr("contingency", "dự phòng")}: {String(record.termsSnapshot.contingencyPct ?? "—")}%</p><p className="batch-copy">{String(record.termsSnapshot.riskDisclosure ?? "")}</p></section>
      {!!record.escrowReleases.length && <section className="batch-panel"><h2>{tr("Escrow tranches", "Các kỳ giải ngân")}</h2><table><thead><tr><th>{tr("Milestone", "Cột mốc")}</th><th>{tr("Amount", "Số tiền")}</th><th>{tr("State", "Trạng thái")}</th></tr></thead><tbody>{record.escrowReleases.map(tranche => <tr key={tranche.id}><td>{tranche.milestone}</td><td>{money(tranche.amount, vi)}</td><td>{tranche.state}</td></tr>)}</tbody></table><p>{tr("The company is paid in milestone tranches, never a lump sum.", "Công ty được trả theo từng cột mốc, không bao giờ nhận một lần.")}</p></section>}
      {!!record.adjustments.length && <section className="batch-panel"><h2>{tr("Refunds and adjustments", "Hoàn tiền và điều chỉnh")}</h2><table><thead><tr><th>{tr("Kind", "Loại")}</th><th>{tr("Amount", "Số tiền")}</th><th>{tr("Reason", "Lý do")}</th><th>{tr("Applied · UTC", "Áp dụng · UTC")}</th></tr></thead><tbody>{record.adjustments.map(row => <tr key={row.id}><td>{row.kind}</td><td>{money(row.amount, vi)}</td><td>{row.reason}</td><td>{batchUtc(row.appliedAt, "—")}</td></tr>)}</tbody></table></section>}
      {canPaySponsorship(record.status) && !blocked && <section className="batch-panel"><h2>{tr("Pay the full package", "Thanh toán trọn gói")}</h2><p>{money(record.packageAmount, vi)} · {tr("one simulated payment, idempotent; escrow tranches are created", "một lần thanh toán mô phỏng, an toàn khi gửi lại; các kỳ giải ngân được tạo")}</p><p>{tr("This reservation expires 24 hours after reservation; after that the server cancels it, the shares return to the pool and payment is refused with an expiry conflict.", "Đơn giữ này hết hạn 24 giờ sau khi đặt; sau đó máy chủ hủy đơn, số phần được trả lại còn dự trữ và thanh toán bị từ chối.")}</p><fieldset disabled={!!confirmation}><label htmlFor="sponsorship-method">{tr("Payment method", "Phương thức")}</label><select id="sponsorship-method" value={method} onChange={event => { invalidate(); setMethod(event.target.value as PaymentMethod); }}>{paymentMethods.map(value => <option key={value} value={value}>{value}</option>)}</select></fieldset><div className="batch-actions"><button disabled={blocked || !!confirmation || attempted.current} onClick={() => ask("pay")}>{tr("Review full package payment", "Kiểm tra thanh toán trọn gói")}</button></div></section>}
      {canConfirmDelivery(record.status) && deliveryFeeOutstanding(record) && !blocked && <section className="batch-panel"><h2>{tr("Pay the delivery fee", "Thanh toán phí giao hàng")}</h2><p>{money(record.deliveryFee, vi)} · {tr("charged per share at harvest, outside the milestone escrow; it must be paid before delivery can be confirmed. The payment is idempotent.", "thu theo từng phần khi thu hoạch, ngoài quỹ theo cột mốc; phải trả trước khi xác nhận nhận hàng. Thanh toán an toàn khi gửi lại.")}</p><fieldset disabled={!!confirmation}><label htmlFor="sponsorship-fee-method">{tr("Payment method", "Phương thức")}</label><select id="sponsorship-fee-method" value={method} onChange={event => { invalidate(); setMethod(event.target.value as PaymentMethod); }}>{paymentMethods.map(value => <option key={value} value={value}>{value}</option>)}</select></fieldset><div className="batch-actions"><button disabled={blocked || !!confirmation || attempted.current} onClick={() => ask("fee")}>{tr("Review delivery fee payment", "Kiểm tra thanh toán phí giao hàng")}</button></div></section>}
      {canConfirmDelivery(record.status) && !blocked && <section className="batch-panel"><h2>{tr("Confirm delivery", "Xác nhận đã nhận hàng")}</h2><p>{tr("The harvest was published and your shares are ready. Confirming marks this sponsorship delivered; the batch settles only when every sponsorship is delivered or refunded.", "Thu hoạch đã được công bố và các phần của bạn sẵn sàng. Xác nhận sẽ đánh dấu bảo trợ này là đã giao; lô chỉ tất toán khi mọi bảo trợ đã giao hoặc hoàn tiền.")}</p>{deliveryFeeOutstanding(record) && <p>{tr("The {fee} delivery fee must be paid first; delivery confirmation stays blocked until then.", "Cần trả phí giao hàng {fee} trước; xác nhận nhận hàng bị khóa đến khi đó.").replace("{fee}", money(record.deliveryFee, vi))}</p>}<div className="batch-actions"><button disabled={blocked || !!confirmation || attempted.current || deliveryFeeOutstanding(record)} onClick={() => ask("deliver")}>{tr("Review delivery confirmation", "Kiểm tra xác nhận giao hàng")}</button></div></section>}
      {canCancelSponsorship(record.status) && !blocked && <section className="batch-panel"><h2>{canCancelSponsorship(record.status) && record.status === "funded" ? tr("Cancel funded sponsorship (full refund of unreleased escrow)", "Hủy bảo trợ đã thanh toán (hoàn toàn phần quỹ chưa giải ngân)") : tr("Cancel unpaid reservation", "Hủy đơn giữ chưa trả")}</h2><fieldset disabled={!!confirmation}><label htmlFor="sponsorship-cancel-reason">{tr("Cancellation reason · 1–500 trimmed characters", "Lý do hủy · 1–500 ký tự sau khi bỏ khoảng trắng")}</label><textarea id="sponsorship-cancel-reason" rows={3} value={reason} onChange={event => changeReason(event.target.value)} /></fieldset><div className="batch-actions"><button disabled={blocked || !!confirmation || attempted.current} onClick={() => ask("cancel")}>{tr("Review cancellation", "Kiểm tra hủy")}</button></div>{reason.trim() !== "" && <p>{tr("Unrecorded cancellation reason. Payment requires discarding it with Refresh first.", "Lý do hủy chưa ghi nhận. Cần bỏ bằng Làm mới trước khi thanh toán.")}</p>}</section>}
      {sponsorshipDisputeEligible(record.status) && !blocked && !dispute && <section className="batch-panel"><h2>{tr("Open a dispute", "Mở khiếu nại")}</h2><p>{tr("One dispute per sponsorship, filed with the batch growing or later. It cannot be edited or withdrawn here; the company records the decision.", "Mỗi bảo trợ một khiếu nại, gửi khi lô đang phát triển hoặc muộn hơn. Không thể sửa hoặc rút tại đây; công ty ghi nhận quyết định.")}</p><fieldset disabled={busy || !!confirmation || disputeConfirm}><label htmlFor="sponsorship-dispute-reason">{tr("Issue", "Vấn đề")}</label><select id="sponsorship-dispute-reason" value={disputeReason} onChange={event => { if (!sameSession() || locked.current || reading.current) return; setDisputeReason(event.target.value as DisputeReason); }}>{disputeReasons.map(value => <option key={value} value={value}>{disputeLabel(value, language)}</option>)}</select><label htmlFor="sponsorship-dispute-text">{tr("Describe the problem · 15–2000 characters", "Mô tả vấn đề · 15–2000 ký tự")}</label><textarea id="sponsorship-dispute-text" rows={4} maxLength={2000} value={disputeText} onChange={event => { if (!sameSession() || locked.current || reading.current || refreshRequired.current) return; setDisputeText(event.target.value); setError(""); }} /><label htmlFor="sponsorship-dispute-evidence">{tr("Add private evidence · optional, up to three files", "Thêm bằng chứng riêng tư · tùy chọn, tối đa ba tệp")}</label><input id="sponsorship-dispute-evidence" type="file" accept={evidenceTypes.join(",")} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void uploadDisputeEvidence(file); }} /></fieldset><p>{tr("JPEG, PNG, WebP, GIF or PDF, up to 10 MiB per file. Uploaded evidence is linked only when the filing succeeds; unused uploads have no cleanup endpoint.", "JPEG, PNG, WebP, GIF hoặc PDF, tối đa 10 MiB mỗi tệp. Bằng chứng chỉ được liên kết khi gửi thành công; chưa có API dọn tệp chưa dùng.")}</p>{disputeUploads.map(value => <p key={value.id}>{tr("Upload confirmed", "Đã xác nhận tải")}: {value.name}</p>)}<div className="batch-actions"><button disabled={blocked || !!confirmation || disputeConfirm || attempted.current || disputeText.trim().length < 15 || disputeText.trim().length > 2000} onClick={askDispute}>{tr("Review dispute filing", "Kiểm tra khiếu nại")}</button></div>{disputeText.trim() !== "" && <p>{tr("Unrecorded dispute description. Refresh discards it.", "Mô tả khiếu nại chưa ghi nhận. Làm mới sẽ bỏ nội dung này.")}</p>}</section>}
      {dispute && !blocked && <section className="batch-panel"><h2>{tr("Dispute record", "Bản ghi khiếu nại")}</h2><p>{tr("Status", "Trạng thái")}: {disputeLabel(dispute.status, language)} · {tr("Reason", "Lý do")}: {disputeLabel(dispute.reason, language)}</p><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{dispute.description}</p>{dispute.resolution && <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{tr("Company decision", "Quyết định công ty")}: {dispute.resolution}</p>}<p>{tr("Opened", "Mở lúc")}: {batchUtc(dispute.createdAt, "—")}{dispute.resolvedAt ? ` · ${tr("Finalized", "Kết thúc lúc")}: ${batchUtc(dispute.resolvedAt, "—")}` : ""}</p></section>}
      {!canPaySponsorship(record.status) && !canCancelSponsorship(record.status) && !canConfirmDelivery(record.status) && !sponsorshipDisputeEligible(record.status) && !dispute && <section className="batch-panel"><p>{tr("No payment, delivery, cancellation or dispute action is available for this saved status. Unpaid records can be cancelled; cancelled or refunded records cannot be disputed.", "Không có thao tác thanh toán, giao hàng, hủy hay khiếu nại cho trạng thái đã lưu này. Đơn giữ chưa trả có thể hủy; bản ghi đã hủy hoặc đã hoàn tiền không thể khiếu nại.")}</p></section>}
    </div>}
    {confirmation && currentConfirmation && <section className="batch-notice" ref={confirmRef} tabIndex={-1} role="group" aria-labelledby="sponsorship-confirm-title"><h2 id="sponsorship-confirm-title">{confirmation.action === "pay" ? tr("Confirm full package payment", "Xác nhận thanh toán trọn gói") : confirmation.action === "deliver" ? tr("Confirm delivery", "Xác nhận đã nhận hàng") : confirmation.action === "fee" ? tr("Confirm delivery fee payment", "Xác nhận thanh toán phí giao hàng") : tr("Confirm cancellation", "Xác nhận hủy")}</h2><p><strong>{record?.batch.code} · {record?.batch.title}</strong> · {record ? sponsorshipStatusLabel(record.status, vi) : ""}</p>{confirmation.action === "cancel" && <p className="batch-copy">{confirmation.reason.trim()}</p>}{confirmation.action === "pay" && <p>{money(record?.packageAmount ?? 0, vi)} · {confirmation.method}</p>}{confirmation.action === "fee" && <p>{money(record?.deliveryFee ?? 0, vi)} · {confirmation.method}</p>}<p>{confirmation.action === "deliver" ? tr("Send this delivery confirmation exactly once for the saved record? The server rechecks eligibility and settles the batch only when every sponsorship is delivered or refunded. An acknowledgement must be reconciled with a fresh read before further actions; unknown outcomes require Refresh, never automatic replay.", "Gửi xác nhận giao hàng đúng một lần cho bản ghi đã lưu? Máy chủ kiểm tra lại điều kiện và chỉ tất toán lô khi mọi bảo trợ đã giao hoặc hoàn tiền. Phải đối chiếu xác nhận với bản ghi đọc mới trước thao tác tiếp theo; kết quả chưa rõ cần Làm mới, không tự gửi lại.") : confirmation.action === "fee" ? tr("Send this delivery fee payment exactly once for the saved record? The server rechecks eligibility; the payment is idempotent and the fee stays outside the milestone escrow. An acknowledgement must be reconciled with a fresh read before further actions; unknown outcomes require Refresh, never automatic replay.", "Gửi thanh toán phí giao hàng đúng một lần cho bản ghi đã lưu? Máy chủ kiểm tra lại điều kiện; thanh toán an toàn khi gửi lại và phí nằm ngoài quỹ theo cột mốc. Phải đối chiếu xác nhận với bản ghi đọc mới trước thao tác tiếp theo; kết quả chưa rõ cần Làm mới, không tự gửi lại.") : tr("Send this action exactly once for the saved record? The server rechecks eligibility. Payment is idempotent; cancellation of a funded sponsorship refunds unreleased escrow in full and cannot be undone from this screen. An acknowledgement must be reconciled with a fresh read before further actions; unknown outcomes require Refresh, never automatic replay.", "Gửi thao tác đúng một lần cho bản ghi đã lưu? Máy chủ kiểm tra lại điều kiện. Thanh toán an toàn khi gửi lại; hủy bảo trợ đã thanh toán hoàn toàn phần quỹ chưa giải ngân và không thể hoàn tác từ trang này. Phải đối chiếu xác nhận với bản ghi đọc mới trước thao tác tiếp theo; kết quả chưa rõ cần Làm mới, không tự gửi lại.")}</p><div className="batch-actions"><button disabled={blocked || !currentConfirmation} onClick={() => void decide()}>{confirmation.action === "pay" ? tr("Pay once", "Trả một lần") : confirmation.action === "deliver" ? tr("Confirm once", "Xác nhận một lần") : confirmation.action === "fee" ? tr("Pay once", "Trả một lần") : tr("Cancel once", "Hủy một lần")}</button><button onClick={keep}>{tr("Keep unchanged", "Giữ nguyên")}</button></div></section>}
    {disputeConfirm && !confirmation && <section className="batch-notice" ref={confirmRef} tabIndex={-1} role="group" aria-labelledby="sponsorship-dispute-confirm-title"><h2 id="sponsorship-dispute-confirm-title">{tr("Confirm dispute filing", "Xác nhận gửi khiếu nại")}</h2><p><strong>{record?.batch.code} · {record?.batch.title}</strong></p><p>{disputeLabel(disputeReason, language)}</p><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{disputeText.trim()}</p><p>{disputeUploads.length ? `${tr("Evidence files", "Tệp bằng chứng")}: ${disputeUploads.length}` : tr("No evidence files.", "Không có tệp bằng chứng.")}</p><p>{tr("File this dispute exactly once? One dispute per sponsorship, and it cannot be edited or withdrawn here. Resolving it does not automatically refund or replace shares.", "Gửi khiếu nại này đúng một lần? Mỗi bảo trợ một khiếu nại, không thể sửa hoặc rút tại đây. Giải quyết không tự động hoàn tiền hay thay phần cá.")}</p><div className="batch-actions"><button disabled={blocked} onClick={() => void submitDispute()}>{busy ? tr("Filing…", "Đang gửi…") : tr("File once", "Gửi một lần")}</button><button onClick={keepDispute}>{tr("Keep unchanged", "Giữ nguyên")}</button></div></section>}
  </main>;
}
