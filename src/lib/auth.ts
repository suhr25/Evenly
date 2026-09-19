import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";

export const isGoogleAuthEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
);

const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    authorize: async (credentials) => {
      const parsed = loginSchema.safeParse(credentials);
      if (!parsed.success) return null;

      const user = await prisma.user.findUnique({
        where: { email: parsed.data.email },
      });
      if (!user?.passwordHash) return null;

      const passwordValid = await bcrypt.compare(parsed.data.password, user.passwordHash);
      if (!passwordValid) return null;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      };
    },
  }),
];

if (isGoogleAuthEnabled) {
  providers.unshift(Google);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers,
  callbacks: {
    ...authConfig.callbacks,
    /**
     * A JWT outlives the row it points at. Pointing the app at a different
     * database, restoring a backup, or deleting an account all leave a
     * correctly signed cookie naming a user that is gone. Without this check
     * the session looks valid, so every page loads and then dies where it
     * reads the user, showing an unrecoverable error instead of asking the
     * visitor to sign in again.
     *
     * The lookup is a single indexed read on the primary key, against pages
     * that already issue several queries per render, so confirming on every
     * call is cheaper than the window an interval would leave open.
     */
    async jwt({ token, user }) {
      // Signing in: the user was just read from the database, so it exists.
      if (user?.id) {
        token.id = user.id;
        return token;
      }

      if (typeof token.id !== "string") return null;

      const stillExists = await prisma.user.findUnique({
        where: { id: token.id },
        select: { id: true },
      });
      // Returning null clears the session cookie and sends them to sign in.
      return stillExists ? token : null;
    },
    async session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
      }
      return session;
    },
  },
});
