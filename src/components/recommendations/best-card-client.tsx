"use client";

import { useState } from "react";
import { Loader2, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatMoney } from "@/lib/money";
import { useCategories } from "@/hooks/use-categories";
import { useMyCards } from "@/hooks/use-cards";
import { useRecommendation, type RankedCardDTO } from "@/hooks/use-recommendation";

function CardResultRow({ card, currency, rank }: { card: RankedCardDTO; currency: string; rank?: "best" }) {
  return (
    <div className={rank === "best" ? "rounded-lg border-2 border-primary p-4" : "rounded-lg border p-4"}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-medium">
          {rank === "best" && <Trophy className="size-4 text-primary" aria-hidden />}
          {card.cardLabel}
        </p>
        <p className="tabular-nums font-semibold">{formatMoney(card.estimatedValueInr, currency)}</p>
      </div>
      {rank === "best" && (
        <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
          {card.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      {card.utilizationAfterPercent !== null && (
        <p className="mt-1 text-xs text-muted-foreground">
          Utilization after this purchase: ~{card.utilizationAfterPercent.toFixed(1)}%
        </p>
      )}
    </div>
  );
}

export function BestCardClient({ currency }: { currency: string }) {
  const { data: categories } = useCategories();
  const { data: myCards } = useMyCards();
  const recommend = useRecommendation();

  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isOnline, setIsOnline] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      toast.error("Enter an amount greater than 0.");
      return;
    }
    try {
      await recommend.mutateAsync({
        amount,
        categoryId: categoryId || null,
        channel: isOnline ? "ONLINE" : "OFFLINE",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to get a recommendation");
    }
  }

  if (!myCards) {
    return null;
  }

  if (myCards.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border py-20 text-center">
        <Sparkles className="size-8 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-medium">Add a card to get recommendations</p>
          <p className="text-sm text-muted-foreground">
            Recommendations only ever come from the cards you own. Add one from My Cards first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">What are you buying?</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="rec-amount">Amount</Label>
                <Input
                  id="rec-amount"
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
                <Label htmlFor="rec-category">Category</Label>
                <Select
                  items={Object.fromEntries((categories ?? []).map((c) => [c.id, c.name]))}
                  value={categoryId}
                  onValueChange={(v) => setCategoryId(v ?? "")}
                >
                  <SelectTrigger id="rec-category" className="w-full">
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
            </div>

            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <Label htmlFor="rec-online">Online transaction</Label>
                <p className="text-xs text-muted-foreground">Some cards reward online and offline spends differently</p>
              </div>
              <Switch id="rec-online" checked={isOnline} onCheckedChange={setIsOnline} />
            </div>

            <Button type="submit" disabled={recommend.isPending} className="w-fit">
              {recommend.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Find best card
            </Button>
          </form>
        </CardContent>
      </Card>

      {recommend.data && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Recommendation</h2>
          <CardResultRow card={recommend.data.best} currency={currency} rank="best" />
          {recommend.data.alternatives.length > 0 && (
            <>
              <h2 className="mt-2 text-sm font-medium text-muted-foreground">Other owned cards</h2>
              <div className="flex flex-col gap-2">
                {recommend.data.alternatives.map((c) => (
                  <CardResultRow key={c.userCardId} card={c} currency={currency} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
