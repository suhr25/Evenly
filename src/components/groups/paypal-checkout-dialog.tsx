"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { loadPayPalSdk } from "@/lib/paypal/sdk";
import {
  capturePayPalOrder,
  createPayPalOrder,
  type PayPalPaymentDTO,
} from "@/hooks/use-settlements";
import type { SuggestedSettlement } from "@/hooks/use-groups";

type Phase =
  | { kind: "creating" }
  | { kind: "ready"; payment: PayPalPaymentDTO }
  | { kind: "capturing"; payment: PayPalPaymentDTO }
  | { kind: "pending"; payment: PayPalPaymentDTO; message: string }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

interface Props {
  groupId: string;
  suggestion: SuggestedSettlement;
  onClose: () => void;
}

/**
 * PayPal Sandbox demo checkout for one suggested settlement. The server decides the amount
 * and verifies the capture; this component only displays the quote it is given and relays
 * the buyer's approval.
 */
export function PayPalCheckoutDialog({ groupId, suggestion, onClose }: Props) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>({ kind: "creating" });
  const buttonsRef = useRef<HTMLDivElement>(null);
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "";

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
    queryClient.invalidateQueries({ queryKey: ["groups"] });
    queryClient.invalidateQueries({ queryKey: ["income"] });
  }, [queryClient, groupId]);

  const capture = useCallback(
    async (payment: PayPalPaymentDTO) => {
      if (!payment.orderId) return;
      setPhase({ kind: "capturing", payment });
      try {
        const result = await capturePayPalOrder(groupId, payment.orderId);
        if (result.status === "COMPLETED") {
          setPhase({ kind: "done", message: result.message });
          toast.success("Settlement recorded");
          refresh();
        } else {
          setPhase({ kind: "pending", payment: result.payment, message: result.message });
        }
      } catch (err) {
        // The server error is user-safe. Refresh anyway: balances may have changed.
        refresh();
        setPhase({ kind: "error", message: err instanceof Error ? err.message : "Payment failed." });
      }
    },
    [groupId, refresh]
  );

  // Create (or reuse) the order once on open. Reuse is idempotent server-side, so a
  // double mount or double click cannot create a second order.
  useEffect(() => {
    let cancelled = false;
    createPayPalOrder(groupId, suggestion.toMemberId)
      .then((payment) => {
        if (cancelled) return;
        if (payment.status === "CAPTURE_PENDING" || payment.status === "CAPTURED") {
          // A previous attempt already took money: reconcile instead of paying again.
          void capture(payment);
        } else {
          setPhase({ kind: "ready", payment });
        }
      })
      .catch((err) => {
        if (!cancelled) setPhase({ kind: "error", message: err instanceof Error ? err.message : "Could not start PayPal." });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, suggestion.toMemberId]);

  const readyPayment = phase.kind === "ready" ? phase.payment : null;

  useEffect(() => {
    if (!readyPayment || !readyPayment.orderId || !buttonsRef.current) return;
    const container = buttonsRef.current;
    let buttons: { close: () => Promise<void> } | null = null;
    let disposed = false;
    const orderId = readyPayment.orderId;

    loadPayPalSdk(clientId, readyPayment.chargeCurrency)
      .then((paypal) => {
        if (disposed) return;
        const instance = paypal.Buttons({
          style: { layout: "vertical", label: "pay" },
          createOrder: async () => orderId,
          onApprove: async () => {
            await capture(readyPayment);
          },
          onCancel: () => toast.info("PayPal checkout cancelled. You were not charged."),
          onError: () => {
            setPhase({ kind: "error", message: "PayPal reported an error. You were not charged." });
          },
        });
        buttons = instance;
        void instance.render(container).catch(() => {
          /* closed while rendering */
        });
      })
      .catch((err) => {
        if (!disposed) setPhase({ kind: "error", message: err instanceof Error ? err.message : "Could not load PayPal." });
      });

    return () => {
      disposed = true;
      void buttons?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyPayment?.paymentId, readyPayment?.orderId, clientId]);

  const payment =
    phase.kind === "ready" || phase.kind === "capturing" || phase.kind === "pending" ? phase.payment : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Pay with PayPal</DialogTitle>
            <Badge variant="secondary">PayPal Sandbox Demo</Badge>
          </div>
          <DialogDescription>
            This is a sandbox demo. Your payment goes to the configured sandbox merchant account — it does not
            transfer money to {suggestion.toName}. After PayPal confirms it, Evenly records your settlement with{" "}
            {suggestion.toName}.
          </DialogDescription>
        </DialogHeader>

        {phase.kind === "creating" && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Preparing your payment…
          </p>
        )}

        {payment && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border p-3 tabular-nums">
            <dt className="text-muted-foreground">You owe {suggestion.toName}</dt>
            <dd className="text-right font-medium">
              {formatMoney(payment.originalAmount, payment.originalCurrency)}
            </dd>
            <dt className="text-muted-foreground">Sandbox charge</dt>
            <dd className="text-right font-medium">
              {formatMoney(payment.chargeAmount, payment.chargeCurrency)}
            </dd>
            {payment.converted && (
              <>
                <dt className="text-muted-foreground">Demo exchange rate</dt>
                <dd className="text-right">
                  {payment.exchangeRate} {payment.originalCurrency} = 1 {payment.chargeCurrency}
                </dd>
              </>
            )}
          </dl>
        )}

        {payment?.converted && (
          <p className="text-xs text-muted-foreground">
            PayPal can&apos;t charge in {payment.originalCurrency}, so the sandbox charge uses a fixed demo rate set by
            the server operator, not a live market rate. The settlement is recorded as{" "}
            {formatMoney(payment.originalAmount, payment.originalCurrency)}.
          </p>
        )}

        {phase.kind === "ready" && <div ref={buttonsRef} className="min-h-[45px]" />}

        {phase.kind === "capturing" && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Confirming with PayPal. Don&apos;t close this window.
          </p>
        )}

        {phase.kind === "pending" && (
          <div className="flex flex-col gap-2">
            <p className="flex items-start gap-2 text-muted-foreground">
              <Loader2 className="mt-0.5 size-4 shrink-0" aria-hidden /> {phase.message}
            </p>
            <Button variant="outline" size="sm" onClick={() => void capture(phase.payment)}>
              Check status
            </Button>
          </div>
        )}

        {phase.kind === "done" && (
          <p className="flex items-start gap-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> {phase.message}
          </p>
        )}

        {phase.kind === "error" && (
          <p role="alert" className="flex items-start gap-2 text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {phase.message}
          </p>
        )}

        <DialogFooter>
          <p className="mr-auto text-xs text-muted-foreground">
            Prefer not to use PayPal? Close this and use &ldquo;Mark as paid&rdquo; instead.
          </p>
          <Button variant="outline" onClick={onClose} disabled={phase.kind === "capturing"}>
            {phase.kind === "done" ? "Close" : "Cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
