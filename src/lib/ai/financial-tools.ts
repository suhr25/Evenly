import { endOfMonth } from "date-fns";
import { z } from "zod";
import { getMonthBudgetSummary, parseMonthParam } from "@/lib/data/budgets";
import { computeGroupBalances } from "@/lib/data/groups";
import { addMoney, subtractMoney, toMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import type { AIToolDefinition } from "@/types/ai";

// Some models (e.g. Groq's function-calling validation) send an explicit
// `null` for an omitted optional argument rather than leaving it out
// entirely. The JSON schemas below declare those properties as nullable
// (`["string", "null"]`) so the provider's own request validation accepts
// that, and these Zod schemas accept null too so parsing doesn't reject it
// once it reaches us.
const monthInput = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).nullish() });

export const FINANCIAL_TOOLS: AIToolDefinition[] = [
  {
    name: "getMonthlySummary",
    description:
      "Get total income, total expenses, and net savings for a given month, plus the top spending categories. Use this for questions about overall monthly financial position.",
    inputSchema: {
      type: "object",
      properties: {
        month: { type: ["string", "null"], description: "YYYY-MM, defaults to the current month" },
      },
    },
  },
  {
    name: "getCategorySpending",
    description: "Get spending broken down by category for a given month, sorted highest first.",
    inputSchema: {
      type: "object",
      properties: {
        month: { type: ["string", "null"], description: "YYYY-MM, defaults to the current month" },
      },
    },
  },
  {
    name: "getExpenses",
    description:
      "Get a list of individual expenses, optionally filtered by month and/or category name, most recent first.",
    inputSchema: {
      type: "object",
      properties: {
        month: { type: ["string", "null"], description: "YYYY-MM, omit for all-time" },
        category: { type: ["string", "null"], description: "Category name to filter by, e.g. Food" },
        limit: { type: ["number", "null"], description: "Max results, default 20, max 50" },
      },
    },
  },
  {
    name: "getIncome",
    description: "Get total income and the list of income entries for a given month.",
    inputSchema: {
      type: "object",
      properties: {
        month: { type: ["string", "null"], description: "YYYY-MM, defaults to the current month" },
      },
    },
  },
  {
    name: "getBudgets",
    description: "Get the user's budgets for a given month: limit, amount spent, and percentage used per category.",
    inputSchema: {
      type: "object",
      properties: {
        month: { type: ["string", "null"], description: "YYYY-MM, defaults to the current month" },
      },
    },
  },
  {
    name: "getGoals",
    description: "Get the user's savings goals with target amount, current progress, and projections.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "getGroupBalances",
    description:
      "Get how much the user owes or is owed, broken down per group (e.g. a trip or flatmates group). Use this for 'who owes me money' style questions.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "getRecurringExpenses",
    description: "Get expenses the user has flagged as recurring (subscriptions, rent, etc).",
    inputSchema: { type: "object", properties: {} },
  },
];

function monthRange(month: string | null | undefined) {
  const start = parseMonthParam(month);
  return { start, end: endOfMonth(start) };
}

async function getMonthlySummary(userId: string, input: unknown) {
  const { month } = monthInput.parse(input);
  const { start, end } = monthRange(month);

  const [expenseGroups, incomeSum] = await Promise.all([
    prisma.expense.groupBy({
      by: ["categoryId"],
      where: { userId, date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    prisma.income.aggregate({ where: { userId, date: { gte: start, lte: end } }, _sum: { amount: true } }),
  ]);

  const categoryIds = expenseGroups.map((g) => g.categoryId);
  const categories = await prisma.expenseCategory.findMany({ where: { id: { in: categoryIds } } });
  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  const totalExpenses = expenseGroups.reduce(
    (sum, g) => addMoney(sum, g._sum.amount?.toString() ?? "0"),
    toMoney(0)
  );
  const totalIncome = toMoney(incomeSum._sum.amount?.toString() ?? "0");

  const topCategories = expenseGroups
    .map((g) => ({ category: nameById.get(g.categoryId) ?? "Other", amount: toMoney(g._sum.amount?.toString() ?? "0").toString() }))
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5);

  return {
    month: start.toISOString().slice(0, 7),
    income: totalIncome.toString(),
    expenses: totalExpenses.toString(),
    savings: subtractMoney(totalIncome, totalExpenses).toString(),
    topCategories,
  };
}

async function getCategorySpending(userId: string, input: unknown) {
  const { month } = monthInput.parse(input);
  const { start, end } = monthRange(month);

  const groups = await prisma.expense.groupBy({
    by: ["categoryId"],
    where: { userId, date: { gte: start, lte: end } },
    _sum: { amount: true },
  });
  const categories = await prisma.expenseCategory.findMany({ where: { id: { in: groups.map((g) => g.categoryId) } } });
  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  return {
    month: start.toISOString().slice(0, 7),
    categories: groups
      .map((g) => ({ category: nameById.get(g.categoryId) ?? "Other", amount: toMoney(g._sum.amount?.toString() ?? "0").toString() }))
      .sort((a, b) => Number(b.amount) - Number(a.amount)),
  };
}

const expensesInput = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).nullish(),
  category: z.string().nullish(),
  limit: z.number().int().min(1).max(50).nullish(),
});

async function getExpenses(userId: string, input: unknown) {
  const { month, category, limit } = expensesInput.parse(input);
  const dateFilter = month ? monthRange(month) : null;

  const expenses = await prisma.expense.findMany({
    where: {
      userId,
      ...(dateFilter ? { date: { gte: dateFilter.start, lte: dateFilter.end } } : {}),
      ...(category ? { category: { name: { equals: category, mode: "insensitive" } } } : {}),
    },
    include: { category: true },
    orderBy: { date: "desc" },
    take: limit ?? 20,
  });

  return expenses.map((e) => ({
    description: e.description,
    amount: toMoney(e.amount.toString()).toString(),
    category: e.category.name,
    date: e.date.toISOString().slice(0, 10),
    paymentMethod: e.paymentMethod,
  }));
}

async function getIncome(userId: string, input: unknown) {
  const { month } = monthInput.parse(input);
  const { start, end } = monthRange(month);

  const incomes = await prisma.income.findMany({
    where: { userId, date: { gte: start, lte: end } },
    orderBy: { date: "desc" },
  });

  return {
    month: start.toISOString().slice(0, 7),
    total: incomes.reduce((sum, i) => addMoney(sum, i.amount.toString()), toMoney(0)).toString(),
    entries: incomes.map((i) => ({
      source: i.source,
      amount: toMoney(i.amount.toString()).toString(),
      date: i.date.toISOString().slice(0, 10),
    })),
  };
}

async function getBudgets(userId: string, input: unknown) {
  const { month } = monthInput.parse(input);
  const summary = await getMonthBudgetSummary(userId, parseMonthParam(month));
  return {
    month: summary.periodStart.slice(0, 7),
    totalBudgeted: summary.totalBudgeted,
    totalSpent: summary.totalSpent,
    budgets: summary.items
      .filter((i) => i.amount !== null)
      .map((i) => ({
        category: i.name,
        budget: i.amount,
        spent: i.spent,
        percentUsed: i.percentUsed,
        status: i.status,
      })),
  };
}

async function getGoals(userId: string) {
  const goals = await prisma.savingsGoal.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return goals.map((g) => {
    const target = toMoney(g.targetAmount.toString());
    const current = toMoney(g.currentAmount.toString());
    return {
      name: g.name,
      targetAmount: target.toString(),
      currentAmount: current.toString(),
      progressPercent: target.isZero() ? 100 : Math.min(100, Math.round(current.dividedBy(target).times(100).toNumber())),
      targetDate: g.targetDate?.toISOString().slice(0, 10) ?? null,
      isCompleted: g.isCompleted,
    };
  });
}

async function getGroupBalances(userId: string) {
  const memberships = await prisma.groupMember.findMany({
    where: { userId, isActive: true },
    include: { group: true },
  });

  const groups = await Promise.all(
    memberships.map(async (m) => {
      const balances = await computeGroupBalances(m.groupId);
      const yours = balances.find((b) => b.memberId === m.id);
      return { group: m.group.name, yourBalance: yours?.netBalance ?? "0" };
    })
  );

  return { groups: groups.filter((g) => Number(g.yourBalance) !== 0) };
}

async function getRecurringExpenses(userId: string) {
  const expenses = await prisma.expense.findMany({
    where: { userId, isRecurring: true },
    include: { category: true },
    orderBy: { date: "desc" },
    take: 20,
  });

  return expenses.map((e) => ({
    description: e.description,
    amount: toMoney(e.amount.toString()).toString(),
    category: e.category.name,
    interval: e.recurrenceInterval,
  }));
}

export function createFinancialToolExecutor(userId: string) {
  return async (name: string, input: Record<string, unknown>): Promise<unknown> => {
    switch (name) {
      case "getMonthlySummary":
        return getMonthlySummary(userId, input);
      case "getCategorySpending":
        return getCategorySpending(userId, input);
      case "getExpenses":
        return getExpenses(userId, input);
      case "getIncome":
        return getIncome(userId, input);
      case "getBudgets":
        return getBudgets(userId, input);
      case "getGoals":
        return getGoals(userId);
      case "getGroupBalances":
        return getGroupBalances(userId);
      case "getRecurringExpenses":
        return getRecurringExpenses(userId);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  };
}
