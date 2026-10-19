import "./App.css";
import { WorkspaceFrame } from "@/components/layout/WorkspaceFrame";
import { Button as UiButton } from "@/components/ui/button";
import {
  endSession,
  flash,
  hasSession,
  homeFor,
  remainingMs,
  sessionExpired,
  setReturnTo,
  takeFlash,
  touchSession,
  useUser,
} from "@/services/demoStore";
import {
  AccessDenied,
  NotFound,
  SessionExpired,
} from "@/components/common/Portal";
import { lazy, Suspense, useEffect, useState } from "react";
import { type Language, LanguageContext } from "@/context/LanguageContext";
import { AppContent } from "@/pages/home/Home";
export const Auth = lazy(() => import("@/pages/auth/Auth"));
export const Buyer = lazy(() => import("@/pages/buyer/Buyer"));
export const Seller = lazy(() => import("@/pages/seller/Seller"));
export const Admin = lazy(() => import("@/pages/admin/Admin"));
export const Account = lazy(() => import("@/pages/account/Account"));
export const Farming = lazy(() => import("@/pages/farming/Farming"));
export type View =
  | "farming"
  | "home"
  | "auth"
  | "buyer"
  | "seller"
  | "admin"
  | "account"
  | "expired"
  | "notfound";
export const TOP = new Set([
  "",
  "home",
  "login",
  "marketplace",
  "seller",
  "admin",
  "account",
  "farming",
  "expired",
]);
export const topOf = (h: string) => h.replace(/^#/, "").split(/[/?]/)[0];
export default function App() {
  const user = useUser();
  const [hash, setHash] = useState(() => window.location.hash);
  const [language, setLanguage] = useState<Language>(() =>
    localStorage.getItem("fishmarket-language") === "vi" ? "vi" : "en",
  );
  const [flashMsg, setFlashMsg] = useState("");
  const [warn, setWarn] = useState(false);
  useEffect(() => {
    const onHash = () => {
      const t = topOf(window.location.hash);
      if (!TOP.has(t) && document.getElementById(t)) return;
      setHash(window.location.hash);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    const activity = () => touchSession();
    const events = ["mousedown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) =>
      window.addEventListener(e, activity, {
        passive: true,
      }),
    );
    const id = setInterval(() => {
      if (sessionExpired()) {
        endSession();
        window.location.hash = "expired";
        setWarn(false);
        return;
      }
      setWarn(hasSession() && remainingMs() < 60_000);
    }, 5_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, activity));
      clearInterval(id);
    };
  }, []);
  const top = topOf(hash);
  let view: View = "home";
  let denied: string | null = null;
  if (sessionExpired()) view = "expired";
  else if (top === "login") view = "auth";
  else if (top === "expired") view = "expired";
  else if (top === "" || top === "home") view = "home";
  else if (!TOP.has(top)) view = "notfound";
  else if (!user) view = "auth";
  else if (top === "marketplace") view = "buyer";
  else if (top === "account") view = "account";
  else if (top === "farming") {
    view = "farming";
    if (user.role !== "Buyer") denied = "Buyer";
  } else if (top === "seller") {
    view = "seller";
    if (user.role !== "Seller") denied = "Seller";
  } else {
    view = "admin";
    if (user.role !== "Admin") denied = "Admin";
  }
  const gated =
    !user &&
    TOP.has(top) &&
    ["marketplace", "seller", "admin", "account", "farming"].includes(top);
  useEffect(() => {
    if (gated) {
      setReturnTo(hash.replace(/^#/, ""));
      flash("Please sign in to continue.");
    }
    if (user === null && hasSession()) {
      endSession();
      flash("Your account is no longer active. Contact support.");
      window.location.hash = "login";
    }
  }, [gated, hash, user]);
  useEffect(() => {
    if (view !== "auth") {
      const m = takeFlash();
      if (m) {
        setFlashMsg(m);
        const id = setTimeout(() => setFlashMsg(""), 4200);
        return () => clearTimeout(id);
      }
    }
  }, [view, hash]);
  useEffect(() => {
    localStorage.setItem("fishmarket-language", language);
    document.documentElement.lang = view === "home" ? language : "en";
  }, [language, view]);
  let page;
  if (denied && user)
    page = (
      <AccessDenied
        user={user}
        needs={denied}
        language={language}
        setLanguage={setLanguage}
      />
    );
  else if (view === "home") page = <AppContent />;
  else if (view === "auth")
    page = <Auth language={language} setLanguage={setLanguage} />;
  else if (view === "expired")
    page = <SessionExpired language={language} setLanguage={setLanguage} />;
  else if (view === "notfound")
    page = (
      <NotFound
        language={language}
        setLanguage={setLanguage}
        home={user ? "#" + homeFor(user.role) : "#home"}
      />
    );
  else if (!user) page = null;
  else if (view === "seller")
    page = <Seller user={user} language={language} setLanguage={setLanguage} />;
  else if (view === "admin")
    page = <Admin user={user} language={language} setLanguage={setLanguage} />;
  else if (view === "farming")
    page = (
      <Farming user={user} language={language} setLanguage={setLanguage} />
    );
  else if (view === "account")
    page = (
      <Account user={user} language={language} setLanguage={setLanguage} />
    );
  else
    page = <Buyer user={user} language={language} setLanguage={setLanguage} />;
  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
      }}
    >
      <WorkspaceFrame user={user} language={language} setLanguage={setLanguage}>
        <Suspense
          fallback={
            <div className="app-view-1" role="status">
              Loading FISHMARKET...
            </div>
          }
        >
          {page}
        </Suspense>
      </WorkspaceFrame>
      {flashMsg && (
        <div className="sl-toast" role="status">
          {flashMsg}
        </div>
      )}
      {warn && user && (
        <div role="alert" className="sl-card pad app-view-3">
          <b>Still there?</b>
          <p className="app-view-5">
            You'll be signed out in less than a minute because of inactivity.
          </p>
          <UiButton
            variant="plain"
            className="sl-btn sl-btn-primary"
            onClick={() => {
              touchSession(true);
              setWarn(false);
            }}
          >
            Stay signed in
          </UiButton>
        </div>
      )}
    </LanguageContext.Provider>
  );
}
