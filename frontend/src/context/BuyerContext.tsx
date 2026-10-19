import { useSessionState } from "@/hooks/useSessionState";
import { pageTitles } from "@/data/buyerData";
import type { ReactNode as Node } from "react";
import type { User } from "@/services/demoStore";
import type { Lang } from "@/hooks/useTranslation";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useDomTranslation } from "@/hooks/useTranslation";
import { buyerVi } from "@/data/translations";
import { notify, useStore } from "@/services/demoStore";
import {
  type Fish,
  baseStock,
  pictures,
  type Page,
  type Shipping,
  emptyShipping,
} from "@/data/buyerData";
import { createContext, useContext } from "react";
function useBuyerState({
  user,
  language,
  setLanguage,
}: {
  user: User;
  language: Lang;
  setLanguage: (l: Lang) => void;
}) {
  useDomTranslation(language, buyerVi);
  const store = useStore();
  const stock: Fish[] = [
    ...baseStock,
    ...store.listings
      .filter((l) => l.status === "approved")
      .map((l): Fish => ({
        id: 1000 + Number(l.id.replace(/\D/g, "")),
        name: l.draft.name,
        species: l.draft.species,
        breed: l.draft.breed || l.draft.species,
        size: Number(l.draft.size) || 0,
        price: Number(l.draft.price) || 0,
        location: `${l.draft.region}, Vietnam`,
        seller: l.sellerName,
        rating: 4.8,
        image: l.draft.images[0]?.url ?? pictures.kohaku,
        label: "NEW LISTING",
        age: l.draft.age,
        gender: l.draft.gender,
        origin: l.draft.origin,
      })),
  ];
  const routePage = (): Page => {
    const part = window.location.hash
      .replace(/^#/, "")
      .split("?")[0]
      .split("/")[1];
    return part && Object.prototype.hasOwnProperty.call(pageTitles, part)
      ? (part as Page)
      : "marketplace";
  };
  const [page, setPage] = useState<Page>(routePage);
  const draftKey = (field: string) => `fishmarket-buyer:${user.email}:${field}`;
  useEffect(() => {
    const sync = () => {
      setPage(routePage());
      setErrors({});
      setFiltersOpen(false);
    };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const [selected, setSelected] = useSessionState(
    draftKey("selected"),
    stock[0],
  );
  const [favorites, setFavorites] = useSessionState<number[]>(
    draftKey("favorites"),
    [],
  );
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [species, setSpecies] = useState<string[]>([]);
  const [breed, setBreed] = useState("All breeds");
  const [maxPrice, setMaxPrice] = useState(1500);
  const [size, setSize] = useState("Any size");
  const [location, setLocation] = useState("All locations");
  const [sellerRating, setSellerRating] = useState("Any rating");
  const [available, setAvailable] = useState(true);
  const [sort, setSort] = useState("Recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cart, setCart] = useSessionState<Fish[]>(draftKey("cart"), []);
  const [items, setItems] = useSessionState<Fish[]>(draftKey("items"), [
    stock[0],
  ]);
  const [gallery, setGallery] = useState(0);
  const [modal, setModal] = useState<
    "messages" | "notifications" | "zoom" | "support" | null
  >(null);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const [shipping, setShipping] = useSessionState<Shipping>(
    draftKey("shipping"),
    emptyShipping,
  );
  const [method, setMethod] = useSessionState(draftKey("method"), "Express");
  const [paymentMethod, setPaymentMethod] = useSessionState(
    draftKey("paymentMethod"),
    "Bank Card",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);
  const [paymentState, setPaymentState] = useState<"ready" | "failed" | "paid">(
    "ready",
  );
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [hasOrder, setHasOrder] = useSessionState(draftKey("hasOrder"), false);
  const [delivered, setDelivered] = useSessionState(
    draftKey("delivered"),
    false,
  );
  const [completed, setCompleted] = useSessionState(
    draftKey("completed"),
    false,
  );
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [reviewSent, setReviewSent] = useSessionState(
    draftKey("reviewSent"),
    false,
  );
  const [files, setFiles] = useState<File[]>([]);
  const [disputeSent, setDisputeSent] = useSessionState(
    draftKey("disputeSent"),
    false,
  );
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const processingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shippingPrice = method === "Express" ? 35 : 20;
  const subtotal = items.reduce((sum, fish) => sum + fish.price, 0);
  const fee = Math.round(subtotal * 0.02 * 100) / 100;
  const total = subtotal + shippingPrice + fee;
  const galleryImages = [
    selected.image,
    selected.species === "Koi"
      ? pictures.koi
      : selected.species === "Betta"
        ? pictures.red
        : selected.image,
    selected.species === "Koi" ? pictures.ogon : selected.image,
  ];
  useEffect(
    () => () => {
      if (processingTimer.current) clearTimeout(processingTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    heading.current?.focus();
  }, [page]);
  function go(next: Page) {
    if (processing) return;
    setPage(next);
    window.location.hash =
      next === "marketplace" ? "marketplace" : `marketplace/${next}`;
    setErrors({});
    setFiltersOpen(false);
    window.scrollTo({
      top: 0,
      behavior: "instant",
    });
  }
  function openFish(fish: Fish) {
    setSelected(fish);
    setGallery(0);
    go("detail");
  }
  function favorite(id: number) {
    setFavorites((old) =>
      old.includes(id) ? old.filter((x) => x !== id) : [...old, id],
    );
  }
  function clearFilters() {
    setQuery("");
    setSpecies([]);
    setBreed("All breeds");
    setMaxPrice(1500);
    setSize("Any size");
    setLocation("All locations");
    setSellerRating("Any rating");
    setAvailable(true);
  }
  function beginCheckout(fish: Fish[]) {
    if (hasOrder) {
      setToast(
        "This prototype keeps one order per session. Your current demo order is below.",
      );
      go("orders");
      return;
    }
    setItems(fish);
    go("checkout");
  }
  function checkout(e: FormEvent) {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    Object.entries(shipping).forEach(([key, value]) => {
      if (!value.trim()) nextErrors[key] = "This field is required.";
    });
    if (shipping.phone && !/^\+?[\d\s()-]{7,20}$/.test(shipping.phone))
      nextErrors.phone = "Enter a valid phone number.";
    setErrors(nextErrors);
    if (!Object.keys(nextErrors).length) {
      setPaymentState("ready");
      go("payment");
    }
  }
  function pay(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    const nextErrors: Record<string, string> = {};
    if (paymentMethod === "Bank Card") {
      if (!/^\d{16}$/.test((data.card || "").replace(/\s/g, "")))
        nextErrors.card = "Enter 16 digits. Demo: 4242 4242 4242 4242.";
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(data.expiry || ""))
        nextErrors.expiry = "Use MM/YY, for example 12/30.";
      else {
        const [m, y] = data.expiry.split("/").map(Number);
        if (new Date(2000 + y, m) <= new Date())
          nextErrors.expiry = "This card has expired.";
      }
      if (!/^\d{3,4}$/.test(data.cvc || ""))
        nextErrors.cvc = "Enter 3 or 4 digits.";
      if (!data.holder?.trim())
        nextErrors.holder = "Enter the cardholder name.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setProcessing(true);
    processingTimer.current = setTimeout(() => {
      setProcessing(false);
      if (simulateFailure) {
        setPaymentState("failed");
        setSimulateFailure(false);
      } else {
        setPaymentState("paid");
        setHasOrder(true);
        notify(
          user.email,
          "success",
          "Order confirmed",
          "Your order #FM-10248 is confirmed. Follow its progress in your orders.",
          "#marketplace",
        );
        items.forEach((it) => {
          const l = store.listings.find(
            (x) => 1000 + Number(x.id.replace(/\D/g, "")) === it.id,
          );
          if (l)
            notify(
              l.owner,
              "status",
              "New order received",
              `A buyer ordered "${l.draft.name}" (${l.id}).`,
              "#seller/orders",
            );
        });
        setCart((old) =>
          old.filter((fish) => !items.some((item) => item.id === fish.id)),
        );
        go("confirmation");
      }
    }, 1600);
  }
  const filtered = stock
    .filter(
      (fish) =>
        (!favoritesOnly || favorites.includes(fish.id)) &&
        `${fish.name} ${fish.species} ${fish.breed} ${fish.seller} ${fish.location}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (!species.length || species.includes(fish.species)) &&
        (breed === "All breeds" || fish.breed === breed) &&
        fish.price <= maxPrice &&
        (size === "Any size" ||
          (size === "Under 15 cm" ? fish.size < 15 : fish.size >= 15)) &&
        (location === "All locations" || fish.location.includes(location)) &&
        (sellerRating === "Any rating" || fish.rating >= Number(sellerRating)),
    )
    .sort((a, b) =>
      sort === "Price Low to High"
        ? a.price - b.price
        : sort === "Price High to Low"
          ? b.price - a.price
          : sort === "Newest"
            ? b.id - a.id
            : a.id - b.id,
    );
  const activeFilters =
    species.length +
    Number(breed !== "All breeds") +
    Number(maxPrice < 1500) +
    Number(size !== "Any size") +
    Number(location !== "All locations") +
    Number(sellerRating !== "Any rating");
  return {
    user,
    language,
    setLanguage,
    store,
    stock,
    page,
    setPage,
    selected,
    setSelected,
    favorites,
    setFavorites,
    favoritesOnly,
    setFavoritesOnly,
    query,
    setQuery,
    species,
    setSpecies,
    breed,
    setBreed,
    maxPrice,
    setMaxPrice,
    size,
    setSize,
    location,
    setLocation,
    sellerRating,
    setSellerRating,
    available,
    setAvailable,
    sort,
    setSort,
    filtersOpen,
    setFiltersOpen,
    cart,
    setCart,
    items,
    setItems,
    gallery,
    setGallery,
    modal,
    setModal,
    message,
    setMessage,
    sent,
    setSent,
    toast,
    setToast,
    shipping,
    setShipping,
    method,
    setMethod,
    paymentMethod,
    setPaymentMethod,
    errors,
    setErrors,
    processing,
    setProcessing,
    paymentState,
    setPaymentState,
    simulateFailure,
    setSimulateFailure,
    hasOrder,
    setHasOrder,
    delivered,
    setDelivered,
    completed,
    setCompleted,
    rating,
    setRating,
    review,
    setReview,
    reviewSent,
    setReviewSent,
    files,
    setFiles,
    disputeSent,
    setDisputeSent,
    reason,
    setReason,
    problem,
    setProblem,
    heading,
    dialog,
    processingTimer,
    shippingPrice,
    subtotal,
    fee,
    total,
    galleryImages,
    go,
    openFish,
    favorite,
    clearFilters,
    beginCheckout,
    checkout,
    pay,
    filtered,
    activeFilters,
  };
}
type BuyerState = ReturnType<typeof useBuyerState>;
const BuyerContext = createContext<BuyerState | null>(null);
export function BuyerProvider({
  children,
  ...props
}: Parameters<typeof useBuyerState>[0] & {
  children: Node;
}) {
  const value = useBuyerState(props);
  return (
    <BuyerContext.Provider value={value}>{children}</BuyerContext.Provider>
  );
}
export function useBuyer() {
  const state = useContext(BuyerContext);
  if (!state) throw new Error("BuyerProvider is required");
  return state;
}
