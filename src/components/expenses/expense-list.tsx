"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Pencil, Repeat, Trash2, Users } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatMoney } from "@/lib/money";
import { useDeleteExpense, type ExpenseDTO, type ExpenseListResponse } from "@/hooks/use-expenses";

const PAYMENT_LABEL: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  OTHER: "Other",
};

interface ExpenseListProps {
  data: ExpenseListResponse | undefined;
  isLoading: boolean;
  currency: string;
  onEdit: (expense: ExpenseDTO) => void;
  onPageChange: (page: number) => void;
}

export function ExpenseList({ data, isLoading, currency, onEdit, onPageChange }: ExpenseListProps) {
  const [pendingDelete, setPendingDelete] = useState<ExpenseDTO | null>(null);
  const deleteExpense = useDeleteExpense();

  if (isLoading && !data) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.expenses.length === 0) {
    return (
      <div className="rounded-lg border py-16 text-center">
        <p className="text-sm text-muted-foreground">No expenses match your filters.</p>
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
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[45%]">Description</TableHead>
              <TableHead className="hidden md:table-cell">Category</TableHead>
              <TableHead className="hidden lg:table-cell">Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-[84px] text-right sr-only">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.expenses.map((expense) => {
              const Icon = getCategoryIcon(expense.category.icon);
              return (
                <TableRow key={expense.id} className="group/row">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: `color-mix(in oklch, ${expense.category.color} 14%, transparent)`,
                        }}
                      >
                        <Icon className="size-4" style={{ color: expense.category.color }} aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{expense.description}</p>
                        <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground md:hidden">
                          {format(new Date(expense.date), "MMM d")} · {expense.category.name}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-normal">
                        {expense.category.name}
                      </Badge>
                      <Badge variant="outline" className="h-5 px-1.5 text-[11px] font-normal">
                        {PAYMENT_LABEL[expense.paymentMethod] ?? expense.paymentMethod}
                      </Badge>
                      {expense.userCard && (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-normal">
                                {expense.userCard.label}
                              </Badge>
                            }
                          />
                          <TooltipContent>Paid with {expense.userCard.label}</TooltipContent>
                        </Tooltip>
                      )}
                      {expense.group && (
                        <Badge variant="secondary" className="h-5 gap-0.5 px-1.5 text-[11px] font-normal">
                          <Users className="size-2.5" aria-hidden />
                          {expense.group.name}
                        </Badge>
                      )}
                      {expense.isRecurring && (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Badge variant="secondary" className="h-5 gap-0.5 px-1.5 text-[11px] font-normal">
                                <Repeat className="size-2.5" aria-hidden />
                                {expense.recurrenceInterval?.toLowerCase()}
                              </Badge>
                            }
                          />
                          <TooltipContent>Repeats {expense.recurrenceInterval?.toLowerCase()}</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                    {format(new Date(expense.date), "MMM d, yyyy")}
                  </TableCell>

                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(expense.amount, currency)}
                  </TableCell>

                  <TableCell className="text-right">
                    {expense.group ? (
                      <Link
                        href={`/groups/${expense.group.id}`}
                        className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                      >
                        In group
                      </Link>
                    ) : (
                      // Revealed on row hover on pointer devices, always visible
                      // on touch where there is no hover state to rely on.
                      <div className="flex items-center justify-end gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${expense.description}`}
                          onClick={() => onEdit(expense)}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${expense.description}`}
                          onClick={() => setPendingDelete(expense)}
                        >
                          <Trash2 className="size-4 text-destructive" aria-hidden />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {data.page} of {data.totalPages} · {data.total} expenses
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
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && (
                <>
                  &ldquo;{pendingDelete.description}&rdquo; for{" "}
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
