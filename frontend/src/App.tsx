import { endSession, flash, hasSession, homeFor, remainingMs, sessionExpired, setReturnTo, takeFlash, touchSession, useUser } from "./store";
import { SiteHeader } from "./SiteHeader";
import { AccessDenied, NotFound, SessionExpired } from "./ui";
import { createContext, FormEvent, lazy, ReactNode, Suspense, useContext, useEffect, useState } from "react";

const Auth = lazy(() => import("./Auth"));
const Buyer = lazy(() => import("./Buyer"));
const Seller = lazy(() => import("./Seller"));
const Admin = lazy(() => import("./Admin"));
const Account = lazy(() => import("./Account"));

type IconName =
  | "arrow"
  | "bell"
  | "cart"
  | "check"
  | "chevron"
  | "fish"
  | "heart"
  | "instagram"
  | "linkedin"
  | "location"
  | "lock"
  | "mail"
  | "menu"
  | "message"
  | "quality"
  | "search"
  | "shield"
  | "star"
  | "store"
  | "user"
  | "x";

type Language = "en" | "vi";

const vi: Record<string, string> = {
  "Home": "Trang chủ",
  "Marketplace": "Chợ cá",
  "Categories": "Danh mục",
  "Sellers": "Người bán",
  "How It Works": "Cách hoạt động",
  "About Us": "Về chúng tôi",
  "Sign In": "Đăng nhập",
  "Dashboard": "Bảng điều khiển",
  "Sell Your Fish": "Đăng bán cá",
  "The trusted marketplace for aquatic trade": "Sàn giao dịch thủy sản đáng tin cậy",
  "Buy. Sell.": "Mua. Bán.",
  "Trade. Fish.": "Giao dịch cá.",
  "Discover quality fish from trusted breeders, farms, and sellers. Compare prices, verify sellers, and trade with confidence.": "Khám phá cá chất lượng từ các trại giống, trang trại và người bán uy tín. So sánh giá, xác minh người bán và giao dịch an tâm.",
  "Explore Marketplace": "Khám phá chợ cá",
  "Start Selling": "Bắt đầu bán",
  "10,000+ Fish Listed": "10.000+ cá đang bán",
  "2,500+ Verified Sellers": "2.500+ người bán xác minh",
  "Secure Transactions": "Giao dịch an toàn",
  "Buyer Protection": "Bảo vệ người mua",
  "Included on eligible trades": "Áp dụng cho giao dịch đủ điều kiện",
  "Search fish, species, breed, or seller...": "Tìm cá, loài, giống hoặc người bán...",
  "Species": "Loài",
  "Location": "Khu vực",
  "Price Range": "Khoảng giá",
  "All Species": "Tất cả loài",
  "All Location": "Tất cả khu vực",
  "All Price Range": "Tất cả mức giá",
  "Search": "Tìm kiếm",
  "Results": "Kết quả",
  "Browse by type": "Khám phá theo loại",
  "Explore Fish Categories": "Khám phá danh mục cá",
  "Discover the right stock across popular species and trade categories.": "Tìm nguồn cá phù hợp trong các loài và danh mục giao dịch phổ biến.",
  "View all categories": "Xem tất cả danh mục",
  "Ornamental Fish": "Cá cảnh",
  "Freshwater Fish": "Cá nước ngọt",
  "Saltwater Fish": "Cá nước mặn",
  "Koi Fish": "Cá Koi",
  "Betta Fish": "Cá Betta",
  "Goldfish": "Cá vàng",
  "Tropical Fish": "Cá nhiệt đới",
  "Farmed Fish": "Cá nuôi thương phẩm",
  "listings": "tin đăng",
  "Curated marketplace": "Tuyển chọn từ chợ cá",
  "Featured Fish": "Cá nổi bật",
  "Quality listings from trusted sellers": "Tin đăng chất lượng từ người bán uy tín",
  "Browse all listings": "Xem tất cả tin đăng",
  "Verified Seller": "Người bán xác minh",
  "From": "Từ",
  "View Details": "Xem chi tiết",
  "Favorite": "Yêu thích",
  "Male · 6 months": "Cá đực · 6 tháng",
  "30 cm · Farm Raised": "30 cm · Nuôi tại trại",
  "25 cm · Vietnam": "25 cm · Việt Nam",
  "Active Listings": "Tin đang hoạt động",
  "Verified Sellers": "Người bán xác minh",
  "Successful Trades": "Giao dịch thành công",
  "Satisfied Buyers": "Người mua hài lòng",
  "Shop verified stores": "Mua từ cửa hàng xác minh",
  "Trusted Sellers": "Người bán uy tín",
  "Experienced farms, breeders, and aquatic specialists with proven track records.": "Các trang trại, nhà lai tạo và chuyên gia thủy sinh giàu kinh nghiệm với hồ sơ minh bạch.",
  "Explore sellers": "Khám phá người bán",
  "Rare freshwater": "Cá nước ngọt quý hiếm",
  "Premium koi": "Koi cao cấp",
  "Show-grade betta": "Betta chuẩn thi đấu",
  "Listings": "Tin đăng",
  "View Store": "Xem cửa hàng",
  "Simple. Secure. Transparent.": "Đơn giản. An toàn. Minh bạch.",
  "Trade With Confidence": "Giao dịch đầy tự tin",
  "A clear process designed to protect buyers and help trusted sellers grow.": "Quy trình rõ ràng giúp bảo vệ người mua và đồng hành cùng người bán uy tín.",
  "Find Your Fish": "Tìm cá phù hợp",
  "Search thousands of listings and find the fish that matches your needs.": "Tìm kiếm trong hàng nghìn tin đăng để chọn đúng loại cá bạn cần.",
  "Check the Seller": "Kiểm tra người bán",
  "Review ratings, verification, location, and previous transactions.": "Xem đánh giá, trạng thái xác minh, vị trí và lịch sử giao dịch.",
  "Make a Deal": "Thực hiện giao dịch",
  "Contact the seller or place an order securely through the platform.": "Liên hệ người bán hoặc đặt hàng an toàn ngay trên nền tảng.",
  "Receive Your Fish": "Nhận cá",
  "Complete the transaction and receive your fish safely.": "Hoàn tất giao dịch và nhận cá an toàn.",
  "Trust at every step": "An tâm trong từng bước",
  "Built for Safer Fish Trading": "Xây dựng cho giao dịch cá an toàn hơn",
  "The standards, safeguards, and transparency professional aquatic commerce needs.": "Tiêu chuẩn, cơ chế bảo vệ và tính minh bạch mà thương mại thủy sản chuyên nghiệp cần có.",
  "Trade with sellers whose identity and business information have been verified.": "Giao dịch với người bán đã được xác minh danh tính và thông tin kinh doanh.",
  "Protect your payment and sensitive transaction information.": "Bảo vệ thanh toán và thông tin giao dịch nhạy cảm của bạn.",
  "Quality Listings": "Tin đăng chất lượng",
  "Detailed information and photos help buyers make better decisions.": "Thông tin và hình ảnh chi tiết giúp người mua đưa ra quyết định tốt hơn.",
  "Trade Protection": "Bảo vệ giao dịch",
  "Support and dispute assistance for eligible transactions.": "Hỗ trợ và xử lý tranh chấp cho các giao dịch đủ điều kiện.",
  "Grow your aquatic business": "Phát triển kinh doanh thủy sản",
  "Have Fish to Sell?": "Bạn có cá cần bán?",
  "Reach thousands of potential buyers and grow your fish business with our trusted marketplace.": "Tiếp cận hàng nghìn khách hàng tiềm năng và phát triển kinh doanh trên sàn giao dịch uy tín.",
  "Free to create a seller account": "Miễn phí tạo tài khoản người bán",
  "Community stories": "Câu chuyện cộng đồng",
  "What Our Community Says": "Cộng đồng nói gì",
  "Verified Buyer": "Người mua xác minh",
  "Aquatic Retailer": "Nhà bán lẻ thủy sinh",
  "The seller verification and detailed listing gave me the confidence to purchase a high-value koi online.": "Xác minh người bán và tin đăng chi tiết giúp tôi tự tin mua một chú koi giá trị cao trực tuyến.",
  "We have found three reliable farm partners through Fishmarket. It has changed how we source stock.": "Chúng tôi đã tìm được ba đối tác trang trại đáng tin cậy qua Fishmarket. Nền tảng đã thay đổi cách chúng tôi tìm nguồn hàng.",
  "The enquiries are serious and the tools make managing my listings remarkably straightforward.": "Khách hỏi mua rất nghiêm túc và các công cụ giúp tôi quản lý tin đăng cực kỳ dễ dàng.",
  "Market knowledge": "Kiến thức thị trường",
  "Fish Trading Insights": "Kiến thức giao dịch cá",
  "Practical guidance and analysis for smarter aquatic trade.": "Hướng dẫn thực tế và phân tích để giao dịch thủy sản thông minh hơn.",
  "Buyer Guide": "Hướng dẫn người mua",
  "How to Choose a Healthy Ornamental Fish": "Cách chọn cá cảnh khỏe mạnh",
  "Key signs of health, vitality, and responsible breeding to look for before you buy.": "Những dấu hiệu quan trọng về sức khỏe, sức sống và quy trình lai tạo cần xem trước khi mua.",
  "Market Report": "Báo cáo thị trường",
  "Understanding Fish Market Prices": "Hiểu về giá cá trên thị trường",
  "Learn what drives pricing across species, grades, sizes, origins, and seasons.": "Tìm hiểu các yếu tố ảnh hưởng đến giá theo loài, phẩm cấp, kích thước, nguồn gốc và mùa vụ.",
  "Safety": "An toàn",
  "Guide to Buying Fish Online Safely": "Hướng dẫn mua cá trực tuyến an toàn",
  "A practical checklist for assessing listings, sellers, shipping, and payment.": "Danh sách kiểm tra thực tế để đánh giá tin đăng, người bán, vận chuyển và thanh toán.",
  "Read More": "Đọc thêm",
  "Weekly market brief": "Bản tin thị trường hằng tuần",
  "Stay Ahead of the Fish Market": "Luôn dẫn đầu thị trường cá",
  "Get new listings, market updates, and fish trading insights delivered to your inbox.": "Nhận tin đăng mới, cập nhật thị trường và kiến thức giao dịch cá qua email.",
  "Enter your email address": "Nhập địa chỉ email",
  "Subscribe": "Đăng ký",
  "Subscribed": "Đã đăng ký",
  "Your trusted marketplace for buying, selling, and trading quality fish.": "Sàn giao dịch đáng tin cậy để mua, bán và trao đổi cá chất lượng.",
  "Browse Fish": "Khám phá cá",
  "Featured Listings": "Tin đăng nổi bật",
  "For Sellers": "Dành cho người bán",
  "Seller Dashboard": "Trang quản lý người bán",
  "Seller Guidelines": "Hướng dẫn người bán",
  "Transaction Fees": "Phí giao dịch",
  "Support": "Hỗ trợ",
  "Help Center": "Trung tâm trợ giúp",
  "Contact Us": "Liên hệ",
  "Safety & Security": "An toàn & bảo mật",
  "Terms & Conditions": "Điều khoản & điều kiện",
  "Privacy Policy": "Chính sách bảo mật",
  "All rights reserved.": "Bảo lưu mọi quyền.",
  "Built for safer, smarter aquatic trade.": "Vì giao dịch thủy sản an toàn và thông minh hơn.",
};

const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void }>({ language: "en", setLanguage: () => undefined });

function useTranslation() {
  const { language, setLanguage } = useContext(LanguageContext);
  const t = (text: string) => language === "vi" ? (vi[text] || text) : text;
  return { language, setLanguage, t };
}

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    cart: <><path d="M3 3h2l2.5 11h9.8l2-7H6.2" /><circle cx="9" cy="19" r="1.3" /><circle cx="17" cy="19" r="1.3" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    fish: <><path d="M3 12s4-6 10-6c4 0 7 3 8 6-1 3-4 6-8 6-6 0-10-6-10-6Z" /><path d="M3 12 1 7v10l2-5Z" /><circle cx="16" cy="10" r=".8" fill="currentColor" stroke="none" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".6" fill="currentColor" /></>,
    linkedin: <><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4V8h4v2" /><path d="M2 9h4v12H2z" /><circle cx="4" cy="4" r="2" /></>,
    location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8M8 13h5" /></>,
    quality: <><path d="m12 3 2.4 3.7 4.3 1.1-2.8 3.4.3 4.4-4.2-1.7-4.2 1.7.3-4.4-2.8-3.4 4.3-1.1L12 3Z" /><path d="m9 18-1 4 4-2 4 2-1-4" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-5" /></>,
    star: <path d="m12 2.8 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9L6.4 20l1.1-6.2L3 9.4l6.2-.9L12 2.8Z" />,
    store: <><path d="M4 10v10h16V10" /><path d="M3 4h18l-2 6H5L3 4Z" /><path d="M9 20v-6h6v6" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    x: <><path d="M5 5l14 14M19 5 5 19" /></>,
  };

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

const photos = {
  hero: "https://images.unsplash.com/photo-1668349009169-93e19d2eba7a?auto=format&fit=crop&w=1800&q=88",
  blue: "https://images.unsplash.com/photo-1522720833375-9c27ffb02a5e?auto=format&fit=crop&w=900&q=82",
  clown: "https://images.unsplash.com/photo-1706114350113-3063f27619c7?auto=format&fit=crop&w=900&q=82",
  coral: "https://images.unsplash.com/photo-1572438131134-ec29490abfba?auto=format&fit=crop&w=900&q=82",
  yellow: "https://images.unsplash.com/photo-1516408388733-2f8364f2e00b?auto=format&fit=crop&w=900&q=82",
  koi: "https://images.unsplash.com/photo-1640529837996-b81a91eaf7a5?auto=format&fit=crop&w=900&q=84",
  koiSchool: "https://images.unsplash.com/photo-1692765109385-426f4a3a8e47?auto=format&fit=crop&w=900&q=84",
  goldfish: "https://images.unsplash.com/photo-1663892318998-d4b1a5acde66?auto=format&fit=crop&w=900&q=84",
  school: "https://images.unsplash.com/photo-1669048014031-e3664a627ab4?auto=format&fit=crop&w=900&q=82",
  farm: "https://images.unsplash.com/photo-1717468394948-fbd4eb0afc16?auto=format&fit=crop&w=1200&q=82",
};

const categories = [
  ["Ornamental Fish", "2,840 listings", photos.blue],
  ["Freshwater Fish", "1,960 listings", photos.koi],
  ["Saltwater Fish", "1,420 listings", photos.clown],
  ["Koi Fish", "1,180 listings", photos.koiSchool],
  ["Betta Fish", "980 listings", photos.yellow],
  ["Goldfish", "760 listings", photos.goldfish],
  ["Tropical Fish", "1,640 listings", photos.coral],
  ["Farmed Fish", "1,220 listings", photos.school],
];

const listings = [
  { name: "Premium Kohaku Koi", species: "Nishikigoi · Grade A", detail: "45 cm · Japan", location: "Long An, VN", seller: "Golden Koi Farm", rating: "4.9", price: "$850", image: photos.koi },
  { name: "Galaxy Betta", species: "Betta splendens", detail: "Male · 6 months", location: "Bangkok, TH", seller: "Betta House", rating: "4.9", price: "$120", image: photos.blue },
  { name: "Blue Arowana", species: "Scleropages formosus", detail: "30 cm · Farm Raised", location: "Singapore", seller: "Ocean Blue Aquatics", rating: "4.8", price: "$1,200", image: photos.yellow },
  { name: "Redtail Catfish", species: "Phractocephalus", detail: "25 cm · Vietnam", location: "Ho Chi Minh City", seller: "Mekong Aquatics", rating: "4.7", price: "$350", image: photos.coral },
];

const sellers = [
  { name: "Ocean Blue Aquatics", location: "Ho Chi Minh City", rating: "4.9", listings: "128 Listings", image: photos.blue, specialty: "Rare freshwater" },
  { name: "Golden Koi Farm", location: "Long An", rating: "4.8", listings: "86 Listings", image: photos.koiSchool, specialty: "Premium koi" },
  { name: "Premium Betta House", location: "Ho Chi Minh City", rating: "4.9", listings: "214 Listings", image: photos.yellow, specialty: "Show-grade betta" },
];

function Logo({ light = false }: { light?: boolean }) {
  return (
    <a href="#top" className="flex items-center gap-2.5" aria-label="Fishmarket home">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${light ? "bg-white/10 text-white" : "bg-[#087f79] text-white"}`}>
        <Icon name="fish" className="h-6 w-6" />
      </span>
      <span className={`text-[17px] font-extrabold tracking-[0.08em] ${light ? "text-white" : "text-[#071D2E]"}`}>FISHMARKET</span>
    </a>
  );
}

function Button({ children, variant = "primary", className = "", type = "button", onClick }: { children: ReactNode; variant?: "primary" | "secondary" | "light"; className?: string; type?: "button" | "submit"; onClick?: () => void }) {
  const styles = {
    primary: "bg-[#087f79] text-white shadow-[0_8px_24px_rgba(8,127,121,.2)] hover:bg-[#066a65]",
    secondary: "border border-[#CBD8DE] bg-white text-[#0A2B3C] hover:border-[#087f79] hover:text-[#087f79]",
    light: "bg-white text-[#073044] shadow-lg hover:bg-[#EAF7FA]",
  };
  return <button type={type} onClick={onClick} className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#20B8B0]/20 ${styles[variant]} ${className}`}>{children}</button>;
}

function VerifiedBadge() {
  const { t } = useTranslation();
  return <span className="inline-flex items-center gap-1 rounded-full bg-[#E9F8F0] px-2.5 py-1 text-[11px] font-bold text-[#168653]"><Icon name="check" className="h-3.5 w-3.5" /> {t("Verified Seller")}</span>;
}

function Rating({ value }: { value: string }) {
  return <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0A2B3C]"><Icon name="star" className="h-3.5 w-3.5 fill-[#F4B740] stroke-[#F4B740]" /> {value}</span>;
}

function SectionHeading({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="mb-9 flex items-end justify-between gap-6">
      <div>
        {eyebrow && <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-[#087f79]">{t(eyebrow)}</p>}
        <h2 className="text-3xl font-extrabold tracking-[-0.035em] text-[#071D2E] md:text-[40px] md:leading-[1.15]">{t(title)}</h2>
        {subtitle && <p className="mt-3 text-[15px] text-[#617582]">{t(subtitle)}</p>}
      </div>
      {action}
    </div>
  );
}

function Header() {
  const { language, setLanguage } = useTranslation();
  return <SiteHeader language={language} setLanguage={setLanguage} />;
}

function SearchPanel() {
  const [searched, setSearched] = useState(false);
  const { t } = useTranslation();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSearched(true);
    document.querySelector("#featured")?.scrollIntoView({ behavior: "smooth" });
  };
  return (
    <form onSubmit={submit} className="relative z-10 mx-auto -mt-8 max-w-[1220px] rounded-2xl border border-[#DDE8EC] bg-white p-3 shadow-[0_20px_60px_rgba(4,41,58,.14)] md:p-4">
      <div className="grid items-center gap-2 md:grid-cols-[1.7fr_1fr_1fr_1fr_auto]">
        <label className="flex h-[60px] items-center gap-3 rounded-xl bg-[#F4F8F9] px-4">
          <Icon name="search" className="h-5 w-5 text-[#087f79]" />
          <span className="sr-only">Search marketplace</span>
          <input className="min-w-0 flex-1 bg-transparent text-sm text-[#0A2B3C] outline-none placeholder:text-[#78909B]" placeholder={t("Search fish, species, breed, or seller...")} />
        </label>
        {["Species", "Location", "Price Range"].map((label) => (
          <label key={label} className="flex h-[60px] items-center justify-between rounded-xl border border-[#E2EAED] px-4">
            <span className="sr-only">{label}</span>
            <select className="w-full appearance-none bg-transparent text-sm font-semibold text-[#435A67] outline-none" defaultValue=""><option value="" disabled>{t(label)}</option><option>{t(`All ${label}`)}</option></select>
            <Icon name="chevron" className="h-4 w-4 rotate-90 text-[#78909B]" />
          </label>
        ))}
        <Button type="submit" className="h-[60px] px-7"><Icon name="search" className="h-4 w-4" />{t(searched ? "Results" : "Search")}</Button>
      </div>
    </form>
  );
}

function Hero() {
  const { t } = useTranslation();
  return (
    <section id="top" className="market-hero overflow-hidden bg-[#F5FAFB]">
      <div className="mx-auto grid max-w-[1440px] items-stretch lg:grid-cols-[.95fr_1.05fr]">
        <div className="flex items-center px-5 py-16 lg:py-24 xl:pl-[calc((100vw-1320px)/2)] xl:pr-16">
          <div className="hero-copy max-w-[610px]">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#BFE3E5] bg-white px-3.5 py-2 text-xs font-extrabold text-[#087f79] shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[#20B8B0]" /> {t("The trusted marketplace for aquatic trade")}
            </span>
            <h1 className="text-[48px] font-extrabold leading-[1.04] tracking-[-0.055em] text-[#071D2E] sm:text-[64px] xl:text-[76px]">{t("Buy. Sell.")}<br /><span className="text-[#087f79]">{t("Trade. Fish.")}</span></h1>
            <p className="mt-7 max-w-[570px] text-base leading-7 text-[#526A76] md:text-lg">{t("Discover quality fish from trusted breeders, farms, and sellers. Compare prices, verify sellers, and trade with confidence.")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button>{t("Explore Marketplace")} <Icon name="arrow" className="h-4 w-4" /></Button>
              <Button variant="secondary" onClick={() => { window.location.hash = "seller"; }}>{t("Start Selling")}</Button>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3 border-t border-[#D9E6E9] pt-6">
              {["10,000+ Fish Listed", "2,500+ Verified Sellers", "Secure Transactions"].map((item) => <span key={item} className="flex items-center gap-2 text-xs font-bold text-[#405965]"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#DDF5EC] text-[#168653]"><Icon name="check" className="h-3 w-3" /></span>{t(item)}</span>)}
            </div>
          </div>
        </div>
        <div className="relative min-h-[440px] overflow-hidden lg:min-h-[690px]">
          <img src={photos.hero} alt="Koi fish photographed in dark water" className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#052536]/20 via-transparent to-transparent" />
          <div className="absolute bottom-8 right-6 rounded-2xl border border-white/30 bg-white/90 p-4 shadow-xl backdrop-blur-md md:bottom-12 md:right-10">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#E2F5F4] text-[#087f79]"><Icon name="shield" /></span>
              <div><p className="text-xs font-extrabold text-[#0A2B3C]">{t("Buyer Protection")}</p><p className="mt-1 text-[11px] text-[#617582]">{t("Included on eligible trades")}</p></div>
            </div>
          </div>
        </div>
      </div>
      <div className="px-5"><SearchPanel /></div>
      <div className="h-16" />
    </section>
  );
}

function CategoryCard({ item }: { item: string[] }) {
  const { t } = useTranslation();
  return (
    <a href="#featured" className="group relative h-[260px] overflow-hidden rounded-2xl bg-[#0A2B3C] shadow-sm">
      <img src={item[2]} alt={item[0]} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#061D2A]/90 via-[#061D2A]/5 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5 text-white">
        <div><h3 className="font-extrabold">{t(item[0])}</h3><p className="mt-1 text-xs text-white/70">{item[1].replace("listings", t("listings"))}</p></div>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur transition group-hover:bg-white group-hover:text-[#087f79]"><Icon name="arrow" className="h-4 w-4" /></span>
      </div>
    </a>
  );
}

function ListingCard({ item, index }: { item: typeof listings[0]; index: number }) {
  const [favorite, setFavorite] = useState(false);
  const { t } = useTranslation();
  return (
    <article className="market-listing group overflow-hidden rounded-2xl border border-[#DDE7EB] bg-white transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(6,43,58,.11)]">
      <div className="relative h-[245px] overflow-hidden bg-[#E8F1F3]">
        <img src={item.image} alt={item.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <button onClick={() => setFavorite(!favorite)} aria-label={`${t("Favorite")} ${item.name}`} aria-pressed={favorite} className={`absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow-md backdrop-blur transition ${favorite ? "text-[#E75A64]" : "text-[#294652] hover:text-[#E75A64]"}`}>
          <Icon name="heart" className={`h-[18px] w-[18px] ${favorite ? "fill-current" : ""}`} />
        </button>
        <span className="absolute bottom-3 left-3 rounded-lg bg-[#071D2E]/75 px-2.5 py-1.5 text-[10px] font-bold text-white backdrop-blur">ID FM-{2048 + index * 187}</span>
      </div>
      <div className="p-5">
        <VerifiedBadge />
        <p className="text-[11px] font-bold uppercase tracking-[.1em] text-[#087f79]">{item.species}</p>
        <h3 className="mt-2 text-lg font-extrabold tracking-[-.02em] text-[#071D2E]">{item.name}</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#617582]"><span>{t(item.detail)}</span><span className="h-1 w-1 rounded-full bg-[#B4C5CB]" /><span className="flex items-center gap-1"><Icon name="location" className="h-3.5 w-3.5" />{item.location}</span></div>
        <div className="mt-5 flex items-center justify-between border-t border-[#E7EEF0] pt-4">
          <div><p className="text-xs font-bold text-[#294652]">{item.seller}</p><Rating value={item.rating} /></div>
          <div className="text-right"><p className="text-[10px] text-[#78909B]">{t("From")}</p><p className="text-xl font-extrabold tracking-[-.03em] text-[#071D2E]">{item.price}</p></div>
        </div>
        <Button variant="secondary" className="mt-5 h-10 w-full">{t("View Details")} <Icon name="arrow" className="h-4 w-4" /></Button>
      </div>
    </article>
  );
}

function Stats() {
  const { t } = useTranslation();
  return (
    <section className="bg-[#06283A] py-16 text-white">
      <div className="mx-auto grid max-w-[1220px] grid-cols-2 gap-y-10 px-5 lg:grid-cols-4">
        {[["10,000+", "Active Listings"], ["2,500+", "Verified Sellers"], ["15,000+", "Successful Trades"], ["98%", "Satisfied Buyers"]].map(([num, label], i) => (
          <div key={label} className={`text-center ${i ? "lg:border-l lg:border-white/15" : ""}`}>
            <p className="text-4xl font-extrabold tracking-[-.04em] md:text-5xl">{num}</p><p className="mt-2 text-sm text-[#9BC0CD]">{t(label)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SellerCard({ seller }: { seller: typeof sellers[0] }) {
  const { t } = useTranslation();
  return (
    <article className="rounded-2xl border border-[#DDE7EB] bg-white p-5 transition hover:-translate-y-1 hover:shadow-xl">
      <div className="flex gap-4">
        <img src={seller.image} alt="" className="h-16 w-16 rounded-2xl object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2"><h3 className="font-extrabold leading-tight text-[#071D2E]">{seller.name}</h3><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#168653] text-white"><Icon name="check" className="h-3 w-3" /></span></div>
          <p className="mt-1 text-xs text-[#617582]">{t(seller.specialty)}</p>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between rounded-xl bg-[#F5F9FA] px-4 py-3">
        <span className="flex items-center gap-1.5 text-xs text-[#526A76]"><Icon name="location" className="h-4 w-4" />{seller.location}</span>
        <Rating value={seller.rating} />
      </div>
      <div className="mt-4 flex items-center justify-between"><span className="text-xs font-bold text-[#526A76]">{seller.listings.replace("Listings", t("Listings"))}</span><button className="flex items-center gap-1 text-xs font-extrabold text-[#087f79] hover:underline">{t("View Store")} <Icon name="arrow" className="h-3.5 w-3.5" /></button></div>
    </article>
  );
}

function HowItWorks() {
  const { t } = useTranslation();
  const steps = [
    ["search", "Find Your Fish", "Search thousands of listings and find the fish that matches your needs."],
    ["user", "Check the Seller", "Review ratings, verification, location, and previous transactions."],
    ["message", "Make a Deal", "Contact the seller or place an order securely through the platform."],
    ["shield", "Receive Your Fish", "Complete the transaction and receive your fish safely."],
  ] as [IconName, string, string][];
  return (
    <section id="how" className="bg-[#F4F9FA] py-24">
      <div className="mx-auto max-w-[1220px] px-5">
        <SectionHeading eyebrow="Simple. Secure. Transparent." title="Trade With Confidence" subtitle="A clear process designed to protect buyers and help trusted sellers grow." />
        <div className="relative grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div className="absolute left-[12%] right-[12%] top-11 hidden border-t border-dashed border-[#9BC8D3] lg:block" />
          {steps.map(([icon, title, text], i) => <div key={title} className="relative rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(4,45,62,.06)]"><div className="mb-7 flex items-center justify-between"><span className="relative z-10 grid h-14 w-14 place-items-center rounded-2xl bg-[#E4F5F5] text-[#087f79]"><Icon name={icon} className="h-6 w-6" /></span><span className="text-sm font-extrabold text-[#ABC0C8]">0{i + 1}</span></div><h3 className="font-extrabold text-[#071D2E]">{t(title)}</h3><p className="mt-3 text-sm leading-6 text-[#617582]">{t(text)}</p></div>)}
        </div>
      </div>
    </section>
  );
}

function Promo() {
  const { t } = useTranslation();
  return (
    <section className="px-5 py-24">
      <div className="relative mx-auto min-h-[400px] max-w-[1220px] overflow-hidden rounded-[28px]">
        <img src={photos.farm} alt="Professional fish farm seller at work" className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-[#06283A]/80" />
        <div className="relative flex min-h-[400px] max-w-[680px] flex-col justify-center p-8 text-white md:p-16">
          <p className="mb-4 text-xs font-extrabold uppercase tracking-[.2em] text-[#78D5D0]">{t("Grow your aquatic business")}</p>
          <h2 className="text-4xl font-extrabold tracking-[-.04em] md:text-5xl">{t("Have Fish to Sell?")}</h2>
          <p className="mt-5 text-base leading-7 text-white/75">{t("Reach thousands of potential buyers and grow your fish business with our trusted marketplace.")}</p>
          <div className="mt-8 flex flex-wrap items-center gap-5"><Button variant="light" onClick={() => { window.location.hash = "seller"; }}>{t("Start Selling")} <Icon name="arrow" className="h-4 w-4" /></Button><span className="flex items-center gap-2 text-xs font-bold text-white/80"><Icon name="check" className="h-4 w-4 text-[#78D5D0]" /> {t("Free to create a seller account")}</span></div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useTranslation();
  const columns = [
    ["Marketplace", "Browse Fish", "Categories", "Featured Listings", "Trusted Sellers"],
    ["For Sellers", "Sell Your Fish", "Seller Dashboard", "Seller Guidelines", "Transaction Fees"],
    ["Support", "Help Center", "Contact Us", "Safety & Security", "Terms & Conditions", "Privacy Policy"],
  ];
  return (
    <footer id="about" className="bg-[#051F2E] text-white">
      <div className="mx-auto grid max-w-[1220px] gap-12 px-5 py-16 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div><Logo light /><p className="mt-5 max-w-[280px] text-sm leading-6 text-[#9BB4BF]">{t("Your trusted marketplace for buying, selling, and trading quality fish.")}</p><div className="mt-6 flex gap-2">{(["instagram", "linkedin"] as IconName[]).map(icon => <button key={icon} aria-label={icon} className="grid h-10 w-10 place-items-center rounded-lg bg-white/8 text-[#B7CDD5] transition hover:bg-[#087f79] hover:text-white"><Icon name={icon} className="h-[18px] w-[18px]" /></button>)}</div></div>
        {columns.map(([title, ...links]) => <div key={title}><h3 className="text-sm font-extrabold">{t(title)}</h3><ul className="mt-5 space-y-3">{links.map(link => <li key={link}><a href="#" className="text-sm text-[#9BB4BF] transition hover:text-white">{t(link)}</a></li>)}</ul></div>)}
      </div>
      <div className="border-t border-white/10"><div className="mx-auto flex max-w-[1220px] flex-col justify-between gap-3 px-5 py-6 text-xs text-[#7899A6] sm:flex-row"><p>© 2026 FISHMARKET. {t("All rights reserved.")}</p><p>{t("Built for safer, smarter aquatic trade.")}</p></div></div>
    </footer>
  );
}

function AppContent() {
  const [subscribed, setSubscribed] = useState(false);
  const { language, t } = useTranslation();
  const reviews = [
    ["Minh Tran", "Verified Buyer", "The seller verification and detailed listing gave me the confidence to purchase a high-value koi online.", "12 Feb 2026"],
    ["Sarah Lim", "Aquatic Retailer", "We have found three reliable farm partners through Fishmarket. It has changed how we source stock.", "06 Feb 2026"],
    ["Daniel Wong", "Verified Seller", "The enquiries are serious and the tools make managing my listings remarkably straightforward.", "28 Jan 2026"],
  ];
  const articles = [
    ["Buyer Guide", "How to Choose a Healthy Ornamental Fish", "Key signs of health, vitality, and responsible breeding to look for before you buy.", photos.blue],
    ["Market Report", "Understanding Fish Market Prices", "Learn what drives pricing across species, grades, sizes, origins, and seasons.", photos.koiSchool],
    ["Safety", "Guide to Buying Fish Online Safely", "A practical checklist for assessing listings, sellers, shipping, and payment.", photos.clown],
  ];
  const benefits = [
    ["user", "Verified Sellers", "Trade with sellers whose identity and business information have been verified."],
    ["lock", "Secure Transactions", "Protect your payment and sensitive transaction information."],
    ["quality", "Quality Listings", "Detailed information and photos help buyers make better decisions."],
    ["shield", "Trade Protection", "Support and dispute assistance for eligible transactions."],
  ] as [IconName, string, string][];

  return (
    <div className="min-h-screen bg-white text-[#071D2E]">
      <Header />
      <main>
        <Hero />

        <section id="categories" className="py-24">
          <div className="mx-auto max-w-[1220px] px-5">
            <SectionHeading eyebrow="Browse by type" title="Explore Fish Categories" subtitle="Discover the right stock across popular species and trade categories." action={<a href="#" className="hidden items-center gap-2 text-sm font-extrabold text-[#087f79] md:flex">{t("View all categories")} <Icon name="arrow" className="h-4 w-4" /></a>} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{categories.map(item => <CategoryCard key={item[0]} item={item} />)}</div>
          </div>
        </section>

        <section id="featured" className="bg-[#F4F9FA] py-24">
          <div className="mx-auto max-w-[1220px] px-5">
            <SectionHeading eyebrow="Curated marketplace" title="Featured Fish" subtitle="Quality listings from trusted sellers" action={<Button variant="secondary" className="hidden h-10 md:inline-flex">{t("Browse all listings")}</Button>} />
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{listings.map((item, index) => <ListingCard key={item.name} item={item} index={index} />)}</div>
          </div>
        </section>

        <Stats />

        <section id="sellers" className="py-24">
          <div className="mx-auto max-w-[1220px] px-5">
            <SectionHeading eyebrow="Shop verified stores" title="Trusted Sellers" subtitle="Experienced farms, breeders, and aquatic specialists with proven track records." action={<a href="#" className="hidden items-center gap-2 text-sm font-extrabold text-[#087f79] md:flex">{t("Explore sellers")} <Icon name="arrow" className="h-4 w-4" /></a>} />
            <div className="grid gap-5 md:grid-cols-3">{sellers.map(seller => <SellerCard key={seller.name} seller={seller} />)}</div>
          </div>
        </section>

        <HowItWorks />

        <section className="py-24">
          <div className="mx-auto max-w-[1220px] px-5">
            <SectionHeading eyebrow="Trust at every step" title="Built for Safer Fish Trading" subtitle="The standards, safeguards, and transparency professional aquatic commerce needs." />
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">{benefits.map(([icon, title, text]) => <article key={title} className="rounded-2xl border border-[#DDE7EB] p-6 transition hover:border-[#9DCFD5] hover:shadow-lg"><span className="grid h-12 w-12 place-items-center rounded-xl bg-[#E6F5F5] text-[#087f79]"><Icon name={icon} /></span><h3 className="mt-5 font-extrabold">{t(title)}</h3><p className="mt-3 text-sm leading-6 text-[#617582]">{t(text)}</p></article>)}</div>
          </div>
        </section>

        <Promo />

        <section className="bg-[#F4F9FA] py-24">
          <div className="mx-auto max-w-[1220px] px-5">
            <SectionHeading eyebrow="Community stories" title="What Our Community Says" />
            <div className="grid gap-5 md:grid-cols-3">{reviews.map(([name, role, review, date], i) => <article key={name} className="rounded-2xl border border-[#E0E9EC] bg-white p-7"><div className="flex items-center justify-between"><div className="flex gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#DDEFF1] text-sm font-extrabold text-[#087f79]">{name.split(" ").map(n => n[0]).join("")}</span><div><h3 className="text-sm font-extrabold">{name}</h3><p className="text-xs text-[#78909B]">{t(role)}</p></div></div><span className="text-4xl font-bold leading-none text-[#B8DCDF]">“</span></div><div className="mt-5 flex gap-1">{[1,2,3,4,5].map(star => <Icon key={star} name="star" className="h-3.5 w-3.5 fill-[#F4B740] stroke-[#F4B740]" />)}</div><p className="mt-4 text-sm leading-6 text-[#526A76]">{t(review)}</p><p className="mt-5 text-[11px] text-[#9AAEB6]">{date} · {language === "vi" ? "Giao dịch" : "Trade"} #{16420 + i * 641}</p></article>)}</div>
          </div>
        </section>

        <section className="py-24">
          <div className="mx-auto max-w-[1220px] px-5">
            <SectionHeading eyebrow="Market knowledge" title="Fish Trading Insights" subtitle="Practical guidance and analysis for smarter aquatic trade." />
            <div className="grid gap-6 md:grid-cols-3">{articles.map(([category, title, desc, image]) => <article key={title} className="group"><div className="h-[230px] overflow-hidden rounded-2xl"><img src={image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /></div><p className="mt-5 text-[11px] font-extrabold uppercase tracking-[.15em] text-[#087f79]">{t(category)}</p><h3 className="mt-2 text-xl font-extrabold tracking-[-.02em]">{t(title)}</h3><p className="mt-3 text-sm leading-6 text-[#617582]">{t(desc)}</p><a href="#" className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold text-[#087f79]">{t("Read More")} <Icon name="arrow" className="h-4 w-4" /></a></article>)}</div>
          </div>
        </section>

        <section className="px-5 pb-24">
          <div className="mx-auto flex max-w-[1220px] flex-col items-center justify-between gap-8 rounded-[24px] bg-[#E9F5F5] p-8 md:flex-row md:p-12">
            <div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#087f79]">{t("Weekly market brief")}</p><h2 className="mt-3 text-3xl font-extrabold tracking-[-.035em]">{t("Stay Ahead of the Fish Market")}</h2><p className="mt-3 max-w-[560px] text-sm leading-6 text-[#526A76]">{t("Get new listings, market updates, and fish trading insights delivered to your inbox.")}</p></div>
            <form onSubmit={(e) => { e.preventDefault(); setSubscribed(true); }} className="flex w-full max-w-[450px] flex-col gap-2 sm:flex-row">
              <label className="flex h-12 flex-1 items-center gap-2 rounded-xl border border-[#D1E0E3] bg-white px-4"><Icon name="mail" className="h-4 w-4 text-[#78909B]" /><span className="sr-only">Email address</span><input required type="email" className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder={t("Enter your email address")} /></label>
              <Button type="submit">{t(subscribed ? "Subscribed" : "Subscribe")}</Button>
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

type View = "home" | "auth" | "buyer" | "seller" | "admin" | "account" | "expired" | "notfound";
const TOP = new Set(["", "home", "login", "marketplace", "seller", "admin", "account", "expired"]);
const topOf = (h: string) => h.replace(/^#/, "").split(/[/?]/)[0];

export default function App() {
  const user = useUser();
  const [hash, setHash] = useState(() => window.location.hash);
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem("fishmarket-language") === "vi" ? "vi" : "en");
  const [flashMsg, setFlashMsg] = useState("");
  const [warn, setWarn] = useState(false);

  useEffect(() => {
    const onHash = () => {
      const t = topOf(window.location.hash);
      if (!TOP.has(t) && document.getElementById(t)) return;
      if (t === "" || t === "home") window.scrollTo({ top: 0 });
      setHash(window.location.hash);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const activity = () => touchSession();
    const events = ["mousedown", "keydown", "touchstart", "scroll"] as const;
    events.forEach(e => window.addEventListener(e, activity, { passive: true }));
    const id = setInterval(() => {
      if (sessionExpired()) { endSession(); window.location.hash = "expired"; setWarn(false); return; }
      setWarn(hasSession() && remainingMs() < 60_000);
    }, 5_000);
    return () => { events.forEach(e => window.removeEventListener(e, activity)); clearInterval(id); };
  }, []);

  const top = topOf(hash);
  let view: View = "home";
  let denied: string | null = null;
  if (sessionExpired()) view = "expired";
  else if (top === "login") view = "auth";
  else if (top === "expired") view = "expired";
  else if (top === "" || top === "home") view = "home";
  else if (!TOP.has(top)) view = "notfound";
  else if (!user) view = "auth";
  else if (top === "marketplace") view = "buyer";
  else if (top === "account") view = "account";
  else if (top === "seller") { view = "seller"; if (user.role !== "Seller") denied = "Seller"; }
  else { view = "admin"; if (user.role !== "Admin") denied = "Admin"; }
  const gated = !user && TOP.has(top) && ["marketplace", "seller", "admin", "account"].includes(top);

  useEffect(() => {
    if (gated) { setReturnTo(hash.replace(/^#/, "")); flash("Please sign in to continue."); }
    if (user === null && hasSession()) { endSession(); flash("Your account is no longer active. Contact support."); window.location.hash = "login"; }
  }, [gated, hash, user]);

  useEffect(() => {
    if (view !== "auth") { const m = takeFlash(); if (m) { setFlashMsg(m); const id = setTimeout(() => setFlashMsg(""), 4200); return () => clearTimeout(id); } }
  }, [view, hash]);

  useEffect(() => {
    localStorage.setItem("fishmarket-language", language);
    document.documentElement.lang = view === "home" ? language : "en";
  }, [language, view]);

  let page;
  if (denied && user) page = <AccessDenied user={user} needs={denied} language={language} setLanguage={setLanguage} />;
  else if (view === "home") page = <AppContent />;
  else if (view === "auth") page = <Auth language={language} setLanguage={setLanguage} />;
  else if (view === "expired") page = <SessionExpired language={language} setLanguage={setLanguage} />;
  else if (view === "notfound") page = <NotFound language={language} setLanguage={setLanguage} home={user ? "#" + homeFor(user.role) : "#home"} />;
  else if (!user) page = null;
  else if (view === "seller") page = <Seller user={user} language={language} setLanguage={setLanguage} />;
  else if (view === "admin") page = <Admin user={user} language={language} setLanguage={setLanguage} />;
  else if (view === "account") page = <Account user={user} language={language} setLanguage={setLanguage} />;
  else page = <Buyer user={user} language={language} setLanguage={setLanguage} />;

  return <LanguageContext.Provider value={{ language, setLanguage }}>
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-white text-market-navy" role="status">Loading FISHMARKET...</div>}>{page}</Suspense>
    {flashMsg && <div className="sl-toast" role="status">{flashMsg}</div>}
    {warn && user && <div role="alert" className="sl-card pad" style={{ position: "fixed", bottom: 20, right: 20, zIndex: 90, maxWidth: 340 }}><b>Still there?</b><p style={{ margin: "4px 0 12px", fontSize: 13, color: "var(--muted)" }}>You'll be signed out in less than a minute because of inactivity.</p><button className="sl-btn sl-btn-primary" onClick={() => { touchSession(true); setWarn(false); }}>Stay signed in</button></div>}
  </LanguageContext.Provider>;
}
