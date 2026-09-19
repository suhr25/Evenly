"use client";

import { useState } from "react";
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
import { useAddContribution, type GoalDTO } from "@/hooks/use-goals";

interface AddFundsDialogProps {
  goal: GoalDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFundsDialog({ goal, open, onOpenChange }: AddFundsDialogProps) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const addContribution = useAddContribution();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!goal) return;
    if (!amount || Number(amount) <= 0) return setError("Enter an amount greater than 0.");

    try {
      await addContribution.mutateAsync({ id: goal.id, amount, note: note || undefined });
      toast.success(`₹${amount} added to ${goal.name}`);
      setAmount("");
      setNote("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add funds");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setAmount("");
          setNote("");
          setError(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add funds to {goal?.name}</DialogTitle>
          <DialogDescription>Log money you&apos;ve set aside for this goal.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="funds-amount">Amount</Label>
            <Input
              id="funds-amount"
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="funds-note">Note (optional)</Label>
            <Input id="funds-note" value={note} onChange={(e) => setNote(e.target.value)} />
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
            <Button type="submit" disabled={addContribution.isPending}>
              {addContribution.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Add funds
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
