import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "@/context/LanguageContext";
import { notificationsApi } from "@/services/notificationsApi";
import { notificationDate, notificationReads, notificationsErrorMessage, notificationsQuery, notificationText, notificationTypeLabel, notificationTypes, safeNotificationLink, type NotificationsPage, type NotificationsRequest, type NotificationRead, type NotificationType, type PersonalNotification } from "@/services/notifications";
import { useHashTransitionGuard } from "@/services/hashNavigation";
import { currentUser, useUser } from "@/services/session";
import "@/pages/marketplace/PublicMarketplace.css";
import "@/pages/marketplace/Commerce.css";
import "./NotificationInbox.css";

type Loaded = { key: string; value: NotificationsPage };
type Notice = { updated: number | null };

export default function NotificationInbox() {
  const { language } = useTranslation();
  const user = useUser();
  const tr = (en: string, vi: string) => language === "vi" ? vi : en;
  const [read, setRead] = useState<NotificationRead>("all");
  const [type, setType] = useState<NotificationType | "">("");
  const [limit, setLimit] = useState(25);
  const [query, setQuery] = useState<NotificationsRequest>(() => notificationsQuery());
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const locked = useRef(false);
  const alive = useRef(true);
  const activeRead = useRef(0);
  const readController = useRef<AbortController | null>(null);
  const confirmRegion = useRef<HTMLElement | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const sessionKey = user ? `${user.email}:${user.role}` : "";
  const [stateSession, setStateSession] = useState(sessionKey);
  const key = JSON.stringify([sessionKey, query, reload]);
  const sameSession = () => !!user && ["Buyer", "Admin"].includes(user.role) && user.status === "active" && currentUser()?.email === user.email && currentUser()?.role === user.role && currentUser()?.status === "active";
  const stateVisible = sameSession() && stateSession === sessionKey;
  const visible = stateVisible && !loading && !busy && !needsRefresh && !error && loaded?.key === key ? loaded.value : null;
  const blocked = busy || loading || needsRefresh || !!confirmation || !sameSession();
  const readLabel = (value: NotificationRead) => value === "all" ? tr("All", "Tất cả") : value === "unread" ? tr("Unread", "Chưa đọc") : tr("Read", "Đã đọc");

  useHashTransitionGuard(() => !sameSession() || !locked.current);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; readController.current?.abort(); };
  }, []);
  useEffect(() => {
    if (stateSession !== sessionKey) {
      setLoaded(null); setConfirmation(null); setError(null); setNotice(null); setStateSession(sessionKey);
    }
  }, [sessionKey, stateSession]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (sameSession() && locked.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [sessionKey]);
  useEffect(() => { if (confirmation) confirmRegion.current?.focus(); }, [confirmation]);
  useEffect(() => {
    const controller = new AbortController();
    readController.current = controller;
    const sequence = ++activeRead.current;
    setLoaded(null); setLoading(true); setError(null); setConfirmation(null);
    if (!sameSession()) { setLoading(false); return () => controller.abort(); }
    void notificationsApi.list(query, controller.signal).then(value => {
      if (!controller.signal.aborted && sequence === activeRead.current && sameSession()) {
        setLoaded({ key, value }); setNeedsRefresh(false);
      }
    }).catch(failure => {
      if (!controller.signal.aborted && sequence === activeRead.current && sameSession()) {
        setLoaded(null); setError(failure); setNeedsRefresh(true);
      }
    }).finally(() => {
      if (!controller.signal.aborted && sequence === activeRead.current && sameSession()) setLoading(false);
    });
    return () => controller.abort();
  }, [query, reload, sessionKey]);

  function refresh() {
    if (locked.current || busy || loading || !sameSession()) return;
    setConfirmation(null); setLoaded(null); setLoading(true); setError(null); setNotice(null); setReload(value => value + 1);
  }
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current || blocked) return;
    const next = notificationsQuery({ read, ...(type ? { type } : {}), page: 1, limit });
    setLoaded(null); setLoading(true); setNotice(null); setQuery(next);
  }
  function changePage(page: number) {
    if (locked.current || blocked || !visible || page < 1) return;
    setLoaded(null); setLoading(true); setNotice(null); setQuery(value => ({ ...value, page }));
  }
  function cancel() {
    if (locked.current) return;
    setConfirmation(null); opener.current?.focus();
  }
  async function act(target: PersonalNotification | null) {
    if (locked.current || busy || loading || needsRefresh || !visible || !sameSession()) return;
    if (target ? !!confirmation || target.readAt !== null || !visible.items.some(item => item.id === target.id && item.readAt === null) : confirmation !== key) return;
    locked.current = true;
    readController.current?.abort(); activeRead.current++;
    setBusy(true); setNotice(null); setError(null); setLoaded(null);
    try {
      const result = target ? await notificationsApi.markRead(target) : await notificationsApi.markAllRead();
      if (!alive.current || !sameSession()) return;
      setConfirmation(null); setNeedsRefresh(true); setLoading(true);
      setNotice({ updated: "updated" in result ? result.updated : null });
      setReload(value => value + 1);
    } catch (failure) {
      if (!alive.current || !sameSession()) return;
      setConfirmation(null); setLoaded(null); setLoading(false); setNeedsRefresh(true); setError(failure);
    } finally {
      locked.current = false;
      if (alive.current && sameSession()) setBusy(false);
    }
  }

  const pages = visible ? Math.max(1, Math.ceil(visible.total / visible.limit)) : 1;
  return <main className="public-market commerce notification-inbox">
    <h1>{tr("Personal notifications", "Thông báo cá nhân")}</h1>
    <p>{tr("Only notifications addressed to your account appear here. Read state belongs to you, including for Admin events.", "Chỉ hiển thị thông báo gửi đến tài khoản của bạn. Trạng thái đã đọc là riêng của bạn, kể cả sự kiện Admin.")}</p>
    <p>{tr("Opening a destination does not mark a notification read. History is paged on the server, with no newest-200 limit. There is no automatic polling, deletion or mark-unread action.", "Mở trang đích không đánh dấu đã đọc. Lịch sử phân trang trên máy chủ, không giới hạn 200 thông báo mới nhất. Không tự động thăm dò, xóa hay đánh dấu chưa đọc.")}</p>
    <form className="notification-toolbar" onSubmit={apply}><fieldset disabled={blocked}>
      <label>{tr("Read filter", "Lọc trạng thái đọc")}<select value={read} onChange={event => setRead(event.target.value as NotificationRead)}>{notificationReads.map(value => <option key={value} value={value}>{readLabel(value)}</option>)}</select></label>
      <label>{tr("Type", "Loại")}<select value={type} onChange={event => setType(event.target.value as NotificationType | "")}><option value="">{tr("All types", "Mọi loại")}</option>{notificationTypes.map(value => <option key={value} value={value}>{notificationTypeLabel(value, language)}</option>)}</select></label>
      <label>{tr("Rows per server page", "Dòng mỗi trang máy chủ")}<select value={limit} onChange={event => setLimit(Number(event.target.value))}>{[10, 25, 50, 100].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <button type="submit">{tr("Apply filters", "Áp dụng bộ lọc")}</button>
    </fieldset></form>
    <div className="notification-actions"><button className="sl-btn sl-btn-ghost sm" disabled={busy || loading || !!confirmation || !sameSession()} onClick={refresh}>{tr("Refresh", "Làm mới")}</button><button className="sl-btn sl-btn-primary sm" disabled={blocked || !visible || visible.unreadTotal === 0} onClick={event => {
      if (locked.current || blocked || !visible) return;
      opener.current = event.currentTarget; setConfirmation(key);
    }}>{tr("Mark all read…", "Đánh dấu tất cả đã đọc…")}</button></div>
    {!sameSession() && <p role="alert">{tr("An active User or Admin session is required.", "Cần phiên User hoặc Admin đang hoạt động.")}</p>}
    {stateVisible && error != null && <p role="alert" className="commerce-alert">{notificationsErrorMessage(error, language)} {tr("The outcome may be unknown. No write is automatically retried. Select Refresh to reconcile before another action.", "Kết quả có thể chưa rõ. Không tự động gửi lại thao tác. Chọn Làm mới để đối chiếu trước thao tác tiếp theo.")}</p>}
    {stateVisible && notice && <p role="status" className="commerce-alert">{notice.updated === null ? tr("Marked read by the server.", "Máy chủ đã đánh dấu đã đọc.") : `${tr("Server updated", "Máy chủ đã cập nhật")} ${notice.updated.toLocaleString(language === "vi" ? "vi-VN" : "en-US")} ${tr("previously unread notifications.", "thông báo trước đó chưa đọc.")}`} {tr("Reading current totals before another action. New arrivals may remain unread.", "Đang đọc tổng hiện tại trước thao tác tiếp theo. Thông báo mới đến có thể vẫn chưa đọc.")}</p>}
    {stateVisible && needsRefresh && !loading && <p>{tr("Stale records are hidden. Filters and actions remain locked until Refresh succeeds.", "Đã ẩn bản ghi cũ. Bộ lọc và thao tác bị khóa đến khi Làm mới thành công.")}</p>}
    {loading && sameSession() && <p role="status">{tr("Loading personal notifications…", "Đang tải thông báo cá nhân…")}</p>}
    {visible && <section className="commerce-panel" aria-label={tr("Server notification results", "Kết quả thông báo máy chủ")}>
      <div className="notification-totals"><p>{tr("Unread across your entire inbox", "Chưa đọc trong toàn bộ hộp thư của bạn")}: <strong>{visible.unreadTotal.toLocaleString(language === "vi" ? "vi-VN" : "en-US")}</strong></p><p>{tr("Total matching filters", "Tổng phù hợp bộ lọc")}: <strong>{visible.total.toLocaleString(language === "vi" ? "vi-VN" : "en-US")}</strong> · {tr("Rows on this page", "Dòng trên trang này")}: {visible.items.length}</p></div>
      <p>{tr("Applied filters", "Bộ lọc đã áp dụng")}: {readLabel(query.read)} · {query.type ? notificationTypeLabel(query.type, language) : tr("All types", "Mọi loại")} · {tr("Newest first, then notification ID", "Mới nhất trước, rồi ID thông báo")}</p>
      {!visible.items.length ? <p>{visible.total ? tr("No rows on this page. Use Previous or apply filters to return to page 1.", "Không có dòng trên trang này. Chọn Trước hoặc áp dụng bộ lọc để về trang 1.") : tr("No personal notifications match these filters.", "Không có thông báo cá nhân phù hợp bộ lọc này.")}</p> : <ul className="notification-list">{visible.items.map(item => {
        const destination = safeNotificationLink(item.link, user!.role as "Buyer" | "Admin");
        return <li key={item.id} className={`notification-card ${item.readAt === null ? "notification-unread" : ""}`}>
          <div className="notification-meta"><span>{notificationTypeLabel(item.type, language)}</span><strong>{readLabel(item.readAt === null ? "unread" : "read")}</strong><time dateTime={item.createdAt} title={item.createdAt}>{notificationDate(item.createdAt, language)}</time></div>
          <h2>{notificationText(item.titleKey, item.titleParams, language)}</h2>
          <p className="notification-body">{notificationText(item.bodyKey, item.bodyParams, language)}</p>
          {item.readAt && <p><small>{tr("Read at", "Đọc lúc")}: <time dateTime={item.readAt} title={item.readAt}>{notificationDate(item.readAt, language)}</time></small></p>}
          <div className="notification-actions">{destination && <a href={destination}>{tr("Open destination", "Mở trang đích")}</a>}<button className="sl-btn sl-btn-ghost sm" disabled={blocked || item.readAt !== null} aria-label={`${tr("Mark read", "Đánh dấu đã đọc")} · ${item.id}`} onClick={() => void act(item)}>{item.readAt === null ? tr("Mark read", "Đánh dấu đã đọc") : tr("Already read", "Đã đọc")}</button></div>
          {item.link !== null && !destination && <p className="notification-recorded-link">{tr("Recorded destination · unavailable here", "Đích được ghi nhận · chưa khả dụng tại đây")}: <code>{item.link}</code></p>}
          <small className="notification-id">{item.id}</small>
        </li>;
      })}</ul>}
      <div className="notification-pager"><button disabled={blocked || visible.page <= 1} onClick={() => changePage(visible.page - 1)}>{tr("Previous", "Trước")}</button><span>{tr("Server page", "Trang máy chủ")} {visible.page} / {pages} · {visible.limit} {tr("rows per page", "dòng mỗi trang")}</span><button disabled={blocked || visible.page >= pages} onClick={() => changePage(visible.page + 1)}>{tr("Next", "Sau")}</button></div>
    </section>}
    {confirmation && stateVisible && confirmation === key && <section ref={confirmRegion} tabIndex={-1} className="commerce-alert notification-confirm" role="group" aria-labelledby="notification-confirm-title" aria-busy={busy}>
      <h2 id="notification-confirm-title">{tr("Mark your entire inbox read?", "Đánh dấu toàn bộ hộp thư của bạn đã đọc?")}</h2>
      <p><strong>{user?.email}</strong></p>
      <p>{tr("This marks all currently unread personal notifications across every page and type, not just the filtered results. Existing read timestamps are preserved. Notifications arriving after the update may remain unread.", "Thao tác đánh dấu mọi thông báo cá nhân đang chưa đọc trên tất cả trang và loại, không chỉ kết quả đã lọc. Giữ nguyên thời điểm đã đọc cũ. Thông báo đến sau khi cập nhật có thể vẫn chưa đọc.")}</p>
      <div className="notification-actions"><button className="sl-btn sl-btn-primary sm" disabled={busy || loading || needsRefresh} onClick={() => void act(null)}>{busy ? tr("Submitting…", "Đang gửi…") : tr("Confirm · Mark entire inbox read", "Xác nhận · Đánh dấu toàn bộ hộp thư đã đọc")}</button><button className="sl-btn sl-btn-ghost sm" disabled={busy} onClick={cancel}>{tr("Keep unchanged", "Giữ nguyên")}</button></div>
    </section>}
  </main>;
}
