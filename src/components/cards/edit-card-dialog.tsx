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
import { useUpdateCard, type UserCardDTO } from "@/hooks/use-cards";

interface FormState {
  nickname: string;
  lastFourDigits: string;
  creditLimit: string;
  outstanding: string;
  rewardBalance: string;
  statementDate: string;
  paymentDueDate: string;
}

function fromCard(card: UserCardDTO): FormState {
  return {
    nickname: card.nickname ?? "",
    lastFourDigits: card.lastFourDigits ?? "",
    creditLimit: card.creditLimit ?? "",
    outstanding: card.outstanding ?? "",
    rewardBalance: card.rewardBalance ?? "",
    statementDate: card.statementDate?.toString() ?? "",
    paymentDueDate: card.paymentDueDate?.toString() ?? "",
  };
}

interface EditCardDialogProps {
  card: UserCardDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditCardDialog({ card, open, onOpenChange }: EditCardDialogProps) {
  const updateCard = useUpdateCard();
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    if (open && card) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(fromCard(card));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, card?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!card || !form) return;
    try {
      await updateCard.mutateAsync({
        id: card.id,
        input: {
          nickname: form.nickname || null,
          lastFourDigits: form.lastFourDigits || null,
          creditLimit: form.creditLimit || null,
          outstanding: form.outstanding || null,
          rewardBalance: form.rewardBalance || null,
          statementDate: form.statementDate ? Number(form.statementDate) : null,
          paymentDueDate: form.paymentDueDate ? Number(form.paymentDueDate) : null,
        },
      });
      toast.success("Card updated");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update card");
    }
  }

  if (!card || !form) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Edit {card.cardProduct.issuerName} {card.cardProduct.name}
          </DialogTitle>
          <DialogDescription>Updating these fields marks them as manually entered.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-card-limit">Credit limit</Label>
              <Input
                id="edit-card-limit"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={form.creditLimit}
                onChange={(e) => setForm((f) => f && { ...f, creditLimit: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-card-outstanding">Current outstanding</Label>
              <Input
                id="edit-card-outstanding"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={form.outstanding}
                onChange={(e) => setForm((f) => f && { ...f, outstanding: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-card-reward-balance">
              {card.cardProduct.rewardCurrencyName ?? "Reward"} balance
            </Label>
            <Input
              id="edit-card-reward-balance"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.rewardBalance}
              onChange={(e) => setForm((f) => f && { ...f, rewardBalance: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-card-statement">Statement date</Label>
              <Input
                id="edit-card-statement"
                type="number"
                min="1"
                max="31"
                value={form.statementDate}
                onChange={(e) => setForm((f) => f && { ...f, statementDate: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-card-due">Payment due date</Label>
              <Input
                id="edit-card-due"
                type="number"
                min="1"
                max="31"
                value={form.paymentDueDate}
                onChange={(e) => setForm((f) => f && { ...f, paymentDueDate: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-card-nickname">Nickname</Label>
              <Input
                id="edit-card-nickname"
                value={form.nickname}
                onChange={(e) => setForm((f) => f && { ...f, nickname: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-card-last4">Last 4 digits</Label>
              <Input
                id="edit-card-last4"
                inputMode="numeric"
                maxLength={4}
                value={form.lastFourDigits}
                onChange={(e) => setForm((f) => f && { ...f, lastFourDigits: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateCard.isPending}>
              {updateCard.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
