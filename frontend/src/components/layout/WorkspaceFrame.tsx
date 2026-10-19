import { useEffect, useState, type ReactNode } from "react";
import type { User } from "@/services/demoStore";
import type { Lang } from "@/hooks/useTranslation";
import {
  Icon,
  useHash,
  ROLE_NAV,
  ACCOUNT_NAV,
  FARM_ORDERS_NAV,
  type NavItem,
} from "@/components/common/Portal";
import { portalVi } from "@/data/portalTranslations";
import { SiteHeader } from "./SiteHeader";
import { NavigationContext, useNavIndicator } from "./NavigationContext";
import "./WorkspaceFrame.css";

function WorkspaceSidebar({
  user,
  expanded,
  language,
  close,
}: {
  user: User;
  expanded: boolean;
  language: Lang;
  close: () => void;
}) {
  const { hash } = useHash();
  const items: NavItem[] = [
    { label: "Home", href: "#home", icon: "dash" },
    ...ROLE_NAV[user.role],
    ...(user.role === "Buyer"
      ? [
          {
            label: "Orders",
            href: "#marketplace/orders",
            icon: "bag" as const,
          },
          { label: "Cart", href: "#marketplace/cart", icon: "bag" as const },
          FARM_ORDERS_NAV,
        ]
      : []),
    ...ACCOUNT_NAV,
  ];
  const rawRoute = (hash || "#home").split("?")[0];
  const route = /^#seller\/(edit|listing)\//.test(rawRoute)
    ? "#seller/listings"
    : rawRoute;
  const matched =
    items
      .filter((i) => route === i.href || route.startsWith(i.href + "/"))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? "";
  const { ref, style } = useNavIndicator(matched);
  const label = (s: string) =>
    language === "vi"
      ? ({
          Home: "Trang chủ",
          Cart: "Giỏ hàng",
          Orders: "Đơn mua cá",
          "Farm a Fish": "Đặt nuôi cá",
          "Farming Orders": "Đơn đặt nuôi",
          ...portalVi,
        }[s] ?? s)
      : s;
  return (
    <aside
      id="workspace-sidebar"
      className="workspace-sidebar"
      aria-label={`${user.role} dashboard`}
      data-expanded={expanded}
      data-no-translate
    >
      <nav ref={ref} className="workspace-nav" aria-label="Dashboard">
        <span
          aria-hidden="true"
          className="workspace-indicator"
          style={style}
        />
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            title={label(item.label)}
            aria-label={label(item.label)}
            aria-current={matched === item.href ? "page" : undefined}
            onClick={() => {
              if (window.matchMedia("(max-width: 760px)").matches) close();
            }}
          >
            <Icon name={item.icon} />
            <span className="workspace-label">{label(item.label)}</span>
          </a>
        ))}
      </nav>
    </aside>
  );
}
export function WorkspaceFrame({
  user,
  language,
  setLanguage,
  children,
}: {
  user: User | null;
  language: Lang;
  setLanguage: (l: Lang) => void;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    setExpanded(false);
  }, [user?.email]);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExpanded(false);
        document.getElementById("workspace-toggle")?.focus();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  return (
    <NavigationContext.Provider
      value={{ expanded, toggle: () => setExpanded((v) => !v) }}
    >
      <div
        className={`workspace-frame ${user ? "has-workspace" : ""} ${expanded ? "workspace-expanded" : ""}`}
      >
        <SiteHeader language={language} setLanguage={setLanguage} />
        <div className="workspace-body">
          {user && (
            <WorkspaceSidebar
              user={user}
              expanded={expanded}
              language={language}
              close={() => setExpanded(false)}
            />
          )}
          {user && expanded && (
            <button
              className="workspace-scrim"
              aria-label="Close dashboard"
              onClick={() => {
                setExpanded(false);
                document.getElementById("workspace-toggle")?.focus();
              }}
            />
          )}
          <div className="workspace-content">{children}</div>
        </div>
      </div>
    </NavigationContext.Provider>
  );
}
