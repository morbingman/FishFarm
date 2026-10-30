import "./Auth.css";
import { useState, type FormEvent } from "react";
import { LogoMark } from "@/components/layout/LogoMark";
import { Action, Field } from "@/components/auth/AuthParts";
import { authApi, errorMessage } from "@/services/api";
import { useUser } from "@/services/session";
import { isOrderRoute } from "@/services/orders";
import { isCompanyOrderRoute } from "@/services/companyOrders";
import { isDisputeRoute } from "@/services/disputes";
import { isCompanyListingRoute } from "@/services/companyListings";
import { isListingReviewRoute } from "@/services/listingReview";
import { isAdminUsersRoute } from "@/services/adminUsers";
import { isNotificationsRoute } from "@/services/notifications";
import { parseAccountRoute } from "@/services/account";
import { parseBatchRoute } from "@/services/batches";
import { parseBatchReviewRoute } from "@/services/batchReview";
import { parseSponsorshipRoute } from "@/services/sponsorships";
import { parseFacilityRoute } from "@/services/facilities";
import type { Lang } from "@/hooks/useTranslation";

type Screen = "login" | "register" | "forgot" | "reset" | "verify";
export default function Auth({ language }: { language: Lang; setLanguage: (l: Lang) => void }) {
  const [screen, setScreen] = useState<Screen>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const user = useUser();
  const vi = language === "vi";
  const tr = (en: string, vn: string) => vi ? vn : en;
  const go = (next: Screen) => { setScreen(next); setError(""); setNotice(""); };
  const redirect = () => {
    const back = sessionStorage.getItem("fishmarket-return");
    sessionStorage.removeItem("fishmarket-return");
    const route = back?.split("?")[0];
    window.location.hash = back && (back.startsWith("marketplace/detail?") || isOrderRoute(route ?? "") || isCompanyOrderRoute(route ?? "") || isCompanyListingRoute(route ?? "") || parseBatchRoute(back ?? "")?.company || parseBatchReviewRoute(back ?? "") || parseSponsorshipRoute(back ?? "") || parseFacilityRoute(back ?? "") || isListingReviewRoute(route ?? "") || route === "admin/activity" || isAdminUsersRoute(route ?? "") || isNotificationsRoute(back ?? "") || parseAccountRoute(back ?? "") || isDisputeRoute(route ?? "") || ["marketplace/cart", "marketplace/checkout", "marketplace/confirmation"].includes(route ?? "")) ? back : "home";
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    setError(""); setNotice("");
    if (["register", "reset"].includes(screen) && data.password !== data.confirm) {
      setError(tr("Passwords do not match.", "Mật khẩu không khớp.")); return;
    }
    if (["reset", "verify"].includes(screen) && !/^\d{6}$/.test(data.code ?? "")) {
      setError(tr("Enter the 6-digit code.", "Nhập mã gồm 6 chữ số.")); return;
    }
    setBusy(true);
    try {
      if (screen === "login") {
        await authApi.login(data.email.trim().toLowerCase(), data.password);
        redirect();
      } else if (screen === "register") {
        await authApi.register({ email: data.email.trim().toLowerCase(), password: data.password, name: data.name.trim(), phone: data.phone.trim(), location: data.location.trim() });
        setEmail(data.email.trim().toLowerCase());
        go("verify");
        setNotice(tr("Account created. You can verify your email or browse now.", "Đã tạo tài khoản. Bạn có thể xác minh email hoặc xem chợ cá."));
      } else if (screen === "forgot") {
        const result = await authApi.forgotPassword(data.email.trim().toLowerCase());
        setEmail(data.email.trim().toLowerCase()); go("reset");
        setNotice(tr("If this address is registered, a reset code has been issued.", "Nếu email đã đăng ký, mã đặt lại đã được tạo.") + (result.devCode ? ` ${tr("Local development code:", "Mã phát triển cục bộ:")} ${result.devCode}` : ""));
      } else if (screen === "reset") {
        await authApi.resetPassword(email, data.code, data.password);
        await authApi.logout();
        go("login");
        setNotice(tr("Password reset. Sign in with your new password.", "Đã đặt lại mật khẩu. Đăng nhập với mật khẩu mới."));
      } else {
        await authApi.verifyEmail(email, data.code);
        setNotice(tr("Email verified.", "Email đã được xác minh."));
      }
    } catch (err) { setError(errorMessage(err, language)); }
    finally { setBusy(false); }
  }
  const titles: Record<Screen, string> = {
    login: tr("Welcome back", "Chào mừng trở lại"), register: tr("Create your account", "Tạo tài khoản"),
    forgot: tr("Reset your password", "Đặt lại mật khẩu"), reset: tr("Enter your reset code", "Nhập mã đặt lại"), verify: tr("Verify your email", "Xác minh email"),
  };
  return <div className="auth-app">
    <aside className="auth-visual">
      <img className="auth-photo" src="/hero-koi.jpg" alt="Koi fish in water" /><div className="auth-photo-shade" />
      <a className="auth-brand" href="#home"><LogoMark />FISHMARKET</a>
      <div className="auth-visual-content"><h2>{tr("Great fish. One company.", "Cá chất lượng. Một công ty.")}</h2><p>{tr("Browse our company catalog and manage your account securely.", "Khám phá danh mục của công ty và quản lý tài khoản an toàn.")}</p></div>
    </aside>
    <section className="auth-workspace"><main className={`auth-main ${screen === "register" ? "auth-wide" : ""}`}>
      <h1>{titles[screen]}</h1>
      {notice && <p className="auth-notice" role="status">{notice}</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      {user && screen === "login" ? <div className="auth-form"><p>{tr("You are signed in as", "Bạn đã đăng nhập với")} {user.name} ({user.role === "Buyer" ? "User" : "Admin"}).</p><Action onClick={redirect}>{tr("Browse marketplace", "Xem chợ cá")}</Action></div> : <form key={screen} className="auth-form" onSubmit={(event) => { void submit(event); }}>
        <fieldset disabled={busy} className="integration-auth-fields">
          {["login", "register", "forgot"].includes(screen) && <Field label={tr("Email Address", "Địa chỉ email")} name="email" type="email" autoComplete="email" />}
          {screen === "register" && <>
            <Field label={tr("Full Name", "Họ tên")} name="name" autoComplete="name" />
            <Field label={tr("Phone Number", "Số điện thoại")} name="phone" type="tel" autoComplete="tel" />
            <Field label={tr("Location", "Khu vực")} name="location" autoComplete="address-level2" />
          </>}
          {["reset", "verify"].includes(screen) && <><p>{email}</p><Field label={tr("6-digit code", "Mã 6 chữ số")} name="code" autoComplete="one-time-code" /></>}
          {["login", "register", "reset"].includes(screen) && <Field label={tr("Password", "Mật khẩu")} name="password" type="password" autoComplete={screen === "login" ? "current-password" : "new-password"} />}
          {["register", "reset"].includes(screen) && <><Field label={tr("Confirm Password", "Xác nhận mật khẩu")} name="confirm" type="password" autoComplete="new-password" /><p>{tr("Use 8–128 characters with a letter and a number. New accounts are Users only.", "Dùng 8–128 ký tự gồm chữ và số. Tài khoản mới chỉ có vai trò User.")}</p></>}
          <Action type="submit" disabled={busy}>{busy ? tr("Please wait…", "Vui lòng đợi…") : titles[screen]}</Action>
        </fieldset>
      </form>}
      <div className="auth-form">
        {screen === "login" && <><Action secondary disabled={busy} onClick={() => go("register")}>{tr("Create Account", "Tạo tài khoản")}</Action><Action secondary disabled={busy} onClick={() => go("forgot")}>{tr("Forgot password?", "Quên mật khẩu?")}</Action></>}
        {screen === "verify" && <><Action secondary disabled={busy} onClick={() => {
          setBusy(true); setError("");
          void authApi.verifyEmail(email).then((result) => setNotice(tr("Verification code issued.", "Mã xác minh đã được tạo.") + (result.devCode ? ` ${tr("Local development code:", "Mã phát triển cục bộ:")} ${result.devCode}` : ""))).catch((err: unknown) => setError(errorMessage(err, language))).finally(() => setBusy(false));
        }}>{tr("Request verification code", "Yêu cầu mã xác minh")}</Action><Action onClick={redirect}>{tr("Browse now", "Xem chợ cá ngay")}</Action></>}
        {screen !== "login" && <Action secondary disabled={busy} onClick={() => go("login")}>{tr("Back to sign in", "Quay lại đăng nhập")}</Action>}
      </div>
    </main></section>
  </div>;
}
