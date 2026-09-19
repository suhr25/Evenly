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
import { Textarea } from "@/components/ui/textarea";
import { useCategories } from "@/hooks/use-categories";
import {
  type ExpenseDTO,
  type ExpenseInput,
  useCreateExpense,
  useUpdateExpense,
} from "@/hooks/use-expenses";
import { useMyCards } from "@/hooks/use-cards";
import { useRewardEstimate } from "@/hooks/use-reward-estimate";
import { VoiceEntryButton } from "@/components/expenses/voice-entry-button";
import { formatMoney } from "@/lib/money";

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "OTHER", label: "Other" },
];

const RECURRENCE_INTERVALS = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
];

interface FormState {
  amount: string;
  categoryId: string;
  userCardId: string;
  isOnline: boolean;
  description: string;
  date: string;
  paymentMethod: string;
  isRecurring: boolean;
  recurrenceInterval: string;
  notes: string;
}

function emptyForm(): FormState {
  return {
    amount: "",
    categoryId: "",
    userCardId: "",
    isOnline: false,
    description: "",
    date: format(new Date(), "yyyy-MM-dd"),
    paymentMethod: "CASH",
    isRecurring: false,
    recurrenceInterval: "MONTHLY",
    notes: "",
  };
}

function fromExpense(expense: ExpenseDTO): FormState {
  return {
    amount: expense.amount,
    categoryId: expense.category.id,
    userCardId: expense.userCard?.id ?? "",
    isOnline: expense.isOnline ?? false,
    description: expense.description,
    date: format(new Date(expense.date), "yyyy-MM-dd"),
    paymentMethod: expense.paymentMethod,
    isRecurring: expense.isRecurring,
    recurrenceInterval: expense.recurrenceInterval ?? "MONTHLY",
    notes: expense.notes ?? "",
  };
}

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: ExpenseDTO | null;
}

export function ExpenseFormDialog({ open, onOpenChange, expense }: ExpenseFormDialogProps) {
  const isEdit = Boolean(expense);
  const { data: categories } = useCategories();
  const { data: myCards } = useMyCards();
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState<string | null>(null);

  const rewardEstimate = useRewardEstimate({
    userCardId: form.paymentMethod === "CARD" ? form.userCardId || null : null,
    amount: form.amount,
    categoryId: form.categoryId || null,
    channel: form.isOnline ? "ONLINE" : "OFFLINE",
  });

  // Deliberate: reset form state to match whichever expense (or none) the
  // dialog was opened for, each time it opens.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(expense ? fromExpense(expense) : emptyForm());
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense?.id]);

  const saving = createExpense.isPending || updateExpense.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.categoryId) {
      setError("Please choose a category.");
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }

    const input: ExpenseInput = {
      amount: form.amount,
      categoryId: form.categoryId,
      userCardId: form.paymentMethod === "CARD" ? form.userCardId || null : null,
      isOnline: form.paymentMethod === "CARD" ? form.isOnline : null,
      description: form.description,
      date: form.date,
      paymentMethod: form.paymentMethod,
      isRecurring: form.isRecurring,
      recurrenceInterval: form.isRecurring ? form.recurrenceInterval : null,
      notes: form.notes || null,
    };

    try {
      if (isEdit && expense) {
        await updateExpense.mutateAsync({ id: expense.id, input });
        toast.success("Expense updated");
      } else {
        await createExpense.mutateAsync(input);
        toast.success("Expense added");
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
          <DialogTitle>{isEdit ? "Edit expense" : "Add expense"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the details below." : "Track a new expense."}
          </DialogDescription>
        </DialogHeader>

        {!isEdit && (
          <VoiceEntryButton
            onParsed={(result) =>
              setForm((f) => ({
                ...f,
                amount: result.amount || f.amount,
                description: result.description || f.description,
                categoryId: result.categoryId || f.categoryId,
              }))
            }
          />
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
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
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              required
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="category">Category</Label>
              <Select
                items={Object.fromEntries((categories ?? []).map((c) => [c.id, c.name]))}
                value={form.categoryId}
                onValueChange={(v) => v && setForm((f) => ({ ...f, categoryId: v }))}
              >
                <SelectTrigger id="category" className="w-full">
                  <SelectValue placeholder="Choose category" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="paymentMethod">Payment method</Label>
              <Select
                items={Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label]))}
                value={form.paymentMethod}
                onValueChange={(v) =>
                  v &&
                  setForm((f) => ({
                    ...f,
                    paymentMethod: v,
                    userCardId: v === "CARD" ? f.userCardId : "",
                  }))
                }
              >
                <SelectTrigger id="paymentMethod" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.paymentMethod === "CARD" && myCards && myCards.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="userCardId">Which card? (optional)</Label>
              <Select
                items={Object.fromEntries(
                  myCards.map((c) => [
                    c.id,
                    c.nickname || `${c.cardProduct.issuerName} ${c.cardProduct.name}`,
                  ])
                )}
                value={form.userCardId}
                onValueChange={(v) => setForm((f) => ({ ...f, userCardId: v ?? "" }))}
              >
                <SelectTrigger id="userCardId" className="w-full">
                  <SelectValue placeholder="Not specified" />
                </SelectTrigger>
                <SelectContent>
                  {myCards.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nickname || `${c.cardProduct.issuerName} ${c.cardProduct.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.paymentMethod === "CARD" && (
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <Label htmlFor="isOnline">Online transaction</Label>
                <p className="text-xs text-muted-foreground">
                  Some cards reward online and offline spends differently
                </p>
              </div>
              <Switch
                id="isOnline"
                checked={form.isOnline}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, isOnline: checked }))}
              />
            </div>
          )}

          {form.paymentMethod === "CARD" && form.userCardId && rewardEstimate.data && (
            <div className="rounded-md border border-dashed p-3 text-sm">
              <p className="font-medium">
                Estimated reward: {formatMoney(rewardEstimate.data.cappedValueInr, "INR")}
              </p>
              <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                {rewardEstimate.data.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <Label htmlFor="recurring">Recurring expense</Label>
              <p className="text-xs text-muted-foreground">Repeats on a schedule</p>
            </div>
            <Switch
              id="recurring"
              checked={form.isRecurring}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, isRecurring: checked }))}
            />
          </div>

          {form.isRecurring && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="recurrenceInterval">Repeats</Label>
              <Select
                items={Object.fromEntries(RECURRENCE_INTERVALS.map((r) => [r.value, r.label]))}
                value={form.recurrenceInterval}
                onValueChange={(v) => v && setForm((f) => ({ ...f, recurrenceInterval: v }))}
              >
                <SelectTrigger id="recurrenceInterval" className="w-full">
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
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
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {isEdit ? "Save changes" : "Add expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
