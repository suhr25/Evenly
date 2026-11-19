import { ArrowUpRight, Check, Sparkles } from "lucide-react";

export function AuthOverview() {
  return (
    <div className="auth-overview" aria-label="Illustrative monthly budget preview">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-2 font-medium text-white/85"><span className="size-1.5 rounded-full bg-violet-300" />Monthly overview</span>
        <span className="rounded-full border border-white/15 px-2 py-1 text-[9px] tracking-widest text-white/50">SAMPLE</span>
      </div>
      <div className="mt-7 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-white/55">Available to spend</p>
          <p className="mt-2 text-[38px] font-medium leading-none tracking-[-0.05em] tabular-nums">₹24,850<span className="text-xl text-white/35">.00</span></p>
          <p className="mt-3 flex items-center gap-1.5 text-[10px] text-emerald-300"><Check className="size-3" aria-hidden />Within your monthly budget</p>
        </div>
        <div className="auth-budget-ring shrink-0" aria-hidden="true"><div><span className="text-lg font-medium">62<span className="text-xs text-white/45">%</span></span><span className="text-[9px] text-white/45">spent</span></div></div>
      </div>
      <div className="mt-7 grid grid-cols-2 gap-5 border-t border-white/10 pt-5">
        <div><p className="text-[10px] text-white/50">Monthly budget</p><p className="mt-1 text-sm tabular-nums">₹65,000</p></div>
        <div className="border-l border-white/10 pl-5"><p className="text-[10px] text-white/50">Total spent</p><p className="mt-1 text-sm tabular-nums">₹40,150</p></div>
      </div>
      <div className="auth-overview-note mt-5 flex items-center gap-2.5 rounded-xl border border-violet-300/15 bg-violet-300/[0.06] px-3 py-3 text-[11px] text-violet-100">
        <Sparkles className="size-4 shrink-0 text-violet-300" aria-hidden /><span className="flex-1">The bigger picture. Without the busywork.</span><ArrowUpRight className="size-3.5 shrink-0 text-violet-300" aria-hidden />
      </div>
    </div>
  );
}
