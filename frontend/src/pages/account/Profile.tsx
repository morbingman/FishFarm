import type { User } from "@/services/demoStore";
import type { FormEvent } from "react";
import "./Profile.css";
import { Button as UiButton } from "@/components/ui/button";
import { Input as UiInput } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { useState } from "react";
import {
  Banner,
  Crumbs,
  Skeleton,
  useLoading,
} from "@/components/common/Portal";
import { request, updateUser } from "@/services/demoStore";
import { Req, Opt } from "@/components/account/AccountParts";
export function Profile({
  user,
  show,
}: {
  user: User;
  show: (m: string) => void;
}) {
  const loading = useLoading(400);
  const [f, setF] = useState({
    name: user.name,
    phone: user.phone,
    location: user.location,
    store: user.store ?? "",
  });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const dirty =
    f.name !== user.name ||
    f.phone !== user.phone ||
    f.location !== user.location ||
    f.store !== (user.store ?? "");
  const errs: Record<string, string> = {};
  if (!f.name.trim()) errs.name = "Enter your name.";
  if (f.phone && !/^\+?[\d\s()-]{7,20}$/.test(f.phone))
    errs.phone = "Enter a valid phone number.";
  if (!f.location.trim()) errs.location = "Enter your location.";
  if (user.role === "Admin" && !f.store.trim())
    errs.store = "Enter your store name.";
  const set =
    (k: keyof typeof f) =>
    (e: {
      target: {
        value: string;
      };
    }) => {
      setF((x) => ({
        ...x,
        [k]: e.target.value,
      }));
      setSaved(false);
    };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError("");
    if (Object.keys(errs).length || busy) return;
    setBusy(true);
    try {
      await request(() =>
        updateUser(user.email, {
          name: f.name.trim(),
          phone: f.phone.trim(),
          location: f.location.trim(),
          ...(user.role === "Admin"
            ? {
                store: f.store.trim(),
              }
            : {}),
        }),
      );
      setSaved(true);
      show("Profile updated");
    } catch (x) {
      setError(
        (x as Error).message === "expired"
          ? "Your session expired. Sign in again."
          : "Network error. Your changes were not saved. Try again.",
      );
    }
    setBusy(false);
  };
  const field = (
    k: keyof typeof f,
    label: string,
    opts: {
      req?: boolean;
      type?: string;
      hint?: string;
    } = {},
  ) => (
    <UiLabel className={`sl-field ${tried && errs[k] ? "bad" : ""}`}>
      <span>
        {label}
        {opts.req ? <Req /> : <Opt />}
      </span>
      <UiInput
        value={f[k]}
        onChange={set(k)}
        type={opts.type ?? "text"}
        aria-invalid={!!(tried && errs[k])}
      />
      {tried && errs[k] ? (
        <em>{errs[k]}</em>
      ) : opts.hint ? (
        <small className="profile-view-2">{opts.hint}</small>
      ) : null}
    </UiLabel>
  );
  return (
    <>
      <Crumbs items={[["Account", "#account/profile"], ["Profile"]]} />
      <div className="sl-page-head">
        <div>
          <h1>Profile</h1>
          <p>Your personal details and public information.</p>
        </div>
      </div>
      <section className="sl-card pad">
        {loading ? (
          <Skeleton rows={5} />
        ) : (
          <form className="pt-form" onSubmit={submit} noValidate>
            {error && (
              <Banner
                tone="error"
                action={
                  <UiButton
                    variant="plain"
                    type="button"
                    onClick={submit as never}
                  >
                    Retry
                  </UiButton>
                }
              >
                {error}
              </Banner>
            )}
            {saved && !dirty && (
              <Banner tone="ok">Your profile was saved.</Banner>
            )}
            <UiLabel className="sl-field">
              <span>
                Email<span className="pt-opt">Can't be changed</span>
              </span>
              <UiInput value={user.email} disabled />
              <small className="profile-view-4">
                Role: {user.role}. Member since {user.joined}.
              </small>
            </UiLabel>
            {field(
              "name",
              user.role === "Admin" ? "Contact name" : "Full name",
              {
                req: true,
              },
            )}
            {user.role === "Admin" &&
              field("store", "Store name", {
                req: true,
                hint: "Shown to buyers on every listing.",
              })}
            <div className="row2">
              {field("phone", "Phone", {
                type: "tel",
              })}
              {field("location", "Location", {
                req: true,
              })}
            </div>
            <div className="sl-row profile-view-6">
              <UiButton
                variant="plain"
                className="sl-btn sl-btn-primary"
                type="submit"
                disabled={busy || !dirty}
              >
                {busy ? (
                  <>
                    <span className="pt-spin" />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </UiButton>
              <UiButton
                variant="plain"
                className="sl-btn sl-btn-ghost"
                type="button"
                disabled={busy || !dirty}
                onClick={() => {
                  setF({
                    name: user.name,
                    phone: user.phone,
                    location: user.location,
                    store: user.store ?? "",
                  });
                  setTried(false);
                }}
              >
                Discard
              </UiButton>
            </div>
          </form>
        )}
      </section>
    </>
  );
}
