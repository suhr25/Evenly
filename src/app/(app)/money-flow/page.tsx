import type { Metadata } from "next";
import { Suspense } from "react";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { MoneyFlowClient } from "@/components/money-flow/money-flow-client";

export const metadata: Metadata = { title: "Money Flow | Evenly" };

export default async function MoneyFlowPage() {
  const session = await requireSession();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { currency: true },
  });

  return (
    <Suspense>
      <MoneyFlowClient currency={user.currency} />
    </Suspense>
  );
}
