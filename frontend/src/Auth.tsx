import { DEMO_ACCOUNTS } from "./session"
import { addUser, authenticate, currentUser, findUser, homeFor, log, signOut, startSession, takeFlash, takeReturnTo, updateUser, type Role } from "./store"
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import { useDomTranslation, type Lang } from "./i18n"
import { SiteHeader } from "./SiteHeader"
import { authVi } from "./i18n-vi"
import "./auth.css"

type Screen = "login" | "register" | "verify" | "created" | "forgot" | "email" | "reset" | "updated" | "dashboard"
type SymbolName = "fish" | "arrow" | "shield" | "mail" | "lock" | "eye" | "store" | "user" | "check"

function Symbol({
  name,
  className = "",
}: {
  name: SymbolName
  className?: string
}) {
  const paths: Record<SymbolName, ReactNode> = {
    fish: (
      <>
        <path d="M4 12s4-6 10-6c4 0 7 6 7 6s-3 6-7 6c-6 0-10-6-10-6Zm0 0L1 7v10l3-5Z" />
        <circle cx="16" cy="10" r="1" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    store: (
      <>
        <path d="M4 10v10h16V10M3 4h18l-2 6H5L3 4Zm6 16v-6h6v6" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
  }
  return (
    <svg
      className={`auth-icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

function Action({
  children,
  onClick,
  secondary = false,
  disabled = false,
  type = "button",
}: {
  children: ReactNode
  onClick?: () => void
  secondary?: boolean
  disabled?: boolean
  type?: "button" | "submit"
}) {
  return (
    <button
      type={type}
      className={`auth-action ${secondary ? "secondary" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  error,
  autoComplete,
  onValue,
  defaultValue,
}: {
  defaultValue?: string
  label: string
  name: string
  placeholder?: string
  type?: string
  error?: string
  autoComplete?: string
  onValue?: (value: string) => void
}) {
  const [visible, setVisible] = useState(false)
  const password = type === "password"
  return (
    <div className="auth-field">
      <label htmlFor={name}>{label}</label>
      <div className={`auth-input-wrap ${error ? "invalid" : ""}`}>
        {(type === "email" || password) && (
          <Symbol name={password ? "lock" : "mail"} />
        )}
        <input
          id={name}
          name={name}
          type={password && visible ? "text" : type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          onChange={(e) => onValue?.(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
        />
        {password && (
          <button
            type="button"
            className="auth-eye"
            onClick={() => setVisible(!visible)}
            aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
            aria-pressed={visible}
          >
            <Symbol name="eye" />
          </button>
        )}
      </div>
      {error && (
        <span id={`${name}-error`} className="auth-error">
          {error}
        </span>
      )}
    </div>
  )
}

const screenMeta: Record<Screen, [string, string]> = {
  login: ["Welcome Back", "Sign in to continue to your FISHMARKET account."],
  register: [
    "Create Your Account",
    "Your next great trade starts here. Let's get you set up.",
  ],
  verify: [
    "Verify Your Account",
    "We've sent a verification code to your email.",
  ],
  created: [
    "You're All Set",
    "Your account is verified. A world of better trading awaits.",
  ],
  forgot: [
    "Forgot Your Password?",
    "It happens. Enter your email and we'll send you a reset link.",
  ],
  email: [
    "Check Your Email",
    "If an account exists for this address, a password reset link is on its way.",
  ],
  reset: [
    "Set a New Password",
    "Choose a strong password to keep your account secure.",
  ],
  updated: [
    "Password Updated Successfully",
    "You're ready to sign in with your new password.",
  ],
  dashboard: [
    "Welcome to Your Dashboard",
    "Your next opportunity is just a trade away.",
  ],
}
const steps: [Screen, string][] = [
  ["login", "Sign in"],
  ["register", "Create account"],
  ["verify", "Verification"],
  ["forgot", "Recovery"],
]

export default function Auth({ language, setLanguage }: { language: Lang; setLanguage: (l: Lang) => void }) {
  useDomTranslation(language, authVi)
  const [screen, setScreen] = useState<Screen>(() => (currentUser() ? "dashboard" : "login"))
  const [role, setRole] = useState<Role>(() => currentUser()?.role ?? "Buyer")
  const [info] = useState(() => takeFlash() ?? "")
  const regRef = useRef<Record<string, string> | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [email, setEmail] = useState("alex@example.com")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  const [password, setPassword] = useState("")
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""))
  const [seconds, setSeconds] = useState(45)
  const [expiry, setExpiry] = useState(Date.now() + 5 * 60_000)
  const [legal, setLegal] = useState<string | null>(null)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const modal = useRef<HTMLDivElement>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  useEffect(() => {
    if (screen !== "verify") return
    const interval = setInterval(
      () => setSeconds((s) => Math.max(0, s - 1)),
      1000,
    )
    return () => clearInterval(interval)
  }, [screen])
  useEffect(() => {
    heading.current?.focus()
  }, [screen])
  useEffect(() => {
    if (!legal) return
    const previous = document.activeElement as HTMLElement | null
    modal.current?.querySelector<HTMLButtonElement>("button")?.focus()
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLegal(null)
      if (event.key === "Tab") {
        event.preventDefault()
        modal.current?.querySelector<HTMLButtonElement>("button")?.focus()
      }
    }
    document.addEventListener("keydown", handle)
    return () => {
      document.removeEventListener("keydown", handle)
      previous?.focus()
    }
  }, [legal])

  function go(next: Screen) {
    if (timer.current) clearTimeout(timer.current)
    if (next === "register" && role === "Admin") setRole("Buyer")
    setScreen(next)
    setErrors({})
    setNotice("")
    setBusy(false)
    setPassword("")
    if (next === "verify") {
      setOtp(Array(6).fill(""))
      setSeconds(45)
      setExpiry(Date.now() + 5 * 60_000)
    }
  }
  function redirectAfterLogin(r: Role) {
    const back = takeReturnTo()
    const top = (back ?? "").split(/[/?]/)[0]
    const ok = (top === "seller" && r === "Seller") || (top === "admin" && r === "Admin") || top === "marketplace" || top === "account"
    window.location.hash = ok && back ? back : homeFor(r)
  }
  function pending(callback: () => void) {
    setBusy(true)
    timer.current = setTimeout(() => {
      setBusy(false)
      callback()
    }, 900)
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = Object.fromEntries(
      new FormData(e.currentTarget),
    ) as Record<string, string>
    const nextErrors: Record<string, string> = {}
    if (
      screen !== "verify" &&
      screen !== "reset" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || "")
    )
      nextErrors.email = "Enter a valid email address."
    if (["login", "register", "reset"].includes(screen) && !data.password)
      nextErrors.password = "Enter your password."
    if (screen === "register" || screen === "reset") {
      if (
        (data.password || "").length < 8 ||
        !/[A-Z]/.test(data.password || "") ||
        !/\d/.test(data.password || "")
      )
        nextErrors.password =
          "Use 8+ characters, an uppercase letter, and a number."
      if (data.confirm !== data.password)
        nextErrors.confirm = "Your passwords don't match."
    }
    if (screen === "register") {
      for (const field of [
        "name",
        "phone",
        "location",
        ...(role === "Seller"
          ? ["store", "business", "storeLocation", "description"]
          : []),
      ])
        if (!data[field]?.trim()) nextErrors[field] = "This field is required."
      if (data.phone && !/^\+?[\d\s()-]{7,20}$/.test(data.phone))
        nextErrors.phone = "Enter a valid phone number."
      if (!data.terms)
        nextErrors.terms = "Please agree to the terms to continue."
    }
    if (screen === "verify") {
      if (Date.now() > expiry)
        nextErrors.otp = "This code has expired. Request a new one."
      else if (otp.join("") !== "123456")
        nextErrors.otp = "That code isn't correct. Please try again."
    }
    let matched: Role | null = null
    if (screen === "login" && !Object.keys(nextErrors).length) {
      const res = authenticate(data.email, data.password)
      if (!res.ok) {
        if (res.reason === "suspended") nextErrors.email = "This account is suspended. Contact support to appeal."
        else nextErrors.password = "Incorrect email or password. Use a demo account below."
      } else {
        matched = res.user.role
        startSession(res.user.email)
        log(res.user.name, res.user.role, "Signed in")
      }
    }
    if (screen === "register" && !Object.keys(nextErrors).length && findUser(data.email))
      nextErrors.email = "An account with this email already exists. Try signing in instead."
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    if (data.email) setEmail(data.email)
    pending(() => {
      if (screen === "login") {
        if (matched) setRole(matched)
        setNotice("Signed in successfully. Taking you to your dashboard…")
        timer.current = setTimeout(() => redirectAfterLogin(matched ?? role), 700)
      }
      if (screen === "register") {
        regRef.current = data
        go("verify")
      }
      if (screen === "verify") {
        const r = regRef.current
        if (r) addUser({ email: r.email.trim().toLowerCase(), password: r.password, name: r.name.trim(), role, phone: r.phone, location: r.location, store: role === "Seller" ? r.store : undefined })
        go("created")
      }
      if (screen === "forgot") go("email")
      if (screen === "reset") {
        if (findUser(email)) updateUser(findUser(email)!.email, { password: data.password })
        go("updated")
      }
    })
  }
  const strength =
    Number(password.length >= 8) +
    Number(/[A-Z]/.test(password)) +
    Number(/\d/.test(password)) +
    Number(/[^a-zA-Z0-9]/.test(password))
  const success = ["created", "updated", "email"].includes(screen)

  return (
    <>
    <SiteHeader language={language} setLanguage={setLanguage} />
    <div className="auth-app">
      <aside className="auth-visual">
        <img
          className="auth-photo"
          src="https://images.unsplash.com/photo-1668349009169-93e19d2eba7a?auto=format&fit=crop&w=1800&q=90"
          alt="Premium koi moving through deep blue water"
        />
        <div className="auth-photo-shade" />
        <a className="auth-brand" href="#home">
          <span className="auth-brand-mark">
            <Symbol name="fish" />
          </span>
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
            <button
              className="auth-back"
              onClick={() => go(screen === "verify" ? "register" : "login")}
            >
              ← Back to {screen === "verify" ? "registration" : "sign in"}
            </button>
          )}
          <div className={`auth-heading-symbol ${success ? "is-success" : ""}`}>
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
                  key={`e-${role}`}
                  label="Email Address"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  defaultValue={DEMO_ACCOUNTS[role].email}
                  error={errors.email}
                />
                <Field
                  key={`p-${role}`}
                  label="Password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  defaultValue={DEMO_ACCOUNTS[role].password}
                  error={errors.password}
                />
                <div className="auth-options">
                  <label className="auth-checkbox">
                    <input type="checkbox" name="remember" />
                    Remember me
                  </label>
                  <button
                    type="button"
                    className="auth-text-button"
                    onClick={() => go("forgot")}
                  >
                    Forgot password?
                  </button>
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
              <div className="auth-divider">
                <span />
                or continue with
                <span />
              </div>
              <Action
                secondary
                disabled={busy}
                onClick={() =>
                  pending(() => {
                    const acct = DEMO_ACCOUNTS[role]
                    startSession(acct.email)
                    log(acct.name, role, "Signed in with Google")
                    setNotice(
                      "Demo Google sign-in complete. Taking you to your dashboard…",
                    )
                    timer.current = setTimeout(() => redirectAfterLogin(role), 700)
                  })
                }
              >
                <span className="auth-google">G</span> Continue with Google
              </Action>
              <p className="auth-bottom-question">
                Don't have an account?{" "}
                <button
                  className="auth-text-button"
                  onClick={() => go("register")}
                >
                  Create Account <span>↗</span>
                </button>
              </p>
              <div className="auth-demo">
                <div>
                  <span className="auth-demo-dot" />
                  <strong>Explore the prototype</strong>
                  <span>No real credentials needed</span>
                </div>
                <div className="auth-role-tabs" aria-label="Demo account role">
                  {(["Buyer", "Seller", "Admin"] as Role[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={role === r}
                      onClick={() => {
                        setRole(r)
                        setErrors({})
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <dl className="auth-demo-cred" data-no-translate>
                  <div><dt>Email</dt><dd>{DEMO_ACCOUNTS[role].email}</dd></div>
                  <div><dt>Password</dt><dd>{DEMO_ACCOUNTS[role].password}</dd></div>
                </dl>
                <p>
                  Pick a role to fill in its demo account, then press Sign In.
                </p>
              </div>
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
                Use at least 8 characters, one uppercase letter, and one number.
              </p>
              <fieldset className="auth-role-fieldset">
                <legend>Choose your account type</legend>
                <div className="auth-account-cards">
                  {(["Buyer", "Seller"] as Role[]).map((r) => (
                    <label
                      key={r}
                      className={`auth-account-card ${
                        role === r ? "selected" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={r}
                        checked={role === r}
                        onChange={() => setRole(r)}
                      />
                      <Symbol name={r === "Buyer" ? "user" : "store"} />
                      <strong>{r}</strong>
                      <span>
                        {r === "Buyer"
                          ? "Buy fish from trusted sellers."
                          : "Sell your fish and grow your business."}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {role === "Seller" && (
                <div className="auth-seller-fields">
                  <div className="auth-subheading">
                    <Symbol name="store" />
                    Tell us about your business
                  </div>
                  <div className="auth-register-grid">
                    <Field
                      label="Store Name"
                      name="store"
                      placeholder="Your business name"
                      error={errors.store}
                    />
                    <div className="auth-field">
                      <label htmlFor="business">Business Type</label>
                      <select
                        id="business"
                        name="business"
                        aria-invalid={!!errors.business}
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Select business type
                        </option>
                        {[
                          "Breeder",
                          "Farm",
                          "Wholesaler",
                          "Retailer",
                          "Individual seller",
                        ].map((b) => (
                          <option key={b}>{b}</option>
                        ))}
                      </select>
                      {errors.business && (
                        <span className="auth-error">{errors.business}</span>
                      )}
                    </div>
                  </div>
                  <Field
                    label="Store Location"
                    name="storeLocation"
                    placeholder="Business address, city, country"
                    error={errors.storeLocation}
                  />
                  <div className="auth-field">
                    <label htmlFor="description">Store Description</label>
                    <textarea
                      id="description"
                      name="description"
                      placeholder="Tell buyers about your stock and expertise"
                      aria-invalid={!!errors.description}
                    />
                    {errors.description && (
                      <span className="auth-error">{errors.description}</span>
                    )}
                  </div>
                </div>
              )}
              <div>
                <label className="auth-checkbox auth-terms">
                  <input name="terms" type="checkbox" />
                  <span>
                    I agree to the{" "}
                    <button
                      type="button"
                      className="auth-text-button"
                      onClick={() => setLegal("Terms & Conditions")}
                    >
                      Terms & Conditions
                    </button>{" "}
                    and{" "}
                    <button
                      type="button"
                      className="auth-text-button"
                      onClick={() => setLegal("Privacy Policy")}
                    >
                      Privacy Policy
                    </button>
                    .
                  </span>
                </label>
                {errors.terms && <p className="auth-error">{errors.terms}</p>}
              </div>
              <Action type="submit" disabled={busy}>
                {busy ? "Creating your account…" : "Create Account"}
                <Symbol name="arrow" />
              </Action>
              <p className="auth-bottom-question">
                Already have an account?{" "}
                <button
                  type="button"
                  className="auth-text-button"
                  onClick={() => go("login")}
                >
                  Sign In
                </button>
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
                    <input
                      key={index}
                      ref={(el) => {
                        otpRefs.current[index] = el
                      }}
                      aria-label={`Digit ${index + 1}`}
                      aria-invalid={!!errors.otp}
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      maxLength={1}
                      value={digit}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(-1)
                        setOtp((old) =>
                          old.map((x, i) => (i === index ? v : x)),
                        )
                        if (v) otpRefs.current[index + 1]?.focus()
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !digit)
                          otpRefs.current[index - 1]?.focus()
                        if (e.key === "ArrowLeft")
                          otpRefs.current[index - 1]?.focus()
                        if (e.key === "ArrowRight")
                          otpRefs.current[index + 1]?.focus()
                      }}
                      onPaste={(e) => {
                        e.preventDefault()
                        const digits = e.clipboardData
                          .getData("text")
                          .replace(/\D/g, "")
                          .slice(0, 6)
                        setOtp(
                          Array.from({ length: 6 }, (_, i) => digits[i] || ""),
                        )
                        otpRefs.current[Math.min(digits.length, 5)]?.focus()
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
                <button
                  type="button"
                  className="auth-text-button"
                  disabled={seconds > 0}
                  onClick={() => {
                    setSeconds(45)
                    setExpiry(Date.now() + 5 * 60_000)
                    setErrors({})
                    setOtp(Array(6).fill(""))
                    setNotice("A fresh demo code is ready: 123456.")
                  }}
                >
                  Resend Code{seconds > 0 ? ` (${seconds}s)` : ""}
                </button>
              </p>
              <div className="auth-prototype-note">
                Prototype code: <strong>123456</strong> · Valid for 5 minutes.
                <button
                  type="button"
                  className="auth-text-button"
                  onClick={() => {
                    setExpiry(0)
                    setErrors({
                      otp: "This code has expired. Request a new one.",
                    })
                    setSeconds(0)
                  }}
                >
                  Preview expired code
                </button>
              </div>
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
                Check your inbox and spam folder. Follow the link in your email
                to securely reset your password.
              </p>
              <div className="auth-prototype-note">
                No email is sent in this prototype. Preview the next step below.
              </div>
              <Action onClick={() => go("reset")}>
                Open Demo Reset Link
                <Symbol name="arrow" />
              </Action>
              <Action
                secondary
                disabled={busy}
                onClick={() =>
                  pending(() =>
                    setNotice(
                      "Demo reset link sent again. Please check your inbox.",
                    ),
                  )
                }
              >
                {busy ? "Sending…" : "Resend Email"}
              </Action>
            </div>
          )}
          {screen === "reset" && (
            <form noValidate onSubmit={submit} className="auth-form">
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
                    ? ["Very weak", "Weak", "Fair", "Good", "Strong"][strength]
                    : "Password strength"}
                </span>
                <p>
                  8+ characters, an uppercase letter, and a number. Add a symbol
                  for extra strength.
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
                    ? `${email} is now verified in this prototype.`
                    : "Your password reset is complete in this prototype."}
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
              <Action onClick={() => { window.location.hash = homeFor(role) }}>
                {role === "Seller" ? "Open Seller Center" : role === "Admin" ? "Open Admin Console" : "Explore Marketplace"}
                <Symbol name="arrow" />
              </Action>
              <Action secondary onClick={() => signOut("Signed out. Sign in with another demo account to continue.")}>
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
            <button onClick={() => setLegal("Privacy Policy")}>Privacy</button>
            <button onClick={() => setLegal("Terms & Conditions")}>
              Terms
            </button>
            <button onClick={() => setLegal("Need a hand?")}>
              Get help <span>↗</span>
            </button>
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
                ? "This is an interactive authentication prototype. Use any valid email and password to sign in, and 123456 for verification. No personal data is sent or stored."
                : "This prototype does not collect personal information or create real accounts. Final legal policies will be available before the platform launches. Do not enter real passwords or sensitive information."}
            </p>
            <Action onClick={() => setLegal(null)}>Got it</Action>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
