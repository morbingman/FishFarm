import { LogoMark } from "@/components/layout/LogoMark";
import type { Lang } from "@/hooks/useTranslation";
import type { FormEvent } from "react";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea as UiTextarea } from "@/components/ui/textarea";
import { Input as UiInput } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { Button as UiButton } from "@/components/ui/button";
import {
  addUser,
  authenticate,
  currentUser,
  findUser,
  homeFor,
  log,
  signOut,
  startSession,
  takeFlash,
  takeReturnTo,
  type Role,
} from "@/services/demoStore";
import { useEffect, useRef, useState } from "react";
import { useDomTranslation } from "@/hooks/useTranslation";
import { authVi } from "@/data/translations";
import "@/pages/auth/Auth.css";
import { type Screen, screenMeta } from "@/data/authData";
import { authApi } from "@/services/api";
import { Symbol, Field, Action } from "@/components/auth/AuthParts";
export default function Auth({
  language,
  setLanguage,
}: {
  language: Lang;
  setLanguage: (l: Lang) => void;
}) {
  useDomTranslation(language, authVi);
  const [screen, setScreen] = useState<Screen>(() =>
    currentUser() ? "dashboard" : "login",
  );
  const [role, setRole] = useState<Role>(() => currentUser()?.role ?? "Buyer");
  const [info] = useState(() => takeFlash() ?? "");
  const regRef = useRef<Record<string, string> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [seconds, setSeconds] = useState(45);
  const [expiry, setExpiry] = useState(Date.now() + 5 * 60_000);
  const [legal, setLegal] = useState<string | null>(null);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const modal = useRef<HTMLDivElement>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (screen !== "verify") return;
    const interval = setInterval(
      () => setSeconds((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearInterval(interval);
  }, [screen]);
  useEffect(() => {
    heading.current?.focus();
  }, [screen]);
  useEffect(() => {
    if (!legal) return;
    const previous = document.activeElement as HTMLElement | null;
    modal.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLegal(null);
      if (event.key === "Tab") {
        event.preventDefault();
        modal.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [legal]);
  function go(next: Screen) {
    if (timer.current) clearTimeout(timer.current);
    if (next === "register" && role === "Admin") setRole("Buyer");
    setScreen(next);
    setErrors({});
    setNotice("");
    setBusy(false);
    setPassword("");
    if (next === "verify") {
      setOtp(Array(6).fill(""));
      setSeconds(45);
      setExpiry(Date.now() + 5 * 60_000);
    }
  }
  function redirectAfterLogin(r: Role) {
    const back = takeReturnTo();
    const top = (back ?? "").split(/[/?]/)[0];
    const ok =
      (top === "admin" && r === "Admin") ||
      top === "marketplace" ||
      top === "account";
    window.location.hash =
      r === "Admin"
        ? top === "admin" && back && back !== "admin"
          ? back
          : "admin/listings"
        : "home";
  }
  function pending(callback: () => void) {
    setBusy(true);
    timer.current = setTimeout(() => {
      setBusy(false);
      callback();
    }, 900);
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    const nextErrors: Record<string, string> = {};
    if (
      screen !== "verify" &&
      screen !== "reset" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || "")
    )
      nextErrors.email = "Enter a valid email address.";
    if (["login", "register", "reset"].includes(screen) && !data.password)
      nextErrors.password = "Enter your password.";
    if (screen === "register" || screen === "reset") {
      if (
        (data.password || "").length < 8 ||
        !/[A-Z]/.test(data.password || "") ||
        !/\d/.test(data.password || "")
      )
        nextErrors.password =
          "Use 8+ characters, an uppercase letter, and a number.";
      if (data.confirm !== data.password)
        nextErrors.confirm = "Your passwords don't match.";
    }
    if (screen === "register") {
      for (const field of ["name", "phone", "location"])
        if (!data[field]?.trim()) nextErrors[field] = "This field is required.";
      if (data.phone && !/^\+?[\d\s()-]{7,20}$/.test(data.phone))
        nextErrors.phone = "Enter a valid phone number.";
      if (!data.terms)
        nextErrors.terms = "Please agree to the terms to continue.";
    }
    if (screen === "verify") {
      if (Date.now() > expiry)
        nextErrors.otp = "This code has expired. Request a new one.";
      else if (!/^\d{6}$/.test(otp.join("")))
        nextErrors.otp = "Enter the 6-digit code sent to your email.";
    }
    let matched: Role | null = null;
    if (screen === "login" && !Object.keys(nextErrors).length) {
      setBusy(true);
      const res = await authenticate(data.email, data.password);
      setBusy(false);
      if (!res.ok) {
        if (res.reason === "suspended")
          nextErrors.email =
            "This account is suspended. Contact support to appeal.";
        else nextErrors.password = "Incorrect email or password.";
      } else {
        matched = res.user.role;
      }
    }
    if (
      screen === "register" &&
      !Object.keys(nextErrors).length &&
      findUser(data.email)
    )
      nextErrors.email =
        "An account with this email already exists. Try signing in instead.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (data.email) setEmail(data.email);
    if (screen === "register") {
      setBusy(true);
      try {
        regRef.current = data;
        await addUser({
          email: data.email.trim().toLowerCase(),
          password: data.password,
          name: data.name.trim(),
          role: "Buyer",
          phone: data.phone,
          location: data.location,
          store: undefined,
        });
        const verification = await authApi.verifyEmail(data.email);
        go("verify");
        if (verification.devCode)
          setNotice(`Development code: ${verification.devCode}`);
      } catch {
        setErrors({
          email:
            "This email is already registered or the server is unavailable.",
        });
      } finally {
        setBusy(false);
      }
      return;
    }
    if (screen === "verify") {
      setBusy(true);
      try {
        await authApi.verifyEmail(email, otp.join(""));
        go("created");
      } catch {
        setErrors({ otp: "That code is invalid or expired." });
      } finally {
        setBusy(false);
      }
      return;
    }
    if (screen === "forgot") {
      setBusy(true);
      try {
        const reset = await authApi.forgotPassword(data.email);
        go("email");
        if (reset.devCode) setNotice(`Development code: ${reset.devCode}`);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (screen === "reset") {
      setBusy(true);
      try {
        await authApi.resetPassword(email, data.code, data.password);
        go("updated");
      } catch {
        setErrors({ code: "That reset code is invalid or expired." });
      } finally {
        setBusy(false);
      }
      return;
    }
    pending(() => {
      if (screen === "login") {
        if (matched) setRole(matched);
        setNotice("Signed in successfully. Taking you to your dashboard…");
        timer.current = setTimeout(() => {
          // Commit the route and session together. A gated page must not
          // unmount Auth before its delayed redirect has run.
          startSession(data.email.trim().toLowerCase());
          redirectAfterLogin(matched ?? role);
          const signedIn = currentUser();
          if (signedIn) log(signedIn.name, signedIn.role, "Signed in");
        }, 700);
      }
    });
  }
  const strength =
    Number(password.length >= 8) +
    Number(/[A-Z]/.test(password)) +
    Number(/\d/.test(password)) +
    Number(/[^a-zA-Z0-9]/.test(password));
  const success = ["created", "updated", "email"].includes(screen);
  return (
    <>
      <div className="auth-app">
        <aside className="auth-visual">
          <img
            className="auth-photo"
            src="https://images.unsplash.com/photo-1668349009169-93e19d2eba7a?auto=format&fit=crop&w=1800&q=90"
            alt="Premium koi moving through deep blue water"
          />
          <div className="auth-photo-shade" />
          <a className="auth-brand" href="#home">
            <LogoMark />
            FISHMARKET
            <span className="auth-brand-dot" />
          </a>
          <div className="auth-visual-content">
            <span className="auth-kicker">
              <span /> A BETTER WAY TO TRADE
            </span>
            <h2>
              Great fish.
              <br />
              Trusted people.
              <br />
              <span>Better business.</span>
            </h2>
            <p>
              Connecting passionate buyers with exceptional breeders, farms, and
              sellers. Trade with confidence, every time.
            </p>
            <div className="auth-community">
              <div className="auth-avatars">
                <span>MT</span>
                <span>SL</span>
                <span>DK</span>
                <span>+</span>
              </div>
              <div>
                <strong>Good company. Great opportunities.</strong>
                <span>Join our growing trading community.</span>
              </div>
            </div>
          </div>
          <div className="auth-visual-bottom">
            <span>
              <Symbol name="shield" /> Built on trust. Made for trade.
            </span>
            <span>EST. 2026</span>
          </div>
        </aside>

        <section className="auth-workspace">
          <main
            className={`auth-main ${screen === "register" ? "auth-wide" : ""}`}
          >
            <div className="auth-progress">
              <span className="auth-section-tag">YOUR FISHMARKET ACCOUNT</span>
              <span className="auth-mini-line" />
            </div>
            {screen !== "login" && screen !== "dashboard" && (
              <UiButton
                variant="plain"
                className="auth-back"
                onClick={() => go(screen === "verify" ? "register" : "login")}
              >
                ← Back to {screen === "verify" ? "registration" : "sign in"}
              </UiButton>
            )}
            <div
              className={`auth-heading-symbol ${success ? "is-success" : ""}`}
            >
              <Symbol
                name={
                  success
                    ? "check"
                    : screen === "verify"
                      ? "mail"
                      : screen === "register"
                        ? "user"
                        : "lock"
                }
              />
            </div>
            <h1 ref={heading} tabIndex={-1}>
              {screen === "dashboard"
                ? "You're signed in"
                : screenMeta[screen][0]}
            </h1>
            <p className="auth-description">{screenMeta[screen][1]}</p>

            {notice && (
              <div className="auth-notice" role="status">
                <Symbol name="check" />
                {notice}
              </div>
            )}

            {screen === "login" && (
              <>
                {info && !notice && (
                  <div className="auth-notice" role="status">
                    <Symbol name="shield" />
                    {info}
                  </div>
                )}
                <form noValidate onSubmit={submit} className="auth-form">
                  <Field
                    label="Email Address"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    error={errors.email}
                  />
                  <Field
                    label="Password"
                    name="password"
                    type="password"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    error={errors.password}
                  />
                  <div className="auth-options">
                    <UiLabel className="auth-checkbox">
                      <UiInput type="checkbox" name="remember" />
                      Remember me
                    </UiLabel>
                    <UiButton
                      variant="plain"
                      type="button"
                      className="auth-text-button"
                      onClick={() => go("forgot")}
                    >
                      Forgot password?
                    </UiButton>
                  </div>
                  <Action type="submit" disabled={busy || !!notice}>
                    {busy ? (
                      <>
                        <span className="auth-spinner" />
                        Signing in…
                      </>
                    ) : (
                      <>
                        Sign In <Symbol name="arrow" />
                      </>
                    )}
                  </Action>
                </form>
                <p className="auth-bottom-question">
                  Don't have an account?{" "}
                  <UiButton
                    variant="plain"
                    className="auth-text-button"
                    onClick={() => go("register")}
                  >
                    Create Account <span>↗</span>
                  </UiButton>
                </p>
              </>
            )}

            {screen === "register" && (
              <form noValidate onSubmit={submit} className="auth-form">
                <div className="auth-register-grid">
                  <Field
                    label="Full Name"
                    name="name"
                    placeholder="Your full name"
                    autoComplete="name"
                    error={errors.name}
                  />
                  <Field
                    label="Email Address"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    error={errors.email}
                  />
                  <Field
                    label="Phone Number"
                    name="phone"
                    type="tel"
                    placeholder="+84 901 234 567"
                    autoComplete="tel"
                    error={errors.phone}
                  />
                  <Field
                    label="Location"
                    name="location"
                    placeholder="City, country"
                    autoComplete="address-level2"
                    error={errors.location}
                  />
                  <Field
                    label="Password"
                    name="password"
                    type="password"
                    placeholder="Create a password"
                    autoComplete="new-password"
                    error={errors.password}
                  />
                  <Field
                    label="Confirm Password"
                    name="confirm"
                    type="password"
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    error={errors.confirm}
                  />
                </div>
                <p className="auth-field-hint">
                  Use at least 8 characters, one uppercase letter, and one
                  number.
                </p>
                <div>
                  <UiLabel className="auth-checkbox auth-terms">
                    <UiInput name="terms" type="checkbox" />
                    <span>
                      I agree to the{" "}
                      <UiButton
                        variant="plain"
                        type="button"
                        className="auth-text-button"
                        onClick={() => setLegal("Terms & Conditions")}
                      >
                        Terms & Conditions
                      </UiButton>{" "}
                      and{" "}
                      <UiButton
                        variant="plain"
                        type="button"
                        className="auth-text-button"
                        onClick={() => setLegal("Privacy Policy")}
                      >
                        Privacy Policy
                      </UiButton>
                      .
                    </span>
                  </UiLabel>
                  {errors.terms && <p className="auth-error">{errors.terms}</p>}
                </div>
                <Action type="submit" disabled={busy}>
                  {busy ? "Creating your account…" : "Create Account"}
                  <Symbol name="arrow" />
                </Action>
                <p className="auth-bottom-question">
                  Already have an account?{" "}
                  <UiButton
                    variant="plain"
                    type="button"
                    className="auth-text-button"
                    onClick={() => go("login")}
                  >
                    Sign In
                  </UiButton>
                </p>
              </form>
            )}

            {screen === "verify" && (
              <form noValidate onSubmit={submit} className="auth-form">
                <div className="auth-email-pill">
                  <Symbol name="mail" />
                  {email}
                </div>
                <fieldset className="auth-otp-fieldset">
                  <legend>Enter your 6-digit code</legend>
                  <div className="auth-otp">
                    {otp.map((digit, index) => (
                      <UiInput
                        key={index}
                        ref={(el) => {
                          otpRefs.current[index] = el;
                        }}
                        aria-label={`Digit ${index + 1}`}
                        aria-invalid={!!errors.otp}
                        inputMode="numeric"
                        autoComplete={index === 0 ? "one-time-code" : "off"}
                        maxLength={1}
                        value={digit}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(-1);
                          setOtp((old) =>
                            old.map((x, i) => (i === index ? v : x)),
                          );
                          if (v) otpRefs.current[index + 1]?.focus();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace" && !digit)
                            otpRefs.current[index - 1]?.focus();
                          if (e.key === "ArrowLeft")
                            otpRefs.current[index - 1]?.focus();
                          if (e.key === "ArrowRight")
                            otpRefs.current[index + 1]?.focus();
                        }}
                        onPaste={(e) => {
                          e.preventDefault();
                          const digits = e.clipboardData
                            .getData("text")
                            .replace(/\D/g, "")
                            .slice(0, 6);
                          setOtp(
                            Array.from(
                              {
                                length: 6,
                              },
                              (_, i) => digits[i] || "",
                            ),
                          );
                          otpRefs.current[Math.min(digits.length, 5)]?.focus();
                        }}
                      />
                    ))}
                  </div>
                </fieldset>
                {errors.otp && (
                  <p className="auth-error" role="alert">
                    {errors.otp}
                  </p>
                )}
                <Action
                  type="submit"
                  disabled={busy || otp.join("").length !== 6}
                >
                  {busy ? "Verifying…" : "Verify Account"}
                  <Symbol name="arrow" />
                </Action>
                <p className="auth-resend">
                  Didn't receive a code?{" "}
                  <UiButton
                    variant="plain"
                    type="button"
                    className="auth-text-button"
                    disabled={seconds > 0}
                    onClick={async () => {
                      setBusy(true);
                      setSeconds(45);
                      setExpiry(Date.now() + 5 * 60_000);
                      setErrors({});
                      setOtp(Array(6).fill(""));
                      try {
                        const verification = await authApi.verifyEmail(email);
                        setNotice(
                          verification.devCode
                            ? `Development code: ${verification.devCode}`
                            : "A new verification code was sent to your email.",
                        );
                      } catch {
                        setErrors({
                          otp: "Unable to send a new code. Please try again.",
                        });
                        setSeconds(0);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Resend Code{seconds > 0 ? ` (${seconds}s)` : ""}
                  </UiButton>
                </p>
              </form>
            )}

            {screen === "forgot" && (
              <form noValidate onSubmit={submit} className="auth-form">
                <Field
                  label="Email Address"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  error={errors.email}
                />
                <Action type="submit" disabled={busy}>
                  {busy ? "Sending reset link…" : "Send Reset Link"}
                  <Symbol name="arrow" />
                </Action>
                <p className="auth-field-hint">
                  For your security, we'll never share whether an email is
                  registered.
                </p>
              </form>
            )}
            {screen === "email" && (
              <div className="auth-form">
                <div className="auth-email-pill">
                  <Symbol name="mail" />
                  {email}
                </div>
                <p className="auth-help-copy">
                  Check your inbox and spam folder for the 6-digit password
                  reset code.
                </p>
                <Action onClick={() => go("reset")}>
                  Enter Reset Code
                  <Symbol name="arrow" />
                </Action>
                <Action
                  secondary
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const reset = await authApi.forgotPassword(email);
                      setNotice(
                        reset.devCode
                          ? `Development code: ${reset.devCode}`
                          : "A new password reset code was sent to your email.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "Sending…" : "Resend Email"}
                </Action>
              </div>
            )}
            {screen === "reset" && (
              <form noValidate onSubmit={submit} className="auth-form">
                <Field
                  label="Reset Code"
                  name="code"
                  placeholder="Enter the 6-digit code"
                  autoComplete="one-time-code"
                  error={errors.code}
                />
                <Field
                  label="New Password"
                  name="password"
                  type="password"
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  error={errors.password}
                  onValue={setPassword}
                />
                <div className="auth-strength">
                  <div>
                    {[1, 2, 3, 4].map((n) => (
                      <span key={n} className={strength >= n ? "filled" : ""} />
                    ))}
                  </div>
                  <span>
                    {password
                      ? ["Very weak", "Weak", "Fair", "Good", "Strong"][
                          strength
                        ]
                      : "Password strength"}
                  </span>
                  <p>
                    8+ characters, an uppercase letter, and a number. Add a
                    symbol for extra strength.
                  </p>
                </div>
                <Field
                  label="Confirm Password"
                  name="confirm"
                  type="password"
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                  error={errors.confirm}
                />
                <Action type="submit" disabled={busy}>
                  {busy ? "Updating password…" : "Reset Password"}
                  <Symbol name="arrow" />
                </Action>
              </form>
            )}
            {(screen === "created" || screen === "updated") && (
              <div className="auth-form">
                <div className="auth-success-card">
                  <Symbol name="shield" />
                  <strong>
                    {screen === "created"
                      ? `${role} account ready`
                      : "A fresh start. A secure account."}
                  </strong>
                  <p>
                    {screen === "created"
                      ? `${email} is now verified.`
                      : "Your password reset is complete."}
                  </p>
                </div>
                <Action onClick={() => go("login")}>
                  Back to Login
                  <Symbol name="arrow" />
                </Action>
              </div>
            )}
            {screen === "dashboard" && (
              <div className="auth-form">
                <div className="auth-notice">
                  <Symbol name="check" />
                  You're signed in as {currentUser()?.name ?? role} ({role}).
                </div>
                <Action
                  onClick={() => {
                    window.location.hash = homeFor(role);
                  }}
                >
                  {role === "Admin" ? "Open Admin Console" : "Open Home"}
                  <Symbol name="arrow" />
                </Action>
                <Action
                  secondary
                  onClick={() => signOut("Signed out successfully.")}
                >
                  Sign out
                </Action>
              </div>
            )}

            <div className="auth-security-note">
              <Symbol name="shield" />
              <span>Your privacy matters. Your trade comes first.</span>
            </div>
          </main>
          <footer className="auth-footer">
            <span>© 2026 FISHMARKET</span>
            <div>
              <UiButton
                variant="plain"
                onClick={() => setLegal("Privacy Policy")}
              >
                Privacy
              </UiButton>
              <UiButton
                variant="plain"
                onClick={() => setLegal("Terms & Conditions")}
              >
                Terms
              </UiButton>
              <UiButton
                variant="plain"
                onClick={() => setLegal("Need a hand?")}
              >
                Get help <span>↗</span>
              </UiButton>
            </div>
          </footer>
        </section>
        {legal && (
          <div className="auth-modal-backdrop" onClick={() => setLegal(null)}>
            <div
              ref={modal}
              role="dialog"
              aria-modal="true"
              aria-label={legal}
              className="auth-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>{legal}</h2>
              <p>
                {legal === "Need a hand?"
                  ? "Contact the FISHMARKET support team if you need help signing in, verifying your email, or resetting your password."
                  : "Your account information is used to provide marketplace, order, and support services. Never share your password or verification code with anyone."}
              </p>
              <Action onClick={() => setLegal(null)}>Got it</Action>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
