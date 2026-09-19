import { z } from "zod";
import { nonNegativeMoneyAmountSchema } from "@/lib/validations/shared";

export const receiptItemInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().positive().max(1000),
  unitPrice: nonNegativeMoneyAmountSchema,
  totalPrice: nonNegativeMoneyAmountSchema,
});

export const confirmReceiptSchema = z.object({
  groupId: z.string().min(1),
  categoryId: z.string().min(1),
  paidByMemberId: z.string().min(1),
  description: z.string().trim().min(1).max(200),
  date: z.coerce.date(),
  merchant: z.string().trim().max(200).optional().nullable(),
  items: z.array(receiptItemInputSchema).min(1, "Add at least one item"),
  subtotal: nonNegativeMoneyAmountSchema.optional().nullable(),
  tax: nonNegativeMoneyAmountSchema.optional().nullable(),
  discount: nonNegativeMoneyAmountSchema.optional().nullable(),
  tip: nonNegativeMoneyAmountSchema.optional().nullable(),
  total: nonNegativeMoneyAmountSchema,
  itemAssignments: z
    .array(z.object({ itemIndex: z.number().int().min(0), memberIds: z.array(z.string().min(1)) }))
    .min(1),
});

export type ConfirmReceiptInput = z.infer<typeof confirmReceiptSchema>;
