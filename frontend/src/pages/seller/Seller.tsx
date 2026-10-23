import type { User } from "@/services/demoStore";
import type { Lang } from "@/hooks/useTranslation";
import type { TFn } from "@/data/sellerData";
import { useEffect, useMemo } from "react";
import "@/pages/seller/Seller.css";
import { portalVi } from "@/data/portalTranslations";
import {
  StateBlock,
  useHash,
  useToast,
  PortalShell,
} from "@/components/common/Portal";
import { vi, xvi } from "@/data/sellerData";
import { Dashboard } from "@/pages/seller/Dashboard";
import { Listings } from "@/pages/seller/Listings";
import { ListingForm } from "@/pages/seller/ListingForm";
import { Detail } from "@/pages/seller/Detail";
import { Placeholder } from "@/pages/seller/Placeholder";
export function Seller({
  user,
  language,
  setLanguage,
}: {
  user: User;
  language: Lang;
  setLanguage: (l: Lang) => void;
}) {
  const dict = useMemo(
    () => ({
      ...portalVi,
      ...vi,
      ...xvi,
    }),
    [],
  );
  const t: TFn = (s) => (language === "vi" ? (dict[s] ?? s) : s);
  const { parts, params } = useHash();
  const [toast, show] = useToast();
  const sec = parts[1] ?? "";
  const id = parts[2];
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    window.scrollTo({
      top: 0,
    });
  }, [sec, id]);
  const active =
    sec === ""
      ? "#seller"
      : sec === "listings" || sec === "listing" || sec === "edit"
        ? "#seller/listings"
        : `#seller/${sec}`;
  let body;
  if (sec === "") body = <Dashboard user={user} t={t} />;
  else if (sec === "listings")
    body = (
      <Listings
        user={user}
        t={t}
        initTab={params.get("tab") ?? "all"}
        key={params.get("tab") ?? "all"}
      />
    );
  else if (sec === "add")
    body = <ListingForm key="new" user={user} t={t} show={show} />;
  else if (sec === "edit" && id)
    body = <ListingForm key={id} user={user} id={id} t={t} show={show} />;
  else if (sec === "listing" && id)
    body = (
      <Detail
        key={id}
        user={user}
        id={id}
        t={t}
        show={show}
        published={params.get("published") === "1"}
      />
    );
  else if (
    ["orders", "customers", "messages", "analytics", "reviews"].includes(sec)
  )
    body = <Placeholder sec={sec} t={t} />;
  else
    body = (
      <StateBlock
        icon="search"
        tone="warn"
        title={t("Listing not found")}
        body={t("It may have been deleted or you may not have access to it.")}
        actions={
          <a className="sl-btn sl-btn-primary" href="#seller">
            {t("Dashboard")}
          </a>
        }
      />
    );
  return (
    <PortalShell
      user={user}
      active={active}
      language={language}
      setLanguage={setLanguage}
      dict={dict}
      toast={toast}
    >
      {body}
    </PortalShell>
  );
}
export default Seller;
