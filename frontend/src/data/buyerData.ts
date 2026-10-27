export type Page =
  | "marketplace"
  | "detail"
  | "cart"
  | "checkout"
  | "payment"
  | "confirmation"
  | "tracking"
  | "delivery"
  | "review"
  | "dispute"
  | "orders";
export const photo = (id: string, width = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;
export const pictures = {
  kohaku: photo("photo-1616989161881-6c788f319bd7"),
  koi: photo("photo-1668349009169-93e19d2eba7a"),
  gold: photo("photo-1522069169874-c58ec4b76be5"),
  betta: photo("photo-1578507065211-1c4e99a5fd24"),
  red: photo("photo-1544943910-4c1dc44aab44"),
  ogon: photo("photo-1585936529565-1871537209e3"),
};
export type Fish = {
  id: number;
  apiId?: string;
  code?: string;
  name: string;
  species: string;
  breed: string;
  size: number;
  price: number;
  location: string;
  seller: string;
  rating: number;
  image: string;
  label: string;
  age: string;
  gender: string;
  origin: string;
  description?: string;
  health?: string;
  quantity?: number;
  reviewCount?: number;
  images?: string[];
};
export const money = (n: number) =>
  n.toLocaleString("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  });
export const pageTitles: Record<Page, string> = {
  marketplace: "Marketplace",
  detail: "Fish Details",
  cart: "Your Cart",
  checkout: "Checkout",
  payment: "Secure Payment",
  confirmation: "Order Confirmation",
  tracking: "Track Your Order",
  delivery: "Delivery Confirmation",
  review: "Leave a Review",
  dispute: "Report a Problem",
  orders: "Your Orders",
};
export type Shipping = {
  name: string;
  phone: string;
  address: string;
  city: string;
  province: string;
};
export const emptyShipping: Shipping = {
  name: "",
  phone: "",
  address: "",
  city: "",
  province: "",
};
