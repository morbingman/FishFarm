import type { User, Listing } from "@/services/demoStore";
import type { TFn } from "@/data/sellerData";
import type { IconName } from "@/components/seller/SellerParts";
import "./Dashboard.css";
import {
  Skeleton,
  StateBlock,
  STATUS_LABEL,
  useLoading,
} from "@/components/common/Portal";
import { SAMPLE_PHOTOS } from "@/services/demoStore";
import { useMine, Icon, Table } from "@/components/seller/SellerParts";
export function Dashboard({ user, t }: { user: User; t: TFn }) {
  const mine = useMine(user);
  const loading = useLoading(450);
  const c = (f: (l: Listing) => boolean) => mine.filter(f).length;
  const views = mine.reduce((n, l) => n + l.views, 0);
  const stats: [string, string, IconName, string][] = [
    [
      "Active listings",
      String(c((l) => l.status === "approved")),
      "list",
      "#seller/listings?tab=approved",
    ],
    [
      "Awaiting review",
      String(c((l) => l.status === "pending")),
      "clock",
      "#seller/listings?tab=pending",
    ],
    [
      "Needs attention",
      String(c((l) => l.status === "changes" || l.status === "rejected")),
      "alert",
      "#seller/listings?tab=attention",
    ],
    ["Total views", views.toLocaleString(), "eye", "#seller/listings"],
  ];
  const todo = mine
    .filter((l) => ["changes", "rejected", "draft"].includes(l.status))
    .slice(0, 4);
  return (
    <>
      <div className="sl-page-head">
        <div>
          <span className="sl-eyebrow">{t("Seller Center")}</span>
          <h1>
            {t("Good Morning, Golden Koi Farm").replace(
              "Golden Koi Farm",
              user.store || user.name,
            )}
          </h1>
          <p>{t("Here is what is happening in your store today.")}</p>
        </div>
        <a
          className="sl-btn sl-btn-primary lg dashboard-view-2"
          href="#seller/add"
        >
          {t("+ Add New Fish")}
        </a>
      </div>
      <div className="sl-stats">
        {stats.map(([label, val, ic, href]) => (
          <a className="sl-stat dashboard-view-4" key={label} href={href}>
            <div className="sl-stat-top">
              <span>
                <Icon name={ic} />
              </span>
            </div>
            <strong>{val}</strong>
            <small>{t(label)}</small>
          </a>
        ))}
      </div>
      <div className="sl-dash-grid">
        <section className="sl-card">
          <div className="sl-card-head">
            <h2>{t("Recent listings")}</h2>
            <a className="sl-link" href="#seller/listings">
              {t("View all")}
            </a>
          </div>
          {loading ? (
            <Skeleton rows={4} />
          ) : mine.length === 0 ? (
            <StateBlock
              icon="inbox"
              tone="info"
              title={t("No listings yet")}
              body={t(
                "Create your first listing to start selling on FISHMARKET.",
              )}
              actions={
                <a className="sl-btn sl-btn-primary" href="#seller/add">
                  {t("Add New Fish")}
                </a>
              }
            />
          ) : (
            <Table rows={mine.slice(0, 4)} t={t} vi={t("Live") !== "Live"} />
          )}
        </section>
        <aside className="sl-promo">
          <img src={SAMPLE_PHOTOS[1].url} alt="Koi in a clear pond" />
          <div>
            <h2>{t("Next actions")}</h2>
            {todo.length === 0 ? (
              <p>
                {t("Every listing is reviewed by our team before going live.")}
              </p>
            ) : (
              <ul className="dashboard-view-6">
                {todo.map((l) => (
                  <li key={l.id}>
                    <a
                      href={`#seller/listing/${l.id}`}
                      className="dashboard-view-8"
                    >
                      {l.draft.name || l.id}
                    </a>{" "}
                    <small className="dashboard-view-10">
                      · {STATUS_LABEL[l.status]}
                    </small>
                  </li>
                ))}
              </ul>
            )}
            <a
              className="sl-btn sl-btn-light dashboard-view-12"
              href="#seller/add"
            >
              {t("Add New Fish")} <Icon name="arrow" />
            </a>
          </div>
        </aside>
      </div>
    </>
  );
}
