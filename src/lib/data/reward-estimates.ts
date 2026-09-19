import { prisma } from "@/lib/prisma";
import {
  computeRawReward,
  estimateReward,
  findMatchingRule,
  type CardRewardProfile,
  type RewardChannel,
  type RewardEstimate,
  type RewardRuleInput,
} from "@/lib/rewards";
import { getOwnedUserCard, type UserCardWithRelations } from "@/lib/data/cards";

export function buildRewardProfile(cardProduct: UserCardWithRelations["cardProduct"]): CardRewardProfile {
  return {
    baseRewardRateOnCurrency:
      cardProduct.baseRewardRateOnCurrency !== null ? cardProduct.baseRewardRateOnCurrency.toString() : null,
    rewardCurrencyUnitValueInr: cardProduct.rewardCurrency
      ? cardProduct.rewardCurrency.unitValueInr.toString()
      : null,
    categoryRules: cardProduct.categoryRules.map((r) => ({
      id: r.id,
      categoryId: r.categoryId,
      channel: r.channel as RewardRuleInput["channel"],
      multiplier: r.multiplier.toString(),
      capAmount: r.capAmount !== null ? r.capAmount.toString() : null,
      capPeriod: r.capPeriod as RewardRuleInput["capPeriod"],
    })),
  };
}

export function periodBounds(date: Date, capPeriod: "MONTHLY" | "ANNUAL"): { start: Date; end: Date } {
  if (capPeriod === "ANNUAL") {
    return { start: new Date(date.getFullYear(), 0, 1), end: new Date(date.getFullYear() + 1, 0, 1) };
  }
  // Calendar-month approximation of the cap period. Real statement cycles run from a card's
  // own statement date to the next, which we track (UserCard.statementDate) but don't yet
  // use here. Refining this to true statement-cycle boundaries is a reasonable next step,
  // not a correctness bug: caps are still tracked and enforced, just on slightly different
  // period edges than the issuer's own cycle.
  return {
    start: new Date(date.getFullYear(), date.getMonth(), 1),
    end: new Date(date.getFullYear(), date.getMonth() + 1, 1),
  };
}

/** Sums how much reward value has already accrued against the SAME matched rule for past
 * expenses on this card within the rule's current cap period, so a new estimate can respect
 * whatever headroom is actually left rather than assuming a fresh cap every time. */
export async function computeAlreadyAccruedInr(
  userCardId: string,
  profile: CardRewardProfile,
  rule: RewardRuleInput,
  periodStart: Date,
  periodEnd: Date,
  excludeExpenseId?: string
): Promise<number> {
  const pastExpenses = await prisma.expense.findMany({
    where: {
      userCardId,
      date: { gte: periodStart, lt: periodEnd },
      ...(excludeExpenseId ? { id: { not: excludeExpenseId } } : {}),
    },
    orderBy: { date: "asc" },
    select: { amount: true, categoryId: true, isOnline: true },
  });

  let accrued = 0;
  for (const expense of pastExpenses) {
    const channel: RewardChannel = expense.isOnline === true ? "ONLINE" : "OFFLINE";
    if (expense.isOnline === null) {
      // Unknown channel: only counts toward rules that don't care about channel at all.
      if (rule.channel !== "ANY") continue;
    }
    const matched = findMatchingRule(profile.categoryRules, expense.categoryId, channel);
    if (matched?.id !== rule.id) continue;

    const raw = computeRawReward(profile, { amount: expense.amount.toString(), categoryId: expense.categoryId, channel });
    const cap = rule.capAmount ? Number(rule.capAmount) : Infinity;
    accrued = Math.min(cap, accrued + raw.rewardValueInr);
  }
  return accrued;
}

export interface RewardEstimateInput {
  amount: string;
  categoryId: string | null;
  channel: RewardChannel;
  date?: Date;
  /** Pass when re-estimating an existing expense being edited, so it isn't double-counted
   * against its own cap period. */
  excludeExpenseId?: string;
}

/** Core estimate logic given an already-fetched, already-ownership-checked UserCard record.
 * Exposed separately from estimateRewardForCard so Phase 5's cross-portfolio recommendation
 * can reuse it after fetching all owned cards once, instead of re-fetching (and re-checking
 * ownership for) each one individually. */
export async function estimateRewardForUserCardRecord(
  userCard: UserCardWithRelations,
  input: RewardEstimateInput
): Promise<RewardEstimate> {
  const profile = buildRewardProfile(userCard.cardProduct);
  const date = input.date ?? new Date();

  const matched = findMatchingRule(profile.categoryRules, input.categoryId, input.channel);

  let alreadyAccruedInr = 0;
  if (matched?.capAmount && matched.capPeriod) {
    const { start, end } = periodBounds(date, matched.capPeriod);
    alreadyAccruedInr = await computeAlreadyAccruedInr(
      userCard.id,
      profile,
      matched,
      start,
      end,
      input.excludeExpenseId
    );
  }

  return estimateReward(profile, { amount: input.amount, categoryId: input.categoryId, channel: input.channel }, alreadyAccruedInr);
}

/** The Phase 4 single-card reward estimate: given one owned card and a transaction, returns
 * the estimated reward value with cap awareness and plain-language reasons. This is
 * deliberately scoped to one card. Comparing across a user's whole portfolio to recommend
 * the best one is Phase 5, built on top of this, not inside it. */
export async function estimateRewardForCard(
  userId: string,
  userCardId: string,
  input: RewardEstimateInput
): Promise<RewardEstimate> {
  const userCard = await getOwnedUserCard(userId, userCardId);
  return estimateRewardForUserCardRecord(userCard, input);
}
