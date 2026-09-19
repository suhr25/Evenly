import type { Metadata } from "next";
import { Suspense } from "react";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CardsTabsClient } from "@/components/cards/cards-tabs-client";

export const metadata: Metadata = { title: "Cards | Evenly" };

export default async function CardsPage() {
  const session = await requireSession();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { currency: true },
  });

  return (
    <Suspense>
      <CardsTabsClient currency={user.currency} />
    </Suspense>
  );
}
