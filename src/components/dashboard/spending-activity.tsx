"use client";

import { useId, useState } from "react";
import { ChevronLeft, ChevronRight, Activity } from "lucide-react";

import { addMoney, subtractMoney } from "@/lib/money";
import type { ActivityMonth } from "@/lib/data/dashboard";

interface Props {
  months: ActivityMonth[];
  currency: string;
  initialMonth: number;
  initialDay?: number;
  sample?: boolean;
}

export function SpendingActivity({ months, currency, initialMonth, initialDay = 0, sample = false }: Props) {
  const money = new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const [index, setIndex] = useState(initialMonth);
  const [day, setDay] = useState(initialDay);
  const rangeId = useId();
  const month = months[index];
  const expenses = addMoney(...month.days).toNumber();
  const peak = Math.max(1, ...month.days);
  const latestActive = months.findLastIndex(item => item.days.some(value => value > 0));
  const [monthName, year] = month.name.split(" ");
  const dateLabel = monthName + " " + (day + 1) + (year ? ", " + year : "");
  function moveMonth(offset: number) {
    setIndex(index + offset);
    setDay(0);
  }

  return (
    <section className="spend-preview" aria-label={sample ? "Sample spending activity" : "Your spending activity"}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium"><Activity size={16} aria-hidden className="text-[#cdffa8]" /> Spending activity</h2>
        <span className="rounded-full border border-white/20 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white/75">{sample ? "Sample" : currency}</span>
      </div>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs text-[#d2cddd]">Total spent</p><p className="mt-1 text-4xl font-medium tracking-[-.06em] tabular-nums sm:text-5xl">{money.format(expenses)}</p></div>
        <div className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 p-1">
          <button type="button" className="preview-arrow" aria-label={sample ? "Previous sample month" : "Previous month"} disabled={!index} onClick={() => moveMonth(-1)}><ChevronLeft size={15} /></button>
          <span className="min-w-16 text-center text-xs">{month.name}</span>
          <button type="button" className="preview-arrow" aria-label={sample ? "Next sample month" : "Next month"} disabled={index === months.length - 1} onClick={() => moveMonth(1)}><ChevronRight size={15} /></button>
        </div>
      </div>
      <div className="preview-plot" aria-hidden onPointerMove={e => {
        if (e.pointerType === "mouse") {
          const rect = e.currentTarget.getBoundingClientRect();
          setDay(Math.max(0, Math.min(month.days.length - 1, Math.floor((e.clientX - rect.left) / rect.width * month.days.length))));
        }
      }}>
        {month.days.map((value, i) => <span key={i} data-selected={day === i} style={{height: (value / peak * 100) + "%"}} />)}
      </div>
      {!sample && expenses === 0 && <p className="mt-2 text-xs text-white/75">No expenses recorded this month. {latestActive >= 0 && <button type="button" className="rounded text-[#d7edb3] underline underline-offset-4" onClick={() => moveMonth(latestActive - index)}>View {months[latestActive].name}</button>}</p>}
      <div className="mt-2 flex justify-between font-mono text-[10px] text-[#cbc5d7]"><span>01</span><span>15</span><span>{month.days.length}</span></div>
      <div className="my-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-white/10 bg-black/20 px-3 py-1">
        <label htmlFor={rangeId} className="text-xs text-white/80">{dateLabel} <strong className="ml-1 text-white">{money.format(month.days[day])}</strong></label>
        <input id={rangeId} type="range" aria-label="Inspect daily spending" aria-valuetext={dateLabel + ", " + money.format(month.days[day])} min={1} max={month.days.length} value={day + 1} onChange={e => setDay(Number(e.target.value) - 1)} className="h-8 min-w-16 flex-1 cursor-pointer accent-[#d2b7ff]" />
      </div>
      <dl className="grid grid-cols-2 gap-3 border-t border-white/15 pt-4 text-xs text-white/75">
        <div><dt>Income</dt><dd className="mt-1 text-lg font-medium text-white">{money.format(month.income)}</dd></div>
        <div><dt>Left after expenses</dt><dd className={month.income >= expenses ? "mt-1 text-lg font-medium text-[#d2f5af]" : "mt-1 text-lg font-medium text-[#ffb4ad]"}>{money.format(subtractMoney(month.income, expenses).toNumber())}</dd></div>
      </dl>
    </section>
  );
}
