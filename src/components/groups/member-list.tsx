"use client";

import { useState } from "react";
import { Send, UserMinus } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { InviteMemberDialog } from "@/components/groups/invite-member-dialog";
import { useRemoveMember, type GroupMemberDTO } from "@/hooks/use-groups";

interface MemberListProps {
  groupId: string;
  groupName: string;
  members: GroupMemberDTO[];
  currency: string;
}

export function MemberList({ groupId, groupName, members, currency }: MemberListProps) {
  const [pendingRemove, setPendingRemove] = useState<GroupMemberDTO | null>(null);
  const [invitingMember, setInvitingMember] = useState<GroupMemberDTO | null>(null);
  const removeMember = useRemoveMember(groupId);

  const activeMembers = members.filter((m) => m.isActive);

  async function confirmRemove() {
    if (!pendingRemove) return;
    try {
      await removeMember.mutateAsync(pendingRemove.id);
      toast.success(`${pendingRemove.name} removed from the group`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setPendingRemove(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {activeMembers.map((member) => (
        <div key={member.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
          <Avatar className="size-8">
            <AvatarFallback>{member.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-sm font-medium">
              {member.name}
              {member.isYou && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                  You
                </Badge>
              )}
              {!member.userId && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                  No account
                </Badge>
              )}
            </p>
            {member.email && <p className="truncate text-xs text-muted-foreground">{member.email}</p>}
          </div>
          <p
            className="shrink-0 text-sm tabular-nums"
            style={{
              color:
                Number(member.netBalance) > 0
                  ? "var(--status-good)"
                  : Number(member.netBalance) < 0
                    ? "var(--status-critical)"
                    : undefined,
            }}
          >
            {Number(member.netBalance) === 0 ? "settled up" : formatMoney(member.netBalance, currency)}
          </p>
          {!member.userId && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Invite ${member.name}`}
              onClick={() => setInvitingMember(member)}
            >
              <Send className="size-4" aria-hidden />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${member.name}`}
            onClick={() => setPendingRemove(member)}
          >
            <UserMinus className="size-4 text-destructive" aria-hidden />
          </Button>
        </div>
      ))}

      {invitingMember && (
        <InviteMemberDialog
          groupId={groupId}
          groupName={groupName}
          memberId={invitingMember.id}
          memberName={invitingMember.name}
          open={Boolean(invitingMember)}
          onOpenChange={(open) => !open && setInvitingMember(null)}
        />
      )}

      <AlertDialog open={pendingRemove !== null} onOpenChange={(open) => !open && setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {pendingRemove?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They&apos;ll be removed from the group. Their expense history stays intact. This only
              works if they&apos;re fully settled up.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmRemove}
              disabled={removeMember.isPending}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
