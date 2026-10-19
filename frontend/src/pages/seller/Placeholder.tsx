import type { TFn } from "@/data/sellerData";
import { Crumbs, StateBlock } from "@/components/common/Portal";
import { PLACE } from "@/data/sellerData";
export function Placeholder({ sec, t }: { sec: string; t: TFn }) {
  const [ic, title, body] = PLACE[sec];
  return (
    <>
      <Crumbs items={[[t("Seller Center"), "#seller"], [t(title)]]} />
      <div className="sl-page-head">
        <div>
          <h1>{t(title)}</h1>
        </div>
      </div>
      <section className="sl-card">
        <StateBlock
          icon={ic === "bag" ? "bag" : "inbox"}
          tone="info"
          title={`${t(title)}: ${t("Nothing here yet")}`}
          body={t(body)}
          actions={
            <a className="sl-btn sl-btn-primary" href="#seller/listings">
              {t("My Listings")}
            </a>
          }
        />
      </section>
    </>
  );
}
