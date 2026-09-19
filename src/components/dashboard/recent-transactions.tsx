import { format } from "date-fns";
import Link from "next/link";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatMoney } from "@/lib/money";
import type { RecentTransaction } from "@/lib/data/dashboard";

const PAYMENT_LABEL: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  OTHER: "Other",
};

interface RecentTransactionsProps {
  items: RecentTransaction[];
  currency: string;
}

export function RecentTransactions({ items, currency }: RecentTransactionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent transactions</CardTitle>
        <CardAction>
          <Link href="/money-flow" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            View all
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No transactions yet. Once you add expenses, they&apos;ll show up here.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {items.map((tx) => {
              const Icon = getCategoryIcon(tx.categoryIcon);
              return (
                <li key={tx.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `color-mix(in oklch, ${tx.categoryColor} 15%, transparent)` }}
                  >
                    <Icon className="size-4" style={{ color: tx.categoryColor }} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{tx.description}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {format(new Date(tx.date), "MMM d")} · {tx.categoryName}
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                        {PAYMENT_LABEL[tx.paymentMethod] ?? tx.paymentMethod}
                      </Badge>
                    </p>
                  </div>
                  <p className="shrink-0 tabular-nums font-medium">
                    {formatMoney(tx.amount, currency)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
