import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { recommendDiscoveryCard } from "@/lib/data/discovery";
import { discoveryRecommendationSchema } from "@/lib/validations/discovery";

// Discovery Mode only. Ranks cards the user does NOT own for a hypothetical transaction
// (e.g. "recommend a new travel card"). Structurally distinct from POST /api/recommendations,
// which only ever ranks owned cards. Never merge these two endpoints.
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  const data = discoveryRecommendationSchema.parse(await req.json());
  const top = await recommendDiscoveryCard(session.user.id, {
    amount: data.amount,
    categoryId: data.categoryId ?? null,
    channel: data.channel,
  });

  return apiSuccess({ top });
});
