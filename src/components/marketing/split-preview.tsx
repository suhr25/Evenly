"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Users } from "lucide-react";

export function SplitPreview() {
  const [people, setPeople] = useState(3);
  return (
    <section className="split-preview">
      <div>
        <Users size={28} strokeWidth={1.5} aria-hidden />
        <h2 className="mt-5 text-4xl font-semibold leading-none tracking-[-.055em] sm:text-5xl">Dinner for the table.<br /><em className="font-serif font-normal">One bill to split.</em></h2>
        <p className="mt-4 max-w-sm text-sm leading-6">Try an equal split on a sample dinner bill, then start a group to track who paid and who owes.</p>
        <Link href="/signup" className="mt-5 inline-flex min-h-11 items-center gap-2 font-semibold underline underline-offset-4">Create an account <ArrowUpRight size={16} /></Link>
      </div>
      <div className="rounded-2xl bg-[#faf8ed] p-5 text-[#26281e] shadow-lg sm:p-7">
        <div className="flex items-center justify-between gap-2 border-b border-dashed border-black/25 pb-4"><span>Dinner bill</span><strong className="font-mono">₹2,400</strong></div>
        <fieldset className="my-5"><legend className="mb-2 text-sm">Split equally between</legend>
          <div className="flex flex-wrap gap-2">{[2,3,4,6].map(n => <button type="button" key={n} aria-label={n + " people"} aria-pressed={n === people} onClick={() => setPeople(n)} className="size-11 rounded-full border border-[#867e99] font-medium aria-pressed:bg-[#342a47] aria-pressed:text-white">{n}</button>)}</div>
        </fieldset>
        <p className="border-t border-dashed border-black/25 pt-4 text-sm" aria-live="polite"><strong className="mr-2 text-3xl tracking-tight">₹{(2400 / people).toLocaleString("en-IN")}</strong>per person</p>
      </div>
    </section>
  );
}
