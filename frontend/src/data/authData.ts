export type Screen =
  | "login"
  | "register"
  | "created"
  | "forgot"
  | "email"
  | "reset"
  | "updated"
  | "dashboard";
export const screenMeta: Record<Screen, [string, string]> = {
  login: ["Welcome Back", "Sign in to continue to your FISHMARKET account."],
  register: [
    "Create Your Account",
    "Your next great trade starts here. Let's get you set up.",
  ],
  created: [
    "You're All Set",
    "Your account is ready. A world of better trading awaits.",
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
};
export const steps: [Screen, string][] = [
  ["login", "Sign in"],
  ["register", "Create account"],
  ["forgot", "Recovery"],
];
