import { useEffect, useRef } from "react";

type GoogleCredentialResponse = { credential?: string };

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(options: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }): void;
          renderButton(
            element: HTMLElement,
            options: Record<string, string | number>,
          ): void;
        };
      };
    };
  }
}

export function GoogleSignInButton({
  disabled,
  onCredential,
  onError,
}: {
  disabled?: boolean;
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const credentialHandler = useRef(onCredential);
  credentialHandler.current = onCredential;
  const clientId = (
    import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
  )?.trim();

  useEffect(() => {
    if (!clientId || !container.current) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !container.current || !window.google) return;
      container.current.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: ({ credential }) => {
          if (credential) credentialHandler.current(credential);
          else onError("Google did not return a valid sign-in token.");
        },
      });
      window.google.accounts.id.renderButton(container.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: 360,
      });
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    if (window.google) render();
    else if (existing) existing.addEventListener("load", render);
    else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", render);
      script.addEventListener("error", () =>
        onError("Unable to load Google Sign-In."),
      );
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      existing?.removeEventListener("load", render);
    };
  }, [clientId, onError]);

  if (!clientId) {
    return (
      <button
        type="button"
        className="auth-google-fallback"
        disabled={disabled}
        onClick={() =>
          onError("Google Sign-In has not been configured for this website.")
        }
      >
        <span className="auth-google-mark">G</span>
        Continue with Google
      </button>
    );
  }

  return (
    <div
      className={`auth-google-button ${disabled ? "is-disabled" : ""}`}
      aria-disabled={disabled}
    >
      <div ref={container} />
    </div>
  );
}
