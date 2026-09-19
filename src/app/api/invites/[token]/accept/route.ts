import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ token: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { token } = await ctx.params;

    const invite = await prisma.groupInvite.findUnique({
      where: { token },
      include: { member: true },
    });

    if (!invite) throw new ApiError(404, "This invite link is invalid.");
    if (invite.expiresAt < new Date()) throw new ApiError(400, "This invite link has expired.");
    if (invite.acceptedAt || invite.member.userId) {
      throw new ApiError(400, "This invite has already been used.");
    }

    const alreadyInGroup = await prisma.groupMember.findFirst({
      where: { groupId: invite.groupId, userId: session.user.id, isActive: true },
    });
    if (alreadyInGroup) {
      throw new ApiError(409, "You're already a member of this group.");
    }

    await prisma.$transaction([
      prisma.groupMember.update({
        where: { id: invite.memberId },
        data: {
          userId: session.user.id,
          isActive: true,
          name: session.user.name ?? invite.member.name,
        },
      }),
      prisma.groupInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    return apiSuccess({ groupId: invite.groupId });
  }
);
