import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AnimatedMoney } from "@/components/ui/animated-number";

type Tone = "brand" | "positive" | "negative" | "neutral";

interface StatCardProps {
  label: string;
  amount: string;
  currency: string;
  icon: LucideIcon;
  tone?: Tone;
  /** The anchor metric on the page. Gets a hairline accent, not a filled surface. */
  emphasis?: boolean;
}

// Colour lives on the icon and its container only. Filling a whole card with
// green or red would make the palette shout and stop the semantic colours
// meaning anything at the point they actually matter: the figures.
const ICON_TONE: Record<Tone, string> = {
  brand: "bg-brand-subtle text-primary",
  positive: "bg-positive-subtle text-positive",
  negative: "bg-negative-subtle text-negative",
  neutral: "bg-muted text-muted-foreground",
};

export function StatCard({
  label,
  amount,
  currency,
  icon: Icon,
  tone = "neutral",
  emphasis = false,
}: StatCardProps) {
  // A zero figure is neither a gain nor a loss. Colouring it green or red
  // would state a direction the data does not support, so tone only applies
  // once there is actual movement to describe.
  const hasMovement = Number(amount) !== 0;
  const valueTone = hasMovement ? tone : "neutral";

  return (
    <Card
      className={cn(
        "interactive-card relative overflow-hidden",
        emphasis && "ring-1 ring-primary/20"
      )}
    >
      {emphasis && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
        />
      )}
      <CardContent className="flex flex-col gap-3.5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[0.6875rem] font-medium uppercase leading-none tracking-[0.07em] text-muted-foreground">
            {label}
          </p>
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-[7px]",
              ICON_TONE[valueTone === "neutral" && tone !== "brand" ? "neutral" : tone]
            )}
          >
            <Icon className="size-3.5" aria-hidden strokeWidth={2} />
          </span>
        </div>
        <AnimatedMoney
          amount={amount}
          currency={currency}
          className={cn(
            "block truncate font-semibold tabular-nums leading-none tracking-[-0.025em]",
            emphasis ? "text-[1.75rem]" : "text-2xl",
            valueTone === "positive" && "text-positive",
            valueTone === "negative" && "text-negative"
          )}
        />
      </CardContent>
    </Card>
  );
}
