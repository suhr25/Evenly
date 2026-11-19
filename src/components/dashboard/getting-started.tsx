import Link from "next/link";
import { ArrowUpRight, ArrowLeftRight, PiggyBank, Target } from "lucide-react";

const steps = [
  { icon: ArrowLeftRight, title: "Start with a transaction", body: "Log an expense or income to build your overview.", href: "/money-flow", action: "Open Money Flow" },
  { icon: PiggyBank, title: "Give your spending a plan", body: "Set a monthly limit for the categories that matter.", href: "/budgets", action: "Create a budget" },
  { icon: Target, title: "Make room for a goal", body: "Put a number to something you’re saving for.", href: "/goals", action: "Set a goal" },
];
export function DashboardGettingStarted() {
  return (
    <section aria-labelledby="getting-started-title" className="dashboard-start rounded-2xl border border-primary/15 bg-card px-5 py-5 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.15em] text-primary">MAKE YOURSELF AT HOME</p>
          <h2 id="getting-started-title" className="text-base font-medium tracking-tight">A clearer picture starts here.</h2>
        </div>
        <span className="rounded-full border border-primary/15 bg-brand-subtle px-2.5 py-1 text-[10px] text-primary">Your first steps</span>
      </div>
      <div className="grid gap-3 md:grid-cols-3">{steps.map(({ icon: Icon, title, body, href, action }, i) => <Link key={href} href={href} className="group rounded-xl border border-border/70 bg-background/60 p-4 transition-colors hover:border-primary/30 hover:bg-brand-subtle/30">
        <div className="mb-3 flex items-center justify-between">
          <Icon className="size-[17px] text-primary" strokeWidth={1.6} aria-hidden />
          <span className="font-mono text-[10px] text-muted-foreground/60">0{i + 1}</span>
        </div>
        <h3 className="text-xs font-medium">{title}</h3>
        <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">{body}</p>
        <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary">{action}<ArrowUpRight className="size-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
        </span>
      </Link>)}</div>
    </section>
  );
}
