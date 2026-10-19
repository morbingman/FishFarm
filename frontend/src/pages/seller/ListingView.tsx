import type { Draft } from "@/services/demoStore";
import type { TFn } from "@/data/sellerData";
import "./ListingView.css";
import { initials } from "@/components/common/Portal";
import { money } from "@/data/sellerData";
import { Icon, Gallery } from "@/components/seller/SellerParts";
export function ListingView({
  draft,
  seller,
  t,
}: {
  draft: Draft;
  seller: string;
  t: TFn;
}) {
  const main =
    draft.images.find((i) => i.id === draft.mainId) ?? draft.images[0];
  const specs: [string, string][] = [
    [t("Age"), draft.age],
    [t("Size"), `${draft.size} cm`],
    [t("Gender"), t(draft.gender)],
    [t("Origin"), t(draft.origin)],
    [t("Health Status"), t(draft.health)],
    [t("Breed"), draft.breed || "—"],
  ];
  return (
    <div className="sl-listing">
      <div className="sl-crumbs">
        {t("Marketplace")} <Icon name="right" /> {t(draft.species)}{" "}
        <Icon name="right" /> <b>{draft.name}</b>
      </div>
      <div className="sl-listing-grid">
        <Gallery imgs={draft.images} main={main} alt={draft.name} />
        <div className="sl-buybox">
          <span className="sl-eyebrow">
            {t(draft.species)}
            {draft.breed && ` · ${draft.breed}`}
          </span>
          <h2>{draft.name}</h2>
          <div className="sl-price-row">
            <strong>{money(draft.price)}</strong>
            {draft.negotiable && (
              <span className="sl-tag">{t("Negotiable price")}</span>
            )}
          </div>
          <div className="sl-quick">
            <div>
              <small>{t("Size")}</small>
              <b>{draft.size} cm</b>
            </div>
            <div>
              <small>{t("Age")}</small>
              <b>{draft.age}</b>
            </div>
            <div>
              <small>{t("Availability")}</small>
              <b className="ok">
                {draft.quantity} {t("in stock")}
              </b>
            </div>
          </div>
          <div className="sl-seller-card">
            <span className="sl-avatar">{initials(seller)}</span>
            <div>
              <b>{seller}</b>
              <span>
                <Icon name="shield" /> {t("Verified Seller")}
              </span>
            </div>
          </div>
          <div className="sl-loc">
            <Icon name="pin" />
            <span>
              {draft.location}, {t(draft.region)}
            </span>
          </div>
          <div className="sl-loc">
            <Icon name="truck" />
            <span>{draft.shipping.map(t).join(" · ")}</span>
          </div>
          <div className="sl-fake-actions">
            <span>{t("Buy now")}</span>
            <span>{t("Contact seller")}</span>
          </div>
        </div>
      </div>
      <div className="sl-listing-body">
        <section>
          <h3>{t("Description")}</h3>
          <p>{draft.description}</p>
        </section>
        <section>
          <h3>{t("Fish Details")}</h3>
          <dl className="sl-specs">
            {specs.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
