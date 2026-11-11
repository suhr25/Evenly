import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { capturePayPalPayment } from "@/lib/paypal/payments";
import { rateLimit } from "@/lib/rate-limit";
import { capturePayPalOrderSchema } from "@/lib/validations/paypal";

/**
 * PayPal Sandbox demo: capture an approved order, verify it, and only then record the
 * settlement. Safe to call repeatedly for the same order (retries reconcile, never re-charge).
 */
export const POST = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    if (!rateLimit(`paypal-capture:${session.user.id}`, 30, 60_000)) {
      throw new ApiError(429, "Too many requests. Please wait a moment.");
    }

    const { id } = await ctx.params;
    const data = capturePayPalOrderSchema.parse(await req.json().catch(() => ({})));

    const result = await capturePayPalPayment({
      userId: session.user.id,
      groupId: id,
      orderId: data.orderId,
    });
    return apiSuccess(result, result.status === "CAPTURE_PENDING" ? 202 : 200);
  }
);
