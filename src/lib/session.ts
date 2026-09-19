import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";

/** A session that has been checked, so `user.id` is known to be present. */
export type AuthenticatedSession = Session & { user: Session["user"] & { id: string } };

/**
 * Returns the signed-in user's session, or sends them to sign in.
 *
 * Middleware already turns anonymous visitors away, so reaching here without a
 * session means the token is signed correctly but its user is gone: a
 * different database, a restored backup, a deleted account. Those go to
 * /session-expired rather than /login, because the cookie has to be cleared
 * before /login will stay put; see that route for why.
 */
export async function requireSession(): Promise<AuthenticatedSession> {
  const session = await auth();
  if (!session?.user?.id) redirect("/session-expired");
  return session as AuthenticatedSession;
}
