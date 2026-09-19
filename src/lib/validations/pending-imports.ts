import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/validations/expense";

export const confirmPendingImportSchema = z.object({
  as: z.enum(["expense", "income"]),
  categoryId: z.string().min(1).nullish(),
  paymentMethod: z.enum(PAYMENT_METHODS).nullish(),
  description: z.string().trim().min(1).max(200).nullish(),
});

export type ConfirmPendingImportInput = z.infer<typeof confirmPendingImportSchema>;
