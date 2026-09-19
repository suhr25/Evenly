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
import { EmojiIconPicker } from "@/components/shared/emoji-icon-picker";
import { GOAL_ICONS } from "@/lib/validations/goal";
import { useCreateGoal, useUpdateGoal, type GoalDTO, type GoalInput } from "@/hooks/use-goals";

interface GoalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: GoalDTO | null;
}

interface FormState {
  name: string;
  icon: string;
  targetAmount: string;
  currentAmount: string;
  targetDate: string;
  monthlyContribution: string;
}

function emptyForm(): FormState {
  return { name: "", icon: "🎯", targetAmount: "", currentAmount: "", targetDate: "", monthlyContribution: "" };
}

function fromGoal(goal: GoalDTO): FormState {
  return {
    name: goal.name,
    icon: goal.icon,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    targetDate: goal.targetDate ? goal.targetDate.slice(0, 10) : "",
    monthlyContribution: goal.monthlyContribution ?? "",
  };
}

export function GoalFormDialog({ open, onOpenChange, goal }: GoalFormDialogProps) {
  const isEdit = Boolean(goal);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();

  // Deliberate: reset the form to match whichever goal (or a blank form) the
  // dialog was opened for, each time it opens.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(goal ? fromGoal(goal) : emptyForm());
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, goal?.id]);

  const saving = createGoal.isPending || updateGoal.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) return setError("Give your goal a name.");
    if (!form.targetAmount || Number(form.targetAmount) <= 0) {
      return setError("Enter a target amount greater than 0.");
    }

    const input: GoalInput = {
      name: form.name,
      icon: form.icon,
      targetAmount: form.targetAmount,
      currentAmount: form.currentAmount || "0",
      targetDate: form.targetDate || null,
      monthlyContribution: form.monthlyContribution || null,
    };

    try {
      if (isEdit && goal) {
        await updateGoal.mutateAsync({ id: goal.id, input });
        toast.success("Goal updated");
      } else {
        await createGoal.mutateAsync(input);
        toast.success("Goal created");
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit goal" : "New savings goal"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the details of this goal." : "Give it a name, a target, and a deadline."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="goal-name">Name</Label>
            <Input
              id="goal-name"
              required
              placeholder="Emergency fund"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Icon</Label>
            <EmojiIconPicker
              icons={GOAL_ICONS}
              value={form.icon}
              onChange={(icon) => setForm((f) => ({ ...f, icon }))}
              label="Goal icon"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="goal-target">Target amount</Label>
              <Input
                id="goal-target"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                required
                value={form.targetAmount}
                onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="goal-current">Already saved</Label>
              <Input
                id="goal-current"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={form.currentAmount}
                onChange={(e) => setForm((f) => ({ ...f, currentAmount: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="goal-date">Target date (optional)</Label>
              <Input
                id="goal-date"
                type="date"
                value={form.targetDate}
                onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="goal-monthly">Monthly plan (optional)</Label>
              <Input
                id="goal-monthly"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={form.monthlyContribution}
                onChange={(e) => setForm((f) => ({ ...f, monthlyContribution: e.target.value }))}
              />
            </div>
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
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {isEdit ? "Save changes" : "Create goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
