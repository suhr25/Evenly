import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { computeGroupBalances, requireGroupMembership } from "@/lib/data/groups";
import { prisma } from "@/lib/prisma";
import { simplifyDebts } from "@/lib/settlement";
import { updateGroupSchema } from "@/lib/validations/group";

export const GET = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id } = await ctx.params;
    await requireGroupMembership(session.user.id, id);

    const group = await prisma.group.findUniqueOrThrow({
      where: { id },
      include: {
        members: {
          orderBy: { joinedAt: "asc" },
          include: { user: { select: { phone: true, upiId: true } } },
        },
      },
    });

    const balances = await computeGroupBalances(id);
    const balanceByMember = new Map(balances.map((b) => [b.memberId, b.netBalance]));
    const nameByMember = new Map(group.members.map((m) => [m.id, m.name]));
    const phoneByMember = new Map(group.members.map((m) => [m.id, m.phone ?? m.user?.phone ?? null]));
    const upiIdByMember = new Map(group.members.map((m) => [m.id, m.user?.upiId ?? null]));

    const suggestedSettlements = simplifyDebts(
      balances.map((b) => ({ memberId: b.memberId, netBalance: b.netBalance }))
    ).map((t) => ({
      fromMemberId: t.fromMemberId,
      fromName: nameByMember.get(t.fromMemberId) ?? "",
      fromPhone: phoneByMember.get(t.fromMemberId) ?? null,
      toMemberId: t.toMemberId,
      toName: nameByMember.get(t.toMemberId) ?? "",
      toUpiId: upiIdByMember.get(t.toMemberId) ?? null,
      amount: t.amount,
    }));

    return apiSuccess({
      id: group.id,
      name: group.name,
      icon: group.icon,
      createdBy: group.createdBy,
      isCreator: group.createdBy === session.user.id,
      members: group.members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        phone: m.phone ?? m.user?.phone ?? null,
        upiId: m.user?.upiId ?? null,
        userId: m.userId,
        isActive: m.isActive,
        isYou: m.userId === session.user.id,
        netBalance: balanceByMember.get(m.id) ?? "0",
      })),
      suggestedSettlements,
    });
  }
);

export const PATCH = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id } = await ctx.params;
    await requireGroupMembership(session.user.id, id);

    const data = updateGroupSchema.parse(await req.json());
    const group = await prisma.group.update({
      where: { id },
      data: { name: data.name, icon: data.icon },
    });

    return apiSuccess({ id: group.id, name: group.name, icon: group.icon });
  }
);

export const DELETE = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id } = await ctx.params;
    const group = await prisma.group.findUnique({ where: { id } });
    if (!group) throw new ApiError(404, "Group not found.");
    if (group.createdBy !== session.user.id) {
      throw new ApiError(403, "Only the group creator can delete this group.");
    }

    await prisma.group.delete({ where: { id } });
    return apiSuccess({ id });
  }
);
