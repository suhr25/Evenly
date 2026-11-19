"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, SETTINGS_NAV_ITEM } from "@/components/layout/nav-items";
import { signOut } from "next-auth/react";
import { LogOut, Settings, Wallet, ChevronRight, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/layout/theme-toggle";

interface TopbarProps {
  user: { name?: string | null; email?: string | null; image?: string | null };
}

export function Topbar({ user }: TopbarProps) {
  const pathname = usePathname();
  const currentPage = [...NAV_ITEMS, SETTINGS_NAV_ITEM].find(item => pathname.startsWith(item.href))?.label ?? "Workspace";
  const words = user.name?.trim().split(/\s+/).filter(Boolean);
  const initials = words?.length ? (words[0][0] + (words.length > 1 ? words.at(-1)![0] : "")).toUpperCase() : (user.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <header className="app-topbar sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/80 bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 md:px-7">
      <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight md:hidden">
        <Wallet className="size-5 text-primary" aria-hidden />
        Evenly
      </Link>
      <div className="hidden items-center gap-5 md:flex">
        <Tooltip>
          <TooltipTrigger render={<SidebarTrigger className="-ml-1" />} />
          <TooltipContent side="right">Toggle sidebar (Ctrl+B)</TooltipContent>
        </Tooltip>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Workspace</span>
          <ChevronRight className="size-3 text-muted-foreground/50" aria-hidden />
          <span className="text-sm font-semibold">{currentPage}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Open account menu" className="ml-1 flex items-center gap-2.5 rounded-xl border border-transparent p-1.5 text-left outline-none transition-colors hover:border-border hover:bg-card focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="size-8 border border-primary/15">
              <AvatarImage src={user.image ?? undefined} alt="" />
              <AvatarFallback className="bg-brand-subtle text-[11px] font-medium text-primary">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-32 sm:block">
              <span className="block truncate text-[11px] font-medium">{user.name ?? "Your account"}</span>
              <span className="mt-0.5 block text-[9px] text-muted-foreground">Personal account</span>
            </span>
            <ChevronDown className="hidden size-3 text-muted-foreground sm:block" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="truncate">
                {user.name ?? user.email}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={
                <Link href="/settings">
                  <Settings className="size-4" aria-hidden />
                  Settings
                </Link>
              }
            />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
              <LogOut className="size-4" aria-hidden />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
