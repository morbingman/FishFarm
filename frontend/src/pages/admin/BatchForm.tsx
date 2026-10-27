import { useState, type FormEvent } from "react";
import { useTranslation } from "@/context/LanguageContext";
import { domainApi } from "@/services/api";
import { refreshFarming } from "@/services/farmingStore";

type Props = { show: (message: string) => void };

const initialForm = {
  title: "",
  species: "",
  breed: "",
  ageMonths: "",
  gender: "",
  description: "",
  packagePricePerShare: "",
};

export function BatchForm({ show }: Props) {
  const { language } = useTranslation();
  const t = (vi: string, en: string) => (language === "vi" ? vi : en);
  const [form, setForm] = useState(initialForm);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof typeof initialForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    setUploading(true);
    try {
      const selected = Array.from(files).slice(
        0,
        Math.max(0, 5 - images.length),
      );
      const uploaded: string[] = [];
      for (const file of selected) {
        if (!file.type.startsWith("image/"))
          throw new Error(
            t("Chỉ được chọn tệp ảnh.", "Only image files are allowed."),
          );
        if (file.size > 5 * 1024 * 1024)
          throw new Error(
            t("Mỗi ảnh tối đa 5 MB.", "Each image must be 5 MB or smaller."),
          );
        uploaded.push((await domainApi.uploadImage(file, "batch_update")).url);
      }
      setImages((current) => [...current, ...uploaded]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Tải ảnh thất bại.", "Image upload failed."),
      );
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!images.length) {
      setError(
        t(
          "Vui lòng tải ít nhất một ảnh thật của cá.",
          "Upload at least one real photo of the fish.",
        ),
      );
      return;
    }
    if (form.description.trim().length < 10) {
      setError(
        t(
          "Mô tả cần có ít nhất 10 ký tự.",
          "Description must contain at least 10 characters.",
        ),
      );
      return;
    }
    setSaving(true);
    try {
      const created = await domainApi.createBatch({
        ...form,
        ageMonths: Number(form.ageMonths),
        packagePricePerShare: Number(form.packagePricePerShare),
        images,
      });
      await refreshFarming();
      show(
        t(
          "Đã đăng cá con để nhận đầu tư nuôi",
          "Juvenile fish published for sponsorship",
        ),
      );
      window.location.hash = `admin/bookings?created=${encodeURIComponent(created.code)}`;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      setError(
        message.includes("batch.incomplete")
          ? t(
              "Thông tin cá và kế hoạch nuôi chưa đầy đủ.",
              "Fish and farming plan information is incomplete.",
            )
          : t(
              "Không thể đăng cá. Hãy kiểm tra dữ liệu và thử lại.",
              "Could not publish the fish. Check the information and try again.",
            ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div data-no-translate>
      <header className="sl-page-head">
        <div>
          <span className="sl-eyebrow">
            {t("Đầu tư nuôi cá", "Fish sponsorship")}
          </span>
          <h1>{t("Đăng một cá con", "Add a juvenile fish")}</h1>
          <p>
            {t(
              "Đăng một cá thể cá con để một người đầu tư chi phí nuôi. Trang trại chăm sóc, cập nhật quá trình lớn lên rồi giao đúng con cá đó.",
              "Publish one juvenile fish for one investor to fund. The farm raises it, posts growth updates, and hands over that same fish.",
            )}
          </p>
        </div>
        <a className="sl-btn sl-btn-ghost" href="#admin/bookings">
          {t("Hủy", "Cancel")}
        </a>
      </header>

      <form className="sl-card admin-pad batch-form" onSubmit={submit}>
        <h2>{t("Hồ sơ cá con", "Juvenile fish profile")}</h2>
        <p className="admin-note batch-model-note">
          {t(
            "Mỗi hồ sơ chỉ có 1 con cá và chỉ nhận 1 nhà đầu tư.",
            "Each profile represents one fish and accepts one investor only.",
          )}
        </p>
        <div className="batch-form-grid">
          <label className="sl-field">
            <span>
              {t("Tên hoặc mã nhận diện cá *", "Fish name or identifier *")}
            </span>
            <input
              required
              placeholder={t(
                "Ví dụ: Koi Kohaku K-01",
                "Example: Kohaku Koi K-01",
              )}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </label>
          <label className="sl-field">
            <span>{t("Loài cá *", "Species *")}</span>
            <input
              required
              value={form.species}
              onChange={(e) => set("species", e.target.value)}
            />
          </label>
          <label className="sl-field">
            <span>{t("Giống/dòng cá", "Breed/strain")}</span>
            <input
              value={form.breed}
              onChange={(e) => set("breed", e.target.value)}
            />
          </label>
          <label className="sl-field">
            <span>{t("Giới tính", "Gender")}</span>
            <select
              value={form.gender}
              onChange={(e) => set("gender", e.target.value)}
            >
              <option value="">{t("Chưa xác định", "Unknown")}</option>
              <option value="male">{t("Đực", "Male")}</option>
              <option value="female">{t("Cái", "Female")}</option>
            </select>
          </label>
          <label className="sl-field">
            <span>
              {t("Tuổi hiện tại (tháng) *", "Current age (months) *")}
            </span>
            <input
              required
              type="number"
              min="0"
              step="1"
              value={form.ageMonths}
              onChange={(e) => set("ageMonths", e.target.value)}
            />
          </label>
          <label className="sl-field batch-wide">
            <span>{t("Mô tả đặc điểm cá *", "Fish description *")}</span>
            <textarea
              required
              minLength={10}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
            <small>
              {t(
                "Màu sắc, hoa văn, nguồn gốc và đặc điểm nhận diện",
                "Colour, pattern, origin and identifying traits",
              )}
            </small>
          </label>
          <label className="sl-field">
            <span>
              {t(
                "Tổng chi phí đầu tư nuôi (VNĐ) *",
                "Total sponsorship cost (VND) *",
              )}
            </span>
            <input
              required
              type="number"
              min="1"
              step="1"
              value={form.packagePricePerShare}
              onChange={(e) => set("packagePricePerShare", e.target.value)}
            />
          </label>
        </div>

        <div className="batch-images">
          <div>
            <b>{t("Ảnh thật của cá *", "Real fish photos *")}</b>
            <p className="admin-note">
              {t(
                "Tối đa 5 ảnh. Ảnh đầu tiên là ảnh đại diện để nhà đầu tư nhận diện cá.",
                "Up to 5 photos. The first is the cover used to identify the fish.",
              )}
            </p>
          </div>
          <label
            className={`sl-btn sl-btn-ghost ${uploading || images.length >= 5 ? "disabled" : ""}`}
          >
            {uploading
              ? t("Đang tải ảnh...", "Uploading...")
              : t("Chọn ảnh", "Choose images")}
            <input
              hidden
              type="file"
              accept="image/*"
              multiple
              disabled={uploading || images.length >= 5}
              onChange={(e) => void upload(e.target.files)}
            />
          </label>
        </div>
        {!!images.length && (
          <div className="batch-image-grid">
            {images.map((url, index) => (
              <figure key={url}>
                <img
                  src={url}
                  alt={`${t("Ảnh cá", "Fish photo")} ${index + 1}`}
                />
                <button
                  type="button"
                  onClick={() =>
                    setImages((current) =>
                      current.filter((item) => item !== url),
                    )
                  }
                >
                  {t("Xóa", "Remove")}
                </button>
              </figure>
            ))}
          </div>
        )}
        {error && (
          <p className="batch-error" role="alert">
            {error}
          </p>
        )}
        <div className="admin-inline-actions">
          <button
            className="sl-btn sl-btn-primary"
            type="submit"
            disabled={saving || uploading}
          >
            {saving
              ? t("Đang đăng...", "Publishing...")
              : t("Đăng cá để nhận đầu tư", "Publish fish for sponsorship")}
          </button>
          <a className="sl-btn sl-btn-ghost" href="#admin/bookings">
            {t("Hủy", "Cancel")}
          </a>
        </div>
      </form>
    </div>
  );
}
