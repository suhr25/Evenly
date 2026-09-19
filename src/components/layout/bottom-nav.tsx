"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, SETTINGS_NAV_ITEM } from "@/components/layout/nav-items";

const MOBILE_ITEMS = [...NAV_ITEMS.slice(0, 4), SETTINGS_NAV_ITEM];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80 md:hidden">
      {MOBILE_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname.startsWith(item.href);

        if (item.disabled) {
          return (
            <span
              key={item.href}
              className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground/40"
              aria-disabled
            >
              <Icon className="size-5" aria-hidden />
              {item.label}
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="size-5" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
