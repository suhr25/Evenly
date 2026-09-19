import { z } from "zod";
import { moneyAmountSchema } from "@/lib/validations/shared";

export const recommendationRequestSchema = z.object({
  amount: moneyAmountSchema,
  categoryId: z.string().nullish(),
  channel: z.enum(["ONLINE", "OFFLINE"]).default("OFFLINE"),
});

export type RecommendationRequest = z.infer<typeof recommendationRequestSchema>;
