import type { User } from "@/services/demoStore";
import type { Lang } from "@/hooks/useTranslation";
import { PortalShell, useToast, useHash } from "@/components/common/Portal";
import { portalVi } from "@/data/portalTranslations";
import { Catalog } from "@/pages/farming/Catalog";
import { Booking } from "@/pages/farming/Booking";
import { Detail } from "@/pages/farming/Detail";
export default function Farming({
  user,
  language,
  setLanguage,
}: {
  user: User;
  language: Lang;
  setLanguage: (l: Lang) => void;
}) {
  const { parts, params } = useHash();
  const [toast, show] = useToast();
  const sub = parts[1];
  const body = !sub ? (
    <Catalog language={language} user={user} />
  ) : sub === "booking" ? (
    <Booking
      key={params.get("fish") ?? "x"}
      user={user}
      language={language}
      fishId={params.get("fish")}
      show={show}
    />
  ) : (
    <Detail id={sub} language={language} />
  );
  return (
    <PortalShell
      user={user}
      active="#farming"
      language={language}
      setLanguage={setLanguage}
      dict={portalVi}
      toast={toast}
    >
      {body}
    </PortalShell>
  );
}

/* ---------------------------------- catalog ---------------------------------- */
