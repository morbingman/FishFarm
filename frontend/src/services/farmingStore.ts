import type { Lang } from "@/hooks/useTranslation";
import { useEffect, useSyncExternalStore } from "react";
import { log, notify, currentUser } from "@/services/demoStore";
import { api, domainApi } from "@/services/api";

/* ============ types ============ */
export type Bi = {
  vi: string;
  en: string;
};
export const L = (b: Bi, lang: Lang) => b[lang];
const bi = (vi: string, en: string): Bi => ({
  vi,
  en,
});
export type Avail = "available" | "limited" | "full" | "paused";
export type Category = "carp" | "tilapia" | "catfish" | "livebearer" | "marine";
export type Water = "fresh" | "salt" | "brackish";
export type Kind = "ornamental" | "commercial";
export type Pkg = "basic" | "advanced" | "custom";
export type Delivery = "pickup" | "delivery";
export type PayMethod = "bank" | "gateway" | "wallet";
export type PayStatus =
  "unpaid" | "processing" | "paid" | "failed" | "refund_pending" | "refunded";
export type OrderStatus =
  | "awaiting_deposit"
  | "pending"
  | "confirmed"
  | "preparing"
  | "farming"
  | "ready"
  | "handover"
  | "completed"
  | "cancelled";
export type CareType = "feeding" | "water" | "health" | "note" | "photo";
export type Facility = {
  id: string;
  name: Bi;
  address: Bi;
};
export type Fish = {
  id: string;
  singleFish?: boolean;
  hasSchedule?: boolean;
  catalogVisible?: boolean;
  name: Bi;
  sci: string;
  category: Category;
  kind: Kind;
  water: Water;
  stage: Bi;
  sizeStart: number;
  sizeTarget: number;
  months: number;
  fishPrice: number;
  care: number;
  minQty: number;
  perBox: number;
  total: number;
  capacity: number;
  paused?: boolean;
  facilities: string[];
  deliveryAreas: string[];
  photos: string[];
  desc: Bi;
  info: {
    k: Bi;
    v: Bi;
  }[];
};
export type Payment = {
  id: string;
  at: string;
  amount: number;
  method: PayMethod;
  status: PayStatus;
  ref: string;
  kind: "deposit" | "balance" | "refund";
};
export type Care = {
  id: string;
  at: string;
  type: CareType;
  text: Bi;
  by: Bi;
  photo?: string;
};
export type Meas = {
  at: string;
  sizeCm: number;
  weightG: number;
  survival: number;
};
export type Handover = {
  method: Delivery;
  date: string;
  address: string;
  status: "requested" | "scheduled" | "in_transit" | "done";
  requestedAt: string;
};
export type Order = {
  id: string;
  owner: string;
  fishId: string;
  qty: number;
  confirmedQty: number | null;
  pkg: Pkg;
  addons: string[];
  facility: string;
  createdAt: string;
  startDate: string;
  months: number;
  fishSubtotal: number;
  serviceCost: number;
  deliveryFee: number;
  total: number;
  deposit: number;
  balance: number;
  status: OrderStatus;
  delivery: Delivery;
  area: string;
  address: string;
  name: string;
  phone: string;
  notes: string;
  payments: Payment[];
  care: Care[];
  meas: Meas[];
  handover: Handover | null;
  sample: boolean;
};

/* ============ business rules (demo configuration) ============ */
export const RULES = {
  depositRate: 0.3,
  minDeposit: 100_000,
  advancedMultiplier: 1.6,
  limitedRatio: 0.2,
  leadDays: 3,
};
export const ADDONS: {
  id: string;
  mult: number;
  name: Bi;
  desc: Bi;
}[] = [
  {
    id: "feeding",
    mult: 0.5,
    name: bi("Cho ăn theo lịch", "Scheduled feeding"),
    desc: bi(
      "Khẩu phần theo giai đoạn phát triển",
      "Rations matched to growth stage",
    ),
  },
  {
    id: "water",
    mult: 0.25,
    name: bi("Theo dõi chất lượng nước", "Water monitoring"),
    desc: bi(
      "Đo pH, oxy hòa tan, nhiệt độ hằng ngày",
      "Daily pH, dissolved oxygen, temperature",
    ),
  },
  {
    id: "photo",
    mult: 0.25,
    name: bi("Ảnh cập nhật hằng tuần", "Weekly photo updates"),
    desc: bi(
      "Ảnh thật từ ao nuôi gửi vào đơn",
      "Real photos from the pond added to your order",
    ),
  },
  {
    id: "report",
    mult: 0.3,
    name: bi("Báo cáo nuôi chi tiết", "Detailed farming reports"),
    desc: bi(
      "Số đo kích thước, tỷ lệ sống theo tháng",
      "Monthly size and survival records",
    ),
  },
  {
    id: "vet",
    mult: 0.4,
    name: bi("Kiểm tra sức khỏe chuyên sâu", "Extended health checks"),
    desc: bi(
      "Kiểm tra bệnh lý định kỳ bởi kỹ thuật viên",
      "Periodic checks by a farm technician",
    ),
  },
];
export const PKG_MULT = (pkg: Pkg, addons: string[]) =>
  pkg === "basic"
    ? 1
    : pkg === "advanced"
      ? RULES.advancedMultiplier
      : ADDONS.filter((a) => addons.includes(a.id)).reduce(
          (s, a) => s + a.mult,
          0,
        );
export const FACILITIES: Facility[] = [
  {
    id: "cc",
    name: bi("Trại nuôi Củ Chi", "Cu Chi Farm"),
    address: bi(
      "Xã Phước Hiệp, Củ Chi, TP. Hồ Chí Minh",
      "Phuoc Hiep, Cu Chi, Ho Chi Minh City",
    ),
  },
  {
    id: "ct",
    name: bi("Trại nuôi Cần Thơ", "Can Tho Farm"),
    address: bi("Huyện Phong Điền, Cần Thơ", "Phong Dien District, Can Tho"),
  },
  {
    id: "vt",
    name: bi("Trại nuôi Vũng Tàu", "Vung Tau Farm"),
    address: bi("Xã Long Sơn, Vũng Tàu", "Long Son, Vung Tau"),
  },
];
export const facilityOf = (id: string) =>
  FACILITIES.find((f) => f.id === id) ?? FACILITIES[0];
export const AREAS_SOUTH = [
  "TP. Hồ Chí Minh",
  "Đồng Nai",
  "Bình Dương",
  "Long An",
  "Cần Thơ",
];
const U = (id: string, w = 900) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${Math.round(w * 0.75)}&fit=crop&auto=format`;
export const ENV_IDS = [
  "1768475162937-9cd0b89815b6",
  "1768941362625-4c3b206e6250",
  "1711826949953-6ac54aa7546b",
];
const env = (...i: number[]) => i.map((n) => U(ENV_IDS[n]));
export const FISH: Fish[] = [
  {
    id: "koi",
    name: bi("Cá Koi", "Koi"),
    sci: "Cyprinus rubrofuscus",
    category: "carp",
    kind: "ornamental",
    water: "fresh",
    stage: bi("Cá giống 8–10 cm", "Fingerling 8–10 cm"),
    sizeStart: 9,
    sizeTarget: 32,
    months: 12,
    fishPrice: 650_000,
    care: 90_000,
    minQty: 1,
    perBox: 2,
    total: 120,
    capacity: 22,
    facilities: ["cc"],
    deliveryAreas: AREAS_SOUTH.slice(0, 3),
    photos: [
      U("1640529837996-b81a91eaf7a5"),
      U("1543285129-bfdac0db10b2"),
      U("1540996772485-94e7e92bc1f0"),
    ].concat(env(0)),
    desc: bi(
      "Koi giống tuyển chọn từ đàn bố mẹ thuần chủng, nuôi trong ao lót bạt có hệ thống lọc tuần hoàn để lên màu và dáng đẹp.",
      "Selected koi fingerlings from pure-line parents, raised in lined ponds with recirculating filtration for colour and body shape.",
    ),
    info: [
      {
        k: bi("Nhóm", "Group"),
        v: bi("Cá cảnh nước ngọt", "Freshwater ornamental"),
      },
      {
        k: bi("Nhiệt độ nước", "Water temp."),
        v: bi("22–28 °C", "22–28 °C"),
      },
      {
        k: bi("Kích thước kỳ vọng", "Expected size"),
        v: bi("28–35 cm", "28–35 cm"),
      },
      {
        k: bi("Thức ăn", "Feed"),
        v: bi(
          "Cám nổi giàu đạm, 2–3 cữ/ngày",
          "High-protein floating feed, 2–3 times/day",
        ),
      },
    ],
  },
  {
    id: "tilapia",
    name: bi("Cá rô phi", "Tilapia"),
    sci: "Oreochromis niloticus",
    category: "tilapia",
    kind: "commercial",
    water: "fresh",
    stage: bi("Cá giống 5 cm", "Fingerling 5 cm"),
    sizeStart: 5,
    sizeTarget: 24,
    months: 5,
    fishPrice: 3_500,
    care: 1_800,
    minQty: 200,
    perBox: 100,
    total: 20_000,
    capacity: 14_000,
    facilities: ["ct", "cc"],
    deliveryAreas: AREAS_SOUTH,
    photos: [U("1607629194532-53c98b8180da")].concat(env(1, 2)),
    desc: bi(
      "Rô phi dòng GIFT sinh trưởng nhanh, nuôi mật độ vừa phải trong ao đất, thu hoạch cỡ 500–700 g/con.",
      "Fast-growing GIFT-strain tilapia stocked at moderate density in earth ponds, harvested at 500–700 g each.",
    ),
    info: [
      {
        k: bi("Nhóm", "Group"),
        v: bi("Cá thương phẩm", "Commercial food fish"),
      },
      {
        k: bi("Trọng lượng thu hoạch", "Harvest weight"),
        v: bi("500–700 g/con", "500–700 g each"),
      },
      {
        k: bi("Mật độ", "Stocking density"),
        v: bi("5–6 con/m²", "5–6 fish/m²"),
      },
      {
        k: bi("Thức ăn", "Feed"),
        v: bi(
          "Cám viên công nghiệp 28–32% đạm",
          "Pelleted feed, 28–32% protein",
        ),
      },
    ],
  },
  {
    id: "carp",
    name: bi("Cá chép", "Common carp"),
    sci: "Cyprinus carpio",
    category: "carp",
    kind: "commercial",
    water: "fresh",
    stage: bi("Cá giống 8 cm", "Fingerling 8 cm"),
    sizeStart: 8,
    sizeTarget: 30,
    months: 6,
    fishPrice: 6_000,
    care: 2_500,
    minQty: 100,
    perBox: 60,
    total: 6_000,
    capacity: 3_200,
    facilities: ["cc"],
    deliveryAreas: AREAS_SOUTH.slice(0, 4),
    photos: [
      U("1541441056316-443fff347c40"),
      U("1627223330339-370c025265d8"),
    ].concat(env(1)),
    desc: bi(
      "Cá chép giống khỏe, ăn tạp, thích nghi tốt. Phù hợp nuôi lấy thịt hoặc thả hồ, ao gia đình.",
      "Hardy omnivorous carp fingerlings that adapt well, suited to food production or family ponds.",
    ),
    info: [
      {
        k: bi("Nhóm", "Group"),
        v: bi("Cá thương phẩm", "Commercial food fish"),
      },
      {
        k: bi("Trọng lượng thu hoạch", "Harvest weight"),
        v: bi("1,0–1,5 kg/con", "1.0–1.5 kg each"),
      },
      {
        k: bi("Nhiệt độ nước", "Water temp."),
        v: bi("20–30 °C", "20–30 °C"),
      },
      {
        k: bi("Thức ăn", "Feed"),
        v: bi(
          "Cám viên kết hợp thức ăn tươi",
          "Pellets with fresh supplementary feed",
        ),
      },
    ],
  },
  {
    id: "catfish",
    name: bi("Cá trê", "Catfish (trê)"),
    sci: "Clarias gariepinus",
    category: "catfish",
    kind: "commercial",
    water: "fresh",
    stage: bi("Cá giống 6 cm", "Fingerling 6 cm"),
    sizeStart: 6,
    sizeTarget: 28,
    months: 4,
    fishPrice: 2_500,
    care: 1_500,
    minQty: 200,
    perBox: 120,
    total: 12_000,
    capacity: 1_800,
    facilities: ["ct"],
    deliveryAreas: AREAS_SOUTH.slice(3),
    photos: [U("1723975465129-269a531e8658")].concat(env(2, 1)),
    desc: bi(
      "Cá trê lai sinh trưởng nhanh, chịu được mật độ cao. Ao nuôi có hệ thống thay nước định kỳ.",
      "Fast-growing hybrid catfish that tolerates higher density. Ponds have scheduled water exchange.",
    ),
    info: [
      {
        k: bi("Nhóm", "Group"),
        v: bi("Cá da trơn thương phẩm", "Commercial catfish"),
      },
      {
        k: bi("Trọng lượng thu hoạch", "Harvest weight"),
        v: bi("300–400 g/con", "300–400 g each"),
      },
      {
        k: bi("Thức ăn", "Feed"),
        v: bi("Cám viên 30% đạm", "Pelleted feed, 30% protein"),
      },
      {
        k: bi("Chu kỳ", "Cycle"),
        v: bi("Khoảng 4 tháng", "About 4 months"),
      },
    ],
  },
  {
    id: "basa",
    name: bi("Cá basa", "Basa"),
    sci: "Pangasius bocourti",
    category: "catfish",
    kind: "commercial",
    water: "fresh",
    stage: bi("Cá giống 10 cm", "Fingerling 10 cm"),
    sizeStart: 10,
    sizeTarget: 45,
    months: 8,
    fishPrice: 9_000,
    care: 3_200,
    minQty: 100,
    perBox: 50,
    total: 10_000,
    capacity: 6_500,
    facilities: ["ct"],
    deliveryAreas: ["Cần Thơ", "Long An"],
    photos: [U("1515735543535-12664d2453f8")].concat(env(2, 0)),
    desc: bi(
      "Basa nuôi ao nước chảy tại Cần Thơ, thịt trắng, ít mỡ. Quy trình theo dõi chất lượng nước hằng ngày.",
      "Basa raised in flow-through ponds in Can Tho. White, lean flesh with daily water-quality monitoring.",
    ),
    info: [
      {
        k: bi("Nhóm", "Group"),
        v: bi("Cá da trơn thương phẩm", "Commercial catfish"),
      },
      {
        k: bi("Trọng lượng thu hoạch", "Harvest weight"),
        v: bi("1,0–1,2 kg/con", "1.0–1.2 kg each"),
      },
      {
        k: bi("Thức ăn", "Feed"),
        v: bi("Cám viên 26–28% đạm", "Pelleted feed, 26–28% protein"),
      },
      {
        k: bi("Chu kỳ", "Cycle"),
        v: bi("Khoảng 8 tháng", "About 8 months"),
      },
    ],
  },
  {
    id: "guppy",
    name: bi("Cá bảy màu", "Guppy"),
    sci: "Poecilia reticulata",
    category: "livebearer",
    kind: "ornamental",
    water: "fresh",
    stage: bi("Cá con 1,5 cm", "Juvenile 1.5 cm"),
    sizeStart: 1.5,
    sizeTarget: 4.5,
    months: 3,
    fishPrice: 2_000,
    care: 800,
    minQty: 50,
    perBox: 100,
    total: 5_000,
    capacity: 4_100,
    facilities: ["cc"],
    deliveryAreas: AREAS_SOUTH,
    photos: [
      U("1706479980962-23942d2f4d56"),
      U("1711826949953-6ac54aa7546b"),
    ].concat(env(0)),
    desc: bi(
      "Bảy màu dòng đuôi quạt, màu sắc rực rỡ, nuôi trong bể xi măng có sục khí và lọc sinh học.",
      "Fancy-tail guppies with vivid colour, raised in concrete tanks with aeration and biofiltration.",
    ),
    info: [
      {
        k: bi("Nhóm", "Group"),
        v: bi("Cá cảnh nước ngọt", "Freshwater ornamental"),
      },
      {
        k: bi("Nhiệt độ nước", "Water temp."),
        v: bi("24–28 °C", "24–28 °C"),
      },
      {
        k: bi("Kích thước kỳ vọng", "Expected size"),
        v: bi("4–5 cm", "4–5 cm"),
      },
      {
        k: bi("Thức ăn", "Feed"),
        v: bi("Thức ăn dạng bột giàu đạm", "High-protein fine feed"),
      },
    ],
  },
  {
    id: "barra",
    name: bi("Cá chẽm", "Barramundi"),
    sci: "Lates calcarifer",
    category: "marine",
    kind: "commercial",
    water: "brackish",
    stage: bi("Cá giống 8–10 cm", "Fingerling 8–10 cm"),
    sizeStart: 9,
    sizeTarget: 42,
    months: 7,
    fishPrice: 14_000,
    care: 5_000,
    minQty: 100,
    perBox: 40,
    total: 4_000,
    capacity: 2_100,
    facilities: ["vt"],
    deliveryAreas: [],
    photos: [U("1645793664614-b4aa5b610946")].concat(env(2, 1)),
    desc: bi(
      "Cá chẽm nuôi ao nước lợ tại Vũng Tàu, độ mặn ổn định 10–20‰. Chỉ nhận cá tại trang trại để đảm bảo chất lượng.",
      "Barramundi raised in brackish ponds at Vung Tau with stable 10–20‰ salinity. Farm pickup only to protect quality.",
    ),
    info: [
      {
        k: bi("Nhóm", "Group"),
        v: bi("Cá biển & nước lợ thương phẩm", "Marine / brackish food fish"),
      },
      {
        k: bi("Độ mặn", "Salinity"),
        v: bi("10–20‰", "10–20‰"),
      },
      {
        k: bi("Trọng lượng thu hoạch", "Harvest weight"),
        v: bi("0,8–1,0 kg/con", "0.8–1.0 kg each"),
      },
      {
        k: bi("Nhận cá", "Handover"),
        v: bi("Tại trang trại", "At the farm"),
      },
    ],
  },
  {
    id: "grouper",
    name: bi("Cá mú", "Grouper"),
    sci: "Epinephelus spp.",
    category: "marine",
    kind: "commercial",
    water: "salt",
    stage: bi("Cá giống 12 cm", "Fingerling 12 cm"),
    sizeStart: 12,
    sizeTarget: 40,
    months: 14,
    fishPrice: 38_000,
    care: 9_000,
    minQty: 50,
    perBox: 20,
    total: 1_500,
    capacity: 0,
    facilities: ["vt"],
    deliveryAreas: [],
    photos: [U("1645692397118-0eba11cd6c11")].concat(env(2)),
    desc: bi(
      "Cá mú nuôi lồng bè nước mặn với chu kỳ dài. Đợt này đã kín chỗ, đăng ký nhận thông báo cho đợt tiếp theo.",
      "Grouper raised in marine net cages over a long cycle. This batch is fully booked; register interest for the next one.",
    ),
    info: [
      {
        k: bi("Nhóm", "Group"),
        v: bi("Cá biển thương phẩm", "Marine food fish"),
      },
      {
        k: bi("Độ mặn", "Salinity"),
        v: bi("28–33‰", "28–33‰"),
      },
      {
        k: bi("Chu kỳ", "Cycle"),
        v: bi("Khoảng 14 tháng", "About 14 months"),
      },
      {
        k: bi("Nhận cá", "Handover"),
        v: bi("Tại trang trại", "At the farm"),
      },
    ],
  },
  {
    id: "clown",
    name: bi("Cá hề", "Clownfish"),
    sci: "Amphiprion ocellaris",
    category: "marine",
    kind: "ornamental",
    water: "salt",
    stage: bi("Cá con 2–3 cm", "Juvenile 2–3 cm"),
    sizeStart: 2.5,
    sizeTarget: 7,
    months: 6,
    fishPrice: 180_000,
    care: 25_000,
    minQty: 2,
    perBox: 4,
    total: 200,
    capacity: 60,
    paused: true,
    facilities: ["vt"],
    deliveryAreas: [],
    photos: [
      U("1535591273668-578e31182c4f"),
      U("1779122624831-f00f349776ca"),
    ].concat(env(0)),
    desc: bi(
      "Cá hề sinh sản nhân tạo, nuôi trong hệ thống nước biển nhân tạo. Tạm ngừng nhận đặt trong lúc bảo trì hệ thống.",
      "Captive-bred clownfish in an artificial seawater system. Bookings are paused during system maintenance.",
    ),
    info: [
      {
        k: bi("Nhóm", "Group"),
        v: bi("Cá cảnh nước mặn", "Saltwater ornamental"),
      },
      {
        k: bi("Nhiệt độ nước", "Water temp."),
        v: bi("25–28 °C", "25–28 °C"),
      },
      {
        k: bi("Kích thước kỳ vọng", "Expected size"),
        v: bi("6–8 cm", "6–8 cm"),
      },
      {
        k: bi("Trạng thái", "Status"),
        v: bi("Tạm ngừng nhận đặt", "Bookings paused"),
      },
    ],
  },
];
// The catalogue is populated from /batches. The former design-time examples above only
// document the shape and are never exposed as application data.
FISH.splice(0, FISH.length);
export const fishById = (id?: string | null) => FISH.find((f) => f.id === id);
export const CAT_LABEL: Record<Category, Bi> = {
  carp: bi("Cá chép & Koi", "Carp & Koi"),
  tilapia: bi("Cá rô phi", "Tilapia"),
  catfish: bi("Cá da trơn", "Catfish"),
  livebearer: bi("Cá đẻ con", "Livebearers"),
  marine: bi("Cá biển & nước lợ", "Marine & brackish"),
};
export const WATER_LABEL: Record<Water, Bi> = {
  fresh: bi("Nước ngọt", "Freshwater"),
  salt: bi("Nước mặn", "Saltwater"),
  brackish: bi("Nước lợ", "Brackish"),
};
export const KIND_LABEL: Record<Kind, Bi> = {
  ornamental: bi("Cá cảnh", "Ornamental"),
  commercial: bi("Cá thương phẩm", "Commercial"),
};
export const AVAIL_LABEL: Record<Avail, Bi> = {
  available: bi("Còn chỗ", "Available"),
  limited: bi("Sắp hết chỗ", "Limited availability"),
  full: bi("Đã kín chỗ", "Fully booked"),
  paused: bi("Tạm ngừng nhận", "Temporarily unavailable"),
};
export const STATUS_LABEL: Record<OrderStatus, Bi> = {
  awaiting_deposit: bi("Chờ thanh toán cọc", "Awaiting deposit"),
  pending: bi("Chờ xác nhận", "Pending confirmation"),
  confirmed: bi("Đã xác nhận", "Confirmed"),
  preparing: bi("Đang chuẩn bị", "Preparing"),
  farming: bi("Đang nuôi", "Farming"),
  ready: bi("Sẵn sàng bàn giao", "Ready for handover"),
  handover: bi("Đang bàn giao", "Handover in progress"),
  completed: bi("Hoàn thành", "Completed"),
  cancelled: bi("Đã hủy", "Cancelled"),
};
export const STATUS_TONE: Record<OrderStatus, string> = {
  awaiting_deposit: "warn",
  pending: "warn",
  confirmed: "info",
  preparing: "info",
  farming: "ok",
  ready: "ok",
  handover: "info",
  completed: "muted",
  cancelled: "muted",
};
export const PAY_LABEL: Record<PayStatus, Bi> = {
  unpaid: bi("Chưa thanh toán", "Unpaid"),
  processing: bi("Đang xử lý", "Processing"),
  paid: bi("Đã thanh toán", "Paid"),
  failed: bi("Thất bại", "Failed"),
  refund_pending: bi("Chờ hoàn tiền", "Refund pending"),
  refunded: bi("Đã hoàn tiền", "Refunded"),
};
export const PAY_TONE: Record<PayStatus, string> = {
  unpaid: "muted",
  processing: "info",
  paid: "ok",
  failed: "bad",
  refund_pending: "warn",
  refunded: "muted",
};
export const METHOD_LABEL: Record<PayMethod, Bi> = {
  bank: bi("Chuyển khoản ngân hàng", "Bank transfer"),
  gateway: bi("Cổng thanh toán trực tuyến", "Online payment gateway"),
  wallet: bi("Ví điện tử", "E-wallet"),
};
export const PKG_LABEL: Record<Pkg, Bi> = {
  basic: bi("Gói Cơ bản", "Basic package"),
  advanced: bi("Gói Nâng cao", "Advanced package"),
  custom: bi("Gói Tùy chỉnh", "Custom package"),
};
export const CARE_LABEL: Record<CareType, Bi> = {
  feeding: bi("Cho ăn", "Feeding"),
  water: bi("Chất lượng nước", "Water quality"),
  health: bi("Kiểm tra sức khỏe", "Health check"),
  note: bi("Ghi chú nhân viên", "Staff note"),
  photo: bi("Ảnh cập nhật", "Photo update"),
};

/* ============ pricing ============ */
export type Quote = {
  fishSubtotal: number;
  serviceCost: number;
  deliveryFee: number;
  total: number;
  deposit: number;
  balance: number;
  unit: number;
  addonLines: {
    id: string;
    amount: number;
  }[];
};
export function quote(
  fish: Fish,
  qty: number,
  pkg: Pkg,
  addons: string[],
  delivery: Delivery,
): Quote {
  const q = Math.max(0, Math.floor(qty) || 0);
  const unit = Math.round(fish.care * PKG_MULT(pkg, addons));
  const serviceCost = unit * fish.months * q;
  const fishSubtotal = fish.fishPrice * q;
  const deliveryFee =
    delivery === "delivery" && fish.deliveryAreas.length && q > 0
      ? Math.min(2_000_000, 80_000 + 12_000 * Math.ceil(q / fish.perBox))
      : 0;
  const total = fishSubtotal + serviceCost + deliveryFee;
  const deposit = fish.singleFish
    ? total
    : total === 0
      ? 0
      : Math.min(
          total,
          Math.max(
            RULES.minDeposit,
            Math.round((total * RULES.depositRate) / 1000) * 1000,
          ),
        );
  const addonLines =
    pkg === "custom"
      ? ADDONS.filter((a) => addons.includes(a.id)).map((a) => ({
          id: a.id,
          amount: Math.round(fish.care * a.mult) * fish.months * q,
        }))
      : [];
  return {
    fishSubtotal,
    serviceCost,
    deliveryFee,
    total,
    deposit,
    balance: total - deposit,
    unit,
    addonLines,
  };
}
export const fmtMoney = (n: number, lang: Lang) =>
  new Intl.NumberFormat(lang === "vi" ? "vi-VN" : "en-GB").format(
    Math.round(n),
  ) + " ₫";
export const fmtDay = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleDateString(lang === "vi" ? "vi-VN" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
export const fmtTime = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleString(lang === "vi" ? "vi-VN" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export const fmtNum = (n: number, lang: Lang) =>
  new Intl.NumberFormat(lang === "vi" ? "vi-VN" : "en-GB").format(n);

/* ============ state ============ */
type State = {
  orders: Order[];
  used: Record<string, number>;
  seq: number;
};
const KEY = "fishmarket-farming-v1";
const DEMO_OWNER = "buyer@fishmarket.demo";
const day = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * day).toISOString();
const ahead = (d: number) => new Date(Date.now() + d * day).toISOString();
const ymd = (iso: string) => iso.slice(0, 10);
const NOTE_TEXT: Bi[] = [
  bi(
    "Đàn cá ăn mạnh, đồng đều, không ghi nhận bất thường.",
    "The stock is feeding well and evenly, no abnormalities noted.",
  ),
  bi(
    "Đã tách cá nhỏ sang ao riêng để đảm bảo tốc độ lớn đồng đều.",
    "Smaller fish moved to a separate pond to keep growth even.",
  ),
  bi(
    "Thời tiết nắng nóng, đã tăng sục khí vào buổi trưa.",
    "Hot weather, aeration increased around midday.",
  ),
];
function history(
  o: {
    id: string;
    startDate: string;
    status: OrderStatus;
    months: number;
    sizeStart: number;
    sizeTarget: number;
  },
  fishPhotos: string[],
): {
  care: Care[];
  meas: Meas[];
} {
  const started = ["farming", "ready", "handover", "completed"].includes(
    o.status,
  );
  if (!started)
    return {
      care: [],
      meas: [],
    };
  const elapsed =
    o.status === "farming"
      ? Math.max(
          5,
          Math.min(
            Math.round((Date.now() - new Date(o.startDate).getTime()) / day),
            o.months * 30,
          ),
        )
      : o.months * 30;
  const care: Care[] = [];
  const marks = [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1]
    .map((p) => Math.round(p * elapsed))
    .filter((v, i, a) => a.indexOf(v) === i);
  marks.forEach((d, i) => {
    const at = new Date(
      new Date(o.startDate).getTime() + d * day + 8 * 3600_000,
    ).toISOString();
    const by = bi("Kỹ thuật viên trại", "Farm technician");
    care.push({
      id: `${o.id}-f${i}`,
      at,
      type: "feeding",
      text: bi(
        `Cho ăn ${3 - (i % 2)} cữ, lượng cám điều chỉnh theo trọng lượng đàn.`,
        `Fed ${3 - (i % 2)} times; ration adjusted to stock weight.`,
      ),
      by,
    });
    if (i % 2 === 0)
      care.push({
        id: `${o.id}-w${i}`,
        at: new Date(new Date(at).getTime() + 3600_000).toISOString(),
        type: "water",
        text: bi(
          `pH ${(7.1 + (i % 3) * 0.1).toFixed(1)} · Oxy ${(5.8 + (i % 4) * 0.2).toFixed(1)} mg/L · ${27 + (i % 2)} °C — trong ngưỡng an toàn.`,
          `pH ${(7.1 + (i % 3) * 0.1).toFixed(1)} · DO ${(5.8 + (i % 4) * 0.2).toFixed(1)} mg/L · ${27 + (i % 2)} °C — within safe range.`,
        ),
        by,
      });
    if (i % 3 === 1)
      care.push({
        id: `${o.id}-h${i}`,
        at: new Date(new Date(at).getTime() + 7200_000).toISOString(),
        type: "health",
        text: bi(
          "Kiểm tra mẫu ngẫu nhiên: mang, vây và hoạt động bơi bình thường.",
          "Random sample checked: gills, fins and swimming behaviour normal.",
        ),
        by,
      });
    if (i % 3 === 2)
      care.push({
        id: `${o.id}-n${i}`,
        at: new Date(new Date(at).getTime() + 9000_000).toISOString(),
        type: "note",
        text: NOTE_TEXT[i % NOTE_TEXT.length],
        by: bi("Quản lý trại", "Farm manager"),
      });
    if (i % 3 === 0 && i > 0)
      care.push({
        id: `${o.id}-p${i}`,
        at: new Date(new Date(at).getTime() + 10_000_000).toISOString(),
        type: "photo",
        text: bi(
          "Ảnh cập nhật đàn cá trong ao nuôi (ảnh minh họa).",
          "Photo update of the stock in the pond (illustrative image).",
        ),
        by,
        photo: fishPhotos[i % fishPhotos.length],
      });
  });
  const months = Math.max(1, Math.ceil(elapsed / 30));
  const meas: Meas[] = [];
  for (let m = 0; m <= months; m++) {
    const frac = Math.min(1, (m * 30) / (o.months * 30));
    meas.push({
      at: new Date(
        new Date(o.startDate).getTime() + Math.min(m * 30, elapsed) * day,
      ).toISOString(),
      sizeCm: +(o.sizeStart + (o.sizeTarget - o.sizeStart) * frac).toFixed(1),
      weightG: Math.round(
        2 +
          Math.pow(o.sizeStart + (o.sizeTarget - o.sizeStart) * frac, 3) *
            0.018,
      ),
      survival: +(100 - m * 0.4).toFixed(1),
    });
  }
  return {
    care: care.sort((a, b) => b.at.localeCompare(a.at)),
    meas,
  };
}
const stamp = (d: Date) => d.toISOString().slice(2, 10).replace(/-/g, "");
function build(p: {
  seq: number;
  fishId: string;
  qty: number;
  pkg: Pkg;
  addons?: string[];
  status: OrderStatus;
  createdAgo: number;
  startAgo?: number;
  delivery?: Delivery;
  area?: string;
  address?: string;
  handover?: Handover | null;
  owner?: string;
}): Order {
  const fish = fishById(p.fishId)!;
  const q = quote(fish, p.qty, p.pkg, p.addons ?? [], p.delivery ?? "pickup");
  const createdAt = ago(p.createdAgo);
  const startDate = ymd(p.startAgo !== undefined ? ago(p.startAgo) : ahead(7));
  const id = `FO-${stamp(new Date(createdAt))}-${String(p.seq).padStart(4, "0")}`;
  const paid = p.status !== "awaiting_deposit";
  const payments: Payment[] = [];
  if (paid)
    payments.push({
      id: `${id}-d`,
      at: createdAt,
      amount: q.deposit,
      method: p.seq % 2 ? "bank" : "gateway",
      status: p.status === "cancelled" ? "refund_pending" : "paid",
      ref: `DEP-${id.slice(3)}`,
      kind: "deposit",
    });
  if (p.status === "completed")
    payments.push({
      id: `${id}-b`,
      at: ago(Math.max(1, p.createdAgo - fish.months * 30 - 10)),
      amount: q.balance,
      method: "bank",
      status: "paid",
      ref: `BAL-${id.slice(3)}`,
      kind: "balance",
    });
  const h = history(
    {
      id,
      startDate,
      status: p.status,
      months: fish.months,
      sizeStart: fish.sizeStart,
      sizeTarget: fish.sizeTarget,
    },
    fish.photos,
  );
  return {
    id,
    owner: p.owner ?? DEMO_OWNER,
    fishId: fish.id,
    qty: p.qty,
    confirmedQty: ["awaiting_deposit", "pending", "cancelled"].includes(
      p.status,
    )
      ? null
      : p.qty,
    pkg: p.pkg,
    addons: p.addons ?? [],
    facility: fish.facilities[0],
    createdAt,
    startDate,
    months: fish.months,
    fishSubtotal: q.fishSubtotal,
    serviceCost: q.serviceCost,
    deliveryFee: q.deliveryFee,
    total: q.total,
    deposit: q.deposit,
    balance: q.balance,
    status: p.status,
    delivery: p.delivery ?? "pickup",
    area: p.area ?? "",
    address: p.address ?? "",
    name: "Alex Nguyen",
    phone: "+84 90 123 4567",
    notes: "",
    payments,
    care: h.care,
    meas: h.meas,
    handover: p.handover ?? null,
    sample: true,
  };
}
function seed(): State {
  const orders = [
    build({
      seq: 7,
      fishId: "carp",
      qty: 400,
      pkg: "basic",
      status: "awaiting_deposit",
      createdAgo: 0.1,
    }),
    build({
      seq: 6,
      fishId: "basa",
      qty: 500,
      pkg: "basic",
      status: "pending",
      createdAgo: 1,
      delivery: "delivery",
      area: "Cần Thơ",
      address: "12 Nguyễn Văn Cừ, Ninh Kiều",
    }),
    build({
      seq: 5,
      fishId: "barra",
      qty: 300,
      pkg: "advanced",
      status: "confirmed",
      createdAgo: 6,
    }),
    build({
      seq: 4,
      fishId: "koi",
      qty: 6,
      pkg: "advanced",
      status: "farming",
      createdAgo: 62,
      startAgo: 55,
      delivery: "delivery",
      area: "TP. Hồ Chí Minh",
      address: "45 Lê Lợi, Quận 1",
    }),
    build({
      seq: 3,
      fishId: "tilapia",
      qty: 1000,
      pkg: "custom",
      addons: ["feeding", "water", "report"],
      status: "ready",
      createdAgo: 170,
      startAgo: 160,
      delivery: "delivery",
      area: "Đồng Nai",
      address: "88 Võ Thị Sáu, Biên Hòa",
    }),
    build({
      seq: 2,
      fishId: "guppy",
      qty: 300,
      pkg: "basic",
      status: "completed",
      createdAgo: 140,
      startAgo: 130,
    }),
    build({
      seq: 1,
      fishId: "catfish",
      qty: 800,
      pkg: "basic",
      status: "cancelled",
      createdAgo: 20,
    }),
  ];
  const used: Record<string, number> = {};
  return {
    orders,
    used,
    seq: 8,
  };
}
let state: State = { orders: [], used: {}, seq: 1 };
const subs = new Set<() => void>();
function commit(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* full */
  }
  subs.forEach((f) => f());
}
window.addEventListener("storage", (event) => {
  if (event.key !== KEY) return;
  try {
    state = event.newValue
      ? (JSON.parse(event.newValue) as State)
      : { orders: [], used: {}, seq: 1 };
    subs.forEach((fn) => fn());
  } catch {
    /* Ignore malformed updates. */
  }
});
export function useFarming(): State {
  useEffect(() => {
    void refreshFarming();
    const refreshOnFocus = () => void refreshFarming();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshFarming();
    };
    const interval = window.setInterval(() => void refreshFarming(), 15_000);
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    () => state,
  );
}
export async function refreshFarming() {
  try {
    const user = currentUser();
    const [batches, sponsorships] = await Promise.all([
      domainApi.batches(),
      !user
        ? Promise.resolve([])
        : user.role === "Admin"
          ? domainApi.adminSponsorships()
          : domainApi.sponsorships(),
    ]);
    const publicBatchIds = new Set(batches.map((batch: any) => batch.code));
    const allBatches = Array.from(
      new Map(
        [
          ...batches,
          ...sponsorships.map((sponsorship: any) => sponsorship.batch),
        ]
          .filter(Boolean)
          .map((batch: any) => [batch.code, batch]),
      ).values(),
    );
    const mapped: Fish[] = allBatches.map((batch: any) => {
      const start = batch.stockingDate
        ? new Date(batch.stockingDate)
        : new Date();
      const end = batch.expectedHarvestDate
        ? new Date(batch.expectedHarvestDate)
        : start;
      const hasSchedule = Boolean(
        batch.stockingDate && batch.expectedHarvestDate,
      );
      const months = hasSchedule
        ? Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (30 * day)))
        : 0;
      const text = { vi: batch.title, en: batch.title };
      const singleFish = batch.stockCount === 1 && batch.totalShares === 1;
      const facilityId = `farm-${batch.code}`;
      const hasFacility = Boolean(batch.location || batch.region);
      if (
        hasFacility &&
        !FACILITIES.some((facility) => facility.id === facilityId)
      ) {
        FACILITIES.push({
          id: facilityId,
          name: {
            vi: batch.location ?? batch.region,
            en: batch.location ?? batch.region,
          },
          address: {
            vi: batch.region ?? batch.location,
            en: batch.region ?? batch.location,
          },
        });
      }
      return {
        id: batch.code,
        singleFish,
        hasSchedule,
        catalogVisible: publicBatchIds.has(batch.code),
        name: text,
        sci: batch.breed ?? batch.species,
        category: /tilapia/i.test(batch.species)
          ? "tilapia"
          : /cat|basa/i.test(batch.species)
            ? "catfish"
            : "carp",
        kind: /koi|betta|gold/i.test(batch.species)
          ? "ornamental"
          : "commercial",
        water: "fresh",
        stage: singleFish
          ? {
              vi: `Cá con ${batch.ageMonths ?? 0} tháng`,
              en: `${batch.ageMonths ?? 0}-month juvenile`,
            }
          : { vi: batch.status, en: batch.status },
        sizeStart: Number(batch.currentSizeCm ?? 0),
        sizeTarget: Number(batch.targetSizeCm ?? 0),
        months,
        fishPrice: batch.packagePricePerShare,
        care: 0,
        minQty: 1,
        perBox: 1,
        total: singleFish ? 1 : batch.totalShares,
        capacity: singleFish ? 1 : batch.totalShares,
        paused: batch.status !== "open",
        facilities: hasFacility ? [facilityId] : [],
        deliveryAreas: batch.region ? [batch.region] : [],
        photos: batch.images?.map((x: any) => x.url) ?? [],
        desc: { vi: batch.description, en: batch.description },
        info: [
          ...(batch.carePlan
            ? [
                {
                  k: { vi: "Kế hoạch chăm sóc", en: "Care plan" },
                  v: { vi: batch.carePlan, en: batch.carePlan },
                },
              ]
            : []),
        ],
      } as Fish;
    });
    FISH.splice(0, FISH.length, ...mapped);
    const used = Object.fromEntries(
      batches.map((b: any) => [b.code, b.totalShares - b.sharesAvailable]),
    );
    const orders: Order[] = sponsorships.map((s: any) => ({
      id: s.id,
      owner: s.sponsor?.email ?? user?.email ?? "",
      fishId: s.batch.code,
      qty: s.shares,
      confirmedQty: s.shares,
      pkg: "basic",
      addons: [],
      facility: FACILITIES[0]?.id ?? "main",
      createdAt: s.createdAt,
      startDate: s.batch.stockingDate?.slice(0, 10) ?? s.createdAt.slice(0, 10),
      months: 1,
      fishSubtotal: s.packageAmount,
      serviceCost: 0,
      deliveryFee: s.deliveryFee,
      total: s.totalAmount,
      deposit: s.totalAmount,
      balance: 0,
      status:
        (
          {
            pending_payment: "awaiting_deposit",
            funded: "confirmed",
            preparing: "preparing",
            growing: "farming",
            ready_for_delivery: "ready",
            handover: "handover",
            delivered: "completed",
            settled: "completed",
            cancelled: "cancelled",
            refunded: "cancelled",
          } as any
        )[s.status] ?? "pending",
      delivery: s.deliveryMethod ? "delivery" : "pickup",
      area: s.province ?? s.city ?? "",
      address: s.address,
      name: s.recipientName,
      phone: s.phone,
      notes: "",
      payments: (s.payments ?? []).map((p: any) => ({
        id: p.id,
        at: p.createdAt,
        amount: p.amount,
        method:
          p.method === "e_wallet"
            ? "wallet"
            : p.method === "bank_card"
              ? "gateway"
              : "bank",
        status: p.state,
        ref: p.providerRef ?? p.id,
        kind: "deposit",
      })),
      care: (s.batch.updates ?? []).map((u: any) => ({
        id: u.id,
        at: u.createdAt,
        type: u.photos?.length ? "photo" : "note",
        text: { vi: u.note ?? u.stage, en: u.note ?? u.stage },
        by: { vi: "Quản trị viên", en: "Administrator" },
        photo: u.photos?.[0]?.url,
      })),
      meas: [],
      handover: null,
      sample: false,
    }));
    commit({ orders, used, seq: orders.length + 1 });
  } catch {
    /* The page renders an empty state if Supabase is temporarily unavailable. */
  }
}
export const resetFarmingData = () => {
  commit({ orders: [], used: {}, seq: 1 });
  void refreshFarming();
};

/* ============ availability ============ */
export const remaining = (f: Fish, s: State) =>
  Math.max(0, f.capacity - (s.used[f.id] ?? 0));
export function availOf(f: Fish, s: State): Avail {
  if (f.paused) return "paused";
  const r = remaining(f, s);
  if (r <= 0) return "full";
  return r / f.total <= RULES.limitedRatio ? "limited" : "available";
}
export const canBook = (a: Avail) => a === "available" || a === "limited";
export const orderFish = (o: Order) => fishById(o.fishId)!;

/* ============ mock services (swap for real API calls later) ============ */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
export type BookingInput = {
  fishId: string;
  qty: number;
  pkg: Pkg;
  addons: string[];
  facility: string;
  startDate: string;
  delivery: Delivery;
  area: string;
  address: string;
  name: string;
  phone: string;
  notes: string;
};
export async function submitDeposit(
  owner: string,
  input: BookingInput,
  method: PayMethod,
  simulateFail: boolean,
  lang: Lang,
): Promise<Order> {
  const sponsorship = await domainApi.sponsor(input.fishId, {
    shares: input.qty,
    deliveryFee:
      input.delivery === "delivery"
        ? quote(
            fishById(input.fishId)!,
            input.qty,
            input.pkg,
            input.addons,
            input.delivery,
          ).deliveryFee
        : 0,
    recipientName: input.name,
    phone: input.phone,
    address: input.address || input.area,
    province: input.area,
    deliveryMethod: input.delivery,
  });
  const payment = await domainApi.paySponsorship(sponsorship.id, {
    method:
      method === "wallet"
        ? "e_wallet"
        : method === "gateway"
          ? "bank_card"
          : "bank_transfer",
    simulateFailure: simulateFail,
    idempotencyKey: `${sponsorship.id}-package`,
  });
  if (payment.state === "failed") throw new Error("payment_failed");
  await refreshFarming();
  const saved = state.orders.find((item) => item.id === sponsorship.id);
  if (saved) return saved;
  await wait(100);
  const fish = fishById(input.fishId)!;
  if (input.qty > remaining(fish, state)) throw new Error("capacity");
  const q = quote(fish, input.qty, input.pkg, input.addons, input.delivery);
  const now = new Date();
  const id = `FO-${stamp(now)}-${String(state.seq).padStart(4, "0")}`;
  const order: Order = {
    id,
    owner,
    fishId: fish.id,
    qty: input.qty,
    confirmedQty: null,
    pkg: input.pkg,
    addons: input.addons,
    facility: input.facility,
    createdAt: now.toISOString(),
    startDate: input.startDate,
    months: fish.months,
    fishSubtotal: q.fishSubtotal,
    serviceCost: q.serviceCost,
    deliveryFee: q.deliveryFee,
    total: q.total,
    deposit: q.deposit,
    balance: q.balance,
    status: "pending",
    delivery: input.delivery,
    area: input.area,
    address: input.address,
    name: input.name,
    phone: input.phone,
    notes: input.notes,
    payments: [
      {
        id: `${id}-d`,
        at: now.toISOString(),
        amount: q.deposit,
        method,
        status: "paid",
        ref: `DEP-${id.slice(3)}`,
        kind: "deposit",
      },
    ],
    care: [],
    meas: [],
    handover: null,
    sample: true,
  };
  commit({
    orders: [order, ...state.orders],
    used: {
      ...state.used,
      [fish.id]: (state.used[fish.id] ?? 0) + input.qty,
    },
    seq: state.seq + 1,
  });
  notify(
    "Admin",
    "status",
    "New farming booking",
    `${id}: ${input.name}`,
    `#admin/bookings/${id}`,
  );
  notify(
    owner,
    "status",
    lang === "vi" ? "Đã nhận tiền cọc" : "Deposit received",
    lang === "vi"
      ? `Đơn ${id} đang chờ trang trại xác nhận.`
      : `Order ${id} is awaiting farm confirmation.`,
    `account/farming-orders/${id}`,
  );
  log(
    input.name,
    "Buyer",
    "Placed a farming deposit",
    id,
    `#account/farming-orders/${id}`,
  );
  return order;
}
export async function payPendingDeposit(
  id: string,
  method: PayMethod,
  simulateFail: boolean,
) {
  await wait(1600);
  if (simulateFail) throw new Error("payment_failed");
  const o = state.orders.find((x) => x.id === id)!;
  const fish = orderFish(o);
  if (o.qty > remaining(fish, state)) throw new Error("capacity");
  patch(id, (x) => ({
    ...x,
    status: "pending",
    payments: [
      {
        id: `${id}-d`,
        at: new Date().toISOString(),
        amount: x.deposit,
        method,
        status: "paid",
        ref: `DEP-${id.slice(3)}`,
        kind: "deposit",
      },
      ...x.payments,
    ],
  }));
  commit({
    ...state,
    used: {
      ...state.used,
      [fish.id]: (state.used[fish.id] ?? 0) + o.qty,
    },
  });
}
function patch(id: string, fn: (o: Order) => Order) {
  commit({
    ...state,
    orders: state.orders.map((o) => (o.id === id ? fn(o) : o)),
  });
}
export function cancelOrder(id: string) {
  const o = state.orders.find((x) => x.id === id);
  if (!o || !["awaiting_deposit", "pending"].includes(o.status)) return;
  const held = o.status === "pending";
  commit({
    ...state,
    used: held
      ? {
          ...state.used,
          [o.fishId]: Math.max(0, (state.used[o.fishId] ?? 0) - o.qty),
        }
      : state.used,
    orders: state.orders.map((x) =>
      x.id === id
        ? {
            ...x,
            status: "cancelled",
            payments: x.payments.map((p) =>
              p.kind === "deposit" && p.status === "paid"
                ? {
                    ...p,
                    status: "refund_pending" as PayStatus,
                  }
                : p,
            ),
          }
        : x,
    ),
  });
}
export function requestHandover(
  id: string,
  h: Omit<Handover, "status" | "requestedAt">,
) {
  const o = state.orders.find((x) => x.id === id);
  if (!o || o.status !== "ready") return false;
  patch(id, (x) => ({
    ...x,
    status: "handover",
    handover: {
      ...h,
      status: "requested",
      requestedAt: new Date().toISOString(),
    },
  }));
  return true;
}
const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "farming",
  farming: "ready",
};
export function demoAdvance(id: string) {
  const o = state.orders.find((x) => x.id === id);
  if (!o) return;
  if (o.status === "handover" && o.handover) {
    const order: Handover["status"][] = [
      "requested",
      "scheduled",
      "in_transit",
      "done",
    ];
    const next = order[order.indexOf(o.handover.status) + 1];
    if (!next) return;
    if (next === "done") {
      patch(id, (x) => ({
        ...x,
        status: "completed",
        handover: {
          ...x.handover!,
          status: "done",
        },
        payments: [
          ...x.payments,
          {
            id: `${id}-b`,
            at: new Date().toISOString(),
            amount: x.balance,
            method: "bank",
            status: "paid",
            ref: `BAL-${id.slice(3)}`,
            kind: "balance",
          },
        ],
      }));
    } else
      patch(id, (x) => ({
        ...x,
        handover: {
          ...x.handover!,
          status: next,
        },
      }));
    return;
  }
  const n = NEXT[o.status];
  if (!n) return;
  patch(id, (x) => {
    const base = {
      ...x,
      status: n,
      confirmedQty: x.confirmedQty ?? x.qty,
    };
    if (n === "farming" || n === "ready") {
      const f = fishById(x.fishId)!;
      const h = history(
        {
          id: x.id,
          startDate: x.startDate,
          status: n,
          months: x.months,
          sizeStart: f.sizeStart,
          sizeTarget: f.sizeTarget,
        },
        f.photos,
      );
      return {
        ...base,
        care: h.care,
        meas: h.meas,
      };
    }
    return base;
  });
}
export const ordersOf = (s: State, email: string) =>
  s.orders
    .filter((o) => o.owner === email)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/* Administration updates the same order records shown to the customer. */
export const ADMIN_BOOKING_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "farming",
  farming: "ready",
  ready: "handover",
  handover: "completed",
};
export async function adminSetBookingStatus(id: string, next: OrderStatus) {
  const admin = currentUser();
  const order = state.orders.find((item) => item.id === id);
  if (admin?.role !== "Admin" || !order) throw new Error("Access denied");
  const cancellable = [
    "awaiting_deposit",
    "pending",
    "confirmed",
    "preparing",
  ].includes(order.status);
  if (
    ADMIN_BOOKING_NEXT[order.status] !== next &&
    !(next === "cancelled" && cancellable)
  )
    throw new Error("Invalid booking transition");
  if (
    next === "confirmed" &&
    !order.payments.some(
      (payment) => payment.kind === "deposit" && payment.status === "paid",
    )
  )
    throw new Error("Confirm the deposit before accepting this booking");
  if (
    next === "completed" &&
    order.balance > 0 &&
    !order.payments.some(
      (payment) => payment.kind === "balance" && payment.status === "paid",
    )
  )
    throw new Error(
      "Record the remaining payment before completing the booking",
    );
  await domainApi.updateSponsorshipStatus(id, next);
  await refreshFarming();
  log(
    admin.name,
    "Admin",
    `Booking status: ${next}`,
    id,
    `#admin/bookings/${id}`,
  );
  notify(
    order.owner,
    "status",
    "Farming booking updated",
    `${id}: ${STATUS_LABEL[next].vi}`,
    `#account/farming-orders/${id}`,
  );
}
export function adminRecordBookingPayment(
  id: string,
  kind: "deposit" | "balance" | "refund",
  reference: string,
) {
  const admin = currentUser();
  const order = state.orders.find((item) => item.id === id);
  if (admin?.role !== "Admin" || !order || !reference.trim())
    throw new Error("Enter a transaction reference");
  if (kind === "refund") {
    if (
      order.status !== "cancelled" ||
      !order.payments.some((payment) => payment.status === "refund_pending")
    )
      throw new Error("No refund is pending");
    patch(id, (item) => ({
      ...item,
      payments: item.payments.map((payment) =>
        payment.status === "refund_pending"
          ? { ...payment, status: "refunded", ref: reference.trim() }
          : payment,
      ),
    }));
  } else {
    if (
      order.status === "cancelled" ||
      order.status === "completed" ||
      order.payments.some(
        (payment) => payment.kind === kind && payment.status === "paid",
      )
    )
      throw new Error("Payment cannot be recorded again");
    const reserve = kind === "deposit" && order.status === "awaiting_deposit";
    if (reserve && order.qty > remaining(fishById(order.fishId)!, state))
      throw new Error("Insufficient farming capacity");
    commit({
      ...state,
      used: reserve
        ? {
            ...state.used,
            [order.fishId]: (state.used[order.fishId] ?? 0) + order.qty,
          }
        : state.used,
      orders: state.orders.map((item) =>
        item.id === id
          ? {
              ...item,
              status: reserve ? "pending" : item.status,
              payments: [
                ...item.payments.filter((payment) => payment.kind !== kind),
                {
                  id: `${id}-${kind}-${Date.now()}`,
                  kind,
                  amount: kind === "deposit" ? item.deposit : item.balance,
                  method: "bank",
                  status: "paid",
                  ref: reference.trim(),
                  at: new Date().toISOString(),
                },
              ],
            }
          : item,
      ),
    });
  }
  log(
    admin.name,
    "Admin",
    `Recorded ${kind}: ${reference.trim()}`,
    id,
    `#admin/bookings/${id}`,
  );
  notify(
    order.owner,
    "status",
    "Farming payment updated",
    `${id}: ${kind}`,
    `#account/farming-orders/${id}`,
  );
}
