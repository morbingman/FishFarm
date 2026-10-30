import "./SiteHeader.css";
import "@/styles/theme.css";
import "@/styles/AzureTheme.css";
import { useState } from "react";
import { LogoMark } from "./LogoMark";
import { LangSwitch, type Lang } from "@/hooks/useTranslation";
import { signOut, useUser } from "@/services/session";
import { errorMessage } from "@/services/api";

export function SiteHeader({ language, setLanguage }: { language: Lang; setLanguage: (l: Lang) => void }) {
  const user = useUser();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const vi = language === "vi";
  return (
    <header className="ds-header ribbon-header integration-header" data-theme="azure-v3">
      <div className="ds-header-in">
        <a className="ds-brand" href="#home" aria-label="FISHMARKET"><LogoMark /><strong>FISHMARKET</strong></a>
        <nav className="ds-nav" aria-label="Main">
          <a href="#home">{vi ? "Trang chủ" : "Home"}</a>
          <a href="#marketplace">{vi ? "Chợ cá" : "Marketplace"}</a>
          <a href="#farming">{vi ? "Lô cá và cập nhật" : "Batches and updates"}</a>
          {user?.role === "Buyer" && <><a href="#marketplace/cart">{vi ? "Giỏ hàng" : "Cart"}</a><a href="#marketplace/orders">{vi ? "Đơn hàng" : "Orders"}</a><a href="#marketplace/sponsorships">{vi ? "Bảo trợ của tôi" : "My sponsorships"}</a></>}
          {user && <a href="#account/profile">{vi ? "Hồ sơ" : "Profile"}</a>}
          {user && <a href="#account/notifications">{vi ? "Thông báo" : "Notifications"}</a>}
          {user && <a href={user.role === "Admin" ? "#admin/disputes" : "#marketplace/disputes"}>{vi ? "Khiếu nại" : "Disputes"}</a>}
          {user?.role === "Admin" && <><a href="#company/orders">{vi ? "Đơn hàng công ty" : "Company orders"}</a><a href="#company/listings">{vi ? "Danh mục công ty" : "Company catalog"}</a><a href="#company/batches">{vi ? "Lô cá công ty" : "Company batches"}</a><a href="#admin/batches">{vi ? "Xét duyệt lô" : "Batch review"}</a><a href="#company/facilities">{vi ? "Cơ sở và tuân thủ" : "Facilities and compliance"}</a><a href="#admin/facilities">{vi ? "Xét duyệt cơ sở" : "Facility review"}</a><a href="#admin/queue">{vi ? "Xét duyệt tùy chọn" : "Optional review"}</a><a href="#admin/activity">{vi ? "Hoạt động" : "Activity"}</a><a href="#admin/users">{vi ? "Tài khoản" : "Users"}</a></>}
        </nav>
        <div className="ds-header-right">
          <LangSwitch language={language} setLanguage={setLanguage} />
          {user ? <>
            <span className="integration-user">{user.name} · {user.role === "Buyer" ? "User" : "Admin"}</span>
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
