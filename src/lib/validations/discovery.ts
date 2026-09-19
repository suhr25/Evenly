import { z } from "zod";
import { moneyAmountSchema } from "@/lib/validations/shared";

export const listDiscoverableCardsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
});

export const discoveryRecommendationSchema = z.object({
  amount: moneyAmountSchema,
  categoryId: z.string().nullish(),
  channel: z.enum(["ONLINE", "OFFLINE"]).default("OFFLINE"),
});

export const compareCardsSchema = z.object({
  cardProductIds: z.array(z.string().min(1)).min(2, "Choose at least 2 cards to compare").max(6),
});
