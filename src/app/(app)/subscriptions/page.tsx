import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SubscriptionsClient } from "@/components/subscriptions/subscriptions-client";

export const metadata: Metadata = { title: "Subscriptions | Evenly" };

export default async function SubscriptionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { currency: true },
  });

  return <SubscriptionsClient currency={user.currency} />;
}
