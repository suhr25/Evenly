import { z } from "zod";
import { moneyAmountSchema, nonNegativeMoneyAmountSchema } from "@/lib/validations/shared";

export const GOAL_ICONS = [
  "🎯", "🚗", "💻", "🏖️", "🏠", "🎓", "💍", "👶", "🚨", "✈️", "📱", "🛡️",
] as const;

export const upsertGoalSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  icon: z.string().trim().min(1).max(8).default("🎯"),
  targetAmount: moneyAmountSchema,
  // A brand-new goal legitimately starts at ₹0 saved, so this allows zero
  // unlike targetAmount/monthlyContribution which must be positive.
  currentAmount: nonNegativeMoneyAmountSchema.optional(),
  targetDate: z.coerce.date().nullable().optional(),
  monthlyContribution: moneyAmountSchema.nullable().optional(),
});

export const addContributionSchema = z.object({
  amount: moneyAmountSchema,
  note: z.string().trim().max(200).optional().nullable(),
});

export type UpsertGoalInput = z.infer<typeof upsertGoalSchema>;
