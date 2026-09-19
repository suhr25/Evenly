import { toMoney, type MoneyInput } from "@/lib/money";

export type RewardChannel = "ONLINE" | "OFFLINE";
export type RuleChannel = "ANY" | RewardChannel;
export type CapPeriod = "MONTHLY" | "ANNUAL";

export interface RewardRuleInput {
  /** Identity for this rule, used to recognize "the same rule" when accumulating cap usage
   * across multiple past transactions. Not used for matching logic itself. */
  id: string;
  categoryId: string | null;
  channel: RuleChannel;
  multiplier: MoneyInput;
  capAmount: MoneyInput | null;
  capPeriod: CapPeriod | null;
}

export interface CardRewardProfile {
  /** Units of reward currency earned per Rs 100 of base (unaccelerated) spend. Null means
   * this card's base rate hasn't been confirmed yet. The engine still runs, but flags the
   * estimate as incomplete rather than silently returning a confident-looking zero. */
  baseRewardRateOnCurrency: MoneyInput | null;
  /** Rupees of value per one unit of this card's reward currency. Same null handling as above. */
  rewardCurrencyUnitValueInr: MoneyInput | null;
  categoryRules: RewardRuleInput[];
}

export interface RewardTransactionInput {
  amount: MoneyInput;
  categoryId: string | null;
  channel: RewardChannel;
}

export interface RawReward {
  rule: RewardRuleInput | null;
  multiplier: number;
  rewardUnits: number;
  rewardValueInr: number;
}

export interface CappedReward extends RawReward {
  cappedValueInr: number;
  capApplied: boolean;
  /** Headroom left under the matched rule's cap before this transaction, in rupees.
   * Null when the matched rule (or lack thereof) has no cap. */
  capRemainingBeforeInr: number | null;
}

export interface RewardEstimate extends CappedReward {
  /** Plain-language reasons, safe to render directly. No financial claims beyond what the
   * matched rule and cap state actually support. */
  reasons: string[];
}

/**
 * Picks the single best-matching reward rule for a transaction. Real Indian card reward
 * structures generally don't stack accelerators (a transaction gets the one applicable
 * boost, not several multiplied together), so this returns at most one rule rather than
 * combining matches.
 *
 * A rule matches when its category is either unset (channel-only rule, e.g. SBI Cashback's
 * online/offline split) or equal to the transaction's category, AND its channel is either
 * ANY or equal to the transaction's channel. Among matches, the highest multiplier wins;
 * ties prefer a category-bound rule over a channel-only one, since a named category
 * accelerator is more likely to be the card's intended boost for that spend.
 */
export function findMatchingRule(
  rules: RewardRuleInput[],
  categoryId: string | null,
  channel: RewardChannel
): RewardRuleInput | null {
  const candidates = rules.filter(
    (r) =>
      (r.categoryId === null || r.categoryId === categoryId) &&
      (r.channel === "ANY" || r.channel === channel)
  );
  if (candidates.length === 0) return null;

  return [...candidates].sort((a, b) => {
    const diff = Number(b.multiplier) - Number(a.multiplier);
    if (diff !== 0) return diff;
    return (a.categoryId !== null ? 0 : 1) - (b.categoryId !== null ? 0 : 1);
  })[0];
}

/** Reward value before any cap is applied. A card with no confirmed base rate or reward
 * currency value earns 0 here rather than throwing. Callers should check for that via the
 * `reasons` array from estimateReward, not by inspecting for an exception. */
export function computeRawReward(profile: CardRewardProfile, txn: RewardTransactionInput): RawReward {
  const baseRate =
    profile.baseRewardRateOnCurrency !== null ? Number(profile.baseRewardRateOnCurrency) : 0;
  const unitValue =
    profile.rewardCurrencyUnitValueInr !== null ? Number(profile.rewardCurrencyUnitValueInr) : 0;
  const rule = findMatchingRule(profile.categoryRules, txn.categoryId, txn.channel);
  const multiplier = rule ? Number(rule.multiplier) : 1;
  const amount = Number(toMoney(txn.amount));

  const rewardUnits = (amount / 100) * baseRate * multiplier;
  const rewardValueInr = rewardUnits * unitValue;
  return { rule, multiplier, rewardUnits, rewardValueInr };
}

/** Reduces a raw reward by whatever cap headroom remains, given how much value has already
 * accrued against the SAME rule earlier in its cap period. */
export function applyCap(raw: RawReward, alreadyAccruedInr: number): CappedReward {
  if (!raw.rule?.capAmount) {
    return { ...raw, cappedValueInr: raw.rewardValueInr, capApplied: false, capRemainingBeforeInr: null };
  }
  const cap = Number(raw.rule.capAmount);
  const remaining = Math.max(0, cap - alreadyAccruedInr);
  const cappedValueInr = Math.min(raw.rewardValueInr, remaining);
  return {
    ...raw,
    cappedValueInr,
    capApplied: cappedValueInr < raw.rewardValueInr,
    capRemainingBeforeInr: remaining,
  };
}

/**
 * The single entry point most callers should use: computes the estimated reward for one
 * transaction on one card, with cap awareness and plain-language reasons for why the number
 * came out the way it did. `alreadyAccruedInr` is the value already earned against the
 * matched rule's cap earlier in its period. Pass 0 if unknown or not applicable; the data
 * layer is responsible for computing it from past transactions before calling this.
 */
export function estimateReward(
  profile: CardRewardProfile,
  txn: RewardTransactionInput,
  alreadyAccruedInr = 0
): RewardEstimate {
  const raw = computeRawReward(profile, txn);
  const capped = applyCap(raw, alreadyAccruedInr);
  const reasons: string[] = [];

  const hasConfirmedRate = profile.baseRewardRateOnCurrency !== null && profile.rewardCurrencyUnitValueInr !== null;

  if (!hasConfirmedRate) {
    reasons.push(
      "This card's reward rate or redemption value hasn't been confirmed yet, so this is an incomplete estimate."
    );
  } else if (capped.rule && capped.multiplier === 0) {
    reasons.push(
      capped.rule.categoryId
        ? "This category is excluded from earning rewards on this card."
        : "This channel is excluded from earning rewards on this card."
    );
  } else if (capped.rule && capped.multiplier > 1) {
    reasons.push(
      capped.rule.categoryId
        ? `A ${capped.multiplier}x category accelerator applies to this transaction.`
        : `A ${capped.multiplier}x channel accelerator applies to this transaction.`
    );
  } else {
    reasons.push("No category or channel accelerator applies; this earns the card's base rate.");
  }

  if (capped.rule?.capAmount) {
    if (capped.capApplied) {
      reasons.push(
        "The reward cap for this category/channel has already been reached this period, so part or all of this transaction earns no further reward."
      );
    } else if (capped.capRemainingBeforeInr !== null) {
      reasons.push(
        `The reward cap for this category/channel has not been reached yet (about Rs ${Math.round(
          capped.capRemainingBeforeInr
        )} of headroom left this period).`
      );
    }
  }

  return { ...capped, reasons };
}

// ---------- Cross-card ranking (Phase 5) ----------
//
// Everything above answers "what does ONE card earn on this transaction." Ranking answers
// "which of the cards I actually own is best for it". A distinct, deliberately separate
// concern. This function only ever sees whatever candidates its caller constructs; the
// portfolio-only guarantee (never recommend a card the user doesn't own) is enforced by the
// data layer only ever building candidates from the user's own UserCard rows, not by anything
// in here. Keeping that boundary at the data layer, not this pure function, is intentional:
// it means a bug here can misrank cards but can never leak an unowned one into the result.

export interface CardCandidate {
  userCardId: string;
  cardLabel: string;
  estimate: RewardEstimate;
  /** Projected utilization percent if this transaction is charged to this card. Null when the
   * card has no credit limit on file, meaning utilization can't be assessed for it. */
  utilizationAfterPercent: number | null;
}

export interface RankedCandidate extends CardCandidate {
  /** The estimate's own reasons, plus any ranking-specific reasoning (e.g. a utilization
   * tradeoff) appended. This is the full, ready-to-render explanation for this card. */
  reasons: string[];
}

export interface CardRecommendation {
  best: RankedCandidate;
  alternatives: RankedCandidate[];
}

const HIGH_UTILIZATION_THRESHOLD = 80;
const SAFE_UTILIZATION_THRESHOLD = 50;
const MIN_UTILIZATION_GAP = 30;

/**
 * Ranks owned-card candidates for one transaction, primarily by estimated reward value.
 *
 * The one deliberate exception: if the reward-best card would push utilization into a high
 * range (>=80% after this purchase) and a meaningfully safer owned alternative exists (>=30
 * points lower utilization, itself under 50%), that alternative is recommended instead, with
 * the tradeoff explained in hedged language. This mirrors the product's own worked example of
 * utilization sometimes outweighing a small reward difference. But it never fires just
 * because one card has *slightly* better utilization than another; the gap has to be large
 * and the reward-best option has to be genuinely risky first.
 */
export function rankCardCandidates(candidates: CardCandidate[]): CardRecommendation {
  if (candidates.length === 0) {
    throw new Error("rankCardCandidates: at least one candidate is required");
  }

  const byReward = [...candidates].sort((a, b) => b.estimate.cappedValueInr - a.estimate.cappedValueInr);
  const topByReward = byReward[0];

  let winner = topByReward;
  let utilizationNote: string | null = null;

  if (
    topByReward.utilizationAfterPercent !== null &&
    topByReward.utilizationAfterPercent >= HIGH_UTILIZATION_THRESHOLD
  ) {
    const saferAlternative = byReward.slice(1).find(
      (c) =>
        c.utilizationAfterPercent !== null &&
        c.utilizationAfterPercent <= SAFE_UTILIZATION_THRESHOLD &&
        topByReward.utilizationAfterPercent! - c.utilizationAfterPercent >= MIN_UTILIZATION_GAP
    );

    if (saferAlternative) {
      const rewardGap = Math.round(topByReward.estimate.cappedValueInr - saferAlternative.estimate.cappedValueInr);
      winner = saferAlternative;
      utilizationNote =
        `From a utilization perspective, ${topByReward.cardLabel} would reach about ` +
        `${topByReward.utilizationAfterPercent!.toFixed(1)}% utilization with this purchase, while ` +
        `${saferAlternative.cardLabel} would stay around ${saferAlternative.utilizationAfterPercent!.toFixed(1)}%. ` +
        `Based on the information available, ${saferAlternative.cardLabel} is suggested here for that reason` +
        (rewardGap > 0 ? `, at an estimated cost of about Rs ${rewardGap} less in rewards.` : ".");
    }
  }

  const alternatives = candidates
    .filter((c) => c.userCardId !== winner.userCardId)
    .sort((a, b) => b.estimate.cappedValueInr - a.estimate.cappedValueInr);

  const winnerReasons = utilizationNote ? [...winner.estimate.reasons, utilizationNote] : winner.estimate.reasons;

  return {
    best: { ...winner, reasons: winnerReasons },
    alternatives: alternatives.map((c) => ({ ...c, reasons: c.estimate.reasons })),
  };
}
