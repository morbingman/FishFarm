import { useState } from "react";
import { MoreHorizontal, Ban, Trash2, Unlock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog, Pager } from "@/components/common/Portal";
import { useTranslation } from "@/context/LanguageContext";
import {
  manageAccount,
  isAccountBlocked,
  useStore,
  type User,
  type BlockKind,
} from "@/services/demoStore";
export function Users({
  user,
  show,
}: {
  user: User;
  show: (message: string) => void;
}) {
  const { language } = useTranslation();
  const t = (vi: string, en: string) => (language === "vi" ? vi : en);
  const store = useStore();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<{
    user: User;
    action: BlockKind | "unblock" | "delete";
  } | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const actionName = (action: BlockKind | "unblock" | "delete") =>
    ({
      "24h": t("Khóa 24 giờ", "Block 24 hours"),
      "7d": t("Khóa 7 ngày", "Block 7 days"),
      permanent: t("Khóa vĩnh viễn", "Block permanently"),
      unblock: t("Mở khóa", "Unblock"),
      delete: t("Xóa tài khoản", "Delete account"),
    })[action];
  const rows = store.users.filter(
    (account) =>
      account.role !== "Admin" &&
      !account.deletedAt &&
      `${account.name} ${account.email}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()) &&
      (filter === "all" ||
        (filter === "blocked") === isAccountBlocked(account)),
  );
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const safePage = Math.min(page, pages);
  const select = (account: User, action: BlockKind | "unblock" | "delete") => {
    setTarget({ user: account, action });
    setReason("");
    setError("");
  };
  return (
    <div data-no-translate>
      <header className="sl-page-head">
        <div>
          <span className="sl-eyebrow">{t("Quản trị", "Administration")}</span>
          <h1>{t("Quản lý người dùng", "User management")}</h1>
          <p>
            {t(
              "Theo dõi trạng thái truy cập và quản lý tài khoản khách hàng.",
              "Review customer access and manage their accounts.",
            )}
          </p>
        </div>
      </header>
      <section className="sl-card">
        <div className="admin-toolbar">
          <input
            aria-label={t("Tìm người dùng", "Search users")}
            placeholder={t(
              "Tìm theo tên hoặc email",
              "Search by name or email",
            )}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select
            aria-label={t("Lọc trạng thái", "Filter status")}
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">
              {t("Tất cả trạng thái", "All statuses")}
            </option>
            <option value="active">{t("Đang hoạt động", "Active")}</option>
            <option value="blocked">{t("Đã khóa", "Blocked")}</option>
          </select>
        </div>
        <div className="sl-table-wrap">
          <table className="sl-table">
            <thead>
              <tr>
                <th>{t("Người dùng", "User")}</th>
                <th>{t("Ngày tham gia", "Joined")}</th>
                <th>{t("Trạng thái", "Status")}</th>
                <th>{t("Thao tác trạng thái", "Status actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice((safePage - 1) * 10, safePage * 10).map((account) => (
                <tr key={account.email}>
                  <td>
                    <b>{account.name}</b>
                    <br />
                    <small>{account.email}</small>
                  </td>
                  <td>{account.joined}</td>
                  <td>
                    <span
                      className={`admin-pill ${isAccountBlocked(account) ? "blocked" : "active"}`}
                    >
                      {isAccountBlocked(account)
                        ? t("Đã khóa", "Blocked")
                        : t("Hoạt động", "Active")}
                    </span>
                    {isAccountBlocked(account) && (
                      <small className="admin-meta">
                        {account.blockedUntil
                          ? `${t("Đến", "Until")} ${new Date(account.blockedUntil).toLocaleString(language === "vi" ? "vi-VN" : "en-US")}`
                          : t("Vĩnh viễn", "Permanent")}
                      </small>
                    )}
                  </td>
                  <td>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="admin-icon-button"
                          aria-label={`${t("Thao tác", "Actions")}: ${account.name}`}
                        >
                          <MoreHorizontal size={22} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        className="admin-actions-menu"
                        align="end"
                        sideOffset={8}
                        data-no-translate
                      >
                        {(["24h", "7d", "permanent"] as const).map((action) => (
                          <DropdownMenuItem
                            key={action}
                            onSelect={() => select(account, action)}
                          >
                            <Ban size={15} />
                            {actionName(action)}
                          </DropdownMenuItem>
                        ))}
                        {isAccountBlocked(account) && (
                          <DropdownMenuItem
                            onSelect={() => select(account, "unblock")}
                          >
                            <Unlock size={15} />
                            {actionName("unblock")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="admin-danger"
                          onSelect={() => select(account, "delete")}
                        >
                          <Trash2 size={15} />
                          {actionName("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={4}>
                    {t("Không có người dùng phù hợp.", "No matching users.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {rows.length > 0 && (
          <Pager
            page={safePage}
            size={10}
            total={rows.length}
            onPage={setPage}
          />
        )}
      </section>
      {target && (
        <ConfirmDialog
          title={`${actionName(target.action)}: ${target.user.name}`}
          body={
            target.action === "delete"
              ? t(
                  "Tài khoản sẽ bị xóa khỏi danh sách và không thể đăng nhập. Lịch sử đơn hàng được giữ lại.",
                  "The account will be removed and cannot sign in. Order history is retained.",
                )
              : t(
                  "Thao tác này thay đổi quyền truy cập tài khoản và được ghi vào nhật ký.",
                  "This changes account access and is recorded in the activity log.",
                )
          }
          danger={target.action !== "unblock"}
          confirmLabel={actionName(target.action)}
          error={error}
          onCancel={() => setTarget(null)}
          onConfirm={() => {
            try {
              manageAccount(target.user.email, target.action, reason);
              show(t("Đã cập nhật tài khoản", "Account updated"));
              setTarget(null);
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : t("Có lỗi xảy ra", "Action failed"),
              );
            }
          }}
        >
          <label className="sl-field">
            <span>{t("Lý do (bắt buộc)", "Reason (required)")}</span>
            <textarea
              aria-label={t("Lý do", "Reason")}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </label>
        </ConfirmDialog>
      )}
    </div>
  );
}
