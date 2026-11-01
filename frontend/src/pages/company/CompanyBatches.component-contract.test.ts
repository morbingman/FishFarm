import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as batchRules from "../../services/batches";
import type { BatchStatus, CompanyBatch } from "../../services/batchContracts";

// Node component-contract coverage: execute the actual transpiled component and
// its handlers with deterministic hook slots. No mounted DOM/browser or server.
const require = createRequire(import.meta.url);
const at = "2026-10-28T00:00:00.000Z";
const submittedAt = "2026-10-30T12:00:00.000Z";
const company = (status: BatchStatus = "draft"): CompanyBatch => ({
  id: "BATCH-1024", title: "Pond fish", species: "Tilapia", breed: null, description: "A complete description of this batch.", location: "Farm pond", region: "South", status,
  stockingDate: null, expectedHarvestDate: null, stockCount: 100, shareUnitType: "count", shareUnit: "10 fish", shareQuantity: 10, expectedHarvestWeightG: null, totalShares: 10, sharesAvailable: 10, packagePricePerShare: 100, contingencyPct: 10, riskDisclosure: "Growth and harvest are subject to natural risks.", termsVersion: "v1",
  images: [{ id: "image1", batchId: "internal1", url: "/uploads/pond.png", position: 0, isMain: true, createdAt: at }],
  costs: [{ id: "cost1", batchId: "internal1", category: "feed", label: "Feed", amount: 100, allocation: "per_share", note: null }],
  updates: [{ id: "update1", stage: "nursery", averageWeightG: 4, countAlive: 100, note: "Retained", photos: [{ id: "photo1", url: "/uploads/care.png" }], createdBy: "Admin", createdAt: at }], createdAt: at, updatedAt: at,
  farmVerified: true, inspectedAt: at, inspector: "Previous inspector", createdBy: { id: "admin1", name: "Admin", email: "admin@example.test" },
  facility: { id: "facility1", name: "Pond", location: "Farm pond", verification: { id: "verification1", level: "registered", status: "approved", inspectedAt: at, inspector: "Inspector", validUntil: "2020-01-01T00:00:00.000Z", documents: [{ id: "document1", type: "Registration", controlled: true }] } },
  reviewedAt: at, reviewedBy: "Previous reviewer", reviewNote: status === "draft" ? "Prior rejection" : null, submittedAt: status === "pending_review" ? submittedAt : null, cancelledAt: null, cancelReason: null, sponsorshipCount: 0,
});

type Element = ReactElement<Record<string, any>>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, any>>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (isValidElement<Record<string, any>>(node)) return text(node.props.children);
  return typeof node === "string" || typeof node === "number" ? String(node) : "";
}
function loadComponent(file: string, modules: Record<string, unknown>) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const output = { exports: {} as Record<string, any> };
  new Function("require", "module", "exports", compiled)((id: string) => id.endsWith(".css") ? {} : id in modules ? modules[id] : require(id), output, output.exports);
  return output.exports;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness(initialMode: "list" | "new" | "detail" | "edit" = "detail", saved = company()) {
  let session = { email: "admin@example.test", role: "Admin", status: "active" } as { email: string; role: string; status: string } | null;
  let generation = 1;
  let cursor = 0;
  let changed = true;
  let tree: ReactNode;
  let guard = () => true;
  let props = { mode: initialMode, batchId: initialMode === "new" || initialMode === "list" ? null : saved.id };
  const slots: { value?: any; deps?: unknown[]; cleanup?: (() => void) | void }[] = [];
  const effects: (() => void)[] = [];
  const listeners = new Map<string, Set<() => void>>();
  const windowMock = { location: { hash: `#company/batches/${saved.id}${initialMode === "edit" ? "/edit" : ""}` }, confirm: vi.fn(() => true), addEventListener: (name: string, callback: () => void) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name)!.add(callback); }, removeEventListener: (name: string, callback: () => void) => listeners.get(name)?.delete(callback) };
  vi.stubGlobal("window", windowMock);
  const hooks = {
    useState(initial: any) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, (next: any) => { const value = typeof next === "function" ? next(slots[index].value) : next; if (!Object.is(value, slots[index].value)) { slots[index].value = value; changed = true; } }];
    },
    useRef(initial: any) { const index = cursor++; if (!slots[index]) slots[index] = { value: { current: initial } }; return slots[index].value; },
    useEffect(effect: () => (() => void) | void, deps: unknown[] = []) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps?.[i]))) {
        const previous = slots[index]; slots[index] = { deps };
        effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = effect(); });
      }
    },
  };
  const api = {
    companyDetail: vi.fn(async () => saved), companyList: vi.fn(async () => [saved]), facilities: vi.fn(async () => [{ ...saved.facility, verification: saved.facility?.verification }]),
    submit: vi.fn(async (_id: string) => company("pending_review")), publish: vi.fn(async () => company("open")), save: vi.fn(async () => company()), create: vi.fn(async () => company()), cancel: vi.fn(async () => company("cancelled")), addUpdate: vi.fn(async () => saved.updates[0]),
  };
  const sponsorships = {
    companyGrow: vi.fn(async (code: string) => ({ batch: { id: code, code, title: saved.title, status: "growing", sharesAvailable: 0, stockCount: saved.stockCount, stockingDate: saved.stockingDate } })),
    companyHarvest: vi.fn(async (code: string) => ({ batch: { id: code, code, status: "harvested" }, harvest: { id: "harvest00000001", batchId: code, harvestedAt: at, actualCount: 90, actualWeightG: null, yieldPerShare: "4.50 fish", mortalityRateBps: 1000, status: "published", publishedAt: at, createdAt: at, updatedAt: at } })),
  };
  const component = loadComponent("./CompanyBatches.tsx", {
    react: hooks, "@/context/LanguageContext": { useTranslation: () => ({ language: "en" }) },
    "@/services/api": { apiSessionStamp: () => ({ role: "Admin", generation }), isApiSession: (stamp: { generation: number }) => stamp.generation === generation, errorMessage: (error: unknown) => error instanceof Error ? error.message : "Malformed response" },
    "@/services/session": { useUser: () => session, currentUser: () => session }, "@/services/hashNavigation": { useHashTransitionGuard: (callback: () => boolean) => { guard = callback; }, replaceHashRoute: vi.fn(() => true) },
    "@/services/batchesApi": { batchesApi: api }, "@/services/sponsorshipsApi": { sponsorshipsApi: sponsorships }, "@/services/batches": batchRules, "@/services/facilities": { facilityTextLength: (value: string) => [...value].length },
    "@/components/batches/BatchDetails": { __esModule: true, default: () => null, batchUtc: (value: string | null, missing: string) => value ?? missing },
  }).default;
  function render() {
    for (let limit = 0; limit < 30; limit++) {
      changed = false; cursor = 0; tree = component(props);
      effects.splice(0).forEach(effect => effect());
      if (!changed) return;
    }
    throw new Error("Hook contract did not settle");
  }
  async function settle() { for (let i = 0; i < 12; i++) { await Promise.resolve(); render(); } }
  const find = (predicate: (element: Element) => boolean) => { const result = elements(tree).find(predicate); if (!result) throw new Error("Component element not found"); return result; };
  const button = (label: string) => find(element => element.type === "button" && text(element) === label);
  const click = (label: string) => button(label).props.onClick({ currentTarget: { focus: vi.fn() } });
  render();
  return {
    api, sponsorships, settle, render, button, click, find, text: () => text(tree), has: (label: string) => elements(tree).some(element => element.type === "button" && text(element) === label),
    session: (next: typeof session, newGeneration = true) => { session = next; if (newGeneration) generation++; },
    route: (id: string) => { props = { ...props, batchId: id }; windowMock.location.hash = `#company/batches/${id}`; render(); },
    hash: (value: string) => { windowMock.location.hash = value; listeners.get("hashchange")?.forEach(callback => callback()); },
    back: () => guard(),
    local: (predicate: (value: any) => boolean, patch: Record<string, unknown>) => { const slot = slots.find(entry => predicate(entry?.value)); if (!slot) throw new Error("Local hook state not found"); slot.value = { ...slot.value, ...patch }; render(); },
    unmount: () => slots.forEach(slot => slot.cleanup?.()),
  };
}
const open = "Review submission of this saved draft";
const grow = "Review growing transition";
const harvest = "Review harvest publication";
const isHarvest = (value: any) => !!value && typeof value === "object" && "actualCount" in value;
const send = "Submit this saved draft once";
afterEach(() => vi.unstubAllGlobals());

describe("saved-draft submission component contract (Node handlers, not mounted GUI)", () => {
  it("submits only the saved code, locks synchronously through authoritative reread, and retains observations/review data", async () => {
    const h = harness(); await h.settle(); h.click(open); h.render();
    const sendHandler = h.button(send).props.onClick;
    const publication = h.button("Confirm publication of saved draft").props.onClick;
    const ack = deferred<CompanyBatch>(), reread = deferred<CompanyBatch>();
    h.api.submit.mockReturnValueOnce(ack.promise); h.api.companyDetail.mockReturnValueOnce(reread.promise);
    sendHandler(); sendHandler(); publication({ currentTarget: { focus: vi.fn() } });
    expect(h.api.submit.mock.calls).toEqual([["BATCH-1024"]]); expect(h.api.publish).not.toHaveBeenCalled();
    ack.resolve(company("pending_review")); await h.settle(); sendHandler(); expect(h.api.submit).toHaveBeenCalledTimes(1);
    reread.resolve(company("pending_review")); await h.settle();
    expect(h.api.companyDetail).toHaveBeenCalledTimes(2); expect(h.text()).toContain("exact submitted UTC time");
    expect(h.text()).toContain("already under review, not public"); expect(h.has(open)).toBe(false);
    expect(h.api.create).not.toHaveBeenCalled(); expect(h.api.save).not.toHaveBeenCalled(); expect(h.api.cancel).not.toHaveBeenCalled(); expect(h.api.addUpdate).not.toHaveBeenCalled();
  });
  it.each(["list", "new", "edit"] as const)("does not offer submission in %s mode", async mode => { const h = harness(mode); await h.settle(); expect(h.has(open)).toBe(false); });
  it.each(["pending_review", "open", "cancelled"] as const)("does not submit saved %s records", async status => { const h = harness("detail", company(status)); await h.settle(); expect(h.has(open)).toBe(false); expect(h.api.submit).not.toHaveBeenCalled(); });
  it.each(["logout", "role", "inactive", "same-account-generation"] as const)("rejects stale opener and final handler after %s", async change => {
    const h = harness(); await h.settle(); const opener = h.button(open).props.onClick; h.click(open); h.render(); const final = h.button(send).props.onClick;
    h.session(change === "logout" ? null : { email: "admin@example.test", role: change === "role" ? "Buyer" : "Admin", status: change === "inactive" ? "suspended" : "active" }, change === "same-account-generation" || change === "logout");
    opener({ currentTarget: { focus: vi.fn() } }); final(); await h.settle(); expect(h.api.submit).not.toHaveBeenCalled(); expect(h.text()).toContain("active Admin session is required");
  });
  it("invalidates confirmation on keep unchanged, hash changed-back, Back and Refresh, including retained stale handlers", async () => {
    const h = harness(); await h.settle();
    for (const invalidate of [() => h.click("Keep draft unchanged"), () => { h.hash("#company/batches/BATCH-2000"); h.hash("#company/batches/BATCH-1024"); }, () => h.back(), () => h.click("Refresh server data")]) {
      h.click(open); h.render(); const final = h.button(send).props.onClick; invalidate(); final(); await h.settle(); expect(h.has(send)).toBe(false);
    }
    expect(h.api.submit).not.toHaveBeenCalled();
  });
  it("rejects stale confirmation after route/id and read sequence change", async () => {
    const h = harness(); await h.settle(); h.click(open); h.render(); const final = h.button(send).props.onClick;
    h.api.companyDetail.mockResolvedValueOnce({ ...company(), id: "BATCH-2000" }); h.route("BATCH-2000"); await h.settle(); final(); await h.settle(); expect(h.api.submit).not.toHaveBeenCalled();
  });
  it.each(["draft", "observation", "cancellation"] as const)("blocks dirty %s state and invalidates changed-back confirmation", async kind => {
    const h = harness(); await h.settle(); h.click(open); h.render(); const final = h.button(send).props.onClick;
    if (kind === "cancellation") {
      const onChange = h.find(element => element.props.id === "batch-cancellation-note").props.onChange;
      onChange({ target: { value: "Local reason" } }); onChange({ target: { value: "" } }); h.render();
    } else {
      const isForm = (value: any) => !!value && typeof value === "object" && (kind === "draft" ? "stockCount" in value && typeof value.stockCount === "string" : "averageWeightG" in value && typeof value.averageWeightG === "string");
      h.local(isForm, kind === "draft" ? { title: "Local title" } : { note: "Local observation" });
      expect(h.button(open).props.disabled).toBe(true);
      h.local(isForm, kind === "draft" ? { title: "Pond fish" } : { note: "" });
    }
    final(); await h.settle(); expect(h.api.submit).not.toHaveBeenCalled(); expect(h.has(send)).toBe(false);
  });
  it.each(["wrong-id", "wrong-status", "missing-time", "review-note", "malformed", "lost", "reread-failed", "reread-status", "reread-time", "reread-note", "observation-missing", "observation-changed", "ack-observation-missing"] as const)("Refresh-gates %s without replay or optimistic success", async failure => {
    const h = harness(); await h.settle(); h.click(open); h.render(); const final = h.button(send).props.onClick;
    const ack = company("pending_review"), read = company("pending_review");
    if (failure === "wrong-id") Object.assign(ack, { id: "BATCH-2000" });
    if (failure === "wrong-status") ack.status = "draft";
    if (failure === "missing-time") ack.submittedAt = null;
    if (failure === "review-note") ack.reviewNote = "Uncleared";
    if (failure === "reread-status") read.status = "open";
    if (failure === "reread-time") read.submittedAt = at;
    if (failure === "reread-note") read.reviewNote = "Unexpected";
    if (failure === "observation-missing") read.updates = [];
    if (failure === "observation-changed") read.updates[0].note = "Changed";
    if (failure === "ack-observation-missing") ack.updates.push({ ...ack.updates[0], id: "new-observation" });
    if (failure === "lost") h.api.submit.mockRejectedValueOnce(new TypeError("Lost response"));
    else if (failure === "malformed") h.api.submit.mockResolvedValueOnce({} as CompanyBatch);
    else h.api.submit.mockResolvedValueOnce(ack);
    if (failure === "reread-failed") h.api.companyDetail.mockRejectedValueOnce(new Error("Reread failed"));
    else h.api.companyDetail.mockResolvedValueOnce(read);
    final(); await h.settle(); final(); await h.settle();
    expect(h.api.submit).toHaveBeenCalledTimes(1); expect(h.has(open)).toBe(false); expect(h.text()).toContain("Use Refresh"); expect(h.text()).not.toContain("Submission acknowledged and");
    h.api.companyDetail.mockResolvedValueOnce(company("pending_review")); h.click("Refresh server data"); await h.settle();
    expect(h.text()).toContain("already under review"); expect(h.api.submit).toHaveBeenCalledTimes(1);
  });
  it("does not accept a late acknowledgement after session invalidation or unmount", async () => {
    for (const change of ["session", "unmount"]) {
      const h = harness(); await h.settle(); h.click(open); h.render(); const ack = deferred<CompanyBatch>(); h.api.submit.mockReturnValueOnce(ack.promise); h.click(send);
      if (change === "session") h.session(null); else h.unmount();
      ack.resolve(company("pending_review")); await h.settle(); expect(h.api.companyDetail).toHaveBeenCalledTimes(1); expect(h.text()).not.toContain("Submission acknowledged and");
    }
  });
});

describe("growing and harvest component contract (Node handlers, not mounted GUI)", () => {
  it("starts growing only from an eligible saved status with one POST and an authoritative reread", async () => {
    const h = harness("detail", company("open")); await h.settle();
    expect(h.has(grow)).toBe(true); expect(h.has(harvest)).toBe(false);
    h.click(grow); h.render(); expect(h.has("Confirm once")).toBe(true); expect(h.text()).toContain("Confirm start of growing");
    h.api.companyDetail.mockResolvedValueOnce(company("growing"));
    h.click("Confirm once"); await h.settle();
    expect(h.sponsorships.companyGrow.mock.calls).toEqual([["BATCH-1024"]]);
    expect(h.sponsorships.companyHarvest).not.toHaveBeenCalled();
    expect(h.api.companyDetail).toHaveBeenCalledTimes(2);
    expect(h.text()).toContain("Growing transition acknowledged");
    expect(h.has(grow)).toBe(false); expect(h.has(harvest)).toBe(true);
    expect(h.api.submit).not.toHaveBeenCalled(); expect(h.api.publish).not.toHaveBeenCalled(); expect(h.api.cancel).not.toHaveBeenCalled();
  });
  it.each(["draft", "pending_review", "growing", "harvested", "settled", "cancelled"] as const)("does not offer growing for saved %s records", async status => {
    const h = harness("detail", company(status)); await h.settle(); expect(h.has(grow)).toBe(false); expect(h.sponsorships.companyGrow).not.toHaveBeenCalled();
  });
  it("Refresh-gates a lost growing outcome without replay or optimistic success", async () => {
    const h = harness("detail", company("open")); await h.settle(); h.click(grow); h.render();
    h.sponsorships.companyGrow.mockRejectedValueOnce(new TypeError("Lost response"));
    const final = h.button("Confirm once").props.onClick;
    final(); await h.settle(); final(); await h.settle();
    expect(h.sponsorships.companyGrow).toHaveBeenCalledTimes(1);
    expect(h.text()).toContain("No automatic replay was sent"); expect(h.text()).not.toContain("Growing transition acknowledged"); expect(h.has(grow)).toBe(false);
    h.api.companyDetail.mockResolvedValueOnce(company("growing")); h.click("Refresh server data"); await h.settle();
    expect(h.sponsorships.companyGrow).toHaveBeenCalledTimes(1); expect(h.has(harvest)).toBe(true);
  });
  it("publishes the harvest for a growing count-share batch with a validated actual count", async () => {
    const h = harness("detail", company("growing")); await h.settle();
    expect(h.has(harvest)).toBe(true); expect(h.has(grow)).toBe(false);
    h.local(isHarvest, { actualCount: "0" }); h.click(harvest); h.render();
    expect(h.has("Confirm once")).toBe(false);
    h.local(isHarvest, { actualCount: "90" }); h.click(harvest); h.render();
    expect(h.has("Confirm once")).toBe(true); expect(h.text()).toContain("Confirm harvest publication");
    expect(h.text()).toContain("Surviving fish count: 90");
    h.api.companyDetail.mockResolvedValueOnce(company("harvested"));
    h.click("Confirm once"); await h.settle();
    expect(h.sponsorships.companyHarvest.mock.calls).toEqual([["BATCH-1024", { actualCount: 90 }]]);
    expect(h.api.companyDetail).toHaveBeenCalledTimes(2);
    expect(h.text()).toContain("Harvest publication acknowledged");
  });
  it("requires whole-batch biomass before publishing a weight-share harvest", async () => {
    const weight = { ...company("growing"), shareUnitType: "weight" as const, shareQuantity: 1000, expectedHarvestWeightG: 100000 };
    const h = harness("detail", weight); await h.settle();
    h.local(isHarvest, { actualCount: "90" }); h.click(harvest); h.render();
    expect(h.has("Confirm once")).toBe(false);
    h.local(isHarvest, { actualWeightG: "95000" }); h.click(harvest); h.render();
    expect(h.has("Confirm once")).toBe(true);
    h.api.companyDetail.mockResolvedValueOnce({ ...weight, status: "harvested" });
    h.click("Confirm once"); await h.settle();
    expect(h.sponsorships.companyHarvest.mock.calls).toEqual([["BATCH-1024", { actualCount: 90, actualWeightG: 95000 }]]);
  });
  it("sends the optional delivery fee per share only when entered and rejects fractional input", async () => {
    const h = harness("detail", company("growing")); await h.settle();
    h.local(isHarvest, { actualCount: "90", deliveryFeePerShare: "1.5" }); h.click(harvest); h.render();
    expect(h.has("Confirm once")).toBe(false);
    h.local(isHarvest, { deliveryFeePerShare: "20000" }); h.click(harvest); h.render();
    expect(h.has("Confirm once")).toBe(true);
    expect(h.text()).toContain("Delivery fee per share: 20,000 ₫");
    h.api.companyDetail.mockResolvedValueOnce(company("harvested"));
    h.click("Confirm once"); await h.settle();
    expect(h.sponsorships.companyHarvest.mock.calls).toEqual([["BATCH-1024", { actualCount: 90, deliveryFeePerShare: 20000 }]]);
    expect(h.text()).toContain("Harvest publication acknowledged");
  });
  it.each(["draft", "open", "harvested", "settled", "cancelled"] as const)("does not offer harvest publication for saved %s records", async status => {
    const h = harness("detail", company(status)); await h.settle(); expect(h.has(harvest)).toBe(false); expect(h.sponsorships.companyHarvest).not.toHaveBeenCalled();
  });
  it("rejects stale grow and harvest handlers after session invalidation", async () => {
    const h = harness("detail", company("open")); await h.settle(); const opener = h.button(grow).props.onClick;
    h.session(null);
    opener({ currentTarget: { focus: vi.fn() } }); await h.settle();
    expect(h.sponsorships.companyGrow).not.toHaveBeenCalled(); expect(h.text()).toContain("active Admin session is required");
  });
});

describe("company-only review metadata rendering", () => {
  const details = () => loadComponent("../../components/batches/BatchDetails.tsx", { "@/context/LanguageContext": { useTranslation: () => ({ language: "en" }) }, "@/services/batches": batchRules }).default;
  it("escapes reviewer/note, renders UTC and explicitly explains prior retained attribution", () => {
    const batch = company(); batch.reviewedBy = "<script>reviewer</script>"; batch.reviewNote = "<img src=x onerror=alert(1)>";
    const html = renderToStaticMarkup(createElement(details(), { batch, includeCompanyReview: true }));
    expect(html).toContain("28/10/2026, 00:00:00 UTC"); expect(html).toContain("&lt;script&gt;reviewer&lt;/script&gt;"); expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<script>"); expect(html).toContain("retain the prior reviewer and review time"); expect(html).toContain("not approval of the current submission");
  });
  it("does not display review metadata by default or for a public projection, even with explicit opt-in", () => {
    const Component = details(); const batch = company();
    expect(renderToStaticMarkup(createElement(Component, { batch }))).not.toContain("Company-only saved review record");
    const publicProjection = { ...batch, status: "open", compliance: { level: "registered", inspectedAt: at, validUntil: at } };
    expect(renderToStaticMarkup(createElement(Component, { batch: publicProjection, includeCompanyReview: true }))).not.toContain("Company-only saved review record");
  });
});
