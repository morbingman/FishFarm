import type { Lang } from "@/hooks/useTranslation";
import { type CSSProperties } from "react";
import "./FarmingOrders.css";
import { StateBlock, useLoading, useHash } from "@/components/common/Portal";
import { ordersOf, useFarming } from "@/services/farmingStore";
import { useT } from "@/components/farming/FarmingParts";
import { OrderDetail } from "@/pages/farming/OrderDetail";
import { OrderList } from "@/pages/farming/OrderList";
export default function FarmingOrders({
  user,
  language,
  show,
}: {
  user: {
    email: string;
    name: string;
    phone: string;
  };
  language: Lang;
  show: (m: string) => void;
}) {
  const { parts } = useHash();
  const s = useFarming();
  const loading = useLoading(450);
  const id = parts[2];
  const t = useT(language);
  const mine = ordersOf(s, user.email);
  if (id) {
    const o = mine.find((x) => x.id === id);
    if (loading)
      return (
        <div className="sl-card pad" aria-busy="true">
          <div className="farming-orders-view-2">
            {[60, 90, 75].map((w) => (
              <div
                key={w}
                className="pt-skel farming-orders-view-4"
                style={
                  {
                    "--farming-orders-layout-3-width": `${w}%`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        </div>
      );
    if (!o)
      return (
        <StateBlock
          card
          icon="search"
          tone="info"
          title={t("Không tìm thấy đơn nuôi", "Farming order not found")}
          body={t(
            "Đơn này không tồn tại hoặc không thuộc tài khoản của bạn.",
            "This order doesn't exist or doesn't belong to your account.",
          )}
          actions={
            <a className="sl-btn sl-btn-primary" href="#account/farming-orders">
              {t("Về danh sách đơn", "Back to orders")}
            </a>
          }
        />
      );
    return <OrderDetail o={o} language={language} show={show} />;
  }
  return <OrderList orders={mine} loading={loading} language={language} />;
}

/* ---------------------------------- list ---------------------------------- */
