import { z } from "zod";

// Deliberately minimal: amount, currency and payer identity are never accepted from the client.
export const createPayPalOrderSchema = z.object({
  toMemberId: z.string().trim().min(1).max(64),
});

export const capturePayPalOrderSchema = z.object({
  orderId: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid order id"),
});
