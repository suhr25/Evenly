import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/settings/profile-form";
import { GmailImportCard } from "@/components/settings/gmail-import-card";

export const metadata: Metadata = { title: "Settings | Evenly" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { name: true, email: true, currency: true, phone: true, upiId: true },
  });

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <ProfileForm user={user} />
      <Suspense>
        <GmailImportCard />
      </Suspense>
    </div>
  );
}
