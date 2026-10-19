import { TableCell as UiTableCell } from "@/components/ui/table";
import { TableBody as UiTableBody } from "@/components/ui/table";
import { TableHead as UiTableHead } from "@/components/ui/table";
import { TableRow as UiTableRow } from "@/components/ui/table";
import { TableHeader as UiTableHeader } from "@/components/ui/table";
import { Table as UiTable } from "@/components/ui/table";
import { Crumbs } from "@/components/common/Portal";
import { PERMS } from "@/services/demoStore";
import { MATRIX } from "@/data/adminData";
export function Roles() {
  return (
    <>
      <Crumbs items={[["Admin", "#admin"], ["Roles & Permissions"]]} />
      <div className="sl-page-head">
        <div>
          <h1>Roles &amp; permissions</h1>
          <p>
            What each role can do. These rules are enforced on every page and
            action.
          </p>
        </div>
      </div>
      <section className="sl-card">
        <div className="sl-table-wrap">
          <UiTable className="sl-table pt-perm">
            <UiTableHeader>
              <UiTableRow>
                <UiTableHead>Capability</UiTableHead>
                <UiTableHead>Type</UiTableHead>
                <UiTableHead>Buyer</UiTableHead>
                <UiTableHead>Seller</UiTableHead>
                <UiTableHead>Admin</UiTableHead>
              </UiTableRow>
            </UiTableHeader>
            <UiTableBody>
              {MATRIX.map(([label, kind, p]) => (
                <UiTableRow key={p}>
                  <UiTableCell>{label}</UiTableCell>
                  <UiTableCell className="pt-mini">{kind}</UiTableCell>
                  {(["Buyer", "Seller", "Admin"] as const).map((r) => (
                    <UiTableCell key={r}>
                      {PERMS[r].includes(p) ? (
                        <span className="pt-yes" aria-label="Allowed">
                          ✓
                        </span>
                      ) : (
                        <span className="pt-no" aria-label="Not allowed">
                          —
                        </span>
                      )}
                    </UiTableCell>
                  ))}
                </UiTableRow>
              ))}
            </UiTableBody>
          </UiTable>
        </div>
      </section>
    </>
  );
}
