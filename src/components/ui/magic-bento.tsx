"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const DEFAULT_SPOTLIGHT_RADIUS = 320;

/**
 * Proximity-driven border glow across a grid, adapted from React Bits'
 * MagicBento.
 *
 * Three deliberate departures from the original, all because this wraps real
 * data rather than a marketing demo:
 *
 *  - No tilt or magnetism. Cards that rotate or drift toward the cursor are
 *    harder to read and harder to click, which is a bad trade on a surface
 *    listing financial products.
 *  - No text auto-hide. Clamping a card's name on hover hides the exact
 *    information someone is scanning for.
 *  - The spotlight is scoped to this grid instead of a fixed element appended
 *    to document.body. A body-level overlay at z-index 200 with
 *    mix-blend-mode would sit on top of dialogs and dropdowns.
 *
 * What is kept is the part that earns its place: the glow that tracks the
 * pointer across the whole grid, so neighbouring cards respond too.
 */
export function MagicBentoGrid({
  children,
  className,
  spotlightRadius = DEFAULT_SPOTLIGHT_RADIUS,
  glowColor = "124, 107, 245",
}: {
  children: ReactNode;
  className?: string;
  spotlightRadius?: number;
  glowColor?: string;
}) {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const proximity = spotlightRadius * 0.5;
    const fadeDistance = spotlightRadius * 0.75;
    let frame = 0;

    const handleMove = (e: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const cards = grid.querySelectorAll<HTMLElement>("[data-bento-card]");
        cards.forEach((card) => {
          const rect = card.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const distance = Math.max(
            0,
            Math.hypot(e.clientX - cx, e.clientY - cy) - Math.max(rect.width, rect.height) / 2
          );

          let intensity = 0;
          if (distance <= proximity) intensity = 1;
          else if (distance <= fadeDistance) {
            intensity = (fadeDistance - distance) / (fadeDistance - proximity);
          }

          card.style.setProperty("--glow-x", `${((e.clientX - rect.left) / rect.width) * 100}%`);
          card.style.setProperty("--glow-y", `${((e.clientY - rect.top) / rect.height) * 100}%`);
          card.style.setProperty("--glow-intensity", intensity.toFixed(3));
        });
      });
    };

    const handleLeave = () => {
      grid
        .querySelectorAll<HTMLElement>("[data-bento-card]")
        .forEach((c) => c.style.setProperty("--glow-intensity", "0"));
    };

    // Listening on the grid rather than the document keeps the work scoped to
    // the one surface that uses it.
    grid.addEventListener("pointermove", handleMove);
    grid.addEventListener("pointerleave", handleLeave);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      grid.removeEventListener("pointermove", handleMove);
      grid.removeEventListener("pointerleave", handleLeave);
    };
  }, [spotlightRadius]);

  return (
    <div
      ref={gridRef}
      className={cn("bento-grid", className)}
      style={{ "--glow-color": glowColor } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

export function MagicBentoCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div data-bento-card className={cn("bento-card", className)}>
      {children}
    </div>
  );
}
