"use client";

import { useId, useState } from "react";
import { ChartNoAxesCombined } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state";
import { addMoney, formatMoney } from "@/lib/money";
import type { SpendingTrendPoint } from "@/lib/data/dashboard";

const config = { value: { label: "Expenses", color: "var(--primary)" } };
const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

export function SpendingTrendChart({ data, currency }: { data: SpendingTrendPoint[]; currency: string }) {
  const [range, setRange] = useState(6);
  const fill = useId().replace(/:/g, "");
  const reduceMotion = useReducedMotion();
  const points = data.slice(-range).map(item => ({ ...item, value: Number(item.amount) }));
  const total = addMoney(...points.map(item => item.amount));
  const average = total.div(points.length || 1);
  const peak = points.reduce<SpendingTrendPoint | undefined>((best, item) =>
    !best || item.value > Number(best.amount) ? item : best, undefined);
  const hasHistory = data.some(item => Number(item.amount) > 0);

  return (
    <Card className="spending-report min-w-0">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Spending trend</CardTitle>
          {hasHistory && <div role="group" aria-label="Spending history range" className="flex rounded-full border bg-card p-0.5">
            {[3, 6].map(n => <button key={n} type="button" aria-pressed={range === n} aria-label={n + " months"} onClick={() => setRange(n)} className="min-h-8 rounded-full px-3 text-xs font-medium text-muted-foreground aria-pressed:bg-brand-subtle aria-pressed:text-accent-foreground">{n}M</button>)}
          </div>}
        </div>
      </CardHeader>
      <CardContent>
        {!hasHistory ? <DashboardEmptyState icon={ChartNoAxesCombined} title="Your spending story starts here" description="Add an expense to see how your spending changes over time." href="/money-flow" action="Track your spending" /> : <>
          <p className="text-xs text-muted-foreground">Total over {range} months</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{formatMoney(total, currency)}</p>
          <ChartContainer config={config} className="mt-5 h-48 w-full sm:h-56">
            <AreaChart accessibilityLayer data={points} margin={{ left: 0, right: 12, bottom: 2, top: 10 }}>
              <defs><linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.46} />
                <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.015} />
              </linearGradient></defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 5" />
              <YAxis width={43} tickCount={4} axisLine={false} tickLine={false} tickFormatter={v => compact.format(v)} tick={{ fontSize: 10 }} domain={[0, "auto"]} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={8} tick={{ fontSize: 11 }} />
              <ReferenceLine y={average.toNumber()} stroke="var(--muted-foreground)" strokeDasharray="5 5" />
              <ChartTooltip cursor={{ stroke: "var(--primary)", strokeDasharray: "3 4" }} content={<ChartTooltipContent formatter={v => formatMoney(Number(v), currency)} />} />
              <Area type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={3} fill={`url(#${fill})`} dot={{ r: 3, fill: "var(--card)", strokeWidth: 2 }} activeDot={{ r: 6, stroke: "var(--card)", strokeWidth: 3 }} isAnimationActive={reduceMotion === false} animationDuration={360} />
            </AreaChart>
          </ChartContainer>
          <dl className="mt-4 grid grid-cols-2 gap-4 border-t pt-4">
            <div><dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><span aria-hidden className="w-4 border-t border-dashed" />Monthly average</dt><dd className="mt-1 font-semibold tabular-nums">{formatMoney(average, currency)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Highest month{peak && total.gt(0) ? " · " + peak.label : ""}</dt><dd className="mt-1 font-semibold tabular-nums">{formatMoney(peak?.amount ?? 0, currency)}</dd></div>
          </dl>
          <details className="mt-4 text-xs"><summary className="w-fit cursor-pointer py-2 text-muted-foreground hover:text-foreground">Monthly figures</summary>
            <dl>{points.map(p => <div key={p.month} className="flex justify-between border-t py-2"><dt>{p.month}</dt><dd className="tabular-nums">{formatMoney(p.amount, currency)}</dd></div>)}</dl>
          </details>
        </>}
      </CardContent>
    </Card>
  );
}
