"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Wallet, ArrowUpRight, Target } from "lucide-react";
import { Sidebar as SidebarRoot, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, SETTINGS_NAV_ITEM, type NavItem } from "@/components/layout/nav-items";

const SECTIONS = [
  { label: "WORKSPACE", paths: ["/dashboard", "/money-flow", "/cards"] },
  { label: "PLAN & SHARE", paths: ["/budgets", "/goals", "/groups", "/subscriptions"] },
  { label: "INTELLIGENCE", paths: ["/ai-chat"] },
];
export function Sidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <SidebarRoot collapsible="icon" variant="sidebar" className="app-sidebar border-r border-border/80">
      <SidebarHeader className="px-4 pb-7 pt-6 group-data-[collapsible=icon]:px-2">
        <Link href="/dashboard" aria-label="Evenly dashboard" className="flex items-center gap-2.5 rounded-xl">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[11px] bg-primary text-white shadow-sm">
            <Wallet className="size-4" aria-hidden strokeWidth={1.8} />
          </span>
          {!collapsed && <span className="text-lg font-semibold tracking-tight">Evenly<span className="text-primary">.</span>
          </span>}
        </Link>
        {!collapsed && <p className="mt-4 text-[10px] text-muted-foreground">Your personal finance workspace</p>}
      </SidebarHeader>
      <SidebarContent className="gap-4 px-2 group-data-[collapsible=icon]:px-0">
        {SECTIONS.map(({ label, paths }) => <SidebarGroup key={label} className="py-0">
          {!collapsed && <p className="mb-2 px-2 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground">{label}</p>}
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">{paths.map(path => NAV_ITEMS.find(item => item.href === path)!).map(item => <NavEntry key={item.href} item={item} active={pathname.startsWith(item.href)} />)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>)}
      </SidebarContent>
      <SidebarFooter className="gap-4 px-4 pb-5 group-data-[collapsible=icon]:px-2">
        {!collapsed && <Link href="/goals" className="group rounded-xl border border-primary/15 bg-brand-subtle/35 p-3.5 transition-colors hover:bg-brand-subtle/70">
          <span className="mb-3 flex items-center justify-between text-primary">
            <Target className="size-[17px]" strokeWidth={1.6} aria-hidden />
            <ArrowUpRight className="size-3.5 opacity-60" aria-hidden />
          </span>
          <p className="text-[11px] font-medium">Savings goals</p>
          <p className="mt-1 text-[10px] leading-5 text-muted-foreground">View your targets and contributions.</p>
        </Link>}
        <SidebarMenu>
          <NavEntry item={SETTINGS_NAV_ITEM} active={pathname.startsWith(SETTINGS_NAV_ITEM.href)} />
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </SidebarRoot>
  );
}
function NavEntry({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const reduceMotion = useReducedMotion();
  return (
    <SidebarMenuItem className="group/nav relative">
      {active && <motion.span layoutId="sidebar-active" transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 36 }} className="absolute inset-0 rounded-xl border border-primary/10 bg-brand-subtle/70" />}
      <SidebarMenuButton isActive={active} disabled={item.disabled} tooltip={item.label} render={<Link href={item.href} aria-current={active ? "page" : undefined} />} className={cn("relative z-10 h-10 gap-3 rounded-xl bg-transparent px-3 text-[13px] transition-colors hover:bg-sidebar-accent/70", active && "bg-transparent font-medium text-primary hover:bg-transparent")}>
        <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} aria-hidden strokeWidth={1.7} />
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
