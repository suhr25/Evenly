import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { getOwnedUserCard, serializeUserCard } from "@/lib/data/cards";
import { prisma } from "@/lib/prisma";
import { updateUserCardSchema } from "@/lib/validations/card";

export const GET = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id } = await ctx.params;
    const card = await getOwnedUserCard(session.user.id, id);
    return apiSuccess(serializeUserCard(card));
  }
);

export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id } = await ctx.params;
    await getOwnedUserCard(session.user.id, id);

    const data = updateUserCardSchema.parse(await req.json());

    await prisma.userCard.update({
      where: { id },
      data: {
        nickname: data.nickname ?? null,
        lastFourDigits: data.lastFourDigits ?? null,
        creditLimit: data.creditLimit ?? null,
        outstanding: data.outstanding ?? null,
        rewardBalance: data.rewardBalance ?? null,
        statementDate: data.statementDate ?? null,
        paymentDueDate: data.paymentDueDate ?? null,
        // Manual edits always mean this field's source is MANUAL from now on, even if a
        // future AA sync previously set it. The user is asserting the current truth.
        creditLimitSource: "MANUAL",
        outstandingSource: "MANUAL",
        rewardBalanceSource: "MANUAL",
      },
    });

    const updated = await getOwnedUserCard(session.user.id, id);
    return apiSuccess(serializeUserCard(updated));
  }
);

export const DELETE = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id } = await ctx.params;
    await getOwnedUserCard(session.user.id, id);

    await prisma.userCard.delete({ where: { id } });
    return apiSuccess({ id });
  }
);
