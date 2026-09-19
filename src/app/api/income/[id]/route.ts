import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { serializeIncome } from "@/lib/data/income";
import { prisma } from "@/lib/prisma";
import { updateIncomeSchema } from "@/lib/validations/income";

async function getOwnedIncome(userId: string, id: string) {
  const income = await prisma.income.findUnique({ where: { id } });
  if (!income || income.userId !== userId) {
    throw new ApiError(404, "Income entry not found.");
  }
  return income;
}

export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id } = await ctx.params;
    await getOwnedIncome(session.user.id, id);

    const data = updateIncomeSchema.parse(await req.json());

    const income = await prisma.income.update({
      where: { id },
      data: {
        amount: data.amount,
        source: data.source,
        date: data.date,
        isRecurring: data.isRecurring,
        recurrenceInterval: data.isRecurring ? data.recurrenceInterval : null,
      },
    });

    return apiSuccess(serializeIncome(income));
  }
);

export const DELETE = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id } = await ctx.params;
    await getOwnedIncome(session.user.id, id);

    await prisma.income.delete({ where: { id } });
    return apiSuccess({ id });
  }
);
