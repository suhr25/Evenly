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
import { createGroupExpenseSchema } from "@/lib/validations/group";

const EXPENSE_INCLUDE = {
  category: true,
  paidBy: true,
  shares: { include: { groupMember: true } },
} as const;

export const GET = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id } = await ctx.params;
    await requireGroupMembership(session.user.id, id);

    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? 1));
    const pageSize = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("pageSize") ?? 20)));

    const [total, expenses] = await Promise.all([
      prisma.groupExpense.count({ where: { groupId: id } }),
      prisma.groupExpense.findMany({
        where: { groupId: id },
        include: EXPENSE_INCLUDE,
        orderBy: { date: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return apiSuccess({
      expenses: expenses.map(serializeGroupExpense),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  }
);

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id } = await ctx.params;
    await requireGroupMembership(session.user.id, id);

    const data = createGroupExpenseSchema.parse(await req.json());

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

    const expense = await prisma.groupExpense.create({
      data: {
        groupId: id,
        categoryId: data.categoryId,
        paidByMemberId: data.paidByMemberId,
        description: data.description,
        amount: data.amount,
        date: data.date,
        splitType: data.splitType,
        createdByUserId: session.user.id,
        shares: {
          create: shares.map((s) => ({
            groupMemberId: s.memberId,
            shareAmount: s.shareAmount,
            sharePercentage: s.sharePercentage,
            shareUnits: s.shareUnits,
          })),
        },
      },
      include: EXPENSE_INCLUDE,
    });

    await syncGroupExpenseToPersonalExpenses(expense.id);

    return apiSuccess(serializeGroupExpense(expense), 201);
  }
);
