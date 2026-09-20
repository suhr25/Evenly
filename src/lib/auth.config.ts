import type { NextAuthConfig } from "next-auth";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  // Reached while still holding a signed cookie, so it has to stay public or
  // middleware would send the visitor back to the dashboard that rejected them.
  "/session-expired",
  "/offline",
  "/manifest.webmanifest",
  "/sw.js",
  "/icon",
  "/apple-icon",
  "/pwa-icon-192",
  "/pwa-icon-512",
];

/**
 * Edge-safe config: no Prisma adapter, no bcrypt, no Credentials provider,
 * only what middleware needs to verify the JWT and redirect. The full config
 * (adapter + providers) lives in auth.ts and is only imported by route
 * handlers / server components, which run in the Node.js runtime.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
    /*
     * Auth.js's own error page is not worth showing anyone. It maps most
     * failures, including an expired OAuth attempt, to "Configuration" and
     * announces "There is a problem with the server configuration", which
     * sends the reader looking for a broken setting when the usual cause is a
     * sign-in that simply took too long or was retried from an old tab.
     * Failures come back to the login form instead, which can say something
     * true and offer the obvious next step. The real detail stays in the
     * server log, where it belongs.
     */
    error: "/login",
  },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const isPublic =
        PUBLIC_PATHS.includes(nextUrl.pathname) ||
        nextUrl.pathname.startsWith("/api/auth") ||
        nextUrl.pathname.startsWith("/invite/") ||
        nextUrl.pathname.startsWith("/api/invites/");

      if (isLoggedIn && (nextUrl.pathname === "/login" || nextUrl.pathname === "/signup")) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      if (!isPublic && !isLoggedIn) {
        return false;
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
