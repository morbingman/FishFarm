import type { Fish } from "@/services/farmingStore";
import type { Lang } from "@/hooks/useTranslation";
import { type CSSProperties } from "react";
import "./FishCard.css";
import { Button as UiButton } from "@/components/ui/button";
import {
  AVAIL_LABEL,
  CAT_LABEL,
  KIND_LABEL,
  WATER_LABEL,
  availOf,
  canBook,
  fmtMoney,
  fmtNum,
  L,
  remaining,
  useFarming,
} from "@/services/farmingStore";
import { Badge, useT } from "@/components/farming/FarmingParts";
import { AV_TONE } from "@/data/farmingFilters";
export function FishCard({ fish, language }: { fish: Fish; language: Lang }) {
  const t = useT(language);
  const s = useFarming();
  const a = availOf(fish, s);
  const rem = remaining(fish, s);
  const ok = canBook(a);
  const pct = fish.paused ? 0 : Math.round((rem / fish.total) * 100);
  return (
    <article className={`fm-card ${ok ? "" : "off"}`}>
      <a
        className="fm-img"
        href={`#farming/${fish.id}`}
        aria-label={`${t("Xem chi tiết", "View details")}: ${L(fish.name, language)}`}
      >
        <img
          src={fish.photos[0]}
          alt={`${L(fish.name, language)}`}
          loading="lazy"
        />
        <Badge tone={AV_TONE[a]}>{L(AVAIL_LABEL[a], language)}</Badge>
      </a>
      <div className="fm-body">
        <div>
          <h3 className="fm-title">
            <a href={`#farming/${fish.id}`} className="fish-card-view-2">
              {L(fish.name, language)}
            </a>
          </h3>
          <div className="fm-tags">
            <span className="fm-tag teal">
              {L(CAT_LABEL[fish.category], language)}
            </span>
            <span className="fm-tag">{L(KIND_LABEL[fish.kind], language)}</span>
            <span className="fm-tag">
              {L(WATER_LABEL[fish.water], language)}
            </span>
          </div>
        </div>
        <dl className="fm-facts">
          <div>
            <dt>{t("Giai đoạn", "Stage")}</dt>
            <dd>{L(fish.stage, language)}</dd>
          </div>
          <div>
            <dt>
              {fish.singleFish
                ? t("Mục tiêu", "Target")
                : t("Thời gian nuôi", "Duration")}
            </dt>
            <dd>
              {fish.singleFish
                ? `${fish.sizeTarget} cm`
                : t(`~${fish.months} tháng`, `~${fish.months} months`)}
            </dd>
          </div>
        </dl>
        <div className="fm-price">
          <div>
            <small>
              {fish.singleFish
                ? t("Chi phí đầu tư nuôi", "Sponsorship cost")
                : t("Giá cá giống từ", "Fish from")}
            </small>
            <b>{fmtMoney(fish.fishPrice, language)}</b>
            {!fish.singleFish && <small>{t("/ con", "/ fish")}</small>}
          </div>
          {!fish.singleFish && (
            <div className="fish-card-view-4">
              <small>{t("Phí nuôi ước tính", "Est. farming fee")}</small>
              <b>{fmtMoney(fish.care, language)}</b>
              <small>{t("/ con / tháng", "/ fish / month")}</small>
            </div>
          )}
        </div>
        <div className="fm-cap">
          <div>
            <span>
              {fish.singleFish
                ? t("Trạng thái đầu tư", "Sponsorship status")
                : t("Chỗ nuôi còn lại", "Capacity left")}
            </span>
            <b className="fish-card-view-6">
              {fish.singleFish
                ? ok
                  ? t("Đang nhận đầu tư", "Open")
                  : t("Đã có người đầu tư", "Sponsored")
                : fish.paused
                  ? "—"
                  : `${fmtNum(rem, language)} / ${fmtNum(fish.total, language)}`}
            </b>
          </div>
          <div
            className={`fm-meter ${a === "limited" ? "warn" : ok ? "" : "off"}`}
            role="img"
            aria-label={`${pct}%`}
          >
            <i
              style={
                {
                  "--fish-card-layout-7-width": `${pct}%`,
                } as CSSProperties
              }
              className="fish-card-view-8"
            />
          </div>
        </div>
        <div className="fm-card-actions">
          <a className="sl-btn sl-btn-ghost" href={`#farming/${fish.id}`}>
            {t("Xem chi tiết", "View details")}
          </a>
          {ok ? (
            <a
              className="sl-btn sl-btn-primary"
              href={`#farming/booking?fish=${fish.id}`}
            >
              {fish.singleFish
                ? t("Đầu tư nuôi", "Sponsor fish")
                : t("Đặt nuôi", "Book now")}
            </a>
          ) : (
            <UiButton
              variant="plain"
              className="sl-btn sl-btn-primary"
              disabled
              title={L(AVAIL_LABEL[a], language)}
            >
              {fish.singleFish
                ? t("Đã được đầu tư", "Sponsored")
                : t("Đặt nuôi", "Book now")}
            </UiButton>
          )}
        </div>
      </div>
    </article>
  );
}

/* ---------------------------------- detail ---------------------------------- */
