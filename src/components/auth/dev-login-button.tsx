"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Development shortcut: signs in as the seeded demo account so the app can be
 * reloaded without retyping credentials on every change.
 *
 * Gated twice. The parent only renders it when NODE_ENV !== "production", and
 * it bails again here at click time. A one-click path into a signed-in session
 * is a straightforward authentication bypass, so it must never reach a
 * deployed build even if the render guard is ever refactored away.
 */
export function DevLoginButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (process.env.NODE_ENV === "production") return null;

  async function handleDevLogin() {
    if (process.env.NODE_ENV === "production") return;
    setLoading(true);
    const result = await signIn("credentials", {
      email: "demo@evenly.app",
      password: "password123",
      redirect: false,
    });
    setLoading(false);
    if (result?.error) return;
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="mt-6 rounded-lg border border-dashed border-warning/40 bg-warning-subtle/40 p-3">
      <p className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.07em] text-warning">
        Development only
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={handleDevLogin}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Zap className="size-4" aria-hidden />
        )}
        Skip to dashboard as demo user
      </Button>
    </div>
  );
}
