import type { Metadata } from "next";
import { Suspense } from "react";
import { isGoogleAuthEnabled } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

/*
 * Rendered per request, not prerendered at build.
 *
 * Whether Google sign-in is available depends on environment variables, and a
 * statically prerendered page freezes that answer into HTML at build time. On
 * Amplify the build container and the running server do not necessarily see
 * the same environment, so the button vanished from a deployment that was
 * configured correctly.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Log in | Evenly" };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm googleEnabled={isGoogleAuthEnabled()} />
    </Suspense>
  );
}
