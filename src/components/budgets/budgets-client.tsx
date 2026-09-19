"use client";

import { useMemo, useState } from "react";
import { addMonths, format, getDaysInMonth, isSameMonth } from "date-fns";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { monthKey, useBudgets, useDeleteBudget, type BudgetLineItem } from "@/hooks/use-budgets";
import { SetBudgetDialog } from "@/components/budgets/set-budget-dialog";

const STATUS_TONE: Record<BudgetLineItem["status"], string> = {
  healthy: "text-positive",
  warning: "text-warning",
  exceeded: "text-negative",
  none: "text-muted-foreground",
};

const STATUS_BAR: Record<BudgetLineItem["status"], string> = {
  healthy: "bg-positive",
  warning: "bg-warning",
  exceeded: "bg-negative",
  none: "bg-muted-foreground",
};

const STATUS_LABEL: Record<Exclude<BudgetLineItem["status"], "none">, string> = {
  healthy: "On track",
  warning: "Near limit",
  exceeded: "Exceeded",
};

type Filter = "all" | "over" | "unset";

export function BudgetsClient({ currency }: { currency: string }) {
  const [cursor, setCursor] = useState(() => new Date());
  const month = monthKey(cursor);
  const { data, isLoading } = useBudgets(month);
  const [dialogItem, setDialogItem] = useState<BudgetLineItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<BudgetLineItem | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const deleteBudget = useDeleteBudget();

  /**
   * Month-pace maths. The useful question isn't "how much have I spent" but
   * "am I spending faster than the month is passing". If 40% of the month has
   * elapsed, roughly 40% of the budget should be gone; well past that means
   * the current rate won't last the month.
   *
   * Only meaningful for the current month: a past month is fully elapsed and
   * a future one hasn't started, so pace is suppressed for both.
   */
  const pace = useMemo(() => {
    if (!data || !data.isCurrentMonth) return null;

    const budgeted = Number(data.totalBudgeted);
    // trackedSpent, not totalSpent: only spend in categories that actually
    // have a limit can be measured against the sum of those limits. Using the
    // all-category total here reported a huge overspend whenever some
    // categories were left unbudgeted.
    const spent = Number(data.trackedSpent);
    if (budgeted <= 0) return null;

    const daysInMonth = getDaysInMonth(cursor);
    const daysRemaining = data.daysRemaining ?? 0;
    const daysElapsed = Math.max(1, daysInMonth - daysRemaining);
    const elapsedFraction = daysElapsed / daysInMonth;

    const expectedByNow = budgeted * elapsedFraction;
    const dailyRate = spent / daysElapsed;
    const projected = dailyRate * daysInMonth;

    return {
      daysElapsed,
      daysInMonth,
      daysRemaining,
      elapsedPercent: Math.round(elapsedFraction * 100),
      spentPercent: Math.round((spent / budgeted) * 100),
      projected,
      projectedOver: projected > budgeted,
      overspendingNow: spent > expectedByNow,
      remaining: budgeted - spent,
      dailyAllowance: daysRemaining > 0 ? Math.max(0, budgeted - spent) / daysRemaining : null,
    };
  }, [data, cursor]);

  // Memoised so the `?? []` fallback does not produce a new array identity
  // on every render and invalidate the memos below.
  const items = useMemo(() => data?.items ?? [], [data]);
  const counts = useMemo(
    () => ({
      all: items.length,
      over: items.filter((i) => i.status === "exceeded").length,
      unset: items.filter((i) => i.amount === null).length,
    }),
    [items]
  );

  const visible = useMemo(() => {
    if (filter === "over") return items.filter((i) => i.status === "exceeded");
    if (filter === "unset") return items.filter((i) => i.amount === null);
    return items;
  }, [items, filter]);

  function openDialog(item: BudgetLineItem) {
    setDialogItem(item);
    setDialogOpen(true);
  }

  async function confirmDelete() {
    if (!pendingDelete?.budgetId) return;
    try {
      await deleteBudget.mutateAsync(pendingDelete.budgetId);
      toast.success(`${pendingDelete.name} budget removed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove budget");
    } finally {
      setPendingDelete(null);
    }
  }

  const totalPercent =
    data && Number(data.totalBudgeted) > 0
      ? Math.round((Number(data.trackedSpent) / Number(data.totalBudgeted)) * 100)
      : null;

  // Spend that falls outside every budgeted category. Worth naming rather than
  // hiding: it is real money, it just isn't measured by any limit.
  const untracked = data ? Number(data.totalSpent) - Number(data.trackedSpent) : 0;

  return (
    <div className="section-seq flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[1.375rem] font-semibold leading-tight tracking-[-0.02em]">Budgets</h1>
          <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
            Monthly limits per category, tracked against your actual spend.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => setCursor((c) => addMonths(c, -1))}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <p className="min-w-[8.5rem] text-center text-[0.8125rem] font-medium tabular-nums">
            {format(cursor, "MMMM yyyy")}
          </p>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            disabled={isSameMonth(cursor, new Date())}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      {/* ---- Overview ---- */}
      {data && (
        <Card className="overflow-hidden">
          <CardContent className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Metric label="Budgeted" value={formatMoney(data.totalBudgeted, currency)} />
              <Metric
                label="Spent against budgets"
                value={formatMoney(data.trackedSpent, currency)}
                hint={
                  untracked > 0
                    ? `${formatMoney(untracked, currency)} more spent in categories with no limit`
                    : undefined
                }
              />
              <Metric
                label="Remaining"
                value={formatMoney(
                  Math.max(0, Number(data.totalBudgeted) - Number(data.trackedSpent)),
                  currency
                )}
                tone={
                  Number(data.trackedSpent) > Number(data.totalBudgeted) ? "negative" : "positive"
                }
              />
              <Metric
                label={pace ? `${pace.daysRemaining} days left` : "Period"}
                value={pace ? `${pace.elapsedPercent}% elapsed` : format(cursor, "MMM yyyy")}
              />
            </div>

            {totalPercent !== null && (
              <div className="flex flex-col gap-2">
                {/*
                  The month-progress marker is the point of this bar: it shows
                  where spending *should* be by now, so being left of it means
                  on pace and right of it means burning too fast.
                */}
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-500 ease-out",
                      totalPercent >= 100
                        ? "bg-negative"
                        : totalPercent >= 80
                          ? "bg-warning"
                          : "bg-positive"
                    )}
                    style={{ width: `${Math.min(totalPercent, 100)}%` }}
                  />
                  {pace && (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span
                            className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-foreground/70"
                            style={{ left: `${Math.min(pace.elapsedPercent, 100)}%` }}
                          />
                        }
                      />
                      <TooltipContent>
                        {pace.elapsedPercent}% of the month has passed
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[0.8125rem]">
                  <span className="tabular-nums text-muted-foreground">
                    {totalPercent}% of budget used
                  </span>
                  {pace && (
                    <span
                      className={cn(
                        "flex items-center gap-1.5 font-medium tabular-nums",
                        pace.projectedOver ? "text-negative" : "text-positive"
                      )}
                    >
                      <TrendingUp className="size-3.5" aria-hidden />
                      On track for {formatMoney(pace.projected.toFixed(2), currency)} by month end
                    </span>
                  )}
                </div>

                {pace?.dailyAllowance !== null && pace?.dailyAllowance !== undefined && (
                  <p className="text-[0.8125rem] text-muted-foreground">
                    {pace.remaining > 0 ? (
                      <>
                        You can spend{" "}
                        <span className="font-medium tabular-nums text-foreground">
                          {formatMoney(pace.dailyAllowance.toFixed(2), currency)}/day
                        </span>{" "}
                        for the remaining {pace.daysRemaining} days and stay within budget.
                      </>
                    ) : (
                      <span className="text-negative">
                        Budget is already exhausted with {pace.daysRemaining} days to go.
                      </span>
                    )}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---- Filters ---- */}
      {!isLoading && items.length > 0 && (
        <AnimatedTabs
          aria-label="Filter budgets"
          value={filter}
          onValueChange={(v) => setFilter(v as Filter)}
          items={[
            { value: "all", label: `All ${counts.all}` },
            { value: "over", label: `Over ${counts.over}` },
            { value: "unset", label: `No limit ${counts.unset}` },
          ]}
        />
      )}

      {isLoading ? (
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[4.5rem] w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium">
              {filter === "over" ? "Nothing over budget" : "No categories here"}
            </p>
            <p className="mt-1 text-[0.8125rem] text-muted-foreground">
              {filter === "over"
                ? "Every category with a limit is still within it."
                : "Every category already has a limit set."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="stagger flex flex-col gap-2.5">
          {visible.map((item) => {
            const Icon = getCategoryIcon(item.icon);
            const hasBudget = item.amount !== null;
            const over = hasBudget && Number(item.spent) > Number(item.amount);

            return (
              <li
                key={item.categoryId}
                className="group/budget rounded-xl border bg-card p-4 transition-colors duration-200 hover:border-input"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: `color-mix(in oklch, ${item.color} 14%, transparent)`,
                      }}
                    >
                      <Icon className="size-4" style={{ color: item.color }} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[0.875rem] font-medium">
                        {item.name}
                      </span>
                      <span className="block text-xs tabular-nums text-muted-foreground">
                        {hasBudget ? (
                          <>
                            {formatMoney(item.spent, currency)} of{" "}
                            {formatMoney(item.amount!, currency)}
                          </>
                        ) : (
                          <>{formatMoney(item.spent, currency)} spent, no limit</>
                        )}
                      </span>
                    </span>
                  </span>

                  <div className="flex shrink-0 items-center gap-2">
                    {hasBudget && item.status !== "none" && (
                      <Badge
                        variant="secondary"
                        className={cn("hidden text-[11px] sm:inline-flex", STATUS_TONE[item.status])}
                      >
                        {STATUS_LABEL[item.status]}
                      </Badge>
                    )}
                    {hasBudget ? (
                      <div className="flex items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover/budget:opacity-100 md:group-focus-within/budget:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${item.name} budget`}
                          onClick={() => openDialog(item)}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${item.name} budget`}
                          onClick={() => setPendingDelete(item)}
                        >
                          <Trash2 className="size-4 text-destructive" aria-hidden />
                        </Button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => openDialog(item)}>
                        <Plus className="size-3.5" aria-hidden />
                        Set limit
                      </Button>
                    )}
                  </div>
                </div>

                {hasBudget && (
                  <div className="mt-3 flex items-center gap-3">
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width] duration-500 ease-out",
                          STATUS_BAR[item.status]
                        )}
                        style={{ width: `${Math.min(item.percentUsed ?? 0, 100)}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        "w-11 shrink-0 text-right text-xs font-medium tabular-nums",
                        STATUS_TONE[item.status]
                      )}
                    >
                      {item.percentUsed ?? 0}%
                    </span>
                  </div>
                )}

                {over && (
                  <p className="mt-2 text-xs text-negative">
                    {formatMoney(Number(item.spent) - Number(item.amount), currency)} over the limit
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <SetBudgetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={dialogItem}
        periodStart={data?.periodStart ?? cursor.toISOString()}
      />

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {pendingDelete?.name} budget?</AlertDialogTitle>
            <AlertDialogDescription>
              This only removes the budget limit. Your expenses in this category are unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmDelete}
              disabled={deleteBudget.isPending}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
  /** Small caption under the figure, for context the number alone can mislead on. */
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[0.6875rem] font-medium uppercase leading-none tracking-[0.07em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "truncate text-lg font-semibold tabular-nums tracking-[-0.02em]",
          tone === "positive" && "text-positive",
          tone === "negative" && "text-negative"
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="text-[0.6875rem] leading-snug text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
