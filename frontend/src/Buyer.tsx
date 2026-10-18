import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import "./buyer.css"
import { useDomTranslation, type Lang } from "./i18n"
import { buyerVi } from "./i18n-vi"
import { SiteHeader } from "./SiteHeader"
import { notify, useStore, type User } from "./store"

type Page = "marketplace" | "detail" | "cart" | "checkout" | "payment" | "confirmation" | "tracking" | "delivery" | "review" | "dispute" | "orders"
type GlyphName = "fish" | "search" | "chevron" | "arrow" | "heart" | "bag" | "message" | "bell" | "shield" | "check" | "pin" | "filter" | "close" | "truck" | "lock" | "star" | "plus" | "zoom" | "upload" | "card" | "box" | "store"
function Glyph({
  name,
  className = "",
}: {
  name: GlyphName
  className?: string
}) {
  const paths: Record<GlyphName, ReactNode> = {
    fish: (
      <>
        <path d="M4 12s4-6 10-6c4 0 7 6 7 6s-3 6-7 6c-6 0-10-6-10-6Zm0 0L1 7v10l3-5Z" />
        <circle cx="16" cy="10" r="1" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    chevron: <path d="m9 5 7 7-7 7" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    heart: (
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8Z" />
    ),
    bag: (
      <>
        <path d="M5 7h14l2 14H3L5 7Z" />
        <path d="M8 8V6a4 4 0 0 1 8 0v2" />
      </>
    ),
    message: (
      <>
        <path d="M21 14a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
        <path d="M8 8h8M8 12h5" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    pin: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    filter: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="2" fill="currentColor" />
        <circle cx="15" cy="17" r="2" fill="currentColor" />
      </>
    ),
    close: <path d="m5 5 14 14M19 5 5 19" />,
    truck: (
      <>
        <path d="M2 5h12v12H2zm12 5h4l4 4v3h-8" />
        <circle cx="6" cy="19" r="2" />
        <circle cx="18" cy="19" r="2" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
      </>
    ),
    star: (
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    zoom: (
      <>
        <circle cx="10" cy="10" r="7" />
        <path d="m15 15 6 6M7 10h6m-3-3v6" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6" />
      </>
    ),
    card: (
      <>
        <rect x="2" y="4" width="20" height="16" rx="3" />
        <path d="M2 9h20M6 15h4" />
      </>
    ),
    box: (
      <>
        <path d="m12 2 9 5-9 5-9-5 9-5Zm-9 5v10l9 5 9-5V7M12 12v10M7 4.5l10 5" />
      </>
    ),
    store: <path d="M4 10v10h16V10M3 4h18l-2 6H5L3 4Zm6 16v-6h6v6" />,
  }
  return (
    <svg
      className={`buy-icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
const photo = (id: string, width = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`
const pictures = {
  kohaku: photo("photo-1616989161881-6c788f319bd7"),
  koi: photo("photo-1668349009169-93e19d2eba7a"),
  gold: photo("photo-1522069169874-c58ec4b76be5"),
  betta: photo("photo-1578507065211-1c4e99a5fd24"),
  red: photo("photo-1544943910-4c1dc44aab44"),
  ogon: photo("photo-1585936529565-1871537209e3"),
}
type Fish = {
  id: number
  name: string
  species: string
  breed: string
  size: number
  price: number
  location: string
  seller: string
  rating: number
  image: string
  label: string
  age: string
  gender: string
  origin: string
}
const baseStock: Fish[] = [
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
]
const money = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: n % 1 ? 2 : 0,
  })
function BuyButton({
  children,
  onClick,
  secondary = false,
  disabled = false,
  type = "button",
  className = "",
}: {
  children: ReactNode
  onClick?: () => void
  secondary?: boolean
  disabled?: boolean
  type?: "button" | "submit"
  className?: string
}) {
  return (
    <button
      type={type}
      className={`buy-button ${secondary ? "is-secondary" : ""} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
function Verified() {
  return (
    <span className="buy-verified">
      <Glyph name="shield" /> Verified Seller
    </span>
  )
}
function Rating({ value }: { value: number }) {
  return (
    <span className="buy-rating">
      <Glyph name="star" />
      {value.toFixed(1)}
    </span>
  )
}
function TrustRow() {
  return (
    <div className="buy-trust-row">
      <span>
        <Glyph name="shield" />
        Verified sellers
      </span>
      <span>
        <Glyph name="lock" />
        Secure transactions
      </span>
      <span>
        <Glyph name="check" />
        Buyer protection
      </span>
    </div>
  )
}
const pageTitles: Record<Page, string> = {
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
}
type Shipping = {
  name: string
  phone: string
  address: string
  city: string
  province: string
}
const emptyShipping: Shipping = {
  name: "",
  phone: "",
  address: "",
  city: "",
  province: "",
}

export default function Buyer({ user, language, setLanguage }: { user: User; language: Lang; setLanguage: (l: Lang) => void }) {
  useDomTranslation(language, buyerVi)
  const store = useStore()
  const stock: Fish[] = [
    ...baseStock,
    ...store.listings
      .filter((l) => l.status === "approved")
      .map((l): Fish => ({
        id: 1000 + Number(l.id.replace(/\D/g, "")),
        name: l.draft.name, species: l.draft.species, breed: l.draft.breed || l.draft.species,
        size: Number(l.draft.size) || 0, price: Number(l.draft.price) || 0, location: `${l.draft.region}, Vietnam`,
        seller: l.sellerName, rating: 4.8, image: l.draft.images[0]?.url ?? pictures.kohaku, label: "NEW LISTING",
        age: l.draft.age, gender: l.draft.gender, origin: l.draft.origin,
      })),
  ]
  const [page, setPage] = useState<Page>("marketplace")
  const [selected, setSelected] = useState(stock[0])
  const [favorites, setFavorites] = useState<number[]>([])
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [query, setQuery] = useState("")
  const [species, setSpecies] = useState<string[]>([])
  const [breed, setBreed] = useState("All breeds")
  const [maxPrice, setMaxPrice] = useState(1500)
  const [size, setSize] = useState("Any size")
  const [location, setLocation] = useState("All locations")
  const [sellerRating, setSellerRating] = useState("Any rating")
  const [available, setAvailable] = useState(true)
  const [sort, setSort] = useState("Recommended")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [cart, setCart] = useState<Fish[]>([])
  const [items, setItems] = useState<Fish[]>([stock[0]])
  const [gallery, setGallery] = useState(0)
  const [modal, setModal] =
    useState<"messages" | "notifications" | "zoom" | "support" | null>(null)
  const [message, setMessage] = useState("")
  const [sent, setSent] = useState<string[]>([])
  const [toast, setToast] = useState("")
  const [shipping, setShipping] = useState<Shipping>(emptyShipping)
  const [method, setMethod] = useState("Express")
  const [paymentMethod, setPaymentMethod] = useState("Bank Card")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState(false)
  const [paymentState, setPaymentState] = useState<"ready" | "failed" | "paid">(
    "ready",
  )
  const [simulateFailure, setSimulateFailure] = useState(false)
  const [hasOrder, setHasOrder] = useState(false)
  const [delivered, setDelivered] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [rating, setRating] = useState(0)
  const [review, setReview] = useState("")
  const [reviewSent, setReviewSent] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [disputeSent, setDisputeSent] = useState(false)
  const [reason, setReason] = useState("")
  const [problem, setProblem] = useState("")
  const heading = useRef<HTMLHeadingElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const processingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shippingPrice = method === "Express" ? 35 : 20
  const subtotal = items.reduce((sum, fish) => sum + fish.price, 0)
  const fee = Math.round(subtotal * 0.02 * 100) / 100
  const total = subtotal + shippingPrice + fee
  const galleryImages = [
    selected.image,
    selected.species === "Koi"
      ? pictures.koi
      : selected.species === "Betta"
        ? pictures.red
        : selected.image,
    selected.species === "Koi" ? pictures.ogon : selected.image,
  ]

  useEffect(
    () => () => {
      if (processingTimer.current) clearTimeout(processingTimer.current)
    },
    [],
  )
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(""), 3500)
    return () => clearTimeout(t)
  }, [toast])
  useEffect(() => {
    heading.current?.focus()
  }, [page])
  useEffect(() => {
    if (!modal) return
    const previous = document.activeElement as HTMLElement
    const controls = () =>
      Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          "button, input, textarea, a[href]",
        ) || [],
      )
    controls()[0]?.focus()
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") setModal(null)
      if (e.key === "Tab") {
        const list = controls()
        const first = list[0]
        const last = list[list.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener("keydown", handle)
    return () => {
      document.removeEventListener("keydown", handle)
      previous?.focus()
    }
  }, [modal])
  function go(next: Page) {
    if (processing) return
    setPage(next)
    setErrors({})
    setFiltersOpen(false)
    window.scrollTo({ top: 0, behavior: "instant" })
  }
  function openFish(fish: Fish) {
    setSelected(fish)
    setGallery(0)
    go("detail")
  }
  function favorite(id: number) {
    setFavorites((old) =>
      old.includes(id) ? old.filter((x) => x !== id) : [...old, id],
    )
  }
  function clearFilters() {
    setQuery("")
    setSpecies([])
    setBreed("All breeds")
    setMaxPrice(1500)
    setSize("Any size")
    setLocation("All locations")
    setSellerRating("Any rating")
    setAvailable(true)
  }
  function beginCheckout(fish: Fish[]) {
    if (hasOrder) {
      setToast(
        "This prototype keeps one order per session. Your current demo order is below.",
      )
      go("orders")
      return
    }
    setItems(fish)
    go("checkout")
  }
  function checkout(e: FormEvent) {
    e.preventDefault()
    const nextErrors: Record<string, string> = {}
    Object.entries(shipping).forEach(([key, value]) => {
      if (!value.trim()) nextErrors[key] = "This field is required."
    })
    if (shipping.phone && !/^\+?[\d\s()-]{7,20}$/.test(shipping.phone))
      nextErrors.phone = "Enter a valid phone number."
    setErrors(nextErrors)
    if (!Object.keys(nextErrors).length) {
      setPaymentState("ready")
      go("payment")
    }
  }
  function pay(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = Object.fromEntries(
      new FormData(e.currentTarget),
    ) as Record<string, string>
    const nextErrors: Record<string, string> = {}
    if (paymentMethod === "Bank Card") {
      if (!/^\d{16}$/.test((data.card || "").replace(/\s/g, "")))
        nextErrors.card = "Enter 16 digits. Demo: 4242 4242 4242 4242."
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(data.expiry || ""))
        nextErrors.expiry = "Use MM/YY, for example 12/30."
      else {
        const [m, y] = data.expiry.split("/").map(Number)
        if (new Date(2000 + y, m) <= new Date())
          nextErrors.expiry = "This card has expired."
      }
      if (!/^\d{3,4}$/.test(data.cvc || ""))
        nextErrors.cvc = "Enter 3 or 4 digits."
      if (!data.holder?.trim()) nextErrors.holder = "Enter the cardholder name."
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setProcessing(true)
    processingTimer.current = setTimeout(() => {
      setProcessing(false)
      if (simulateFailure) {
        setPaymentState("failed")
        setSimulateFailure(false)
      } else {
        setPaymentState("paid")
        setHasOrder(true)
        notify(user.email, "success", "Order confirmed", "Your order #FM-10248 is confirmed. Follow its progress in your orders.", "#marketplace")
        items.forEach((it) => {
          const l = store.listings.find((x) => 1000 + Number(x.id.replace(/\D/g, "")) === it.id)
          if (l) notify(l.owner, "status", "New order received", `A buyer ordered "${l.draft.name}" (${l.id}).`, "#seller/orders")
        })
        setCart((old) =>
          old.filter((fish) => !items.some((item) => item.id === fish.id)),
        )
        go("confirmation")
      }
    }, 1600)
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
    )
  const activeFilters =
    species.length +
    Number(breed !== "All breeds") +
    Number(maxPrice < 1500) +
    Number(size !== "Any size") +
    Number(location !== "All locations") +
    Number(sellerRating !== "Any rating")

  function Summary({ showAction = false }: { showAction?: boolean }) {
    return (
      <aside className="buy-summary buy-panel">
        <div className="buy-panel-heading">
          <h2>Order summary</h2>
          <span>
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </div>
        {items.map((fish) => (
          <div className="buy-summary-item" key={fish.id}>
            <img src={fish.image} alt={fish.name} />
            <div>
              <strong>{fish.name}</strong>
              <span>{fish.seller}</span>
              <small>Qty 1 · {fish.size} cm</small>
            </div>
            <b>{money(fish.price)}</b>
          </div>
        ))}
        <div className="buy-price-lines">
          <div>
            <span>Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          <div>
            <span>{method} shipping</span>
            <span>{money(shippingPrice)}</span>
          </div>
          <div>
            <span>
              Platform fee <small>(2%)</small>
            </span>
            <span>{money(fee)}</span>
          </div>
          <div className="buy-total">
            <strong>
              Total <small>USD</small>
            </strong>
            <strong>{money(total)}</strong>
          </div>
        </div>
        {showAction && (
          <BuyButton type="submit">
            Continue to Payment
            <Glyph name="arrow" />
          </BuyButton>
        )}
        <p className="buy-summary-safety">
          <Glyph name="shield" />
          Your purchase is protected from checkout to delivery.
        </p>
        <p className="buy-fine-print">
          Live-fish shipping includes insulated packaging and oxygen support.
          All amounts are demo prices.
        </p>
      </aside>
    )
  }
  function Stepper({ active }: { active: number }) {
    return (
      <ol className="buy-stepper">
        {["Cart", "Shipping", "Payment", "Confirmation"].map((step, i) => (
          <li
            key={step}
            className={`${i < active ? "done" : ""} ${
              i === active ? "active" : ""
            }`}
          >
            <span>{i < active ? <Glyph name="check" /> : `0${i + 1}`}</span>
            <strong>{step}</strong>
          </li>
        ))}
      </ol>
    )
  }
  function OrderProduct() {
    return (
      <div className="buy-order-product">
        <img src={items[0].image} alt={items[0].name} />
        <div>
          <span className="buy-eyebrow">ORDER #FM-10248</span>
          <h2>
            {items[0].name}
            {items.length > 1 ? ` + ${items.length - 1} more` : ""}
          </h2>
          <p>
            {items[0].seller} <Verified />
          </p>
        </div>
        <strong>{money(total)}</strong>
      </div>
    )
  }
  function FileUpload() {
    return (
      <div className="buy-upload">
        <label htmlFor="buyer-photos">
          <Glyph name="upload" />
          <strong>Add photos</strong>
          <span>Up to 3 JPG, PNG, or WebP images · 5 MB each</span>
        </label>
        <input
          id="buyer-photos"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const chosen = Array.from(e.target.files || [])
            if (
              chosen.length > 3 ||
              chosen.some(
                (file) =>
                  file.size > 5 * 1024 * 1024 ||
                  !["image/jpeg", "image/png", "image/webp"].includes(
                    file.type,
                  ),
              )
            ) {
              setErrors((old) => ({
                ...old,
                files:
                  "Choose up to 3 JPG, PNG, or WebP images, each under 5 MB.",
              }))
              return
            }
            setFiles(chosen)
            setErrors((old) => ({ ...old, files: "" }))
          }}
        />
        {files.map((file, i) => (
          <div className="buy-file" key={`${file.name}-${i}`}>
            <span>{file.name}</span>
            <button
              type="button"
              onClick={() => setFiles((old) => old.filter((_, n) => n !== i))}
              aria-label={`Remove ${file.name}`}
            >
              <Glyph name="close" />
            </button>
          </div>
        ))}
        {errors.files && <span className="buy-error">{errors.files}</span>}
      </div>
    )
  }
  return (
    <div className="buyer-app">
      <SiteHeader language={language} setLanguage={setLanguage} />
      <header className="buy-header">
        <div className="buy-header-main">
          <label className="buy-header-search">
            <Glyph name="search" />
            <input
              aria-label="Search marketplace"
              placeholder="Search fish, species, or sellers..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                if (page !== "marketplace") {
                  setFavoritesOnly(false)
                  go("marketplace")
                }
              }}
            />
            <kbd>⌕</kbd>
          </label>
          <div className="buy-header-actions">
            <button
              onClick={() => go("orders")}
              className={
                page === "orders" || page === "tracking" ? "active" : ""
              }
            >
              <Glyph name="box" />
              <span>Orders</span>
            </button>
            <button
              onClick={() => {
                setFavoritesOnly(!favoritesOnly)
                go("marketplace")
              }}
              className={
                favoritesOnly && page === "marketplace" ? "active" : ""
              }
            >
              <Glyph name="heart" />
              <span>Favorites</span>
              {favorites.length > 0 && <b>{favorites.length}</b>}
            </button>
            <button onClick={() => setModal("messages")} aria-label="Messages">
              <Glyph name="message" />
              <span>Messages</span>
            </button>
            <span className="buy-header-divider" />
            <button
              onClick={() => go("cart")}
              aria-label={`Cart, ${cart.length} items`}
            >
              <Glyph name="bag" />
              {cart.length > 0 && <b>{cart.length}</b>}
            </button>
          </div>
        </div>
        <nav className="buy-nav">
          <div>
            <button
              className={page === "marketplace" ? "active" : ""}
              onClick={() => {
                setFavoritesOnly(false)
                clearFilters()
                go("marketplace")
              }}
            >
              Marketplace
            </button>
            {["Koi", "Betta", "Goldfish"].map((s) => (
              <button
                key={s}
                onClick={() => {
                  clearFilters()
                  setSpecies([s])
                  setFavoritesOnly(false)
                  go("marketplace")
                }}
              >
                {s === "Koi" ? "Koi Fish" : `${s} Fish`}
              </button>
            ))}
            <button
              onClick={() => {
                clearFilters()
                setSort("Newest")
                setFavoritesOnly(false)
                go("marketplace")
              }}
            >
              New Arrivals
              <span className="buy-new-dot" />
            </button>
            <span className="buy-nav-spacer" />
            <span className="buy-nav-assurance">
              <Glyph name="truck" />
              Specialist live-fish delivery
            </span>
          </div>
        </nav>
      </header>

      {page === "marketplace" ? (
        <>
          <section className="buy-market-hero">
            <div className="buy-market-hero-inner">
              <div className="buy-market-hero-copy">
                <span className="buy-eyebrow">
                  <span />
                  QUALITY STOCK. TRUSTED SOURCES.
                </span>
                <h1 ref={heading} tabIndex={-1}>
                  {favoritesOnly
                    ? "Your Favorite Finds"
                    : "Find Your Perfect Fish"}
                  <span>.</span>
                </h1>
                <p>
                  Exceptional fish from verified breeders and farms. Your next
                  great find starts here.
                </p>
                <label className="buy-hero-search">
                  <Glyph name="search" />
                  <input
                    aria-label="Search fish, species, breed, or seller"
                    placeholder="Search fish, species, breed, or seller..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <span className="buy-search-hint">
                    {stock.length} curated listings
                  </span>
                </label>
                <div className="buy-hero-pills">
                  <span>
                    <Glyph name="shield" />
                    Verified sellers
                  </span>
                  <span>
                    <Glyph name="lock" />
                    Secure payments
                  </span>
                  <span>
                    <Glyph name="truck" />
                    Safe live-fish shipping
                  </span>
                </div>
              </div>
              <div className="buy-hero-image">
                <img
                  src={pictures.koi}
                  alt="Premium koi photographed in deep water"
                />
                <div className="buy-hero-image-overlay" />
                <div className="buy-hero-caption">
                  <span>EXCEPTIONAL BY NATURE</span>
                  <strong>Quality worth discovering.</strong>
                  <span>Responsibly raised. Carefully selected.</span>
                </div>
                <span className="buy-hero-number">01 / 03</span>
              </div>
            </div>
          </section>
          <main className="buy-container buy-market-body">
            <aside className={`buy-filters ${filtersOpen ? "is-open" : ""}`}>
              <div className="buy-filter-heading">
                <h2>
                  <Glyph name="filter" />
                  Filters {activeFilters > 0 && <span>{activeFilters}</span>}
                </h2>
                <button onClick={clearFilters}>Reset all</button>
                <button
                  className="buy-mobile-filter-close"
                  onClick={() => setFiltersOpen(false)}
                  aria-label="Close filters"
                >
                  <Glyph name="close" />
                </button>
              </div>
              <div className="buy-filter-group">
                <h3>
                  Species <Glyph name="chevron" />
                </h3>
                {["Koi", "Betta", "Goldfish"].map((s) => (
                  <label className="buy-filter-check" key={s}>
                    <input
                      type="checkbox"
                      checked={species.includes(s)}
                      onChange={() =>
                        setSpecies((old) =>
                          old.includes(s)
                            ? old.filter((x) => x !== s)
                            : [...old, s],
                        )
                      }
                    />
                    <span>{s === "Koi" ? "Koi Fish" : s}</span>
                    <small>{stock.filter((f) => f.species === s).length}</small>
                  </label>
                ))}
              </div>
              <div className="buy-filter-group">
                <h3>Breed</h3>
                <select
                  aria-label="Filter by breed"
                  value={breed}
                  onChange={(e) => setBreed(e.target.value)}
                >
                  {["All breeds", ...stock.map((f) => f.breed)].map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div className="buy-filter-group">
                <h3>
                  Price range <span>USD</span>
                </h3>
                <input
                  className="buy-range"
                  type="range"
                  min="50"
                  max="1500"
                  step="10"
                  value={maxPrice}
                  aria-label="Maximum price"
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                />
                <div className="buy-range-values">
                  <span>$0</span>
                  <span>
                    {money(maxPrice)}
                    {maxPrice === 1500 ? "+" : ""}
                  </span>
                </div>
              </div>
              {[
                {
                  label: "Size",
                  value: size,
                  setter: setSize,
                  options: ["Any size", "Under 15 cm", "15 cm and above"],
                },
                {
                  label: "Location",
                  value: location,
                  setter: setLocation,
                  options: ["All locations", "Vietnam", "Thailand"],
                },
                {
                  label: "Seller Rating",
                  value: sellerRating,
                  setter: setSellerRating,
                  options: ["Any rating", "4.9", "4.8", "4.7"],
                },
              ].map(({ label, value, setter, options }) => (
                <div className="buy-filter-group" key={label}>
                  <h3>{label}</h3>
                  <select
                    aria-label={`Filter by ${label}`}
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                  >
                    {options.map((o) => (
                      <option key={o} value={o}>
                        {label === "Seller Rating" && o !== "Any rating"
                          ? `${o} stars & up`
                          : o}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <div className="buy-filter-group">
                <h3>Availability</h3>
                <label className="buy-filter-check">
                  <input
                    type="checkbox"
                    checked={available}
                    onChange={(e) => setAvailable(e.target.checked)}
                  />
                  <span>In stock only</span>
                  <span className="buy-instock-dot" />
                </label>
                <p className="buy-filter-note">
                  All current listings are ready to ship.
                </p>
              </div>
              <div className="buy-sidebar-trust">
                <Glyph name="shield" />
                <strong>Trade with confidence.</strong>
                <p>
                  Verified sellers. Transparent listings. Support at every step.
                </p>
                <button onClick={() => setModal("support")}>
                  How we protect you <Glyph name="arrow" />
                </button>
              </div>
              {filtersOpen && (
                <BuyButton onClick={() => setFiltersOpen(false)}>
                  Show {filtered.length} results
                </BuyButton>
              )}
            </aside>
            <section className="buy-listings-section">
              <div className="buy-listing-toolbar">
                <div>
                  <span className="buy-eyebrow">THE MARKETPLACE</span>
                  <h2>
                    {favoritesOnly
                      ? "Saved for later"
                      : species.length === 1
                        ? `${species[0]} collection`
                        : "Discover exceptional fish"}{" "}
                    <span>({filtered.length})</span>
                  </h2>
                  <p>
                    {query
                      ? `Results for “${query}”`
                      : favoritesOnly
                        ? "Your shortlist of exceptional finds."
                        : "Handpicked quality. Direct from the source."}
                  </p>
                </div>
                <div>
                  <button
                    className="buy-mobile-filter-button"
                    onClick={() => setFiltersOpen(true)}
                  >
                    <Glyph name="filter" />
                    Filters
                  </button>
                  <label className="buy-sort">
                    <span>Sort by:</span>
                    <select
                      aria-label="Sort listings"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      {[
                        "Recommended",
                        "Newest",
                        "Price Low to High",
                        "Price High to Low",
                      ].map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <div className="buy-collection-tabs">
                {["All fish", "Koi", "Betta", "Goldfish"].map((s) => (
                  <button
                    className={
                      s === "All fish"
                        ? !species.length
                          ? "active"
                          : ""
                        : species.length === 1 && species[0] === s
                          ? "active"
                          : ""
                    }
                    onClick={() => setSpecies(s === "All fish" ? [] : [s])}
                    key={s}
                  >
                    {s === "All fish"
                      ? "All fish"
                      : s === "Koi"
                        ? "Koi & Nishikigoi"
                        : s}
                    <span>
                      {s === "All fish"
                        ? stock.length
                        : stock.filter((f) => f.species === s).length}
                    </span>
                  </button>
                ))}
              </div>
              {activeFilters > 0 && (
                <div className="buy-active-filters">
                  {species.map((s) => (
                    <button
                      onClick={() =>
                        setSpecies((old) => old.filter((x) => x !== s))
                      }
                      key={s}
                    >
                      {s}
                      <Glyph name="close" />
                    </button>
                  ))}
                  <button onClick={clearFilters}>
                    Clear all filters <Glyph name="close" />
                  </button>
                </div>
              )}
              <div className="buy-product-grid">
                {filtered.map((fish) => (
                  <article className="buy-product-card" key={fish.id}>
                    <div className="buy-product-image">
                      <button
                        className="buy-image-link"
                        aria-label={`View ${fish.name}`}
                        onClick={() => openFish(fish)}
                      >
                        <img src={fish.image} alt={fish.name} loading="lazy" />
                      </button>
                      <span className="buy-product-label">{fish.label}</span>
                      <button
                        className={`buy-favorite ${
                          favorites.includes(fish.id) ? "saved" : ""
                        }`}
                        onClick={() => favorite(fish.id)}
                        aria-label={`${
                          favorites.includes(fish.id) ? "Remove" : "Add"
                        } ${fish.name} ${
                          favorites.includes(fish.id) ? "from" : "to"
                        } favorites`}
                        aria-pressed={favorites.includes(fish.id)}
                      >
                        <Glyph name="heart" />
                      </button>
                      <span className="buy-image-stock">
                        <span />
                        Ready to ship
                      </span>
                    </div>
                    <div className="buy-product-content">
                      <div className="buy-product-meta">
                        <span>
                          {fish.species === "Koi"
                            ? "NISHIKIGOI"
                            : fish.species.toUpperCase()}
                        </span>
                        <span>{fish.size} cm</span>
                      </div>
                      <button
                        className="buy-product-title"
                        onClick={() => openFish(fish)}
                      >
                        {fish.name}
                      </button>
                      <p className="buy-product-location">
                        <Glyph name="pin" />
                        {fish.location}
                      </p>
                      <div className="buy-card-verification">
                        <Verified />
                      </div>
                      <div className="buy-product-seller">
                        <span>
                          <span className="buy-seller-avatar">
                            {fish.seller
                              .split(" ")
                              .slice(0, 2)
                              .map((w) => w[0])
                              .join("")}
                          </span>
                          {fish.seller}
                          <Glyph name="shield" />
                        </span>
                        <Rating value={fish.rating} />
                      </div>
                      <div className="buy-product-footer">
                        <div>
                          <span>Asking price</span>
                          <strong>
                            {money(fish.price)} <small>USD</small>
                          </strong>
                        </div>
                        <button onClick={() => openFish(fish)}>
                          View Details
                          <Glyph name="arrow" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {!filtered.length && (
                <div className="buy-empty">
                  <Glyph name={favoritesOnly ? "heart" : "search"} />
                  <h2>
                    {favoritesOnly
                      ? "Your next favorite is out there."
                      : "No fish match your search."}
                  </h2>
                  <p>
                    {favoritesOnly
                      ? "Tap the heart on a listing to keep it here."
                      : "Try a different search or widen your filters."}
                  </p>
                  <BuyButton
                    onClick={() => {
                      clearFilters()
                      setFavoritesOnly(false)
                    }}
                  >
                    Explore all fish
                  </BuyButton>
                </div>
              )}
              <div className="buy-results-end">
                <span>
                  Showing {filtered.length} of {filtered.length} curated
                  listings
                </span>
                <span>Quality over quantity. Always.</span>
              </div>
              <div className="buy-sourcing-banner">
                <div className="buy-sourcing-icon">
                  <Glyph name="message" />
                </div>
                <div>
                  <h3>Looking for something specific?</h3>
                  <p>
                    Our team can help you find the right fish from the right
                    source.
                  </p>
                </div>
                <BuyButton secondary onClick={() => setModal("support")}>
                  Let's talk
                  <Glyph name="arrow" />
                </BuyButton>
              </div>
            </section>
          </main>
        </>
      ) : (
        <main className="buy-container buy-flow-main">
          <div className="buy-breadcrumb">
            <button
              onClick={() => {
                setFavoritesOnly(false)
                go("marketplace")
              }}
            >
              Marketplace
            </button>
            <Glyph name="chevron" />
            <span>{pageTitles[page]}</span>
            {page !== "detail" && (
              <span className="buy-prototype-tag">
                <span />
                BUYER JOURNEY PROTOTYPE
              </span>
            )}
          </div>
          {page === "detail" && (
            <>
              <div className="buy-detail-layout">
                <div>
                  <div className="buy-detail-main-image">
                    <img
                      src={galleryImages[gallery]}
                      alt={
                        gallery === 0
                          ? selected.name
                          : `${selected.species} collection reference photo`
                      }
                    />
                    <span className="buy-product-label">{selected.label}</span>
                    <button
                      onClick={() => setModal("zoom")}
                      aria-label="Zoom fish photo"
                    >
                      <Glyph name="zoom" />
                    </button>
                    <span className="buy-gallery-note">
                      {gallery === 0
                        ? "Listing photography"
                        : "Collection reference · not the exact specimen"}
                    </span>
                  </div>
                  <div className="buy-thumbnails">
                    {galleryImages.map((src, i) => (
                      <button
                        className={gallery === i ? "selected" : ""}
                        onClick={() => setGallery(i)}
                        key={i}
                        aria-label={`View ${
                          i === 0 ? "listing" : "reference"
                        } photo ${i + 1}`}
                        aria-pressed={gallery === i}
                      >
                        <img src={src} alt="" />
                      </button>
                    ))}
                  </div>
                  <div className="buy-panel buy-about-fish">
                    <span className="buy-eyebrow">RAISED WITH CARE</span>
                    <h2>Exceptional stock. No guesswork.</h2>
                    <p>
                      Carefully selected by {selected.seller} for vibrant
                      coloration, balanced form, and active behavior. Every
                      listing includes a health review before dispatch and
                      specialist packaging for a safe journey.
                    </p>
                    <p className="buy-fine-print">
                      This is a demonstration listing. Photos are illustrative;
                      confirm the exact specimen and delivery requirements with
                      the seller before a real purchase.
                    </p>
                  </div>
                </div>
                <section className="buy-detail-info">
                  <div className="buy-detail-topline">
                    <Verified />
                    <span className="buy-availability">
                      <span />
                      Available now
                    </span>
                  </div>
                  <span className="buy-eyebrow">
                    {selected.species.toUpperCase()} COLLECTION · FM-
                    {10247 + selected.id}
                  </span>
                  <h1 ref={heading} tabIndex={-1}>
                    {selected.name}
                  </h1>
                  <p className="buy-detail-subtitle">
                    Selected quality. Expertly raised. Ready for your next
                    chapter.
                  </p>
                  <div className="buy-detail-price">
                    {money(selected.price)}
                    <span>USD / fish</span>
                  </div>
                  <dl className="buy-specs">
                    {[
                      [
                        "Species",
                        selected.species === "Koi"
                          ? "Cyprinus carpio"
                          : selected.species === "Betta"
                            ? "Betta splendens"
                            : "Carassius auratus",
                      ],
                      ["Breed", selected.breed],
                      ["Size", `${selected.size} cm`],
                      ["Age", selected.age],
                      ["Gender", selected.gender],
                      ["Origin", selected.origin],
                      ["Health Status", "Health checked"],
                      ["Availability", "1 specimen"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="buy-detail-seller">
                    <span className="buy-farm-avatar">
                      <Glyph name="fish" />
                    </span>
                    <div>
                      <strong>{selected.seller}</strong>
                      <Verified />
                      <span>
                        <Rating value={selected.rating} /> · 128 Listings ·{" "}
                        {selected.location}
                      </span>
                    </div>
                    <button
                      aria-label="Contact seller"
                      onClick={() => setModal("messages")}
                    >
                      <Glyph name="message" />
                    </button>
                  </div>
                  <div className="buy-detail-actions">
                    <BuyButton onClick={() => beginCheckout([selected])}>
                      Buy Now
                      <Glyph name="arrow" />
                    </BuyButton>
                    <BuyButton
                      secondary
                      onClick={() => {
                        if (cart.some((f) => f.id === selected.id)) {
                          go("cart")
                        } else {
                          setCart((old) => [...old, selected])
                          setToast(`${selected.name} added to your cart.`)
                        }
                      }}
                    >
                      <Glyph name="bag" />
                      {cart.some((f) => f.id === selected.id)
                        ? "View Cart"
                        : "Add to Cart"}
                    </BuyButton>
                  </div>
                  <div className="buy-detail-minor-actions">
                    <button onClick={() => setModal("messages")}>
                      <Glyph name="message" />
                      Contact Seller
                    </button>
                    <button
                      aria-pressed={favorites.includes(selected.id)}
                      onClick={() => favorite(selected.id)}
                    >
                      <Glyph name="heart" />
                      {favorites.includes(selected.id)
                        ? "Saved to Favorites"
                        : "Add to Favorites"}
                    </button>
                  </div>
                  <TrustRow />
                  <div className="buy-delivery-note">
                    <Glyph name="truck" />
                    <div>
                      <strong>
                        Handled with care. Delivered with confidence.
                      </strong>
                      <p>
                        Insulated live-fish packaging. Express shipping from
                        $35.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </>
          )}

          {page === "cart" && (
            <>
              <div className="buy-page-heading">
                <span className="buy-eyebrow">ONE STEP CLOSER</span>
                <h1 ref={heading} tabIndex={-1}>
                  Your Cart<span>.</span>
                </h1>
                <p>Exceptional finds, ready for their next home.</p>
              </div>
              <Stepper active={0} />
              {cart.length ? (
                <div className="buy-cart-layout">
                  <div className="buy-panel">
                    {cart.map((fish) => (
                      <div className="buy-cart-item" key={fish.id}>
                        <img src={fish.image} alt={fish.name} />
                        <div>
                          <button onClick={() => openFish(fish)}>
                            {fish.name}
                          </button>
                          <p>{fish.seller}</p>
                          <span>Qty 1 · Unique specimen · {fish.size} cm</span>
                        </div>
                        <strong>{money(fish.price)}</strong>
                        <button
                          className="buy-icon-button"
                          onClick={() =>
                            setCart((old) =>
                              old.filter((f) => f.id !== fish.id),
                            )
                          }
                          aria-label={`Remove ${fish.name}`}
                        >
                          <Glyph name="close" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <aside className="buy-panel buy-cart-total">
                    <h2>Ready to make it yours?</h2>
                    <div>
                      <span>Subtotal</span>
                      <strong>
                        {money(cart.reduce((sum, f) => sum + f.price, 0))}
                      </strong>
                    </div>
                    <p>
                      Shipping and the 2% platform fee are calculated at
                      checkout. Each listing is one unique live specimen.
                    </p>
                    <BuyButton onClick={() => beginCheckout(cart)}>
                      Continue to Checkout
                      <Glyph name="arrow" />
                    </BuyButton>
                    <TrustRow />
                  </aside>
                </div>
              ) : (
                <div className="buy-empty">
                  <Glyph name="bag" />
                  <h2>Your cart is waiting for a great find.</h2>
                  <p>Discover exceptional fish from verified sellers.</p>
                  <BuyButton onClick={() => go("marketplace")}>
                    Browse Marketplace
                    <Glyph name="arrow" />
                  </BuyButton>
                </div>
              )}
            </>
          )}

          {page === "checkout" && (
            <>
              <div className="buy-page-heading">
                <span className="buy-eyebrow">A CONFIDENT NEXT STEP</span>
                <h1 ref={heading} tabIndex={-1}>
                  Make It Yours<span>.</span>
                </h1>
                <p>A few details, then we'll take care of the rest.</p>
              </div>
              <Stepper active={1} />
              <form
                className="buy-checkout-layout"
                noValidate
                onSubmit={checkout}
              >
                <div className="buy-checkout-fields">
                  <section className="buy-panel">
                    <div className="buy-panel-heading">
                      <h2>
                        <Glyph name="pin" />
                        Shipping information
                      </h2>
                      <span>All fields required</span>
                    </div>
                    <div className="buy-input-grid">
                      {([
                        ["name", "Full Name", "Alex Tran", "name"],
                        ["phone", "Phone", "+84 901 234 567", "tel"],
                        [
                          "address",
                          "Address",
                          "Street address, building, apartment",
                          "street-address",
                        ],
                        ["city", "City", "Ho Chi Minh City", "address-level2"],
                        [
                          "province",
                          "Province",
                          "Ho Chi Minh",
                          "address-level1",
                        ],
                      ] as const).map(
                        ([key, label, placeholder, autocomplete]) => (
                          <div
                            className={`buy-field ${
                              key === "address" ? "full-width" : ""
                            }`}
                            key={key}
                          >
                            <label htmlFor={`ship-${key}`}>{label}</label>
                            <input
                              id={`ship-${key}`}
                              name={key}
                              type={key === "phone" ? "tel" : "text"}
                              autoComplete={autocomplete}
                              placeholder={placeholder}
                              value={shipping[key]}
                              onChange={(e) =>
                                setShipping((old) => ({
                                  ...old,
                                  [key]: e.target.value,
                                }))
                              }
                              aria-invalid={!!errors[key]}
                              aria-describedby={
                                errors[key] ? `${key}-error` : undefined
                              }
                            />
                            {errors[key] && (
                              <span id={`${key}-error`} className="buy-error">
                                {errors[key]}
                              </span>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  </section>
                  <section className="buy-panel">
                    <div className="buy-panel-heading">
                      <h2>
                        <Glyph name="truck" />
                        Shipping method
                      </h2>
                    </div>
                    <div className="buy-shipping-methods">
                      {["Standard", "Express"].map((m) => (
                        <label
                          className={`buy-choice ${
                            method === m ? "selected" : ""
                          }`}
                          key={m}
                        >
                          <input
                            name="shippingMethod"
                            type="radio"
                            checked={method === m}
                            onChange={() => setMethod(m)}
                          />
                          <span>
                            <strong>
                              {m} delivery{" "}
                              {m === "Express" && <small>RECOMMENDED</small>}
                            </strong>
                            <span>
                              {m === "Express"
                                ? "1–2 business days · Priority live-fish handling"
                                : "3–5 business days · Insulated live-fish packaging"}
                            </span>
                          </span>
                          <b>{m === "Express" ? "$35" : "$20"}</b>
                        </label>
                      ))}
                    </div>
                  </section>
                  <section className="buy-panel">
                    <div className="buy-panel-heading">
                      <h2>
                        <Glyph name="card" />
                        Payment method
                      </h2>
                    </div>
                    <div className="buy-payment-methods">
                      {["Bank Card", "E-Wallet", "Bank Transfer"].map((m) => (
                        <label
                          className={`buy-choice ${
                            paymentMethod === m ? "selected" : ""
                          }`}
                          key={m}
                        >
                          <input
                            name="paymentMethod"
                            type="radio"
                            checked={paymentMethod === m}
                            onChange={() => setPaymentMethod(m)}
                          />
                          <Glyph
                            name={
                              m === "Bank Card"
                                ? "card"
                                : m === "E-Wallet"
                                  ? "bag"
                                  : "lock"
                            }
                          />
                          <strong>{m}</strong>
                        </label>
                      ))}
                    </div>
                    <p className="buy-fine-print">
                      <Glyph name="lock" />
                      All payment methods are simulated. No real charges are
                      made.
                    </p>
                  </section>
                </div>
                <Summary showAction />
              </form>
            </>
          )}

          {page === "payment" && (
            <>
              <div className="buy-page-heading">
                <span className="buy-eyebrow">THE FINAL STEP</span>
                <h1 ref={heading} tabIndex={-1}>
                  Secure Payment<span>.</span>
                </h1>
                <p>Your next great find is almost yours.</p>
              </div>
              <Stepper active={2} />
              <div className="buy-checkout-layout">
                <section className="buy-panel buy-payment-panel">
                  <div className="buy-panel-heading">
                    <h2>
                      <Glyph name="lock" />
                      Payment details
                    </h2>
                    <span className="buy-secure-label">Secure Payment</span>
                  </div>
                  <div className="buy-payment-overview">
                    <div>
                      <span>Order ID</span>
                      <strong>#FM-10248</strong>
                    </div>
                    <div>
                      <span>Payment Method</span>
                      <strong>{paymentMethod}</strong>
                    </div>
                    <div>
                      <span>Payment Amount</span>
                      <strong>{money(total)}</strong>
                    </div>
                  </div>
                  {paymentState === "failed" ? (
                    <div className="buy-payment-failed" role="alert">
                      <span className="buy-state-icon is-error">
                        <Glyph name="close" />
                      </span>
                      <h2>Payment Failed</h2>
                      <p>
                        Your demo payment couldn't be completed. No money has
                        been charged. Your order details are safe.
                      </p>
                      <BuyButton
                        onClick={() => {
                          setPaymentState("ready")
                          setErrors({})
                        }}
                      >
                        Try Again
                        <Glyph name="arrow" />
                      </BuyButton>
                    </div>
                  ) : (
                    <form noValidate onSubmit={pay}>
                      <div className="buy-demo-payment">
                        <Glyph name="shield" />
                        <div>
                          <strong>You're in a safe demo environment.</strong>
                          <p>
                            Don't enter real financial information. Use the test
                            details below.
                          </p>
                        </div>
                      </div>
                      {paymentMethod === "Bank Card" ? (
                        <div className="buy-input-grid">
                          <div className="buy-field full-width">
                            <label htmlFor="card">Card number</label>
                            <input
                              id="card"
                              name="card"
                              placeholder="4242 4242 4242 4242"
                              inputMode="numeric"
                              maxLength={19}
                              aria-invalid={!!errors.card}
                              disabled={processing}
                            />
                            {errors.card && (
                              <span className="buy-error">{errors.card}</span>
                            )}
                          </div>
                          <div className="buy-field full-width">
                            <label htmlFor="holder">Cardholder name</label>
                            <input
                              id="holder"
                              name="holder"
                              placeholder="Demo Buyer"
                              aria-invalid={!!errors.holder}
                              disabled={processing}
                            />
                            {errors.holder && (
                              <span className="buy-error">{errors.holder}</span>
                            )}
                          </div>
                          <div className="buy-field">
                            <label htmlFor="expiry">Expiry date</label>
                            <input
                              id="expiry"
                              name="expiry"
                              placeholder="12/30"
                              maxLength={5}
                              aria-invalid={!!errors.expiry}
                              disabled={processing}
                            />
                            {errors.expiry && (
                              <span className="buy-error">{errors.expiry}</span>
                            )}
                          </div>
                          <div className="buy-field">
                            <label htmlFor="cvc">Security code</label>
                            <input
                              id="cvc"
                              name="cvc"
                              placeholder="123"
                              type="password"
                              inputMode="numeric"
                              maxLength={4}
                              aria-invalid={!!errors.cvc}
                              disabled={processing}
                            />
                            {errors.cvc && (
                              <span className="buy-error">{errors.cvc}</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="buy-alternative-payment">
                          <Glyph
                            name={paymentMethod === "E-Wallet" ? "bag" : "card"}
                          />
                          <h3>
                            {paymentMethod === "E-Wallet"
                              ? "Demo wallet connected"
                              : "Demo bank transfer"}
                          </h3>
                          <p>
                            {paymentMethod === "E-Wallet"
                              ? "Confirm below to simulate a successful wallet authorization."
                              : "Reference: FM-10248. Confirm below to simulate receipt of a bank transfer. Do not send money."}
                          </p>
                        </div>
                      )}
                      <label className="buy-test-failure">
                        <input
                          type="checkbox"
                          checked={simulateFailure}
                          disabled={processing}
                          onChange={(e) => setSimulateFailure(e.target.checked)}
                        />
                        Simulate a failed payment to preview retry
                      </label>
                      <BuyButton type="submit" disabled={processing}>
                        {processing ? (
                          <>
                            <span className="buy-spinner" />
                            Processing Payment...
                          </>
                        ) : (
                          <>
                            Confirm Payment · {money(total)}
                            <Glyph name="lock" />
                          </>
                        )}
                      </BuyButton>
                      <p className="buy-encryption">
                        <Glyph name="lock" />
                        Encrypted Transaction · Prototype only
                      </p>
                    </form>
                  )}
                  <button
                    className="buy-text-link"
                    disabled={processing}
                    onClick={() => go("checkout")}
                  >
                    ← Back to shipping & payment method
                  </button>
                </section>
                <Summary />
              </div>
            </>
          )}

          {page === "confirmation" && (
            <div className="buy-success-page">
              <span className="buy-state-icon">
                <Glyph name="check" />
              </span>
              <span className="buy-eyebrow">A GREAT FIND. A GREAT CHOICE.</span>
              <h1 ref={heading} tabIndex={-1}>
                Order Placed Successfully
              </h1>
              <p>
                Your purchase is confirmed. We'll keep you in the loop every
                step of the way.
              </p>
              <Stepper active={3} />
              <section className="buy-panel">
                <OrderProduct />
                <div className="buy-confirmation-data">
                  <div>
                    <span>Order ID</span>
                    <strong>#FM-10248</strong>
                  </div>
                  <div>
                    <span>Payment Status</span>
                    <strong className="buy-paid">
                      <Glyph name="check" />
                      Paid · Demo
                    </strong>
                  </div>
                  <div>
                    <span>Delivery to</span>
                    <strong>{shipping.name}</strong>
                    <small>
                      {shipping.city}, {shipping.province}
                    </small>
                  </div>
                  <div>
                    <span>Estimated delivery</span>
                    <strong>
                      {method === "Express" ? "1–2" : "3–5"} business days
                    </strong>
                  </div>
                </div>
              </section>
              <div className="buy-success-actions">
                <BuyButton onClick={() => go("tracking")}>
                  Track Order
                  <Glyph name="truck" />
                </BuyButton>
                <BuyButton secondary onClick={() => go("marketplace")}>
                  Continue Shopping
                  <Glyph name="arrow" />
                </BuyButton>
              </div>
              <p className="buy-fine-print">
                This is a demo order. No payment was collected and no fish will
                be shipped.
              </p>
            </div>
          )}

          {page === "orders" && (
            <>
              <div className="buy-page-heading">
                <span className="buy-eyebrow">YOUR TRADING JOURNEY</span>
                <h1 ref={heading} tabIndex={-1}>
                  Your Orders<span>.</span>
                </h1>
                <p>Every great find, all in one place.</p>
              </div>
              {hasOrder ? (
                <section className="buy-panel">
                  <OrderProduct />
                  <div className="buy-order-row">
                    <span className="buy-status-pill">
                      {disputeSent
                        ? "Issue reported"
                        : completed
                          ? "Completed"
                          : delivered
                            ? "Delivered"
                            : "Seller preparing"}
                    </span>
                    <span>Paid · {money(total)}</span>
                    <BuyButton onClick={() => go("tracking")}>
                      View Order
                      <Glyph name="arrow" />
                    </BuyButton>
                  </div>
                </section>
              ) : (
                <div className="buy-empty">
                  <Glyph name="box" />
                  <h2>Your first great trade starts here.</h2>
                  <p>You haven't placed an order in this session yet.</p>
                  <BuyButton onClick={() => go("marketplace")}>
                    Discover Fish
                    <Glyph name="arrow" />
                  </BuyButton>
                </div>
              )}
            </>
          )}

          {page === "tracking" && (
            <>
              <div className="buy-page-heading">
                <span className="buy-eyebrow">EVERY STEP, IN THE CLEAR</span>
                <h1 ref={heading} tabIndex={-1}>
                  Track Your Order<span>.</span>
                </h1>
                <p>From trusted hands to yours. Follow your fish's journey.</p>
              </div>
              <div className="buy-tracking-layout">
                <section className="buy-panel">
                  <OrderProduct />
                  <div className="buy-tracking-status">
                    <span className="buy-status-pill">
                      {disputeSent
                        ? "Support reviewing"
                        : completed
                          ? "Order completed"
                          : delivered
                            ? "Delivered"
                            : "Seller preparing"}
                    </span>
                    <span>
                      {delivered
                        ? "Delivered to your shipping address"
                        : "Estimated arrival: 1–2 business days after dispatch"}
                    </span>
                  </div>
                  <ol className="buy-timeline">
                    {[
                      [
                        "Order Placed",
                        "10 Jul 2026",
                        "09:30 AM",
                        "Your order has been received. A great find is on its way.",
                      ],
                      [
                        "Payment Confirmed",
                        "10 Jul 2026",
                        "09:31 AM",
                        "Payment verified. Your purchase is covered by buyer protection.",
                      ],
                      [
                        "Seller Preparing",
                        "10 Jul 2026",
                        "11:15 AM",
                        "Health check, oxygen support, and insulated packaging are underway.",
                      ],
                      [
                        "Shipped",
                        delivered ? "11 Jul 2026" : "Expected 11 Jul",
                        delivered ? "08:00 AM" : "Awaiting dispatch",
                        "Specialist live-fish courier. Tracking reference: LF-829104.",
                      ],
                      [
                        "Delivered",
                        delivered ? "12 Jul 2026" : "Expected 12 Jul",
                        delivered ? "10:20 AM" : "Before 6:00 PM",
                        "Delivered with care. Please inspect your fish and confirm receipt.",
                      ],
                    ].map(([title, date, time, description], i) => (
                      <li
                        key={title}
                        className={
                          delivered || i < 2
                            ? "done"
                            : i === 2
                              ? "current"
                              : "pending"
                        }
                      >
                        <span className="buy-timeline-marker">
                          {delivered || i < 2 ? (
                            <Glyph name="check" />
                          ) : i === 2 ? (
                            <Glyph name="box" />
                          ) : (
                            <span />
                          )}
                        </span>
                        <div>
                          <div className="buy-timeline-title">
                            <h3>{title}</h3>
                            <span>
                              {date} · {time}
                            </span>
                          </div>
                          <p>{description}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
                <aside className="buy-tracking-aside">
                  <section className="buy-panel">
                    <span className="buy-eyebrow">YOUR DELIVERY</span>
                    <h2>
                      <Glyph name="truck" />
                      Handled with care.
                    </h2>
                    <strong>{shipping.name}</strong>
                    <p>
                      {shipping.address}
                      <br />
                      {shipping.city}, {shipping.province}
                      <br />
                      {shipping.phone}
                    </p>
                    <div className="buy-tracking-buttons">
                      <BuyButton secondary onClick={() => setModal("messages")}>
                        <Glyph name="message" />
                        Contact Seller
                      </BuyButton>
                      <button
                        className="buy-text-link"
                        onClick={() => setModal("support")}
                      >
                        Contact Support
                        <Glyph name="arrow" />
                      </button>
                    </div>
                  </section>
                  <section className="buy-demo-advance">
                    <span className="buy-eyebrow">EXPLORE THE PROTOTYPE</span>
                    <h3>
                      {disputeSent
                        ? "Your issue is under review."
                        : completed
                          ? "Thanks for completing your trade."
                          : "Ready to see the next step?"}
                    </h3>
                    <p>
                      {disputeSent
                        ? "We've kept your order open while your report is reviewed. You can check your case details below."
                        : completed
                          ? "Your receipt and review are attached to this demo order."
                          : "Skip the wait and preview delivery confirmation. No shipment is actually sent."}
                    </p>
                    <BuyButton
                      onClick={() => {
                        if (disputeSent) go("dispute")
                        else if (completed) go("review")
                        else {
                          setDelivered(true)
                          go("delivery")
                        }
                      }}
                    >
                      {disputeSent
                        ? "View Issue Report"
                        : completed
                          ? reviewSent
                            ? "View Review"
                            : "Leave a Review"
                          : delivered
                            ? "Confirm Your Delivery"
                            : "Simulate Delivery"}
                      <Glyph name="arrow" />
                    </BuyButton>
                  </section>
                </aside>
              </div>
            </>
          )}

          {page === "delivery" && (
            <div className="buy-centered-flow">
              <span className="buy-state-icon">
                <Glyph name="box" />
              </span>
              <span className="buy-eyebrow">A SAFE ARRIVAL</span>
              <h1 ref={heading} tabIndex={-1}>
                Have you received your order?
              </h1>
              <p>
                Take a moment to check your fish. Confirm receipt only when
                everything looks right.
              </p>
              <section className="buy-panel">
                <OrderProduct />
                <div className="buy-inspection">
                  <h3>A quick arrival checklist</h3>
                  {[
                    "Check the packaging for damage.",
                    "Confirm the fish matches your listing.",
                    "Inspect health and activity before acclimation.",
                  ].map((item) => (
                    <p key={item}>
                      <Glyph name="check" />
                      {item}
                    </p>
                  ))}
                </div>
              </section>
              <BuyButton
                onClick={() => {
                  setCompleted(true)
                  setFiles([])
                  go("review")
                }}
              >
                <Glyph name="check" />
                Confirm Received
              </BuyButton>
              <BuyButton
                secondary
                onClick={() => {
                  setFiles([])
                  go("dispute")
                }}
              >
                Report a Problem
                <Glyph name="arrow" />
              </BuyButton>
              <p className="buy-fine-print">
                <Glyph name="shield" />
                Confirming receipt completes your demo order. Report any issue
                first.
              </p>
            </div>
          )}

          {page === "review" && (
            <div className="buy-centered-flow">
              {reviewSent ? (
                <>
                  <span className="buy-state-icon">
                    <Glyph name="check" />
                  </span>
                  <span className="buy-eyebrow">
                    YOUR VOICE MAKES A DIFFERENCE
                  </span>
                  <h1 ref={heading} tabIndex={-1}>
                    Thank you for your review.
                  </h1>
                  <p>
                    You've helped the next buyer trade with a little more
                    confidence.
                  </p>
                  <section className="buy-panel buy-posted-review">
                    <span className="buy-status-pill">Order completed</span>
                    <h2>{items[0].seller}</h2>
                    <div className="buy-review-stars">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Glyph
                          key={i}
                          name="star"
                          className={i < rating ? "filled" : ""}
                        />
                      ))}
                    </div>
                    <p>{review}</p>
                    {files.length > 0 && (
                      <small>
                        {files.length} photo{files.length > 1 ? "s" : ""}{" "}
                        attached locally
                      </small>
                    )}
                    <Verified />
                  </section>
                  <BuyButton onClick={() => go("marketplace")}>
                    Continue Shopping
                    <Glyph name="arrow" />
                  </BuyButton>
                  <BuyButton secondary onClick={() => go("orders")}>
                    View Orders
                  </BuyButton>
                </>
              ) : (
                <>
                  <span className="buy-state-icon">
                    <Glyph name="star" />
                  </span>
                  <span className="buy-eyebrow">
                    ORDER COMPLETED · #FM-10248
                  </span>
                  <h1 ref={heading} tabIndex={-1}>
                    How was your experience?
                  </h1>
                  <p>
                    Your honest feedback helps great sellers grow and buyers
                    choose with confidence.
                  </p>
                  <form
                    className="buy-panel buy-review-form"
                    noValidate
                    onSubmit={(e) => {
                      e.preventDefault()
                      const next: Record<string, string> = {}
                      if (!rating) next.rating = "Choose a star rating."
                      if (review.trim().length < 10)
                        next.review =
                          "Tell us a little more (at least 10 characters)."
                      setErrors(next)
                      if (!Object.keys(next).length) setReviewSent(true)
                    }}
                  >
                    <div className="buy-review-seller">
                      <img src={items[0].image} alt={items[0].name} />
                      <div>
                        <strong>{items[0].name}</strong>
                        <span>{items[0].seller}</span>
                      </div>
                    </div>
                    <fieldset className="buy-star-field">
                      <legend>Rate your experience</legend>
                      <div className="buy-star-input">
                        {Array.from({ length: 5 }, (_, i) => (
                          <label key={i} className={i < rating ? "filled" : ""}>
                            <input
                              type="radio"
                              name="rating"
                              value={i + 1}
                              checked={rating === i + 1}
                              onChange={() => setRating(i + 1)}
                              aria-label={`${i + 1} star${i ? "s" : ""}`}
                            />
                            <Glyph name="star" />
                          </label>
                        ))}
                      </div>
                      <span>
                        {rating
                          ? [
                              "",
                              "Not great",
                              "Could be better",
                              "Good",
                              "Really good",
                              "Exceptional",
                            ][rating]
                          : "Choose a rating"}
                      </span>
                      {errors.rating && (
                        <span className="buy-error">{errors.rating}</span>
                      )}
                    </fieldset>
                    <div className="buy-field">
                      <label htmlFor="review">Your review</label>
                      <textarea
                        id="review"
                        placeholder="Tell us about the fish, the seller, and the delivery..."
                        rows={4}
                        value={review}
                        maxLength={1000}
                        onChange={(e) => setReview(e.target.value)}
                        aria-invalid={!!errors.review}
                      />
                      {errors.review && (
                        <span className="buy-error">{errors.review}</span>
                      )}
                      <small>{review.length}/1000 characters</small>
                    </div>
                    <div className="buy-field">
                      <label>
                        Photos <span>(optional)</span>
                      </label>
                      <FileUpload />
                    </div>
                    <BuyButton type="submit">
                      Submit Review
                      <Glyph name="arrow" />
                    </BuyButton>
                    <button
                      type="button"
                      className="buy-text-link"
                      onClick={() => go("orders")}
                    >
                      I'll do this later
                    </button>
                  </form>
                </>
              )}
            </div>
          )}

          {page === "dispute" && (
            <div className="buy-centered-flow">
              <span className="buy-state-icon is-neutral">
                <Glyph name="shield" />
              </span>
              <span className="buy-eyebrow">WE'RE HERE TO HELP</span>
              <h1 ref={heading} tabIndex={-1}>
                {disputeSent
                  ? "Your report is with our team."
                  : "Let's Make It Right"}
              </h1>
              <p>
                {disputeSent
                  ? "Your demo case #DS-10248 has been opened. The order is marked for review, not completed."
                  : "Tell us what happened. We'll help you and the seller find a fair resolution."}
              </p>
              {disputeSent ? (
                <>
                  <section className="buy-panel buy-dispute-success">
                    <strong>Case #DS-10248 · Review pending</strong>
                    <p>Reason: {reason}</p>
                    <p>{problem}</p>
                    <p className="buy-fine-print">
                      In a live transaction, support would review the evidence
                      and contact you. This report is saved only in this
                      session.
                    </p>
                  </section>
                  <BuyButton onClick={() => go("tracking")}>
                    Back to Order
                    <Glyph name="arrow" />
                  </BuyButton>
                  <BuyButton secondary onClick={() => setModal("support")}>
                    Contact Support
                  </BuyButton>
                </>
              ) : (
                <form
                  className="buy-panel buy-dispute-form"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault()
                    const next: Record<string, string> = {}
                    if (!reason) next.reason = "Choose the type of issue."
                    if (problem.trim().length < 15)
                      next.problem =
                        "Please describe the issue in at least 15 characters."
                    setErrors(next)
                    if (!Object.keys(next).length) setDisputeSent(true)
                  }}
                >
                  <OrderProduct />
                  <div className="buy-field">
                    <label htmlFor="reason">What went wrong?</label>
                    <select
                      id="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      aria-invalid={!!errors.reason}
                    >
                      <option value="">Select an issue</option>
                      {[
                        "Fish arrived unwell",
                        "Item doesn't match listing",
                        "Damaged packaging",
                        "Order not received",
                        "Other issue",
                      ].map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                    {errors.reason && (
                      <span className="buy-error">{errors.reason}</span>
                    )}
                  </div>
                  <div className="buy-field">
                    <label htmlFor="problem">Describe the problem</label>
                    <textarea
                      id="problem"
                      rows={4}
                      value={problem}
                      maxLength={2000}
                      placeholder="Include as much detail as you can..."
                      onChange={(e) => setProblem(e.target.value)}
                      aria-invalid={!!errors.problem}
                    />
                    {errors.problem && (
                      <span className="buy-error">{errors.problem}</span>
                    )}
                  </div>
                  <FileUpload />
                  <BuyButton type="submit">
                    Submit Report
                    <Glyph name="arrow" />
                  </BuyButton>
                  <button
                    type="button"
                    className="buy-text-link"
                    onClick={() => go("delivery")}
                  >
                    Back to delivery confirmation
                  </button>
                </form>
              )}
            </div>
          )}
        </main>
      )}
      <section className="buy-bottom-trust">
        <div className="buy-container">
          {[
            [
              "shield",
              "Verified by people. Not promises.",
              "Identity-checked sellers and transparent listings.",
            ],
            [
              "truck",
              "Specialist shipping. Safer arrivals.",
              "Live-fish handling from dispatch to your door.",
            ],
            [
              "message",
              "Real support. Every step.",
              "Here to help you trade with confidence.",
            ],
          ].map(([icon, title, description]) => (
            <div key={title}>
              <span>
                <Glyph name={icon as GlyphName} />
              </span>
              <div>
                <strong>{title}</strong>
                <p>{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <footer className="buy-footer buy-container">
        <button className="buy-footer-brand" onClick={() => go("marketplace")}>
          <Glyph name="fish" />
          FISHMARKET
        </button>
        <span>Better fish. Better connections. Better trade.</span>
        <div>
          <a href="#home">About FISHMARKET</a>
          <button onClick={() => setModal("support")}>Help & Support</button>
          <span>© 2026 FISHMARKET</span>
        </div>
      </footer>
      <div className="buy-prototype-footer">
        <span>
          <span />
          BUYER PURCHASE PROTOTYPE
        </span>
        <span>
          Discover <Glyph name="chevron" /> Purchase <Glyph name="chevron" />{" "}
          Track <Glyph name="chevron" /> Review
        </span>
        <span>No real payments or shipments</span>
      </div>
      {toast && (
        <div className="buy-toast" role="status">
          <Glyph name="check" />
          {toast}
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <Glyph name="close" />
          </button>
        </div>
      )}
      {modal && (
        <div className="buy-modal-backdrop" onClick={() => setModal(null)}>
          <div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "zoom"
                ? "Fish photo zoom"
                : modal === "messages"
                  ? "Contact seller"
                  : modal === "notifications"
                    ? "Notifications"
                    : "FISHMARKET support"
            }
            className={`buy-modal ${modal === "zoom" ? "buy-zoom-modal" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="buy-modal-close"
              onClick={() => setModal(null)}
              aria-label="Close dialog"
            >
              <Glyph name="close" />
            </button>
            {modal === "zoom" ? (
              <>
                <img src={galleryImages[gallery]} alt={selected.name} />
                <p>
                  {gallery === 0
                    ? selected.name
                    : "Collection reference photo — illustrative specimen"}
                </p>
              </>
            ) : modal === "notifications" ? (
              <>
                <span className="buy-state-icon is-neutral">
                  <Glyph name="bell" />
                </span>
                <h2>You're all caught up.</h2>
                <p>
                  {hasOrder
                    ? "Your demo order #FM-10248 is confirmed. Follow its progress in your orders."
                    : "Order updates and important marketplace news will appear here."}
                </p>
                <BuyButton
                  onClick={() => {
                    setModal(null)
                    go("orders")
                  }}
                >
                  View Orders
                  <Glyph name="arrow" />
                </BuyButton>
              </>
            ) : (
              <>
                <span className="buy-state-icon is-neutral">
                  <Glyph name={modal === "messages" ? "message" : "shield"} />
                </span>
                <h2>
                  {modal === "messages"
                    ? `Chat with ${selected.seller}`
                    : "A little help. A lot of confidence."}
                </h2>
                <p>
                  {modal === "messages"
                    ? "Ask about health, shipping, or the exact specimen before you buy."
                    : "Verified sellers, transparent listings, and dispute assistance help protect eligible trades. Tell us what you need."}
                </p>
                <div className="buy-chat-history">
                  <div className="buy-chat-system">
                    {modal === "messages"
                      ? "Hello! How can we help with your next great find?"
                      : "Welcome to FISHMARKET support. How can we help?"}
                  </div>
                  {sent.map((text, i) => (
                    <div className="buy-chat-sent" key={i}>
                      {text}
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (message.trim()) {
                      setSent((old) => [...old, message.trim()])
                      setMessage("")
                    }
                  }}
                >
                  <label className="buy-field">
                    <span>Your message</span>
                    <textarea
                      rows={3}
                      value={message}
                      maxLength={1000}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Write your message..."
                    />
                  </label>
                  <BuyButton type="submit" disabled={!message.trim()}>
                    Send Message
                    <Glyph name="arrow" />
                  </BuyButton>
                </form>
                <p className="buy-fine-print">
                  Local prototype chat. Messages aren't sent to real people.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
