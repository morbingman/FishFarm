import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { Sponsorship, SponsorshipLedgerEntry } from "./sponsorshipContracts";

const at = "2026-10-28T00:00:00.000Z";
const tranches = () => [
  { id: "tranche00001", milestone: "stocking" as const, amount: 60, state: "held" as const, releasedAt: null, createdAt: at },
  { id: "tranche00002", milestone: "mid_growth" as const, amount: 80, state: "held" as const, releasedAt: null, createdAt: at },
  { id: "tranche00003", milestone: "harvest" as const, amount: 60, state: "held" as const, releasedAt: null, createdAt: at },
];
const payment = (state = "paid") => ({ id: "payment00001", purpose: "sponsorship_package", method: "e_wallet", amount: 200, state, createdAt: at, paidAt: state === "paid" ? at : null, refundedAt: state === "refunded" ? at : null });
const remote = (status: Sponsorship["status"] = "pending_payment"): Sponsorship => ({
  id: "sponsorship0001", batchId: "internalbatch01",
  sponsor: { id: "user1account01", name: "User", email: "user@example.test", phone: "0900000000" },
  batch: { id: "internalbatch01", code: "BATCH-1024", title: "Pond fish", species: "Tilapia", status: "open", location: "Farm pond", region: "South", shareUnitType: "count", shareUnit: "10 fish", shareQuantity: 10, stockingDate: null, expectedHarvestDate: null, images: [{ id: "image1", url: "/uploads/pond.png" }] },
  shares: 2, packageAmount: 200, deliveryFee: 0, totalAmount: 200, status,
  recipientName: "User", phone: "0900000000", address: "12 Street", city: null, province: null, deliveryMethod: null,
  termsSnapshot: { code: "BATCH-1024", termsVersion: "v1", packagePricePerShare: 100, riskDisclosure: "Growth risks apply.", contingencyPct: 10 },
  paidAt: status === "pending_payment" || status === "cancelled" ? null : at, growingAt: null, readyAt: null, deliveredAt: null, settledAt: null,
  cancelledAt: status === "cancelled" || status === "refunded" ? at : null, refundedAt: status === "refunded" ? at : null,
  createdAt: at, updatedAt: at,
  payments: status === "pending_payment" || status === "cancelled" ? [] : [payment(status === "refunded" ? "refunded" : "paid")],
  escrowReleases: status === "pending_payment" || status === "cancelled" ? [] : tranches().map(t => status === "refunded" ? { ...t, state: "reversed" as const } : t),
  adjustments: [],
});
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const reservationBody = { shares: 2, recipientName: "User", phone: "0900000000", address: "12 Street", city: "Can Tho", province: "Can Tho", deliveryMethod: "cold_chain" };

beforeEach(() => { vi.resetModules(); vi.stubGlobal("sessionStorage", { removeItem: vi.fn() }); });
afterEach(() => { vi.unstubAllGlobals(); });

async function session(fetch: ReturnType<typeof vi.fn>) {
  const { authApi } = await import("./api");
  fetch.mockResolvedValueOnce(response({ accessToken: "test-token", user: { id: "user1account01", role: "User" } }));
  await authApi.login("user@example.test", "LOCAL TEST ONLY");
  fetch.mockClear();
}

describe("sponsorship transport", () => {
  it("reads my sponsorships with a protected authenticated GET", async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => response({ items: [remote()], total: 1 })); vi.stubGlobal("fetch", fetch);
    await session(fetch);
    const { sponsorshipsApi } = await import("./sponsorshipsApi");
    await expect(sponsorshipsApi.mine()).resolves.toEqual({ items: [remote()], total: 1 });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/v1/me/sponsorships"); expect(init.method).toBeUndefined(); expect(init.body).toBeUndefined(); expect(init.credentials).toBe("include");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test-token");
    fetch.mockResolvedValueOnce(response({ items: [remote(), remote()], total: 1 }));
    await expect(sponsorshipsApi.mine()).rejects.toMatchObject({ code: "sponsorship.invalidResponse" });
  });

  it("reads the money ledger with strict rows, pagination and zero-fetch invalid paging", async () => {
    const ledgerRow = (overrides: Partial<SponsorshipLedgerEntry> = {}): SponsorshipLedgerEntry => ({
      id: "payment00001", sponsorshipId: "sponsorship0001", shares: 2, sponsorshipStatus: "funded",
      batchCode: "BATCH-1024", batchTitle: "Pond fish", purpose: "sponsorship_package", method: "e_wallet",
      amount: 200, state: "paid", createdAt: at, paidAt: at, refundedAt: null, ...overrides,
    });
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => response({ items: [ledgerRow()], total: 1 })); vi.stubGlobal("fetch", fetch);
    await session(fetch);
    const { sponsorshipsApi } = await import("./sponsorshipsApi");
    await expect(sponsorshipsApi.ledger()).resolves.toEqual({ items: [ledgerRow()], total: 1 });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/v1/me/sponsorships/ledger"); expect(init.method).toBeUndefined(); expect(init.body).toBeUndefined(); expect(init.credentials).toBe("include");
    fetch.mockClear();
    await expect(sponsorshipsApi.ledger(2, 50)).resolves.toEqual({ items: [ledgerRow()], total: 1 });
    expect(fetch.mock.calls[0][0]).toBe("/v1/me/sponsorships/ledger?skip=2&take=50");
    for (const paging of [[0], [-1], [1.5], [10_001], [undefined, 0], [undefined, 101]] as const) {
      await expect(sponsorshipsApi.ledger(paging[0], paging[1])).rejects.toBeInstanceOf(Error);
    }
    expect(fetch).toHaveBeenCalledTimes(1);
    for (const value of [
      { items: [ledgerRow()], total: 0 },
      { items: [ledgerRow()], total: "many" },
      { items: [{ ...ledgerRow(), id: "short" }], total: 1 },
      { items: [{ ...ledgerRow(), purpose: "order_full" }], total: 1 },
      { items: [{ ...ledgerRow(), state: "ready" }], total: 1 },
      { items: [{ ...ledgerRow(), paidAt: null }], total: 1 },
      { items: [{ ...ledgerRow(), refundedAt: at }], total: 1 },
      { items: [{ ...ledgerRow(), purpose: "refund", state: "refunded", refundedAt: at, paidAt: at }], total: 1 },
      { items: [{ ...ledgerRow(), purpose: "sponsorship_package", state: "refunded", refundedAt: at, paidAt: null }], total: 1 },
      { items: [{ ...ledgerRow(), amount: 0 }], total: 1 },
      { items: [{ ...ledgerRow(), batchCode: "internalbatch01" }], total: 1 },
      { items: [ledgerRow(), ledgerRow()], total: 1 },
    ]) {
      fetch.mockResolvedValueOnce(response(value));
      await expect(sponsorshipsApi.ledger()).rejects.toMatchObject({ code: "sponsorship.invalidResponse" });
    }
    // Counting window starts at mockClear: one paging fetch plus twelve
    // malformed-response fetches; invalid paging args never reach the wire.
    expect(fetch).toHaveBeenCalledTimes(13);
  });

  it("reads one sponsorship and its reconciled escrow view", async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => response(remote("funded"))); vi.stubGlobal("fetch", fetch);
    await session(fetch);
    const { sponsorshipsApi } = await import("./sponsorshipsApi");
    await expect(sponsorshipsApi.detail("sponsorship0001")).resolves.toEqual(remote("funded"));
    const escrow = { sponsorshipId: "sponsorship0001", packageAmount: 200, tranches: tranches(), held: 200, released: 0, reversed: 0 };
    fetch.mockResolvedValueOnce(response(escrow));
    await expect(sponsorshipsApi.escrow("sponsorship0001")).resolves.toEqual(escrow);
    fetch.mockResolvedValueOnce(response({ ...escrow, held: 199 }));
    await expect(sponsorshipsApi.escrow("sponsorship0001")).rejects.toMatchObject({ code: "sponsorship.invalidResponse" });
    fetch.mockResolvedValueOnce(response({ ...escrow, sponsorshipId: "sponsorship9999" }));
    await expect(sponsorshipsApi.escrow("sponsorship0001")).rejects.toMatchObject({ code: "sponsorship.invalidResponse" });
  });

  it("sends the exact reservation POST and validates the pending acknowledgement", async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => response(remote())); vi.stubGlobal("fetch", fetch);
    await session(fetch);
    const { sponsorshipsApi } = await import("./sponsorshipsApi");
    await expect(sponsorshipsApi.reserve("BATCH-1024", reservationBody)).resolves.toEqual(remote());
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/v1/batches/BATCH-1024/sponsorships");
    expect(init.method).toBe("POST"); expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body as string)).toEqual(reservationBody);
  });

  it.each([
    { ...remote(), status: "funded" }, { ...remote(), paidAt: at }, { ...remote(), shares: 3 }, { ...remote(), batch: { ...remote().batch, code: "BATCH-9999" } },
    { ...remote(), escrowReleases: tranches() }, { ...remote(), termsSnapshot: { ...remote().termsSnapshot, code: "BATCH-7777" } },
    { ...remote(), totalAmount: 300 },
  ])("rejects a malformed or inconsistent reservation acknowledgement %#", async value => {
    vi.stubGlobal("fetch", vi.fn(async () => response(value)));
    const { sponsorshipsApi } = await import("./sponsorshipsApi");
    await expect(sponsorshipsApi.reserve("BATCH-1024", reservationBody)).rejects.toMatchObject({ code: "sponsorship.invalidResponse" });
  });

  it("rejects invalid reservations before any HTTP request", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const { sponsorshipsApi } = await import("./sponsorshipsApi");
    for (const input of [
      { ...reservationBody, shares: 0 }, { ...reservationBody, shares: 1.5 }, { ...reservationBody, recipientName: "  " },
      { ...reservationBody, phone: "" }, { ...reservationBody, address: " " },
    ]) await expect(sponsorshipsApi.reserve("BATCH-1024", input)).rejects.toBeInstanceOf(Error);
    for (const code of ["BATCH-0", "internal1", ""]) await expect(sponsorshipsApi.reserve(code, reservationBody)).rejects.toBeInstanceOf(Error);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("pays the full package exactly once with reconciled escrow and rejects replay-like acks", async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => response(remote("funded"))); vi.stubGlobal("fetch", fetch);
    await session(fetch);
    const { sponsorshipsApi } = await import("./sponsorshipsApi");
    await expect(sponsorshipsApi.pay("sponsorship0001", "e_wallet")).resolves.toEqual(remote("funded"));
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/v1/sponsorships/sponsorship0001/pay");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ paymentMethod: "e_wallet" });
    for (const value of [
      { ...remote("funded"), paidAt: null }, { ...remote("funded"), payments: [payment(), payment()] },
      { ...remote("funded"), escrowReleases: [] }, { ...remote("funded"), payments: [{ ...payment(), amount: 199 }] },
      { ...remote("funded"), escrowReleases: tranches().map((t, i) => i === 2 ? { ...t, amount: 59 } : t) },
    ]) {
      fetch.mockResolvedValueOnce(response(value));
      await expect(sponsorshipsApi.pay("sponsorship0001", "e_wallet")).rejects.toMatchObject({ code: "sponsorship.invalidResponse" });
    }
    await expect(sponsorshipsApi.pay("sponsorship0001", "crypto" as never)).rejects.toBeInstanceOf(Error);
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  it("cancels with a normalized reason and validates refunded versus cancelled outcomes", async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => response(remote("refunded"))); vi.stubGlobal("fetch", fetch);
    await session(fetch);
    const { sponsorshipsApi } = await import("./sponsorshipsApi");
    await expect(sponsorshipsApi.cancel("sponsorship0001", "  Changed plans.  ")).resolves.toEqual(remote("refunded"));
    expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual({ reason: "Changed plans." });
    for (const value of [
      { ...remote("refunded"), refundedAt: null }, { ...remote("refunded"), payments: [payment("paid")] },
      { ...remote("refunded"), escrowReleases: tranches() }, { ...remote("cancelled"), refundedAt: at, payments: [payment("refunded")] },
      { ...remote("cancelled"), cancelledAt: null }, { ...remote("pending_payment") },
    ]) {
      fetch.mockResolvedValueOnce(response(value));
      await expect(sponsorshipsApi.cancel("sponsorship0001", "Reason")).rejects.toMatchObject({ code: "sponsorship.invalidResponse" });
    }
    for (const reason of ["", " ", "x".repeat(501)]) await expect(sponsorshipsApi.cancel("sponsorship0001", reason)).rejects.toBeInstanceOf(Error);
    for (const id of ["short", "sponsorship0001\n"]) await expect(sponsorshipsApi.cancel(id, "Reason")).rejects.toBeInstanceOf(Error);
    expect(fetch).toHaveBeenCalledTimes(7);
  });

  it("passes 409 through, never retries uncertain failures and never replays after 401", async () => {
    const fetch = vi.fn(async () => response({ statusCode: 409, code: "sponsorship.invalidTransition" }, 409)); vi.stubGlobal("fetch", fetch);
    await session(fetch);
    const { sponsorshipsApi } = await import("./sponsorshipsApi");
    await expect(sponsorshipsApi.pay("sponsorship0001", "e_wallet")).rejects.toMatchObject({ status: 409 });
    expect(fetch).toHaveBeenCalledTimes(1);
    fetch.mockRejectedValue(new TypeError("Lost response"));
    await expect(sponsorshipsApi.pay("sponsorship0001", "e_wallet")).rejects.toThrow("Lost response");
    expect(fetch).toHaveBeenCalledTimes(2);
    fetch.mockResolvedValue(response({ statusCode: 401, code: "auth.unauthorized" }, 401));
    await expect(sponsorshipsApi.cancel("sponsorship0001", "Reason")).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("rejects late reservation results after session changes", async () => {
    let finish: (value: unknown) => void = () => {};
    const fetch = vi.fn().mockResolvedValueOnce(response({ accessToken: "test-token", user: { id: "user1account01", role: "User" } }));
    vi.stubGlobal("fetch", fetch);
    const { authApi, clearApiSession } = await import("./api");
    await authApi.login("user@example.test", "LOCAL TEST ONLY");
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => new Promise(resolve => { finish = resolve; }) });
    const { sponsorshipsApi } = await import("./sponsorshipsApi");
    const pending = sponsorshipsApi.reserve("BATCH-1024", reservationBody);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    clearApiSession();
    finish(remote());
    await expect(pending).rejects.toMatchObject({ code: "auth.sessionChanged" });
  });

  it("serializes sponsorship writes through one shared lock", async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => response(remote())); vi.stubGlobal("fetch", fetch);
    await session(fetch);
    const { sponsorshipsApi } = await import("./sponsorshipsApi");
    const first = sponsorshipsApi.reserve("BATCH-1024", reservationBody);
    await expect(sponsorshipsApi.pay("sponsorship0001", "e_wallet")).rejects.toMatchObject({ code: "sponsorship.requestPending" });
    await expect(sponsorshipsApi.cancel("sponsorship0001", "Reason")).rejects.toMatchObject({ code: "sponsorship.requestPending" });
    await expect(first).resolves.toEqual(remote());
    fetch.mockResolvedValueOnce(response(remote("funded")));
    await expect(sponsorshipsApi.pay("sponsorship0001", "e_wallet")).resolves.toEqual(remote("funded"));
  });

  it("confirms delivery with an empty POST body and validates delivered or settled outcomes", async () => {
    const delivered = (status: "delivered" | "settled" = "delivered"): Sponsorship => ({
      ...remote("funded"), status, growingAt: at, readyAt: at, deliveredAt: at, settledAt: status === "settled" ? at : null,
    });
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => response(delivered())); vi.stubGlobal("fetch", fetch);
    await session(fetch);
    const { sponsorshipsApi } = await import("./sponsorshipsApi");
    await expect(sponsorshipsApi.confirmDelivery("sponsorship0001")).resolves.toEqual(delivered());
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/v1/sponsorships/sponsorship0001/confirm-delivery");
    expect(init.method).toBe("POST"); expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body as string)).toEqual({});
    for (const value of [
      { ...delivered(), id: "sponsorship9999" }, { ...delivered(), deliveredAt: null },
      { ...delivered("settled"), settledAt: null }, { ...delivered(), status: "ready_for_delivery" as const, deliveredAt: null },
    ]) {
      fetch.mockResolvedValueOnce(response(value));
      await expect(sponsorshipsApi.confirmDelivery("sponsorship0001")).rejects.toMatchObject({ code: "sponsorship.invalidResponse" });
    }
    fetch.mockResolvedValueOnce(response(delivered("settled")));
    await expect(sponsorshipsApi.confirmDelivery("sponsorship0001")).resolves.toEqual(delivered("settled"));
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  it("starts growing with an exact POST and validates the batch acknowledgement", async () => {
    const ack = { batch: { id: "BATCH-1024", code: "BATCH-1024", title: "Pond fish", status: "growing", sharesAvailable: 0, stockCount: 100, stockingDate: null } };
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => response(ack)); vi.stubGlobal("fetch", fetch);
    await session(fetch);
    const { sponsorshipsApi } = await import("./sponsorshipsApi");
    await expect(sponsorshipsApi.companyGrow("BATCH-1024")).resolves.toEqual(ack);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/v1/company/batches/BATCH-1024/grow");
    expect(init.method).toBe("POST"); expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body as string)).toEqual({});
    for (const value of [
      { batch: { ...ack.batch, status: "open" } }, { batch: { ...ack.batch, code: "BATCH-9999" } },
      { batch: { ...ack.batch, stockCount: 0 } }, { batch: { ...ack.batch, title: "" } },
      {}, { batch: { ...ack.batch, extra: 1 } },
    ]) {
      fetch.mockResolvedValueOnce(response(value));
      await expect(sponsorshipsApi.companyGrow("BATCH-1024")).rejects.toMatchObject({ code: "sponsorship.invalidResponse" });
    }
    for (const code of ["internalbatch01", "BATCH-0"]) await expect(sponsorshipsApi.companyGrow(code)).rejects.toBeInstanceOf(Error);
    expect(fetch).toHaveBeenCalledTimes(7);
  });

  it("publishes the harvest with a normalized body and validates the acknowledgement", async () => {
    const harvest = { id: "harvest00000001", batchId: "BATCH-1024", harvestedAt: at, actualCount: 90, actualWeightG: null, yieldPerShare: "4.50 fish", mortalityRateBps: 1000, status: "published", publishedAt: at, createdAt: at, updatedAt: at };
    const ack = { batch: { id: "BATCH-1024", code: "BATCH-1024", status: "harvested" }, harvest };
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => response(ack)); vi.stubGlobal("fetch", fetch);
    await session(fetch);
    const { sponsorshipsApi } = await import("./sponsorshipsApi");
    await expect(sponsorshipsApi.companyHarvest("BATCH-1024", { actualCount: 90 })).resolves.toEqual(ack);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/v1/company/batches/BATCH-1024/harvest");
    expect(init.method).toBe("POST"); expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body as string)).toEqual({ actualCount: 90 });
    for (const value of [
      { ...ack, batch: { ...ack.batch, status: "growing" } }, { ...ack, harvest: { ...harvest, status: "draft" } },
      { ...ack, harvest: { ...harvest, mortalityRateBps: 10001 } }, { ...ack, harvest: { ...harvest, actualCount: 0 } },
      { ...ack, harvest: { ...harvest, publishedAt: "not-a-date" } },
    ]) {
      fetch.mockResolvedValueOnce(response(value));
      await expect(sponsorshipsApi.companyHarvest("BATCH-1024", { actualCount: 90 })).rejects.toMatchObject({ code: "sponsorship.invalidResponse" });
    }
    fetch.mockResolvedValueOnce(response(ack));
    await expect(sponsorshipsApi.companyHarvest("BATCH-1024", { actualCount: 90, actualWeightG: 12345 })).resolves.toEqual(ack);
    expect(JSON.parse(fetch.mock.calls[6][1].body as string)).toEqual({ actualCount: 90, actualWeightG: 12345 });
    fetch.mockResolvedValueOnce(response(ack));
    await expect(sponsorshipsApi.companyHarvest("BATCH-1024", { actualCount: 90, deliveryFeePerShare: 20000 })).resolves.toEqual(ack);
    expect(JSON.parse(fetch.mock.calls[7][1].body as string)).toEqual({ actualCount: 90, deliveryFeePerShare: 20000 });
    for (const input of [{ actualCount: 0 }, { actualCount: 1.5 }, { actualCount: 90, actualWeightG: 0 }, { actualCount: 1_000_000_001 }, { actualCount: 90, deliveryFeePerShare: -1 }, { actualCount: 90, deliveryFeePerShare: 1.5 }]) await expect(sponsorshipsApi.companyHarvest("BATCH-1024", input)).rejects.toBeInstanceOf(Error);
    expect(fetch).toHaveBeenCalledTimes(8);
  });

  it("pays the harvest delivery fee once and validates exactly one paid fee payment", async () => {
    const feePayment = (overrides: Partial<ReturnType<typeof payment>> = {}, id = "payment00002") => ({ id, purpose: "delivery_fee", method: "e_wallet", amount: 40, state: "paid", createdAt: at, paidAt: at, refundedAt: null, ...overrides });
    const ready = (fee = true): Sponsorship => ({
      ...remote("funded"), status: "ready_for_delivery", deliveryFee: 40, totalAmount: 240, growingAt: at, readyAt: at,
      payments: [payment("paid"), ...(fee ? [feePayment()] : [])],
    });
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => response(ready())); vi.stubGlobal("fetch", fetch);
    await session(fetch);
    const { sponsorshipsApi } = await import("./sponsorshipsApi");
    await expect(sponsorshipsApi.payDeliveryFee("sponsorship0001", "e_wallet")).resolves.toEqual(ready());
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/v1/sponsorships/sponsorship0001/pay-delivery-fee");
    expect(init.method).toBe("POST"); expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body as string)).toEqual({ paymentMethod: "e_wallet" });
    await expect(sponsorshipsApi.payDeliveryFee("sponsorship0001", "crypto" as never)).rejects.toBeInstanceOf(Error);
    expect(fetch).toHaveBeenCalledTimes(1);
    for (const value of [
      ready(false),
      { ...ready(), payments: [payment("paid"), feePayment(), feePayment({}, "payment00003")] },
      { ...ready(), payments: [payment("paid"), feePayment({ amount: 50 })] },
      { ...ready(), payments: [payment("paid"), feePayment({ state: "refunded", paidAt: at, refundedAt: at })] },
      { ...ready(), status: "delivered" as const, deliveredAt: at },
      { ...remote("funded"), status: "ready_for_delivery" as const, growingAt: at, readyAt: at },
    ]) {
      fetch.mockResolvedValueOnce(response(value));
      await expect(sponsorshipsApi.payDeliveryFee("sponsorship0001", "e_wallet")).rejects.toMatchObject({ code: "sponsorship.invalidResponse" });
    }
    fetch.mockResolvedValueOnce(response(ready()));
    await expect(sponsorshipsApi.payDeliveryFee("sponsorship0001", "bank_card")).resolves.toEqual(ready());
    expect(fetch).toHaveBeenCalledTimes(8);
  });
});
