import type { Fish, Pkg, Delivery, Quote } from "@/services/farmingStore";
import type { Lang } from "@/hooks/useTranslation";
import "./Summary.css";
import { Icon } from "@/components/common/Portal";
import {
  ADDONS,
  PKG_LABEL,
  RULES,
  fmtMoney,
  fmtNum,
  L,
} from "@/services/farmingStore";
import { useT } from "@/components/farming/FarmingParts";
export function Summary({
  fish,
  qty,
  pkg,
  addons,
  delivery,
  q,
  language,
  step,
}: {
  fish: Fish;
  qty: number;
  pkg: Pkg;
  addons: string[];
  delivery: Delivery;
  q: Quote;
  language: Lang;
  step: number;
}) {
  const t = useT(language);
  return (
    <div>
      <h3>{t("Tóm tắt đơn", "Order summary")}</h3>
      <div className="fm-sum-fish">
        <img src={fish.photos[0]} alt="" />
        <div>
          <b>{L(fish.name, language)}</b>
          <small>
            {fmtNum(qty, language)} {t("con", "fish")} ·{" "}
            {t(`~${fish.months} tháng`, `~${fish.months} mo.`)}
          </small>
        </div>
      </div>
      <div className="fm-line">
        <span>{t("Tiền cá", "Fish subtotal")}</span>
        <b>{fmtMoney(q.fishSubtotal, language)}</b>
      </div>
      <div className="fm-line">
        <span>{L(PKG_LABEL[pkg], language)}</span>
        <b>
          {pkg === "custom" && addons.length === 0
            ? "—"
            : fmtMoney(q.serviceCost, language)}
        </b>
      </div>
      {q.addonLines.map((l) => (
        <div key={l.id} className="fm-line sub">
          <span>+ {L(ADDONS.find((a) => a.id === l.id)!.name, language)}</span>
          <b>{fmtMoney(l.amount, language)}</b>
        </div>
      ))}
      <div className="fm-line">
        <span>{t("Phí giao hàng (ước tính)", "Delivery fee (est.)")}</span>
        <b>
          {delivery === "delivery"
            ? fmtMoney(q.deliveryFee, language)
            : step < 3
              ? t("Chọn ở bước 3", "Set in step 3")
              : t("Miễn phí", "Free")}
        </b>
      </div>
      <div className="fm-line hr">
        <span>{t("Tổng ước tính", "Estimated total")}</span>
        <b>{fmtMoney(q.total, language)}</b>
      </div>
      <div className="fm-line big">
        <span>{t("Đặt cọc hôm nay", "Deposit due now")}</span>
        <b>{fmtMoney(q.deposit, language)}</b>
      </div>
      <div className="fm-line">
        <span>{t("Số dư còn lại", "Remaining balance")}</span>
        <b>{fmtMoney(q.balance, language)}</b>
      </div>
      <p className="summary-view-2">
        {t(
          "Lịch thanh toán: đặt cọc ngay; số dư thanh toán khi nhận cá. Tiền cọc nằm trong tổng đơn, không thu hai lần.",
          "Schedule: deposit now; balance at handover. The deposit is part of the total and is never charged twice.",
        )}
      </p>
      <p className="fm-demo-note summary-view-4">
        <Icon name="info" size={14} />
        {t(
          `Tỷ lệ cọc ${Math.round(RULES.depositRate * 100)}% (tối thiểu 100.000 ₫) là cấu hình demo.`,
          `${Math.round(RULES.depositRate * 100)}% deposit rate (min 100,000 ₫) is a demo configuration.`,
        )}
      </p>
    </div>
  );
}
