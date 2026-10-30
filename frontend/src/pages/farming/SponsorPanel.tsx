import { useRef, useState } from "react";
import { useTranslation } from "@/context/LanguageContext";
import { apiSessionStamp, errorMessage, isApiSession } from "@/services/api";
import { currentUser, useUser } from "@/services/session";
import { sponsorshipsApi } from "@/services/sponsorshipsApi";
import { sponsorshipRoute } from "@/services/sponsorships";
import type { PublicBatch } from "@/services/batchContracts";

type ReserveForm = { shares: string; recipientName: string; phone: string; address: string; city: string; province: string; deliveryMethod: string };
const emptyForm: ReserveForm = { shares: "1", recipientName: "", phone: "", address: "", city: "", province: "", deliveryMethod: "" };

export function SponsorPanel({ batch }: { batch: PublicBatch }) {
  const { language } = useTranslation();
  const user = useUser();
  const tr = (en: string, vi: string) => language === "vi" ? vi : en;
  const [stamp] = useState(apiSessionStamp);
  const [form, setForm] = useState<ReserveForm>(emptyForm);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reserved, setReserved] = useState<{ id: string; shares: number } | null>(null);
  const alive = useRef(true);
  const sameSession = () => isApiSession(stamp) && stamp?.role === "User" && user?.role === "Buyer" && user.status === "active" && currentUser()?.email === user.email;
  const money = (value: number) => `${value.toLocaleString(language === "vi" ? "vi-VN" : "en-US")} ₫`;
  const total = (Number.isSafeInteger(Number(form.shares)) && Number(form.shares) >= 1 ? Number(form.shares) : 0) * batch.packagePricePerShare;
  function field(key: keyof ReserveForm, label: string, type = "text", required = false) {
    return <div><label htmlFor={`sponsor-${key}`}>{label}{required ? " *" : ""}</label><input id={`sponsor-${key}`} type={type} min={type === "number" ? 1 : undefined} step={type === "number" ? 1 : undefined} value={form[key]} onChange={event => { setForm(value => ({ ...value, [key]: event.target.value })); setConfirming(false); setError(""); }} /></div>;
  }
  async function reserve() {
    if (!sameSession() || busy || !confirming) return;
    setBusy(true); setError("");
    try {
      const created = await sponsorshipsApi.reserve(batch.id, {
        shares: Number(form.shares),
        recipientName: form.recipientName,
        phone: form.phone,
        address: form.address,
        city: form.city || undefined,
        province: form.province || undefined,
        deliveryMethod: form.deliveryMethod || undefined,
      });
      if (alive.current) { setReserved({ id: created.id, shares: created.shares }); setForm(emptyForm); setConfirming(false); }
    } catch (failure) { if (alive.current) setError(errorMessage(failure, language)); } finally { if (alive.current) setBusy(false); }
  }
  if (reserved) return <aside className="batch-notice" role="status"><p>{tr("Reservation recorded. Nothing is charged yet — open it to pay the full package.", "Đã ghi nhận giữ chỗ. Chưa trừ tiền — mở bảo trợ để thanh toán trọn gói.")}</p><a href={sponsorshipRoute(reserved.id)}>{tr("Open my sponsorship", "Mở bảo trợ của tôi")}</a></aside>;
  if (batch.status !== "open" || batch.sharesAvailable < 1) return null;
  if (!sameSession()) return <aside className="batch-notice"><p>{tr("Sponsoring reserves shares for a User account and is paid in full on the sponsorship page. Admin accounts cannot sponsor.", "Bảo trợ giữ số phần cho tài khoản User và được thanh toán trọn gói trên trang bảo trợ. Tài khoản quản trị không thể bảo trợ.")}</p><a href="#login">{tr("Sign in to sponsor", "Đăng nhập để bảo trợ")}</a></aside>;
  return <section className="batch-panel" aria-labelledby="sponsor-reserve-title"><h2 id="sponsor-reserve-title">{tr("Sponsor this batch", "Bảo trợ lô này")}</h2><p>{tr("Choose shares and delivery details. Reserving holds the shares; the full package of", "Chọn số phần và thông tin giao hàng. Giữ chỗ khóa số phần; tổng gói")} {money(total)} {tr("is paid once on the sponsorship page — no deposit, no balance.", "được trả một lần trên trang bảo trợ — không đặt cọc, không trả góp.")}</p>
    <fieldset disabled={busy || !!reserved}><div className="batch-form-grid">
      {field("shares", tr("Shares (max", "Số phần (tối đa") + ` ${batch.sharesAvailable})`, "number", true)}
      {field("recipientName", tr("Recipient name", "Tên người nhận"), "text", true)}
      {field("phone", tr("Phone", "Điện thoại"), "tel", true)}
      {field("address", tr("Address", "Địa chỉ"), "text", true)}
      {field("city", tr("City", "Thành phố"))}
      {field("province", tr("Province", "Tỉnh"))}
      {field("deliveryMethod", tr("Delivery method", "Phương thức giao"))}
    </div><div className="batch-actions">
      {!confirming && <button type="button" disabled={busy || !form.recipientName.trim() || !form.phone.trim() || !form.address.trim() || !/^[1-9]\d*$/.test(form.shares) || Number(form.shares) > batch.sharesAvailable} onClick={() => { setError(""); setConfirming(true); }}>{tr("Review reservation", "Kiểm tra giữ chỗ")}</button>}
      {confirming && <button type="button" disabled={busy} onClick={() => void reserve()}>{tr(`Reserve ${form.shares} share(s) once`, `Giữ ${form.shares} phần một lần`)}</button>}
      {confirming && <button type="button" disabled={busy} onClick={() => setConfirming(false)}>{tr("Keep editing", "Sửa tiếp")}</button>}
    </div></fieldset>
    {confirming && <p role="note">{tr("Reserving creates an unpaid reservation with a frozen terms snapshot; the company is notified and the shares are held. Payment happens separately and exactly once.", "Giữ chỗ tạo đơn chưa trả với bản điều khoản đã khóa; công ty được thông báo và số phần được giữ. Thanh toán diễn ra riêng và đúng một lần.")}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
