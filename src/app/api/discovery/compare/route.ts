import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { compareCards } from "@/lib/data/discovery";
import { compareCardsSchema } from "@/lib/validations/discovery";

// Explicitly labels each compared card as owned or not. A user comparing their own cards
// against ones they don't have must never be left thinking an unowned card is already theirs.
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  const data = compareCardsSchema.parse(await req.json());
  const comparison = await compareCards(session.user.id, data.cardProductIds);
  return apiSuccess(comparison);
});
