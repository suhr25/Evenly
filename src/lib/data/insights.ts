import { AIUnavailableError, getAIProvider } from "@/lib/ai";
import type { AIInsight, FinancialSnapshot } from "@/types/ai";
import type { DashboardData } from "@/lib/data/dashboard";

export type InsightResult = { available: true; insights: AIInsight[] } | { available: false };

export function toFinancialSnapshot(data: DashboardData): FinancialSnapshot {
  return {
    currency: data.currency,
    monthlyIncome: Number(data.monthlyIncome),
    monthlyExpenses: Number(data.monthlyExpenses),
    currentBalance: Number(data.balance),
    categorySpending: Object.fromEntries(
      data.categoryBreakdown.map((c) => [c.name, Number(c.amount)])
    ),
    budgets: data.budgets.map((b) => ({
      category: b.name,
      budget: Number(b.budget),
      spent: Number(b.spent),
    })),
  };
}

export async function getDashboardInsights(data: DashboardData): Promise<InsightResult> {
  if (!data.hasAnyData) return { available: false };

  try {
    const insights = await getAIProvider().generateInsight(toFinancialSnapshot(data));
    return { available: true, insights };
  } catch (err) {
    // AIUnavailableError is expected whenever no AI provider is configured.
    // Log it quietly and let the UI show the "unavailable" state. Anything
    // else (a real API failure) is worth surfacing at error level.
    if (err instanceof AIUnavailableError) {
      console.info("[ai-insight] unavailable:", err.message);
    } else {
      console.error("[ai-insight]", err);
    }
    return { available: false };
  }
}
