import Link from "next/link";
import { TrendingDown, TrendingUp, Users } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import type { UserGroupBalanceSummary } from "@/lib/data/groups";

interface GroupBalancesCardProps {
  summary: UserGroupBalanceSummary;
  currency: string;
}

export function GroupBalancesCard({ summary, currency }: GroupBalancesCardProps) {
  const hasGroups = summary.groupCount > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Group balances</CardTitle>
        <CardAction>
          <Link href="/groups" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            View all
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {!hasGroups ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Users className="size-8 text-muted-foreground/50" aria-hidden />
            <p className="text-sm text-muted-foreground">You&apos;re not in any groups yet.</p>
            <Link href="/groups" className="text-sm font-medium text-primary hover:underline">
              Create a group
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--status-critical)_15%,transparent)]">
                <TrendingDown className="size-5 text-negative" aria-hidden />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">You owe</p>
                <p className="font-semibold tabular-nums">{formatMoney(summary.youOwe, currency)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--status-good)_15%,transparent)]">
                <TrendingUp className="size-5 text-positive" aria-hidden />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Owed to you</p>
                <p className="font-semibold tabular-nums">{formatMoney(summary.youAreOwed, currency)}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
