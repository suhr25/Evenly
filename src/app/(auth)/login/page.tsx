import type { Metadata } from "next";
import { Suspense } from "react";
import { isGoogleAuthEnabled } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Log in | Evenly" };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm googleEnabled={isGoogleAuthEnabled} />
    </Suspense>
  );
}
