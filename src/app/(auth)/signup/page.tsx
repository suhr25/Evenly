import type { Metadata } from "next";
import { Suspense } from "react";
import { isGoogleAuthEnabled } from "@/lib/auth";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Sign up | Evenly" };

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm googleEnabled={isGoogleAuthEnabled} />
    </Suspense>
  );
}
