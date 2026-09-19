import { Prisma, type Income } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { toMoney } from "@/lib/money";
import type { ListIncomeQuery } from "@/lib/validations/income";

export interface SerializedIncome {
  id: string;
  amount: string;
  source: string;
  date: string;
  isRecurring: boolean;
  recurrenceInterval: string | null;
  createdAt: string;
}

export interface ListIncomeResult {
  income: SerializedIncome[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listIncome(userId: string, query: ListIncomeQuery): Promise<ListIncomeResult> {
  const where: Prisma.IncomeWhereInput = {
    userId,
    ...(query.search ? { source: { contains: query.search, mode: "insensitive" as const } } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          date: {
            ...(query.dateFrom ? { gte: query.dateFrom } : {}),
            ...(query.dateTo ? { lte: query.dateTo } : {}),
          },
        }
      : {}),
  };

  const [total, income] = await Promise.all([
    prisma.income.count({ where }),
    prisma.income.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortOrder },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return {
    income: income.map(serializeIncome),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export function serializeIncome(income: Income): SerializedIncome {
  return {
    id: income.id,
    amount: toMoney(income.amount.toString()).toString(),
    source: income.source,
    date: income.date.toISOString(),
    isRecurring: income.isRecurring,
    recurrenceInterval: income.recurrenceInterval,
    createdAt: income.createdAt.toISOString(),
  };
}
