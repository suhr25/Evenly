"use client";

import {
  Children,
  cloneElement,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, type Transition } from "framer-motion";
import { cn } from "@/lib/utils";

interface ChildProps {
  "data-id": string;
  className?: string;
  children?: ReactNode;
  [key: string]: unknown;
}

interface AnimatedBackgroundProps {
  /**
   * Each child must carry a unique `data-id`. That id is what the highlight
   * keys off, so the same layout animation can follow hover or selection.
   */
  children: ReactElement<ChildProps>[];
  defaultValue?: string;
  onValueChange?: (value: string | null) => void;
  className?: string;
  transition?: Transition;
  enableHover?: boolean;
}

/**
 * Renders a single shared highlight that slides between children using a
 * layout animation, rather than fading a separate background in and out on
 * each item. One element moves, so the motion reads as continuous.
 *
 * Honours prefers-reduced-motion through framer-motion's own reduced-motion
 * handling, which drops the transform animation but keeps the highlight.
 */
export function AnimatedBackground({
  children,
  defaultValue,
  onValueChange,
  className,
  transition,
  enableHover = false,
}: AnimatedBackgroundProps) {
  const [activeId, setActiveId] = useState<string | null>(defaultValue ?? null);
  const uniqueId = useId();

  function handleSetActiveId(id: string | null) {
    setActiveId(id);
    onValueChange?.(id);
  }

  return Children.map(children, (child, index) => {
    const id = child.props["data-id"];

    const interactionProps = enableHover
      ? {
          onMouseEnter: () => handleSetActiveId(id),
          onMouseLeave: () => handleSetActiveId(null),
        }
      : { onClick: () => handleSetActiveId(id) };

    return cloneElement<ChildProps>(
      child,
      {
        key: index,
        className: cn("relative inline-flex", child.props.className),
        "data-checked": activeId === id ? "true" : "false",
        ...interactionProps,
      },
      <>
        <AnimatePresence initial={false}>
          {activeId === id && (
            <motion.div
              layoutId={`background-${uniqueId}`}
              className={cn("absolute inset-0 z-0", className)}
              transition={transition}
              initial={{ opacity: defaultValue ? 1 : 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>
        <span className="z-10 w-full">{child.props.children}</span>
      </>
    );
  });
}
