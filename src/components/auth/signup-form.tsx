"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleButton } from "@/components/auth/google-button";
import { signupSchema } from "@/lib/validations/auth";

export function SignupForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = signupSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const body = await res.json();

    if (!res.ok) {
      setLoading(false);
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

    if (result?.error) {
      setError("Account created. Please log in.");
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="auth-reveal flex flex-col">
      <header className="mb-7">
        <h1 className="text-[1.5rem] font-semibold leading-tight tracking-[-0.025em]">
          Create your account
        </h1>
        <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
          Start tracking your money in minutes.
        </p>
      </header>
      <div className="flex flex-col">
        {googleEnabled && (
          <>
            <GoogleButton />
            <div className="my-6 flex items-center gap-3 text-[0.6875rem] font-medium uppercase tracking-[0.07em] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name" className="text-[0.8125rem]">Name</Label>
            <Input
              id="name"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email" className="text-[0.8125rem]">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" className="text-[0.8125rem]">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-negative-subtle px-3 py-2.5 text-[0.8125rem] text-negative"
            >
              <AlertCircle className="mt-px size-4 shrink-0" aria-hidden strokeWidth={2} />
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={loading} className="mt-1 w-full">
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Create account
          </Button>
        </form>
      </div>
      <p className="mt-7 text-center text-[0.8125rem] text-muted-foreground">
        Already have an account?&nbsp;
        <Link
          href={
            searchParams.get("callbackUrl")
              ? `/login?callbackUrl=${encodeURIComponent(searchParams.get("callbackUrl")!)}`
              : "/login"
          }
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
