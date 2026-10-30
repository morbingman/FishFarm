import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "@/context/LanguageContext";
import { apiSessionStamp, errorMessage, isApiSession } from "@/services/api";
import { currentUser, useUser } from "@/services/session";
import { replaceHashRoute, useHashTransitionGuard } from "@/services/hashNavigation";
import { batchesApi } from "@/services/batchesApi";
import { batchRoute, batchShareSummary, batchStageLabel, batchStatusLabel, batchStages, batchStatuses, BatchValidationError, canCancelBatch, canEditBatch, canPostBatchUpdate, costCategories, normalizeBatchCancellationNote, normalizeBatchInput, normalizeBatchUpdateInput } from "@/services/batches";
import { facilityTextLength } from "@/services/facilities";
import type { BatchCostInput, BatchFacility, BatchInput, BatchStage, BatchStatus, CompanyBatch } from "@/services/batchContracts";
import BatchDetails, { batchUtc } from "@/components/batches/BatchDetails";
import "../marketplace/PublicMarketplace.css";
import "../farming/PublicBatches.css";
import "./CompanyBatches.css";

type CostForm = Omit<BatchCostInput, "amount" | "note"> & { amount: string; note: string };
type DraftForm = {
  title: string; species: string; breed: string; description: string; location: string; region: string;
  stockingDate: string; expectedHarvestDate: string; stockCount: string; shareUnitType: "count" | "weight";
  shareQuantity: string; expectedHarvestWeightG: string; packagePricePerShare: string; contingencyPct: string;
  riskDisclosure: string; termsVersion: string; facilityId: string; images: string[]; costs: CostForm[];
};
type UpdateForm = { stage: BatchStage; averageWeightG: string; countAlive: string; note: string; photoUrls: string };
type Confirmation = "save" | "publish" | "update" | "cancel";
type CancellationConfirmation = {
  id: string; title: string; status: BatchStatus; sponsorshipCount: number; updatedAt: string;
  reason: string; rawReason: string; revision: number; draft: string; observation: string; read: number; hash: string;
};
const emptyUpdate = (): UpdateForm => ({ stage: "nursery", averageWeightG: "", countAlive: "", note: "", photoUrls: "" });
const utcInput = (value: string | null) => value ? new Date(value).toISOString().slice(0, -1) : "";
function draftForm(batch?: CompanyBatch): DraftForm {
  return {
    title: batch?.title ?? "", species: batch?.species ?? "", breed: batch?.breed ?? "", description: batch?.description ?? "", location: batch?.location ?? "", region: batch?.region ?? "",
    stockingDate: utcInput(batch?.stockingDate ?? null), expectedHarvestDate: utcInput(batch?.expectedHarvestDate ?? null), stockCount: batch ? String(batch.stockCount) : "",
    shareUnitType: batch?.shareUnitType ?? "count", shareQuantity: batch?.shareQuantity == null ? "" : String(batch.shareQuantity), expectedHarvestWeightG: batch?.expectedHarvestWeightG == null ? "" : String(batch.expectedHarvestWeightG),
    packagePricePerShare: batch ? String(batch.packagePricePerShare) : "", contingencyPct: batch ? String(batch.contingencyPct) : "10", riskDisclosure: batch?.riskDisclosure ?? "", termsVersion: batch?.termsVersion ?? "", facilityId: batch?.facility?.id ?? "",
    images: batch?.images.map(image => image.url) ?? [], costs: batch?.costs.map(cost => ({ category: cost.category, label: cost.label, amount: String(cost.amount), allocation: cost.allocation, note: cost.note ?? "" })) ?? [],
  };
}
function integer(value: string, field: string, min = 1, max = 2147483647) {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) throw new BatchValidationError(field);
  return Number(value);
}
function dateInput(value: string, field: string) {
  if (!value) return undefined;
  const date = new Date(`${value}Z`);
  if (Number.isNaN(date.getTime())) throw new BatchValidationError(field);
  return date.toISOString();
}
function inputFromForm(form: DraftForm, baseline?: DraftForm): BatchInput {
  for (const key of ["stockingDate", "expectedHarvestDate", "expectedHarvestWeightG"] as const) {
    if (baseline?.[key] && !form[key] && !(key === "expectedHarvestWeightG" && form.shareUnitType === "count")) throw new BatchValidationError(key);
  }
  const input: BatchInput = {
    title: form.title, species: form.species, breed: form.breed.trim(), description: form.description, location: form.location, region: form.region,
    stockingDate: dateInput(form.stockingDate, "stockingDate"), expectedHarvestDate: dateInput(form.expectedHarvestDate, "expectedHarvestDate"),
    stockCount: integer(form.stockCount, "stockCount"), shareUnitType: form.shareUnitType, shareQuantity: integer(form.shareQuantity, "shareQuantity"),
    ...(form.shareUnitType === "weight" ? { expectedHarvestWeightG: integer(form.expectedHarvestWeightG, "expectedHarvestWeightG") } : {}),
    packagePricePerShare: integer(form.packagePricePerShare, "packagePricePerShare"), contingencyPct: integer(form.contingencyPct, "contingencyPct", 0, 100),
    riskDisclosure: form.riskDisclosure, termsVersion: form.termsVersion, facilityId: form.facilityId,
    images: form.images.map((url, position) => ({ url, position })), costs: form.costs.map((cost, index) => ({ ...cost, amount: integer(cost.amount, `costs.${index}.amount`, 0), note: cost.note.trim() || undefined })),
  };
  return normalizeBatchInput(input) as BatchInput;
}
function changedInput(input: BatchInput, form: DraftForm, baseline: DraftForm): Partial<BatchInput> {
  const patch: Partial<BatchInput> = {};
  for (const key of Object.keys(input) as (keyof BatchInput)[]) {
    if (JSON.stringify(form[key]) !== JSON.stringify(baseline[key]) && input[key] !== undefined) Object.assign(patch, { [key]: input[key] });
  }
  return normalizeBatchInput(patch, true);
}

export default function CompanyBatches({ mode, batchId }: { mode: "list" | "new" | "detail" | "edit"; batchId: string | null }) {
  const { language } = useTranslation();
  const user = useUser();
  const tr = (en: string, vi: string) => language === "vi" ? vi : en;
  const [stamp] = useState(apiSessionStamp);
  const [rows, setRows] = useState<CompanyBatch[]>([]);
  const [batch, setBatch] = useState<CompanyBatch | null>(null);
  const [facilities, setFacilities] = useState<BatchFacility[]>([]);
  const [facilityError, setFacilityError] = useState("");
  const [form, setForm] = useState<DraftForm>(() => draftForm());
  const [baseline, setBaseline] = useState<DraftForm>(() => draftForm());
  const [update, setUpdate] = useState<UpdateForm>(emptyUpdate);
  const [cancellationNote, setCancellationNote] = useState("");
  const [cancellationConfirmation, setCancellationConfirmation] = useState<CancellationConfirmation | null>(null);
  const [status, setStatus] = useState<BatchStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [createUncertain, setCreateUncertain] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [appendUncertain, setAppendUncertain] = useState(false);
  const [routeMismatch, setRouteMismatch] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState<Confirmation | null>(null);
  const locked = useRef(false);
  const readPending = useRef(true);
  const refreshRequired = useRef(false);
  const alive = useRef(true);
  const sequence = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const confirmedCreatedId = useRef<string | null>(null);
  const confirmRef = useRef<HTMLElement | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const cancellationRevision = useRef(0);
  const cancellationAttempted = useRef(false);
  const sameSession = () => isApiSession(stamp) && stamp?.role === "Admin" && user?.role === "Admin" && user.status === "active" && currentUser()?.email === user.email && currentUser()?.role === "Admin" && currentUser()?.status === "active";
  const draftDirty = JSON.stringify(form) !== JSON.stringify(baseline);
  const updateDirty = JSON.stringify(update) !== JSON.stringify(emptyUpdate());
  const cancellationDirty = cancellationNote !== "";
  const dirty = draftDirty || updateDirty || cancellationDirty;
  const cancellationLength = facilityTextLength(cancellationNote.trim());
  const cancellationValid = cancellationLength >= 1 && cancellationLength <= 1000;
  const cancellationValidationMessage = tr("Enter a cancellation reason of 1–1,000 characters after trimming surrounding whitespace.", "Nhập lý do hủy gồm 1–1.000 ký tự sau khi bỏ khoảng trắng đầu và cuối.");
  const blocked = busy || loading || needsRefresh || createUncertain || appendUncertain || routeMismatch || !sameSession();
  const visible = !busy && !loading && !needsRefresh && sameSession() ? batch : null;
  const editable = mode === "new" ? !createdId && !createUncertain : mode === "edit" && !!batch && canEditBatch(batch.status);
  const cancellationEligible = mode === "detail" && !!visible && visible.id === batchId && canCancelBatch(visible.status, visible.sponsorshipCount);
  const cancellationConfirmationCurrent = !!cancellationConfirmation && !!batch && cancellationEligible && !blocked && !draftDirty && !updateDirty
    && cancellationConfirmation.id === batch.id && cancellationConfirmation.title === batch.title
    && cancellationConfirmation.status === batch.status && cancellationConfirmation.sponsorshipCount === batch.sponsorshipCount
    && cancellationConfirmation.updatedAt === batch.updatedAt && cancellationConfirmation.rawReason === cancellationNote
    && cancellationConfirmation.revision === cancellationRevision.current && cancellationConfirmation.draft === JSON.stringify(form)
    && cancellationConfirmation.observation === JSON.stringify(update) && cancellationConfirmation.read === sequence.current
    && cancellationConfirmation.hash === window.location.hash;
  const set = <K extends keyof DraftForm>(key: K, value: DraftForm[K]) => setForm(current => ({ ...current, [key]: value }));
  const categories: Record<string, string> = { equipment: tr("Equipment", "Thiết bị"), feed: tr("Feed", "Thức ăn"), labour: tr("Labour", "Nhân công"), health: tr("Health", "Sức khỏe"), transport: tr("Transport", "Vận chuyển"), platform_fee: tr("Platform fee", "Phí nền tảng"), contingency: tr("Contingency", "Dự phòng") };
  const labels: Record<string, string> = {
    title: tr("Batch title", "Tiêu đề lô"), species: tr("Species", "Loài"), breed: tr("Breed · optional, can be emptied", "Giống · tùy chọn, có thể để trống"), description: tr("Description · 20–4,000 characters", "Mô tả · 20–4.000 ký tự"),
    location: tr("Location", "Địa chỉ"), region: tr("Region", "Khu vực"), stockingDate: tr("Planned stocking date · UTC, optional", "Ngày thả dự kiến · UTC, tùy chọn"), expectedHarvestDate: tr("Expected harvest date · UTC, optional", "Ngày thu hoạch dự kiến · UTC, tùy chọn"),
    stockCount: tr("Whole-batch stocked fish count", "Số cá thả toàn lô"), shareUnitType: tr("Share unit type", "Loại đơn vị phần"), shareQuantity: form.shareUnitType === "weight" ? tr("Grams per share · integer", "Gam mỗi phần · số nguyên") : tr("Fish per share · integer", "Con mỗi phần · số nguyên"),
    expectedHarvestWeightG: tr("Expected whole-batch harvest biomass · grams", "Sinh khối thu hoạch dự kiến toàn lô · gam"), packagePricePerShare: tr("Package price per share · integer VND", "Giá gói mỗi phần · số nguyên VND"), contingencyPct: tr("Contingency percentage · 0–100", "Tỷ lệ dự phòng · 0–100"),
    riskDisclosure: tr("Risk disclosure · 20–4,000 characters", "Công bố rủi ro · 20–4.000 ký tự"), termsVersion: tr("Terms version", "Phiên bản điều khoản"), facilityId: tr("Existing facility", "Cơ sở hiện có"), images: tr("Public batch image URLs", "URL ảnh lô công khai"), costs: tr("Cost lines", "Dòng chi phí"),
    averageWeightG: tr("Average weight · grams, optional", "Khối lượng trung bình · gam, tùy chọn"), countAlive: tr("Count alive · optional", "Số cá còn sống · tùy chọn"), note: tr("Note · optional", "Ghi chú · tùy chọn"), photoUrls: tr("Public update photo URLs", "URL ảnh cập nhật công khai"), stage: tr("Recorded stage", "Giai đoạn ghi nhận"),
  };
  const failureMessage = (failure: unknown) => failure instanceof BatchValidationError ? tr("Check field: ", "Kiểm tra trường: ") + (labels[failure.field] ?? (failure.field.startsWith("costs") ? labels.costs : failure.field)) : errorMessage(failure, language);
  useHashTransitionGuard(() => !sameSession() || (!locked.current && (!dirty || window.confirm(tr("Leave without saving local draft, observation or cancellation reason changes?", "Rời trang mà không lưu thay đổi nháp, quan sát hoặc lý do hủy?")))));
  useEffect(() => { alive.current = true; return () => { alive.current = false; controllerRef.current?.abort(); }; }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (sameSession() && (dirty || locked.current)) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, user, stamp]);
  useEffect(() => { if (confirm) confirmRef.current?.focus(); }, [confirm]);
  useEffect(() => {
    if (confirm === "cancel" && !cancellationConfirmationCurrent) { setConfirm(null); setCancellationConfirmation(null); }
  }, [confirm, cancellationConfirmationCurrent]);
  const accept = (value: CompanyBatch) => { setBatch(value); const next = draftForm(value); setForm(next); setBaseline(next); refreshRequired.current = false; setNeedsRefresh(false); };
  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current?.abort(); controllerRef.current = controller;
    const read = ++sequence.current;
    const current = () => alive.current && !controller.signal.aborted && read === sequence.current && sameSession();
    const expectedHash = window.location.hash;
    readPending.current = true;
    setLoading(true); setError(""); setConfirm(null); setCancellationConfirmation(null); setFacilityError(""); setRows([]); setBatch(null);
    if (!sameSession()) { readPending.current = false; setLoading(false); return () => controller.abort(); }
    const id = confirmedCreatedId.current ?? batchId;
    const readBatch = mode === "list" ? batchesApi.companyList(status === "all" ? undefined : status, controller.signal).then(values => { if (current()) { setRows(values); setPage(1); setNeedsRefresh(false); } })
      : id ? batchesApi.companyDetail(id, controller.signal).then(value => {
        if (!current()) return;
        accept(value);
        cancellationAttempted.current = false;
        if (value.id !== batchId || mode === "new") {
          const replaced = replaceHashRoute(batchRoute(mode === "detail" ? "detail" : "edit", value.id, true), expectedHash);
          if (!replaced) { setRouteMismatch(true); setNotice(tr("Canonical navigation was not accepted. Writes are locked on this route; open the confirmed record link.", "Chưa chấp nhận chuyển đến đường dẫn chuẩn. Thao tác ghi bị khóa trên trang này; mở liên kết bản ghi đã xác nhận.")); }
        }
      }) : mode === "new" ? Promise.resolve() : Promise.reject(new Error("Missing batch ID"));
    const readFacilities = mode === "new" || mode === "edit" ? batchesApi.facilities(controller.signal).then(values => { if (current()) setFacilities(values); })
      .catch(failure => { if (current()) { setFacilities([]); setFacilityError(errorMessage(failure, language)); } }) : Promise.resolve();
    void Promise.all([readBatch, readFacilities]).catch(failure => { if (current()) { setError(failureMessage(failure)); setNeedsRefresh(true); } })
      .finally(() => { if (current()) { readPending.current = false; setLoading(false); } });
    return () => controller.abort();
  }, [mode, batchId, status, reload, stamp]);
  function refresh() {
    if (locked.current || readPending.current || loading || !sameSession()) return;
    if (dirty && !window.confirm(tr("Discard local changes, including any cancellation reason, and read the authoritative server record?", "Bỏ thay đổi cục bộ, gồm cả lý do hủy, và đọc bản ghi máy chủ chính thức?"))) return;
    if (mode === "new" && !confirmedCreatedId.current && !createdId) {
      const next = draftForm(); setForm(next); setBaseline(next);
    }
    readPending.current = true; controllerRef.current?.abort(); ++sequence.current; ++cancellationRevision.current;
    setUpdate(emptyUpdate()); setCancellationNote(""); setCancellationConfirmation(null); setLoading(true); setConfirm(null); setReload(value => value + 1);
  }
  function ask(action: Confirmation, button: HTMLButtonElement) { if (action !== "cancel" && !blocked && !locked.current && !readPending.current) { opener.current = button; setCancellationConfirmation(null); setConfirm(action); } }
  function changeCancellationNote(value: string) {
    if (locked.current || readPending.current || blocked) return;
    ++cancellationRevision.current; setCancellationNote(value); setCancellationConfirmation(null); setConfirm(null);
  }
  function askCancellation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sameSession() || locked.current || readPending.current || blocked || cancellationAttempted.current || !cancellationEligible || !batch || draftDirty || updateDirty) return;
    let reason: string;
    try { reason = normalizeBatchCancellationNote(cancellationNote); }
    catch { setError(cancellationValidationMessage); return; }
    opener.current = event.currentTarget.querySelector<HTMLButtonElement>('button[type="submit"]');
    setError("");
    setCancellationConfirmation({ id: batch.id, title: batch.title, status: batch.status, sponsorshipCount: batch.sponsorshipCount, updatedAt: batch.updatedAt, reason, rawReason: cancellationNote, revision: cancellationRevision.current, draft: JSON.stringify(form), observation: JSON.stringify(update), read: sequence.current, hash: window.location.hash });
    setConfirm("cancel");
  }
  function cancelConfirmation() { if (!locked.current) { setConfirm(null); setCancellationConfirmation(null); opener.current?.focus(); } }
  async function act(action: Confirmation) {
    if (!sameSession() || locked.current || readPending.current || refreshRequired.current || blocked) return;
    const cancellation = action === "cancel" ? cancellationConfirmation : null;
    if (action === "cancel" && (confirm !== "cancel" || !cancellationConfirmationCurrent || !cancellation || cancellationAttempted.current || cancellation.revision !== cancellationRevision.current || cancellation.read !== sequence.current || cancellation.hash !== window.location.hash)) { setConfirm(null); setCancellationConfirmation(null); return; }
    const creating = action === "save" && mode === "new";
    if (action === "save" && (!editable || (creating && confirmedCreatedId.current) || (!creating && (!batch || !draftDirty)))) return;
    if (action === "publish" && (!batch || !canEditBatch(batch.status) || dirty)) return;
    if (action === "update" && (!batch || !canPostBatchUpdate(batch.status) || draftDirty || cancellationDirty)) return;
    let input: Partial<BatchInput> | undefined;
    let updateInput;
    try {
      if (action === "cancel" && (!cancellation || normalizeBatchCancellationNote(cancellationNote) !== cancellation.reason)) throw new BatchValidationError("cancelReason");
      if (action === "save") { const full = inputFromForm(form, creating ? undefined : baseline); input = creating ? full : changedInput(full, form, baseline); }
      if (action === "update") updateInput = normalizeBatchUpdateInput({ stage: update.stage, ...(update.averageWeightG ? { averageWeightG: integer(update.averageWeightG, "averageWeightG") } : {}), ...(update.countAlive ? { countAlive: integer(update.countAlive, "countAlive", 0) } : {}), ...(update.note.trim() ? { note: update.note.trim() } : {}), photoUrls: update.photoUrls.split(/\r?\n/).map(value => value.trim()).filter(Boolean) });
    } catch (failure) { setError(action === "cancel" ? cancellationValidationMessage : failureMessage(failure)); setConfirm(null); setCancellationConfirmation(null); return; }
    locked.current = true;
    if (action === "cancel") cancellationAttempted.current = true;
    controllerRef.current?.abort(); const writeSequence = ++sequence.current;
    const expectedHash = window.location.hash;
    const current = () => alive.current && sameSession() && writeSequence === sequence.current;
    setBusy(true); setError(""); setNotice(""); setConfirm(null); setCancellationConfirmation(null);
    let acknowledged = false;
    try {
      let id = batch?.id;
      let updateId: string | null = null;
      let cancellationAck: CompanyBatch | null = null;
      if (action === "cancel") {
        cancellationAck = await batchesApi.cancel(cancellation!.id, cancellation!.reason);
        if (cancellationAck.id !== cancellation!.id || cancellationAck.status !== "cancelled" || cancellationAck.sponsorshipCount !== 0 || !cancellationAck.cancelledAt || cancellationAck.cancelReason !== cancellation!.reason) throw new Error("Unexpected cancellation acknowledgement");
        id = cancellationAck.id;
      }
      else if (action === "update") { const ack = await batchesApi.addUpdate(id!, updateInput!); updateId = ack.id; }
      else {
        const ack = action === "publish" ? await batchesApi.publish(id!) : creating ? await batchesApi.create(input as BatchInput) : await batchesApi.save(id!, input!);
        if (!creating && ack.id !== id) throw new Error("Unexpected batch acknowledgement");
        id = ack.id;
        if (creating) { confirmedCreatedId.current = id; if (current()) setCreatedId(id); }
      }
      acknowledged = true;
      if (!current()) return;
      refreshRequired.current = true; setNeedsRefresh(true);
      const controller = new AbortController(); controllerRef.current = controller;
      const value = await batchesApi.companyDetail(id!, controller.signal);
      if (value.id !== id || (updateId && !value.updates.some(entry => entry.id === updateId))) throw new Error("Acknowledgement not found in authoritative record");
      if (cancellationAck && (value.status !== "cancelled" || value.sponsorshipCount !== 0 || value.cancelReason !== cancellation!.reason || value.cancelledAt !== cancellationAck.cancelledAt || batch!.updates.some(entry => !value.updates.some(saved => saved.id === entry.id)) || cancellationAck.updates.some(entry => !value.updates.some(saved => saved.id === entry.id)))) throw new Error("Cancellation acknowledgement not reconciled with retained observations");
      if (!current() || controller.signal.aborted) return;
      accept(value);
      if (action === "update") setUpdate(emptyUpdate());
      if (action === "cancel") { ++cancellationRevision.current; setCancellationNote(""); }
      setNotice(action === "cancel" ? tr("Cancellation acknowledged and the authoritative company record read again. The saved reason, UTC time and retained observations are shown below. No financial action, restoration or deletion was performed.", "Đã xác nhận hủy và đọc lại bản ghi công ty chính thức. Lý do đã lưu, thời điểm UTC và quan sát được giữ lại hiển thị bên dưới. Không thực hiện thao tác tài chính, khôi phục hoặc xóa.") : tr("Write acknowledged and authoritative company record read again. The displayed baseline is saved server data.", "Đã xác nhận ghi và đọc lại bản ghi công ty chính thức. Dữ liệu nền hiển thị là dữ liệu đã lưu trên máy chủ."));
      if (creating && !replaceHashRoute(batchRoute("edit", value.id, true), expectedHash)) {
        setRouteMismatch(true); setNotice(tr("Creation and server reread were confirmed, but canonical navigation was not accepted. Creation is permanently disabled on this mounted route; open the confirmed record.", "Đã xác nhận tạo và đọc lại máy chủ, nhưng chưa chấp nhận chuyển đường dẫn chuẩn. Không thể tạo thêm trên trang đang mở; hãy mở bản ghi đã xác nhận."));
      }
    } catch (failure) {
      if (current()) {
        refreshRequired.current = true; setNeedsRefresh(true);
        if (creating && !confirmedCreatedId.current) setCreateUncertain(true);
        if (action === "update") setAppendUncertain(true);
        setError(failureMessage(failure) + " " + (action === "cancel" ? acknowledged ? tr("Cancellation was acknowledged but the saved record could not be reconciled. Use Refresh to inspect the actual record before any further action. The cancellation will not be replayed.", "Đã xác nhận hủy nhưng chưa đối chiếu được bản ghi đã lưu. Dùng Làm mới để kiểm tra bản ghi thực tế trước thao tác tiếp theo. Không gửi lại yêu cầu hủy.") : tr("Cancellation failed or its outcome is unconfirmed; the server may already have cancelled the batch. Use Refresh to inspect the actual record. No automatic retry or replay is sent; repeated cancellation is a conflict, not an idempotent action.", "Hủy thất bại hoặc chưa xác nhận kết quả; máy chủ có thể đã hủy lô. Dùng Làm mới để kiểm tra bản ghi thực tế. Không tự thử lại hoặc gửi lại; hủy lặp lại là xung đột, không phải thao tác có thể gửi lại an toàn.") : acknowledged ? tr("The write was acknowledged but the saved record could not be reconciled. Refresh before any further action.", "Đã xác nhận ghi nhưng chưa đối chiếu được bản ghi đã lưu. Làm mới trước thao tác tiếp theo.") : tr("Outcome is not confirmed; the server may already have written it. No automatic replay was sent. Inspect the company list or refresh the saved record.", "Chưa xác nhận kết quả; máy chủ có thể đã ghi. Không tự động gửi lại. Kiểm tra danh sách công ty hoặc làm mới bản ghi đã lưu.")));
      }
    } finally { locked.current = false; if (current()) setBusy(false); }
  }
  function saveForm(event: FormEvent) { event.preventDefault(); if (!blocked && !locked.current && !readPending.current && !refreshRequired.current) setConfirm("save"); }
  function field(key: Exclude<keyof DraftForm, "shareUnitType" | "images" | "costs" | "facilityId">, type = "text", optional = false) {
    const multiline = key === "description" || key === "riskDisclosure";
    const limits: Record<string, number> = { title: 120, species: 80, breed: 80, description: 4000, location: 160, region: 80, riskDisclosure: 4000, termsVersion: 60 };
    const id = `company-batch-${key}`;
    return <div className={`batch-field ${multiline ? "batch-wide" : ""}`} key={key}><label htmlFor={id}>{labels[key]}</label>{multiline ? <textarea id={id} rows={5} required minLength={20} maxLength={4000} value={form[key]} onChange={event => set(key, event.target.value)} /> : <input id={id} type={type} required={!optional} min={type === "number" ? key === "contingencyPct" ? 0 : 1 : undefined} max={type === "number" ? key === "contingencyPct" ? 100 : 2147483647 : undefined} step={type === "datetime-local" ? "any" : type === "number" ? 1 : undefined} maxLength={limits[key]} value={form[key]} onChange={event => set(key, event.target.value)} />}{optional && baseline[key] && key !== "breed" && <small>{tr("Clearing this existing optional value is unsupported by the API and is blocked. Replace it instead.", "API không hỗ trợ xóa giá trị tùy chọn đã có; thao tác bị chặn. Có thể thay giá trị khác.")}</small>}</div>;
  }
  const filtered = rows.filter(value => `${value.id} ${value.title} ${value.species}`.toLowerCase().includes(search.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const selectedFacility = facilities.find(value => value.id === form.facilityId);
  let summary: ReturnType<typeof batchShareSummary> | null = null;
  try { summary = batchShareSummary(inputFromForm(form, mode === "new" ? undefined : baseline)); } catch { /* Incomplete local input has no budget preview. */ }
  const savedVerification = visible?.facility?.verification;
  const complianceReady = !!savedVerification && savedVerification.status === "approved" && savedVerification.level !== "none" && !!savedVerification.validUntil && new Date(savedVerification.validUntil).getTime() > Date.now() && savedVerification.documents.length > 0 && savedVerification.documents.every(doc => doc.controlled);
  let savedBudget: ReturnType<typeof batchShareSummary> | null = null;
  if (visible?.shareQuantity != null) {
    try { savedBudget = batchShareSummary({ stockCount: visible.stockCount, shareUnitType: visible.shareUnitType, shareQuantity: visible.shareQuantity, expectedHarvestWeightG: visible.expectedHarvestWeightG ?? undefined, packagePricePerShare: visible.packagePricePerShare, costs: visible.costs.map(cost => ({ category: cost.category, label: cost.label, amount: cost.amount, allocation: cost.allocation, note: cost.note ?? undefined })) }); } catch { /* Legacy data may not support a share summary. */ }
  }
  if (!sameSession()) return <main className="public-market company-batches"><h1>{tr("Company batches", "Lô công ty")}</h1><p role="alert">{tr("An active Admin session is required. Private records and controls are hidden.", "Cần phiên quản trị viên đang hoạt động. Dữ liệu riêng tư và thao tác đã được ẩn.")}</p></main>;
  return <main className="public-market company-batches">
    <div className="public-market-heading"><div><a href="#company/batches">{tr("Shared company batches", "Lô công ty dùng chung")}</a><h1>{mode === "list" ? tr("Company batches", "Lô công ty") : mode === "new" ? tr("Create complete batch draft", "Tạo bản nháp lô đầy đủ") : mode === "edit" ? tr("Edit batch draft", "Sửa bản nháp lô") : tr("Company batch detail", "Chi tiết lô công ty")}</h1><p>{tr("All Admins manage the same company batches. Creator identity is attribution, not ownership. This screen does not manage sponsoring, payments, harvest or the ledger.", "Mọi quản trị viên quản lý chung lô công ty. Người tạo là thông tin ghi nhận, không phải sở hữu. Trang này không quản lý tài trợ, thanh toán, thu hoạch hay sổ cái.")}</p></div></div>
    {error && <p role="alert" className="batch-notice">{error}</p>}{notice && <p role="status" className="batch-notice">{notice}</p>}{loading && <p role="status">{tr("Reading server records…", "Đang đọc bản ghi máy chủ…")}</p>}{busy && <p role="status">{tr("Sending one write and reconciling its server record…", "Đang gửi một thao tác ghi và đối chiếu bản ghi máy chủ…")}</p>}
    <div className="batch-actions">{mode === "list" && <a href="#company/batches/new">{tr("Create draft", "Tạo bản nháp")}</a>}<button disabled={loading || busy} onClick={refresh}>{tr("Refresh server data", "Làm mới dữ liệu máy chủ")}</button></div>
    {needsRefresh && <p className="batch-notice">{tr("Private data and writes are hidden or blocked until a successful authoritative reread. Refresh discards local changes.", "Dữ liệu riêng tư và thao tác ghi bị ẩn hoặc khóa đến khi đọc lại bản ghi chính thức thành công. Làm mới sẽ bỏ thay đổi cục bộ.")}</p>}
    {createUncertain && <p className="batch-notice">{tr("Creation outcome is unknown and there is no idempotency key. Resubmission is blocked on this mounted route. Inspect the shared list and open an existing record if it was created before starting any new draft.", "Chưa rõ kết quả tạo và không có khóa chống trùng. Trang đang mở chặn gửi tạo lại. Kiểm tra danh sách chung và mở bản ghi nếu đã được tạo trước khi bắt đầu bản nháp mới.")} <a href="#company/batches">{tr("Inspect company list", "Kiểm tra danh sách công ty")}</a></p>}
    {(createdId || routeMismatch) && <p className="batch-notice">{tr("Writes are disabled on this route if canonical navigation failed. No existing or confirmed-created record is turned into a new creation.", "Thao tác ghi bị khóa trên trang nếu chuyển đường dẫn chuẩn thất bại. Không biến bản ghi hiện có hoặc đã xác nhận tạo thành thao tác tạo mới.")} {(createdId || batch?.id) && <a href={batchRoute("edit", createdId ?? batch!.id, true)}>{tr("Open confirmed record", "Mở bản ghi đã xác nhận")}</a>}</p>}
    {mode === "list" && <><div className="batch-form-grid"><div><label htmlFor="company-batch-status">{tr("Server status filter", "Lọc trạng thái máy chủ")}</label><select id="company-batch-status" disabled={busy || loading} value={status} onChange={event => { setLoading(true); setStatus(event.target.value as BatchStatus | "all"); }}><option value="all">{tr("All statuses", "Tất cả trạng thái")}</option>{batchStatuses.map(value => <option key={value} value={value}>{batchStatusLabel(value, language)}</option>)}</select></div><div><label htmlFor="company-batch-search">{tr("Local search · loaded title, code or species", "Tìm cục bộ · tiêu đề, mã hoặc loài đã tải")}</label><input id="company-batch-search" disabled={busy} value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></div></div>{!loading && !busy && !needsRefresh && !error && <><p>{filtered.length} {tr("loaded matching records · local pagination", "bản ghi đã tải phù hợp · phân trang cục bộ")}</p>{!filtered.length ? <p>{tr("No company batches match the selected status and local search.", "Không có lô công ty khớp trạng thái và tìm kiếm cục bộ.")}</p> : <div className="batch-table-wrap"><table><caption>{tr("Shared batch list", "Danh sách lô dùng chung")}</caption><thead><tr>{[tr("Batch", "Lô"), tr("Status", "Trạng thái"), tr("Available / total shares", "Phần còn / tổng"), tr("Package price · VND/share", "Giá gói · VND/phần"), tr("Creator", "Người tạo"), tr("Actions", "Thao tác")].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{filtered.slice((Math.min(page, pages) - 1) * 10, Math.min(page, pages) * 10).map(value => <tr key={value.id}><td><a href={batchRoute("detail", value.id, true)}>{value.title}</a><br />{value.id}</td><td>{batchStatusLabel(value.status, language)}</td><td>{value.sharesAvailable} / {value.totalShares}</td><td>{value.packagePricePerShare.toLocaleString(language === "vi" ? "vi-VN" : "en-US")}</td><td>{value.createdBy?.name ?? tr("Not recorded", "Chưa ghi nhận")}</td><td><a href={batchRoute("detail", value.id, true)}>{tr("Read", "Đọc")}</a>{canEditBatch(value.status) && <> · <a href={batchRoute("edit", value.id, true)}>{tr("Edit draft", "Sửa nháp")}</a></>}</td></tr>)}</tbody></table></div>}<nav className="public-market-pages" aria-label={tr("Local batch pagination", "Phân trang lô cục bộ")}><button disabled={page <= 1} onClick={() => setPage(value => value - 1)}>{tr("Previous", "Trước")}</button><span>{Math.min(page, pages)} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(value => value + 1)}>{tr("Next", "Sau")}</button></nav></>}</>}
    {visible && <><section className="batch-panel"><h2>{visible.id} · {batchStatusLabel(visible.status, language)}</h2><p>{tr("Creator", "Người tạo")}: {visible.createdBy?.name ?? tr("Not recorded", "Chưa ghi nhận")}</p><div className="batch-actions">{mode === "detail" && canEditBatch(visible.status) && <a href={batchRoute("edit", visible.id, true)}>{tr("Edit this saved draft", "Sửa bản nháp đã lưu")}</a>}{visible.status === "open" && <a href={batchRoute("detail", visible.id)}>{tr("Try public view · visibility is checked by server", "Mở trang công khai · máy chủ kiểm tra hiển thị")}</a>}</div>{!canEditBatch(visible.status) && <p>{tr("Draft editing is unavailable in this status. No review or delete controls are provided here.", "Không thể sửa nháp ở trạng thái này. Không có thao tác xét duyệt hoặc xóa tại đây.")}</p>}</section></>}
    {editable && !busy && !loading && !needsRefresh && !createUncertain && !routeMismatch && <form onSubmit={saveForm}>
      <fieldset disabled={blocked || !!confirm || !!facilityError || !facilities.length}><legend>{tr("Complete draft content", "Nội dung nháp đầy đủ")}</legend><div className="batch-form-grid">{field("title")}{field("species")}{field("breed", "text", true)}{field("description")}{field("location")}{field("region")}{field("stockingDate", "datetime-local", true)}{field("expectedHarvestDate", "datetime-local", true)}{field("stockCount", "number")}<div className="batch-field"><label htmlFor="company-batch-unit">{labels.shareUnitType}</label><select id="company-batch-unit" value={form.shareUnitType} onChange={event => set("shareUnitType", event.target.value as DraftForm["shareUnitType"])}><option value="count">{tr("Fish count", "Số con")}</option><option value="weight">{tr("Weight in grams", "Khối lượng gam")}</option></select></div>{field("shareQuantity", "number")}{form.shareUnitType === "weight" && field("expectedHarvestWeightG", "number", !baseline.expectedHarvestWeightG)}{field("packagePricePerShare", "number")}{field("contingencyPct", "number")}{field("riskDisclosure")}{field("termsVersion")}<div className="batch-field"><label htmlFor="company-batch-facility">{labels.facilityId}</label><select id="company-batch-facility" required value={form.facilityId} onChange={event => set("facilityId", event.target.value)}><option value="">{tr("Select an existing facility", "Chọn cơ sở hiện có")}</option>{facilities.map(value => <option key={value.id} value={value.id}>{value.name} · {value.location}</option>)}</select>{form.facilityId && !selectedFacility && <p>{tr("The saved facility is not in the current directory. Choose an existing returned facility; no fallback is created.", "Cơ sở đã lưu không có trong danh mục hiện tại. Chọn cơ sở máy chủ trả về; không tạo cơ sở thay thế.")}</p>}</div></div>
      <p>{tr("Dates are entered and sent as UTC. Weight shares use whole-batch expected biomass ÷ grams per share; count shares use stocked fish ÷ fish per share, rounded down. Expected biomass is not average fish weight. Changing to count shares lets the server remove weight biomass; clearing existing dates or weight biomass otherwise is unsupported.", "Ngày được nhập và gửi theo UTC. Phần khối lượng dùng sinh khối dự kiến toàn lô ÷ gam mỗi phần; phần số con dùng số cá thả ÷ con mỗi phần, làm tròn xuống. Sinh khối dự kiến không phải khối lượng cá trung bình. Đổi sang phần số con cho phép máy chủ bỏ sinh khối; ngoài ra không hỗ trợ xóa ngày hoặc sinh khối đã có.")}</p>
      <h2>{tr("Integer VND cost lines", "Dòng chi phí số nguyên VND")}</h2><p>{tr("Per-share costs multiply by total shares; whole-batch costs count once. Contingency percentage is metadata, not an automatic addition. Include any contingency as a cost line. Arrays are replaced only when changed; all Admins share this record without version locking.", "Chi phí mỗi phần nhân tổng số phần; chi phí toàn lô tính một lần. Tỷ lệ dự phòng là thông tin, không tự cộng. Ghi chi phí dự phòng vào một dòng. Mảng chỉ bị thay thế khi có đổi; mọi quản trị viên dùng chung bản ghi, không có khóa phiên bản.")}</p>
      {form.costs.map((cost, index) => <fieldset className="batch-cost-row" key={index}><legend>{tr("Cost line", "Dòng chi phí")} {index + 1}</legend><div className="batch-form-grid">{(["category", "label", "allocation", "amount", "note"] as const).map(key => <div className="batch-field" key={key}><label htmlFor={`batch-cost-${index}-${key}`}>{key === "category" ? tr("Category", "Loại") : key === "label" ? tr("Label", "Nhãn") : key === "allocation" ? tr("Allocation", "Phân bổ") : key === "amount" ? tr("Amount · integer VND", "Số tiền · số nguyên VND") : tr("Note · optional", "Ghi chú · tùy chọn")}</label>{key === "category" || key === "allocation" ? <select id={`batch-cost-${index}-${key}`} value={cost[key]} onChange={event => set("costs", form.costs.map((value, position) => position === index ? { ...value, [key]: event.target.value } as CostForm : value))}>{key === "category" ? costCategories.map(category => <option key={category} value={category}>{categories[category]}</option>) : <><option value="per_share">{tr("Per share", "Mỗi phần")}</option><option value="batch_total">{tr("Whole batch", "Toàn lô")}</option></>}</select> : <input id={`batch-cost-${index}-${key}`} type={key === "amount" ? "number" : "text"} required={key !== "note"} min={key === "amount" ? 0 : undefined} max={key === "amount" ? 2147483647 : undefined} step={key === "amount" ? 1 : undefined} maxLength={key === "note" ? 500 : key === "label" ? 120 : undefined} value={cost[key]} onChange={event => set("costs", form.costs.map((value, position) => position === index ? { ...value, [key]: event.target.value } : value))} />}</div>)}</div><button type="button" onClick={() => set("costs", form.costs.filter((_, position) => position !== index))}>{tr("Remove cost line", "Gỡ dòng chi phí")} {index + 1}</button></fieldset>)}<button type="button" disabled={form.costs.length >= 30} onClick={() => set("costs", [...form.costs, { category: "feed", label: "", amount: "", allocation: "per_share", note: "" }])}>{tr("Add cost line · maximum 30", "Thêm dòng chi phí · tối đa 30")}</button>
      <h2>{tr("Existing public media URLs", "URL ảnh công khai hiện có")}</h2><p>{tr("Up to 12 batch images; the first image is the cover. Use HTTP(S) URLs or existing /uploads URLs registered for batch_image. Update photos must be registered for batch_update. Listing images and private compliance files are not interchangeable. This screen does not upload files or delete hosted files.", "Tối đa 12 ảnh lô; ảnh đầu là ảnh chính. Dùng URL HTTP(S) hoặc URL /uploads hiện có được đăng ký cho batch_image. Ảnh cập nhật phải đăng ký cho batch_update. Ảnh tin đăng và hồ sơ tuân thủ riêng tư không dùng thay nhau. Trang không tải tệp hoặc xóa tệp đã lưu.")}</p>
      {form.images.map((url, index) => <div className="batch-image-row batch-field" key={index}><label htmlFor={`batch-image-${index}`}>{tr("Public image URL", "URL ảnh công khai")} {index + 1}{index === 0 ? tr(" · cover", " · ảnh chính") : ""}</label><input id={`batch-image-${index}`} required maxLength={500} value={url} onChange={event => set("images", form.images.map((value, position) => position === index ? event.target.value : value))} /><button type="button" onClick={() => set("images", form.images.filter((_, position) => position !== index))}>{tr("Remove URL reference", "Gỡ tham chiếu URL")} {index + 1}</button></div>)}<button type="button" disabled={form.images.length >= 12} onClick={() => set("images", [...form.images, ""])}>{tr("Add image URL", "Thêm URL ảnh")}</button>
      {selectedFacility && <p>{tr("Existing facility verification", "Tuân thủ cơ sở hiện có")}: {selectedFacility.verification?.status === "approved" ? tr("Approved", "Đã phê duyệt") : tr("Not currently approved", "Chưa được phê duyệt hiện tại")} · {tr("Valid until UTC", "Có hiệu lực đến UTC")}: {batchUtc(selectedFacility.verification?.validUntil, tr("Not recorded", "Chưa ghi nhận"))}. {tr("Selection does not approve compliance. The backend checks current approval and controlled documents when publishing.", "Lựa chọn không phê duyệt tuân thủ. Máy chủ kiểm tra phê duyệt còn hiệu lực và hồ sơ được kiểm soát khi xuất bản.")}</p>}
      {summary && <p role="status">{tr("Local draft estimate, not saved", "Ước tính nháp cục bộ, chưa lưu")}: {summary.totalShares} {tr("shares", "phần")} · {tr("Allocated costs", "Chi phí phân bổ")}: {summary.totalCost.toLocaleString()} ₫ · {tr("Package budget", "Ngân sách gói")}: {summary.packageTotal.toLocaleString()} ₫ · {summary.matches ? tr("Exact match", "Khớp chính xác") : tr("Mismatch · must match before publication", "Chưa khớp · phải khớp trước xuất bản")}</p>}
      <div className="batch-actions"><button type="submit" disabled={blocked || (!!batch && !draftDirty)}>{tr("Save draft only", "Chỉ lưu bản nháp")}</button><span>{draftDirty ? tr("Unsaved local draft changes", "Thay đổi nháp chưa lưu") : tr("No unsaved draft changes", "Không có thay đổi nháp chưa lưu")}</span></div></fieldset>
    </form>}
    {facilityError && <p role="alert" className="batch-notice">{tr("The read-only facility directory could not be loaded. Draft writes are disabled; retry server read. No fabricated facility is used.", "Không tải được danh mục cơ sở chỉ đọc. Khóa ghi nháp; thử đọc lại máy chủ. Không dùng cơ sở giả.")} {facilityError}</p>}{editable && !loading && !facilities.length && !facilityError && <p className="batch-notice">{tr("No existing facilities were returned. Draft creation/save requires an existing facility; there is no facility editor in this slice.", "Máy chủ không trả cơ sở hiện có. Tạo/lưu nháp cần cơ sở hiện có; phần này không có trình sửa cơ sở.")}</p>}
    {visible && canEditBatch(visible.status) && <section className="batch-panel"><h2>{tr("Publish saved draft separately", "Xuất bản riêng bản nháp đã lưu")}</h2><p>{tr("Save first, then publish only a clean reread server record. These are hints, not approval: the backend authoritatively checks exact costs, valid shares, at least one image and current controlled facility compliance at publication.", "Lưu trước, rồi chỉ xuất bản bản ghi đã đọc lại không còn sửa cục bộ. Đây là gợi ý, không phải phê duyệt: máy chủ kiểm tra chính xác chi phí, phần hợp lệ, ít nhất một ảnh và tuân thủ cơ sở hiện hành với hồ sơ được kiểm soát khi xuất bản.")}</p><ul><li>{savedBudget?.matches ? tr("Saved costs match package budget.", "Chi phí đã lưu khớp ngân sách gói.") : tr("Saved costs do not match package budget.", "Chi phí đã lưu chưa khớp ngân sách gói.")}</li><li>{visible.images.length ? tr("Saved image references are present.", "Đã có tham chiếu ảnh đã lưu.") : tr("At least one saved image is required.", "Cần ít nhất một ảnh đã lưu.")}</li><li>{complianceReady ? tr("Saved facility summary indicates current approval and controlled documents.", "Tóm tắt cơ sở đã lưu cho thấy phê duyệt còn hiệu lực và hồ sơ được kiểm soát.") : tr("Current approval and controlled documents need attention.", "Cần kiểm tra phê duyệt còn hiệu lực và hồ sơ được kiểm soát.")}</li></ul><button disabled={blocked || dirty || !!confirm} onClick={event => ask("publish", event.currentTarget)}>{tr("Confirm publication of saved draft", "Xác nhận xuất bản nháp đã lưu")}</button>{dirty && <p>{tr("Save or discard local changes before publication.", "Lưu hoặc bỏ thay đổi cục bộ trước khi xuất bản.")}</p>}</section>}
    {visible && mode === "detail" && <section className="batch-panel batch-cancellation" aria-labelledby="batch-cancellation-title">
      <h2 id="batch-cancellation-title">{tr("Cancel an unsponsored saved batch", "Hủy lô đã lưu chưa có bảo trợ")}</h2>
      {visible.status === "cancelled" ? <p>{tr("This saved batch is already cancelled. Cancellation reason and UTC time are shown in its saved details below; recorded observations are retained. It cannot be cancelled again or restored here.", "Lô đã lưu này đã bị hủy. Lý do và thời điểm hủy UTC hiển thị trong chi tiết đã lưu bên dưới; các quan sát đã ghi được giữ lại. Không thể hủy lại hoặc khôi phục tại đây.")}</p> : <>
        <p>{tr("Only a saved Draft, Under review or Open batch with zero sponsorship records is eligible. Available shares are not proof that a batch is unsponsored; the server rechecks its status and all sponsorship records.", "Chỉ lô đã lưu ở trạng thái Bản nháp, Đang xét duyệt hoặc Đang mở và không có bản ghi bảo trợ nào mới đủ điều kiện. Số phần còn lại không chứng minh lô chưa có bảo trợ; máy chủ kiểm tra lại trạng thái và toàn bộ bản ghi bảo trợ.")}</p>
        <p>{tr("Saved sponsorship record count", "Số bản ghi bảo trợ đã lưu")}: <strong>{visible.sponsorshipCount}</strong> · {tr("Saved status", "Trạng thái đã lưu")}: <strong>{batchStatusLabel(visible.status, language)}</strong></p>
        {cancellationEligible ? <form onSubmit={askCancellation}>
          <fieldset disabled={blocked || draftDirty || updateDirty || !!confirm || cancellationAttempted.current}>
            <legend>{tr("Cancellation reason", "Lý do hủy")}</legend>
            <p id="batch-cancellation-warning" className="batch-cancellation-warning">{tr("Cancellation changes the batch to Cancelled and stores this reason and a server UTC time. It retains the batch and all recorded observations. It performs no refund, payment or order change, does not delete anything, and offers no restoration. Repeating cancellation is a conflict, not a safe retry.", "Hủy chuyển lô sang Đã hủy và lưu lý do cùng thời điểm UTC của máy chủ. Lô và mọi quan sát đã ghi được giữ lại. Không hoàn tiền, thanh toán hoặc thay đổi đơn hàng, không xóa dữ liệu và không có thao tác khôi phục. Hủy lặp lại là xung đột, không phải cách thử lại an toàn.")}</p>
            <div className="batch-field">
              <label htmlFor="batch-cancellation-note">{tr("Reason · required, 1–1,000 characters after trimming", "Lý do · bắt buộc, 1–1.000 ký tự sau khi bỏ khoảng trắng đầu và cuối")}</label>
              <textarea id="batch-cancellation-note" rows={4} required value={cancellationNote} aria-describedby={`batch-cancellation-length batch-cancellation-warning${cancellationDirty && !cancellationValid ? " batch-cancellation-error" : ""}`} aria-invalid={cancellationDirty && !cancellationValid ? true : undefined} onChange={event => changeCancellationNote(event.target.value)} />
              <small id="batch-cancellation-length" aria-live="polite">{cancellationLength} / 1,000 · {tr("Length after trimming, using the server's character counting rules.", "Độ dài sau khi bỏ khoảng trắng đầu và cuối, theo cách đếm ký tự của máy chủ.")}</small>
              {cancellationDirty && !cancellationValid && <p id="batch-cancellation-error" role="alert">{cancellationValidationMessage}</p>}
            </div>
            <div className="batch-actions"><button type="submit" disabled={!cancellationValid}>{tr("Review cancellation of this saved batch", "Kiểm tra trước khi hủy lô đã lưu này")}</button>{cancellationDirty && <span>{tr("Unsaved cancellation reason · leaving or refreshing requires discard confirmation", "Lý do hủy chưa lưu · rời trang hoặc làm mới cần xác nhận bỏ thay đổi")}</span>}</div>
          </fieldset>
          {(draftDirty || updateDirty) && <p>{tr("Save or discard local draft/observation changes before cancellation. Refresh discards local changes and reads the saved record.", "Lưu hoặc bỏ thay đổi nháp/quan sát cục bộ trước khi hủy. Làm mới sẽ bỏ thay đổi cục bộ và đọc bản ghi đã lưu.")}</p>}
        </form> : <p>{tr("Cancellation is unavailable for this saved status or sponsorship count. No cancellation request can be sent from this record.", "Không thể hủy với trạng thái hoặc số bản ghi bảo trợ đã lưu này. Không thể gửi yêu cầu hủy từ bản ghi này.")}</p>}
      </>}
    </section>}
    {visible && <BatchDetails batch={visible} />}
    {appendUncertain && <section className="batch-notice"><h2>{tr("Inspect before another append", "Kiểm tra trước khi ghi thêm")}</h2><p>{tr("The previous append may already exist, and there is no idempotency key. Refresh and inspect the actual feed before deciding; this control never retries the old request. Enter only a genuinely new observation after confirming inspection.", "Lần ghi thêm trước có thể đã tồn tại và không có khóa chống trùng. Làm mới và kiểm tra cập nhật thực tế trước khi quyết định; nút này không gửi lại yêu cầu cũ. Chỉ nhập quan sát thực sự mới sau khi xác nhận đã kiểm tra.")}</p><button disabled={busy || loading || needsRefresh || !visible} onClick={() => { if (locked.current || !visible || needsRefresh) return; setAppendUncertain(false); setUpdate(emptyUpdate()); setNotice(tr("Feed inspection confirmed. The unconfirmed append was not replayed; enter a new observation only.", "Đã xác nhận kiểm tra cập nhật. Không gửi lại lần ghi chưa xác nhận; chỉ nhập quan sát mới.")); }}>{tr("I inspected the refreshed feed; clear local append without replay", "Tôi đã kiểm tra cập nhật mới tải; bỏ nhập cục bộ, không gửi lại")}</button></section>}
    {visible && canPostBatchUpdate(visible.status) && <form className="batch-panel" onSubmit={event => { event.preventDefault(); if (!blocked && !locked.current && !readPending.current && !refreshRequired.current && !cancellationDirty) setConfirm("update"); }}><fieldset disabled={blocked || draftDirty || cancellationDirty || !!confirm}><legend>{tr("Append a recorded growth observation", "Ghi thêm quan sát tăng trưởng")}</legend><p>{tr("Append-only; no edit or deletion. Posting an observation does not advance the batch status. Empty optional measurements are not recorded, not zero. A real count of zero is allowed.", "Chỉ ghi thêm; không sửa hoặc xóa. Ghi quan sát không chuyển trạng thái lô. Đo lường tùy chọn để trống là chưa ghi nhận, không phải số không. Cho phép số cá thực tế bằng không.")}</p><div className="batch-form-grid"><div className="batch-field"><label htmlFor="batch-update-stage">{labels.stage}</label><select id="batch-update-stage" value={update.stage} onChange={event => setUpdate(value => ({ ...value, stage: event.target.value as BatchStage }))}>{batchStages.map(stage => <option key={stage} value={stage}>{batchStageLabel(stage, language)}</option>)}</select></div>{(["averageWeightG", "countAlive", "note", "photoUrls"] as const).map(key => <div className={`batch-field ${key === "note" || key === "photoUrls" ? "batch-wide" : ""}`} key={key}><label htmlFor={`batch-update-${key}`}>{labels[key]}{key === "photoUrls" && tr(" · one per line, maximum 10", " · mỗi dòng một URL, tối đa 10")}</label>{key === "note" || key === "photoUrls" ? <textarea id={`batch-update-${key}`} rows={3} maxLength={key === "note" ? 2000 : undefined} value={update[key]} onChange={event => setUpdate(value => ({ ...value, [key]: event.target.value }))} /> : <input id={`batch-update-${key}`} type="number" min={key === "countAlive" ? 0 : 1} max={2147483647} step={1} value={update[key]} onChange={event => setUpdate(value => ({ ...value, [key]: event.target.value }))} />}</div>)}</div><div className="batch-actions"><button type="submit">{tr("Confirm append once", "Xác nhận ghi thêm một lần")}</button><button type="button" onClick={() => { if (window.confirm(tr("Discard this local observation?", "Bỏ quan sát nhập cục bộ?"))) setUpdate(emptyUpdate()); }}>{tr("Discard local observation", "Bỏ quan sát cục bộ")}</button></div></fieldset></form>}
    {visible && canPostBatchUpdate(visible.status) && cancellationDirty && <p>{tr("Discard the local cancellation reason with Refresh before entering or posting an observation.", "Bỏ lý do hủy cục bộ bằng Làm mới trước khi nhập hoặc ghi quan sát.")}</p>}
    {visible && !canPostBatchUpdate(visible.status) && <p>{tr("Appending growth observations is unavailable in this batch status.", "Không thể ghi thêm quan sát tăng trưởng ở trạng thái lô này.")}</p>}
    {confirm === "cancel" && cancellationConfirmation && cancellationConfirmationCurrent && <section ref={confirmRef} tabIndex={-1} role="group" aria-labelledby="batch-cancel-confirm-title" className="batch-notice batch-cancellation-confirmation">
      <h2 id="batch-cancel-confirm-title">{tr("Confirm cancellation of this saved batch", "Xác nhận hủy lô đã lưu này")}</h2>
      <dl className="batch-facts"><div><dt>{tr("Saved name", "Tên đã lưu")}</dt><dd>{cancellationConfirmation.title}</dd></div><div><dt>{tr("Batch code", "Mã lô")}</dt><dd>{cancellationConfirmation.id}</dd></div><div><dt>{tr("Saved status", "Trạng thái đã lưu")}</dt><dd>{batchStatusLabel(cancellationConfirmation.status, language)}</dd></div><div><dt>{tr("Saved sponsorship records", "Bản ghi bảo trợ đã lưu")}</dt><dd>{cancellationConfirmation.sponsorshipCount}</dd></div><div><dt>{tr("Reason to be saved", "Lý do sẽ được lưu")}</dt><dd className="batch-copy">{cancellationConfirmation.reason}</dd></div></dl>
      <p>{tr("Send exactly one cancellation for this code, saved status and reason? The server rechecks eligibility. This retains the batch and recorded observations, performs no refund/payment/order change, deletes nothing and provides no restoration. Repeated cancellation conflicts. After acknowledgement, the authoritative company detail must be read again before any actions; a failed or uncertain request requires Refresh, never automatic replay.", "Gửi đúng một yêu cầu hủy cho mã lô, trạng thái đã lưu và lý do này? Máy chủ kiểm tra lại điều kiện. Lô và quan sát đã ghi được giữ lại, không hoàn tiền/thanh toán/thay đổi đơn hàng, không xóa dữ liệu và không có khôi phục. Hủy lặp lại gây xung đột. Sau khi xác nhận, phải đọc lại chi tiết công ty chính thức trước mọi thao tác; yêu cầu thất bại hoặc chưa rõ kết quả cần Làm mới, không tự gửi lại.")}</p>
      <div className="batch-actions"><button className="batch-cancellation-submit" disabled={blocked || !cancellationConfirmationCurrent || cancellationAttempted.current} onClick={() => void act("cancel")}>{tr("Cancel this batch once", "Hủy lô này một lần")}</button><button onClick={cancelConfirmation}>{tr("Keep batch unchanged", "Giữ nguyên lô")}</button></div>
    </section>}
    {confirm && confirm !== "cancel" && !busy && !loading && !needsRefresh && <section ref={confirmRef} tabIndex={-1} role="group" aria-labelledby="batch-confirm-title" className="batch-notice"><h2 id="batch-confirm-title">{confirm === "publish" ? tr("Confirm public visibility", "Xác nhận hiển thị công khai") : confirm === "update" ? tr("Confirm append-only observation", "Xác nhận quan sát chỉ ghi thêm") : tr("Confirm draft save", "Xác nhận lưu nháp")}</h2><p><strong>{batch?.id ?? tr("New draft · no code assigned yet", "Nháp mới · chưa cấp mã")} · {confirm === "save" ? form.title : batch?.title}</strong></p>{confirm === "publish" && batch && <><p>{batch.totalShares} {tr("shares", "phần")} · {batch.shareQuantity} {batch.shareUnitType === "weight" ? tr("grams/share", "gam/phần") : tr("fish/share", "con/phần")} · {batch.packagePricePerShare.toLocaleString()} ₫ {tr("per share", "mỗi phần")} · {tr("Allocated cost / package total", "Tổng chi phí / tổng gói")}: {savedBudget?.totalCost.toLocaleString()} / {savedBudget?.packageTotal.toLocaleString()} ₫</p><p>{tr("Publish this saved draft as open? It is publicly visible only while shares are available and the facility has current approved compliance backed by controlled documents. Publication is separate from saving and creates no order, payment, refund or harvest promise.", "Xuất bản nháp đã lưu sang trạng thái mở? Lô chỉ công khai khi còn phần và cơ sở có tuân thủ phê duyệt còn hiệu lực với hồ sơ được kiểm soát. Xuất bản tách khỏi lưu và không tạo cam kết đơn hàng, thanh toán, hoàn tiền hay thu hoạch.")}</p></>}{confirm === "save" && <p>{tr("Save this complete draft content only? No publication is performed. Only changed fields are sent for an existing draft; a changed array replaces that entire array.", "Chỉ lưu nội dung nháp đầy đủ này? Không xuất bản. Nháp hiện có chỉ gửi trường đã đổi; mảng đã đổi sẽ thay toàn bộ mảng.")}</p>}{confirm === "update" && <p>{batchStageLabel(update.stage, language)} · {tr("This observation is recorded once with a server UTC timestamp. There is no edit/delete or automatic retry, and it does not advance batch status.", "Quan sát ghi một lần với thời điểm UTC máy chủ. Không sửa/xóa hoặc tự gửi lại và không chuyển trạng thái lô.")}</p>}<div className="batch-actions"><button disabled={blocked} onClick={() => void act(confirm)}>{tr("Confirm once", "Xác nhận một lần")}</button><button onClick={cancelConfirmation}>{tr("Keep unchanged", "Giữ nguyên")}</button></div></section>}
  </main>;
}
