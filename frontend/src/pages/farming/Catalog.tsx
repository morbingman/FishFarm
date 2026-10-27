import type { Lang } from "@/hooks/useTranslation";
import type { User } from "@/services/demoStore";
import "./Catalog.css";
import { Button as UiButton } from "@/components/ui/button";
import { useState } from "react";
import {
  Icon,
  StateBlock,
  Crumbs,
  useLoading,
} from "@/components/common/Portal";
import { FISH, useFarming } from "@/services/farmingStore";
import { Modal, useT } from "@/components/farming/FarmingParts";
import { FishCard } from "@/components/farming/FishCard";
export function Catalog({ language }: { language: Lang; user: User }) {
  const t = useT(language);
  useFarming();
  const loading = useLoading(500);
  const [flow, setFlow] = useState(false);
  const list = FISH.filter((fish) => fish.catalogVisible !== false);
  return (
    <>
      <Crumbs
        items={[
          [t("Trang chủ", "Home"), "#home"],
          [t("Đặt nuôi cá", "Farm a Fish")],
        ]}
      />
      <div className="sl-page-head">
        <div>
          <h1>{t("Đầu tư nuôi một cá thể", "Sponsor a fish")}</h1>
          <p>
            {t(
              "Chọn đúng cá thể bạn muốn đầu tư chi phí nuôi; trang trại sẽ chăm sóc, cập nhật quá trình lớn lên và giao cá cho bạn.",
              "Choose the individual fish you want to sponsor; the farm will raise it, post growth updates, and hand it over to you.",
            )}
          </p>
        </div>
        <div className="fm-actions">
          <UiButton
            variant="plain"
            className="sl-btn sl-btn-ghost"
            onClick={() => setFlow(true)}
          >
            <Icon name="info" size={16} />
            {t("Quy trình đặt nuôi", "How it works")}
          </UiButton>
          <a className="sl-btn sl-btn-secondary" href="#account/farming-orders">
            <Icon name="clipboard" size={16} />
            {t("Đơn nuôi của tôi", "My farming orders")}
          </a>
        </div>
      </div>

      <div className="fm-result-line">
        <span aria-live="polite">
          {t(
            `${list.length} cá thể đang đăng`,
            `${list.length} fish available`,
          )}
        </span>
      </div>

      {loading ? (
        <div className="fm-grid" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="fm-card">
              <div className="fm-img pt-skel catalog-view-2" />
              <div className="fm-body">
                <div className="pt-skel catalog-view-4" />
                <div className="pt-skel" />
                <div className="pt-skel catalog-view-6" />
              </div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <StateBlock
          card
          icon="search"
          tone="info"
          title={t("Không tìm thấy loài cá phù hợp", "No matching species")}
          body={t(
            "Hiện chưa có cá con nào đang nhận đầu tư nuôi.",
            "There are currently no juvenile fish available for sponsorship.",
          )}
        />
      ) : (
        <div className="fm-grid">
          {list.map((x) => (
            <FishCard key={x.id} fish={x} language={language} />
          ))}
        </div>
      )}

      {flow && (
        <Modal
          title={t("Quy trình đầu tư nuôi cá", "How fish sponsorship works")}
          onClose={() => setFlow(false)}
        >
          <ol className="fm-flow">
            <li>
              <div>
                <b>{t("Chọn một cá thể", "Choose one fish")}</b>
                <span>
                  {t(
                    "Xem ảnh thật, kích thước, sức khỏe và kế hoạch chăm sóc của đúng con cá.",
                    "Review real photos, size, health and the care plan for that exact fish.",
                  )}
                </span>
              </div>
            </li>
            <li>
              <div>
                <b>{t("Thanh toán chi phí nuôi", "Fund the care")}</b>
                <span>
                  {t(
                    "Thanh toán khoản đầu tư nuôi. Sau đó cá sẽ không nhận thêm nhà đầu tư khác.",
                    "Pay the sponsorship cost. That fish will then stop accepting other investors.",
                  )}
                </span>
              </div>
            </li>
            <li>
              <div>
                <b>
                  {t("Trang trại xác nhận & nuôi", "Farm confirms & raises")}
                </b>
                <span>
                  {t(
                    "Trang trại chăm sóc cá và gửi ảnh, kích thước cùng tình trạng sức khỏe trong quá trình lớn lên.",
                    "The farm raises the fish and posts photos, measurements and health updates as it grows.",
                  )}
                </span>
              </div>
            </li>
            <li>
              <div>
                <b>{t("Nhận cá", "Receive your fish")}</b>
                <span>
                  {t(
                    "Khi đạt mục tiêu, nhận đúng cá thể đã đầu tư tại trại hoặc yêu cầu giao tận nơi.",
                    "When it reaches the target, receive the exact fish you sponsored at the farm or by delivery.",
                  )}
                </span>
              </div>
            </li>
          </ol>
          <div className="fm-note">
            <Icon name="info" size={16} />
            <span>
              {t(
                "Đây là dịch vụ mua cá và thuê nuôi, không phải sản phẩm đầu tư. Không có cam kết lợi nhuận.",
                "This is a fish purchase and farming service, not an investment product. No returns are promised.",
              )}
            </span>
          </div>
          <div className="pt-modal-actions">
            <UiButton
              variant="plain"
              className="sl-btn sl-btn-primary"
              onClick={() => setFlow(false)}
            >
              {t("Đã hiểu", "Got it")}
            </UiButton>
          </div>
        </Modal>
      )}
    </>
  );
}
