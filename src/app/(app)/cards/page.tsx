import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CardsTabsClient } from "@/components/cards/cards-tabs-client";

export const metadata: Metadata = { title: "Cards | Evenly" };

export default async function CardsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

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
