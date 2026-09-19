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
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No expenses recorded this month yet.
          </p>
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
