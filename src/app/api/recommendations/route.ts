import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { recommendBestCard } from "@/lib/data/recommendations";
import { recommendationRequestSchema } from "@/lib/validations/recommendation";

// Portfolio Mode only: recommends the best of the user's OWNED cards for a transaction.
// Discovery Mode (cards the user doesn't own) is a separate, explicit feature. Never
// blended into this endpoint.
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  const data = recommendationRequestSchema.parse(await req.json());

  const recommendation = await recommendBestCard(session.user.id, {
    amount: data.amount,
    categoryId: data.categoryId ?? null,
    channel: data.channel,
  });

  return apiSuccess(recommendation);
});
