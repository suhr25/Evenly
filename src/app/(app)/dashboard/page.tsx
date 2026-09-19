import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";
import { getDashboardData } from "@/lib/data/dashboard";
import { computeFinancialInsights } from "@/lib/data/financial-insights";
import { computeCardInsights } from "@/lib/data/card-insights";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BorderTrail } from "@/components/ui/border-trail";
import { StatCard } from "@/components/dashboard/stat-card";
import { CategoryBreakdown } from "@/components/dashboard/category-breakdown";
import { SpendingTrendChart } from "@/components/dashboard/spending-trend-chart";
import { BudgetList } from "@/components/dashboard/budget-list";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { RecentIncomeCard } from "@/components/dashboard/recent-income-card";
import { GroupBalancesCard } from "@/components/dashboard/group-balances-card";
import { AIInsightSection } from "@/components/dashboard/ai-insight-section";
import { PendingImportsPrompt } from "@/components/dashboard/pending-imports-prompt";
import { FinancialInsightsCard } from "@/components/dashboard/financial-insights-card";
import { CardInsightsCard } from "@/components/dashboard/card-insights-card";

export const metadata: Metadata = { title: "Dashboard | Evenly" };

function AIInsightSkeleton() {
  return (
    // The trail runs only while the model is actually working. It marks a
    // genuinely in-progress region rather than decorating an idle card.
    <Card className="relative overflow-hidden" role="status" aria-label="Generating insights">
      <BorderTrail
        className="bg-primary"
        size={90}
        style={{ boxShadow: "0 0 40px 18px color-mix(in oklab, var(--primary) 45%, transparent)" }}
        transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
      />
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-[0.9375rem]">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-brand-subtle text-primary">
            <Sparkles className="size-3.5" aria-hidden strokeWidth={2} />
          </span>
          AI insights
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3.5 w-2/3" />
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const data = await getDashboardData(session.user.id);
  const [financialInsights, cardInsights] = await Promise.all([
    computeFinancialInsights(session.user.id, data.currency),
    computeCardInsights(session.user.id, data.currency),
  ]);

  const firstName = session.user.name?.split(" ")[0] ?? "there";

  return (
    <div className="section-seq flex flex-col gap-6 md:gap-7">
      <div>
        <h1 className="text-[1.375rem] font-semibold leading-tight tracking-[-0.02em]">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>

      <PendingImportsPrompt userId={session.user.id} currency={data.currency} />

      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
        <StatCard
          label="Current balance"
          amount={data.balance}
          currency={data.currency}
          icon={Wallet}
          tone="brand"
          emphasis
        />
        <StatCard
          label="Monthly income"
          amount={data.monthlyIncome}
          currency={data.currency}
          icon={TrendingUp}
          tone="positive"
        />
        <StatCard
          label="Monthly expenses"
          amount={data.monthlyExpenses}
          currency={data.currency}
          icon={TrendingDown}
          tone="negative"
        />
        <StatCard
          label="Monthly savings"
          amount={data.monthlySavings}
          currency={data.currency}
          icon={PiggyBank}
          tone={Number(data.monthlySavings) >= 0 ? "positive" : "negative"}
        />
      </div>

      <Suspense fallback={<AIInsightSkeleton />}>
        <AIInsightSection data={data} />
      </Suspense>

      <FinancialInsightsCard items={financialInsights} />

      <CardInsightsCard items={cardInsights} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SpendingTrendChart data={data.spendingTrend} currency={data.currency} />
        <CategoryBreakdown items={data.categoryBreakdown} currency={data.currency} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <BudgetList items={data.budgets} currency={data.currency} />
        <GroupBalancesCard summary={data.groupBalances} currency={data.currency} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <RecentTransactions items={data.recentTransactions} currency={data.currency} />
        <RecentIncomeCard currency={data.currency} />
      </div>
    </div>
  );
}
