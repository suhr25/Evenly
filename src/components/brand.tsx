import Link from "next/link";
import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="Evenly home" className={cn("inline-flex w-fit items-center gap-2.5 rounded-lg text-xl font-semibold tracking-tight", className)}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
        <Wallet className="size-[19px]" aria-hidden strokeWidth={1.8} />
      </span>
      Evenly<span className="-ml-2 text-primary">.</span>
    </Link>
  );
}
