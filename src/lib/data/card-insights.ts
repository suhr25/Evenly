import { formatMoney, toMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { computeUtilizationPercent, listOwnedUserCardsRaw } from "@/lib/data/cards";
import { estimateRewardForUserCardRecord } from "@/lib/data/reward-estimates";
import { rankCardCandidates, type CardCandidate, type RewardChannel } from "@/lib/rewards";

export interface CardInsight {
  id: string;
  title: string;
  description: string;
  severity: "positive" | "warning" | "info";
}

const MISSED_REWARD_LOOKBACK_DAYS = 60;
const MISSED_REWARD_MAX_EXPENSES = 30;
/** Below this, a "missed" amount is noise (rounding, tiny rate differences) rather than a
 * genuinely better choice worth surfacing. */
const MISSED_REWARD_NOISE_FLOOR_INR = 20;

function cardLabel(card: { nickname: string | null; cardProduct: { issuer: { name: string }; name: string } }) {
  return card.nickname || `${card.cardProduct.issuer.name} ${card.cardProduct.name}`;
}

/**
 * Compares the reward actually earned on each recent card-tagged expense against what the
 * best of the user's OWNED cards would have earned for that same transaction. Portfolio-only,
 * same as the live recommendation engine. This never suggests a card the user doesn't have.
 *
 * Deliberately neutral in tone (per the product's own rule against shaming past choices):
 * this reports what the numbers show, not that a decision was a mistake, and accounts for
 * only the information a reasonable comparison can reconstruct after the fact.
 */
async function missedRewardInsight(userId: string, currency: string): Promise<CardInsight | null> {
  const ownedCards = await listOwnedUserCardsRaw(userId);
  if (ownedCards.length < 2) return null; // no "missed" comparison possible with a single card

  const since = new Date();
  since.setDate(since.getDate() - MISSED_REWARD_LOOKBACK_DAYS);

  const expenses = await prisma.expense.findMany({
    where: { userId, userCardId: { not: null }, date: { gte: since } },
    orderBy: { date: "desc" },
    take: MISSED_REWARD_MAX_EXPENSES,
    select: { id: true, amount: true, categoryId: true, isOnline: true, date: true, description: true, userCardId: true },
  });
  if (expenses.length === 0) return null;

  let totalMissed = 0;
  let worst: { amountMissed: number; description: string; betterCardLabel: string } | null = null;
  let countWithMiss = 0;

  for (const expense of expenses) {
    const actualCard = ownedCards.find((c) => c.id === expense.userCardId);
    if (!actualCard) continue; // card was removed from the portfolio since

    const channel: RewardChannel = expense.isOnline === true ? "ONLINE" : "OFFLINE";
    const txnInput = { amount: expense.amount.toString(), categoryId: expense.categoryId, channel, date: expense.date, excludeExpenseId: expense.id };

    const candidates: CardCandidate[] = await Promise.all(
      ownedCards.map(async (card) => ({
        userCardId: card.id,
        cardLabel: cardLabel(card),
        estimate: await estimateRewardForUserCardRecord(card, txnInput),
        utilizationAfterPercent: null, // not relevant to a retrospective comparison
      }))
    );

    const ranked = rankCardCandidates(candidates);
    const actualEstimate = candidates.find((c) => c.userCardId === actualCard.id)!.estimate;
    const missed = ranked.best.estimate.cappedValueInr - actualEstimate.cappedValueInr;

    if (ranked.best.userCardId !== actualCard.id && missed > MISSED_REWARD_NOISE_FLOOR_INR) {
      totalMissed += missed;
      countWithMiss += 1;
      if (!worst || missed > worst.amountMissed) {
        worst = { amountMissed: missed, description: expense.description, betterCardLabel: ranked.best.cardLabel };
      }
    }
  }

  if (!worst || totalMissed <= MISSED_REWARD_NOISE_FLOOR_INR) return null;

  return {
    id: "missed-reward",
    title: `You could have earned about ${formatMoney(totalMissed, currency)} more in rewards`,
    description: `Across ${countWithMiss} transaction${countWithMiss === 1 ? "" : "s"} in the last ${MISSED_REWARD_LOOKBACK_DAYS} days, based on the cards you own. The biggest gap: "${worst.description}" could have earned more on ${worst.betterCardLabel}.`,
    severity: "info",
  };
}

const HIGH_UTILIZATION_THRESHOLD = 75;

async function highUtilizationInsight(userId: string, currency: string): Promise<CardInsight | null> {
  const ownedCards = await listOwnedUserCardsRaw(userId);
  const withUtilization = ownedCards
    .map((card) => {
      const creditLimit = card.creditLimit ? toMoney(card.creditLimit).toString() : null;
      const outstanding = card.outstanding ? toMoney(card.outstanding).toString() : null;
      return { card, utilization: computeUtilizationPercent(creditLimit, outstanding) };
    })
    .filter((c): c is { card: (typeof ownedCards)[number]; utilization: number } => c.utilization !== null);

  const worst = withUtilization.sort((a, b) => b.utilization - a.utilization)[0];
  if (!worst || worst.utilization < HIGH_UTILIZATION_THRESHOLD) return null;

  return {
    id: "high-utilization",
    title: `${cardLabel(worst.card)} is at ${worst.utilization.toFixed(0)}% utilization`,
    description: `Outstanding is ${formatMoney(worst.card.outstanding?.toString() ?? "0", currency)} of a ${formatMoney(
      worst.card.creditLimit?.toString() ?? "0",
      currency
    )} limit. From a utilization perspective, paying this down before the statement date may help, based on the information available.`,
    severity: "warning",
  };
}

const PAYMENT_DUE_WINDOW_DAYS = 5;

function nextOccurrenceOfDay(dayOfMonth: number, today: Date): Date {
  const candidate = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);
  if (candidate < today) candidate.setMonth(candidate.getMonth() + 1);
  return candidate;
}

async function paymentDueInsight(userId: string, currency: string): Promise<CardInsight | null> {
  const ownedCards = await listOwnedUserCardsRaw(userId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const withDueDates = ownedCards
    .filter((c) => c.paymentDueDate !== null && c.outstanding && !toMoney(c.outstanding).isZero())
    .map((c) => ({ card: c, dueDate: nextOccurrenceOfDay(c.paymentDueDate!, today) }))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const soonest = withDueDates[0];
  if (!soonest) return null;

  const daysUntil = Math.round((soonest.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil > PAYMENT_DUE_WINDOW_DAYS) return null;

  return {
    id: "payment-due",
    title:
      daysUntil === 0
        ? `${cardLabel(soonest.card)} payment is due today`
        : `${cardLabel(soonest.card)} payment due in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
    description: `Outstanding balance of ${formatMoney(soonest.card.outstanding!.toString(), currency)}.`,
    severity: daysUntil <= 1 ? "warning" : "info",
  };
}

const SEVERITY_ORDER: Record<CardInsight["severity"], number> = { warning: 0, positive: 1, info: 2 };

/** Deterministic, data-driven card insights. Every number comes from the reward engine and
 * the database, never from an AI call. Mirrors the pattern in financial-insights.ts. */
export async function computeCardInsights(userId: string, currency = "INR"): Promise<CardInsight[]> {
  const results = await Promise.all([
    paymentDueInsight(userId, currency),
    highUtilizationInsight(userId, currency),
    missedRewardInsight(userId, currency),
  ]);

  return results
    .filter((i): i is CardInsight => i !== null)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
