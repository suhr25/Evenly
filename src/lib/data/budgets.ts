import { differenceInCalendarDays, endOfMonth, startOfMonth } from "date-fns";
import { toMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export interface BudgetLineItem {
  budgetId: string | null;
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  amount: string | null;
  spent: string;
  remaining: string | null;
  percentUsed: number | null;
  status: "healthy" | "warning" | "exceeded" | "none";
}

export interface MonthBudgetSummary {
  periodStart: string;
  isCurrentMonth: boolean;
  daysRemaining: number | null;
  totalBudgeted: string;
  /** Spend across every category, budgeted or not. */
  totalSpent: string;
  /**
   * Spend confined to the categories that actually have a limit set. This is
   * the only figure it is meaningful to compare against totalBudgeted:
   * totalSpent includes categories the user never budgeted, so pitting it
   * against a partial budget reports an overspend that does not exist.
   */
  trackedSpent: string;
  items: BudgetLineItem[];
}

export function parseMonthParam(month: string | null | undefined): Date {
  if (!month) return startOfMonth(new Date());
  const [year, m] = month.split("-").map(Number);
  return startOfMonth(new Date(year, m - 1, 1));
}

export async function getMonthBudgetSummary(userId: string, periodStart: Date): Promise<MonthBudgetSummary> {
  const periodEnd = endOfMonth(periodStart);
  const now = new Date();
  const isCurrentMonth = startOfMonth(now).getTime() === periodStart.getTime();

  const [categories, budgets, spentGroups] = await Promise.all([
    prisma.expenseCategory.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      orderBy: { name: "asc" },
    }),
    prisma.budget.findMany({ where: { userId, periodStart } }),
    prisma.expense.groupBy({
      by: ["categoryId"],
      where: { userId, date: { gte: periodStart, lte: periodEnd } },
      _sum: { amount: true },
    }),
  ]);

  const budgetByCategory = new Map(budgets.map((b) => [b.categoryId, b]));
  const spentByCategory = new Map(
    spentGroups.map((g) => [g.categoryId, toMoney(g._sum.amount?.toString() ?? "0")])
  );

  const items: BudgetLineItem[] = categories.map((category) => {
    const budget = budgetByCategory.get(category.id);
    const spent = spentByCategory.get(category.id) ?? toMoney(0);
    const amount = budget ? toMoney(budget.amount.toString()) : null;

    let percentUsed: number | null = null;
    let status: BudgetLineItem["status"] = "none";
    let remaining: string | null = null;

    if (amount) {
      percentUsed = amount.isZero() ? 0 : Math.round(spent.dividedBy(amount).times(100).toNumber());
      status = percentUsed >= 100 ? "exceeded" : percentUsed >= 80 ? "warning" : "healthy";
      remaining = amount.minus(spent).toString();
    }

    return {
      budgetId: budget?.id ?? null,
      categoryId: category.id,
      name: category.name,
      icon: category.icon,
      color: category.color,
      amount: amount?.toString() ?? null,
      spent: spent.toString(),
      remaining,
      percentUsed,
      status,
    };
  });

  const totalBudgeted = budgets.reduce((sum, b) => sum.plus(toMoney(b.amount.toString())), toMoney(0));
  const totalSpent = items.reduce((sum, i) => sum.plus(toMoney(i.spent)), toMoney(0));
  const trackedSpent = items.reduce(
    (sum, i) => (i.amount === null ? sum : sum.plus(toMoney(i.spent))),
    toMoney(0)
  );

  return {
    periodStart: periodStart.toISOString(),
    isCurrentMonth,
    daysRemaining: isCurrentMonth ? Math.max(0, differenceInCalendarDays(periodEnd, now)) : null,
    totalBudgeted: totalBudgeted.toString(),
    totalSpent: totalSpent.toString(),
    trackedSpent: trackedSpent.toString(),
    items: items.sort((a, b) => {
      // Budgets set first, then by highest usage, then alphabetically.
      if (Boolean(a.amount) !== Boolean(b.amount)) return a.amount ? -1 : 1;
      if (a.percentUsed !== b.percentUsed) return (b.percentUsed ?? -1) - (a.percentUsed ?? -1);
      return a.name.localeCompare(b.name);
    }),
  };
}
