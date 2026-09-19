import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { GroupDetailClient } from "@/components/groups/group-detail-client";

export const metadata: Metadata = { title: "Group | Evenly" };

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { currency: true },
  });

  return <GroupDetailClient groupId={id} currency={user.currency} />;
}
