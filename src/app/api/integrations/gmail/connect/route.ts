import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGmailAuthUrl, isGmailSyncEnabled } from "@/lib/integrations/gmail";

const STATE_COOKIE = "gmail_oauth_state";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));
  if (!isGmailSyncEnabled) {
    return NextResponse.redirect(new URL("/settings?gmail=not_configured", req.url));
  }

  const state = randomBytes(24).toString("hex");
  const jar = await cookies();
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(getGmailAuthUrl(state));
}
