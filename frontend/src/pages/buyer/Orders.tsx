import { useBuyer } from "@/context/BuyerContext";
import { BuyButton, Glyph } from "@/components/buyer/BuyerParts";
import { money } from "@/data/buyerData";
export function Orders() {
  const { sales, user, language, viewPurchase, go, heading } = useBuyer();
  const t = (vi: string, en: string) => (language === "vi" ? vi : en);
  const mine = sales.filter((order) => order.owner === user.email);
  const labels: Record<string, string> = {
    confirmed: t("Đã xác nhận", "Confirmed"),
    preparing: t("Trang trại đang chuẩn bị", "Farm preparing"),
    shipped: t("Đang giao", "Shipped"),
    delivered: t("Đã giao", "Delivered"),
    completed: t("Hoàn tất", "Completed"),
    cancelled: t("Đã hủy", "Cancelled"),
  };
  return (
    <div data-no-translate>
      <div className="buy-page-heading">
        <h1 ref={heading} tabIndex={-1}>
          {t("Đơn mua cá của tôi", "Your orders")}
        </h1>
        <p>
          {t(
            "Theo dõi các đơn mua và cập nhật từ trang trại.",
            "Track purchases and updates from the farm.",
          )}
        </p>
      </div>
      {mine.map((order) => (
        <section className="buy-panel" key={order.id}>
          <h2>{order.id}</h2>
          <p>{order.items.map((item) => item.name).join(", ")}</p>
          <div className="buy-order-row">
            <span className="buy-status-pill">{labels[order.status]}</span>
            <span>
              {money(order.total)} ·{" "}
              {order.payment === "paid"
                ? t("Đã thanh toán", "Paid")
                : t("Chờ hoàn tiền", "Refund pending")}
            </span>
            <BuyButton onClick={() => viewPurchase(order.id)}>
              {t("Xem đơn", "View order")}
              <Glyph name="arrow" />
            </BuyButton>
          </div>
        </section>
      ))}
      {!mine.length && (
        <div className="buy-empty">
          <Glyph name="box" />
          <h2>{t("Bạn chưa có đơn mua cá.", "You have no purchases yet.")}</h2>
          <BuyButton onClick={() => go("marketplace")}>
            {t("Khám phá cá", "Discover fish")}
          </BuyButton>
        </div>
      )}
    </div>
  );
}
