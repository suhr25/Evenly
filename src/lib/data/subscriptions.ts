import { differenceInCalendarDays } from "date-fns";
import { toMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";

const GHOST_OCCURRENCE_THRESHOLD = 3;

interface DetectedPattern {
  merchant: string;
  amount: string;
  interval: "WEEKLY" | "MONTHLY" | "YEARLY";
  occurrenceCount: number;
  firstChargeAt: Date;
  lastChargeAt: Date;
  sourceExpenseIds: string[];
}

/**
 * Groups expenses by (normalized) description and flags groups whose amount
 * stays consistent and whose date gaps cluster around a weekly/monthly/
 * yearly cadence. Deliberately conservative: both amount and interval must
 * be consistent across every occurrence, not just on average, to avoid
 * flagging coincidental same-amount one-offs as subscriptions.
 */
function detectPatterns(
  expenses: { id: string; description: string; amount: string; date: Date }[]
): DetectedPattern[] {
  const groups = new Map<string, typeof expenses>();
  for (const e of expenses) {
    const key = e.description.trim().toLowerCase();
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }

  const patterns: DetectedPattern[] = [];

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.date.getTime() - b.date.getTime());

    const amounts = sorted.map((e) => toMoney(e.amount).toNumber());
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const amountTolerance = Math.max(10, avgAmount * 0.05);
    if (!amounts.every((a) => Math.abs(a - avgAmount) <= amountTolerance)) continue;

    const gaps = sorted.slice(1).map((e, i) => differenceInCalendarDays(e.date, sorted[i].date));
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

    let interval: DetectedPattern["interval"] | null = null;
    let gapTolerance = 0;
    if (avgGap >= 6 && avgGap <= 8) {
      interval = "WEEKLY";
      gapTolerance = 3;
    } else if (avgGap >= 27 && avgGap <= 33) {
      interval = "MONTHLY";
      gapTolerance = 6;
    } else if (avgGap >= 350 && avgGap <= 380) {
      interval = "YEARLY";
      gapTolerance = 20;
    }
    if (!interval) continue;
    if (!gaps.every((g) => Math.abs(g - avgGap) <= gapTolerance)) continue;

    patterns.push({
      merchant: sorted[0].description.trim(),
      amount: avgAmount.toFixed(2),
      interval,
      occurrenceCount: sorted.length,
      firstChargeAt: sorted[0].date,
      lastChargeAt: sorted[sorted.length - 1].date,
      sourceExpenseIds: sorted.map((e) => e.id),
    });
  }

  return patterns;
}

/** Re-runs detection over the user's expense history and upserts results.
 * A subscription the user has already confirmed, ignored, or marked
 * inactive keeps that decision; only its stats (amount/last charge/source
 * expenses) refresh. */
export async function syncDetectedSubscriptions(userId: string) {
  const expenses = await prisma.expense.findMany({
    where: { userId },
    select: { id: true, description: true, amount: true, date: true },
  });

  const patterns = detectPatterns(
    expenses.map((e) => ({ ...e, amount: e.amount.toString() }))
  );

  for (const p of patterns) {
    await prisma.subscription.upsert({
      where: { userId_merchant: { userId, merchant: p.merchant } },
      update: {
        amount: p.amount,
        interval: p.interval,
        occurrenceCount: p.occurrenceCount,
        lastChargeAt: p.lastChargeAt,
        sourceExpenseIds: p.sourceExpenseIds,
      },
      create: {
        userId,
        merchant: p.merchant,
        amount: p.amount,
        interval: p.interval,
        occurrenceCount: p.occurrenceCount,
        firstChargeAt: p.firstChargeAt,
        lastChargeAt: p.lastChargeAt,
        sourceExpenseIds: p.sourceExpenseIds,
        status: "DETECTED",
      },
    });
  }
}

export interface SerializedSubscription {
  id: string;
  merchant: string;
  displayName: string | null;
  amount: string;
  interval: string;
  annualCost: string;
  occurrenceCount: number;
  firstChargeAt: string;
  lastChargeAt: string;
  status: string;
  isGhost: boolean;
}

const ANNUAL_MULTIPLIER: Record<string, number> = { WEEKLY: 52, MONTHLY: 12, YEARLY: 1 };

export function serializeSubscription(sub: {
  id: string;
  merchant: string;
  displayName: string | null;
  amount: import("@/generated/prisma/client").Prisma.Decimal;
  interval: string;
  occurrenceCount: number;
  firstChargeAt: Date;
  lastChargeAt: Date;
  status: string;
}): SerializedSubscription {
  const amount = toMoney(sub.amount.toString());
  return {
    id: sub.id,
    merchant: sub.merchant,
    displayName: sub.displayName,
    amount: amount.toString(),
    interval: sub.interval,
    annualCost: amount.times(ANNUAL_MULTIPLIER[sub.interval] ?? 1).toString(),
    occurrenceCount: sub.occurrenceCount,
    firstChargeAt: sub.firstChargeAt.toISOString(),
    lastChargeAt: sub.lastChargeAt.toISOString(),
    status: sub.status,
    isGhost: sub.status === "DETECTED" && sub.occurrenceCount >= GHOST_OCCURRENCE_THRESHOLD,
  };
}
