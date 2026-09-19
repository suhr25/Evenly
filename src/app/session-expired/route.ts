import { NextResponse } from "next/server";
import { signOut } from "@/lib/auth";

/**
 * Clears a session cookie whose user no longer exists, then sends the visitor
 * to sign in.
 *
 * This needs to be a route handler rather than a redirect straight to /login,
 * because middleware runs on the edge without database access. All it can see
 * is a correctly signed token, so it reads the visitor as logged in and
 * bounces them off /login back to the dashboard, which redirects to /login
 * again. The only way out of that loop is to remove the cookie, and a route
 * handler is the one place in this path that can set response headers.
 *
 * signOut does the removal rather than a hand-written cookie delete, so the
 * cookie name, chunking and security attributes stay Auth.js's problem.
 */
export async function GET(request: Request) {
  await signOut({ redirect: false });
  return NextResponse.redirect(new URL("/login", request.url));
}
