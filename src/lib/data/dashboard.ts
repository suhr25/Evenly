import { endOfMonth, getDaysInMonth, format, startOfMonth, subMonths } from "date-fns";
import { getUserGroupBalanceSummary, type UserGroupBalanceSummary } from "@/lib/data/groups";
import { prisma } from "@/lib/prisma";
import { addMoney, subtractMoney, toMoney } from "@/lib/money";

export interface CategoryBreakdownItem {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  amount: string;
}

export interface BudgetSummaryItem {
  categoryId: string;
  name: string;
  icon: string;
  budget: string;
  spent: string;
  percentUsed: number;
  status: "healthy" | "warning" | "exceeded";
}

export interface RecentTransaction {
  id: string;
  description: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  amount: string;
  date: string;
  paymentMethod: string;
}

export interface SpendingTrendPoint {
  month: string;
  label: string;
  amount: string;
}

export interface ActivityMonth {
  name: string;
  days: number[];
  income: number;
}

export interface DashboardData {
  activityMonths: ActivityMonth[];
  activityDay: number;
  currency: string;
  balance: string;
  monthlyIncome: string;
  monthlyExpenses: string;
  monthlySavings: string;
  categoryBreakdown: CategoryBreakdownItem[];
  spendingTrend: SpendingTrendPoint[];
  budgets: BudgetSummaryItem[];
  recentTransactions: RecentTransaction[];
  groupBalances: UserGroupBalanceSummary;
  hasAnyData: boolean;
}

const TREND_MONTHS = 6;

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [user, allTimeExpenses, allTimeIncome, monthExpenseGroups, monthIncomeSum, budgets, recent] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { currency: true } }),
      prisma.expense.aggregate({ where: { userId }, _sum: { amount: true } }),
      prisma.income.aggregate({ where: { userId }, _sum: { amount: true } }),
      prisma.expense.groupBy({
        by: ["categoryId"],
        where: { userId, date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
      prisma.income.aggregate({
        where: { userId, date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
      prisma.budget.findMany({
        where: { userId, periodStart: monthStart },
        include: { category: true },
      }),
      prisma.expense.findMany({
        where: { userId },
        include: { category: true },
        orderBy: { date: "desc" },
        take: 8,
      }),
    ]);

  const [categories, groupBalances] = await Promise.all([
    prisma.expenseCategory.findMany({ where: { OR: [{ userId: null }, { userId }] } }),
    getUserGroupBalanceSummary(userId),
  ]);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const balance = subtractMoney(
    allTimeIncome._sum.amount?.toString() ?? "0",
    allTimeExpenses._sum.amount?.toString() ?? "0"
  );

  const monthlyExpenses = monthExpenseGroups.reduce(
    (sum, g) => addMoney(sum, g._sum.amount?.toString() ?? "0"),
    toMoney(0)
  );
  const monthlyIncome = toMoney(monthIncomeSum._sum.amount?.toString() ?? "0");
  const monthlySavings = subtractMoney(monthlyIncome, monthlyExpenses);

  const categoryBreakdown: CategoryBreakdownItem[] = monthExpenseGroups
    .map((g) => {
      const category = categoryById.get(g.categoryId);
      return {
        categoryId: g.categoryId,
        name: category?.name ?? "Other",
        icon: category?.icon ?? "MoreHorizontal",
        color: category?.color ?? "#6b7280",
        amount: toMoney(g._sum.amount?.toString() ?? "0").toString(),
      };
    })
    .sort((a, b) => Number(b.amount) - Number(a.amount));

  const budgetSummaries: BudgetSummaryItem[] = await Promise.all(
    budgets.map(async (b) => {
      const spentAgg = await prisma.expense.aggregate({
        where: { userId, categoryId: b.categoryId, date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      });
      const spent = toMoney(spentAgg._sum.amount?.toString() ?? "0");
      const budgetAmount = toMoney(b.amount.toString());
      const percentUsed = budgetAmount.isZero()
        ? 0
        : Math.round(spent.dividedBy(budgetAmount).times(100).toNumber());
      const status: BudgetSummaryItem["status"] =
        percentUsed >= 100 ? "exceeded" : percentUsed >= 80 ? "warning" : "healthy";

      return {
        categoryId: b.categoryId,
        name: b.category.name,
        icon: b.category.icon,
        budget: budgetAmount.toString(),
        spent: spent.toString(),
        percentUsed,
        status,
      };
    })
  );

  const historyStart = startOfMonth(subMonths(now, TREND_MONTHS - 1));
  const historyWhere = { userId, date: { gte: historyStart, lte: monthEnd } };
  const [expenseDates, incomeDates] = await Promise.all([
    prisma.expense.groupBy({ by: ["date"], where: historyWhere, _sum: { amount: true } }),
    prisma.income.groupBy({ by: ["date"], where: historyWhere, _sum: { amount: true } }),
  ]);
  const dates = Array.from({ length: TREND_MONTHS }, (_, i) => subMonths(monthStart, TREND_MONTHS - 1 - i));
  const activityMonths = dates.map(date => ({
    name: format(date, "MMM yyyy"),
    days: Array<number>(getDaysInMonth(date)).fill(0),
    income: 0,
  }));
  const byMonth = new Map(dates.map((date, i) => [format(date, "yyyy-MM"), activityMonths[i]]));
  for (const row of expenseDates) {
    const month = byMonth.get(format(row.date, "yyyy-MM"))!;
    const day = row.date.getDate() - 1;
    month.days[day] = addMoney(month.days[day], row._sum.amount?.toString() ?? 0).toNumber();
  }
  for (const row of incomeDates) {
    const month = byMonth.get(format(row.date, "yyyy-MM"))!;
    month.income = addMoney(month.income, row._sum.amount?.toString() ?? 0).toNumber();
  }
  const spendingTrend = dates.map((date, i) => ({
    month: format(date, "yyyy-MM"),
    label: format(date, "MMM"),
    amount: addMoney(...activityMonths[i].days).toString(),
  }));

  const recentTransactions: RecentTransaction[] = recent.map((e) => ({
    id: e.id,
    description: e.description,
    categoryName: e.category.name,
    categoryIcon: e.category.icon,
    categoryColor: e.category.color,
    amount: toMoney(e.amount.toString()).toString(),
    date: e.date.toISOString(),
    paymentMethod: e.paymentMethod,
  }));

  return {
    activityMonths,
    activityDay: now.getDate() - 1,
    currency: user.currency,
    balance: balance.toString(),
    monthlyIncome: monthlyIncome.toString(),
    monthlyExpenses: monthlyExpenses.toString(),
    monthlySavings: monthlySavings.toString(),
    categoryBreakdown,
    spendingTrend,
    budgets: budgetSummaries,
    recentTransactions,
    groupBalances,
    hasAnyData: recent.length > 0 || monthIncomeSum._sum.amount !== null,
  };
}
