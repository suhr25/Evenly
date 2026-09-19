"use client";

import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GroupCard } from "@/components/groups/group-card";
import { CreateGroupDialog } from "@/components/groups/create-group-dialog";
import { useGroups } from "@/hooks/use-groups";

export function GroupsClient({ currency }: { currency: string }) {
  const { data: groups, isLoading } = useGroups();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
          <p className="text-sm text-muted-foreground">Split expenses with friends, roommates, or a trip.</p>
        </div>
        <CreateGroupDialog
          trigger={
            <Button>
              <Plus className="size-4" aria-hidden />
              New group
            </Button>
          }
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !groups || groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border py-20 text-center">
          <Users className="size-10 text-muted-foreground/50" aria-hidden />
          <div>
            <p className="font-medium">No groups yet</p>
            <p className="text-sm text-muted-foreground">
              Create one to start splitting expenses with people.
            </p>
          </div>
          <CreateGroupDialog
            trigger={
              <Button className="mt-2">
                <Plus className="size-4" aria-hidden />
                Create your first group
              </Button>
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} currency={currency} />
          ))}
        </div>
      )}
    </div>
  );
}
