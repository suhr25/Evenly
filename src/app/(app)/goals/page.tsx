import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { GoalsClient } from "@/components/goals/goals-client";

export const metadata: Metadata = { title: "Goals | Evenly" };

export default async function GoalsPage() {
  const session = await requireSession();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { currency: true },
  });

  return <GoalsClient currency={user.currency} />;
}
