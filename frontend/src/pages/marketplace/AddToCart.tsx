import { useRef, useState, type FormEvent } from "react";
import { useTranslation } from "@/context/LanguageContext";
import { commerceApi } from "@/services/commerceApi";
import { errorMessage } from "@/services/api";
import { pendingCheckout } from "@/services/checkout";
import { useSessionReady, useUser } from "@/services/session";
import type { MarketplaceListing } from "@/services/contracts";
import "./Commerce.css";

export function AddToCart({ listing }: { listing: MarketplaceListing }) {
  const user = useUser();
  const ready = useSessionReady();
  const { language } = useTranslation();
  const tr = (en: string, vi: string) => language === "vi" ? vi : en;
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  if (!ready) return <p role="status">{tr("Checking session…", "Đang kiểm tra phiên…")}</p>;
  if (!user) return <button className="sl-btn sl-btn-primary" onClick={() => {
    sessionStorage.setItem("fishmarket-return", window.location.hash.replace(/^#/, ""));
    window.location.hash = "login";
  }}>{tr("Sign in to purchase", "Đăng nhập để mua")}</button>;
  if (user.role !== "Buyer") return <p>{tr("Admin accounts may browse but cannot purchase.", "Quản trị viên có thể xem nhưng không thể mua hàng.")}</p>;
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current || !user) return;
    setMessage(""); setError("");
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > listing.quantity) {
      setError(tr("Choose a quantity within available stock.", "Chọn số lượng trong giới hạn có sẵn.")); return;
    }
    locked.current = true; setBusy(true);
    try {
      if (pendingCheckout(user.email)) {
        setError(tr("Resolve the pending checkout in your cart before adding more fish.", "Xử lý thanh toán đang chờ trong giỏ trước khi thêm cá.")); return;
      }
      const cart = await commerceApi.add(listing.id, quantity);
      setMessage(`${tr("Added to cart. Cart quantity:", "Đã thêm vào giỏ. Số lượng trong giỏ:")} ${cart.itemCount}`);
    } catch (failure) { setError(errorMessage(failure, language)); }
    finally { locked.current = false; setBusy(false); }
  }
  return <div className="commerce"><form onSubmit={(event) => { void add(event); }}>
    <label htmlFor="purchase-quantity">{tr("Quantity to add", "Số lượng thêm")}</label>{" "}
    <input id="purchase-quantity" type="number" min={1} max={Math.max(1, listing.quantity)} step={1} required value={quantity} disabled={busy || listing.quantity < 1} onChange={(event) => setQuantity(event.target.valueAsNumber)} />
    <button className="commerce-primary" disabled={busy || listing.quantity < 1} type="submit">{busy ? tr("Adding…", "Đang thêm…") : listing.quantity < 1 ? tr("Out of stock", "Hết hàng") : tr("Add to cart", "Thêm vào giỏ")}</button>
  </form>{message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    <a href="#marketplace/cart">{tr("View cart", "Xem giỏ hàng")}</a>
    <p>{tr("Your cart does not reserve stock. Payment at checkout is simulated.", "Giỏ hàng không giữ chỗ. Thanh toán được mô phỏng.")}</p>
  </div>;
}
