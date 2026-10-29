import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JsonValue, NotificationsQuery, PersonalNotification } from "./notifications";

const createdAt = "2026-10-28T00:00:00.000Z";
const fixture = (overrides: Partial<PersonalNotification> = {}): PersonalNotification => ({
  id: "n1", type: "status", titleKey: "notifications.buyer.orderPlaced.title", titleParams: { code: "ORD-1" },
  bodyKey: "notifications.buyer.orderPlaced.body", bodyParams: { total: 1250000 },
  link: "#marketplace/orders/ORD-1", readAt: null, createdAt, ...overrides,
});
const nestedJson = (depth: number, leaf: JsonValue = null): JsonValue => {
  let value = leaf;
  for (let index = 0; index < depth; index++) value = { nested: [value] };
  return value;
};
beforeEach(() => { vi.resetModules(); vi.stubGlobal("sessionStorage", { removeItem: vi.fn() }); });
afterEach(() => vi.unstubAllGlobals());

describe("personal notification queries", () => {
  it("recognizes only the exact standalone account route", async () => {
    const { notificationsRoute, isNotificationsRoute } = await import("./notifications");
    expect(notificationsRoute).toBe("#account/notifications");
    expect(isNotificationsRoute("account/notifications")).toBe(true);
    for (const route of ["account", "#account/notifications", "account/notifications/", "account/notifications/n1", "account/notifications?read=unread", "account/notifications#x", "admin/notifications", "account/notifications%00"]) {
      expect(isNotificationsRoute(route)).toBe(false);
    }
  });
  it("serializes exact defaults and optional filters without mutating the input", async () => {
    const { notificationsQuery, notificationsSearchParams } = await import("./notifications");
    expect(notificationsQuery()).toEqual({ read: "all", page: 1, limit: 25 });
    expect(notificationsSearchParams()).toBe("read=all&page=1&limit=25");
    const input = Object.freeze({ read: "unread", type: "reminder", page: 1_000_000, limit: 100 } as const);
    expect(notificationsQuery(input)).toEqual(input);
    expect(notificationsSearchParams(input)).toBe("read=unread&type=reminder&page=1000000&limit=100");
    expect(notificationsSearchParams({ read: "read", page: 1, limit: 1 })).toBe("read=read&page=1&limit=1");
    expect(notificationsQuery({ read: undefined, type: undefined, page: undefined, limit: undefined })).toEqual({ read: "all", page: 1, limit: 25 });
  });
  it("accepts every exact server read/type enum and inclusive paging boundaries", async () => {
    const { notificationReads, notificationTypes, notificationsQuery } = await import("./notifications");
    expect(notificationReads).toEqual(["all", "unread", "read"]);
    expect(notificationTypes).toEqual(["success", "error", "system", "status", "approval", "reminder"]);
    for (const read of notificationReads) for (const type of notificationTypes) {
      expect(notificationsQuery({ read, type })).toEqual({ read, type, page: 1, limit: 25 });
    }
    for (const page of [1, 1_000_000]) for (const limit of [1, 100]) {
      expect(notificationsQuery({ page, limit })).toEqual({ read: "all", page, limit });
    }
  });
  it.each([
    null, [], "read=all", true, 1, { read: null }, { read: "All" }, { read: " unread " }, { read: true }, { read: ["unread"] },
    { type: null }, { type: "all" }, { type: "Status" }, { type: " status" }, { type: ["status"] },
    { page: 0 }, { page: -1 }, { page: 1_000_001 }, { page: 1.5 }, { page: "1" }, { page: null }, { page: true }, { page: NaN }, { page: Infinity },
    { limit: 0 }, { limit: -1 }, { limit: 101 }, { limit: 1.5 }, { limit: "25" }, { limit: null }, { limit: false }, { limit: NaN }, { limit: Infinity },
    { recipientId: "other" }, { unread: true }, { q: "search" }, { read: "all", extra: undefined },
  ])("rejects invalid or non-exact query %#", async input => {
    const { notificationsQuery, notificationsSearchParams } = await import("./notifications");
    for (const validate of [notificationsQuery, notificationsSearchParams]) {
      expect(() => validate(input as NotificationsQuery)).toThrowError(expect.objectContaining({ status: 400, code: "validation.failed" }));
    }
  });
});

describe("notification projection, UTC dates and persisted JSON", () => {
  it("retains only the exact personal projection, nullable fields and all notification types", async () => {
    const { notificationTypes, validateNotification } = await import("./notifications");
    for (const type of notificationTypes) {
      const item = fixture({ type, titleParams: null, bodyParams: null, link: null });
      expect(validateNotification(item)).toEqual(item);
      expect(validateNotification(item)).not.toBe(item);
    }
    const item = fixture({ readAt: "2026-10-28T01:00:00Z" });
    expect(validateNotification(item)).toEqual(item);
  });
  it("does not impose registration-like text, key, link or JSON size constraints on stored history", async () => {
    const { validateNotification } = await import("./notifications");
    for (const text of ["", "  ", "line\nwith\ttext", "<img src=x onerror=alert(1)>", "x".repeat(20000)]) {
      const item = fixture({ id: text || "n1", titleKey: text, bodyKey: text, titleParams: text, bodyParams: text, link: text });
      expect(validateNotification(item)).toEqual(item);
    }
    const wide = Object.fromEntries(Array.from({ length: 1500 }, (_, index) => [`key${index}`, null]));
    expect(validateNotification(fixture({ titleParams: wide })).titleParams).toEqual(wide);
  });
  it.each(["id", "type", "titleKey", "titleParams", "bodyKey", "bodyParams", "link", "readAt", "createdAt"])("requires the projected %s field even when its value may be null", async key => {
    const { validateNotification } = await import("./notifications");
    const value: Record<string, unknown> = { ...fixture() };
    delete value[key];
    expect(() => validateNotification(value)).toThrow("notifications.invalidResponse");
  });
  it.each([
    null, [], {}, { ...fixture(), recipientId: "private-owner" }, { ...fixture(), recipientRole: "Admin" }, { ...fixture(), extra: undefined },
    { ...fixture(), id: "" }, { ...fixture(), id: 1 }, { ...fixture(), type: "Status" }, { ...fixture(), type: "unknown" },
    { ...fixture(), titleKey: null }, { ...fixture(), bodyKey: 1 }, { ...fixture(), link: {} }, { ...fixture(), link: false },
    { ...fixture(), createdAt: null }, { ...fixture(), readAt: false }, { ...fixture(), titleParams: undefined }, { ...fixture(), bodyParams: { bad: undefined } },
  ])("rejects invalid or privacy-expanding row %#", async value => {
    const { validateNotification } = await import("./notifications");
    expect(() => validateNotification(value)).toThrowError(expect.objectContaining({ status: 502, code: "notifications.invalidResponse" }));
  });
  it.each(["2024-02-29T23:59:59Z", "2000-02-29T00:00:00.000Z", "2026-04-30T12:34:56.123456Z", "2026-12-31T23:59:59.999Z", "2026-10-28T00:00:00Z"])("accepts actual UTC calendar timestamp %s", async value => {
    const { notificationIsoDate, validateNotification } = await import("./notifications");
    expect(notificationIsoDate(value)).toBe(true);
    expect(validateNotification(fixture({ createdAt: value, readAt: value })).createdAt).toBe(value);
  });
  it.each([
    null, 0, new Date(createdAt), "", "invalid", "2026-10-28", "2026-10-28T00:00:00", "2026-10-28T00:00:00+00:00", "2026-10-28T07:00:00+07:00",
    "2026-02-29T00:00:00Z", "1900-02-29T00:00:00Z", "2026-02-30T00:00:00Z", "2026-04-31T00:00:00Z", "2026-00-01T00:00:00Z",
    "2026-13-01T00:00:00Z", "2026-10-00T00:00:00Z", "2026-10-32T00:00:00Z", "2026-10-28T24:00:00Z", "2026-10-28T00:60:00Z",
    "2026-10-28T00:00:60Z", "2026-10-28t00:00:00z", "2026-10-28T00:00:00.Z", " 2026-10-28T00:00:00Z", "2026-10-28T00:00:00Z\n",
  ])("rejects non-UTC, normalized or malformed timestamp %#", async value => {
    const { notificationIsoDate, validateNotification } = await import("./notifications");
    expect(notificationIsoDate(value)).toBe(false);
    expect(() => validateNotification({ ...fixture(), createdAt: value })).toThrow("notifications.invalidResponse");
    if (value !== null) expect(() => validateNotification({ ...fixture(), readAt: value })).toThrow("notifications.invalidResponse");
  });
  it("accepts arbitrary primitive, nested, nullable and shared JSON without artificial numeric/depth limits", async () => {
    const { isNotificationJson, validateNotification } = await import("./notifications");
    const shared = { nullable: null, values: [true, false, 1.25, -3, "text"] };
    const values: JsonValue[] = [null, true, false, "", 0, -1, 1.25, Number.MAX_VALUE, Number.MAX_SAFE_INTEGER + 1,
      [], {}, [shared, null, [shared]], { left: shared, right: shared }, Object.assign(Object.create(null), { nullable: null }), nestedJson(2000, shared)];
    for (const value of values) {
      expect(isNotificationJson(value)).toBe(true);
      const item = validateNotification(fixture({ titleParams: value, bodyParams: value }));
      expect(item.titleParams).toBe(value);
      expect(item.bodyParams).toBe(value);
    }
  });
  it("rejects non-JSON values and cycles but not repeated non-cyclic references", async () => {
    const { isNotificationJson, validateNotification } = await import("./notifications");
    const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    const arrayCycle: unknown[] = []; arrayCycle.push(arrayCycle);
    const sparse = new Array(2); sparse[1] = null;
    for (const value of [undefined, NaN, Infinity, -Infinity, 1n, Symbol("x"), () => null, new Date(), new Map(), new Set(), /x/, sparse, cycle, arrayCycle,
      { nested: [null, { invalid: undefined }] }, [NaN], Object.create({ inherited: true })]) {
      expect(isNotificationJson(value)).toBe(false);
      expect(() => validateNotification({ ...fixture(), titleParams: value })).toThrow("notifications.invalidResponse");
      expect(() => validateNotification({ ...fixture(), bodyParams: value })).toThrow("notifications.invalidResponse");
    }
  });
  it("snapshots arbitrary JSON iteratively and preserves own prototype-named keys without aliasing", async () => {
    const { snapshotNotificationJson, notificationJsonEqual, isNotificationJson } = await import("./notifications");
    for (const value of [null, true, "text", -1.5, [], nestedJson(20000, { nullable: null })] as JsonValue[]) {
      const snapshot = snapshotNotificationJson(value);
      expect(isNotificationJson(snapshot)).toBe(true); expect(notificationJsonEqual(snapshot, value)).toBe(true);
      if (value !== null && typeof value === "object") expect(snapshot === value).toBe(false);
    }
    const original = JSON.parse('{"__proto__":{"nested":[{"text":"original"}]},"constructor":null,"toString":false}');
    const snapshot = snapshotNotificationJson(original) as Record<string, JsonValue>;
    expect(Object.getPrototypeOf(snapshot)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(snapshot, "__proto__")).toBe(true);
    expect(Object.keys(snapshot)).toEqual(["__proto__", "constructor", "toString"]);
    expect(notificationJsonEqual(snapshot, original)).toBe(true);
    original.__proto__.nested[0].text = "mutated";
    expect(notificationJsonEqual(snapshot, original)).toBe(false);
    expect((snapshot.__proto__ as { nested: { text: string }[] }).nested[0].text).toBe("original");
  });
  it("compares JSON structurally, retaining array order, primitive types and nullable members", async () => {
    const { notificationJsonEqual } = await import("./notifications");
    expect(notificationJsonEqual({ b: [null, { x: true }], a: 1 }, { a: 1, b: [null, { x: true }] })).toBe(true);
    expect(notificationJsonEqual(nestedJson(2000, "leaf"), nestedJson(2000, "leaf"))).toBe(true);
    expect(notificationJsonEqual(nestedJson(2000, "leaf"), nestedJson(2000, "changed"))).toBe(false);
    for (const [left, right] of [[null, {}], [1, "1"], [false, 0], [[], {}], [[1, 2], [2, 1]], [{ a: null }, {}], [{ a: 1 }, { b: 1 }], [[null], []]] as [JsonValue, JsonValue][]) {
      expect(notificationJsonEqual(left, right)).toBe(false);
    }
  });
});

const databaseId = `c${"a".repeat(24)}`;
describe("safe role-aware mounted notification destinations", () => {
  it("allows exact public marketplace/detail links for both personal roles", async () => {
    const { safeNotificationLink } = await import("./notifications");
    for (const role of ["User", "Buyer", "Admin"] as const) for (const link of ["#marketplace", "#marketplace/detail?fish=FM-1", `#marketplace/detail?fish=${databaseId}`]) {
      expect(safeNotificationLink(link, role)).toBe(link);
    }
  });
  it("allows User/Buyer orders and disputes but keeps them inaccessible to Admin", async () => {
    const { safeNotificationLink } = await import("./notifications");
    for (const link of ["#marketplace/orders", "#marketplace/disputes", "#marketplace/orders/ORD-1", "#marketplace/orders/ORD-1/dispute", `#marketplace/disputes/${databaseId}`]) {
      for (const role of ["User", "Buyer"] as const) expect(safeNotificationLink(link, role)).toBe(link);
      expect(safeNotificationLink(link, "Admin")).toBeNull();
    }
  });
  it("allows only mounted Admin workspaces and canonical FM, order and database identifiers", async () => {
    const { safeNotificationLink } = await import("./notifications");
    for (const link of ["#company/listings", "#company/orders", "#admin/queue", "#admin/activity", "#admin/users", "#admin/disputes", "#company/listing/FM-1", `#company/listing/${databaseId}`, "#company/orders/ORD-1", "#admin/orders/ORD-1", "#admin/review/FM-1", `#admin/review/${databaseId}`, `#admin/disputes/${databaseId}`]) {
      expect(safeNotificationLink(link, "Admin")).toBe(link);
      for (const role of ["User", "Buyer"] as const) expect(safeNotificationLink(link, role)).toBeNull();
    }
  });
  it("keeps unsafe, malformed, query-expanded and unmounted historical URLs as text", async () => {
    const { safeNotificationLink } = await import("./notifications");
    for (const link of [null, undefined, "", "javascript:alert(1)", "https://example.test", "//example.test", "/marketplace", " #marketplace", "#marketplace\n", "#marketplace\u0000", "#marketplace\u007f",
      "#marketplace/detail", "#marketplace/detail?fish=FM-1&next=x", "#marketplace/detail?fish=FM-1#x", "#marketplace/detail?fish=unknown", "#marketplace/detail?fish=FM%2D1", `#marketplace/detail?fish=c${"a".repeat(23)}`,
      "#marketplace/orders/ORD-1/extra", "#marketplace/orders/ORD-1?x=1", "#marketplace/orders/ORD%2F1", "#marketplace/disputes/unknown", "#marketplace/cart", "#marketplace/checkout",
      "#company", "#admin", "#account/notifications", "#admin/queue?tab=pending", "#company/facilities/f1", "#admin/batches/B-1", "#admin/users/u1", "#admin/users/", "#admin/review/", "#admin/review/a/extra", "#admin/review/a?next=x",
      "#admin/review/not-an-id", "#admin/disputes/not-an-id", "#admin/disputes/id_with-dash", "#admin/review/%46M-1", "#company/listing/ORD-1", "#company/orders/FM-1", `#admin/orders/${databaseId}`, "#admin/disputes/FM-1",
      "#admin/review/%", "#admin/review/%20", "#admin/review/%0A", "#admin/review/%00", "#admin/review/%7F", "#admin/review/id%2Fother", "#admin/review/%252F", "#admin/review/%2e%2e", "#admin/review/id%3Fquery", "#admin/review/id%23hash"]) {
      for (const role of ["User", "Buyer", "Admin"] as const) expect(safeNotificationLink(link, role), `${role}: ${link}`).toBeNull();
    }
  });
});

// Exact keys and parameter shapes emitted by auth, orders, disputes, listings and the seed.
const producerTemplates: [string, JsonValue, string, string][] = [
  ["welcome.title", null, "Welcome to FISHMARKET", "Chào mừng đến FISHMARKET"],
  ["welcome.body", null, "Browse the company marketplace and manage your orders securely.", "Khám phá chợ cá của công ty và quản lý đơn hàng an toàn."],
  ["buyer.welcome.title", null, "Welcome to FISHMARKET", "Chào mừng đến FISHMARKET"],
  ["buyer.welcome.body", null, "Browse the company marketplace and manage your orders securely.", "Khám phá chợ cá của công ty và quản lý đơn hàng an toàn."],
  ["company.welcome.title", null, "Welcome to the company workspace", "Chào mừng đến không gian công ty"],
  ["company.welcome.body", null, "Manage the company catalog and orders.", "Quản lý danh mục và đơn hàng công ty."],
  ["admin.pendingQueue.title", { count: 2 }, "2 listings awaiting review", "2 tin đăng chờ xét duyệt"],
  ["admin.pendingQueue.body", { names: "Betta, Koi", hours: 20 }, "Betta, Koi have been waiting for 20 hours.", "Betta, Koi đã chờ 20 giờ."],
  ["admin.orderPlaced.title", { code: "ORD-1" }, "New order ORD-1", "Đơn hàng mới ORD-1"],
  ["admin.orderPlaced.body", { name: "Buyer", total: 1250000 }, "Buyer placed an order totaling 1,250,000 ₫.", "Buyer đã đặt đơn trị giá 1.250.000 ₫."],
  ["buyer.orderPlaced.title", { code: "ORD-1" }, "Order ORD-1 placed", "Đã đặt đơn ORD-1"],
  ["buyer.orderPlaced.body", { total: 1250000 }, "Your order total is 1,250,000 ₫.", "Tổng đơn hàng của bạn là 1.250.000 ₫."],
  ["admin.balancePaid.title", { code: "ORD-1" }, "Balance paid for ORD-1", "Đã thanh toán phần còn lại cho ORD-1"],
  ["admin.balancePaid.body", null, "The buyer paid the remaining order balance.", "Người mua đã thanh toán phần còn lại của đơn hàng."],
  ["buyer.balancePaid.title", { code: "ORD-1" }, "Balance paid for ORD-1", "Đã thanh toán phần còn lại cho ORD-1"],
  ["buyer.balancePaid.body", null, "Your remaining order balance has been paid.", "Phần còn lại của đơn hàng đã được thanh toán."],
  ["buyer.orderReadyBalanceDue.title", { code: "ORD-1" }, "Order ORD-1 ready · balance due", "Đơn ORD-1 sẵn sàng · cần thanh toán phần còn lại"],
  ["buyer.orderReadyBalanceDue.body", { balance: 1250000, days: 7 }, "Pay the remaining 1,250,000 ₫ within 7 days.", "Thanh toán phần còn lại 1.250.000 ₫ trong 7 ngày."],
  ["buyer.orderReady.title", { code: "ORD-1" }, "Order ORD-1 ready", "Đơn ORD-1 đã sẵn sàng"],
  ["buyer.orderReady.body", { days: 7, balance: 0 }, "Your order is ready for shipping.", "Đơn hàng của bạn đã sẵn sàng giao."],
  ["buyer.orderShipped.title", { code: "ORD-1" }, "Order ORD-1 shipped", "Đơn ORD-1 đang giao"],
  ["buyer.orderShipped.body", null, "Your order has been shipped. Open the order for tracking details.", "Đơn hàng đã được gửi. Mở đơn để xem thông tin vận chuyển."],
  ["buyer.orderDelivered.title", { code: "ORD-1" }, "Order ORD-1 delivered", "Đã giao đơn ORD-1"],
  ["buyer.orderDelivered.body", null, "Your order is marked delivered. Open the order to review delivery.", "Đơn hàng được ghi nhận đã giao. Mở đơn để kiểm tra việc giao hàng."],
  ["buyer.orderCompleted.title", { code: "ORD-1" }, "Order ORD-1 completed", "Đơn ORD-1 hoàn tất"],
  ["buyer.orderCompleted.body", null, "Your order has been completed.", "Đơn hàng của bạn đã hoàn tất."],
  ["buyer.orderCancelled.title", { code: "ORD-1" }, "Order ORD-1 cancelled", "Đã hủy đơn ORD-1"],
  ["buyer.orderCancelled.body", { reason: "Unavailable" }, "Your order was cancelled: Unavailable", "Đơn hàng đã bị hủy: Unavailable"],
  ["buyer.orderRefunded.title", { code: "ORD-1" }, "Order ORD-1 refunded", "Đơn ORD-1 đã hoàn tiền"],
  ["buyer.orderRefunded.body", { reason: "Unavailable" }, "Your order was cancelled and paid amounts refunded: Unavailable", "Đơn hàng đã bị hủy và khoản đã trả được hoàn tiền: Unavailable"],
  ["admin.disputeOpened.title", { code: "ORD-1" }, "Dispute opened for ORD-1", "Khiếu nại mới cho ORD-1"],
  ["admin.disputeOpened.body", { name: "Buyer" }, "Buyer opened a dispute. Review its details.", "Buyer đã mở khiếu nại. Xem thông tin chi tiết."],
  ["buyer.disputeReviewing.title", { code: "ORD-1" }, "Dispute for ORD-1 under review", "Khiếu nại cho ORD-1 đang xét duyệt"],
  ["buyer.disputeReviewing.body", null, "Your dispute is being reviewed.", "Khiếu nại của bạn đang được xét duyệt."],
  ["buyer.disputeResolved.title", { code: "ORD-1" }, "Dispute for ORD-1 resolved", "Đã giải quyết khiếu nại cho ORD-1"],
  ["buyer.disputeResolved.body", null, "Your dispute has been resolved. Open it for details.", "Khiếu nại đã được giải quyết. Mở để xem chi tiết."],
  ["buyer.disputeRejected.title", { code: "ORD-1" }, "Dispute for ORD-1 rejected", "Khiếu nại cho ORD-1 bị từ chối"],
  ["buyer.disputeRejected.body", null, "Your dispute has been rejected. Open it for details.", "Khiếu nại đã bị từ chối. Mở để xem chi tiết."],
  ["admin.batchSubmitted.title", { code: "BATCH-1024" }, "Batch BATCH-1024 submitted for review", "Lô BATCH-1024 gửi xét duyệt"],
  ["admin.batchSubmitted.body", null, "A company batch is awaiting review. Batch management is not integrated here.", "Một lô của công ty đang chờ xét duyệt. Quản lý lô chưa được tích hợp tại đây."],
  ["admin.listingSubmitted.title", { name: "Koi" }, "Listing submitted: Koi", "Tin đăng gửi xét duyệt: Koi"],
  ["admin.listingSubmitted.body", { company: "FishFarm", name: "Koi", code: "FM-1" }, "FishFarm submitted Koi (FM-1) for review.", "FishFarm đã gửi Koi (FM-1) để xét duyệt."],
  ["admin.listingResubmitted.title", { name: "Koi" }, "Listing resubmitted: Koi", "Tin đăng gửi lại: Koi"],
  ["admin.listingResubmitted.body", { company: "FishFarm", name: "Koi", code: "FM-1" }, "FishFarm resubmitted Koi (FM-1) for review.", "FishFarm đã gửi lại Koi (FM-1) để xét duyệt."],
];
describe("notification presentation and EN/VI producer keys", () => {
  it.each(producerTemplates)("translates notifications.%s with its actual producer params", async (suffix, params, en, viText) => {
    const { notificationText } = await import("./notifications");
    expect(notificationText(`notifications.${suffix}`, params, "en")).toBe(en);
    expect(notificationText(`notifications.${suffix}`, params, "vi")).toBe(viText);
  });
  it("retains unknown, inherited-name and untranslated historical keys plus arbitrary JSON", async () => {
    const { notificationText } = await import("./notifications");
    for (const key of ["notifications.legacy.title", "", "constructor", "toString", "__proto__", "<script>key</script>"]) {
      for (const params of [null, true, 1.25, "text", [null, { nested: [1, false] }], { arbitrary: { nullable: null } }] as JsonValue[]) {
        for (const language of ["en", "vi"] as const) expect(notificationText(key, params, language)).toBe(`${key} · ${JSON.stringify(params)}`);
      }
    }
  });
  it("falls back instead of coercing missing or unsuitable template substitutions", async () => {
    const { notificationText } = await import("./notifications");
    for (const [key, values] of [
      ["notifications.buyer.orderPlaced.title", [null, [], "ORD-1", {}, { code: null }, { code: 1 }, { code: ["ORD-1"] }]],
      ["notifications.buyer.orderPlaced.body", [{}, { total: "1000" }, { total: -1 }, { total: 1.25 }, { total: null }, { total: Number.MAX_SAFE_INTEGER + 1 }]],
      ["notifications.admin.pendingQueue.body", [{ names: "Koi" }, { names: "Koi", hours: "20" }, { names: ["Koi"], hours: 20 }]],
    ] as [string, JsonValue[]][]) for (const params of values) {
      for (const language of ["en", "vi"] as const) expect(notificationText(key, params, language)).toBe(`${key} · ${JSON.stringify(params)}`);
    }
    const inherited = Object.create({ code: "ORD-1" });
    expect(notificationText("notifications.buyer.orderPlaced.title", inherited, "en")).toBe("notifications.buyer.orderPlaced.title · {}");
  });
  it("interpolates recorded strings as literal text without recursive template interpretation", async () => {
    const { notificationText } = await import("./notifications");
    const code = "<img src=x onerror=alert(1)> {total} $&";
    const params = { code, extra: { arbitrary: [null, false] } };
    expect(notificationText("notifications.buyer.orderPlaced.title", params, "en")).toBe(`Order ${code} placed`);
    expect(notificationText("notifications.buyer.orderPlaced.title", params, "vi")).toBe(`Đã đặt đơn ${code}`);
    expect(notificationText("notifications.admin.pendingQueue.title", { count: 1000 }, "en")).toBe("1,000 listings awaiting review");
    expect(notificationText("notifications.admin.pendingQueue.title", { count: 1000 }, "vi")).toBe("1.000 tin đăng chờ xét duyệt");
    expect(notificationText("notifications.buyer.orderPlaced.body", { total: 0 }, "en")).toBe("Your order total is 0 ₫.");
  });
  it("has a display fallback even for valid JSON too deep for native stringify", async () => {
    const { isNotificationJson, notificationText } = await import("./notifications");
    const params = nestedJson(20000);
    expect(isNotificationJson(params)).toBe(true);
    expect(notificationText("legacy.key", params, "en")).toBe("legacy.key · Parameters cannot be displayed");
    expect(notificationText("legacy.key", params, "vi")).toBe("legacy.key · Không thể hiển thị tham số");
  });
  it("labels all six types and formats dates explicitly in UTC", async () => {
    const { notificationDate, notificationTypeLabel } = await import("./notifications");
    for (const [type, en, viText] of [["success", "Success", "Thành công"], ["error", "Error", "Lỗi"], ["system", "System", "Hệ thống"], ["status", "Status", "Trạng thái"], ["approval", "Approval", "Phê duyệt"], ["reminder", "Reminder", "Nhắc nhở"]] as const) {
      expect(notificationTypeLabel(type, "en")).toBe(en);
      expect(notificationTypeLabel(type, "vi")).toBe(viText);
    }
    for (const language of ["en", "vi"] as const) {
      expect(notificationDate(null, language)).toBe("—");
      expect(notificationDate("invalid", language)).toBe("—");
      const formatted = notificationDate("2026-10-28T07:08:09+07:00", language);
      expect(formatted).toContain("00:08:09");
      expect(formatted).toMatch(/ UTC$/);
      expect(formatted).toContain("28/10/2026");
    }
  });
  it("provides localized notification errors and delegates session/network fallback", async () => {
    const { notificationsErrorMessage } = await import("./notifications");
    const { ApiError, errorMessage } = await import("./api");
    for (const code of ["notification.notFound", "notifications.invalidResponse", "notifications.requestPending"]) {
      const error = new ApiError(409, code);
      const en = notificationsErrorMessage(error, "en");
      const viText = notificationsErrorMessage(error, "vi");
      expect(en).not.toContain(code); expect(viText).not.toContain(code); expect(en).not.toBe(viText);
    }
    for (const error of [new TypeError("network"), new ApiError(401, "auth.sessionChanged"), new ApiError(403, "auth.accountSuspended"), new ApiError(400, "validation.failed")]) {
      for (const language of ["en", "vi"] as const) expect(notificationsErrorMessage(error, language)).toBe(errorMessage(error, language));
    }
  });
});
