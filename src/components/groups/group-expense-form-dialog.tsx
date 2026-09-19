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
import { useCategories } from "@/hooks/use-categories";
import {
  useCreateGroupExpense,
  useUpdateGroupExpense,
  type GroupExpenseDTO,
  type GroupExpenseInput,
} from "@/hooks/use-group-expenses";
import type { GroupMemberDTO } from "@/hooks/use-groups";
import { buildSplitPayload, isSplitValid, SplitEditor, type SplitState } from "@/components/groups/split-editor";

interface GroupExpenseFormDialogProps {
  groupId: string;
  members: GroupMemberDTO[];
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: GroupExpenseDTO | null;
}

function defaultSplit(members: GroupMemberDTO[]): SplitState {
  return { splitType: "EQUAL", memberIds: members.map((m) => m.id) };
}

function splitStateFromExpense(expense: GroupExpenseDTO): SplitState {
  if (expense.splitType === "EQUAL") {
    return { splitType: "EQUAL", memberIds: expense.shares.map((s) => s.memberId) };
  }
  if (expense.splitType === "EXACT") {
    return {
      splitType: "EXACT",
      amounts: Object.fromEntries(expense.shares.map((s) => [s.memberId, s.amount])),
    };
  }
  if (expense.splitType === "PERCENTAGE") {
    return {
      splitType: "PERCENTAGE",
      percentages: Object.fromEntries(expense.shares.map((s) => [s.memberId, s.percentage ?? ""])),
    };
  }
  return {
    splitType: "SHARES",
    units: Object.fromEntries(expense.shares.map((s) => [s.memberId, String(s.units ?? 1)])),
  };
}

export function GroupExpenseFormDialog({
  groupId,
  members,
  currency,
  open,
  onOpenChange,
  expense,
}: GroupExpenseFormDialogProps) {
  const isEdit = Boolean(expense);
  const activeMembers = members.filter((m) => m.isActive);
  const { data: categories } = useCategories();
  const createExpense = useCreateGroupExpense(groupId);
  const updateExpense = useUpdateGroupExpense(groupId);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [categoryId, setCategoryId] = useState("");
  const [paidByMemberId, setPaidByMemberId] = useState("");
  const [split, setSplit] = useState<SplitState>(defaultSplit(activeMembers));
  const [error, setError] = useState<string | null>(null);

  // Deliberate: reset the form to match whichever expense (or a blank form)
  // the dialog was opened for, each time it opens.
  useEffect(() => {
    if (!open) return;
    if (expense) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDescription(expense.description);
      setAmount(expense.amount);
      setDate(format(new Date(expense.date), "yyyy-MM-dd"));
      setCategoryId(expense.category.id);
      setPaidByMemberId(expense.paidBy.id);
      setSplit(splitStateFromExpense(expense));
    } else {
      setDescription("");
      setAmount("");
      setDate(format(new Date(), "yyyy-MM-dd"));
      setCategoryId("");
      setPaidByMemberId(activeMembers.find((m) => m.isYou)?.id ?? activeMembers[0]?.id ?? "");
      setSplit(defaultSplit(activeMembers));
    }
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense?.id]);

  const saving = createExpense.isPending || updateExpense.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!categoryId) return setError("Please choose a category.");
    if (!paidByMemberId) return setError("Please choose who paid.");
    if (!amount || Number(amount) <= 0) return setError("Enter an amount greater than 0.");
    if (!isSplitValid(split, Number(amount))) return setError("Fix the split before saving.");

    const input = {
      description,
      amount,
      date,
      categoryId,
      paidByMemberId,
      ...buildSplitPayload(split),
    } as GroupExpenseInput;

    try {
      if (isEdit && expense) {
        await updateExpense.mutateAsync({ expenseId: expense.id, input });
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit expense" : "Add group expense"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the details and split." : "Record a shared expense and split it."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ge-amount">Amount</Label>
              <Input
                id="ge-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ge-date">Date</Label>
              <Input id="ge-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ge-description">Description</Label>
            <Input
              id="ge-description"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ge-category">Category</Label>
              <Select
                items={Object.fromEntries((categories ?? []).map((c) => [c.id, c.name]))}
                value={categoryId}
                onValueChange={(v) => v && setCategoryId(v)}
              >
                <SelectTrigger id="ge-category" className="w-full">
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
              <Label htmlFor="ge-paidby">Paid by</Label>
              <Select
                items={Object.fromEntries(activeMembers.map((m) => [m.id, m.isYou ? `${m.name} (you)` : m.name]))}
                value={paidByMemberId}
                onValueChange={(v) => v && setPaidByMemberId(v)}
              >
                <SelectTrigger id="ge-paidby" className="w-full">
                  <SelectValue placeholder="Who paid?" />
                </SelectTrigger>
                <SelectContent>
                  {activeMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.isYou ? `${m.name} (you)` : m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Split</Label>
            <SplitEditor members={activeMembers} amount={amount} currency={currency} value={split} onChange={setSplit} />
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
