import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { estimateRewardForCard } from "@/lib/data/reward-estimates";
import { estimateRewardQuerySchema } from "@/lib/validations/reward-estimate";

// Phase 4: single-card reward estimate, with cap awareness. This is the calculation the
// eventual Phase 5 "which card should I use" recommendation runs once per owned card. This
// route exists on its own now so the reward engine has a real, independently testable
// surface before any cross-card ranking is built on top of it.
export const GET = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id } = await ctx.params;
    const query = estimateRewardQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));

    const estimate = await estimateRewardForCard(session.user.id, id, {
      amount: query.amount,
      categoryId: query.categoryId ?? null,
      channel: query.channel,
      excludeExpenseId: query.excludeExpenseId ?? undefined,
    });

    return apiSuccess(estimate);
  }
);
