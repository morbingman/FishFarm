import type { Lang } from "@/hooks/useTranslation";
import type { User } from "@/services/demoStore";
import type { Fish } from "@/services/farmingStore";
import type { IconName } from "@/components/common/Portal";
import "./Catalog.css";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Input as UiInput } from "@/components/ui/input";
import { Button as UiButton } from "@/components/ui/button";
import { Label as UiLabel } from "@/components/ui/label";
import { useMemo, useState } from "react";
import {
  Icon,
  StateBlock,
  Crumbs,
  useLoading,
} from "@/components/common/Portal";
import {
  CAT_LABEL,
  FISH,
  KIND_LABEL,
  WATER_LABEL,
  availOf,
  canBook,
  L,
  ordersOf,
  useFarming,
  type Category,
} from "@/services/farmingStore";
import { Modal, useT } from "@/components/farming/FarmingParts";
import { type Filters, F0, norm } from "@/data/farmingFilters";
import { FishCard } from "@/components/farming/FishCard";
export function Catalog({ language, user }: { language: Lang; user: User }) {
  const t = useT(language);
  const s = useFarming();
  const loading = useLoading(500);
  const [f, setF] = useState<Filters>(F0);
  const [sheet, setSheet] = useState(false);
  const [flow, setFlow] = useState(false);
  const set =
    <K extends keyof Filters>(k: K) =>
    (e: {
      target: {
        value: string;
      };
    }) =>
      setF((x) => ({
        ...x,
        [k]: e.target.value as Filters[K],
      }));
  const mine = ordersOf(s, user.email);
  const list = useMemo(() => {
    const q = norm(f.q.trim());
    const r = FISH.filter((x) => {
      const a = availOf(x, s);
      if (q && !norm(x.name.vi + " " + x.name.en + " " + x.sci).includes(q))
        return false;
      if (f.cat && x.category !== f.cat) return false;
      if (f.kind && x.kind !== f.kind) return false;
      if (f.water && x.water !== f.water) return false;
      if (f.dur === "3" && x.months > 3) return false;
      if (f.dur === "6" && (x.months < 4 || x.months > 6)) return false;
      if (f.dur === "12" && (x.months < 7 || x.months > 12)) return false;
      if (f.dur === "13" && x.months <= 12) return false;
      if (f.price === "1" && x.fishPrice >= 5_000) return false;
      if (f.price === "2" && (x.fishPrice < 5_000 || x.fishPrice >= 20_000))
        return false;
      if (f.price === "3" && (x.fishPrice < 20_000 || x.fishPrice >= 100_000))
        return false;
      if (f.price === "4" && x.fishPrice < 100_000) return false;
      if (f.slots === "open" && !canBook(a)) return false;
      if (f.slots === "plenty" && a !== "available") return false;
      return true;
    });
    const nm = (x: Fish) => x.name[language];
    return r.sort((a, b) =>
      f.sort === "price-asc"
        ? a.fishPrice - b.fishPrice
        : f.sort === "price-desc"
          ? b.fishPrice - a.fishPrice
          : f.sort === "duration"
            ? a.months - b.months
            : nm(a).localeCompare(nm(b), language),
    );
  }, [f, s, language]);
  const active = (Object.keys(F0) as (keyof Filters)[]).filter(
    (k) => k !== "sort" && f[k] !== F0[k],
  ).length;
  const stat = (icon: IconName, n: number, label: string, href?: string) => {
    const inner = (
      <>
        <span>
          <Icon name={icon} size={20} />
        </span>
        <div>
          <strong>{n}</strong>
          <small>{label}</small>
        </div>
      </>
    );
    return href ? (
      <a className="fm-stat" href={href}>
        {inner}
      </a>
    ) : (
      <div className="fm-stat">{inner}</div>
    );
  };
  const select = (
    label: string,
    k: keyof Filters,
    opts: [string, string][],
  ) => (
    <UiLabel>
      {label}
      <NativeSelect className="pt-select" value={f[k]} onChange={set(k)}>
        {opts.map(([v, l]) => (
          <NativeSelectOption key={v} value={v}>
            {l}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </UiLabel>
  );
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
          <h1>{t("Đặt nuôi cá", "Farm a Fish")}</h1>
          <p>
            {t(
              "Chọn loại cá yêu thích, đặt cọc và để trang trại chăm sóc trong suốt quá trình phát triển.",
              "Pick the fish you like, pay a deposit and let the farm care for them throughout their growth.",
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

      <div className="fm-stats" aria-label={t("Tổng quan", "Overview")}>
        {stat(
          "fish",
          FISH.filter((x) => canBook(availOf(x, s))).length,
          t("Loài cá đang nhận đặt", "Species open for booking"),
        )}
        {stat("shield", 3, t("Gói dịch vụ nuôi", "Farming service packages"))}
        {stat(
          "waves",
          mine.filter((o) =>
            ["confirmed", "preparing", "farming"].includes(o.status),
          ).length,
          t("Đơn đang nuôi của bạn", "Your active farming orders"),
          "#account/farming-orders",
        )}
        {stat(
          "truck",
          mine.filter((o) => ["ready", "handover"].includes(o.status)).length,
          t("Đơn sẵn sàng bàn giao", "Orders ready for handover"),
          "#account/farming-orders",
        )}
      </div>

      <section
        className="fm-bar"
        aria-label={t("Tìm kiếm và bộ lọc", "Search and filters")}
      >
        <div className="fm-bar-top">
          <div className="pt-search">
            <Icon name="search" size={16} />
            <UiInput
              type="search"
              value={f.q}
              onChange={set("q")}
              placeholder={t("Tìm theo tên cá…", "Search by fish name…")}
              aria-label={t("Tìm theo tên cá", "Search by fish name")}
            />
          </div>
          <UiButton
            variant="plain"
            className="sl-btn sl-btn-ghost fm-filter-btn"
            onClick={() => setSheet(true)}
          >
            <Icon name="filter" size={16} />
            {t("Bộ lọc", "Filters")}
            {active > 0 && ` (${active})`}
          </UiButton>
          <UiButton
            variant="plain"
            className="sl-btn sl-btn-ghost"
            onClick={() => setF(F0)}
            disabled={active === 0 && !f.q && f.sort === "name"}
          >
            {t("Xóa bộ lọc", "Clear filters")}
          </UiButton>
        </div>
        <div className={`fm-filters ${sheet ? "open" : ""}`}>
          <div className="fm-sheet-head">
            <span>{t("Bộ lọc", "Filters")}</span>
            <UiButton
              variant="plain"
              className="pt-iconbtn"
              onClick={() => setSheet(false)}
              aria-label={t("Đóng", "Close")}
            >
              <Icon name="x" size={16} />
            </UiButton>
          </div>
          {select(t("Nhóm cá", "Category"), "cat", [
            ["", t("Tất cả nhóm", "All categories")],
            ...(Object.keys(CAT_LABEL) as Category[]).map(
              (c) => [c, L(CAT_LABEL[c], language)] as [string, string],
            ),
          ])}
          {select(t("Loại cá", "Fish type"), "kind", [
            ["", t("Cá cảnh & thương phẩm", "Ornamental & commercial")],
            ["ornamental", L(KIND_LABEL.ornamental, language)],
            ["commercial", L(KIND_LABEL.commercial, language)],
          ])}
          {select(t("Môi trường nước", "Water type"), "water", [
            ["", t("Tất cả", "All")],
            ["fresh", L(WATER_LABEL.fresh, language)],
            ["salt", L(WATER_LABEL.salt, language)],
            ["brackish", L(WATER_LABEL.brackish, language)],
          ])}
          {select(t("Thời gian nuôi", "Farming duration"), "dur", [
            ["", t("Mọi thời gian", "Any duration")],
            ["3", t("Đến 3 tháng", "Up to 3 months")],
            ["6", t("4–6 tháng", "4–6 months")],
            ["12", t("7–12 tháng", "7–12 months")],
            ["13", t("Trên 12 tháng", "Over 12 months")],
          ])}
          {select(t("Giá cá giống / con", "Fish price / fish"), "price", [
            ["", t("Mọi mức giá", "Any price")],
            ["1", t("Dưới 5.000 ₫", "Under 5,000 ₫")],
            ["2", "5.000 – 20.000 ₫"],
            ["3", "20.000 – 100.000 ₫"],
            ["4", t("Trên 100.000 ₫", "Over 100,000 ₫")],
          ])}
          {select(t("Chỗ nuôi còn trống", "Available slots"), "slots", [
            ["", t("Tất cả", "All")],
            ["open", t("Còn nhận đặt", "Open for booking")],
            ["plenty", t("Còn nhiều chỗ", "Plenty of capacity")],
          ])}
          {select(t("Sắp xếp", "Sort by"), "sort", [
            ["name", t("Tên A → Z", "Name A → Z")],
            ["price-asc", t("Giá thấp → cao", "Price low → high")],
            ["price-desc", t("Giá cao → thấp", "Price high → low")],
            ["duration", t("Thời gian nuôi ngắn nhất", "Shortest duration")],
          ])}
          <div className="fm-sheet-foot">
            <UiButton
              variant="plain"
              className="sl-btn sl-btn-ghost"
              onClick={() => setF(F0)}
            >
              {t("Xóa bộ lọc", "Clear filters")}
            </UiButton>
            <UiButton
              variant="plain"
              className="sl-btn sl-btn-primary"
              onClick={() => setSheet(false)}
            >
              {t(`Xem ${list.length} kết quả`, `Show ${list.length} results`)}
            </UiButton>
          </div>
        </div>
      </section>

      <div className="fm-result-line">
        <span aria-live="polite">
          {t(`${list.length} loài cá`, `${list.length} species`)}
        </span>
        <span className="fm-demo-note">
          <Icon name="info" size={14} />
          {t(
            "Giá và số lượng là dữ liệu minh họa",
            "Prices and quantities are demonstration data",
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
            "Hãy thử đổi từ khóa hoặc bỏ bớt bộ lọc.",
            "Try a different keyword or remove some filters.",
          )}
          actions={
            <UiButton
              variant="plain"
              className="sl-btn sl-btn-primary"
              onClick={() => setF(F0)}
            >
              {t("Xóa bộ lọc", "Clear filters")}
            </UiButton>
          }
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
          title={t("Quy trình đặt nuôi", "How farming works")}
          onClose={() => setFlow(false)}
        >
          <ol className="fm-flow">
            <li>
              <div>
                <b>{t("Chọn cá & gói dịch vụ", "Choose fish & package")}</b>
                <span>
                  {t(
                    "Chọn loài, số lượng và gói chăm sóc phù hợp.",
                    "Pick the species, quantity and care package.",
                  )}
                </span>
              </div>
            </li>
            <li>
              <div>
                <b>{t("Đặt cọc", "Pay a deposit")}</b>
                <span>
                  {t(
                    "Thanh toán tiền cọc để giữ chỗ. Đơn chuyển sang trạng thái chờ xác nhận.",
                    "Pay the deposit to reserve a slot. The order moves to pending confirmation.",
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
                    "Sau khi xác nhận, trang trại chuẩn bị cá và chăm sóc, cập nhật tiến độ cho bạn.",
                    "Once confirmed, the farm prepares and cares for the fish and sends progress updates.",
                  )}
                </span>
              </div>
            </li>
            <li>
              <div>
                <b>{t("Nhận cá", "Receive your fish")}</b>
                <span>
                  {t(
                    "Khi cá sẵn sàng, gửi yêu cầu nhận cá, thanh toán số dư và nhận tại trại hoặc giao tận nơi.",
                    "When ready, request handover, settle the balance and collect at the farm or have it delivered.",
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
