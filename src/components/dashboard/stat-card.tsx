import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
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
  emphasis?: boolean;
  description?: string;
  href?: string;
}
const ICON_TONE: Record<Tone, string> = {
  brand: "bg-brand-subtle text-primary", positive: "bg-positive-subtle text-positive",
  negative: "bg-negative-subtle text-negative", neutral: "bg-muted text-muted-foreground",
};
export function StatCard({ label, amount, currency, icon: Icon, tone = "neutral", emphasis = false, description, href }: StatCardProps) {
  const valueTone = Number(amount) !== 0 ? tone : "neutral";
  const content = (
    <Card className={cn("dashboard-stat relative h-full overflow-hidden", emphasis && "dashboard-stat-primary")}>
      <CardContent className="flex h-full flex-col gap-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-[10px]", ICON_TONE[valueTone === "neutral" && tone !== "brand" ? "neutral" : tone])}>
            <Icon className="size-4" aria-hidden strokeWidth={1.7} />
          </span>
        </div>
        <AnimatedMoney amount={amount} currency={currency} className={cn("block truncate text-[1.7rem] font-semibold leading-none tracking-[-0.04em] tabular-nums", valueTone === "positive" && "text-positive", valueTone === "negative" && "text-negative")} />
        {description && <p className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-[10px] leading-4 text-muted-foreground">
          <span>{description}</span>{href && <ArrowUpRight className="size-3 shrink-0 opacity-50 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />}</p>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href} className="group block min-w-0 rounded-2xl" aria-label={`${label}: view details`}>{content}</Link> : content;
}
