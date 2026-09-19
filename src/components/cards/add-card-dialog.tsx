"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Plus, Search } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useCardProductSearch, type CardProductDTO } from "@/hooks/use-card-products";
import { useAddCard } from "@/hooks/use-cards";

interface DetailsForm {
  nickname: string;
  lastFourDigits: string;
  creditLimit: string;
  outstanding: string;
  rewardBalance: string;
  statementDate: string;
  paymentDueDate: string;
}

function emptyDetails(): DetailsForm {
  return {
    nickname: "",
    lastFourDigits: "",
    creditLimit: "",
    outstanding: "",
    rewardBalance: "",
    statementDate: "",
    paymentDueDate: "",
  };
}

export function AddCardDialog() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState<CardProductDTO | null>(null);
  const [details, setDetails] = useState<DetailsForm>(emptyDetails());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: results, isLoading } = useCardProductSearch(debouncedSearch);
  const addCard = useAddCard();

  function reset() {
    setSearch("");
    setDebouncedSearch("");
    setSelected(null);
    setDetails(emptyDetails());
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    try {
      await addCard.mutateAsync({
        cardProductId: selected.id,
        nickname: details.nickname || null,
        lastFourDigits: details.lastFourDigits || null,
        creditLimit: details.creditLimit || null,
        outstanding: details.outstanding || null,
        rewardBalance: details.rewardBalance || null,
        statementDate: details.statementDate ? Number(details.statementDate) : null,
        paymentDueDate: details.paymentDueDate ? Number(details.paymentDueDate) : null,
      });
      toast.success(`${selected.issuerName} ${selected.name} added to your cards`);
      handleOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add card");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" aria-hidden />
            Add card
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        {!selected ? (
          <>
            <DialogHeader>
              <DialogTitle>Add a card you own</DialogTitle>
              <DialogDescription>
                Search for your card. All fields after this are optional. You can start
                getting recommendations right away and fill in the rest later.
              </DialogDescription>
            </DialogHeader>

            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                autoFocus
                placeholder="Search e.g. Regalia, Atlas, Cashback..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {isLoading && (
                <div className="flex flex-col gap-2 py-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              )}
              {!isLoading && results?.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No cards match &ldquo;{debouncedSearch}&rdquo;.
                </p>
              )}
              {!isLoading &&
                results?.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setSelected(product)}
                    className="flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left hover:bg-accent"
                  >
                    <span className="text-sm font-medium">
                      {product.issuerName} {product.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {product.network} · Annual fee {product.annualFee === "0.00" ? "Nil" : `₹${product.annualFee}`}
                    </span>
                  </button>
                ))}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit -ml-2 mb-1"
                onClick={() => setSelected(null)}
              >
                <ArrowLeft className="size-3.5" aria-hidden />
                Back to search
              </Button>
              <DialogTitle>
                {selected.issuerName} {selected.name}
              </DialogTitle>
              <DialogDescription>
                Everything below is optional and can be updated any time from the card&apos;s
                details page.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSave} className="flex flex-col gap-4" noValidate>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="add-card-limit">Credit limit</Label>
                  <Input
                    id="add-card-limit"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={details.creditLimit}
                    onChange={(e) => setDetails((d) => ({ ...d, creditLimit: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="add-card-outstanding">Current outstanding</Label>
                  <Input
                    id="add-card-outstanding"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={details.outstanding}
                    onChange={(e) => setDetails((d) => ({ ...d, outstanding: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="add-card-reward-balance">
                  {selected.rewardCurrencyName ?? "Reward"} balance
                </Label>
                <Input
                  id="add-card-reward-balance"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={details.rewardBalance}
                  onChange={(e) => setDetails((d) => ({ ...d, rewardBalance: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="add-card-statement">Statement date</Label>
                  <Input
                    id="add-card-statement"
                    type="number"
                    min="1"
                    max="31"
                    placeholder="Day of month"
                    value={details.statementDate}
                    onChange={(e) => setDetails((d) => ({ ...d, statementDate: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="add-card-due">Payment due date</Label>
                  <Input
                    id="add-card-due"
                    type="number"
                    min="1"
                    max="31"
                    placeholder="Day of month"
                    value={details.paymentDueDate}
                    onChange={(e) => setDetails((d) => ({ ...d, paymentDueDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="add-card-nickname">Nickname (optional)</Label>
                  <Input
                    id="add-card-nickname"
                    placeholder="e.g. Travel card"
                    value={details.nickname}
                    onChange={(e) => setDetails((d) => ({ ...d, nickname: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="add-card-last4">Last 4 digits (optional)</Label>
                  <Input
                    id="add-card-last4"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="1234"
                    value={details.lastFourDigits}
                    onChange={(e) => setDetails((d) => ({ ...d, lastFourDigits: e.target.value }))}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addCard.isPending}>
                  {addCard.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  Add to my cards
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
