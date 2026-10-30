import { useTranslation } from "@/context/LanguageContext";
import type { CompanyBatch, PublicBatch, RecordedBatchUpdate } from "@/services/batchContracts";
import { batchStageLabel, batchStatusLabel } from "@/services/batches";
import "./BatchDetails.css";

type Batch = PublicBatch | CompanyBatch;
export function batchUtc(value: string | null | undefined, missing: string) {
  if (!value) return missing;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? missing : date.toISOString().replace("T", " ").replace("Z", " UTC");
}

export function BatchUpdateFeed({ updates }: { updates: RecordedBatchUpdate[] }) {
  const { language } = useTranslation();
  const tr = (en: string, vi: string) => language === "vi" ? vi : en;
  const missing = tr("Not recorded", "Chưa ghi nhận");
  return <section className="batch-panel"><h2>{tr("Recorded growth updates", "Cập nhật tăng trưởng đã ghi nhận")}</h2>
    <p>{tr("Times below are server recording times in UTC, not measurement dates. Stages are recorded labels, not a progress schedule or a batch status transition.", "Thời gian bên dưới là thời điểm máy chủ ghi nhận theo UTC, không phải ngày đo. Giai đoạn là nhãn ghi nhận, không phải lịch tiến độ hay thay đổi trạng thái lô.")}</p>
    {!updates.length ? <p>{tr("No updates returned by the server.", "Máy chủ chưa trả về cập nhật nào.")}</p> : <ol className="batch-feed">{updates.map(update => <li key={update.id}>
      <h3>{batchStageLabel(update.stage, language)}</h3><p><time dateTime={update.createdAt}>{batchUtc(update.createdAt, missing)}</time> · {update.createdBy}</p>
      <dl className="batch-facts"><div><dt>{tr("Average weight", "Khối lượng trung bình")}</dt><dd>{update.averageWeightG === null ? missing : `${update.averageWeightG.toLocaleString(language === "vi" ? "vi-VN" : "en-US")} g`}</dd></div><div><dt>{tr("Count alive", "Số cá còn sống")}</dt><dd>{update.countAlive === null ? missing : update.countAlive.toLocaleString(language === "vi" ? "vi-VN" : "en-US")}</dd></div><div><dt>{tr("Note", "Ghi chú")}</dt><dd className="batch-copy">{update.note ?? missing}</dd></div></dl>
      <div className="batch-media">{update.photos.map((photo, index) => <img loading="lazy" key={photo.id} src={photo.url} alt={`${tr("Recorded update photo", "Ảnh cập nhật đã ghi nhận")} ${index + 1}`} />)}</div>
    </li>)}</ol>}
  </section>;
}

export default function BatchDetails({ batch, includeFeed = true }: { batch: Batch; includeFeed?: boolean }) {
  const { language } = useTranslation();
  const tr = (en: string, vi: string) => language === "vi" ? vi : en;
  const missing = tr("Not recorded", "Chưa ghi nhận");
  const number = (value: number | bigint) => value.toLocaleString(language === "vi" ? "vi-VN" : "en-US");
  const categories: Record<string, string> = { equipment: tr("Equipment", "Thiết bị"), feed: tr("Feed", "Thức ăn"), labour: tr("Labour", "Nhân công"), health: tr("Health", "Sức khỏe"), transport: tr("Transport", "Vận chuyển"), platform_fee: tr("Platform fee", "Phí nền tảng"), contingency: tr("Contingency", "Dự phòng") };
  const verification = "compliance" in batch ? batch.compliance : batch.facility?.verification;
  const levels: Record<string, string> = { none: tr("None", "Không có"), registered: tr("Registered", "Đã đăng ký"), inspected: tr("Inspected", "Đã kiểm tra") };
  const budget = batch.costs.reduce((sum, cost) => sum + BigInt(cost.amount) * (cost.allocation === "per_share" ? BigInt(batch.totalShares) : 1n), 0n);
  const facts = [
    [tr("Batch status", "Trạng thái lô"), batchStatusLabel(batch.status, language)],
    [tr("Species / breed", "Loài / giống"), `${batch.species} / ${batch.breed ?? missing}`],
    [tr("Location / region", "Địa chỉ / khu vực"), `${batch.location} / ${batch.region}`],
    [tr("Facility", "Cơ sở"), batch.facility ? `${batch.facility.name} · ${batch.facility.location}` : missing],
    [tr("Stock count · fish", "Số cá thả · con"), number(batch.stockCount)],
    [tr("One share", "Một phần"), batch.shareQuantity === null ? missing : `${number(batch.shareQuantity)} ${batch.shareUnitType === "weight" ? tr("grams per share", "gam mỗi phần") : tr("fish per share", "con mỗi phần")}`],
    [tr("Expected whole-batch harvest biomass", "Sinh khối thu hoạch dự kiến toàn lô"), batch.expectedHarvestWeightG === null ? missing : `${number(batch.expectedHarvestWeightG)} g`],
    [tr("Total / available shares", "Tổng / phần còn có sẵn"), `${number(batch.totalShares)} / ${number(batch.sharesAvailable)}`],
    [tr("Package price per share · VND", "Giá gói mỗi phần · VND"), `${number(batch.packagePricePerShare)} ₫`],
    [tr("Contingency rate · metadata, not added twice", "Tỷ lệ dự phòng · thông tin, không cộng hai lần"), `${batch.contingencyPct}%`],
    [tr("Planned stocking date · UTC", "Ngày thả dự kiến · UTC"), batchUtc(batch.stockingDate, missing)],
    [tr("Expected harvest date · UTC", "Ngày thu hoạch dự kiến · UTC"), batchUtc(batch.expectedHarvestDate, missing)],
    [tr("Compliance level", "Mức tuân thủ"), verification ? (levels[verification.level] ?? verification.level) : missing],
    [tr("Inspection recorded · UTC", "Kiểm tra đã ghi nhận · UTC"), batchUtc(verification?.inspectedAt, missing)],
    [tr("Compliance valid until · UTC", "Tuân thủ có hiệu lực đến · UTC"), batchUtc(verification?.validUntil, missing)],
    [tr("Terms version", "Phiên bản điều khoản"), batch.termsVersion],
    [tr("Record last updated · UTC", "Bản ghi cập nhật lần cuối · UTC"), batchUtc(batch.updatedAt, missing)],
  ];
  return <>
    <article className="batch-panel"><p>{batch.id}</p><h2>{batch.title}</h2><p className="batch-copy">{batch.description}</p><dl className="batch-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <div className="batch-media">{batch.images.map((image, index) => <img loading="lazy" key={image.id} src={image.url} alt={`${batch.title} · ${tr("image", "ảnh")} ${index + 1}`} />)}</div>
      <h3>{tr("Risk disclosure", "Công bố rủi ro")}</h3><p className="batch-copy">{batch.riskDisclosure}</p>
    </article>
    {"cancelReason" in batch && (batch.status === "cancelled" || batch.cancelReason !== null || batch.cancelledAt !== null) && <section className="batch-panel" aria-labelledby="batch-saved-cancellation-title">
      <h2 id="batch-saved-cancellation-title">{tr("Saved cancellation record", "Bản ghi hủy đã lưu")}</h2>
      <dl className="batch-facts"><div><dt>{tr("Cancellation recorded · UTC", "Thời điểm ghi nhận hủy · UTC")}</dt><dd>{batch.cancelledAt ? <time dateTime={batch.cancelledAt}>{batchUtc(batch.cancelledAt, missing)}</time> : missing}</dd></div><div><dt>{tr("Saved cancellation reason", "Lý do hủy đã lưu")}</dt><dd className="batch-copy">{batch.cancelReason ?? missing}</dd></div></dl>
      <p>{tr("Cancellation retains this batch and its recorded growth observations. It does not issue a refund or payment, change orders, delete records or restore the batch.", "Hủy giữ lại lô này và các quan sát tăng trưởng đã ghi. Không hoàn tiền hoặc thanh toán, thay đổi đơn hàng, xóa bản ghi hoặc khôi phục lô.")}</p>
    </section>}
    <section className="batch-panel"><h2>{tr("Saved budget breakdown", "Chi tiết ngân sách đã lưu")}</h2><p>{tr("Per-share lines multiply by total shares; whole-batch lines count once. All amounts are integer VND. Expected biomass and harvest dates are plans, not guaranteed yield.", "Dòng mỗi phần nhân với tổng số phần; dòng toàn lô tính một lần. Số tiền là số nguyên VND. Sinh khối và ngày thu hoạch dự kiến là kế hoạch, không bảo đảm sản lượng.")}</p>
      <div className="batch-table-wrap"><table><caption>{tr("Allocated costs", "Chi phí phân bổ")}</caption><thead><tr>{[tr("Category / label", "Loại / nhãn"), tr("Allocation", "Phân bổ"), tr("Amount · VND", "Số tiền · VND"), tr("Whole-batch amount · VND", "Số tiền toàn lô · VND"), tr("Note", "Ghi chú")].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{batch.costs.map((cost, index) => <tr key={index}><td>{categories[cost.category]} · {cost.label}</td><td>{cost.allocation === "per_share" ? tr("Per share", "Mỗi phần") : tr("Whole batch", "Toàn lô")}</td><td>{number(cost.amount)}</td><td>{number(BigInt(cost.amount) * (cost.allocation === "per_share" ? BigInt(batch.totalShares) : 1n))}</td><td>{cost.note ?? missing}</td></tr>)}</tbody></table></div>
      {!batch.costs.length && <p>{tr("No cost lines recorded.", "Chưa ghi nhận dòng chi phí.")}</p>}<p>{tr("Allocated total", "Tổng phân bổ")}: {number(budget)} ₫ · {tr("Package budget", "Ngân sách gói")}: {number(BigInt(batch.packagePricePerShare) * BigInt(batch.totalShares))} ₫</p>
    </section>
    {includeFeed && <BatchUpdateFeed updates={batch.updates} />}
  </>;
}
