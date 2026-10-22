import { useTranslation } from "@/context/LanguageContext";
import { ADMIN_NAV, adminLabel } from "@/data/adminNavigation";
import { Icon } from "@/components/common/Portal";
import { isAccountBlocked, useStore } from "@/services/demoStore";
import { useFarming } from "@/services/farmingStore";
import { useSales } from "@/services/commerceStore";
export function Overview() {
  const { language } = useTranslation();
  const t = (vi: string, en: string) => (language === "vi" ? vi : en);
  const store = useStore();
  const farming = useFarming();
  const sales = useSales();
  const notes: Record<string, [string, string]> = {
    "#admin/listings": [
      "Thêm cá mới, chỉnh sửa thông tin, hình ảnh, giá và số lượng; tạm ẩn hoặc xóa bản nháp.",
      "Create and edit fish listings, photos, prices and quantities; pause listings or delete drafts.",
    ],
    "#admin/queue": [
      "Xem nội dung chờ duyệt, yêu cầu bổ sung, từ chối hoặc duyệt đăng; xử lý cá đang hiển thị.",
      "Review submissions, request changes, reject or publish listings and moderate live inventory.",
    ],
    "#admin/orders": [
      "Tiếp nhận đơn mua cá, kiểm tra khách hàng và cập nhật đóng gói, giao hàng, hoàn tất.",
      "Review purchases and customer details, then update preparation, shipping and completion.",
    ],
    "#admin/bookings": [
      "Xem đơn đặt nuôi từ khách, đối soát tiền cọc, xác nhận đặt nuôi và theo dõi đến khi bàn giao.",
      "Review customer bookings, reconcile deposits and manage farming through handover.",
    ],
    "#admin/users": [
      "Xem trạng thái khách hàng; khóa 24 giờ, 7 ngày hoặc vĩnh viễn, mở khóa và xóa tài khoản.",
      "Review customer access; block for 24 hours, 7 days or permanently, unblock or delete accounts.",
    ],
    "#admin/activity": [
      "Tra cứu người thực hiện, thời điểm và nội dung thay đổi để đối chiếu vận hành.",
      "Trace who performed each action, when it happened and what changed.",
    ],
  };
  const counts: Record<string, number> = {
    "#admin/listings": store.listings.length,
    "#admin/queue": store.listings.filter((item) => item.status === "pending")
      .length,
    "#admin/orders": sales.length,
    "#admin/bookings": farming.orders.length,
    "#admin/users": store.users.filter(
      (item) => item.role === "Buyer" && !item.deletedAt,
    ).length,
    "#admin/activity": store.activity.length,
  };
  return (
    <div data-no-translate>
      <header className="sl-page-head">
        <div>
          <span className="sl-eyebrow">
            FISHMARKET · {t("Quản trị", "Administration")}
          </span>
          <h1>{t("Tổng quan quản lý", "Management overview")}</h1>
          <p>
            {t(
              "Chọn khu vực cần xử lý. Mỗi mục bên dưới tóm tắt công việc của khu vực đó.",
              "Choose a management area. Each section below explains what you can do there.",
            )}
          </p>
        </div>
      </header>
      <div className="admin-module-grid">
        {ADMIN_NAV.filter((item) => item.href !== "#admin").map((item) => (
          <a className="sl-card admin-module" key={item.href} href={item.href}>
            <div className="admin-module-head">
              <span>
                <Icon name={item.icon} size={23} />
              </span>
              <strong>{counts[item.href]}</strong>
            </div>
            <h2>{adminLabel(item.label, language)}</h2>
            <p>{notes[item.href]?.[language === "vi" ? 0 : 1]}</p>
            <span className="admin-module-link">
              {t("Mở quản lý", "Open section")} →
            </span>
          </a>
        ))}
      </div>
      <p className="admin-note">
        {t(
          "Thông báo mới nằm ở biểu tượng chuông trên navbar; mỗi lần mở hiển thị tối đa 4 tin.",
          "Open the bell in the navbar to see up to four recent notifications.",
        )}
      </p>
    </div>
  );
}
