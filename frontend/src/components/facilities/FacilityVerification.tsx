import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/context/LanguageContext";
import { apiSessionStamp, errorMessage, isApiSession } from "@/services/api";
import { useUser } from "@/services/session";
import { facilitiesApi } from "@/services/facilitiesApi";
import {
  verificationLevelLabel,
  verificationStatusLabel,
} from "@/services/facilities";
import "./FacilityVerification.css";

type Verification = Awaited<ReturnType<typeof facilitiesApi.verification>>;
type Document = Verification["documents"][number];
export function facilityUtc(value: string | null | undefined, missing: string) {
  if (!value) return missing;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? missing
    : date.toISOString().replace("T", " ").replace("Z", " UTC");
}

/** Saved metadata only. Private media never becomes an inline preview or raw upload link. */
export default function FacilityVerification({
  facilityId,
  verification,
  admin = false,
}: {
  facilityId: string;
  verification: Verification | null;
  admin?: boolean;
}) {
  const { language } = useTranslation();
  const user = useUser();
  const tr = (en: string, vi: string) => (language === "vi" ? vi : en);
  const missing = tr("Not recorded", "Chưa ghi nhận");
  const [stamp] = useState(apiSessionStamp);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [clock, setClock] = useState(Date.now);
  const alive = useRef(true);
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const objectUrl = useRef<string | null>(null);
  const locked = useRef(false);
  const sameSession = () =>
    isApiSession(stamp) &&
    stamp?.role === "Admin" &&
    user?.role === "Admin" &&
    user.status === "active";
  const sessionValid = sameSession();
  function revoke() {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
  }
  useEffect(() => {
    alive.current = true;
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => {
      alive.current = false;
      ++sequence.current;
      controller.current?.abort();
      revoke();
      window.clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    ++sequence.current;
    controller.current?.abort();
    revoke();
    setDownloading(null);
    setError("");
    setNotice("");
    return () => {
      ++sequence.current;
      controller.current?.abort();
      revoke();
    };
  }, [facilityId, verification, admin, sessionValid, stamp]);
  async function download(document: Document) {
    if (
      locked.current ||
      !sameSession() ||
      !document.controlled ||
      !verification?.documents.some((value) => value.id === document.id)
    )
      return;
    locked.current = true;
    revoke();
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const read = ++sequence.current;
    const current = () =>
      alive.current &&
      sameSession() &&
      !abort.signal.aborted &&
      read === sequence.current;
    setDownloading(document.id);
    setError("");
    setNotice("");
    try {
      const blob = await facilitiesApi.document(
        facilityId,
        document,
        admin,
        abort.signal,
      );
      if (!current()) return;
      // The URL is created only for this explicit download, never from upload metadata.
      const url = URL.createObjectURL(blob);
      objectUrl.current = url;
      const suffixes: Record<string, string> = {
        "application/pdf": "pdf",
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
      };
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `facility-document-${document.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.${suffixes[document.mimeType ?? ""] ?? "bin"}`;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      setNotice(
        tr(
          "Download requested. The browser saves the file; no inline preview is opened.",
          "Đã yêu cầu tải xuống. Trình duyệt lưu tệp; không mở bản xem trước trong trang.",
        ),
      );
    } catch (failure) {
      if (current()) setError(errorMessage(failure, language));
    } finally {
      locked.current = false;
      if (current()) setDownloading(null);
    }
  }
  if (!sameSession()) return null;
  if (!verification)
    return (
      <section className="facility-verification">
        <h2>{tr("Saved compliance", "Tuân thủ đã lưu")}</h2>
        <p>
          {tr(
            "No verification has been saved for this facility.",
            "Cơ sở này chưa có hồ sơ tuân thủ đã lưu.",
          )}
        </p>
      </section>
    );
  const expiry = verification.validUntil
    ? new Date(verification.validUntil).getTime()
    : null;
  const expired = expiry !== null && expiry <= clock;
  const facts = [
    [
      tr("Saved status", "Trạng thái đã lưu"),
      verificationStatusLabel(verification.status, language),
    ],
    [
      tr("Saved level", "Mức đã lưu"),
      verificationLevelLabel(verification.level, language),
    ],
    [
      tr("Inspection · UTC", "Kiểm tra · UTC"),
      facilityUtc(verification.inspectedAt, missing),
    ],
    [tr("Inspector", "Người kiểm tra"), verification.inspector ?? missing],
    [
      tr("Valid until · UTC", "Có hiệu lực đến · UTC"),
      facilityUtc(verification.validUntil, missing),
    ],
    [
      tr("Submitted · UTC", "Đã gửi · UTC"),
      facilityUtc(verification.submittedAt, missing),
    ],
    [
      tr("Reviewed · UTC", "Đã xét duyệt · UTC"),
      facilityUtc(verification.reviewedAt, missing),
    ],
    [
      tr("Review author", "Người xét duyệt"),
      verification.reviewedBy ?? missing,
    ],
    [tr("Notes", "Ghi chú"), verification.notes ?? missing],
  ];
  return (
    <section
      className="facility-verification"
      aria-labelledby="facility-verification-heading"
    >
      <h2 id="facility-verification-heading">
        {tr("Saved compliance", "Tuân thủ đã lưu")}
      </h2>
      <p>
        {tr("Verification ID", "Mã hồ sơ")}: {verification.id}
      </p>
      <dl className="facility-verification-facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p>
        {expired
          ? tr(
              "The saved validity date has passed. This is a derived expiry warning; the saved status above has not been changed to a new status.",
              "Ngày hiệu lực đã qua. Đây là cảnh báo hết hạn suy ra; trạng thái đã lưu bên trên không bị đổi thành trạng thái mới.",
            )
          : expiry === null
            ? tr(
                "No validity date is recorded.",
                "Chưa ghi nhận ngày hiệu lực.",
              )
            : tr(
                "The validity date has not passed. The backend checks current compliance and public visibility.",
                "Ngày hiệu lực chưa qua. Máy chủ kiểm tra tuân thủ hiện tại và khả năng hiển thị công khai.",
              )}
      </p>
      <h3>
        {tr(
          "Saved document references · read only",
          "Tham chiếu hồ sơ đã lưu · chỉ đọc",
        )}
      </h3>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {!verification.documents.length ? (
        <p>
          {tr(
            "No saved documents returned.",
            "Không có hồ sơ đã lưu được trả về.",
          )}
        </p>
      ) : (
        <ul className="facility-document-list">
          {verification.documents.map((document) => (
            <li key={document.id}>
              <div>
                <strong>{document.type}</strong>
                <p>
                  {document.mimeType ?? missing} ·{" "}
                  {document.sizeBytes === null
                    ? missing
                    : `${document.sizeBytes.toLocaleString()} ${tr("bytes", "byte")}`}
                </p>
                <p>
                  {tr("Recorded · UTC", "Đã ghi nhận · UTC")}:{" "}
                  {facilityUtc(document.uploadedAt, missing)}
                </p>
              </div>
              {document.controlled ? (
                <button
                  type="button"
                  disabled={downloading !== null}
                  onClick={() => void download(document)}
                  aria-label={`${tr("Download controlled document", "Tải hồ sơ được kiểm soát")}: ${document.type}`}
                >
                  {downloading === document.id
                    ? tr("Downloading…", "Đang tải…")
                    : tr("Download", "Tải xuống")}
                </button>
              ) : (
                <span>
                  {tr(
                    "Not controlled · protected download unavailable",
                    "Chưa được kiểm soát · không có tải xuống được bảo vệ",
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="facility-document-help">
        {tr(
          "Downloads use the facility-owned protected content endpoint. Private upload URLs and upload IDs are not exposed here; files are never displayed inline. Existing documents cannot be retained by document ID in a replacement submission. Transient storage and server MIME/content hardening remain backend risks, not fixes provided by this UI.",
          "Tải xuống dùng điểm cuối nội dung được bảo vệ thuộc cơ sở. Trang không công khai URL tải lên riêng tư hoặc mã tải lên; không hiển thị tệp trong trang. Không thể giữ hồ sơ cũ bằng mã hồ sơ khi gửi thay thế. Lưu trữ tạm thời và gia cố MIME/nội dung máy chủ vẫn là rủi ro phía máy chủ, không được giao diện này giải quyết.",
        )}
      </p>
    </section>
  );
}
