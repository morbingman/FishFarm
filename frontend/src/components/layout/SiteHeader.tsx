import "./SiteHeader.css";
import type { Lang } from "@/hooks/useTranslation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { LangSwitch } from "@/hooks/useTranslation";
import { Icon, NotifBell, UserMenu, useHash } from "@/components/common/Portal";
import { useUser } from "@/services/demoStore";
import { useNavigation, useNavIndicator } from "./NavigationContext";
import "@/styles/theme.css";
import "@/styles/AzureTheme.css";
const VI: Record<string, string> = {
  Home: "Trang chủ",
  Categories: "Danh mục",
  "Featured Fish": "Cá nổi bật",
  Sellers: "Nhà bán",
  "How it works": "Cách hoạt động",
  Insights: "Kiến thức",
  "Farm a Fish": "Đặt nuôi cá",
  "Sign In": "Đăng nhập",
  "Safe trading": "Giao dịch an toàn",
  Community: "Cộng đồng",
  "About us": "Về chúng tôi",
  More: "Thêm",
  Marketplace: "Chợ cá",
  "Help & support": "Trợ giúp",
  Privacy: "Quyền riêng tư",
  Terms: "Điều khoản",
  "All rights reserved.": "Bảo lưu mọi quyền.",
};
const tr = (l: Lang, s: string) => (l === "vi" ? (VI[s] ?? s) : s);
const PRIMARY_SECTIONS = [
  { key: "top", label: "Home" },
  { key: "categories", label: "Categories" },
  { key: "featured", label: "Featured Fish" },
  { key: "sellers", label: "Sellers" },
  { key: "how", label: "How it works" },
  { key: "insights", label: "Insights" },
];
const EXTRA_SECTIONS = [
  { key: "safety", label: "Safe trading" },
  { key: "reviews", label: "Community" },
  { key: "about", label: "About us" },
];
const SECTIONS = [...PRIMARY_SECTIONS, ...EXTRA_SECTIONS];
export function SiteHeader({
  language,
  setLanguage,
}: {
  language: Lang;
  setLanguage: (l: Lang) => void;
}) {
  const user = useUser();
  const { hash, parts, params } = useHash();
  const { expanded, toggle } = useNavigation();
  const [mobile, setMobile] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButton = useRef<HTMLButtonElement>(null);
  const moreMenu = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({
    left: 0,
    top: 96,
    maxHeight: 360,
  });
  const [activeSection, setActiveSection] = useState("top");
  const scrollTarget = useRef<string | null>(null);
  const home = !parts[0] || parts[0] === "home";
  const active = home ? activeSection : parts[0] === "farming" ? "farming" : "";
  const { ref, style } = useNavIndicator(active + language);
  useEffect(() => {
    setMobile(false);
    setMoreOpen(false);
  }, [hash]);
  useEffect(() => {
    if (!moreOpen) return;
    const position = () => {
      const nav = ref.current?.getBoundingClientRect();
      const button = moreButton.current?.getBoundingClientRect();
      const header = moreButton.current
        ?.closest("header")
        ?.getBoundingClientRect();
      if (!nav || !button || !header) return;
      setMenuPosition({
        left: Math.max(
          12 - nav.left,
          Math.min(button.left - nav.left, window.innerWidth - 232 - nav.left),
        ),
        top: header.bottom - nav.top + 10,
        maxHeight: Math.max(100, window.innerHeight - header.bottom - 24),
      });
    };
    position();
    moreMenu.current
      ?.querySelector<HTMLAnchorElement>("a")
      ?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (
        !moreMenu.current?.contains(event.target as Node) &&
        !moreButton.current?.contains(event.target as Node)
      )
        setMoreOpen(false);
    };
    const resize = () => {
      if (window.innerWidth <= 1100) setMoreOpen(false);
      else position();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setMoreOpen(false);
        moreButton.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", resize);
    };
  }, [moreOpen, ref]);
  useEffect(() => {
    if (!home) return;
    const target = params.get("section") || "top";
    // Home may be behind Suspense; wait for its actual React section to mount.
    let frame = 0,
      tries = 0;
    const scroll = () => {
      const el = document.getElementById(target);
      if (el) {
        scrollTarget.current = target;
        el.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
          block: "start",
        });
        setActiveSection(target);
      } else if (++tries < 180) frame = requestAnimationFrame(scroll);
    };
    frame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(frame);
  }, [hash, home]);
  useEffect(() => {
    if (!home) return;
    let frame = 0;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      if (scrollTarget.current) return;
      let current = "top";
      for (const section of SECTIONS) {
        const el = document.getElementById(section.key);
        if (el && el.getBoundingClientRect().top <= 170) current = section.key;
      }
      setActiveSection(current);
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
      clearTimeout(settle);
      // Do not slide through every intermediate section during one smooth jump.
      settle = setTimeout(() => {
        scrollTarget.current = null;
        update();
      }, 180);
    };
    const onManualScroll = () => {
      scrollTarget.current = null;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onManualScroll, { passive: true });
    window.addEventListener("touchstart", onManualScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onManualScroll);
      window.removeEventListener("touchstart", onManualScroll);
    };
  }, [home]);
  const navigateSection = (
    e: React.MouseEvent<HTMLAnchorElement>,
    key: string,
  ) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    setMobile(false);
    setMoreOpen(false);
    scrollTarget.current = key;
    setActiveSection(key);
    const href = key === "top" ? "#home" : `#home?section=${key}`;
    if (window.location.hash === href) {
      e.preventDefault();
      document.getElementById(key)?.scrollIntoView({ behavior: "smooth" });
    }
  };
  return (
    <header
      className="ds-header ribbon-header"
      data-theme="azure-v3"
      data-no-translate
    >
      <div className="ds-header-in">
        {user && (
          <button
            id="workspace-toggle"
            className="workspace-toggle"
            aria-label={
              language === "vi"
                ? "Mở hoặc thu gọn dashboard"
                : "Toggle dashboard"
            }
            aria-expanded={expanded}
            aria-controls="workspace-sidebar"
            onClick={toggle}
          >
            <Menu size={21} />
          </button>
        )}
        <a className="ds-brand" href="#home" aria-label="FISHMARKET home">
          <span>
            <Icon name="fish" />
          </span>
          <strong>FISHMARKET</strong>
        </a>
        <nav className="ds-nav" aria-label="Main" ref={ref}>
          <span className="nav-indicator" style={style} aria-hidden="true" />
          {PRIMARY_SECTIONS.map((s) => (
            <a
              key={s.key}
              href={s.key === "top" ? "#home" : `#home?section=${s.key}`}
              onClick={(e) => navigateSection(e, s.key)}
              className={active === s.key ? "on" : ""}
              aria-current={active === s.key ? "location" : undefined}
            >
              {tr(language, s.label)}
            </a>
          ))}
          <button
            ref={moreButton}
            type="button"
            className={`nav-more ${EXTRA_SECTIONS.some((s) => s.key === active) ? "on" : ""}`}
            data-nav-active={EXTRA_SECTIONS.some((s) => s.key === active)}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            aria-controls="ribbon-more-menu"
            onClick={() => setMoreOpen((open) => !open)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setMoreOpen(true);
              }
            }}
          >
            {tr(language, "More")}
          </button>
          {moreOpen && (
            <div
              id="ribbon-more-menu"
              ref={moreMenu}
              className="ribbon-more-menu ribbon-inline-menu"
              role="menu"
              aria-label={tr(language, "More")}
              style={menuPosition}
              data-no-translate
              onKeyDown={(event) => {
                const links = Array.from(
                  moreMenu.current?.querySelectorAll<HTMLAnchorElement>("a") ??
                    [],
                );
                const index = links.indexOf(
                  document.activeElement as HTMLAnchorElement,
                );
                if (
                  ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
                ) {
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? links.length - 1
                        : (index +
                            (event.key === "ArrowDown" ? 1 : -1) +
                            links.length) %
                          links.length;
                  links[next]?.focus({ preventScroll: true });
                } else if (event.key === "Tab") setMoreOpen(false);
              }}
            >
              {EXTRA_SECTIONS.map((section) => (
                <a
                  key={section.key}
                  role="menuitem"
                  tabIndex={-1}
                  href={`#home?section=${section.key}`}
                  onClick={(event) => navigateSection(event, section.key)}
                >
                  {tr(language, section.label)}
                </a>
              ))}
            </div>
          )}
          {(!user || user.role === "Buyer") && (
            <a
              className={`farm-nav-cta ${active === "farming" ? "on" : ""}`}
              href="#farming"
              aria-current={active === "farming" ? "page" : undefined}
            >
              {tr(language, "Farm a Fish")} <Icon name="arrow" size={14} />
            </a>
          )}
        </nav>
        <div className="ds-header-right">
          <LangSwitch language={language} setLanguage={setLanguage} />
          {user ? (
            <>
              <NotifBell user={user} language={language} />
              <UserMenu user={user} />
            </>
          ) : (
            <a className="sl-btn sl-btn-primary" href="#login">
              {tr(language, "Sign In")}
            </a>
          )}
          <button
            className="section-menu-toggle"
            aria-label="Homepage sections"
            aria-expanded={mobile}
            aria-controls="mobile-sections"
            onClick={() => setMobile((v) => !v)}
          >
            {mobile ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {mobile && (
        <nav
          id="mobile-sections"
          className="ribbon-mobile-nav"
          aria-label="Homepage sections"
        >
          {SECTIONS.map((s) => (
            <a
              key={s.key}
              href={s.key === "top" ? "#home" : `#home?section=${s.key}`}
              aria-current={active === s.key ? "location" : undefined}
              onClick={(e) => navigateSection(e, s.key)}
            >
              {tr(language, s.label)}
            </a>
          ))}
          {(!user || user.role === "Buyer") && (
            <a href="#farming">{tr(language, "Farm a Fish")}</a>
          )}
        </nav>
      )}
    </header>
  );
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
  );
}
