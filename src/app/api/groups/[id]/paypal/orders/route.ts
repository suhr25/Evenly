import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { createPayPalPayment } from "@/lib/paypal/payments";
import { rateLimit } from "@/lib/rate-limit";
import { createPayPalOrderSchema } from "@/lib/validations/paypal";

/** PayPal Sandbox demo: create (or reuse) an order for the caller's current suggested settlement. */
export const POST = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    if (!rateLimit(`paypal-order:${session.user.id}`, 20, 60_000)) {
      throw new ApiError(429, "Too many requests. Please wait a moment.");
    }

    const { id } = await ctx.params;
    const data = createPayPalOrderSchema.parse(await req.json().catch(() => ({})));

    const payment = await createPayPalPayment({
      userId: session.user.id,
      groupId: id,
      toMemberId: data.toMemberId,
    });
    return apiSuccess(payment, 201);
  }
);
