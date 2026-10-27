import type { User } from "@/services/demoStore";
import type { FormEvent } from "react";
import "./Settings.css";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Button as UiButton } from "@/components/ui/button";
import { Input as UiInput } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { useState } from "react";
import type { Lang } from "@/hooks/useTranslation";
import {
  Banner,
  ConfirmDialog,
  Crumbs,
  Skeleton,
  useLoading,
} from "@/components/common/Portal";
import {
  request,
  setUserStatus,
  signOut,
  updateUser,
} from "@/services/demoStore";
import { Req, Toggle } from "@/components/account/AccountParts";
export function Settings({
  user,
  language,
  setLanguage,
  show,
  embedded = false,
}: {
  user: User;
  language: Lang;
  setLanguage: (l: Lang) => void;
  show: (m: string) => void;
  embedded?: boolean;
}) {
  const loading = useLoading(400);
  const [pw, setPw] = useState({
    cur: "",
    next: "",
    confirm: "",
  });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deact, setDeact] = useState(false);
  const errs: Record<string, string> = {};
  if (!pw.cur) errs.cur = "Enter your current password.";
  else if (pw.cur !== user.password)
    errs.cur = "Current password is incorrect.";
  if (pw.next.length < 8 || !/[A-Z]/.test(pw.next) || !/\d/.test(pw.next))
    errs.next = "Use 8+ characters, an uppercase letter, and a number.";
  else if (pw.next === pw.cur)
    errs.next = "Choose a password you haven't used before.";
  if (pw.confirm !== pw.next) errs.confirm = "Your passwords don't match.";
  const change = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    setError("");
    if (Object.keys(errs).length || busy) return;
    setBusy(true);
    try {
      await request(() =>
        updateUser(user.email, {
          password: pw.next,
        }),
      );
      setPw({
        cur: "",
        next: "",
        confirm: "",
      });
      setTried(false);
      show("Password changed");
    } catch (x) {
      setError(
        (x as Error).message === "expired"
          ? "Your session expired. Sign in again."
          : "Network error. Your password was not changed. Try again.",
      );
    }
    setBusy(false);
  };
  const pf = (k: keyof typeof pw, label: string) => (
    <UiLabel className={`sl-field ${tried && errs[k] ? "bad" : ""}`}>
      <span>
        {label}
        <Req />
      </span>
      <UiInput
        type="password"
        value={pw[k]}
        onChange={(e) =>
          setPw((x) => ({
            ...x,
            [k]: e.target.value,
          }))
        }
        autoComplete={k === "cur" ? "current-password" : "new-password"}
        aria-invalid={!!(tried && errs[k])}
      />
      {tried && errs[k] && <em>{errs[k]}</em>}
    </UiLabel>
  );
  const setPref = (k: keyof User["prefs"]) => (v: boolean) => {
    updateUser(user.email, {
      prefs: {
        ...user.prefs,
        [k]: v,
      },
    });
    show("Preference saved");
  };
  return (
    <>
      {!embedded && (
        <>
          <Crumbs
            items={[["Account", "#account/profile"], ["Account Settings"]]}
          />
          <div className="sl-page-head">
            <div>
              <h1>Account settings</h1>
              <p>Security, notifications and preferences.</p>
            </div>
          </div>
        </>
      )}
      {embedded && (
        <div className="sl-page-head">
          <div>
            <h2>Account settings</h2>
            <p>Security, notifications and preferences.</p>
          </div>
        </div>
      )}
      {loading ? (
        <section className="sl-card pad">
          <Skeleton rows={6} />
        </section>
      ) : (
        <div className="settings-view-2">
          <section className="sl-card pad">
            <h3>Language</h3>
            <div className="pt-form">
              <UiLabel className="sl-field">
                <span>Display language</span>
                <NativeSelect
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value as Lang);
                    show(
                      e.target.value === "vi"
                        ? "Đã chuyển sang Tiếng Việt"
                        : "Switched to English",
                    );
                  }}
                >
                  <NativeSelectOption value="en">English</NativeSelectOption>
                  <NativeSelectOption value="vi">Tiếng Việt</NativeSelectOption>
                </NativeSelect>
              </UiLabel>
            </div>
          </section>
          <section className="sl-card pad">
            <h3>Change password</h3>
            <form className="pt-form" onSubmit={change} noValidate>
              {error && <Banner tone="error">{error}</Banner>}
              {pf("cur", "Current password")}
              {pf("next", "New password")}
              {pf("confirm", "Confirm new password")}
              <div>
                <UiButton
                  variant="plain"
                  className="sl-btn sl-btn-primary"
                  type="submit"
                  disabled={busy}
                >
                  {busy ? (
                    <>
                      <span className="pt-spin" />
                      Updating…
                    </>
                  ) : (
                    "Update password"
                  )}
                </UiButton>
              </div>
            </form>
          </section>
          <section className="sl-card pad">
            <h3>Notification preferences</h3>
            <Toggle
              label="Status updates"
              hint="When your listings or orders change status."
              on={user.prefs.status}
              onChange={setPref("status")}
            />
            <Toggle
              label="Reminders"
              hint="Nudges about pending reviews and unfinished drafts."
              on={user.prefs.reminders}
              onChange={setPref("reminders")}
            />
            <Toggle
              label="System announcements"
              hint="Product news and policy changes."
              on={user.prefs.system}
              onChange={setPref("system")}
            />
            <p className="pt-mini settings-view-4">
              Approval, rejection and security notifications can't be turned
              off.
            </p>
          </section>
          {user.role !== "Admin" && (
            <section className="pt-danger-zone">
              <h3 className="settings-view-8">Deactivate account</h3>
              <p className="pt-mini settings-view-10">
                You'll be signed out immediately and won't be able to sign in
                until an admin reactivates your account.
              </p>
              <UiButton
                variant="plain"
                className="sl-btn sl-btn-outline-danger"
                onClick={() => setDeact(true)}
              >
                Deactivate my account
              </UiButton>
            </section>
          )}
        </div>
      )}
      {deact && (
        <ConfirmDialog
          danger
          requireText="DEACTIVATE"
          title="Deactivate your account?"
          body="This signs you out right away. Contact support or an admin to get access back."
          confirmLabel="Deactivate account"
          onCancel={() => setDeact(false)}
          onConfirm={() => {
            setUserStatus(user.email, "suspended", user.name);
            signOut("Your account was deactivated.");
          }}
        />
      )}
    </>
  );
}
