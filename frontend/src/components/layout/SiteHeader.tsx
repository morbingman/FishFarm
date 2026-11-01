import "./SiteHeader.css";
import "@/styles/theme.css";
import "@/styles/AzureTheme.css";
import { useEffect, useState } from "react";
import { LogoMark } from "./LogoMark";
import { LangSwitch, type Lang } from "@/hooks/useTranslation";
import { signOut, useUser } from "@/services/session";
import { errorMessage } from "@/services/api";
import { notificationsApi } from "@/services/notificationsApi";

export function SiteHeader({ language, setLanguage }: { language: Lang; setLanguage: (l: Lang) => void }) {
  const user = useUser();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const vi = language === "vi";
  // Header unread badge: one cheap server read on mount and after every hash
  // navigation (marking read in the inbox, new dispute decisions, …). A failed
  // read just leaves the last count — the badge must never break the header.
  useEffect(() => {
    if (!user) { setUnread(0); return; }
    const controller = new AbortController();
    const read = () => {
      notificationsApi.list({ read: "unread", page: 1, limit: 1 }, controller.signal)
        .then((page) => { if (!controller.signal.aborted) setUnread(page.unreadTotal); })
        .catch(() => undefined);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => { controller.abort(); window.removeEventListener("hashchange", read); };
  }, [user?.email, user?.role]);
  // The nine admin tools read as a wall of links; they collapse into three
  // dropdown groups. Close on outside click, Escape, and after navigating.
  useEffect(() => {
    if (!openGroup) return;
    const close = (event: MouseEvent) => { if (!(event.target as Element).closest(".nav-group")) setOpenGroup(null); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenGroup(null); };
    document.addEventListener("click", close);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", key); };
  }, [openGroup]);
  const group = (id: string, label: string, links: { href: string; text: string }[]) => (
    <div className="nav-group">
      <button type="button" className="nav-group-trigger" aria-haspopup="true" aria-expanded={openGroup === id}
        onClick={() => setOpenGroup(value => value === id ? null : id)}>
        {label}<span className="nav-group-caret" aria-hidden="true">▾</span>
      </button>
      {openGroup === id && <div className="nav-group-menu ribbon-inline-menu">
        {links.map(link => <a key={link.href} href={link.href} onClick={() => setOpenGroup(null)}>{link.text}</a>)}
      </div>}
    </div>
  );
  return (
    <header className="ds-header ribbon-header integration-header" data-theme="azure-v3">
      <div className="ds-header-in">
        <a className="ds-brand" href="#home" aria-label="FISHMARKET"><LogoMark /><strong>FISHMARKET</strong></a>
        <nav className="ds-nav" aria-label="Main">
          <a href="#home">{vi ? "Trang chủ" : "Home"}</a>
          <a href="#marketplace">{vi ? "Chợ cá" : "Marketplace"}</a>
          <a href="#farming">{vi ? "Lô cá và cập nhật" : "Batches and updates"}</a>
          {user?.role === "Buyer" && <><a href="#marketplace/cart">{vi ? "Giỏ hàng" : "Cart"}</a><a href="#marketplace/orders">{vi ? "Đơn hàng" : "Orders"}</a><a href="#marketplace/sponsorships">{vi ? "Bảo trợ của tôi" : "My sponsorships"}</a></>}
          {user && <a href="#account/notifications">{vi ? "Thông báo" : "Notifications"}{unread > 0 && <span className="nav-unread-badge">{unread > 9 ? "9+" : unread}</span>}</a>}
          {user && <a href={user.role === "Admin" ? "#admin/disputes" : "#marketplace/disputes"}>{vi ? "Khiếu nại" : "Disputes"}</a>}
          {user?.role === "Admin" && <>
            {group("selling", vi ? "Bán hàng" : "Selling", [
              { href: "#company/orders", text: vi ? "Đơn hàng công ty" : "Company orders" },
              { href: "#company/listings", text: vi ? "Danh mục công ty" : "Company catalog" },
              { href: "#company/batches", text: vi ? "Lô cá công ty" : "Company batches" },
              { href: "#company/facilities", text: vi ? "Cơ sở và tuân thủ" : "Facilities and compliance" },
            ])}
            {group("reviews", vi ? "Xét duyệt" : "Reviews", [
              { href: "#admin/batches", text: vi ? "Xét duyệt lô" : "Batch review" },
              { href: "#admin/facilities", text: vi ? "Xét duyệt cơ sở" : "Facility review" },
              { href: "#admin/queue", text: vi ? "Xét duyệt tùy chọn" : "Optional review" },
            ])}
            {group("admin", vi ? "Quản trị" : "Admin", [
              { href: "#admin/activity", text: vi ? "Hoạt động" : "Activity" },
              { href: "#admin/users", text: vi ? "Tài khoản" : "Users" },
            ])}
          </>}
        </nav>
        <div className="ds-header-right">
          <LangSwitch language={language} setLanguage={setLanguage} />
          {user ? <>
            <a className="integration-user" href="#account/profile" title={vi ? "Mở hồ sơ" : "Open profile"}>{user.name} · {user.role === "Buyer" ? "User" : "Admin"}</a>
            <button className="sl-btn sl-btn-primary" disabled={busy} onClick={() => {
              setBusy(true); setError("");
              void signOut().catch((err: unknown) => setError(errorMessage(err, language))).finally(() => setBusy(false));
            }}>{vi ? "Đăng xuất" : "Sign out"}</button>
          </> : <a className="sl-btn sl-btn-primary" href="#login">{vi ? "Đăng nhập" : "Sign In"}</a>}
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
    </header>
  );
}
export function SiteFooter({ language }: { language: Lang }) {
  return <footer className="ds-footer"><div className="ds-footer-in">© 2026 FISHMARKET. {language === "vi" ? "Bảo lưu mọi quyền." : "All rights reserved."}</div></footer>;
}
