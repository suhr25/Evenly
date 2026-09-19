import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { listDiscoverableCardProducts } from "@/lib/data/discovery";
import { listDiscoverableCardsQuerySchema } from "@/lib/validations/discovery";

// Discovery Mode: cards this user does NOT own. Never called from any Portfolio Mode surface
// (My Cards, Best Card). This is the one route in the app allowed to return an unowned card.
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  const { search } = listDiscoverableCardsQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const cards = await listDiscoverableCardProducts(session.user.id, search);
  return apiSuccess(cards);
});
