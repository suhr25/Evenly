import type { ImportedTransaction } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api-response";
import { toMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  assertCategoryAccessible,
  expenseInclude,
  serializeExpense,
} from "@/lib/data/expenses";
import { serializeIncome } from "@/lib/data/income";
import { requireGroupMembership, syncGroupExpenseToPersonalExpenses } from "@/lib/data/groups";
import { categoriseMerchant } from "@/lib/merchant-category";
import { fromMinorUnits, toMinorUnits } from "@/lib/money";
import type { ParsedTransaction } from "@/lib/transaction-parser";
import type { ConfirmPendingImportInput } from "@/lib/validations/pending-imports";

export interface SerializedPendingImport {
  id: string;
  direction: "DEBIT" | "CREDIT";
  amount: string;
  merchant: string | null;
  bankName: string | null;
  lastFourDigits: string | null;
  occurredAt: string;
  rawSnippet: string;
  createdAt: string;
}

function serializePendingImport(row: ImportedTransaction): SerializedPendingImport {
  return {
    id: row.id,
    direction: row.direction as "DEBIT" | "CREDIT",
    amount: toMoney(row.amount.toString()).toString(),
    merchant: row.merchant,
    bankName: row.bankName,
    lastFourDigits: row.lastFourDigits,
    occurredAt: row.occurredAt.toISOString(),
    rawSnippet: row.rawSnippet,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listPendingImports(userId: string): Promise<SerializedPendingImport[]> {
  const rows = await prisma.importedTransaction.findMany({
    where: { userId, status: "PENDING" },
    orderBy: { occurredAt: "desc" },
  });
  return rows.map(serializePendingImport);
}

/**
 * Records a parsed transaction from a Gmail message as a pending import.
 * Never touches Expense/Income directly. A regex parse of an email is never
 * treated as ground truth on its own; it only becomes a real record once the
 * user confirms it. Returns true when this message produced a new pending
 * row: existing rows are left untouched whatever their status, so a re-scan
 * never resurrects a transaction the user already confirmed or dismissed.
 */
export async function recordParsedTransaction(
  userId: string,
  gmailMessageId: string,
  parsed: ParsedTransaction,
  occurredAt: Date,
  rawSnippet: string
): Promise<boolean> {
  const existing = await prisma.importedTransaction.findUnique({
    where: { userId_gmailMessageId: { userId, gmailMessageId } },
    select: { id: true },
  });
  if (existing) return false;

  await prisma.importedTransaction.create({
    data: {
      userId,
      gmailMessageId,
      direction: parsed.direction,
      amount: parsed.amount,
      merchant: parsed.merchant,
      bankName: parsed.bankName,
      lastFourDigits: parsed.lastFourDigits,
      occurredAt,
      rawSnippet: rawSnippet.slice(0, 2000),
      status: "PENDING",
    },
  });
  return true;
}

/**
 * Confirms every pending import at once: debits become expenses, credits
 * become income. Each row is confirmed independently so one bad row can't
 * block the rest of a sync from landing.
 */
export async function confirmAllPendingImports(
  userId: string
): Promise<{ expenses: number; income: number; failed: number }> {
  const pending = await prisma.importedTransaction.findMany({
    where: { userId, status: "PENDING" },
  });

  let expenses = 0;
  let income = 0;
  let failed = 0;

  for (const row of pending) {
    try {
      const result = await confirmPendingImport(userId, row.id, {
        as: row.direction === "DEBIT" ? "expense" : "income",
      });
      if (result.as === "expense") expenses += 1;
      else income += 1;
    } catch (err) {
      console.error("[confirm-all-imports]", row.id, err);
      failed += 1;
    }
  }

  return { expenses, income, failed };
}

export async function dismissPendingImport(userId: string, id: string): Promise<void> {
  const result = await prisma.importedTransaction.updateMany({
    where: { id, userId, status: "PENDING" },
    data: { status: "DISMISSED" },
  });
  if (result.count === 0) throw new ApiError(404, "Import not found.");
}

/**
 * Resolves the category for an imported transaction, in priority order:
 *
 *   1. What the user explicitly picked, always.
 *   2. A keyword match on the merchant name ("Zepto" -> Grocery).
 *   3. "Other", so confirming never hard-blocks on a dropdown.
 *
 * Step 2 is what stops every imported transaction landing in "Other" and
 * making budgets useless. It only ever fires when the user has not chosen,
 * so it can never override an explicit decision.
 */
async function resolveCategoryId(
  userId: string,
  requested: string | null | undefined,
  merchant: string | null
): Promise<string> {
  if (requested) {
    const ok = await assertCategoryAccessible(userId, requested);
    if (!ok) throw new ApiError(400, "Invalid category.");
    return requested;
  }

  const guess = categoriseMerchant(merchant);
  if (guess) {
    const matched = await prisma.expenseCategory.findFirst({
      where: { name: guess, OR: [{ userId }, { userId: null }] },
      orderBy: { userId: "desc" },
    });
    if (matched) return matched.id;
  }

  const fallback = await prisma.expenseCategory.findFirst({
    where: { name: "Other", OR: [{ userId }, { userId: null }] },
    orderBy: { userId: "desc" },
  });
  if (!fallback) throw new ApiError(400, "Choose a category for this expense.");
  return fallback.id;
}

/**
 * Routes an imported transaction into a group as a shared expense, split
 * equally across active members, rather than booking it as a solo expense.
 *
 * The user's own share flows back into their personal expenses through the
 * existing group-sync path, so the amount is counted once and only once: the
 * group ledger holds the full amount, the personal ledger holds their share.
 */
async function confirmIntoGroup(
  userId: string,
  pending: ImportedTransaction,
  groupId: string,
  categoryId: string,
  description: string
) {
  const membership = await requireGroupMembership(userId, groupId);

  const activeMembers = await prisma.groupMember.findMany({
    where: { groupId, isActive: true },
    select: { id: true },
  });
  if (activeMembers.length === 0) {
    throw new ApiError(400, "That group has no active members to split with.");
  }

  // Equal split in integer paise so the shares always re-sum to the total,
  // with the remainder handed to the earliest members rather than dropped.
  const totalMinor = toMinorUnits(pending.amount.toString());
  const base = Math.floor(totalMinor / activeMembers.length);
  const remainder = totalMinor - base * activeMembers.length;
  const shares = activeMembers.map((m, i) => ({
    groupMemberId: m.id,
    shareAmount: fromMinorUnits(base + (i < remainder ? 1 : 0)).toString(),
  }));

  const groupExpense = await prisma.groupExpense.create({
    data: {
      groupId,
      categoryId,
      paidByMemberId: membership.id,
      description,
      amount: pending.amount,
      date: pending.occurredAt,
      splitType: "EQUAL",
      createdByUserId: userId,
      shares: { create: shares },
    },
  });

  await syncGroupExpenseToPersonalExpenses(groupExpense.id);
  await prisma.importedTransaction.update({
    where: { id: pending.id },
    data: { status: "CONFIRMED" },
  });

  return {
    as: "group-expense" as const,
    record: {
      id: groupExpense.id,
      groupId,
      amount: toMoney(groupExpense.amount.toString()).toString(),
      description,
      splitBetween: activeMembers.length,
    },
  };
}

export async function confirmPendingImport(
  userId: string,
  id: string,
  input: ConfirmPendingImportInput
) {
  const pending = await prisma.importedTransaction.findFirst({
    where: { id, userId, status: "PENDING" },
  });
  if (!pending) throw new ApiError(404, "Import not found.");

  const description =
    input.description?.trim() ||
    pending.merchant ||
    `${pending.bankName ?? "Bank"} ${pending.direction === "DEBIT" ? "transaction" : "credit"}`;

  if (input.as === "expense") {
    const categoryId = await resolveCategoryId(userId, input.categoryId, pending.merchant);

    // A shared expense belongs in the group ledger, which then syncs this
    // user's share back into their personal expenses.
    if (input.groupId) {
      return confirmIntoGroup(userId, pending, input.groupId, categoryId, description);
    }

    const [expense] = await prisma.$transaction([
      prisma.expense.create({
        data: {
          userId,
          categoryId,
          amount: pending.amount,
          description,
          date: pending.occurredAt,
          paymentMethod: input.paymentMethod ?? "CARD",
          isRecurring: false,
        },
        include: expenseInclude,
      }),
      prisma.importedTransaction.update({ where: { id }, data: { status: "CONFIRMED" } }),
    ]);

    return { as: "expense" as const, record: serializeExpense(expense) };
  }

  const [income] = await prisma.$transaction([
    prisma.income.create({
      data: {
        userId,
        amount: pending.amount,
        source: description,
        date: pending.occurredAt,
        isRecurring: false,
      },
    }),
    prisma.importedTransaction.update({ where: { id }, data: { status: "CONFIRMED" } }),
  ]);

  return { as: "income" as const, record: serializeIncome(income) };
}
