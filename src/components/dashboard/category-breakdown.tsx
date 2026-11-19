import { ChartPie } from "lucide-react";
import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatMoney } from "@/lib/money";
import type { CategoryBreakdownItem } from "@/lib/data/dashboard";

interface CategoryBreakdownProps {
  items: CategoryBreakdownItem[];
  currency: string;
}

export function CategoryBreakdown({ items, currency }: CategoryBreakdownProps) {
  const total = items.reduce((sum, i) => sum + Number(i.amount), 0);
  const max = Math.max(...items.map((i) => Number(i.amount)), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Category breakdown</CardTitle>
        <p className="text-[11px] text-muted-foreground">Where your money goes this month</p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <DashboardEmptyState icon={ChartPie} title="A place for every purchase" description="Categorise your expenses to see what makes up your monthly spending." href="/money-flow" action="Add your first expense" />
        ) : (
          <ul className="flex flex-col gap-4">
            {items.map((item) => {
              const Icon = getCategoryIcon(item.icon);
              const amount = Number(item.amount);
              const widthPct = Math.max((amount / max) * 100, 3);
              const sharePct = total > 0 ? Math.round((amount / total) * 100) : 0;

              return (
                <li key={item.categoryId} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <Icon className="size-4" style={{ color: item.color }} aria-hidden />
                      {item.name}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatMoney(item.amount, currency)}
                      <span className="ml-1.5 text-xs">({sharePct}%)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${widthPct}%`, backgroundColor: item.color }}
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
