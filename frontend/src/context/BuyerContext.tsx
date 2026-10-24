import { refreshSales, useSales } from "@/services/commerceStore";
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
  type Page,
  type Shipping,
  emptyShipping,
} from "@/data/buyerData";
import { domainApi } from "@/services/api";
import { createContext, useContext } from "react";

function listingToFish(item: any): Fish {
  return {
    id: Number(String(item.id).replace(/\D/g, "")),
    apiId: item.id,
    code: item.id,
    name: item.name,
    species: item.species,
    breed: item.breed || item.species,
    size: Number(item.size) || 0,
    price: Number(item.price) || 0,
    location: item.location ?? "",
    seller: item.seller,
    rating: Number(item.rating) || 0,
    image: item.image ?? "",
    label: item.saleMode === "pre_order" ? "PRE-ORDER" : "IN STOCK",
    age: item.age ? `${item.age} months` : "",
    gender: item.gender ?? "",
    origin: item.origin ?? "",
    description: item.description ?? "",
    health: item.health ?? "",
    quantity: Number(item.quantity) || 0,
    reviewCount: Number(item.reviewCount) || 0,
    images: (item.images ?? []).map((image: any) => image.url),
  };
}

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
  const sales = useSales();
  const emptyFish: Fish = {
    id: 0,
    name: "",
    species: "",
    breed: "",
    size: 0,
    price: 0,
    location: "",
    seller: "",
    rating: 0,
    image: "",
    label: "",
    age: "",
    gender: "",
    origin: "",
    images: [],
  };
  const [stock, setStock] = useState<Fish[]>([]);
  async function refreshMarketplace() {
    const { items: listings } = await domainApi.listings();
    setStock(listings.map(listingToFish));
  }
  useEffect(() => {
    void refreshMarketplace().catch(() =>
      setToast("Unable to load marketplace data."),
    );
  }, []);
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
    emptyFish,
  );
  useEffect(() => {
    const apply = () => {
      const code = new URLSearchParams(
        window.location.hash.split("?")[1] ?? "",
      ).get("fish");
      const fish = stock.find((item) => item.apiId === code);
      if (fish) {
        setSelected(fish);
        setGallery(0);
      }
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [stock]);
  const [favorites, setFavorites] = useSessionState<number[]>(
    draftKey("favorites"),
    [],
  );
  useEffect(() => {
    if (!stock.length) return;
    setSelected((current) => (current.id ? current : stock[0]));
    void domainApi
      .favorites()
      .then((items) =>
        setFavorites(
          items.map((item: any) => Number(String(item.id).replace(/\D/g, ""))),
        ),
      )
      .catch(() => undefined);
    void domainApi
      .cart()
      .then((rows) =>
        setCart(
          rows
            .map((row: any) =>
              stock.find((fish) => fish.apiId === row.listing.code),
            )
            .filter(Boolean) as Fish[],
        ),
      )
      .catch(() => undefined);
  }, [stock.length]);
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
  const [items, setItems] = useSessionState<Fish[]>(draftKey("items"), []);
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
  const [purchaseId, setPurchaseId] = useSessionState(
    draftKey("purchaseId"),
    "",
  );
  const currentPurchase = sales.find(
    (order) => order.id === purchaseId && order.owner === user.email,
  );
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
  const galleryImages = selected.images?.length
    ? selected.images
    : selected.image
      ? [selected.image]
      : [];
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
    const fish = stock.find((item) => item.id === id);
    if (fish?.apiId)
      void (
        favorites.includes(id)
          ? domainApi.removeFavorite(fish.apiId)
          : domainApi.addFavorite(fish.apiId)
      ).catch(() => setToast("Could not update favorite."));
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
    setPurchaseId("");
    setHasOrder(false);
    setDelivered(false);
    setCompleted(false);
    setReviewSent(false);
    setDisputeSent(false);
    setItems(fish);
    go("checkout");
  }
  async function addToCart(fish: Fish) {
    if (!fish.apiId) {
      setToast("This fish is currently unavailable.");
      return;
    }
    try {
      await domainApi.putCart(fish.apiId, 1);
      setCart((old) =>
        old.some((item) => item.id === fish.id) ? old : [...old, fish],
      );
      setToast(`${fish.name} added to your cart.`);
    } catch {
      setToast("Could not add this fish. It may have just been sold.");
      await refreshMarketplace().catch(() => undefined);
    }
  }
  async function removeFromCart(fish: Fish) {
    try {
      if (fish.apiId) await domainApi.removeCart(fish.apiId);
      setCart((old) => old.filter((item) => item.id !== fish.id));
    } catch {
      setToast("Could not remove this fish from your cart.");
    }
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
  async function pay(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    const nextErrors: Record<string, string> = {};
    if (paymentMethod === "Bank Card") {
      if (!/^\d{16}$/.test((data.card || "").replace(/\s/g, "")))
        nextErrors.card = "Enter a valid 16-digit card number.";
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
    try {
      for (const item of items)
        if (item.apiId) await domainApi.putCart(item.apiId, 1);
      const order = await domainApi.createOrder({
        listingCodes: items
          .map((item) => item.apiId)
          .filter((code): code is string => Boolean(code)),
        recipientName: shipping.name,
        phone: shipping.phone,
        address: shipping.address,
        city: shipping.city,
        province: shipping.province,
        deliveryMethod: method,
        shippingFee: shippingPrice,
      });
      const payment = await domainApi.payOrder(order.code, {
        method:
          paymentMethod === "Bank Card"
            ? "bank_card"
            : paymentMethod === "E-Wallet"
              ? "e_wallet"
              : "bank_transfer",
        idempotencyKey: `${order.id}-initial`,
      });
      if (payment.state === "failed") {
        setPaymentState("failed");
      } else {
        setPaymentState("paid");
        setHasOrder(true);
        setPurchaseId(order.code);
        await Promise.all([refreshSales(), refreshMarketplace()]);
        notify(
          user.email,
          "success",
          "Order confirmed",
          `Your order ${order.code} is confirmed. Follow its progress in your orders.`,
          "#marketplace",
        );
        setCart((old) =>
          old.filter((fish) => !items.some((item) => item.id === fish.id)),
        );
        go("confirmation");
      }
    } catch {
      setPaymentState("failed");
      setErrors({
        payment: "Payment could not be completed. Please try again.",
      });
    } finally {
      setProcessing(false);
    }
  }
  function viewPurchase(id: string) {
    const order = sales.find(
      (item) => item.id === id && item.owner === user.email,
    );
    if (!order) return;
    setPurchaseId(order.id);
    setShipping(order.shipping);
    setHasOrder(true);
    setItems(
      order.items.map(
        (item) =>
          stock.find((fish) => fish.id === item.id) ?? { ...stock[0], ...item },
      ),
    );
    setDelivered(["delivered", "completed"].includes(order.status));
    setCompleted(order.status === "completed");
    go("tracking");
  }
  async function submitReview() {
    if (!purchaseId) return;
    await domainApi.reviewOrder(purchaseId, { rating, text: review });
    setReviewSent(true);
  }
  async function submitDispute() {
    if (!purchaseId) return;
    const uploaded = await Promise.all(
      files.map((file) => domainApi.uploadImage(file, "dispute_attachment")),
    );
    await domainApi.disputeOrder(purchaseId, {
      reason,
      description: problem,
      attachments: uploaded.map((item) => item.url),
    });
    setDisputeSent(true);
  }
  async function confirmDelivery() {
    if (!purchaseId) return;
    await domainApi.confirmDelivery(purchaseId);
    setDelivered(true);
    setCompleted(true);
  }
  async function sendSellerMessage(text: string) {
    if (!selected.apiId) return;
    const conversation = await domainApi.startConversation(selected.apiId);
    await domainApi.sendMessage(conversation.id, text);
    setSent((old) => [...old, text]);
  }
  useEffect(() => {
    if (currentPurchase) {
      setDelivered(["delivered", "completed"].includes(currentPurchase.status));
      setCompleted(currentPurchase.status === "completed");
    }
  }, [currentPurchase?.status]);
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
    hasOrder,
    setHasOrder,
    sales,
    currentPurchase,
    purchaseId,
    viewPurchase,
    delivered,
    setDelivered,
    completed,
    setCompleted,
    confirmDelivery,
    rating,
    setRating,
    review,
    setReview,
    reviewSent,
    setReviewSent,
    submitReview,
    files,
    setFiles,
    disputeSent,
    setDisputeSent,
    submitDispute,
    sendSellerMessage,
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
    addToCart,
    removeFromCart,
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
