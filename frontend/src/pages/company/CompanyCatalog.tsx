import { useEffect, useRef, useState } from "react";
import { currentUser, useUser } from "@/services/session";
import { replaceHashRoute, useHashTransitionGuard } from "@/services/hashNavigation";
import { useTranslation } from "@/context/LanguageContext";
import { errorMessage } from "@/services/api";
import { companyListingsApi } from "@/services/companyListingsApi";
import { canPublish, imageTypes, listingForm, listingInput, listingLabel, listingRoute, listingStatuses, ListingValidationError, publicationMissing, textLimits, validImageUrl, validateListingFile, type ListingForm } from "@/services/companyListings";
import type { CompanyListing, CompanyListingFilter } from "@/services/contracts";
import "../marketplace/PublicMarketplace.css";
import "../marketplace/Commerce.css";
import "./CompanyCatalog.css";

export default function CompanyCatalog({ mode, listingId }: { mode: "list" | "new" | "edit" | "detail"; listingId: string | null }) {
  const { language } = useTranslation();
  const user = useUser();
  const tr = (en: string, vi: string) => language === "vi" ? vi : en;
  const [rows, setRows] = useState<CompanyListing[]>([]);
  const [listing, setListing] = useState<CompanyListing | null>(null);
  const [form, setForm] = useState<ListingForm>(() => listingForm());
  const [baseline, setBaseline] = useState<ListingForm>(() => listingForm());
  const [status, setStatus] = useState<CompanyListingFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [step, setStep] = useState(0);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(mode !== "new");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [createUncertain, setCreateUncertain] = useState(false);
  const [uploadUncertain, setUploadUncertain] = useState(false);
  const [confirm, setConfirm] = useState<"save" | "publish" | "refresh" | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const locked = useRef(false);
  const alive = useRef(true);
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);
  const editing = mode === "new" || mode === "edit";
  const disabled = busy || loading || needsRefresh || createUncertain || uploadUncertain || listing?.status === "pending";
  const sameSession = () => !!user && currentUser()?.email === user.email && currentUser()?.role === user.role;
  useHashTransitionGuard(() => !sameSession() || !dirty || window.confirm(tr("Leave without saving these local changes? Uploaded files will remain public on the server.", "Rời trang mà không lưu thay đổi? Tệp đã tải vẫn công khai trên máy chủ.")));
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty && sameSession()) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, user]);
  useEffect(() => {
    const controller = new AbortController();
    if (mode === "new") return () => controller.abort();
    const requestedHash = window.location.hash;
    setLoading(true); setError(""); setConfirm(null);
    const load = mode === "list" ? companyListingsApi.list(status, controller.signal).then(values => {
      if (!controller.signal.aborted) { setRows(values); setPage(1); }
    }) : companyListingsApi.detail(listingId!, controller.signal).then(value => {
      if (!controller.signal.aborted) {
        setListing(value); const next = listingForm(value.draft); setForm(next); setBaseline(next);
        if ((mode === "edit" || mode === "detail") && value.id !== listingId) {
          replaceHashRoute(listingRoute(mode, value.id) + (requestedHash.includes("?") ? requestedHash.slice(requestedHash.indexOf("?")) : ""), requestedHash);
        }
      }
    });
    void load.then(() => { if (!controller.signal.aborted) setNeedsRefresh(false); })
      .catch(failure => { if (!controller.signal.aborted) { setError(errorMessage(failure, language)); setNeedsRefresh(true); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [mode, listingId, status, reload]);
  const set = <K extends keyof ListingForm>(field: K, value: ListingForm[K]) => setForm(current => ({ ...current, [field]: value }));
  const navigate = (url: string) => { window.location.hash = url; };
  const accept = (value: CompanyListing) => { setListing(value); const next = listingForm(value.draft); setForm(next); setBaseline(next); setNotice(tr("The server returned the saved listing below.", "Máy chủ đã trả về tin đăng đã lưu bên dưới.")); };
  async function act(action: "save" | "publish") {
    if (locked.current || disabled) return;
    let input;
    try { input = listingInput(form, listing ? baseline : undefined); }
    catch (failure) { setError(failure instanceof ListingValidationError ? tr("Check this field: ", "Kiểm tra trường: ") + failure.field : errorMessage(failure, language)); setConfirm(null); return; }
    if (action === "publish" && (!listing || dirty || !canPublish(listing.status))) return;
    locked.current = true; setBusy(true); setError(""); setNotice("");
    const creating = action === "save" && !listing;
    try {
      const value = action === "publish" ? await companyListingsApi.publish(listing!.id)
        : listing ? await companyListingsApi.save(listing.id, input) : await companyListingsApi.create(input);
      if (listing && value.company.id !== listing.company.id) throw new Error("Unexpected company response");
      if (alive.current) { accept(value); setConfirm(null); if (creating) replaceHashRoute(listingRoute("edit", value.id)); }
    } catch (failure) {
      if (alive.current) {
        setError(errorMessage(failure, language) + " " + tr("No automatic replay was sent. Read the shared catalog or Refresh before another action; the write may already have completed.", "Không tự động gửi lại. Xem danh mục chung hoặc làm mới trước khi thao tác; máy chủ có thể đã hoàn tất."));
        setConfirm(null); setNeedsRefresh(true); if (creating) setCreateUncertain(true);
      }
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  async function upload(file: File) {
    if (locked.current || disabled) return;
    try { validateListingFile(file, form.images.length); }
    catch { setError(tr("Use up to eight JPEG, PNG, WebP or GIF images, at most 10 MiB each.", "Tối đa tám ảnh JPEG, PNG, WebP hoặc GIF, mỗi ảnh tối đa 10 MiB.")); return; }
    locked.current = true; setBusy(true); setError("");
    try {
      const value = await companyListingsApi.upload(file);
      if (alive.current) setForm(current => ({ ...current, images: [...current.images, { url: value.url, position: current.images.length, isMain: !current.images.length }] }));
    } catch (failure) {
      if (alive.current) { setUploadUncertain(true); setError(errorMessage(failure, language) + " " + tr("Upload not confirmed. A public file may remain unlinked; there is no upload cleanup or recovery endpoint.", "Chưa xác nhận tải ảnh. Có thể còn tệp công khai chưa liên kết; chưa có API dọn hoặc khôi phục.")); }
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  const moveImage = (from: number, to: number) => {
    const images = [...form.images]; const [image] = images.splice(from, 1); images.splice(to, 0, image); set("images", images);
  };
  const removeImage = (index: number) => {
    const images = form.images.filter((_, position) => index !== position);
    if (images.length && !images.some(image => image.isMain)) images[0] = { ...images[0], isMain: true };
    set("images", images);
  };
  const missing = publicationMissing(form);
  const titles = [tr("Basic information", "Thông tin cơ bản"), tr("Fish details", "Thông tin cá"), tr("Pricing and terms", "Giá và điều khoản"), tr("Public media", "Ảnh công khai"), tr("Location and shipping", "Vị trí và vận chuyển"), tr("Editorial preview", "Xem trước nội dung")];
  const labels: Record<string, string> = {
    name: tr("Fish name", "Tên cá"), species: tr("Species", "Loài"), breed: tr("Breed · optional", "Giống · tùy chọn"), description: tr("Description", "Mô tả"),
    ageMonths: tr("Age · months", "Tuổi · tháng"), sizeCm: tr("Size · cm", "Kích thước · cm"), gender: tr("Gender", "Giới tính"), origin: tr("Origin", "Nguồn gốc"), health: tr("Health", "Sức khỏe"),
    price: tr("Price per fish · VND", "Giá mỗi cá · VND"), quantity: tr("Available quantity", "Số lượng có sẵn"), depositPct: tr("Deposit · 20–30%", "Đặt cọc · 20–30%"), expectedReadyDate: tr("Expected ready date · local time", "Ngày sẵn sàng · giờ địa phương"), preorderPolicy: tr("Preorder policy · optional", "Chính sách đặt trước · tùy chọn"),
    location: tr("Location", "Địa chỉ"), region: tr("Region", "Khu vực"), shipping: tr("Shipping options · one per line", "Cách vận chuyển · mỗi dòng một mục")
  };
  function field(field: Exclude<keyof ListingForm, "images" | "saleMode" | "negotiable">, type = "text") {
    const multiline = ["description", "shipping", "preorderPolicy"].includes(field);
    return <label key={field} className={multiline ? "catalog-wide" : ""}>{labels[field]}{multiline
      ? <textarea rows={field === "description" ? 6 : 3} value={form[field]} maxLength={field in textLimits ? textLimits[field as keyof typeof textLimits] : 809} onChange={event => set(field, event.target.value)} />
      : <input type={type} value={form[field]} maxLength={field in textLimits ? textLimits[field as keyof typeof textLimits] : undefined} step={type === "number" ? 1 : undefined} onChange={event => set(field, event.target.value)} />}</label>;
  }
  const filtered = rows.filter(value => `${value.id} ${value.draft?.name ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  return <main className="public-market commerce company-catalog">
    <a href="#company/listings" onClick={event => { event.preventDefault(); navigate("#company/listings"); }}>← {tr("Company catalog", "Danh mục công ty")}</a>
    <h1>{mode === "list" ? tr("Company catalog", "Danh mục công ty") : editing ? listing ? tr("Edit company listing", "Sửa tin đăng công ty") : tr("Create company draft", "Tạo bản nháp công ty") : tr("Company listing", "Tin đăng công ty")}</h1>
    <p>{tr("All Admins operate the same company inventory. Creator identity is attribution, not ownership.", "Mọi quản trị viên cùng quản lý kho công ty. Người tạo chỉ là thông tin ghi nhận, không phải chủ sở hữu.")}</p>
    {error && <p role="alert" className="commerce-alert">{error}</p>}{notice && <p role="status" className="commerce-alert">{notice}</p>}
    {loading && <p role="status">{tr("Loading…", "Đang tải…")}</p>}
    <div className="commerce-actions">
      {mode === "list" && <><a href="#company/add">{tr("Create draft", "Tạo bản nháp")}</a><label>{tr("Listing status", "Trạng thái tin")}<select disabled={busy} value={status} onChange={event => setStatus(event.target.value as CompanyListingFilter)}><option value="all">{tr("All", "Tất cả")}</option>{listingStatuses.map(value => <option key={value} value={value}>{listingLabel(value, language)}</option>)}<option value="attention">{tr("Needs attention", "Cần xử lý")}</option></select></label><label>{tr("Search name or code · loaded records", "Tìm tên hoặc mã · bản ghi đã tải")}<input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label></>}
      {mode !== "new" && <button disabled={loading || busy} onClick={() => dirty ? setConfirm("refresh") : setReload(value => value + 1)}>{tr("Refresh", "Làm mới")}</button>}
    </div>
    {needsRefresh && <p>{tr("Actions are disabled until the server record is reconciled. Refresh discards local edits.", "Thao tác bị khóa đến khi đối chiếu bản ghi máy chủ. Làm mới sẽ bỏ thay đổi chưa lưu.")}</p>}
    {createUncertain && <p>{tr("Creation has an unknown outcome and no idempotency key. This screen will not create again. Inspect the shared catalog and open the saved record if it exists before starting any new draft.", "Chưa rõ kết quả tạo, không có khóa chống trùng. Trang này không tạo lại. Kiểm tra danh mục chung và mở bản ghi đã lưu nếu có trước khi tạo bản nháp mới.")} <a href="#company/listings">{tr("Inspect shared catalog", "Kiểm tra danh mục chung")}</a></p>}
    {uploadUncertain && <button disabled={busy} onClick={() => { setUploadUncertain(false); setError(""); }}>{tr("Continue without retrying the unconfirmed image", "Tiếp tục, không tải lại ảnh chưa xác nhận")}</button>}
    {mode === "list" && !loading && !error && <><p>{filtered.length} {tr("loaded records · local search/pagination", "bản ghi · tìm kiếm/phân trang cục bộ")}</p>{!filtered.length ? <p>{tr("No listings found.", "Không tìm thấy tin đăng.")}</p> : <div className="catalog-table-wrap"><table><thead><tr>{[tr("Listing", "Tin đăng"), tr("Status", "Trạng thái"), tr("Price / stock", "Giá / tồn kho"), tr("Creator", "Người tạo"), tr("Actions", "Thao tác")].map(value => <th key={value}>{value}</th>)}</tr></thead><tbody>{filtered.slice((Math.min(page, pageCount) - 1) * 10, Math.min(page, pageCount) * 10).map(value => <tr key={value.id}><td><a href={listingRoute("detail", value.id)}>{value.draft?.name || tr("Untitled draft", "Bản nháp chưa đặt tên")}</a><br />{value.id}</td><td>{listingLabel(value.status, language)}</td><td>{(value.draft?.price ?? 0).toLocaleString(language === "vi" ? "vi-VN" : "en-US")} ₫ / {value.draft?.quantity ?? "—"}</td><td>{value.createdBy ?? "—"}</td><td><a href={listingRoute("detail", value.id)}>{tr("View", "Xem")}</a>{value.status !== "pending" && <> · <a href={listingRoute("edit", value.id)}>{tr("Edit", "Sửa")}</a></>}</td></tr>)}</tbody></table></div>}<div className="commerce-actions"><button disabled={page <= 1} onClick={() => setPage(value => value - 1)}>{tr("Previous", "Trước")}</button><span>{Math.min(page, pageCount)} / {pageCount}</span><button disabled={page >= pageCount} onClick={() => setPage(value => value + 1)}>{tr("Next", "Sau")}</button></div></>}
    {listing && <section className="commerce-panel"><h2>{listing.id} · {listingLabel(listing.status, language)}</h2><p>{listing.company.name} · {listing.createdBy ?? "—"}</p><p>{tr("Updated", "Cập nhật")}: {new Date(listing.updatedAt).toLocaleString(language === "vi" ? "vi-VN" : "en-US")}</p>{listing.status === "approved" && <p className="commerce-alert">{tr("This listing is live. Saving edits changes public content immediately; there is no separate unpublished snapshot.", "Tin đang hiển thị. Lưu sửa đổi sẽ thay nội dung công khai ngay; không có bản riêng chưa xuất bản.")}</p>}{listing.status === "pending" && <p>{tr("Editing is locked while under review. Optional review controls are not integrated here.", "Không thể sửa khi đang xét duyệt. Thao tác xét duyệt tùy chọn chưa được tích hợp tại đây.")}</p>}<div className="commerce-actions">{mode === "detail" && listing.status !== "pending" && <a href={listingRoute("edit", listing.id)}>{tr("Edit listing", "Sửa tin")}</a>}{listing.status === "approved" && <a href={`#marketplace/detail?fish=${encodeURIComponent(listing.id)}`} onClick={event => { event.preventDefault(); navigate(`#marketplace/detail?fish=${encodeURIComponent(listing.id)}`); }}>{tr("Open public listing", "Mở tin công khai")}</a>}{mode === "new" && <a href={listingRoute("edit", listing.id)} onClick={event => { event.preventDefault(); navigate(listingRoute("edit", listing.id)); }}>{tr("Continue in saved record", "Tiếp tục tại bản ghi đã lưu")}</a>}</div></section>}
    {editing && !loading && <><ol className="catalog-steps">{titles.map((title, index) => <li key={title}><button disabled={busy || !!confirm} aria-current={step === index ? "step" : undefined} onClick={() => setStep(index)}>{index + 1}. {title}</button></li>)}</ol><section className="commerce-panel"><h2>{titles[step]}</h2><fieldset className="catalog-fields" disabled={disabled || !!confirm}>
      {step === 0 && <>{field("name")}{field("species")}{field("breed")}{field("description")}</>}
      {step === 1 && <>{field("ageMonths", "number")}{field("sizeCm", "number")}{field("gender")}{field("origin")}{field("health")}</>}
      {step === 2 && <>{field("price", "number")}{field("quantity", "number")}<label>{tr("Sale mode", "Hình thức bán")}<select value={form.saleMode} onChange={event => set("saleMode", event.target.value as ListingForm["saleMode"])}><option value="in_stock">{tr("In stock", "Có sẵn")}</option><option value="pre_order">{tr("Preorder · deposit and later balance", "Đặt trước · cọc và trả phần còn lại")}</option></select></label><label className="catalog-check"><input type="checkbox" checked={form.negotiable} onChange={event => set("negotiable", event.target.checked)} />{tr("Negotiable", "Có thể thương lượng")}</label>{form.saleMode === "pre_order" && <>{field("depositPct", "number")}{field("expectedReadyDate", "datetime-local")}{field("preorderPolicy")}<p className="catalog-wide">{tr("Preorder deposit/date are required even for a partial save. The seven-day balance window begins when the company marks the order ready; missed deadlines cancel/refund rather than forfeit the deposit.", "Cọc/ngày sẵn sàng bắt buộc ngay khi lưu nháp đặt trước. Hạn trả còn lại bảy ngày bắt đầu khi công ty đánh dấu sẵn sàng; quá hạn sẽ hủy/hoàn tiền, không mất cọc.")}</p></>}</>}
      {step === 3 && <><p className="catalog-wide">{tr("Uploaded listing images are public immediately, even before publication. Use JPEG/PNG/WebP/GIF, up to eight images and 10 MiB each. Removing an image does not delete its uploaded file.", "Ảnh tải lên công khai ngay cả trước xuất bản. JPEG/PNG/WebP/GIF, tối đa tám ảnh, mỗi ảnh 10 MiB. Gỡ ảnh không xóa tệp đã tải.")}</p><label>{tr("Upload public image", "Tải ảnh công khai")}<input type="file" accept={imageTypes.join(",")} disabled={form.images.length >= 8} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} /></label><label>{tr("Existing public image URL · optional", "URL ảnh công khai có sẵn · tùy chọn")}<input value={imageUrl} onChange={event => setImageUrl(event.target.value)} /></label><button type="button" disabled={form.images.length >= 8 || !validImageUrl(imageUrl.trim())} onClick={() => { set("images", [...form.images, { url: imageUrl.trim(), position: form.images.length, isMain: !form.images.length }]); setImageUrl(""); }}>{tr("Add image URL", "Thêm URL ảnh")}</button><div className="catalog-images catalog-wide">{form.images.map((image, index) => <article key={`${image.url}:${index}`}><img src={image.url} alt={`${form.name || tr("Listing image", "Ảnh tin")} ${index + 1}`} /><p>{index + 1} · {image.isMain ? tr("Cover", "Ảnh chính") : tr("Image", "Ảnh")}</p><button disabled={image.isMain} onClick={() => set("images", form.images.map((value, position) => ({ ...value, isMain: position === index })))}>{tr("Set cover", "Đặt ảnh chính")}</button><button disabled={index === 0} onClick={() => moveImage(index, index - 1)}>{tr("Move earlier", "Đưa lên")}</button><button disabled={index === form.images.length - 1} onClick={() => moveImage(index, index + 1)}>{tr("Move later", "Đưa xuống")}</button><button onClick={() => removeImage(index)}>{tr("Remove reference", "Gỡ tham chiếu")}</button></article>)}</div></>}
      {step === 4 && <>{field("location")}{field("region")}{field("shipping")}</>}
      {step === 5 && <div className="catalog-wide"><p>{tr("Editorial preview, not an exact buyer view. Only saved approved records appear publicly.", "Xem trước nội dung, không phải giao diện mua hàng chính xác. Chỉ bản đã lưu và xuất bản mới công khai.")}</p><h3>{form.name || tr("Untitled", "Chưa đặt tên")}</h3><p>{form.species} · {form.breed}</p><p className="catalog-copy">{form.description}</p><p>{Number(form.price || 0).toLocaleString(language === "vi" ? "vi-VN" : "en-US")} ₫ · {form.quantity} {tr("available", "có sẵn")}</p><p>{form.saleMode === "pre_order" ? `${tr("Preorder deposit", "Cọc đặt trước")} ${form.depositPct}% · ${form.expectedReadyDate}` : tr("In stock", "Có sẵn")}</p><p>{form.location} · {form.region}</p><p className="catalog-copy">{form.shipping}</p><div className="catalog-images">{form.images.map((image, index) => <img key={index} src={image.url} alt={`${form.name} ${index + 1}`} />)}</div>{missing.length > 0 && <p>{tr("Required before publication: ", "Cần bổ sung trước xuất bản: ")}{missing.join(", ")}</p>}</div>}
    </fieldset></section><div className="commerce-actions"><button disabled={step === 0 || busy} onClick={() => setStep(value => value - 1)}>{tr("Previous step", "Bước trước")}</button><button disabled={step === 5 || busy} onClick={() => setStep(value => value + 1)}>{tr("Next step", "Bước tiếp")}</button><button disabled={disabled || (!!listing && !dirty) || !!confirm} onClick={() => setConfirm("save")}>{listing?.status === "approved" ? tr("Save live changes", "Lưu thay đổi công khai") : tr("Save draft content", "Lưu nội dung nháp")}</button>{listing && canPublish(listing.status) && <button disabled={disabled || dirty || missing.length > 0 || !!confirm} onClick={() => setConfirm("publish")}>{tr("Publish saved listing", "Xuất bản tin đã lưu")}</button>}<span>{dirty ? tr("Unsaved local changes", "Thay đổi chưa lưu") : tr("No unsaved changes", "Không có thay đổi chưa lưu")}</span></div><p>{tr("Save first, then publish the returned record. Shared Admin edits can overwrite changed fields; no version or concurrency lock exists. Only changed fields are sent, but replacing media replaces its entire array.", "Lưu trước, rồi xuất bản bản ghi máy chủ. Sửa đổi chung có thể ghi đè trường đã đổi; chưa có khóa phiên bản. Chỉ gửi trường đã đổi, nhưng sửa ảnh thay toàn bộ mảng ảnh.")}</p></>}
    {mode === "detail" && listing?.draft && <section className="commerce-panel"><h2>{listing.draft.name || tr("Untitled draft", "Bản nháp chưa đặt tên")}</h2><p>{listing.draft.species} · {listing.draft.breed}</p><p className="catalog-copy">{listing.draft.description}</p><p>{listing.draft.price.toLocaleString(language === "vi" ? "vi-VN" : "en-US")} ₫ · {listing.draft.quantity}</p><p>{listing.draft.saleMode} {listing.draft.saleMode === "pre_order" ? `· ${listing.draft.depositPct}% · ${listing.draft.expectedReadyDate}` : ""}</p><div className="catalog-images">{listing.draft.images.map(image => <img key={image.id} src={image.url} alt={listing.draft!.name} />)}</div></section>}
    {confirm && <section className="commerce-alert" role="group" aria-label={tr("Confirm catalog action", "Xác nhận thao tác danh mục")}><p>{confirm === "refresh" ? tr("Discard unsaved local changes and read the server record?", "Bỏ thay đổi chưa lưu và đọc bản ghi máy chủ?") : confirm === "publish" ? tr("Publish the saved company listing directly to public browsing? No mandatory review is required.", "Xuất bản trực tiếp tin công ty đã lưu? Không bắt buộc xét duyệt.") : listing?.status === "approved" ? tr("Save these changes to the live public listing immediately?", "Lưu thay đổi vào tin công khai ngay?") : tr("Save this content to the company catalog? This is separate from publication.", "Lưu nội dung vào danh mục công ty? Đây là thao tác riêng với xuất bản.")}</p><button disabled={busy} onClick={() => confirm === "refresh" ? (setConfirm(null), setReload(value => value + 1)) : void act(confirm)}>{busy ? tr("Saving…", "Đang lưu…") : tr("Confirm action", "Xác nhận thao tác")}</button><button disabled={busy} onClick={() => setConfirm(null)}>{tr("Keep unchanged", "Giữ nguyên")}</button></section>}
  </main>;
}
