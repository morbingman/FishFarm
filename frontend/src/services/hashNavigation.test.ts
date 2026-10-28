import { describe, expect, it, vi } from "vitest";
import { createHashNavigation, registerHashTransitionGuard } from "./hashNavigation";

function browserAt(hash = "#company/edit/FM-1") {
  const events = new EventTarget();
  const entries: { hash: string; state: Record<string, unknown> | null }[] = [{ hash, state: null }];
  let position = 0;
  const location = { get hash() { return entries[position].hash; }, get href() { return `https://example.test/${entries[position].hash}`; } };
  const history = {
    get state() { return entries[position].state; },
    replaceState(state: Record<string, unknown>, _title: string, url: string) { entries[position] = { state, hash: new URL(url, location.href).hash }; },
    go: vi.fn((offset: number) => { position += offset; events.dispatchEvent(new Event("hashchange")); }),
  };
  const browser = { location, history, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events) };
  return {
    browser: browser as unknown as Window,
    entries,
    history,
    push(nextHash: string) { entries.splice(position + 1); entries.push({ hash: nextHash, state: null }); position++; events.dispatchEvent(new Event("hashchange")); },
    back() { history.go(-1); },
    forward() { history.go(1); },
  };
}

describe("guarded hash transitions", () => {
  it("keeps the mounted editor and URL when header/hash navigation is cancelled", () => {
    const tab = browserAt(); const change = vi.fn(); const allow = vi.fn(() => false);
    const nav = createHashNavigation(tab.browser, change, allow);
    tab.push("#company/listings");
    expect(allow).toHaveBeenCalledTimes(1); expect(change).not.toHaveBeenCalled();
    expect(tab.browser.location.hash).toBe("#company/edit/FM-1");
    expect(tab.history.go).toHaveBeenLastCalledWith(-1); nav.dispose();
  });
  it("cancels Back and Forward by restoring the entry without overwriting either route", () => {
    const tab = browserAt("#company/listings"); let allowed = true; const change = vi.fn();
    const nav = createHashNavigation(tab.browser, change, () => allowed);
    tab.push("#company/edit/FM-1"); allowed = false; change.mockClear();
    tab.back();
    expect(tab.browser.location.hash).toBe("#company/edit/FM-1"); expect(change).not.toHaveBeenCalled();
    allowed = true; tab.back(); allowed = false; change.mockClear(); tab.forward();
    expect(tab.browser.location.hash).toBe("#company/listings"); expect(change).not.toHaveBeenCalled();
    expect(tab.entries.map(entry => entry.hash)).toEqual(["#company/listings", "#company/edit/FM-1"]); nav.dispose();
  });
  it("accepts confirmed navigation and does not prompt for the same hash", () => {
    const tab = browserAt(); const change = vi.fn(); const allow = vi.fn(() => true);
    const nav = createHashNavigation(tab.browser, change, allow);
    tab.push("#company/orders"); tab.push("#company/orders");
    expect(change).toHaveBeenCalledTimes(1); expect(allow).toHaveBeenCalledTimes(1); nav.dispose();
  });
  it("replaces a server-confirmed alias without a guard prompt or extra history entry", () => {
    const tab = browserAt("#company/edit/database-id"); const change = vi.fn(); const allow = vi.fn(() => false);
    const nav = createHashNavigation(tab.browser, change, allow);
    expect(nav.replace("#company/edit/FM-1", "#company/edit/database-id")).toBe(true);
    expect(tab.browser.location.hash).toBe("#company/edit/FM-1"); expect(tab.entries).toHaveLength(1);
    expect(allow).not.toHaveBeenCalled(); expect(change).toHaveBeenCalledWith("#company/edit/FM-1"); nav.dispose();
  });
  it("does not canonicalize a stale detail response over a newer destination", () => {
    const tab = browserAt("#company/listing/database-id"); const nav = createHashNavigation(tab.browser, vi.fn(), () => true);
    tab.push("#company/listings");
    expect(nav.replace("#company/listing/FM-1", "#company/listing/database-id")).toBe(false);
    expect(tab.browser.location.hash).toBe("#company/listings"); nav.dispose();
  });
  it("bypasses a dirty guard when its session is no longer current and unregisters on cleanup", () => {
    const tab = browserAt(); const change = vi.fn(); const confirm = vi.fn(() => false); let sameSession = true;
    const release = registerHashTransitionGuard(() => !sameSession || confirm());
    const nav = createHashNavigation(tab.browser, change);
    sameSession = false; tab.push("#home");
    expect(confirm).not.toHaveBeenCalled(); expect(change).toHaveBeenCalledWith("#home");
    release(); sameSession = true; tab.push("#marketplace");
    expect(confirm).not.toHaveBeenCalled(); nav.dispose();
  });
});
