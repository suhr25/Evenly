import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import type { GroupSummary } from "@/hooks/use-groups";

export function GroupCard({ group, currency }: { group: GroupSummary; currency: string }) {
  const balance = Number(group.yourBalance);
  const balanceLabel = balance > 0 ? "you are owed" : balance < 0 ? "you owe" : "settled up";
  const balanceTone =
    balance > 0
      ? "text-positive"
      : balance < 0
        ? "text-negative"
        : "text-muted-foreground";

  return (
    <Link href={`/groups/${group.id}`}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardContent className="flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-2xl">
            {group.icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{group.name}</p>
            <p className="text-sm text-muted-foreground">
              {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className={`font-medium tabular-nums ${balanceTone}`}>
              {formatMoney(Math.abs(balance), currency)}
            </p>
            <p className="text-xs text-muted-foreground">{balanceLabel}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
