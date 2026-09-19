import { z } from "zod";
import { moneyAmountSchema } from "@/lib/validations/shared";

export const estimateRewardQuerySchema = z.object({
  amount: moneyAmountSchema,
  categoryId: z.string().nullish(),
  channel: z.enum(["ONLINE", "OFFLINE"]).default("OFFLINE"),
  excludeExpenseId: z.string().nullish(),
});

export type EstimateRewardQuery = z.infer<typeof estimateRewardQuerySchema>;
