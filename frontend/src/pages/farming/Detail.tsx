import type { Lang } from "@/hooks/useTranslation";
import { type CSSProperties } from "react";
import "./Detail.css";
import { Button as UiButton } from "@/components/ui/button";
import { useState } from "react";
import {
  Icon,
  StateBlock,
  Banner,
  Crumbs,
  useLoading,
} from "@/components/common/Portal";
import {
  AVAIL_LABEL,
  CAT_LABEL,
  ENV_IDS,
  KIND_LABEL,
  PKG_LABEL,
  RULES,
  WATER_LABEL,
  availOf,
  canBook,
  facilityOf,
  fishById,
  fmtMoney,
  fmtNum,
  L,
  remaining,
  useFarming,
  type Pkg,
} from "@/services/farmingStore";
import { Badge, TERMS, useT } from "@/components/farming/FarmingParts";
import { AV_TONE } from "@/data/farmingFilters";
export /* ---------------------------------- detail ---------------------------------- */
function Detail({ id, language }: { id: string; language: Lang }) {
  const t = useT(language);
  const s = useFarming();
  const fish = fishById(id);
  const [img, setImg] = useState(0);
  const [tab, setTab] = useState<"info" | "care" | "pkg" | "terms">("info");
  const loading = useLoading(350);
  if (!fish)
    return (
      <StateBlock
        card
        icon="search"
        tone="info"
        title={t("Không tìm thấy loài cá", "Fish not found")}
        body={t(
          "Loài cá này không tồn tại hoặc đã bị gỡ.",
          "This species doesn't exist or was removed.",
        )}
        actions={
          <a className="sl-btn sl-btn-primary" href="#farming">
            {t("Về trang đặt nuôi", "Back to farming")}
          </a>
        }
      />
    );
  const a = availOf(fish, s);
  const rem = remaining(fish, s);
  const ok = canBook(a);
  const fishPhotos = fish.photos.filter(
    (p) => !ENV_IDS.some((e) => p.includes(e)),
  );
  const envPhotos = fish.photos.filter((p) =>
    ENV_IDS.some((e) => p.includes(e)),
  );
  const all = [...fishPhotos, ...envPhotos];
  const unit = (m: number) => fmtMoney(Math.round(fish.care * m), language);
  const tabs: [typeof tab, string][] = [
    ["info", t("Thông tin cá", "Fish information")],
    ["care", t("Quy trình chăm sóc", "Care process")],
    ...(fish.singleFish
      ? []
      : ([["pkg", t("Gói dịch vụ", "Service packages")]] as [
          typeof tab,
          string,
        ][])),
    ["terms", t("Điều khoản đặt nuôi", "Farming terms")],
  ];
  const fac = fish.facilities.map(facilityOf);
  return (
    <>
      <Crumbs
        items={[
          [t("Trang chủ", "Home"), "#home"],
          [t("Đặt nuôi cá", "Farm a Fish"), "#farming"],
          [L(fish.name, language)],
        ]}
      />
      {loading ? (
        <div className="sl-card pad">
          <div className="detail-view-2">
            {[90, 70, 80, 50].map((w) => (
              <div
                key={w}
                className="pt-skel detail-view-4"
                style={
                  {
                    "--detail-layout-3-width": `${w}%`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="fm-detail">
            <div className="fm-gallery">
              <div className="fm-main">
                <img
                  src={all[img]}
                  alt={`${L(fish.name, language)} ${img + 1}`}
                />
              </div>
              <div
                className="fm-thumbs"
                role="group"
                aria-label={t("Ảnh cá", "Fish photos")}
              >
                {all.map((p, i) => (
                  <UiButton
                    variant="plain"
                    key={p}
                    className={i === img ? "on" : ""}
                    onClick={() => setImg(i)}
                    aria-label={`${t("Ảnh", "Photo")} ${i + 1}`}
                    aria-pressed={i === img}
                  >
                    <img src={p} alt="" loading="lazy" />
                  </UiButton>
                ))}
              </div>
              {envPhotos.length > 0 && (
                <p className="fm-demo-note detail-view-6">
                  <Icon name="camera" size={14} />
                  {t(
                    "Ba ảnh cuối là ảnh minh họa môi trường nuôi tại trang trại.",
                    "The last photos illustrate the farming environment.",
                  )}
                </p>
              )}
            </div>
            <div>
              <div className="fm-tags detail-view-8">
                <Badge tone={AV_TONE[a]}>{L(AVAIL_LABEL[a], language)}</Badge>
                <span className="fm-tag teal">
                  {L(CAT_LABEL[fish.category], language)}
                </span>
                <span className="fm-tag">
                  {L(KIND_LABEL[fish.kind], language)}
                </span>
                <span className="fm-tag">
                  {L(WATER_LABEL[fish.water], language)}
                </span>
              </div>
              <h2 className="fm-name">{L(fish.name, language)}</h2>
              <i className="detail-view-10">{fish.sci}</i>
              <div className="fm-spec">
                <div>
                  <small>{t("Giai đoạn hiện tại", "Current stage")}</small>
                  <b>{L(fish.stage, language)}</b>
                </div>
                <div>
                  <small>{t("Kích thước hiện tại", "Current size")}</small>
                  <b>{fish.sizeStart} cm</b>
                </div>
                <div>
                  <small>
                    {fish.singleFish
                      ? t("Kích thước mục tiêu", "Target size")
                      : t("Chu kỳ nuôi dự kiến", "Estimated cycle")}
                  </small>
                  <b>
                    {fish.singleFish
                      ? `${fish.sizeTarget} cm`
                      : t(`~${fish.months} tháng`, `~${fish.months} months`)}
                  </b>
                </div>
                <div>
                  <small>
                    {fish.singleFish
                      ? t("Trạng thái đầu tư", "Sponsorship status")
                      : t("Số lượng còn nhận", "Available quantity")}
                  </small>
                  <b>
                    {fish.singleFish
                      ? ok
                        ? t("Đang nhận đầu tư", "Open for sponsorship")
                        : t("Đã có người đầu tư", "Already sponsored")
                      : fish.paused
                        ? "—"
                        : `${fmtNum(rem, language)} ${t("con", "fish")}`}
                  </b>
                </div>
                <div>
                  <small>
                    {fish.singleFish
                      ? t("Tổng chi phí đầu tư nuôi", "Total sponsorship cost")
                      : t("Giá cá giống", "Starting fish price")}
                  </small>
                  <b>
                    {fmtMoney(fish.fishPrice, language)}{" "}
                    {!fish.singleFish && t("/ con", "/ fish")}
                  </b>
                </div>
                {!fish.singleFish && (
                  <div>
                    <small>{t("Phí dịch vụ từ", "Service from")}</small>
                    <b>
                      {unit(1)} {t("/ con / tháng", "/ fish / mo.")}
                    </b>
                  </div>
                )}
              </div>
              {(fac.length > 0 || fish.deliveryAreas.length > 0) && (
                <div className="sl-card pad detail-view-12">
                  <b className="detail-view-14">
                    <Icon name="map" size={16} />
                    {t("Cơ sở nuôi", "Farming facility")}
                  </b>
                  {fac.map((f) => (
                    <p key={f.id} className="detail-view-16">
                      <b>{L(f.name, language)}</b> —{" "}
                      <span className="detail-view-18">
                        {L(f.address, language)}
                      </span>
                    </p>
                  ))}
                  <p className="detail-view-20">
                    {fish.deliveryAreas.length
                      ? t(
                          `Hỗ trợ giao tận nơi: ${fish.deliveryAreas.join(", ")}.`,
                          `Home delivery: ${fish.deliveryAreas.join(", ")}.`,
                        )
                      : t("Chỉ nhận cá tại trang trại.", "Farm pickup only.")}
                  </p>
                </div>
              )}
              {!ok && (
                <Banner tone="warn">
                  {a === "full"
                    ? fish.singleFish
                      ? t(
                          "Cá này đã có người đầu tư nuôi.",
                          "This fish already has an investor.",
                        )
                      : t(
                          "Đợt nuôi này đã kín chỗ. Vui lòng quay lại khi có đợt mới.",
                          "This batch is fully booked. Check back when a new batch opens.",
                        )
                    : t(
                        "Loài cá này tạm ngừng nhận đặt nuôi.",
                        "Bookings for this species are temporarily unavailable.",
                      )}
                </Banner>
              )}
              <div className="fm-actions">
                {ok ? (
                  <a
                    className="sl-btn sl-btn-primary lg"
                    href={`#farming/booking?fish=${fish.id}`}
                  >
                    {fish.singleFish
                      ? t("Đầu tư nuôi cá này", "Sponsor this fish")
                      : t("Tiến hành đặt nuôi", "Start booking")}
                    <Icon name="arrow" size={16} />
                  </a>
                ) : (
                  <UiButton
                    variant="plain"
                    className="sl-btn sl-btn-primary lg"
                    disabled
                  >
                    {fish.singleFish
                      ? t("Cá đã có người đầu tư", "Fish already sponsored")
                      : t("Tiến hành đặt nuôi", "Start booking")}
                  </UiButton>
                )}
                <a className="sl-btn sl-btn-ghost lg" href="#farming">
                  {t("Quay lại danh sách", "Back to list")}
                </a>
              </div>
            </div>
          </div>

          <section className="sl-card detail-view-24">
            <div className="pt-tabs" role="tablist">
              {tabs.map(([k, l]) => (
                <UiButton
                  variant="plain"
                  key={k}
                  role="tab"
                  aria-selected={tab === k}
                  className={tab === k ? "on" : ""}
                  onClick={() => setTab(k)}
                >
                  {l}
                </UiButton>
              ))}
            </div>
            <div className="fm-tabpanel" role="tabpanel">
              {tab === "info" && (
                <div className="detail-view-26">
                  <p className="detail-view-28">{L(fish.desc, language)}</p>
                  <div className="fm-spec detail-view-30">
                    {fish.info.map((r) => (
                      <div key={r.k.en}>
                        <small>{L(r.k, language)}</small>
                        <b>{L(r.v, language)}</b>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {tab === "care" && (
                <ul className="fm-list">
                  {[
                    [
                      t("Tiếp nhận & thả giống", "Intake & stocking"),
                      t(
                        "Kiểm tra sức khỏe, phân cỡ và thả vào ao đã xử lý nước.",
                        "Health check, grading and release into a treated pond.",
                      ),
                    ],
                    [
                      t("Cho ăn theo lịch", "Scheduled feeding"),
                      t(
                        "Khẩu phần điều chỉnh theo trọng lượng đàn và nhiệt độ nước.",
                        "Rations adjusted to stock weight and water temperature.",
                      ),
                    ],
                    [
                      t("Theo dõi chất lượng nước", "Water monitoring"),
                      t(
                        "Đo pH, oxy hòa tan, nhiệt độ; thay nước khi cần.",
                        "pH, dissolved oxygen and temperature tracking; water exchange when needed.",
                      ),
                    ],
                    [
                      t("Kiểm tra sức khỏe định kỳ", "Routine health checks"),
                      t(
                        "Lấy mẫu kiểm tra và xử lý sớm khi có dấu hiệu bất thường.",
                        "Sampling and early treatment at the first sign of trouble.",
                      ),
                    ],
                    [
                      t("Cập nhật tiến độ", "Progress updates"),
                      t(
                        "Ghi nhận kích thước, ảnh và ghi chú vào đơn của bạn.",
                        "Sizes, photos and notes are logged on your order.",
                      ),
                    ],
                    [
                      t("Chuẩn bị bàn giao", "Handover preparation"),
                      t(
                        "Nhịn ăn, đóng gói và thông báo khi cá sẵn sàng.",
                        "Purging, packing and a notification when fish are ready.",
                      ),
                    ],
                  ].map(([h, p]) => (
                    <li key={h}>
                      <Icon name="check" size={16} />
                      <span>
                        <b className="detail-view-32">{h}</b>
                        <br />
                        <span className="detail-view-34">{p}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {tab === "pkg" && (
                <div className="fm-cols">
                  {(
                    [
                      ["basic", 1],
                      ["advanced", RULES.advancedMultiplier],
                      ["custom", 0],
                    ] as [Pkg, number][]
                  ).map(([p, m]) => (
                    <div key={p} className="fm-minicard">
                      <h4>{L(PKG_LABEL[p], language)}</h4>
                      <p className="detail-view-36">
                        {p === "basic"
                          ? t(
                              "Cho ăn, theo dõi nước cơ bản, cập nhật định kỳ.",
                              "Feeding, basic water monitoring, periodic updates.",
                            )
                          : p === "advanced"
                            ? t(
                                "Gồm gói Cơ bản, ảnh thường xuyên và báo cáo chi tiết.",
                                "Everything in Basic, plus frequent photos and detailed reports.",
                              )
                            : t(
                                "Tự chọn từng dịch vụ chăm sóc được hỗ trợ.",
                                "Choose the supported care services one by one.",
                              )}
                      </p>
                      <b className="detail-view-38">
                        {p === "custom"
                          ? t(`Từ ${unit(0.25)}`, `From ${unit(0.25)}`)
                          : unit(m)}{" "}
                        <span className="detail-view-40">
                          {t("/ con / tháng", "/ fish / month")}
                        </span>
                      </b>
                    </div>
                  ))}
                </div>
              )}
              {tab === "terms" && (
                <div className="detail-view-42">
                  {TERMS.map((x) => (
                    <div key={x.h.en}>
                      <b className="detail-view-44">{L(x.h, language)}</b>
                      <p className="detail-view-46">{L(x.p, language)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}

/* ---------------------------------- booking ---------------------------------- */
