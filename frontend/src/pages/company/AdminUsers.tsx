import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "@/context/LanguageContext";
import { adminUsersApi } from "@/services/adminUsersApi";
import { adminUsersErrorMessage, adminUsersQuery, canChangeUserStatus, managedUserRoles, managedUserStatuses, oppositeUserStatus, type AdminUsersPage, type AdminUsersRequest, type ManagedUser } from "@/services/adminUsers";
import { useHashTransitionGuard } from "@/services/hashNavigation";
import { reviewDate } from "@/services/listingReview";
import { currentUser, useUser } from "@/services/session";
import "@/pages/marketplace/PublicMarketplace.css";
import "@/pages/marketplace/Commerce.css";
import "./AdminUsers.css";

type Loaded = { key: string; value: AdminUsersPage };
type Confirmation = { key: string; target: ManagedUser };

export default function AdminUsers() {
  const { language } = useTranslation();
  const user = useUser();
  const tr = (en: string, vi: string) => language === "vi" ? vi : en;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [limit, setLimit] = useState(25);
  const [query, setQuery] = useState<AdminUsersRequest>(() => adminUsersQuery());
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState<Confirmation | null>(null);
  const locked = useRef(false);
  const alive = useRef(true);
  const activeRead = useRef(0);
  const readController = useRef<AbortController | null>(null);
  const confirmRegion = useRef<HTMLElement | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const sessionKey = user ? `${user.email}:${user.role}` : "";
  const [stateSession, setStateSession] = useState(sessionKey);
  const key = JSON.stringify([sessionKey, query, reload]);
  const sameSession = () => user?.role === "Admin" && user.status === "active" && currentUser()?.email === user.email && currentUser()?.role === "Admin" && currentUser()?.status === "active";
  const visible = sameSession() && stateSession === sessionKey && !loading && !busy && !needsRefresh && !error && loaded?.key === key ? loaded.value : null;
  const blocked = busy || loading || needsRefresh || !!confirm || !sameSession();
  const statusLabel = (value: ManagedUser["status"]) => value === "active" ? tr("Active", "Hoạt động") : tr("Suspended", "Tạm khóa");
  const actionLabel = (target: ManagedUser) => target.status === "active" ? tr("Suspend account", "Tạm khóa tài khoản") : tr("Reactivate account", "Kích hoạt lại tài khoản");

  useHashTransitionGuard(() => !sameSession() || !locked.current);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; readController.current?.abort(); };
  }, []);
  useEffect(() => {
    if (stateSession !== sessionKey) {
      setLoaded(null); setConfirm(null); setError(""); setNotice(""); setSearch(""); setStatus(""); setRole(""); setStateSession(sessionKey);
    }
  }, [sessionKey, stateSession]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (sameSession() && locked.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [sessionKey]);
  useEffect(() => { if (confirm) confirmRegion.current?.focus(); }, [confirm]);
  useEffect(() => {
    const controller = new AbortController();
    readController.current = controller;
    const read = ++activeRead.current;
    setLoaded(null); setLoading(true); setError(""); setConfirm(null);
    if (!sameSession()) { setLoading(false); return () => controller.abort(); }
    void adminUsersApi.list(query, controller.signal).then(value => {
      if (!controller.signal.aborted && read === activeRead.current && sameSession()) {
        setLoaded({ key, value }); setNeedsRefresh(false);
      }
    }).catch(failure => {
      if (!controller.signal.aborted && read === activeRead.current && sameSession()) {
        setLoaded(null); setError(adminUsersErrorMessage(failure, language)); setNeedsRefresh(true);
      }
    }).finally(() => {
      if (!controller.signal.aborted && read === activeRead.current && sameSession()) setLoading(false);
    });
    return () => controller.abort();
  }, [query, reload, sessionKey]);

  function refresh() {
    if (locked.current || busy || loading || !sameSession()) return;
    setConfirm(null); setLoaded(null); setLoading(true); setError(""); setNotice(""); setReload(value => value + 1);
  }
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current || blocked) return;
    const next = adminUsersQuery({ q: search, ...(status ? { status: status as ManagedUser["status"] } : {}), ...(role ? { role: role as ManagedUser["role"] } : {}), page: 1, limit });
    setSearch(next.q); setLoaded(null); setLoading(true); setNotice(""); setQuery(next);
  }
  function changePage(page: number) {
    if (locked.current || blocked || !visible || page < 1) return;
    setLoaded(null); setLoading(true); setNotice(""); setQuery(value => ({ ...value, page }));
  }
  function cancel() {
    if (locked.current) return;
    setConfirm(null); opener.current?.focus();
  }
  async function act() {
    if (locked.current || busy || loading || needsRefresh || !confirm || !visible || confirm.key !== key || !sameSession()) return;
    const original = visible.items.find(value => value.id === confirm.target.id && value.email === confirm.target.email && value.status === confirm.target.status);
    if (!original || !canChangeUserStatus(original)) return;
    const target = { ...original };
    const nextStatus = oppositeUserStatus(target.status);
    locked.current = true;
    readController.current?.abort(); activeRead.current++;
    setBusy(true); setNotice(""); setError(""); setLoaded(null);
    try {
      await adminUsersApi.setStatus(target, { status: nextStatus, expectedStatus: target.status });
      if (!alive.current || !sameSession()) return;
      setConfirm(null); setNeedsRefresh(true); setLoading(true);
      setNotice(`${target.email} · ${tr("Status confirmed by the server. Reading the current page before another action.", "Máy chủ xác nhận trạng thái. Đang đọc trang hiện tại trước thao tác tiếp theo.")}`);
      setReload(value => value + 1);
    } catch (failure) {
      if (!alive.current || !sameSession()) return;
      setConfirm(null); setLoaded(null); setLoading(false); setNeedsRefresh(true);
      setError(adminUsersErrorMessage(failure, language) + " " + tr("The outcome may be unknown. No write is automatically retried. Select Refresh to reconcile before another action; filters and paging are locked until that read succeeds.", "Kết quả có thể chưa rõ. Không tự động gửi lại thao tác. Chọn Làm mới để đối chiếu trước thao tác tiếp theo; bộ lọc và phân trang bị khóa đến khi đọc thành công."));
    } finally {
      locked.current = false;
      if (alive.current && sameSession()) setBusy(false);
    }
  }

  const pages = visible ? Math.max(1, Math.ceil(visible.total / visible.limit)) : 1;
  const stateVisible = sameSession() && stateSession === sessionKey;
  return <main className="public-market commerce admin-users">
    <nav className="admin-users-navigation" aria-label={tr("Admin users navigation", "Điều hướng tài khoản Admin")}><a href="#company/listings">{tr("Company catalog", "Danh mục công ty")}</a><a href="#company/orders">{tr("Company orders", "Đơn hàng công ty")}</a><a href="#admin/activity">{tr("Recent activity", "Hoạt động gần đây")}</a></nav>
    <h1>{tr("Admin · User accounts", "Admin · Tài khoản người dùng")}</h1>
    <p>{tr("View User and Admin accounts. Only User accounts can be suspended or reactivated. All Admin accounts are protected in both directions.", "Xem tài khoản User và Admin. Chỉ tài khoản User có thể tạm khóa hoặc kích hoạt lại. Mọi tài khoản Admin được bảo vệ theo cả hai chiều.")}</p>
    <p>{tr("Suspension revokes all sessions for that User. Reactivation permits a new sign-in; it does not restore old sessions. No account deletion, timed suspension, provisioning or role changes are available.", "Tạm khóa thu hồi toàn bộ phiên của User đó. Kích hoạt lại cho phép đăng nhập mới; không khôi phục phiên cũ. Không hỗ trợ xóa tài khoản, khóa theo thời hạn, tạo tài khoản hay đổi vai trò.")}</p>
    <form className="admin-users-toolbar" onSubmit={apply}><fieldset disabled={blocked}>
      <label>{tr("Search name or email · server", "Tìm tên hoặc email · máy chủ")}<input type="search" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} autoComplete="off" /></label>
      <label>{tr("Status", "Trạng thái")}<select value={status} onChange={event => setStatus(event.target.value)}><option value="">{tr("All statuses", "Mọi trạng thái")}</option>{managedUserStatuses.map(value => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label>
      <label>{tr("Role", "Vai trò")}<select value={role} onChange={event => setRole(event.target.value)}><option value="">{tr("Both roles", "Cả hai vai trò")}</option>{managedUserRoles.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>{tr("Rows per server page", "Dòng mỗi trang máy chủ")}<select value={limit} onChange={event => setLimit(Number(event.target.value))}>{[10, 25, 50, 100].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <button type="submit">{tr("Apply search / filters", "Áp dụng tìm kiếm / bộ lọc")}</button>
    </fieldset></form>
    <button disabled={busy || loading || !!confirm || !sameSession()} onClick={refresh}>{tr("Refresh", "Làm mới")}</button>
    {!sameSession() && <p role="alert">{tr("An active Admin session is required.", "Cần phiên Admin đang hoạt động.")}</p>}
    {stateVisible && error && <p role="alert" className="commerce-alert">{error}</p>}
    {stateVisible && notice && <p role="status" className="commerce-alert">{notice}</p>}
    {stateVisible && needsRefresh && !loading && <p>{tr("Stale records are hidden. Select Refresh; no further status action is available until a successful read.", "Đã ẩn bản ghi cũ. Chọn Làm mới; không thể đổi trạng thái đến khi đọc thành công.")}</p>}
    {loading && sameSession() && <p role="status">{tr("Loading private accounts…", "Đang tải tài khoản riêng…")}</p>}
    {visible && <section className="commerce-panel" aria-label={tr("Server user results", "Kết quả tài khoản máy chủ")}>
      <p>{tr("Total matching accounts on the server", "Tổng tài khoản phù hợp trên máy chủ")}: <strong>{visible.total.toLocaleString(language === "vi" ? "vi-VN" : "en-US")}</strong> · {tr("Rows on this page", "Dòng trên trang này")}: {visible.items.length}{visible.items.length > 0 && ` · ${(visible.page - 1) * visible.limit + 1}–${(visible.page - 1) * visible.limit + visible.items.length}`}</p>
      <p>{tr("Applied search", "Từ khóa đã áp dụng")}: {query.q || tr("None", "Không")} · {query.status ? statusLabel(query.status) : tr("All statuses", "Mọi trạng thái")} · {query.role || tr("Both roles", "Cả hai vai trò")}</p>
      <p>{tr("Server order: newest joined first, then account ID. Search and paging are server-side; totals are not limited to loaded rows.", "Thứ tự máy chủ: tham gia mới nhất trước, rồi ID tài khoản. Tìm kiếm và phân trang ở máy chủ; tổng không giới hạn ở dòng đã tải.")}</p>
      {!visible.items.length ? <p>{visible.total ? tr("No rows on this page. Use Previous or apply filters to return to page 1.", "Không có dòng trên trang này. Chọn Trước hoặc áp dụng bộ lọc để về trang 1.") : tr("No accounts match the applied search and filters.", "Không có tài khoản phù hợp từ khóa và bộ lọc đã áp dụng.")}</p> : <div className="admin-users-table-wrap"><table><caption className="admin-users-sr-only">{tr("Managed User and protected Admin accounts", "Tài khoản User quản lý được và Admin được bảo vệ")}</caption><thead><tr><th scope="col">{tr("Name / email / ID", "Tên / email / ID")}</th><th scope="col">{tr("Role", "Vai trò")}</th><th scope="col">{tr("Status", "Trạng thái")}</th><th scope="col">{tr("Joined · UTC", "Tham gia · UTC")}</th><th scope="col">{tr("Account action", "Thao tác tài khoản")}</th></tr></thead><tbody>{visible.items.map(target => <tr key={target.id}>
        <td data-label={tr("Account", "Tài khoản")}><strong>{target.name}</strong><br /><span>{target.email}</span><br /><small>{target.id}</small></td>
        <td data-label={tr("Role", "Vai trò")}>{target.role}{target.role === "Admin" && <span className="admin-users-badge">{tr("Protected Admin", "Admin được bảo vệ")}</span>}</td>
        <td data-label={tr("Status", "Trạng thái")}><span className={`admin-users-status admin-users-status-${target.status}`}>{statusLabel(target.status)}</span></td>
        <td data-label={tr("Joined · UTC", "Tham gia · UTC")}><time dateTime={target.joinedAt} title={target.joinedAt}>{reviewDate(target.joinedAt, language)}</time></td>
        <td data-label={tr("Action", "Thao tác")}>{!canChangeUserStatus(target) ? <small>{tr("Protected account · no suspension or reactivation controls.", "Tài khoản được bảo vệ · không có điều khiển khóa hay kích hoạt lại.")}</small> : <button disabled={blocked} onClick={event => {
          if (locked.current || blocked) return;
          opener.current = event.currentTarget; setConfirm({ key, target: { ...target } });
        }} aria-label={`${actionLabel(target)} · ${target.email}`}>{actionLabel(target)}</button>}</td>
      </tr>)}</tbody></table></div>}
      <div className="admin-users-pager"><button disabled={blocked || visible.page <= 1} onClick={() => changePage(visible.page - 1)}>{tr("Previous", "Trước")}</button><span>{tr("Server page", "Trang máy chủ")} {visible.page} / {pages} · {visible.limit} {tr("rows per page", "dòng mỗi trang")}</span><button disabled={blocked || visible.page >= pages} onClick={() => changePage(visible.page + 1)}>{tr("Next", "Sau")}</button></div>
    </section>}
    {confirm && stateVisible && confirm.key === key && <section ref={confirmRegion} tabIndex={-1} className="commerce-alert admin-users-confirm" role="group" aria-labelledby="admin-users-confirm-title" aria-busy={busy}>
      <h2 id="admin-users-confirm-title">{actionLabel(confirm.target)}?</h2>
      <p><strong>{confirm.target.name}</strong><br /><strong className="admin-users-email">{confirm.target.email}</strong></p>
      <p>{statusLabel(confirm.target.status)} → {statusLabel(oppositeUserStatus(confirm.target.status))}</p>
      <p>{confirm.target.status === "active" ? tr("Suspend this exact email account and revoke all of its sessions? The server will reject the action if the expected active state has changed.", "Tạm khóa đúng tài khoản email này và thu hồi toàn bộ phiên? Máy chủ sẽ từ chối nếu trạng thái hoạt động dự kiến đã thay đổi.") : tr("Reactivate this exact email account? It must still be suspended. Old sessions will not be restored; the User must sign in again.", "Kích hoạt lại đúng tài khoản email này? Tài khoản phải vẫn đang tạm khóa. Không khôi phục phiên cũ; User phải đăng nhập lại.")}</p>
      <p>{tr("No reason is collected or sent: the current audit schema does not persist it.", "Không thu thập hay gửi lý do: cấu trúc kiểm toán hiện tại không lưu trường này.")}</p>
      <div className="admin-users-pager"><button disabled={busy || loading || needsRefresh} onClick={() => void act()}>{busy ? tr("Submitting…", "Đang gửi…") : `${tr("Confirm", "Xác nhận")} · ${actionLabel(confirm.target)}`}</button><button disabled={busy} onClick={cancel}>{tr("Keep unchanged", "Giữ nguyên")}</button></div>
    </section>}
  </main>;
}
