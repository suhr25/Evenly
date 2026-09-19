import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { listIncome, serializeIncome } from "@/lib/data/income";
import { prisma } from "@/lib/prisma";
import { createIncomeSchema, listIncomeQuerySchema } from "@/lib/validations/income";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const query = listIncomeQuerySchema.parse(params);

  const result = await listIncome(session.user.id, query);
  return apiSuccess(result);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  const data = createIncomeSchema.parse(await req.json());

  const income = await prisma.income.create({
    data: {
      userId: session.user.id,
      amount: data.amount,
      source: data.source,
      date: data.date,
      isRecurring: data.isRecurring,
      recurrenceInterval: data.isRecurring ? data.recurrenceInterval : null,
    },
  });

  return apiSuccess(serializeIncome(income), 201);
});
