"use client";

import { useState } from "react";
import { addMonths, format } from "date-fns";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
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
import { getCategoryIcon } from "@/lib/category-icons";
import { formatMoney } from "@/lib/money";
import { monthKey, useBudgets, useDeleteBudget, type BudgetLineItem } from "@/hooks/use-budgets";
import { SetBudgetDialog } from "@/components/budgets/set-budget-dialog";

const STATUS_COLOR: Record<BudgetLineItem["status"], string> = {
  healthy: "var(--status-good)",
  warning: "var(--status-warning)",
  exceeded: "var(--status-critical)",
  none: "var(--muted-foreground)",
};

const STATUS_LABEL: Record<Exclude<BudgetLineItem["status"], "none">, string> = {
  healthy: "On track",
  warning: "Near limit",
  exceeded: "Exceeded",
};

export function BudgetsClient({ currency }: { currency: string }) {
  const [cursor, setCursor] = useState(() => new Date());
  const month = monthKey(cursor);
  const { data, isLoading } = useBudgets(month);
  const [dialogItem, setDialogItem] = useState<BudgetLineItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<BudgetLineItem | null>(null);
  const deleteBudget = useDeleteBudget();

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Budgets</h1>
          <p className="text-sm text-muted-foreground">Set monthly limits per category and track them.</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setCursor((c) => addMonths(c, -1))}>
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <p className="font-medium">{format(cursor, "MMMM yyyy")}</p>
        <Button variant="outline" size="icon" aria-label="Next month" onClick={() => setCursor((c) => addMonths(c, 1))}>
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>

      {data && (
        <Card>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total budgeted</p>
              <p className="text-xl font-semibold tabular-nums">{formatMoney(data.totalBudgeted, currency)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">
                Total spent{data.daysRemaining !== null ? ` · ${data.daysRemaining}d left` : ""}
              </p>
              <p className="text-xl font-semibold tabular-nums">{formatMoney(data.totalSpent, currency)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {data?.items.map((item) => {
            const Icon = getCategoryIcon(item.icon);
            const hasBudget = item.amount !== null;
            return (
              <li key={item.categoryId} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium">
                    <Icon className="size-4" style={{ color: item.color }} aria-hidden />
                    {item.name}
                  </span>
                  <div className="flex items-center gap-2">
                    {hasBudget && item.status !== "none" && (
                      <Badge
                        variant="secondary"
                        style={{ color: STATUS_COLOR[item.status] }}
                        className="text-[11px]"
                      >
                        {STATUS_LABEL[item.status]}
                      </Badge>
                    )}
                    {hasBudget ? (
                      <>
                        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${item.name} budget`} onClick={() => openDialog(item)}>
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
                      </>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => openDialog(item)}>
                        <Plus className="size-3.5" aria-hidden />
                        Set budget
                      </Button>
                    )}
                  </div>
                </div>

                {hasBudget ? (
                  <>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-[width]"
                        style={{
                          width: `${Math.min(item.percentUsed ?? 0, 100)}%`,
                          backgroundColor: STATUS_COLOR[item.status],
                        }}
                      />
                    </div>
                    <p className="mt-1.5 text-sm tabular-nums text-muted-foreground">
                      {formatMoney(item.spent, currency)} of {formatMoney(item.amount!, currency)} spent
                      {item.percentUsed !== null ? ` (${item.percentUsed}%)` : ""}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {formatMoney(item.spent, currency)} spent, no budget set
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
