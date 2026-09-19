import { describe, expect, it } from "vitest";
import { simplifyDebts, type MemberBalanceInput } from "@/lib/settlement";
import { addMoney, toMoney } from "@/lib/money";

function balances(input: Record<string, string>): MemberBalanceInput[] {
  return Object.entries(input).map(([memberId, netBalance]) => ({ memberId, netBalance }));
}

/** Every debtor's total outgoing equals their debt, every creditor's total
 * incoming equals their credit, and money is neither created nor destroyed. */
function assertConservesMoney(input: MemberBalanceInput[], transactions: ReturnType<typeof simplifyDebts>) {
  const sentBy = new Map<string, string>();
  const receivedBy = new Map<string, string>();

  for (const t of transactions) {
    sentBy.set(t.fromMemberId, addMoney(sentBy.get(t.fromMemberId) ?? "0", t.amount).toString());
    receivedBy.set(t.toMemberId, addMoney(receivedBy.get(t.toMemberId) ?? "0", t.amount).toString());
  }

  for (const b of input) {
    const net = toMoney(b.netBalance);
    if (net.greaterThan(0)) {
      expect(receivedBy.get(b.memberId) ?? "0").toBe(net.toString());
    } else if (net.lessThan(0)) {
      expect(sentBy.get(b.memberId) ?? "0").toBe(net.abs().toString());
    } else {
      expect(sentBy.has(b.memberId)).toBe(false);
      expect(receivedBy.has(b.memberId)).toBe(false);
    }
  }
}

describe("simplifyDebts", () => {
  it("returns no transactions for an empty group", () => {
    expect(simplifyDebts([])).toEqual([]);
  });

  it("returns no transactions when everyone is already settled", () => {
    const input = balances({ a: "0", b: "0.00", c: "0" });
    expect(simplifyDebts(input)).toEqual([]);
  });

  it("settles a simple pair in one transaction", () => {
    const input = balances({ a: "100.00", b: "-100.00" });
    const result = simplifyDebts(input);
    expect(result).toEqual([{ fromMemberId: "b", toMemberId: "a", amount: "100" }]);
    assertConservesMoney(input, result);
  });

  it("ignores a member who is exactly settled among others who aren't", () => {
    const input = balances({ a: "-200.00", b: "0.00", c: "200.00" });
    const result = simplifyDebts(input);
    expect(result).toEqual([{ fromMemberId: "a", toMemberId: "c", amount: "200" }]);
  });

  it("matches the spec's worked example (A owes B 500, B owes C 500, C owes A 300)", () => {
    // Net balances derived from those three debts: A = -500 + 300 = -200,
    // B = +500 - 500 = 0, C = +500 - 300 = 200.
    const input = balances({ A: "-200.00", B: "0.00", C: "200.00" });
    const result = simplifyDebts(input);
    expect(result).toEqual([{ fromMemberId: "A", toMemberId: "C", amount: "200" }]);
  });

  it("produces at most n-1 transactions for a multi-way group", () => {
    // 4 people with non-zero balances that don't pair off 1:1.
    const input = balances({ a: "300.00", b: "150.00", c: "-200.00", d: "-250.00" });
    const result = simplifyDebts(input);
    expect(result.length).toBeLessThanOrEqual(3);
    assertConservesMoney(input, result);
  });

  it("handles multiple creditors and debtors requiring several transactions", () => {
    const input = balances({
      alice: "500.00",
      bob: "300.00",
      carol: "-400.00",
      dave: "-250.00",
      erin: "-150.00",
    });
    const result = simplifyDebts(input);
    assertConservesMoney(input, result);
    // No self-payments, no zero/negative amounts.
    for (const t of result) {
      expect(t.fromMemberId).not.toBe(t.toMemberId);
      expect(Number(t.amount)).toBeGreaterThan(0);
    }
  });

  it("handles rounding-prone thirds (33.33 / 33.33 / -66.66-style splits)", () => {
    const input = balances({ a: "33.34", b: "33.33", c: "-66.67" });
    const result = simplifyDebts(input);
    assertConservesMoney(input, result);
  });

  it("is deterministic across repeated runs with the same input", () => {
    const input = balances({ zed: "150.00", amy: "150.00", bob: "-100.00", cid: "-200.00" });
    const first = simplifyDebts(input);
    const second = simplifyDebts(structuredClone(input));
    expect(second).toEqual(first);
  });

  it("breaks ties deterministically by memberId when amounts are equal", () => {
    const input = balances({ zed: "100.00", amy: "100.00", bob: "-100.00", cid: "-100.00" });
    const result = simplifyDebts(input);
    // Largest-amount ties resolved alphabetically: amy before zed, bob before cid.
    expect(result).toEqual([
      { fromMemberId: "bob", toMemberId: "amy", amount: "100" },
      { fromMemberId: "cid", toMemberId: "zed", amount: "100" },
    ]);
  });

  it("never emits a zero-amount transaction", () => {
    const input = balances({ a: "0.01", b: "-0.01", c: "0.00" });
    const result = simplifyDebts(input);
    for (const t of result) {
      expect(Number(t.amount)).toBeGreaterThan(0);
    }
  });

  it("settles a large group (10 members) with balanced money conservation", () => {
    const input = balances({
      m1: "1250.75",
      m2: "800.00",
      m3: "430.25",
      m4: "-300.00",
      m5: "-450.50",
      m6: "-125.00",
      m7: "-600.00",
      m8: "-275.25",
      m9: "-430.25",
      m10: "-300.00",
    });
    const result = simplifyDebts(input);
    expect(result.length).toBeLessThanOrEqual(9);
    assertConservesMoney(input, result);
  });
});
