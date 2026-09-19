import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import type { GroupMemberDTO } from "@/hooks/use-groups";

export function BalancesPanel({ members, currency }: { members: GroupMemberDTO[]; currency: string }) {
  const activeMembers = members.filter((m) => m.isActive);

  return (
    <div className="flex flex-col gap-2">
      {activeMembers.map((member) => {
        const balance = Number(member.netBalance);
        return (
          <div key={member.id} className="flex items-center gap-3 rounded-md border px-3 py-2.5">
            <Avatar className="size-8">
              <AvatarFallback>{member.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <p className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm font-medium">
              {member.name}
              {member.isYou && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                  You
                </Badge>
              )}
            </p>
            <div className="shrink-0 text-right">
              <p
                className="text-sm font-medium tabular-nums"
                style={{
                  color:
                    balance > 0 ? "var(--status-good)" : balance < 0 ? "var(--status-critical)" : undefined,
                }}
              >
                {balance === 0 ? "Settled up" : formatMoney(Math.abs(balance), currency)}
              </p>
              {balance !== 0 && (
                <p className="text-xs text-muted-foreground">{balance > 0 ? "is owed" : "owes"}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
