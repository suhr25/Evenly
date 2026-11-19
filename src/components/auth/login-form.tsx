"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { authDestination } from "@/lib/auth-destination";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, Mail, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleButton } from "@/components/auth/google-button";
import { DevLoginButton } from "@/components/auth/dev-login-button";

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {

  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const code = searchParams.get("error");
  const signInError = !code ? null : code === "OAuthAccountNotLinked"
    ? "That Google sign-in did not finish. Select Continue with Google to try again."
    : code === "AccessDenied" ? "Access was denied. Try again, or use a different account."
      : "That sign-in did not complete. Please try again.";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const reduceMotion = useReducedMotion();
  const busy = loading || googleLoading || signedIn;
  const [dismissedOAuthError, setDismissedOAuthError] = useState(false);
  const visibleError = error ?? (dismissedOAuthError ? null : signInError);
  const requestedCallback = searchParams.get("callbackUrl");
  const callbackUrl = authDestination(requestedCallback, typeof window === "undefined" ? "https://evenly.local" : window.location.origin);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setDismissedOAuthError(true);
    setLoading(true);
    try {
      const result = await signIn("credentials", { email: email.trim(), password, redirect: false });
      if (!result?.ok || result.error) {
        setError(result?.error !== "CredentialsSignin" ? "Sign-in is temporarily unavailable. Please try again shortly." : "That email and password don’t match. Check your details and try again.");
        return;
      }
      setSignedIn(true);
      window.location.replace(callbackUrl);
    } catch {
      setError("We couldn’t connect. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-refined flex flex-col">
      <header className="login-stage login-stage-1 mb-8">
        <h1 className="text-[2.15rem] font-semibold leading-tight tracking-[-0.045em]">Welcome <em>back.</em></h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Sign in to see your spending and shared balances.</p>
      </header>

      {googleEnabled && <div className="login-stage login-stage-2">
        <GoogleButton callbackUrl={callbackUrl} disabled={loading || signedIn} onLoadingChange={setGoogleLoading} />
        <div className="my-6 flex items-center gap-4 text-[10px] text-muted-foreground"><span className="h-px flex-1 bg-border" />or sign in with email<span className="h-px flex-1 bg-border" /></div>
      </div>}

      <form onSubmit={handleSubmit} className="login-stage login-stage-3 flex flex-col gap-5" aria-busy={busy}>
        <div className="login-field flex flex-col gap-2.5">
          <Label htmlFor="email" className="text-xs font-medium">Email address</Label>
          <div className="login-input-wrap relative">
            <Mail className="login-input-icon pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground/65" strokeWidth={1.7} aria-hidden />
            <Input
              id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
              placeholder="you@example.com" required disabled={busy}
              aria-invalid={visibleError ? true : undefined} aria-describedby={visibleError ? "login-error" : undefined}
              value={email} onChange={e => { setEmail(e.target.value); setError(null); setDismissedOAuthError(true); }}
              className="login-input h-[50px] rounded-xl pl-10 pr-4 text-base md:text-sm"
            />
          </div>
        </div>
        <div className="login-field flex flex-col gap-2.5">
          <Label htmlFor="password" className="text-xs font-medium">Password</Label>
          <div className="login-input-wrap relative">
            <LockKeyhole className="login-input-icon pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground/65" strokeWidth={1.7} aria-hidden />
            <Input
              id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password"
              placeholder="Enter your password" required disabled={busy}
              aria-invalid={visibleError ? true : undefined} aria-describedby={[visibleError ? "login-error" : "", capsLock ? "caps-lock-hint" : ""].filter(Boolean).join(" ") || undefined}
              value={password} onChange={e => { setPassword(e.target.value); setError(null); setDismissedOAuthError(true); }}
              onKeyDown={e => setCapsLock(e.getModifierState("CapsLock"))}
              onKeyUp={e => setCapsLock(e.getModifierState("CapsLock"))}
              onBlur={() => setCapsLock(false)}
              className="login-input h-[50px] rounded-xl pl-10 pr-12 text-base md:text-sm"
            />
            <button type="button" disabled={busy} onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="login-visibility absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-50">
              {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          </div>
          {capsLock && <p id="caps-lock-hint" role="status" className="text-[11px] text-warning">Caps Lock is on.</p>}
        </div>

        <AnimatePresence initial={false}>
          {visibleError && <motion.div key="error" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.2 }} className="overflow-hidden">
            <p id="login-error" role="alert" className="flex items-start gap-2 rounded-xl border border-negative/15 bg-negative-subtle px-3 py-3 text-xs leading-5 text-negative"><AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />{visibleError}</p>
          </motion.div>}
        </AnimatePresence>

        <Button type="submit" disabled={busy} className="login-submit mt-1 h-[50px] w-full justify-center gap-3 rounded-xl px-5 text-sm" data-success={signedIn || undefined}>
          {signedIn ? <Check className="size-4" aria-hidden /> : loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          <span aria-live="polite">{signedIn ? "Signed in. Taking you home…" : loading ? "Signing you in…" : "Sign in to Evenly"}</span>
          {!loading && !signedIn && <ArrowRight className="login-submit-arrow size-4" aria-hidden />}
        </Button>
      </form>

      <div className="login-stage login-stage-4 mt-4">
        <p className="flex flex-wrap items-center justify-center gap-x-1.5 text-xs text-muted-foreground">New to Evenly?
          <Link href={requestedCallback ? `/signup?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/signup"} className="login-create inline-flex min-h-9 items-center gap-1.5 rounded font-medium text-primary underline-offset-4 hover:underline">Create an account<ArrowRight className="size-3" aria-hidden /></Link>
        </p>
      </div>
      {process.env.NODE_ENV !== "production" && <details className="login-dev mt-5 text-xs text-muted-foreground"><summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded py-2 hover:text-foreground">Developer access<ChevronDown className="size-3" aria-hidden /></summary><DevLoginButton destination={callbackUrl} /></details>}
    </div>
  );
}
