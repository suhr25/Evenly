import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GroupsClient } from "@/components/groups/groups-client";

export const metadata: Metadata = { title: "Groups | Evenly" };

export default async function GroupsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { currency: true },
  });

  return <GroupsClient currency={user.currency} />;
}
