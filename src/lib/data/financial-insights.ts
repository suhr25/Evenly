import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { addMoney, formatMoney, toMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getMonthBudgetSummary } from "@/lib/data/budgets";
import { syncDetectedSubscriptions } from "@/lib/data/subscriptions";

export interface FinancialInsight {
  id: string;
  title: string;
  description: string;
  severity: "positive" | "warning" | "info";
}

async function categorySpendForMonth(userId: string, monthStart: Date) {
  const groups = await prisma.expense.groupBy({
    by: ["categoryId"],
    where: { userId, date: { gte: monthStart, lte: endOfMonth(monthStart) } },
    _sum: { amount: true },
  });
  const categories = await prisma.expenseCategory.findMany({ where: { id: { in: groups.map((g) => g.categoryId) } } });
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  return new Map(groups.map((g) => [nameById.get(g.categoryId) ?? "Other", toMoney(g._sum.amount?.toString() ?? "0")]));
}

async function categorySpendChangeInsight(
  userId: string,
  now: Date,
  currency: string
): Promise<FinancialInsight | null> {
  const [current, previous] = await Promise.all([
    categorySpendForMonth(userId, startOfMonth(now)),
    categorySpendForMonth(userId, startOfMonth(subMonths(now, 1))),
  ]);

  let best: { name: string; pct: number; from: string; to: string } | null = null;
  for (const [name, amount] of current) {
    const prev = previous.get(name);
    if (!prev || prev.lessThan(500)) continue; // ignore noisy tiny baselines
    const pct = amount.minus(prev).dividedBy(prev).times(100).toNumber();
    if (Math.abs(pct) < 20) continue;
    if (!best || Math.abs(pct) > Math.abs(best.pct)) {
      best = { name, pct, from: prev.toString(), to: amount.toString() };
    }
  }
  if (!best) return null;

  const up = best.pct > 0;
  return {
    id: "category-change",
    title: `${best.name} spending ${up ? "increased" : "decreased"} ${Math.abs(Math.round(best.pct))}%`,
    description: `You spent ${formatMoney(best.to, currency)} on ${best.name} this month, compared to ${formatMoney(best.from, currency)} last month.`,
    severity: up ? "warning" : "positive",
  };
}

async function weekendVsWeekdayInsight(
  userId: string,
  now: Date,
  currency: string
): Promise<FinancialInsight | null> {
  const expenses = await prisma.expense.findMany({
    where: { userId, date: { gte: startOfMonth(now), lte: endOfMonth(now) } },
    select: { amount: true, date: true },
  });
  if (expenses.length < 6) return null;

  let weekendTotal = toMoney(0);
  let weekdayTotal = toMoney(0);
  const weekendDays = new Set<string>();
  const weekdayDays = new Set<string>();
  for (const e of expenses) {
    const day = e.date.getDay();
    const key = e.date.toISOString().slice(0, 10);
    if (day === 0 || day === 6) {
      weekendTotal = addMoney(weekendTotal, e.amount.toString());
      weekendDays.add(key);
    } else {
      weekdayTotal = addMoney(weekdayTotal, e.amount.toString());
      weekdayDays.add(key);
    }
  }
  if (weekendDays.size === 0 || weekdayDays.size === 0) return null;

  const weekendAvg = weekendTotal.dividedBy(weekendDays.size);
  const weekdayAvg = weekdayTotal.dividedBy(weekdayDays.size);
  if (weekdayAvg.isZero() || weekendAvg.lessThanOrEqualTo(weekdayAvg.times(1.2))) return null;

  const pct = weekendAvg.minus(weekdayAvg).dividedBy(weekdayAvg).times(100).toNumber();
  return {
    id: "weekend-spending",
    title: "Weekend spending is higher than weekday spending",
    description: `You spend about ${Math.round(pct)}% more per day on weekends (${formatMoney(weekendAvg, currency)}/day) than on weekdays (${formatMoney(weekdayAvg, currency)}/day) this month.`,
    severity: "info",
  };
}

async function budgetStatusInsight(
  userId: string,
  now: Date,
  currency: string
): Promise<FinancialInsight | null> {
  const summary = await getMonthBudgetSummary(userId, startOfMonth(now));
  const withBudget = summary.items.filter((i) => i.amount !== null);
  if (withBudget.length === 0) return null;

  const exceeded = withBudget.find((i) => i.status === "exceeded");
  if (exceeded) {
    return {
      id: "budget-status",
      title: `You've exceeded your ${exceeded.name} budget`,
      description: `You've spent ${formatMoney(exceeded.spent, currency)} of your ${formatMoney(exceeded.amount!, currency)} ${exceeded.name} budget this month.`,
      severity: "warning",
    };
  }

  const warning = withBudget
    .filter((i) => i.status === "warning")
    .sort((a, b) => (b.percentUsed ?? 0) - (a.percentUsed ?? 0))[0];
  if (warning) {
    const daysLeft = summary.daysRemaining;
    return {
      id: "budget-status",
      title: `Approaching your ${warning.name} budget`,
      description: `You've used ${warning.percentUsed}% of your ${warning.name} budget${
        daysLeft !== null ? ` with ${daysLeft} day${daysLeft === 1 ? "" : "s"} left this month` : ""
      }.`,
      severity: "warning",
    };
  }

  return null;
}

async function recurringExpensesInsight(userId: string, currency: string): Promise<FinancialInsight | null> {
  await syncDetectedSubscriptions(userId);
  const subs = await prisma.subscription.findMany({
    where: { userId, status: { in: ["ACTIVE", "DETECTED"] } },
  });
  if (subs.length === 0) return null;

  const monthlyTotal = subs.reduce((sum, s) => {
    const amount = toMoney(s.amount.toString());
    const monthlyEquivalent =
      s.interval === "WEEKLY" ? amount.times(52).dividedBy(12) : s.interval === "YEARLY" ? amount.dividedBy(12) : amount;
    return addMoney(sum, monthlyEquivalent);
  }, toMoney(0));

  return {
    id: "recurring-total",
    title: `You have recurring expenses totaling ${formatMoney(monthlyTotal, currency)}/month`,
    description: `Across ${subs.length} detected subscription${subs.length === 1 ? "" : "s"}. Check the Subscriptions page to review them.`,
    severity: "info",
  };
}

async function savingsRateInsight(
  userId: string,
  now: Date,
  currency: string
): Promise<FinancialInsight | null> {
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const [incomeAgg, expenseAgg] = await Promise.all([
    prisma.income.aggregate({ where: { userId, date: { gte: monthStart, lte: monthEnd } }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { userId, date: { gte: monthStart, lte: monthEnd } }, _sum: { amount: true } }),
  ]);
  const income = toMoney(incomeAgg._sum.amount?.toString() ?? "0");
  const expenses = toMoney(expenseAgg._sum.amount?.toString() ?? "0");
  if (income.isZero()) return null;

  const savingsRate = income.minus(expenses).dividedBy(income).times(100).toNumber();

  if (savingsRate < 0) {
    return {
      id: "savings-rate",
      title: "You've spent more than you've earned this month",
      description: `Expenses (${formatMoney(expenses, currency)}) have exceeded income (${formatMoney(income, currency)}) so far this month.`,
      severity: "warning",
    };
  }
  if (savingsRate >= 20) {
    return {
      id: "savings-rate",
      title: `You're saving ${Math.round(savingsRate)}% of your income this month`,
      description: `That's ${formatMoney(income.minus(expenses), currency)} saved out of ${formatMoney(income, currency)} earned so far.`,
      severity: "positive",
    };
  }
  return null;
}

const SEVERITY_ORDER: Record<FinancialInsight["severity"], number> = { warning: 0, positive: 1, info: 2 };

/** Deterministic, data-driven insights: every number here comes straight
 * from the database, never from an AI call, so this always works even
 * without an AI provider configured. */
export async function computeFinancialInsights(
  userId: string,
  currency = "INR"
): Promise<FinancialInsight[]> {
  const now = new Date();
  const results = await Promise.all([
    budgetStatusInsight(userId, now, currency),
    categorySpendChangeInsight(userId, now, currency),
    savingsRateInsight(userId, now, currency),
    weekendVsWeekdayInsight(userId, now, currency),
    recurringExpensesInsight(userId, currency),
  ]);

  return results
    .filter((i): i is FinancialInsight => i !== null)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
