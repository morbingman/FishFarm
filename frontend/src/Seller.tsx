import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import "./seller.css"
import { portalVi } from "./portal-vi"
import { Banner, ConfirmDialog, Crumbs, Pager, Skeleton, StateBlock, StatusChip, STATUS_LABEL, go, initials, useHash, useLoading, useToast, PortalShell } from "./ui"
import { EMPTY_DRAFT, SAMPLE_PHOTOS, deleteListing, flash, fmtDate, getListing, request, saveDraft, setPaused, submitListing, timeAgo, useStore, withdrawListing, type Draft, type Img, type LStatus, type Listing, type User } from "./store"

type Lang = "en" | "vi"

const vi: Record<string, string> = {
  "Marketplace": "Chợ cá", "Buy now": "Mua ngay", "Contact seller": "Liên hệ người bán", "Just now": "Vừa xong",
  "Koi": "Cá Koi", "Goldfish": "Cá vàng", "Betta": "Cá Betta", "Arowana": "Cá rồng", "Discus": "Cá đĩa", "Tropical": "Cá nhiệt đới", "Freshwater food fish": "Cá nước ngọt thực phẩm",
  "Male": "Đực", "Female": "Cái", "Unsexed": "Chưa phân biệt", "Breeding pair": "Cặp sinh sản",
  "Excellent — vet certified": "Xuất sắc — có chứng nhận thú y", "Good — quarantined 14 days": "Tốt — đã cách ly 14 ngày", "Fair — treated and stable": "Khá — đã điều trị, ổn định",
  "Niigata, Japan": "Niigata, Nhật Bản", "Hiroshima, Japan": "Hiroshima, Nhật Bản", "Vietnam — farm bred": "Việt Nam — nuôi tại trại", "Thailand": "Thái Lan", "Indonesia": "Indonesia",
  "Ho Chi Minh City": "TP. Hồ Chí Minh", "Hanoi": "Hà Nội", "Da Nang": "Đà Nẵng", "Can Tho": "Cần Thơ", "Dong Nai": "Đồng Nai",
  "e.g. Showa Sanshoku Koi": "VD: Koi Showa Sanshoku", "e.g. Showa, Kohaku, Halfmoon": "VD: Showa, Kohaku, Halfmoon", "Lineage, colouring, temperament, feeding and water conditions…": "Dòng máu, màu sắc, tính cách, chế độ ăn và điều kiện nước…",
  "e.g. 14 months": "VD: 14 tháng", "Street address or farm name": "Địa chỉ hoặc tên trại", "Explain what needs to change…": "Nêu rõ cần chỉnh sửa điều gì…",
  "Photos are clear and show the actual fish": "Ảnh rõ nét và thể hiện đúng con cá thật", "Species and breed match the photos": "Loài và giống khớp với ảnh", "Price is within the market range": "Giá nằm trong khoảng thị trường", "Health status is credible": "Tình trạng sức khỏe đáng tin cậy",
  "Demo flow": "Luồng demo", "Pending": "Chờ duyệt", "Admin": "Quản trị", "Approved": "Đã duyệt", "Rejected": "Bị từ chối", "Add Fish": "Đăng cá",
  "Seller Dashboard": "Bảng điều khiển người bán",
  "Seller Center": "Kênh người bán", "Sign out": "Đăng xuất", "Back to marketplace": "Về chợ cá",
  "Dashboard": "Tổng quan", "My Listings": "Tin đăng của tôi", "Add New Fish": "Đăng cá mới", "Orders": "Đơn hàng", "Customers": "Khách hàng", "Messages": "Tin nhắn", "Analytics": "Phân tích", "Reviews": "Đánh giá", "Store Profile": "Hồ sơ cửa hàng", "Settings": "Cài đặt",
  "Good Morning, Golden Koi Farm": "Chào buổi sáng, Golden Koi Farm",
  "Here is what is happening in your store today.": "Tình hình cửa hàng của bạn hôm nay.",
  "+ Add New Fish": "+ Đăng cá mới", "Active Listings": "Tin đang bán", "Revenue": "Doanh thu", "vs last month": "so với tháng trước",
  "Recent listings": "Tin đăng gần đây", "View all": "Xem tất cả", "Listing": "Tin đăng", "Price": "Giá", "Status": "Trạng thái", "Views": "Lượt xem", "Updated": "Cập nhật",
  "Live": "Đang bán", "Draft": "Bản nháp", "Pending Review": "Chờ duyệt", "Requires Changes": "Cần chỉnh sửa",
  "Listing quality": "Chất lượng tin đăng", "Listings with 5+ photos and health certificates sell 2.4x faster.": "Tin có từ 5 ảnh và giấy chứng nhận sức khỏe bán nhanh gấp 2,4 lần.",
  "Create a new listing": "Tạo tin đăng mới", "Every listing is reviewed by our team before going live.": "Mọi tin đăng đều được đội ngũ của chúng tôi duyệt trước khi hiển thị.",
  "Add New Fish listing": "Đăng bán cá mới", "Create your listing in six short steps. Your progress is saved as you go.": "Tạo tin đăng qua sáu bước ngắn. Tiến trình được lưu khi bạn thực hiện.",
  "Basic Information": "Thông tin cơ bản", "Fish Details": "Chi tiết cá", "Pricing": "Giá bán", "Media": "Hình ảnh", "Location": "Vị trí", "Preview": "Xem trước",
  "Fish Name": "Tên cá", "Species": "Loài", "Breed": "Giống", "Description": "Mô tả", "Select species": "Chọn loài", "Use sample koi data": "Dùng dữ liệu koi mẫu",
  "Age": "Tuổi", "Size": "Kích thước", "Gender": "Giới tính", "Origin": "Xuất xứ", "Health Status": "Tình trạng sức khỏe", "Select": "Chọn",
  "Price per fish (USD)": "Giá mỗi con (USD)", "Quantity available": "Số lượng hiện có", "Negotiable": "Có thể thương lượng", "Buyers can send you an offer": "Người mua có thể gửi đề nghị giá",
  "Upload Fish Images": "Tải ảnh cá lên", "Drag photos here or browse": "Kéo ảnh vào đây hoặc chọn tệp", "JPG or PNG, up to 8 photos. The first photo is your cover.": "JPG hoặc PNG, tối đa 8 ảnh. Ảnh đầu tiên là ảnh bìa.",
  "Browse files": "Chọn tệp", "Or start with sample photos": "Hoặc dùng ảnh mẫu", "Main": "Ảnh chính", "Set Main Image": "Đặt làm ảnh chính", "Delete Image": "Xóa ảnh", "Move earlier": "Dời lên trước", "Move later": "Dời ra sau", "Drag to reorder": "Kéo để sắp xếp",
  "Farm / Store Location": "Vị trí trại / cửa hàng", "Region": "Khu vực", "Shipping Availability": "Hình thức vận chuyển", "Local pickup": "Nhận tại trại", "Domestic overnight": "Giao nội địa trong đêm", "International air freight": "Vận chuyển hàng không quốc tế",
  "Back": "Quay lại", "Continue": "Tiếp tục", "Save Draft": "Lưu nháp", "Draft saved": "Đã lưu nháp", "Edit Listing": "Sửa tin đăng", "Submit for Review": "Gửi duyệt", "Resubmit for Review": "Gửi duyệt lại",
  "This is exactly how buyers will see your listing.": "Đây chính xác là cách người mua sẽ thấy tin đăng của bạn.", "Buyer view": "Giao diện người mua",
  "Seller": "Người bán", "Seller rating": "Đánh giá người bán", "Availability": "Tình trạng", "in stock": "còn hàng", "Shipping": "Vận chuyển", "Verified Seller": "Người bán xác minh", "Negotiable price": "Giá thương lượng",
  "Your listing has been submitted and is waiting for admin approval.": "Tin đăng của bạn đã được gửi và đang chờ quản trị viên duyệt.",
  "Listing ID": "Mã tin đăng", "Submitted Date": "Ngày gửi", "Current Status": "Trạng thái hiện tại", "View Listing": "Xem tin đăng", "Manage Listing": "Quản lý tin đăng",
  "Submitted": "Đã gửi", "Under review": "Đang xét duyệt", "Decision": "Kết quả", "Typical review time: under 24 hours": "Thời gian duyệt thông thường: dưới 24 giờ",
  "Prototype: continue as admin moderator": "Prototype: tiếp tục với vai trò quản trị viên", "Back to dashboard": "Về tổng quan",
  "Not visible to buyers until approved.": "Người mua chưa thấy tin này cho đến khi được duyệt.",
  "Admin Console": "Bảng quản trị", "Moderation queue": "Hàng chờ kiểm duyệt", "Seller information": "Thông tin người bán", "Listing information": "Thông tin tin đăng", "Images": "Hình ảnh", "Approve Listing": "Duyệt tin đăng", "Reject Listing": "Từ chối tin đăng", "Request Changes": "Yêu cầu chỉnh sửa",
  "Moderation decision": "Quyết định kiểm duyệt", "Reason": "Lý do", "Feedback for the seller": "Phản hồi cho người bán", "Confirm": "Xác nhận", "Cancel": "Hủy", "Joined": "Tham gia", "Total sales": "Tổng đơn bán", "Response rate": "Tỷ lệ phản hồi",
  "Your listing is now live!": "Tin đăng của bạn đã hiển thị!", "Published date": "Ngày đăng", "Favorites": "Lượt yêu thích",
  "Listing Requires Changes": "Tin đăng cần chỉnh sửa", "Rejection reason": "Lý do từ chối", "Admin feedback": "Phản hồi của quản trị viên", "Changes requested": "Cần chỉnh sửa",
  "Required": "Bắt buộc", "Edited — ready to resubmit": "Đã sửa — sẵn sàng gửi lại",
  "Image quality": "Chất lượng ảnh", "Incomplete fish details": "Thiếu chi tiết về cá", "Pricing concern": "Vấn đề về giá", "Species policy": "Chính sách loài",
  "Not part of this flow — try Add New Fish.": "Mục này nằm ngoài luồng hiện tại — hãy thử Đăng cá mới.",
}

const SPECIES = ["Koi", "Goldfish", "Betta", "Arowana", "Discus", "Tropical", "Freshwater food fish"]
const GENDERS = ["Male", "Female", "Unsexed", "Breeding pair"]
const HEALTH = ["Excellent — vet certified", "Good — quarantined 14 days", "Fair — treated and stable"]
const ORIGINS = ["Niigata, Japan", "Hiroshima, Japan", "Vietnam — farm bred", "Thailand", "Indonesia"]
const REGIONS = ["Ho Chi Minh City", "Hanoi", "Da Nang", "Can Tho", "Dong Nai"]
const SHIPPING = ["Local pickup", "Domestic overnight", "International air freight"]
const REASONS = [
  { label: "Image quality", step: 4 }, { label: "Incomplete fish details", step: 2 },
  { label: "Pricing concern", step: 3 }, { label: "Species policy", step: 1 },
]
const STEPS = ["Basic Information", "Fish Details", "Pricing", "Media", "Location", "Preview"]

const SAMPLE: Omit<Draft, "images" | "mainId"> = {
  name: "Showa Sanshoku Koi", species: "Koi", breed: "Showa Sanshoku",
  description: "Hand-selected Showa from our Niigata-line broodstock. Deep sumi with balanced hi pattern, clean white skin, and a calm temperament. Raised in mud-pond conditions and grown on a premium pellet diet.",
  age: "14 months", size: "32", gender: "Female", origin: "Niigata, Japan", health: HEALTH[0],
  price: "480", quantity: "4", negotiable: true,
  location: "Golden Koi Farm, 128 Nguyen Van Huong, Thao Dien", region: "Ho Chi Minh City", shipping: ["Local pickup", "Domestic overnight"],
}
const EMPTY: Draft = {
  name: "", species: "", breed: "", description: "", age: "", size: "", gender: "", origin: "", health: "",
  price: "", quantity: "1", negotiable: false, images: [], mainId: "", location: "", region: "", shipping: [],
}

type IconName = "dash" | "list" | "plus" | "bag" | "users" | "msg" | "chart" | "star" | "store" | "gear" | "upload" | "trash" | "left" | "right" | "check" | "clock" | "shield" | "pin" | "truck" | "x" | "fish" | "arrow" | "eye" | "heart" | "flag" | "edit" | "alert"
const ICONS: Record<IconName, ReactNode> = {
  dash: <path d="M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  plus: <path d="M12 5v14M5 12h14" />,
  bag: <><path d="M5 7h14l1.5 14h-17z" /><path d="M8 9V6a4 4 0 0 1 8 0v3" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.5-4 3-6 6.5-6s6 2 6.5 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .6 3.3 2.4 3.5 5" /></>,
  msg: <path d="M21 14a3 3 0 0 1-3 3H9l-5 4V6a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3z" />,
  chart: <path d="M4 20V4M4 20h16M8 16v-5M13 16V8M18 16v-3" />,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  store: <path d="M3 9l1.5-5h15L21 9M3 9v1a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9M5 13v8h14v-8M10 21v-5h4v5" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>,
  upload: <path d="M12 16V4m0 0L7 9m5-5 5 5M4 16v4h16v-4" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  left: <path d="m15 5-7 7 7 7" />, right: <path d="m9 5 7 7-7 7" />,
  check: <path d="m5 12 4.5 4.5L19 7" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  pin: <><path d="M12 22s7-6.3 7-12a7 7 0 0 0-14 0c0 5.7 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>,
  truck: <path d="M2 6h11v10H2zM13 9h4l4 4v3h-8M6.5 19a1.5 1.5 0 1 0 0-.01M17.5 19a1.5 1.5 0 1 0 0-.01" />,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  fish: <><path d="M3 12s4-6 10-6c4 0 8 6 8 6s-4 6-8 6c-6 0-10-6-10-6zm0 0L1 7v10z" /><circle cx="16" cy="11" r="1" /></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8z" />,
  flag: <path d="M5 21V4m0 0h12l-2 4 2 4H5" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  alert: <><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h.01" /></>,
}
function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return <svg className={`sl-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>
}

function Field({ id, label, children, hint, bad, t, optional }: { id: string; label: string; children: ReactNode; hint?: string; bad: boolean; t: (s: string) => string; optional?: boolean }) {
  return (
    <label className={`sl-field ${bad ? "bad" : ""}`} data-field={id}>
      <span>{t(label)}{optional ? <i style={{ fontWeight: 500, opacity: .6 }}> ({t("optional")})</i> : " *"}</span>{children}
      {bad ? <em>{t("Required")}</em> : hint ? <small>{hint}</small> : null}
    </label>
  )
}
function Select({ id, label, value, options, onChange, bad, t }: { id: string; label: string; value: string; options: string[]; onChange: (v: string) => void; bad: boolean; t: (s: string) => string }) {
  return <Field t={t} bad={bad} id={id} label={label}><select value={value} onChange={e => onChange(e.target.value)}><option value="">{t("Select")}</option>{options.map(o => <option key={o} value={o}>{t(o)}</option>)}</select></Field>
}
function Gallery({ imgs, main, alt }: { imgs: Img[]; main?: Img; alt: string }) {
  const [sel, setSel] = useState(main?.id ?? imgs[0]?.id)
  const cur = imgs.find(i => i.id === sel) ?? main ?? imgs[0]
  return (
    <div className="sl-gallery">
      <div className="sl-gallery-main">{cur ? <img src={cur.url} alt={alt} /> : <div className="sl-noimg"><Icon name="fish" /></div>}</div>
      {imgs.length > 1 && <div className="sl-gallery-thumbs">{imgs.map(i => <button key={i.id} className={i.id === cur?.id ? "on" : ""} onClick={() => setSel(i.id)} aria-label="Show photo"><img src={i.url} alt="" /></button>)}</div>}
    </div>
  )
}


const money = (v: string) => `$${Number(v || 0).toLocaleString("en-US")}`
type TFn = (s: string) => string
type Toast = (m: string) => void

const xvi: Record<string, string> = {
  "optional": "tùy chọn", "Orders": "Đơn hàng", "Customers": "Khách hàng", "Messages": "Tin nhắn", "Analytics": "Phân tích", "Reviews": "Đánh giá",
  "Store Profile": "Hồ sơ cửa hàng", "Settings": "Cài đặt", "Dashboard": "Bảng điều khiển", "My Listings": "Tin đăng của tôi", "Add New Fish": "Thêm cá mới",
  "Live": "Đang bán", "Paused": "Tạm ngưng", "Drafts": "Bản nháp", "Needs attention": "Cần xử lý", "Pending Review": "Chờ duyệt", "All": "Tất cả",
  "Active listings": "Tin đang bán", "Awaiting review": "Đang chờ duyệt", "Total views": "Tổng lượt xem", "View": "Xem",
  "Seller Center": "Trung tâm người bán", "Next actions": "Việc cần làm", "Recent listings": "Tin đăng gần đây", "View all": "Xem tất cả",
  "No listings yet": "Chưa có tin đăng", "Create your first listing to start selling on FISHMARKET.": "Hãy tạo tin đăng đầu tiên để bắt đầu bán trên FISHMARKET.",
  "Search by name or ID": "Tìm theo tên hoặc mã", "No results": "Không có kết quả", "Clear search": "Xóa tìm kiếm",
  "Listing not found": "Không tìm thấy tin đăng", "This listing was deleted": "Tin đăng này đã bị xóa",
  "It may have been deleted or you may not have access to it.": "Có thể tin đã bị xóa hoặc bạn không có quyền truy cập.",
  "The listing was deleted and can no longer be opened.": "Tin đăng đã bị xóa và không thể mở lại.",
  "Withdraw from review": "Rút khỏi hàng chờ duyệt", "Pause listing": "Tạm ngưng tin đăng", "Resume listing": "Mở bán lại", "Delete listing": "Xóa tin đăng",
  "Edit listing": "Chỉnh sửa tin đăng", "Edit & resubmit": "Chỉnh sửa & gửi lại", "View on marketplace": "Xem trên chợ", "Preview as buyer": "Xem như người mua",
  "History": "Lịch sử", "Cancel": "Hủy", "Discard changes?": "Bỏ thay đổi?", "Keep editing": "Tiếp tục chỉnh sửa", "Discard": "Bỏ",
  "You have unsaved changes. If you leave now they will be lost.": "Bạn có thay đổi chưa lưu. Nếu rời đi bây giờ, các thay đổi sẽ mất.",
  "Submitting…": "Đang gửi…", "Saving…": "Đang lưu…", "Try again": "Thử lại",
  "Submitted for review": "Đã gửi để duyệt", "Your listing is waiting for an admin. You will be notified as soon as there is a decision.": "Tin đăng của bạn đang chờ quản trị viên. Bạn sẽ được báo ngay khi có quyết định.",
  "Nothing here yet": "Chưa có gì ở đây", "Back to My Listings": "Về Tin đăng của tôi", "Required fields are marked": "Các trường bắt buộc được đánh dấu",
  "This listing is under review": "Tin đăng đang được xem xét", "Withdraw it first if you want to make changes.": "Hãy rút lại trước nếu bạn muốn chỉnh sửa.",
  "Editing a live listing sends it back to review and hides it until approved.": "Chỉnh sửa tin đang bán sẽ gửi lại để duyệt và ẩn đến khi được chấp thuận.",
}

function Seller({ user, language, setLanguage }: { user: User; language: Lang; setLanguage: (l: Lang) => void }) {
  const dict = useMemo(() => ({ ...portalVi, ...vi, ...xvi }), [])
  const t: TFn = s => (language === "vi" ? dict[s] ?? s : s)
  const { parts, params } = useHash()
  const [toast, show] = useToast()
  const sec = parts[1] ?? ""
  const id = parts[2]
  useEffect(() => { document.documentElement.lang = language }, [language])
  useEffect(() => { window.scrollTo({ top: 0 }) }, [sec, id])

  const active = sec === "" ? "#seller" : sec === "listings" || sec === "listing" || sec === "edit" ? "#seller/listings" : `#seller/${sec}`
  let body
  if (sec === "") body = <Dashboard user={user} t={t} />
  else if (sec === "listings") body = <Listings user={user} t={t} initTab={params.get("tab") ?? "all"} key={params.get("tab") ?? "all"} />
  else if (sec === "add") body = <ListingForm key="new" user={user} t={t} show={show} />
  else if (sec === "edit" && id) body = <ListingForm key={id} user={user} id={id} t={t} show={show} />
  else if (sec === "listing" && id) body = <Detail key={id} user={user} id={id} t={t} show={show} submitted={params.get("submitted") === "1"} />
  else if (["orders", "customers", "messages", "analytics", "reviews"].includes(sec)) body = <Placeholder sec={sec} t={t} />
  else body = <StateBlock icon="search" tone="warn" title={t("Listing not found")} body={t("It may have been deleted or you may not have access to it.")} actions={<a className="sl-btn sl-btn-primary" href="#seller">{t("Dashboard")}</a>} />

  return (
    <PortalShell user={user} active={active} language={language} setLanguage={setLanguage} dict={dict} toast={toast}>{body}</PortalShell>
  )
}
export default Seller

const TABS: [string, string, (l: Listing) => boolean][] = [
  ["all", "All", () => true],
  ["approved", "Live", l => l.status === "approved"],
  ["pending", "Pending Review", l => l.status === "pending"],
  ["attention", "Needs attention", l => l.status === "changes" || l.status === "rejected"],
  ["draft", "Drafts", l => l.status === "draft"],
  ["paused", "Paused", l => l.status === "paused"],
]

function useMine(user: User) {
  const s = useStore()
  return useMemo(() => s.listings.filter(l => l.owner === user.email).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [s.listings, user.email])
}

function Table({ rows, t, vi: isVi }: { rows: Listing[]; t: TFn; vi: boolean }) {
  return (
    <div className="sl-table-wrap">
      <table className="sl-table">
        <thead><tr><th>{t("Listing")}</th><th>{t("Price")}</th><th>{t("Status")}</th><th>{t("Views")}</th><th>{t("Updated")}</th></tr></thead>
        <tbody>
          {rows.map(l => (
            <tr key={l.id} className="pt-row-click" tabIndex={0} onClick={() => go(`seller/listing/${l.id}`)} onKeyDown={e => e.key === "Enter" && go(`seller/listing/${l.id}`)}>
              <td><div className="sl-cell">{l.draft.images[0] ? <img src={l.draft.images[0].url} alt="" /> : <span className="sl-noimg sm"><Icon name="fish" /></span>}<div><b>{l.draft.name || "Untitled"}</b><small>{l.id} · {t(l.draft.species) || "—"}</small></div></div></td>
              <td>{l.draft.price ? money(l.draft.price) : "—"}</td><td><StatusChip s={l.status} /></td><td>{l.status === "approved" || l.status === "paused" ? l.views.toLocaleString() : "—"}</td><td>{timeAgo(l.updatedAt, isVi)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Dashboard({ user, t }: { user: User; t: TFn }) {
  const mine = useMine(user)
  const loading = useLoading(450)
  const c = (f: (l: Listing) => boolean) => mine.filter(f).length
  const views = mine.reduce((n, l) => n + l.views, 0)
  const stats: [string, string, IconName, string][] = [
    ["Active listings", String(c(l => l.status === "approved")), "list", "#seller/listings?tab=approved"],
    ["Awaiting review", String(c(l => l.status === "pending")), "clock", "#seller/listings?tab=pending"],
    ["Needs attention", String(c(l => l.status === "changes" || l.status === "rejected")), "alert", "#seller/listings?tab=attention"],
    ["Total views", views.toLocaleString(), "eye", "#seller/listings"],
  ]
  const todo = mine.filter(l => ["changes", "rejected", "draft"].includes(l.status)).slice(0, 4)
  return (
    <>
      <div className="sl-page-head">
        <div><span className="sl-eyebrow">{t("Seller Center")}</span><h1>{t("Good Morning, Golden Koi Farm").replace("Golden Koi Farm", user.store || user.name)}</h1><p>{t("Here is what is happening in your store today.")}</p></div>
        <a className="sl-btn sl-btn-primary lg" href="#seller/add" style={{ textDecoration: "none" }}>{t("+ Add New Fish")}</a>
      </div>
      <div className="sl-stats">
        {stats.map(([label, val, ic, href]) => (
          <a className="sl-stat" key={label} href={href} style={{ textDecoration: "none", color: "inherit" }}>
            <div className="sl-stat-top"><span><Icon name={ic} /></span></div>
            <strong>{val}</strong><small>{t(label)}</small>
          </a>
        ))}
      </div>
      <div className="sl-dash-grid">
        <section className="sl-card">
          <div className="sl-card-head"><h2>{t("Recent listings")}</h2><a className="sl-link" href="#seller/listings">{t("View all")}</a></div>
          {loading ? <Skeleton rows={4} /> : mine.length === 0
            ? <StateBlock icon="inbox" tone="info" title={t("No listings yet")} body={t("Create your first listing to start selling on FISHMARKET.")} actions={<a className="sl-btn sl-btn-primary" href="#seller/add">{t("Add New Fish")}</a>} />
            : <Table rows={mine.slice(0, 4)} t={t} vi={t("Live") !== "Live"} />}
        </section>
        <aside className="sl-promo">
          <img src={SAMPLE_PHOTOS[1].url} alt="Koi in a clear pond" />
          <div>
            <h2>{t("Next actions")}</h2>
            {todo.length === 0 ? <p>{t("Every listing is reviewed by our team before going live.")}</p> : (
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px", display: "grid", gap: 8 }}>
                {todo.map(l => <li key={l.id}><a href={`#seller/listing/${l.id}`} style={{ color: "#fff", fontWeight: 700 }}>{l.draft.name || l.id}</a> <small style={{ opacity: .8 }}>· {STATUS_LABEL[l.status]}</small></li>)}
              </ul>
            )}
            <a className="sl-btn sl-btn-light" href="#seller/add" style={{ textDecoration: "none" }}>{t("Add New Fish")} <Icon name="arrow" /></a>
          </div>
        </aside>
      </div>
    </>
  )
}

function Listings({ user, t, initTab }: { user: User; t: TFn; initTab: string }) {
  const mine = useMine(user)
  const loading = useLoading(450)
  const [tab, setTab] = useState(TABS.some(x => x[0] === initTab) ? initTab : "all")
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const f = TABS.find(x => x[0] === tab)![2]
  const rows = mine.filter(f).filter(l => !q.trim() || `${l.draft.name} ${l.id}`.toLowerCase().includes(q.trim().toLowerCase()))
  const pageRows = rows.slice((page - 1) * 5, page * 5)
  return (
    <>
      <Crumbs items={[[t("Seller Center"), "#seller"], [t("My Listings")]]} />
      <div className="sl-page-head"><div><h1>{t("My Listings")}</h1></div><a className="sl-btn sl-btn-primary lg" href="#seller/add" style={{ textDecoration: "none" }}>{t("+ Add New Fish")}</a></div>
      <section className="sl-card">
        <div className="pt-tabs" role="tablist">
          {TABS.map(([k, label, fn]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); setPage(1) }}>{t(label)}<em>{mine.filter(fn).length}</em></button>)}
        </div>
        <div className="pt-toolbar">
          <label className="pt-search"><Icon name="eye" /><input value={q} onChange={e => { setQ(e.target.value); setPage(1) }} placeholder={t("Search by name or ID")} aria-label={t("Search by name or ID")} /></label>
        </div>
        {loading ? <Skeleton /> : rows.length === 0 ? (
          q ? <StateBlock icon="search" tone="info" title={t("No results")} body={`"${q}"`} actions={<button className="sl-btn sl-btn-ghost" onClick={() => setQ("")}>{t("Clear search")}</button>} />
            : <StateBlock icon="inbox" tone="info" title={mine.length ? t("Nothing here yet") : t("No listings yet")} body={t("Create your first listing to start selling on FISHMARKET.")} actions={<a className="sl-btn sl-btn-primary" href="#seller/add">{t("Add New Fish")}</a>} />
        ) : <Table rows={pageRows} t={t} vi={t("Live") !== "Live"} />}
        {!loading && rows.length > 0 && <Pager page={page} size={5} total={rows.length} onPage={setPage} />}
      </section>
    </>
  )
}

const PLACE: Record<string, [IconName, string, string]> = {
  orders: ["bag", "Orders", "Orders from buyers appear here once your listings sell. You have no orders yet."],
  customers: ["users", "Customers", "Customers who buy from you will be listed here."],
  messages: ["msg", "Messages", "Buyer enquiries about your listings will appear here."],
  analytics: ["chart", "Analytics", "Views and conversion insights appear once you have live listings with traffic."],
  reviews: ["star", "Reviews", "Reviews from buyers show up here after completed orders."],
}
function Placeholder({ sec, t }: { sec: string; t: TFn }) {
  const [ic, title, body] = PLACE[sec]
  return (
    <>
      <Crumbs items={[[t("Seller Center"), "#seller"], [t(title)]]} />
      <div className="sl-page-head"><div><h1>{t(title)}</h1></div></div>
      <section className="sl-card"><StateBlock icon={ic === "bag" ? "bag" : "inbox"} tone="info" title={`${t(title)}: ${t("Nothing here yet")}`} body={t(body)} actions={<a className="sl-btn sl-btn-primary" href="#seller/listings">{t("My Listings")}</a>} /></section>
    </>
  )
}

function ListingView({ draft, seller, t }: { draft: Draft; seller: string; t: TFn }) {
  const main = draft.images.find(i => i.id === draft.mainId) ?? draft.images[0]
  const specs: [string, string][] = [[t("Age"), draft.age], [t("Size"), `${draft.size} cm`], [t("Gender"), t(draft.gender)], [t("Origin"), t(draft.origin)], [t("Health Status"), t(draft.health)], [t("Breed"), draft.breed || "—"]]
  return (
    <div className="sl-listing">
      <div className="sl-crumbs">{t("Marketplace")} <Icon name="right" /> {t(draft.species)} <Icon name="right" /> <b>{draft.name}</b></div>
      <div className="sl-listing-grid">
        <Gallery imgs={draft.images} main={main} alt={draft.name} />
        <div className="sl-buybox">
          <span className="sl-eyebrow">{t(draft.species)}{draft.breed && ` · ${draft.breed}`}</span>
          <h2>{draft.name}</h2>
          <div className="sl-price-row"><strong>{money(draft.price)}</strong>{draft.negotiable && <span className="sl-tag">{t("Negotiable price")}</span>}</div>
          <div className="sl-quick">
            <div><small>{t("Size")}</small><b>{draft.size} cm</b></div>
            <div><small>{t("Age")}</small><b>{draft.age}</b></div>
            <div><small>{t("Availability")}</small><b className="ok">{draft.quantity} {t("in stock")}</b></div>
          </div>
          <div className="sl-seller-card">
            <span className="sl-avatar">{initials(seller)}</span>
            <div><b>{seller}</b><span><Icon name="shield" /> {t("Verified Seller")}</span></div>
          </div>
          <div className="sl-loc"><Icon name="pin" /><span>{draft.location}, {t(draft.region)}</span></div>
          <div className="sl-loc"><Icon name="truck" /><span>{draft.shipping.map(t).join(" · ")}</span></div>
          <div className="sl-fake-actions"><span>{t("Buy now")}</span><span>{t("Contact seller")}</span></div>
        </div>
      </div>
      <div className="sl-listing-body">
        <section><h3>{t("Description")}</h3><p>{draft.description}</p></section>
        <section><h3>{t("Fish Details")}</h3><dl className="sl-specs">{specs.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section>
      </div>
    </div>
  )
}

function Detail({ user, id, t, show, submitted }: { user: User; id: string; t: TFn; show: Toast; submitted: boolean }) {
  const s = useStore()
  const l = s.listings.find(x => x.id === id)
  const [dlg, setDlg] = useState<null | "withdraw" | "pause" | "delete" | "edit">(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [preview, setPreview] = useState(false)
  const crumbs = (label: string): [string, string?][] => [[t("Seller Center"), "#seller"], [t("My Listings"), "#seller/listings"], [label]]
  if (!l && s.deleted.includes(id)) return <><Crumbs items={crumbs(id)} /><StateBlock card icon="x" tone="warn" title={t("This listing was deleted")} body={t("The listing was deleted and can no longer be opened.")} actions={<a className="sl-btn sl-btn-primary" href="#seller/listings">{t("Back to My Listings")}</a>} /></>
  if (!l || l.owner !== user.email) return <><Crumbs items={crumbs(id)} /><StateBlock card icon="search" tone="warn" title={t("Listing not found")} body={t("It may have been deleted or you may not have access to it.")} actions={<a className="sl-btn sl-btn-primary" href="#seller/listings">{t("Back to My Listings")}</a>} /></>

  const run = (fn: () => void, msg: string) => {
    setBusy(true); setErr("")
    request(fn, 650).then(() => { setBusy(false); setDlg(null); show(msg) }).catch((e: Error) => {
      setBusy(false)
      setErr(e.message === "expired" ? "Your session expired. Please sign in again." : "Network error. Check your connection and try again.")
    })
  }
  const st = l.status
  const d = l.decision
  return (
    <>
      <Crumbs items={crumbs(l.draft.name || l.id)} />
      <div className="sl-page-head tight">
        <div><span className="sl-eyebrow">{l.id}</span><h1>{l.draft.name || "Untitled listing"}</h1><p className="sl-muted">{t(l.draft.species)} · {l.draft.price ? money(l.draft.price) : "—"} · {t("Updated")} {timeAgo(l.updatedAt, t("Live") !== "Live")}</p></div>
        <StatusChip s={st} />
      </div>
      {submitted && st === "pending" && <Banner tone="ok">{t("Submitted for review")}. {t("Your listing is waiting for an admin. You will be notified as soon as there is a decision.")}</Banner>}
      {st === "pending" && !submitted && <Banner tone="info">{t("This listing is under review")}. {t("Withdraw it first if you want to make changes.")}</Banner>}
      {(st === "changes" || st === "rejected") && d && (
        <Banner tone="warn" action={<a className="sl-btn sl-btn-primary" href={`#seller/edit/${l.id}`}>{t("Edit & resubmit")}</a>}>
          <b>{st === "changes" ? t("Changes requested") : t("Rejection reason")}: {t(d.reason)}</b> — {d.feedback}
        </Banner>
      )}
      {st === "approved" && <Banner tone="ok">{t("Your listing is now live!")} {t("Editing a live listing sends it back to review and hides it until approved.")}</Banner>}
      {st === "paused" && <Banner tone="info">{t("Paused")}</Banner>}
      {err && !dlg && <Banner tone="error" action={<button className="sl-btn sl-btn-ghost" onClick={() => setErr("")}>{t("Cancel")}</button>}>{err}</Banner>}
      <div className="sl-row" style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "4px 0 18px" }}>
        {(st === "draft" || st === "changes" || st === "rejected") && <a className="sl-btn sl-btn-primary" href={`#seller/edit/${l.id}`}><Icon name="edit" />{st === "draft" ? t("Edit listing") : t("Edit & resubmit")}</a>}
        {st === "approved" && <a className="sl-btn sl-btn-primary" href="#marketplace">{t("View on marketplace")}</a>}
        {st === "approved" && <button className="sl-btn sl-btn-ghost" onClick={() => setDlg("pause")}>{t("Pause listing")}</button>}
        {st === "approved" && <button className="sl-btn sl-btn-ghost" onClick={() => setDlg("edit")}><Icon name="edit" />{t("Edit listing")}</button>}
        {st === "paused" && <button className="sl-btn sl-btn-primary" onClick={() => run(() => setPaused(user, l.id, false), "Listing is live again.")}>{busy ? "…" : t("Resume listing")}</button>}
        {st === "pending" && <button className="sl-btn sl-btn-ghost" onClick={() => setDlg("withdraw")}>{t("Withdraw from review")}</button>}
        {st !== "pending" && st !== "approved" && <button className="sl-btn sl-btn-outline-danger" onClick={() => setDlg("delete")}><Icon name="trash" />{t("Delete listing")}</button>}
        <button className="sl-btn sl-btn-ghost" onClick={() => setPreview(p => !p)}><Icon name="eye" />{t("Preview as buyer")}</button>
      </div>
      {preview && <div className="sl-frame" style={{ marginBottom: 24 }}><ListingView draft={l.draft} seller={l.sellerName} t={t} /></div>}
      <section className="sl-card pad">
        <h3>{t("History")}</h3>
        <ol className="pt-timeline" style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
          {[...l.history].reverse().map((h, i) => <li key={i}><b>{h.action}</b><small>{h.by} · {fmtDate(h.at)}{h.note ? ` — ${h.note}` : ""}</small></li>)}
        </ol>
      </section>
      {dlg === "withdraw" && <ConfirmDialog title="Withdraw from review?" body="The listing returns to Draft and the admin queue is updated. You can edit and submit it again." confirmLabel="Withdraw" busy={busy} error={err} onCancel={() => { setDlg(null); setErr("") }} onConfirm={() => run(() => withdrawListing(user, l.id), "Listing withdrawn and saved as a draft.")} />}
      {dlg === "pause" && <ConfirmDialog title="Pause this listing?" body="It will be hidden from buyers until you resume it." confirmLabel="Pause" busy={busy} error={err} onCancel={() => { setDlg(null); setErr("") }} onConfirm={() => run(() => setPaused(user, l.id, true), "Listing paused.")} />}
      {dlg === "delete" && <ConfirmDialog danger title="Delete this listing?" body="This permanently removes the listing and its history. This cannot be undone." confirmLabel="Delete" busy={busy} error={err} onCancel={() => { setDlg(null); setErr("") }} onConfirm={() => { setBusy(true); setErr(""); request(() => deleteListing(user, l.id), 650).then(() => { flash("Listing deleted."); go("seller/listings") }).catch((e: Error) => { setBusy(false); setErr(e.message === "expired" ? "Your session expired. Please sign in again." : "Network error. Check your connection and try again.") }) }} />}
      {dlg === "edit" && <ConfirmDialog title="Edit this live listing?" body="Saving changes sends the listing back to review and hides it from buyers until it is approved again." confirmLabel="Continue to edit" onCancel={() => setDlg(null)} onConfirm={() => go(`seller/edit/${l.id}`)} />}
    </>
  )
}

function ListingForm({ user, id, t, show }: { user: User; id?: string; t: TFn; show: Toast }) {
  const existing = id ? getListing(id) : undefined
  const s = useStore()
  const [recId, setRecId] = useState<string | undefined>(id)
  const [draft, setDraft] = useState<Draft>(() => existing ? existing.draft : EMPTY_DRAFT)
  const [step, setStep] = useState(1)
  const [maxStep, setMaxStep] = useState(existing ? 6 : 1)
  const [tried, setTried] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState<"" | "save" | "submit">("")
  const [err, setErr] = useState("")
  const [leave, setLeave] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropZone, setDropZone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const rec = recId ? s.listings.find(x => x.id === recId) : undefined

  useEffect(() => { window.scrollTo({ top: 0 }) }, [step])
  useEffect(() => {
    if (!dirty) return
    const f = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener("beforeunload", f); return () => window.removeEventListener("beforeunload", f)
  }, [dirty])

  const crumbs = (label: string): [string, string?][] => [[t("Seller Center"), "#seller"], [t("My Listings"), "#seller/listings"], [label]]
  if (id && !existing) {
    const gone = s.deleted.includes(id)
    return <><Crumbs items={crumbs(id)} /><StateBlock card icon={gone ? "x" : "search"} tone="warn" title={gone ? t("This listing was deleted") : t("Listing not found")} body={gone ? t("The listing was deleted and can no longer be opened.") : t("It may have been deleted or you may not have access to it.")} actions={<a className="sl-btn sl-btn-primary" href="#seller/listings">{t("Back to My Listings")}</a>} /></>
  }
  if (existing && (existing.owner !== user.email)) return <><Crumbs items={crumbs(id!)} /><StateBlock card icon="lock" tone="warn" title={t("Listing not found")} body={t("It may have been deleted or you may not have access to it.")} actions={<a className="sl-btn sl-btn-primary" href="#seller/listings">{t("Back to My Listings")}</a>} /></>
  if (rec && rec.status === "pending") return <><Crumbs items={crumbs(rec.draft.name)} /><StateBlock card icon="clock" tone="info" title={t("This listing is under review")} body={t("Withdraw it first if you want to make changes.")} actions={<a className="sl-btn sl-btn-primary" href={`#seller/listing/${rec.id}`}>{t("View")}</a>} /></>

  const status: LStatus | null = rec?.status ?? null
  const resubmit = status === "changes" || status === "rejected" || status === "approved"
  const decision = rec?.decision

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setDraft(d => ({ ...d, [k]: v })); setDirty(true); setErr("") }
  const e: Record<number, string[]> = {
    1: [!draft.name.trim() && "name", !draft.species && "species", draft.description.trim().length < 20 && "description"].filter(Boolean) as string[],
    2: [!draft.age.trim() && "age", !(Number(draft.size) > 0) && "size", !draft.gender && "gender", !draft.origin && "origin", !draft.health && "health"].filter(Boolean) as string[],
    3: [!(Number(draft.price) > 0) && "price", !(Number(draft.quantity) >= 1) && "quantity"].filter(Boolean) as string[],
    4: [draft.images.length < 1 && "images"].filter(Boolean) as string[],
    5: [!draft.location.trim() && "location", !draft.region && "region", draft.shipping.length < 1 && "shipping"].filter(Boolean) as string[],
    6: [],
  }
  const err_ = (f: string) => tried && e[step]?.includes(f)
  const goStep = (n: number) => { setStep(n); setTried(false) }
  const next = () => {
    if (e[step].length) { setTried(true); return }
    const n = Math.min(6, step + 1); setMaxStep(m => Math.max(m, n)); goStep(n)
  }
  const fail = (x: Error) => setErr(x.message === "expired" ? "Your session expired. Please sign in again." : "Network error — your changes are still here. Check your connection and try again.")
  const saveNow = () => {
    if (busy) return
    if (!draft.name.trim()) { setStep(1); setTried(true); return }
    setBusy("save"); setErr("")
    request(() => saveDraft(user, recId, draft), 600).then(nid => { setRecId(nid); setDirty(false); setBusy(""); show("Draft saved") }).catch(x => { setBusy(""); fail(x) })
  }
  const submit = () => {
    if (busy) return
    for (let i = 1; i <= 5; i++) if (e[i].length) { setStep(i); setTried(true); setErr(`Step ${i} is incomplete — please fill in the required fields.`); return }
    setBusy("submit"); setErr("")
    request(() => { const nid = saveDraft(user, recId, draft); submitListing(user, nid, draft); return nid }, 900)
      .then(nid => { setDirty(false); go(`seller/listing/${nid}?submitted=1`) }).catch(x => { setBusy(""); fail(x) })
  }
  const leaveTo = () => { if (dirty) setLeave(true); else go(recId ? `seller/listing/${recId}` : "seller/listings") }

  const addImgs = (imgs: Img[]) => {
    const merged = [...draft.images, ...imgs.filter(n => !draft.images.some(o => o.id === n.id))].slice(0, 8)
    setDraft(d => ({ ...d, images: merged, mainId: d.mainId || merged[0]?.id || "" })); setDirty(true)
  }
  const addFiles = (files: FileList | null) => {
    if (!files) return
    addImgs([...files].filter(f => f.type.startsWith("image/")).map(f => ({ id: `u${Date.now()}${Math.random().toString(36).slice(2, 6)}`, url: URL.createObjectURL(f) })))
  }
  const removeImg = (iid: string) => {
    const images = draft.images.filter(i => i.id !== iid)
    setDraft(d => ({ ...d, images, mainId: d.mainId === iid ? images[0]?.id ?? "" : d.mainId })); setDirty(true)
  }
  const move = (from: number, to: number) => {
    if (to < 0 || to >= draft.images.length || from === to) return
    const a = [...draft.images]; const [m] = a.splice(from, 1); a.splice(to, 0, m); set("images", a)
  }

  const stepBody = () => {
    switch (step) {
      case 1: return (
        <div className="sl-form-grid">
          <Field t={t} bad={err_("name")} id="name" label="Fish Name"><input value={draft.name} onChange={x => set("name", x.target.value)} placeholder={t("e.g. Showa Sanshoku Koi")} /></Field>
          <Select t={t} bad={err_("species")} id="species" label="Species" value={draft.species} options={SPECIES} onChange={v => set("species", v)} />
          <Field t={t} optional bad={false} id="breed" label="Breed"><input value={draft.breed} onChange={x => set("breed", x.target.value)} placeholder={t("e.g. Showa, Kohaku, Halfmoon")} /></Field>
          <div className="sl-sample"><button type="button" className="sl-link" onClick={() => { setDraft(d => ({ ...d, ...SAMPLE })); setDirty(true) }}><Icon name="fish" /> {t("Use sample koi data")}</button></div>
          <div className="sl-span2"><Field t={t} bad={err_("description")} id="description" label="Description" hint={`${draft.description.length} / 600 · min 20`}><textarea rows={6} maxLength={600} value={draft.description} onChange={x => set("description", x.target.value)} placeholder={t("Lineage, colouring, temperament, feeding and water conditions…")} /></Field></div>
        </div>)
      case 2: return (
        <div className="sl-form-grid">
          <Field t={t} bad={err_("age")} id="age" label="Age"><input value={draft.age} onChange={x => set("age", x.target.value)} placeholder={t("e.g. 14 months")} /></Field>
          <Field t={t} bad={err_("size")} id="size" label="Size"><div className="sl-unit"><input type="number" min="0" value={draft.size} onChange={x => set("size", x.target.value)} placeholder="32" /><span>cm</span></div></Field>
          <Select t={t} bad={err_("gender")} id="gender" label="Gender" value={draft.gender} options={GENDERS} onChange={v => set("gender", v)} />
          <Select t={t} bad={err_("origin")} id="origin" label="Origin" value={draft.origin} options={ORIGINS} onChange={v => set("origin", v)} />
          <div className="sl-span2"><Select t={t} bad={err_("health")} id="health" label="Health Status" value={draft.health} options={HEALTH} onChange={v => set("health", v)} /></div>
        </div>)
      case 3: return (
        <div className="sl-form-grid">
          <Field t={t} bad={err_("price")} id="price" label="Price per fish (USD)"><div className="sl-unit pre"><span>$</span><input type="number" min="0" value={draft.price} onChange={x => set("price", x.target.value)} placeholder="480" /></div></Field>
          <Field t={t} bad={err_("quantity")} id="quantity" label="Quantity available"><input type="number" min="1" value={draft.quantity} onChange={x => set("quantity", x.target.value)} /></Field>
          <div className="sl-span2 sl-toggle-row">
            <div><b>{t("Negotiable")}</b><small>{t("Buyers can send you an offer")}</small></div>
            <button type="button" role="switch" aria-checked={draft.negotiable} aria-label={t("Negotiable")} className={`sl-switch ${draft.negotiable ? "on" : ""}`} onClick={() => set("negotiable", !draft.negotiable)}><i /></button>
          </div>
        </div>)
      case 4: return (
        <div>
          <div className={`sl-drop ${dropZone ? "over" : ""} ${err_("images") ? "bad" : ""}`}
            onDragOver={x => { x.preventDefault(); setDropZone(true) }} onDragLeave={() => setDropZone(false)}
            onDrop={x => { x.preventDefault(); setDropZone(false); addFiles(x.dataTransfer.files) }}>
            <Icon name="upload" />
            <b>{t("Upload Fish Images")}</b>
            <p>{t("Drag photos here or browse")}</p>
            <button type="button" className="sl-btn sl-btn-ghost" onClick={() => fileRef.current?.click()}>{t("Browse files")}</button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={x => { addFiles(x.target.files); x.target.value = "" }} />
            <small>{t("JPG or PNG, up to 8 photos. The first photo is your cover.")}</small>
          </div>
          {err_("images") && <p className="sl-err">{t("Required")}: {t("Upload Fish Images")}</p>}
          <div className="sl-samples"><span>{t("Or start with sample photos")}</span>
            {SAMPLE_PHOTOS.map(p => <button key={p.id} disabled={draft.images.some(i => i.id === p.id)} onClick={() => addImgs([p])} aria-label="Add sample photo"><img src={p.url} alt="" /></button>)}
          </div>
          {draft.images.length > 0 && (
            <ul className="sl-thumbs">
              {draft.images.map((img, i) => {
                const isMain = (draft.mainId || draft.images[0].id) === img.id
                return (
                  <li key={img.id} draggable onDragStart={() => setDragIdx(i)} onDragOver={x => x.preventDefault()} onDrop={() => { if (dragIdx !== null) move(dragIdx, i); setDragIdx(null) }} className={`${isMain ? "main" : ""} ${dragIdx === i ? "drag" : ""}`}>
                    <img src={img.url} alt={`Photo ${i + 1}`} />
                    {isMain && <span className="sl-main-badge">{t("Main")}</span>}
                    <span className="sl-order">{i + 1}</span>
                    <div className="sl-thumb-actions">
                      <button onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={t("Move earlier")} title={t("Move earlier")}><Icon name="left" /></button>
                      <button onClick={() => move(i, i + 1)} disabled={i === draft.images.length - 1} aria-label={t("Move later")} title={t("Move later")}><Icon name="right" /></button>
                      <button onClick={() => set("mainId", img.id)} disabled={isMain} aria-label={t("Set Main Image")} title={t("Set Main Image")}><Icon name="star" /></button>
                      <button onClick={() => removeImg(img.id)} aria-label={t("Delete Image")} title={t("Delete Image")} className="del"><Icon name="trash" /></button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {draft.images.length > 1 && <p className="sl-hint">{t("Drag to reorder")}</p>}
        </div>)
      case 5: return (
        <div className="sl-form-grid">
          <div className="sl-span2"><Field t={t} bad={err_("location")} id="location" label="Farm / Store Location"><input value={draft.location} onChange={x => set("location", x.target.value)} placeholder={t("Street address or farm name")} /></Field></div>
          <Select t={t} bad={err_("region")} id="region" label="Region" value={draft.region} options={REGIONS} onChange={v => set("region", v)} />
          <div className="sl-span2">
            <p className="sl-label">{t("Shipping Availability")} *</p>
            <div className={`sl-ship ${err_("shipping") ? "bad" : ""}`}>
              {SHIPPING.map(sh => {
                const on = draft.shipping.includes(sh)
                return <button type="button" key={sh} aria-pressed={on} className={on ? "on" : ""} onClick={() => set("shipping", on ? draft.shipping.filter(z => z !== sh) : [...draft.shipping, sh])}>
                  <Icon name={sh === "Local pickup" ? "pin" : "truck"} /><span>{t(sh)}</span>{on && <Icon name="check" className="tick" />}
                </button>
              })}
            </div>
            {err_("shipping") && <p className="sl-err">{t("Required")}</p>}
          </div>
        </div>)
      default: return null
    }
  }

  return (
    <>
      <Crumbs items={crumbs(existing ? existing.draft.name || existing.id : t("Add New Fish"))} />
      <div className="sl-page-head tight">
        <div><span className="sl-eyebrow">{recId ?? t("Seller Center")}</span><h1>{existing ? t("Edit listing") : t("Add New Fish")}</h1><p>{t("Create your listing in six short steps. Your progress is saved as you go.")} <small>* {t("Required fields are marked")}</small></p></div>
        {status && <StatusChip s={status} />}
      </div>
      {(status === "changes" || status === "rejected") && decision && <Banner tone="warn"><b>{t("Changes requested")}: {t(decision.reason)}</b> — {decision.feedback}</Banner>}
      {status === "approved" && <Banner tone="warn">{t("Editing a live listing sends it back to review and hides it until approved.")}</Banner>}
      {err && <Banner tone="error" action={<button className="sl-btn sl-btn-ghost" onClick={() => (step === 6 ? submit() : saveNow())}>{t("Try again")}</button>}>{err}</Banner>}
      <ol className="sl-steps">
        {STEPS.map((st, i) => {
          const n = i + 1; const state = n === step ? "cur" : n < step || n <= maxStep ? "done" : ""
          return <li key={st} className={state}><button disabled={n > maxStep} onClick={() => goStep(n)} aria-current={n === step ? "step" : undefined}><i>{n < step ? <Icon name="check" /> : `0${n}`}</i><span>{t(st)}</span></button></li>
        })}
      </ol>
      {step < 6 ? (
        <section className="sl-card sl-form-card">
          <h2><span>0{step}</span>{t(STEPS[step - 1])}</h2>
          {stepBody()}
        </section>
      ) : (
        <>
          <div className="sl-preview-bar"><div><span className="sl-eyebrow"><Icon name="eye" /> {t("Buyer view")}</span><p>{t("This is exactly how buyers will see your listing.")}</p></div></div>
          <div className="sl-frame"><ListingView draft={draft} seller={user.store || user.name} t={t} /></div>
        </>
      )}
      <div className="sl-footer">
        <button className="sl-btn sl-btn-ghost" onClick={() => (step === 1 ? leaveTo() : goStep(step - 1))} disabled={!!busy}><Icon name="left" />{step === 1 ? t("Cancel") : t("Back")}</button>
        <div>
          {step === 6 && <button className="sl-btn sl-btn-ghost" onClick={() => goStep(1)}><Icon name="edit" />{t("Edit Listing")}</button>}
          {status !== "approved" && <button className="sl-btn sl-btn-ghost" onClick={saveNow} disabled={!!busy}>{busy === "save" ? t("Saving…") : t("Save Draft")}</button>}
          {step < 6
            ? <button className="sl-btn sl-btn-primary" onClick={next}>{t("Continue")}<Icon name="arrow" /></button>
            : <button className="sl-btn sl-btn-primary" disabled={!!busy || (resubmit && !dirty)} onClick={submit}>{busy === "submit" ? t("Submitting…") : t(resubmit ? "Resubmit for Review" : "Submit for Review")}<Icon name="arrow" /></button>}
        </div>
      </div>
      {resubmit && step === 6 && !dirty && <p className="sl-hint right">{t("Edit Listing")} → {t("Resubmit for Review")}</p>}
      {leave && <ConfirmDialog danger title="Discard changes?" body="You have unsaved changes. If you leave now they will be lost." confirmLabel="Discard" onCancel={() => setLeave(false)} onConfirm={() => { setDirty(false); go(recId ? `seller/listing/${recId}` : "seller/listings") }} />}
    </>
  )
}
