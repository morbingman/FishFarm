import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "@/context/LanguageContext";
import { apiSessionStamp, errorMessage, isApiSession } from "@/services/api";
import { useUser } from "@/services/session";
import {
  replaceHashRoute,
  useHashTransitionGuard,
} from "@/services/hashNavigation";
import { facilitiesApi } from "@/services/facilitiesApi";
import {
  facilityLevels,
  facilityTextLength,
  facilityRoute,
  FacilityValidationError,
  normalizeFacilityInput,
  normalizeVerificationInput,
  normalizeFacilityDecision,
  validateFacilityDocument,
  verificationLevelLabel,
  verificationStatusLabel,
  verificationStatuses,
} from "@/services/facilities";
import FacilityVerification, {
  facilityUtc,
} from "@/components/facilities/FacilityVerification";
import "./CompanyFacilities.css";

type Mode = "list" | "new" | "detail" | "submit" | "review-list" | "review";
type Facility = Awaited<ReturnType<typeof facilitiesApi.detail>>;
type Verification = Awaited<ReturnType<typeof facilitiesApi.verification>>;
type Level = Verification["level"];
type Status = Verification["status"];
type FacilityInput = Parameters<typeof facilitiesApi.create>[0];
type SubmitInput = Parameters<typeof facilitiesApi.submit>[1];
type DecisionInput = Parameters<typeof facilitiesApi.inspect>[1];
type PendingDocument = {
  uploadId: string;
  type: string;
  mimeType: string;
  sizeBytes: number;
};
type ComplianceForm = {
  level: Level | "";
  status: Exclude<Status, "pending"> | "";
  inspectedAt: string;
  validUntil: string;
  inspector: string;
  notes: string;
  includeInspector: boolean;
  includeNotes: boolean;
};
type Confirmation =
  | { action: "create"; input: FacilityInput }
  | {
      action: "submit";
      input: SubmitInput;
      facility: Facility;
      savedStatus: Status | null;
    }
  | {
      action: "inspect";
      input: DecisionInput;
      facility: Facility;
      savedStatus: Status;
    };
const emptyFacility = () => ({ name: "", location: "", region: "" });
const emptyCompliance = (level: Level | "" = ""): ComplianceForm => ({
  level,
  status: "",
  inspectedAt: "",
  validUntil: "",
  inspector: "",
  notes: "",
  includeInspector: false,
  includeNotes: false,
});
function utcDate(value: string, field: string) {
  if (!value) return undefined;
  const date = new Date(`${value}Z`);
  if (Number.isNaN(date.getTime())) throw new FacilityValidationError(field);
  return date.toISOString();
}

export default function CompanyFacilities({
  mode,
  facilityId,
}: {
  mode: Mode;
  facilityId: string | null;
}) {
  const { language } = useTranslation();
  const user = useUser();
  const tr = (en: string, vi: string) => (language === "vi" ? vi : en);
  const missing = tr("Not recorded", "Chưa ghi nhận");
  const [stamp] = useState(apiSessionStamp);
  const [rows, setRows] = useState<Facility[]>([]);
  const [facility, setFacility] = useState<Facility | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [form, setForm] = useState(emptyFacility);
  const [compliance, setCompliance] = useState<ComplianceForm>(emptyCompliance);
  const [baseline, setBaseline] = useState<ComplianceForm>(emptyCompliance);
  const [documents, setDocuments] = useState<PendingDocument[]>([]);
  const [uploadType, setUploadType] = useState("");
  const [uploadUncertain, setUploadUncertain] = useState(false);
  const [referencesUncertain, setReferencesUncertain] = useState(false);
  const [createUncertain, setCreateUncertain] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status | "all" | "missing">("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const locked = useRef(false);
  const alive = useRef(true);
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const confirmedCreatedId = useRef<string | null>(null);
  const createOutcomeUnknown = useRef(false);
  const confirmationPanel = useRef<HTMLElement | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const sameSession = () =>
    isApiSession(stamp) &&
    stamp?.role === "Admin" &&
    user?.role === "Admin" &&
    user.status === "active";
  const sessionValid = sameSession();
  const isList = mode === "list" || mode === "review-list";
  const admin = mode === "review";
  const formDirty = JSON.stringify(form) !== JSON.stringify(emptyFacility());
  const complianceDirty =
    JSON.stringify(compliance) !== JSON.stringify(baseline);
  const dirty =
    (mode === "new" && formDirty && !createdId) ||
    complianceDirty ||
    documents.length > 0 ||
    !!uploadType ||
    uploadUncertain ||
    referencesUncertain;
  const blocked = busy || loading || needsRefresh || !sessionValid;
  const visible = !blocked ? facility : null;
  const privateVisible = !blocked;
  const setComplianceField = <K extends keyof ComplianceForm>(
    key: K,
    value: ComplianceForm[K],
  ) => setCompliance((current) => ({ ...current, [key]: value }));
  const failureMessage = (failure: unknown) =>
    failure instanceof FacilityValidationError
      ? tr("Check field: ", "Kiểm tra trường: ") + failure.field
      : errorMessage(failure, language);
  const leaveMessage = tr(
    "Leave and discard local form changes and pending upload references? Uploads may remain on the server; this page cannot look up or delete orphaned files.",
    "Rời trang và bỏ thay đổi biểu mẫu cùng tham chiếu tải lên chờ gửi? Tệp có thể còn trên máy chủ; trang không thể tra cứu hoặc xóa tệp không được liên kết.",
  );
  useHashTransitionGuard(
    () =>
      !sameSession() ||
      (!locked.current && (!dirty || window.confirm(leaveMessage))),
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      ++sequence.current;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (sameSession() && (dirty || locked.current)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, sessionValid]);
  useEffect(() => {
    if (confirmation) confirmationPanel.current?.focus();
  }, [confirmation]);
  function resetCompliance(value: Verification | null) {
    const next = emptyCompliance(
      mode === "submit" ? (value?.level ?? "none") : "",
    );
    setCompliance(next);
    setBaseline(next);
    setDocuments([]);
    setUploadType("");
  }
  async function readSaved(id: string, signal: AbortSignal) {
    const saved = await facilitiesApi.detail(id, signal);
    if (saved.id !== id) throw new Error("Unexpected facility record");
    const savedVerification = admin
      ? await facilitiesApi.verification(id, true, signal)
      : saved.verification;
    return { saved, savedVerification };
  }
  useEffect(() => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const read = ++sequence.current;
    const expectedHash = window.location.hash;
    const current = () =>
      alive.current &&
      !abort.signal.aborted &&
      read === sequence.current &&
      sameSession();
    setLoading(true);
    setRows([]);
    setFacility(null);
    setVerification(null);
    setConfirmation(null);
    setError("");
    if (!sessionValid) {
      setForm(emptyFacility());
      resetCompliance(null);
      setUploadUncertain(false);
      setReferencesUncertain(false);
      setLoading(false);
      return () => abort.abort();
    }
    // A confirmed creation remains a read of that exact ID, never another POST.
    const id = mode === "new" ? confirmedCreatedId.current : facilityId;
    const pending = isList
      ? facilitiesApi.list(abort.signal).then((values) => {
          if (current()) {
            setRows(values);
            setPage(1);
            setNeedsRefresh(false);
            resetCompliance(null);
          }
        })
      : id
        ? readSaved(id, abort.signal).then(({ saved, savedVerification }) => {
            if (!current()) return;
            setFacility(saved);
            setVerification(savedVerification);
            resetCompliance(savedVerification);
            setNeedsRefresh(false);
            if (
              mode === "review" &&
              /^#admin\/facilities\/[^/]+$/.test(expectedHash) &&
              !dirty &&
              !locked.current
            ) {
              const canonical = facilityRoute("review", saved.id);
              if (!replaceHashRoute(canonical, expectedHash))
                setNotice(
                  tr(
                    "The recorded review alias could not be replaced. Use the canonical review link; no write was sent.",
                    "Không thể thay đường dẫn xét duyệt đã ghi. Dùng liên kết xét duyệt chuẩn; không gửi thao tác ghi.",
                  ),
                );
            }
          })
        : mode === "new"
          ? Promise.resolve().then(() => {
              if (current()) {
                setForm(emptyFacility());
                resetCompliance(null);
                setNeedsRefresh(false);
              }
            })
          : Promise.reject(new Error("Missing facility ID"));
    void pending
      .catch((failure) => {
        if (current()) {
          setError(failureMessage(failure));
          setNeedsRefresh(true);
        }
      })
      .finally(() => {
        if (current()) setLoading(false);
      });
    return () => abort.abort();
  }, [mode, facilityId, reload, sessionValid]);
  function refresh() {
    if (locked.current || loading || !sameSession()) return;
    if (
      dirty &&
      !window.confirm(
        tr(
          "Discard local fields and confirmed pending references, then read authoritative server data? Unconfirmed upload/submission warnings remain until you explicitly acknowledge them. No hosted file is deleted.",
          "Bỏ trường cục bộ và tham chiếu chờ gửi đã xác nhận, rồi đọc dữ liệu máy chủ chính thức? Cảnh báo tải lên/gửi chưa rõ kết quả vẫn giữ đến khi bạn xác nhận bỏ qua. Không xóa tệp đã lưu.",
        ),
      )
    )
      return;
    setForm(emptyFacility());
    resetCompliance(null);
    setLoading(true);
    setConfirmation(null);
    setReload((value) => value + 1);
  }
  function cancelConfirmation() {
    if (!locked.current) {
      setConfirmation(null);
      opener.current?.focus();
    }
  }
  function prepare(
    event: FormEvent<HTMLFormElement>,
    action: "create" | "submit" | "inspect",
  ) {
    event.preventDefault();
    if (blocked || locked.current || confirmation) return;
    opener.current = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    try {
      if (action === "create") {
        if (
          mode !== "new" ||
          createOutcomeUnknown.current ||
          confirmedCreatedId.current
        )
          return;
        setConfirmation({
          action,
          input: normalizeFacilityInput({
            name: form.name,
            location: form.location,
            ...(form.region.trim() ? { region: form.region } : {}),
          }),
        });
        return;
      }
      if (
        !facility ||
        facility.id !== facilityId ||
        uploadUncertain ||
        referencesUncertain
      )
        return;
      const optional = {
        ...(compliance.inspectedAt
          ? { inspectedAt: utcDate(compliance.inspectedAt, "inspectedAt") }
          : {}),
        ...(compliance.validUntil
          ? { validUntil: utcDate(compliance.validUntil, "validUntil") }
          : {}),
        ...(compliance.includeInspector
          ? { inspector: compliance.inspector }
          : {}),
        ...(compliance.includeNotes ? { notes: compliance.notes } : {}),
      };
      if (action === "submit") {
        const input = normalizeVerificationInput({
          level: compliance.level as Level,
          ...optional,
          documents: documents.map(({ type, uploadId }) => ({
            type,
            uploadId,
          })),
        });
        setConfirmation({
          action,
          input,
          facility,
          savedStatus: verification?.status ?? null,
        });
      } else {
        if (!verification || !compliance.status)
          throw new FacilityValidationError("status");
        const input = normalizeFacilityDecision({
          status: compliance.status,
          ...(compliance.level ? { level: compliance.level } : {}),
          ...optional,
        });
        if (
          input.status === "approved" &&
          (!input.validUntil ||
            new Date(input.validUntil).getTime() <= Date.now() ||
            (input.level ?? verification.level) === "none" ||
            !verification.documents.length ||
            verification.documents.some((document) => !document.controlled))
        )
          throw new FacilityValidationError(
            "approval: validUntil / level / controlled documents",
          );
        setConfirmation({
          action,
          input,
          facility,
          savedStatus: verification.status,
        });
      }
      setError("");
    } catch (failure) {
      setError(failureMessage(failure));
    }
  }
  async function act(value: Confirmation) {
    if (locked.current || blocked || confirmation !== value) return;
    if (
      value.action === "create" &&
      (createOutcomeUnknown.current || confirmedCreatedId.current)
    )
      return;
    if (
      value.action !== "create" &&
      (facility?.id !== value.facility.id ||
        verification?.status !== (value.savedStatus ?? undefined) ||
        uploadUncertain ||
        referencesUncertain)
    )
      return;
    // Recheck future validity immediately before dispatch, not only at confirmation creation.
    if (
      value.action === "inspect" &&
      value.input.status === "approved" &&
      (!value.input.validUntil ||
        new Date(value.input.validUntil).getTime() <= Date.now())
    ) {
      setError(
        tr(
          "Approval validity must still be in the future.",
          "Ngày hiệu lực phê duyệt vẫn phải ở tương lai.",
        ),
      );
      setConfirmation(null);
      return;
    }
    locked.current = true;
    controller.current?.abort();
    const write = ++sequence.current;
    const current = () =>
      alive.current && sameSession() && write === sequence.current;
    const expectedHash = window.location.hash;
    setBusy(true);
    setConfirmation(null);
    setError("");
    setNotice("");
    let acknowledged = false;
    try {
      let id: string;
      if (value.action === "create") {
        const ack = await facilitiesApi.create(value.input);
        id = ack.id;
        confirmedCreatedId.current = id;
        if (current()) {
          setCreatedId(id);
          setForm(emptyFacility());
        }
      } else {
        id = value.facility.id;
        const ack =
          value.action === "submit"
            ? await facilitiesApi.submit(id, value.input)
            : await facilitiesApi.inspect(id, value.input);
        if (
          value.facility.verification &&
          ack.id !== value.facility.verification.id
        )
          throw new Error("Unexpected verification acknowledgement");
      }
      acknowledged = true;
      if (!current()) return;
      setNeedsRefresh(true);
      // Submission references cannot be replayed after an attempt, even if reread fails.
      if (value.action === "submit") setDocuments([]);
      const abort = new AbortController();
      controller.current = abort;
      const { saved, savedVerification } = await readSaved(id, abort.signal);
      if (!current() || abort.signal.aborted) return;
      setFacility(saved);
      setVerification(savedVerification);
      resetCompliance(savedVerification);
      setNeedsRefresh(false);
      setReferencesUncertain(false);
      setNotice(
        tr(
          "Write acknowledged, then authoritative server data loaded. Actions use this saved record; other Admins may also change it.",
          "Đã xác nhận ghi, sau đó tải dữ liệu máy chủ chính thức. Thao tác dùng bản ghi đã lưu này; quản trị viên khác cũng có thể thay đổi.",
        ),
      );
      if (
        value.action === "create" &&
        !replaceHashRoute(facilityRoute("detail", id), expectedHash)
      )
        setNotice(
          tr(
            "Creation and authoritative reread confirmed. Canonical navigation was not accepted; creation is permanently disabled on this mounted page. Open the confirmed facility link.",
            "Đã xác nhận tạo và đọc lại chính thức. Chưa chấp nhận chuyển đường dẫn chuẩn; tạo mới bị tắt vĩnh viễn trên trang đang mở. Mở liên kết cơ sở đã xác nhận.",
          ),
        );
    } catch (failure) {
      if (value.action === "create" && !confirmedCreatedId.current)
        createOutcomeUnknown.current = true;
      if (current()) {
        setNeedsRefresh(true);
        if (value.action === "create" && !confirmedCreatedId.current)
          setCreateUncertain(true);
        if (value.action === "submit") {
          setDocuments([]);
          setReferencesUncertain(true);
        }
        setError(
          failureMessage(failure) +
            " " +
            (acknowledged
              ? tr(
                  "The write was acknowledged but the saved state could not be reread. Refresh before acting.",
                  "Đã xác nhận ghi nhưng chưa đọc lại được trạng thái đã lưu. Làm mới trước thao tác.",
                )
              : tr(
                  "Outcome is unconfirmed; the server may have written it. No automatic replay was sent. Refresh the authoritative record; do not blindly resubmit replacement upload references.",
                  "Chưa xác nhận kết quả; máy chủ có thể đã ghi. Không tự động gửi lại. Làm mới bản ghi chính thức; không gửi lại mù quáng tham chiếu tải lên thay thế.",
                )),
        );
      }
    } finally {
      locked.current = false;
      if (current()) setBusy(false);
    }
  }
  async function upload(file: File) {
    if (
      locked.current ||
      blocked ||
      confirmation ||
      mode !== "submit" ||
      !facility ||
      uploadUncertain ||
      referencesUncertain ||
      documents.length >= 20
    )
      return;
    try {
      validateFacilityDocument(file);
      if (!uploadType.trim() || facilityTextLength(uploadType.trim()) > 80)
        throw new FacilityValidationError("document type");
    } catch (failure) {
      setError(failureMessage(failure));
      return;
    }
    locked.current = true;
    controller.current?.abort();
    const write = ++sequence.current;
    const current = () =>
      alive.current && sameSession() && write === sequence.current;
    const id = facility.id;
    const type = uploadType.trim();
    setBusy(true);
    setError("");
    setNotice("");
    let acknowledged = false;
    try {
      const ack = await facilitiesApi.upload(file);
      acknowledged = true;
      if (!current()) return;
      setDocuments((values) => [
        ...values,
        {
          uploadId: ack.id,
          type,
          mimeType: ack.mimeType,
          sizeBytes: ack.sizeBytes,
        },
      ]);
      setUploadType("");
      setNeedsRefresh(true);
      const abort = new AbortController();
      controller.current = abort;
      const { saved, savedVerification } = await readSaved(id, abort.signal);
      if (!current() || abort.signal.aborted) return;
      setFacility(saved);
      setVerification(savedVerification);
      setNeedsRefresh(false);
      setConfirmation(null);
      setNotice(
        tr(
          "Private farm_document upload acknowledged and facility reread. The confirmed reference is held only in memory and is not yet a saved compliance document.",
          "Đã xác nhận tải lên riêng tư farm_document và đọc lại cơ sở. Tham chiếu đã xác nhận chỉ giữ trong bộ nhớ, chưa là hồ sơ tuân thủ đã lưu.",
        ),
      );
    } catch (failure) {
      if (current()) {
        setNeedsRefresh(true);
        if (!acknowledged) setUploadUncertain(true);
        setError(
          failureMessage(failure) +
            " " +
            (acknowledged
              ? tr(
                  "Upload confirmed, but reread failed. Refresh discards local references; do not assume the file was linked.",
                  "Đã xác nhận tải lên, nhưng đọc lại thất bại. Làm mới bỏ tham chiếu cục bộ; không coi tệp đã được liên kết.",
                )
              : tr(
                  "Upload outcome unknown. Automatic repetition is blocked. Explicitly acknowledge skipping the unconfirmed upload before choosing another new file; no lookup or deletion is available.",
                  "Chưa rõ kết quả tải lên. Chặn lặp tự động. Xác nhận bỏ qua lần tải chưa rõ kết quả trước khi chọn tệp mới khác; không có tra cứu hoặc xóa.",
                )),
        );
      }
    } finally {
      locked.current = false;
      if (fileInput.current) fileInput.current.value = "";
      if (current()) setBusy(false);
    }
  }
  const filtered = rows.filter(
    (value) =>
      (status === "all" ||
        (status === "missing"
          ? !value.verification
          : value.verification?.status === status)) &&
      `${value.id} ${value.name} ${value.location} ${value.region ?? ""}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const heading =
    mode === "list"
      ? tr("Company facilities", "Cơ sở công ty")
      : mode === "review-list"
        ? tr(
            "Facility compliance review directory",
            "Danh mục xét duyệt tuân thủ cơ sở",
          )
        : mode === "new"
          ? tr("Create facility", "Tạo cơ sở")
          : mode === "submit"
            ? tr("Submit replacement compliance", "Gửi hồ sơ tuân thủ thay thế")
            : mode === "review"
              ? tr("Review facility compliance", "Xét duyệt tuân thủ cơ sở")
              : tr("Facility detail", "Chi tiết cơ sở");
  function complianceFields() {
    return (
      <div className="facility-form-grid">
        {mode === "review" && (
          <div>
            <label htmlFor="facility-decision">
              {tr("Explicit decision", "Quyết định rõ ràng")}
            </label>
            <select
              id="facility-decision"
              required
              value={compliance.status}
              onChange={(event) =>
                setComplianceField(
                  "status",
                  event.target.value as ComplianceForm["status"],
                )
              }
            >
              <option value="">
                {tr("Choose a decision", "Chọn quyết định")}
              </option>
              {(["approved", "rejected", "revoked"] as const).map((value) => (
                <option key={value} value={value}>
                  {verificationStatusLabel(value, language)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="facility-level">
            {mode === "review"
              ? tr(
                  "Level · optional, omission retains saved level",
                  "Mức · tùy chọn, bỏ qua giữ mức đã lưu",
                )
              : tr("Compliance level", "Mức tuân thủ")}
          </label>
          <select
            id="facility-level"
            required={mode === "submit"}
            value={compliance.level}
            onChange={(event) =>
              setComplianceField("level", event.target.value as Level | "")
            }
          >
            {mode === "review" && (
              <option value="">
                {tr("Keep saved level", "Giữ mức đã lưu")}
              </option>
            )}
            {facilityLevels.map((value) => (
              <option value={value} key={value}>
                {verificationLevelLabel(value, language)}
              </option>
            ))}
          </select>
        </div>
        {(["inspectedAt", "validUntil"] as const).map((key) => (
          <div key={key}>
            <label htmlFor={`facility-${key}`}>
              {key === "inspectedAt"
                ? tr(
                    "Inspection date · UTC, optional",
                    "Ngày kiểm tra · UTC, tùy chọn",
                  )
                : tr(
                    "Valid until · UTC, explicitly required for approval",
                    "Có hiệu lực đến · UTC, bắt buộc nhập khi phê duyệt",
                  )}
            </label>
            <input
              id={`facility-${key}`}
              type="datetime-local"
              step="any"
              required={
                mode === "review" &&
                key === "validUntil" &&
                compliance.status === "approved"
              }
              value={compliance[key]}
              onChange={(event) => setComplianceField(key, event.target.value)}
            />
          </div>
        ))}
        <div className="facility-wide">
          <label className="facility-checkbox">
            <input
              type="checkbox"
              checked={compliance.includeInspector}
              onChange={(event) =>
                setComplianceField("includeInspector", event.target.checked)
              }
            />
            {tr(
              "Send inspector · unchecked retains existing; checked empty clears",
              "Gửi người kiểm tra · không chọn giữ giá trị cũ; chọn và để trống sẽ xóa",
            )}
          </label>
          {compliance.includeInspector && (
            <>
              <label htmlFor="facility-inspector">
                {tr("Inspector · optional", "Người kiểm tra · tùy chọn")}
              </label>
              <input
                id="facility-inspector"
                value={compliance.inspector}
                onChange={(event) =>
                  setComplianceField("inspector", event.target.value)
                }
              />
              {characterCount(compliance.inspector, 120)}
            </>
          )}
        </div>
        <div className="facility-wide">
          <label className="facility-checkbox">
            <input
              type="checkbox"
              checked={compliance.includeNotes}
              onChange={(event) =>
                setComplianceField("includeNotes", event.target.checked)
              }
            />
            {tr(
              "Send notes · unchecked retains existing; checked empty clears",
              "Gửi ghi chú · không chọn giữ giá trị cũ; chọn và để trống sẽ xóa",
            )}
          </label>
          {compliance.includeNotes && (
            <>
              <label htmlFor="facility-notes">
                {tr(
                  "Notes · optional, not a required reason",
                  "Ghi chú · tùy chọn, không bắt buộc lý do",
                )}
              </label>
              <textarea
                id="facility-notes"
                rows={4}
                value={compliance.notes}
                onChange={(event) =>
                  setComplianceField("notes", event.target.value)
                }
              />
              {characterCount(compliance.notes, 2000)}
            </>
          )}
        </div>
      </div>
    );
  }
  function characterCount(value: string, maximum: number) {
    return (
      <small>
        {facilityTextLength(value.trim())} / {maximum}{" "}
        {tr(
          "Unicode characters after trimming",
          "ký tự Unicode sau bỏ khoảng trắng",
        )}
      </small>
    );
  }
  if (!sessionValid)
    return (
      <main className="company-facilities">
        <h1>{heading}</h1>
        <p role="alert">
          {tr(
            "An active Admin session is required. Private facility data and controls are hidden.",
            "Cần phiên quản trị viên đang hoạt động. Dữ liệu cơ sở riêng tư và thao tác đã được ẩn.",
          )}
        </p>
      </main>
    );
  return (
    <main className="company-facilities" aria-busy={busy || loading}>
      <header className="facility-heading">
        <a
          href={facilityRoute(
            mode === "review" || mode === "review-list"
              ? "review-list"
              : "list",
          )}
        >
          {tr("Shared facility directory", "Danh mục cơ sở dùng chung")}
        </a>
        <h1>{heading}</h1>
        <p>
          {tr(
            "All Admins share the same company facilities and may submit and review their own submissions. There are no facility edit/delete controls, compliance history, payment or refund actions here.",
            "Mọi quản trị viên dùng chung cơ sở công ty và có thể gửi cũng như xét duyệt hồ sơ của mình. Trang không có sửa/xóa cơ sở, lịch sử tuân thủ, thanh toán hoặc hoàn tiền.",
          )}
        </p>
      </header>
      <div className="facility-actions">
        {isList && (
          <a href={facilityRoute("new")}>
            {tr("Create facility", "Tạo cơ sở")}
          </a>
        )}
        <button type="button" disabled={busy || loading} onClick={refresh}>
          {tr(
            "Refresh · discard local changes",
            "Làm mới · bỏ thay đổi cục bộ",
          )}
        </button>
        {mode === "list" && (
          <a href={facilityRoute("review-list")}>
            {tr("Review directory", "Danh mục xét duyệt")}
          </a>
        )}
      </div>
      {error && (
        <p role="alert" className="facility-warning">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="facility-notice">
          {notice}
        </p>
      )}
      {loading && (
        <p role="status">
          {tr(
            "Loading authoritative server data…",
            "Đang tải dữ liệu máy chủ chính thức…",
          )}
        </p>
      )}
      {busy && (
        <p role="status">
          {tr(
            "One write is in progress; private data is hidden until the server reread finishes.",
            "Đang thực hiện một thao tác ghi; ẩn dữ liệu riêng tư đến khi đọc lại máy chủ hoàn tất.",
          )}
        </p>
      )}
      {needsRefresh && (
        <p className="facility-warning">
          {tr(
            "Private data and writes are hidden or blocked until a successful authoritative refresh. This never replays the previous write.",
            "Dữ liệu riêng tư và thao tác ghi bị ẩn hoặc khóa đến khi làm mới chính thức thành công. Không gửi lại thao tác ghi trước.",
          )}
        </p>
      )}
      {createUncertain && (
        <p className="facility-warning">
          {tr(
            "Creation outcome unknown; no idempotency key exists. Creating again is blocked on this mounted page, including after Refresh. Inspect the shared list for a possibly created facility before starting any new draft.",
            "Chưa rõ kết quả tạo; không có khóa chống trùng. Trang đang mở chặn tạo lại, kể cả sau Làm mới. Kiểm tra danh sách chung xem cơ sở có thể đã được tạo trước khi bắt đầu nháp mới.",
          )}{" "}
          <a href={facilityRoute("list")}>
            {tr("Inspect shared list", "Kiểm tra danh sách chung")}
          </a>
        </p>
      )}
      {createdId && (
        <p className="facility-notice">
          {tr(
            "Confirmed facility ID; duplicate creation is permanently disabled here.",
            "Mã cơ sở đã xác nhận; tạo trùng bị tắt vĩnh viễn tại đây.",
          )}{" "}
          <a href={facilityRoute("detail", createdId)}>
            {tr("Open confirmed facility", "Mở cơ sở đã xác nhận")} ·{" "}
            {createdId}
          </a>
        </p>
      )}
      {uploadUncertain && (
        <section className="facility-warning">
          <h2>{tr("Unconfirmed upload", "Tải lên chưa xác nhận")}</h2>
          <p>
            {tr(
              "The upload may exist, but no usable acknowledgement was received. Do not automatically repeat it. Skipping abandons this unconfirmed reference only; it does not look up or delete a server file. Choose a different new file afterward if needed.",
              "Tệp tải lên có thể tồn tại, nhưng không nhận được xác nhận dùng được. Không tự động lặp lại. Bỏ qua chỉ từ bỏ tham chiếu chưa xác nhận; không tra cứu hoặc xóa tệp máy chủ. Chọn tệp mới khác sau đó nếu cần.",
            )}
          </p>
          <button
            type="button"
            disabled={blocked || !!confirmation}
            onClick={() => {
              if (
                !locked.current &&
                window.confirm(
                  tr(
                    "Acknowledge skipping the unconfirmed upload without cleanup?",
                    "Xác nhận bỏ qua tải lên chưa rõ kết quả mà không dọn tệp?",
                  ),
                )
              ) {
                setUploadUncertain(false);
                setUploadType("");
              }
            }}
          >
            {tr(
              "Acknowledge and skip unconfirmed upload",
              "Xác nhận bỏ qua tải lên chưa rõ kết quả",
            )}
          </button>
        </section>
      )}
      {referencesUncertain && (
        <section className="facility-warning">
          <h2>
            {tr(
              "Attempted replacement references are quarantined",
              "Tham chiếu thay thế đã gửi được cách ly",
            )}
          </h2>
          <p>
            {tr(
              "All attempted references were removed from the sendable draft. They may be linked, unused or superseded; saved documents never expose upload IDs. Refresh first, then acknowledge this unknown disposition. Any next replacement submission requires new confirmed uploads; no blind replay or orphan cleanup is available.",
              "Mọi tham chiếu đã thử gửi bị gỡ khỏi nháp có thể gửi. Chúng có thể đã liên kết, chưa dùng hoặc bị thay thế; hồ sơ đã lưu không lộ mã tải lên. Làm mới trước, rồi xác nhận tình trạng chưa rõ này. Lần gửi thay thế tiếp theo cần tải lên mới được xác nhận; không có gửi lại mù quáng hoặc dọn tệp không liên kết.",
            )}
          </p>
          <button
            type="button"
            disabled={blocked || !!confirmation}
            onClick={() => {
              if (
                !locked.current &&
                window.confirm(
                  tr(
                    "Acknowledge that attempted uploads will not be reused and may remain on the server?",
                    "Xác nhận không dùng lại tệp đã thử gửi và chúng có thể vẫn còn trên máy chủ?",
                  ),
                )
              )
                setReferencesUncertain(false);
            }}
          >
            {tr(
              "Acknowledge after authoritative refresh",
              "Xác nhận sau làm mới chính thức",
            )}
          </button>
        </section>
      )}
      {isList && (
        <section className="facility-panel">
          <h2>{tr("Loaded company array", "Mảng cơ sở công ty đã tải")}</h2>
          {mode === "review-list" && (
            <p>
              {tr(
                "This is a client-filtered view of the same company GET array, not a server review queue. Filters and pagination below are local; every Admin sees the shared company scope.",
                "Đây là chế độ lọc phía trình duyệt của cùng mảng GET cơ sở công ty, không phải hàng đợi xét duyệt máy chủ. Bộ lọc và phân trang bên dưới là cục bộ; mọi quản trị viên thấy cùng phạm vi công ty.",
              )}
            </p>
          )}
          <div className="facility-form-grid">
            <div>
              <label htmlFor="facility-search">
                {tr(
                  "Local search · name, ID, location, region",
                  "Tìm cục bộ · tên, mã, địa chỉ, khu vực",
                )}
              </label>
              <input
                id="facility-search"
                disabled={blocked}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div>
              <label htmlFor="facility-status-filter">
                {tr(
                  "Local saved verification status filter",
                  "Lọc trạng thái tuân thủ đã lưu cục bộ",
                )}
              </label>
              <select
                id="facility-status-filter"
                disabled={blocked}
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as typeof status);
                  setPage(1);
                }}
              >
                <option value="all">{tr("All facilities", "Mọi cơ sở")}</option>
                <option value="missing">
                  {tr("No verification", "Chưa có hồ sơ")}
                </option>
                {verificationStatuses.map((value) => (
                  <option value={value} key={value}>
                    {verificationStatusLabel(value, language)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {privateVisible && (
            <>
              <p>
                {filtered.length}{" "}
                {tr(
                  "matching loaded facilities · 10 per local page",
                  "cơ sở đã tải phù hợp · 10 mỗi trang cục bộ",
                )}
              </p>
              {!filtered.length ? (
                <p>
                  {tr(
                    "No loaded facilities match. Missing records are never turned into new creations.",
                    "Không có cơ sở đã tải phù hợp. Không biến bản ghi thiếu thành thao tác tạo mới.",
                  )}
                </p>
              ) : (
                <div className="facility-table-wrap">
                  <table>
                    <caption>
                      {tr(
                        "Shared company facilities",
                        "Cơ sở công ty dùng chung",
                      )}
                    </caption>
                    <thead>
                      <tr>
                        {[
                          tr("Facility / ID", "Cơ sở / mã"),
                          tr("Location / region", "Địa chỉ / khu vực"),
                          tr("Saved compliance", "Tuân thủ đã lưu"),
                          tr("Linked batch count", "Số lô liên kết"),
                          tr("Read / review", "Đọc / xét duyệt"),
                        ].map((label) => (
                          <th key={label} scope="col">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered
                        .slice(
                          (Math.min(page, pages) - 1) * 10,
                          Math.min(page, pages) * 10,
                        )
                        .map((value) => (
                          <tr key={value.id}>
                            <td>
                              <a href={facilityRoute("detail", value.id)}>
                                {value.name}
                              </a>
                              <br />
                              {value.id}
                            </td>
                            <td>
                              {value.location}
                              <br />
                              {value.region ?? missing}
                            </td>
                            <td>
                              {value.verification ? (
                                <>
                                  {verificationStatusLabel(
                                    value.verification.status,
                                    language,
                                  )}{" "}
                                  ·{" "}
                                  {verificationLevelLabel(
                                    value.verification.level,
                                    language,
                                  )}
                                  <br />
                                  {facilityUtc(
                                    value.verification.validUntil,
                                    missing,
                                  )}
                                </>
                              ) : (
                                tr("Not submitted", "Chưa gửi")
                              )}
                            </td>
                            <td>{value.batchCount}</td>
                            <td>
                              <a href={facilityRoute("detail", value.id)}>
                                {tr("Read", "Đọc")}
                              </a>
                              {value.verification && (
                                <>
                                  {" "}
                                  ·{" "}
                                  <a href={facilityRoute("review", value.id)}>
                                    {tr("Review", "Xét duyệt")}
                                  </a>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
              <nav
                className="facility-actions"
                aria-label={tr(
                  "Local facility pagination",
                  "Phân trang cơ sở cục bộ",
                )}
              >
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  {tr("Previous", "Trước")}
                </button>
                <span>
                  {Math.min(page, pages)} / {pages}
                </span>
                <button
                  disabled={page >= pages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  {tr("Next", "Sau")}
                </button>
              </nav>
            </>
          )}
        </section>
      )}
      {mode === "new" && privateVisible && !createdId && !createUncertain && (
        <form
          className="facility-panel"
          onSubmit={(event) => prepare(event, "create")}
        >
          <fieldset disabled={blocked || !!confirmation}>
            <legend>
              {tr("New facility basics only", "Chỉ thông tin cơ bản cơ sở mới")}
            </legend>
            <div className="facility-form-grid">
              {(["name", "location", "region"] as const).map((key) => (
                <div key={key}>
                  <label htmlFor={`new-facility-${key}`}>
                    {key === "name"
                      ? tr("Full facility name", "Tên đầy đủ cơ sở")
                      : key === "location"
                        ? tr("Location", "Địa chỉ")
                        : tr("Region · optional", "Khu vực · tùy chọn")}
                  </label>
                  <input
                    id={`new-facility-${key}`}
                    required={key !== "region"}
                    value={form[key]}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                  />
                  {characterCount(
                    form[key],
                    key === "name" ? 120 : key === "location" ? 200 : 80,
                  )}
                </div>
              ))}
            </div>
            <button type="submit">
              {tr("Confirm facility creation", "Xác nhận tạo cơ sở")}
            </button>
          </fieldset>
        </form>
      )}
      {visible && (
        <>
          <section className="facility-panel">
            <h2>{visible.name}</h2>
            <dl className="facility-basics">
              {[
                [tr("Facility ID", "Mã cơ sở"), visible.id],
                [tr("Location", "Địa chỉ"), visible.location],
                [tr("Region", "Khu vực"), visible.region ?? missing],
                [
                  tr("Linked batch count", "Số lô liên kết"),
                  String(visible.batchCount),
                ],
                [
                  tr("Created · UTC", "Đã tạo · UTC"),
                  facilityUtc(visible.createdAt, missing),
                ],
                [
                  tr("Updated · UTC", "Cập nhật · UTC"),
                  facilityUtc(visible.updatedAt, missing),
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="facility-actions">
              {mode !== "detail" && (
                <a href={facilityRoute("detail", visible.id)}>
                  {tr("Read facility detail", "Đọc chi tiết cơ sở")}
                </a>
              )}
              {mode !== "submit" && (
                <a href={facilityRoute("submit", visible.id)}>
                  {tr("Submit replacement compliance", "Gửi tuân thủ thay thế")}
                </a>
              )}
              {verification && mode !== "review" && (
                <a href={facilityRoute("review", visible.id)}>
                  {tr("Review saved compliance", "Xét duyệt tuân thủ đã lưu")}
                </a>
              )}
            </div>
          </section>
          <FacilityVerification
            key={`${stamp?.generation}:${stamp?.id}:${stamp?.role}:${visible.id}:${verification?.id ?? "none"}`}
            facilityId={visible.id}
            verification={verification}
            admin={admin}
          />
        </>
      )}
      {mode === "submit" && visible && (
        <>
          <section className="facility-warning">
            <h2>
              {tr(
                "Replacement, not document retention",
                "Thay thế, không giữ hồ sơ cũ",
              )}
            </h2>
            <p>
              {tr(
                "Submission replaces ALL saved documents with 1–20 NEW confirmed controlled upload references, sets status to pending, and clears review author/time. Existing documents are read-only: their document IDs cannot retain them, and reload requires new replacement uploads. Omitted inspection/validity dates become null; omitted inspector/notes retain existing values.",
                "Gửi hồ sơ thay thế TẤT CẢ tài liệu đã lưu bằng 1–20 tham chiếu tải lên được kiểm soát MỚI đã xác nhận, đặt trạng thái chờ xét duyệt và xóa người/thời gian xét duyệt. Hồ sơ cũ chỉ đọc: không thể giữ bằng mã hồ sơ, tải lại trang cần tải lên thay thế mới. Bỏ ngày kiểm tra/hiệu lực sẽ thành null; bỏ người kiểm tra/ghi chú giữ giá trị cũ.",
              )}
            </p>
            <p>
              {tr(
                "Resubmitting immediately hides otherwise-open linked batches from public view until approval. It does NOT cancel batches or sponsorships, charge, pay or refund anyone.",
                "Gửi lại lập tức ẩn các lô liên kết vốn đang mở khỏi công khai đến khi phê duyệt. KHÔNG hủy lô hoặc tài trợ, thu tiền, thanh toán hay hoàn tiền.",
              )}
            </p>
          </section>
          <form
            className="facility-panel"
            onSubmit={(event) => prepare(event, "submit")}
          >
            <fieldset
              disabled={
                blocked ||
                !!confirmation ||
                uploadUncertain ||
                referencesUncertain
              }
            >
              <legend>
                {tr("New replacement submission", "Hồ sơ thay thế mới")}
              </legend>
              {complianceFields()}
              <h3>
                {tr("New controlled documents", "Hồ sơ được kiểm soát mới")}
              </h3>
              <p>
                {tr(
                  "Default preflight: at most 10 MiB per JPEG, PNG, WebP, GIF or PDF. Current backend upload configuration is authoritative. Purpose is farm_document; no arbitrary upload ID entry, URL paste or inline preview is provided.",
                  "Kiểm tra mặc định: tối đa 10 MiB mỗi tệp JPEG, PNG, WebP, GIF hoặc PDF. Cấu hình tải lên hiện tại của máy chủ là chính thức. Mục đích farm_document; không nhập mã tải lên tùy ý, dán URL hoặc xem tệp trong trang.",
                )}
              </p>
              <div className="facility-form-grid">
                <div>
                  <label htmlFor="facility-upload-type">
                    {tr(
                      "Next document type · free text, 1–80 characters",
                      "Loại hồ sơ tiếp theo · văn bản tự do, 1–80 ký tự",
                    )}
                  </label>
                  <input
                    id="facility-upload-type"
                    value={uploadType}
                    onChange={(event) => setUploadType(event.target.value)}
                  />
                  {characterCount(uploadType, 80)}
                </div>
                <div>
                  <label htmlFor="facility-upload-file">
                    {tr(
                      "Choose one new private file to upload",
                      "Chọn một tệp riêng tư mới để tải lên",
                    )}
                  </label>
                  <input
                    id="facility-upload-file"
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                    disabled={documents.length >= 20 || !uploadType.trim()}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void upload(file);
                    }}
                  />
                </div>
              </div>
              <ol className="facility-pending-documents">
                {documents.map((document, index) => (
                  <li key={document.uploadId}>
                    <label htmlFor={`pending-document-${index}`}>
                      {tr(
                        "Confirmed new reference type",
                        "Loại tham chiếu mới đã xác nhận",
                      )}{" "}
                      {index + 1}
                    </label>
                    <input
                      id={`pending-document-${index}`}
                      required
                      value={document.type}
                      onChange={(event) =>
                        setDocuments((values) =>
                          values.map((value, position) =>
                            position === index
                              ? { ...value, type: event.target.value }
                              : value,
                          ),
                        )
                      }
                    />
                    {characterCount(document.type, 80)}
                    <p>
                      {document.mimeType} ·{" "}
                      {document.sizeBytes.toLocaleString()}{" "}
                      {tr(
                        "bytes · held only in memory, not linked yet",
                        "byte · chỉ giữ trong bộ nhớ, chưa liên kết",
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setDocuments((values) =>
                          values.filter(
                            (value) => value.uploadId !== document.uploadId,
                          ),
                        )
                      }
                    >
                      {tr(
                        "Remove local reference only · not file deletion",
                        "Chỉ gỡ tham chiếu cục bộ · không xóa tệp",
                      )}
                    </button>
                  </li>
                ))}
              </ol>
              <p>
                {documents.length} / 20{" "}
                {tr(
                  "confirmed new references. Leaving, reload or Refresh loses local references; files may remain on the server without a linked document. No lookup/delete/orphan cleanup is supported.",
                  "tham chiếu mới đã xác nhận. Rời trang, tải lại hoặc Làm mới mất tham chiếu cục bộ; tệp có thể còn trên máy chủ mà không được liên kết. Không hỗ trợ tra cứu/xóa/dọn tệp không liên kết.",
                )}
              </p>
              <button
                type="submit"
                disabled={documents.length < 1 || documents.length > 20}
              >
                {tr("Confirm replacement submission", "Xác nhận gửi thay thế")}
              </button>
            </fieldset>
          </form>
        </>
      )}
      {mode === "review" && visible && verification && (
        <form
          className="facility-panel"
          onSubmit={(event) => prepare(event, "inspect")}
        >
          <fieldset disabled={blocked || !!confirmation}>
            <legend>
              {tr(
                "Explicit saved-facility review decision",
                "Quyết định xét duyệt cơ sở đã lưu rõ ràng",
              )}
            </legend>
            <p>
              {tr(
                "Any Admin, including the submitter, may review. No invented status-transition matrix or required reason is enforced here. Optional omitted fields retain saved values; dates cannot be cleared with null. Approval requires an explicitly supplied future UTC validity, effective non-none level and saved controlled documents; the backend makes the authoritative check.",
                "Mọi quản trị viên, kể cả người gửi, có thể xét duyệt. Không áp đặt ma trận chuyển trạng thái hoặc lý do bắt buộc tự đặt. Trường tùy chọn bị bỏ qua giữ giá trị đã lưu; không xóa ngày bằng null. Phê duyệt cần nhập rõ ngày hiệu lực UTC tương lai, mức hiệu lực khác không có và hồ sơ được kiểm soát đã lưu; máy chủ kiểm tra chính thức.",
              )}
            </p>
            {complianceFields()}
            <button type="submit" disabled={!compliance.status}>
              {tr(
                "Confirm this exact decision",
                "Xác nhận đúng quyết định này",
              )}
            </button>
          </fieldset>
        </form>
      )}
      {confirmation && privateVisible && (
        <section
          className="facility-confirmation"
          role="dialog"
          aria-modal="false"
          aria-labelledby="facility-confirm-heading"
          ref={confirmationPanel}
          tabIndex={-1}
        >
          <h2 id="facility-confirm-heading">
            {tr(
              "Confirm one server write",
              "Xác nhận một thao tác ghi máy chủ",
            )}
          </h2>
          {confirmation.action === "create" ? (
            <>
              <p>
                {tr(
                  "Create exactly this new facility",
                  "Tạo đúng cơ sở mới này",
                )}
                : <strong>{confirmation.input.name}</strong>
              </p>
              <p>
                {confirmation.input.location} ·{" "}
                {confirmation.input.region ??
                  tr("No region supplied", "Không nhập khu vực")}
              </p>
              <p>
                {tr(
                  "There is no idempotency key. An unknown creation outcome blocks mounted resubmission.",
                  "Không có khóa chống trùng. Kết quả tạo chưa rõ chặn gửi lại trên trang đang mở.",
                )}
              </p>
            </>
          ) : (
            <>
              <p>
                <strong>{confirmation.facility.name}</strong> ·{" "}
                {confirmation.facility.id}
              </p>
              <p>
                {tr("Exact saved status", "Đúng trạng thái đã lưu")}:{" "}
                {confirmation.savedStatus
                  ? verificationStatusLabel(confirmation.savedStatus, language)
                  : tr("No saved verification", "Chưa có hồ sơ đã lưu")}{" "}
                →{" "}
                <strong>
                  {verificationStatusLabel(
                    confirmation.action === "submit"
                      ? "pending"
                      : confirmation.input.status,
                    language,
                  )}
                </strong>
              </p>
              <p>
                {confirmation.action === "submit"
                  ? tr(
                      "Replace every saved document, clear reviewers, make pending, and immediately hide otherwise-open batches until approval. This neither cancels nor pays nor refunds.",
                      "Thay mọi hồ sơ đã lưu, xóa người xét duyệt, chuyển chờ xét duyệt và lập tức ẩn lô vốn mở đến khi phê duyệt. Không hủy, thanh toán hoặc hoàn tiền.",
                    )
                  : confirmation.input.status === "approved"
                    ? tr(
                        "Record approval for this facility. Eligible open batches may become public only if backend visibility checks pass; approval does not publish drafts, charge or pay.",
                        "Ghi phê duyệt cho cơ sở này. Lô mở đủ điều kiện có thể công khai chỉ khi máy chủ kiểm tra hiển thị thành công; không xuất bản nháp, thu tiền hoặc thanh toán.",
                      )
                    : confirmation.input.status === "revoked"
                      ? tr(
                          "REVOKE this exact facility compliance. Otherwise-open linked batches immediately lose compliant public visibility. No batch/sponsorship cancellation, payment or refund is performed.",
                          "THU HỒI tuân thủ đúng cơ sở này. Các lô liên kết vốn mở lập tức mất hiển thị công khai đủ tuân thủ. Không hủy lô/tài trợ, thanh toán hoặc hoàn tiền.",
                        )
                      : tr(
                          "Reject this exact facility compliance. Otherwise-open linked batches are not publicly eligible through this compliance. No cancellation, payment or refund is performed.",
                          "Từ chối tuân thủ đúng cơ sở này. Các lô liên kết vốn mở không đủ điều kiện công khai qua tuân thủ này. Không hủy, thanh toán hoặc hoàn tiền.",
                        )}
              </p>
              <dl className="facility-basics">
                <div>
                  <dt>{tr("Sent level", "Mức gửi")}</dt>
                  <dd>
                    {confirmation.input.level
                      ? verificationLevelLabel(
                          confirmation.input.level,
                          language,
                        )
                      : tr("Omitted · keep saved", "Bỏ qua · giữ đã lưu")}
                  </dd>
                </div>
                <div>
                  <dt>{tr("Sent inspection · UTC", "Kiểm tra gửi · UTC")}</dt>
                  <dd>
                    {facilityUtc(
                      confirmation.input.inspectedAt,
                      confirmation.action === "submit"
                        ? tr("Omitted → null", "Bỏ qua → null")
                        : tr("Omitted · keep saved", "Bỏ qua · giữ đã lưu"),
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{tr("Sent validity · UTC", "Hiệu lực gửi · UTC")}</dt>
                  <dd>
                    {facilityUtc(
                      confirmation.input.validUntil,
                      confirmation.action === "submit"
                        ? tr("Omitted → null", "Bỏ qua → null")
                        : tr("Omitted · keep saved", "Bỏ qua · giữ đã lưu"),
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{tr("Sent inspector", "Người kiểm tra gửi")}</dt>
                  <dd>
                    {confirmation.input.inspector === undefined
                      ? tr("Omitted · keep saved", "Bỏ qua · giữ đã lưu")
                      : confirmation.input.inspector ||
                        tr("Explicit empty · clear", "Rỗng rõ ràng · xóa")}
                  </dd>
                </div>
                <div>
                  <dt>{tr("Sent notes", "Ghi chú gửi")}</dt>
                  <dd>
                    {confirmation.input.notes === undefined
                      ? tr("Omitted · keep saved", "Bỏ qua · giữ đã lưu")
                      : confirmation.input.notes ||
                        tr("Explicit empty · clear", "Rỗng rõ ràng · xóa")}
                  </dd>
                </div>
              </dl>
              {confirmation.action === "submit" && (
                <p>
                  {confirmation.input.documents.length}{" "}
                  {tr(
                    "NEW uploaded references replace all existing documents",
                    "tham chiếu tải lên MỚI thay mọi hồ sơ cũ",
                  )}
                  :{" "}
                  {confirmation.input.documents
                    .map((document) => document.type)
                    .join(" · ")}
                </p>
              )}
            </>
          )}
          <p>
            {tr(
              "All Admins share this record; there is no version lock. One write is sent without 401 replay, then the authoritative facility is loaded again before more actions.",
              "Mọi quản trị viên dùng chung bản ghi; không có khóa phiên bản. Gửi một thao tác ghi không phát lại khi 401, rồi tải lại cơ sở chính thức trước thao tác khác.",
            )}
          </p>
          <div className="facility-actions">
            <button type="button" onClick={() => void act(confirmation)}>
              {tr(
                "Send this confirmed write once",
                "Gửi đúng thao tác đã xác nhận một lần",
              )}
            </button>
            <button type="button" onClick={cancelConfirmation}>
              {tr("Cancel confirmation", "Hủy xác nhận")}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
