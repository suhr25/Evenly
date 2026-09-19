"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import type { SpendingTrendPoint } from "@/lib/data/dashboard";

interface SpendingTrendChartProps {
  data: SpendingTrendPoint[];
  currency: string;
}

const chartConfig = {
  value: { label: "Spent", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function SpendingTrendChart({ data, currency }: SpendingTrendChartProps) {
  const chartData = data.map((d) => ({ ...d, value: Number(d.amount) }));
  const hasSpending = chartData.some((d) => d.value > 0);

  const total = chartData.reduce((sum, d) => sum + d.value, 0);
  const last = chartData.at(-1)?.value ?? 0;
  const prev = chartData.at(-2)?.value ?? 0;
  const delta = prev > 0 ? ((last - prev) / prev) * 100 : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending trend</CardTitle>
        {hasSpending && (
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold tabular-nums tracking-[-0.02em]">
              {formatMoney(total, currency)}
            </span>
            {delta !== null && (
              <span
                className={`text-xs font-medium tabular-nums ${
                  delta > 0 ? "text-negative" : "text-positive"
                }`}
              >
                {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}% vs last month
              </span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {!hasSpending ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Not enough data yet to show a trend.
          </p>
        ) : (
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="spendingFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="4 4" strokeOpacity={0.7} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tickMargin={10}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip
                cursor={{ strokeDasharray: "4 4" }}
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatMoney(Number(value), currency)}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--color-value)"
                strokeWidth={2}
                fill="url(#spendingFill)"
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                animationDuration={420}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
