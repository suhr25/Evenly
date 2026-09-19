import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { serializeGoal } from "@/lib/data/goals";
import { prisma } from "@/lib/prisma";
import { upsertGoalSchema } from "@/lib/validations/goal";

const GOAL_INCLUDE = { contributions: true } as const;

export const GET = withErrorHandling(async () => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  const goals = await prisma.savingsGoal.findMany({
    where: { userId: session.user.id },
    include: GOAL_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess(goals.map(serializeGoal));
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  const data = upsertGoalSchema.parse(await req.json());

  const goal = await prisma.savingsGoal.create({
    data: {
      userId: session.user.id,
      name: data.name,
      icon: data.icon,
      targetAmount: data.targetAmount,
      currentAmount: data.currentAmount ?? "0",
      targetDate: data.targetDate ?? null,
      monthlyContribution: data.monthlyContribution ?? null,
    },
    include: GOAL_INCLUDE,
  });

  return apiSuccess(serializeGoal(goal), 201);
});
