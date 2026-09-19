import { z } from "zod";

export const CURRENCIES = ["INR", "USD", "EUR", "GBP"] as const;

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+\d][\d\s\-()]{6,19}$/, "Enter a valid phone number")
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));

const upiIdSchema = z
  .string()
  .trim()
  .regex(/^[\w.\-]{2,100}@[a-zA-Z]{2,64}$/, "Enter a valid UPI ID, e.g. name@bank")
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  currency: z.enum(CURRENCIES),
  phone: phoneSchema,
  upiId: upiIdSchema,
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
