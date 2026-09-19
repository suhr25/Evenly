import type { Metadata } from "next";
import Link from "next/link";
import { Users, Wallet } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AcceptInviteButton } from "@/components/invite/accept-invite-button";

export const metadata: Metadata = { title: "Join group | Evenly" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await auth();

  const invite = await prisma.groupInvite.findUnique({
    where: { token },
    include: { group: true, member: true, invitedBy: true },
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-muted/30 p-4">
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Wallet className="size-5 text-primary" aria-hidden />
        Evenly
      </Link>

      <Card className="w-full max-w-sm">
        {!invite ? (
          <>
            <CardHeader>
              <CardTitle>Invite not found</CardTitle>
              <CardDescription>This invite link doesn&apos;t exist or was already removed.</CardDescription>
            </CardHeader>
          </>
        ) : invite.expiresAt < new Date() ? (
          <CardHeader>
            <CardTitle>Invite expired</CardTitle>
            <CardDescription>
              Ask {invite.invitedBy.name ?? "your friend"} to send you a new invite link.
            </CardDescription>
          </CardHeader>
        ) : invite.acceptedAt || invite.member.userId ? (
          <>
            <CardHeader>
              <CardTitle>Already joined</CardTitle>
              <CardDescription>This invite has already been used.</CardDescription>
            </CardHeader>
            {session?.user && (
              <CardContent>
                <Link href={`/groups/${invite.groupId}`}>
                  <Button className="w-full" variant="outline">
                    Go to group
                  </Button>
                </Link>
              </CardContent>
            )}
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span aria-hidden>{invite.group.icon}</span>
                {invite.group.name}
              </CardTitle>
              <CardDescription className="flex items-center gap-1.5">
                <Users className="size-3.5" aria-hidden />
                {invite.invitedBy.name ?? "A friend"} invited you as &ldquo;{invite.member.name}&rdquo;
              </CardDescription>
            </CardHeader>
            <CardContent>
              {session?.user ? (
                <AcceptInviteButton token={token} />
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    href={`/signup?callbackUrl=${encodeURIComponent(`/invite/${token}`)}${
                      invite.member.email ? `&email=${encodeURIComponent(invite.member.email)}` : ""
                    }`}
                  >
                    <Button className="w-full">Sign up to join</Button>
                  </Link>
                  <Link href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}>
                    <Button className="w-full" variant="outline">
                      I already have an account
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
