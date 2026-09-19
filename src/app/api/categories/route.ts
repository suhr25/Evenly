import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const GET = withErrorHandling(async () => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  const categories = await prisma.expenseCategory.findMany({
    where: { OR: [{ userId: null }, { userId: session.user.id }] },
    orderBy: { name: "asc" },
    select: { id: true, name: true, icon: true, color: true },
  });

  return apiSuccess(categories);
});
