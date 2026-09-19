import Link from "next/link";
import { Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";

const PREVIEW_LIMIT = 3;

/**
 * Gmail-detected transactions still waiting on the user. Deliberately compact:
 * it is a prompt, not a workspace, so it states the count, previews a few rows
 * and hands off to Money Flow. Amber marks it as attention-needed rather than
 * an error, since nothing here is wrong yet.
 */
export async function PendingImportsPrompt({
  userId,
  currency,
}: {
  userId: string;
  currency: string;
}) {
  const [count, preview] = await Promise.all([
    prisma.importedTransaction.count({ where: { userId, status: "PENDING" } }),
    prisma.importedTransaction.findMany({
      where: { userId, status: "PENDING" },
      orderBy: { occurredAt: "desc" },
      take: PREVIEW_LIMIT,
    }),
  ]);
  if (count === 0) return null;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-warning-subtle text-warning">
          <Inbox className="size-3.5" aria-hidden strokeWidth={2} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[0.8125rem] font-medium leading-tight">
            {count} transaction{count === 1 ? "" : "s"} to review
          </p>
          <p className="truncate text-xs leading-tight text-muted-foreground">
            Detected in Gmail. Not counted until you confirm.
          </p>
        </div>

        <Link
          href="/money-flow"
          className={buttonVariants({ size: "sm", className: "shrink-0" })}
        >
          Review
        </Link>
      </div>

      <ul className="divide-y border-t">
        {preview.map((item) => {
          const isDebit = item.direction === "DEBIT";
          return (
            <li
              key={item.id}
              className="flex items-center justify-between gap-4 px-4 py-2 text-[0.8125rem]"
            >
              <span className="truncate text-muted-foreground">
                {item.merchant ?? `${item.bankName ?? "Bank"} transaction`}
              </span>
              <span
                className={`shrink-0 font-medium tabular-nums ${
                  isDebit ? "text-negative" : "text-positive"
                }`}
              >
                {isDebit ? "−" : "+"}
                {formatMoney(item.amount.toString(), currency)}
              </span>
            </li>
          );
        })}
      </ul>

      {count > PREVIEW_LIMIT && (
        <Link
          href="/money-flow"
          className="block border-t px-4 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          View {count - PREVIEW_LIMIT} more
        </Link>
      )}
    </Card>
  );
}
