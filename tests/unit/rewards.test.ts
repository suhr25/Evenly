import { describe, expect, it } from "vitest";
import {
  applyCap,
  computeRawReward,
  estimateReward,
  findMatchingRule,
  rankCardCandidates,
  type CardCandidate,
  type CardRewardProfile,
  type RewardRuleInput,
} from "@/lib/rewards";

function rule(overrides: Partial<RewardRuleInput> = {}): RewardRuleInput {
  return {
    id: "rule-1",
    categoryId: null,
    channel: "ANY",
    multiplier: "1.00",
    capAmount: null,
    capPeriod: null,
    ...overrides,
  };
}

describe("findMatchingRule", () => {
  it("returns null when no rule matches the category or channel", () => {
    const rules = [rule({ categoryId: "travel", channel: "ANY" })];
    expect(findMatchingRule(rules, "dining", "OFFLINE")).toBeNull();
  });

  it("matches a channel-only rule (null category) regardless of transaction category", () => {
    const online = rule({ id: "online", categoryId: null, channel: "ONLINE", multiplier: "5.00" });
    expect(findMatchingRule([online], "dining", "ONLINE")).toEqual(online);
    expect(findMatchingRule([online], "fuel", "ONLINE")).toEqual(online);
  });

  it("does not match a channel-only rule against the wrong channel", () => {
    const online = rule({ id: "online", categoryId: null, channel: "ONLINE", multiplier: "5.00" });
    expect(findMatchingRule([online], "dining", "OFFLINE")).toBeNull();
  });

  it("matches a category rule with channel ANY regardless of transaction channel (Axis Atlas travel)", () => {
    const travel = rule({ id: "travel", categoryId: "travel", channel: "ANY", multiplier: "2.50" });
    expect(findMatchingRule([travel], "travel", "ONLINE")).toEqual(travel);
    expect(findMatchingRule([travel], "travel", "OFFLINE")).toEqual(travel);
  });

  it("picks the higher multiplier when both a category rule and a channel rule match", () => {
    const category = rule({ id: "cat", categoryId: "dining", channel: "ANY", multiplier: "2.00" });
    const channel = rule({ id: "chan", categoryId: null, channel: "ONLINE", multiplier: "5.00" });
    expect(findMatchingRule([category, channel], "dining", "ONLINE")).toEqual(channel);
  });

  it("breaks a multiplier tie in favor of the more specific (category-bound) rule", () => {
    const category = rule({ id: "cat", categoryId: "dining", channel: "ANY", multiplier: "5.00" });
    const channel = rule({ id: "chan", categoryId: null, channel: "ONLINE", multiplier: "5.00" });
    expect(findMatchingRule([category, channel], "dining", "ONLINE")).toEqual(category);
  });

  it("matches a zero-multiplier exclusion rule (Amex MRCC fuel)", () => {
    const excluded = rule({ id: "fuel-excl", categoryId: "fuel", channel: "ANY", multiplier: "0.00" });
    expect(findMatchingRule([excluded], "fuel", "OFFLINE")).toEqual(excluded);
  });
});

describe("computeRawReward", () => {
  it("computes the base rate with no matching rule (flat-rate card, e.g. HDFC Regalia Gold)", () => {
    const profile: CardRewardProfile = {
      baseRewardRateOnCurrency: "2.667",
      rewardCurrencyUnitValueInr: "0.50",
      categoryRules: [],
    };
    const raw = computeRawReward(profile, { amount: "15000", categoryId: "travel", channel: "OFFLINE" });
    // 15000/100 * 2.667 = 400.05 points; * Rs0.50 = Rs 200.025
    expect(raw.multiplier).toBe(1);
    expect(raw.rewardUnits).toBeCloseTo(400.05, 2);
    expect(raw.rewardValueInr).toBeCloseTo(200.025, 2);
  });

  it("applies a category accelerator (Axis Atlas travel, from the app's own worked example)", () => {
    const profile: CardRewardProfile = {
      baseRewardRateOnCurrency: "2.000",
      rewardCurrencyUnitValueInr: "1.00",
      categoryRules: [rule({ id: "travel", categoryId: "travel", channel: "ANY", multiplier: "2.50" })],
    };
    const raw = computeRawReward(profile, { amount: "20000", categoryId: "travel", channel: "OFFLINE" });
    // 20000/100 * 2 * 2.5 = 1000 miles; * Rs1 = Rs 1000
    expect(raw.multiplier).toBe(2.5);
    expect(raw.rewardUnits).toBe(1000);
    expect(raw.rewardValueInr).toBe(1000);
  });

  it("earns nothing on an excluded category (Amex MRCC fuel)", () => {
    const profile: CardRewardProfile = {
      baseRewardRateOnCurrency: "2.000",
      rewardCurrencyUnitValueInr: "0.30",
      categoryRules: [rule({ id: "fuel-excl", categoryId: "fuel", channel: "ANY", multiplier: "0.00" })],
    };
    const raw = computeRawReward(profile, { amount: "3000", categoryId: "fuel", channel: "OFFLINE" });
    expect(raw.rewardValueInr).toBe(0);
  });

  it("returns zero when the card's base rate or currency value is unconfirmed, without throwing", () => {
    const profile: CardRewardProfile = {
      baseRewardRateOnCurrency: null,
      rewardCurrencyUnitValueInr: "1.00",
      categoryRules: [],
    };
    const raw = computeRawReward(profile, { amount: "1000", categoryId: null, channel: "OFFLINE" });
    expect(raw.rewardValueInr).toBe(0);
  });
});

describe("applyCap", () => {
  it("passes through uncapped when the matched rule has no cap", () => {
    const raw = { rule: rule({ capAmount: null }), multiplier: 1, rewardUnits: 100, rewardValueInr: 500 };
    const capped = applyCap(raw, 0);
    expect(capped.cappedValueInr).toBe(500);
    expect(capped.capApplied).toBe(false);
    expect(capped.capRemainingBeforeInr).toBeNull();
  });

  it("passes through uncapped when there was no matching rule at all", () => {
    const raw = { rule: null, multiplier: 1, rewardUnits: 100, rewardValueInr: 500 };
    const capped = applyCap(raw, 999999);
    expect(capped.cappedValueInr).toBe(500);
    expect(capped.capApplied).toBe(false);
  });

  it("leaves the value untouched when well under the cap (SBI Cashback, cap not reached)", () => {
    const r = rule({ capAmount: "2000.00", capPeriod: "MONTHLY" });
    const raw = { rule: r, multiplier: 5, rewardUnits: 100, rewardValueInr: 100 };
    const capped = applyCap(raw, 500);
    expect(capped.cappedValueInr).toBe(100);
    expect(capped.capApplied).toBe(false);
    expect(capped.capRemainingBeforeInr).toBe(1500);
  });

  it("truncates the value when it would cross the cap boundary", () => {
    const r = rule({ capAmount: "2000.00", capPeriod: "MONTHLY" });
    const raw = { rule: r, multiplier: 5, rewardUnits: 300, rewardValueInr: 300 };
    const capped = applyCap(raw, 1900);
    expect(capped.cappedValueInr).toBe(100); // only 100 of headroom left
    expect(capped.capApplied).toBe(true);
    expect(capped.capRemainingBeforeInr).toBe(100);
  });

  it("returns zero when the cap has already been fully used", () => {
    const r = rule({ capAmount: "2000.00", capPeriod: "MONTHLY" });
    const raw = { rule: r, multiplier: 5, rewardUnits: 300, rewardValueInr: 300 };
    const capped = applyCap(raw, 2000);
    expect(capped.cappedValueInr).toBe(0);
    expect(capped.capApplied).toBe(true);
    expect(capped.capRemainingBeforeInr).toBe(0);
  });
});

describe("estimateReward", () => {
  const atlasProfile: CardRewardProfile = {
    baseRewardRateOnCurrency: "2.000",
    rewardCurrencyUnitValueInr: "1.00",
    categoryRules: [rule({ id: "travel", categoryId: "travel", channel: "ANY", multiplier: "2.50" })],
  };

  it("explains an accelerated category with no cap issue (Axis Atlas travel)", () => {
    const est = estimateReward(atlasProfile, { amount: "20000", categoryId: "travel", channel: "OFFLINE" });
    expect(est.cappedValueInr).toBe(1000);
    expect(est.reasons.some((r) => r.includes("2.5x category accelerator"))).toBe(true);
  });

  it("flags an incomplete estimate when the card's rate isn't confirmed", () => {
    const profile: CardRewardProfile = {
      baseRewardRateOnCurrency: null,
      rewardCurrencyUnitValueInr: null,
      categoryRules: [],
    };
    const est = estimateReward(profile, { amount: "5000", categoryId: null, channel: "OFFLINE" });
    expect(est.cappedValueInr).toBe(0);
    expect(est.reasons.some((r) => r.includes("hasn't been confirmed"))).toBe(true);
  });

  it("explains a channel exclusion at zero multiplier", () => {
    const profile: CardRewardProfile = {
      baseRewardRateOnCurrency: "2.000",
      rewardCurrencyUnitValueInr: "0.30",
      categoryRules: [rule({ id: "fuel-excl", categoryId: "fuel", channel: "ANY", multiplier: "0.00" })],
    };
    const est = estimateReward(profile, { amount: "2000", categoryId: "fuel", channel: "OFFLINE" });
    expect(est.cappedValueInr).toBe(0);
    expect(est.reasons.some((r) => r.includes("excluded"))).toBe(true);
  });

  it("explains cap headroom remaining vs. cap already reached (SBI Cashback online)", () => {
    const profile: CardRewardProfile = {
      baseRewardRateOnCurrency: "1.000",
      rewardCurrencyUnitValueInr: "1.00",
      categoryRules: [
        rule({ id: "online", categoryId: null, channel: "ONLINE", multiplier: "5.00", capAmount: "2000.00", capPeriod: "MONTHLY" }),
      ],
    };
    const roomLeft = estimateReward(profile, { amount: "1000", categoryId: null, channel: "ONLINE" }, 0);
    expect(roomLeft.capApplied).toBe(false);
    expect(roomLeft.reasons.some((r) => r.includes("has not been reached yet"))).toBe(true);

    const capHit = estimateReward(profile, { amount: "1000", categoryId: null, channel: "ONLINE" }, 2000);
    expect(capHit.cappedValueInr).toBe(0);
    expect(capHit.capApplied).toBe(true);
    expect(capHit.reasons.some((r) => r.includes("already been reached"))).toBe(true);
  });
});

function candidate(overrides: Partial<CardCandidate> = {}): CardCandidate {
  return {
    userCardId: "card-1",
    cardLabel: "Test Card",
    estimate: {
      rule: null,
      multiplier: 1,
      rewardUnits: 0,
      rewardValueInr: 0,
      cappedValueInr: 0,
      capApplied: false,
      capRemainingBeforeInr: null,
      reasons: [],
    },
    utilizationAfterPercent: null,
    ...overrides,
  };
}

describe("rankCardCandidates", () => {
  it("throws on an empty portfolio rather than silently picking nothing", () => {
    expect(() => rankCardCandidates([])).toThrow();
  });

  it("picks the single candidate when only one card is owned", () => {
    const only = candidate({ userCardId: "only", estimate: { ...candidate().estimate, cappedValueInr: 50 } });
    const result = rankCardCandidates([only]);
    expect(result.best.userCardId).toBe("only");
    expect(result.alternatives).toEqual([]);
  });

  it("ranks by estimated reward value when utilization isn't a concern (the app's own worked example)", () => {
    // Axis Atlas Rs 1,850 vs HDFC Regalia Gold Rs 700 vs SBI Cashback Rs 200
    const atlas = candidate({
      userCardId: "atlas",
      cardLabel: "Axis Atlas",
      estimate: { ...candidate().estimate, cappedValueInr: 1850 },
      utilizationAfterPercent: 20,
    });
    const regalia = candidate({
      userCardId: "regalia",
      cardLabel: "HDFC Regalia Gold",
      estimate: { ...candidate().estimate, cappedValueInr: 700 },
      utilizationAfterPercent: 25,
    });
    const cashback = candidate({
      userCardId: "cashback",
      cardLabel: "SBI Cashback",
      estimate: { ...candidate().estimate, cappedValueInr: 200 },
      utilizationAfterPercent: 15,
    });

    const result = rankCardCandidates([regalia, cashback, atlas]);
    expect(result.best.userCardId).toBe("atlas");
    expect(result.alternatives.map((a) => a.userCardId)).toEqual(["regalia", "cashback"]);
  });

  it("never introduces a candidate that wasn't passed in — the portfolio boundary is the caller's job, not this function's, but it must not fabricate one either", () => {
    const a = candidate({ userCardId: "a", estimate: { ...candidate().estimate, cappedValueInr: 10 } });
    const b = candidate({ userCardId: "b", estimate: { ...candidate().estimate, cappedValueInr: 5 } });
    const result = rankCardCandidates([a, b]);
    const allIds = [result.best.userCardId, ...result.alternatives.map((c) => c.userCardId)];
    expect(new Set(allIds)).toEqual(new Set(["a", "b"]));
  });

  it("overrides the reward-best pick when it would push utilization high and a much safer owned alternative exists (the app's own utilization example)", () => {
    const cardA = candidate({
      userCardId: "card-a",
      cardLabel: "Card A",
      estimate: { ...candidate().estimate, cappedValueInr: 500 },
      utilizationAfterPercent: 95, // Rs 1.6L used of Rs 2L limit, per the app's own example
    });
    const cardB = candidate({
      userCardId: "card-b",
      cardLabel: "Card B",
      estimate: { ...candidate().estimate, cappedValueInr: 380 }, // Rs 120 less in rewards
      utilizationAfterPercent: 26.7,
    });

    const result = rankCardCandidates([cardA, cardB]);
    expect(result.best.userCardId).toBe("card-b");
    expect(result.best.reasons.some((r) => r.includes("From a utilization perspective"))).toBe(true);
    expect(result.best.reasons.some((r) => r.includes("Rs 120"))).toBe(true);
    expect(result.alternatives[0].userCardId).toBe("card-a");
  });

  it("does NOT override when the reward-best card's utilization is already safe", () => {
    const cardA = candidate({
      userCardId: "card-a",
      estimate: { ...candidate().estimate, cappedValueInr: 500 },
      utilizationAfterPercent: 40,
    });
    const cardB = candidate({
      userCardId: "card-b",
      estimate: { ...candidate().estimate, cappedValueInr: 100 },
      utilizationAfterPercent: 10,
    });
    const result = rankCardCandidates([cardA, cardB]);
    expect(result.best.userCardId).toBe("card-a");
  });

  it("does NOT override when no owned alternative is meaningfully safer", () => {
    const cardA = candidate({
      userCardId: "card-a",
      estimate: { ...candidate().estimate, cappedValueInr: 500 },
      utilizationAfterPercent: 90,
    });
    const cardB = candidate({
      userCardId: "card-b",
      estimate: { ...candidate().estimate, cappedValueInr: 100 },
      utilizationAfterPercent: 70, // only 20 points lower — below the required gap
    });
    const result = rankCardCandidates([cardA, cardB]);
    expect(result.best.userCardId).toBe("card-a");
  });

  it("does not treat a card with unknown utilization (no credit limit on file) as either risky or safe", () => {
    const cardA = candidate({
      userCardId: "card-a",
      estimate: { ...candidate().estimate, cappedValueInr: 500 },
      utilizationAfterPercent: null,
    });
    const cardB = candidate({
      userCardId: "card-b",
      estimate: { ...candidate().estimate, cappedValueInr: 100 },
      utilizationAfterPercent: 10,
    });
    const result = rankCardCandidates([cardA, cardB]);
    expect(result.best.userCardId).toBe("card-a");
  });
});
