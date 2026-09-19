import { z } from "zod";

/** A positive money amount, max 2 decimal places, as a string for Decimal-safe transport. */
export const moneyAmountSchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) > 0 && Number(v) < 100_000_000, {
    message: "Enter a valid amount greater than 0",
  });

/** Same as above but allows 0, used for individual exact-split shares. */
export const nonNegativeMoneyAmountSchema = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) >= 0 && Number(v) < 100_000_000, {
    message: "Enter a valid non-negative amount",
  });
