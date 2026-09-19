import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { toMoney } from "@/lib/money";
import type { ListExpensesQuery } from "@/lib/validations/expense";

export interface SerializedExpense {
  id: string;
  amount: string;
  description: string;
  date: string;
  paymentMethod: string;
  isRecurring: boolean;
  recurrenceInterval: string | null;
  notes: string | null;
  category: { id: string; name: string; icon: string; color: string };
  userCard: { id: string; label: string } | null;
  isOnline: boolean | null;
  group: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

const expenseInclude = {
  category: true,
  userCard: { include: { cardProduct: { include: { issuer: true } } } },
  groupExpense: { include: { group: { select: { id: true, name: true } } } },
} satisfies Prisma.ExpenseInclude;

type ExpenseWithRelations = Prisma.ExpenseGetPayload<{ include: typeof expenseInclude }>;

export interface ListExpensesResult {
  expenses: SerializedExpense[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listExpenses(
  userId: string,
  query: ListExpensesQuery
): Promise<ListExpensesResult> {
  const where: Prisma.ExpenseWhereInput = {
    userId,
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.userCardId ? { userCardId: query.userCardId } : {}),
    ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
    ...(query.search
      ? { description: { contains: query.search, mode: "insensitive" as const } }
      : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          date: {
            ...(query.dateFrom ? { gte: query.dateFrom } : {}),
            ...(query.dateTo ? { lte: query.dateTo } : {}),
          },
        }
      : {}),
  };

  const [total, expenses] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      include: expenseInclude,
      orderBy: { [query.sortBy]: query.sortOrder },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return {
    expenses: expenses.map(serializeExpense),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export function serializeExpense(expense: ExpenseWithRelations): SerializedExpense {
  return {
    id: expense.id,
    amount: toMoney(expense.amount.toString()).toString(),
    description: expense.description,
    date: expense.date.toISOString(),
    paymentMethod: expense.paymentMethod,
    isRecurring: expense.isRecurring,
    recurrenceInterval: expense.recurrenceInterval,
    notes: expense.notes,
    category: {
      id: expense.category.id,
      name: expense.category.name,
      icon: expense.category.icon,
      color: expense.category.color,
    },
    userCard: expense.userCard
      ? {
          id: expense.userCard.id,
          label:
            expense.userCard.nickname ||
            `${expense.userCard.cardProduct.issuer.name} ${expense.userCard.cardProduct.name}`,
        }
      : null,
    isOnline: expense.isOnline,
    group: expense.groupExpense ? { id: expense.groupExpense.group.id, name: expense.groupExpense.group.name } : null,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  };
}

export async function assertCategoryAccessible(userId: string, categoryId: string) {
  const category = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, OR: [{ userId: null }, { userId }] },
  });
  return category !== null;
}

export async function assertUserCardAccessible(userId: string, userCardId: string) {
  const card = await prisma.userCard.findFirst({ where: { id: userCardId, userId } });
  return card !== null;
}

export { expenseInclude };
