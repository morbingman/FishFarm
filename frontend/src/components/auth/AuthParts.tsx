import type { ReactNode } from "react";
import { Input as UiInput } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { Button as UiButton } from "@/components/ui/button";
import { useState } from "react";
export type SymbolName =
  | "fish"
  | "arrow"
  | "shield"
  | "mail"
  | "lock"
  | "eye"
  | "store"
  | "user"
  | "check";
export function Symbol({
  name,
  className = "",
}: {
  name: SymbolName;
  className?: string;
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
  };
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
  );
}
export function Action({
  children,
  onClick,
  secondary = false,
  disabled = false,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <UiButton
      variant="plain"
      type={type}
      className={`auth-action ${secondary ? "secondary" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </UiButton>
  );
}
export function Field({
  label,
  name,
  placeholder,
  type = "text",
  error,
  autoComplete,
  onValue,
  defaultValue,
}: {
  defaultValue?: string;
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  error?: string;
  autoComplete?: string;
  onValue?: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const password = type === "password";
  return (
    <div className="auth-field">
      <UiLabel htmlFor={name}>{label}</UiLabel>
      <div className={`auth-input-wrap ${error ? "invalid" : ""}`}>
        {(type === "email" || password) && (
          <Symbol name={password ? "lock" : "mail"} />
        )}
        <UiInput
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
          <UiButton
            variant="plain"
            type="button"
            className="auth-eye"
            onClick={() => setVisible(!visible)}
            aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
            aria-pressed={visible}
          >
            <Symbol name="eye" />
          </UiButton>
        )}
      </div>
      {error && (
        <span id={`${name}-error`} className="auth-error">
          {error}
        </span>
      )}
    </div>
  );
}
