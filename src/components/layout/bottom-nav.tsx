"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis } from "lucide-react";
import { NAV_ITEMS, SETTINGS_NAV_ITEM } from "@/components/layout/nav-items";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const primary = NAV_ITEMS.slice(0, 4);
const more = [...NAV_ITEMS.slice(4), SETTINGS_NAV_ITEM];
const navClass = "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium text-muted-foreground hover:bg-muted";
const iconClass = "flex h-6 w-10 items-center justify-center rounded-full";

export function BottomNav() {
  const pathname = usePathname();
  const matches = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const moreActive = more.some(item => matches(item.href));

  return (
    <nav aria-label="Primary navigation" className="app-mobile-nav fixed inset-x-0 bottom-0 z-40 flex border-t bg-card px-1 md:hidden">
      {primary.map(({ href, label, icon: Icon, disabled }) => {
        if (disabled) return null;
        const active = matches(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={navClass}>
            <span className={iconClass + (active ? " bg-brand-subtle text-primary" : "")}><Icon size={18} aria-hidden /></span>
            {label}
          </Link>
        );
      })}
      <DropdownMenu>
        <DropdownMenuTrigger className={navClass} aria-label="More destinations">
          <span className={iconClass + (moreActive ? " bg-brand-subtle text-primary" : "")}><Ellipsis size={18} aria-hidden /></span>
          More
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" sideOffset={8} className="w-52">
          {more.map(({ href, label, icon: Icon, disabled }) => (
            <DropdownMenuItem key={href} disabled={disabled} className="min-h-11" render={<Link href={href} aria-current={matches(href) ? "page" : undefined} />}>
              <Icon size={17} aria-hidden />{label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
