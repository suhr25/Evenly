import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * The root path is an entry router, not a destination. Signed-in users go
 * straight to their dashboard; everyone else lands on the login screen, which
 * carries the product framing in its brand panel. There is no separate
 * marketing page to maintain.
 */
export default async function Home() {
  const session = await auth();
  redirect(session?.user ? "/dashboard" : "/login");
}
