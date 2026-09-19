"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, Inbox, Loader2, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/money";
import { useCategories } from "@/hooks/use-categories";
import { useGroups } from "@/hooks/use-groups";
import {
  useConfirmAllPendingImports,
  useConfirmPendingImport,
  useDismissPendingImport,
  usePendingImports,
  type PendingImportDTO,
} from "@/hooks/use-pending-imports";

function PendingImportRow({ item, currency }: { item: PendingImportDTO; currency: string }) {
  const { data: categories } = useCategories();
  const { data: groups } = useGroups();
  const [categoryId, setCategoryId] = useState("");
  const [groupId, setGroupId] = useState("");
  const confirm = useConfirmPendingImport();
  const dismiss = useDismissPendingImport();
  const isDebit = item.direction === "DEBIT";

  async function handleConfirm() {
    try {
      await confirm.mutateAsync({
        id: item.id,
        // No category picked just means "Other". Never a reason to block
        // the import; the expense stays editable afterwards.
        input: isDebit
          ? { as: "expense", categoryId: categoryId || null, groupId: groupId || null }
          : { as: "income" },
      });
      const groupName = groups?.find((g) => g.id === groupId)?.name;
      toast.success(
        !isDebit
          ? "Added to Money Flow as income"
          : groupName
            ? `Split in ${groupName}. Your share is in Money Flow.`
            : "Added to Money Flow as an expense"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to confirm");
    }
  }

  async function handleDismiss() {
    try {
      await dismiss.mutateAsync(item.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to dismiss");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-baseline gap-2 text-sm">
          <span
            className={`shrink-0 tabular-nums font-semibold ${
              isDebit ? "text-negative" : "text-positive"
            }`}
          >
            {isDebit ? "−" : "+"}
            {formatMoney(item.amount, currency)}
          </span>
          <span className="truncate font-medium">
            {item.merchant ?? (
              <span className="font-normal text-muted-foreground">Payee not named in the email</span>
            )}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {isDebit ? "Paid" : "Received"} · {item.bankName ?? "Bank"}
          {item.lastFourDigits ? ` · •••• ${item.lastFourDigits}` : ""} ·{" "}
          {new Date(item.occurredAt).toLocaleDateString()}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isDebit && (
          <>
            <Select
              items={Object.fromEntries((categories ?? []).map((c) => [c.id, c.name]))}
              value={categoryId}
              onValueChange={(v) => setCategoryId(v ?? "")}
            >
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="Auto" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {groups && groups.length > 0 && (
              <Select
                items={{
                  "": "Just me",
                  ...Object.fromEntries(groups.map((g) => [g.id, g.name])),
                }}
                value={groupId}
                onValueChange={(v) => setGroupId(v ?? "")}
              >
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue placeholder="Just me" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Just me</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      <Users className="size-3" aria-hidden />
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        )}
        <Button
          size="icon-sm"
          onClick={handleConfirm}
          disabled={confirm.isPending}
          aria-label={isDebit ? "Add as expense" : "Add as income"}
        >
          <CheckCircle2 className="size-4" aria-hidden />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={handleDismiss}
          disabled={dismiss.isPending}
          aria-label="Dismiss"
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

export function PendingImportsCard({ currency }: { currency: string }) {
  const [open, setOpen] = useState(true);
  const { data } = usePendingImports();
  const confirmAll = useConfirmAllPendingImports();
  const imports = data?.imports ?? [];

  async function handleConfirmAll() {
    try {
      const result = await confirmAll.mutateAsync();
      const parts = [
        result.expenses > 0 ? `${result.expenses} expense${result.expenses === 1 ? "" : "s"}` : null,
        result.income > 0 ? `${result.income} income entr${result.income === 1 ? "y" : "ies"}` : null,
      ].filter(Boolean);
      toast.success(`Added ${parts.join(" and ")} to Money Flow.`);
      if (result.failed > 0) {
        toast.error(`${result.failed} couldn't be added and are still listed.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to confirm imports");
    }
  }

  if (imports.length === 0) return null;

  const net = imports.reduce(
    (sum, item) => sum + (item.direction === "DEBIT" ? -Number(item.amount) : Number(item.amount)),
    0
  );

  return (
    <Card className="animate-rise overflow-hidden py-0">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <CollapsibleTrigger className="-m-1 flex min-w-0 flex-1 items-center gap-2.5 p-1 text-left">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <Inbox className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                Review imports
                <Badge variant="secondary" className="h-5 px-1.5 tabular-nums">
                  {imports.length}
                </Badge>
                <ChevronDown
                  className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {open ? "From your Gmail. Confirm to add them to your money flow" : `Net ${net < 0 ? "−" : "+"}${formatMoney(Math.abs(net), currency)} waiting to be confirmed`}
              </span>
            </span>
          </CollapsibleTrigger>

          <Button size="sm" onClick={handleConfirmAll} disabled={confirmAll.isPending}>
            {confirmAll.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Confirm all
          </Button>
        </div>

        <CollapsiblePanel>
          <div className="flex flex-col gap-2 border-t px-6 py-4">
            <p className="text-xs text-muted-foreground">
              Confirming adds these to your expenses and income, which updates your budgets,
              dashboard and insights. Anything left uncategorised goes to &ldquo;Other&rdquo; and
              can be edited later.
            </p>
            {imports.map((item) => (
              <PendingImportRow key={item.id} item={item} currency={currency} />
            ))}
          </div>
        </CollapsiblePanel>
      </Collapsible>
    </Card>
  );
}
