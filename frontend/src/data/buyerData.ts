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
};
export const baseStock: Fish[] = [
  {
    id: 1,
    name: "Premium Kohaku Koi",
    species: "Koi",
    breed: "Kohaku",
    size: 45,
    price: 850,
    location: "Long An, Vietnam",
    seller: "Golden Koi Farm",
    rating: 4.9,
    image: pictures.kohaku,
    label: "SELECT GRADE",
    age: "18 months",
    gender: "Female",
    origin: "Japan",
  },
  {
    id: 2,
    name: "Galaxy Halfmoon Betta",
    species: "Betta",
    breed: "Halfmoon",
    size: 7,
    price: 120,
    location: "Bangkok, Thailand",
    seller: "Siam Betta House",
    rating: 4.9,
    image: pictures.betta,
    label: "BREEDER'S PICK",
    age: "6 months",
    gender: "Male",
    origin: "Thailand",
  },
  {
    id: 3,
    name: "Japanese Sanke Koi",
    species: "Koi",
    breed: "Sanke",
    size: 38,
    price: 620,
    location: "Ho Chi Minh City, Vietnam",
    seller: "Nishikigoi Collective",
    rating: 4.8,
    image: pictures.koi,
    label: "JAPAN IMPORT",
    age: "12 months",
    gender: "Female",
    origin: "Japan",
  },
  {
    id: 4,
    name: "Red Veiltail Betta",
    species: "Betta",
    breed: "Veiltail",
    size: 6,
    price: 65,
    location: "Bangkok, Thailand",
    seller: "Siam Betta House",
    rating: 4.9,
    image: pictures.red,
    label: "IN STOCK",
    age: "5 months",
    gender: "Male",
    origin: "Thailand",
  },
  {
    id: 5,
    name: "Platinum Ogon Koi",
    species: "Koi",
    breed: "Ogon",
    size: 32,
    price: 480,
    location: "Long An, Vietnam",
    seller: "Golden Koi Farm",
    rating: 4.9,
    image: pictures.ogon,
    label: "FARM RAISED",
    age: "10 months",
    gender: "Male",
    origin: "Japan",
  },
  {
    id: 6,
    name: "Pearl White Goldfish",
    species: "Goldfish",
    breed: "Fantail",
    size: 12,
    price: 95,
    location: "Da Nang, Vietnam",
    seller: "Pearl River Aquatics",
    rating: 4.7,
    image: pictures.gold,
    label: "NEW ARRIVAL",
    age: "8 months",
    gender: "Female",
    origin: "Vietnam",
  },
];
export const money = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: n % 1 ? 2 : 0,
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
