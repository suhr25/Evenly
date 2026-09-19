import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import {
  assertCategoryAccessible,
  assertUserCardAccessible,
  expenseInclude,
  serializeExpense,
} from "@/lib/data/expenses";
import { prisma } from "@/lib/prisma";
import { updateExpenseSchema } from "@/lib/validations/expense";

async function getOwnedExpense(userId: string, id: string) {
  const expense = await prisma.expense.findUnique({ where: { id }, include: expenseInclude });
  if (!expense || expense.userId !== userId) {
    throw new ApiError(404, "Expense not found.");
  }
  return expense;
}

export const GET = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id } = await ctx.params;
    const expense = await getOwnedExpense(session.user.id, id);
    return apiSuccess(serializeExpense(expense));
  }
);

export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id } = await ctx.params;
    const existing = await getOwnedExpense(session.user.id, id);
    if (existing.groupExpenseId) {
      throw new ApiError(400, "This expense is synced from a group and can only be edited from the group.");
    }

    const body = await req.json();
    const data = updateExpenseSchema.parse(body);

    const categoryOk = await assertCategoryAccessible(session.user.id, data.categoryId);
    if (!categoryOk) throw new ApiError(400, "Invalid category.");

    if (data.userCardId) {
      const cardOk = await assertUserCardAccessible(session.user.id, data.userCardId);
      if (!cardOk) throw new ApiError(400, "Invalid card.");
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: {
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

    return apiSuccess(serializeExpense(expense));
  }
);

export const DELETE = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id } = await ctx.params;
    const existing = await getOwnedExpense(session.user.id, id);
    if (existing.groupExpenseId) {
      throw new ApiError(
        400,
        "This expense is synced from a group. Remove it from the group's expenses to remove it here too."
      );
    }

    await prisma.expense.delete({ where: { id } });
    return apiSuccess({ id });
  }
);
