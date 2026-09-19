import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { apiSuccess, ApiError, withErrorHandling } from "@/lib/api-response";
import { computeGroupBalances } from "@/lib/data/groups";
import { prisma } from "@/lib/prisma";
import { createGroupSchema } from "@/lib/validations/group";

export const GET = withErrorHandling(async () => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  const memberships = await prisma.groupMember.findMany({
    where: { userId: session.user.id, isActive: true },
    include: {
      group: {
        include: { _count: { select: { members: { where: { isActive: true } } } } },
      },
    },
    orderBy: { group: { updatedAt: "desc" } },
  });

  const groups = await Promise.all(
    memberships.map(async (m) => {
      const balances = await computeGroupBalances(m.groupId);
      const myBalance = balances.find((b) => b.memberId === m.id)?.netBalance ?? "0";
      return {
        id: m.group.id,
        name: m.group.name,
        icon: m.group.icon,
        memberCount: m.group._count.members,
        yourBalance: myBalance,
      };
    })
  );

  return apiSuccess(groups);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "You must be logged in.");

  const data = createGroupSchema.parse(await req.json());

  const group = await prisma.group.create({
    data: {
      name: data.name,
      icon: data.icon,
      createdBy: session.user.id,
      members: {
        create: {
          userId: session.user.id,
          name: session.user.name ?? session.user.email ?? "You",
        },
      },
    },
  });

  return apiSuccess({ id: group.id, name: group.name, icon: group.icon }, 201);
});
