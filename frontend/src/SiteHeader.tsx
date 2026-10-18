import { useEffect, useState } from "react"
import { LangSwitch, type Lang } from "./i18n"
import { Icon, NotifBell, UserMenu, useHash } from "./ui"
import { homeFor, useUser } from "./store"
import "./design-system.css"

const VI: Record<string, string> = {
  "Home": "Trang chủ", "Marketplace": "Chợ cá", "Sell Your Fish": "Bán cá", "Seller Center": "Trung tâm người bán",
  "Admin Console": "Bảng quản trị", "My Account": "Tài khoản", "Sign In": "Đăng nhập", "Menu": "Menu",
  "Help & support": "Trợ giúp", "Privacy": "Quyền riêng tư", "Terms": "Điều khoản", "All rights reserved.": "Bảo lưu mọi quyền.",
}
const tr = (l: Lang, s: string) => (l === "vi" ? VI[s] ?? s : s)

type Item = { label: string; href: string; key: string }

function activeKey(top: string) {
  if (top === "" || top === "home") return "home"
  if (["seller", "admin", "account"].includes(top)) return top
  if (["login", "expired"].includes(top)) return ""
  return "marketplace"
}

export function SiteHeader({ language, setLanguage }: { language: Lang; setLanguage: (l: Lang) => void }) {
  const user = useUser()
  const { parts } = useHash()
  const [open, setOpen] = useState(false)
  const active = activeKey(parts[0] ?? "")
  useEffect(() => { setOpen(false) }, [parts.join("/")])

  const items: Item[] = [
    { label: "Home", href: "#home", key: "home" },
    { label: "Marketplace", href: "#marketplace", key: "marketplace" },
  ]
  if (!user) items.push({ label: "Sell Your Fish", href: "#seller", key: "seller" })
  else if (user.role === "Seller") items.push({ label: "Seller Center", href: "#seller", key: "seller" })
  else if (user.role === "Admin") items.push({ label: "Admin Console", href: "#admin", key: "admin" })
  else items.push({ label: "My Account", href: "#account/profile", key: "account" })

  return (
    <header className="ds-header" data-no-translate>
      <div className="ds-header-in">
        <a className="ds-brand" href="#home" aria-label="FISHMARKET home"><span><Icon name="fish" /></span>FISHMARKET</a>
        <nav className="ds-nav" aria-label="Main">
          {items.map(i => <a key={i.key} href={i.href} className={active === i.key ? "on" : ""} aria-current={active === i.key ? "page" : undefined}>{tr(language, i.label)}</a>)}
        </nav>
        <div className="ds-header-right">
          <LangSwitch language={language} setLanguage={setLanguage} />
          {user ? (<><NotifBell user={user} language={language} /><UserMenu user={user} /></>) : (
            <a className="sl-btn sl-btn-primary" href="#login">{tr(language, "Sign In")}</a>
          )}
          <button className="ds-burger" aria-label={tr(language, "Menu")} aria-expanded={open} onClick={() => setOpen(o => !o)}><Icon name={open ? "x" : "list"} /></button>
        </div>
      </div>
      {open && (
        <nav className="ds-mobile-nav" aria-label="Mobile">
          {items.map(i => <a key={i.key} href={i.href} className={active === i.key ? "on" : ""}>{tr(language, i.label)}</a>)}
          {user && <a href={"#" + homeFor(user.role)}>{user.role === "Buyer" ? tr(language, "Marketplace") : tr(language, user.role === "Admin" ? "Admin Console" : "Seller Center")}</a>}
        </nav>
      )}
    </header>
  )
}

export function SiteFooter({ language }: { language: Lang }) {
  return (
    <footer className="ds-footer" data-no-translate>
      <div className="ds-footer-in">
        <span>© 2026 FISHMARKET. {tr(language, "All rights reserved.")}</span>
        <nav aria-label="Footer">
          <a href="#marketplace">{tr(language, "Marketplace")}</a>
          <a href="#account/settings">{tr(language, "Help & support")}</a>
          <a href="#account/settings">{tr(language, "Privacy")}</a>
          <a href="#account/settings">{tr(language, "Terms")}</a>
        </nav>
      </div>
    </footer>
  )
}
