import { useEffect } from "react";
import type { User } from "@/services/demoStore";
import type { Lang } from "@/hooks/useTranslation";
import {
  PortalShell,
  StateBlock,
  useToast,
  useHash,
} from "@/components/common/Portal";
import { portalVi } from "@/data/portalTranslations";
import { Users } from "@/pages/admin/Users";
import { Listings } from "@/pages/seller/Listings";
import { ListingForm } from "@/pages/seller/ListingForm";
import { Detail } from "@/pages/seller/Detail";
import { Bookings } from "./Bookings";
import { PurchaseOrders } from "./PurchaseOrders";
import { vi, xvi } from "@/data/sellerData";
import "./AdminWorkspace.css";
export default function Admin({
  user,
  language,
  setLanguage,
}: {
  user: User;
  language: Lang;
  setLanguage: (l: Lang) => void;
}) {
  const dictionary = {
    ...portalVi,
    ...vi,
    ...xvi,
    "Seller Center": language === "vi" ? "Quản lý cá" : "Fish management",
    "My Listings": language === "vi" ? "Danh sách cá" : "Fish listings",
    "Back to My Listings":
      language === "vi" ? "Về danh sách cá" : "Back to fish listings",
    "+ Add New Fish": language === "vi" ? "Thêm cá mới" : "Add fish",
  };
  const text = (value: string) =>
    language === "vi"
      ? (dictionary[value as keyof typeof dictionary] ?? value)
      : ({
          "Seller Center": "Fish management",
          "My Listings": "Fish listings",
          "+ Add New Fish": "Add fish",
          "Back to My Listings": "Back to fish listings",
        }[value] ?? value);
  const { parts, params } = useHash();
  const [toast, show] = useToast();
  const sec = parts[1] ?? "";
  useEffect(() => {
    if (sec === "") window.location.replace("#admin/listings");
    if (sec === "roles") window.location.replace("#admin/users");
    if (sec === "queue" || sec === "review" || sec === "activity")
      window.location.replace("#admin/listings");
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [sec, parts[2]]);
  const active = sec === "" ? "#admin/listings" : `#admin/${sec}`;
  let body;
  if (sec === "") body = <Listings user={user} t={text} initTab="all" />;
  else if (sec === "users") body = <Users user={user} show={show} />;
  else if (sec === "listings")
    body = (
      <Listings user={user} t={text} initTab={params.get("tab") ?? "all"} />
    );
  else if (sec === "add")
    body = <ListingForm key="new" user={user} t={text} show={show} />;
  else if (sec === "edit" && parts[2])
    body = (
      <ListingForm
        key={parts[2]}
        id={parts[2]}
        user={user}
        t={text}
        show={show}
      />
    );
  else if (sec === "listing" && parts[2])
    body = (
      <Detail
        key={parts[2]}
        id={parts[2]}
        user={user}
        t={text}
        show={show}
        published={params.get("published") === "1"}
      />
    );
  else if (sec === "bookings") body = <Bookings id={parts[2]} show={show} />;
  else if (sec === "orders")
    body = <PurchaseOrders id={parts[2]} show={show} />;
  else if (sec === "roles") body = <Users user={user} show={show} />;
  else
    body = (
      <StateBlock
        card
        icon="search"
        tone="info"
        title="Page not found"
        body="This admin page doesn't exist."
        actions={
          <a className="sl-btn sl-btn-primary" href="#admin/listings">
            Back to fish management
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
      dict={portalVi}
      badges={{}}
      toast={toast}
    >
      {body}
    </PortalShell>
  );
}
