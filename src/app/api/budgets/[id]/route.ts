import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const DELETE = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id } = await ctx.params;
    const budget = await prisma.budget.findUnique({ where: { id } });
    if (!budget || budget.userId !== session.user.id) {
      throw new ApiError(404, "Budget not found.");
    }

    await prisma.budget.delete({ where: { id } });
    return apiSuccess({ id });
  }
);
