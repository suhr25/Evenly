import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BorderGlow } from "@/components/ui/border-glow";
import type { AIInsight } from "@/types/ai";
import type { InsightResult } from "@/lib/data/insights";

// Purple marks AI as a product surface. Severity still uses the financial
// semantics so a warning reads the same here as it does anywhere else.
const SEVERITY_DOT: Record<AIInsight["severity"], string> = {
  info: "bg-primary",
  warning: "bg-warning",
  positive: "bg-positive",
};

export function AIInsightCard({ result }: { result: InsightResult }) {
  return (
    // Edge glow marks the AI panel as the one generated surface on the page.
    <BorderGlow glowColor="258 90% 72%" borderRadius={12} glowRadius={34} fillOpacity={0.3}>
      <Card className="ai-surface border-transparent bg-transparent shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-[0.9375rem]">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-brand-subtle text-primary">
            <Sparkles className="size-3.5" aria-hidden strokeWidth={2} />
          </span>
          AI insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!result.available ? (
          <p className="text-sm text-muted-foreground">
            AI features are currently unavailable. Everything else in Evenly still works.
            Insights will appear here once an AI provider is configured.
          </p>
        ) : result.insights.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keep tracking your expenses. Insights will show up here once there&apos;s enough data.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {result.insights.map((insight, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className={`mt-[0.4375rem] size-1.5 shrink-0 rounded-full ${SEVERITY_DOT[insight.severity]}`}
                  aria-hidden
                />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[0.8125rem] font-medium leading-snug">{insight.title}</p>
                  <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
                    {insight.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
    </BorderGlow>
  );
}
