import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CardInsight } from "@/lib/data/card-insights";

const SEVERITY_ICON: Record<CardInsight["severity"], typeof Info> = {
  warning: AlertTriangle,
  positive: CheckCircle2,
  info: Info,
};

const SEVERITY_COLOR: Record<CardInsight["severity"], string> = {
  warning: "var(--status-warning)",
  positive: "var(--status-good)",
  info: "var(--muted-foreground)",
};

export function CardInsightsCard({ items }: { items: CardInsight[] }) {
  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Card insights</CardTitle>
        <CardAction>
          <Link href="/cards" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Cards
          </Link>
        </CardAction>
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
