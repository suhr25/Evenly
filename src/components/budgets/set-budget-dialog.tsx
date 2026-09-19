"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSetBudget, type BudgetLineItem } from "@/hooks/use-budgets";

interface SetBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: BudgetLineItem | null;
  periodStart: string;
}

export function SetBudgetDialog({ open, onOpenChange, item, periodStart }: SetBudgetDialogProps) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const setBudget = useSetBudget();

  // Deliberate: reset the form to match whichever line item the dialog was
  // opened for, each time it opens.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAmount(item?.amount ?? "");
      setError(null);
    }
  }, [open, item?.categoryId, item?.amount]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!item) return;
    if (!amount || Number(amount) <= 0) return setError("Enter an amount greater than 0.");

    try {
      await setBudget.mutateAsync({ categoryId: item.categoryId, amount, periodStart });
      toast.success(`${item.name} budget saved`);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save budget");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{item?.amount ? "Edit" : "Set"} budget: {item?.name}</DialogTitle>
          <DialogDescription>Monthly limit for this category.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="budget-amount">Amount</Label>
            <Input
              id="budget-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              required
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={setBudget.isPending}>
              {setBudget.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Save budget
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
