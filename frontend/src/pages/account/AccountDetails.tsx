import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "@/context/LanguageContext";
import { apiSessionStamp, isApiSession, publishApiUser, type ApiSessionStamp } from "@/services/api";
import { accountApi } from "@/services/accountApi";
import { accountErrorMessage, profileInput, type ProfileInput, type NotificationPrefs } from "@/services/account";
import type { ApiUser } from "@/services/contracts";
import { useHashTransitionGuard } from "@/services/hashNavigation";
import { currentUser, useUser } from "@/services/session";
import "../marketplace/PublicMarketplace.css";
import "../marketplace/Commerce.css";
import "./AccountDetails.css";

type Form = ProfileInput & NotificationPrefs;
const formOf = (user: ApiUser): Form => ({ name: user.name, phone: user.phone ?? "", location: user.location ?? "", ...user.prefs });

export default function AccountDetails({ mode }: { mode: "profile" | "settings" }) {
  const { language } = useTranslation();
  const user = useUser();
  const tr = (en: string, vi: string) => language === "vi" ? vi : en;
  const [stamp] = useState<ApiSessionStamp | null>(apiSessionStamp);
  const [remote, setRemote] = useState<ApiUser | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [baseline, setBaseline] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [reload, setReload] = useState(0);
  const locked = useRef(false);
  const alive = useRef(true);
  const readController = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const sameSession = () => isApiSession(stamp) && !!user && currentUser()?.email === user.email && currentUser()?.role === user.role && currentUser()?.status === "active";
  const dirty = !!form && !!baseline && (mode === "profile"
    ? form.name !== baseline.name || form.phone !== baseline.phone || form.location !== baseline.location
    : form.status !== baseline.status || form.system !== baseline.system || form.reminders !== baseline.reminders);
  const blocked = loading || busy || needsRefresh || !sameSession();
  const visible = sameSession() && !loading && !busy && !needsRefresh && remote && form;

  useHashTransitionGuard(() => !sameSession() || (!locked.current && (!dirty || window.confirm(tr("Leave without saving your changes?", "Rời trang mà không lưu thay đổi?")))));
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; readController.current?.abort(); };
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (sameSession() && (dirty || locked.current)) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, stamp, user]);
  useEffect(() => {
    const controller = new AbortController();
    readController.current = controller;
    const request = ++sequence.current;
    setLoading(true); setRemote(null); setForm(null); setBaseline(null); setError(null);
    if (!sameSession() || !stamp) { setLoading(false); return () => controller.abort(); }
    void (async () => {
      const profile = await accountApi.profile({ id: stamp.id, role: stamp.role }, controller.signal);
      const prefs = mode === "settings" ? await accountApi.prefs(controller.signal) : profile.prefs;
      if (controller.signal.aborted || request !== sequence.current || !sameSession()) return;
      if (profile.email !== user!.email) throw new Error("Unexpected account identity");
      const value = { ...profile, prefs };
      if (!publishApiUser(value, stamp)) return;
      setRemote(value); setForm(formOf(value)); setBaseline(formOf(value)); setNeedsRefresh(false);
    })().catch(failure => {
      if (!controller.signal.aborted && request === sequence.current && sameSession()) { setError(failure); setNeedsRefresh(true); }
    }).finally(() => {
      if (!controller.signal.aborted && request === sequence.current && sameSession()) setLoading(false);
    });
    return () => controller.abort();
  }, [mode, reload, stamp]);

  function refresh() {
    if (locked.current || loading || !sameSession()) return;
    if (dirty && !window.confirm(tr("Discard local changes and read the server record?", "Bỏ thay đổi chưa lưu và đọc bản ghi máy chủ?"))) return;
    setRemote(null); setForm(null); setBaseline(null); setLoading(true); setSaved(false); setReload(value => value + 1);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current || blocked || !visible || !form || !remote || !dirty) return;
    let input: ProfileInput | NotificationPrefs;
    try { input = mode === "profile" ? profileInput({ name: form.name, phone: form.phone, location: form.location }) : { status: form.status, system: form.system, reminders: form.reminders }; }
    catch (failure) { setError(failure); return; }
    locked.current = true; readController.current?.abort(); sequence.current++;
    setBusy(true); setError(null); setSaved(false);
    try {
      if (mode === "profile") await accountApi.saveProfile(input as ProfileInput, remote);
      else await accountApi.savePrefs(input as NotificationPrefs);
      if (!alive.current || !sameSession()) return;
      setRemote(null); setForm(null); setBaseline(null); setNeedsRefresh(true); setLoading(true); setSaved(true); setReload(value => value + 1);
    } catch (failure) {
      if (!alive.current || !sameSession()) return;
      setRemote(null); setForm(null); setBaseline(null); setLoading(false); setNeedsRefresh(true); setError(failure);
    } finally {
      locked.current = false;
      if (alive.current && sameSession()) setBusy(false);
    }
  }
  const set = <K extends keyof Form>(field: K, value: Form[K]) => setForm(current => current ? { ...current, [field]: value } : null);
  const date = (value: string) => new Date(value).toLocaleString(language === "vi" ? "vi-VN" : "en-US", { timeZone: "UTC" }) + " UTC";
  return <main className="public-market commerce account-details">
    <nav className="commerce-actions" aria-label={tr("Your account", "Tài khoản của bạn")}>
      <a href="#account/profile" aria-current={mode === "profile" ? "page" : undefined}>{tr("Profile", "Hồ sơ")}</a>
      <a href="#account/settings" aria-current={mode === "settings" ? "page" : undefined}>{tr("Notification preferences", "Tùy chọn thông báo")}</a>
      <a href="#account/notifications">{tr("Personal notifications", "Thông báo cá nhân")}</a>
    </nav>
    <h1>{mode === "profile" ? tr("Your profile", "Hồ sơ của bạn") : tr("Notification preferences", "Tùy chọn thông báo")}</h1>
    <p>{tr("Your account details are read from the server. Email, role and account status cannot be changed here.", "Thông tin tài khoản được đọc từ máy chủ. Không thể thay đổi email, vai trò hay trạng thái tài khoản tại đây.")}</p>
    <button className="sl-btn sl-btn-ghost sm" disabled={loading || busy || !sameSession()} onClick={refresh}>{tr("Refresh", "Làm mới")}</button>
    {!sameSession() && <p role="alert">{tr("An active User or Admin session is required.", "Cần phiên User hoặc Admin đang hoạt động.")}</p>}
    {sameSession() && error != null && <p role="alert" className="commerce-alert">{accountErrorMessage(error, language)} {needsRefresh && tr("The write may have completed. No automatic retry is sent; select Refresh before another save.", "Máy chủ có thể đã lưu. Không tự động gửi lại; chọn Làm mới trước khi lưu tiếp.")}</p>}
    {sameSession() && saved && <p role="status" className="commerce-alert">{tr("The server acknowledged your save.", "Máy chủ đã xác nhận lưu.")} {loading || needsRefresh ? tr("Reading the current record before another save.", "Đang đọc bản ghi hiện tại trước khi lưu tiếp.") : tr("The current server record is shown below.", "Bản ghi máy chủ hiện tại hiển thị bên dưới.")}</p>}
    {loading && sameSession() && <p role="status">{tr("Loading account details…", "Đang tải thông tin tài khoản…")}</p>}
    {needsRefresh && !loading && sameSession() && <p>{tr("Stale details are hidden. Refresh must succeed to unlock editing.", "Đã ẩn thông tin cũ. Cần làm mới thành công để mở khóa chỉnh sửa.")}</p>}
    {visible && remote && form && <>
      <section className="commerce-panel"><h2>{tr("Account identity", "Danh tính tài khoản")}</h2><dl>
        <dt>{tr("Email", "Email")}</dt><dd>{remote.email}</dd>
        <dt>{tr("Role", "Vai trò")}</dt><dd>{remote.role}</dd>
        <dt>{tr("Status", "Trạng thái")}</dt><dd>{tr("Active", "Đang hoạt động")}</dd>
        <dt>{tr("Joined", "Ngày tham gia")}</dt><dd><time dateTime={remote.joinedAt}>{date(remote.joinedAt)}</time></dd>
        <dt>{tr("Email verification", "Xác minh email")}</dt><dd>{remote.emailVerifiedAt ? <time dateTime={remote.emailVerifiedAt}>{date(remote.emailVerifiedAt)}</time> : tr("Not verified", "Chưa xác minh")}</dd>
      </dl></section>
      <form onSubmit={event => void save(event)} className="commerce-panel"><fieldset disabled={blocked}>
        {mode === "profile" ? <>
          <label>{tr("Full name", "Họ tên")}<input name="name" autoComplete="name" required maxLength={80} value={form.name} onChange={event => set("name", event.target.value)} /></label>
          <label>{tr("Phone · optional", "Số điện thoại · tùy chọn")}<input name="phone" type="tel" autoComplete="tel" maxLength={32} value={form.phone} onChange={event => set("phone", event.target.value)} /></label>
          <label>{tr("Location · optional", "Khu vực · tùy chọn")}<input name="location" autoComplete="address-level2" maxLength={120} value={form.location} onChange={event => set("location", event.target.value)} /></label>
          <p>{tr("A blank phone or location clears that field. Text is trimmed before saving. This is not your order delivery address.", "Để trống số điện thoại hay khu vực sẽ xóa nội dung trường đó. Loại bỏ khoảng trắng đầu/cuối trước khi lưu. Đây không phải địa chỉ giao đơn hàng.")}</p>
        </> : <>
          {(["status", "system", "reminders"] as const).map(key => <label className="account-check" key={key}><input type="checkbox" name={key} checked={form[key]} onChange={event => set(key, event.target.checked)} />{key === "status" ? tr("Order and listing status updates", "Cập nhật trạng thái đơn hàng và tin đăng") : key === "system" ? tr("System announcements", "Thông báo hệ thống") : tr("Reminders and follow-ups", "Nhắc nhở và theo dõi")}</label>)}
          <p>{tr("These settings affect future status, system and reminder notifications. Existing inbox history and read states do not change. Success, error and approval messages are not muted by these switches.", "Tùy chọn áp dụng cho thông báo trạng thái, hệ thống và nhắc nhở trong tương lai. Không thay đổi lịch sử hộp thư hay trạng thái đã đọc. Các nút này không tắt thông báo thành công, lỗi hay phê duyệt.")}</p>
          <p>{tr("Saving replaces all three choices. A later save from another tab can overwrite them; there is no version-conflict check.", "Lưu thay thế cả ba lựa chọn. Lần lưu sau từ thẻ khác có thể ghi đè; chưa có kiểm tra xung đột phiên bản.")}</p>
        </>}
        <div className="commerce-actions"><button type="submit" disabled={blocked || !dirty}>{tr("Save changes", "Lưu thay đổi")}</button><button type="button" disabled={blocked || !dirty} onClick={() => { setForm(baseline); setError(null); }}>{tr("Discard local changes", "Bỏ thay đổi chưa lưu")}</button><span>{dirty ? tr("Unsaved changes", "Thay đổi chưa lưu") : tr("No unsaved changes", "Không có thay đổi chưa lưu")}</span></div>
      </fieldset></form>
    </>}
    {busy && sameSession() && <p role="status">{tr("Saving… Do not leave until the result is known.", "Đang lưu… Không rời trang cho đến khi có kết quả.")}</p>}
    <p>{tr("Password changes, avatars and account deactivation are not part of this screen.", "Đổi mật khẩu, ảnh đại diện và vô hiệu hóa tài khoản không thuộc trang này.")}</p>
  </main>;
}
