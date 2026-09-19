"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Info, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getCategoryIcon } from "@/lib/category-icons";
import { DEFAULT_EXPENSE_FILTERS, useExpenses } from "@/hooks/use-expenses";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { EditCardDialog } from "@/components/cards/edit-card-dialog";
import { UtilizationBar } from "@/components/cards/utilization-bar";
import { useMyCard, useRemoveCard } from "@/hooks/use-cards";

const SOURCE_LABEL: Record<string, string> = {
  MANUAL: "Entered manually",
  AA_SYNC: "Synced from your bank",
  ISSUER_SYNC: "Synced from your issuer",
};

function ordinal(day: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = day % 100;
  return day + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function CardDetailClient({ id, currency }: { id: string; currency: string }) {
  const router = useRouter();
  const { data: card, isLoading, isError } = useMyCard(id);
  const { data: recentExpenses } = useExpenses({ ...DEFAULT_EXPENSE_FILTERS, userCardId: id, pageSize: 5 });
  const removeCard = useRemoveCard();
  const [editOpen, setEditOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border py-20 text-center">
        <p className="font-medium">Card not found</p>
        <p className="text-sm text-muted-foreground">
          It may have been removed from your portfolio.
        </p>
      </div>
    );
  }

  if (isLoading || !card) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const product = card.cardProduct;
  const estimatedRewardValue =
    card.rewardBalance && product.rewardCurrencyUnitValueInr
      ? Number(card.rewardBalance) * Number(product.rewardCurrencyUnitValueInr)
      : null;

  async function confirmRemove() {
    try {
      await removeCard.mutateAsync(id);
      toast.success("Card removed from your portfolio");
      router.push("/cards");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove card");
      setRemoveOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => router.push("/cards")}>
          <ArrowLeft className="size-3.5" aria-hidden />
          Cards
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {card.nickname || `${product.issuerName} ${product.name}`}
            </h1>
            <p className="text-sm text-muted-foreground">
              {product.issuerName} {product.name} · {product.network}
              {card.lastFourDigits ? ` · •••• ${card.lastFourDigits}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="size-3.5" aria-hidden />
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRemoveOpen(true)}>
              <Trash2 className="size-3.5 text-destructive" aria-hidden />
              Remove
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Credit limit</p>
                <p className="font-medium tabular-nums">
                  {card.creditLimit ? formatMoney(card.creditLimit, currency) : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="font-medium tabular-nums">
                  {card.outstanding ? formatMoney(card.outstanding, currency) : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Available credit</p>
                <p className="font-medium tabular-nums">
                  {card.availableCredit ? formatMoney(card.availableCredit, currency) : "-"}
                </p>
              </div>
            </div>
            <UtilizationBar percent={card.utilizationPercent} />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Statement date</p>
                <p className="font-medium">
                  {card.statementDate ? `${ordinal(card.statementDate)} of the month` : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Payment due date</p>
                <p className="font-medium">
                  {card.paymentDueDate ? `${ordinal(card.paymentDueDate)} of the month` : "Not set"}
                </p>
              </div>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="size-3 shrink-0" aria-hidden />
              Credit limit: {SOURCE_LABEL[card.creditLimitSource]} · Outstanding:{" "}
              {SOURCE_LABEL[card.outstandingSource]}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rewards</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-muted-foreground">{product.rewardCurrencyName ?? "Reward"} balance</p>
              <p className="text-xl font-semibold tabular-nums">{card.rewardBalance ?? "0"}</p>
            </div>
            {estimatedRewardValue !== null && (
              <div>
                <p className="text-xs text-muted-foreground">Estimated value</p>
                <p className="font-medium tabular-nums">{formatMoney(estimatedRewardValue, currency)}</p>
                <p className="text-xs text-muted-foreground">
                  Based on an indicative redemption value of ₹{product.rewardCurrencyUnitValueInr} per unit.
                </p>
              </div>
            )}
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="size-3 shrink-0" aria-hidden />
              {SOURCE_LABEL[card.rewardBalanceSource]}
            </p>
          </CardContent>
        </Card>
      </div>

      {product.bestUsedFor.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Best used for</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {product.bestUsedFor.map((label) => (
              <Badge key={label} variant="secondary">
                {label}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {!recentExpenses || recentExpenses.expenses.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No expenses tagged to this card yet. Choosing it as the payment card when logging
              an expense will show up here.
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {recentExpenses.expenses.map((tx) => {
                const Icon = getCategoryIcon(tx.category.icon);
                return (
                  <li key={tx.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div
                      className="flex size-9 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `color-mix(in oklch, ${tx.category.color} 15%, transparent)` }}
                    >
                      <Icon className="size-4" style={{ color: tx.category.color }} aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(tx.date), "MMM d")} · {tx.category.name}
                      </p>
                    </div>
                    <p className="shrink-0 tabular-nums font-medium">{formatMoney(tx.amount, currency)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Card terms</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Joining fee</p>
              <p className="font-medium">{product.joiningFee ? formatMoney(product.joiningFee, currency) : "Not confirmed"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Annual fee</p>
              <p className="font-medium">{formatMoney(product.annualFee, currency)}</p>
            </div>
            {product.annualFeeWaiverSpend && (
              <div>
                <p className="text-xs text-muted-foreground">Fee waiver at</p>
                <p className="font-medium">{formatMoney(product.annualFeeWaiverSpend, currency)}/yr spend</p>
              </div>
            )}
            {product.foreignTxnFeePercent && (
              <div>
                <p className="text-xs text-muted-foreground">Forex markup</p>
                <p className="font-medium">{product.foreignTxnFeePercent}%</p>
              </div>
            )}
          </div>

          {product.milestoneNote && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Potential milestone benefit</p>
              <p className="text-sm">{product.milestoneNote}</p>
            </div>
          )}
          {product.benefitsNote && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Benefits</p>
              <p className="text-sm">{product.benefitsNote}</p>
            </div>
          )}
          {product.exclusionsNote && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Exclusions</p>
              <p className="text-sm">{product.exclusionsNote}</p>
            </div>
          )}

          {product.sourceNote && (
            <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              {product.sourceNote}
            </p>
          )}
        </CardContent>
      </Card>

      <EditCardDialog card={card} open={editOpen} onOpenChange={setEditOpen} />

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this card?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{card.nickname || product.name}&rdquo; will be removed from your portfolio.
              This doesn&apos;t close your actual credit card account. It only stops Evenly from
              including it in recommendations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmRemove}
              disabled={removeCard.isPending}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
