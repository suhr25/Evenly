import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { updateProfileSchema } from "@/lib/validations/user";

export const PATCH = withErrorHandling(async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user) {
    throw new ApiError(401, "You must be logged in.");
  }

  const body = await req.json();
  const data = updateProfileSchema.parse(body);

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: { id: true, name: true, email: true, currency: true, phone: true, upiId: true },
  });

  return apiSuccess(user);
});
