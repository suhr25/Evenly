"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { AddCardDialog } from "@/components/cards/add-card-dialog";
import { EditCardDialog } from "@/components/cards/edit-card-dialog";
import { UtilizationBar } from "@/components/cards/utilization-bar";
import { useMyCards, useRemoveCard, type UserCardDTO } from "@/hooks/use-cards";

export function MyCardsClient({ currency }: { currency: string }) {
  const { data: cards, isLoading } = useMyCards();
  const removeCard = useRemoveCard();
  const [editingCard, setEditingCard] = useState<UserCardDTO | null>(null);
  const [pendingRemove, setPendingRemove] = useState<UserCardDTO | null>(null);

  const totalLimit = cards?.reduce((sum, c) => sum + Number(c.creditLimit ?? 0), 0) ?? 0;
  const totalOutstanding = cards?.reduce((sum, c) => sum + Number(c.outstanding ?? 0), 0) ?? 0;
  const overallUtilization = totalLimit > 0 ? (totalOutstanding / totalLimit) * 100 : null;

  async function confirmRemove() {
    if (!pendingRemove) return;
    try {
      await removeCard.mutateAsync(pendingRemove.id);
      toast.success("Card removed from your portfolio");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove card");
    } finally {
      setPendingRemove(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {!isLoading && cards && cards.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total credit limit
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">
              {formatMoney(totalLimit, currency)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total outstanding
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold tabular-nums">
              {formatMoney(totalOutstanding, currency)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Overall utilization
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="text-2xl font-semibold tabular-nums">
                {overallUtilization !== null ? `${overallUtilization.toFixed(1)}%` : "-"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : !cards || cards.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border py-20 text-center">
          <CreditCard className="size-8 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-medium">No cards yet</p>
            <p className="text-sm text-muted-foreground">
              Add the credit cards you own to start getting recommendations.
            </p>
          </div>
          <AddCardDialog />
        </div>
      ) : (
        <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Card key={card.id} className="interactive-card flex flex-col">
              <CardHeader className="flex-row items-start justify-between gap-2 pb-2">
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">
                    {card.nickname || `${card.cardProduct.issuerName} ${card.cardProduct.name}`}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {card.cardProduct.issuerName} {card.cardProduct.name}
                    {card.lastFourDigits ? ` · •••• ${card.lastFourDigits}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${card.cardProduct.name}`}
                    onClick={() => setEditingCard(card)}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${card.cardProduct.name}`}
                    onClick={() => setPendingRemove(card)}
                  >
                    <Trash2 className="size-4 text-destructive" aria-hidden />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">Outstanding</span>
                  <span className="tabular-nums font-medium">
                    {card.outstanding ? formatMoney(card.outstanding, currency) : "-"}
                    {card.creditLimit && <span className="text-muted-foreground"> / {formatMoney(card.creditLimit, currency)}</span>}
                  </span>
                </div>
                <UtilizationBar percent={card.utilizationPercent} />
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">
                    {card.cardProduct.rewardCurrencyName ?? "Reward"} balance
                  </span>
                  <span className="tabular-nums font-medium">{card.rewardBalance ?? "0"}</span>
                </div>
                <Link
                  href={`/cards/${card.id}`}
                  className="mt-auto text-sm font-medium text-primary hover:underline"
                >
                  View details
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EditCardDialog card={editingCard} open={editingCard !== null} onOpenChange={(open) => !open && setEditingCard(null)} />

      <AlertDialog open={pendingRemove !== null} onOpenChange={(open) => !open && setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this card?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemove && (
                <>
                  &ldquo;{pendingRemove.nickname || pendingRemove.cardProduct.name}&rdquo; will be
                  removed from your portfolio. This doesn&apos;t close your actual credit card
                  account. It only stops Evenly from including it in recommendations.
                </>
              )}
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
