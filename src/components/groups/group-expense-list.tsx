"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatMoney } from "@/lib/money";
import { useDeleteGroupExpense, type GroupExpenseDTO, type GroupExpenseListResponse } from "@/hooks/use-group-expenses";

const SPLIT_LABEL: Record<string, string> = {
  EQUAL: "Split equally",
  EXACT: "Split by exact amount",
  PERCENTAGE: "Split by percentage",
  SHARES: "Split by shares",
};

interface GroupExpenseListProps {
  groupId: string;
  data: GroupExpenseListResponse | undefined;
  isLoading: boolean;
  currency: string;
  onEdit: (expense: GroupExpenseDTO) => void;
  onPageChange: (page: number) => void;
}

export function GroupExpenseList({ groupId, data, isLoading, currency, onEdit, onPageChange }: GroupExpenseListProps) {
  const [pendingDelete, setPendingDelete] = useState<GroupExpenseDTO | null>(null);
  const deleteExpense = useDeleteGroupExpense(groupId);

  if (isLoading && !data) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.expenses.length === 0) {
    return (
      <div className="rounded-lg border py-16 text-center">
        <p className="text-sm text-muted-foreground">No expenses in this group yet.</p>
      </div>
    );
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteExpense.mutateAsync(pendingDelete.id);
      toast.success("Expense deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete expense");
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y rounded-lg border">
        {data.expenses.map((expense) => {
          const Icon = getCategoryIcon(expense.category.icon);
          return (
            <li key={expense.id} className="flex items-center gap-3 p-3 sm:p-4">
              <div
                className="flex size-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `color-mix(in oklch, ${expense.category.color} 15%, transparent)` }}
              >
                <Icon className="size-4.5" style={{ color: expense.category.color }} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{expense.description}</p>
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {format(new Date(expense.date), "MMM d, yyyy")} · Paid by {expense.paidBy.name}
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                    {SPLIT_LABEL[expense.splitType]}
                  </Badge>
                </p>
              </div>
              <p className="shrink-0 tabular-nums font-medium">{formatMoney(expense.amount, currency)}</p>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="icon-sm" aria-label="Edit expense" onClick={() => onEdit(expense)}>
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete expense"
                  onClick={() => setPendingDelete(expense)}
                >
                  <Trash2 className="size-4 text-destructive" aria-hidden />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {data.page} of {data.totalPages} · {data.total} expenses
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => onPageChange(data.page - 1)}>
              <ChevronLeft className="size-4" aria-hidden />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= data.totalPages}
              onClick={() => onPageChange(data.page + 1)}
            >
              Next
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && (
                <>
                  &ldquo;{pendingDelete.description}&rdquo; for {formatMoney(pendingDelete.amount, currency)} will
                  be permanently deleted, and everyone&apos;s balances will be recalculated. This can&apos;t be
                  undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmDelete}
              disabled={deleteExpense.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
