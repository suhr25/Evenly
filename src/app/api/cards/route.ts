import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { getOwnedUserCard, listUserCards, serializeUserCard } from "@/lib/data/cards";
import { prisma } from "@/lib/prisma";
import { createUserCardSchema } from "@/lib/validations/card";

// Portfolio Mode entry point: every card this user owns, and nothing else.
export const GET = withErrorHandling(async () => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  const cards = await listUserCards(session.user.id);
  return apiSuccess(cards);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  const data = createUserCardSchema.parse(await req.json());

  const product = await prisma.cardProduct.findUnique({ where: { id: data.cardProductId } });
  if (!product) throw new ApiError(404, "Card not found in the catalog.");

  const created = await prisma.userCard.create({
    data: {
      userId: session.user.id,
      cardProductId: data.cardProductId,
      nickname: data.nickname ?? null,
      lastFourDigits: data.lastFourDigits ?? null,
      creditLimit: data.creditLimit ?? null,
      outstanding: data.outstanding ?? null,
      rewardBalance: data.rewardBalance ?? null,
      statementDate: data.statementDate ?? null,
      paymentDueDate: data.paymentDueDate ?? null,
    },
  });

  const withRelations = await getOwnedUserCard(session.user.id, created.id);
  return apiSuccess(serializeUserCard(withRelations), 201);
});
