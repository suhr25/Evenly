"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, PiggyBank, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { useDeleteGoal, type GoalDTO } from "@/hooks/use-goals";

interface GoalCardProps {
  goal: GoalDTO;
  currency: string;
  onEdit: () => void;
  onAddFunds: () => void;
}

export function GoalCard({ goal, currency, onEdit, onAddFunds }: GoalCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteGoal = useDeleteGoal();

  async function handleDelete() {
    try {
      await deleteGoal.mutateAsync(goal.id);
      toast.success(`${goal.name} removed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove goal");
    } finally {
      setConfirmDelete(false);
    }
  }

  return (
    <Card className={goal.isCompleted ? "border-[var(--status-good)]/40" : undefined}>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-xl">
              {goal.icon}
            </div>
            <div>
              <p className="flex items-center gap-1.5 font-medium">
                {goal.name}
                {goal.isCompleted && (
                  <CheckCircle2 className="size-4 text-positive" aria-label="Goal reached" />
                )}
              </p>
              {goal.targetDate && (
                <p className="text-xs text-muted-foreground">Target: {format(new Date(goal.targetDate), "MMM d, yyyy")}</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${goal.name}`} onClick={onEdit}>
              <Pencil className="size-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${goal.name}`}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4 text-destructive" aria-hidden />
            </Button>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-semibold tabular-nums">
              {formatMoney(goal.currentAmount, currency)}
            </span>
            <span className="text-sm text-muted-foreground">
              of {formatMoney(goal.targetAmount, currency)}
            </span>
          </div>
          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-positive transition-[width]"
              style={{ width: `${goal.progressPercent}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {goal.progressPercent}% there
            {!goal.isCompleted && ` · ${formatMoney(goal.remaining, currency)} to go`}
          </p>
        </div>

        {!goal.isCompleted && (goal.requiredMonthlyContribution || goal.expectedCompletionDate) && (
          <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {goal.requiredMonthlyContribution &&
              `Save ${formatMoney(goal.requiredMonthlyContribution, currency)}/month to hit your target date.`}
            {goal.requiredMonthlyContribution && goal.expectedCompletionDate && " "}
            {goal.expectedCompletionDate &&
              `At your planned pace, you'll get there by ${format(new Date(goal.expectedCompletionDate), "MMM yyyy")}.`}
          </p>
        )}

        <Button variant="outline" size="sm" onClick={onAddFunds} disabled={goal.isCompleted}>
          <Plus className="size-3.5" aria-hidden />
          Add funds
        </Button>

        {goal.recentContributions.length > 0 && (
          <ul className="flex flex-col gap-1 border-t pt-3 text-xs text-muted-foreground">
            {goal.recentContributions.slice(0, 3).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 truncate">
                  <PiggyBank className="size-3 shrink-0" aria-hidden />
                  {c.note || "Contribution"}
                </span>
                <span className="shrink-0 tabular-nums">
                  +{formatMoney(c.amount, currency)} · {format(new Date(c.createdAt), "MMM d")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {goal.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the goal and its contribution history. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleteGoal.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
