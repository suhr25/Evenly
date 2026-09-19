import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CreditCard,
  ArrowLeftRight,
  Users,
  PiggyBank,
  Target,
  Repeat,
  Sparkles,
  Settings,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Not built yet: rendered as non-interactive so the IA is visible without linking to dead routes. */
  disabled?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Cards", href: "/cards", icon: CreditCard },
  { label: "Money Flow", href: "/money-flow", icon: ArrowLeftRight },
  { label: "Groups", href: "/groups", icon: Users },
  { label: "Budgets", href: "/budgets", icon: PiggyBank },
  { label: "Goals", href: "/goals", icon: Target },
  { label: "Subscriptions", href: "/subscriptions", icon: Repeat },
  { label: "AI Assistant", href: "/ai-chat", icon: Sparkles },
];

export const SETTINGS_NAV_ITEM: NavItem = {
  label: "Settings",
  href: "/settings",
  icon: Settings,
};
