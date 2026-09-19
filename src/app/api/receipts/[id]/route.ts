import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/storage";

export const DELETE = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id } = await ctx.params;
    const receipt = await prisma.receipt.findUnique({ where: { id }, include: { groupExpense: true } });
    if (!receipt || receipt.userId !== session.user.id) throw new ApiError(404, "Receipt not found.");
    if (receipt.groupExpense) throw new ApiError(409, "This receipt is already linked to an expense.");

    await prisma.receipt.delete({ where: { id } });
    await getStorageProvider().delete(receipt.imageKey);

    return apiSuccess({ id });
  }
);
