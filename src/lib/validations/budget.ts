import { z } from "zod";
import { moneyAmountSchema } from "@/lib/validations/shared";

export const upsertBudgetSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  amount: moneyAmountSchema,
  periodStart: z.coerce.date(),
});

export const monthQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM")
    .optional(),
});

export type UpsertBudgetInput = z.infer<typeof upsertBudgetSchema>;
