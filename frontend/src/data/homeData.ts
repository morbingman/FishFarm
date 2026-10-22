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
export const categories = [
  ["Ornamental Fish", "2,840 listings", photos.blue],
  ["Freshwater Fish", "1,960 listings", photos.koi],
  ["Saltwater Fish", "1,420 listings", photos.clown],
  ["Koi Fish", "1,180 listings", photos.koiSchool],
  ["Betta Fish", "980 listings", photos.yellow],
  ["Goldfish", "760 listings", photos.goldfish],
  ["Tropical Fish", "1,640 listings", photos.coral],
  ["Farmed Fish", "1,220 listings", photos.school],
];
export const listings = [
  {
    name: "Premium Kohaku Koi",
    species: "Nishikigoi · Grade A",
    detail: "45 cm · Japan",
    location: "Long An, VN",
    seller: "Golden Koi Farm",
    rating: "4.9",
    price: "$850",
    image: photos.koi,
  },
  {
    name: "Galaxy Betta",
    species: "Betta splendens",
    detail: "Male · 6 months",
    location: "Bangkok, TH",
    seller: "Betta House",
    rating: "4.9",
    price: "$120",
    image: photos.blue,
  },
  {
    name: "Blue Arowana",
    species: "Scleropages formosus",
    detail: "30 cm · Farm Raised",
    location: "Singapore",
    seller: "Ocean Blue Aquatics",
    rating: "4.8",
    price: "$1,200",
    image: photos.yellow,
  },
  {
    name: "Redtail Catfish",
    species: "Phractocephalus",
    detail: "25 cm · Vietnam",
    location: "Ho Chi Minh City",
    seller: "Mekong Aquatics",
    rating: "4.7",
    price: "$350",
    image: photos.coral,
  },
];
export const sellers = [
  {
    name: "Ocean Blue Aquatics",
    location: "Ho Chi Minh City",
    rating: "4.9",
    listings: "128 Listings",
    image: photos.blue,
    specialty: "Rare freshwater",
  },
  {
    name: "Golden Koi Farm",
    location: "Long An",
    rating: "4.8",
    listings: "86 Listings",
    image: photos.koiSchool,
    specialty: "Premium koi",
  },
  {
    name: "Premium Betta House",
    location: "Ho Chi Minh City",
    rating: "4.9",
    listings: "214 Listings",
    image: photos.yellow,
    specialty: "Show-grade betta",
  },
];
