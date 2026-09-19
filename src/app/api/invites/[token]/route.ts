import { NextRequest } from "next/server";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const GET = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ token: string }> }) => {
    const { token } = await ctx.params;

    const invite = await prisma.groupInvite.findUnique({
      where: { token },
      include: { group: { select: { name: true, icon: true } }, member: true, invitedBy: true },
    });

    if (!invite) throw new ApiError(404, "This invite link is invalid.");

    return apiSuccess({
      groupId: invite.groupId,
      groupName: invite.group.name,
      groupIcon: invite.group.icon,
      memberName: invite.member.name,
      invitedByName: invite.invitedBy.name ?? invite.invitedBy.email,
      isExpired: invite.expiresAt < new Date(),
      isAccepted: Boolean(invite.acceptedAt),
      isAlreadyLinked: Boolean(invite.member.userId),
    });
  }
);
