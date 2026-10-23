import type { User } from "@/services/demoStore";
import type { Lang } from "@/hooks/useTranslation";
import {
  PortalShell,
  StateBlock,
  useToast,
  useHash,
} from "@/components/common/Portal";
import { notifsFor, useStore } from "@/services/demoStore";
import { portalVi } from "@/data/portalTranslations";
import FarmingOrders from "@/pages/farming/FarmingOrders";
import { Profile } from "@/pages/account/Profile";
import { Settings } from "@/pages/account/Settings";
import { Notifications } from "@/pages/account/Notifications";
import { History } from "@/pages/account/History";
export default function Account({
  user,
  language,
  setLanguage,
}: {
  user: User;
  language: Lang;
  setLanguage: (l: Lang) => void;
}) {
  const { parts } = useHash();
  const [toast, show] = useToast();
  const sec = parts[1] ?? "profile";
  const accountDetails = sec === "profile" || sec === "settings";
  const body = accountDetails ? (
    <>
      <Profile user={user} show={show} />
      <Settings
        embedded
        user={user}
        language={language}
        setLanguage={setLanguage}
        show={show}
      />
    </>
  ) : sec === "notifications" ? (
    <Notifications user={user} language={language} />
  ) : sec === "activity" ? (
    <History user={user} />
  ) : sec === "farming-orders" && user.role === "Buyer" ? (
    <FarmingOrders user={user} language={language} show={show} />
  ) : (
    <StateBlock
      card
      icon="search"
      tone="info"
      title="Page not found"
      body="This account page doesn't exist."
      actions={
        <a className="sl-btn sl-btn-primary" href="#account/profile">
          Go to profile
        </a>
      }
    />
  );
  const unread = notifsFor(useStore(), user).filter((n) => !n.read).length;
  return (
    <PortalShell
      user={user}
      active={`#account/${accountDetails ? "profile" : sec}`}
      language={language}
      setLanguage={setLanguage}
      dict={portalVi}
      badges={{
        "#account/notifications": unread,
      }}
      toast={toast}
    >
      {body}
    </PortalShell>
  );
}
