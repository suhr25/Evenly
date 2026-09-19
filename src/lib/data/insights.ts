import { AIUnavailableError, getAIProvider } from "@/lib/ai";
import type { AIInsight, FinancialSnapshot } from "@/types/ai";
import type { DashboardData } from "@/lib/data/dashboard";

/**
 * Three different situations used to collapse into a single "unavailable"
 * state, which told the user the wrong thing twice over: a brand-new account
 * has working AI and simply nothing to analyse yet, and a timed-out request is
 * temporary rather than a missing feature. Only `not-configured` means the
 * feature genuinely is not there.
 */
export type InsightResult =
  | { available: true; insights: AIInsight[] }
  | { available: false; reason: "no-data" | "not-configured" | "error" };

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
  if (!data.hasAnyData) return { available: false, reason: "no-data" };

  try {
    const insights = await getAIProvider().generateInsight(toFinancialSnapshot(data));
    return { available: true, insights };
  } catch (err) {
    // AIUnavailableError is expected whenever no AI provider is configured.
    // Log it quietly and let the UI show the "unavailable" state. Anything
    // else (a real API failure) is worth surfacing at error level.
    if (err instanceof AIUnavailableError) {
      console.info("[ai-insight] unavailable:", err.message);
      return { available: false, reason: "not-configured" };
    }
    console.error("[ai-insight]", err);
    return { available: false, reason: "error" };
  }
}
