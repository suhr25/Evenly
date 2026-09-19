import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { apiError, apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { signupSchema } from "@/lib/validations/auth";

export const POST = withErrorHandling(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(`signup:${ip}`, 5, 60_000)) {
    return apiError(429, "Too many signup attempts. Please try again in a minute.");
  }

  const body = await req.json();
  const { name, email, password } = signupSchema.parse(body);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(409, "An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
    select: { id: true, name: true, email: true },
  });

  return apiSuccess(user, 201);
});
