import type { User } from "@/services/demoStore";
import type { TFn, Toast } from "@/data/sellerData";
import "./Detail.css";
import { Button as UiButton } from "@/components/ui/button";
import { useState } from "react";
import {
  Banner,
  ConfirmDialog,
  Crumbs,
  StateBlock,
  StatusChip,
  go,
} from "@/components/common/Portal";
import {
  deleteListing,
  flash,
  fmtDate,
  listingMissingFields,
  publishListing,
  request,
  setPaused,
  timeAgo,
  useStore,
} from "@/services/demoStore";
import { money } from "@/data/sellerData";
import { Icon } from "@/components/seller/SellerParts";
import { ListingView } from "@/pages/seller/ListingView";
export function Detail({
  user,
  id,
  t,
  show,
  published,
}: {
  user: User;
  id: string;
  t: TFn;
  show: Toast;
  published: boolean;
}) {
  const s = useStore();
  const l = s.listings.find((x) => x.id === id);
  const [dlg, setDlg] = useState<null | "pause" | "delete" | "edit">(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState(false);
  const crumbs = (label: string): [string, string?][] => [
    [t("Seller Center"), "#admin"],
    [t("My Listings"), "#admin/listings"],
    [label],
  ];
  if (!l && s.deleted.includes(id))
    return (
      <>
        <Crumbs items={crumbs(id)} />
        <StateBlock
          card
          icon="x"
          tone="warn"
          title={t("This listing was deleted")}
          body={t("The listing was deleted and can no longer be opened.")}
          actions={
            <a className="sl-btn sl-btn-primary" href="#admin/listings">
              {t("Back to My Listings")}
            </a>
          }
        />
      </>
    );
  if (!l || (user.role !== "Admin" && l.owner !== user.email))
    return (
      <>
        <Crumbs items={crumbs(id)} />
        <StateBlock
          card
          icon="search"
          tone="warn"
          title={t("Listing not found")}
          body={t("It may have been deleted or you may not have access to it.")}
          actions={
            <a className="sl-btn sl-btn-primary" href="#admin/listings">
              {t("Back to My Listings")}
            </a>
          }
        />
      </>
    );
  const missingFields = listingMissingFields(l.draft);
  const run = (fn: () => void, msg: string) => {
    setBusy(true);
    setErr("");
    request(fn, 650)
      .then(() => {
        setBusy(false);
        setDlg(null);
        show(msg);
      })
      .catch((e: Error) => {
        setBusy(false);
        setErr(
          e.message === "expired"
            ? "Your session expired. Please sign in again."
            : "Network error. Check your connection and try again.",
        );
      });
  };
  const publishNow = async () => {
    if (missingFields.length) {
      setErr(
        `Complete these fields before publishing: ${missingFields.join(", ")}.`,
      );
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await publishListing(user, l.id, l.draft);
      show("Listing published.");
      go(`admin/listing/${l.id}?published=1`);
    } catch (error) {
      setErr(
        error instanceof Error && error.message === "expired"
          ? "Your session expired. Please sign in again."
          : "Could not publish the listing. Check the required fields and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const st = l.status;
  const d = l.decision;
  return (
    <>
      <Crumbs items={crumbs(l.draft.name || l.id)} />
      <div className="sl-page-head tight">
        <div>
          <span className="sl-eyebrow">{l.id}</span>
          <h1>{l.draft.name || "Untitled listing"}</h1>
          <p className="sl-muted">
            {t(l.draft.species)} · {l.draft.price ? money(l.draft.price) : "—"}{" "}
            · {t("Updated")} {timeAgo(l.updatedAt, t("Live") !== "Live")}
          </p>
        </div>
        <StatusChip s={st} />
      </div>
      {published && st === "approved" && (
        <Banner tone="ok">{t("Your listing is now live!")}</Banner>
      )}
      {(st === "changes" || st === "rejected") && d && (
        <Banner
          tone="warn"
          action={
            <a className="sl-btn sl-btn-primary" href={`#admin/edit/${l.id}`}>
              {t("Edit & resubmit")}
            </a>
          }
        >
          <b>
            {st === "changes" ? t("Changes requested") : t("Rejection reason")}:{" "}
            {t(d.reason)}
          </b>{" "}
          — {d.feedback}
        </Banner>
      )}
      {st === "approved" && !published && (
        <Banner tone="ok">
          {t("Your listing is now live!")}{" "}
          {t("Changes are published immediately.")}
        </Banner>
      )}
      {st === "paused" && <Banner tone="info">{t("Paused")}</Banner>}
      {st === "draft" && missingFields.length > 0 && (
        <Banner tone="warn">
          {t("Complete all required information before publishing")}:{" "}
          {missingFields.join(", ")}.
        </Banner>
      )}
      {err && !dlg && (
        <Banner
          tone="error"
          action={
            <UiButton
              variant="plain"
              className="sl-btn sl-btn-ghost"
              onClick={() => setErr("")}
            >
              {t("Cancel")}
            </UiButton>
          }
        >
          {err}
        </Banner>
      )}
      <div className="sl-row detail-view-2">
        {(st === "draft" || st === "changes" || st === "rejected") && (
          <a className="sl-btn sl-btn-primary" href={`#admin/edit/${l.id}`}>
            <Icon name="edit" />
            {t("Edit listing")}
          </a>
        )}
        {(st === "draft" || st === "changes" || st === "rejected") && (
          <UiButton
            variant="plain"
            className="sl-btn sl-btn-primary"
            disabled={busy || missingFields.length > 0}
            onClick={() => void publishNow()}
          >
            {busy ? t("Publishing…") : t("Publish Listing")}
          </UiButton>
        )}
        {st === "approved" && (
          <a className="sl-btn sl-btn-primary" href="#marketplace">
            {t("View on marketplace")}
          </a>
        )}
        {st === "approved" && (
          <UiButton
            variant="plain"
            className="sl-btn sl-btn-ghost"
            onClick={() => setDlg("pause")}
          >
            {t("Pause listing")}
          </UiButton>
        )}
        {st === "approved" && (
          <UiButton
            variant="plain"
            className="sl-btn sl-btn-ghost"
            onClick={() => setDlg("edit")}
          >
            <Icon name="edit" />
            {t("Edit listing")}
          </UiButton>
        )}
        {st === "paused" && (
          <UiButton
            variant="plain"
            className="sl-btn sl-btn-primary"
            onClick={() =>
              run(() => setPaused(user, l.id, false), "Listing is live again.")
            }
          >
            {busy ? "…" : t("Resume listing")}
          </UiButton>
        )}
        {st !== "approved" && (
          <UiButton
            variant="plain"
            className="sl-btn sl-btn-outline-danger"
            onClick={() => setDlg("delete")}
          >
            <Icon name="trash" />
            {t("Delete listing")}
          </UiButton>
        )}
        <UiButton
          variant="plain"
          className="sl-btn sl-btn-ghost"
          onClick={() => setPreview((p) => !p)}
        >
          <Icon name="eye" />
          {t("Preview as buyer")}
        </UiButton>
      </div>
      {preview && (
        <div className="sl-frame detail-view-4">
          <ListingView draft={l.draft} seller={l.sellerName} t={t} />
        </div>
      )}
      <section className="sl-card pad">
        <h3>{t("History")}</h3>
        <ol className="pt-timeline detail-view-6">
          {[...l.history].reverse().map((h, i) => (
            <li key={i}>
              <b>{h.action}</b>
              <small>
                {h.by} · {fmtDate(h.at)}
                {h.note ? ` — ${h.note}` : ""}
              </small>
            </li>
          ))}
        </ol>
      </section>
      {dlg === "pause" && (
        <ConfirmDialog
          title="Pause this listing?"
          body="It will be hidden from buyers until you resume it."
          confirmLabel="Pause"
          busy={busy}
          error={err}
          onCancel={() => {
            setDlg(null);
            setErr("");
          }}
          onConfirm={() =>
            run(() => setPaused(user, l.id, true), "Listing paused.")
          }
        />
      )}
      {dlg === "delete" && (
        <ConfirmDialog
          danger
          title="Delete this listing?"
          body="This permanently removes the listing and its history. This cannot be undone."
          confirmLabel="Delete"
          busy={busy}
          error={err}
          onCancel={() => {
            setDlg(null);
            setErr("");
          }}
          onConfirm={() => {
            setBusy(true);
            setErr("");
            request(() => deleteListing(user, l.id), 650)
              .then(() => {
                flash("Listing deleted.");
                go("admin/listings");
              })
              .catch((e: Error) => {
                setBusy(false);
                setErr(
                  e.message === "expired"
                    ? "Your session expired. Please sign in again."
                    : "Network error. Check your connection and try again.",
                );
              });
          }}
        />
      )}
      {dlg === "edit" && (
        <ConfirmDialog
          title="Edit this live listing?"
          body="Changes will be published immediately when you update the listing."
          confirmLabel="Continue to edit"
          onCancel={() => setDlg(null)}
          onConfirm={() => go(`admin/edit/${l.id}`)}
        />
      )}
    </>
  );
}
