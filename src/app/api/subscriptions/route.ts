import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { serializeSubscription, syncDetectedSubscriptions } from "@/lib/data/subscriptions";
import { prisma } from "@/lib/prisma";

export const GET = withErrorHandling(async () => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  await syncDetectedSubscriptions(session.user.id);

  const subscriptions = await prisma.subscription.findMany({
    where: { userId: session.user.id, status: { not: "INACTIVE" } },
    orderBy: { amount: "desc" },
  });

  return apiSuccess(subscriptions.map(serializeSubscription));
});
