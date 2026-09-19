import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CardDetailClient } from "@/components/cards/card-detail-client";

export const metadata: Metadata = { title: "Card details | Evenly" };

export default async function CardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { currency: true },
  });

  return <CardDetailClient id={id} currency={user.currency} />;
}
