import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FinancialInsight } from "@/lib/data/financial-insights";

const SEVERITY_ICON: Record<FinancialInsight["severity"], typeof Info> = {
  warning: AlertTriangle,
  positive: CheckCircle2,
  info: Info,
};

const SEVERITY_COLOR: Record<FinancialInsight["severity"], string> = {
  warning: "var(--status-warning)",
  positive: "var(--status-good)",
  info: "var(--muted-foreground)",
};

export function FinancialInsightsCard({ items }: { items: FinancialInsight[] }) {
  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detected patterns</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {items.map((insight) => {
            const Icon = SEVERITY_ICON[insight.severity];
            return (
              <li key={insight.id} className="flex items-start gap-2.5">
                <Icon
                  className="mt-0.5 size-4 shrink-0"
                  style={{ color: SEVERITY_COLOR[insight.severity] }}
                  aria-hidden
                />
                <div>
                  <p className="text-sm font-medium">{insight.title}</p>
                  <p className="text-sm text-muted-foreground">{insight.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
