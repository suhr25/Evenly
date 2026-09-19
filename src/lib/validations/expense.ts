import { z } from "zod";
import { moneyAmountSchema } from "@/lib/validations/shared";

export const PAYMENT_METHODS = ["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"] as const;
export const RECURRENCE_INTERVALS = ["WEEKLY", "MONTHLY", "YEARLY"] as const;

export const createExpenseSchema = z
  .object({
    amount: moneyAmountSchema,
    categoryId: z.string().min(1, "Category is required"),
    userCardId: z.string().nullish(),
    isOnline: z.boolean().nullish(),
    description: z.string().trim().min(1, "Description is required").max(200),
    date: z.coerce.date(),
    paymentMethod: z.enum(PAYMENT_METHODS).default("CASH"),
    isRecurring: z.boolean().default(false),
    recurrenceInterval: z.enum(RECURRENCE_INTERVALS).nullable().optional(),
    notes: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((data) => !data.isRecurring || Boolean(data.recurrenceInterval), {
    message: "Recurrence interval is required for recurring expenses",
    path: ["recurrenceInterval"],
  });

export const updateExpenseSchema = createExpenseSchema;

export const listExpensesQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  categoryId: z.string().optional(),
  userCardId: z.string().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(["date", "amount", "description"]).default("date"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const parseExpenseTextSchema = z.object({
  text: z.string().trim().min(1).max(500),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;
