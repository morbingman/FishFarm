import { useEffect } from "react";
import type { User } from "@/services/demoStore";
import type { Lang } from "@/hooks/useTranslation";
import {
  PortalShell,
  StateBlock,
  useToast,
  useHash,
} from "@/components/common/Portal";
import { useStore } from "@/services/demoStore";
import { portalVi } from "@/data/portalTranslations";
import { Overview } from "@/pages/admin/Overview";
import { Queue } from "@/pages/admin/Queue";
import { Review } from "@/pages/admin/Review";
import { Users } from "@/pages/admin/Users";
import { ActivityLog } from "@/pages/admin/ActivityLog";
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
  const s = useStore();
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
  const pending = s.listings.filter((l) => l.status === "pending").length;
  const sec = parts[1] ?? "";
  useEffect(() => {
    if (sec === "roles") window.location.replace("#admin/users");
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [sec, parts[2]]);
  const active =
    sec === "" ? "#admin" : sec === "review" ? "#admin/queue" : `#admin/${sec}`;
  let body;
  if (sec === "") body = <Overview />;
  else if (sec === "queue")
    body = (
      <Queue
        key={params.get("tab") ?? "pending"}
        initTab={params.get("tab") ?? "pending"}
      />
    );
  else if (sec === "review" && parts[2])
    body = <Review key={parts[2]} id={parts[2]} user={user} show={show} />;
  else if (sec === "users") body = <Users user={user} show={show} />;
  else if (sec === "activity") body = <ActivityLog />;
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
        submitted={params.get("submitted") === "1"}
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
          <a className="sl-btn sl-btn-primary" href="#admin">
            Back to overview
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
      badges={{
        "#admin/queue": pending,
      }}
      toast={toast}
    >
      {body}
    </PortalShell>
  );
}
