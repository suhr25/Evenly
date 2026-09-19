"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, PiggyBank, Pencil, Repeat, Trash2 } from "lucide-react";
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
import { formatMoney } from "@/lib/money";
import { useDeleteIncome, type IncomeDTO, type IncomeListResponse } from "@/hooks/use-income";

interface IncomeListProps {
  data: IncomeListResponse | undefined;
  isLoading: boolean;
  currency: string;
  onEdit: (income: IncomeDTO) => void;
  onPageChange: (page: number) => void;
}

export function IncomeList({ data, isLoading, currency, onEdit, onPageChange }: IncomeListProps) {
  const [pendingDelete, setPendingDelete] = useState<IncomeDTO | null>(null);
  const deleteIncome = useDeleteIncome();

  if (isLoading && !data) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.income.length === 0) {
    return (
      <div className="rounded-lg border py-16 text-center">
        <p className="text-sm text-muted-foreground">No income entries match your filters.</p>
      </div>
    );
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteIncome.mutateAsync(pendingDelete.id);
      toast.success("Income deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete income");
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y rounded-lg border">
        {data.income.map((income) => (
          <li key={income.id} className="flex items-center gap-3 p-3 sm:p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
              <PiggyBank className="size-4.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{income.source}</p>
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {format(new Date(income.date), "MMM d, yyyy")}
                {income.isRecurring && (
                  <Badge variant="secondary" className="h-4 gap-0.5 px-1.5 text-[10px]">
                    <Repeat className="size-2.5" aria-hidden />
                    {income.recurrenceInterval?.toLowerCase()}
                  </Badge>
                )}
              </p>
            </div>
            <p className="shrink-0 tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
              +{formatMoney(income.amount, currency)}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit income"
                onClick={() => onEdit(income)}
              >
                <Pencil className="size-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete income"
                onClick={() => setPendingDelete(income)}
              >
                <Trash2 className="size-4 text-destructive" aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {data.page} of {data.totalPages} · {data.total} entries
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1}
              onClick={() => onPageChange(data.page - 1)}
            >
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
            <AlertDialogTitle>Delete this income entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && (
                <>
                  &ldquo;{pendingDelete.source}&rdquo; for{" "}
                  {formatMoney(pendingDelete.amount, currency)} will be permanently deleted. This
                  can&apos;t be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmDelete}
              disabled={deleteIncome.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
