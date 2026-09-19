import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { requireGroupMembership } from "@/lib/data/groups";
import { prisma } from "@/lib/prisma";
import { addMemberSchema } from "@/lib/validations/group";

export const POST = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user) throw new ApiError(401, "You must be logged in.");

    const { id } = await ctx.params;
    await requireGroupMembership(session.user.id, id);

    const data = addMemberSchema.parse(await req.json());
    const email = data.email || undefined;
    const phone = data.phone || undefined;

    // Link to an existing registered user by email if one exists, otherwise
    // this is a ledger-only member with no account.
    const existingUser = email ? await prisma.user.findUnique({ where: { email } }) : null;

    if (existingUser) {
      const alreadyMember = await prisma.groupMember.findFirst({
        where: { groupId: id, userId: existingUser.id },
      });
      if (alreadyMember) {
        if (alreadyMember.isActive) {
          throw new ApiError(409, "This person is already in the group.");
        }
        const reactivated = await prisma.groupMember.update({
          where: { id: alreadyMember.id },
          data: { isActive: true, name: data.name, phone: phone ?? alreadyMember.phone },
        });
        return apiSuccess(reactivated, 201);
      }
    }

    const member = await prisma.groupMember.create({
      data: {
        groupId: id,
        userId: existingUser?.id ?? null,
        name: data.name,
        email: email ?? null,
        phone: phone ?? null,
      },
    });

    return apiSuccess(member, 201);
  }
);
