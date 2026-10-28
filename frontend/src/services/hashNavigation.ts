import { useLayoutEffect } from "react";

type HashBrowser = Pick<Window, "location" | "history" | "addEventListener" | "removeEventListener">;
const historyIndex = "fishfarm-hash-index";
const guards = new Set<() => boolean>();
let navigation: ReturnType<typeof createHashNavigation> | null = null;

export function registerHashTransitionGuard(allow: () => boolean) {
  guards.add(allow);
  return () => { guards.delete(allow); };
}

export function useHashTransitionGuard(allow: () => boolean) {
  useLayoutEffect(() => registerHashTransitionGuard(allow), [allow]);
}

// Keep the rendered route unchanged until a hash transition is accepted. Indexed
// history entries let cancelled Back/Forward return to the original entry rather
// than overwriting the destination or adding another history entry.
export function createHashNavigation(browser: HashBrowser, onChange: (hash: string) => void, allow = () => [...guards].every(guard => guard())) {
  const index = () => {
    const value: unknown = browser.history.state?.[historyIndex];
    return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
  };
  const stamp = (value: number, hash = browser.location.hash) => browser.history.replaceState({ ...browser.history.state, [historyIndex]: value }, "", hash || browser.location.href.split("#")[0]);
  let acceptedHash = browser.location.hash;
  let acceptedIndex = index() ?? 0;
  let restoring = false;
  stamp(acceptedIndex);
  const sync = () => {
    if (restoring) {
      if (browser.location.hash === acceptedHash) restoring = false;
      return;
    }
    const nextHash = browser.location.hash;
    if (nextHash === acceptedHash) return;
    const nextIndex = index();
    const targetIndex = nextIndex !== null && nextIndex !== acceptedIndex ? nextIndex : acceptedIndex + 1;
    stamp(targetIndex);
    if (!allow()) {
      restoring = true;
      browser.history.go(acceptedIndex - targetIndex);
      return;
    }
    acceptedHash = nextHash;
    acceptedIndex = targetIndex;
    onChange(nextHash);
  };
  browser.addEventListener("hashchange", sync);
  return {
    replace(hash: string, expectedHash = browser.location.hash) {
      if (restoring || browser.location.hash !== expectedHash) return false;
      stamp(acceptedIndex, hash);
      acceptedHash = browser.location.hash;
      onChange(acceptedHash);
      return true;
    },
    dispose() { browser.removeEventListener("hashchange", sync); },
  };
}

export function listenHashNavigation(onChange: (hash: string) => void) {
  const current = createHashNavigation(window, onChange);
  navigation = current;
  return () => {
    current.dispose();
    if (navigation === current) navigation = null;
  };
}

// Server-confirmed canonicalization replaces the alias without prompting or
// inserting another history entry. A stale response cannot redirect a newer URL.
export const replaceHashRoute = (hash: string, expectedHash?: string) => navigation?.replace(hash, expectedHash) ?? false;
