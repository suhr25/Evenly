"use client";

import { usePathname } from "next/navigation";

/**
 * Re-keys on navigation so each route's content fades in rather than
 * swapping instantly. Purely presentational: no layout shift, and the
 * reduced-motion guard in globals.css disables the animation entirely.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-fade">
      {children}
    </div>
  );
}
