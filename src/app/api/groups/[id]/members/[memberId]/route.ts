import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { assertMemberBalanceIsZero, requireGroupMembership } from "@/lib/data/groups";
import { prisma } from "@/lib/prisma";

export const DELETE = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string; memberId: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id, memberId } = await ctx.params;
    await requireGroupMembership(session.user.id, id);

    const member = await prisma.groupMember.findFirst({ where: { id: memberId, groupId: id } });
    if (!member) throw new ApiError(404, "Member not found.");

    await assertMemberBalanceIsZero(id, memberId);

    await prisma.groupMember.update({
      where: { id: memberId },
      data: { isActive: false },
    });

    return apiSuccess({ id: memberId });
  }
);
