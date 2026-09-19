import { getDashboardInsights } from "@/lib/data/insights";
import type { DashboardData } from "@/lib/data/dashboard";
import { AIInsightCard } from "@/components/dashboard/ai-insight-card";

// Isolated in its own async server component so it can sit behind a
// <Suspense> boundary: this is the one dashboard data source that calls out
// to an LLM, and that round trip must never block the rest of the page
// (stat cards, charts, budgets) from painting immediately.
export async function AIInsightSection({ data }: { data: DashboardData }) {
  const insights = await getDashboardInsights(data);
  return <AIInsightCard result={insights} />;
}
