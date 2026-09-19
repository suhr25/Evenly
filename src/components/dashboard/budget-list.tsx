import Link from "next/link";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatMoney } from "@/lib/money";
import type { BudgetSummaryItem } from "@/lib/data/dashboard";

const STATUS_COLOR: Record<BudgetSummaryItem["status"], string> = {
  healthy: "var(--status-good)",
  warning: "var(--status-warning)",
  exceeded: "var(--status-critical)",
};

const STATUS_LABEL: Record<BudgetSummaryItem["status"], string> = {
  healthy: "On track",
  warning: "Near limit",
  exceeded: "Exceeded",
};

interface BudgetListProps {
  items: BudgetSummaryItem[];
  currency: string;
}

export function BudgetList({ items, currency }: BudgetListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Budgets</CardTitle>
        <CardAction>
          <Link href="/budgets" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            View all
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm text-muted-foreground">You haven&apos;t set any budgets yet.</p>
            <Link href="/budgets" className="text-sm font-medium underline underline-offset-2">
              Set your first budget
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {items.map((item) => {
              const Icon = getCategoryIcon(item.icon);
              const color = STATUS_COLOR[item.status];
              return (
                <li key={item.categoryId} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <Icon className="size-4" aria-hidden />
                      {item.name}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-medium" style={{ color }}>
                        {STATUS_LABEL[item.status]}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatMoney(item.spent, currency)} / {formatMoney(item.budget, currency)}
                      </span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-[width]"
                      style={{
                        width: `${Math.min(item.percentUsed, 100)}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
