import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { BudgetsClient } from "@/components/budgets/budgets-client";

export const metadata: Metadata = { title: "Budgets | Evenly" };

export default async function BudgetsPage() {
  const session = await requireSession();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { currency: true },
  });

  return <BudgetsClient currency={user.currency} />;
}
