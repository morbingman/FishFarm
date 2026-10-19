import "./Users.css";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { TableCell as UiTableCell } from "@/components/ui/table";
import { TableBody as UiTableBody } from "@/components/ui/table";
import { TableHead as UiTableHead } from "@/components/ui/table";
import { TableRow as UiTableRow } from "@/components/ui/table";
import { TableHeader as UiTableHeader } from "@/components/ui/table";
import { Table as UiTable } from "@/components/ui/table";
import { Button as UiButton } from "@/components/ui/button";
import { Input as UiInput } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { useState } from "react";
import {
  Icon,
  StatusBadge,
  StateBlock,
  ConfirmDialog,
  Crumbs,
  Pager,
  Skeleton,
  useLoading,
} from "@/components/common/Portal";
import {
  request,
  setUserStatus,
  useStore,
  type User,
} from "@/services/demoStore";
export function Users({
  user,
  show,
}: {
  user: User;
  show: (m: string) => void;
}) {
  const s = useStore();
  const loading = useLoading(450);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rows = s.users.filter(
    (u) =>
      (role === "all" || u.role === role) &&
      (!q.trim() ||
        [u.name, u.email].some((x) =>
          x.toLowerCase().includes(q.trim().toLowerCase()),
        )),
  );
  const toggle = async () => {
    if (!target) return;
    setBusy(true);
    setError("");
    try {
      await request(() =>
        setUserStatus(
          target.email,
          target.status === "active" ? "suspended" : "active",
          user.name,
        ),
      );
      show(
        target.status === "active"
          ? `${target.name} suspended`
          : `${target.name} reactivated`,
      );
      setTarget(null);
    } catch {
      setError("Network error. The change was not saved. Try again.");
    }
    setBusy(false);
  };
  return (
    <>
      <Crumbs items={[["Admin", "#admin"], ["Users"]]} />
      <div className="sl-page-head">
        <div>
          <h1>Users</h1>
          <p>
            Suspend or reactivate buyer and seller accounts. Admin accounts
            can't be changed here.
          </p>
        </div>
      </div>
      <section className="sl-card">
        <div className="pt-toolbar">
          <UiLabel className="pt-search">
            <Icon name="search" size={16} />
            <UiInput
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name or email"
              aria-label="Search users"
            />
          </UiLabel>
          <NativeSelect
            className="pt-select"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by role"
          >
            <NativeSelectOption value="all">All roles</NativeSelectOption>
            <NativeSelectOption>Buyer</NativeSelectOption>
            <NativeSelectOption>Seller</NativeSelectOption>
            <NativeSelectOption>Admin</NativeSelectOption>
          </NativeSelect>
        </div>
        {loading ? (
          <Skeleton />
        ) : rows.length === 0 ? (
          <StateBlock
            icon="search"
            tone="info"
            title="No users found"
            body="No accounts match your search and filter."
            actions={
              <UiButton
                variant="plain"
                className="sl-btn sl-btn-ghost"
                onClick={() => {
                  setQ("");
                  setRole("all");
                }}
              >
                Reset filters
              </UiButton>
            }
          />
        ) : (
          <div className="sl-table-wrap">
            <UiTable className="sl-table">
              <UiTableHeader>
                <UiTableRow>
                  <UiTableHead>User</UiTableHead>
                  <UiTableHead>Role</UiTableHead>
                  <UiTableHead>Status</UiTableHead>
                  <UiTableHead>Joined</UiTableHead>
                  <UiTableHead>Listings</UiTableHead>
                  <UiTableHead />
                </UiTableRow>
              </UiTableHeader>
              <UiTableBody>
                {rows.slice((page - 1) * 6, page * 6).map((u) => (
                  <UiTableRow key={u.email}>
                    <UiTableCell>
                      <b>{u.name}</b>
                      <br />
                      <small className="pt-mini">{u.email}</small>
                    </UiTableCell>
                    <UiTableCell>{u.role}</UiTableCell>
                    <UiTableCell>
                      <StatusBadge
                        kind={u.status === "active" ? "active" : "failed"}
                        label={u.status === "active" ? "Active" : "Suspended"}
                      />
                    </UiTableCell>
                    <UiTableCell>{u.joined}</UiTableCell>
                    <UiTableCell>
                      {u.role === "Seller"
                        ? s.listings.filter((l) => l.owner === u.email).length
                        : "—"}
                    </UiTableCell>
                    <UiTableCell>
                      {u.role === "Admin" ? (
                        <span className="pt-mini">Protected</span>
                      ) : (
                        <UiButton
                          variant="plain"
                          className={
                            "users-layout-1 " +
                            "" +
                            `sl-btn ${
                              u.status === "active"
                                ? "sl-btn-outline-danger"
                                : "sl-btn-ghost"
                            }`
                          }
                          onClick={() => setTarget(u)}
                        >
                          {u.status === "active" ? "Suspend" : "Reactivate"}
                        </UiButton>
                      )}
                    </UiTableCell>
                  </UiTableRow>
                ))}
              </UiTableBody>
            </UiTable>
          </div>
        )}
        {!loading && rows.length > 0 && (
          <Pager page={page} size={6} total={rows.length} onPage={setPage} />
        )}
      </section>
      {target && (
        <ConfirmDialog
          danger={target.status === "active"}
          busy={busy}
          error={error}
          onCancel={() => setTarget(null)}
          onConfirm={toggle}
          title={
            target.status === "active"
              ? `Suspend ${target.name}?`
              : `Reactivate ${target.name}?`
          }
          body={
            target.status === "active"
              ? "They will be signed out and unable to sign in until reactivated. Their live listings stay visible unless you take them down."
              : "They will be able to sign in again."
          }
          confirmLabel={
            target.status === "active" ? "Suspend account" : "Reactivate"
          }
        />
      )}
    </>
  );
}
