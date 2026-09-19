"use client";

import { useRef } from "react";
import { AnimatedBackground } from "@/components/ui/animated-background";
import { cn } from "@/lib/utils";

export interface AnimatedTabItem {
  value: string;
  label: string;
}

interface AnimatedTabsProps {
  items: AnimatedTabItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  "aria-label"?: string;
}

/**
 * A segmented tab bar with a highlight that slides between tabs.
 *
 * The roving-tabindex and arrow-key handling are implemented here rather than
 * inherited from a primitive, because the sliding highlight needs to own the
 * markup. Dropping to plain buttons would have cost the tab semantics that
 * screen readers and keyboard users rely on, so they are reimplemented
 * explicitly: only the selected tab is tabbable, and arrows move selection.
 */
export function AnimatedTabs({
  items,
  value,
  onValueChange,
  className,
  "aria-label": ariaLabel,
}: AnimatedTabsProps) {
  const listRef = useRef<HTMLDivElement>(null);

  function handleKeyDown(e: React.KeyboardEvent) {
    const currentIndex = items.findIndex((i) => i.value === value);
    let nextIndex: number | null = null;

    if (e.key === "ArrowRight") nextIndex = (currentIndex + 1) % items.length;
    else if (e.key === "ArrowLeft") nextIndex = (currentIndex - 1 + items.length) % items.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = items.length - 1;

    if (nextIndex === null) return;
    e.preventDefault();
    const next = items[nextIndex];
    onValueChange(next.value);
    listRef.current
      ?.querySelector<HTMLButtonElement>(`[data-id="${next.value}"]`)
      ?.focus();
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg bg-muted/60 p-1",
        className
      )}
    >
      <AnimatedBackground
        defaultValue={value}
        onValueChange={(v) => v && onValueChange(v)}
        className="rounded-md bg-card shadow-xs"
        transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
      >
        {items.map((item) => (
          <button
            key={item.value}
            data-id={item.value}
            type="button"
            role="tab"
            aria-selected={value === item.value}
            tabIndex={value === item.value ? 0 : -1}
            className={cn(
              "rounded-md px-3 py-1.5 text-[0.8125rem] font-medium outline-none transition-colors duration-200",
              "focus-visible:ring-3 focus-visible:ring-ring/40",
              value === item.value
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </AnimatedBackground>
    </div>
  );
}
