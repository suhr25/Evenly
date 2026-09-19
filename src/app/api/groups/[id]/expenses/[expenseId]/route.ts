import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { assertCategoryAccessible } from "@/lib/data/expenses";
import {
  computeShares,
  requireGroupMembership,
  serializeGroupExpense,
  syncGroupExpenseToPersonalExpenses,
} from "@/lib/data/groups";
import { prisma } from "@/lib/prisma";
import { updateGroupExpenseSchema } from "@/lib/validations/group";

const EXPENSE_INCLUDE = {
  category: true,
  paidBy: true,
  shares: { include: { groupMember: true } },
} as const;

async function getOwnedGroupExpense(groupId: string, expenseId: string) {
  const expense = await prisma.groupExpense.findFirst({ where: { id: expenseId, groupId } });
  if (!expense) throw new ApiError(404, "Expense not found.");
  return expense;
}

export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string; expenseId: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id, expenseId } = await ctx.params;
    await requireGroupMembership(session.user.id, id);
    await getOwnedGroupExpense(id, expenseId);

    const data = updateGroupExpenseSchema.parse(await req.json());

    const categoryOk = await assertCategoryAccessible(session.user.id, data.categoryId);
    if (!categoryOk) throw new ApiError(400, "Invalid category.");

    const activeMembers = await prisma.groupMember.findMany({
      where: { groupId: id, isActive: true },
      select: { id: true },
    });
    const activeMemberIds = new Set(activeMembers.map((m) => m.id));

    if (!activeMemberIds.has(data.paidByMemberId)) {
      throw new ApiError(400, "The person who paid must be an active group member.");
    }

    const shares = computeShares(data);
    for (const share of shares) {
      if (!activeMemberIds.has(share.memberId)) {
        throw new ApiError(400, "All split participants must be active group members.");
      }
    }

    const [, , expense] = await prisma.$transaction([
      prisma.groupExpenseShare.deleteMany({ where: { groupExpenseId: expenseId } }),
      prisma.groupExpense.update({
        where: { id: expenseId },
        data: {
          categoryId: data.categoryId,
          paidByMemberId: data.paidByMemberId,
          description: data.description,
          amount: data.amount,
          date: data.date,
          splitType: data.splitType,
          shares: {
            create: shares.map((s) => ({
              groupMemberId: s.memberId,
              shareAmount: s.shareAmount,
              sharePercentage: s.sharePercentage,
              shareUnits: s.shareUnits,
            })),
          },
        },
      }),
      prisma.groupExpense.findUniqueOrThrow({ where: { id: expenseId }, include: EXPENSE_INCLUDE }),
    ]);

    await syncGroupExpenseToPersonalExpenses(expenseId);

    return apiSuccess(serializeGroupExpense(expense));
  }
);

export const DELETE = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string; expenseId: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id, expenseId } = await ctx.params;
    await requireGroupMembership(session.user.id, id);
    await getOwnedGroupExpense(id, expenseId);

    await prisma.groupExpense.delete({ where: { id: expenseId } });
    return apiSuccess({ id: expenseId });
  }
);
