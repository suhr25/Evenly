import { z } from "zod";
import { moneyAmountSchema } from "@/lib/validations/shared";
import { RECURRENCE_INTERVALS } from "@/lib/validations/expense";

export const createIncomeSchema = z
  .object({
    amount: moneyAmountSchema,
    source: z.string().trim().min(1, "Source is required").max(200),
    date: z.coerce.date(),
    isRecurring: z.boolean().default(false),
    recurrenceInterval: z.enum(RECURRENCE_INTERVALS).nullable().optional(),
  })
  .refine((data) => !data.isRecurring || Boolean(data.recurrenceInterval), {
    message: "Recurrence interval is required for recurring income",
    path: ["recurrenceInterval"],
  });

export const updateIncomeSchema = createIncomeSchema;

export const listIncomeQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(["date", "amount", "source"]).default("date"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateIncomeInput = z.infer<typeof createIncomeSchema>;
export type ListIncomeQuery = z.infer<typeof listIncomeQuerySchema>;
