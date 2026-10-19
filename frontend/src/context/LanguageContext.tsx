import { createContext, useContext } from "react";
export type Language = "en" | "vi";
export const vi: Record<string, string> = {
  Home: "Trang chủ",
  Marketplace: "Chợ cá",
  Categories: "Danh mục",
  Sellers: "Người bán",
  "How It Works": "Cách hoạt động",
  "About Us": "Về chúng tôi",
  "Sign In": "Đăng nhập",
  Dashboard: "Bảng điều khiển",
  "Sell Your Fish": "Đăng bán cá",
  "The trusted marketplace for aquatic trade":
    "Sàn giao dịch thủy sản đáng tin cậy",
  "Buy. Sell.": "Mua. Bán.",
  "Trade. Fish.": "Giao dịch cá.",
  "Discover quality fish from trusted breeders, farms, and sellers. Compare prices, verify sellers, and trade with confidence.":
    "Khám phá cá chất lượng từ các trại giống, trang trại và người bán uy tín. So sánh giá, xác minh người bán và giao dịch an tâm.",
  "Explore Marketplace": "Khám phá chợ cá",
  "Start Selling": "Bắt đầu bán",
  "10,000+ Fish Listed": "10.000+ cá đang bán",
  "2,500+ Verified Sellers": "2.500+ người bán xác minh",
  "Secure Transactions": "Giao dịch an toàn",
  "Buyer Protection": "Bảo vệ người mua",
  "Included on eligible trades": "Áp dụng cho giao dịch đủ điều kiện",
  "Search fish, species, breed, or seller...":
    "Tìm cá, loài, giống hoặc người bán...",
  Species: "Loài",
  Location: "Khu vực",
  "Price Range": "Khoảng giá",
  "All Species": "Tất cả loài",
  "All Location": "Tất cả khu vực",
  "All Price Range": "Tất cả mức giá",
  Search: "Tìm kiếm",
  Results: "Kết quả",
  "Browse by type": "Khám phá theo loại",
  "Explore Fish Categories": "Khám phá danh mục cá",
  "Discover the right stock across popular species and trade categories.":
    "Tìm nguồn cá phù hợp trong các loài và danh mục giao dịch phổ biến.",
  "View all categories": "Xem tất cả danh mục",
  "Ornamental Fish": "Cá cảnh",
  "Freshwater Fish": "Cá nước ngọt",
  "Saltwater Fish": "Cá nước mặn",
  "Koi Fish": "Cá Koi",
  "Betta Fish": "Cá Betta",
  Goldfish: "Cá vàng",
  "Tropical Fish": "Cá nhiệt đới",
  "Farmed Fish": "Cá nuôi thương phẩm",
  listings: "tin đăng",
  "Curated marketplace": "Tuyển chọn từ chợ cá",
  "Featured Fish": "Cá nổi bật",
  "Quality listings from trusted sellers":
    "Tin đăng chất lượng từ người bán uy tín",
  "Browse all listings": "Xem tất cả tin đăng",
  "Verified Seller": "Người bán xác minh",
  From: "Từ",
  "View Details": "Xem chi tiết",
  Favorite: "Yêu thích",
  "Male · 6 months": "Cá đực · 6 tháng",
  "30 cm · Farm Raised": "30 cm · Nuôi tại trại",
  "25 cm · Vietnam": "25 cm · Việt Nam",
  "Active Listings": "Tin đang hoạt động",
  "Verified Sellers": "Người bán xác minh",
  "Successful Trades": "Giao dịch thành công",
  "Satisfied Buyers": "Người mua hài lòng",
  "Shop verified stores": "Mua từ cửa hàng xác minh",
  "Trusted Sellers": "Người bán uy tín",
  "Experienced farms, breeders, and aquatic specialists with proven track records.":
    "Các trang trại, nhà lai tạo và chuyên gia thủy sinh giàu kinh nghiệm với hồ sơ minh bạch.",
  "Explore sellers": "Khám phá người bán",
  "Rare freshwater": "Cá nước ngọt quý hiếm",
  "Premium koi": "Koi cao cấp",
  "Show-grade betta": "Betta chuẩn thi đấu",
  Listings: "Tin đăng",
  "View Store": "Xem cửa hàng",
  "Simple. Secure. Transparent.": "Đơn giản. An toàn. Minh bạch.",
  "Trade With Confidence": "Giao dịch đầy tự tin",
  "A clear process designed to protect buyers and help trusted sellers grow.":
    "Quy trình rõ ràng giúp bảo vệ người mua và đồng hành cùng người bán uy tín.",
  "Find Your Fish": "Tìm cá phù hợp",
  "Search thousands of listings and find the fish that matches your needs.":
    "Tìm kiếm trong hàng nghìn tin đăng để chọn đúng loại cá bạn cần.",
  "Check the Seller": "Kiểm tra người bán",
  "Review ratings, verification, location, and previous transactions.":
    "Xem đánh giá, trạng thái xác minh, vị trí và lịch sử giao dịch.",
  "Make a Deal": "Thực hiện giao dịch",
  "Contact the seller or place an order securely through the platform.":
    "Liên hệ người bán hoặc đặt hàng an toàn ngay trên nền tảng.",
  "Receive Your Fish": "Nhận cá",
  "Complete the transaction and receive your fish safely.":
    "Hoàn tất giao dịch và nhận cá an toàn.",
  "Trust at every step": "An tâm trong từng bước",
  "Built for Safer Fish Trading": "Xây dựng cho giao dịch cá an toàn hơn",
  "The standards, safeguards, and transparency professional aquatic commerce needs.":
    "Tiêu chuẩn, cơ chế bảo vệ và tính minh bạch mà thương mại thủy sản chuyên nghiệp cần có.",
  "Trade with sellers whose identity and business information have been verified.":
    "Giao dịch với người bán đã được xác minh danh tính và thông tin kinh doanh.",
  "Protect your payment and sensitive transaction information.":
    "Bảo vệ thanh toán và thông tin giao dịch nhạy cảm của bạn.",
  "Quality Listings": "Tin đăng chất lượng",
  "Detailed information and photos help buyers make better decisions.":
    "Thông tin và hình ảnh chi tiết giúp người mua đưa ra quyết định tốt hơn.",
  "Trade Protection": "Bảo vệ giao dịch",
  "Support and dispute assistance for eligible transactions.":
    "Hỗ trợ và xử lý tranh chấp cho các giao dịch đủ điều kiện.",
  "Grow your aquatic business": "Phát triển kinh doanh thủy sản",
  "Have Fish to Sell?": "Bạn có cá cần bán?",
  "Reach thousands of potential buyers and grow your fish business with our trusted marketplace.":
    "Tiếp cận hàng nghìn khách hàng tiềm năng và phát triển kinh doanh trên sàn giao dịch uy tín.",
  "Free to create a seller account": "Miễn phí tạo tài khoản người bán",
  "Community stories": "Câu chuyện cộng đồng",
  "What Our Community Says": "Cộng đồng nói gì",
  "Verified Buyer": "Người mua xác minh",
  "Aquatic Retailer": "Nhà bán lẻ thủy sinh",
  "The seller verification and detailed listing gave me the confidence to purchase a high-value koi online.":
    "Xác minh người bán và tin đăng chi tiết giúp tôi tự tin mua một chú koi giá trị cao trực tuyến.",
  "We have found three reliable farm partners through Fishmarket. It has changed how we source stock.":
    "Chúng tôi đã tìm được ba đối tác trang trại đáng tin cậy qua Fishmarket. Nền tảng đã thay đổi cách chúng tôi tìm nguồn hàng.",
  "The enquiries are serious and the tools make managing my listings remarkably straightforward.":
    "Khách hỏi mua rất nghiêm túc và các công cụ giúp tôi quản lý tin đăng cực kỳ dễ dàng.",
  "Market knowledge": "Kiến thức thị trường",
  "Fish Trading Insights": "Kiến thức giao dịch cá",
  "Practical guidance and analysis for smarter aquatic trade.":
    "Hướng dẫn thực tế và phân tích để giao dịch thủy sản thông minh hơn.",
  "Buyer Guide": "Hướng dẫn người mua",
  "How to Choose a Healthy Ornamental Fish": "Cách chọn cá cảnh khỏe mạnh",
  "Key signs of health, vitality, and responsible breeding to look for before you buy.":
    "Những dấu hiệu quan trọng về sức khỏe, sức sống và quy trình lai tạo cần xem trước khi mua.",
  "Market Report": "Báo cáo thị trường",
  "Understanding Fish Market Prices": "Hiểu về giá cá trên thị trường",
  "Learn what drives pricing across species, grades, sizes, origins, and seasons.":
    "Tìm hiểu các yếu tố ảnh hưởng đến giá theo loài, phẩm cấp, kích thước, nguồn gốc và mùa vụ.",
  Safety: "An toàn",
  "Guide to Buying Fish Online Safely": "Hướng dẫn mua cá trực tuyến an toàn",
  "A practical checklist for assessing listings, sellers, shipping, and payment.":
    "Danh sách kiểm tra thực tế để đánh giá tin đăng, người bán, vận chuyển và thanh toán.",
  "Read More": "Đọc thêm",
  "Weekly market brief": "Bản tin thị trường hằng tuần",
  "Stay Ahead of the Fish Market": "Luôn dẫn đầu thị trường cá",
  "Get new listings, market updates, and fish trading insights delivered to your inbox.":
    "Nhận tin đăng mới, cập nhật thị trường và kiến thức giao dịch cá qua email.",
  "Enter your email address": "Nhập địa chỉ email",
  Subscribe: "Đăng ký",
  Subscribed: "Đã đăng ký",
  "Your trusted marketplace for buying, selling, and trading quality fish.":
    "Sàn giao dịch đáng tin cậy để mua, bán và trao đổi cá chất lượng.",
  "Browse Fish": "Khám phá cá",
  "Featured Listings": "Tin đăng nổi bật",
  "For Sellers": "Dành cho người bán",
  "Seller Dashboard": "Trang quản lý người bán",
  "Seller Guidelines": "Hướng dẫn người bán",
  "Transaction Fees": "Phí giao dịch",
  Support: "Hỗ trợ",
  "Help Center": "Trung tâm trợ giúp",
  "Contact Us": "Liên hệ",
  "Safety & Security": "An toàn & bảo mật",
  "Terms & Conditions": "Điều khoản & điều kiện",
  "Privacy Policy": "Chính sách bảo mật",
  "All rights reserved.": "Bảo lưu mọi quyền.",
  "Built for safer, smarter aquatic trade.":
    "Vì giao dịch thủy sản an toàn và thông minh hơn.",
};
export const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
}>({
  language: "en",
  setLanguage: () => undefined,
});
export function useTranslation() {
  const { language, setLanguage } = useContext(LanguageContext);
  const t = (text: string) => (language === "vi" ? vi[text] || text : text);
  return {
    language,
    setLanguage,
    t,
  };
}
