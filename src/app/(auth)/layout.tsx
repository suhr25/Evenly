import Link from "next/link";
import { ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { Scanner } from "@/components/ui/scanner";
import { FoldText } from "@/components/ui/fold-text";

const PROOF_POINTS = [
  {
    icon: Sparkles,
    title: "Transactions that log themselves",
    body: "Evenly reads your bank alerts and stages them for one-tap confirmation.",
  },
  {
    icon: Wallet,
    title: "Know which card to reach for",
    body: "Recommendations come only from the cards you actually hold.",
  },
  {
    icon: ShieldCheck,
    title: "Nothing posted without you",
    body: "Detected activity never touches a budget until you confirm it.",
  },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/*
        Brand panel. Desktop only: on small screens the form should own the
        viewport rather than make people scroll past marketing to sign in.
      */}
      <aside className="auth-reveal relative hidden overflow-hidden border-r bg-card lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0">
          <Scanner
            color1="#5B4BF0"
            color2="#A78BFA"
            color3="#FFFFFF"
            speed={0.32}
            sweepSpeed={0.16}
            sweepWidth={2.1}
            sweepFalloff={7}
            scale={1.9}
            bandDensity={9}
            glow={0.2}
            brightness={0.85}
            vignette={0.55}
            grainIntensity={0.03}
            opacity={0.8}
            mouseInteraction={false}
          />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card via-card/45 to-transparent"
        />

        <Link href="/" className="relative flex w-fit items-center gap-3 rounded-md">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Wallet className="size-[1.125rem]" aria-hidden strokeWidth={2} />
          </span>
          <FoldText
            text="Evenly"
            splitBy="char"
            hinge="left"
            trigger="mount"
            duration={0.6}
            stagger={0.05}
            ease="power3.out"
            perspective={600}
            creaseShading={0.5}
            fontSize={28}
            fontWeight={600}
          />
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-[1.75rem] font-semibold leading-[1.2] tracking-[-0.025em]">
            Your money, already sorted by the time you open the app.
          </h2>
          <ul className="mt-9 flex flex-col gap-6">
            {PROOF_POINTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3.5">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-brand-subtle text-primary">
                  <Icon className="size-3.5" aria-hidden strokeWidth={2} />
                </span>
                <div className="space-y-1">
                  <p className="text-[0.8125rem] font-medium leading-none">{title}</p>
                  <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-muted-foreground">
          Evenly is a personal finance tool, not a licensed financial adviser.
        </p>
      </aside>

      <main className="flex flex-col items-center justify-center px-5 py-10 sm:px-8">
        <Link
          href="/"
          className="mb-9 flex items-center gap-2.5 text-[0.9375rem] font-semibold tracking-[-0.02em] lg:hidden"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="size-4" aria-hidden strokeWidth={2} />
          </span>
          Evenly
        </Link>
        <div className="auth-panel-in w-full max-w-[22rem]">{children}</div>
      </main>
    </div>
  );
}
