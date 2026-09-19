"use client";

import { useEffect, useState } from "react";
import { Compass, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard, MagicBentoGrid } from "@/components/ui/magic-bento";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { formatMoney } from "@/lib/money";
import { useCategories } from "@/hooks/use-categories";
import { useDiscoverableCards, useDiscoveryRecommendation } from "@/hooks/use-discovery";

export function DiscoverCardsClient({ currency }: { currency: string }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);
  const { data: cards, isLoading } = useDiscoverableCards(debouncedSearch);

  const { data: categories } = useCategories();
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const recommend = useDiscoveryRecommendation();

  async function handleRecommend(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      toast.error("Enter an amount greater than 0.");
      return;
    }
    try {
      await recommend.mutateAsync({ amount, categoryId: categoryId || null, channel: isOnline ? "ONLINE" : "OFFLINE" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to get a recommendation");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Should I get a new card for something specific?</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRecommend} className="flex flex-col gap-4" noValidate>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="disc-amount">Amount</Label>
                <Input
                  id="disc-amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="disc-category">Category</Label>
                <Select
                  items={Object.fromEntries((categories ?? []).map((c) => [c.id, c.name]))}
                  value={categoryId}
                  onValueChange={(v) => setCategoryId(v ?? "")}
                >
                  <SelectTrigger id="disc-category" className="w-full">
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
              <Label htmlFor="disc-online">Online transaction</Label>
              <Switch id="disc-online" checked={isOnline} onCheckedChange={setIsOnline} />
            </div>
            <Button type="submit" disabled={recommend.isPending} className="w-fit">
              {recommend.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Find a new card
            </Button>
          </form>

          {recommend.data && (
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                Based on the catalog information available. Not a guarantee of actual terms, and not
                a claim that any card here is universally &ldquo;best.&rdquo;
              </p>
              {recommend.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  You already own every card in the catalog that matches this search.
                </p>
              ) : (
                recommend.data.map((c, i) => (
                  <div key={c.cardProductId} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 font-medium">
                        {i === 0 && <Compass className="size-4 text-primary" aria-hidden />}
                        {c.cardLabel}
                        <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                          Not owned
                        </Badge>
                      </p>
                      <p className="tabular-nums font-semibold">{formatMoney(c.estimatedValueInr, currency)}</p>
                    </div>
                    {i === 0 && (
                      <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                        {c.reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Search the catalog, e.g. Infinia, Magnus, HSBC..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : !cards || cards.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No cards match &ldquo;{debouncedSearch}&rdquo;.
          </p>
        ) : (
          <MagicBentoGrid className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <MagicBentoCard key={card.id}>
                <Card className="h-full border-border/80">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between gap-2 text-base">
                      <span className="truncate">
                        {card.issuerName} {card.name}
                      </span>
                      <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[10px]">
                        Not owned
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-1 text-sm">
                    <p className="text-muted-foreground">
                      {card.network} · Annual fee{" "}
                      {card.annualFee === "0" || card.annualFee === "0.00"
                        ? "Nil"
                        : formatMoney(card.annualFee, currency)}
                    </p>
                    {card.bestUsedFor.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {card.bestUsedFor.map((label) => (
                          <Badge key={label} variant="secondary" className="h-4 px-1.5 text-[10px]">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </MagicBentoCard>
            ))}
          </MagicBentoGrid>
        )}
      </div>
    </div>
  );
}
