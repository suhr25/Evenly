import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { requireGroupMembership, syncSettlementToIncome } from "@/lib/data/groups";
import { toMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { recordSettlementSchema } from "@/lib/validations/group";

export const GET = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id } = await ctx.params;
    await requireGroupMembership(session.user.id, id);

    const settlements = await prisma.settlement.findMany({
      where: { groupId: id },
      include: { fromMember: true, toMember: true },
      orderBy: { settledAt: "desc" },
      take: 50,
    });

    return apiSuccess(
      settlements.map((s) => ({
        id: s.id,
        from: { id: s.fromMember.id, name: s.fromMember.name },
        to: { id: s.toMember.id, name: s.toMember.name },
        amount: toMoney(s.amount.toString()).toString(),
        note: s.note,
        settledAt: s.settledAt.toISOString(),
      }))
    );
  }
);

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id } = await ctx.params;
    await requireGroupMembership(session.user.id, id);

    const data = recordSettlementSchema.parse(await req.json());

    const members = await prisma.groupMember.findMany({
      where: { groupId: id, id: { in: [data.fromMemberId, data.toMemberId] }, isActive: true },
    });
    if (members.length !== 2) {
      throw new ApiError(400, "Both members must be active members of this group.");
    }

    const settlement = await prisma.settlement.create({
      data: {
        groupId: id,
        fromMemberId: data.fromMemberId,
        toMemberId: data.toMemberId,
        amount: data.amount,
        note: data.note || null,
        createdByUserId: session.user.id,
      },
      include: { fromMember: true, toMember: true },
    });

    await syncSettlementToIncome(settlement.id);

    return apiSuccess(
      {
        id: settlement.id,
        from: { id: settlement.fromMember.id, name: settlement.fromMember.name },
        to: { id: settlement.toMember.id, name: settlement.toMember.name },
        amount: toMoney(settlement.amount.toString()).toString(),
        note: settlement.note,
        settledAt: settlement.settledAt.toISOString(),
      },
      201
    );
  }
);
