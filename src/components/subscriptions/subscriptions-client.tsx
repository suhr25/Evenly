"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Check, Ghost, Pencil, Repeat, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { useSubscriptions, useUpdateSubscription, type SubscriptionDTO } from "@/hooks/use-subscriptions";

const INTERVAL_LABEL: Record<string, string> = { WEEKLY: "week", MONTHLY: "month", YEARLY: "year" };

export function SubscriptionsClient({ currency }: { currency: string }) {
  const { data: subscriptions, isLoading } = useSubscriptions();
  const [showIgnored, setShowIgnored] = useState(false);

  const detected = (subscriptions ?? []).filter((s) => s.status === "DETECTED");
  const active = (subscriptions ?? []).filter((s) => s.status === "ACTIVE");
  const ignored = (subscriptions ?? []).filter((s) => s.status === "IGNORED");

  const annualTotal = active.reduce((sum, s) => sum + Number(s.annualCost), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
        <p className="text-sm text-muted-foreground">
          Recurring charges detected from your expense history.
        </p>
      </div>

      {active.length > 0 && (
        <Card>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Confirmed subscriptions</p>
              <p className="text-xl font-semibold tabular-nums">{formatMoney(annualTotal, currency)}/year</p>
            </div>
            <p className="text-sm text-muted-foreground">{active.length} active</p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (subscriptions ?? []).length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border py-20 text-center">
          <Repeat className="size-10 text-muted-foreground/50" aria-hidden />
          <div>
            <p className="font-medium">No recurring charges detected yet</p>
            <p className="text-sm text-muted-foreground">
              Once the same expense shows up a couple of times at a regular interval, it&apos;ll appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {detected.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">Needs review</h2>
              {detected.map((s) => (
                <SubscriptionCard key={s.id} sub={s} currency={currency} />
              ))}
            </section>
          )}

          {active.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">Confirmed</h2>
              {active.map((s) => (
                <SubscriptionCard key={s.id} sub={s} currency={currency} />
              ))}
            </section>
          )}

          {ignored.length > 0 && (
            <section className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowIgnored((v) => !v)}
                className="text-left text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {showIgnored ? "Hide" : "Show"} ignored ({ignored.length})
              </button>
              {showIgnored && ignored.map((s) => <SubscriptionCard key={s.id} sub={s} currency={currency} />)}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function SubscriptionCard({ sub, currency }: { sub: SubscriptionDTO; currency: string }) {
  const updateSubscription = useUpdateSubscription();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(sub.displayName ?? sub.merchant);

  async function setStatus(status: string) {
    try {
      await updateSubscription.mutateAsync({ id: sub.id, status });
      toast.success(
        status === "ACTIVE" ? "Marked as a subscription" : status === "IGNORED" ? "Ignored" : "Marked inactive"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }

  async function saveRename() {
    setRenaming(false);
    if (name.trim() === (sub.displayName ?? sub.merchant)) return;
    try {
      await updateSubscription.mutateAsync({ id: sub.id, displayName: name.trim() || null });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename");
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {renaming ? (
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={saveRename}
                onKeyDown={(e) => e.key === "Enter" && saveRename()}
                className="h-7 max-w-xs"
              />
            ) : (
              <p className="flex items-center gap-1.5 font-medium">
                {sub.displayName ?? sub.merchant}
                <button
                  type="button"
                  onClick={() => setRenaming(true)}
                  aria-label="Rename"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="size-3" aria-hidden />
                </button>
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              First seen {format(new Date(sub.firstChargeAt), "MMM yyyy")}, last charged{" "}
              {format(new Date(sub.lastChargeAt), "MMM d, yyyy")} ({sub.occurrenceCount}x)
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-medium tabular-nums">
              {formatMoney(sub.amount, currency)}
              <span className="text-xs text-muted-foreground">/{INTERVAL_LABEL[sub.interval]}</span>
            </p>
            <p className="text-xs text-muted-foreground">{formatMoney(sub.annualCost, currency)}/year</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {sub.isGhost && (
              <Badge variant="secondary" className="gap-1 text-warning">
                <Ghost className="size-3" aria-hidden />
                Worth reviewing
              </Badge>
            )}
            {sub.status === "ACTIVE" && <Badge variant="secondary">Subscription</Badge>}
            {sub.status === "IGNORED" && <Badge variant="secondary">Ignored</Badge>}
          </div>

          <div className="flex gap-1.5">
            {sub.status === "DETECTED" && (
              <>
                <Button size="sm" variant="outline" onClick={() => setStatus("ACTIVE")}>
                  <Check className="size-3.5" aria-hidden />
                  Confirm
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setStatus("IGNORED")}>
                  <X className="size-3.5" aria-hidden />
                  Ignore
                </Button>
              </>
            )}
            {sub.status === "ACTIVE" && (
              <Button size="sm" variant="ghost" onClick={() => setStatus("INACTIVE")}>
                Mark inactive
              </Button>
            )}
            {sub.status === "IGNORED" && (
              <Button size="sm" variant="ghost" onClick={() => setStatus("DETECTED")}>
                Unignore
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
