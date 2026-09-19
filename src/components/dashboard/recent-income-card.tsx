"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, PiggyBank, Repeat } from "lucide-react";
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
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { IncomeFormDialog } from "@/components/income/income-form-dialog";
import { useDeleteIncome, useIncome, type IncomeDTO } from "@/hooks/use-income";

const RECENT_INCOME_FILTERS = {
  sortBy: "date" as const,
  sortOrder: "desc" as const,
  page: 1,
  pageSize: 5,
};

export function RecentIncomeCard({ currency }: { currency: string }) {
  const { data, isLoading } = useIncome(RECENT_INCOME_FILTERS);
  const deleteIncome = useDeleteIncome();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeDTO | null>(null);
  const [pendingDelete, setPendingDelete] = useState<IncomeDTO | null>(null);

  function openCreate() {
    setEditingIncome(null);
    setDialogOpen(true);
  }

  function openEdit(income: IncomeDTO) {
    setEditingIncome(income);
    setDialogOpen(true);
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
    <Card>
      <CardHeader>
        <CardTitle>Recent income</CardTitle>
        <CardAction className="flex items-center gap-3">
          <Link href="/money-flow?tab=income" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            View all
          </Link>
          <Button variant="ghost" size="sm" onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            Add income
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading && !data ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !data || data.income.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No income logged yet. Add your salary, freelance, or other earnings here.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {data.income.map((income) => (
              <li key={income.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                  <PiggyBank className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{income.source}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {format(new Date(income.date), "MMM d")}
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
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Edit income"
                    onClick={() => openEdit(income)}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete income"
                    onClick={() => setPendingDelete(income)}
                  >
                    <Trash2 className="size-3.5 text-destructive" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <IncomeFormDialog open={dialogOpen} onOpenChange={setDialogOpen} income={editingIncome} />

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
    </Card>
  );
}
