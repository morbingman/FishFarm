import { signInWithPopup } from "firebase/auth";
import { firebaseAuth, googleProvider } from "@/services/firebase";

export function GoogleSignInButton({
  disabled,
  onCredential,
  onError,
}: {
  disabled?: boolean;
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
}) {
  return (
    <button
      type="button"
      className="auth-google-fallback"
      disabled={disabled}
      onClick={async () => {
        try {
          const result = await signInWithPopup(firebaseAuth, googleProvider);
          onCredential(await result.user.getIdToken());
        } catch (error) {
          const code =
            typeof error === "object" && error && "code" in error
              ? String(error.code)
              : "";
          if (code !== "auth/popup-closed-by-user")
            onError("Unable to sign in with Google. Please try again.");
        }
      }}
    >
      <span className="auth-google-mark">G</span>
      Continue with Google
    </button>
  );
}
