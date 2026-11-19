import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDown, ArrowRight, ArrowUpRight, CreditCard, ScanLine, Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { SplitPreview } from "@/components/marketing/split-preview";
import { MoneyPreview } from "@/components/marketing/money-preview";

export const metadata: Metadata = {
  title: "Evenly | Everyday money, together",
  description: "Track spending, split shared bills, and get more from your cards with Evenly.",
};

const features = [
  { href: "/money-flow", icon: ScanLine, title: "Track your spending", body: "Turn bank alerts into expenses. Review each transaction before adding it to your budget.", color: "bg-[#ded5ff] text-[#432982]" },
  { href: "/groups", icon: Users, title: "Split shared bills", body: "From groceries to group trips, see who paid, who owes, and how to settle up.", color: "bg-[#ddedb5] text-[#3d5119]" },
  { href: "/cards", icon: CreditCard, title: "Choose the right card", body: "Compare the rewards on cards you already own before your next purchase.", color: "bg-[#ffddc7] text-[#763f21]" },
];

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="landing-shell min-h-screen">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:p-3">Skip to content</a>
      <header className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-2 px-4 sm:px-8 lg:h-24 lg:px-12">
        <Brand />
        <nav aria-label="Main navigation" className="flex items-center gap-2 sm:gap-7">
          <a href="#features" className="hidden text-sm text-muted-foreground hover:text-foreground sm:block">Features</a>
          <Link href="/login" className="p-2 text-sm font-medium hover:text-primary">Log in</Link>
          <Link href="/signup" className="rounded-full bg-foreground px-4 py-3 text-xs font-semibold text-background sm:px-5 sm:text-sm">Get started</Link>
        </nav>
      </header>
      <main id="main-content" className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <section className="ledger-hero">
          <div className="relative z-10">
            <h1 className="ledger-headline">Everyday money,<br /><em>in focus.</em></h1>
            <p className="cover-description mt-6 max-w-sm text-base leading-7">Track spending, split bills with friends, and see what’s left for the things you care about.</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
              <Link href="/signup" className="ledger-cta">Get started <ArrowUpRight size={17} aria-hidden /></Link>
              <a href="#features" className="flex min-h-11 items-center gap-2 text-sm hover:underline">Explore features <ArrowDown size={15} aria-hidden /></a>
            </div>
          </div>
          <div className="cover-chart"><MoneyPreview /></div>
        </section>
        <section id="features" className="scroll-mt-5 px-2 py-12 sm:px-4 lg:py-16">
          <h2 className="mb-7 text-3xl font-semibold tracking-[-.05em] sm:text-4xl">Your workspace</h2>
          <div className="grid gap-4 md:grid-cols-3">{features.map(({ icon: Icon, title, body, color, href }) => (
            <article key={title} className="feature-entry"><Link href={href} className="group block h-full rounded-2xl p-6 lg:p-7">
              <span className={`mb-6 inline-flex size-11 items-center justify-center rounded-2xl ${color}`}><Icon size={22} strokeWidth={1.6} aria-hidden /></span>
              <h3 className="flex items-center justify-between gap-2 text-xl font-semibold tracking-tight">{title}<ArrowUpRight className="size-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden /></h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
            </Link></article>
          ))}</div>
        </section>
        <SplitPreview />
      </main>
      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 border-t px-6 py-7 sm:px-12">
        <Brand /><p className="text-xs text-muted-foreground">Evenly is a personal finance tool, not a licensed financial adviser.</p>
        <Link href="/login" className="flex items-center gap-2 py-2 text-sm">Log in <ArrowRight size={14} aria-hidden /></Link>
      </footer>
    </div>
  );
}
