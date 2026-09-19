import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { getMonthBudgetSummary, parseMonthParam } from "@/lib/data/budgets";
import { assertCategoryAccessible } from "@/lib/data/expenses";
import { prisma } from "@/lib/prisma";
import { monthQuerySchema, upsertBudgetSchema } from "@/lib/validations/budget";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  const { month } = monthQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const periodStart = parseMonthParam(month);

  const summary = await getMonthBudgetSummary(session.user.id, periodStart);
  return apiSuccess(summary);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  const data = upsertBudgetSchema.parse(await req.json());

  const categoryOk = await assertCategoryAccessible(session.user.id, data.categoryId);
  if (!categoryOk) throw new ApiError(400, "Invalid category.");

  const budget = await prisma.budget.upsert({
    where: {
      userId_categoryId_periodStart: {
        userId: session.user.id,
        categoryId: data.categoryId,
        periodStart: data.periodStart,
      },
    },
    update: { amount: data.amount },
    create: {
      userId: session.user.id,
      categoryId: data.categoryId,
      amount: data.amount,
      periodStart: data.periodStart,
    },
  });

  return apiSuccess({ id: budget.id }, 201);
});
