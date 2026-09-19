"use client";

import { useEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/money";

interface AnimatedMoneyProps {
  amount: string | number;
  currency: string;
  className?: string;
  /** Milliseconds for the full count. Kept short so the figure is readable fast. */
  duration?: number;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Counts a currency figure up to its value on mount and whenever it changes.
 * The real value is rendered immediately for SSR and for anyone who prefers
 * reduced motion, so the number is never wrong or missing, only animated.
 */
export function AnimatedMoney({
  amount,
  currency,
  className,
  duration = 650,
}: AnimatedMoneyProps) {
  const target = Number(amount) || 0;
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced || fromRef.current === target) {
      setDisplay(target);
      fromRef.current = target;
      return;
    }

    const from = fromRef.current;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setDisplay(from + (target - from) * easeOut(progress));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      fromRef.current = target;
    };
  }, [target, duration]);

  return (
    <span className={className} suppressHydrationWarning>
      {formatMoney(display.toFixed(2), currency)}
    </span>
  );
}
