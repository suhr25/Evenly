import { z } from "zod";
import { moneyAmountSchema, nonNegativeMoneyAmountSchema } from "@/lib/validations/shared";

export const GROUP_ICONS = [
  "👥", "✈️", "🏠", "🍕", "🎉", "🏖️", "🚗", "🎓", "💼", "🎮", "❤️", "🛒",
] as const;

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required").max(100),
  icon: z.string().trim().min(1).max(8).default("👥"),
});

export const updateGroupSchema = createGroupSchema;

export const addMemberSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email").optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
});

const baseExpenseFields = {
  description: z.string().trim().min(1, "Description is required").max(200),
  amount: moneyAmountSchema,
  date: z.coerce.date(),
  categoryId: z.string().min(1, "Category is required"),
  paidByMemberId: z.string().min(1, "Choose who paid"),
};

const equalSplitSchema = z.object({
  ...baseExpenseFields,
  splitType: z.literal("EQUAL"),
  memberIds: z.array(z.string().min(1)).min(1, "Select at least one member"),
});

const exactSplitSchema = z.object({
  ...baseExpenseFields,
  splitType: z.literal("EXACT"),
  shares: z
    .array(z.object({ memberId: z.string().min(1), amount: nonNegativeMoneyAmountSchema }))
    .min(1, "Add at least one share"),
});

const percentageSplitSchema = z.object({
  ...baseExpenseFields,
  splitType: z.literal("PERCENTAGE"),
  shares: z
    .array(z.object({ memberId: z.string().min(1), percentage: z.number().min(0).max(100) }))
    .min(1, "Add at least one share"),
});

const sharesSplitSchema = z.object({
  ...baseExpenseFields,
  splitType: z.literal("SHARES"),
  shares: z
    .array(z.object({ memberId: z.string().min(1), units: z.number().int().min(1) }))
    .min(1, "Add at least one share"),
});

export const createGroupExpenseSchema = z.discriminatedUnion("splitType", [
  equalSplitSchema,
  exactSplitSchema,
  percentageSplitSchema,
  sharesSplitSchema,
]);

export const updateGroupExpenseSchema = createGroupExpenseSchema;

export const recordSettlementSchema = z
  .object({
    fromMemberId: z.string().min(1),
    toMemberId: z.string().min(1),
    amount: moneyAmountSchema,
    note: z.string().trim().max(500).optional().nullable(),
  })
  .refine((data) => data.fromMemberId !== data.toMemberId, {
    message: "Payer and recipient must be different members",
    path: ["toMemberId"],
  });

export type CreateGroupExpenseInput = z.infer<typeof createGroupExpenseSchema>;
export type RecordSettlementInput = z.infer<typeof recordSettlementSchema>;
