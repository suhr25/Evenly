import type { NextAuthConfig } from "next-auth";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
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
