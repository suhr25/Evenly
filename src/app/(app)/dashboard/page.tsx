import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarDays, Wallet, TrendingUp, TrendingDown, PiggyBank, Sparkles } from "lucide-react";
import { requireSession } from "@/lib/session";
import { getDashboardData } from "@/lib/data/dashboard";
import { computeFinancialInsights } from "@/lib/data/financial-insights";
import { computeCardInsights } from "@/lib/data/card-insights";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BorderTrail } from "@/components/ui/border-trail";
import { StatCard } from "@/components/dashboard/stat-card";
import { CategoryBreakdown } from "@/components/dashboard/category-breakdown";
import { SpendingActivity } from "@/components/dashboard/spending-activity";
import { SpendingTrendChart } from "@/components/dashboard/spending-trend-chart";
import { BudgetList } from "@/components/dashboard/budget-list";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { RecentIncomeCard } from "@/components/dashboard/recent-income-card";
import { GroupBalancesCard } from "@/components/dashboard/group-balances-card";
import { AIInsightSection } from "@/components/dashboard/ai-insight-section";
import { PendingImportsPrompt } from "@/components/dashboard/pending-imports-prompt";
import { FinancialInsightsCard } from "@/components/dashboard/financial-insights-card";
import { CardInsightsCard } from "@/components/dashboard/card-insights-card";

import { DashboardActions } from "@/components/dashboard/dashboard-actions";
import { DashboardGettingStarted } from "@/components/dashboard/getting-started";

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
  const session = await requireSession();
  const data = await getDashboardData(session.user.id);
  const [financialInsights, cardInsights] = await Promise.all([
    computeFinancialInsights(session.user.id, data.currency),
    computeCardInsights(session.user.id, data.currency),
  ]);

  const firstName = session.user.name?.split(" ")[0] ?? "there";

  return (
    <div className="dashboard-view section-seq flex flex-col gap-6">
      <div className="workspace-intro flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
        <div>
          <p className="mb-3 flex items-center gap-2 text-xs text-[#e0d2f5]"><CalendarDays size={15} aria-hidden />{new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" })}</p>
          <h1 className="text-3xl font-medium leading-tight tracking-[-.045em] sm:text-4xl">Welcome back, <em className="font-serif text-[#d6c1ff]">{firstName}.</em>
          </h1>
        </div>
        <DashboardActions />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Balance and cash flow</h2>
      </div>

      <PendingImportsPrompt userId={session.user.id} currency={data.currency} />

      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
        <StatCard
          label="Current balance"
          description="All recorded income minus expenses"
          href="/money-flow"
          amount={data.balance}
          currency={data.currency}
          icon={Wallet}
          tone="brand"
          emphasis
        />
        <StatCard
          label="Monthly income"
          description="Income recorded this month"
          href="/money-flow?tab=income"
          amount={data.monthlyIncome}
          currency={data.currency}
          icon={TrendingUp}
          tone="positive"
        />
        <StatCard
          label="Monthly expenses"
          description="Spending recorded this month"
          href="/money-flow"
          amount={data.monthlyExpenses}
          currency={data.currency}
          icon={TrendingDown}
          tone="negative"
        />
        <StatCard
          label="Monthly savings"
          description="This month’s income minus expenses"
          href="/money-flow"
          amount={data.monthlySavings}
          currency={data.currency}
          icon={PiggyBank}
          tone={Number(data.monthlySavings) >= 0 ? "positive" : "negative"}
        />
      </div>

      {!data.hasAnyData && <DashboardGettingStarted />}



      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SpendingActivity months={data.activityMonths} currency={data.currency} initialMonth={data.activityMonths.length - 1} initialDay={data.activityDay} />
        <SpendingTrendChart data={data.spendingTrend} currency={data.currency} />

      </div>

      <Suspense fallback={<AIInsightSkeleton />}>
        <AIInsightSection data={data} />
      </Suspense>

      <CategoryBreakdown items={data.categoryBreakdown} currency={data.currency} />

      <FinancialInsightsCard items={financialInsights} />

      <CardInsightsCard items={cardInsights} />

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
