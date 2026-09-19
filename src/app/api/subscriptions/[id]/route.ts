import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { serializeSubscription } from "@/lib/data/subscriptions";
import { prisma } from "@/lib/prisma";
import { updateSubscriptionSchema } from "@/lib/validations/subscription";

export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id } = await ctx.params;
    const existing = await prisma.subscription.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      throw new ApiError(404, "Subscription not found.");
    }

    const data = updateSubscriptionSchema.parse(await req.json());

    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        ...(data.status ? { status: data.status } : {}),
        ...(data.displayName !== undefined ? { displayName: data.displayName || null } : {}),
      },
    });

    return apiSuccess(serializeSubscription(updated));
  }
);
