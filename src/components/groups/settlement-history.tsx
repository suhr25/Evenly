"use client";

import { format } from "date-fns";
import { ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { useSettlements } from "@/hooks/use-settlements";

export function SettlementHistory({ groupId, currency }: { groupId: string; currency: string }) {
  const { data: settlements, isLoading } = useSettlements(groupId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!settlements || settlements.length === 0) {
    return <p className="text-sm text-muted-foreground">No payments recorded yet.</p>;
  }

  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {settlements.map((s) => (
        <li key={s.id} className="flex items-center gap-3 p-3 text-sm">
          <span className="font-medium">{s.from.name}</span>
          <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
          <span className="font-medium">{s.to.name}</span>
          <span className="ml-auto tabular-nums">{formatMoney(s.amount, currency)}</span>
          <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
            {format(new Date(s.settledAt), "MMM d")}
          </span>
        </li>
      ))}
    </ul>
  );
}
