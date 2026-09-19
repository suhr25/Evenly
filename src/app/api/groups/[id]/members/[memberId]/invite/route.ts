import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { requireGroupMembership } from "@/lib/data/groups";
import { prisma } from "@/lib/prisma";

const INVITE_TTL_DAYS = 14;

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string; memberId: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id, memberId } = await ctx.params;
    await requireGroupMembership(session.user.id, id);

    const member = await prisma.groupMember.findFirst({ where: { id: memberId, groupId: id } });
    if (!member) throw new ApiError(404, "Member not found.");
    if (member.userId) {
      throw new ApiError(400, "This member already has an Evenly account linked.");
    }

    const existing = await prisma.groupInvite.findFirst({
      where: { memberId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });

    const invite =
      existing ??
      (await prisma.groupInvite.create({
        data: {
          groupId: id,
          memberId,
          invitedByUserId: session.user.id,
          expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
        },
      }));

    return apiSuccess({ token: invite.token, expiresAt: invite.expiresAt.toISOString() }, 201);
  }
);
