"use client";

import { motion, type Transition } from "framer-motion";
import { cn } from "@/lib/utils";

interface BorderTrailProps {
  className?: string;
  size?: number;
  transition?: Transition;
  delay?: number;
  onAnimationComplete?: () => void;
  style?: React.CSSProperties;
}

/**
 * A light that travels around an element's border via SVG path offset motion.
 *
 * Marked aria-hidden: it conveys "work in progress", which the surrounding
 * region already announces through role="status". Duplicating that for screen
 * readers would just be noise.
 */
export function BorderTrail({
  className,
  size = 60,
  transition,
  delay,
  onAnimationComplete,
  style,
}: BorderTrailProps) {
  const defaultTransition: Transition = {
    repeat: Infinity,
    duration: 5,
    ease: "linear",
  };

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]"
    >
      <motion.div
        className={cn("absolute aspect-square bg-zinc-500", className)}
        style={{
          width: size,
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          ...style,
        }}
        animate={{ offsetDistance: ["0%", "100%"] }}
        transition={{ ...(transition ?? defaultTransition), delay }}
        onAnimationComplete={onAnimationComplete}
      />
    </div>
  );
}
