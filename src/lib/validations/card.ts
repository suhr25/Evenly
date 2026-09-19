import { z } from "zod";
import { nonNegativeMoneyAmountSchema } from "@/lib/validations/shared";

export const listCardProductsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
});

const dayOfMonthSchema = z.coerce.number().int().min(1).max(31).nullish();

export const createUserCardSchema = z.object({
  cardProductId: z.string().min(1, "Choose a card"),
  nickname: z.string().trim().max(100).nullish(),
  lastFourDigits: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Enter exactly 4 digits")
    .nullish()
    .or(z.literal("").transform(() => null)),
  creditLimit: nonNegativeMoneyAmountSchema.nullish(),
  outstanding: nonNegativeMoneyAmountSchema.nullish(),
  rewardBalance: nonNegativeMoneyAmountSchema.nullish(),
  statementDate: dayOfMonthSchema,
  paymentDueDate: dayOfMonthSchema,
});

export const updateUserCardSchema = createUserCardSchema.omit({ cardProductId: true });

export type CreateUserCardInput = z.infer<typeof createUserCardSchema>;
export type UpdateUserCardInput = z.infer<typeof updateUserCardSchema>;
