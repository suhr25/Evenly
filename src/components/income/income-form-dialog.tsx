"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { type IncomeDTO, type IncomeInput, useCreateIncome, useUpdateIncome } from "@/hooks/use-income";

const RECURRENCE_INTERVALS = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
];

interface FormState {
  amount: string;
  source: string;
  date: string;
  isRecurring: boolean;
  recurrenceInterval: string;
}

function emptyForm(): FormState {
  return {
    amount: "",
    source: "",
    date: format(new Date(), "yyyy-MM-dd"),
    isRecurring: false,
    recurrenceInterval: "MONTHLY",
  };
}

function fromIncome(income: IncomeDTO): FormState {
  return {
    amount: income.amount,
    source: income.source,
    date: format(new Date(income.date), "yyyy-MM-dd"),
    isRecurring: income.isRecurring,
    recurrenceInterval: income.recurrenceInterval ?? "MONTHLY",
  };
}

interface IncomeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  income?: IncomeDTO | null;
}

export function IncomeFormDialog({ open, onOpenChange, income }: IncomeFormDialogProps) {
  const isEdit = Boolean(income);
  const createIncome = useCreateIncome();
  const updateIncome = useUpdateIncome();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState<string | null>(null);

  // Deliberate: reset form state to match whichever income entry (or none)
  // the dialog was opened for, each time it opens.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(income ? fromIncome(income) : emptyForm());
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, income?.id]);

  const saving = createIncome.isPending || updateIncome.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.source.trim()) {
      setError("Please enter a source.");
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }

    const input: IncomeInput = {
      amount: form.amount,
      source: form.source,
      date: form.date,
      isRecurring: form.isRecurring,
      recurrenceInterval: form.isRecurring ? form.recurrenceInterval : null,
    };

    try {
      if (isEdit && income) {
        await updateIncome.mutateAsync({ id: income.id, input });
        toast.success("Income updated");
      } else {
        await createIncome.mutateAsync(input);
        toast.success("Income added");
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit income" : "Add income"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the details below." : "Track money coming in."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="income-amount">Amount</Label>
              <Input
                id="income-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                required
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="income-date">Date</Label>
              <Input
                id="income-date"
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="income-source">Source</Label>
            <Input
              id="income-source"
              required
              placeholder="Salary, freelance, bonus..."
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <Label htmlFor="income-recurring">Recurring income</Label>
              <p className="text-xs text-muted-foreground">Repeats on a schedule</p>
            </div>
            <Switch
              id="income-recurring"
              checked={form.isRecurring}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, isRecurring: checked }))}
            />
          </div>

          {form.isRecurring && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="income-recurrenceInterval">Repeats</Label>
              <Select
                items={Object.fromEntries(RECURRENCE_INTERVALS.map((r) => [r.value, r.label]))}
                value={form.recurrenceInterval}
                onValueChange={(v) => v && setForm((f) => ({ ...f, recurrenceInterval: v }))}
              >
                <SelectTrigger id="income-recurrenceInterval" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_INTERVALS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
              {isEdit ? "Save changes" : "Add income"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
