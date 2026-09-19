import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { serializeGoal } from "@/lib/data/goals";
import { prisma } from "@/lib/prisma";
import { upsertGoalSchema } from "@/lib/validations/goal";

const GOAL_INCLUDE = { contributions: true } as const;

async function getOwnedGoal(userId: string, id: string) {
  const goal = await prisma.savingsGoal.findUnique({ where: { id } });
  if (!goal || goal.userId !== userId) throw new ApiError(404, "Goal not found.");
  return goal;
}

export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id } = await ctx.params;
    await getOwnedGoal(session.user.id, id);

    const data = upsertGoalSchema.parse(await req.json());

    const goal = await prisma.savingsGoal.update({
      where: { id },
      data: {
        name: data.name,
        icon: data.icon,
        targetAmount: data.targetAmount,
        ...(data.currentAmount !== undefined ? { currentAmount: data.currentAmount } : {}),
        targetDate: data.targetDate ?? null,
        monthlyContribution: data.monthlyContribution ?? null,
      },
      include: GOAL_INCLUDE,
    });

    return apiSuccess(serializeGoal(goal));
  }
);

export const DELETE = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id } = await ctx.params;
    await getOwnedGoal(session.user.id, id);

    await prisma.savingsGoal.delete({ where: { id } });
    return apiSuccess({ id });
  }
);
