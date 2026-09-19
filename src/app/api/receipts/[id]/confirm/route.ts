import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { assertCategoryAccessible } from "@/lib/data/expenses";
import { computeReceiptShares, computeReceiptTotal } from "@/lib/data/receipts";
import { requireGroupMembership, serializeGroupExpense } from "@/lib/data/groups";
import { prisma } from "@/lib/prisma";
import { confirmReceiptSchema } from "@/lib/validations/receipt";

const EXPENSE_INCLUDE = {
  category: true,
  paidBy: true,
  shares: { include: { groupMember: true } },
} as const;

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id } = await ctx.params;
    const receipt = await prisma.receipt.findUnique({ where: { id }, include: { groupExpense: true } });
    if (!receipt || receipt.userId !== session.user.id) throw new ApiError(404, "Receipt not found.");
    if (receipt.groupExpense) throw new ApiError(409, "This receipt has already been confirmed.");

    const data = confirmReceiptSchema.parse(await req.json());

    await requireGroupMembership(session.user.id, data.groupId);

    const categoryOk = await assertCategoryAccessible(session.user.id, data.categoryId);
    if (!categoryOk) throw new ApiError(400, "Invalid category.");

    const activeMembers = await prisma.groupMember.findMany({
      where: { groupId: data.groupId, isActive: true },
      select: { id: true },
    });
    const activeMemberIds = new Set(activeMembers.map((m) => m.id));
    if (!activeMemberIds.has(data.paidByMemberId)) {
      throw new ApiError(400, "The person who paid must be an active group member.");
    }
    for (const assignment of data.itemAssignments) {
      for (const memberId of assignment.memberIds) {
        if (!activeMemberIds.has(memberId)) {
          throw new ApiError(400, "All assigned members must be active group members.");
        }
      }
    }

    const total = data.total || computeReceiptTotal(data);
    const shares = computeReceiptShares({ ...data, total });

    const [, expense] = await prisma.$transaction([
      prisma.receipt.update({
        where: { id },
        data: {
          merchant: data.merchant || null,
          date: data.date,
          subtotal: data.subtotal ?? null,
          tax: data.tax ?? null,
          discount: data.discount ?? null,
          tip: data.tip ?? null,
          total,
          items: {
            deleteMany: {},
            create: data.items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          },
        },
      }),
      prisma.groupExpense.create({
        data: {
          groupId: data.groupId,
          categoryId: data.categoryId,
          paidByMemberId: data.paidByMemberId,
          receiptId: id,
          description: data.description,
          amount: total,
          date: data.date,
          splitType: "EXACT",
          createdByUserId: session.user.id,
          shares: { create: shares.map((s) => ({ groupMemberId: s.memberId, shareAmount: s.amount })) },
        },
        include: EXPENSE_INCLUDE,
      }),
    ]);

    return apiSuccess(serializeGroupExpense(expense), 201);
  }
);
