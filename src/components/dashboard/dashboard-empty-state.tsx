import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

export function DashboardEmptyState({ icon: Icon, title, description, href, action }: {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="dashboard-empty flex min-h-[200px] flex-col items-center justify-center px-4 py-7 text-center">
      <span className="mb-4 flex size-11 items-center justify-center rounded-2xl border border-border/70 bg-background text-muted-foreground">
        <Icon className="size-[19px]" strokeWidth={1.5} aria-hidden />
      </span>
      <p className="text-[13px] font-medium">{title}</p>
      <p className="mt-2 max-w-[260px] text-xs leading-6 text-muted-foreground">{description}</p>
      {href && action && <Link href={href} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-md text-xs font-medium text-primary underline-offset-4 hover:underline">{action}<ArrowUpRight className="size-3.5" aria-hidden />
      </Link>}
    </div>
  );
}
