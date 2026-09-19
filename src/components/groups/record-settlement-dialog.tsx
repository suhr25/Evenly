"use client";

import { useState } from "react";
import { HandCoins, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useRecordSettlement } from "@/hooks/use-settlements";
import type { GroupMemberDTO } from "@/hooks/use-groups";

export function RecordSettlementDialog({
  groupId,
  members,
}: {
  groupId: string;
  members: GroupMemberDTO[];
}) {
  const [open, setOpen] = useState(false);
  const [fromMemberId, setFromMemberId] = useState("");
  const [toMemberId, setToMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recordSettlement = useRecordSettlement(groupId);

  const activeMembers = members.filter((m) => m.isActive);
  const memberItems = Object.fromEntries(activeMembers.map((m) => [m.id, m.isYou ? `${m.name} (you)` : m.name]));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fromMemberId || !toMemberId) return setError("Choose who paid and who received.");
    if (fromMemberId === toMemberId) return setError("Payer and recipient must be different.");
    if (!amount || Number(amount) <= 0) return setError("Enter an amount greater than 0.");

    try {
      await recordSettlement.mutateAsync({ fromMemberId, toMemberId, amount, note: note || undefined });
      toast.success("Settlement recorded");
      setOpen(false);
      setFromMemberId("");
      setToMemberId("");
      setAmount("");
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record settlement");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <HandCoins className="size-4" aria-hidden />
            Record payment
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>Log a payment someone made to settle up.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="settle-from">Who paid</Label>
            <Select items={memberItems} value={fromMemberId} onValueChange={(v) => v && setFromMemberId(v)}>
              <SelectTrigger id="settle-from" className="w-full">
                <SelectValue placeholder="Choose member" />
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="settle-to">Who received</Label>
            <Select items={memberItems} value={toMemberId} onValueChange={(v) => v && setToMemberId(v)}>
              <SelectTrigger id="settle-to" className="w-full">
                <SelectValue placeholder="Choose member" />
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="settle-amount">Amount</Label>
            <Input
              id="settle-amount"
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
            <Label htmlFor="settle-note">Note (optional)</Label>
            <Input id="settle-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={recordSettlement.isPending}>
              {recordSettlement.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
