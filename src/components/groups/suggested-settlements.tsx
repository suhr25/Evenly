"use client";

import { useState } from "react";
import { ArrowRight, Check, Loader2, MessageCircle, Sparkles, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { buildUpiPayLink, buildWhatsAppLink } from "@/lib/payment-links";
import { useRecordSettlement } from "@/hooks/use-settlements";
import type { SuggestedSettlement } from "@/hooks/use-groups";

interface SuggestedSettlementsProps {
  groupId: string;
  groupName: string;
  suggestions: SuggestedSettlement[];
  currency: string;
  currentMemberId: string | null;
}

function payViaUpi(s: SuggestedSettlement, groupName: string) {
  if (!s.toUpiId) return;
  const link = buildUpiPayLink({
    upiId: s.toUpiId,
    payeeName: s.toName,
    amount: s.amount,
    note: `${groupName} on Evenly`,
  });
  window.location.href = link;
}

function remindOnWhatsApp(s: SuggestedSettlement, groupName: string, currency: string) {
  if (!s.fromPhone) return;
  const message = `Hey ${s.fromName}, just a reminder. You owe me ${formatMoney(s.amount, currency)} for ${groupName} on Evenly. Whenever you get a chance to settle up 🙏`;
  window.open(buildWhatsAppLink(s.fromPhone, message), "_blank", "noopener,noreferrer");
}

export function SuggestedSettlements({
  groupId,
  groupName,
  suggestions,
  currency,
  currentMemberId,
}: SuggestedSettlementsProps) {
  const recordSettlement = useRecordSettlement(groupId);
  const [markingId, setMarkingId] = useState<string | null>(null);

  if (suggestions.length === 0) {
    return null;
  }

  async function markPaid(s: SuggestedSettlement) {
    const key = `${s.fromMemberId}:${s.toMemberId}:${s.amount}`;
    setMarkingId(key);
    try {
      await recordSettlement.mutateAsync({
        fromMemberId: s.fromMemberId,
        toMemberId: s.toMemberId,
        amount: s.amount,
        note: "Suggested settlement",
      });
      toast.success(`Marked ${s.fromName} to ${s.toName} as paid`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record settlement");
    } finally {
      setMarkingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="size-3.5" aria-hidden />
        The minimum number of payments to settle everyone up
      </p>
      <ul className="flex flex-col divide-y rounded-lg border">
        {suggestions.map((s) => {
          const key = `${s.fromMemberId}:${s.toMemberId}:${s.amount}`;
          const isMarking = markingId === key && recordSettlement.isPending;
          const youOwe = currentMemberId === s.fromMemberId;
          const youAreOwed = currentMemberId === s.toMemberId;

          return (
            <li key={key} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className="font-medium">{s.fromName}</span>
              <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
              <span className="font-medium">{s.toName}</span>
              <span className="tabular-nums">{formatMoney(s.amount, currency)}</span>

              <div className="ml-auto flex items-center gap-2">
                {youOwe && (!s.toUpiId ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button variant="outline" size="sm" disabled>
                          <Wallet className="size-3.5" aria-hidden />
                          Pay via UPI
                        </Button>
                      }
                    />
                    <TooltipContent>{s.toName} hasn&apos;t added a UPI ID yet</TooltipContent>
                  </Tooltip>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => payViaUpi(s, groupName)}>
                    <Wallet className="size-3.5" aria-hidden />
                    Pay via UPI
                  </Button>
                ))}

                {youAreOwed && (!s.fromPhone ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button variant="outline" size="sm" disabled>
                          <MessageCircle className="size-3.5" aria-hidden />
                          Remind
                        </Button>
                      }
                    />
                    <TooltipContent>Add {s.fromName}&apos;s phone number to send a reminder</TooltipContent>
                  </Tooltip>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => remindOnWhatsApp(s, groupName, currency)}>
                    <MessageCircle className="size-3.5" aria-hidden />
                    Remind
                  </Button>
                ))}

                <Button variant="outline" size="sm" onClick={() => markPaid(s)} disabled={isMarking}>
                  {isMarking ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Check className="size-3.5" aria-hidden />
                  )}
                  Mark as paid
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
