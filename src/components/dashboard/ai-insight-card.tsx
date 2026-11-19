import Link from "next/link";
import { Sparkles, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { AIInsight } from "@/types/ai";
import type { InsightResult } from "@/lib/data/insights";

const SEVERITY_DOT: Record<AIInsight["severity"], string> = { info: "bg-primary", warning: "bg-warning", positive: "bg-positive" };
const UNAVAILABLE_COPY = {
  "no-data": "Once you’ve logged a few expenses, find useful patterns and a little perspective here.",
  error: "Insights couldn’t be generated just now. Check back on your next visit.",
  "not-configured": "AI insights are currently unavailable. You can keep tracking and planning as usual.",
};
export function AIInsightCard({ result }: { result: InsightResult }) {
  return (
    <Card className="dashboard-insights relative border-primary/15 bg-brand-subtle/20 shadow-none">
      <div className="flex flex-col gap-4 px-5 sm:flex-row sm:items-start sm:gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-brand-subtle text-primary">
          <Sparkles className="size-[18px]" aria-hidden strokeWidth={1.6} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2.5">
            <h2 className="text-sm font-medium">A little insight goes a long way</h2>
            <span className="rounded border border-primary/15 px-1.5 py-0.5 text-[8px] font-medium tracking-wider text-primary">AI</span>
          </div>
          {!result.available ? <p className="max-w-2xl text-xs leading-6 text-muted-foreground">{UNAVAILABLE_COPY[result.reason]}</p> : result.insights.length === 0 ? <p className="text-xs leading-6 text-muted-foreground">Keep tracking your expenses. Insights will appear when there’s enough data.</p> : <ul className="space-y-3">{result.insights.map((insight, i) => <li key={i} className="flex gap-2.5">
            <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${SEVERITY_DOT[insight.severity]}`} aria-hidden />
            <div>
              <p className="text-xs font-medium">{insight.title}</p>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">{insight.description}</p>
            </div>
          </li>)}</ul>}
        </div>
        <Link href="/ai-chat" className="inline-flex min-h-9 shrink-0 items-center gap-1.5 self-start rounded-lg border border-primary/15 bg-card px-3 text-[11px] font-medium text-primary transition-colors hover:bg-brand-subtle">Ask Evenly<ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </Card>
  );
}
