import {
  UtensilsCrossed,
  ShoppingBag,
  Car,
  Clapperboard,
  Receipt,
  HeartPulse,
  GraduationCap,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  UtensilsCrossed,
  ShoppingBag,
  Car,
  Clapperboard,
  Receipt,
  HeartPulse,
  GraduationCap,
  MoreHorizontal,
};

export function getCategoryIcon(name: string): LucideIcon {
  return CATEGORY_ICONS[name] ?? MoreHorizontal;
}
