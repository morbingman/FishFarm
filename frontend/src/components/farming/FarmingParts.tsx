import type { Lang } from "@/hooks/useTranslation";
import type { ReactNode } from "react";
import type { OrderStatus, PayStatus, Bi } from "@/services/farmingStore";
import "./FarmingParts.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input as UiInput } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { Button as UiButton } from "@/components/ui/button";
import { useState } from "react";
import "@/pages/farming/Farming.css";
import { Banner, Icon } from "@/components/common/Portal";
import {
  fmtMoney,
  METHOD_LABEL,
  PAY_LABEL,
  PAY_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  L,
  type PayMethod,
} from "@/services/farmingStore";
export const useT = (lang: Lang) => (vi: string, en: string) =>
  lang === "vi" ? vi : en;
export const Req = () => (
  <b className="pt-req" aria-hidden>
    *
  </b>
);
export function Badge({
  tone,
  children,
}: {
  tone: string;
  children: ReactNode;
}) {
  return (
    <span className={`ds-badge ds-badge-${tone}`}>
      <i />
      {children}
    </span>
  );
}
export const OrderBadge = ({ s, lang }: { s: OrderStatus; lang: Lang }) => (
  <Badge tone={STATUS_TONE[s]}>{L(STATUS_LABEL[s], lang)}</Badge>
);
export const PayBadge = ({ s, lang }: { s: PayStatus; lang: Lang }) => (
  <Badge tone={PAY_TONE[s]}>{L(PAY_LABEL[s], lang)}</Badge>
);
export function Modal({
  title,
  onClose,
  children,
  label,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  label?: string;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="sl-app pt-modal fm-modal-wide"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>{label ?? title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export const TERMS: {
  h: Bi;
  p: Bi;
}[] = [
  {
    h: {
      vi: "1. Chính sách đặt cọc",
      en: "1. Deposit policy",
    },
    p: {
      vi: "Tiền cọc giữ chỗ trong đợt nuôi và được trừ vào tổng giá trị đơn, không thu hai lần. Tỷ lệ cọc hiển thị là cấu hình minh họa.",
      en: "The deposit reserves your place in the batch and is deducted from the order total, never charged twice. The deposit rate shown is a demo configuration.",
    },
  },
  {
    h: {
      vi: "2. Trách nhiệm chăm sóc",
      en: "2. Farming care responsibilities",
    },
    p: {
      vi: "Trang trại chịu trách nhiệm cho ăn, theo dõi nước, phòng bệnh và cập nhật tiến độ theo gói dịch vụ bạn chọn.",
      en: "The farm is responsible for feeding, water monitoring, disease prevention and progress updates according to the package you choose.",
    },
  },
  {
    h: {
      vi: "3. Thời gian giao dự kiến",
      en: "3. Estimated delivery timeline",
    },
    p: {
      vi: "Thời gian nuôi chỉ là ước tính và có thể thay đổi theo thời tiết, tốc độ tăng trưởng. Trang trại sẽ thông báo khi cá sẵn sàng bàn giao.",
      en: "The farming period is an estimate and may change with weather and growth rate. The farm will notify you when fish are ready for handover.",
    },
  },
  {
    h: {
      vi: "4. Quy định hủy đơn",
      en: "4. Cancellation rules",
    },
    p: {
      vi: "Bạn có thể hủy khi đơn chưa được trang trại xác nhận. Sau khi xác nhận, việc hủy cần được trang trại chấp thuận.",
      en: "You can cancel before the farm confirms the order. After confirmation, cancellation needs the farm's approval.",
    },
  },
  {
    h: {
      vi: "5. Điều kiện hoàn tiền",
      en: "5. Refund conditions",
    },
    p: {
      vi: "Đơn hủy trước khi xác nhận được hoàn cọc. Sau khi xác nhận, hoàn tiền xét theo giai đoạn nuôi và chi phí đã phát sinh.",
      en: "Orders cancelled before confirmation receive a full deposit refund. After confirmation, refunds depend on the farming stage and costs already incurred.",
    },
  },
  {
    h: {
      vi: "6. Rủi ro nuôi trồng",
      en: "6. Farming and fish health risks",
    },
    p: {
      vi: "Nuôi trồng thủy sản có rủi ro về dịch bệnh, thời tiết và môi trường. Số lượng hao hụt thực tế sẽ được ghi nhận và thông báo cho bạn; không có cam kết về lợi nhuận hay tăng giá.",
      en: "Aquaculture carries disease, weather and environmental risks. Actual losses are recorded and reported to you. There is no promise of profit or price appreciation.",
    },
  },
  {
    h: {
      vi: "7. Điều kiện bàn giao cá",
      en: "7. Fish handover conditions",
    },
    p: {
      vi: "Cá được bàn giao khi đạt kích cỡ thỏa thuận và sau khi thanh toán số dư còn lại. Hình thức nhận: tại trang trại hoặc giao tận nơi nếu được hỗ trợ.",
      en: "Fish are handed over once they reach the agreed size and the remaining balance is paid. Pickup at the farm, or home delivery where supported.",
    },
  },
];
export function PayPanel({
  amount,
  lang,
  cta,
  run,
}: {
  amount: number;
  lang: Lang;
  cta: string;
  run: (m: PayMethod, fail: boolean) => Promise<void>;
}) {
  const t = useT(lang);
  const [method, setMethod] = useState<PayMethod>("bank");
  const [fail, setFail] = useState(false);
  const [phase, setPhase] = useState<"idle" | "processing" | "failed">("idle");
  const [err, setErr] = useState("");
  const go = async () => {
    setPhase("processing");
    setErr("");
    try {
      await run(method, fail);
    } catch (e) {
      setPhase("failed");
      setErr(
        (e as Error).message === "capacity"
          ? t(
              "Số chỗ còn lại không đủ cho đơn này. Vui lòng giảm số lượng.",
              "Not enough capacity remains for this order. Please reduce the quantity.",
            )
          : t(
              "Thanh toán không thành công. Bạn chưa bị trừ tiền. Hãy thử lại hoặc đổi phương thức.",
              "The payment did not go through and you were not charged. Retry or change the method.",
            ),
      );
    }
  };
  const busy = phase === "processing";
  return (
    <div className="fm-pay">
      <fieldset disabled={busy} className="farming-parts-view-2">
        <legend className="sl-label farming-parts-view-4">
          {t("Phương thức thanh toán", "Payment method")}
        </legend>
        {(["bank", "gateway", "wallet"] as PayMethod[]).map((m) => (
          <UiLabel key={m} className="fm-check">
            <UiInput
              type="radio"
              name="pay-method"
              checked={method === m}
              onChange={() => setMethod(m)}
            />
            <div>
              <b>{L(METHOD_LABEL[m], lang)}</b>
              <small>
                {m === "bank"
                  ? t(
                      "Chuyển khoản theo thông tin bên dưới (mô phỏng)",
                      "Transfer using the details below (simulated)",
                    )
                  : m === "gateway"
                    ? t(
                        "Thẻ nội địa / quốc tế qua cổng thanh toán (mô phỏng)",
                        "Local / international cards via a gateway (simulated)",
                      )
                    : t(
                        "Thanh toán bằng ví điện tử (mô phỏng)",
                        "Pay with an e-wallet (simulated)",
                      )}
              </small>
            </div>
            <Icon name={m === "bank" ? "store" : "card"} size={20} />
          </UiLabel>
        ))}
      </fieldset>
      {method === "bank" && (
        <div className="fm-bank">
          <span>
            {t("Ngân hàng", "Bank")}: <b>FISHMARKET Demo Bank</b>
          </span>
          <span>
            {t("Số tài khoản", "Account no.")}:{" "}
            <b className="fm-mono">0000 1234 5678</b>
          </span>
          <span>
            {t("Nội dung", "Reference")}:{" "}
            <b className="fm-mono">COC FISHMARKET</b>
          </span>
          <span>
            {t("Số tiền", "Amount")}: <b>{fmtMoney(amount, lang)}</b>
          </span>
        </div>
      )}
      <UiLabel className="fm-check farming-parts-view-6">
        <UiInput
          type="checkbox"
          checked={fail}
          onChange={(e) => setFail(e.target.checked)}
          disabled={busy}
        />
        <div>
          <b>
            {t(
              "Mô phỏng thanh toán thất bại (chỉ để demo)",
              "Simulate a failed payment (demo only)",
            )}
          </b>
          <small>
            {t(
              "Bật để xem trạng thái lỗi và thao tác thử lại.",
              "Turn on to preview the error state and retry action.",
            )}
          </small>
        </div>
      </UiLabel>
      {phase === "failed" && (
        <Banner
          tone="error"
          action={
            <UiButton
              variant="plain"
              type="button"
              onClick={() => {
                setFail(false);
                setPhase("idle");
              }}
            >
              {t("Tắt mô phỏng lỗi", "Turn off simulation")}
            </UiButton>
          }
        >
          {err}
        </Banner>
      )}
      {busy && (
        <Banner tone="info">
          {t(
            "Đang xử lý thanh toán, vui lòng không đóng trang…",
            "Processing payment, please keep this page open…",
          )}
        </Banner>
      )}
      <UiButton
        variant="plain"
        type="button"
        className={
          "farming-parts-layout-7 " +
          "" +
          `sl-btn sl-btn-primary lg ${busy ? "loading" : ""}`
        }
        onClick={go}
        disabled={busy}
      >
        {phase === "failed" ? t("Thử lại thanh toán", "Retry payment") : cta} ·{" "}
        {fmtMoney(amount, lang)}
      </UiButton>
      <p className="fm-demo-note farming-parts-view-9">
        <Icon name="info" size={14} />
        {t(
          "Thanh toán mô phỏng, không có giao dịch thật.",
          "Simulated payment. No real transaction takes place.",
        )}
      </p>
    </div>
  );
}
