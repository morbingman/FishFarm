import type { User, LStatus, Img } from "@/services/demoStore";
import type { TFn, Toast } from "@/data/sellerData";
import { Textarea as UiTextarea } from "@/components/ui/textarea";
import { Button as UiButton } from "@/components/ui/button";
import { Input as UiInput } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";
import {
  Banner,
  ConfirmDialog,
  Crumbs,
  StateBlock,
  StatusChip,
  go,
} from "@/components/common/Portal";
import {
  EMPTY_DRAFT,
  SAMPLE_PHOTOS,
  getListing,
  request,
  saveDraft,
  submitListing,
  useStore,
  type Draft,
} from "@/services/demoStore";
import {
  SPECIES,
  SAMPLE,
  GENDERS,
  ORIGINS,
  HEALTH,
  REGIONS,
  SHIPPING,
  STEPS,
} from "@/data/sellerData";
import { Field, Select, Icon } from "@/components/seller/SellerParts";
import { ListingView } from "@/pages/seller/ListingView";
export function ListingForm({
  user,
  id,
  t,
  show,
}: {
  user: User;
  id?: string;
  t: TFn;
  show: Toast;
}) {
  const existing = id ? getListing(id) : undefined;
  const s = useStore();
  const [recId, setRecId] = useState<string | undefined>(id);
  const [draft, setDraft] = useState<Draft>(() =>
    existing ? existing.draft : EMPTY_DRAFT,
  );
  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(existing ? 6 : 1);
  const [tried, setTried] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "submit">("");
  const [err, setErr] = useState("");
  const [leave, setLeave] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropZone, setDropZone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const rec = recId ? s.listings.find((x) => x.id === recId) : undefined;
  useEffect(() => {
    window.scrollTo({
      top: 0,
    });
  }, [step]);
  useEffect(() => {
    if (!dirty) return;
    const f = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [dirty]);
  const crumbs = (label: string): [string, string?][] => [
    [t("Seller Center"), "#admin"],
    [t("My Listings"), "#admin/listings"],
    [label],
  ];
  if (id && !existing) {
    const gone = s.deleted.includes(id);
    return (
      <>
        <Crumbs items={crumbs(id)} />
        <StateBlock
          card
          icon={gone ? "x" : "search"}
          tone="warn"
          title={gone ? t("This listing was deleted") : t("Listing not found")}
          body={
            gone
              ? t("The listing was deleted and can no longer be opened.")
              : t("It may have been deleted or you may not have access to it.")
          }
          actions={
            <a className="sl-btn sl-btn-primary" href="#admin/listings">
              {t("Back to My Listings")}
            </a>
          }
        />
      </>
    );
  }
  if (existing && user.role !== "Admin" && existing.owner !== user.email)
    return (
      <>
        <Crumbs items={crumbs(id!)} />
        <StateBlock
          card
          icon="lock"
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
  if (rec && rec.status === "pending")
    return (
      <>
        <Crumbs items={crumbs(rec.draft.name)} />
        <StateBlock
          card
          icon="clock"
          tone="info"
          title={t("This listing is under review")}
          body={t("Withdraw it first if you want to make changes.")}
          actions={
            <a
              className="sl-btn sl-btn-primary"
              href={`#admin/listing/${rec.id}`}
            >
              {t("View")}
            </a>
          }
        />
      </>
    );
  const status: LStatus | null = rec?.status ?? null;
  const resubmit =
    status === "changes" || status === "rejected" || status === "approved";
  const decision = rec?.decision;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({
      ...d,
      [k]: v,
    }));
    setDirty(true);
    setErr("");
  };
  const e: Record<number, string[]> = {
    1: [
      !draft.name.trim() && "name",
      !draft.species && "species",
      draft.description.trim().length < 20 && "description",
    ].filter(Boolean) as string[],
    2: [
      !draft.age.trim() && "age",
      !(Number(draft.size) > 0) && "size",
      !draft.gender && "gender",
      !draft.origin && "origin",
      !draft.health && "health",
    ].filter(Boolean) as string[],
    3: [
      !(Number(draft.price) > 0) && "price",
      !(Number(draft.quantity) >= 1) && "quantity",
    ].filter(Boolean) as string[],
    4: [draft.images.length < 1 && "images"].filter(Boolean) as string[],
    5: [
      !draft.location.trim() && "location",
      !draft.region && "region",
      draft.shipping.length < 1 && "shipping",
    ].filter(Boolean) as string[],
    6: [],
  };
  const err_ = (f: string) => tried && e[step]?.includes(f);
  const goStep = (n: number) => {
    setStep(n);
    setTried(false);
  };
  const next = () => {
    if (e[step].length) {
      setTried(true);
      return;
    }
    const n = Math.min(6, step + 1);
    setMaxStep((m) => Math.max(m, n));
    goStep(n);
  };
  const fail = (x: Error) =>
    setErr(
      x.message === "expired"
        ? "Your session expired. Please sign in again."
        : "Network error — your changes are still here. Check your connection and try again.",
    );
  const saveNow = () => {
    if (busy) return;
    if (!draft.name.trim()) {
      setStep(1);
      setTried(true);
      return;
    }
    setBusy("save");
    setErr("");
    request(() => saveDraft(user, recId, draft), 600)
      .then((nid) => {
        setRecId(nid);
        setDirty(false);
        setBusy("");
        show("Draft saved");
      })
      .catch((x) => {
        setBusy("");
        fail(x);
      });
  };
  const submit = () => {
    if (busy) return;
    for (let i = 1; i <= 5; i++)
      if (e[i].length) {
        setStep(i);
        setTried(true);
        setErr(`Step ${i} is incomplete — please fill in the required fields.`);
        return;
      }
    setBusy("submit");
    setErr("");
    request(() => {
      const nid = saveDraft(user, recId, draft);
      submitListing(user, nid, draft);
      return nid;
    }, 900)
      .then((nid) => {
        setDirty(false);
        go(`admin/listing/${nid}?submitted=1`);
      })
      .catch((x) => {
        setBusy("");
        fail(x);
      });
  };
  const leaveTo = () => {
    if (dirty) setLeave(true);
    else go(recId ? `admin/listing/${recId}` : "admin/listings");
  };
  const addImgs = (imgs: Img[]) => {
    const merged = [
      ...draft.images,
      ...imgs.filter((n) => !draft.images.some((o) => o.id === n.id)),
    ].slice(0, 8);
    setDraft((d) => ({
      ...d,
      images: merged,
      mainId: d.mainId || merged[0]?.id || "",
    }));
    setDirty(true);
  };
  const addFiles = (files: FileList | null) => {
    if (!files) return;
    addImgs(
      [...files]
        .filter((f) => f.type.startsWith("image/"))
        .map((f) => ({
          id: `u${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
          url: URL.createObjectURL(f),
        })),
    );
  };
  const removeImg = (iid: string) => {
    const images = draft.images.filter((i) => i.id !== iid);
    setDraft((d) => ({
      ...d,
      images,
      mainId: d.mainId === iid ? (images[0]?.id ?? "") : d.mainId,
    }));
    setDirty(true);
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= draft.images.length || from === to) return;
    const a = [...draft.images];
    const [m] = a.splice(from, 1);
    a.splice(to, 0, m);
    set("images", a);
  };
  const stepBody = () => {
    switch (step) {
      case 1:
        return (
          <div className="sl-form-grid">
            <Field t={t} bad={err_("name")} id="name" label="Fish Name">
              <UiInput
                value={draft.name}
                onChange={(x) => set("name", x.target.value)}
                placeholder={t("e.g. Showa Sanshoku Koi")}
              />
            </Field>
            <Select
              t={t}
              bad={err_("species")}
              id="species"
              label="Species"
              value={draft.species}
              options={SPECIES}
              onChange={(v) => set("species", v)}
            />
            <Field t={t} optional bad={false} id="breed" label="Breed">
              <UiInput
                value={draft.breed}
                onChange={(x) => set("breed", x.target.value)}
                placeholder={t("e.g. Showa, Kohaku, Halfmoon")}
              />
            </Field>
            <div className="sl-sample">
              <UiButton
                variant="plain"
                type="button"
                className="sl-link"
                onClick={() => {
                  setDraft((d) => ({
                    ...d,
                    ...SAMPLE,
                  }));
                  setDirty(true);
                }}
              >
                <Icon name="fish" /> {t("Use sample koi data")}
              </UiButton>
            </div>
            <div className="sl-span2">
              <Field
                t={t}
                bad={err_("description")}
                id="description"
                label="Description"
                hint={`${draft.description.length} / 600 · min 20`}
              >
                <UiTextarea
                  rows={6}
                  maxLength={600}
                  value={draft.description}
                  onChange={(x) => set("description", x.target.value)}
                  placeholder={t(
                    "Lineage, colouring, temperament, feeding and water conditions…",
                  )}
                />
              </Field>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="sl-form-grid">
            <Field t={t} bad={err_("age")} id="age" label="Age">
              <UiInput
                value={draft.age}
                onChange={(x) => set("age", x.target.value)}
                placeholder={t("e.g. 14 months")}
              />
            </Field>
            <Field t={t} bad={err_("size")} id="size" label="Size">
              <div className="sl-unit">
                <UiInput
                  type="number"
                  min="0"
                  value={draft.size}
                  onChange={(x) => set("size", x.target.value)}
                  placeholder="32"
                />
                <span>cm</span>
              </div>
            </Field>
            <Select
              t={t}
              bad={err_("gender")}
              id="gender"
              label="Gender"
              value={draft.gender}
              options={GENDERS}
              onChange={(v) => set("gender", v)}
            />
            <Select
              t={t}
              bad={err_("origin")}
              id="origin"
              label="Origin"
              value={draft.origin}
              options={ORIGINS}
              onChange={(v) => set("origin", v)}
            />
            <div className="sl-span2">
              <Select
                t={t}
                bad={err_("health")}
                id="health"
                label="Health Status"
                value={draft.health}
                options={HEALTH}
                onChange={(v) => set("health", v)}
              />
            </div>
          </div>
        );
      case 3:
        return (
          <div className="sl-form-grid">
            <Field
              t={t}
              bad={err_("price")}
              id="price"
              label="Price per fish (USD)"
            >
              <div className="sl-unit pre">
                <span>$</span>
                <UiInput
                  type="number"
                  min="0"
                  value={draft.price}
                  onChange={(x) => set("price", x.target.value)}
                  placeholder="480"
                />
              </div>
            </Field>
            <Field
              t={t}
              bad={err_("quantity")}
              id="quantity"
              label="Quantity available"
            >
              <UiInput
                type="number"
                min="1"
                value={draft.quantity}
                onChange={(x) => set("quantity", x.target.value)}
              />
            </Field>
            <div className="sl-span2 sl-toggle-row">
              <div>
                <b>{t("Negotiable")}</b>
                <small>{t("Buyers can send you an offer")}</small>
              </div>
              <UiButton
                variant="plain"
                type="button"
                role="switch"
                aria-checked={draft.negotiable}
                aria-label={t("Negotiable")}
                className={`sl-switch ${draft.negotiable ? "on" : ""}`}
                onClick={() => set("negotiable", !draft.negotiable)}
              >
                <i />
              </UiButton>
            </div>
          </div>
        );
      case 4:
        return (
          <div>
            <div
              className={`sl-drop ${dropZone ? "over" : ""} ${
                err_("images") ? "bad" : ""
              }`}
              onDragOver={(x) => {
                x.preventDefault();
                setDropZone(true);
              }}
              onDragLeave={() => setDropZone(false)}
              onDrop={(x) => {
                x.preventDefault();
                setDropZone(false);
                addFiles(x.dataTransfer.files);
              }}
            >
              <Icon name="upload" />
              <b>{t("Upload Fish Images")}</b>
              <p>{t("Drag photos here or browse")}</p>
              <UiButton
                variant="plain"
                type="button"
                className="sl-btn sl-btn-ghost"
                onClick={() => fileRef.current?.click()}
              >
                {t("Browse files")}
              </UiButton>
              <UiInput
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(x) => {
                  addFiles(x.target.files);
                  x.target.value = "";
                }}
              />
              <small>
                {t(
                  "JPG or PNG, up to 8 photos. The first photo is your cover.",
                )}
              </small>
            </div>
            {err_("images") && (
              <p className="sl-err">
                {t("Required")}: {t("Upload Fish Images")}
              </p>
            )}
            <div className="sl-samples">
              <span>{t("Or start with sample photos")}</span>
              {SAMPLE_PHOTOS.map((p) => (
                <UiButton
                  variant="plain"
                  key={p.id}
                  disabled={draft.images.some((i) => i.id === p.id)}
                  onClick={() => addImgs([p])}
                  aria-label="Add sample photo"
                >
                  <img src={p.url} alt="" />
                </UiButton>
              ))}
            </div>
            {draft.images.length > 0 && (
              <ul className="sl-thumbs">
                {draft.images.map((img, i) => {
                  const isMain =
                    (draft.mainId || draft.images[0].id) === img.id;
                  return (
                    <li
                      key={img.id}
                      draggable
                      onDragStart={() => setDragIdx(i)}
                      onDragOver={(x) => x.preventDefault()}
                      onDrop={() => {
                        if (dragIdx !== null) move(dragIdx, i);
                        setDragIdx(null);
                      }}
                      className={`${isMain ? "main" : ""} ${
                        dragIdx === i ? "drag" : ""
                      }`}
                    >
                      <img src={img.url} alt={`Photo ${i + 1}`} />
                      {isMain && (
                        <span className="sl-main-badge">{t("Main")}</span>
                      )}
                      <span className="sl-order">{i + 1}</span>
                      <div className="sl-thumb-actions">
                        <UiButton
                          variant="plain"
                          onClick={() => move(i, i - 1)}
                          disabled={i === 0}
                          aria-label={t("Move earlier")}
                          title={t("Move earlier")}
                        >
                          <Icon name="left" />
                        </UiButton>
                        <UiButton
                          variant="plain"
                          onClick={() => move(i, i + 1)}
                          disabled={i === draft.images.length - 1}
                          aria-label={t("Move later")}
                          title={t("Move later")}
                        >
                          <Icon name="right" />
                        </UiButton>
                        <UiButton
                          variant="plain"
                          onClick={() => set("mainId", img.id)}
                          disabled={isMain}
                          aria-label={t("Set Main Image")}
                          title={t("Set Main Image")}
                        >
                          <Icon name="star" />
                        </UiButton>
                        <UiButton
                          variant="plain"
                          onClick={() => removeImg(img.id)}
                          aria-label={t("Delete Image")}
                          title={t("Delete Image")}
                          className="del"
                        >
                          <Icon name="trash" />
                        </UiButton>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {draft.images.length > 1 && (
              <p className="sl-hint">{t("Drag to reorder")}</p>
            )}
          </div>
        );
      case 5:
        return (
          <div className="sl-form-grid">
            <div className="sl-span2">
              <Field
                t={t}
                bad={err_("location")}
                id="location"
                label="Farm / Store Location"
              >
                <UiInput
                  value={draft.location}
                  onChange={(x) => set("location", x.target.value)}
                  placeholder={t("Street address or farm name")}
                />
              </Field>
            </div>
            <Select
              t={t}
              bad={err_("region")}
              id="region"
              label="Region"
              value={draft.region}
              options={REGIONS}
              onChange={(v) => set("region", v)}
            />
            <div className="sl-span2">
              <p className="sl-label">{t("Shipping Availability")} *</p>
              <div className={`sl-ship ${err_("shipping") ? "bad" : ""}`}>
                {SHIPPING.map((sh) => {
                  const on = draft.shipping.includes(sh);
                  return (
                    <UiButton
                      variant="plain"
                      type="button"
                      key={sh}
                      aria-pressed={on}
                      className={on ? "on" : ""}
                      onClick={() =>
                        set(
                          "shipping",
                          on
                            ? draft.shipping.filter((z) => z !== sh)
                            : [...draft.shipping, sh],
                        )
                      }
                    >
                      <Icon name={sh === "Local pickup" ? "pin" : "truck"} />
                      <span>{t(sh)}</span>
                      {on && <Icon name="check" className="tick" />}
                    </UiButton>
                  );
                })}
              </div>
              {err_("shipping") && <p className="sl-err">{t("Required")}</p>}
            </div>
          </div>
        );
      default:
        return null;
    }
  };
  return (
    <>
      <Crumbs
        items={crumbs(
          existing ? existing.draft.name || existing.id : t("Add New Fish"),
        )}
      />
      <div className="sl-page-head tight">
        <div>
          <span className="sl-eyebrow">{recId ?? t("Seller Center")}</span>
          <h1>{existing ? t("Edit listing") : t("Add New Fish")}</h1>
          <p>
            {t(
              "Create your listing in six short steps. Your progress is saved as you go.",
            )}{" "}
            <small>* {t("Required fields are marked")}</small>
          </p>
        </div>
        {status && <StatusChip s={status} />}
      </div>
      {(status === "changes" || status === "rejected") && decision && (
        <Banner tone="warn">
          <b>
            {t("Changes requested")}: {t(decision.reason)}
          </b>{" "}
          — {decision.feedback}
        </Banner>
      )}
      {status === "approved" && (
        <Banner tone="warn">
          {t(
            "Editing a live listing sends it back to review and hides it until approved.",
          )}
        </Banner>
      )}
      {err && (
        <Banner
          tone="error"
          action={
            <UiButton
              variant="plain"
              className="sl-btn sl-btn-ghost"
              onClick={() => (step === 6 ? submit() : saveNow())}
            >
              {t("Try again")}
            </UiButton>
          }
        >
          {err}
        </Banner>
      )}
      <ol className="sl-steps">
        {STEPS.map((st, i) => {
          const n = i + 1;
          const state =
            n === step ? "cur" : n < step || n <= maxStep ? "done" : "";
          return (
            <li key={st} className={state}>
              <UiButton
                variant="plain"
                disabled={n > maxStep}
                onClick={() => goStep(n)}
                aria-current={n === step ? "step" : undefined}
              >
                <i>{n < step ? <Icon name="check" /> : `0${n}`}</i>
                <span>{t(st)}</span>
              </UiButton>
            </li>
          );
        })}
      </ol>
      {step < 6 ? (
        <section className="sl-card sl-form-card">
          <h2>
            <span>0{step}</span>
            {t(STEPS[step - 1])}
          </h2>
          {stepBody()}
        </section>
      ) : (
        <>
          <div className="sl-preview-bar">
            <div>
              <span className="sl-eyebrow">
                <Icon name="eye" /> {t("Buyer view")}
              </span>
              <p>{t("This is exactly how buyers will see your listing.")}</p>
            </div>
          </div>
          <div className="sl-frame">
            <ListingView draft={draft} seller={user.store || user.name} t={t} />
          </div>
        </>
      )}
      <div className="sl-footer">
        <UiButton
          variant="plain"
          className="sl-btn sl-btn-ghost"
          onClick={() => (step === 1 ? leaveTo() : goStep(step - 1))}
          disabled={!!busy}
        >
          <Icon name="left" />
          {step === 1 ? t("Cancel") : t("Back")}
        </UiButton>
        <div>
          {step === 6 && (
            <UiButton
              variant="plain"
              className="sl-btn sl-btn-ghost"
              onClick={() => goStep(1)}
            >
              <Icon name="edit" />
              {t("Edit Listing")}
            </UiButton>
          )}
          {status !== "approved" && (
            <UiButton
              variant="plain"
              className="sl-btn sl-btn-ghost"
              onClick={saveNow}
              disabled={!!busy}
            >
              {busy === "save" ? t("Saving…") : t("Save Draft")}
            </UiButton>
          )}
          {step < 6 ? (
            <UiButton
              variant="plain"
              className="sl-btn sl-btn-primary"
              onClick={next}
            >
              {t("Continue")}
              <Icon name="arrow" />
            </UiButton>
          ) : (
            <UiButton
              variant="plain"
              className="sl-btn sl-btn-primary"
              disabled={!!busy || (resubmit && !dirty)}
              onClick={submit}
            >
              {busy === "submit"
                ? t("Submitting…")
                : t(resubmit ? "Resubmit for Review" : "Submit for Review")}
              <Icon name="arrow" />
            </UiButton>
          )}
        </div>
      </div>
      {resubmit && step === 6 && !dirty && (
        <p className="sl-hint right">
          {t("Edit Listing")} → {t("Resubmit for Review")}
        </p>
      )}
      {leave && (
        <ConfirmDialog
          danger
          title="Discard changes?"
          body="You have unsaved changes. If you leave now they will be lost."
          confirmLabel="Discard"
          onCancel={() => setLeave(false)}
          onConfirm={() => {
            setDirty(false);
            go(recId ? `admin/listing/${recId}` : "admin/listings");
          }}
        />
      )}
    </>
  );
}
