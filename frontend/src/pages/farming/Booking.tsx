import type { User } from "@/services/demoStore";
import type { Lang } from "@/hooks/useTranslation";
import type { Order } from "@/services/farmingStore";
import { type CSSProperties } from "react";
import "./Booking.css";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea as UiTextarea } from "@/components/ui/textarea";
import { Input as UiInput } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { Button as UiButton } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { Icon, Crumbs, go } from "@/components/common/Portal";
import {
  ADDONS,
  FACILITIES,
  FISH,
  PKG_LABEL,
  PKG_MULT,
  RULES,
  STATUS_LABEL,
  availOf,
  canBook,
  facilityOf,
  fishById,
  fmtMoney,
  fmtNum,
  L,
  quote,
  remaining,
  submitDeposit,
  useFarming,
  type Delivery,
  type Pkg,
} from "@/services/farmingStore";
import { PayPanel, Req, TERMS, useT } from "@/components/farming/FarmingParts";
import { isoDay } from "@/data/farmingFilters";
import { Summary } from "@/components/farming/Summary";
export /* ---------------------------------- booking ---------------------------------- */
function Booking({
  user,
  language,
  fishId,
  show,
}: {
  user: User;
  language: Lang;
  fishId: string | null;
  show: (m: string) => void;
}) {
  const t = useT(language);
  const s = useFarming();
  // Keep the requested fish selected even after payment changes it to
  // fully-sponsored. Re-selecting only from available fish here could return
  // undefined during the success render and blank the entire page.
  const first =
    fishById(fishId) ??
    FISH.find((item) => canBook(availOf(item, s))) ??
    FISH[0];
  const [step, setStep] = useState(1);
  const [fid, setFid] = useState(first.id);
  const fish = fishById(fid)!;
  const [qty, setQty] = useState(String(first.singleFish ? 1 : first.minQty));
  const [facility, setFacility] = useState(first.facilities[0]);
  const [start, setStart] = useState(isoDay(RULES.leadDays + 4));
  const [pkg, setPkg] = useState<Pkg>("basic");
  const [addons, setAddons] = useState<string[]>(["feeding", "water"]);
  const [delivery, setDelivery] = useState<Delivery>("pickup");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [notes, setNotes] = useState("");
  const [agree, setAgree] = useState(false);
  const [tried, setTried] = useState<Record<number, boolean>>({});
  const [done, setDone] = useState<{
    order: Order;
    method: string;
  } | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const rem = remaining(fish, s);
  const n = Math.floor(Number(qty));
  const canDeliver = fish.deliveryAreas.length > 0;
  const q = quote(fish, n > 0 ? n : 0, pkg, addons, delivery);
  const e1: Record<string, string> = {};
  if (!qty.trim() || !Number.isInteger(Number(qty)) || n <= 0)
    e1.qty = t("Nhập số lượng nguyên dương.", "Enter a positive whole number.");
  else if (n < fish.minQty)
    e1.qty = t(
      `Số lượng tối thiểu là ${fish.minQty} con.`,
      `Minimum quantity is ${fish.minQty}.`,
    );
  else if (n > rem)
    e1.qty = t(
      `Chỉ còn ${fmtNum(rem, language)} chỗ nuôi, vui lòng giảm số lượng.`,
      `Only ${fmtNum(rem, language)} slots remain. Please reduce the quantity.`,
    );
  if (!fish.singleFish && !facility)
    e1.facility = t("Chọn cơ sở nuôi.", "Choose a facility.");
  if (!fish.singleFish && !start)
    e1.start = t(
      "Chọn ngày bắt đầu mong muốn.",
      "Choose an expected start date.",
    );
  else if (start < isoDay(RULES.leadDays))
    e1.start = t(
      `Ngày bắt đầu phải sau hôm nay ít nhất ${RULES.leadDays} ngày.`,
      `Start date must be at least ${RULES.leadDays} days from today.`,
    );
  const e2: Record<string, string> = {};
  if (pkg === "custom" && addons.length === 0)
    e2.addons = t("Chọn ít nhất một dịch vụ.", "Select at least one service.");
  const e3: Record<string, string> = {};
  if (!name.trim())
    e3.name = t("Nhập họ tên người nhận.", "Enter the recipient's name.");
  if (!/^\+?[\d\s()-]{9,16}$/.test(phone.trim()))
    e3.phone = t("Nhập số điện thoại hợp lệ.", "Enter a valid phone number.");
  if (delivery === "delivery") {
    if (!area)
      e3.area = t(
        "Chọn khu vực giao hàng được hỗ trợ.",
        "Choose a supported delivery area.",
      );
    if (address.trim().length < 6)
      e3.address = t(
        "Nhập địa chỉ nhận cá đầy đủ.",
        "Enter a full delivery address.",
      );
  }
  if (!agree)
    e3.agree = t(
      "Bạn cần đồng ý điều khoản để tiếp tục.",
      "You must accept the terms to continue.",
    );
  const errs = [{}, e1, e2, e3][step] as Record<string, string>;
  const showErr = (k: string, st: number) =>
    tried[st] ? ([{}, e1, e2, e3][st] as Record<string, string>)[k] : undefined;
  const jump = () =>
    top.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  const next = () => {
    setTried((x) => ({
      ...x,
      [step]: true,
    }));
    if (Object.keys(errs).length) {
      show(
        t(
          "Vui lòng kiểm tra lại các trường được đánh dấu.",
          "Please review the highlighted fields.",
        ),
      );
      return;
    }
    setStep(step + 1);
    jump();
  };
  const back = () => {
    setStep(step - 1);
    jump();
  };
  const changeFish = (id: string) => {
    const f = fishById(id)!;
    setFid(id);
    setQty(String(f.singleFish ? 1 : f.minQty));
    setFacility(f.facilities[0]);
    if (!f.deliveryAreas.length) {
      setDelivery("pickup");
      setArea("");
    } else if (!f.deliveryAreas.includes(area)) setArea("");
  };
  const pay = async (method: "bank" | "gateway" | "wallet", fail: boolean) => {
    const order = await submitDeposit(
      user.email,
      {
        fishId: fish.id,
        qty: n,
        pkg,
        addons,
        facility,
        startDate: start,
        delivery,
        area,
        address: address.trim(),
        name: name.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
      },
      method,
      fail,
      language,
    );
    setDone({
      order,
      method,
    });
    show(t("Đặt cọc thành công", "Deposit paid successfully"));
    jump();
  };
  useEffect(() => {
    if (!canBook(availOf(fish, s)) && !done) setStep(1);
  }, [s, fish, done]);
  const steps = [
    t("Thông tin đặt nuôi", "Booking details"),
    t("Dịch vụ chăm sóc", "Care service"),
    t("Thông tin nhận cá", "Handover details"),
    t("Xác nhận đặt cọc", "Confirm deposit"),
  ];
  const Err = ({ k, st }: { k: string; st: number }) => {
    const m = showErr(k, st);
    return m ? <em role="alert">{m}</em> : null;
  };
  if (done) {
    const o = done.order;
    return (
      <>
        <Crumbs
          items={[
            [t("Trang chủ", "Home"), "#home"],
            [t("Đặt nuôi cá", "Farm a Fish"), "#farming"],
            [t("Hoàn tất", "Done")],
          ]}
        />
        <section className="sl-card">
          <div className="fm-result" role="status">
            <span className="pt-state-ic ok">
              <Icon name="check" size={28} />
            </span>
            <h2 className="booking-view-2">
              {t("Đặt cọc thành công", "Deposit received")}
            </h2>
            <p className="booking-view-4">
              {t(
                "Đơn của bạn đang chờ trang trại xác nhận. Chúng tôi sẽ thông báo ngay khi đơn được duyệt và bắt đầu chuẩn bị cá.",
                "Your order is awaiting farm confirmation. We'll notify you as soon as it's approved and the fish are being prepared.",
              )}
            </p>
            <span className="fm-ref">{o.id}</span>
            <div className="fm-receipt">
              <div className="fm-line">
                <span>{t("Loại cá", "Fish")}</span>
                <b>
                  {L(fish.name, language)} × {fmtNum(o.qty, language)}
                </b>
              </div>
              <div className="fm-line">
                <span>{t("Gói dịch vụ", "Package")}</span>
                <b>{L(PKG_LABEL[o.pkg], language)}</b>
              </div>
              <div className="fm-line">
                <span>{t("Tổng giá trị ước tính", "Estimated total")}</span>
                <b>{fmtMoney(o.total, language)}</b>
              </div>
              <div className="fm-line">
                <span>
                  {fish.singleFish
                    ? t("Đã thanh toán đầu tư", "Sponsorship paid")
                    : t("Đã thanh toán (đặt cọc)", "Paid now (deposit)")}
                </span>
                <b>{fmtMoney(o.deposit, language)}</b>
              </div>
              <div className="fm-line">
                <span>{t("Số dư còn lại", "Remaining balance")}</span>
                <b>{fmtMoney(o.balance, language)}</b>
              </div>
              <div className="fm-line">
                <span>{t("Trạng thái", "Status")}</span>
                <b>{L(STATUS_LABEL[o.status], language)}</b>
              </div>
            </div>
            <div className="fm-actions booking-view-6">
              <UiButton
                variant="plain"
                className="sl-btn sl-btn-primary"
                onClick={() => go(`account/farming-orders/${o.id}`)}
              >
                {t("Xem đơn nuôi", "View order")}
              </UiButton>
              <a className="sl-btn sl-btn-ghost" href="#farming">
                {t("Đặt nuôi thêm", "Book another")}
              </a>
            </div>
          </div>
        </section>
      </>
    );
  }
  const sumProps = {
    fish,
    qty: n > 0 ? n : 0,
    pkg,
    addons,
    delivery,
    q,
    language,
    step,
  };
  return (
    <>
      <Crumbs
        items={[
          [t("Trang chủ", "Home"), "#home"],
          [t("Đặt nuôi cá", "Farm a Fish"), "#farming"],
          [t("Đặt nuôi", "Booking")],
        ]}
      />
      <div className="sl-page-head">
        <div>
          <h1>
            {fish.singleFish
              ? t("Đầu tư nuôi cá", "Sponsor this fish")
              : t("Đặt nuôi", "Book a farming slot")}
          </h1>
          <p>
            {L(fish.name, language)} ·{" "}
            {t(`Bước ${step}/4`, `Step ${step} of 4`)}
          </p>
        </div>
        <a className="sl-btn sl-btn-ghost" href="#farming">
          {t("Hủy", "Cancel")}
        </a>
      </div>
      <div ref={top} className="booking-view-8" />
      <ol
        className="fm-steps"
        aria-label={t("Các bước đặt nuôi", "Booking steps")}
      >
        {steps.map((l, i) => (
          <li
            key={l}
            className={step === i + 1 ? "on" : step > i + 1 ? "done" : ""}
            aria-current={step === i + 1 ? "step" : undefined}
          >
            <span className="n">
              {step > i + 1 ? <Icon name="check" size={14} /> : i + 1}
            </span>
            <span className="t">{l}</span>
          </li>
        ))}
      </ol>

      <div className="fm-book">
        <div>
          <details className="sl-card fm-sum-m">
            <summary>
              <span>
                {t("Tóm tắt đơn", "Order summary")}
                <small>{t("Đặt cọc hôm nay", "Deposit today")}</small>
              </span>
              <b className="booking-view-10">{fmtMoney(q.deposit, language)}</b>
            </summary>
            <div className="inner">
              <Summary {...sumProps} />
            </div>
          </details>
          <section className="sl-card pad booking-view-12">
            <h2 className="fm-h">{steps[step - 1]}</h2>

            {step === 1 && (
              <div className="fm-form">
                <UiLabel className="sl-field">
                  <span>
                    {t("Loại cá", "Fish species")}
                    <Req />
                  </span>
                  <NativeSelect
                    value={fid}
                    onChange={(e) => changeFish(e.target.value)}
                  >
                    {FISH.filter(
                      (x) => canBook(availOf(x, s)) || x.id === fid,
                    ).map((x) => (
                      <NativeSelectOption key={x.id} value={x.id}>
                        {L(x.name, language)} —{" "}
                        {fmtMoney(x.fishPrice, language)}/{t("con", "fish")}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </UiLabel>
                <div className={`sl-field ${showErr("qty", 1) ? "bad" : ""}`}>
                  <UiLabel htmlFor="qty">
                    <span className="sl-label">
                      {fish.singleFish
                        ? t("Cá thể đầu tư", "Sponsored fish")
                        : t("Số lượng (con)", "Quantity (fish)")}
                      <Req />
                    </span>
                  </UiLabel>
                  {fish.singleFish ? (
                    <div className="fm-ro">
                      {t("1 con cá – 1 nhà đầu tư", "1 fish – 1 investor")}
                    </div>
                  ) : (
                    <div className="fm-qty">
                      <UiButton
                        variant="plain"
                        type="button"
                        aria-label={t("Giảm", "Decrease")}
                        onClick={() =>
                          setQty(
                            String(
                              Math.max(
                                fish.minQty,
                                (n || 0) - (fish.minQty > 1 ? fish.minQty : 1),
                              ),
                            ),
                          )
                        }
                        disabled={n <= fish.minQty}
                      >
                        <Icon name="minus" size={16} />
                      </UiButton>
                      <UiInput
                        id="qty"
                        inputMode="numeric"
                        value={qty}
                        onChange={(e) =>
                          setQty(e.target.value.replace(/[^\d]/g, ""))
                        }
                        aria-invalid={!!showErr("qty", 1)}
                      />
                      <UiButton
                        variant="plain"
                        type="button"
                        aria-label={t("Tăng", "Increase")}
                        onClick={() =>
                          setQty(
                            String(
                              Math.min(
                                rem,
                                (n || 0) + (fish.minQty > 1 ? fish.minQty : 1),
                              ),
                            ),
                          )
                        }
                        disabled={n >= rem}
                      >
                        <Icon name="plus" size={16} />
                      </UiButton>
                    </div>
                  )}
                  <small>
                    {fish.singleFish
                      ? t(
                          "Sau khi có người đầu tư, cá này sẽ ngừng nhận đơn.",
                          "Once sponsored, this fish stops accepting orders.",
                        )
                      : t(
                          `Tối thiểu ${fish.minQty} · còn ${fmtNum(rem, language)} chỗ nuôi`,
                          `Minimum ${fish.minQty} · ${fmtNum(rem, language)} slots left`,
                        )}
                  </small>
                  <Err k="qty" st={1} />
                </div>
                {!fish.singleFish && (
                  <div className="fm-row2">
                    <div className="sl-field">
                      <span>{t("Kích thước hiện tại", "Current size")}</span>
                      <div className="fm-ro">
                        {fish.sizeStart} cm · {L(fish.stage, language)}
                      </div>
                    </div>
                    <div className="sl-field">
                      <span>
                        {t("Thời gian nuôi dự kiến", "Estimated duration")}
                      </span>
                      <div className="fm-ro">
                        {t(`~${fish.months} tháng`, `~${fish.months} months`)}
                      </div>
                    </div>
                  </div>
                )}
                {!fish.singleFish && (
                  <div className="fm-row2">
                    <UiLabel
                      className={`sl-field ${
                        showErr("facility", 1) ? "bad" : ""
                      }`}
                    >
                      <span>
                        {t("Cơ sở nuôi", "Farming location")}
                        <Req />
                      </span>
                      <NativeSelect
                        value={facility}
                        onChange={(e) => setFacility(e.target.value)}
                      >
                        {fish.facilities.map((id) => {
                          const f = FACILITIES.find((x) => x.id === id)!;
                          return (
                            <NativeSelectOption key={id} value={id}>
                              {L(f.name, language)}
                            </NativeSelectOption>
                          );
                        })}
                      </NativeSelect>
                      <small>{L(facilityOf(facility).address, language)}</small>
                    </UiLabel>
                    <UiLabel
                      className={`sl-field ${showErr("start", 1) ? "bad" : ""}`}
                    >
                      <span>
                        {t("Ngày bắt đầu mong muốn", "Expected start date")}
                        <Req />
                      </span>
                      <UiInput
                        type="date"
                        value={start}
                        min={isoDay(RULES.leadDays)}
                        onChange={(e) => setStart(e.target.value)}
                        aria-invalid={!!showErr("start", 1)}
                      />
                      <Err k="start" st={1} />
                    </UiLabel>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="fm-form">
                {fish.singleFish && (
                  <section className="sl-card pad">
                    <h3>
                      {t(
                        "Chi phí đã bao gồm chăm sóc đến ngày giao",
                        "The price includes care through handover",
                      )}
                    </h3>
                    <p>
                      {fish.info.find(
                        (item) => item.k.vi === "Kế hoạch chăm sóc",
                      )?.v[language] ??
                        t(
                          "Trang trại chăm sóc và cập nhật quá trình phát triển của cá.",
                          "The farm cares for the fish and posts growth updates.",
                        )}
                    </p>
                    <div className="fm-line hr">
                      <span>
                        {t("Tổng chi phí đầu tư", "Total sponsorship cost")}
                      </span>
                      <b>{fmtMoney(fish.fishPrice, language)}</b>
                    </div>
                  </section>
                )}
                {!fish.singleFish && (
                  <>
                    <div
                      className="fm-pkgs"
                      role="radiogroup"
                      aria-label={t("Gói dịch vụ", "Service package")}
                    >
                      {(
                        [
                          [
                            "basic",
                            t("Cho ăn theo lịch", "Scheduled feeding"),
                            t("Theo dõi nước cơ bản", "Basic water monitoring"),
                            t("Chăm sóc trại định kỳ", "Routine farm care"),
                            t(
                              "Cập nhật tiến độ định kỳ",
                              "Periodic progress updates",
                            ),
                          ],
                          [
                            "advanced",
                            t(
                              "Toàn bộ dịch vụ Gói Cơ bản",
                              "All Basic package services",
                            ),
                            t(
                              "Ảnh cập nhật thường xuyên hơn",
                              "More frequent photo updates",
                            ),
                            t(
                              "Báo cáo nuôi chi tiết",
                              "Detailed farming reports",
                            ),
                            t(
                              "Giám sát bổ sung khi có sẵn",
                              "Extra monitoring when available",
                            ),
                          ],
                          [
                            "custom",
                            t(
                              "Tự chọn từng dịch vụ hỗ trợ",
                              "Pick each supported service",
                            ),
                            t(
                              "Trả phí theo dịch vụ đã chọn",
                              "Pay only for what you choose",
                            ),
                            t(
                              "Thay đổi bất cứ lúc nào ở bước này",
                              "Change anytime on this step",
                            ),
                          ],
                        ] as [Pkg, ...string[]][]
                      ).map(([p, ...items]) => {
                        const m = PKG_MULT(p, addons);
                        return (
                          <UiLabel key={p} className="fm-pkg">
                            <UiInput
                              type="radio"
                              name="pkg"
                              checked={pkg === p}
                              onChange={() => setPkg(p)}
                            />
                            <span className="ck">
                              {pkg === p && <Icon name="check" size={12} />}
                            </span>
                            <h4>{L(PKG_LABEL[p], language)}</h4>
                            <p>
                              {p === "basic"
                                ? t(
                                    "Phù hợp nhu cầu nuôi cơ bản, an tâm và tiết kiệm.",
                                    "For straightforward, economical farming.",
                                  )
                                : p === "advanced"
                                  ? t(
                                      "Theo dõi sát hơn với báo cáo và hình ảnh thường xuyên.",
                                      "Closer oversight with frequent reports and photos.",
                                    )
                                  : t(
                                      "Tùy chỉnh dịch vụ theo nhu cầu của bạn.",
                                      "Tailor the services to your needs.",
                                    )}
                            </p>
                            <div className="pr">
                              {p === "custom" && m === 0
                                ? "—"
                                : fmtMoney(Math.round(fish.care * m), language)}
                              <small>
                                {t(
                                  "/ con / tháng · tính theo tháng nuôi, gộp vào tổng đơn",
                                  "/ fish / month · billed per farming month, included in the order total",
                                )}
                              </small>
                            </div>
                            <ul>
                              {items.map((i) => (
                                <li key={i}>
                                  <Icon name="check" size={14} />
                                  {i}
                                </li>
                              ))}
                            </ul>
                          </UiLabel>
                        );
                      })}
                    </div>
                    {pkg === "custom" && (
                      <div
                        className="fm-addons"
                        role="group"
                        aria-label={t("Dịch vụ tùy chỉnh", "Custom services")}
                      >
                        {ADDONS.map((a) => (
                          <UiLabel key={a.id} className="fm-check">
                            <UiInput
                              type="checkbox"
                              checked={addons.includes(a.id)}
                              onChange={() =>
                                setAddons((x) =>
                                  x.includes(a.id)
                                    ? x.filter((i) => i !== a.id)
                                    : [...x, a.id],
                                )
                              }
                            />
                            <div>
                              <b>{L(a.name, language)}</b>
                              <small>{L(a.desc, language)}</small>
                            </div>
                            <span className="amt">
                              +
                              {fmtMoney(
                                Math.round(fish.care * a.mult),
                                language,
                              )}
                              /{t("con/tháng", "fish/mo")}
                            </span>
                          </UiLabel>
                        ))}
                        <Err k="addons" st={2} />
                      </div>
                    )}
                    <div className="fm-note">
                      <Icon name="info" size={16} />
                      <span>
                        {t(
                          "Đơn giá dịch vụ mô phỏng theo cấu hình demo và có thể thay đổi khi triển khai thật.",
                          "Service rates follow a demo configuration and may change in production.",
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="fm-form">
                <div className="fm-row2">
                  <UiLabel
                    className={`sl-field ${showErr("name", 3) ? "bad" : ""}`}
                  >
                    <span>
                      {t("Họ tên", "Full name")}
                      <Req />
                    </span>
                    <UiInput
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      aria-invalid={!!showErr("name", 3)}
                    />
                    <Err k="name" st={3} />
                  </UiLabel>
                  <UiLabel
                    className={`sl-field ${showErr("phone", 3) ? "bad" : ""}`}
                  >
                    <span>
                      {t("Số điện thoại", "Phone number")}
                      <Req />
                    </span>
                    <UiInput
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      inputMode="tel"
                      autoComplete="tel"
                      aria-invalid={!!showErr("phone", 3)}
                    />
                    <Err k="phone" st={3} />
                  </UiLabel>
                </div>
                <fieldset className="booking-view-14">
                  <legend className="sl-label booking-view-16">
                    {t("Hình thức nhận cá", "Delivery preference")}
                    <Req />
                  </legend>
                  <div className="fm-seg">
                    <UiLabel className="fm-check">
                      <UiInput
                        type="radio"
                        name="dl"
                        checked={delivery === "pickup"}
                        onChange={() => setDelivery("pickup")}
                      />
                      <div>
                        <b>{t("Nhận tại trang trại", "Pick up at the farm")}</b>
                        <small>
                          {L(facilityOf(facility).name, language)} ·{" "}
                          {t("miễn phí", "free")}
                        </small>
                      </div>
                    </UiLabel>
                    {canDeliver ? (
                      <UiLabel className="fm-check">
                        <UiInput
                          type="radio"
                          name="dl"
                          checked={delivery === "delivery"}
                          onChange={() => setDelivery("delivery")}
                        />
                        <div>
                          <b>{t("Giao tận nơi", "Home delivery")}</b>
                          <small>
                            {t(
                              "Phí giao ước tính được tính vào tổng đơn",
                              "Estimated fee is added to the total",
                            )}
                          </small>
                        </div>
                      </UiLabel>
                    ) : (
                      <div className="fm-check booking-view-18">
                        <Icon name="truck" size={18} />
                        <div>
                          <b>{t("Giao tận nơi", "Home delivery")}</b>
                          <small>
                            {t(
                              "Chưa hỗ trợ cho loài cá này",
                              "Not supported for this species",
                            )}
                          </small>
                        </div>
                      </div>
                    )}
                  </div>
                </fieldset>
                {delivery === "delivery" && (
                  <div className="fm-row2">
                    <UiLabel
                      className={`sl-field ${showErr("area", 3) ? "bad" : ""}`}
                    >
                      <span>
                        {t("Khu vực giao hàng", "Delivery area")}
                        <Req />
                      </span>
                      <NativeSelect
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                        aria-invalid={!!showErr("area", 3)}
                      >
                        <NativeSelectOption value="">
                          {t("Chọn khu vực…", "Select area…")}
                        </NativeSelectOption>
                        {fish.deliveryAreas.map((a) => (
                          <NativeSelectOption key={a}>{a}</NativeSelectOption>
                        ))}
                      </NativeSelect>
                      <Err k="area" st={3} />
                    </UiLabel>
                    <UiLabel
                      className={`sl-field ${
                        showErr("address", 3) ? "bad" : ""
                      }`}
                    >
                      <span>
                        {t("Địa chỉ nhận cá", "Delivery address")}
                        <Req />
                      </span>
                      <UiInput
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        autoComplete="street-address"
                        aria-invalid={!!showErr("address", 3)}
                      />
                      <Err k="address" st={3} />
                    </UiLabel>
                  </div>
                )}
                <UiLabel className="sl-field">
                  <span>
                    {t("Ghi chú thêm", "Additional notes")}
                    <span className="pt-opt">{t("Tùy chọn", "Optional")}</span>
                  </span>
                  <UiTextarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={300}
                  />
                </UiLabel>
                <div>
                  <h3 className="fm-h booking-view-20">
                    {t("Điều khoản đặt nuôi", "Farming agreement")}
                  </h3>
                  <div
                    className="fm-terms"
                    tabIndex={0}
                    role="region"
                    aria-label={t("Nội dung điều khoản", "Agreement text")}
                  >
                    {TERMS.map((x) => (
                      <div key={x.h.en}>
                        <h5>{L(x.h, language)}</h5>
                        <p>{L(x.p, language)}</p>
                      </div>
                    ))}
                  </div>
                  <UiLabel
                    className={
                      "booking-layout-21 " +
                      "" +
                      `fm-check ${showErr("agree", 3) ? "bad" : ""}`
                    }
                    style={
                      {
                        "--booking-layout-21-border-color": showErr("agree", 3)
                          ? "var(--danger)"
                          : undefined,
                      } as CSSProperties
                    }
                  >
                    <UiInput
                      type="checkbox"
                      checked={agree}
                      onChange={(e) => setAgree(e.target.checked)}
                      aria-invalid={!!showErr("agree", 3)}
                    />
                    <div>
                      <b>
                        {t(
                          "Tôi đã đọc và đồng ý với các điều khoản đặt nuôi cá.",
                          "I have read and agree to the fish farming terms.",
                        )}
                      </b>
                    </div>
                  </UiLabel>
                  <div className="sl-field booking-view-23">
                    <Err k="agree" st={3} />
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="fm-form">
                <div className="sl-card pad booking-view-25">
                  <div className="fm-line">
                    <span>{t("Người nhận", "Recipient")}</span>
                    <b>
                      {name} · {phone}
                    </b>
                  </div>
                  <div className="fm-line">
                    <span>{t("Cơ sở nuôi", "Facility")}</span>
                    <b>{L(facilityOf(facility).name, language)}</b>
                  </div>
                  <div className="fm-line">
                    <span>{t("Bắt đầu dự kiến", "Expected start")}</span>
                    <b>{start.split("-").reverse().join("/")}</b>
                  </div>
                  <div className="fm-line">
                    <span>{t("Nhận cá", "Handover")}</span>
                    <b>
                      {delivery === "pickup"
                        ? t("Tại trang trại", "Farm pickup")
                        : `${address}, ${area}`}
                    </b>
                  </div>
                </div>
                <div className="fm-note">
                  <Icon name="info" size={16} />
                  <span>
                    {fish.singleFish
                      ? t(
                          "Bạn thanh toán toàn bộ chi phí đầu tư nuôi hôm nay. Sau khi thanh toán thành công, cá này sẽ không nhận thêm đơn khác.",
                          "You pay the full sponsorship cost today. Once payment succeeds, this fish will accept no other orders.",
                        )
                      : t(
                          `Bạn chỉ thanh toán tiền đặt cọc hôm nay. Khoản này được trừ vào tổng đơn; số dư ${fmtMoney(q.balance, language)} thanh toán khi nhận cá. Tỷ lệ cọc ${Math.round(RULES.depositRate * 100)}% là cấu hình demo.`,
                          `You only pay the deposit today. It is deducted from the order total; the ${fmtMoney(q.balance, language)} balance is paid at handover. The ${Math.round(RULES.depositRate * 100)}% deposit rate is a demo configuration.`,
                        )}
                  </span>
                </div>
                <PayPanel
                  amount={q.deposit}
                  lang={language}
                  cta={t("Xác nhận đặt cọc", "Confirm deposit")}
                  run={pay}
                />
              </div>
            )}

            <div className="fm-nav">
              {step > 1 ? (
                <UiButton
                  variant="plain"
                  className="sl-btn sl-btn-ghost"
                  onClick={back}
                >
                  <Icon name="left" size={16} />
                  {t("Quay lại", "Back")}
                </UiButton>
              ) : (
                <a className="sl-btn sl-btn-ghost" href={`#farming/${fish.id}`}>
                  {t("Xem chi tiết cá", "Fish details")}
                </a>
              )}
              {step < 4 && (
                <UiButton
                  variant="plain"
                  className="sl-btn sl-btn-primary"
                  onClick={next}
                >
                  {t("Tiếp tục", "Continue")}
                  <Icon name="arrow" size={16} />
                </UiButton>
              )}
            </div>
          </section>
        </div>
        <aside
          className="sl-card pad fm-sum desk"
          aria-label={t("Tóm tắt đơn", "Order summary")}
        >
          <Summary {...sumProps} />
        </aside>
      </div>
    </>
  );
}
