import { useEffect, useState, type SetStateAction, type Dispatch } from "react";
/** Tab-scoped draft state. Never use this for passwords or card credentials. */
export function useSessionState<T>(
  key: string,
  fallback: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = sessionStorage.getItem(key);
      return saved === null ? fallback : (JSON.parse(saved) as T);
    } catch {
      return fallback;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* Storage may be full or unavailable. */
    }
  }, [key, value]);
  return [value, setValue];
}
