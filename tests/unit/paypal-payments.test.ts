import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// In-memory Prisma fake (only the surface the PayPal service uses)
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

const OPEN = ["INITIATED", "ORDER_CREATED", "CAPTURE_PENDING", "CAPTURED"];

const db = vi.hoisted(() => ({
  payments: [] as Row[],
  settlements: [] as Row[],
  failSettlementCreate: false,
  seq: 0,
}));

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (v && typeof v === "object" && "in" in (v as Row)) return ((v as Row).in as unknown[]).includes(row[k]);
    return row[k] === v;
  });
}

function dec(v: unknown) {
  return { toString: () => String(v) };
}

function materialize(row: Row | undefined) {
  if (!row) return null;
  return {
    ...row,
    originalAmount: dec(row.originalAmount),
    chargeAmount: dec(row.chargeAmount),
    exchangeRate: dec(row.exchangeRate),
  };
}

const fakePrisma = vi.hoisted(() => {
  const p: Record<string, unknown> = {};
  return p;
});

vi.mock("@/lib/prisma", () => {
  const payPalPayment = {
    create: async ({ data }: { data: Row }) => {
      const open = db.payments.find(
        (r) =>
          OPEN.includes(r.status as string) &&
          r.groupId === data.groupId &&
          r.fromMemberId === data.fromMemberId &&
          r.toMemberId === data.toMemberId
      );
      if (open) throw Object.assign(new Error("unique"), { code: "P2002" });
      const row: Row = {
        id: `pay_${++db.seq}`,
        status: "INITIATED",
        paypalOrderId: null,
        paypalCaptureId: null,
        captureStatus: null,
        failureReason: null,
        settlementId: null,
        capturedAt: null,
        createdAt: new Date(),
        ...data,
      };
      db.payments.push(row);
      return materialize(row);
    },
    findFirst: async ({ where }: { where: Row }) => materialize(db.payments.find((r) => matches(r, where))),
    findUnique: async ({ where }: { where: Row }) => materialize(db.payments.find((r) => matches(r, where))),
    updateMany: async ({ where, data }: { where: Row; data: Row }) => {
      const hits = db.payments.filter((r) => matches(r, where));
      hits.forEach((r) => Object.assign(r, data));
      return { count: hits.length };
    },
    update: async ({ where, data }: { where: Row; data: Row }) => {
      const row = db.payments.find((r) => matches(r, where))!;
      Object.assign(row, data);
      return materialize(row);
    },
  };
  const tx = {
    payPalPayment,
    settlement: {
      create: async ({ data }: { data: Row }) => {
        if (db.failSettlementCreate) throw new Error("db down");
        const row = { id: `set_${db.settlements.length + 1}`, ...data };
        db.settlements.push(row);
        return row;
      },
    },
  };
  const prisma = {
    ...tx,
    user: { findUnique: async () => ({ currency: "INR" }) },
    groupMember: { findFirst: async ({ where }: { where: Row }) => (where.id ? { id: where.id } : null) },
    $transaction: async (cb: (t: typeof tx) => Promise<unknown>) => {
      const snapshot = JSON.stringify(db.payments);
      const settlementCount = db.settlements.length;
      try {
        return await cb(tx);
      } catch (err) {
        db.payments = JSON.parse(snapshot, (k, v) => (k === "createdAt" && v ? new Date(v) : v));
        db.settlements.length = settlementCount;
        throw err;
      }
    },
  };
  Object.assign(fakePrisma, prisma);
  return { prisma };
});

// ---------------------------------------------------------------------------
// Group data mocks
// ---------------------------------------------------------------------------

const groups = vi.hoisted(() => ({
  isMember: true,
  /** Successive balance snapshots; the last one repeats. Amounts in INR. */
  owed: ["830.00"] as string[],
  calls: 0,
}));

vi.mock("@/lib/data/groups", () => ({
  requireGroupMembership: vi.fn(async (userId: string) => {
    if (!groups.isMember) {
      const { ApiError } = await import("@/lib/api-response");
      throw new ApiError(404, "Group not found.");
    }
    return { id: userId === "user_a" ? "mem_a" : "mem_other" };
  }),
  computeGroupBalances: vi.fn(async () => {
    const owed = groups.owed[Math.min(groups.calls++, groups.owed.length - 1)];
    return [
      { memberId: "mem_a", netBalance: `-${owed}` },
      { memberId: "mem_b", netBalance: owed },
    ];
  }),
  syncSettlementToIncome: vi.fn(async () => {}),
}));

// ---------------------------------------------------------------------------
// Fake PayPal
// ---------------------------------------------------------------------------

interface FakeOrder {
  id: string;
  status: string;
  paymentId: string;
  amount: string;
  currency: string;
  merchant: string;
  captureStatus: string;
}

const paypal = vi.hoisted(() => ({
  orders: new Map<string, FakeOrder>(),
  requestIds: new Map<string, string>(),
  createCalls: 0,
  captureCalls: 0,
  /** Behaviour knobs */
  captureStatus: "COMPLETED",
  captureAmountOverride: null as string | null,
  declineWith: null as string | null,
  merchantOverride: null as string | null,
}));

function orderJson(o: FakeOrder, amountOverride?: string | null) {
  const captured = o.status === "COMPLETED";
  return {
    id: o.id,
    status: o.status,
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: o.paymentId,
        custom_id: o.paymentId,
        amount: { currency_code: o.currency, value: o.amount },
        payee: { merchant_id: paypal.merchantOverride ?? o.merchant },
        payments: captured
          ? {
              captures: [
                {
                  id: `CAP-${o.id}`,
                  status: o.captureStatus,
                  custom_id: o.paymentId,
                  amount: { currency_code: o.currency, value: amountOverride ?? o.amount },
                },
              ],
            }
          : undefined,
      },
    ],
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const fakeFetch = vi.fn(async (url: string, init?: RequestInit) => {
  const u = new URL(url);
  const headers = (init?.headers ?? {}) as Record<string, string>;
  if (u.pathname === "/v1/oauth2/token") return json({ access_token: "tok", expires_in: 3600 });

  if (u.pathname === "/v2/checkout/orders" && init?.method === "POST") {
    paypal.createCalls++;
    const reqId = headers["PayPal-Request-Id"];
    const existing = paypal.requestIds.get(reqId);
    if (existing) return json(orderJson(paypal.orders.get(existing)!), 200);
    const body = JSON.parse(init.body as string);
    const unit = body.purchase_units[0];
    const order: FakeOrder = {
      id: `ORDER${paypal.orders.size + 1}`,
      status: "CREATED",
      paymentId: unit.reference_id,
      amount: unit.amount.value,
      currency: unit.amount.currency_code,
      merchant: unit.payee.merchant_id,
      captureStatus: paypal.captureStatus,
    };
    paypal.orders.set(order.id, order);
    paypal.requestIds.set(reqId, order.id);
    return json(orderJson(order), 201);
  }

  const capture = u.pathname.match(/^\/v2\/checkout\/orders\/([^/]+)\/capture$/);
  if (capture) {
    paypal.captureCalls++;
    const order = paypal.orders.get(capture[1])!;
    if (paypal.declineWith) return json({ name: "UNPROCESSABLE_ENTITY", details: [{ issue: paypal.declineWith }] }, 422);
    if (order.status === "COMPLETED") return json({ name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_ALREADY_CAPTURED" }] }, 422);
    order.status = "COMPLETED";
    order.captureStatus = paypal.captureStatus;
    return json(orderJson(order, paypal.captureAmountOverride), 201);
  }

  const get = u.pathname.match(/^\/v2\/checkout\/orders\/([^/]+)$/);
  if (get) return json(orderJson(paypal.orders.get(get[1])!, paypal.captureAmountOverride));

  return json({ name: "NOT_FOUND" }, 404);
});

/** Simulates the buyer approving the order in the PayPal popup. */
function approve(orderId: string) {
  paypal.orders.get(orderId)!.status = "APPROVED";
}

// ---------------------------------------------------------------------------

import { ApiError } from "@/lib/api-response";
import { resetPayPalTokenCache } from "@/lib/paypal/client";
import { getPayPalConfig, quoteCharge } from "@/lib/paypal/config";
import { capturePayPalPayment, createPayPalPayment } from "@/lib/paypal/payments";
import { syncSettlementToIncome } from "@/lib/data/groups";

const GROUP = "grp_1";
const create = (userId = "user_a") => createPayPalPayment({ userId, groupId: GROUP, toMemberId: "mem_b" });
const capture = (orderId: string, userId = "user_a") => capturePayPalPayment({ userId, groupId: GROUP, orderId });

async function expectApiError(p: Promise<unknown>, status: number) {
  await expect(p).rejects.toMatchObject({ status });
  await p.catch((e) => expect(e).toBeInstanceOf(ApiError));
}

beforeEach(() => {
  db.payments = [];
  db.settlements = [];
  db.failSettlementCreate = false;
  db.seq = 0;
  groups.isMember = true;
  groups.owed = ["830.00"];
  groups.calls = 0;
  paypal.orders.clear();
  paypal.requestIds.clear();
  paypal.createCalls = 0;
  paypal.captureCalls = 0;
  paypal.captureStatus = "COMPLETED";
  paypal.captureAmountOverride = null;
  paypal.declineWith = null;
  paypal.merchantOverride = null;
  fakeFetch.mockClear();
  vi.mocked(syncSettlementToIncome).mockClear();
  resetPayPalTokenCache();
  vi.stubGlobal("fetch", fakeFetch);
  process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID = "client-id";
  process.env.PAYPAL_CLIENT_SECRET = "secret-value";
  process.env.PAYPAL_MERCHANT_ID = "MERCHANT123";
  process.env.PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com";
  process.env.PAYPAL_CHARGE_CURRENCY = "USD";
  process.env.PAYPAL_DEMO_EXCHANGE_RATE = "83";
});

describe("currency handling", () => {
  it("converts with the configured rate using decimal math and keeps both amounts", () => {
    const q = quoteCharge("830.00", "INR", { chargeCurrency: "USD", exchangeRate: getPayPalConfig().exchangeRate });
    expect(q).toMatchObject({
      originalAmount: "830.00",
      originalCurrency: "INR",
      chargeAmount: "10.00",
      chargeCurrency: "USD",
      exchangeRate: "83",
      converted: true,
    });
    // 100.10 / 83 = 1.20602... rounds half-up to 1.21
    expect(quoteCharge("100.10", "INR", { chargeCurrency: "USD", exchangeRate: getPayPalConfig().exchangeRate }).chargeAmount).toBe("1.21");
  });

  it("never relabels INR as USD: no rate means no PayPal", () => {
    expect(() => quoteCharge("100.00", "INR", { chargeCurrency: "USD", exchangeRate: null })).toThrow(/cannot charge in INR/);
  });

  it("passes through unchanged when the group currency is already the charge currency", () => {
    const q = quoteCharge("12.50", "USD", { chargeCurrency: "USD", exchangeRate: null });
    expect(q).toMatchObject({ chargeAmount: "12.50", exchangeRate: "1", converted: false });
  });

  it("rejects non-sandbox base URLs and bad rates", () => {
    expect(() => getPayPalConfig({ ...process.env, PAYPAL_BASE_URL: "https://api-m.paypal.com" })).toThrow(/Sandbox/);
    expect(() => getPayPalConfig({ ...process.env, PAYPAL_DEMO_EXCHANGE_RATE: "-1" })).toThrow(/positive/);
    expect(() => getPayPalConfig({ ...process.env, PAYPAL_DEMO_EXCHANGE_RATE: "abc" })).toThrow(/positive/);
    expect(() => getPayPalConfig({ ...process.env, PAYPAL_MERCHANT_ID: "" })).toThrow(/not configured/);
  });
});

describe("create order", () => {
  it("derives amount and payer on the server and stores both currencies", async () => {
    const p = await create();
    expect(p).toMatchObject({
      status: "ORDER_CREATED",
      originalAmount: "830.00",
      originalCurrency: "INR",
      chargeAmount: "10.00",
      chargeCurrency: "USD",
      exchangeRate: "83",
    });
    expect(db.payments[0]).toMatchObject({ payerUserId: "user_a", fromMemberId: "mem_a", merchantId: "MERCHANT123" });
    const order = paypal.orders.get(p.orderId!)!;
    expect(order).toMatchObject({ amount: "10.00", currency: "USD", merchant: "MERCHANT123" });
  });

  it("rejects non-members", async () => {
    groups.isMember = false;
    await expectApiError(create(), 404);
    expect(paypal.createCalls).toBe(0);
  });

  it("rejects paying a member you do not owe", async () => {
    await expectApiError(createPayPalPayment({ userId: "user_a", groupId: GROUP, toMemberId: "mem_zzz" }), 409);
  });

  it("collapses double clicks into one attempt and one PayPal order", async () => {
    const [a, b] = await Promise.all([create(), create()]);
    expect(a.paymentId).toBe(b.paymentId);
    expect(a.orderId).toBe(b.orderId);
    expect(db.payments).toHaveLength(1);
    expect(paypal.orders.size).toBe(1);
  });

  it("replaces an unapproved attempt whose amount went stale", async () => {
    const first = await create();
    groups.owed = ["500.00"];
    groups.calls = 0;
    const second = await create();
    expect(second.paymentId).not.toBe(first.paymentId);
    expect(second.originalAmount).toBe("500.00");
    expect(db.payments.find((r) => r.id === first.paymentId)!.status).toBe("CANCELLED");
  });
});

describe("capture", () => {
  it("rejects another user's order", async () => {
    const p = await create();
    approve(p.orderId!);
    await expectApiError(capture(p.orderId!, "user_other"), 404);
    expect(paypal.captureCalls).toBe(0);
  });

  it("rejects non-members", async () => {
    const p = await create();
    groups.isMember = false;
    await expectApiError(capture(p.orderId!), 404);
  });

  it("does not capture an order the buyer has not approved", async () => {
    const p = await create();
    await expectApiError(capture(p.orderId!), 409);
    expect(paypal.captureCalls).toBe(0);
    expect(db.settlements).toHaveLength(0);
  });

  it("records exactly one settlement after a verified capture, and is idempotent on retry", async () => {
    const p = await create();
    approve(p.orderId!);
    const r1 = await capture(p.orderId!);
    expect(r1.status).toBe("COMPLETED");
    expect(db.settlements).toHaveLength(1);
    expect(db.settlements[0]).toMatchObject({
      groupId: GROUP,
      fromMemberId: "mem_a",
      toMemberId: "mem_b",
      amount: expect.anything(),
      createdByUserId: "user_a",
    });
    expect(String(db.settlements[0].amount)).toBe("830.00");
    expect(syncSettlementToIncome).toHaveBeenCalledWith("set_1");

    const r2 = await capture(p.orderId!);
    expect(r2.status).toBe("COMPLETED");
    expect(db.settlements).toHaveLength(1);
    expect(paypal.captureCalls).toBe(1);
    expect(db.payments[0]).toMatchObject({ status: "COMPLETED", paypalCaptureId: `CAP-${p.orderId}`, settlementId: "set_1" });
  });

  it("handles concurrent capture requests without a duplicate settlement", async () => {
    const p = await create();
    approve(p.orderId!);
    const results = await Promise.all([capture(p.orderId!), capture(p.orderId!)].map((x) => x.catch((e) => e)));
    expect(db.settlements).toHaveLength(1);
    expect(results.some((r) => r.status === "COMPLETED")).toBe(true);
  });

  it("refuses to record when PayPal reports a different captured amount", async () => {
    const p = await create();
    approve(p.orderId!);
    paypal.captureAmountOverride = "1.00";
    await expectApiError(capture(p.orderId!), 409);
    expect(db.settlements).toHaveLength(0);
    expect(db.payments[0].status).toBe("NEEDS_REVIEW");
  });

  it("refuses an order paid to a different merchant before capturing", async () => {
    const p = await create();
    approve(p.orderId!);
    paypal.merchantOverride = "SOMEONE_ELSE";
    await expectApiError(capture(p.orderId!), 409);
    expect(paypal.captureCalls).toBe(0);
    expect(db.settlements).toHaveLength(0);
    expect(db.payments[0].status).toBe("FAILED");
  });

  it("records nothing while the capture is pending, then completes on a later check", async () => {
    paypal.captureStatus = "PENDING";
    const p = await create();
    approve(p.orderId!);
    const r1 = await capture(p.orderId!);
    expect(r1.status).toBe("CAPTURE_PENDING");
    expect(db.settlements).toHaveLength(0);
    expect(db.payments[0].status).toBe("CAPTURE_PENDING");

    // A new create must not open a second order while the first is pending.
    const again = await create();
    expect(again.paymentId).toBe(p.paymentId);
    expect(paypal.orders.size).toBe(1);

    paypal.orders.get(p.orderId!)!.captureStatus = "COMPLETED";
    const r2 = await capture(p.orderId!);
    expect(r2.status).toBe("COMPLETED");
    expect(db.settlements).toHaveLength(1);
    expect(paypal.captureCalls).toBe(1);
  });

  it("marks declined captures as failed without a settlement", async () => {
    const p = await create();
    approve(p.orderId!);
    paypal.declineWith = "INSTRUMENT_DECLINED";
    await expectApiError(capture(p.orderId!), 409);
    expect(db.settlements).toHaveLength(0);
    expect(db.payments[0].status).toBe("FAILED");
    // A failed attempt no longer blocks a fresh one.
    paypal.declineWith = null;
    const next = await create();
    expect(next.paymentId).not.toBe(p.paymentId);
  });

  it("recovers after a database failure without charging again", async () => {
    const p = await create();
    approve(p.orderId!);

    db.failSettlementCreate = true;
    await expect(capture(p.orderId!)).rejects.toThrow("db down");
    expect(db.settlements).toHaveLength(0);
    expect(db.payments[0]).toMatchObject({ status: "CAPTURED", paypalCaptureId: `CAP-${p.orderId}` });
    expect(paypal.captureCalls).toBe(1);

    db.failSettlementCreate = false;
    const retry = await capture(p.orderId!);
    expect(retry.status).toBe("COMPLETED");
    expect(db.settlements).toHaveLength(1);
    expect(paypal.captureCalls).toBe(1); // reconciled from our own record, no second capture call
  });

  it("recovers when PayPal captured but our status write never happened", async () => {
    const p = await create();
    approve(p.orderId!);
    // Simulate: PayPal completed the capture, then the process died before any DB write.
    paypal.orders.get(p.orderId!)!.status = "COMPLETED";
    const r = await capture(p.orderId!);
    expect(r.status).toBe("COMPLETED");
    expect(paypal.captureCalls).toBe(0);
    expect(db.settlements).toHaveLength(1);
  });

  it("does not charge when balances changed before capture", async () => {
    const p = await create();
    approve(p.orderId!);
    groups.owed = ["400.00"];
    groups.calls = 0;
    await expectApiError(capture(p.orderId!), 409);
    expect(paypal.captureCalls).toBe(0);
    expect(db.settlements).toHaveLength(0);
    expect(db.payments[0].status).toBe("CANCELLED");
  });

  it("flags for review, not a wrong settlement, when balances change after capture", async () => {
    const p = await create(); // balances call #1
    approve(p.orderId!);
    groups.calls = 0;
    groups.owed = ["830.00", "400.00"]; // pre-capture check passes (#1), finalize check sees change (#2)
    await expectApiError(capture(p.orderId!), 409);
    expect(paypal.captureCalls).toBe(1);
    expect(db.settlements).toHaveLength(0);
    expect(db.payments[0].status).toBe("NEEDS_REVIEW");
    expect(String(db.payments[0].failureReason)).toContain("refund");
  });

  it("never logs or returns credentials", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const p = await create();
    approve(p.orderId!);
    paypal.declineWith = "INSTRUMENT_DECLINED";
    await capture(p.orderId!).catch(() => {});
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).not.toContain("secret-value");
    expect(logged).not.toContain("tok");
    spy.mockRestore();
  });
});
