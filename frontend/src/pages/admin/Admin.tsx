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
import { Roles } from "@/pages/admin/Roles";
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
  const { parts, params } = useHash();
  const [toast, show] = useToast();
  const pending = s.listings.filter((l) => l.status === "pending").length;
  const sec = parts[1] ?? "";
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
  else if (sec === "roles") body = <Roles />;
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
