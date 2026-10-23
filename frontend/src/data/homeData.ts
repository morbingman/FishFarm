export const photos = {
  hero: "https://images.unsplash.com/photo-1668349009169-93e19d2eba7a?auto=format&fit=crop&w=1800&q=88",
  blue: "https://images.unsplash.com/photo-1522720833375-9c27ffb02a5e?auto=format&fit=crop&w=900&q=82",
  clown:
    "https://images.unsplash.com/photo-1706114350113-3063f27619c7?auto=format&fit=crop&w=900&q=82",
  coral:
    "https://images.unsplash.com/photo-1572438131134-ec29490abfba?auto=format&fit=crop&w=900&q=82",
  yellow:
    "https://images.unsplash.com/photo-1516408388733-2f8364f2e00b?auto=format&fit=crop&w=900&q=82",
  koi: "https://images.unsplash.com/photo-1640529837996-b81a91eaf7a5?auto=format&fit=crop&w=900&q=84",
  koiSchool:
    "https://images.unsplash.com/photo-1692765109385-426f4a3a8e47?auto=format&fit=crop&w=900&q=84",
  goldfish:
    "https://images.unsplash.com/photo-1663892318998-d4b1a5acde66?auto=format&fit=crop&w=900&q=84",
  school:
    "https://images.unsplash.com/photo-1669048014031-e3664a627ab4?auto=format&fit=crop&w=900&q=82",
  farm: "https://images.unsplash.com/photo-1717468394948-fbd4eb0afc16?auto=format&fit=crop&w=1200&q=82",
};
export type HomeCategory = {
  name: string;
  count: number;
  image: string | null;
};

export type HomeListing = {
  id: string;
  name: string;
  species: string;
  breed: string;
  size: number | null;
  age: number | null;
  gender: string | null;
  origin: string | null;
  price: number;
  location: string | null;
  seller: string;
  rating: number;
  image: string | null;
};

export type HomeSeller = {
  id: string;
  name: string;
  location: string;
  count: number;
  image: string | null;
  specialty: string;
  rating: number;
};

export type HomeData = {
  categories: HomeCategory[];
  featured: HomeListing[];
  sellers: HomeSeller[];
  stats: {
    activeListings: number;
    verifiedSellers: number;
    successfulTrades: number;
    satisfiedPercent: number;
  };
  reviews: {
    id: string;
    buyerName: string;
    rating: number;
    text: string;
    orderCode: string;
    createdAt: string;
  }[];
};
