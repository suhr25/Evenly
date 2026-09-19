import { describe, expect, it } from "vitest";
import {
  computeUtilizationPercent,
  computePortfolioSummary,
  deriveBestUsedFor,
  type SerializedCategoryRule,
  type SerializedUserCard,
} from "@/lib/data/cards";

function rule(overrides: Partial<SerializedCategoryRule>): SerializedCategoryRule {
  return {
    id: "rule-1",
    categoryId: null,
    categoryName: null,
    channel: "ANY",
    multiplier: "1.00",
    capAmount: null,
    capPeriod: null,
    notes: null,
    ...overrides,
  };
}

describe("computeUtilizationPercent", () => {
  it("returns null when no credit limit is on file", () => {
    expect(computeUtilizationPercent(null, "10000")).toBeNull();
  });

  it("returns null when credit limit is zero", () => {
    expect(computeUtilizationPercent("0", "10000")).toBeNull();
  });

  it("treats a missing outstanding as zero", () => {
    expect(computeUtilizationPercent("100000", null)).toBe(0);
  });

  it("computes the exact percentage from the spec's own example (HDFC Regalia Gold)", () => {
    // 42,300 / 2,00,000 = 21.15%
    expect(computeUtilizationPercent("200000", "42300")).toBe(21.15);
  });

  it("computes the exact percentage from the spec's own example (Axis Atlas)", () => {
    // 50,000 / 3,00,000 = 16.666...% -> rounded to 2dp
    expect(computeUtilizationPercent("300000", "50000")).toBe(16.67);
  });

  it("can exceed 100% when outstanding exceeds the limit", () => {
    expect(computeUtilizationPercent("100000", "160000")).toBe(160);
  });
});

describe("computePortfolioSummary", () => {
  function card(creditLimit: string | null, outstanding: string | null): SerializedUserCard {
    return {
      id: "c",
      nickname: null,
      lastFourDigits: null,
      creditLimit,
      outstanding,
      availableCredit: null,
      utilizationPercent: null,
      rewardBalance: null,
      statementDate: null,
      paymentDueDate: null,
      status: "ACTIVE",
      creditLimitSource: "MANUAL",
      outstandingSource: "MANUAL",
      rewardBalanceSource: "MANUAL",
      lastSyncedAt: null,
      createdAt: new Date().toISOString(),
      cardProduct: {} as SerializedUserCard["cardProduct"],
    };
  }

  it("sums limits/outstanding across the whole portfolio from the spec's own example", () => {
    const cards = [
      card("200000.00", "42300.00"), // HDFC Regalia Gold
      card("300000.00", "50000.00"), // Axis Atlas
      card("150000.00", "18000.00"), // SBI Cashback
      card("100000.00", "22000.00"), // Amex MRCC
    ];
    const summary = computePortfolioSummary(cards);
    expect(summary.totalCreditLimit).toBe("750000");
    expect(summary.totalOutstanding).toBe("132300");
    expect(summary.overallUtilizationPercent).toBeCloseTo(17.64, 2);
  });

  it("handles an empty portfolio without dividing by zero", () => {
    const summary = computePortfolioSummary([]);
    expect(summary.totalCreditLimit).toBe("0");
    expect(summary.overallUtilizationPercent).toBeNull();
  });
});

describe("deriveBestUsedFor", () => {
  it("returns nothing for a flat-rate card with no accelerated category (HDFC Regalia Gold)", () => {
    expect(deriveBestUsedFor([])).toEqual([]);
  });

  it("excludes base-rate (multiplier <= 1) and excluded (multiplier 0) rules", () => {
    const rules = [
      rule({ categoryName: "Fuel", multiplier: "0.00" }),
      rule({ categoryName: "Groceries", channel: "OFFLINE", multiplier: "1.00" }),
    ];
    expect(deriveBestUsedFor(rules)).toEqual([]);
  });

  it("labels a category-only accelerator without a channel suffix (Axis Atlas travel)", () => {
    const rules = [rule({ categoryName: "Travel", channel: "ANY", multiplier: "2.50" })];
    expect(deriveBestUsedFor(rules)).toEqual(["Travel"]);
  });

  it("labels a channel-only accelerator with its channel (SBI Cashback online)", () => {
    const rules = [rule({ categoryName: null, channel: "ONLINE", multiplier: "5.00" })];
    expect(deriveBestUsedFor(rules)).toEqual(["General spend (online)"]);
  });

  it("sorts multiple accelerators by strength, strongest first", () => {
    const rules = [
      rule({ categoryName: "Dining", channel: "ANY", multiplier: "2.00" }),
      rule({ categoryName: null, channel: "ONLINE", multiplier: "5.00" }),
      rule({ categoryName: "Travel", channel: "ANY", multiplier: "3.00" }),
    ];
    expect(deriveBestUsedFor(rules)).toEqual([
      "General spend (online)",
      "Travel",
      "Dining",
    ]);
  });
});
