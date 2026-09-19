"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Wallet } from "lucide-react";
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, SETTINGS_NAV_ITEM, type NavItem } from "@/components/layout/nav-items";

export function Sidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <SidebarRoot collapsible="icon" variant="sidebar" className="border-r">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm"
          >
            <Wallet className="size-4" aria-hidden strokeWidth={2} />
          </motion.span>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="truncate text-[0.9375rem] font-semibold tracking-[-0.02em]"
            >
              Evenly
            </motion.span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {NAV_ITEMS.map((item) => (
                <NavEntry
                  key={item.href}
                  item={item}
                  active={pathname.startsWith(item.href)}
                  collapsed={collapsed}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <NavEntry
            item={SETTINGS_NAV_ITEM}
            active={pathname.startsWith(SETTINGS_NAV_ITEM.href)}
            collapsed={collapsed}
          />
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </SidebarRoot>
  );
}

function NavEntry({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  if (item.disabled) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton disabled aria-disabled className="opacity-50">
          <Icon aria-hidden />
          <span>{item.label}</span>
        </SidebarMenuButton>
        <SidebarMenuBadge>Soon</SidebarMenuBadge>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem className="group/nav relative">
      {/*
        One shared indicator slides between items via layoutId, so changing
        page reads as the selection moving rather than one block disappearing
        and another appearing somewhere else.
      */}
      {active && (
        <motion.span
          layoutId="sidebar-active"
          transition={{ type: "spring", stiffness: 400, damping: 34 }}
          className="absolute inset-0 z-0 rounded-lg bg-brand-subtle"
        />
      )}
      {active && !collapsed && (
        <motion.span
          layoutId="sidebar-active-bar"
          transition={{ type: "spring", stiffness: 400, damping: 34 }}
          className="absolute left-0 top-1/2 z-10 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
        />
      )}

      <SidebarMenuButton
        isActive={active}
        tooltip={item.label}
        render={<Link href={item.href} />}
        className={cn(
          "relative z-10 h-9 gap-2.5 rounded-lg bg-transparent transition-colors duration-150",
          "hover:bg-sidebar-accent/70 active:bg-sidebar-accent",
          active && "bg-transparent font-medium text-accent-foreground hover:bg-transparent"
        )}
      >
        <motion.span
          // A small scale nudge on the icon is enough feedback. Moving the
          // whole row would fight the sliding indicator behind it.
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          className="flex shrink-0 items-center justify-center"
        >
          <Icon
            aria-hidden
            className={cn(
              "transition-colors duration-150",
              active ? "text-primary" : "text-muted-foreground group-hover/nav:text-foreground"
            )}
          />
        </motion.span>
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
