import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForTokens } from "@/lib/integrations/gmail";

const STATE_COOKIE = "gmail_oauth_state";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));

  const settingsUrl = (status: string) => new URL(`/settings?gmail=${status}`, req.url);

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  const jar = await cookies();
  const expectedState = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);

  if (error) return NextResponse.redirect(settingsUrl(error === "access_denied" ? "denied" : "error"));
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(settingsUrl("error"));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await prisma.gmailConnection.upsert({
      where: { userId: session.user.id },
      update: {
        emailAddress: tokens.emailAddress,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      },
      create: {
        userId: session.user.id,
        emailAddress: tokens.emailAddress,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      },
    });
    return NextResponse.redirect(settingsUrl("connected"));
  } catch (err) {
    console.error("[gmail-oauth-callback]", err);
    return NextResponse.redirect(settingsUrl("error"));
  }
}
