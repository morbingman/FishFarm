import type { User } from "@/services/demoStore";
import "./Review.css";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Button as UiButton } from "@/components/ui/button";
import { Textarea as UiTextarea } from "@/components/ui/textarea";
import { Input as UiInput } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { useEffect, useState } from "react";
import {
  Icon,
  StatusChip,
  StateBlock,
  Banner,
  ConfirmDialog,
  Crumbs,
  Skeleton,
  useLoading,
  STATUS_LABEL,
} from "@/components/common/Portal";
import {
  decideListing,
  fmtDate,
  request,
  takedownListing,
  timeAgo,
  useStore,
} from "@/services/demoStore";
import { type Mode, REASONS, CHECKS, money } from "@/data/adminData";
export function Review({
  id,
  user,
  show,
}: {
  id: string;
  user: User;
  show: (m: string) => void;
}) {
  const s = useStore();
  const l = s.listings.find((x) => x.id === id);
  const [mode, setMode] = useState<Mode>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [reason, setReason] = useState(REASONS[0][0]);
  const [feedback, setFeedback] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const loading = useLoading(350);
  useEffect(() => {
    setError("");
  }, [mode]);
  if (!l)
    return (
      <>
        <Crumbs
          items={[
            ["Admin", "#admin"],
            ["Moderation Queue", "#admin/queue"],
            [id],
          ]}
        />
        <StateBlock
          card
          icon="trash"
          tone="warn"
          title={
            s.deleted.includes(id)
              ? "This listing was deleted"
              : "Listing not found"
          }
          body={
            s.deleted.includes(id)
              ? "The seller removed this listing, so there is nothing left to review. Related notifications now point to a record that no longer exists."
              : `We couldn't find a listing with ID ${id}. It may have been mistyped.`
          }
          actions={
            <a className="sl-btn sl-btn-primary" href="#admin/queue">
              Back to queue
            </a>
          }
        />
      </>
    );
  const seller = s.users.find((u) => u.email === l.owner);
  const d = l.draft;
  const allChecked = CHECKS.every((c) => checks[c]);
  const feedbackBad = feedback.trim().length < 10;
  const next = s.listings.find((x) => x.status === "pending" && x.id !== l.id);
  const run = async (fn: () => boolean, done: string) => {
    setBusy(true);
    setError("");
    try {
      const ok = await request(fn);
      if (!ok) {
        setError(
          "This listing is no longer pending, so the decision couldn't be recorded. Refresh to see its current state.",
        );
        setBusy(false);
        return;
      }
      setBusy(false);
      setMode(null);
      setFeedback("");
      show(done);
    } catch (e) {
      setBusy(false);
      setError(
        (e as Error).message === "expired"
          ? "Your session expired. Sign in again to continue."
          : "Network error. The decision was not saved. Check your connection and try again.",
      );
    }
  };
  const confirm = () => {
    if (mode === "approve")
      run(
        () => decideListing(user, l.id, "approved"),
        `"${d.name}" approved and published`,
      );
    else if (mode === "rejected" || mode === "changes")
      run(
        () =>
          decideListing(
            user,
            l.id,
            mode,
            reason,
            feedback.trim(),
            REASONS.find((r) => r[0] === reason)![1],
          ),
        mode === "rejected"
          ? "Listing rejected. The management team was notified."
          : "Changes requested. The management team was notified.",
      );
    else if (mode === "takedown")
      run(() => {
        takedownListing(user, l.id, feedback.trim());
        return true;
      }, "Listing taken down");
  };
  const start = (m: Mode) => {
    setTried(true);
    if (m === "approve" && !allChecked) return;
    if (m !== "approve" && feedbackBad) return;
    setMode(m);
  };
  const dialog = mode && (
    <ConfirmDialog
      danger={mode !== "approve"}
      busy={busy}
      error={error}
      onCancel={() => setMode(null)}
      onConfirm={confirm}
      title={
        mode === "approve"
          ? "Approve this listing?"
          : mode === "changes"
            ? "Request changes?"
            : mode === "rejected"
              ? "Reject this listing?"
              : "Take down this listing?"
      }
      body={
        mode === "approve"
          ? `"${d.name}" will go live on the marketplace immediately and ${l.sellerName} will be notified.`
          : mode === "changes"
            ? "Edit and resubmit the listing from Fish management. This is recorded in the listing history."
            : mode === "rejected"
              ? "The listing will be rejected. You can still edit and resubmit it from Fish management."
              : "The listing will disappear from the marketplace and the management team will be notified."
      }
      confirmLabel={
        mode === "approve"
          ? "Approve & publish"
          : mode === "changes"
            ? "Send request"
            : mode === "rejected"
              ? "Reject listing"
              : "Take down"
      }
    />
  );
  return (
    <>
      <Crumbs
        items={[
          ["Admin", "#admin"],
          ["Moderation Queue", "#admin/queue"],
          [l.id],
        ]}
      />
      <div className="sl-page-head tight">
        <div>
          <span className="sl-eyebrow">
            {l.id} · Submitted {l.submittedAt ? fmtDate(l.submittedAt) : "—"}
          </span>
          <h1>{d.name}</h1>
        </div>
        <StatusChip s={l.status} />
      </div>
      {loading ? (
        <Skeleton rows={6} />
      ) : (
        <div className="sl-admin-cols">
          <div className="sl-admin-content">
            <section className="sl-card pad">
              <h3>Images</h3>
              {d.images.length ? (
                <div className="sl-admin-imgs">
                  {d.images.map((im, i) => (
                    <figure key={im.id}>
                      <img src={im.url} alt={`${d.name} ${i + 1}`} />
                      {im.id === (d.mainId || d.images[0].id) && (
                        <figcaption>Main</figcaption>
                      )}
                    </figure>
                  ))}
                </div>
              ) : (
                <p className="pt-mini">No images uploaded.</p>
              )}
            </section>
            <section className="sl-card pad">
              <h3>Listing information</h3>
              <dl className="sl-specs two">
                {(
                  [
                    ["Species", d.species],
                    ["Breed", d.breed || "—"],
                    [
                      "Price",
                      `${money(d.price)}${d.negotiable ? " · Negotiable" : ""}`,
                    ],
                    ["Quantity available", d.quantity],
                    ["Age", d.age],
                    ["Size", `${d.size} cm`],
                    ["Gender", d.gender],
                    ["Origin", d.origin],
                    ["Health Status", d.health],
                    ["Location", `${d.location}, ${d.region}`],
                    ["Shipping", d.shipping.join(", ")],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <h4>Description</h4>
              <p className="sl-desc">{d.description}</p>
            </section>
            <section className="sl-card pad">
              <h3>History</h3>
              <ul className="pt-timeline">
                {[...l.history].reverse().map((h, i) => (
                  <li key={i}>
                    <b>{h.action}</b>
                    <small>
                      {h.by} · {fmtDate(h.at)}
                    </small>
                    {h.note && <p>{h.note}</p>}
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <div className="sl-admin-side">
            <section className="sl-card pad">
              <h3>Farm / source information</h3>
              <div className="sl-seller-card flat">
                <span className="sl-avatar">
                  {l.sellerName.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <b>{l.sellerName}</b>
                  <span>
                    <Icon name="shield" size={14} /> Managed by FISHMARKET
                  </span>
                </div>
              </div>
              <dl className="sl-specs one">
                <div>
                  <dt>Account status</dt>
                  <dd>
                    {seller
                      ? seller.status === "active"
                        ? "Active"
                        : "Suspended"
                      : "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt>Contact</dt>
                  <dd>{l.owner}</dd>
                </div>
                <div>
                  <dt>Joined</dt>
                  <dd>{seller?.joined ?? "—"}</dd>
                </div>
                <div>
                  <dt>Listings</dt>
                  <dd>
                    {s.listings.filter((x) => x.owner === l.owner).length}
                  </dd>
                </div>
              </dl>
            </section>
            <section className="sl-card pad sl-decision">
              <h3>Moderation decision</h3>
              {l.status === "pending" ? (
                <>
                  <ul className="sl-checks">
                    {CHECKS.map((c) => (
                      <li key={c}>
                        <UiLabel>
                          <UiInput
                            type="checkbox"
                            checked={!!checks[c]}
                            onChange={(e) =>
                              setChecks((x) => ({
                                ...x,
                                [c]: e.target.checked,
                              }))
                            }
                          />
                          {c}
                        </UiLabel>
                      </li>
                    ))}
                  </ul>
                  {tried && !allChecked && (
                    <p className="pt-mini review-view-3">
                      Complete the checklist before approving.
                    </p>
                  )}
                  <div className="sl-reject">
                    <UiLabel
                      className={`sl-field ${
                        tried && feedbackBad ? "bad" : ""
                      }`}
                    >
                      <span>
                        Reason<b className="pt-req">*</b>
                      </span>
                      <NativeSelect
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      >
                        {REASONS.map((r) => (
                          <NativeSelectOption key={r[0]}>
                            {r[0]}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </UiLabel>
                    <UiLabel
                      className={`sl-field ${
                        tried && feedbackBad ? "bad" : ""
                      }`}
                    >
                      <span>
                        Feedback for the seller<b className="pt-req">*</b>
                      </span>
                      <UiTextarea
                        rows={3}
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="Explain what needs to change… (needed to reject / request changes)"
                      />
                      {tried && feedbackBad && (
                        <em>Add at least 10 characters of feedback.</em>
                      )}
                    </UiLabel>
                  </div>
                  <div className="sl-actions-stack review-view-5">
                    <UiButton
                      variant="plain"
                      className="sl-btn sl-btn-primary"
                      onClick={() => start("approve")}
                    >
                      <Icon name="check" />
                      Approve Listing
                    </UiButton>
                    <UiButton
                      variant="plain"
                      className="sl-btn sl-btn-ghost"
                      onClick={() => start("changes")}
                    >
                      <Icon name="edit" />
                      Request Changes
                    </UiButton>
                    <UiButton
                      variant="plain"
                      className="sl-btn sl-btn-outline-danger"
                      onClick={() => start("rejected")}
                    >
                      <Icon name="x" />
                      Reject Listing
                    </UiButton>
                  </div>
                </>
              ) : (
                <>
                  <Banner tone="info">
                    This listing is <b>{STATUS_LABEL[l.status]}</b>, so no
                    review decision is available.
                    {l.status === "draft" &&
                      " The seller has not submitted it or withdrew it."}
                  </Banner>
                  {l.decision && (
                    <div className="pt-mini review-view-7">
                      <b>{l.decision.reason}</b> — {l.decision.feedback}
                      <br />
                      By {l.decision.by}, {timeAgo(l.decision.at)}
                    </div>
                  )}
                  {(l.status === "approved" || l.status === "paused") && (
                    <>
                      <UiLabel
                        className={`sl-field ${
                          tried && feedbackBad ? "bad" : ""
                        }`}
                      >
                        <span>
                          Reason for take-down<b className="pt-req">*</b>
                        </span>
                        <UiTextarea
                          rows={3}
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          placeholder="Why is this listing being removed?"
                        />
                        {tried && feedbackBad && (
                          <em>Add at least 10 characters.</em>
                        )}
                      </UiLabel>
                      <UiButton
                        variant="plain"
                        className="sl-btn sl-btn-outline-danger review-view-9"
                        onClick={() => start("takedown")}
                      >
                        <Icon name="x" />
                        Take down listing
                      </UiButton>
                    </>
                  )}
                </>
              )}
              {next && l.status !== "pending" && (
                <a
                  className="sl-link review-view-11"
                  href={`#admin/review/${next.id}`}
                >
                  Next in queue: {next.draft.name} →
                </a>
              )}
            </section>
          </div>
        </div>
      )}
      {!busy && !mode && l.status !== "pending" && !loading && (
        <div className="review-view-13">
          <a className="sl-btn sl-btn-ghost" href="#admin/queue">
            <Icon name="left" />
            Back to queue
          </a>
        </div>
      )}
      {dialog}
    </>
  );
}
