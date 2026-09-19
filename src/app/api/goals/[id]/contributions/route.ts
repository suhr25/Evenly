import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { serializeGoal } from "@/lib/data/goals";
import { addMoney, toMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { addContributionSchema } from "@/lib/validations/goal";

const GOAL_INCLUDE = { contributions: true } as const;

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id } = await ctx.params;
    const goal = await prisma.savingsGoal.findUnique({ where: { id } });
    if (!goal || goal.userId !== session.user.id) throw new ApiError(404, "Goal not found.");

    const data = addContributionSchema.parse(await req.json());

    const newCurrentAmount = addMoney(goal.currentAmount.toString(), data.amount);
    const isCompleted = !toMoney(newCurrentAmount).lessThan(toMoney(goal.targetAmount.toString()));

    const [, updatedGoal] = await prisma.$transaction([
      prisma.goalContribution.create({
        data: { goalId: id, amount: data.amount, note: data.note || null },
      }),
      prisma.savingsGoal.update({
        where: { id },
        data: { currentAmount: newCurrentAmount.toString(), isCompleted },
        include: GOAL_INCLUDE,
      }),
    ]);

    return apiSuccess(serializeGoal(updatedGoal), 201);
  }
);
