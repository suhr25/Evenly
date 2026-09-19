import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import {
  assertCategoryAccessible,
  assertUserCardAccessible,
  expenseInclude,
  listExpenses,
  serializeExpense,
} from "@/lib/data/expenses";
import { prisma } from "@/lib/prisma";
import { createExpenseSchema, listExpensesQuerySchema } from "@/lib/validations/expense";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const query = listExpensesQuerySchema.parse(params);

  const result = await listExpenses(session.user.id, query);
  return apiSuccess(result);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  const body = await req.json();
  const data = createExpenseSchema.parse(body);

  const categoryOk = await assertCategoryAccessible(session.user.id, data.categoryId);
  if (!categoryOk) throw new ApiError(400, "Invalid category.");

  if (data.userCardId) {
    const cardOk = await assertUserCardAccessible(session.user.id, data.userCardId);
    if (!cardOk) throw new ApiError(400, "Invalid card.");
  }

  const expense = await prisma.expense.create({
    data: {
      userId: session.user.id,
      categoryId: data.categoryId,
      userCardId: data.userCardId || null,
      isOnline: data.isOnline ?? null,
      amount: data.amount,
      description: data.description,
      date: data.date,
      paymentMethod: data.paymentMethod,
      isRecurring: data.isRecurring,
      recurrenceInterval: data.isRecurring ? data.recurrenceInterval : null,
      notes: data.notes || null,
    },
    include: expenseInclude,
  });

  return apiSuccess(serializeExpense(expense), 201);
});
