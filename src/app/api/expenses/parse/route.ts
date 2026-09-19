import { NextRequest } from "next/server";
import { getAIProvider } from "@/lib/ai";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { parseExpenseTextSchema } from "@/lib/validations/expense";

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  if (!rateLimit(`expense-parse:${session.user.id}`, 20, 60_000)) {
    throw new ApiError(429, "Too many requests. Please slow down.");
  }

  const { text } = parseExpenseTextSchema.parse(await req.json());

  const categories = await prisma.expenseCategory.findMany({
    where: { OR: [{ userId: null }, { userId: session.user.id }] },
    select: { id: true, name: true },
  });

  const parsed = await getAIProvider().parseExpenseText(
    text,
    categories.map((c) => c.name)
  );

  const matchedCategory =
    categories.find((c) => c.name.toLowerCase() === parsed.category.toLowerCase()) ??
    categories.find((c) => c.name === "Other") ??
    categories[0];

  return apiSuccess({
    amount: parsed.amount > 0 ? parsed.amount.toFixed(2) : "",
    description: parsed.description,
    categoryId: matchedCategory?.id ?? "",
  });
});
