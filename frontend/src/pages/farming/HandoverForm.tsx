import type { Order } from "@/services/farmingStore";
import type { Lang } from "@/hooks/useTranslation";
import { Button as UiButton } from "@/components/ui/button";
import { Input as UiInput } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { useState } from "react";
import { Icon } from "@/components/common/Portal";
import {
  fishById,
  fmtMoney,
  requestHandover,
  type Delivery,
} from "@/services/farmingStore";
import { Modal, Req, useT } from "@/components/farming/FarmingParts";
import { isoDay } from "@/data/farmingOrderData";
export function HandoverForm({
  o,
  language,
  onClose,
  onDone,
}: {
  o: Order;
  language: Lang;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT(language);
  const f = fishById(o.fishId)!;
  const [method, setMethod] = useState<Delivery>(
    o.delivery === "delivery" && f.deliveryAreas.length ? "delivery" : "pickup",
  );
  const [date, setDate] = useState(isoDay(3));
  const [address, setAddress] = useState(o.address);
  const [tried, setTried] = useState(false);
  const err: Record<string, string> = {};
  if (!date || date < isoDay(2))
    err.date = t(
      "Chọn ngày từ 2 ngày kể từ hôm nay.",
      "Choose a date at least 2 days from today.",
    );
  if (method === "delivery" && address.trim().length < 6)
    err.address = t(
      "Nhập địa chỉ giao hàng đầy đủ.",
      "Enter a full delivery address.",
    );
  const submit = () => {
    setTried(true);
    if (Object.keys(err).length) return;
    if (
      requestHandover(o.id, {
        method,
        date,
        address:
          method === "pickup"
            ? t("Trang trại FISHMARKET", "FISHMARKET farm")
            : address.trim(),
      })
    )
      onDone();
  };
  return (
    <Modal title={t("Yêu cầu nhận cá", "Request handover")} onClose={onClose}>
      <div className="fm-form">
        <div className="fm-seg">
          <UiLabel className="fm-check">
            <UiInput
              type="radio"
              name="hm"
              checked={method === "pickup"}
              onChange={() => setMethod("pickup")}
            />
            <div>
              <b>{t("Nhận tại trang trại", "Farm pickup")}</b>
            </div>
          </UiLabel>
          {f.deliveryAreas.length > 0 && (
            <UiLabel className="fm-check">
              <UiInput
                type="radio"
                name="hm"
                checked={method === "delivery"}
                onChange={() => setMethod("delivery")}
              />
              <div>
                <b>{t("Giao tận nơi", "Home delivery")}</b>
              </div>
            </UiLabel>
          )}
        </div>
        <UiLabel className={`sl-field ${tried && err.date ? "bad" : ""}`}>
          <span>
            {t("Ngày mong muốn", "Preferred date")}
            <Req />
          </span>
          <UiInput
            type="date"
            min={isoDay(2)}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          {tried && err.date && <em role="alert">{err.date}</em>}
        </UiLabel>
        {method === "delivery" && (
          <UiLabel className={`sl-field ${tried && err.address ? "bad" : ""}`}>
            <span>
              {t("Địa chỉ giao hàng", "Delivery address")}
              <Req />
            </span>
            <UiInput
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            {tried && err.address && <em role="alert">{err.address}</em>}
          </UiLabel>
        )}
        <div className="fm-note">
          <Icon name="info" size={16} />
          <span>
            {t(
              `Số dư ${fmtMoney(o.balance, language)} thanh toán khi nhận cá.`,
              `The ${fmtMoney(o.balance, language)} balance is paid at handover.`,
            )}
          </span>
        </div>
      </div>
      <div className="pt-modal-actions">
        <UiButton
          variant="plain"
          className="sl-btn sl-btn-ghost"
          onClick={onClose}
        >
          {t("Hủy", "Cancel")}
        </UiButton>
        <UiButton
          variant="plain"
          className="sl-btn sl-btn-primary"
          onClick={submit}
        >
          {t("Gửi yêu cầu", "Send request")}
        </UiButton>
      </div>
    </Modal>
  );
}
